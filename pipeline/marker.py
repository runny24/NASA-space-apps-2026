"""The marker test: which polarization's harvest pairs draw the harvest map (harvest.marker, HH or HV).

The rule was fixed before any fire data was analysed (PROGRESS.md, "The marker rule", Saturday 14 November 2026,
16:37 CT): stubble can only burn after the crop is cut, so the polarization that still calls more of the burning
rice "not harvested" sees the harvest late. docs/METHODS.md, section 6, "Choosing the marker", says the same in
plain words. The steps, each a small function with its own test (pipeline/tests/test_marker.py):

  1. window     detections with UTC dates from passes[2] (the first pass at which a harvest pair can end) to the
                fires block's end, both included; the test is made only when every day of it was fetched (rule
                item 2 takes every detection of the window, and a day not fetched is unknown, not empty)
  2. cells      the test's rice cells: a rice class (a harvest pair, no harvest seen, fell before) in BOTH bands
                of the class raster, centre inside the site box; HH and HV are scored on the same cells
  3. weigh      each detection's 375 m square, shared among the cells by area exactly as the fire bars share it
                (fires.square_cells): r = the part on the test's rice cells; s = the part on the cells a
                polarization still calls "not harvested" on the detection's UTC date
  4. scores     per polarization, sum(s) / sum(r) over the detections with a part on rice
  5. interval   HV score minus HH score; a bootstrap over the UTC days of those detections, 2000 replicates,
                seed 20261114, its 2.5th and 97.5th percentiles
  6. decide     an interval above zero: HH; below zero: HV (rule item 3). Otherwise, or with fewer than two days:
                the polarization with more of the test's rice cells in a harvest pair by the last pass (rule
                item 4); equal counts leave the choice to the team

Nothing here reads files or the network: pipeline/stages.py (marker_site) reads the analysis and the detections,
and writes work/<site>/analysis/marker.json.
"""

from __future__ import annotations

import datetime as dt
import hashlib
import json
from bisect import bisect_right

import numpy as np
from affine import Affine

from pipeline import fires as fires_mod
from pipeline.harvest import POLARIZATIONS, Codes, date_text

RULE = ("PROGRESS.md, \"The marker rule\", fixed on Saturday 14 November 2026 at 16:37 CT, before any fire data "
        "was analysed")
# The first pass at which a harvest pair can end: pair 1 runs from passes[1] to passes[2].
FIRST_END_PASS = 2
SEED = 20261114
REPLICATES = 2000
PERCENTILES = (2.5, 97.5)
PERCENTILE_METHOD = "linear"
MIN_DAYS = 2  # an interval over days needs at least two of them
# A weight below this share of the 375 m square (about 1e-4 m2) is 0: the overlaps are computed from projected
# coordinates near 1e6 m, whose rounding alone leaves parts of about 1e-10 m along a cell edge the square only
# touches. Such a detection has no part on rice and is not used.
ZERO_WEIGHT = 1e-9

METHOD = (
    "Rule fixed before any fire data was analysed (PROGRESS.md, 'The marker rule'). Window: VIIRS detections "
    "inside the site box with UTC dates from the third pass of the harvest analysis (the first at which a harvest "
    "pair can end) to the end of the fires block, both included; the test is made only when every day of the window "
    "has been fetched. Rice cells of the test: cells whose centres lie inside the site box and whose class is a rice "
    "class (a harvest pair, no harvest seen, fell before) in both HH and HV, so that both are scored on the same "
    "cells and the same detections. Each detection stands for a 375 m square centred on it and aligned with the "
    "product grid, shared among the cells by area as in the fire bars; its weight r is the share of the square on "
    "the test's rice cells, and a detection with no part on them (r below 1e-9) is not used. For each "
    "polarization, s is the share of the square on test rice cells that the "
    "polarization still calls not harvested on the detection's UTC date: no harvest seen, or a harvest pair whose "
    "later pass comes after that date (a pass on that date counts as on or before it); cells that fell before the "
    "first harvest pass count in r and never in s. Score of a polarization: the sum of s over the sum of r of the "
    "detections used. Difference: HV score minus HH score. Its 95 % interval: the 2.5th and 97.5th percentiles "
    "(numpy, method linear) of the difference over 2000 bootstrap replicates; each replicate draws as many of the "
    "UTC days of the detections used as there are, with replacement (numpy.random.default_rng(20261114), one call "
    "integers(0, days, size=days) per replicate, the days in date order), and takes every detection used of each "
    "day drawn as often as the day was drawn. Decision: an interval above zero gives HH and one below zero HV "
    "(rule item 3); otherwise, or with fewer than 2 days, the polarization that gives a harvest pair (not fell "
    "before) to more of the test's rice cells by the last pass (rule item 4); equal counts leave the choice to the "
    "team.")


def constants() -> dict:
    """Every fixed number of the test, for the record of inputs and marker.json."""
    return {"first_end_pass": FIRST_END_PASS, "seed": SEED, "replicates": REPLICATES,
            "percentiles": list(PERCENTILES), "percentile_method": PERCENTILE_METHOD, "min_days": MIN_DAYS,
            "zero_weight": ZERO_WEIGHT, "square_m": fires_mod.PIXEL_M}


# Step 1: window --------------------------------------------------------------------------------------------

def window(passes, fires_end: str) -> tuple[str, str]:
    """(first, last) UTC date of the detections the test takes, both included: passes[2] to the fires block's end.
    Before passes[2] no pass can have shown a harvest pair, so earlier detections cannot tell HH from HV."""
    if len(passes) <= FIRST_END_PASS:
        raise ValueError(f"the marker test needs at least {FIRST_END_PASS + 1} passes, got {len(passes)}")
    first = passes[FIRST_END_PASS]
    if fires_end < first:
        raise ValueError(f"the fires block ends on {fires_end}, before {first}, the third harvest pass and the first "
                         "at which a harvest pair can end, so the marker test's window holds no day: the fires block "
                         f"must run to {first} or later")
    return first, fires_end


def in_window(detections: list[dict], first: str, last: str) -> list[dict]:
    """The detections whose UTC date lies from first to last, both included (ISO dates compare as text)."""
    return [d for d in detections if first <= d["date"] <= last]


def covered(first: str, last: str, fetched: list[str]) -> tuple[str, str] | None:
    """The part of the window [first, last] that the fetched days (detections.json's `asked`) cover; None when
    they cover none of it."""
    a, b = max(first, fetched[0]), min(last, fetched[1])
    return (a, b) if a <= b else None


def shift(day: str, days: int) -> str:
    """The ISO date `days` days after `day` (before it when negative)."""
    return (dt.date.fromisoformat(day) + dt.timedelta(days=days)).isoformat()


def missing(first: str, last: str, fetched: list[str]) -> str | None:
    """None when the fetched days (detections.json's `asked`) hold every day of the window [first, last]; otherwise
    which of its days were not fetched, in words. Rule item 2 takes every detection of its window, and the detections
    of a day not fetched are unknown, not absent, so the test is never made on part of the window: the marker stage
    stops, and export leaves out a result made so."""
    span = covered(first, last, fetched)
    if span == (first, last):
        return None
    if span is None:
        gaps = [(first, last)]
    else:
        gaps = [g for g in ((first, shift(span[0], -1)), (shift(span[1], 1), last)) if g[0] <= g[1]]
    days = " and ".join(a if a == b else f"{a} to {b}" for a, b in gaps)
    return (f"the marker rule's window runs from {first} to {last}, but detections.json holds the days {fetched[0]} "
            f"to {fetched[1]}, so these days of the window were not fetched: {days}")


# Step 2: cells ----------------------------------------------------------------------------------------------

def rice(classes: np.ndarray, codes: Codes) -> np.ndarray:
    """Cells of a rice class: a harvest pair, no harvest seen or fell before (Codes 1 to fell_before)."""
    return (classes >= 1) & (classes <= codes.fell_before)


def scored_cells(hh: np.ndarray, hv: np.ndarray, codes: Codes, region: np.ndarray) -> np.ndarray:
    """The test's rice cells: a rice class in both bands and inside the region (centres in the site box). A cell
    without a class in either band (0, no data) or not rice in either carries no weight, for both."""
    return rice(hh, codes) & rice(hv, codes) & region


def harvest_end(classes: np.ndarray, codes: Codes, n_passes: int) -> np.ndarray:
    """Per cell, the index in the passes of the pass at which its harvest pair ends: k + 1 for harvest pair k (it
    runs from passes[k] to passes[k + 1]); n_passes, after every pass, for no harvest seen; -1, before every pass,
    for fell before and for every other class (the test's cells are rice, so only fell before matters)."""
    out = np.full(classes.shape, -1, dtype=np.int32)
    pair = (classes >= 1) & (classes <= codes.harvest_pairs)
    out[pair] = classes[pair].astype(np.int32) + 1
    out[classes == codes.no_harvest] = n_passes
    return out


def passes_by(passes, day: str) -> int:
    """How many passes fall on or before `day`: a pass on the detection's own date counts as on or before it."""
    return bisect_right(list(passes), day)


def standing(ends: np.ndarray, passes_done: int) -> np.ndarray:
    """Cells still called "not harvested" once `passes_done` passes are in: the pass that ends their harvest pair
    (passes[ends]) comes later. No harvest seen is always standing; fell before never."""
    return ends >= passes_done


def harvest_pair_counts(classes: dict[str, np.ndarray], scored: np.ndarray, codes: Codes) -> dict[str, int]:
    """Test rice cells with a harvest pair (1 to harvest_pairs, not fell before) by the last pass, per
    polarization: rule item 4's measure."""
    return {p: int((scored & (classes[p] >= 1) & (classes[p] <= codes.harvest_pairs)).sum()) for p in POLARIZATIONS}


# Step 3: weigh ----------------------------------------------------------------------------------------------

def weigh(xs, ys, dates: list[str], classes: dict[str, np.ndarray], codes: Codes, passes, transform: Affine,
          region: np.ndarray) -> dict:
    """Per detection (at x, y in the class grid's projection, on UTC date dates[i]): r, the share of its 375 m
    square on the test's rice cells, and for each polarization s, the share on those of them that the
    polarization still calls not harvested on that date. The square and its sharing among cells are the fire
    bars' (fires.square_cells)."""
    fires_mod.require_north_up(transform)
    shape = region.shape
    for p in POLARIZATIONS:
        if classes[p].shape != shape:
            raise ValueError(f"the {p} classes {classes[p].shape} and the region {shape} differ in shape")
    scored = scored_cells(classes["HH"], classes["HV"], codes, region)
    ends = {p: harvest_end(classes[p], codes, len(passes)) for p in POLARIZATIONS}
    n = len(dates)
    r = np.zeros(n)
    s = {p: np.zeros(n) for p in POLARIZATIONS}
    for i, (x, y, day) in enumerate(zip(xs, ys, dates, strict=True)):
        r0, c0, w = fires_mod.square_cells(x, y, transform, shape)
        if w.size == 0:
            continue
        rows, cols = slice(r0, r0 + w.shape[0]), slice(c0, c0 + w.shape[1])
        on = scored[rows, cols]
        r[i] = float(w[on].sum())
        done = passes_by(passes, day)
        for p in POLARIZATIONS:
            s[p][i] = float(w[on & standing(ends[p][rows, cols], done)].sum())
    return {"rice": r, "standing": s, "scored": scored}


def used(rice_weights: np.ndarray) -> np.ndarray:
    """Detections with a part on the test's rice cells. The others (weight 0) are not used."""
    return np.asarray(rice_weights) > ZERO_WEIGHT


# Steps 4 and 5: scores and interval -------------------------------------------------------------------------

def by_day(dates: list[str], rice_weights: np.ndarray, standing_weights: dict[str, np.ndarray],
           use: np.ndarray) -> tuple[list[str], np.ndarray, dict[str, np.ndarray], list[int]]:
    """The UTC days of the detections used, in date order, with each day's sum of r, of s per polarization, and
    its number of detections used: the units the bootstrap draws."""
    days = sorted({d for d, u in zip(dates, use, strict=True) if u})
    index = {d: k for k, d in enumerate(days)}
    r = np.zeros(len(days))
    s = {p: np.zeros(len(days)) for p in POLARIZATIONS}
    n = [0] * len(days)
    for i, (d, u) in enumerate(zip(dates, use, strict=True)):
        if not u:
            continue
        k = index[d]
        r[k] += rice_weights[i]
        n[k] += 1
        for p in POLARIZATIONS:
            s[p][k] += standing_weights[p][i]
    return days, r, s, n


def score(standing_total: float, rice_total: float) -> float | None:
    """The share of the rice weight a polarization still calls standing; None without rice weight."""
    return standing_total / rice_total if rice_total > 0 else None


def bootstrap(rice_by_day: np.ndarray, standing_by_day: dict[str, np.ndarray], replicates: int = REPLICATES,
              seed: int = SEED) -> np.ndarray:
    """HV score minus HH score in each replicate. A replicate draws len(days) day indices with replacement
    (rng.integers(0, days, size=days), one call per replicate, in order) and recomputes both scores from every
    detection used of each day drawn, a day counting as often as it was drawn."""
    n = len(rice_by_day)
    if n == 0:
        raise ValueError("the bootstrap needs at least one day")
    rng = np.random.default_rng(seed)
    out = np.empty(replicates)
    for b in range(replicates):
        counts = np.bincount(rng.integers(0, n, size=n), minlength=n)
        total = float(counts @ rice_by_day)
        out[b] = float(counts @ standing_by_day["HV"]) / total - float(counts @ standing_by_day["HH"]) / total
    return out


def interval(differences: np.ndarray) -> list[float]:
    return [float(v) for v in np.percentile(differences, PERCENTILES, method=PERCENTILE_METHOD)]


# Step 6: decide ---------------------------------------------------------------------------------------------

def _points(share: float) -> str:
    """A share as signed percentage points, to one decimal. A value that is not zero but would print as 0.0 gets two
    significant digits instead, so a bound of the interval never reads as zero unless it is: the decision turns on
    its sign, and the text must not show the same interval for opposite decisions. Exactly zero is 0.0."""
    value = 100 * share
    if value == 0:
        return "0.0"
    text = f"{value:+.1f}"
    return f"{value:+.2g}" if float(text) == 0 else text


def decide(span: list[float] | None, days: int, detections_used: int, pair_counts: dict[str, int],
           last_pass: str) -> dict:
    """The marker the rule gives, the rule item and branch that gave it, and why. `span` is the 95 % interval of
    HV minus HH; it is used only with detections on rice on at least MIN_DAYS days (with fewer there is none)."""
    if detections_used > 0 and days >= MIN_DAYS:
        if span is None:
            raise ValueError(f"{days} days of detections on rice need an interval")
        if span[0] > 0:
            return {"marker": "HH", "status": "decided", "rule_item": 3, "branch": "interval excludes zero",
                    "reason": f"the 95 % interval of HV minus HH ({_points(span[0])} to {_points(span[1])} "
                              "percentage points) lies above zero: HV leaves more of the fire detections on rice it "
                              "still calls standing"}
        if span[1] < 0:
            return {"marker": "HV", "status": "decided", "rule_item": 3, "branch": "interval excludes zero",
                    "reason": f"the 95 % interval of HV minus HH ({_points(span[0])} to {_points(span[1])} "
                              "percentage points) lies below zero: HH leaves more of the fire detections on rice it "
                              "still calls standing"}
        branch = "fallback: interval includes zero"
        why = (f"the 95 % interval of HV minus HH ({_points(span[0])} to {_points(span[1])} percentage points) "
               "includes zero")
    elif detections_used == 0:
        branch = "fallback: no detection on rice"
        why = "no fire detection in the window has a part on the test's rice cells"
    else:
        branch = "fallback: fewer than 2 days"
        why = (f"the detections on rice fall on {days} UTC day, too few for an interval over days (it needs at "
               f"least {MIN_DAYS})")
    hh, hv = pair_counts["HH"], pair_counts["HV"]
    by = date_text(last_pass)
    if hh == hv:
        return {"marker": None, "status": "undecided", "rule_item": 4, "branch": branch,
                "reason": f"{why}, and HH and HV both give a harvest pair to {hh} of the test's rice cells by {by}: "
                          "the choice is the team's"}
    winner, loser = ("HH", "HV") if hh > hv else ("HV", "HH")
    return {"marker": winner, "status": "decided", "rule_item": 4, "branch": branch,
            "reason": f"{why}; {winner} gives a harvest pair to more of the test's rice cells by {by} "
                      f"({pair_counts[winner]} against {pair_counts[loser]} for {loser})"}


# The whole test on arrays -------------------------------------------------------------------------------------

def evaluate(xs, ys, dates: list[str], classes: dict[str, np.ndarray], codes: Codes, passes, transform: Affine,
             region: np.ndarray) -> dict:
    """Steps 2 to 6 on the detections of the window (projected to the class grid's CRS): the numbers of
    marker.json."""
    passes = list(passes)
    w = weigh(xs, ys, dates, classes, codes, passes, transform, region)
    use = used(w["rice"])
    days, rice_day, standing_day, n_day = by_day(dates, w["rice"], w["standing"], use)
    rice_total = float(w["rice"][use].sum())
    standing_total = {p: float(w["standing"][p][use].sum()) for p in POLARIZATIONS}
    scores = {p: score(standing_total[p], rice_total) for p in POLARIZATIONS}
    difference = None if scores["HH"] is None else scores["HV"] - scores["HH"]
    span = interval(bootstrap(rice_day, standing_day)) if len(days) >= MIN_DAYS else None
    counts = harvest_pair_counts(classes, w["scored"], codes)
    n_scored = int(w["scored"].sum())
    return {
        "cells": {"test_rice": n_scored,
                  "rice_in_one_band_only": int(((rice(classes["HH"], codes) ^ rice(classes["HV"], codes))
                                                 & region).sum())},
        "detections": {"in_window": len(dates), "used": int(use.sum()), "unused": int((~use).sum())},
        "days": len(days),
        "by_day": [{"date": d, "detections": n_day[k], "rice_weight": float(rice_day[k]),
                    "standing_weight": {p: float(standing_day[p][k]) for p in POLARIZATIONS}}
                   for k, d in enumerate(days)],
        "rice_weight": rice_total,
        "standing_weight": standing_total,
        "scores": scores,
        "difference": difference,
        "interval": span,
        "harvest_pair_cells": {**counts, "by": passes[-1], "of": n_scored},
        "decision": decide(span, len(days), int(use.sum()), counts, passes[-1]),
    }


# The class raster's content -----------------------------------------------------------------------------------

def content_hash(bands: np.ndarray, info: dict) -> str:
    """SHA-256 of what the class raster holds: its values, data type, shape, transform, CRS and band names, and
    nothing about how or when it was written. A re-analysis that only changes harvest.marker writes the same
    classes, so it keeps the hash (harvest.marker is not an input of the classes)."""
    header = {"dtype": np.dtype(bands.dtype).str, "shape": list(bands.shape),
              "transform": [float(v) for v in list(info["transform"])[:6]], "crs": info["crs"],
              "bands": list(info["descriptions"])}
    digest = hashlib.sha256(json.dumps(header, sort_keys=True, separators=(",", ":")).encode("utf-8"))
    digest.update(np.ascontiguousarray(bands).tobytes())
    return digest.hexdigest()


# Texts for the console and the app -----------------------------------------------------------------------------

def _pct(share: float | None) -> str:
    return "n/a" if share is None else f"{100 * share:.1f} %"


def _period(first: str, last: str) -> str:
    return f"UTC dates from {first} to {last}"


def report(doc: dict) -> list[str]:
    """The lines `marker` prints for a result (marker.json)."""
    head = "marker "
    w, d, dec = doc["window"], doc["detections"], doc["decision"]
    fetched = w["detections_fetched"]
    lines = [f"{head} rule: {RULE}; method: docs/METHODS.md, section 6, \"Choosing the marker\"",
             f"{head} window: {_period(w['first'], w['last'])}; detections.json holds the days {fetched[0]} to "
             f"{fetched[1]}"]
    gap = missing(w["first"], w["last"], fetched)
    if gap:  # the stage no longer writes such a result; one written before it checked this
        lines.append(f"{head} WARNING: {gap}; the rule takes every detection of its window, so this is not its "
                     "result")
    lines.append(f"{head} {d['in_window']} detection{'s' if d['in_window'] != 1 else ''} in the window: {d['used']} "
                 f"with a part on the test's {doc['cells']['test_rice']} rice cells (weight {doc['rice_weight']:.2f} "
                 f"squares, on {doc['days']} UTC day{'s' if doc['days'] != 1 else ''}), {d['unused']} with none, "
                 "not used")
    s = doc["scores"]
    if s["HH"] is not None:
        lines.append(f"{head} still called not harvested on the detection's date: HH {_pct(s['HH'])}, HV "
                     f"{_pct(s['HV'])} of that weight; HV minus HH {_points(doc['difference'])} percentage points"
                     + (f", 95 % interval {_points(doc['interval'][0])} to {_points(doc['interval'][1])} "
                        f"({doc['bootstrap']['replicates']} bootstrap replicates over days, seed "
                        f"{doc['bootstrap']['seed']})" if doc["interval"] is not None else ", no interval"))
    c = doc["harvest_pair_cells"]
    lines.append(f"{head} harvest pair by {c['by']} on the {c['of']} test rice cells: HH {c['HH']}, HV {c['HV']}")
    lines.append(f"{head} decision: {dec['marker'] or 'none, the team chooses'} (rule item {dec['rule_item']}, "
                 f"{dec['branch']}): {dec['reason']}")
    return lines


def method_sentence(doc: dict) -> str:
    """The sentence the harvest-wave layer's method text carries once the test has been made (export, D11). Only for
    a test made on every day of its window: a ValueError otherwise, since shares of part of the window are not the
    rule's result, and a window not fetched at all must not read as one in which no detection lay on rice."""
    w, d, dec, s = doc["window"], doc["detections"], doc["decision"], doc["scores"]
    gap = missing(w["first"], w["last"], w["detections_fetched"])
    if gap:
        raise ValueError(f"the marker test was made on part of its window ({gap}), so it has no sentence")
    first, last = w["first"], w["last"]
    text = "Marker test, by a rule that the team's own record says was written down before any fire data was analysed: "
    if s["HH"] is None:
        text += (f"no VIIRS fire detection with a UTC date from {first} to {last} lay on rice, so no share could be "
                 "computed.")
    else:
        text += (f"of the VIIRS fire detections with UTC dates from {first} to {last} that lie partly on rice "
                 f"({d['used']} detection{'s' if d['used'] != 1 else ''} on {doc['days']} "
                 f"day{'s' if doc['days'] != 1 else ''}, each weighted by the part of its 375 m square on rice "
                 f"cells), HH still called {_pct(s['HH'])} not harvested on the detection's date and HV "
                 f"{_pct(s['HV'])}; HV minus HH {_points(doc['difference'])} percentage points")
        if doc["interval"] is not None:
            text += (f", 95 % interval {_points(doc['interval'][0])} to {_points(doc['interval'][1])} (bootstrap "
                     "over days).")
        else:
            text += ", no interval (fewer than 2 days)."
    c = doc["harvest_pair_cells"]
    by = date_text(c["by"])
    if dec["rule_item"] == 3:
        text += f" Decision: {dec['marker']}, by item 3 of the rule (the interval excludes zero)."
    else:
        cause = {"fallback: interval includes zero": "the interval includes zero",
                 "fallback: fewer than 2 days": "the detections on rice fall on fewer than 2 days",
                 "fallback: no detection on rice": "no detection lay on rice"}[dec["branch"]]
        if dec["marker"] is None:
            text += (f" No decision: {cause} and HH and HV both give a harvest pair to {c['HH']} rice cells by {by}; "
                     "the choice is the team's (item 4 of the rule).")
        else:
            other = "HV" if dec["marker"] == "HH" else "HH"
            text += (f" Decision: {dec['marker']}, by item 4 of the rule ({cause}; {dec['marker']} gives a harvest "
                     f"pair to more rice cells by {by}: {c[dec['marker']]} against {c[other]}).")
    return text


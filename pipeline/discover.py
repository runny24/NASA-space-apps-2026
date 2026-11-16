"""Commands "coverage" and "discover": what NISAR data exists for a place, and which granules a site uses.

coverage  answers "does this place have data?" for a single point, before a site exists.
discover  searches a site's box, helps choose one stack, then writes pipeline/sites/<id>.granules.json:
          the reproducible, citable list of granules that the fetch stage reads.

Both only search NASA's public catalog (pipeline/cmr.py), so neither needs a login.
"""

from __future__ import annotations

import json
import statistics
import sys
from collections import Counter
from datetime import UTC, datetime, timedelta
from pathlib import Path

from pipeline import cmr, hints

REPEAT_DAYS = 12  # NISAR passes over the same frame every 12 days
# The satellite collected nothing between these two times. Passes that fall inside are lost for good.
GAP_START = datetime(2026, 7, 27, 22, 3, tzinfo=UTC)
GAP_END = datetime(2026, 8, 10, 0, 55, tzinfo=UTC)
GAP_REASON = "instrument data gap, 27 July to 10 August 2026"
NO_PRODUCT_REASON = "no product in the catalog for this pass"
# How far an acquisition may sit from the predicted 12-day slot and still count as that pass. A pass near
# midnight UTC can land on the next calendar date, so one day either way.
PASS_TOLERANCE = timedelta(days=1)
# The one rule for a site's stack, said the same way wherever discover mentions it.
STACK_RULE = ("The site file may leave 'stack: null'; discover --stack records the stack in "
              "pipeline/sites/{site}.granules.json.")


def _time(iso: str) -> datetime:
    return datetime.strptime(iso, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=UTC)


def missing_passes(starts: list[str], unusable: dict[str, str] | None = None) -> list[dict]:
    """Dates on the 12-day repeat that have no usable granule, from the first to the last pass found.

    `starts` are the chosen granules. `unusable` maps the start of each granule that exists but was
    excluded to the reason. The walk spans both, so a pass excluded before the first or after the last
    chosen date is still reported, with its reason, instead of silently shortening the series.

    We step 12 days at a time from the earliest pass. When a real acquisition (chosen or excluded) is
    found near the predicted slot we re-anchor on it, so small drifts in pass time never add up to a
    wrong date. Missing passes are reported, never filled (science rule 7).
    """
    times = sorted(_time(s) for s in starts)
    if not times:
        return []
    # An excluded copy of a pass that also has a chosen granule is not a missing pass.
    rejected = {}
    for s, reason in (unusable or {}).items():
        t = _time(s)
        if not any(abs(t - c) <= PASS_TOLERANCE for c in times):
            rejected[t] = reason
    missing = []

    def excluded_entry(t: datetime) -> dict:
        return {"date": t.strftime("%Y-%m-%d"), "reason": f"a product exists but was excluded: {rejected[t]}"}

    anchor = min([times[0], *rejected])
    last = max([times[-1], *rejected])
    if anchor in rejected:
        missing.append(excluded_entry(anchor))
    while True:
        expected = anchor + timedelta(days=REPEAT_DAYS)
        if expected > last + PASS_TOLERANCE:
            return missing
        found = next((t for t in times if abs(t - expected) <= PASS_TOLERANCE), None)
        if found is not None:
            anchor = found
            continue
        excluded = next((t for t in sorted(rejected) if abs(t - expected) <= PASS_TOLERANCE), None)
        if excluded is not None:
            missing.append(excluded_entry(excluded))
            anchor = excluded
            continue
        reason = GAP_REASON if GAP_START <= expected <= GAP_END else NO_PRODUCT_REASON
        missing.append({"date": expected.strftime("%Y-%m-%d"), "reason": reason})
        anchor = expected


def date_preference(g: cmr.Granule, bbox=None) -> tuple:
    """Best granule of one date first: full frame, covers the box, then the usual release/counter order."""
    covers = cmr.covers_bbox(g, bbox) if bbox else None
    return (not g.full_frame, covers is False) + cmr.preference(g)


_POL_ORDER = ("HH", "HV", "VH", "VV")


def _pol_label(group: list[cmr.Granule]) -> str:
    """Polarizations available on a date from ANY of its copies, since discover may use any copy that
    has what a site needs (it checks the needs before choosing between copies)."""
    def union(pols) -> str:
        found = {p for g in group for p in pols(g)}
        return "+".join(sorted(found, key=lambda p: (_POL_ORDER.index(p) if p in _POL_ORDER else 9, p)))

    return union(lambda g: g.pols_a) or "B only " + (union(lambda g: g.pols_b) or "none")


def _format_dates(dates: list[str], indent: str, per_line: int = 8) -> list[str]:
    return [indent + "  ".join(dates[i:i + per_line]) for i in range(0, len(dates), per_line)]


def _counts(counter: Counter) -> str:
    return ", ".join(f"{key} x{n}" for key, n in counter.most_common())


def coverage_lines(granules: list[cmr.Granule], header: str) -> list[str]:
    """The coverage report: one block per stack, most dates first.

    A point has no site needs to check, so, like discover, this does not throw away copies of a pass
    before looking at them: each date shows its best copy (full frame, then release and counter) and the
    polarizations available on any of its copies. Urgent-response products are left out.
    """
    lines = [header]
    stacks = cmr.group_by_stack(g for g in granules if not g.urgent)
    if not stacks:
        lines.append("  No granules here. Try --releases validated,provisional,beta or another product.")
        return lines
    blocks = []
    for stack, items in stacks.items():
        by_date: dict[str, list[cmr.Granule]] = {}
        for g in items:
            by_date.setdefault(g.date, []).append(g)
        best = [min(group, key=date_preference) for group in by_date.values()]
        sizes = [g.size_bytes for g in best if g.size_bytes]
        extra = len(items) - len(best)
        dates = sorted(by_date)
        size = f"median file {statistics.median(sizes) / 1e9:.2f} GB" if sizes else "file size unknown"
        block = [
            f"  {stack}  {best[0].direction:<10}  {len(dates):3d} dates  {dates[0]} .. {dates[-1]}",
            (f"      pol {_counts(Counter(_pol_label(group) for group in by_date.values()))}"
             f" | bandwidth MHz {_counts(Counter(cmr.mode_label(g) for g in best))} | {size}"),
            f"      releases {_counts(Counter(g.release for g in best))}"
            f" | full frames {sum(g.full_frame for g in best)}/{len(best)}"
            + (f" | +{extra} other copies on the same dates (partial frames, other releases or re-issues)"
               if extra else ""),
        ]
        block += _format_dates(dates, "      ")
        blocks.append((-len(dates), stack, block))
    for _, _, block in sorted(blocks):
        lines += block
    return lines


def run_coverage(args) -> int:
    releases = [r for r in args.releases.split(",") if r.strip()]
    try:
        granules = cmr.search_granules(args.product, point=(args.lon, args.lat), releases=releases)
    except (cmr.CatalogError, ValueError) as error:
        print(f"coverage: {error}", file=sys.stderr)
        return 1
    header = (f"{args.product.upper()} at lon={args.lon} lat={args.lat} (releases {','.join(releases)}): "
              f"{len(granules)} granule(s) in the catalog")
    print("\n".join(coverage_lines(granules, header)))
    return 0


def select_granules(granules: list[cmr.Granule], site, stack: str) -> tuple[list[cmr.Granule], list[dict]]:
    """Choose one granule per date of one stack for a site. Returns (chosen, excluded with reasons).

    A granule is excluded when it is an urgent-response product, lacks a polarization the site needs on
    the site's frequency, is a partial frame that does not cover the site's box, is a duplicate of a
    better usable copy of the same pass, or shares its date with a better usable granule. Nothing is
    dropped silently.

    The site's needs are checked on every granule BEFORE duplicates are resolved. The other order loses
    real dates: the preferred copy of a pass (newer release or counter) can lack a polarization or be a
    partial strip, while a sibling that the site could use was already dropped as "same pass as".
    """
    excluded = []
    passing = []
    for g in (g for g in granules if g.stack == stack):
        have = cmr.pols_for(g, site.frequency)
        lacking = [p for p in site.polarizations if p not in have]
        if g.urgent:
            excluded.append({"name": g.name, "reason": cmr.URGENT_REASON})
        elif lacking:
            excluded.append({"name": g.name, "reason": f"lacks {'+'.join(lacking)} on frequency "
                                                       f"{site.frequency} (has {'+'.join(have) or 'none'})"})
        elif not g.full_frame and cmr.covers_bbox(g, site.bbox) is not True:
            excluded.append({"name": g.name, "reason": "partial frame that may not cover the site box"})
        else:
            passing.append(g)
    kept, dropped = cmr.split_duplicates(passing)
    excluded += [{"name": g.name, "reason": reason} for g, reason in dropped]

    by_date: dict[str, list[cmr.Granule]] = {}
    for g in kept:
        by_date.setdefault(g.date, []).append(g)
    chosen = []
    for date in sorted(by_date):
        usable = sorted(by_date[date], key=lambda g: date_preference(g, site.bbox))
        if usable:
            chosen.append(usable[0])
            for g in usable[1:]:
                excluded.append({"name": g.name, "reason": f"same date as {usable[0].name}, which was "
                                                           "preferred (full frame, then release, then counter)"})
    return chosen, excluded


def granule_list(site, stack: str, chosen: list[cmr.Granule], excluded: list[dict],
                 generated_at: str | None = None) -> dict:
    """The granule list file's content (see the interface notes in docs and pipeline/config.py)."""
    return {
        "site": site.id,
        "generated_at": generated_at or datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "product": site.product,
        "stack": stack,
        "direction": chosen[0].direction if chosen else None,
        "query": {"bbox": list(site.bbox), "releases": list(site.releases)},
        "granules": [
            {
                "name": g.name,
                "date": g.date,
                "start": g.start,
                "release": g.release,
                "collection": g.collection,
                "version": g.version,
                "counter": g.counter,
                "pols": list(cmr.pols_for(g, site.frequency)),
                "bandwidth_mhz": cmr.bandwidth_mhz(g, site.frequency),
                "full_frame": g.full_frame,
                "url": g.data_url,
                "browse": list(g.browse_urls),
                "size_bytes": g.size_bytes,
            }
            for g in chosen
        ],
        "missing_passes": missing_passes([g.start for g in chosen], _unusable_passes(excluded)),
        "excluded": excluded,
    }


def _unusable_passes(excluded: list[dict]) -> dict[str, str]:
    """{start: reason} for passes whose only granules were excluded (not mere duplicates of a kept one)."""
    return {cmr.parse_name(e["name"])["start"]: e["reason"] for e in excluded
            if not e["reason"].startswith(("same pass as", "same date as"))}


def write_granule_list(path: Path, data: dict) -> None:
    """UTF-8, LF line endings, stable key order, so the committed file diffs cleanly on every machine."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as handle:
        handle.write(json.dumps(data, indent=2, ensure_ascii=False) + "\n")


def rank_stacks(granules: list[cmr.Granule], site) -> list[dict]:
    """Score every stack for a site, best first, with the facts behind the score."""
    ranked = []
    for stack in cmr.group_by_stack(granules):
        chosen, _ = select_granules(granules, site, stack)
        all_dates = sorted({g.date for g in granules if g.stack == stack})
        per_release = Counter(g.release for g in chosen)
        modes = Counter(cmr.mode_label(g) for g in chosen)
        best_release, in_best = per_release.most_common(1)[0] if per_release else ("none", 0)
        ranked.append({
            "stack": stack,
            "direction": next(g.direction for g in granules if g.stack == stack),
            "dates": len(all_dates),
            "usable": len(chosen),
            "best_release": best_release,
            "in_best_release": in_best,
            "per_release": per_release,
            "full_frames": sum(g.full_frame for g in chosen),
            "modes": modes,
            "first": chosen[0].date if chosen else None,
            "last": chosen[-1].date if chosen else None,
        })
    # Most usable dates inside one release first (the data guide says not to mix releases in a time
    # series), then most usable dates overall, then full frames, then fewest bandwidth modes.
    ranked.sort(key=lambda r: (-r["in_best_release"], -r["usable"], -r["full_frames"], len(r["modes"]), r["stack"]))
    return ranked


def recommendation_lines(ranked: list[dict], site) -> list[str]:
    pols = "+".join(site.polarizations)
    lines = [f"Stacks over site '{site.id}' ({site.product}, frequency {site.frequency}, needs {pols}):"]
    for r in ranked:
        lines.append(
            f"  {r['stack']}  {r['direction']:<10}  {r['dates']:3d} dates, {r['usable']:3d} usable"
            f" ({r['first']} .. {r['last']})  releases {_counts(r['per_release']) or 'none'}"
            f"  full frames {r['full_frames']}/{r['usable']}  bandwidth MHz {_counts(r['modes']) or 'none'}")
    top = ranked[0]
    if not top["usable"]:
        lines.append(f"No stack has a usable date with {pols} on frequency {site.frequency}. "
                     "Change the site's polarizations or frequency, or widen its releases.")
        return lines
    reasons = [f"{top['in_best_release']} usable dates within one release ({top['best_release']})"]
    reasons.append(f"{pols} present on every date" if top["usable"] == top["dates"] else
                   f"{pols} present on {top['usable']} of {top['dates']} dates")
    reasons.append("full frames on every usable date" if top["full_frames"] == top["usable"] else
                   f"full frames on {top['full_frames']} of {top['usable']} usable dates")
    reasons.append(f"one bandwidth mode ({next(iter(top['modes']))} MHz)" if len(top["modes"]) == 1 else
                   f"{len(top['modes'])} bandwidth modes: {_counts(top['modes'])}")
    lines.append(f"Recommended: {top['stack']}")
    lines += [f"  - {reason}" for reason in reasons]
    lines.append("Next: " + hints.command("discover", "--site", site.id, "--stack", top["stack"]))
    lines.append(f"  {STACK_RULE.format(site=site.id)}")
    lines.append(f"  {hints.POWERSHELL_NOTE}")
    return lines


def summary_lines(data: dict, path: Path) -> list[str]:
    granules = data["granules"]
    releases = Counter(g["release"] for g in granules)
    lines = [f"Wrote {path}",
             (f"  {data['stack']} ({data['direction']}): {len(granules)} dates, "
             f"{granules[0]['date']} .. {granules[-1]['date']}, releases {_counts(releases)}")]
    if len(releases) > 1:
        banner = "!" * 78
        keep, kept_dates = releases.most_common(1)[0]
        lines += [banner,
                  "!! WARNING: these dates come from MORE THAN ONE RELEASE (" + ", ".join(releases) + ").",
                  "!! The NISAR data guide says not to mix releases in one time series. Each granule's",
                  "!! release is recorded in the file; the app must label them. Before comparing dates",
                  "!! across the boundary, check a stable target (dense forest, a city) for an offset.",
                  f"!! To keep one release: {keep} has the most dates ({kept_dates} of {len(granules)}).",
                  f"!! Set this line in pipeline/sites/{data['site']}.yaml:",
                  f"!!   releases: [{keep}]",
                  "!! then run discover again:",
                  "!!   " + hints.command("discover", "--site", data["site"], "--stack", data["stack"]),
                  "!! " + hints.POWERSHELL_NOTE,
                  banner]
    for m in data["missing_passes"]:
        lines.append(f"  missing pass {m['date']}: {m['reason']}")
    reasons = Counter(_reason_kind(e["reason"]) for e in data["excluded"])
    for reason, n in reasons.most_common():
        lines.append(f"  excluded {n}: {reason}")
    if data["excluded"]:
        lines.append("  (each excluded granule and its full reason is listed under 'excluded' in the file)")
    return lines


def _reason_kind(reason: str) -> str:
    """Group exclusion reasons for the summary; the file keeps each full reason."""
    if reason.startswith("same pass as"):
        return "another copy of the same pass was kept (better release or counter, or the full frame)"
    if reason.startswith("same date as"):
        return "another granule of the same date was kept"
    return reason.split(" (")[0]


def run_discover(args) -> int:
    # Imported here, not at the top, so "coverage" works even where config.py or PyYAML is missing.
    from pipeline import config

    try:
        site = config.load_site(args.site)
    except (config.ConfigError, OSError) as error:
        print(f"discover: {error}", file=sys.stderr)
        return 1
    stack = args.stack or site.stack
    releases = [r for r in site.releases if r in cmr.RELEASES]  # "sample" is not a catalog release
    try:
        granules = cmr.search_granules(site.product, bbox=site.bbox, releases=releases, stack=stack)
    except (cmr.CatalogError, ValueError) as error:
        print(f"discover: {error}", file=sys.stderr)
        return 1
    if not granules:
        print(f"discover: the catalog has no {site.product} granules for site '{site.id}' "
              f"(box {list(site.bbox)}, releases {','.join(releases)}{', stack ' + stack if stack else ''}). "
              "Check the box order (west, south, east, north) and the releases.", file=sys.stderr)
        return 1
    if not stack:
        print("\n".join(recommendation_lines(rank_stacks(granules, site), site)))
        return 0

    chosen, excluded = select_granules(granules, site, stack)
    if not chosen:
        print(f"discover: no usable granule in stack {stack} for site '{site.id}'.", file=sys.stderr)
        for e in excluded:
            print(f"  excluded {e['name']}: {e['reason']}", file=sys.stderr)
        return 1
    data = granule_list(site, stack, chosen, excluded)
    path = config.granules_path(site.id)
    write_granule_list(path, data)
    lines = summary_lines(data, path)
    uncovered = [g.date for g in chosen if cmr.covers_bbox(g, site.bbox) is False]
    if uncovered:
        lines.append("  NOTE: the footprint does not cover the whole site box on " + ", ".join(uncovered)
                     + "; those dates will have empty areas.")
    print("\n".join(lines))
    return 0


def register(subparsers) -> None:
    p = subparsers.add_parser(
        "coverage", help="list NISAR stacks and dates at a point (no login)",
        description="Search NASA's catalog at one point and print every stack (track_direction_frame) "
                    "with its dates, polarizations, bandwidth, file size and releases.")
    p.add_argument("--lon", type=float, required=True, help="longitude in degrees (east positive)")
    p.add_argument("--lat", type=float, required=True, help="latitude in degrees (north positive)")
    p.add_argument("--product", default="GCOV", help="GCOV (default), GUNW, GOFF or SME2")
    p.add_argument("--releases", default="validated,provisional",
                   help="comma-separated, from validated,provisional,beta (default validated,provisional)")
    p.set_defaults(func=run_coverage)

    p = subparsers.add_parser(
        "discover", help="choose a stack for a site and write its granule list (no login)",
        description="Search the site's box. Without a stack, rank the candidate stacks and stop. With one, "
                    "write pipeline/sites/<id>.granules.json.")
    p.add_argument("--site", required=True, help="site id: the name of pipeline/sites/<id>.yaml")
    p.add_argument("--stack", help="track_direction_frame, e.g. 030_A_019 (overrides the site file). "
                                   + STACK_RULE.format(site="<id>"))
    p.set_defaults(func=run_discover)


if __name__ == "__main__":
    # For trying this module on its own: node scripts/py.mjs -m pipeline.discover coverage --lon <lon> --lat <lat>
    import argparse

    parser = argparse.ArgumentParser(prog="python -m pipeline.discover")
    register(parser.add_subparsers(dest="command", required=True))
    parsed = parser.parse_args()
    sys.exit(parsed.func(parsed))

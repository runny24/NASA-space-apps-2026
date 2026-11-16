"""The marker test (pipeline/marker.py, the marker stage, its sentence in the harvest-wave layer's method text).

Everything here is SYNTHETIC: hand-built class grids of 100 m cells on a made-up projected grid, invented
detections and pass dates, and the synthetic harvest site of test_end_to_end.py (about 118.0 W 34.8 N, chosen for
the tests, not a place of the team's). No test reads real data or touches the network: FIRMS is the fake of
test_fires.py.
"""

from __future__ import annotations

import datetime as dt
import json
import re
import shutil

import numpy as np
import pytest
from affine import Affine
from pyproj import Transformer

from pipeline import fires as fires_mod
from pipeline import marker
from pipeline import stages as stages_mod
from pipeline.cli import build_parser, main
from pipeline.config import ConfigError, load_site
from pipeline.harvest import Codes
from pipeline.manifest import validate
from pipeline.qa import target_pixels
from pipeline.rasters import read_geotiff, read_json, write_geotiff, write_json
from pipeline.stages import (
    DETECTIONS_FILE,
    HARVEST_FILE,
    HARVEST_RASTER,
    MARKER_FILE,
    analyse_site,
    export_site,
    fires_site,
    manifest_stage,
    marker_site,
    run_site,
)
from pipeline.tests.conftest import SITE_ID
from pipeline.tests.test_end_to_end import H_BLOCK, H_PASSES, _copy_run, _edit_site, _harvest_site
from pipeline.tests.test_fires import KEY, FakeFirms, det, lonlat

# A hand-built SYNTHETIC grid: 20 x 20 cells of 100 m, in blocks of 5 x 5 cells (500 m), so a 375 m square centred
# on a block lies wholly inside it, and one centred on the edge between two blocks lies half on each.
PASSES = ["2026-09-05", "2026-09-17", "2026-09-29", "2026-10-11", "2026-10-23"]  # SYNTHETIC pass dates
CODES = Codes.for_passes(len(PASSES))  # harvest pairs 1 to 3 (ending 09-29, 10-11, 10-23); 4, 5, 6; 0 no data
NH, FB, NR = CODES.no_harvest, CODES.fell_before, CODES.not_rice
TRANSFORM = Affine(100.0, 0.0, 0.0, 0.0, -100.0, 2000.0)
SHAPE = (20, 20)
EVERYWHERE = np.ones(SHAPE, dtype=bool)


def classes(blocks: dict[tuple[int, int], tuple[int, int]]) -> dict[str, np.ndarray]:
    """HH and HV class grids: blocks maps (block row, block column) to (HH class, HV class); the rest is not rice."""
    hh, hv = np.full(SHAPE, NR, dtype=np.uint8), np.full(SHAPE, NR, dtype=np.uint8)
    for (bi, bj), (a, b) in blocks.items():
        hh[5 * bi:5 * bi + 5, 5 * bj:5 * bj + 5] = a
        hv[5 * bi:5 * bi + 5, 5 * bj:5 * bj + 5] = b
    return {"HH": hh, "HV": hv}


def centre(bi: float, bj: float) -> tuple[float, float]:
    """x, y of the centre of block (bi, bj); halves give the edge between two blocks."""
    return 500.0 * bj + 250.0, 2000.0 - (500.0 * bi + 250.0)


def weigh(points: list[tuple[tuple[float, float], str]], grids: dict, region: np.ndarray = EVERYWHERE) -> dict:
    xs, ys = [p[0][0] for p in points], [p[0][1] for p in points]
    return marker.weigh(xs, ys, [p[1] for p in points], grids, CODES, PASSES, TRANSFORM, region)


def evaluate(points: list[tuple[tuple[float, float], str]], grids: dict, region: np.ndarray = EVERYWHERE) -> dict:
    xs, ys = [p[0][0] for p in points], [p[0][1] for p in points]
    return marker.evaluate(xs, ys, [p[1] for p in points], grids, CODES, PASSES, TRANSFORM, region)


# Steps 1 and 2: window and cells -------------------------------------------------------------------------------

def test_the_window_runs_from_the_third_pass_to_the_end_of_the_fires_block_both_included():
    assert marker.window(PASSES, "2026-11-14") == ("2026-09-29", "2026-11-14")
    found = [{"date": d} for d in ["2026-09-28", "2026-09-29", "2026-10-30", "2026-11-14", "2026-11-15"]]
    assert [d["date"] for d in marker.in_window(found, "2026-09-29", "2026-11-14")] == [
        "2026-09-29", "2026-10-30", "2026-11-14"]
    with pytest.raises(ValueError, match="at least 3 passes"):
        marker.window(PASSES[:2], "2026-11-14")
    # The part of the window the fetched days cover (detections.json's `asked`).
    assert marker.covered("2026-09-29", "2026-11-14", ["2026-09-15", "2026-11-13"]) == ("2026-09-29", "2026-11-13")
    assert marker.covered("2026-09-29", "2026-11-14", ["2026-09-15", "2026-11-20"]) == ("2026-09-29", "2026-11-14")
    assert marker.covered("2026-09-29", "2026-11-14", ["2026-11-15", "2026-11-20"]) is None


def test_the_test_needs_every_day_of_the_window():
    # Rule item 2 takes every detection of its window; a day not fetched is unknown, not empty. `missing` names the
    # days of the window that detections.json (its `asked` days) does not hold, and is None only when it holds all.
    window = ("2026-09-29", "2026-11-14")
    assert marker.missing(*window, ["2026-09-15", "2026-11-14"]) is None
    assert marker.missing(*window, ["2026-09-29", "2026-11-20"]) is None
    for fetched, days in [
        (["2026-09-15", "2026-11-13"], "2026-11-14"),  # fires ran on 14 November (UTC): that day had not ended
        (["2026-09-15", "2026-11-10"], "2026-11-11 to 2026-11-14"),
        (["2026-10-01", "2026-11-14"], "2026-09-29 to 2026-09-30"),  # a fires block that starts too late
        (["2026-10-01", "2026-11-13"], "2026-09-29 to 2026-09-30 and 2026-11-14"),
        (["2026-09-15", "2026-09-20"], "2026-09-29 to 2026-11-14"),  # none of the window
    ]:
        gap = marker.missing(*window, fetched)
        assert gap == (f"the marker rule's window runs from 2026-09-29 to 2026-11-14, but detections.json holds the "
                       f"days {fetched[0]} to {fetched[1]}, so these days of the window were not fetched: {days}"), gap
    # A fires block that ends before the third pass leaves the window without a day: no test, a clear error.
    assert marker.window(PASSES, "2026-09-29") == ("2026-09-29", "2026-09-29")
    with pytest.raises(ValueError, match="the fires block ends on 2026-09-28, before 2026-09-29.*holds no day"):
        marker.window(PASSES, "2026-09-28")


def test_a_pass_on_the_detection_date_counts_as_on_or_before_it():
    # Block (0, 0): HH's harvest pair 1 ends on 09-29, HV's pair 2 on 10-11.
    grids = classes({(0, 0): (1, 2)})
    w = weigh([(centre(0, 0), "2026-09-29"), (centre(0, 0), "2026-10-10"), (centre(0, 0), "2026-10-11")], grids)
    assert w["rice"] == pytest.approx([1.0, 1.0, 1.0], abs=1e-12)
    assert w["standing"]["HH"] == pytest.approx([0.0, 0.0, 0.0], abs=1e-12)  # harvested on 09-29 itself
    assert w["standing"]["HV"] == pytest.approx([1.0, 1.0, 0.0], abs=1e-12)  # harvested on 10-11 itself
    assert [marker.passes_by(PASSES, d) for d in ("2026-09-28", "2026-09-29", "2026-10-10", "2026-10-11")] == [
        2, 3, 3, 4]


def test_fell_before_is_rice_that_is_never_called_standing():
    # Block (0, 0) fell before the first harvest pass in both; block (0, 1) shows no harvest in either.
    grids = classes({(0, 0): (FB, FB), (0, 1): (NH, NH)})
    days = ["2026-09-29", "2026-10-11", "2026-11-14"]
    w = weigh([(centre(0, 0), d) for d in days] + [(centre(0, 0.5), "2026-10-01")], grids)
    assert w["rice"] == pytest.approx([1.0, 1.0, 1.0, 1.0], abs=1e-12)  # it counts as rice
    for pol in ("HH", "HV"):
        assert w["standing"][pol] == pytest.approx([0.0, 0.0, 0.0, 0.5], abs=1e-12)  # never as standing
    assert marker.harvest_end(grids["HH"], CODES, len(PASSES))[0, 0] == -1


def test_no_harvest_seen_is_standing_on_every_day_of_the_window():
    grids = classes({(0, 0): (NH, NH)})
    w = weigh([(centre(0, 0), "2026-09-29"), (centre(0, 0), "2026-11-14")], grids)  # 11-14: after the last pass
    for pol in ("HH", "HV"):
        assert w["standing"][pol] == pytest.approx([1.0, 1.0], abs=1e-12)


def test_detections_without_a_part_on_rice_are_not_used():
    grids = classes({(0, 0): (NH, NH), (0, 2): (0, 0), (0, 3): (NH, NH)})  # (0, 1) is not rice, (0, 2) no data
    region = EVERYWHERE.copy()
    region[:, 15:] = False  # block column 3 lies outside the site box
    points = [
        (centre(0, 0), "2026-10-01"),  # on rice
        (centre(0, 1), "2026-10-02"),  # not rice
        (centre(0, 2), "2026-10-03"),  # no data
        (centre(0, 3), "2026-10-04"),  # rice outside the site box
        ((-1000.0, 1750.0), "2026-10-05"),  # off the grid
        ((687.5, 1750.0), "2026-10-07"),  # its square only touches the rice block's edge at x = 500
        (centre(0, 0), "2026-10-06"),  # on rice
    ]
    result = evaluate(points, grids, region)
    assert result["detections"] == {"in_window": 7, "used": 2, "unused": 5}
    assert result["days"] == 2 and [d["date"] for d in result["by_day"]] == ["2026-10-01", "2026-10-06"]
    assert result["rice_weight"] == pytest.approx(2.0, abs=1e-12)
    w = weigh(points, grids, region)
    assert w["rice"][1:6] == pytest.approx([0.0] * 5, abs=1e-12)
    assert list(marker.used(w["rice"])) == [True, False, False, False, False, False, True]


def test_hh_and_hv_are_scored_on_the_same_cells():
    # (0, 0) is rice in both: HH harvested by 09-29, HV standing until 10-11. (0, 1) is rice only in HH (HV has no
    # data) and (1, 0) only in HV: neither counts for either polarization, though HH calls (0, 1) standing.
    grids = classes({(0, 0): (1, 2), (0, 1): (NH, 0), (1, 0): (0, NH)})
    points = [(centre(0, 0.5), "2026-09-29"), (centre(0.5, 0), "2026-09-29")]  # half on (0, 0), half on the other
    w = weigh(points, grids)
    assert w["rice"] == pytest.approx([0.5, 0.5], abs=1e-12)
    assert w["standing"]["HH"] == pytest.approx([0.0, 0.0], abs=1e-12)
    assert w["standing"]["HV"] == pytest.approx([0.5, 0.5], abs=1e-12)
    result = evaluate(points, grids)
    assert result["scores"]["HH"] == pytest.approx(0.0, abs=1e-12)
    assert result["scores"]["HV"] == pytest.approx(1.0, abs=1e-12)
    assert result["cells"] == {"test_rice": 25, "rice_in_one_band_only": 50}


# Steps 3 and 4: weights and scores -----------------------------------------------------------------------------

SCORE_GRIDS = {(0, 0): (1, 2), (1, 1): (NH, NH), (2, 2): (FB, FB)}  # (0, 1) not rice
SCORE_POINTS = [
    (centre(0, 0), "2026-10-01"),  # r 1, HH 0, HV 1
    (centre(0, 0.5), "2026-10-01"),  # half on (0, 0), half on not rice: r 0.5, HH 0, HV 0.5
    (centre(1, 1), "2026-10-01"),  # r 1, HH 1, HV 1
    (centre(2, 2), "2026-10-01"),  # fell before: r 1, HH 0, HV 0
    (centre(0, 1), "2026-10-01"),  # not rice: not used
]


def test_scores_are_the_rice_weighted_mean_of_the_share_still_standing():
    result = evaluate(SCORE_POINTS, classes(SCORE_GRIDS))
    assert result["detections"] == {"in_window": 5, "used": 4, "unused": 1}
    assert result["rice_weight"] == pytest.approx(3.5, abs=1e-12)
    assert result["standing_weight"] == {"HH": pytest.approx(1.0, abs=1e-12), "HV": pytest.approx(2.5, abs=1e-12)}
    assert result["scores"]["HH"] == pytest.approx(1.0 / 3.5, rel=1e-12)  # not the plain mean of shares, 1/4
    assert result["scores"]["HV"] == pytest.approx(2.5 / 3.5, rel=1e-12)
    assert result["difference"] == pytest.approx(1.5 / 3.5, rel=1e-12)
    assert result["days"] == 1 and result["interval"] is None  # one day: no interval


def test_the_square_is_shared_among_cells_exactly_as_in_the_fire_bars():
    # r is the fire bars' attribution (fires.attribute) restricted to the test's rice cells, detection by detection,
    # including squares that straddle cells at odd offsets.
    grids = classes({(0, 0): (1, 2), (1, 1): (NH, NH), (2, 2): (FB, FB), (1, 2): (3, 0)})
    scored = marker.scored_cells(grids["HH"], grids["HV"], CODES, EVERYWHERE)
    on_test = np.where(scored, grids["HH"], 0)
    points = [((431.7, 1612.9), "2026-10-01"), ((873.2, 1288.8), "2026-10-02"), ((1210.4, 1010.1), "2026-10-03"),
              ((40.0, 1990.0), "2026-10-04")]
    w = weigh(points, grids)
    for ((x, y), _), r in zip(points, w["rice"], strict=True):
        att = fires_mod.attribute([x], [y], on_test, TRANSFORM, list(range(1, NR + 1)))
        assert r == pytest.approx(sum(att["by_class"].values()), rel=1e-12, abs=1e-15)
    assert 0 < w["rice"][0] < 1 and 0 < w["rice"][3] < 1


# Step 5: bootstrap ----------------------------------------------------------------------------------------------

# SYNTHETIC detections on five days, with their hand-computed (r, s_HH, s_HV) on the grid SCORE_GRIDS.
BOOT_POINTS = [
    ((centre(0, 0), "2026-10-01"), (1.0, 0.0, 1.0)),
    ((centre(1, 1), "2026-10-02"), (1.0, 1.0, 1.0)),
    ((centre(0, 0.5), "2026-10-03"), (0.5, 0.0, 0.5)),
    ((centre(2, 2), "2026-10-03"), (1.0, 0.0, 0.0)),
    ((centre(0, 0), "2026-10-05"), (1.0, 0.0, 1.0)),
    ((centre(1, 1), "2026-10-05"), (1.0, 1.0, 1.0)),
    ((centre(0, 0), "2026-10-12"), (1.0, 0.0, 0.0)),  # after 10-11 HV has harvested (0, 0) too
    ((centre(0, 1), "2026-10-04"), (0.0, 0.0, 0.0)),  # not rice: its day is not a unit
]


def _hand_rolled_differences(points) -> list[float]:
    """The bootstrap written out detection by detection, from the hand-computed weights."""
    used = [(day, w) for (_, day), w in points if w[0] > 0]
    days = sorted({day for day, _ in used})
    rng = np.random.default_rng(20261114)
    out = []
    for _ in range(2000):
        r = s_hh = s_hv = 0.0
        for k in rng.integers(0, len(days), size=len(days)):
            for day, (ri, hh, hv) in used:
                if day == days[k]:
                    r, s_hh, s_hv = r + ri, s_hh + hh, s_hv + hv
        out.append(s_hv / r - s_hh / r)
    return out


def test_the_bootstrap_is_reproducible_and_matches_a_hand_rolled_loop():
    grids = classes(SCORE_GRIDS)
    points = [p for p, _ in BOOT_POINTS]
    w = weigh(points, grids)
    expected = np.array([v for _, v in BOOT_POINTS])
    assert np.column_stack([w["rice"], w["standing"]["HH"], w["standing"]["HV"]]) == pytest.approx(expected, abs=1e-12)

    use = marker.used(w["rice"])
    days, rice_day, standing_day, n_day = marker.by_day([d for _, d in points], w["rice"], w["standing"], use)
    assert days == ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-05", "2026-10-12"] and n_day == [1, 1, 2, 2, 1]
    first = marker.bootstrap(rice_day, standing_day)
    assert np.array_equal(first, marker.bootstrap(rice_day, standing_day))  # the fixed seed: the same every time
    hand = _hand_rolled_differences(BOOT_POINTS)
    assert first == pytest.approx(hand, rel=1e-12, abs=1e-15)
    assert len(set(np.round(first, 12))) > 10  # the replicates do differ

    result = evaluate(points, grids)
    assert result["interval"] == pytest.approx(list(np.percentile(hand, [2.5, 97.5], method="linear")), rel=1e-12)
    assert result["interval"][0] < result["difference"] < result["interval"][1]
    assert result["days"] == 5 and result["detections"] == {"in_window": 8, "used": 7, "unused": 1}
    assert evaluate(points, grids) == result  # the whole result is reproducible


# Step 6: decision ---------------------------------------------------------------------------------------------

@pytest.mark.parametrize("span, days, used, counts, want", [
    ([0.05, 0.30], 5, 40, {"HH": 10, "HV": 900}, ("HH", "decided", 3, "interval excludes zero")),
    ([-0.30, -0.05], 5, 40, {"HH": 900, "HV": 10}, ("HV", "decided", 3, "interval excludes zero")),
    ([-0.05, 0.30], 5, 40, {"HH": 10, "HV": 900}, ("HV", "decided", 4, "fallback: interval includes zero")),
    ([-0.05, 0.30], 5, 40, {"HH": 900, "HV": 10}, ("HH", "decided", 4, "fallback: interval includes zero")),
    ([0.0, 0.30], 5, 40, {"HH": 900, "HV": 10}, ("HH", "decided", 4, "fallback: interval includes zero")),
    ([-0.30, 0.0], 5, 40, {"HH": 10, "HV": 900}, ("HV", "decided", 4, "fallback: interval includes zero")),
    ([-0.05, 0.30], 5, 40, {"HH": 500, "HV": 500}, (None, "undecided", 4, "fallback: interval includes zero")),
    (None, 1, 3, {"HH": 900, "HV": 10}, ("HH", "decided", 4, "fallback: fewer than 2 days")),
    ([0.2, 0.2], 1, 3, {"HH": 10, "HV": 900}, ("HV", "decided", 4, "fallback: fewer than 2 days")),
    (None, 0, 0, {"HH": 10, "HV": 900}, ("HV", "decided", 4, "fallback: no detection on rice")),
    (None, 0, 0, {"HH": 7, "HV": 7}, (None, "undecided", 4, "fallback: no detection on rice")),
])
def test_each_branch_of_the_decision(span, days, used, counts, want):
    d = marker.decide(span, days, used, counts, "2026-11-04")
    assert (d["marker"], d["status"], d["rule_item"], d["branch"]) == want
    if want[0] is None:
        assert "the choice is the team's" in d["reason"] and f"{counts['HH']} of the test's rice cells" in d["reason"]
    elif want[2] == 4:
        assert "4 November 2026" in d["reason"] and f"({max(counts.values())} against {min(counts.values())}" in d[
            "reason"]


def test_an_interval_is_required_with_two_days_or_more():
    with pytest.raises(ValueError, match="need an interval"):
        marker.decide(None, 2, 5, {"HH": 1, "HV": 2}, "2026-11-04")


def test_one_day_of_detections_falls_back_to_the_harvest_pairs():
    # Every detection lies on one day and HV leaves all of them standing (+100 points). A bootstrap of a single day
    # would give the interval [+100, +100], which excludes zero; the rule allows no interval, so item 4 decides:
    # HV gives a harvest pair to 50 test cells, HH to 25.
    grids = classes({(0, 0): (1, 2), (3, 3): (NH, 3)})
    result = evaluate([(centre(0, 0), "2026-10-01"), (centre(0, 0), "2026-10-01")], grids)
    assert result["difference"] == pytest.approx(1.0, abs=1e-12) and result["interval"] is None
    assert result["days"] == 1
    assert result["harvest_pair_cells"] == {"HH": 25, "HV": 50, "by": "2026-10-23", "of": 50}
    assert (result["decision"]["marker"], result["decision"]["rule_item"]) == ("HV", 4)


def test_no_detection_on_rice_falls_back_to_the_harvest_pairs():
    grids = classes({(0, 0): (2, 1), (3, 3): (3, NH)})  # HH: 50 cells with a pair, HV: 25
    result = evaluate([(centre(0, 1), "2026-10-01"), (centre(2, 1), "2026-10-02")], grids)
    assert result["scores"] == {"HH": None, "HV": None} and result["difference"] is None
    assert result["interval"] is None and result["days"] == 0 and result["rice_weight"] == 0.0
    assert result["decision"]["branch"] == "fallback: no detection on rice" and result["decision"]["marker"] == "HH"


def test_the_item_4_count_takes_only_the_test_rice_cells():
    # Rows 5 to 9, columns 5 to 14 (blocks (1, 1) and (1, 2)) have harvest pair 2 in HH but no data in HV: rice in
    # one band only, so not cells of the test, and their 50 HH harvest pairs must not count for HH in rule item 4
    # (D4: HH and HV on the same cells). On the test's 50 cells HV wins, 50 against 25; counted over every rice cell
    # of each band HH would win, 75 against 50. One day of detections, so item 4 decides.
    grids = classes({(0, 0): (1, 2), (3, 3): (NH, 3), (1, 1): (2, 0), (1, 2): (2, 0)})
    result = evaluate([(centre(0, 0), "2026-10-01"), (centre(0, 0), "2026-10-01")], grids)
    assert result["cells"] == {"test_rice": 50, "rice_in_one_band_only": 50}
    assert result["harvest_pair_cells"] == {"HH": 25, "HV": 50, "by": "2026-10-23", "of": 50}
    assert (result["decision"]["marker"], result["decision"]["rule_item"]) == ("HV", 4)
    assert "(50 against 25 for HH)" in result["decision"]["reason"]


def test_harvest_pair_counts_leave_out_fell_before_and_cells_outside_the_test():
    grids = classes({(0, 0): (1, 2), (0, 1): (FB, FB), (0, 2): (NH, 3), (1, 0): (3, 0), (1, 1): (NR, NR)})
    scored = marker.scored_cells(grids["HH"], grids["HV"], CODES, EVERYWHERE)
    assert int(scored.sum()) == 75  # (0, 0), (0, 1), (0, 2); not (1, 0), whose HV has no data
    assert marker.harvest_pair_counts(grids, scored, CODES) == {"HH": 25, "HV": 50}


# The class raster's content hash -------------------------------------------------------------------------------

def test_the_content_hash_follows_the_classes_not_the_file(tmp_path):
    grids = classes(SCORE_GRIDS)
    bands = np.stack([grids["HH"], grids["HV"]])
    one, two = tmp_path / "one.tif", tmp_path / "two.tif"
    write_geotiff(one, bands, "EPSG:32611", TRANSFORM, 0, descriptions=["HH", "HV"], tags={"PIPELINE_INPUTS": "a"})
    write_geotiff(two, bands, "EPSG:32611", TRANSFORM, 0, descriptions=["HH", "HV"], tags={"PIPELINE_INPUTS": "b"})
    a, b = read_geotiff(one), read_geotiff(two)
    assert marker.content_hash(*a) == marker.content_hash(*b)  # another record of inputs: the same classes
    changed = bands.copy()
    changed[1, 19, 19] = NH
    write_geotiff(two, changed, "EPSG:32611", TRANSFORM, 0, descriptions=["HH", "HV"], tags={"PIPELINE_INPUTS": "a"})
    assert marker.content_hash(*read_geotiff(two)) != marker.content_hash(*a)
    for transform, crs in ((TRANSFORM @ Affine.translation(1, 0), "EPSG:32611"), (TRANSFORM, "EPSG:32612")):
        write_geotiff(two, bands, crs, transform, 0, descriptions=["HH", "HV"], tags={"PIPELINE_INPUTS": "a"})
        assert marker.content_hash(*read_geotiff(two)) != marker.content_hash(*a)


# Texts ----------------------------------------------------------------------------------------------------------

def _doc(span=(0.201, 0.45), days: int = 12, used: int = 40, counts=(600, 300), **changes) -> dict:
    """A marker.json-like document of SYNTHETIC numbers, for the texts; counts are HH's and HV's harvest pairs."""
    pairs = {"HH": counts[0], "HV": counts[1]}
    span = None if span is None else list(span)
    doc = {"window": {"first": "2026-09-29", "last": "2026-11-14", "detections_fetched": ["2026-09-15", "2026-11-14"],
                      "covered": ["2026-09-29", "2026-11-14"]},
           "bootstrap": {"replicates": 2000, "seed": 20261114},
           "cells": {"test_rice": 900, "rice_in_one_band_only": 3},
           "detections": {"in_window": 50, "used": used, "unused": 50 - used}, "days": days, "rice_weight": 31.5,
           "scores": {"HH": 0.123, "HV": 0.456}, "difference": 0.333, "interval": span,
           "harvest_pair_cells": {**pairs, "by": "2026-10-23", "of": 900},
           "decision": marker.decide(span, days, used, pairs, "2026-10-23")}
    doc.update(changes)
    return doc


def test_the_method_sentence_gives_both_scores_the_interval_and_the_rule_item():
    text = marker.method_sentence(_doc())
    assert text.startswith("Marker test, by a rule that the team's own record says was written down before any fire "
                           "data was analysed: ")
    for part in ("UTC dates from 2026-09-29 to 2026-11-14", "(40 detections on 12 days", "HH still called 12.3 %",
                 "HV 45.6 %", "HV minus HH +33.3 percentage points", "95 % interval +20.1 to +45.0",
                 "Decision: HH, by item 3 of the rule (the interval excludes zero)."):
        assert part in text, part
    fallback = marker.method_sentence(_doc(span=(-0.05, 0.45), counts=(300, 600)))
    assert ("Decision: HV, by item 4 of the rule (the interval includes zero; HV gives a harvest pair to more rice "
            "cells by 23 October 2026: 600 against 300).") in fallback
    tie = marker.method_sentence(_doc(span=(-0.05, 0.45), counts=(600, 600)))
    assert "No decision: the interval includes zero and HH and HV both give a harvest pair to 600 rice cells" in tie
    assert "the choice is the team's" in tie
    one_day = marker.method_sentence(_doc(span=None, days=1))
    assert "on 1 day," in one_day and "no interval (fewer than 2 days)." in one_day
    assert "Decision: HH, by item 4 of the rule (the detections on rice fall on fewer than 2 days;" in one_day
    none = marker.method_sentence(_doc(span=None, days=0, used=0, scores={"HH": None, "HV": None}, difference=None))
    assert "no VIIRS fire detection with a UTC date from 2026-09-29 to 2026-11-14 lay on rice" in none
    assert ("(no detection lay on rice; HH gives a harvest pair to more rice cells by 23 October 2026: 600 "
            "against 300)") in none


def test_a_result_made_on_part_of_the_window_has_no_sentence():
    lines = marker.report(_doc())
    assert not any("WARNING" in line for line in lines)
    assert any("decision: HH (rule item 3, interval excludes zero)" in line for line in lines)
    # Results made on part of the window, as the stage wrote them before it checked this (SYNTHETIC numbers): fires
    # ran before 14 November had ended in UTC, or before the window opened, so that no day of it was fetched. The
    # second must not be published as "no detection lay on rice" from 29 September to 14 November.
    short = _doc(window={"first": "2026-09-29", "last": "2026-11-14",
                         "detections_fetched": ["2026-09-15", "2026-11-13"], "covered": ["2026-09-29", "2026-11-13"]})
    none = _doc(span=None, days=0, used=0, scores={"HH": None, "HV": None}, difference=None,
                window={"first": "2026-09-29", "last": "2026-11-14", "detections_fetched": ["2026-09-15", "2026-09-20"],
                        "covered": None})
    for doc, days in ((short, "2026-11-14"), (none, "2026-09-29 to 2026-11-14")):
        warning = [line for line in marker.report(doc) if "WARNING" in line]
        assert len(warning) == 1 and f"these days of the window were not fetched: {days}" in warning[0]
        with pytest.raises(ValueError, match=f"made on part of its window .*not fetched: {days}"):
            marker.method_sentence(doc)


def test_a_bound_that_is_not_zero_never_reads_as_zero():
    # At one decimal a bound of +0.04 percentage points would print as +0.0 next to "lies above zero", the same as a
    # bound of exactly zero, which includes zero: the text would show one interval for two opposite decisions.
    above = marker.decide([0.0004, 0.2], 5, 30, {"HH": 1, "HV": 2}, "2026-11-04")
    assert above["marker"] == "HH" and "(+0.04 to +20.0 percentage points) lies above zero" in above["reason"]
    below = marker.decide([-0.2, -0.0004], 5, 30, {"HH": 2, "HV": 1}, "2026-11-04")
    assert below["marker"] == "HV" and "(-20.0 to -0.04 percentage points) lies below zero" in below["reason"]
    zero = marker.decide([0.0, 0.2], 5, 30, {"HH": 1, "HV": 2}, "2026-11-04")
    assert zero["rule_item"] == 4 and "(0.0 to +20.0 percentage points) includes zero" in zero["reason"]
    tiny = marker.decide([3e-9, 0.2], 5, 30, {"HH": 1, "HV": 2}, "2026-11-04")
    assert tiny["marker"] == "HH" and "(+3e-07 to +20.0 percentage points)" in tiny["reason"]
    near = _doc(span=(0.0004, 0.2), difference=0.00049)
    text = marker.method_sentence(near)
    assert ("HV minus HH +0.049 percentage points, 95 % interval +0.04 to +20.0 (bootstrap over days). Decision: HH, "
            "by item 3 of the rule (the interval excludes zero).") in text
    assert any("95 % interval +0.04 to +20.0" in line for line in marker.report(near))
    for line in [text, *marker.report(near), above["reason"], below["reason"]]:
        assert not re.search(r"[+-]0\.0(?!\d)", line), line  # no signed zero that is not one
    # Values that do not round to zero keep one decimal.
    assert "HV minus HH +33.3 percentage points, 95 % interval +20.1 to +45.0" in marker.method_sentence(_doc())


# The stage, export and the command on the SYNTHETIC harvest site -------------------------------------------------

MARKER_FIRES = {"start": "2026-09-20", "end": "2026-10-25", "sources": ["VIIRS_NOAA20_NRT"]}
# Centres of blocks of the synthetic harvest site (test_end_to_end.H_REGIONS), as (row, column) of its 20 m grid.
# Passes: 08-30, 09-11, 09-23, 10-05, 10-17, so the window runs from 09-23 to 10-25.
A = lonlat(250, 160)  # HH: harvest pair 1 (ends 09-23); HV: pair 2 (ends 10-05)
B = lonlat(250, 340)  # pair 2 in both
C = lonlat(370, 160)  # pair 3 in both (ends 10-17)
S = lonlat(370, 340)  # no harvest seen in both
F = lonlat(447.5, 87.5)  # fell before in both (a 300 m block: part of the square lies on ground that is not rice)
T = lonlat(130, 130)  # the town: not rice
MARKER_ROWS = [  # SYNTHETIC detections
    det(A, "2026-09-21", "0801"),  # before the window: left out
    det(A, "2026-09-23", "0802"),  # the window's first day, a pass: HH has harvested A on it, HV has not
    det(A, "2026-09-24", "0803"),
    det(A, "2026-09-26", "0804"), det(S, "2026-09-26", "0805"),
    det(A, "2026-09-28", "0806"),
    det(A, "2026-09-30", "0807"), det(B, "2026-09-30", "0808"),
    det(A, "2026-10-02", "0809"),
    det(A, "2026-10-03", "0810"), det(T, "2026-10-03", "0811"),  # the town: not used
    det(B, "2026-10-05", "0812"), det(A, "2026-10-05", "0813"),  # a pass: both have harvested A and B on it
    det(C, "2026-10-08", "0814"), det(F, "2026-10-08", "0815"),
    det(A, "2026-10-14", "0816"),
    det(S, "2026-10-20", "0817"), det(C, "2026-10-20", "0818"),
    det(S, "2026-10-25", "0819"),  # the window's last day
]


def _no_network(url: str) -> bytes:
    raise AssertionError("a marker test asked the network")


@pytest.fixture(scope="module")
def fired(tmp_path_factory):
    """The synthetic harvest site run end to end with a fires block, its detections.json written by the fires
    stage from the fake FIRMS. The marker test is not part of run, so there is no marker.json yet."""
    layout = _harvest_site(tmp_path_factory.mktemp("marker"))
    _edit_site(layout, fires=MARKER_FIRES)
    with pytest.MonkeyPatch.context() as mp:
        fake = FakeFirms({"VIIRS_NOAA20_NRT": MARKER_ROWS})
        mp.setattr(fires_mod, "http_get", fake)
        mp.setattr(fires_mod, "utc_now", lambda: fake.now)
        mp.setenv(fires_mod.ENV_KEY, KEY)
        assert run_site(load_site(SITE_ID, layout.sites_dir), layout) == 0
    return layout


@pytest.fixture
def site(fired, tmp_path, monkeypatch):
    """A copy of the fired site for one test, with no key and no network."""
    monkeypatch.delenv(fires_mod.ENV_KEY, raising=False)
    monkeypatch.setattr(fires_mod, "http_get", _no_network)
    return _copy_run(fired, tmp_path)


def _cfg(layout):
    return load_site(SITE_ID, layout.sites_dir)


def _analysis(layout):
    return layout.site_work(SITE_ID) / "analysis"


def _method(layout) -> str:
    site = read_json(layout.site_data(SITE_ID) / "site.json")
    return next(la for la in site["layers"] if la["id"] == "harvest-wave")["method"]


def _expected(layout) -> dict:
    """The test's numbers computed here, without pipeline/marker.py or fires.py: each detection's 375 m square
    against the edges of every 100 m cell, and the classes read as the rule reads them."""
    bands, info = read_geotiff(_analysis(layout) / HARVEST_RASTER)
    hh, hv = bands[info["descriptions"].index("HH")], bands[info["descriptions"].index("HV")]
    t, (rows, cols) = info["transform"], hh.shape
    region, _ = target_pixels(tuple(_cfg(layout).bbox), info["crs"], t, hh.shape)
    scored = (hh >= 1) & (hh <= 5) & (hv >= 1) & (hv <= 5) & region

    def standing(code: int, day: str) -> bool:  # no harvest seen, or a pair whose later pass is after the day
        return code == 4 or (1 <= code <= 3 and H_PASSES[code + 1] > day)

    to_grid = Transformer.from_crs("EPSG:4326", info["crs"], always_xy=True)
    found = read_json(layout.site_work(SITE_ID) / "fires" / DETECTIONS_FILE)["detections"]
    per = []
    for d in found:
        if not H_PASSES[2] <= d["date"] <= MARKER_FIRES["end"]:
            continue
        x, y = to_grid.transform(d["lon"], d["lat"])
        r = s_hh = s_hv = 0.0
        for i in range(rows):
            for j in range(cols):
                x0, y1 = t.c + j * t.a, t.f + i * t.e
                ox = min(x + 187.5, x0 + t.a) - max(x - 187.5, x0)
                oy = min(y + 187.5, y1) - max(y - 187.5, y1 + t.e)
                if ox <= 0 or oy <= 0 or not scored[i, j]:
                    continue
                a = ox * oy / 375.0 ** 2
                r += a
                s_hh += a * standing(int(hh[i, j]), d["date"])
                s_hv += a * standing(int(hv[i, j]), d["date"])
        per.append((d["date"], r, s_hh, s_hv))
    used = [p for p in per if p[1] > 0]
    total = sum(p[1] for p in used)
    days = sorted({p[0] for p in used})
    rng, diffs = np.random.default_rng(20261114), []
    for _ in range(2000):
        r = s_hh = s_hv = 0.0
        for k in rng.integers(0, len(days), size=len(days)):
            for day, ri, hi, vi in used:
                if day == days[k]:
                    r, s_hh, s_hv = r + ri, s_hh + hi, s_hv + vi
        diffs.append(s_hv / r - s_hh / r)
    return {"in_window": len(per), "used": len(used), "days": len(days), "rice_weight": total,
            "HH": sum(p[2] for p in used) / total, "HV": sum(p[3] for p in used) / total,
            "interval": list(np.percentile(diffs, [2.5, 97.5])),
            "pairs": {"HH": int((scored & (hh >= 1) & (hh <= 3)).sum()),
                      "HV": int((scored & (hv >= 1) & (hv <= 3)).sum())}}


def test_run_does_not_make_the_marker_test(fired):
    assert (_analysis(fired) / HARVEST_FILE).is_file()
    assert not (_analysis(fired) / MARKER_FILE).exists()
    assert "Marker test" not in _method(fired)


def test_the_marker_stage_on_the_synthetic_site(site, capsys):
    capsys.readouterr()
    doc = marker_site(_cfg(site), site)
    assert read_json(_analysis(site) / MARKER_FILE) == json.loads(json.dumps(doc))
    want = _expected(site)
    assert doc["window"] == {"first": "2026-09-23", "last": "2026-10-25", "detections_fetched": ["2026-09-20",
                             "2026-10-25"], "covered": ["2026-09-23", "2026-10-25"]}
    assert doc["detections"] == {"in_window": 18, "used": want["used"], "unused": 18 - want["used"]}
    assert want["in_window"] == 18 and want["used"] == 17 and doc["days"] == want["days"] == 12
    assert doc["rice_weight"] == pytest.approx(want["rice_weight"], rel=1e-9)
    assert doc["scores"] == {"HH": pytest.approx(want["HH"], rel=1e-9), "HV": pytest.approx(want["HV"], rel=1e-9)}
    assert doc["difference"] == pytest.approx(want["HV"] - want["HH"], rel=1e-9)
    assert doc["interval"] == pytest.approx(want["interval"], rel=1e-9)
    # HV still calls block A standing for one pass after HH saw it harvested, on 7 of the 12 days: the interval lies
    # above zero, so item 3 decides, although HV gives a harvest pair to a few more cells (item 4 would choose HV).
    assert doc["interval"][0] > 0 and doc["difference"] > 0.3
    assert doc["decision"]["marker"] == "HH" and doc["decision"]["rule_item"] == 3
    assert doc["harvest_pair_cells"]["HV"] > doc["harvest_pair_cells"]["HH"]
    assert {k: doc["harvest_pair_cells"][k] for k in ("HH", "HV")} == want["pairs"]
    harvest = read_json(_analysis(site) / HARVEST_FILE)
    assert doc["cumulative"] == {p: harvest["polarizations"][p]["cumulative"] for p in ("HH", "HV")}
    assert doc["bootstrap"]["seed"] == 20261114 and doc["bootstrap"]["replicates"] == 2000
    assert doc["bootstrap"]["percentile_method"] == "linear" and doc["inputs"]["window"] == ["2026-09-23", "2026-10-25"]
    assert "marker" not in doc["inputs"]["harvest_settings"] and doc["inputs"]["harvest_settings"]["passes"] == H_PASSES
    out = capsys.readouterr().out
    assert "marker  decision: HH (rule item 3, interval excludes zero)" in out
    assert "the site file's harvest.marker is HH, as the test chose" in out and "WARNING" not in out


def test_the_marker_stage_follows_the_rerun_rule(site, capsys):
    cfg = _cfg(site)
    target = _analysis(site) / MARKER_FILE
    first = marker_site(cfg, site)
    made = target.stat().st_mtime_ns
    capsys.readouterr()
    assert marker_site(cfg, site) == first  # nothing changed: skipped, the result printed again
    out = capsys.readouterr().out
    assert "marker: exists, skipped" in out and "decision: HH" in out and target.stat().st_mtime_ns == made
    marker_site(cfg, site, force=True)
    assert target.stat().st_mtime_ns > made and read_json(target) == first
    made = target.stat().st_mtime_ns

    # A re-analysis that changes only harvest.marker writes the same classes: the test is not redone, and it says
    # that the site file now disagrees with it.
    _edit_site(site, harvest={**H_BLOCK, "marker": "HV"})
    cfg = _cfg(site)
    analyse_site(cfg, site)
    capsys.readouterr()
    assert marker_site(cfg, site) == first and target.stat().st_mtime_ns == made
    out = capsys.readouterr().out
    assert "marker: exists, skipped" in out
    assert "WARNING: marker: the marker test chose HH, but the site file's harvest.marker is HV" in out

    # Other detections redo it.
    found = site.site_work(SITE_ID) / "fires" / DETECTIONS_FILE
    fires_doc = read_json(found)
    fires_doc["detections"] = [d for d in fires_doc["detections"] if d["date"] != "2026-10-25"]
    fires_doc["count"] = len(fires_doc["detections"])
    write_json(found, fires_doc)
    again = marker_site(cfg, site)
    assert target.stat().st_mtime_ns > made and again["detections"]["in_window"] == 17
    made = target.stat().st_mtime_ns

    # Other classes redo it: the class raster's content changed, its record of inputs not.
    raster = _analysis(site) / HARVEST_RASTER
    bands, info = read_geotiff(raster)
    bands[:, bands[0] == 4] = 2  # every cell with no harvest seen in HH gets pair 2 in both
    write_geotiff(raster, bands, info["crs"], info["transform"], info["nodata"], descriptions=info["descriptions"],
                  tags=info["tags"])
    changed = marker_site(cfg, site)
    assert target.stat().st_mtime_ns > made
    assert changed["inputs"]["classes"]["sha256"] != again["inputs"]["classes"]["sha256"]


def test_the_marker_stage_says_which_command_to_run_first(site):
    cfg = _cfg(site)
    found = site.site_work(SITE_ID) / "fires" / DETECTIONS_FILE
    found.unlink()
    with pytest.raises(FileNotFoundError, match=r"run `npm run pipeline -- fires --site synthetic-test` first"):
        marker_site(cfg, site)
    (_analysis(site) / HARVEST_FILE).unlink()
    with pytest.raises(FileNotFoundError, match=r"run `npm run pipeline -- analyse --site synthetic-test` first"):
        marker_site(cfg, site)
    _edit_site(site, fires=None)
    with pytest.raises(ConfigError, match="needs a fires block"):
        marker_site(_cfg(site), site)
    _edit_site(site, harvest=None)
    with pytest.raises(ConfigError, match="needs a harvest block"):
        marker_site(_cfg(site), site)


def test_detections_made_with_other_fires_settings_are_not_used(site):
    _edit_site(site, fires={**MARKER_FIRES, "end": "2026-10-26"})
    with pytest.raises(FileNotFoundError, match="no fire detections fetched with the current fires settings"):
        marker_site(_cfg(site), site)


def _fetch(layout, monkeypatch, now: dt.datetime | None = None) -> dict:
    """The fires stage on the copy, from the fake FIRMS of test_fires.py with its clock at `now` (UTC); afterwards
    the network is closed again. Returns what detections.json holds."""
    fake = FakeFirms({"VIIRS_NOAA20_NRT": MARKER_ROWS})
    fake.now = now or fake.now
    monkeypatch.setattr(fires_mod, "http_get", fake)
    monkeypatch.setattr(fires_mod, "utc_now", lambda: fake.now)
    monkeypatch.setenv(fires_mod.ENV_KEY, KEY)
    found = fires_site(_cfg(layout), layout)
    monkeypatch.setattr(fires_mod, "http_get", _no_network)
    monkeypatch.delenv(fires_mod.ENV_KEY)
    return found


def test_the_test_is_not_made_on_part_of_the_window(site, monkeypatch, capsys):
    # SYNTHETIC clock: fires ran at 12:00 UTC on 2026-10-25, the window's last day, which had not ended, so
    # detections.json holds the days 2026-09-20 to 2026-10-24 (fires fetches a day once it has ended in UTC). The
    # rule takes every detection of its window: the stage stops before computing anything, with or without
    # --force, writes no marker.json, prints no number and says what to run.
    cfg = _cfg(site)
    assert _fetch(site, monkeypatch, dt.datetime(2026, 10, 25, 12, 0, tzinfo=dt.UTC))["asked"] == [
        "2026-09-20", "2026-10-24"]
    capsys.readouterr()
    for force in (False, True):
        with pytest.raises(FileNotFoundError) as stop:
            marker_site(cfg, site, force=force)
        text = str(stop.value)
        assert ("the marker rule's window runs from 2026-09-23 to 2026-10-25, but detections.json holds the days "
                "2026-09-20 to 2026-10-24, so these days of the window were not fetched: 2026-10-25") in text
        assert ("nothing was computed: run `npm run pipeline -- fires --site synthetic-test` again once 2026-10-25 "
                "has ended in UTC (at 00:00 UTC on 2026-10-26; near-real-time detections keep arriving for some "
                "hours after each pass), then `npm run pipeline -- marker --site synthetic-test`") in text
        assert not (_analysis(site) / MARKER_FILE).exists()
    assert "decision" not in capsys.readouterr().out
    # The command says the same and fails.
    monkeypatch.setattr("pipeline.cli.load_env_file", lambda: [])  # never read a real .env
    monkeypatch.setattr(stages_mod, "default_layout", lambda: site)
    monkeypatch.setattr(stages_mod, "load_site", lambda site_id: load_site(site_id, site.sites_dir))
    assert main(["marker", "--site", SITE_ID]) == 1
    captured = capsys.readouterr()
    assert "fires --site synthetic-test` again once 2026-10-25 has ended in UTC" in captured.err
    assert "decision" not in captured.out and not (_analysis(site) / MARKER_FILE).exists()
    # Once the day has ended and fires has run again, the test is made, on the whole window.
    assert _fetch(site, monkeypatch, dt.datetime(2026, 10, 26, 0, 30, tzinfo=dt.UTC))["asked"] == [
        "2026-09-20", "2026-10-25"]
    doc = marker_site(cfg, site)
    assert doc["window"]["covered"] == ["2026-09-23", "2026-10-25"] and doc["detections"]["in_window"] == 18
    assert doc["decision"]["status"] == "decided"


def test_the_test_is_not_made_when_no_day_of_the_window_was_fetched(site, monkeypatch):
    # SYNTHETIC clock: fires ran on 2026-09-22, before the window opened (2026-09-23), so detections.json holds only
    # 2026-09-20 and 2026-09-21. Nothing is known of the window: no "no detection lay on rice", no rule item 4.
    assert _fetch(site, monkeypatch, dt.datetime(2026, 9, 22, 12, 0, tzinfo=dt.UTC))["asked"] == [
        "2026-09-20", "2026-09-21"]
    with pytest.raises(FileNotFoundError, match="these days of the window were not fetched: 2026-09-23 to 2026-10-25"):
        marker_site(_cfg(site), site)
    assert not (_analysis(site) / MARKER_FILE).exists()


def test_a_fires_block_that_starts_inside_the_window_is_named(site, monkeypatch):
    _edit_site(site, fires={**MARKER_FIRES, "start": "2026-09-25"})  # after the window's first day, 2026-09-23
    assert _fetch(site, monkeypatch)["asked"] == ["2026-09-25", "2026-10-25"]
    with pytest.raises(FileNotFoundError) as stop:
        marker_site(_cfg(site), site)
    text = str(stop.value)
    assert "these days of the window were not fetched: 2026-09-23 to 2026-09-24" in text
    assert "set the fires block's start to 2026-09-23 or earlier in " in text and "has ended in UTC" not in text
    assert not (_analysis(site) / MARKER_FILE).exists()


def test_export_leaves_out_a_result_made_on_part_of_the_window(site, capsys):
    # A marker.json made on part of the window, as the stage wrote one before it checked this (a SYNTHETIC edit of
    # the record of the days fetched): export publishes no sentence from it, says why and what to run, for a window
    # cut short at its end and for one of which no day was fetched.
    cfg = _cfg(site)
    marker_site(cfg, site)
    target = _analysis(site) / MARKER_FILE
    doc = read_json(target)
    for fetched, covered, days in ((["2026-09-20", "2026-10-24"], ["2026-09-23", "2026-10-24"], "2026-10-25"),
                                   (["2026-09-20", "2026-09-21"], None, "2026-09-23 to 2026-10-25")):
        doc["window"].update(detections_fetched=fetched, covered=covered)
        write_json(target, doc)
        capsys.readouterr()
        export_site(cfg, site)
        out = capsys.readouterr().out
        assert "export  WARNING: " in out and "marker.json was made on part of its window: " in out
        assert f"these days of the window were not fetched: {days}. The rule takes every detection" in out
        assert "fires --site synthetic-test` again once 2026-10-25 has ended in UTC" in out
        assert "method text reports the marker test" not in out and "Marker test" not in _method(site)
    manifest_stage(site)
    assert validate(site.data_dir) == []


def test_export_puts_the_result_in_the_method_text(site, capsys):
    cfg = _cfg(site)
    doc = marker_site(cfg, site)
    capsys.readouterr()
    export_site(cfg, site)
    manifest_stage(site)
    assert validate(site.data_dir) == []
    method = _method(site)
    assert marker.method_sentence(doc) in method and method.endswith(" Details: docs/METHODS.md.")
    assert f"HH still called {100 * doc['scores']['HH']:.1f} % not harvested" in method
    assert f"HV {100 * doc['scores']['HV']:.1f} %" in method
    assert f"({doc['detections']['used']} detections on {doc['days']} days" in method
    assert "Decision: HH, by item 3 of the rule (the interval excludes zero)." in method
    out = capsys.readouterr().out
    assert "method text reports the marker test (marker.json): decision HH, rule item 3" in out
    assert "WARNING" not in out


def test_a_marker_only_reanalysis_keeps_the_result_and_warns_of_the_mismatch(site, capsys):
    marker_site(_cfg(site), site)
    _edit_site(site, harvest={**H_BLOCK, "marker": "HV"})
    cfg = _cfg(site)
    analyse_site(cfg, site)
    capsys.readouterr()
    export_site(cfg, site)
    out = capsys.readouterr().out
    assert ("export  WARNING: the marker test chose HH, but the site file's harvest.marker is HV, so the harvest map "
            "is drawn from HV") in out
    assert "Decision: HH, by item 3 of the rule" in _method(site)  # the same classes: the result still applies


def test_a_stale_marker_result_is_left_out_with_a_warning(site, capsys):
    cfg = _cfg(site)
    marker_site(cfg, site)
    raster = _analysis(site) / HARVEST_RASTER
    bands, info = read_geotiff(raster)
    bands[1, bands[1] == 2] = 3  # HV's pair 2 becomes pair 3: other classes, the same record of inputs
    write_geotiff(raster, bands, info["crs"], info["transform"], info["nodata"], descriptions=info["descriptions"],
                  tags=info["tags"])
    capsys.readouterr()
    export_site(cfg, site)
    out = capsys.readouterr().out
    assert "is stale: it was made from other harvest classes than the current harvest_classes.tif" in out
    assert "WARNING" in out and "Marker test" not in _method(site)
    manifest_stage(site)
    assert validate(site.data_dir) == []


def test_export_without_a_marker_test_or_with_newer_detections(site, capsys):
    cfg = _cfg(site)
    capsys.readouterr()
    export_site(cfg, site)
    assert "no marker test yet (marker.json)" in capsys.readouterr().out and "Marker test" not in _method(site)
    marker_site(cfg, site)
    found = site.site_work(SITE_ID) / "fires" / DETECTIONS_FILE
    fires_doc = read_json(found)
    fires_doc["requests"] = [{"note": "SYNTHETIC: fetched again"}]
    write_json(found, fires_doc)
    capsys.readouterr()
    export_site(cfg, site)
    out = capsys.readouterr().out
    assert "note: detections.json changed after the marker test" in out and "Marker test" in _method(site)


def test_a_damaged_marker_result_is_left_out_with_a_warning(site, capsys):
    cfg = _cfg(site)
    marker_site(cfg, site)
    (_analysis(site) / MARKER_FILE).write_text("{not json", encoding="utf-8")
    capsys.readouterr()
    export_site(cfg, site)
    out = capsys.readouterr().out
    assert "export  WARNING:" in out and "cannot be read" in out and "Marker test" not in _method(site)


def test_the_marker_command(site, monkeypatch, capsys):
    assert build_parser().parse_args(["marker", "--site", SITE_ID]).func
    monkeypatch.setattr("pipeline.cli.load_env_file", lambda: [])  # never read a real .env
    monkeypatch.setattr(stages_mod, "default_layout", lambda: site)
    monkeypatch.setattr(stages_mod, "load_site", lambda site_id: load_site(site_id, site.sites_dir))
    capsys.readouterr()
    assert main(["marker", "--site", SITE_ID]) == 0
    assert "marker  decision: HH" in capsys.readouterr().out and (_analysis(site) / MARKER_FILE).is_file()
    assert main(["marker", "--site", SITE_ID]) == 0
    assert "marker: exists, skipped" in capsys.readouterr().out
    shutil.rmtree(site.site_work(SITE_ID) / "fires")
    assert main(["marker", "--site", SITE_ID]) == 1
    assert "fires --site synthetic-test` first" in capsys.readouterr().err


def test_fires_and_run_do_not_touch_the_marker_result(site, monkeypatch):
    cfg = _cfg(site)
    marker_site(cfg, site)
    target = _analysis(site) / MARKER_FILE
    made = target.stat().st_mtime_ns
    fake = FakeFirms({"VIIRS_NOAA20_NRT": MARKER_ROWS})
    monkeypatch.setattr(fires_mod, "http_get", fake)
    monkeypatch.setattr(fires_mod, "utc_now", lambda: fake.now)
    fires_site(cfg, site)
    assert run_site(cfg, site) == 0
    assert target.stat().st_mtime_ns == made and "Decision: HH" in _method(site)

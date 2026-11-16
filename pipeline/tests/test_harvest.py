"""The harvest analysis (pipeline/harvest.py) on hand-made SYNTHETIC cell arrays, where every number is known.

The stage, the exported layer and validate are tested on a whole synthetic site in test_end_to_end.py. No
coordinate here is a place: the grids are the synthetic UTM grid of synth.py.
"""

from __future__ import annotations

import math

import numpy as np
import pytest
import rasterio
from affine import Affine

from pipeline import harvest as hv
from pipeline.config import Harvest
from pipeline.export import web_grid, write_cog
from pipeline.manifest import categorical_problem
from pipeline.tests.synth import SynthGrid

NAN = np.nan
PASSES = ["2026-09-01", "2026-09-13", "2026-09-25", "2026-10-07", "2026-10-19"]  # 4 pairs, 3 harvest pairs
CODES = hv.Codes.for_passes(len(PASSES))  # 1, 2, 3 harvest pairs; 4 no harvest; 5 fell before; 6 not rice


def power(db) -> np.ndarray:
    return 10 ** (np.asarray(db, dtype=np.float64) / 10)


def levels_to_powers(levels: list[list[float]]) -> list[np.ndarray]:
    """One row of cells per entry of `levels`; each entry lists a cell's dB on every pass. Returns one power
    array (1 x cells) per pass."""
    table = np.array(levels, dtype=np.float64)  # cells x passes
    return [power(table[:, j])[np.newaxis, :] for j in range(table.shape[1])]


# Step 1: cells ---------------------------------------------------------------------------------------------

def test_cells_average_linear_power_and_need_half_of_the_pixels():
    px = np.full((12, 11), power(-10.0))  # 12 x 11: the last 2 rows and the last column fill no block
    block = np.full((5, 5), power(-25.0))
    block.flat[:13] = power(-5.0)  # 13 pixels at -5 dB, 12 at -25 dB
    px[:5, :5] = block
    px[:5, 5:10] = NAN
    px[:5, 5:10].flat[:12] = power(-10.0)  # 12 of 25 valid: less than half, so no value
    px[5:10, :5] = NAN
    px[5:10, :5].flat[:13] = power(-12.0)  # 13 of 25 valid: enough
    px[5:10, 5:10].flat[:13] = 0.0  # not a positive power: invalid, so 12 valid and no value
    cells = hv.cells(px, 5)
    assert cells.shape == (2, 2)
    mean_of_power_db = 10 * np.log10(block.mean())
    mean_of_db = np.mean(10 * np.log10(block))
    assert abs(mean_of_power_db - mean_of_db) > 1  # the mixed block tells the two methods apart (6.8 dB)
    # process.multilook does the block mean and returns float32, the type of the processed rasters.
    assert 10 * np.log10(cells[0, 0]) == pytest.approx(mean_of_power_db, abs=1e-5)
    assert np.isnan(cells[0, 1]) and np.isnan(cells[1, 1])
    assert 10 * np.log10(cells[1, 0]) == pytest.approx(-12.0, abs=1e-5)


def test_cell_grid_area_and_factor():
    transform = Affine(20.0, 0.0, 400000.0, 0.0, -20.0, 3857000.0)
    cell_transform, shape = hv.cell_grid(transform, (483, 251), 5)
    assert cell_transform == Affine(100.0, 0.0, 400000.0, 0.0, -100.0, 3857000.0) and shape == (96, 50)
    assert hv.cell_area_km2(cell_transform) == pytest.approx(0.01)
    assert hv.cell_factor(20.0, 100.0) == 5 and hv.cell_factor(20.0, 20.0) == 1
    with pytest.raises(ValueError, match="whole multiple"):
        hv.cell_factor(20.0, 90.0)


# Step 2: rice --------------------------------------------------------------------------------------------

def test_rise_is_db_of_the_mean_peak_power_minus_the_lowest_flood_db():
    flood = [power([[-20.0, -20.0, -20.0]]), power([[-14.0, -14.0, NAN]])]
    peak = [power([[-5.0, -5.0, -5.0]]), power([[-25.0, NAN, -25.0]])]
    rise = hv.rise_db(flood, peak)
    expected = 10 * np.log10((power(-5.0) + power(-25.0)) / 2) - (-20.0)  # 12.04 dB
    assert rise[0, 0] == pytest.approx(expected, abs=1e-9)
    assert abs(rise[0, 0] - (-15.0 + 20.0)) > 5  # the mean of the peak dB values would give a rise of 5 dB
    assert np.isnan(rise[0, 1]) and np.isnan(rise[0, 2])  # not valid on a peak date / on a flood date


def test_rice_mask_on_cells_with_a_known_rise():
    rise = np.array([[2.0, 7.3], [7.29, NAN]])
    rice, not_rice = hv.rice_classes(rise, 7.3)
    assert rice.tolist() == [[False, True], [False, False]]
    assert not_rice.tolist() == [[True, False], [True, False]]  # no rise: neither


def test_otsu_puts_the_threshold_in_the_middle_of_the_gap_between_two_clear_groups():
    # Two groups in the centres of their 0.1 dB bins, 2.05 and 12.05 dB: every split from 2.1 to 12.0 is
    # equally good, and the middle of them is 7.05 dB.
    values = np.array([2.05] * 600 + [12.05] * 400 + [NAN])
    assert hv.otsu_threshold(values) == pytest.approx(7.05, abs=1e-9)
    # Spread groups: the threshold still falls between them.
    rng = np.random.default_rng(3)
    spread = np.concatenate([rng.normal(1.0, 1.0, 5000), rng.normal(13.0, 1.5, 4000)])
    assert 4.0 < hv.otsu_threshold(spread) < 9.0
    # Values outside the fixed range count in the end bins.
    assert hv.otsu_threshold(np.array([-50.0] * 10 + [80.0] * 10)) == pytest.approx(10.0, abs=1e-9)
    assert (hv.OTSU_RANGE_DB, hv.OTSU_BINS) == ((-10.0, 30.0), 400)
    with pytest.raises(ValueError, match="one histogram bin"):
        hv.otsu_threshold(np.array([3.0, 3.01, 3.02]))


# Step 3: stable cells --------------------------------------------------------------------------------------

CELL_GRID = SynthGrid(x_first=400050.0, y_first=3856950.0, spacing=100.0, rows=20, cols=20)
CELL_TRANSFORM = Affine(100.0, 0.0, 400000.0, 0.0, -100.0, 3857000.0)


def test_stable_cells_are_cells_with_their_centre_in_a_box_that_are_not_rice():
    box = CELL_GRID.lonlat_box(5, 10, 4, 12)  # strictly inside the block of rows 5-9, columns 4-11
    other = CELL_GRID.lonlat_box(15, 17, 15, 17)
    selection, wheres = hv.cells_in_boxes([box, other], "EPSG:32611", CELL_TRANSFORM, (20, 20))
    expected = np.zeros((20, 20), dtype=bool)
    expected[5:10, 4:12] = True
    expected[15:17, 15:17] = True
    assert np.array_equal(selection, expected) and wheres == ["inside the window"] * 2
    rise = np.zeros((20, 20))
    rise[6, 6] = 12.0  # a rice cell inside the box
    rise[7, 7] = NAN  # a cell without a rise
    rice, not_rice = hv.rice_classes(rise, 7.0)
    stable = selection & not_rice
    assert int(stable.sum()) == 40 + 4 - 2 and not stable[6, 6] and not stable[7, 7]


# Steps 4 and 5: change and threshold ----------------------------------------------------------------------

def test_pair_changes_are_db_of_later_over_earlier_with_nan_kept():
    powers = levels_to_powers([[-6.0, -9.0, -9.0], [-6.0, NAN, -8.0]])
    changes = hv.pair_changes(powers)
    assert changes[0][0].tolist() == pytest.approx([-3.0, NAN], nan_ok=True)
    assert changes[1][0].tolist() == pytest.approx([0.0, NAN], nan_ok=True)
    assert hv.complete(changes)[0].tolist() == [True, False]


def _reference_changes(stable_spread: float, rice_spread: float) -> tuple[list[np.ndarray], np.ndarray, np.ndarray]:
    """Changes on 100 stable cells and 100 rice cells for three pairs. Stable cells take the evenly spaced
    values -spread, ..., +spread (one pair twice as wide), rice cells likewise in the first pair; after that,
    every rice cell falls by 8 dB in the second pair."""
    ladder = np.linspace(-1.0, 1.0, 100)
    stable = np.concatenate([np.ones(100, bool), np.zeros(100, bool)])[np.newaxis, :]
    rice = ~stable
    first = np.concatenate([ladder * stable_spread, ladder * rice_spread])
    second = np.concatenate([ladder * stable_spread * 2, np.full(100, -8.0)])
    third = np.concatenate([ladder * stable_spread, ladder * 0.1])
    return [first[np.newaxis, :], second[np.newaxis, :], third[np.newaxis, :]], stable, rice


@pytest.mark.parametrize("stable_spread, rice_spread, used", [(3.0, 1.0, "stable"), (1.0, 5.0, "rice")])
def test_threshold_takes_the_stricter_of_the_two_references(stable_spread, rice_spread, used):
    changes, stable, rice = _reference_changes(stable_spread, rice_spread)
    t = hv.false_alarm_threshold(changes, stable, rice, 0.02)
    ladder = np.linspace(-1.0, 1.0, 100)
    # The 0.02 quantile of 100 values (smallest value with at least 2 % at or below it) is the 2nd lowest.
    assert t["stable_quantile_by_pair_db"] == pytest.approx(
        [ladder[1] * stable_spread, ladder[1] * stable_spread * 2, ladder[1] * stable_spread])
    assert t["stable_reference_db"] == pytest.approx(ladder[1] * stable_spread * 2)  # the lowest pair
    assert t["rice_reference_db"] == pytest.approx(ladder[1] * rice_spread)
    assert t["used"] == used
    assert t["threshold_db"] == min(t["stable_reference_db"], t["rice_reference_db"])
    assert (t["stable_cells"], t["rice_cells"]) == (100, 100)
    # At most 2 % of each reference falls below the threshold: exactly the lowest value where it was set.
    assert max(t["stable_share_below_by_pair"]) <= 0.02 and t["rice_share_below_by_pair"][0] <= 0.02
    assert t["rice_share_below_by_pair"][1] == 1.0  # every rice cell fell in the second pair


def test_reference_cells_are_those_valid_on_every_pass():
    # Each pair's quantile must be taken over the same cells. Stable cell 0 (the lowest change of the first pair)
    # and rice cell 100 (likewise) have no value in the third pair, so they take part in no pair at all.
    changes, stable, rice = _reference_changes(1.0, 1.0)
    changes = [c.copy() for c in changes]
    changes[2][0, 0] = changes[2][0, 100] = NAN
    t = hv.false_alarm_threshold(changes, stable, rice, 0.02)
    assert (t["stable_cells"], t["rice_cells"]) == (99, 99)
    full = hv.complete(changes)
    assert not full[0, 0] and not full[0, 100]
    expected = [float(np.quantile(c[stable & full], 0.02, method="inverted_cdf")) for c in changes]
    assert t["stable_quantile_by_pair_db"] == expected and not any(np.isnan(expected))
    ladder = np.linspace(-1.0, 1.0, 100)
    assert expected[0] == pytest.approx(ladder[2])  # without cell 0, the 2nd lowest of the rest
    assert t["rice_reference_db"] == pytest.approx(ladder[2])
    assert t["rice_reference_db"] == float(np.quantile(changes[0][rice & full], 0.02, method="inverted_cdf"))


def test_a_common_step_across_a_release_boundary_is_not_absorbed():
    # docs/METHODS.md, limits: the threshold is one number for every pair. A step that raises every value from
    # the third pair on leaves it as it was (and so shrinks that pair's falls); one that lowers every value
    # makes it stricter for every pair.
    changes, stable, rice = _reference_changes(1.0, 1.0)
    base = hv.false_alarm_threshold(changes, stable, rice, 0.02)
    raised = hv.false_alarm_threshold([c + (2.0 if j == 2 else 0.0) for j, c in enumerate(changes)],
                                      stable, rice, 0.02)
    assert raised["threshold_db"] == base["threshold_db"]
    assert raised["stable_quantile_by_pair_db"][2] == pytest.approx(base["stable_quantile_by_pair_db"][2] + 2.0)
    lowered = hv.false_alarm_threshold([c - (2.0 if j == 2 else 0.0) for j, c in enumerate(changes)],
                                       stable, rice, 0.02)
    assert lowered["threshold_db"] == pytest.approx(base["stable_quantile_by_pair_db"][2] - 2.0)
    assert lowered["threshold_db"] < base["threshold_db"]


def test_threshold_needs_enough_reference_cells_and_a_fall():
    changes, stable, rice = _reference_changes(1.0, 1.0)
    few = stable.copy()
    few[0, 49:100] = False  # 49 stable cells; the 0.02 quantile needs 50
    with pytest.raises(ValueError, match="stable boxes hold 49 cells"):
        hv.false_alarm_threshold(changes, few, rice, 0.02)
    assert hv.min_reference_cells(0.02) == 50 and hv.min_reference_cells(0.05) == 20
    rising = [np.abs(c) + 0.5 for c in changes]
    with pytest.raises(ValueError, match="not a fall"):
        hv.false_alarm_threshold(rising, stable, rice, 0.02)


# Step 6: classes ---------------------------------------------------------------------------------------------

# dB on each of the five passes. Threshold -3 dB: a fall of more than 3 dB between two passes crosses it.
# No value sits exactly on a threshold, so no result depends on rounding.
CELLS = {
    "pair 1": [-6.0, -6.0, -12.0, -12.0, -12.0],
    "pair 2": [-6.0, -6.2, -6.0, -11.0, -11.0],
    "pair 3": [-6.0, -6.0, -6.0, -6.0, -9.5],
    "pair 1 then again in pair 3": [-6.0, -6.0, -10.0, -10.0, -15.0],
    "never": [-6.0, -6.5, -7.0, -7.5, -8.0],  # 2 dB in all, never more than 0.5 dB in one pair
    "first pair": [-6.0, -12.0, -12.0, -12.0, -12.0],
    "first pair and pair 2": [-6.0, -10.0, -10.0, -14.0, -17.0],
    "nan on a pass": [-6.0, -6.0, NAN, -12.0, -12.0],
    "nan after the fall": [-6.0, -6.0, -12.0, -12.0, NAN],
    "not rice": [-6.0, -6.0, -12.0, -12.0, -12.0],
    "no rise": [-6.0, -6.0, -12.0, -12.0, -12.0],
}
EXPECTED = {
    "pair 1": 1, "pair 2": 2, "pair 3": 3, "pair 1 then again in pair 3": 1, "never": CODES.no_harvest,
    "first pair": CODES.fell_before, "first pair and pair 2": CODES.fell_before,
    "nan on a pass": hv.NO_DATA, "nan after the fall": hv.NO_DATA, "not rice": CODES.not_rice, "no rise": hv.NO_DATA,
}


def _classes(threshold: float = -3.0) -> dict[str, int]:
    names = list(CELLS)
    changes = hv.pair_changes(levels_to_powers([CELLS[n] for n in names]))
    rice = np.array([[n not in ("not rice", "no rise") for n in names]])
    not_rice = np.array([[n == "not rice" for n in names]])
    found = hv.harvest_classes(changes, rice, not_rice, threshold)
    assert found.dtype == np.uint8
    return dict(zip(names, found[0].tolist(), strict=True))


def test_harvest_pairs_are_exact_for_cells_built_to_fall_in_known_pairs():
    found = _classes()
    for name in ("pair 1", "pair 2", "pair 3", "pair 1 then again in pair 3"):
        assert found[name] == EXPECTED[name], name
    assert (CODES.no_harvest, CODES.fell_before, CODES.not_rice) == (4, 5, 6)


def test_a_cell_that_crosses_in_the_first_pair_is_its_own_class():
    found = _classes()
    assert found["first pair"] == found["first pair and pair 2"] == CODES.fell_before


def test_a_cell_that_never_falls_far_enough_is_no_harvest_seen():
    assert _classes()["never"] == CODES.no_harvest
    assert _classes(threshold=-0.4)["never"] == CODES.fell_before  # with a threshold above -0.5 dB it crosses


def test_a_change_exactly_on_the_threshold_does_not_cross():
    changes = [np.array([[0.0, 0.0]]), np.array([[-3.0, -3.01]]), np.array([[0.0, 0.0]])]
    rice = np.array([[True, True]])
    found = hv.harvest_classes(changes, rice, ~rice, -3.0)
    assert found.tolist() == [[hv.Codes(2).no_harvest, 1]]


def test_cells_without_data_on_a_pass_get_no_class():
    found = _classes()
    assert found["nan on a pass"] == found["nan after the fall"] == found["no rise"] == hv.NO_DATA
    assert found["not rice"] == CODES.not_rice  # not rice whatever its passes do
    assert found == EXPECTED


# Step 7: diagnostics ---------------------------------------------------------------------------------------

def test_diagnostics_on_known_classes():
    names = list(CELLS)
    table = [CELLS[n] for n in names]
    powers = levels_to_powers(table)
    changes = hv.pair_changes(powers)
    rice = np.array([[n not in ("not rice", "no rise") for n in names]])
    not_rice = np.array([[n == "not rice" for n in names]])
    found = hv.harvest_classes(changes, rice, not_rice, -3.0)

    counts = hv.class_counts(found, CODES, rice)
    assert counts == {"harvest_pair_cells": [2, 1, 1], "no_harvest_cells": 1, "fell_before_cells": 2,
                      "not_rice_cells": 1, "rice_no_data_cells": 2}
    cum = hv.cumulative_shares(found, CODES, PASSES)
    assert cum["counted_cells"] == 7  # 4 with a harvest pair, 1 none, 2 fell before
    assert [(p["date"], p["cells"], p["share"]) for p in cum["by_pass"]] == [
        (PASSES[2], 2, 2 / 7), (PASSES[3], 3, 3 / 7), (PASSES[4], 4, 4 / 7)]

    hh, hv_ = found.copy(), found.copy()
    hv_[0, names.index("pair 1")] = 2  # HV sees that cell one pair later
    cross = hv.cross_table(hh, hv_, rice, CODES)
    assert cross["values"] == [1, 2, 3, 4, 5, 0]
    counts_table = np.array(cross["counts"])
    assert counts_table.sum() == int(rice.sum()) == 9  # every rice cell once, no data included
    assert counts_table[0, 0] == 1 and counts_table[0, 1] == 1 and counts_table[1, 1] == 1
    assert counts_table[4, 4] == 2 and counts_table[5, 5] == 2 and np.trace(counts_table) == 8

    levels = [hv.db(p) for p in powers]
    back = hv.came_back(levels, found, CODES, -3.0)
    # Pair 1 cells: "pair 1" stays at -12 (not back), "pair 1 then again in pair 3" is at -10 on the pass after
    # its pair, not above -6 - 1.5. Pair 2 cell: -11 on the pass after, not back. The pair 3 cell has no pass
    # after its pair.
    assert back == {"margin_db": 1.5, "cells_evaluated": 3, "cells_came_back": 0, "share": 0.0,
                    "cells_not_evaluated": 1}
    found_back = found.copy()
    levels_back = [lv.copy() for lv in levels]
    levels_back[3][0, names.index("pair 1")] = -7.0  # back above -6 - 1.5 on the pass after its pair
    assert hv.came_back(levels_back, found_back, CODES, -3.0)["cells_came_back"] == 1

    counted = (found >= 1) & (found <= CODES.fell_before)
    falls = hv.abrupt_falls(levels, counted)
    # Total falls above 4 dB, with the largest single fall as a fraction: "pair 1" 6 dB (1.0), "pair 2" 5 dB
    # (1.0), "pair 1 then again" 9 dB (5/9), "first pair" 6 dB (1.0), "first pair and pair 2" 11 dB (4/11).
    # "pair 3" (3.5 dB) and "never" (2 dB) fall less; the cells without data are not counted.
    assert falls["cells"] == 5 and falls["min_total_fall_db"] == 4.0
    assert falls["median"] == pytest.approx(1.0) and falls["share_over_half"] == pytest.approx(4 / 5)
    assert falls["quartiles"] == pytest.approx([5 / 9, 1.0])
    assert hv.abrupt_falls(levels, np.zeros_like(counted))["cells"] == 0

    means = hv.mean_db(powers, counted & hv.complete(changes))
    assert means[0] == pytest.approx(-6.0) and len(means) == len(PASSES)


def test_came_back_compares_with_the_value_just_before_the_harvest_pair():
    # Harvest pair 1 runs from pass 1 to pass 2. The cell was at -4 dB on pass 0 and at -6 dB on pass 1, just
    # before its pair (-2 dB in the first pair: no crossing), fell to -12 dB on pass 2, and is at -7 dB on pass 3:
    # above -6 - 1.5, so it came back. Measured against pass 0 (-4 - 1.5) it would not have.
    levels = [np.array([[v]]) for v in (-4.0, -6.0, -12.0, -7.0, -7.0)]
    classes = hv.harvest_classes(hv.pair_changes([power(lv) for lv in levels]), np.array([[True]]),
                                 np.array([[False]]), -3.0)
    assert classes.tolist() == [[1]]
    back = hv.came_back(levels, classes, CODES, -3.0)
    assert (back["cells_evaluated"], back["cells_came_back"]) == (1, 1)
    levels[3] = np.array([[-8.0]])  # below -6 - 1.5: not back
    assert hv.came_back(levels, classes, CODES, -3.0)["cells_came_back"] == 0


# The whole analysis on cell arrays: HH and HV, and the marker ---------------------------------------------

def _settings(marker: str = "HH", **changes) -> Harvest:
    base = dict(cell_m=100.0, marker=marker, flood_dates=("2026-08-06", "2026-08-18"), peak_dates=("2026-08-30",),
                passes=("2026-08-30", "2026-09-11", "2026-09-23", "2026-10-05", "2026-10-17"), false_alarm=0.02,
                rice_rise_db=None, stable_boxes=((0.0, 0.0, 1.0, 1.0),), stable_boxes_from="stable_boxes")
    return Harvest(**{**base, **changes})


def _cell_scene(seed: int = 0) -> tuple[dict, np.ndarray]:
    """Cells in rows: 0-39 stable ground; 40-79 rice that HH sees harvested in pair 1 and HV in pair 2; 80-119
    rice harvested in pair 3 in both; 120-159 standing rice. 50 cells per row; speckle of about 0.2 dB."""
    rng = np.random.default_rng(seed)
    dates = ["2026-08-06", "2026-08-18", "2026-08-30", "2026-09-11", "2026-09-23", "2026-10-05", "2026-10-17"]
    shape = (160, 50)
    rows = np.arange(shape[0])[:, np.newaxis] * np.ones(shape)
    stable, early, late = rows < 40, (rows >= 40) & (rows < 80), (rows >= 80) & (rows < 120)
    rice = ~stable
    cell_powers: dict = {"HH": {}, "HV": {}}
    for j, date in enumerate(dates):
        for pol, (flood, canopy, cut, ground) in {"HH": (-22.0, -6.0, -13.0, -8.0),
                                                  "HV": (-25.0, -12.0, -19.0, -15.0)}.items():
            level = np.where(rice, flood if j < 2 else canopy, ground)
            harvest_pass = 4 if pol == "HH" else 5  # early rice: HH falls into pass 4, HV into pass 5
            level = np.where(early & (j >= harvest_pass), cut, level)
            level = np.where(late & (j >= 6), cut, level)
            cell_powers[pol][date] = power(level) * rng.gamma(400, 1 / 400, size=shape)
    return cell_powers, stable


ALL = np.ones((160, 50), dtype=bool)  # every cell of _cell_scene inside the site box


def test_marker_hv_gives_a_different_map_from_marker_hh():
    cell_powers, in_boxes = _cell_scene()
    doc_hh, classes_hh = hv.analyse_cells(cell_powers, _settings("HH"), ALL, in_boxes, 0.01)
    doc_hv, classes_hv = hv.analyse_cells(cell_powers, _settings("HV"), ALL, in_boxes, 0.01)
    # Both polarizations are always computed; the marker only picks the one that defines the map.
    assert np.array_equal(classes_hh["HH"], classes_hv["HH"]) and np.array_equal(classes_hh["HV"], classes_hv["HV"])
    hh_map, hv_map = classes_hh["HH"], classes_hh["HV"]
    assert not np.array_equal(hh_map, hv_map)
    # By design about 2 % of unchanged cells cross the threshold in a pair, so a few cells of each block land
    # elsewhere; the blocks themselves must be clear.
    early, late = hh_map[40:80], hh_map[80:120]
    assert (early == 1).mean() > 0.93 and (hv_map[40:80] == 2).mean() > 0.9
    assert (late == 3).mean() > 0.9 and (hv_map[80:120] == 3).mean() > 0.9
    assert (hh_map[:40] == 6).all()  # stable ground is not rice
    assert doc_hh["rice"]["threshold_source"] == "otsu" and 2.0 < doc_hh["rice"]["threshold_db"] < 14.0
    assert doc_hh["rice"]["cells"] == 120 * 50 and doc_hh["rice"]["area_km2"] == pytest.approx(60.0)
    assert doc_hh["stable"]["cells"] == 40 * 50
    cross = np.array(doc_hh["cross_table"]["counts"])
    assert cross[0, 1] > 0.85 * 40 * 50  # HH pair 1 against HV pair 2
    hh_cum = [p["share"] for p in doc_hh["polarizations"]["HH"]["cumulative"]["by_pass"]]
    hv_cum = [p["share"] for p in doc_hh["polarizations"]["HV"]["cumulative"]["by_pass"]]
    assert hh_cum == pytest.approx([1 / 3, 1 / 3, 2 / 3], abs=0.05)
    assert hv_cum == pytest.approx([0.0, 1 / 3, 2 / 3], abs=0.05)
    for entry in doc_hh["polarizations"].values():
        t = entry["threshold"]
        assert t["threshold_db"] < 0 and max(t["stable_share_below_by_pair"]) <= 0.02
        assert t["rice_share_below_by_pair"][0] <= 0.02
    assert [c["value"] for c in doc_hh["classes"]] == [1, 2, 3, 4, 5, 6, 0]


def test_a_fixed_rice_threshold_from_the_site_file_is_used_as_given():
    cell_powers, in_boxes = _cell_scene()
    doc, _ = hv.analyse_cells(cell_powers, _settings(rice_rise_db=5.0), ALL, in_boxes, 0.01)
    rice = doc["rice"]
    assert (rice["threshold_db"], rice["threshold_source"], rice["otsu"], rice["cells"]) == (5.0, "site file", None,
                                                                                             120 * 50)
    with pytest.raises(ValueError, match="only 0 rice cells"):  # no cell rises 30 dB
        hv.analyse_cells(cell_powers, _settings(rice_rise_db=30.0), ALL, in_boxes, 0.01)


def test_only_cells_inside_the_site_box_take_part():
    # The processed window is the UTM rectangle around the site box, so some of its cells lie outside the box.
    # Here the last 10 columns stand for them: rice, stable ground and standing rice alike are left out.
    cell_powers, in_boxes = _cell_scene()
    in_site = ALL.copy()
    in_site[:, 40:] = False
    doc, classes = hv.analyse_cells(cell_powers, _settings(rice_rise_db=5.0), in_site, in_boxes, 0.01)
    for found in classes.values():
        assert (found[:, 40:] == hv.NO_DATA).all() and (found[:, :40] != hv.NO_DATA).all()
    assert doc["cells"]["total"] == 160 * 50 and doc["cells"]["in_site_box"] == 160 * 40
    assert doc["cells"]["with_rise"] == 160 * 40
    assert doc["rice"]["cells"] == 120 * 40 and doc["rice"]["area_km2"] == pytest.approx(48.0)
    assert doc["rice"]["not_rice_cells"] == 40 * 40
    assert doc["stable"]["cells_in_boxes"] == 40 * 50 and doc["stable"]["cells"] == 40 * 40
    for entry in doc["polarizations"].values():
        assert entry["threshold"]["stable_cells"] == 40 * 40 and entry["threshold"]["rice_cells"] == 120 * 40
        assert entry["cumulative"]["counted_cells"] == 120 * 40


# Labels and colours ---------------------------------------------------------------------------------------

def test_labels_are_made_from_the_dates_with_english_month_names():
    assert hv.date_text("2026-11-04") == "4 November 2026"
    assert hv.harvest_label("2026-09-29", "2026-10-11") == "Harvested between 29 September and 11 October 2026"
    assert hv.harvest_label("2025-12-27", "2026-01-08") == "Harvested between 27 December 2025 and 8 January 2026"
    assert hv.no_harvest_label("2026-11-04") == "Rice, no harvest seen by 4 November 2026"
    assert hv.fell_before_label("2026-09-29") == "Fell before 29 September 2026"


def test_layer_classes_in_value_order_with_the_specified_colours():
    passes = ["2026-09-17", "2026-09-29", "2026-10-11", "2026-10-23", "2026-11-04"]
    classes = hv.layer_classes(passes, has_fell_before=True)
    assert [(c["value"], c["label"], c["color"]) for c in classes] == [
        (1, "Harvested between 29 September and 11 October 2026", "#440154"),
        (2, "Harvested between 11 October and 23 October 2026", "#3b528b"),
        (3, "Harvested between 23 October and 4 November 2026", "#21918c"),
        (4, "Rice, no harvest seen by 4 November 2026", "#fde725"),
        (5, "Fell before 29 September 2026", "#b8a3d8"),
        (6, "Not rice", "#d9d9d9"),
    ]
    without = hv.layer_classes(passes, has_fell_before=False)
    assert [c["value"] for c in without] == [1, 2, 3, 4, 6]  # the value of "fell before" stays reserved


def test_more_than_four_harvest_pairs_interpolate_along_the_colours():
    assert hv.harvest_colours(2) == ["#440154", "#3b528b"]
    assert hv.harvest_colours(4) == list(hv.HARVEST_COLOURS)
    seven = hv.harvest_colours(7)
    assert len(seven) == 7 == len(set(seven)) and seven[0] == "#440154" and seven[-1] == "#5ec962"
    assert seven[2] == "#3b528b" and seven[4] == "#21918c"  # stops 1 and 2 fall exactly on positions 2 and 4
    greens = [int(c[3:5], 16) for c in seven]
    assert greens == sorted(greens)  # the viridis stops brighten in green, so the order is kept


def test_codes_reserve_one_value_per_class():
    codes = hv.Codes.for_passes(3)
    assert (codes.harvest_pairs, codes.no_harvest, codes.fell_before, codes.not_rice) == (1, 2, 3, 4)
    with pytest.raises(ValueError):
        hv.Codes.for_passes(2)
    assert math.isclose(hv.Codes.for_passes(254).not_rice, 255)


# validate's check of categorical rasters, on its own -------------------------------------------------------

def test_categorical_check_finds_foreign_values_at_full_resolution_and_in_overviews(tmp_path):
    grid = web_grid((-118.05, 34.75, -117.95, 34.85), 14)
    codes = np.ones(grid.shape, dtype=np.uint8)
    codes[:, 1::2] = 9  # stripes of the classes 1 and 9
    encoding = {"type": "categorical-uint8", "nodata": 0, "classes": [
        {"value": 1, "label": "a", "color": "#000000"}, {"value": 9, "label": "b", "color": "#ffffff"}]}
    nearest, average = tmp_path / "nearest.tif", tmp_path / "average.tif"
    write_cog(nearest, codes, grid, 256, ["x"], {}, overview_resampling="nearest")
    write_cog(average, codes, grid, 256, ["x"], {}, overview_resampling="average")
    assert categorical_problem(nearest, encoding) is None
    problem = categorical_problem(average, encoding)  # averaging 1 and 9 gives 5: not a class
    assert problem is not None and "5 (first seen at overview 1)" in problem
    codes[0, 0] = 200
    write_cog(nearest, codes, grid, 256, ["x"], {}, overview_resampling="nearest")
    assert "200 (first seen at full resolution)" in categorical_problem(nearest, encoding)
    assert categorical_problem(nearest, {"type": "linear-uint8", "nodata": 0, "lo": 0, "hi": 1}) is None


@pytest.mark.parametrize("height, width", [(1001, 777), (640, 512)])
def test_categorical_check_finds_averaged_overviews_when_every_average_is_a_class(tmp_path, height, width):
    # Classes 1 to 6 with no gap: the average of any two is again a class, so only comparing each overview
    # pixel with the pixels under it can tell averaging from nearest neighbour. Odd sides make GDAL's
    # overview pixels cover a fraction of a pixel more or less than 2 x 2, which nearest overviews must pass.
    from pipeline.export import WebGrid

    rng = np.random.default_rng(7)
    blocks = rng.integers(1, 7, size=(height // 5 + 1, width // 5 + 1)).astype(np.uint8)
    codes = np.kron(blocks, np.ones((5, 5), dtype=np.uint8))[:height, :width]
    codes[:40, :60] = 0  # some nodata
    grid = WebGrid(zoom=14, transform=Affine(9.5546, 0.0, 0.0, 0.0, -9.5546, 0.0), width=width, height=height)
    encoding = {"type": "categorical-uint8", "nodata": 0,
                "classes": [{"value": v, "label": str(v), "color": "#000000"} for v in range(1, 7)]}
    nearest, average = tmp_path / "nearest.tif", tmp_path / "average.tif"
    write_cog(nearest, codes, grid, 256, ["x"], {}, overview_resampling="nearest")
    write_cog(average, codes, grid, 256, ["x"], {}, overview_resampling="average")
    with rasterio.open(average) as src:
        assert len(src.overviews(1)) >= 2
    with rasterio.open(average, overview_level=0) as src:
        assert set(np.unique(src.read()).tolist()) <= set(range(7))  # the averages are all classes or nodata
    assert categorical_problem(nearest, encoding) is None
    problem = categorical_problem(average, encoding)
    assert problem is not None and "not among its classes" not in problem  # every value is a class ...
    assert "of overview 1" in problem and "as when classes are averaged" in problem  # ... but not under it

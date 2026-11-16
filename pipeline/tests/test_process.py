"""Validity masks, multilooking, the grid check, dB and change. These run on linear power and go
wrong silently if done in the wrong order, so each rule has a test."""

from __future__ import annotations

import numpy as np
import pytest
from affine import Affine

from pipeline.access import open_granule
from pipeline.gcov import read_facts, read_window
from pipeline.process import (
    MASK_NONE,
    MASK_SUBSWATH,
    MASK_ZERO_VALID,
    GridMismatchError,
    MaskConventionError,
    assert_same_grid,
    boxcar_mean,
    log_ratio_db,
    mask_convention,
    multilook,
    multilook_factor,
    multilook_transform,
    to_db,
    valid_pixels,
)
from pipeline.tests.synth import SynthGrid, write_real_format_gcov


def test_sample_convention_zero_means_valid():
    assert mask_convention("1.2.1", [0, 255]) == MASK_ZERO_VALID
    power = np.array([0.1, 0.1, np.nan], dtype=np.float32)
    mask = np.array([0, 255, 0], dtype=np.uint8)
    assert valid_pixels(power, mask, MASK_ZERO_VALID, 1e-5).tolist() == [True, False, False]


def test_real_convention_one_to_five_valid():
    assert mask_convention("1.5.0", [0, 1, 2, 255]) == MASK_SUBSWATH
    assert mask_convention("1.6.0", [3, 255]) == MASK_SUBSWATH
    power = np.full(5, 0.1, dtype=np.float32)
    mask = np.array([0, 1, 5, 6, 255], dtype=np.uint8)
    assert valid_pixels(power, mask, MASK_SUBSWATH, 1e-5).tolist() == [False, True, True, False, False]


def test_values_that_contradict_the_version_stop_the_run():
    with pytest.raises(MaskConventionError):
        mask_convention("1.2.1", [0, 1, 255])  # old spec should only have 0 and 255
    with pytest.raises(MaskConventionError, match="old sample convention"):
        mask_convention("1.5.0", [0, 255])  # new spec, but nothing valid: looks like the old meaning
    with pytest.raises(MaskConventionError):
        mask_convention("1.5.0", [1, 7])
    with pytest.raises(MaskConventionError):
        mask_convention("", [0])


def test_real_window_with_mask_values_zero_and_one(tmp_path):
    """What was seen in the first real file (spec 1.6.0): inside a window the mask held only 1 (valid,
    sub-swath 1) and 0 (partially focused or invalid). The rule must take 1 to 5 as valid, and the mask alone
    must decide: the synthetic 0 pixels hold ordinary power values, so only the mask can remove them."""
    grid = SynthGrid()
    path = write_real_format_gcov(tmp_path / "synthetic_real.h5", "2026-06-07")
    # Rows 80-199 and columns 80-479: the invalid block (rows 100-101) and the near-zero row (110) are
    # inside, the outside-swath columns (500 and up) are not.
    with open_granule(path) as h5:
        facts = read_facts(h5)
        win = read_window(h5, facts, grid.lonlat_box(80, 200, 80, 480), "A", ["HHHH", "HVHV"])
    values = sorted(int(v) for v in np.unique(win.mask))
    assert values == [0, 1]
    convention = mask_convention(facts.spec_version, values)
    assert convention == MASK_SUBSWATH
    for name, power in win.terms.items():
        assert np.isfinite(power[win.mask == 0]).all() and (power[win.mask == 0] > 1e-5).all(), name
        assert np.array_equal(valid_pixels(power, win.mask, convention, 0.0), win.mask == 1), name
        # With the usual floor, the near-zero edge values go as well, and nothing else does.
        tiny = np.isfinite(power) & (power <= 1e-5)
        assert tiny.any()
        assert np.array_equal(valid_pixels(power, win.mask, convention, 1e-5), (win.mask == 1) & ~tiny), name


def test_window_entirely_outside_the_swath_is_simply_empty():
    assert mask_convention("1.5.0", [255]) == MASK_SUBSWATH


def test_no_mask_falls_back_to_values():
    assert mask_convention("1.5.0", None) == MASK_NONE
    power = np.array([0.1, np.inf, -1.0], dtype=np.float32)
    assert valid_pixels(power, None, MASK_NONE, 1e-5).tolist() == [True, False, False]


def test_power_floor_rejects_edge_values():
    power = np.array([1e-14, 1e-6, 1e-5, 2e-5, 0.2], dtype=np.float32)
    mask = np.ones(5, dtype=np.uint8)
    assert valid_pixels(power, mask, MASK_SUBSWATH, 1e-5).tolist() == [False, False, False, True, True]
    assert valid_pixels(power, mask, MASK_SUBSWATH, 0.0).tolist() == [True, True, True, True, True]


def test_multilook_averages_linear_power_not_db():
    power = np.array([[1.0, 100.0], [1.0, 100.0]], dtype=np.float32)
    assert multilook(power, 2)[0, 0] == pytest.approx(50.5)  # mean of dB would give 10 dB = 10.0


def test_multilook_ignores_nan_and_needs_enough_valid_pixels():
    power = np.array([[1.0, np.nan, 2.0, np.nan], [3.0, np.nan, np.nan, np.nan]], dtype=np.float32)
    out = multilook(power, 2, min_valid_fraction=0.5)
    assert out[0, 0] == pytest.approx(2.0)  # 2 of 4 valid: kept
    assert np.isnan(out[0, 1])  # 1 of 4 valid: below half, dropped


def test_multilook_drops_partial_blocks_and_keeps_origin():
    out = multilook(np.ones((5, 7), dtype=np.float32), 2)
    assert out.shape == (2, 3)
    t = multilook_transform(Affine(20, 0, 1000, 0, -20, 5000), 2)
    assert tuple(t)[:6] == (40, 0, 1000, 0, -40, 5000)


def test_multilook_factor_must_be_whole():
    assert multilook_factor(20, 40) == 2
    with pytest.raises(ValueError):
        multilook_factor(20, 50)


def test_grid_check_accepts_identical_grids():
    t = Affine(40, 0, 1000, 0, -40, 5000)
    assert_same_grid({"a": ("EPSG:32611", t, (10, 10)), "b": ("EPSG:32611", t, (10, 10))})


def test_grid_check_fires_on_a_shifted_grid():
    t = Affine(40, 0, 1000, 0, -40, 5000)
    shifted = Affine(40, 0, 1020, 0, -40, 5000)  # half a pixel east
    with pytest.raises(GridMismatchError, match="transform"):
        assert_same_grid({"a": ("EPSG:32611", t, (10, 10)), "b": ("EPSG:32611", shifted, (10, 10))})
    with pytest.raises(GridMismatchError, match="shape"):
        assert_same_grid({"a": ("EPSG:32611", t, (10, 10)), "b": ("EPSG:32611", t, (10, 11))})
    with pytest.raises(GridMismatchError, match="CRS"):
        assert_same_grid({"a": ("EPSG:32611", t, (10, 10)), "b": ("EPSG:32612", t, (10, 10))})


def test_db_conversion():
    out = to_db(np.array([1.0, 0.1, 0.0, -1.0, np.nan]))
    assert out[:2].tolist() == pytest.approx([0.0, -10.0])
    assert np.isnan(out[2:]).all()


def test_boxcar_ignores_nan_and_does_not_fill_gaps():
    power = np.full((5, 5), 2.0, dtype=np.float32)
    power[2, 2] = np.nan
    out = boxcar_mean(power, 3)
    assert np.isnan(out[2, 2])
    assert out[1, 1] == pytest.approx(2.0)


def test_log_ratio_sign_and_value():
    ref = np.full((5, 5), 0.01, dtype=np.float32)
    sec = np.full((5, 5), 0.1, dtype=np.float32)
    assert log_ratio_db(ref, sec, 3)[2, 2] == pytest.approx(10.0, abs=1e-4)  # later brighter: positive
    assert log_ratio_db(sec, ref, 3)[2, 2] == pytest.approx(-10.0, abs=1e-4)

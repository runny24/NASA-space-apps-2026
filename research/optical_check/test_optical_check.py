"""Tests of the pure functions of optical_check.py. Every array here is SYNTHETIC: small made-up numbers, no
Sentinel-2 or NISAR value. Run from the repository root: python -m pytest research/optical_check
"""

from __future__ import annotations

import json

import numpy as np
import optical_check as oc
import pytest
from affine import Affine

from pipeline.harvest import otsu_threshold

# The product grid's corner and Sentinel-2 tile 43RDQ's corner (both metadata, not measurements).
CELL_T = Affine(100.0, 0.0, 479010.0, 0.0, -100.0, 3467310.0)
TILE_T = Affine(10.0, 0.0, 399960.0, 0.0, -10.0, 3500040.0)


# Step 3: valid pixels and the 20 m SCL -------------------------------------------------------------------------

def test_masked_classes_are_left_out_and_dark_area_stays_in():
    """SYNTHETIC: every dropped SCL class is invalid, every kept one valid, and nodata in either band too."""
    scl = np.array([list(range(12))], dtype=np.uint8)
    red = np.full(scl.shape, 500, dtype=np.uint16)
    nir = np.full(scl.shape, 3000, dtype=np.uint16)
    valid = oc.valid_pixels(red, nir, scl)
    assert [int(c) for c in scl[0][valid[0]]] == [2, 4, 5, 6, 7]
    red[0, 4] = 0  # vegetation pixel with no red value
    nir[0, 5] = 0
    assert not oc.valid_pixels(red, nir, scl)[0, 4]
    assert not oc.valid_pixels(red, nir, scl)[0, 5]


def test_masked_pixels_do_not_enter_the_cell_mean():
    """SYNTHETIC: a cell whose cloud pixels are very bright: its mean comes from the clear pixels only."""
    red = np.full((10, 10), 400, dtype=np.uint16)
    nir = np.full((10, 10), 4000, dtype=np.uint16)
    scl = np.full((10, 10), 4, dtype=np.uint8)
    red[:3], nir[:3], scl[:3] = 9000, 9000, 9  # 30 cloud pixels
    red[3, :2], scl[3, :2] = 100, 2  # 2 dark-area pixels: kept
    count, sr, sn = oc.cell_sums(red, nir, oc.valid_pixels(red, nir, scl))
    assert count[0, 0] == 70
    mean_red = oc.cell_means(count, sr, 1e-4, 0.0)[0, 0]
    assert mean_red == pytest.approx((68 * 0.04 + 2 * 0.01) / 70)
    mean_nir = oc.cell_means(count, sn, 1e-4, 0.0)[0, 0]  # the dark-area pixels keep NIR 4000; cloud NIR 9000 is out
    assert mean_nir == pytest.approx((68 * 0.4 + 2 * 0.4) / 70)


def test_scl_20m_pixel_covers_the_2x2_pixels_under_it_with_a_half_pixel_start():
    """SYNTHETIC: the 10 m window starts in the middle of a 20 m pixel (as the product grid does on tile 43RDQ), and
    once on an odd row and an even column, so that rows and columns cannot be swapped."""
    coarse_full = np.arange(36, dtype=np.uint8).reshape(6, 6)
    repeated = np.repeat(np.repeat(coarse_full, 2, axis=0), 2, axis=1)
    r0, c0, nr, nc, sr, sc = oc.coarse_window(3, 5, 4, 6)
    assert (r0, c0, sr, sc) == (1, 2, 1, 1)
    fine = oc.to_fine(coarse_full[r0:r0 + nr, c0:c0 + nc], sr, sc, 4, 6)
    np.testing.assert_array_equal(fine, repeated[3:7, 5:11])
    assert fine[0, 0] == coarse_full[1, 2] and fine[0, 1] == coarse_full[1, 3]
    r0, c0, nr, nc, sr, sc = oc.coarse_window(3, 4, 5, 6)
    assert (r0, c0, nr, nc, sr, sc) == (1, 2, 3, 3, 1, 0)
    fine = oc.to_fine(coarse_full[r0:r0 + nr, c0:c0 + nc], sr, sc, 5, 6)
    np.testing.assert_array_equal(fine, repeated[3:8, 4:10])


def test_mosaic_takes_each_pixel_from_the_first_granule_with_data():
    """SYNTHETIC: two granules of one tile and date, overlapping in the middle columns; in the last column granule
    a has red but no NIR, so the pixel comes from granule b."""
    a = (np.array([[10, 11, 0, 13]], np.uint16), np.array([[20, 21, 0, 0]], np.uint16),
         np.array([[4, 8, 0, 4]], np.uint8))
    b = (np.array([[0, 31, 32, 33]], np.uint16), np.array([[0, 41, 42, 43]], np.uint16),
         np.array([[0, 4, 5, 5]], np.uint8))
    red, nir, scl, source = oc.mosaic([a, b])
    assert red.tolist() == [[10, 11, 32, 33]] and nir.tolist() == [[20, 21, 42, 43]]
    assert scl.tolist() == [[4, 8, 5, 5]]  # the SCL comes with the pixel: the cloud of granule a is not replaced
    assert source.tolist() == [[0, 0, 1, 1]]


# Step 4: cells -------------------------------------------------------------------------------------------------

def test_a_10x10_block_maps_to_its_cell_and_to_no_other():
    """SYNTHETIC: one block of valid pixels, and the pixels on either side of a cell edge."""
    valid = np.zeros((30, 20), dtype=bool)
    valid[10:20, 10:20] = True
    red = np.arange(600, dtype=np.uint16).reshape(30, 20)
    nir = np.ones((30, 20), dtype=np.uint16)
    count, sr, sn = oc.cell_sums(red, nir, valid)
    assert count.shape == (3, 2)
    assert count.tolist() == [[0, 0], [0, 100], [0, 0]]
    assert sr[1, 1] == red[10:20, 10:20].sum() and sr.sum() == sr[1, 1]
    valid[:] = False
    valid[9, 9] = valid[10, 10] = True  # either side of the corner of cells (0, 0) and (1, 1)
    count, _, _ = oc.cell_sums(red, nir, valid)
    assert count.tolist() == [[1, 0], [0, 1], [0, 0]]
    with pytest.raises(ValueError):
        oc.cell_sums(red[:25], nir[:25], valid[:25])


def test_grid_window_puts_each_cell_on_whole_pixels_and_checks_alignment():
    """SYNTHETIC shapes on the real corners: the product grid lies 7905 columns and 3273 rows into tile 43RDQ."""
    assert oc.grid_window(CELL_T, (288, 286), TILE_T, (10980, 10980)) == (3273, 7905, 2880, 2860)
    with pytest.raises(ValueError, match="multiple"):
        oc.grid_window(Affine(100.0, 0.0, 479015.0, 0.0, -100.0, 3467310.0), (288, 286), TILE_T, (10980, 10980))
    with pytest.raises(ValueError, match="wholly inside"):
        oc.grid_window(CELL_T, (288, 400), TILE_T, (10980, 10980))
    with pytest.raises(ValueError, match="pixels"):
        oc.grid_window(CELL_T, (288, 286), Affine(20.0, 0.0, 399960.0, 0.0, -20.0, 3500040.0), (5490, 5490))


def test_a_cell_needs_50_valid_pixels():
    """SYNTHETIC: 49 valid pixels give no value, 50 give one."""
    count = np.array([[49, 50]])
    total = np.array([[49 * 400, 50 * 400]])
    means = oc.cell_means(count, total, 1e-4, 0.0)
    assert np.isnan(means[0, 0]) and means[0, 1] == pytest.approx(0.04)
    assert oc.has_value(count).tolist() == [[False, True]]


def test_ndvi_is_the_ratio_of_the_means_not_the_mean_of_the_ratios():
    """SYNTHETIC: half the valid pixels green (NDVI 0.8), half bare (NDVI 0): the ratio of the means is 4/7."""
    red = np.where(np.arange(100).reshape(10, 10) % 2 == 0, 500, 1000).astype(np.uint16)
    nir = np.where(np.arange(100).reshape(10, 10) % 2 == 0, 4500, 1000).astype(np.uint16)
    scl = np.full((10, 10), 4, dtype=np.uint8)
    count, sr, sn = oc.cell_sums(red, nir, oc.valid_pixels(red, nir, scl))
    value = oc.ndvi(oc.cell_means(count, sn, 1e-4, 0.0), oc.cell_means(count, sr, 1e-4, 0.0))[0, 0]
    assert value == pytest.approx((0.275 - 0.075) / (0.275 + 0.075))
    assert value != pytest.approx(0.4)  # the mean of the pixel ratios
    # The same reflectances stored with the +1000 offset still in the values give the same index.
    shifted = {k: s + 1000 * count for k, s in (("nir", sn), ("red", sr))}
    v2 = oc.ndvi(oc.cell_means(count, shifted["nir"], 1e-4, -0.1), oc.cell_means(count, shifted["red"], 1e-4, -0.1))
    assert v2[0, 0] == pytest.approx(value)


def test_ndvi_is_undefined_without_a_positive_sum():
    """SYNTHETIC: NaN in, or N + R not positive: no index."""
    out = oc.ndvi(np.array([np.nan, 0.0, 0.3]), np.array([0.1, 0.0, 0.1]))
    assert np.isnan(out[0]) and np.isnan(out[1]) and out[2] == pytest.approx(0.5)


# Step 2: the reflectance conversion ----------------------------------------------------------------------------

def _item(flag, baseline="05.13", offset=-0.1):
    band = {"nodata": 0, "scale": 0.0001, "offset": offset}
    props = {"s2:processing_baseline": baseline}
    if flag is not None:
        props["earthsearch:boa_offset_applied"] = flag
    return {"id": "SYNTHETIC", "properties": props, "assets": {"red": {"raster:bands": [band]}}}


def test_reflectance_offset_follows_boa_offset_applied():
    """SYNTHETIC items: offset already removed -> none applied; still in the values -> -0.1; old baseline -> none;
    a newer baseline without the property stops."""
    assert oc.reflectance_params(_item(True), "red") == (1e-4, 0.0)
    assert oc.reflectance_params(_item(False), "red") == (1e-4, -0.1)
    assert oc.reflectance_params(_item(False, "03.00", 0.0), "red") == (1e-4, 0.0)
    with pytest.raises(ValueError):
        oc.reflectance_params(_item(None), "red")


def test_settings_describe_the_conversion_the_code_applies():
    """SYNTHETIC items: results.json's settings state the rule reflectance_params follows, not raster:bands'."""
    r = oc.settings()["reflectance"]
    assert oc.reflectance_params(_item(True), "red") == (r["scale"], r["offset_where_boa_offset_applied_true"])
    assert oc.reflectance_params(_item(False), "red") == (
        r["scale"], r["offset_where_boa_offset_applied_false_from_baseline_04_00"])
    assert oc.reflectance_params(_item(False, "03.00", 0.0), "red") == (r["scale"], r["offset_before_baseline_04_00"])
    assert r["raster_bands_offset_used"] is False and "earthsearch:boa_offset_applied" in r["rule"]


def test_offset_check_counts_vegetation_pixels_and_stops_a_scene_that_still_holds_the_offset():
    """SYNTHETIC pixels: only vegetation (SCL 4) with data in both bands counts; clouds and bare ground do not."""
    red = np.array([[500, 900, 1500, 0, 400, 3000]], np.uint16)
    nir = np.array([[4000, 4000, 4000, 4000, 900, 3200]], np.uint16)
    scl = np.array([[4, 4, 4, 4, 8, 5]], np.uint8)  # the fourth pixel has no red, the fifth is cloud, the sixth bare
    assert oc.vegetation_below_offset(red, nir, scl) == (pytest.approx(2 / 3), 3)
    assert oc.offset_check(0.0, 0.5, 5000).startswith("passed")
    with pytest.raises(ValueError, match="still hold"):
        oc.offset_check(0.0, 0.005, 5000)  # under 1 % below 1000 on a scene taken as offset-free: stop
    assert oc.offset_check(0.0, 0.0, 999).startswith("not checked")  # too few vegetation pixels (a cloudy date)
    assert oc.offset_check(0.0, None, 0).startswith("not checked")
    assert oc.offset_check(-0.1, 0.0, 5000).startswith("not checked")  # the conversion removes the offset itself


# The catalog: tile, dates, order of the granules, and what a split granule is ---------------------------------

def _cat_item(item_id, nodata=0.0, take="GS2A_20260925T054251_058804_N05.13",
              strip="S2A_OPER_MSI_L2A_DS_2APS_20260925T090015_S20260925T054245_N05.13"):
    """A SYNTHETIC catalog item modelled on the ids of Earth Search: S2A_43RDQ_20260925_0_L2A."""
    sat, tile, day = item_id.split("_")[:3]
    props = {"datetime": f"{day[:4]}-{day[4:6]}-{day[6:]}T05:50:34.283000Z", "mgrs:utm_zone": int(tile[:2]),
             "mgrs:latitude_band": tile[2], "mgrs:grid_square": tile[3:], "s2:nodata_pixel_percentage": nodata,
             "s2:datatake_id": take, "s2:datastrip_id": strip}
    return {"id": item_id, "properties": props}


def test_granules_by_day_keeps_one_tile_and_the_dates_and_orders_by_nodata_then_id():
    """SYNTHETIC items: the other tile and dates outside 10 September to 14 November are left out; a date's granules
    come fewest nodata pixels first, then by id."""
    items = [_cat_item("S2A_43RDQ_20260925_0_L2A", 59.4), _cat_item("S2A_43RDQ_20260925_1_L2A", 22.6),
             _cat_item("S2B_43RDQ_20261018_1_L2A", 5.0), _cat_item("S2B_43RDQ_20261018_0_L2A", 5.0),
             _cat_item("S2B_43REQ_20260918_0_L2A"), _cat_item("S2C_43RDQ_20260909_0_L2A"),
             _cat_item("S2C_43RDQ_20261115_0_L2A"), _cat_item("S2C_43RDQ_20260910_0_L2A"),
             _cat_item("S2C_43RDQ_20261114_0_L2A")]
    days, left_out = oc.granules_by_day(items)
    assert {d: [it["id"] for it in v] for d, v in days.items()} == {
        "2026-09-10": ["S2C_43RDQ_20260910_0_L2A"],
        "2026-09-25": ["S2A_43RDQ_20260925_1_L2A", "S2A_43RDQ_20260925_0_L2A"],
        "2026-10-18": ["S2B_43RDQ_20261018_0_L2A", "S2B_43RDQ_20261018_1_L2A"],
        "2026-11-14": ["S2C_43RDQ_20261114_0_L2A"]}
    assert list(days) == sorted(days)
    assert left_out == ["S2B_43REQ_20260918_0_L2A", "S2C_43RDQ_20260909_0_L2A", "S2C_43RDQ_20261115_0_L2A"]
    assert oc.item_day(_cat_item("S2C_43RDQ_20261003_0_L2A")) == "2026-10-03"


def test_split_granules_must_be_datastrips_of_one_datatake():
    """SYNTHETIC ids modelled on 2026-09-25: two datastrips of one datatake pass; another datatake, a shared
    datastrip, or a reprocessed copy (new datastrip id, same sensing start) stop; so does a missing id."""
    a = _cat_item("S2A_43RDQ_20260925_0_L2A")
    b = _cat_item("S2A_43RDQ_20260925_1_L2A",
                  strip="S2A_OPER_MSI_L2A_DS_2APS_20260925T103013_S20260925T055030_N05.13")
    assert oc.split_granules([b, a]) == {"datatake_id": "GS2A_20260925T054251_058804_N05.13",
                                         "datastrip_ids": [b["properties"]["s2:datastrip_id"],
                                                           a["properties"]["s2:datastrip_id"]]}
    assert oc.split_granules([a])["datastrip_ids"] == [a["properties"]["s2:datastrip_id"]]
    other_take = _cat_item("S2A_43RDQ_20260925_1_L2A", take="GS2A_20260925T054251_058804_N05.14",
                           strip=b["properties"]["s2:datastrip_id"])
    with pytest.raises(ValueError, match="different datatakes"):
        oc.split_granules([a, other_take])
    with pytest.raises(ValueError, match="reprocessed"):
        oc.split_granules([a, _cat_item("S2A_43RDQ_20260925_1_L2A")])
    copy = _cat_item("S2A_43RDQ_20260925_1_L2A",
                     strip="S2A_OPER_MSI_L2A_DS_2APS_20261201T120000_S20260925T054245_N05.13")
    with pytest.raises(ValueError, match="reprocessed"):
        oc.split_granules([a, copy])
    missing = _cat_item("S2A_43RDQ_20260925_1_L2A")
    del missing["properties"]["s2:datatake_id"]
    with pytest.raises(ValueError, match="lack"):
        oc.split_granules([a, missing])


def test_scene_record_keeps_the_conversion_evidence_and_runs_both_guards():
    """SYNTHETIC scene and meta: results.json gets the flag, the raster:bands offset and the offset checks, the
    datatake and datastrips; a scene that fails the offset check stops."""
    items = [_cat_item("S2A_43RDQ_20260925_1_L2A",
                       strip="S2A_OPER_MSI_L2A_DS_2APS_20260925T103013_S20260925T055030_N05.13"),
             _cat_item("S2A_43RDQ_20260925_0_L2A")]
    meta = {"items": [it["id"] for it in items], "processing_baseline": ["05.13"], "boa_offset_applied": ["True"],
            "raster_bands_offset": [-0.1], "red_below_offset_share": 0.8, "vegetation_red_below_offset_share": 0.9,
            "vegetation_pixels": 50_000, "pixels_from_each": [70, 30], "pixels_without_data": 0, "valid_pixels": 90,
            "scl_codes": {4: 100}, "seconds": 1.0, "bytes": 10, "read_at": "SYNTHETIC"}
    scene = {"day": "2026-09-25", "items": meta["items"], "scale": 1e-4, "offset": 0.0, "meta": meta}
    rec = oc.scene_record(scene, items)
    assert rec["boa_offset_applied"] == ["True"] and rec["raster_bands_offset"] == [-0.1]
    assert rec["red_below_offset_share"] == 0.8 and rec["vegetation_red_below_offset_share"] == 0.9
    assert rec["offset_check"].startswith("passed") and rec["offset"] == 0.0
    assert rec["datatake_id"] == "GS2A_20260925T054251_058804_N05.13" and len(rec["datastrip_ids"]) == 2
    with pytest.raises(ValueError, match="still hold"):
        oc.scene_record({**scene, "meta": {**meta, "vegetation_red_below_offset_share": 0.0}}, items)
    with pytest.raises(ValueError, match="reprocessed"):  # the same ids, but both granules on one datastrip
        oc.scene_record(scene, [_cat_item("S2A_43RDQ_20260925_1_L2A"), items[1]])


# Steps 5 and 6 -------------------------------------------------------------------------------------------------

def test_rice_cells_need_a_rice_class_in_both_bands_and_usable_needs_80_percent():
    """SYNTHETIC classes: 6 (not rice) or 0 (no data) in either band leaves the cell out."""
    hh = np.array([1, 4, 5, 6, 3, 0])
    hv = np.array([3, 4, 6, 2, 5, 1])
    assert oc.rice_cells(hh, hv).tolist() == [True, True, False, False, True, False]
    rice = np.ones(10, dtype=bool)
    count = np.array([100] * 8 + [10] * 2)
    assert oc.value_share(count, rice) == pytest.approx(0.8) and oc.usable(oc.value_share(count, rice))
    assert not oc.usable(oc.value_share(np.array([100] * 7 + [10] * 3), rice))


def test_the_usable_share_is_taken_over_the_tests_rice_cells_only():
    """SYNTHETIC: five rice cells and five others; the share over rice cells and over all cells fall on opposite
    sides of 80 %, both ways."""
    rice = np.array([True] * 5 + [False] * 5)
    count = np.array([100, 100, 100, 100, 10] + [10] * 5)  # rice 4/5 = 80 %, all cells 4/10
    assert oc.value_share(count, rice) == pytest.approx(0.8) and oc.usable(oc.value_share(count, rice))
    count = np.array([100, 100, 100, 10, 10] + [100] * 5)  # rice 3/5 = 60 %, all cells 8/10
    assert oc.value_share(count, rice) == pytest.approx(0.6) and not oc.usable(oc.value_share(count, rice))


def test_summary_gives_median_quartiles_and_n_of_finite_values():
    """SYNTHETIC values with NaN."""
    s = oc.summary(np.array([0.1, 0.2, 0.3, 0.4, 0.5, np.nan]))
    assert s == {"n": 5, "median": pytest.approx(0.3), "q1": pytest.approx(0.2), "q3": pytest.approx(0.4)}
    assert oc.summary(np.array([np.nan]))["median"] is None


# Step 8 --------------------------------------------------------------------------------------------------------

DAYS = ["2026-09-13", "2026-09-23", "2026-10-03", "2026-10-08", "2026-10-13", "2026-10-18", "2026-11-07"]


def _stack(rows):
    """rows: one list of NDVI per cell, over DAYS. Returns the (days, 1, cells) stack."""
    return np.array(rows, dtype=np.float64).T[:, None, :]


def test_cut_by_day_needs_an_earlier_green_date():
    """SYNTHETIC: threshold 0.5, five cells over seven usable days."""
    n = np.nan
    stack = _stack([
        [0.3, 0.3, 0.2, 0.2, 0.2, 0.2, 0.2],  # A: never green -> never cut
        [0.8, 0.8, 0.3, 0.2, 0.2, 0.2, 0.7],  # B: green, then below on 10-03 -> cut on 10-03
        [0.8, 0.3, 0.8, 0.8, 0.8, 0.8, 0.8],  # C: below only on 09-23, before 09-29 -> not cut
        [0.3, 0.3, 0.3, 0.8, 0.2, 0.2, 0.2],  # D: below first, green on 10-08, below on 10-13 -> cut on 10-13
        [0.8, n, n, n, n, 0.2, 0.2],          # E: green on 09-13, no value until 10-18 -> cut on 10-18
    ])
    first = oc.first_cut(stack, DAYS, 0.5)
    assert [DAYS[i] if i >= 0 else None for i in first[0]] == [None, "2026-10-03", None, "2026-10-13", "2026-10-18"]
    assert oc.cut_by(first, DAYS, "2026-10-12")[0].tolist() == [False, True, False, False, False]
    assert oc.cut_by(first, DAYS, "2026-10-18")[0].tolist() == [False, True, False, True, True]
    assert oc.never_green_by(stack, DAYS, 0.5, "2026-11-07")[0].tolist() == [True, False, False, False, False]


def test_cut_and_never_green_look_at_no_later_date():
    """SYNTHETIC: a cell first green on 10-13 is never green by 10-08, and its later fall does not count before."""
    stack = _stack([[0.2, 0.2, 0.2, 0.2, 0.8, 0.2, 0.2]])
    first = oc.first_cut(stack, DAYS, 0.5)
    assert oc.never_green_by(stack, DAYS, 0.5, "2026-10-08")[0, 0]
    assert not oc.never_green_by(stack, DAYS, 0.5, "2026-10-13")[0, 0]
    assert not oc.cut_by(first, DAYS, "2026-10-13")[0, 0] and oc.cut_by(first, DAYS, "2026-10-18")[0, 0]
    assert oc.no_value_by(_stack([[np.nan] * 6 + [0.3]]), DAYS, "2026-10-18")[0, 0]


def test_a_value_equal_to_the_threshold_is_green_and_never_cut():
    """SYNTHETIC: threshold 0.5 and values of exactly 0.5 ("at or above" is green, "below" is cut). Under T_strict
    such a tie is certain: the inverted_cdf quantile is one of the pooled values."""
    stack = _stack([
        [0.5, 0.5, 0.2, 0.2, 0.2, 0.2, 0.2],  # A: green only by the tie on 09-13 -> cut on 10-03
        [0.8, 0.8, 0.5, 0.5, 0.5, 0.5, 0.5],  # B: falls to the threshold exactly -> never cut
        [0.2, 0.5, 0.2, 0.2, 0.2, 0.2, 0.2],  # C: at the threshold once -> not never green; cut on 10-03
        [0.8, 0.8, 0.2, 0.5, 0.2, 0.2, 0.2],  # D: cut on 10-03, at the threshold on 10-08 -> back to green
    ])
    first = oc.first_cut(stack, DAYS, 0.5)
    assert [DAYS[i] if i >= 0 else None for i in first[0]] == ["2026-10-03", None, "2026-10-03", "2026-10-03"]
    assert oc.never_green_by(stack, DAYS, 0.5, "2026-11-07")[0].tolist() == [False, False, False, False]
    assert oc.never_green_by(stack, DAYS, 0.5, "2026-09-13")[0].tolist() == [False, False, True, False]
    assert oc.back_to_green(stack, first, 0.5, first >= 0) == {
        "cut_cells": 3, "measured": 3, "back_to_green": 1, "share": pytest.approx(1 / 3), "no_value_next_day": 0,
        "cut_on_last_usable_day": 0}


def test_days_on_or_before_and_on_or_after_a_pass():
    """SYNTHETIC usable days around the three harvest passes."""
    usable = ["2026-10-08", "2026-10-13", "2026-10-23", "2026-11-02"]
    assert oc.days_around("2026-10-11", usable) == ("2026-10-08", "2026-10-13")
    assert oc.days_around("2026-10-23", usable) == ("2026-10-23", "2026-10-23")
    assert oc.days_around("2026-11-04", usable) == ("2026-11-02", None)
    assert oc.days_around("2026-10-01", usable) == (None, "2026-10-08")


def test_pooled_threshold_uses_rice_cells_from_15_september_on():
    """SYNTHETIC: two clear groups after 15 September; a day before it with other values must not count. The values
    sit inside bins, so the 240 bins from -0.2 to 1.0 give their own threshold: the middle of the gap from the top
    of 0.123's bin (0.125) to the foot of 0.791's (0.790), 0.4575; 100 bins from -1 to 1 would give 0.46."""
    days = ["2026-09-13", "2026-09-18", "2026-10-18"]
    stack = np.array([[[0.0, 0.0, 0.5]], [[0.791, 0.791, 0.5]], [[0.123, 0.123, 0.5]]])
    rice = np.array([[True, True, False]])
    t, n = oc.pooled_threshold(stack, days, rice)
    assert n == 4
    values = np.array([0.791, 0.791, 0.123, 0.123])
    assert t == otsu_threshold(values, (-0.2, 1.0), 240) and t == pytest.approx(0.4575, abs=1e-9)
    assert t != otsu_threshold(values, (-1.0, 1.0), 100) and t != otsu_threshold(values, (-0.2, 1.0), 256)
    assert (oc.OTSU_RANGE, oc.OTSU_BINS) == ((-0.2, 1.0), 240)
    t2, n2 = oc.pooled_threshold(stack, ["2026-09-16", "2026-09-18", "2026-10-18"], rice)
    assert n2 == 6


def test_strict_threshold_is_the_inverted_cdf_quantile_or_nothing():
    """SYNTHETIC: four strict-cell values in the span give the third smallest (one of the values itself); the third
    cell is not strict, and its values would make it 0.7; no day in the span gives none."""
    days = ["2026-10-23", "2026-10-28", "2026-11-02", "2026-11-07"]
    stack = np.array([[[0.9, 0.9, 0.9]], [[0.1, 0.4, 0.7]], [[0.2, 0.3, 0.8]], [[0.95, 0.95, 0.95]]])
    cells = np.array([[True, True, False]])
    res = oc.strict_threshold(stack, days, cells)
    assert res["threshold"] == 0.3 and res["values"] == 4
    assert res["days"] == ["2026-10-28", "2026-11-02"]
    none = oc.strict_threshold(stack[[0, 3]], ["2026-10-23", "2026-11-07"], cells)
    assert none["threshold"] is None and "no usable date" in none["reason"]
    hh, hv = np.array([1, 2, 1, 3, 5]), np.array([2, 1, 3, 1, 1])
    assert oc.strict_cells(hh, hv).tolist() == [True, True, False, False, False]


# Step 9 --------------------------------------------------------------------------------------------------------

def test_radar_states_by_pass_leave_fell_before_out():
    """SYNTHETIC classes 1 to 6 at the second harvest pass (2026-10-23)."""
    band = np.array([1, 2, 3, 4, 5, 6])
    harvested, not_harvested = oc.radar_states(band, 2, oc.rice_cells(band, band))
    assert harvested.tolist() == [True, True, False, False, False, False]
    assert not_harvested.tolist() == [False, False, True, True, False, False]


def test_agreement_counts_both_harvested_and_both_not():
    """SYNTHETIC: four used cells, two agree; a cell without an optical call is not used."""
    rh = np.array([True, True, False, False, True])
    rn = ~rh
    oc_cut = np.array([True, False, True, False, False])
    oc_not = np.array([False, True, False, True, False])
    agree, used = oc.agreement(rh, rn, oc_cut, oc_not)
    assert used.tolist() == [True, True, True, True, False]
    assert agree.tolist() == [True, False, False, True, False]


def test_blocks_are_10x10_cells():
    """SYNTHETIC grid of 25 x 12 cells."""
    ids = oc.block_ids((25, 12))
    assert ids[0, 0] == ids[9, 9] and ids[9, 9] != ids[10, 9] and ids[9, 9] != ids[9, 10]
    assert len(np.unique(ids)) == 3 * 2


def test_bootstrap_repeats_with_its_seed_and_draws_blocks():
    """SYNTHETIC: the same seed gives the same replicates, another seed others; replicate 0 is the documented
    draw of blocks."""
    rng = np.random.default_rng(1)
    used = rng.random((30, 30)) < 0.8
    agree = used & (rng.random((30, 30)) < 0.6)
    a = oc.block_bootstrap(agree, used, replicates=50)
    b = oc.block_bootstrap(agree, used, replicates=50)
    c = oc.block_bootstrap(agree, used, replicates=50, seed=oc.SEED + 1)
    np.testing.assert_array_equal(a, b)
    assert not np.array_equal(a, c)
    ids = oc.block_ids(used.shape).ravel()
    per_a = np.bincount(ids, weights=agree.ravel().astype(float))
    per_u = np.bincount(ids, weights=used.ravel().astype(float))
    draw = np.bincount(np.random.default_rng(20261115).integers(0, 9, size=9), minlength=9)
    assert a[0] == pytest.approx(draw @ per_a / (draw @ per_u))
    lo, hi = oc.interval(a)
    assert lo <= agree.sum() / used.sum() <= hi


def test_bootstrap_units_are_the_blocks_with_a_used_cell_and_one_generator_serves_every_replicate():
    """SYNTHETIC: 30 x 30 cells, nine blocks, only three of them with used cells (12, 1 and 9 used; 10, 1 and 6
    agree). The units are those three; every replicate is a further draw of the one default_rng(20261115)."""
    used = np.zeros((30, 30), dtype=bool)
    used[0:3, 0:4] = True     # block 0
    used[12, 25] = True       # block 5
    used[25:28, 15:18] = True  # block 7
    agree = used.copy()
    agree[0, 0:2] = False
    agree[25, 15:18] = False
    reps = oc.block_bootstrap(agree, used, replicates=8)
    a, u = np.array([10.0, 1.0, 6.0]), np.array([12.0, 1.0, 9.0])
    rng = np.random.default_rng(20261115)
    expected = []
    for _ in range(8):
        draw = np.bincount(rng.integers(0, 3, size=3), minlength=3)
        expected.append(draw @ a / (draw @ u))
    np.testing.assert_allclose(reps, expected, rtol=0, atol=1e-12)


def test_bootstrap_settings_and_interval_are_the_briefs():
    """SYNTHETIC replicates: the interval is numpy's 2.5th and 97.5th percentiles; 2000 replicates by default."""
    r = np.linspace(0.0, 1.0, 101)
    assert oc.interval(r) == pytest.approx([0.025, 0.975])
    assert oc.interval(r) == pytest.approx(list(np.percentile(r, [2.5, 97.5])))
    assert (oc.REPLICATES, oc.SEED, oc.BLOCK_CELLS, oc.PERCENTILES) == (2000, 20261115, 10, (2.5, 97.5))
    used = np.ones((3, 3), dtype=bool)
    assert len(oc.block_bootstrap(used, used)) == 2000


def test_back_to_green_on_the_next_usable_day():
    """SYNTHETIC: cut cells green again, not green, without a value next, and cut on the last day."""
    n = np.nan
    stack = _stack([
        [0.8, 0.8, 0.2, 0.7, 0.7, 0.7, 0.7],  # cut 10-03, green again on 10-08
        [0.8, 0.8, 0.2, 0.2, 0.2, 0.2, 0.2],  # cut 10-03, stays below
        [0.8, 0.8, 0.2, n, 0.2, 0.2, 0.2],    # cut 10-03, no value on 10-08
        [0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.2],  # cut on the last usable day
    ])
    first = oc.first_cut(stack, DAYS, 0.5)
    res = oc.back_to_green(stack, first, 0.5, first >= 0)
    assert res == {"cut_cells": 4, "measured": 2, "back_to_green": 1, "share": 0.5, "no_value_next_day": 1,
                   "cut_on_last_usable_day": 1}


# The whole analysis and the report, on a SYNTHETIC site -------------------------------------------------------

SYN_DAYS = ["2026-09-13", "2026-09-18", "2026-09-25", "2026-10-03", "2026-10-13", "2026-10-18", "2026-10-28",
            "2026-11-02", "2026-11-04", "2026-11-07"]


def _synthetic_site():
    rng = np.random.default_rng(7)
    shape = (20, 20)
    hh = rng.integers(1, 7, size=shape)
    hv = rng.integers(1, 7, size=shape)
    stable = np.zeros(shape, dtype=bool)
    stable[:2, :2] = True
    scenes = []
    for i, day in enumerate(SYN_DAYS):
        green = np.clip(0.85 - 0.1 * i + rng.normal(0, 0.05, shape), 0.0, 0.9)  # a made-up fall of green
        red_mean, nir_mean = 0.05, 0.05 * (1 + green) / (1 - green)
        count = np.full(shape, 100)
        if day == "2026-09-25":
            count[:] = 10  # a cloudy day: not usable
        scenes.append({"day": day, "items": [f"SYNTHETIC_{day}"], "count": count,
                       "sum_red": np.rint(np.full(shape, red_mean * 1e4) * count).astype(np.int64),
                       "sum_nir": np.rint(nir_mean * 1e4 * count).astype(np.int64), "scale": 1e-4, "offset": 0.0})
    radar = {p: {d: 0.5 for d in oc.HARVEST_PASSES} for p in oc.POLARIZATIONS}
    return scenes, {"HH": hh, "HV": hv}, stable, radar


def test_analysis_and_report_run_end_to_end_on_a_synthetic_site(tmp_path):
    """SYNTHETIC: the whole of steps 5 to 9 and the three outputs, so that the real run cannot fail on their form."""
    scenes, classes, stable, radar = _synthetic_site()
    a = oc.analyse(scenes, classes, stable, radar)
    assert "2026-09-25" not in a["usable_days"] and len(a["usable_days"]) == len(SYN_DAYS) - 1
    assert a["thresholds"]["T_pooled"]["threshold"] is not None
    assert a["thresholds"]["T_strict"]["days"] == ["2026-10-28", "2026-11-02", "2026-11-04"]
    assert a["pass_days"]["2026-10-11"] == {"on_or_before": "2026-10-03", "on_or_after": "2026-10-13"}
    tab = a["tables"]["T_pooled"]
    assert len(tab["agreement"]) == 3 * 2 * 2 and len(tab["no_harvest_seen"]) == 2 * 3
    for row in tab["no_harvest_seen"]:
        assert row["cut"] + row["not_cut"] + row["never_green"] == row["cells"]
    res = {"run_at": "SYNTHETIC", "inputs": {"harvest_passes_all": ["2026-09-17", "2026-09-29", *oc.HARVEST_PASSES]},
           "analysis": a}
    (tmp_path / "RESULTS.md").write_text(f"x\n{oc.READING_START}\nKept reading.\n{oc.READING_END}\n", encoding="utf-8")
    oc.write_outputs(res, tmp_path)
    doc = json.loads((tmp_path / "results.json").read_text(encoding="utf-8"))
    assert doc["analysis"]["usable_days"] == a["usable_days"]
    md = (tmp_path / "RESULTS.md").read_text(encoding="utf-8")
    assert "Kept reading." in md and "### T_strict" in md and "| 2026-09-25 |" in md
    assert (tmp_path / "ndvi_by_class.png").stat().st_size > 10_000


def test_a_pass_without_a_usable_date_after_it_is_reported_as_none():
    """SYNTHETIC: 4 and 7 November cloudy, so no usable date on or after the last pass; the tables say none."""
    scenes, classes, stable, radar = _synthetic_site()
    for s in scenes:
        if s["day"] in ("2026-11-04", "2026-11-07"):
            s["count"] = np.zeros_like(s["count"])
    a = oc.analyse(scenes, classes, stable, radar)
    assert a["pass_days"]["2026-11-04"] == {"on_or_before": "2026-11-02", "on_or_after": None}
    tab = a["tables"]["T_pooled"]
    assert [r["day"] for r in tab["agreement"] if r["pass"] == "2026-11-04"] == ["2026-11-02", "2026-11-02", None, None]
    assert [r["day"] for r in tab["pair_ending_on_pass"] if r["pass"] == "2026-11-04"] == [None, None]
    md = oc.results_markdown({"run_at": "SYNTHETIC", "analysis": a})
    assert "| 2026-11-04 | on or after | none |" in md


# Every number of steps 5 to 9 on a SYNTHETIC site small enough to work out by hand ------------------------------

G, B = 0.8, 0.2
HAND_DAYS = ["2026-09-13", "2026-09-18", "2026-10-03", "2026-10-08", "2026-10-13", "2026-10-23", "2026-10-28",
             "2026-11-02", "2026-11-04", "2026-11-07", "2026-11-12"]
# One row of 13 cells: (HH class, HV class, NDVI on each of HAND_DAYS; NaN = no value). 11-04 is not usable (6 of
# the 10 rice cells have a value); 10-08 is usable (every rice cell has a value) though 3 of 13 cells have none.
HAND_CELLS = [
    (1, 1, [G, G, B, G, B, B, .10, .15, B, B, B]),         # c0 strict; cut 10-03, green again on 10-08
    (2, 1, [G, G, G, G, B, B, .20, .25, B, B, B]),         # c1 strict; cut 10-13
    (2, 2, [G, G, G, G, G, B, .30, .35, B, B, B]),         # c2 strict; cut 10-23; its 10-28 value is T_strict
    (3, 2, [G, G, G, G, G, G, B, B, B, B, B]),             # c3 cut 10-28
    (4, 3, [G, G, G, G, G, G, G, B, B, B, B]),             # c4 cut 11-02
    (3, 4, [G, G, G, G, G, G, G, .45, G, B, B]),           # c5 cut 11-02 under T_pooled, 11-07 under T_strict
    (4, 4, [G, G, G, G, G, G, G, G, np.nan, G, B]),        # c6 cut 11-12
    (4, 4, [G, G, G, G, G, G, G, G, np.nan, G, G]),        # c7 green throughout: not cut
    (4, 4, [B, B, B, B, B, B, B, B, np.nan, B, B]),        # c8 never green
    (5, 5, [G, B, B, B, B, B, B, B, np.nan, B, B]),        # c9 fell before (radar); optically cut 10-03
    (6, 6, [G, G, B, np.nan, G, G, G, G, G, G, G]),        # c10 not rice; cut 10-03, no value 10-08
    (6, 6, [.7, .7, .7, np.nan, .7, .7, .7, .7, .7, .7, .7]),  # c11 not rice
    (0, 0, [B, B, B, np.nan, B, B, B, B, B, B, B]),        # c12 no radar class; the stable target's box
]
HAND_RADAR = {"HH": {"2026-10-11": 0.11, "2026-10-23": 0.22, "2026-11-04": 0.33},
              "HV": {"2026-10-11": 0.44, "2026-10-23": 0.55, "2026-11-04": 0.66}}


def _hand_site():
    """Scenes whose cell means give exactly the NDVI above: red 500 (1 - v), NIR 500 (1 + v) per pixel."""
    hh = np.array([[c[0] for c in HAND_CELLS]])
    hv = np.array([[c[1] for c in HAND_CELLS]])
    stable = np.zeros(hh.shape, dtype=bool)
    stable[0, 12] = True
    scenes = []
    for i, day in enumerate(HAND_DAYS):
        v = np.array([[c[2][i] for c in HAND_CELLS]])
        count = np.where(np.isfinite(v), 100, 0)
        w = np.nan_to_num(v)
        scenes.append({"day": day, "items": [f"SYNTHETIC_{day}"], "count": count,
                       "sum_red": np.rint(count * 500 * (1 - w)).astype(np.int64),
                       "sum_nir": np.rint(count * 500 * (1 + w)).astype(np.int64), "scale": 1e-4, "offset": 0.0})
    return scenes, {"HH": hh, "HV": hv}, stable


SIDES = [("2026-10-11", "on_or_before", "2026-10-08"), ("2026-10-11", "on_or_after", "2026-10-13"),
         ("2026-10-23", "on_or_before", "2026-10-23"), ("2026-10-23", "on_or_after", "2026-10-23"),
         ("2026-11-04", "on_or_before", "2026-11-02"), ("2026-11-04", "on_or_after", "2026-11-07")]
# Worked out by hand from HAND_CELLS. Rice cells c0 to c9; never green: c8 alone.
HAND = {
    "T_pooled": {
        # (a) per side: cut, not cut, never green, of the 10 rice cells
        "a": [(2, 7, 1), (3, 6, 1), (4, 5, 1), (4, 5, 1), (7, 2, 1), (7, 2, 1)],
        # (b) class 4 (HV: c5 c6 c7 c8; HH: c4 c6 c7 c8) on 11-02, 11-07 and the last usable date 11-12
        "b": {"HV": [(1, 2, 1), (1, 2, 1), (2, 1, 1)], "HH": [(1, 2, 1), (1, 2, 1), (2, 1, 1)]},
        # (d) per side: cells agreeing of the 8 used (c0 to c7), HV then HH
        "d": [(7, 8), (8, 7), (7, 8), (7, 8), (7, 7), (7, 7)],
        # (e) per side: cut cells, measured, back to green
        "e": [(2, 2, 1), (3, 3, 1), (4, 4, 1), (4, 4, 1), (7, 7, 1), (7, 7, 1)],
        "cut_days": {"2026-10-03": 2, "2026-10-08": 0, "2026-10-13": 1, "2026-10-23": 1, "2026-10-28": 1,
                     "2026-11-02": 2, "2026-11-07": 0, "2026-11-12": 1},
    },
    "T_strict": {
        "a": [(2, 7, 1), (3, 6, 1), (4, 5, 1), (4, 5, 1), (6, 3, 1), (7, 2, 1)],
        "b": {"HV": [(0, 3, 1), (1, 2, 1), (2, 1, 1)], "HH": [(1, 2, 1), (1, 2, 1), (2, 1, 1)]},
        "d": [(7, 8), (8, 7), (7, 8), (7, 8), (8, 6), (7, 7)],
        # c2's value on 10-28 equals T_strict: at or above it, so back to green
        "e": [(2, 2, 1), (3, 3, 1), (4, 4, 2), (4, 4, 2), (6, 6, 2), (7, 7, 2)],
        "cut_days": {"2026-10-03": 2, "2026-10-08": 0, "2026-10-13": 1, "2026-10-23": 1, "2026-10-28": 1,
                     "2026-11-02": 1, "2026-11-07": 1, "2026-11-12": 1},
    },
}
# (c) the same under both thresholds: (cells, cut, not cut, never green) of the cells whose pair ends on the pass
HAND_C = {("2026-10-11", "HV"): (2, 2, 0, 0), ("2026-10-11", "HH"): (1, 1, 0, 0),
          ("2026-10-23", "HV"): (2, 1, 1, 0), ("2026-10-23", "HH"): (2, 2, 0, 0),
          ("2026-11-04", "HV"): (1, 1, 0, 0), ("2026-11-04", "HH"): (2, 2, 0, 0)}


def test_every_table_of_steps_5_to_9_matches_a_hand_computed_synthetic_site():
    """SYNTHETIC: 13 cells in one row, 11 dates; every count of steps 5 to 9 checked against HAND."""
    scenes, classes, stable = _hand_site()
    a = oc.analyse(scenes, classes, stable, HAND_RADAR)
    usable = [d for d in HAND_DAYS if d != "2026-11-04"]

    # Step 5: shares over the 10 rice cells, not over all 13 cells (10-08 would fall to 10/13).
    assert a["rice_cells"] == 10 and a["usable_days"] == usable
    assert [(d["day"], d["share_rice_with_value"], d["usable"], d["cells_with_value"]) for d in a["dates"]] == [
        (d, 0.6 if d == "2026-11-04" else 1.0, d != "2026-11-04",
         10 if d == "2026-10-08" else 9 if d == "2026-11-04" else 13) for d in HAND_DAYS]

    # Step 7: each polarization's own classes.
    assert a["group_cells"] == {
        "HV": {"1": 2, "2": 2, "3": 1, "4": 4, "5": 1, "not rice": 2, "stable target box": 1},
        "HH": {"1": 1, "2": 2, "3": 2, "4": 4, "5": 1, "not rice": 2, "stable target box": 1}}
    day = a["ndvi_by_class"]["HV"]["2026-10-13"]
    assert day["1"] == {"n": 2, "median": pytest.approx(B), "q1": pytest.approx(B), "q3": pytest.approx(B)}
    assert day["2"]["median"] == pytest.approx(G) and day["4"]["q1"] == pytest.approx(0.65)
    assert day["not rice"]["median"] == pytest.approx(0.75) and day["stable target box"]["n"] == 1
    assert a["ndvi_by_class"]["HH"]["2026-10-13"]["2"]["median"] == pytest.approx(0.5)
    assert a["ndvi_by_class"]["HV"]["2026-10-08"]["not rice"] == {"n": 0, "median": None, "q1": None, "q3": None}

    # Step 8: T_pooled from the 90 rice values from 09-18 on; T_strict from the 6 values of the 3 strict cells.
    tp, ts = a["thresholds"]["T_pooled"], a["thresholds"]["T_strict"]
    assert tp["values"] == 90 and tp["days"] == usable[1:] and 0.45 < tp["threshold"] < G
    assert ts["values"] == 6 and ts["cells"] == 3 and ts["days"] == ["2026-10-28", "2026-11-02"]
    assert ts["threshold"] == pytest.approx(0.30)
    assert a["pass_days"] == {"2026-10-11": {"on_or_before": "2026-10-08", "on_or_after": "2026-10-13"},
                              "2026-10-23": {"on_or_before": "2026-10-23", "on_or_after": "2026-10-23"},
                              "2026-11-04": {"on_or_before": "2026-11-02", "on_or_after": "2026-11-07"}}
    assert a["last_usable_day"] == "2026-11-12"

    # Step 9, tables (a) to (e), under both thresholds.
    for name, hand in HAND.items():
        tab = a["tables"][name]
        for (p, side, d), (cut, not_cut, never), row in zip(SIDES, hand["a"], tab["cut_share_by_pass"], strict=True):
            assert (row["pass"], row["side"], row["day"]) == (p, side, d)
            assert (row["cells"], row["cut"], row["not_cut"], row["never_green"]) == (10, cut, not_cut, never)
            assert row["share_cut"] == pytest.approx(cut / 10) and row["no_value_at_all"] == 0
            assert row["radar_share_harvest_pair_by_pass"] == {"HH": HAND_RADAR["HH"][p], "HV": HAND_RADAR["HV"][p]}
            assert row["official"] == oc.OFFICIAL[p]
        rows_b = [(r["polarization"], r["day"], r["cells"], r["cut"], r["not_cut"], r["never_green"])
                  for r in tab["no_harvest_seen"]]
        assert rows_b == [(pol, d, 4, *counts) for pol in ("HH", "HV")
                          for d, counts in zip(("2026-11-02", "2026-11-07", "2026-11-12"), hand["b"][pol],
                                               strict=True)], name
        assert [r["day_kind"] for r in tab["no_harvest_seen"][:3]] == [
            "on_or_before 2026-11-04", "on_or_after 2026-11-04", "last usable date"]
        assert [(r["pass"], r["day"], r["polarization"], r["class"], r["cells"], r["cut"], r["not_cut"],
                 r["never_green"]) for r in tab["pair_ending_on_pass"]] == [
            (p, d, pol, k, *HAND_C[(p, pol)])
            for k, (p, d) in enumerate((("2026-10-11", "2026-10-13"), ("2026-10-23", "2026-10-23"),
                                        ("2026-11-04", "2026-11-07")), start=1) for pol in ("HH", "HV")]
        rows_d = tab["agreement"]
        assert len(rows_d) == 12
        for i, (p, side, d) in enumerate(SIDES):
            for pol, agree in zip(("HV", "HH"), hand["d"][i], strict=True):
                row = rows_d[2 * i + (pol == "HV")]
                assert (row["pass"], row["side"], row["day"], row["polarization"]) == (p, side, d, pol)
                assert (row["cells_used"], row["cells_agree"]) == (8, agree), (name, p, side, pol)
                assert row["agreement"] == pytest.approx(agree / 8)
                assert row["interval_95"] == pytest.approx([agree / 8] * 2)  # one block of 10 x 10 cells holds them
                assert (row["left_out_fell_before"], row["left_out_never_green"]) == (1, 1)
                assert row["both_say_harvested"] + row["both_say_not"] == agree
                assert row["radar_harvested_optical_not"] + row["radar_not_optical_cut"] == 8 - agree
        for (p, side, d), (cut, measured, back), row in zip(SIDES, hand["e"], tab["back_to_green"], strict=True):
            assert (row["pass"], row["side"], row["day"]) == (p, side, d)
            assert (row["cut_cells"], row["measured"], row["back_to_green"], row["no_value_next_day"],
                    row["cut_on_last_usable_day"]) == (cut, measured, back, 0, 0), (name, p, side)
        assert tab["cut_day_counts"] == hand["cut_days"]


def test_run_records_each_scenes_evidence_and_stops_on_a_failed_offset_check(monkeypatch):
    """SYNTHETIC inputs, catalog and scenes in place of the real ones: run() puts each scene's conversion evidence,
    datatake and datastrips into results.json, and stops before the analysis when a scene fails the offset check."""
    scenes, classes, stable = _hand_site()
    by_day = {s["day"]: s for s in scenes}
    items = [_cat_item(f"S2C_43RDQ_{d.replace('-', '')}_0_L2A") for d in HAND_DAYS]
    inputs = {"classes": classes, "transform": CELL_T, "shape": (1, 13), "stable": stable, "stable_where": [],
              "stable_box": [0, 0, 1, 1], "site_box": [0, 0, 1, 1], "radar_by_pass": HAND_RADAR,
              "harvest_passes_all": ["2026-09-17", "2026-09-29", *oc.HARVEST_PASSES], "sha256": {}}
    cat = {"url": "SYNTHETIC", "collection": oc.COLLECTION, "bbox": [0, 0, 1, 1], "first_day": oc.FIRST_DAY,
           "last_day": oc.LAST_DAY, "queried_at": "SYNTHETIC", "items": items}
    vegetation_share = dict.fromkeys(HAND_DAYS, 0.9)

    def scene(day, its, transform, shape):
        meta = {"items": [it["id"] for it in its], "processing_baseline": ["05.13"], "boa_offset_applied": ["True"],
                "raster_bands_offset": [-0.1], "red_below_offset_share": 0.8,
                "vegetation_red_below_offset_share": vegetation_share[day], "vegetation_pixels": 50_000,
                "pixels_from_each": [1300], "pixels_without_data": 0, "valid_pixels": 1300, "scl_codes": {4: 1300},
                "seconds": 0.0, "bytes": 0, "read_at": "SYNTHETIC"}
        return {**by_day[day], "items": meta["items"], "meta": meta, "cached": True}

    written = []
    monkeypatch.setattr(oc, "read_inputs", lambda: inputs)
    monkeypatch.setattr(oc, "catalog", lambda bbox, refresh=True: cat)
    monkeypatch.setattr(oc, "load_or_read_scene", scene)
    monkeypatch.setattr(oc, "write_outputs", written.append)
    res = oc.run(refresh_catalog=False)
    assert written == [res] and [s["day"] for s in res["scenes"]] == HAND_DAYS
    first = res["scenes"][0]
    assert (first["boa_offset_applied"], first["raster_bands_offset"], first["red_below_offset_share"]) == (
        ["True"], [-0.1], 0.8)
    assert first["offset_check"].startswith("passed") and first["datatake_id"] == items[0]["properties"][
        "s2:datatake_id"] and first["datastrip_ids"] == [items[0]["properties"]["s2:datastrip_id"]]
    assert res["settings"]["reflectance"]["raster_bands_offset_used"] is False
    vegetation_share["2026-10-13"] = 0.0  # this scene still holds the offset, though taken as free of it
    written.clear()
    with pytest.raises(ValueError, match="still hold"):
        oc.run(refresh_catalog=False)
    assert written == []

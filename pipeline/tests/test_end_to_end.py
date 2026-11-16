"""The whole chain on three SYNTHETIC dates, in a temporary folder (see conftest.py)."""

from __future__ import annotations

import json
import os
import re
import shutil
from pathlib import Path

import h5py
import numpy as np
import pytest
import rasterio
import yaml
from affine import Affine
from pyproj import Transformer
from rasterio.warp import Resampling, reproject

from pipeline.config import ConfigError, load_site
from pipeline.encode import decode
from pipeline.export import check_raster, write_cog
from pipeline.gcov import EXCEPTION_SUMMARY_METHOD
from pipeline.manifest import validate
from pipeline.paths import Layout
from pipeline.process import GridMismatchError
from pipeline.qa import target_pixels
from pipeline.rasters import read_geotiff, read_json, write_geotiff
from pipeline.stages import (
    HARVEST_FILE,
    HARVEST_RASTER,
    INPUTS_TAG,
    analyse_site,
    export_site,
    fetch_site,
    manifest_stage,
    process_site,
    qa_site,
    run_site,
    validate_stage,
)
from pipeline.tests.conftest import DATES, LEVELS_DB, SITE_ID, make_synthetic_site
from pipeline.tests.synth import B_FACTOR, FORMAT_1_5, REAL_FORMAT, BrightSpot, SynthGrid


def test_run_succeeds_and_validates(synthetic_run):
    assert synthetic_run.exit_code == 0
    assert validate(synthetic_run.layout.data_dir) == []
    names = sorted(p.name for p in synthetic_run.data.iterdir())
    assert names == sorted([f"hh_{d}.tif" for d in DATES]
                           + ["hh-change_2026-06-07_2026-06-19.tif", "hh-change_2026-06-19_2026-07-01.tif",
                              "stack_hh.tif", "stats.json", "site.json"])
    qa = synthetic_run.layout.site_work(SITE_ID) / "qa"
    assert len(list(qa.glob("*.png"))) == 2 * len(DATES)


def test_every_raster_meets_the_contract(synthetic_run):
    site = read_json(synthetic_run.data / "site.json")
    for path in synthetic_run.data.glob("*.tif"):
        assert check_raster(path, bounds=tuple(site["bounds"])) == [], path.name


def test_bright_spot_lands_at_the_right_lon_lat(synthetic_run):
    """Wrong hemisphere, a flipped y axis or a half-pixel shift would all move this spot."""
    grid, spot = synthetic_run.grid, synthetic_run.spot
    with rasterio.open(synthetic_run.data / f"hh_{DATES[0]}.tif") as src:
        db = decode(src.read(1), -35, 5)
        transform = src.transform
    rows, cols = np.nonzero(db > -7.5)  # halfway between the -15 dB background and the 0 dB spot
    assert 4 < rows.size < 400
    # Centre of brightness: each pixel weighted by its power above the background. A plain mean of the
    # thresholded pixels would be off by up to half a display pixel just from where the grid falls.
    r0, r1, c0, c1 = rows.min() - 3, rows.max() + 4, cols.min() - 3, cols.max() + 4
    excess = np.nan_to_num(10 ** (db[r0:r1, c0:c1] / 10) - 10 ** (LEVELS_DB[0] / 10)).clip(min=0)
    rr, cc = np.mgrid[r0:r1, c0:c1]
    x, y = transform @ (np.average(cc, weights=excess) + 0.5, np.average(rr, weights=excess) + 0.5)
    lon, lat = Transformer.from_crs("EPSG:3857", "EPSG:4326", always_xy=True).transform(x, y)
    to_utm = Transformer.from_crs("EPSG:4326", f"EPSG:{grid.epsg}", always_xy=True)
    ex, ey = spot.centre_xy(grid)
    gx, gy = to_utm.transform(lon, lat)
    # Measured error is about 1 m. A half-pixel slip would be 10 m (source) or 20 m (multilooked).
    assert abs(gx - ex) < 5 and abs(gy - ey) < 5
    assert lat > 0 and lon < 0  # northern and western hemisphere, like the synthetic grid


def test_processed_grid_keeps_the_spot_exactly(synthetic_run):
    grid, spot = synthetic_run.grid, synthetic_run.spot
    with rasterio.open(synthetic_run.layout.site_work(SITE_ID) / "proc" / f"{DATES[0]}.tif") as src:
        power, transform = src.read(1), src.transform
    rows, cols = np.nonzero(power > 0.2)
    weights = power[rows, cols]
    x, y = transform @ (np.average(cols, weights=weights) + 0.5, np.average(rows, weights=weights) + 0.5)
    assert (x, y) == pytest.approx(spot.centre_xy(grid), abs=1e-6)


def test_stack_bands_follow_date_order(synthetic_run):
    with rasterio.open(synthetic_run.data / "stack_hh.tif") as src:
        assert list(src.descriptions) == DATES
        means = [np.nanmean(decode(src.read(b), -35, 5)) for b in range(1, src.count + 1)]
        assert src.interleaving.name == "pixel"
        assert src.block_shapes[0] == (128, 128)
    assert means == sorted(means)  # the synthetic levels rise date by date
    site = read_json(synthetic_run.data / "site.json")
    assert site["stacks"][0]["band_dates"] == DATES


def test_stats_are_means_of_linear_power(synthetic_run):
    stats = read_json(synthetic_run.data / "stats.json")
    points = stats["series"][0]["points"]
    assert [p["date"] for p in points] == DATES
    # Gamma speckle around each level: the mean of linear power gives back the level (within noise).
    for p, level in zip(points, LEVELS_DB, strict=True):
        assert p["value"] == pytest.approx(level, abs=0.3)
        assert p["n"] > 10000


def test_masked_pixels_are_nodata_not_values(synthetic_run):
    site = read_json(synthetic_run.data / "site.json")
    assert site["dates"][0]["notes"].startswith("Acquired by SYNTHETIC")
    proc = synthetic_run.layout.site_work(SITE_ID) / "proc" / f"{DATES[0]}.tif"
    with rasterio.open(proc) as src:
        data = src.read(1)
    assert np.isnan(data).any()  # invalid mask, 1e-14 edge values and outside-swath columns
    assert np.nanmin(data) > 1e-5


def test_second_run_changes_nothing(synthetic_run):
    layout = synthetic_run.layout
    files = [p for root in (layout.work_dir, layout.data_dir) for p in root.rglob("*") if p.is_file()]
    before = {p: (p.stat().st_mtime_ns, p.stat().st_size) for p in files}
    assert run_site(load_site(SITE_ID, layout.sites_dir), layout) == 0
    after = {p: (p.stat().st_mtime_ns, p.stat().st_size) for p in files}
    assert before == after
    assert sorted(p for root in (layout.work_dir, layout.data_dir) for p in root.rglob("*") if p.is_file()) \
        == sorted(files)


def test_zero_valid_convention_runs_end_to_end(tmp_path, capsys):
    layout = make_synthetic_site(tmp_path, convention="zero-valid")
    assert run_site(load_site(SITE_ID, layout.sites_dir), layout) == 0
    side = read_json(layout.site_work(SITE_ID) / "windows" / f"{DATES[0]}.json")
    assert side["mask_values"] == [0, 255]
    # Like NASA's 1.2.1 samples: no hasInputDataException and no exception mask. Unknown is recorded as
    # null, not as "no exceptions", and nothing fails or warns.
    assert side["has_input_data_exception"] is None and side["facts"]["has_input_data_exception"] is None
    assert side["has_exception_mask"] is False and side["exception_summary"] is None
    assert "WARNING" not in capsys.readouterr().out


def test_a_newer_input_makes_later_stages_redo_their_work(tmp_path):
    layout = make_synthetic_site(tmp_path)
    cfg = load_site(SITE_ID, layout.sites_dir)
    assert run_site(cfg, layout) == 0
    window = layout.site_work(SITE_ID) / "windows" / f"{DATES[0]}.tif"
    proc = layout.site_work(SITE_ID) / "proc" / f"{DATES[0]}.tif"
    cog = layout.site_data(SITE_ID) / f"hh_{DATES[0]}.tif"
    untouched = layout.site_data(SITE_ID) / f"hh_{DATES[2]}.tif"
    before = {p: p.stat().st_mtime_ns for p in (proc, cog, untouched)}
    future = window.stat().st_mtime_ns + 10_000_000_000  # pretend the window was fetched again later
    os.utime(window, ns=(future, future))
    process_site(cfg, layout)
    export_site(cfg, layout)
    assert proc.stat().st_mtime_ns > before[proc]
    assert cog.stat().st_mtime_ns > before[cog]
    assert untouched.stat().st_mtime_ns == before[untouched]


# Stage-level checks of the science rules. Each one fails if the rule is taken out of process_site,
# export_site or fetch_site, not only out of the helper function that implements it.

def _window_origin(layout) -> tuple[int, int]:
    """First source row and column of the fetched window, from what fetch recorded."""
    side = read_json(layout.site_work(SITE_ID) / "windows" / f"{DATES[0]}.json")
    r0, c0 = side["window"]["rows"][0], side["window"]["cols"][0]
    assert r0 % 2 == 0 and c0 % 2 == 0  # so 2x2 looks line up with the synthetic blocks below
    return r0, c0


def _proc(layout, date: str = DATES[0]) -> np.ndarray:
    return read_geotiff(layout.site_work(SITE_ID) / "proc" / f"{date}.tif")[0][0]


def test_masked_block_is_nodata_in_the_processed_raster(synthetic_run):
    # synth.py marks rows 100-101, columns 100-109 invalid (mask 0) with ordinary power values.
    r0, c0 = _window_origin(synthetic_run.layout)
    proc = _proc(synthetic_run.layout)
    row, cols = (100 - r0) // 2, slice((100 - c0) // 2, (110 - c0) // 2)
    assert np.isnan(proc[row, cols]).all()
    assert np.isfinite(proc[row - 1, cols]).all() and np.isfinite(proc[row + 2, cols]).all()


def test_power_floor_removes_edge_values_in_the_processed_raster(synthetic_run):
    # synth.py writes 1e-14 into row 110, columns 100-109. Each 2x2 look over rows 110-111 must be the mean
    # of the two row-111 pixels only; with the floor gone it would be about half of that.
    layout = synthetic_run.layout
    r0, c0 = _window_origin(layout)
    window = read_geotiff(layout.site_work(SITE_ID) / "windows" / f"{DATES[0]}.tif")[0][0]
    below = window[111 - r0, 100 - c0:110 - c0].astype(np.float64)
    expected = (below[0::2] + below[1::2]) / 2
    proc = _proc(layout)[(110 - r0) // 2, (100 - c0) // 2:(110 - c0) // 2]
    np.testing.assert_allclose(proc, expected, rtol=1e-5)


def test_dates_on_different_grids_stop_process(tmp_path):
    # Half a source pixel east: same stack, but the pixels no longer line up.
    layout = make_synthetic_site(tmp_path, files={DATES[1]: {"grid": SynthGrid(x_first=400020.0)}})
    cfg = load_site(SITE_ID, layout.sites_dir)
    fetch_site(cfg, layout)
    with pytest.raises(GridMismatchError):
        process_site(cfg, layout)


def test_dates_on_different_grids_stop_export(tmp_path):
    layout = make_synthetic_site(tmp_path)
    cfg = load_site(SITE_ID, layout.sites_dir)
    fetch_site(cfg, layout)
    process_site(cfg, layout)
    proc_file = layout.site_work(SITE_ID) / "proc" / f"{DATES[1]}.tif"
    data, info = read_geotiff(proc_file)
    write_geotiff(proc_file, data, info["crs"], info["transform"] @ Affine.translation(0.25, 0), np.nan,
                  descriptions=info["descriptions"], tags=info["tags"])
    with pytest.raises(GridMismatchError):
        export_site(cfg, layout)


def _two_scale_scene() -> np.ndarray:
    """A scene where averaging decibels gives a different answer from averaging power, at two scales.

    Source columns repeat -25, -5, -25, -25 dB. A 2x2 look is then -7.97 dB (mean of power) on even
    working columns and -25 dB on odd ones, so the working raster itself alternates as well.
    """
    pattern = np.array([-25.0, -5.0, -25.0, -25.0])
    db = np.tile(pattern, 150)[np.newaxis, :].repeat(600, axis=0)
    return (10 ** (db / 10)).astype(np.float32)


TWO_SCALE_MEAN_DB = 10 * np.log10((0.5 * (10 ** -2.5 + 10 ** -0.5) + 10 ** -2.5) / 2)  # -10.89 dB


@pytest.fixture(scope="module")
def two_scale_run(tmp_path_factory):
    layout = make_synthetic_site(tmp_path_factory.mktemp("two-scale"),
                                 files={d: {"power": _two_scale_scene()} for d in DATES})
    assert run_site(load_site(SITE_ID, layout.sites_dir), layout) == 0
    return layout


def test_stats_average_linear_power(two_scale_run):
    proc = _proc(two_scale_run)
    mean_of_db = np.nanmean(10 * np.log10(proc))
    assert abs(mean_of_db - TWO_SCALE_MEAN_DB) > 1  # the scene can tell the two methods apart
    points = read_json(two_scale_run.site_data(SITE_ID) / "stats.json")["series"][0]["points"]
    for p in points:
        assert p["value"] == pytest.approx(TWO_SCALE_MEAN_DB, abs=0.1)


@pytest.mark.parametrize("name", ["stack_hh.tif", f"hh_{DATES[0]}.tif"])
def test_warp_averages_linear_power(two_scale_run, name):
    with rasterio.open(two_scale_run.site_data(SITE_ID) / name) as src:
        db = decode(src.read(1), -35, 5)
    linear_mean = 10 * np.log10(np.nanmean(10 ** (db / 10)))
    assert linear_mean == pytest.approx(TWO_SCALE_MEAN_DB, abs=0.5)


@pytest.mark.parametrize("stack", [{"track": 31}, {"frame": 20}, {"direction": "Descending"}])
def test_granule_from_another_stack_is_refused(tmp_path, stack):
    layout = make_synthetic_site(tmp_path, files={DATES[1]: stack})
    with pytest.raises(ValueError, match="science rule 1"):
        fetch_site(load_site(SITE_ID, layout.sites_dir), layout)


def test_site_stack_must_match_the_granule_list(tmp_path):
    layout = make_synthetic_site(tmp_path, site={"stack": "031_A_019"})
    with pytest.raises(ConfigError, match="science rule 1"):
        fetch_site(load_site(SITE_ID, layout.sites_dir), layout)


def test_series_uses_one_footprint_and_leaves_out_poorly_covered_dates(tmp_path):
    # Bright top half, dark bottom half, the same on every date. Date 2 misses a band of the bright half
    # (about 15 % of the window): averaged over its own pixels it would read about 0.7 dB darker. Date 3
    # misses most of the window and must become a gap.
    db = np.where(np.arange(600)[:, np.newaxis] < 300, -5.0, -20.0) * np.ones((1, 600))
    scene = (10 ** (db / 10)).astype(np.float32)
    layout = make_synthetic_site(tmp_path, files={
        DATES[0]: {"power": scene},
        DATES[1]: {"power": scene, "hole": (60, 130, 0, 600)},
        DATES[2]: {"power": scene, "hole": (60, 400, 0, 600)},
    })
    assert run_site(load_site(SITE_ID, layout.sites_dir), layout) == 0
    series = read_json(layout.site_data(SITE_ID) / "stats.json")["series"][0]
    first, second, third = series["points"]
    procs = [_proc(layout, d) for d in DATES]
    common = np.isfinite(procs[0]) & np.isfinite(procs[1])
    expected = 10 * np.log10(procs[0][common].astype(np.float64).mean())
    assert first["value"] == pytest.approx(expected, abs=1e-3)
    assert second["value"] == pytest.approx(expected, abs=1e-3)
    assert first["n"] == second["n"] == int(common.sum())
    own = 10 * np.log10(np.nanmean(procs[0].astype(np.float64)))
    assert abs(own - expected) > 0.3  # date 1 over its own pixels: what a per-date footprint would publish
    assert third["value"] is None and third["n"] == int(np.isfinite(procs[2]).sum()) > 0
    assert f"Left out: {DATES[2]}." in series["method"] and "80%" in series["method"]
    assert "EPSG:32611" in series["region"] and "larger than the lon/lat bounds" in series["region"]


def test_layer_descriptions_are_the_pipelines_unless_the_site_writes_them(tmp_path, synthetic_run):
    layers = read_json(synthetic_run.data / "site.json")["layers"]
    # The pipeline's own texts (pipeline/stages.py), as each kind of layer's begins.
    defaults = {"per-date": "How strongly the ground sent the radar signal back, in HH polarization: ",
                "pair": "Change in HH backscatter from the earlier to the later date: "}
    for layer in layers:
        assert layer["description"].startswith(defaults[layer["kind"]])
    assert "usually" in layers[0]["description"]

    own = {"backscatter": {"encoding": {"lo": -35, "hi": 5}, "display": {"min": -25, "max": 0, "ramp": "grey"},
                           "description": "Our words about backscatter."},
           "change": {"encoding": {"lo": -10, "hi": 10}, "display": {"min": -6, "max": 6, "ramp": "BrewerPuOr11"},
                      "description": "Our words about change."}}
    layout = make_synthetic_site(tmp_path, site=own)
    assert run_site(load_site(SITE_ID, layout.sites_dir), layout) == 0
    layers = read_json(layout.site_data(SITE_ID) / "site.json")["layers"]
    assert [la["description"] for la in layers] == ["Our words about backscatter.", "Our words about change."]


# Every output records the inputs it was made from, and a changed setting redoes what depends on it.

def _edit_site(layout, **changes) -> None:
    path = layout.sites_dir / f"{SITE_ID}.yaml"
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    data.update(changes)
    path.write_text(yaml.safe_dump(data, sort_keys=False), encoding="utf-8")


def _mtimes(folder) -> dict[str, int]:
    return {p.name: p.stat().st_mtime_ns for p in folder.iterdir() if p.is_file()}


@pytest.fixture
def finished_run(tmp_path):
    layout = make_synthetic_site(tmp_path)
    assert run_site(load_site(SITE_ID, layout.sites_dir), layout) == 0
    return layout


def test_new_encoding_rewrites_the_files_and_validate_passes(finished_run):
    layout = finished_run
    _edit_site(layout, backscatter={"encoding": {"lo": -30, "hi": 10},
                                    "display": {"min": -25, "max": 0, "ramp": "grey"}})
    assert run_site(load_site(SITE_ID, layout.sites_dir), layout) == 0
    for name in [f"hh_{d}.tif" for d in DATES] + ["stack_hh.tif"]:
        with rasterio.open(layout.site_data(SITE_ID) / name) as src:
            assert json.loads(src.tags()["ENCODING"])["hi"] == 10, name


def test_new_power_floor_redoes_process_and_everything_after(finished_run):
    layout = finished_run
    data = layout.site_data(SITE_ID)
    before = _mtimes(data)
    _edit_site(layout, power_floor=0.2)
    cfg = load_site(SITE_ID, layout.sites_dir)
    process_site(cfg, layout)
    assert json.loads(read_geotiff(layout.site_work(SITE_ID) / "proc" / f"{DATES[0]}.tif")[1]["tags"]
                      [INPUTS_TAG])["power_floor"] == 0.2
    export_site(cfg, layout)
    after = _mtimes(data)
    assert all(after[n] > before[n] for n in before if n.endswith(".tif"))


@pytest.mark.parametrize("change, redone", [
    ({"change_boxcar_px": 5}, {f"hh-change_{DATES[0]}_{DATES[1]}.tif", f"hh-change_{DATES[1]}_{DATES[2]}.tif"}),
    ({"stack_zoom_offset": 1}, {"stack_hh.tif"}),
    ({"display_zoom": 11}, {f"hh_{d}.tif" for d in DATES} | {"stack_hh.tif"}
     | {f"hh-change_{DATES[0]}_{DATES[1]}.tif", f"hh-change_{DATES[1]}_{DATES[2]}.tif"}),
])
def test_export_settings_redo_exactly_the_files_they_change(finished_run, change, redone):
    layout = finished_run
    data = layout.site_data(SITE_ID)
    before = _mtimes(data)
    _edit_site(layout, **change)
    export_site(load_site(SITE_ID, layout.sites_dir), layout)
    after = _mtimes(data)
    assert {n for n in before if n.endswith(".tif") and after[n] != before[n]} == redone


def test_new_bbox_or_granule_refetches(finished_run, tmp_path):
    layout = finished_run
    cfg = load_site(SITE_ID, layout.sites_dir)
    windows = layout.site_work(SITE_ID) / "windows"
    before = _mtimes(windows)
    w, s, e, n = cfg.bbox
    _edit_site(layout, bbox=[w, s, round(e - 0.01, 5), n])
    fetch_site(load_site(SITE_ID, layout.sites_dir), layout)
    after = _mtimes(windows)
    assert all(after[f"{d}.tif"] > before[f"{d}.tif"] for d in DATES)

    listing_path = layout.sites_dir / f"{SITE_ID}.granules.json"
    listing = read_json(listing_path)
    moved = tmp_path / "moved" / "synthetic_moved.h5"
    moved.parent.mkdir()
    shutil.copy(listing["granules"][0]["url"], moved)
    listing["granules"][0]["url"] = str(moved)
    listing_path.write_text(json.dumps(listing), encoding="utf-8")
    fetch_site(load_site(SITE_ID, layout.sites_dir), layout)
    again = _mtimes(windows)
    assert again[f"{DATES[0]}.tif"] > after[f"{DATES[0]}.tif"]
    assert again[f"{DATES[1]}.tif"] == after[f"{DATES[1]}.tif"]
    assert read_json(windows / f"{DATES[0]}.json")["inputs"]["url"] == str(moved)


def test_leftover_temporary_files_are_ignored(finished_run):
    layout = finished_run
    windows = layout.site_work(SITE_ID) / "windows"
    (windows / f".{DATES[0]}.partial.json").write_text('{"date": ', encoding="utf-8")  # cut off mid-write
    shutil.copy(windows / f"{DATES[1]}.json", windows / f".{DATES[1]}.partial.json")  # a replace that failed
    cfg = load_site(SITE_ID, layout.sites_dir)
    process_site(cfg, layout, force=True)
    qa_site(cfg, layout, force=True)
    export_site(cfg, layout, force=True)


def test_dates_dropped_from_the_list_leave_the_published_folder(finished_run, capsys):
    layout = finished_run
    listing_path = layout.sites_dir / f"{SITE_ID}.granules.json"
    listing = read_json(listing_path)
    listing["granules"] = listing["granules"][:2]
    listing_path.write_text(json.dumps(listing), encoding="utf-8")
    cfg = load_site(SITE_ID, layout.sites_dir)
    process_site(cfg, layout)
    export_site(cfg, layout)
    gone = {f"hh_{DATES[2]}.tif", f"hh-change_{DATES[1]}_{DATES[2]}.tif"}
    names = {p.name for p in layout.site_data(SITE_ID).iterdir()}
    assert not gone & names and f"hh_{DATES[1]}.tif" in names
    out = capsys.readouterr().out
    assert all(f"removed {g}" in out for g in gone)
    manifest_stage(layout)
    assert validate_stage(layout) == 0


# Files in the format of the first real granule (specification 1.6.0, read on 14 November 2026): frequencies
# A and B, HH and HV, mask 0 / 1 / 255, inputDataExceptionMask and hasInputDataException. SYNTHETIC values.

REAL = {k: v for k, v in REAL_FORMAT.items() if k != "convention"}  # make_synthetic_site takes the convention
TWO_POLS = {"polarizations": ["HH", "HV"]}

# Frequency A pixels given other exception values, (row, col): value. All inside the window of the test
# site (rows and columns 60 to 540) and inside the swath (columns below 500).
MARKS = {
    (200, 200): 770,  # HH and HV fully focused, anomaly code 2 (sample slip)
    (200, 201): 770,
    (201, 200): 258,  # HV not fully focused, and anomaly code 2
    (202, 202): 256,  # HV not fully focused
    (203, 203): 0,  # nothing fully focused: what a chunk that was never written reads as
    (204, 204): 512,  # HH not fully focused
}


def _windows(layout):
    return layout.site_work(SITE_ID) / "windows"


def _real_site(root, *, common: dict | None = None, site: dict | None = None):
    return make_synthetic_site(root, convention="real", common={**REAL, **(common or {})},
                               site={**TWO_POLS, **(site or {})})


@pytest.fixture(scope="module")
def real_format_run(tmp_path_factory):
    layout = _real_site(tmp_path_factory.mktemp("real-format"))
    assert run_site(load_site(SITE_ID, layout.sites_dir), layout) == 0
    return layout


def test_real_format_site_runs_end_to_end(real_format_run):
    layout = real_format_run
    data = layout.site_data(SITE_ID)
    assert validate(layout.data_dir) == []
    names = {p.name for p in data.iterdir()}
    for pol in ("hh", "hv"):
        assert {f"{pol}_{d}.tif" for d in DATES} | {f"stack_{pol}.tif"} <= names
        assert {f"{pol}-change_{a}_{b}.tif" for a, b in zip(DATES, DATES[1:], strict=False)} <= names
    side = read_json(_windows(layout) / f"{DATES[0]}.json")
    assert side["facts"]["spec_version"] == "1.6.0" and side["facts"]["frequencies"] == ["A", "B"]
    assert side["terms"] == ["HHHH", "HVHV"] and side["mask_values"] == [0, 1, 255]
    assert side["has_input_data_exception"] is False and side["has_exception_mask"] is True
    assert side["exception_summary"] is None
    proc, info = read_geotiff(layout.site_work(SITE_ID) / "proc" / f"{DATES[0]}.tif")
    assert info["descriptions"] == ["HH", "HV"] and info["tags"]["MASK_CONVENTION"] == "subswath-1-to-5"
    series = read_json(data / "stats.json")["series"]
    assert [s["layer"] for s in series] == ["hh", "hv"]
    for s in series:
        assert [p["date"] for p in s["points"]] == DATES and all(p["value"] is not None for p in s["points"])


def test_real_format_site_on_frequency_b(tmp_path):
    # The site file lets a site choose frequency B (80 m here, as in the real file).
    layout = _real_site(tmp_path, site={"frequency": "B", "working_resolution_m": 80})
    assert run_site(load_site(SITE_ID, layout.sites_dir), layout) == 0
    assert validate(layout.data_dir) == []
    side = read_json(_windows(layout) / f"{DATES[0]}.json")
    assert side["frequency"] == "B" and side["window"]["transform"][0] == 80.0
    assert side["mask_values"] == [0, 1, 255] and side["has_exception_mask"] is True
    # The bright square sits where frequency B has it, so the coarser grid is georeferenced right too.
    b_grid, b_spot = SynthGrid().coarser(B_FACTOR), BrightSpot().coarser(B_FACTOR)
    with rasterio.open(layout.site_work(SITE_ID) / "proc" / f"{DATES[0]}.tif") as src:
        power, transform = src.read(1), src.transform
        assert src.res == (80.0, 80.0) and src.count == 2
    rows, cols = np.nonzero(power > 0.2)
    weights = power[rows, cols]
    x, y = transform @ (np.average(cols, weights=weights) + 0.5, np.average(rows, weights=weights) + 0.5)
    assert (x, y) == pytest.approx(b_spot.centre_xy(b_grid), abs=1e-6)


def test_real_window_with_mask_zero_and_one_keeps_exactly_the_ones(tmp_path):
    # The real window held mask values 0 and 1 only. A site box on rows 80-199, columns 80-479 holds the
    # invalid block and no outside-swath column; with no power floor and no multilook, the processed raster
    # must have a value exactly where the mask is 1.
    box = list(SynthGrid().lonlat_box(80, 200, 80, 480))
    layout = _real_site(tmp_path, site={"bbox": box, "working_resolution_m": 20, "power_floor": 0.0})
    cfg = load_site(SITE_ID, layout.sites_dir)
    fetch_site(cfg, layout)
    process_site(cfg, layout)
    for date in DATES:
        assert read_json(_windows(layout) / f"{date}.json")["mask_values"] == [0, 1]
        mask = read_geotiff(_windows(layout) / f"{date}_mask.tif")[0][0]
        proc, info = read_geotiff(layout.site_work(SITE_ID) / "proc" / f"{date}.tif")
        assert info["tags"]["MASK_CONVENTION"] == "subswath-1-to-5"
        assert (mask == 0).sum() == 20  # the synthetic invalid block, 2 x 10 pixels
        for band in proc:
            assert np.array_equal(np.isfinite(band), mask == 1)


def _make_exception_masks_unreadable(layout) -> None:
    """Swap every inputDataExceptionMask for one whose pixels live in a file that does not exist. Its name,
    shape and type stay, so read_facts still finds it, but any read of its pixels raises OSError."""
    for granule in read_json(layout.sites_dir / f"{SITE_ID}.granules.json")["granules"]:
        path = Path(granule["url"])
        with h5py.File(path, "r+") as h5:
            for freq in ("A", "B"):
                group = h5[f"/science/LSAR/GCOV/grids/frequency{freq}"]
                shape = group["inputDataExceptionMask"].shape
                del group["inputDataExceptionMask"]
                missing = path.with_name(f"synthetic_missing_{freq}_{path.stem}.bin")
                group.create_dataset("inputDataExceptionMask", shape=shape, dtype=np.uint16,
                                     external=[(str(missing), 0, 2 * shape[0] * shape[1])])


def test_clear_flag_is_recorded_and_the_exception_mask_is_never_read(tmp_path, capsys):
    layout = _real_site(tmp_path)  # hasInputDataException = 0, as in the real file
    _make_exception_masks_unreadable(layout)
    fetch_site(load_site(SITE_ID, layout.sites_dir), layout)  # any read of an exception mask would raise
    assert "WARNING" not in capsys.readouterr().out
    for date in DATES:
        side = read_json(_windows(layout) / f"{date}.json")
        assert side["has_input_data_exception"] is False and side["facts"]["has_input_data_exception"] is False
        assert side["has_exception_mask"] is True and side["exception_summary"] is None


def test_an_unreadable_exception_mask_really_fails_when_read(tmp_path):
    # The test above proves something only if reading such a mask does fail.
    layout = _real_site(tmp_path, common={"exception_flag": 2})
    _make_exception_masks_unreadable(layout)
    with pytest.raises(OSError):
        fetch_site(load_site(SITE_ID, layout.sites_dir), layout)


def test_set_flag_warns_and_records_exact_shares(tmp_path, capsys):
    layout = _real_site(tmp_path, common={"exception_flag": 2, "exceptions": MARKS})
    fetch_site(load_site(SITE_ID, layout.sites_dir), layout)
    warnings = [line for line in capsys.readouterr().out.splitlines() if line.startswith("WARNING")]
    assert len(warnings) == len(DATES)  # one line per date
    side = read_json(_windows(layout) / f"{DATES[0]}.json")
    assert side["has_input_data_exception"] is True and side["has_exception_mask"] is True
    (r0, r1), (c0, c1) = side["window"]["rows"], side["window"]["cols"]
    pixels = (r1 - r0) * (c1 - c0)
    fill = (r1 - r0) * (c1 - max(c0, 500))  # outside the swath (columns 500 and up): the fill value
    assert fill > 0
    counted = pixels - fill
    s = side["exception_summary"]
    assert (s["pixels"], s["fill_pixels"], s["counted_pixels"]) == (pixels, fill, counted)
    assert s["anomaly_pixels"] == 3 and s["anomaly_share"] == 3 / counted  # 770, 770, 258
    assert s["not_fully_focused_pixels"] == {"HH": 2, "HV": 3}  # HH: 0, 512; HV: 258, 256, 0
    assert s["not_fully_focused_share"] == {"HH": 2 / counted, "HV": 3 / counted}
    assert s["values"] == [{"value": v, "count": c} for v, c in [
        (768, counted - len(MARKS)), (65535, fill), (770, 2), (0, 1), (256, 1), (258, 1), (512, 1)]]
    assert s["values_left_out"] == 0
    assert s["focus_bits"] is True and s["fill_value"] == 65535 and s["method"] == EXCEPTION_SUMMARY_METHOD
    line = warnings[0]
    assert DATES[0] in line and "hasInputDataException" in line and "No pixel was dropped" in line
    assert "reports code 2 (NISAR LSAR qFSP-H1 sample slip) somewhere in the granule" in line
    assert re.search(rf"inside this site's window 3 of {counted} px \(0\.\d+%\) carry an anomaly bit; not fully "
                     r"focused: HH 2 px \(0\.\d+%\), HV 3 px \(0\.\d+%\)", line)
    assert f"({fill} fill px of value 65535 left out)" in line
    assert "0.000%" not in line


def test_the_exception_warning_is_printed_again_when_fetch_skips_the_window(tmp_path, capsys):
    # A long fetch is often run once and `run` repeated: the warning must not vanish from the re-runs.
    layout = _real_site(tmp_path, common={"exception_flag": 2, "exceptions": MARKS})
    cfg = load_site(SITE_ID, layout.sites_dir)
    fetch_site(cfg, layout)
    first = [line for line in capsys.readouterr().out.splitlines() if line.startswith("WARNING")]
    assert len(first) == len(DATES)
    fetch_site(cfg, layout)
    out = capsys.readouterr().out
    assert out.count("exists, skipped") == len(DATES)
    assert [line for line in out.splitlines() if line.startswith("WARNING")] == first


def test_flagged_pixels_are_kept(tmp_path):
    """The exception mask is recorded, never applied: whether flagged pixels go is still an open question."""
    no_looks = {"working_resolution_m": 20}
    flagged = _real_site(tmp_path / "flagged", common={"exception_flag": 2, "exceptions": MARKS}, site=no_looks)
    plain = _real_site(tmp_path / "plain", site=no_looks)
    for layout in (flagged, plain):
        cfg = load_site(SITE_ID, layout.sites_dir)
        fetch_site(cfg, layout)
        process_site(cfg, layout)
    for date in DATES:
        kept = read_geotiff(flagged.site_work(SITE_ID) / "proc" / f"{date}.tif")[0]
        np.testing.assert_array_equal(kept, read_geotiff(plain.site_work(SITE_ID) / "proc" / f"{date}.tif")[0])
    side = read_json(_windows(flagged) / f"{DATES[0]}.json")
    assert side["exception_summary"]["anomaly_pixels"] == 3
    r0, c0 = side["window"]["rows"][0], side["window"]["cols"][0]
    kept = read_geotiff(flagged.site_work(SITE_ID) / "proc" / f"{DATES[0]}.tif")[0]
    for row, col in MARKS:
        assert np.isfinite(kept[:, row - r0, col - c0]).all()


def test_set_flag_without_an_exception_mask_warns(tmp_path, capsys):
    layout = _real_site(tmp_path, common={"exception_flag": 2, "exception_mask": False})
    fetch_site(load_site(SITE_ID, layout.sites_dir), layout)
    out = capsys.readouterr().out
    assert out.count("WARNING") == len(DATES) and "no inputDataExceptionMask for frequency A" in out
    side = read_json(_windows(layout) / f"{DATES[0]}.json")
    assert side["has_input_data_exception"] is True and side["has_exception_mask"] is False
    assert side["exception_summary"] is None
    fetch_site(load_site(SITE_ID, layout.sites_dir), layout)  # skipped, and still warned about
    again = capsys.readouterr().out
    assert again.count("exists, skipped") == len(DATES) and again.count("WARNING") == len(DATES)
    assert again.count("no inputDataExceptionMask for frequency A") == len(DATES)


def test_unreadable_exception_flag_leaves_the_exception_mask_unread(tmp_path, capsys):
    # read_facts records a flag it cannot read as unknown (null) and says the mask is not summarised: fetch
    # must then neither read the mask nor print the exception warning.
    layout = _real_site(tmp_path, common={"exception_flag": "maybe"})
    _make_exception_masks_unreadable(layout)
    fetch_site(load_site(SITE_ID, layout.sites_dir), layout)  # any read of an exception mask would raise
    captured = capsys.readouterr()
    assert "WARNING" not in captured.out and "cannot read hasInputDataException" in captured.err
    for date in DATES:
        side = read_json(_windows(layout) / f"{date}.json")
        assert side["has_input_data_exception"] is None and side["facts"]["has_input_data_exception"] is None
        assert side["has_exception_mask"] is True and side["exception_summary"] is None


def test_a_window_fetched_before_the_exception_record_is_fetched_again(tmp_path):
    layout = make_synthetic_site(tmp_path)
    cfg = load_site(SITE_ID, layout.sites_dir)
    fetch_site(cfg, layout)
    windows = _windows(layout)
    side_path = windows / f"{DATES[0]}.json"
    older = read_json(side_path)
    for key in ("has_input_data_exception", "has_exception_mask", "exception_summary"):
        del older[key]
    side_path.write_text(json.dumps(older), encoding="utf-8")
    before = _mtimes(windows)
    fetch_site(cfg, layout)
    after = _mtimes(windows)
    assert after[f"{DATES[0]}.tif"] > before[f"{DATES[0]}.tif"]
    assert after[f"{DATES[1]}.tif"] == before[f"{DATES[1]}.tif"]
    assert "has_input_data_exception" in read_json(side_path)


# Files with the exception layout of specification 1.5.0 (22 of one real site's 24 dates, 14 November 2026):
# a uint8 exception mask with no focus bits and no fill value, and the flag holding the code itself (2).

FLAGGED_1_5 = {**{k: v for k, v in FORMAT_1_5.items() if k != "convention"}, "exception_flag": 2}


def _site_1_5(root, *, common: dict | None = None, files: dict | None = None):
    return make_synthetic_site(root, convention="subswath", common={**FLAGGED_1_5, **(common or {})},
                               files=files, site=TWO_POLS)


def _warnings(out: str) -> list[str]:
    return [line for line in out.splitlines() if line.startswith("WARNING")]


def test_flagged_1_5_0_file_with_a_clean_window_says_so_and_claims_nothing_about_focus(tmp_path, capsys):
    # The defect seen on real data: a 1.5.0 mask has no focus bits, so "bit off" was read as "not fully
    # focused" and every pixel was reported 100 % not fully focused.
    layout = _site_1_5(tmp_path)
    cfg = load_site(SITE_ID, layout.sites_dir)
    fetch_site(cfg, layout)
    warnings = _warnings(capsys.readouterr().out)
    assert len(warnings) == len(DATES)
    side = read_json(_windows(layout) / f"{DATES[0]}.json")
    assert side["facts"]["spec_version"] == "1.5.0" and side["facts"]["input_data_exception_code"] == 2
    assert side["facts"]["grids"]["A"]["exception_focus_bits"] is False
    assert side["facts"]["grids"]["A"]["exception_fill"] is None
    (r0, r1), (c0, c1) = side["window"]["rows"], side["window"]["cols"]
    pixels = (r1 - r0) * (c1 - c0)
    s = side["exception_summary"]
    assert s["method"] == EXCEPTION_SUMMARY_METHOD and s["focus_bits"] is False and s["fill_value"] is None
    assert (s["pixels"], s["fill_pixels"], s["counted_pixels"]) == (pixels, 0, pixels)
    assert s["anomaly_pixels"] == 0 and s["anomaly_share"] == 0.0
    assert s["not_fully_focused_pixels"] is None and s["not_fully_focused_share"] is None
    assert s["values"] == [{"value": 0, "count": pixels}]
    line = warnings[0]
    assert (f"{DATES[0]} {side['granule']}: hasInputDataException reports code 2 (NISAR LSAR qFSP-H1 sample "
            f"slip) somewhere in the granule; inside this site's window 0 of {pixels} px carry an anomaly bit; "
            "this product version's exception mask carries no focus information") in line
    assert "No pixel was dropped" in line
    assert "not fully focused" not in line and "100.0%" not in line
    # Printed the same from the sidecar when fetch skips the window, raw code included.
    fetch_site(cfg, layout)
    assert _warnings(capsys.readouterr().out) == warnings


def test_flagged_1_5_0_file_reports_the_exact_count_of_sample_slip_pixels(tmp_path, capsys):
    marks = {(200, 200): 2, (200, 201): 2, (300, 300): 2, (450, 400): 2}  # inside the window and the swath
    layout = _site_1_5(tmp_path, common={"exceptions": marks})
    fetch_site(load_site(SITE_ID, layout.sites_dir), layout)
    line = _warnings(capsys.readouterr().out)[0]
    side = read_json(_windows(layout) / f"{DATES[0]}.json")
    (r0, r1), (c0, c1) = side["window"]["rows"], side["window"]["cols"]
    pixels = (r1 - r0) * (c1 - c0)
    s = side["exception_summary"]
    assert s["anomaly_pixels"] == len(marks) and s["anomaly_share"] == len(marks) / pixels
    assert s["not_fully_focused_pixels"] is None and s["not_fully_focused_share"] is None
    assert s["values"] == [{"value": 0, "count": pixels - len(marks)}, {"value": 2, "count": len(marks)}]
    assert re.search(rf"inside this site's window 4 of {pixels} px \(0\.\d+%\) carry an anomaly bit; this product "
                     "version's exception mask carries no focus information", line)
    assert "not fully focused" not in line


def test_fetch_redoes_only_the_windows_whose_exception_summary_is_from_the_old_method(tmp_path, capsys):
    # Two flagged dates and one clean one (no summary). The first date's sidecar is given the summary the
    # code wrote before 14 November 2026 (no method, focus numbers read from a mask that has none).
    layout = _site_1_5(tmp_path, files={DATES[2]: {"exception_flag": 0}})
    cfg = load_site(SITE_ID, layout.sites_dir)
    fetch_site(cfg, layout)
    windows = _windows(layout)
    assert read_json(windows / f"{DATES[2]}.json")["exception_summary"] is None
    side_path = windows / f"{DATES[0]}.json"
    old = read_json(side_path)
    summary = old["exception_summary"]
    for key in ("method", "focus_bits", "fill_value"):
        summary.pop(key, None)
    summary["not_fully_focused_pixels"] = {"HH": summary["pixels"], "HV": summary["pixels"]}
    summary["not_fully_focused_share"] = {"HH": 1.0, "HV": 1.0}
    side_path.write_text(json.dumps(old), encoding="utf-8")
    capsys.readouterr()
    before = _mtimes(windows)
    fetch_site(cfg, layout)
    after = _mtimes(windows)
    out = capsys.readouterr().out
    assert out.count("exists, skipped") == 2
    assert after[f"{DATES[0]}.tif"] > before[f"{DATES[0]}.tif"]  # redone
    for date in DATES[1:]:  # a current summary, and no summary at all: untouched
        for name in (f"{date}.tif", f"{date}.json", f"{date}_mask.tif"):
            assert after[name] == before[name], name
    redone = read_json(side_path)["exception_summary"]
    assert redone["method"] == EXCEPTION_SUMMARY_METHOD and redone["not_fully_focused_share"] is None
    assert "not fully focused" not in out


# The harvest analysis (pipeline/harvest.py, the analyse stage) and its layer, on a SYNTHETIC site with seven
# dates. Blocks of the synthetic grid play rice that is cut on known passes, ground that is not rice, and a
# uniform block as stable ground. None of it is a place.

H_DATES = ["2026-08-06", "2026-08-18", "2026-08-30", "2026-09-11", "2026-09-23", "2026-10-05", "2026-10-17"]
H_PASSES = H_DATES[2:]  # pairs: 08-30 -> 09-11 before the harvest, then three harvest pairs
H_REGIONS = {  # rows and columns [start, stop) of the synthetic grid (synth.py); the rest is ground, not rice
    "town": (80, 180, 80, 180),
    "hh pair 1, hv pair 2": (200, 300, 80, 240),
    "pair 2": (200, 300, 260, 420),
    "pair 3": (320, 420, 80, 240),
    "standing": (320, 420, 260, 420),
    "first pair": (440, 455, 80, 95),
}
H_CUT = {  # index in H_DATES of the first date on which the rice is cut, per polarization
    "hh pair 1, hv pair 2": {"HH": 4, "HV": 5}, "pair 2": {"HH": 5, "HV": 5}, "pair 3": {"HH": 6, "HV": 6},
    "standing": {}, "first pair": {"HH": 3, "HV": 3},
}
H_LEVELS = {"HH": {"ground": -10.0, "town": -6.0, "flood": (-22.0, -18.0), "canopy": -6.0, "cut": -13.0},
            "HV": {"ground": -17.0, "town": -12.0, "flood": (-25.0, -22.0), "canopy": -12.0, "cut": -19.0}}
H_EXPECTED = {"town": (6, 6), "hh pair 1, hv pair 2": (1, 2), "pair 2": (2, 2), "pair 3": (3, 3),
              "standing": (4, 4), "first pair": (5, 5)}  # class in HH, in HV
H_BOX = [round(v, 6) for v in SynthGrid().lonlat_box(90, 170, 90, 170)]  # inside the town block
H_BLOCK = {"cell_m": 100, "marker": "HH", "flood_dates": H_DATES[:2], "peak_dates": [H_DATES[2]],
           "passes": H_PASSES, "stable_boxes": [H_BOX]}


def _harvest_scene(j: int, pol: str, cuts: dict = H_CUT, town_swing_db: float = 0.0) -> np.ndarray:
    """Linear power of date H_DATES[j] in one polarization: the blocks at their levels, with 4-look speckle.
    With town_swing_db, the town's 200 m squares alternate, like a chessboard, between that much above and below
    its level, and swap on every date, so the town varies far more from pass to pass than standing rice."""
    lv = H_LEVELS[pol]
    db = np.full((600, 600), lv["ground"])
    r0, r1, c0, c1 = H_REGIONS["town"]
    db[r0:r1, c0:c1] = lv["town"]
    if town_swing_db:
        rows, cols = np.mgrid[r0:r1, c0:c1]
        db[r0:r1, c0:c1] += town_swing_db * np.where((rows // 10 + cols // 10 + j) % 2, 1.0, -1.0)
    for name, cut in cuts.items():
        r0, r1, c0, c1 = H_REGIONS[name]
        db[r0:r1, c0:c1] = (lv["flood"][j] if j < 2
                            else lv["cut"] if pol in cut and j >= cut[pol] else lv["canopy"])
    speckle = np.random.default_rng(1000 + 10 * j + (pol == "HV")).gamma(4, 1 / 4, size=db.shape)
    return (10 ** (db / 10) * speckle).astype(np.float32)


def _harvest_site(root, harvest: dict | None = None, scene=_harvest_scene) -> Layout:
    files = {d: {"power": {pol: scene(j, pol) for pol in ("HH", "HV")}} for j, d in enumerate(H_DATES)}
    return make_synthetic_site(root, common={"pols": ("HH", "HV")}, dates=H_DATES, files=files,
                               site={"polarizations": ["HH", "HV"], "working_resolution_m": 20, "change": None,
                                     "harvest": {**H_BLOCK, **(harvest or {})}})


@pytest.fixture(scope="module")
def harvest_run(tmp_path_factory) -> Layout:
    layout = _harvest_site(tmp_path_factory.mktemp("harvest"))
    assert run_site(load_site(SITE_ID, layout.sites_dir), layout) == 0
    return layout


def _copy_run(layout: Layout, root) -> Layout:
    """A copy of a finished run (site files, work and data folders, with their times), for tests that change it."""
    copy = Layout(sites_dir=root / "sites", work_dir=root / "work", data_dir=root / "data")
    for source, target in ((layout.sites_dir, copy.sites_dir), (layout.work_dir, copy.work_dir),
                           (layout.data_dir, copy.data_dir)):
        shutil.copytree(source, target)
    return copy


def _analysis(layout: Layout) -> Path:
    return layout.site_work(SITE_ID) / "analysis"


def _harvest_layer(layout: Layout) -> dict:
    return next(la for la in read_json(layout.site_data(SITE_ID) / "site.json")["layers"] if la["id"] == "harvest-wave")


def _cells_inside(transform: Affine, shape: tuple[int, int], region: tuple[int, int, int, int]) -> np.ndarray:
    """Cells whose whole pixel block lies inside a block of the synthetic grid (20 m pixels from 400000, 3857000)."""
    rows, cols = np.mgrid[0:shape[0], 0:shape[1]]
    x0, y0 = transform @ (cols, rows)
    px0, py0 = (x0 - 400000.0) / 20.0, (3857000.0 - y0) / 20.0
    side = transform.a / 20.0
    r0, r1, c0, c1 = region
    return (py0 >= r0) & (py0 + side <= r1) & (px0 >= c0) & (px0 + side <= c1)


def _all_levels(path: Path) -> list[np.ndarray]:
    with rasterio.open(path) as src:
        levels, n = [src.read()], len(src.overviews(1))
    for level in range(n):
        with rasterio.open(path, overview_level=level) as src:
            levels.append(src.read())
    return levels


def test_harvest_site_runs_end_to_end_and_validates(harvest_run):
    layout = harvest_run
    assert validate(layout.data_dir) == []
    assert (layout.site_data(SITE_ID) / "harvest-wave.tif").is_file()
    doc = read_json(_analysis(layout) / HARVEST_FILE)
    assert doc["settings"] == {"cell_m": 100.0, "marker": "HH", "flood_dates": H_DATES[:2],
                               "peak_dates": [H_DATES[2]], "passes": H_PASSES, "false_alarm": 0.02,
                               "rice_rise_db": "auto", "stable_boxes": [H_BOX], "stable_boxes_from": "stable_boxes"}
    assert doc["pairs"] == [[a, b] for a, b in zip(H_PASSES, H_PASSES[1:], strict=False)]
    assert doc["grid"]["crs"] == "EPSG:32611" and doc["grid"]["pixels_per_cell_side"] == 5
    assert doc["rice"]["threshold_source"] == "otsu" and 3.0 < doc["rice"]["threshold_db"] < 13.0
    assert doc["cells"]["cell_area_km2"] == pytest.approx(0.01)
    assert doc["rice"]["area_km2"] == pytest.approx(doc["rice"]["cells"] * 0.01)
    assert doc["stable"]["cells"] == doc["stable"]["cells_in_boxes"] == 16 * 16
    assert doc["stable_boxes"] == [{"bbox": H_BOX, "where": "inside the window"}]
    for pol in ("HH", "HV"):
        t = doc["polarizations"][pol]["threshold"]
        assert t["threshold_db"] < 0 and max(t["stable_share_below_by_pair"]) <= 0.02
        assert t["rice_share_below_by_pair"][0] <= 0.02 and t["stable_cells"] == 256
    assert doc["inputs"]["dates"] == H_DATES and doc["method"].startswith("Cells: mean of linear")


def test_harvest_classes_on_the_product_grid(harvest_run):
    classes, info = read_geotiff(_analysis(harvest_run) / HARVEST_RASTER)
    assert classes.dtype == np.uint8 and info["descriptions"] == ["HH", "HV"] and info["nodata"] == 0
    assert info["transform"].a == 100.0 and info["crs"] == "EPSG:32611"
    for name, expected in H_EXPECTED.items():
        inside = _cells_inside(info["transform"], info["shape"], H_REGIONS[name])
        assert inside.sum() >= 4, name
        for band, want in zip(classes, expected, strict=True):
            # About 2 % of unchanged cells cross the threshold in a pair by design; the blocks must be clear.
            assert (band[inside] == want).mean() >= 0.9, (name, want)
    assert (classes[:, :, -6:] == 0).all()  # the columns outside the swath: no data


def test_harvest_analysis_covers_only_the_site_box(harvest_run):
    # The processed window is the UTM rectangle around the site box. Cells whose centres lie outside the box
    # have no class, so the rice area and the series describe the same ground as the fire bars.
    classes, info = read_geotiff(_analysis(harvest_run) / HARVEST_RASTER)
    bbox = tuple(load_site(SITE_ID, harvest_run.sites_dir).bbox)
    region, _ = target_pixels(bbox, info["crs"], info["transform"], info["shape"])
    assert 0 < region.sum() < region.size
    assert (classes[:, ~region] == 0).all()
    doc = read_json(_analysis(harvest_run) / HARVEST_FILE)
    assert doc["cells"]["in_site_box"] == int(region.sum()) and doc["cells"]["total"] == region.size
    for b, pol in enumerate(("HH", "HV")):
        counts = doc["polarizations"][pol]["classes"]
        assert counts["not_rice_cells"] == int(((classes[b] == 6) & region).sum()) > 0
        assert doc["polarizations"][pol]["cumulative"]["counted_cells"] == int(
            (region & (classes[b] >= 1) & (classes[b] <= 5)).sum())
    series = read_json(harvest_run.site_data(SITE_ID) / "stats.json")["series"]
    assert all("whose centres lie inside the site box" in s["region"] for s in series if s["id"].startswith("harvest"))


def test_harvest_layer_classes_texts_and_series(harvest_run):
    layer = _harvest_layer(harvest_run)
    assert (layer["kind"], layer["unit"], layer["polarization"], layer["title"]) == ("static", "", "HH", "Harvest wave")
    assert layer["encoding"] == {"type": "categorical-uint8", "nodata": 0, "classes": [
        {"value": 1, "label": "Harvested between 11 September and 23 September 2026", "color": "#440154"},
        {"value": 2, "label": "Harvested between 23 September and 5 October 2026", "color": "#3b528b"},
        {"value": 3, "label": "Harvested between 5 October and 17 October 2026", "color": "#21918c"},
        {"value": 4, "label": "Rice, no harvest seen by 17 October 2026", "color": "#fde725"},
        {"value": 5, "label": "Fell before 11 September 2026", "color": "#b8a3d8"},
        {"value": 6, "label": "Not rice", "color": "#d9d9d9"}]}
    assert layer["description"].startswith("For each 100 m rice cell, the pair of radar passes in which its HH "
                                           "backscatter first fell sharply")
    doc = read_json(_analysis(harvest_run) / HARVEST_FILE)
    threshold = doc["polarizations"]["HH"]["threshold"]["threshold_db"]
    assert f"fell by more than {abs(threshold):.2f} dB" in layer["method"] and "from HH" in layer["method"]
    assert len(layer["items"]) == 1 and "date" not in layer["items"][0]

    series = {s["id"]: s for s in read_json(harvest_run.site_data(SITE_ID) / "stats.json")["series"]}
    hh, hv = series["harvest-share-hh"], series["harvest-share-hv"]
    for s in (hh, hv):
        assert s["unit"] == "%" and s["layer"] == "harvest-wave"
        assert [p["date"] for p in s["points"]] == H_PASSES[2:]
        assert len({p["n"] for p in s["points"]}) == 1  # the same cells for every point
        assert "km2" in s["region"] and "False alarms" in s["method"] and "quantile" in s["method"]
    # The four big rice blocks are the same size: a quarter of the rice each.
    assert [p["value"] for p in hh["points"]] == pytest.approx([25.0, 50.0, 75.0], abs=6.0)
    assert [p["value"] for p in hv["points"]] == pytest.approx([0.0, 50.0, 75.0], abs=6.0)
    assert "defines the harvest map" in hh["title"] and "HH defines the map" in hv["title"]


def test_harvest_wave_raster_holds_only_classes_at_every_level(harvest_run):
    path = harvest_run.site_data(SITE_ID) / "harvest-wave.tif"
    site = read_json(harvest_run.site_data(SITE_ID) / "site.json")
    assert check_raster(path, bounds=tuple(site["bounds"])) == []
    allowed = {0} | {c["value"] for c in _harvest_layer(harvest_run)["encoding"]["classes"]}
    levels = _all_levels(path)
    assert len(levels) >= 2
    for data in levels:
        assert set(np.unique(data).tolist()) <= allowed
    # The classes sit where the blocks are: a nearest-neighbour warp keeps each cell's class in place.
    to_web = Transformer.from_crs("EPSG:32611", "EPSG:3857", always_xy=True)
    with rasterio.open(path) as src:
        full = src.read(1)
        for name, (want, _) in H_EXPECTED.items():
            if name == "first pair":
                continue  # too small for the pixels around its centre to be safe from the cells around it
            r0, r1, c0, c1 = H_REGIONS[name]
            x, y = to_web.transform(400000.0 + 20.0 * (c0 + c1) / 2, 3857000.0 - 20.0 * (r0 + r1) / 2)
            row, col = src.index(x, y)
            assert (full[row - 2:row + 3, col - 2:col + 3] == want).mean() >= 0.6, name


def test_harvest_wave_is_a_nearest_warp_of_the_class_raster(harvest_run):
    # The full resolution of the layer is exactly a nearest-neighbour reprojection of the marker's band of the
    # class raster. A bilinear or averaging warp would put classes where no cell has them, and with the class
    # values 1 to 6 every such average is again a listed class, so only this comparison shows it.
    classes, info = read_geotiff(_analysis(harvest_run) / HARVEST_RASTER)
    with rasterio.open(harvest_run.site_data(SITE_ID) / "harvest-wave.tif") as src:
        full, transform, crs = src.read(1), src.transform, src.crs
    expected = np.zeros_like(full)
    reproject(source=classes[info["descriptions"].index("HH")], destination=expected, src_transform=info["transform"],
              src_crs=info["crs"], src_nodata=0, dst_transform=transform, dst_crs=crs, dst_nodata=0,
              resampling=Resampling.nearest)
    assert (expected != 0).sum() > 10000
    assert np.array_equal(full, expected)


def test_validate_rejects_averaged_overviews_even_when_every_average_is_a_class(harvest_run, tmp_path):
    from pipeline.export import WebGrid

    assert [c["value"] for c in _harvest_layer(harvest_run)["encoding"]["classes"]] == [1, 2, 3, 4, 5, 6]
    data = tmp_path / "data"
    shutil.copytree(harvest_run.data_dir, data)
    path = data / SITE_ID / "harvest-wave.tif"
    with rasterio.open(path) as src:
        codes, tags, transform = src.read(1), src.tags(), src.transform
    grid = WebGrid(zoom=0, transform=transform, width=codes.shape[1], height=codes.shape[0])
    write_cog(path, codes, grid, 256, ["harvest"], tags, overview_resampling="average")
    errors = validate(data)
    assert errors and all(e.startswith("rule 10:") and "harvest-wave" in e and "as when classes are averaged" in e
                          for e in errors), errors


def test_validate_rejects_a_value_missing_from_the_classes(harvest_run, tmp_path):
    from pipeline.export import WebGrid

    data = tmp_path / "data"
    shutil.copytree(harvest_run.data_dir, data)
    path = data / SITE_ID / "harvest-wave.tif"
    with rasterio.open(path) as src:
        codes, tags, transform = src.read(1), src.tags(), src.transform
    codes[codes == 6] = 200  # a value the layer's classes do not list
    grid = WebGrid(zoom=0, transform=transform, width=codes.shape[1], height=codes.shape[0])
    write_cog(path, codes, grid, 256, ["harvest"], tags, overview_resampling="nearest")
    errors = validate(data)
    assert any(e.startswith("rule 10:") and "harvest-wave" in e and "200 (first seen at full resolution)" in e
               for e in errors), errors
    assert all(e.startswith("rule 10:") for e in errors)  # the file passes every other check


def test_analyse_follows_the_rerun_rule(harvest_run, tmp_path, capsys):
    layout = _copy_run(harvest_run, tmp_path)
    out, raster = _analysis(layout) / HARVEST_FILE, _analysis(layout) / HARVEST_RASTER
    cog = layout.site_data(SITE_ID) / "harvest-wave.tif"
    before = {p: p.stat().st_mtime_ns for p in (out, raster, cog)}
    first = read_json(out)
    capsys.readouterr()
    assert analyse_site(load_site(SITE_ID, layout.sites_dir), layout) == first
    printed = capsys.readouterr().out
    assert "analyse: exists, skipped" in printed and "HH threshold" in printed  # the result is printed again
    assert all(p.stat().st_mtime_ns == t for p, t in before.items())

    _edit_site(layout, harvest={**H_BLOCK, "false_alarm": 0.05})  # a changed setting redoes the analysis
    cfg = load_site(SITE_ID, layout.sites_dir)
    doc = analyse_site(cfg, layout)
    assert doc["settings"]["false_alarm"] == 0.05 == read_json(out)["inputs"]["settings"]["false_alarm"]
    assert out.stat().st_mtime_ns > before[out] and raster.stat().st_mtime_ns > before[raster]
    others = {p: p.stat().st_mtime_ns for p in layout.site_data(SITE_ID).glob("hh_*.tif")}
    export_site(cfg, layout)  # the layer is redone from the new analysis; the other layers are not
    assert cog.stat().st_mtime_ns > before[cog]
    assert all(p.stat().st_mtime_ns == t for p, t in others.items())

    made = out.stat().st_mtime_ns
    analyse_site(cfg, layout, force=True)
    assert out.stat().st_mtime_ns > made
    made = out.stat().st_mtime_ns
    proc = layout.site_work(SITE_ID) / "proc" / f"{H_PASSES[1]}.tif"
    later = made + 10_000_000_000  # a processed raster made again after the analysis
    os.utime(proc, ns=(later, later))
    analyse_site(cfg, layout)
    assert out.stat().st_mtime_ns > made


def test_dates_on_different_grids_stop_analyse(harvest_run, tmp_path):
    # analyse checks the grid itself: it may run long after process, on rasters made again since.
    layout = _copy_run(harvest_run, tmp_path)
    proc_file = layout.site_work(SITE_ID) / "proc" / f"{H_PASSES[1]}.tif"
    data, info = read_geotiff(proc_file)
    write_geotiff(proc_file, data, info["crs"], info["transform"] @ Affine.translation(0.25, 0), np.nan,
                  descriptions=info["descriptions"], tags=info["tags"])
    with pytest.raises(GridMismatchError):
        analyse_site(load_site(SITE_ID, layout.sites_dir), layout)


def test_a_class_raster_made_from_other_inputs_is_made_again(harvest_run, tmp_path, capsys):
    # harvest.json is current, but the class raster beside it records other settings (as after a run that was
    # cut off between the two files): the analysis is made again, not reused.
    layout = _copy_run(harvest_run, tmp_path)
    raster = _analysis(layout) / HARVEST_RASTER
    data, info = read_geotiff(raster)
    record = info["tags"][INPUTS_TAG]
    other = json.loads(record)
    other["settings"]["false_alarm"] = 0.05
    write_geotiff(raster, data, info["crs"], info["transform"], info["nodata"], descriptions=info["descriptions"],
                  tags={INPUTS_TAG: json.dumps(other, sort_keys=True, separators=(",", ":"))})
    capsys.readouterr()
    analyse_site(load_site(SITE_ID, layout.sites_dir), layout)
    assert "analyse: exists, skipped" not in capsys.readouterr().out
    assert read_geotiff(raster)[1]["tags"][INPUTS_TAG] == record


def _scene_without_fell_before(j: int, pol: str) -> np.ndarray:
    """No rice block falls in the first pair, and the town swings by 2 dB from pass to pass, so the threshold
    is set by the town, well below any change of standing rice: no rice cell falls in the first pair."""
    return _harvest_scene(j, pol, cuts={k: v for k, v in H_CUT.items() if k != "first pair"}, town_swing_db=2.0)


@pytest.fixture(scope="module")
def harvest_run_without_fell_before(tmp_path_factory) -> Layout:
    layout = _harvest_site(tmp_path_factory.mktemp("harvest-no-fell-before"), scene=_scene_without_fell_before)
    assert run_site(load_site(SITE_ID, layout.sites_dir), layout) == 0
    return layout


def test_fell_before_is_listed_only_when_a_cell_has_it(harvest_run_without_fell_before, tmp_path):
    layout = harvest_run_without_fell_before
    assert validate(layout.data_dir) == []
    doc = read_json(_analysis(layout) / HARVEST_FILE)
    hh = doc["polarizations"]["HH"]
    assert hh["threshold"]["used"] == "stable" and hh["classes"]["fell_before_cells"] == 0
    assert hh["classes"]["no_harvest_cells"] > 0 and all(n > 0 for n in hh["classes"]["harvest_pair_cells"])
    layer = _harvest_layer(layout)
    assert [c["value"] for c in layer["encoding"]["classes"]] == [1, 2, 3, 4, 6]  # 5 stays reserved, unlisted
    path = layout.site_data(SITE_ID) / "harvest-wave.tif"
    assert all(5 not in np.unique(level) for level in _all_levels(path))
    # With the gap at 5, an overview that averaged "no harvest seen" (4) and "not rice" (6) would show 5.
    from pipeline.export import WebGrid

    data = tmp_path / "data"
    shutil.copytree(layout.data_dir, data)
    copy = data / SITE_ID / "harvest-wave.tif"
    with rasterio.open(copy) as src:
        codes, tags, transform = src.read(1), src.tags(), src.transform
    grid = WebGrid(zoom=0, transform=transform, width=codes.shape[1], height=codes.shape[0])
    write_cog(copy, codes, grid, 256, ["harvest"], tags, overview_resampling="average")
    errors = validate(data)
    assert any(e.startswith("rule 10:") and "5 (first seen at overview 1)" in e for e in errors), errors


def test_marker_hv_changes_the_map(harvest_run, tmp_path):
    layout = _copy_run(harvest_run, tmp_path)
    _edit_site(layout, harvest={**H_BLOCK, "marker": "HV"})
    cfg = load_site(SITE_ID, layout.sites_dir)
    analyse_site(cfg, layout)
    export_site(cfg, layout)
    layer = _harvest_layer(layout)
    assert layer["polarization"] == "HV" and "from HV" in layer["method"]
    hh_map = _all_levels(harvest_run.site_data(SITE_ID) / "harvest-wave.tif")[0][0]
    hv_map = _all_levels(layout.site_data(SITE_ID) / "harvest-wave.tif")[0][0]
    early = int((hh_map == 1).sum())
    assert early > 100 and ((hv_map == 2) & (hh_map == 1)).sum() > 0.85 * early  # HV sees that rice a pair later
    manifest_stage(layout)
    assert validate_stage(layout) == 0


def test_export_refuses_an_analysis_made_with_other_settings(harvest_run, tmp_path):
    layout = _copy_run(harvest_run, tmp_path)
    _edit_site(layout, harvest={**H_BLOCK, "cell_m": 200})
    with pytest.raises(FileNotFoundError, match="harvest analysis .* run .*analyse --site synthetic-test"):
        export_site(load_site(SITE_ID, layout.sites_dir), layout)


def test_removing_the_harvest_block_removes_its_outputs(harvest_run, tmp_path, capsys):
    layout = _copy_run(harvest_run, tmp_path)
    path = layout.sites_dir / f"{SITE_ID}.yaml"
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    del data["harvest"]
    path.write_text(yaml.safe_dump(data, sort_keys=False), encoding="utf-8")
    cfg = load_site(SITE_ID, layout.sites_dir)
    capsys.readouterr()
    assert analyse_site(cfg, layout) is None
    assert "removed the old harvest.json, harvest_classes.tif" in capsys.readouterr().out
    assert not any(_analysis(layout).iterdir())
    export_site(cfg, layout)
    assert not (layout.site_data(SITE_ID) / "harvest-wave.tif").exists()
    series = read_json(layout.site_data(SITE_ID) / "stats.json")["series"]
    assert [s["id"] for s in series] == ["hh-mean", "hv-mean"]
    manifest_stage(layout)
    assert validate_stage(layout) == 0


def test_a_harvest_date_that_is_not_a_site_date_stops_the_run_at_once(tmp_path):
    layout = _harvest_site(tmp_path, harvest={"flood_dates": [H_DATES[0], "2026-08-19"]})
    with pytest.raises(ConfigError, match=r"field 'harvest\.flood_dates': 2026-08-19 is not among the dates of "
                                          r"the granule list"):
        run_site(load_site(SITE_ID, layout.sites_dir), layout)
    assert not layout.site_work(SITE_ID).exists()  # stopped before fetch

"""Warping to Web Mercator and writing COGs."""

from __future__ import annotations

import numpy as np
import pytest
import rasterio
from affine import Affine
from rasterio.io import MemoryFile
from rasterio.warp import Resampling, transform_bounds

from pipeline.export import (
    HALF_WORLD,
    TILE_PX,
    check_raster,
    choose_zoom,
    ground_pixel_m,
    overview_levels,
    resampling_for,
    warp_linear,
    web_grid,
    write_cog,
)
from pipeline.rasters import write_geotiff, write_json

BBOX = (-118.05, 34.75, -117.95, 34.85)


def test_zoom_choice_uses_ground_size_at_the_latitude():
    assert ground_pixel_m(12, 0) == pytest.approx(38.2185, abs=1e-3)
    assert ground_pixel_m(12, 60) == pytest.approx(19.109, abs=1e-3)
    assert choose_zoom(40, 34.8) == 12  # 31.4 m beats 62.8 m
    assert choose_zoom(40, 0) == 12
    assert choose_zoom(40, 65) == 11  # 32.3 m at z11 is closer than 16.2 m at z12


def test_web_grid_starts_on_a_tile_corner_and_covers_the_bbox():
    grid = web_grid(BBOX, 12)
    tile_m = grid.transform.a * TILE_PX
    assert ((grid.transform.c + HALF_WORLD) / tile_m) == pytest.approx(round((grid.transform.c + HALF_WORLD) / tile_m))
    assert ((HALF_WORLD - grid.transform.f) / tile_m) == pytest.approx(round((HALF_WORLD - grid.transform.f) / tile_m))
    left, top = grid.transform.c, grid.transform.f
    right, bottom = left + grid.width * grid.transform.a, top + grid.height * grid.transform.e
    minx, miny, maxx, maxy = transform_bounds("EPSG:4326", "EPSG:3857", *BBOX)
    assert left <= minx and right >= maxx and bottom <= miny and top >= maxy


def test_resampling_averages_only_when_coarsening():
    lat = 34.8
    assert resampling_for(40, web_grid(BBOX, 12), lat) == Resampling.bilinear  # 31 m target: finer
    assert resampling_for(40, web_grid(BBOX, 10), lat) == Resampling.average  # 125 m target: coarser


def test_warp_keeps_power_linear_and_gaps_empty():
    # Two halves: 0.01 and 1.0 linear power, a NaN hole in the middle. UTM 11N, 40 m pixels.
    power = np.full((200, 200), 0.01, dtype=np.float32)
    power[:, 100:] = 1.0
    power[90:110, 40:60] = np.nan
    t = Affine(40, 0, 400000, 0, -40, 3857000)
    bbox = transform_bounds("EPSG:32611", "EPSG:4326", 400000, 3857000 - 8000, 408000, 3857000)
    coarse = warp_linear(power, t, "EPSG:32611", web_grid(bbox, 10), Resampling.average)
    values = coarse[np.isfinite(coarse)]
    # Averaging linear power: a pixel straddling the two halves lies between 0.01 and 1.0, never below
    # 0.01 (which averaging dB and NaN-as-zero would both produce).
    assert values.min() >= 0.01 - 1e-6 and values.max() <= 1.0 + 1e-6
    fine = warp_linear(power, t, "EPSG:32611", web_grid(bbox, 13), Resampling.bilinear)
    assert np.isnan(fine).any() and np.isfinite(fine).any()
    assert np.nanmin(fine) >= 0.01 - 1e-6


def test_cog_properties_and_exact_base_level(tmp_path):
    grid = web_grid(BBOX, 13)
    rng = np.random.default_rng(1)
    codes = rng.integers(1, 256, size=grid.shape, dtype=np.uint8)
    codes[:20, :] = 0  # some nodata
    path = tmp_path / "layer.tif"
    size = write_cog(path, codes, grid, 256, ["HH 2026-06-07"], {"SOURCE_GRANULES": "SYNTHETIC", "AI_ASSISTED": "true"})
    assert size == path.stat().st_size > 0
    assert check_raster(path, bounds=BBOX) == []
    with rasterio.open(path) as src:
        assert src.crs.to_epsg() == 3857
        assert src.dtypes == ("uint8",)
        assert src.nodata == 0
        assert src.overviews(1)
        assert src.block_shapes == [(256, 256)]
        assert src.tags(ns="IMAGE_STRUCTURE").get("COMPRESSION") == "DEFLATE"
        assert src.tags(ns="IMAGE_STRUCTURE").get("PREDICTOR") == "2"
        assert src.tags()["AI_ASSISTED"] == "true"
        assert src.descriptions == ("HH 2026-06-07",)
        assert src.transform == grid.transform
        assert (src.read(1) == codes).all()  # the base level is exactly what was encoded


def test_small_file_still_gets_an_overview():
    assert overview_levels(100, 80, 128) == 1
    assert overview_levels(1000, 300, 256) == 2


def test_check_raster_catches_a_bad_file(tmp_path):
    path = tmp_path / "plain.tif"
    with rasterio.open(path, "w", driver="GTiff", width=64, height=64, count=1, dtype="float32",
                       crs="EPSG:4326", transform=Affine(0.001, 0, 0, 0, -0.001, 0)) as dst:
        dst.write(np.ones((1, 64, 64), dtype=np.float32))
    problems = " ".join(check_raster(path, bounds=BBOX))
    for expected in ("EPSG:3857", "uint8", "nodata", "overviews", "DEFLATE", "does not overlap"):
        assert expected in problems


@pytest.mark.parametrize("dates", [3, 4, 5])
def test_stack_with_several_dates_stays_grey_and_keeps_every_band(tmp_path, dates):
    # GDAL tags a 3-band file as RGB and a 4-band file as RGBA unless told otherwise. A reader then
    # treats date 4 as transparency and blanks every date wherever date 4 has no data.
    grid = web_grid(BBOX, 11)
    rng = np.random.default_rng(dates)
    codes = rng.integers(1, 256, size=(dates, *grid.shape), dtype=np.uint8)
    codes[-1, 10:30, 10:30] = 0  # the last date has a hole; the other dates have data there
    path = tmp_path / "stack.tif"
    write_cog(path, codes, grid, 128, [f"2026-07-{d + 1:02d}" for d in range(dates)], {"AI_ASSISTED": "true"})
    assert check_raster(path, bounds=BBOX) == []
    with rasterio.open(path) as src:
        assert src.count == dates
        assert {ci.name for ci in src.colorinterp} <= {"gray", "undefined"}
        assert src.interleaving.name == "pixel"  # one tile request returns every date of a pixel
        assert (src.read() == codes).all()
        assert (src.read()[:-1, 10:30, 10:30] != 0).all()  # earlier dates survive inside the hole


def test_check_raster_flags_scale_tags_and_colour_bands(tmp_path):
    grid = web_grid(BBOX, 11)
    common = dict(driver="GTiff", width=grid.width, height=grid.height, dtype="uint8", crs="EPSG:3857",
                  transform=grid.transform, nodata=0)
    ones = np.ones(grid.shape, dtype=np.uint8)

    scaled = tmp_path / "scaled.tif"
    with rasterio.open(scaled, "w", count=1, **common) as dst:
        dst.write(ones, 1)
        dst.scales = (0.157,)
        dst.offsets = (-35.0,)
    assert "scale/offset" in " ".join(check_raster(scaled))

    rgba = tmp_path / "rgba.tif"
    with rasterio.open(rgba, "w", count=4, photometric="RGB", alpha="YES", **common) as dst:
        dst.write(np.stack([ones] * 4))
    assert "colour/alpha" in " ".join(check_raster(rgba))


def test_check_raster_rejects_a_cog_that_is_not_deflate(tmp_path):
    from rio_cogeo.cogeo import cog_translate
    from rio_cogeo.profiles import cog_profiles

    grid = web_grid(BBOX, 13)
    codes = np.random.default_rng(2).integers(1, 256, size=(1, *grid.shape), dtype=np.uint8)
    path = tmp_path / "lzw.tif"
    with MemoryFile() as mem:
        with mem.open(driver="GTiff", dtype="uint8", count=1, height=grid.height, width=grid.width,
                      crs="EPSG:3857", transform=grid.transform, nodata=0, photometric="MINISBLACK") as dst:
            dst.write(codes)
        with mem.open() as src:
            cog_translate(src, str(path), cog_profiles.get("lzw"), nodata=0, overview_level=1, quiet=True)
    assert check_raster(path, bounds=BBOX) == [f"{path.name}: compression is LZW, must be DEFLATE (lossless)"]


@pytest.mark.parametrize("writer", ["json", "geotiff", "cog"])
def test_a_failed_replace_leaves_no_temporary_file(tmp_path, monkeypatch, writer):
    def locked(src, dst):
        raise PermissionError("the destination is open in another program")
    monkeypatch.setattr("os.replace", locked)
    grid = web_grid(BBOX, 11)
    with pytest.raises(PermissionError):
        if writer == "json":
            write_json(tmp_path / "x.json", {"a": 1})
        elif writer == "geotiff":
            write_geotiff(tmp_path / "x.tif", np.ones((4, 4), np.float32), "EPSG:3857", grid.transform, np.nan)
        else:
            write_cog(tmp_path / "x.tif", np.ones(grid.shape, np.uint8), grid, 256, ["x"], {})
    assert list(tmp_path.iterdir()) == []

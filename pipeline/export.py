"""Write web-ready rasters: 8-bit Cloud-Optimized GeoTIFFs in Web Mercator (EPSG:3857).

Order of operations (docs/ARCHITECTURE.md, "Writing web-ready rasters"):
  1. warp LINEAR power onto the web map's tile grid (averaging power, never dB),
  2. convert to dB, 3. encode to uint8 codes, 4. package as a COG.
The grid is the WebMercatorQuad tile grid at one zoom level, with the raster's top-left corner on a
tile corner, so each 256 px internal tile of the file is exactly one map tile.
"""

from __future__ import annotations

import math
import os
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import rasterio
from affine import Affine
from rasterio.io import MemoryFile
from rasterio.warp import Resampling, reproject, transform_bounds
from rio_cogeo.cogeo import cog_translate, cog_validate
from rio_cogeo.profiles import cog_profiles

from pipeline.encode import NODATA
from pipeline.rasters import discard_temp, temp_path

WEB_MERCATOR = "EPSG:3857"
EARTH_RADIUS = 6378137.0  # the sphere Web Mercator is defined on
HALF_WORLD = math.pi * EARTH_RADIUS  # 20037508.34 m: x and y of the grid's outer edge
TILE_PX = 256
DISPLAY_BLOCK = 256
STACK_BLOCK = 128
MAX_FILE_BYTES = 100 * 1024 * 1024  # GitHub Pages refuses files of 100 MiB or more


def mercator_pixel_m(zoom: int) -> float:
    """Size of one pixel in Web Mercator metres at a zoom level (256 px tiles)."""
    return 2 * HALF_WORLD / (TILE_PX * 2**zoom)


def ground_pixel_m(zoom: int, lat: float) -> float:
    """Real ground size of one pixel at a latitude. Mercator stretches distances by 1/cos(lat), so a
    zoom-12 pixel is 38 m in map units but only 31 m on the ground at 35 degrees north."""
    return mercator_pixel_m(zoom) * math.cos(math.radians(lat))


def choose_zoom(working_resolution_m: float, lat: float) -> int:
    """The zoom whose ground pixel size at this latitude is closest to the working resolution."""
    return min(range(0, 23), key=lambda z: abs(ground_pixel_m(z, lat) - working_resolution_m))


@dataclass(frozen=True)
class WebGrid:
    zoom: int
    transform: Affine
    width: int
    height: int

    @property
    def shape(self) -> tuple[int, int]:
        return self.height, self.width


def web_grid(bbox: tuple[float, float, float, float], zoom: int) -> WebGrid:
    """The pixels of the web tile grid at `zoom` that cover a lon/lat bbox, starting on a tile corner."""
    minx, miny, maxx, maxy = transform_bounds("EPSG:4326", WEB_MERCATOR, *bbox, densify_pts=21)
    res = mercator_pixel_m(zoom)
    tile_m = res * TILE_PX
    x0 = -HALF_WORLD + math.floor((minx + HALF_WORLD) / tile_m) * tile_m
    y0 = HALF_WORLD - math.floor((HALF_WORLD - maxy) / tile_m) * tile_m
    width = math.ceil((maxx - x0) / res)
    height = math.ceil((y0 - miny) / res)
    return WebGrid(zoom, Affine(res, 0.0, x0, 0.0, -res, y0), width, height)


def resampling_for(source_ground_m: float, grid: WebGrid, lat: float) -> Resampling:
    """Average when the target pixels are coarser than the source (many source pixels per target), so
    every source pixel counts; bilinear when they are finer or about the same."""
    return Resampling.average if ground_pixel_m(grid.zoom, lat) > source_ground_m * 1.01 else Resampling.bilinear


def warp_linear(power: np.ndarray, src_transform: Affine, src_crs: str, grid: WebGrid,
                resampling: Resampling) -> np.ndarray:
    """Reproject linear power onto the web grid. NaN is no data on both sides, so gaps stay gaps and
    are not averaged in as zeros."""
    out = np.full(grid.shape, np.nan, dtype=np.float32)
    reproject(source=np.ascontiguousarray(power, dtype=np.float32), destination=out,
              src_transform=src_transform, src_crs=src_crs, src_nodata=np.nan,
              dst_transform=grid.transform, dst_crs=WEB_MERCATOR, dst_nodata=np.nan,
              resampling=resampling)
    return out


def warp_classes(codes: np.ndarray, src_transform: Affine, src_crs: str, grid: WebGrid) -> np.ndarray:
    """Reproject a class raster (uint8 class values, 0 = no data) onto the web grid by NEAREST neighbour, so
    every output pixel holds a value that was in the input: a class is never averaged into another."""
    out = np.zeros(grid.shape, dtype=np.uint8)
    reproject(source=np.ascontiguousarray(codes, dtype=np.uint8), destination=out,
              src_transform=src_transform, src_crs=src_crs, src_nodata=NODATA,
              dst_transform=grid.transform, dst_crs=WEB_MERCATOR, dst_nodata=NODATA,
              resampling=Resampling.nearest)
    return out


def overview_levels(width: int, height: int, block: int) -> int:
    """Halve until the image fits in one block, but always at least one overview: the data contract
    requires overviews in every file, even a small one."""
    levels, size = 0, max(width, height)
    while size > block:
        size = math.ceil(size / 2)
        levels += 1
    return max(levels, 1)


def write_cog(path: Path, codes: np.ndarray, grid: WebGrid, block: int,
              descriptions: list[str], tags: dict[str, str], overview_resampling: str = "average") -> int:
    """Package uint8 codes, already on the web grid, as a COG. Returns the file size in bytes.

    The pixels are written as they are (no second warp), so the full-resolution level of the file is
    exactly the array given here. Overviews average the codes and skip nodata 0; they are for display
    only, the numbers the app reports come from full-resolution data and stats.json. A categorical layer
    passes overview_resampling="nearest": each overview pixel is then one of the pixels below it, so it
    always holds a class and never an average of two.
    """
    if overview_resampling not in ("average", "nearest"):
        raise ValueError(f"overview_resampling must be 'average' or 'nearest', got {overview_resampling!r}")
    data = codes[np.newaxis] if codes.ndim == 2 else codes
    if data.dtype != np.uint8:
        raise TypeError(f"COG data must be uint8 codes, got {data.dtype}")
    profile = cog_profiles.get("deflate")
    profile.update(blockxsize=block, blockysize=block, predictor=2)
    # photometric="MINISBLACK" (plain grey bands) must be set on the SOURCE raster. Without it GDAL tags
    # a 3-band file as RGB and a 4-band file as RGBA; a browser reader then treats the fourth date as an
    # alpha channel and blanks every date wherever that one has no data. Setting it only in the COG
    # profile does not help: the interpretation is copied from the source.
    src_profile = dict(driver="GTiff", dtype="uint8", count=data.shape[0], height=data.shape[1],
                       width=data.shape[2], crs=WEB_MERCATOR, transform=grid.transform, nodata=NODATA,
                       photometric="MINISBLACK")
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = temp_path(path)
    try:
        with MemoryFile() as mem:
            with mem.open(**src_profile) as staging:
                staging.write(data)
                for i, text in enumerate(descriptions, start=1):
                    staging.set_band_description(i, text)
            with mem.open() as src:
                cog_translate(src, str(tmp), profile, nodata=NODATA,
                              overview_level=overview_levels(grid.width, grid.height, block),
                              overview_resampling=overview_resampling, in_memory=True, quiet=True,
                              allow_intermediate_compression=True,
                              additional_cog_metadata=tags,
                              config={"GDAL_TIFF_OVR_BLOCKSIZE": str(block)})
        os.replace(tmp, path)
    finally:
        discard_temp(tmp)
    return path.stat().st_size


def check_raster(path: Path, bounds: tuple[float, float, float, float] | None = None) -> list[str]:
    """Problems that make a raster unfit for the web app (data contract, "Every raster file").

    Empty list = fine. With `bounds` (lon/lat), also checks that the file overlaps them.
    """
    if not path.is_file():
        return [f"{path.name}: file does not exist"]
    problems = []
    if path.stat().st_size >= MAX_FILE_BYTES:
        problems.append(f"{path.name}: {path.stat().st_size} bytes, GitHub Pages allows under 100 MiB per file")
    valid, errors, _warnings = cog_validate(str(path), quiet=True)
    if not valid:
        problems.append(f"{path.name}: not a valid COG: {'; '.join(errors)}")
    with rasterio.open(path) as src:
        if src.crs is None or src.crs.to_epsg() != 3857:
            problems.append(f"{path.name}: CRS is {src.crs}, must be EPSG:3857")
        if any(dt != "uint8" for dt in src.dtypes):
            problems.append(f"{path.name}: data type {src.dtypes}, must be uint8")
        if src.nodata is None or src.nodata != 0:
            problems.append(f"{path.name}: nodata is {src.nodata}, must be 0 declared in the file")
        if not src.overviews(1):
            problems.append(f"{path.name}: no overviews")
        # Lossy codecs (JPEG, WebP) change pixel codes, and the codes are the values.
        compression = src.compression.name.upper() if src.compression else "NONE"
        if compression != "DEFLATE":
            problems.append(f"{path.name}: compression is {compression}, must be DEFLATE (lossless)")
        if not (src.read(1) != NODATA).any():
            problems.append(f"{path.name}: no valid pixels")
        # The app decodes pixel codes with the manifest's `encoding` only. The browser reader also applies
        # GDAL scale/offset tags by itself, so a file that declared them would be decoded twice.
        if any(scale != 1.0 for scale in src.scales) or any(offset != 0.0 for offset in src.offsets):
            problems.append(f"{path.name}: declares GDAL scale/offset {src.scales}/{src.offsets}; "
                            "files must hold plain codes (the manifest's encoding is the only decoding rule)")
        # Every band is a grey value. Colour or alpha tagging makes readers drop or blank bands.
        coloured = [ci.name for ci in src.colorinterp if ci.name in ("red", "green", "blue", "alpha")]
        if coloured:
            problems.append(f"{path.name}: bands are tagged as colour/alpha ({', '.join(coloured)}); "
                            'write the source raster with photometric="MINISBLACK"')
        if bounds is not None and src.crs is not None:
            w, s, e, n = transform_bounds(src.crs, "EPSG:4326", *src.bounds, densify_pts=21)
            if e <= bounds[0] or w >= bounds[2] or n <= bounds[1] or s >= bounds[3]:
                problems.append(f"{path.name}: footprint {w:.4f},{s:.4f},{e:.4f},{n:.4f} does not overlap "
                                f"the site bounds {bounds}")
    return problems

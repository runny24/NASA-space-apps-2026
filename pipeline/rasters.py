"""Small file helpers shared by the stages: GeoTIFF and JSON in and out.

Every write goes to a temporary name in the same folder and is then moved into place with os.replace.
A run that is interrupted therefore never leaves a half-written file under the final name, which the
"skip outputs that exist and validate" logic would otherwise trust. All handles are closed before the
move, because Windows cannot replace a file that is still open.
"""

from __future__ import annotations

import contextlib
import json
import os
from pathlib import Path

import numpy as np
import rasterio
from affine import Affine


def temp_path(path: Path) -> Path:
    """The temporary name a file is written under. It starts with a dot, so the stages skip it."""
    return path.with_name(f".{path.stem}.partial{path.suffix}")


def discard_temp(tmp: Path) -> None:
    """Remove a temporary file left by a write that did not reach its final name (an error, Ctrl+C, or a
    Windows lock on the destination). Called after every write; after a successful one there is nothing
    to remove. A file that cannot be removed now is left for the next run, which skips dot-files."""
    with contextlib.suppress(OSError):
        tmp.unlink(missing_ok=True)


def write_geotiff(path: Path, bands: np.ndarray, crs: str, transform: Affine, nodata: float | int | None,
                  descriptions: list[str] | None = None, tags: dict | None = None) -> int:
    """Write a (bands, rows, cols) or (rows, cols) array as a tiled, compressed GeoTIFF. Returns bytes."""
    data = bands[np.newaxis] if bands.ndim == 2 else bands
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = temp_path(path)
    profile = dict(driver="GTiff", width=data.shape[2], height=data.shape[1], count=data.shape[0],
                   dtype=data.dtype.name, crs=crs, transform=transform, nodata=nodata,
                   tiled=True, blockxsize=256, blockysize=256, compress="deflate")
    if data.dtype.kind == "f":
        profile["predictor"] = 3  # floating-point predictor: smaller files for float32 power
    try:
        with rasterio.open(tmp, "w", **profile) as dst:
            dst.write(data)
            for i, text in enumerate(descriptions or [], start=1):
                dst.set_band_description(i, text)
            if tags:
                dst.update_tags(**tags)
        os.replace(tmp, path)
    finally:
        discard_temp(tmp)
    return path.stat().st_size


def read_geotiff(path: Path) -> tuple[np.ndarray, dict]:
    """Return (bands, rows, cols) array and a dict with crs, transform, nodata, descriptions, tags."""
    with rasterio.open(path) as src:
        data = src.read()
        info = dict(crs=src.crs.to_string() if src.crs else None, transform=src.transform,
                    nodata=src.nodata, descriptions=list(src.descriptions), tags=src.tags(),
                    shape=(src.height, src.width))
    return data, info


def write_json(path: Path, obj, indent: int | None = 2) -> int:
    """Write JSON (indented by default; indent=None writes it on one line, for files the browser loads whole)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = temp_path(path)
    try:
        # newline="\n": LF line endings on every platform, so the committed JSON does not churn on Windows.
        with open(tmp, "w", encoding="utf-8", newline="\n") as fh:
            json.dump(obj, fh, indent=indent, ensure_ascii=False,
                      separators=None if indent is not None else (",", ":"))
            fh.write("\n")
        os.replace(tmp, path)
    finally:
        discard_temp(tmp)
    return path.stat().st_size


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json_if_changed(path: Path, obj, ignore: tuple[str, ...] = ("generated_at",),
                          indent: int | None = 2) -> bool:
    """Write only when the content differs (ignoring timestamps), so a re-run changes nothing on disk."""
    if path.is_file():
        try:
            old = read_json(path)
        except (OSError, ValueError):
            old = None
        if isinstance(old, dict) and isinstance(obj, dict):
            strip = lambda d: {k: v for k, v in d.items() if k not in ignore}  # noqa: E731
            if strip(old) == strip(json.loads(json.dumps(obj))):
                return False
    write_json(path, obj, indent=indent)
    return True

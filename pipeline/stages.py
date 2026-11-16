"""The pipeline stages for one site, and the commands that run them.

    fetch    granule list -> work/<site>/windows/<date>.tif (+ _mask.tif, .json facts)
    process  windows      -> work/<site>/proc/<date>.tif   masked, multilooked linear power
    analyse  proc         -> work/<site>/analysis/         harvest.json + harvest_classes.tif, if the site
                                                           sets a harvest block (pipeline/harvest.py)
    fires    NASA FIRMS   -> work/<site>/fires/            raw CSVs (cached) + detections.json, if the site
                                                           sets a fires block (pipeline/fires.py)
    marker   analysis and -> work/<site>/analysis/         marker.json: which polarization draws the harvest
             detections      marker.json                   map, by the rule fixed before any fire data was
                                                           analysed (pipeline/marker.py). Not part of `run`:
                                                           the choice is made deliberately, once
    qa       both         -> work/<site>/qa/*.png          histograms and thumbnails to look at
                             + stable_target.json          the stable-target check, if the site sets one
    export   proc         -> web/public/data/<site>/       COGs, stats.json, site.json (+ the harvest layer
                                                           and series, from the analysis; + fires.geojson
                                                           and the fire bars, from the detections)
    manifest site.json    -> web/public/data/manifest.json
    validate everything   -> exit code

Every stage skips outputs that already exist and pass their check, unless --force is given, so a run
that stopped halfway can simply be started again. Each output carries a record of exactly the inputs it
was made from (the window sidecar's "inputs", the PIPELINE_INPUTS tag of a GeoTIFF), and an output whose
record is missing or differs from the current settings is made again, so a config change never leaves
files made with the old settings behind.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import time
from dataclasses import dataclass
from itertools import pairwise
from pathlib import Path

import numpy as np
import rasterio

from pipeline import __version__
from pipeline import fires as fires_mod
from pipeline import harvest as harvest_mod
from pipeline import manifest as manifest_mod
from pipeline import marker as marker_mod
from pipeline.access import open_granule
from pipeline.config import ConfigError, SiteConfig, check_harvest_dates, load_granule_list, load_site
from pipeline.encode import NODATA, clip_report, encode, encoding_json
from pipeline.export import (
    DISPLAY_BLOCK,
    STACK_BLOCK,
    check_raster,
    choose_zoom,
    ground_pixel_m,
    resampling_for,
    warp_classes,
    warp_linear,
    web_grid,
    write_cog,
)
from pipeline.gcov import (
    EXCEPTION_MASK,
    EXCEPTION_SUMMARY_METHOD,
    describe_exception_code,
    describe_exceptions,
    read_exception_window,
    read_facts,
    read_window,
    start_datetime,
    summarise_exceptions,
    unique_mask_values,
)
from pipeline.hints import command
from pipeline.paths import Layout, default_layout
from pipeline.process import (
    assert_same_grid,
    log_ratio_db,
    mask_convention,
    multilook,
    multilook_factor,
    multilook_transform,
    to_db,
    valid_pixels,
)
from pipeline.qa import (
    MIN_TARGET_PIXELS,
    OUTSIDE,
    STABLE_TARGET_METHOD,
    grid_lonlat_bounds,
    histogram_png,
    stable_target_report,
    stable_target_series,
    target_pixels,
    thumbnail_png,
)
from pipeline.rasters import read_geotiff, read_json, write_geotiff, write_json, write_json_if_changed
from pipeline.stats import backscatter_series, common_footprint_points, stats_document

# GeoTIFF tag holding the record of inputs an output was made from (see the module docstring).
INPUTS_TAG = "PIPELINE_INPUTS"


def say(message: str) -> None:
    print(message, flush=True)


def mb(n: int) -> str:
    return f"{n / 1e6:.1f} MB"


def is_fresh(output: Path, inputs: list[Path]) -> bool:
    """True when output exists and is at least as new as every input, so it can be reused. A newer
    input (for example a window fetched again with --force) makes the later stages redo their work."""
    if not output.is_file():
        return False
    newest = max((p.stat().st_mtime_ns for p in inputs if p.is_file()), default=0)
    return output.stat().st_mtime_ns >= newest


def record_text(record: dict) -> str:
    """One canonical text for a record of inputs, so two records are equal exactly when the inputs are."""
    return json.dumps(record, sort_keys=True, separators=(",", ":"))


def file_tags(path: Path) -> dict[str, str]:
    """The default-domain tags of a GeoTIFF; empty when the file is missing or unreadable."""
    try:
        with rasterio.open(path) as src:
            return src.tags()
    except (OSError, rasterio.errors.RasterioError):
        return {}


def term(pol: str) -> str:
    """Backscatter of polarization HH is the covariance term HHHH (the diagonal of the matrix)."""
    return pol + pol


@dataclass(frozen=True)
class SitePaths:
    windows: Path
    proc: Path
    qa: Path
    data: Path
    analysis: Path
    fires: Path

    @classmethod
    def of(cls, site_id: str, layout: Layout) -> SitePaths:
        work = layout.site_work(site_id)
        return cls(work / "windows", work / "proc", work / "qa", layout.site_data(site_id), work / "analysis",
                   work / "fires")


def stack_code(facts: dict) -> str | None:
    """track_direction_frame of the file, e.g. 030_A_019, from what the file itself says."""
    if facts.get("track") is None or facts.get("frame") is None or not facts.get("orbit_direction"):
        return None
    return f"{facts['track']:03d}_{facts['orbit_direction'][0].upper()}_{facts['frame']:03d}"


def fetch_inputs(cfg: SiteConfig, granule: dict, terms: list[str]) -> dict:
    """Everything that decides what a fetched window holds. A change to any of these refetches it."""
    return {"bbox": list(cfg.bbox), "frequency": cfg.frequency, "terms": terms,
            "granule": granule["name"], "url": granule["url"]}


def _window_ok(paths: SitePaths, date: str, inputs: dict) -> bool:
    tif, side = paths.windows / f"{date}.tif", paths.windows / f"{date}.json"
    if not (tif.is_file() and side.is_file()):
        return False
    try:
        sidecar = read_json(side)
        with rasterio.open(tif) as src:
            # A sidecar without the exception record was written before fetch looked at it; fetch again
            # so that a file flagging input data exceptions cannot slip through without its warning.
            # An exception summary made by another method (before 14 November 2026 every file was read with
            # the 1.6.0 layout, which misreads 1.5.0 files) is redone too; a window without one is not.
            summary = sidecar.get("exception_summary")
            current = summary is None or (isinstance(summary, dict)
                                          and summary.get("method") == EXCEPTION_SUMMARY_METHOD)
            return (list(src.descriptions) == inputs["terms"] and sidecar.get("inputs") == inputs
                    and "has_input_data_exception" in sidecar and current)
    except (OSError, ValueError, rasterio.errors.RasterioError):
        return False


def exception_warning(date: str, granule: str, flag: bool | None, summary: dict | None,
                      frequency: str, code: int | None = None) -> str | None:
    """The WARNING for a window whose file sets hasInputDataException, or None when the flag is not True.
    `code` is the number the flag holds (GcovFacts.input_data_exception_code). fetch prints the warning when
    it reads the window and again, from the sidecar, whenever it skips the window, so the warning does not
    vanish from the output of a re-run."""
    if flag is not True:
        return None
    head = (f"WARNING: {date} {granule}: hasInputDataException reports {describe_exception_code(code)} "
            "somewhere in the granule")
    if summary is None:  # the flag is set but this frequency has no exception mask to summarise
        return (f"{head}, but the file has no {EXCEPTION_MASK} for frequency {frequency}, so nothing says which "
                "pixels. No pixel was dropped.")
    return (f"{head}; inside this site's window {describe_exceptions(summary)}. No pixel was dropped; whether "
            "to remove them is still an open question (docs/TASKS.md, T2). Details: exception_summary in the "
            "window's sidecar.")


def fetch_site(cfg: SiteConfig, layout: Layout, force: bool = False) -> list[dict]:
    """Read the site's window from every granule in its list and save it locally."""
    granules = load_granule_list(cfg.id, layout.sites_dir)
    paths = SitePaths.of(cfg.id, layout)
    terms = [term(p) for p in cfg.polarizations]
    results = []
    if cfg.stack and granules.get("stack") != cfg.stack:
        raise ConfigError(f"{cfg.id}: the granule list is for stack {granules.get('stack')} but the site "
                          f"file says {cfg.stack}; only one stack per site (science rule 1)")
    for g in granules["granules"]:
        date = g["date"]
        inputs = fetch_inputs(cfg, g, terms)
        if not force and _window_ok(paths, date, inputs):
            say(f"fetch   {date}: exists, skipped")
            side = read_json(paths.windows / f"{date}.json")
            warning = exception_warning(side["date"], side["granule"], side["has_input_data_exception"],
                                        side.get("exception_summary"), side["frequency"],
                                        side.get("facts", {}).get("input_data_exception_code"))
            if warning:
                say(warning)
            results.append(side)
            continue
        t0, net = time.perf_counter(), {}
        with open_granule(g["url"], cfg.access, stats=net) as h5:
            facts = read_facts(h5)
            window = read_window(h5, facts, cfg.bbox, cfg.frequency, terms)
            flagged = facts.has_input_data_exception is True
            has_exception_mask = facts.grids[cfg.frequency].has_exception_mask
            exceptions = None
            # Read the exception mask only when the file flags exceptions: it costs several seconds per date.
            # The summary is a record and a warning; it never drops or changes a pixel (see
            # gcov.summarise_exceptions: whether to remove flagged pixels is still open, docs/TASKS.md T2).
            if flagged and has_exception_mask:
                grid = facts.grids[cfg.frequency]  # the mask's layout, read from this file (gcov.exception_layout)
                exceptions = summarise_exceptions(read_exception_window(h5, cfg.frequency, window.pixels),
                                                  cfg.polarizations, focus_bits=bool(grid.exception_focus_bits),
                                                  fill=grid.exception_fill)
        file_date, file_datetime = start_datetime(facts)
        if file_date != date:
            say(f"warning: {g['name']}: the list says {date} but the file starts on {file_date}; "
                "using the file's date")
        warning = exception_warning(file_date, g["name"], facts.has_input_data_exception, exceptions,
                                    cfg.frequency, facts.input_data_exception_code)
        if warning:
            say(warning)
        file_stack = stack_code(facts.to_dict())
        if granules.get("stack") and file_stack and file_stack != granules["stack"]:
            raise ValueError(f"{g['name']} is on stack {file_stack}, not {granules['stack']} "
                             "(science rule 1: one stack per site)")
        mask_values = sorted(int(v) for v in np.unique(window.mask)) if window.mask is not None else None
        crs = f"EPSG:{window.epsg}"
        stack = np.stack([window.terms[t] for t in terms])
        written = write_geotiff(paths.windows / f"{date}.tif", stack, crs, window.transform, np.nan,
                                descriptions=terms, tags={"SOURCE_GRANULE": g["name"]})
        mask_file = paths.windows / f"{date}_mask.tif"
        if window.mask is not None:
            written += write_geotiff(mask_file, window.mask, crs, window.transform,
                                     None, descriptions=["mask"], tags={"SOURCE_GRANULE": g["name"]})
        else:
            # A mask left from an earlier granule for this date would otherwise be applied to this one.
            mask_file.unlink(missing_ok=True)
        sidecar = {
            "granule": g["name"], "source": g["url"], "list_date": date, "date": file_date,
            "datetime": file_datetime, "release": g["release"], "collection": g.get("collection", ""),
            "version": g.get("version") or facts.release_id, "bandwidth_mhz": g.get("bandwidth_mhz"),
            "full_frame": facts.is_full_frame if facts.is_full_frame is not None else g.get("full_frame"),
            "frequency": cfg.frequency, "terms": terms, "mask_values": mask_values, "inputs": inputs,
            # identification/hasInputDataException (None: the file has no such field, like the 1.2.1
            # samples); whether this frequency has an inputDataExceptionMask; and, only when the flag is
            # set, what that mask holds inside the window (gcov.summarise_exceptions), else None.
            "has_input_data_exception": facts.has_input_data_exception,
            "has_exception_mask": has_exception_mask, "exception_summary": exceptions,
            "window": {"rows": [window.pixels.row0, window.pixels.row1],
                       "cols": [window.pixels.col0, window.pixels.col1],
                       "clipped": window.pixels.clipped, "crs": crs, "transform": list(window.transform)[:6]},
            "facts": facts.to_dict(),
            "seconds": round(time.perf_counter() - t0, 2), "bytes_fetched": net.get("bytes_fetched", 0),
        }
        written += write_json(paths.windows / f"{date}.json", sidecar)
        say(f"fetch   {date}: {sidecar['seconds']:.1f} s, {mb(sidecar['bytes_fetched'])} fetched, "
            f"window {window.pixels.shape[0]}x{window.pixels.shape[1]} px, mask values {mask_values}, "
            f"wrote {mb(written)}")
        results.append(sidecar)
    return results


def _dates(cfg: SiteConfig, layout: Layout) -> list[str]:
    paths = SitePaths.of(cfg.id, layout)
    dates = [g["date"] for g in load_granule_list(cfg.id, layout.sites_dir)["granules"]]
    missing = [d for d in dates if not (paths.windows / f"{d}.json").is_file()]
    if missing:
        raise FileNotFoundError(f"{cfg.id}: no fetched window for {missing}; run "
                                f"`{command('fetch', '--site', cfg.id)}` first")
    # The file's own start date is the date we publish (granule names can disagree with the file).
    return [read_json(paths.windows / f"{d}.json")["date"] for d in dates]


def _sidecar_for(paths: SitePaths, date: str) -> tuple[str, dict]:
    """Find the window files of an acquisition date (files are named by the granule list's date)."""
    # Names starting with a dot are temporary files of an interrupted write (rasters.temp_path), not sidecars.
    for side in sorted(p for p in paths.windows.glob("*.json") if not p.name.startswith(".")):
        data = read_json(side)
        if data.get("date") == date:
            return side.stem, data
    raise FileNotFoundError(f"no window sidecar for {date} in {paths.windows}")


def process_site(cfg: SiteConfig, layout: Layout, force: bool = False) -> None:
    """Mask invalid pixels, multilook to the working resolution, and check all dates share one grid."""
    paths = SitePaths.of(cfg.id, layout)
    grids = {}
    for date in _dates(cfg, layout):
        out = paths.proc / f"{date}.tif"
        stem, side = _sidecar_for(paths, date)
        window_file, mask_file = paths.windows / f"{stem}.tif", paths.windows / f"{stem}_mask.tif"
        convention = mask_convention(side["facts"]["spec_version"], side["mask_values"])
        record = record_text({
            "working_resolution_m": cfg.working_resolution_m, "power_floor": cfg.power_floor,
            "min_valid_fraction": cfg.min_valid_fraction, "mask_convention": convention,
            "polarizations": cfg.polarizations, "window": side.get("inputs"),
        })
        if (force or not is_fresh(out, [window_file, mask_file])
                or file_tags(out).get(INPUTS_TAG) != record):
            t0 = time.perf_counter()
            bands, info = read_geotiff(window_file)
            mask = read_geotiff(mask_file)[0][0] if mask_file.is_file() else None
            grid = side["facts"]["grids"][side["frequency"]]
            if abs(abs(grid["y_spacing"]) - grid["x_spacing"]) > 1e-6:
                raise ValueError(f"{date}: non-square pixels ({grid['x_spacing']}, {grid['y_spacing']}) "
                                 "are not supported")
            factor = multilook_factor(grid["x_spacing"], cfg.working_resolution_m)
            looked, fractions = [], []
            for band in bands:
                valid = valid_pixels(band, mask, convention, cfg.power_floor)
                fractions.append(float(valid.mean()))
                clean = np.where(valid, band, np.nan).astype(np.float32)
                looked.append(multilook(clean, factor, cfg.min_valid_fraction))
            transform = multilook_transform(info["transform"], factor)
            written = write_geotiff(out, np.stack(looked), info["crs"], transform, np.nan,
                                    descriptions=cfg.polarizations,
                                    tags={"SOURCE_GRANULE": side["granule"], "MASK_CONVENTION": convention,
                                          INPUTS_TAG: record})
            say(f"process {date}: {time.perf_counter() - t0:.1f} s, mask '{convention}', valid "
                f"{', '.join(f'{100 * f:.1f}%' for f in fractions)}, {factor}x{factor} looks -> "
                f"{looked[0].shape[0]}x{looked[0].shape[1]} px, wrote {mb(written)}")
        else:
            say(f"process {date}: exists, skipped")
        with rasterio.open(out) as src:
            grids[date] = (src.crs.to_string(), src.transform, (src.height, src.width))
    assert_same_grid(grids)
    say(f"process: {len(grids)} dates on one identical grid")


def qa_site(cfg: SiteConfig, layout: Layout, force: bool = False) -> None:
    paths = SitePaths.of(cfg.id, layout)
    displays = {p: (cfg.backscatter.display_for(p).min, cfg.backscatter.display_for(p).max) for p in cfg.polarizations}
    for date in _dates(cfg, layout):
        stem, side = _sidecar_for(paths, date)
        targets = [(paths.qa / f"{date}_{p.lower()}_hist.png", paths.qa / f"{date}_{p.lower()}_thumb.png")
                   for p in cfg.polarizations]
        proc_file = paths.proc / f"{date}.tif"
        if not force and all(is_fresh(h, [proc_file]) and is_fresh(t, [proc_file]) for h, t in targets):
            say(f"qa      {date}: exists, skipped")
            continue
        t0 = time.perf_counter()
        raw, _ = read_geotiff(paths.windows / f"{stem}.tif")
        proc, _ = read_geotiff(proc_file)
        mask_file = paths.windows / f"{stem}_mask.tif"
        mask = read_geotiff(mask_file)[0][0] if mask_file.is_file() else None
        convention = mask_convention(side["facts"]["spec_version"], side["mask_values"])
        written = 0
        for i, (pol, (hist, thumb)) in enumerate(zip(cfg.polarizations, targets, strict=True)):
            raw_valid = np.where(valid_pixels(raw[i], mask, convention, cfg.power_floor), raw[i], np.nan)
            title = f"{cfg.id} {pol} {date} ({side['facts']['mission_id']} {side['facts']['instrument']})"
            written += histogram_png(hist, title, {"window, valid px": raw_valid,
                                                   f"multilooked {cfg.working_resolution_m:g} m": proc[i]},
                                     displays[pol])
            written += thumbnail_png(thumb, title, proc[i], displays[pol])
        say(f"qa      {date}: {time.perf_counter() - t0:.1f} s, wrote {mb(written)} to {paths.qa}")
    stable_target_site(cfg, layout, force)


STABLE_TARGET_FILE = "stable_target.json"


def stable_target_site(cfg: SiteConfig, layout: Layout, force: bool = False) -> dict | None:
    """The stable-target check (pipeline/qa.py) on the processed rasters: work/<site>/qa/stable_target.json
    and a printed table. A flagged date is a WARNING, never an error: the run goes on, and nothing that is
    published changes. Returns what the file holds, or None when the site file sets no stable_target."""
    paths = SitePaths.of(cfg.id, layout)
    out = paths.qa / STABLE_TARGET_FILE
    target = cfg.stable_target
    if target is None:
        # A result made with a setting that is gone must not stay behind looking current.
        old = out.is_file()
        out.unlink(missing_ok=True)
        say("qa      stable target: skipped, the site file has no stable_target; to switch the check on, add one "
            "(see pipeline/sites/_template.yaml)" + (f"; removed the old {out.name}" if old else ""))
        return None
    dates = _dates(cfg, layout)
    proc_files = [paths.proc / f"{d}.tif" for d in dates]
    missing = [p.name for p in proc_files if not p.is_file()]
    if missing:
        raise FileNotFoundError(f"{cfg.id}: no processed raster {', '.join(missing)}; run "
                                f"`{command('process', '--site', cfg.id)}` first")
    # Everything the result depends on, as the other stages record it (see the module docstring): a change
    # to the target, the tolerance, the dates or any processed raster's own record redoes the check, and so
    # does a change to the method, so a result made by an older rule is not shown as current.
    record = json.loads(json.dumps({
        "method": STABLE_TARGET_METHOD,
        "target": {"name": target.name, "bbox": list(target.bbox)}, "tolerance_db": target.tolerance_db,
        "min_pixels": MIN_TARGET_PIXELS, "polarizations": cfg.polarizations, "dates": dates,
        "sources": [file_tags(p).get(INPUTS_TAG) for p in proc_files],
    }))
    if not force and is_fresh(out, proc_files):
        try:
            old = read_json(out)
        except (OSError, ValueError):
            old = None
        if isinstance(old, dict) and old.get("inputs") == record:
            # Printed again on purpose, so a warning does not vanish from the output of a re-run.
            say(f"qa      stable target: exists, skipped ({out}); its result:")
            for line in stable_target_report(old):
                say(line)
            return old

    t0 = time.perf_counter()
    rasters = {d: read_geotiff(p) for d, p in zip(dates, proc_files, strict=True)}
    for date, (_, info) in rasters.items():
        if info["descriptions"] != cfg.polarizations:
            raise ValueError(f"{paths.proc / f'{date}.tif'} holds {info['descriptions']} but the site file asks "
                             f"for {cfg.polarizations}; run `{command('process', '--site', cfg.id)}` first")
    # Science rule 5: the same pixel must be the same ground on every date.
    assert_same_grid({d: (i["crs"], i["transform"], i["shape"]) for d, (_, i) in rasters.items()})
    info = rasters[dates[0]][1]
    selection, where = target_pixels(target.bbox, info["crs"], info["transform"], info["shape"])
    if where == OUTSIDE:
        w, s, e, n = grid_lonlat_bounds(info["crs"], info["transform"], info["shape"])
        raise ConfigError(f"{cfg.path}: field 'stable_target.bbox': the box {list(target.bbox)} lies outside the "
                          f"processed window of site {cfg.id} (about [{w:.4f}, {s:.4f}, {e:.4f}, {n:.4f}] in lon/lat), "
                          "so there is nothing to check. Choose a target inside the area every date covers.")
    powers = {pol: [rasters[d][0][b] for d in dates] for b, pol in enumerate(cfg.polarizations)}
    series = stable_target_series(dates, powers, selection, target.tolerance_db)
    doc = {
        "site": cfg.id,
        "target": {"name": target.name, "bbox": list(target.bbox)},
        "tolerance_db": target.tolerance_db,
        "method": STABLE_TARGET_METHOD,
        "grid": {"crs": info["crs"], "resolution_m": cfg.working_resolution_m},
        "target_box": where,
        **series,
        "inputs": record,
    }
    write_json(out, doc)
    say(f"qa      stable target: {time.perf_counter() - t0:.1f} s, wrote {out}")
    for line in stable_target_report(doc):
        say(line)
    return doc


HARVEST_FILE = "harvest.json"
HARVEST_RASTER = "harvest_classes.tif"
HARVEST_LAYER = "harvest-wave"


def _harvest_settings(cfg: SiteConfig) -> dict:
    """The harvest block as it was used (title and description only change texts, so export reads them)."""
    h = cfg.harvest
    return {"cell_m": h.cell_m, "marker": h.marker, "flood_dates": list(h.flood_dates),
            "peak_dates": list(h.peak_dates), "passes": list(h.passes), "false_alarm": h.false_alarm,
            "rice_rise_db": "auto" if h.rice_rise_db is None else h.rice_rise_db,
            "stable_boxes": [list(b) for b in h.stable_boxes], "stable_boxes_from": h.stable_boxes_from}


def _harvest_inputs(cfg: SiteConfig, layout: Layout) -> tuple[list[str], dict[str, Path], dict]:
    """The dates the harvest analysis reads, their processed rasters, and the record of everything its result
    depends on (as the other stages record theirs, see the module docstring)."""
    paths = SitePaths.of(cfg.id, layout)
    h = cfg.harvest
    check_harvest_dates(cfg, _dates(cfg, layout), "the dates of the fetched files")
    needed = sorted(set(h.flood_dates) | set(h.peak_dates) | set(h.passes))
    proc_files = {d: paths.proc / f"{d}.tif" for d in needed}
    missing = [p.name for p in proc_files.values() if not p.is_file()]
    if missing:
        raise FileNotFoundError(f"{cfg.id}: no processed raster {', '.join(missing)}; run "
                                f"`{command('process', '--site', cfg.id)}` first")
    record = json.loads(json.dumps({
        "method": harvest_mod.METHOD,
        "settings": _harvest_settings(cfg),
        "constants": {"min_cell_valid": harvest_mod.MIN_CELL_VALID, "otsu_range_db": harvest_mod.OTSU_RANGE_DB,
                      "otsu_bins": harvest_mod.OTSU_BINS, "large_fall_db": harvest_mod.LARGE_FALL_DB,
                      "quantile": harvest_mod.QUANTILE_METHOD},
        "polarizations": cfg.polarizations,
        "dates": needed,
        "sources": [file_tags(proc_files[d]).get(INPUTS_TAG) for d in needed],
    }))
    return needed, proc_files, record


def _analysis_current(out: Path, raster: Path, inputs: list[Path], record: dict) -> bool:
    """True when harvest.json and the class raster exist, are newer than every input, and both carry exactly
    this record of inputs."""
    if not (is_fresh(out, inputs) and is_fresh(raster, inputs)):
        return False
    try:
        old = read_json(out)
    except (OSError, ValueError):
        return False
    return (isinstance(old, dict) and old.get("inputs") == record
            and file_tags(raster).get(INPUTS_TAG) == record_text(record))


def analyse_site(cfg: SiteConfig, layout: Layout, force: bool = False) -> dict | None:
    """The harvest analysis (pipeline/harvest.py) on the processed rasters: work/<site>/analysis/harvest.json
    (every number, the settings used and the record of inputs) and harvest_classes.tif (the class of every
    cell on the product's grid at cell size, one band per polarization, 0 = no data). Returns what the JSON
    holds, or None when the site file has no harvest block."""
    paths = SitePaths.of(cfg.id, layout)
    out, raster = paths.analysis / HARVEST_FILE, paths.analysis / HARVEST_RASTER
    h = cfg.harvest
    if h is None:
        # A result made with a setting that is gone must not stay behind looking current.
        old = [p.name for p in (out, raster) if p.is_file()]
        for p in (out, raster):
            p.unlink(missing_ok=True)
        say("analyse: skipped, the site file has no harvest block; to switch the harvest analysis on, add one "
            "(see pipeline/sites/_template.yaml)" + (f"; removed the old {', '.join(old)}" if old else ""))
        return None
    needed, proc_files, record = _harvest_inputs(cfg, layout)
    if not force and _analysis_current(out, raster, list(proc_files.values()), record):
        doc = read_json(out)
        say(f"analyse: exists, skipped ({out}); its result:")
        for line in harvest_mod.report(doc):
            say(line)
        return doc

    t0 = time.perf_counter()
    grids, factor = {}, None
    cell_powers: dict[str, dict[str, np.ndarray]] = {pol: {} for pol in harvest_mod.POLARIZATIONS}
    for date in needed:
        data, info = read_geotiff(proc_files[date])
        if info["descriptions"] != cfg.polarizations:
            raise ValueError(f"{proc_files[date]} holds {info['descriptions']} but the site file asks for "
                             f"{cfg.polarizations}; run `{command('process', '--site', cfg.id)}` first")
        grids[date] = (info["crs"], info["transform"], info["shape"])
        if factor is None:
            factor = harvest_mod.cell_factor(abs(info["transform"].a), h.cell_m)
        for pol in harvest_mod.POLARIZATIONS:
            cell_powers[pol][date] = harvest_mod.cells(data[cfg.polarizations.index(pol)], factor)
    # Science rule 5: the same cell must be the same ground on every date.
    assert_same_grid(grids)
    crs, transform, shape = grids[needed[0]]
    cell_transform, cell_shape = harvest_mod.cell_grid(transform, shape, factor)
    # The processed window is the UTM rectangle around the site box, so it reaches a little beyond the box. Only
    # cells whose centres lie inside the box take part, as in the fire bars, so that the rice area, the harvest
    # series and the class areas behind a fire density all describe the same ground.
    in_site, _ = harvest_mod.cells_in_boxes([cfg.bbox], crs, cell_transform, cell_shape)
    in_boxes, wheres = harvest_mod.cells_in_boxes(h.stable_boxes, crs, cell_transform, cell_shape)
    if all(w == OUTSIDE for w in wheres):
        field = "harvest.stable_boxes" if h.stable_boxes_from == "stable_boxes" else "stable_target.bbox"
        w, s, e, n = grid_lonlat_bounds(crs, transform, shape)
        raise ConfigError(f"{cfg.path}: field '{field}': no stable box reaches the processed window of site "
                          f"{cfg.id} (about [{w:.4f}, {s:.4f}, {e:.4f}, {n:.4f}] in lon/lat), so the harvest "
                          "threshold has no stable ground to start from")
    try:
        core, classes = harvest_mod.analyse_cells(cell_powers, h, in_site, in_boxes,
                                                  harvest_mod.cell_area_km2(cell_transform))
    except ValueError as exc:  # too few reference cells, or a threshold that is not a fall
        raise ValueError(f"{cfg.id}: harvest analysis: {exc}") from exc
    doc = {
        "site": cfg.id,
        "method": harvest_mod.METHOD,
        "settings": _harvest_settings(cfg),
        "grid": {"crs": crs, "transform": list(cell_transform)[:6], "shape": list(cell_shape), "cell_m": h.cell_m,
                 "pixels_per_cell_side": factor, "processed_resolution_m": abs(transform.a)},
        "stable_boxes": [{"bbox": list(b), "where": w} for b, w in zip(h.stable_boxes, wheres, strict=True)],
        **core,
        "raster": {"file": HARVEST_RASTER, "bands": list(harvest_mod.POLARIZATIONS), "nodata": NODATA},
        "inputs": record,
    }
    # The raster first, the JSON last: a run cut off between the two leaves no JSON that looks current.
    write_geotiff(raster, np.stack([classes[p] for p in harvest_mod.POLARIZATIONS]), crs, cell_transform, NODATA,
                  descriptions=list(harvest_mod.POLARIZATIONS), tags={INPUTS_TAG: record_text(record)})
    write_json(out, doc)
    say(f"analyse: {time.perf_counter() - t0:.1f} s, {cell_shape[0]}x{cell_shape[1]} cells of {h.cell_m:g} m, "
        f"wrote {out} and {raster.name}")
    for line in harvest_mod.report(doc):
        say(line)
    return doc


DETECTIONS_FILE = "detections.json"


def _fires_settings(cfg: SiteConfig) -> dict:
    """What the detections depend on (the periods, title and description only change what export makes)."""
    f = cfg.fires
    return {"start": f.start, "end": f.end, "sources": list(f.sources), "bbox": [float(v) for v in cfg.bbox]}


def _matching_detections(out: Path, settings: dict) -> dict | None:
    try:
        old = read_json(out) if out.is_file() else None
    except (OSError, ValueError):
        return None
    return old if isinstance(old, dict) and old.get("settings") == settings else None


def fires_site(cfg: SiteConfig, layout: Layout, force: bool = False) -> dict | None:
    """Fetch NASA FIRMS fire detections for the site's box and days (pipeline/fires.py): raw CSVs cached under
    work/<site>/fires/, and detections.json (every detection inside the box, each once, with its source, and
    what was asked). Without FIRMS_MAP_KEY it prints how to get one and carries on: it never fails a run for
    that. When FIRMS cannot be asked or answers with something other than detections it raises
    fires.FiresError; run_site turns that into a warning and goes on. Returns what detections.json holds, or
    None when there is nothing (no fires block, or no key and nothing fetched before)."""
    paths = SitePaths.of(cfg.id, layout)
    out = paths.fires / DETECTIONS_FILE
    f = cfg.fires
    if f is None:
        old = out.is_file()
        out.unlink(missing_ok=True)  # a result made with a setting that is gone must not look current
        say("fires: skipped, the site file has no fires block; to fetch fire detections, add one (see "
            "pipeline/sites/_template.yaml)" + (f"; removed the old {out.name}" if old else ""))
        return None
    settings = _fires_settings(cfg)
    now = fires_mod.utc_now()
    today = now.date()
    last = fires_mod.last_day(f.end, today)
    first = dt.date.fromisoformat(f.start)
    if last < first:
        say(f"fires: skipped, no day from {f.start} on has ended yet (UTC); detections are fetched for whole days")
        return None
    plan = fires_mod.chunks(first, last)
    status = {(s, c): fires_mod.chunk_status(paths.fires, s, cfg.bbox, c[0], c[1], today)
              for s in f.sources for c in plan}
    wanted = [k for k, st in status.items() if force or st != "settled"]
    key, problem = fires_mod.map_key()
    if wanted and key is None:
        missing = [k for k in wanted if status[k] == "missing" or force]
        if missing:
            old = _matching_detections(out, settings)
            if old is not None:
                say(f"fires: {problem}. Keeping the detections fetched before ({out}, UTC dates "
                    f"{old['asked'][0]} to {old['asked'][1]})")
                return old
            say(f"fires: skipped: {problem}")
            return None
        say(f"fires: {problem}. {len(wanted)} recent request(s) could not be asked again and are used as fetched")
        wanted = []

    t0 = time.perf_counter()
    fetched: dict[str, int] = dict.fromkeys(f.sources, 0)
    for source, (day, days) in wanted:
        body = fires_mod.fetch_chunk(key, source, cfg.bbox, day, days)
        rows = len(fires_mod.parse_csv(body, source))  # a CSV that cannot be read stops here, before caching
        fires_mod.save_chunk(paths.fires, key, source, cfg.bbox, day, days, body, rows)
        fetched[source] += 1
    by_source, requests, rows = [], [], {}
    for source in f.sources:
        found = []
        for day, days in plan:
            name = fires_mod.chunk_name(source, day, days)
            body = (paths.fires / f"{name}.csv").read_bytes()
            record = read_json(paths.fires / f"{name}.json")
            found += fires_mod.parse_csv(body, source)
            requests.append({"file": f"{name}.csv", "source": source, "first": record["first"],
                             "last": record["last"], "fetched_utc": record["fetched_utc"],
                             "sha256": record["sha256"]})
        rows[source] = len(found)
        by_source.append((source, found))
        say(f"fires   {source}: {len(plan)} request(s) of at most {fires_mod.MAX_DAYS} days, {fetched[source]} "
            f"fetched, {len(plan) - fetched[source]} from the cache; {len(found)} detection"
            f"{'' if len(found) == 1 else 's'}")
        if not found and source.endswith("_SP"):
            say(f"fires   {source}: no detection from {f.start} to {last.isoformat()}. Standard-processing (SP) data "
                "appear months after the pass; near-real-time (NRT) sources cover recent weeks. If that is why, run "
                f"`{command('fires', '--site', cfg.id, '--force')}` once the SP data are out")
    merged, dropped = fires_mod.merge(by_source)
    inside = [d for d in merged if fires_mod.in_box(d, cfg.bbox)]
    kept = {s: sum(1 for d in inside if d["source"] == s) for s in f.sources}
    doc = {
        "site": cfg.id,
        "settings": settings,
        "asked": [f.start, last.isoformat()],
        "sources": {s: {"rows": rows[s], "duplicates": dropped[s], "kept": kept[s]} for s in f.sources},
        "outside_box": len(merged) - len(inside),
        "count": len(inside),
        "detections": inside,
        "requests": requests,
    }
    changed = write_json_if_changed(out, doc)
    dups = sum(dropped.values())
    say(f"fires: {time.perf_counter() - t0:.1f} s, {len(inside)} detections with UTC dates {f.start} to "
        f"{last.isoformat()} inside the site box; {dups} found in two sources and kept once; "
        f"{doc['outside_box']} outside the box left out; {out.name} {'written' if changed else 'unchanged'}")
    if last.isoformat() < f.end:
        say(f"fires: the days after {last.isoformat()} (to {f.end}) have not ended yet (UTC); a later run fetches them")
    return doc


MARKER_FILE = "marker.json"


def _marker_mismatch(cfg: SiteConfig, chosen: str | None) -> str | None:
    """The WARNING text when the marker test chose another polarization than the site file's harvest.marker."""
    current = cfg.harvest.marker
    if chosen is None or chosen == current:
        return None
    return (f"the marker test chose {chosen}, but the site file's harvest.marker is {current}, so the harvest map is "
            f"drawn from {current}. Set harvest.marker: {chosen} in {cfg.path}, then run "
            f"`{command('analyse', '--site', cfg.id)}` and `{command('export', '--site', cfg.id)}` again")


def _marker_verdict(cfg: SiteConfig, doc: dict) -> str:
    chosen = doc["decision"]["marker"]
    mismatch = _marker_mismatch(cfg, chosen)
    if mismatch:
        return f"WARNING: marker: {mismatch}"
    if chosen is None:
        return f"marker  the test leaves the choice to the team; the site file's harvest.marker is {cfg.harvest.marker}"
    return f"marker  the site file's harvest.marker is {cfg.harvest.marker}, as the test chose"


def _window_todo(cfg: SiteConfig, first: str, last: str, fetched: list[str]) -> str:
    """What to run so that detections.json holds every day of the marker test's window [first, last]."""
    todo = []
    if fetched[0] > first:
        todo.append(f"set the fires block's start to {first} or earlier in {cfg.path} and run "
                    f"`{command('fires', '--site', cfg.id)}`")
    if fetched[1] < last:
        todo.append(f"run `{command('fires', '--site', cfg.id)}` again once {last} has ended in UTC (at 00:00 UTC on "
                    f"{marker_mod.shift(last, 1)}; near-real-time detections keep arriving for some hours after each "
                    "pass)")
    return f"{' and '.join(todo)}, then `{command('marker', '--site', cfg.id)}`"


def marker_site(cfg: SiteConfig, layout: Layout, force: bool = False) -> dict:
    """The marker test (pipeline/marker.py): which polarization's harvest pairs should draw the harvest map, by the
    rule fixed before any fire data was analysed (PROGRESS.md, "The marker rule"). Reads the harvest analysis
    (harvest.json, harvest_classes.tif) and the fire detections (detections.json), writes
    work/<site>/analysis/marker.json and prints the result. It never changes the site file: setting harvest.marker
    is the person's step. Not part of `run`, so the choice is made deliberately, once. The rule takes every
    detection of its window, so when detections.json does not hold every day of it (fires ran before the window's
    last day had ended in UTC), it stops before computing anything, with or without --force, and says what to run.
    Like the other stages it is skipped when its inputs are unchanged (the class raster's content, the harvest
    settings without the marker, detections.json and the method), printing the result again; --force makes it
    again."""
    paths = SitePaths.of(cfg.id, layout)
    if cfg.harvest is None:
        raise ConfigError(f"{cfg.path}: the marker test chooses which polarization of the harvest analysis draws "
                          "the harvest map, so the site needs a harvest block (see pipeline/sites/_template.yaml)")
    if cfg.fires is None:
        raise ConfigError(f"{cfg.path}: the marker test weighs the harvest classes with fire detections, so the "
                          "site needs a fires block (see pipeline/sites/_template.yaml)")
    out, raster = paths.analysis / HARVEST_FILE, paths.analysis / HARVEST_RASTER
    _, proc_files, analysis_record = _harvest_inputs(cfg, layout)
    if not _analysis_current(out, raster, list(proc_files.values()), analysis_record):
        raise FileNotFoundError(f"{cfg.id}: the harvest analysis in {paths.analysis} is missing or was made from "
                                f"other settings or inputs; run `{command('analyse', '--site', cfg.id)}` first")
    det_file = paths.fires / DETECTIONS_FILE
    fires_doc = _matching_detections(det_file, _fires_settings(cfg))
    if fires_doc is None:
        raise FileNotFoundError(f"{cfg.id}: no fire detections fetched with the current fires settings in "
                                f"{det_file}; run `{command('fires', '--site', cfg.id)}` first (it needs "
                                f"{fires_mod.ENV_KEY} in .env)")
    harvest = read_json(out)
    bands, info = read_geotiff(raster)
    passes = list(cfg.harvest.passes)
    first, last = marker_mod.window(passes, cfg.fires.end)
    gap = marker_mod.missing(first, last, fires_doc["asked"])
    if gap:  # no share, interval or decision on part of the window: nothing is computed, nothing is written
        raise FileNotFoundError(f"{cfg.id}: {gap}. The rule takes every detection of its window, so the marker test "
                                "is not made on part of it and nothing was computed: "
                                f"{_window_todo(cfg, first, last, fires_doc['asked'])}")
    record = json.loads(json.dumps({
        "method": marker_mod.METHOD,
        "constants": marker_mod.constants(),
        "classes": {"file": HARVEST_RASTER, "sha256": marker_mod.content_hash(bands, info)},
        "harvest_settings": {k: v for k, v in harvest["settings"].items() if k != "marker"},
        "detections": {"file": DETECTIONS_FILE, "sha256": fires_mod.sha256(det_file.read_bytes()),
                       "asked": fires_doc["asked"]},
        "bbox": [float(v) for v in cfg.bbox],
        "window": [first, last],
    }))
    target = paths.analysis / MARKER_FILE
    if not force:
        try:
            old = read_json(target) if target.is_file() else None
        except (OSError, ValueError):
            old = None
        if isinstance(old, dict) and old.get("inputs") == record:
            say(f"marker: exists, skipped ({target}); its result:")
            for line in marker_mod.report(old):
                say(line)
            say(_marker_verdict(cfg, old))
            return old

    t0 = time.perf_counter()
    codes = harvest_mod.Codes.for_passes(len(passes))
    classes = {p: bands[info["descriptions"].index(p)] for p in harvest_mod.POLARIZATIONS}
    for pol, values in classes.items():
        unknown = set(np.unique(values).tolist()) - set(range(codes.not_rice + 1))
        if unknown:
            raise ValueError(f"{raster}: {pol} holds class values {sorted(unknown)} that the analysis does not write")
    crs, transform = info["crs"], info["transform"]
    region, _ = harvest_mod.cells_in_boxes([cfg.bbox], crs, transform, info["shape"])  # as the fire bars
    chosen = marker_mod.in_window(fires_doc["detections"], first, last)
    xs, ys = fires_mod.project(chosen, crs)
    numbers = marker_mod.evaluate(xs, ys, [d["date"] for d in chosen], classes, codes, passes, transform, region)
    span = marker_mod.covered(first, last, fires_doc["asked"])  # the whole window, checked above
    doc = {
        "site": cfg.id,
        "rule": marker_mod.RULE,
        "method": marker_mod.METHOD,
        "window": {"first": first, "last": last, "detections_fetched": list(fires_doc["asked"]),
                   "covered": list(span)},
        "bootstrap": {"unit": "the UTC date of a detection used", "replicates": marker_mod.REPLICATES,
                      "seed": marker_mod.SEED, "generator": "numpy.random.default_rng",
                      "draws": "integers(0, days, size=days), one call per replicate, the days in date order",
                      "percentiles": list(marker_mod.PERCENTILES), "percentile_method": marker_mod.PERCENTILE_METHOD,
                      "numpy": np.__version__},
        "grid": {"crs": crs, "cell_m": cfg.harvest.cell_m, "shape": list(info["shape"])},
        **numbers,
        # The harvested share per pass of both polarizations, as the analysis has it (rule item 5).
        "cumulative": {p: harvest["polarizations"][p]["cumulative"] for p in harvest_mod.POLARIZATIONS},
        "inputs": record,
    }
    write_json(target, doc)
    say(f"marker: {time.perf_counter() - t0:.1f} s, wrote {target}")
    for line in marker_mod.report(doc):
        say(line)
    say(_marker_verdict(cfg, doc))
    return doc


# The default descriptions below, and fires.DESCRIPTION, are what the pipeline supplies when a site has not
# written its own. They were written with AI.


def _tags(cfg: SiteConfig, layer: str, when: str, granules: list[str], enc: dict) -> dict[str, str]:
    """Metadata written into every GeoTIFF: what it shows, where it came from, how it is encoded, and
    the acknowledgement of AI-assisted code that the Space Apps rules ask for."""
    tags = {
        "TIFFTAG_SOFTWARE": f"nisar-surface-change pipeline {__version__} (AI-assisted code, see AI_USE.md)",
        "TIFFTAG_IMAGEDESCRIPTION": f"site {cfg.id}, layer {layer}, {when}",
        "SITE": cfg.id, "LAYER": layer, "WHEN": when,
        "SOURCE_GRANULES": ",".join(granules),
        "ENCODING": json.dumps(enc),
        "AI_ASSISTED": "true",
        "PROCESSING_NOTE": manifest_mod.AI_NOTE,
    }
    if cfg.is_sample and cfg.notice:
        tags["DATA_NOTICE"] = cfg.notice
    return tags


def _grid_record(grid) -> dict:
    return {"zoom": grid.zoom, "transform": list(grid.transform)[:6], "width": grid.width, "height": grid.height}


def _export_cog(path: Path, make_codes, grid, block: int, descriptions: list[str], tags: dict,
                record: dict, bounds, inputs: list[Path], force: bool,
                overview_resampling: str = "average") -> tuple[int, bool]:
    """Write one COG unless a valid copy made from the same inputs is already there. Returns (bytes, written).

    `record` lists everything that changes the pixels (grid, encoding, filter sizes, and the records of the
    processed rasters it reads). It is stored in the file, and the file is reused only when every tag,
    that record included, equals what this run would write: otherwise the app would decode an old file
    with the new encoding. `make_codes` is called only when the file is (re)written.
    """
    tags = {**tags, INPUTS_TAG: record_text(record)}
    if not force and is_fresh(path, inputs):
        existing = file_tags(path)
        if all(existing.get(k) == v for k, v in tags.items()) and not check_raster(path, bounds):
            return path.stat().st_size, False
    size = write_cog(path, make_codes(), grid, block, descriptions, tags, overview_resampling=overview_resampling)
    problems = check_raster(path, bounds)
    if problems:
        raise RuntimeError("; ".join(problems))
    return size, True


def export_site(cfg: SiteConfig, layout: Layout, force: bool = False) -> dict:
    """Warp, encode and write every layer, the click-query stack and stats; then the site.json fragment."""
    paths = SitePaths.of(cfg.id, layout)
    granule_list = load_granule_list(cfg.id, layout.sites_dir)
    dates = _dates(cfg, layout)
    sidecars = {d: _sidecar_for(paths, d)[1] for d in dates}
    lat = cfg.center_lat
    zoom = cfg.display_zoom if cfg.display_zoom is not None else choose_zoom(cfg.working_resolution_m, lat)
    grid = web_grid(cfg.bbox, zoom)
    stack_grid = web_grid(cfg.bbox, max(zoom - cfg.stack_zoom_offset, 0))
    say(f"export: display zoom {zoom} ({ground_pixel_m(zoom, lat):.1f} m ground pixels, {grid.width}x"
        f"{grid.height} px), stack zoom {stack_grid.zoom} ({ground_pixel_m(stack_grid.zoom, lat):.1f} m)")
    bounds = cfg.bbox
    bs, ch = cfg.backscatter, cfg.change
    bs_enc = encoding_json(bs.encoding.lo, bs.encoding.hi)

    proc_files = {d: paths.proc / f"{d}.tif" for d in dates}
    proc = {}
    for date in dates:
        data, info = read_geotiff(paths.proc / f"{date}.tif")
        proc[date] = (data, info)
    assert_same_grid({d: (i["crs"], i["transform"], i["shape"]) for d, (_, i) in proc.items()})
    # What each processed raster was made from; part of the record of every file made from it.
    made_from = {d: proc[d][1]["tags"].get(INPUTS_TAG) for d in dates}

    layers, stacks, series = [], [], []
    for b, pol in enumerate(cfg.polarizations):
        lid = pol.lower()
        warped, items = {}, []
        for date in dates:
            t0 = time.perf_counter()
            data, info = proc[date]
            res = resampling_for(cfg.working_resolution_m, grid, lat)
            warped[date] = warp_linear(data[b], info["transform"], info["crs"], grid, res)
            db = to_db(warped[date])
            report = clip_report(db, bs.encoding.lo, bs.encoding.hi)
            name = f"{lid}_{date}.tif"
            record = {"grid": _grid_record(grid), "block": DISPLAY_BLOCK, "resampling": res.name,
                      "band": pol, "encoding": bs_enc, "sources": [made_from[date]]}
            size, wrote = _export_cog(paths.data / name, lambda db=db: encode(db, bs.encoding.lo, bs.encoding.hi),
                                      grid, DISPLAY_BLOCK, [f"{pol} {date}"],
                                      _tags(cfg, lid, date, [sidecars[date]["granule"]], bs_enc), record, bounds,
                                      [proc_files[date]], force)
            items.append({"date": date, "url": manifest_mod.url_join(cfg.id, name), "bytes": size})
            say(f"export  {date} {lid}: {time.perf_counter() - t0:.1f} s, {mb(size)}, "
                f"{'written' if wrote else 'exists, skipped'}, {res.name} warp, {report.describe()}")
        layers.append({
            "id": lid, "title": f"{pol} backscatter", "kind": "per-date", "unit": "dB",
            "description": bs.description or (
                f"How strongly the ground sent the radar signal back, in {pol} polarization: brighter "
                "usually means rougher or wetter ground, buildings or vegetation; darker usually means "
                "smoother surfaces such as calm water."),
            "polarization": pol,
            "method": (f"Gamma-naught linear power, invalid pixels removed, averaged to "
                       f"{cfg.working_resolution_m:g} m, warped to Web Mercator, then 10*log10."),
            "encoding": bs_enc,
            # A drawing hint only: no raster or record depends on it, so changing it rewrites site.json alone.
            "display": {"min": bs.display_for(pol).min, "max": bs.display_for(pol).max,
                        "ramp": bs.display_for(pol).ramp},
            "items": items,
        })

        if ch is not None and len(dates) >= 2:
            ch_enc = encoding_json(ch.encoding.lo, ch.encoding.hi)
            pair_items = []
            for ref, sec in pairwise(dates):
                t0 = time.perf_counter()
                change = log_ratio_db(warped[ref], warped[sec], cfg.change_boxcar_px)
                report = clip_report(change, ch.encoding.lo, ch.encoding.hi)
                name = f"{lid}-change_{ref}_{sec}.tif"
                granules = [sidecars[ref]["granule"], sidecars[sec]["granule"]]
                record = {"grid": _grid_record(grid), "block": DISPLAY_BLOCK, "resampling": res.name,
                          "band": pol, "encoding": ch_enc, "boxcar_px": cfg.change_boxcar_px,
                          "sources": [made_from[ref], made_from[sec]]}
                size, wrote = _export_cog(paths.data / name,
                                          lambda change=change: encode(change, ch.encoding.lo, ch.encoding.hi),
                                          grid, DISPLAY_BLOCK, [f"{pol} change {ref} to {sec}"],
                                          _tags(cfg, f"{lid}-change", f"{ref} to {sec}", granules, ch_enc),
                                          record, bounds, [proc_files[ref], proc_files[sec]], force)
                pair_items.append({"reference": ref, "secondary": sec,
                                   "url": manifest_mod.url_join(cfg.id, name), "bytes": size})
                say(f"export  {ref}->{sec} {lid}-change: {time.perf_counter() - t0:.1f} s, {mb(size)}, "
                    f"{'written' if wrote else 'exists, skipped'}, {report.describe()}")
            layers.append({
                "id": f"{lid}-change", "title": f"{pol} backscatter change", "kind": "pair", "unit": "dB",
                "description": ch.description or (
                    f"Change in {pol} backscatter from the earlier to the later date: positive means "
                    "the ground looked brighter to the radar on the later date, negative means darker."),
                "polarization": pol,
                "method": (f"10*log10(later/earlier) of linear power on the display grid, each date first "
                           f"averaged over a {cfg.change_boxcar_px}x{cfg.change_boxcar_px}-pixel box."),
                "encoding": ch_enc,
                "display": {"min": ch.display.min, "max": ch.display.max, "ramp": ch.display.ramp,
                            "diverging": True},
                "items": pair_items,
            })

        t0 = time.perf_counter()
        res = resampling_for(cfg.working_resolution_m, stack_grid, lat)

        def cube(b=b, res=res):
            return np.stack([encode(to_db(warp_linear(proc[d][0][b], proc[d][1]["transform"], proc[d][1]["crs"],
                                                      stack_grid, res)), bs.encoding.lo, bs.encoding.hi)
                             for d in dates])

        name = f"stack_{lid}.tif"
        record = {"grid": _grid_record(stack_grid), "block": STACK_BLOCK, "resampling": res.name,
                  "stack_zoom_offset": cfg.stack_zoom_offset, "band": pol, "encoding": bs_enc,
                  "sources": [made_from[d] for d in dates]}
        size, wrote = _export_cog(paths.data / name, cube, stack_grid, STACK_BLOCK, list(dates),
                                  _tags(cfg, lid, f"{dates[0]} to {dates[-1]}",
                                        [sidecars[d]["granule"] for d in dates], bs_enc), record, bounds,
                                  list(proc_files.values()), force)
        stacks.append({"layer": lid, "url": manifest_mod.url_join(cfg.id, name), "band_dates": list(dates),
                       "encoding": bs_enc, "resolution_m": round(ground_pixel_m(stack_grid.zoom, lat), 1),
                       "bytes": size})
        say(f"export  stack {lid}: {len(dates)} bands, {time.perf_counter() - t0:.1f} s, {mb(size)}, "
            f"{'written' if wrote else 'exists, skipped'}, {res.name} warp")

        points, left_out = common_footprint_points(dates, [proc[d][0][b] for d in dates], cfg.series_min_coverage)
        series.append(backscatter_series(lid, pol, points, cfg.working_resolution_m, crs=proc[dates[0]][1]["crs"],
                                         min_coverage=cfg.series_min_coverage, left_out=left_out))
        if left_out:
            say(f"export  stats {lid}: {', '.join(left_out)} cover less than {100 * cfg.series_min_coverage:g}% "
                "of the best-covered date's pixels; published as gaps")

    harvest_ctx = None
    if cfg.harvest is not None:
        layer, harvest_series, harvest_ctx = _export_harvest(cfg, layout, sidecars, grid, force)
        layers.append(layer)
        series.extend(harvest_series)

    overlays, bars = _export_fires(cfg, layout, harvest_ctx)

    stats_changed = write_json_if_changed(paths.data / "stats.json", stats_document(cfg.id, series, bars))
    site = manifest_mod.site_fragment(cfg, granule_list, [sidecars[d] for d in dates], layers, stacks,
                                      manifest_mod.url_join(cfg.id, "stats.json"), overlays=overlays,
                                      story=[dict(step) for step in cfg.story])
    site_changed = write_json_if_changed(paths.data / manifest_mod.SITE_FILE, site)
    say(f"export: stats.json {'written' if stats_changed else 'unchanged'}, "
        f"site.json {'written' if site_changed else 'unchanged'}")
    _remove_unreferenced(paths.data, layers, stacks)
    return site


def _export_harvest(cfg: SiteConfig, layout: Layout, sidecars: dict[str, dict], grid,
                    force: bool) -> tuple[dict, list, dict]:
    """The harvest-wave layer (a static categorical-uint8 COG of the marker polarization's classes) and the two
    stats series (share of the rice area with a harvest pair by each pass, HH and HV), from the analysis; and
    the marker's class grid on the product grid, for the fire bars."""
    paths = SitePaths.of(cfg.id, layout)
    h = cfg.harvest
    out, raster = paths.analysis / HARVEST_FILE, paths.analysis / HARVEST_RASTER
    needed, proc_files, record = _harvest_inputs(cfg, layout)
    if not _analysis_current(out, raster, list(proc_files.values()), record):
        raise FileNotFoundError(f"{cfg.id}: the harvest analysis in {paths.analysis} is missing or was made from "
                                f"other settings or inputs; run `{command('analyse', '--site', cfg.id)}` first")
    doc = read_json(out)
    bands, info = read_geotiff(raster)
    codes = bands[info["descriptions"].index(h.marker)]
    entry = doc["polarizations"][h.marker]
    passes = list(h.passes)
    classes = harvest_mod.layer_classes(passes, has_fell_before=entry["classes"]["fell_before_cells"] > 0)
    unlisted = set(np.unique(codes).tolist()) - {NODATA} - {c["value"] for c in classes}
    if unlisted:
        raise ValueError(f"{raster}: {h.marker} holds class values {sorted(unlisted)} that the layer would not list")
    enc = {"type": "categorical-uint8", "nodata": NODATA, "classes": classes}

    t0 = time.perf_counter()
    name = f"{HARVEST_LAYER}.tif"
    cog_record = {"grid": _grid_record(grid), "block": DISPLAY_BLOCK, "resampling": "nearest", "overviews": "nearest",
                  "band": h.marker, "encoding": enc,
                  "analysis": hashlib.sha256(record_text(record).encode("utf-8")).hexdigest()}
    tags = _tags(cfg, HARVEST_LAYER, f"{passes[0]} to {passes[-1]}", [sidecars[d]["granule"] for d in needed], enc)
    size, wrote = _export_cog(paths.data / name,
                              lambda: warp_classes(codes, info["transform"], info["crs"], grid),
                              grid, DISPLAY_BLOCK, [f"harvest pair ({h.marker}), {passes[0]} to {passes[-1]}"], tags,
                              cog_record, cfg.bbox, [out, raster], force, overview_resampling="nearest")
    problem = manifest_mod.categorical_problem(paths.data / name, enc)
    if problem:
        raise RuntimeError(problem)
    say(f"export  {HARVEST_LAYER}: {time.perf_counter() - t0:.1f} s, {mb(size)}, "
        f"{'written' if wrote else 'exists, skipped'}, nearest warp and overviews, classes of {h.marker}")

    threshold = entry["threshold"]["threshold_db"]
    method = (f"Harvest pair of each {h.cell_m:g} m rice cell whose centre lies inside the site box, from "
              f"{h.marker}: the first pair of consecutive "
              f"passes, from {passes[1]} to {passes[2]} on, in which {h.marker} (mean of linear power over the "
              f"cell, in dB) fell by more than {abs(threshold):.2f} dB, the more negative of the "
              f"{h.false_alarm:g} quantiles of the change on stable ground in any pair and on standing rice "
              f"from {passes[0]} to {passes[1]}. Rice: HH rose by at least {doc['rice']['threshold_db']:.2f} dB "
              "from the flood to the canopy. Warped to Web Mercator by nearest neighbour.")
    sentence = _marker_sentence(cfg, paths, bands, info)
    if sentence:
        method += f" {sentence}"
    method += " Details: docs/METHODS.md."
    layer = {
        "id": HARVEST_LAYER,
        "title": h.title or "Harvest wave",
        "kind": "static",
        "unit": "",
        "description": h.description or (
            f"For each {h.cell_m:g} m rice cell, the pair of radar passes in which its {h.marker} backscatter "
            f"first fell sharply, from {harvest_mod.date_text(passes[1])} on; such a fall in this season is read as "
            "the harvest. Cells that are not rice are grey."),
        "polarization": h.marker,
        "method": method,
        "encoding": enc,
        "items": [{"url": manifest_mod.url_join(cfg.id, name), "bytes": size}],
    }
    series = [harvest_mod.share_series(doc, pol, doc["grid"]["crs"], HARVEST_LAYER)
              for pol in harvest_mod.POLARIZATIONS]
    ctx = {"codes": codes, "transform": info["transform"], "crs": info["crs"], "classes": classes,
           "cell_area_km2": doc["cells"]["cell_area_km2"], "marker": h.marker, "cell_m": h.cell_m,
           "bbox": tuple(cfg.bbox)}
    return layer, series, ctx


def _marker_sentence(cfg: SiteConfig, paths: SitePaths, bands: np.ndarray, info: dict) -> str | None:
    """The marker test's sentence for the harvest-wave layer's method text, when work/<site>/analysis/marker.json
    exists, was made from the class raster export publishes (the same content: a re-analysis that changed only
    harvest.marker keeps it) and on every day of the rule's window. Otherwise None, with a WARNING when marker.json
    is stale, unreadable or made on part of the window (as the stage could write it before it checked this). Also
    warns when the test chose another polarization than the site file's harvest.marker."""
    path = paths.analysis / MARKER_FILE
    head = f"export  {HARVEST_LAYER}:"
    if not path.is_file():
        if cfg.fires is not None:  # without a fires block there can be no marker test
            say(f"{head} no marker test yet ({path.name}), so its method text reports none; run "
                f"`{command('marker', '--site', cfg.id)}` once the fire detections are in")
        return None
    try:
        doc = read_json(path)
        made_from = doc["inputs"]["classes"]["sha256"]
        chosen = doc["decision"]["marker"]
        w = doc["window"]
        gap = marker_mod.missing(w["first"], w["last"], w["detections_fetched"])
        sentence = None if gap else marker_mod.method_sentence(doc)
    except (OSError, ValueError, KeyError, TypeError, IndexError) as exc:
        say(f"export  WARNING: {path} cannot be read ({type(exc).__name__}: {exc}), so the {HARVEST_LAYER} method "
            f"text leaves the marker test out; run `{command('marker', '--site', cfg.id, '--force')}`")
        return None
    if made_from != marker_mod.content_hash(bands, info):
        say(f"export  WARNING: {path} is stale: it was made from other harvest classes than the current "
            f"{HARVEST_RASTER}, so the {HARVEST_LAYER} method text leaves the marker test out. Run "
            f"`{command('marker', '--site', cfg.id)}` again")
        return None
    if gap:
        say(f"export  WARNING: {path} was made on part of its window: {gap}. The rule takes every detection of its "
            f"window, so the {HARVEST_LAYER} method text leaves the marker test out: "
            f"{_window_todo(cfg, w['first'], w['last'], w['detections_fetched'])}")
        return None
    mismatch = _marker_mismatch(cfg, chosen)
    if mismatch:
        say(f"export  WARNING: {mismatch}")
    det_file = paths.fires / DETECTIONS_FILE
    made_with = doc.get("inputs", {}).get("detections", {}).get("sha256")
    if det_file.is_file() and fires_mod.sha256(det_file.read_bytes()) != made_with:
        say(f"{head} note: {DETECTIONS_FILE} changed after the marker test; the method text gives the test as it was "
            f"made. To make it again on the new detections: `{command('marker', '--site', cfg.id)}`")
    say(f"{head} method text reports the marker test ({path.name}): decision "
        f"{chosen or 'left to the team'}, rule item {doc['decision']['rule_item']}")
    return sentence


def _export_fires(cfg: SiteConfig, layout: Layout, harvest_ctx: dict | None) -> tuple[list[dict], list[dict]]:
    """The fires overlay (<site>/fires.geojson and its site.json entry) and, for each period of the fires block,
    one stats.json bar of detections per km2 on each class of the harvest-wave layer. Without detections made
    with the current settings (no key yet, or the fires stage not run since a change), both are left out and
    the run goes on: the overlay is never published for days it was not fetched for."""
    paths = SitePaths.of(cfg.id, layout)
    geojson = paths.data / fires_mod.OVERLAY_FILE
    if cfg.fires is None:
        if geojson.is_file():
            geojson.unlink()
            say(f"export: removed {geojson.name}: the site file has no fires block")
        return [], []
    doc = _matching_detections(paths.fires / DETECTIONS_FILE, _fires_settings(cfg))
    if doc is None:
        if geojson.is_file():
            geojson.unlink()
        say(f"export: no fire detections fetched with the current fires settings, so the fires overlay and the fire "
            f"bars are left out; run `{command('fires', '--site', cfg.id)}` (it needs {fires_mod.ENV_KEY})")
        return [], []
    t0 = time.perf_counter()
    changed = write_json_if_changed(geojson, fires_mod.feature_collection(doc["detections"]), indent=None)
    overlay = fires_mod.overlay_entry(cfg.fires, doc, manifest_mod.url_join(cfg.id, geojson.name),
                                      geojson.stat().st_size)
    say(f"export  {geojson.name}: {doc['count']} points, UTC dates {doc['asked'][0]} to {doc['asked'][1]}, "
        f"{time.perf_counter() - t0:.1f} s, {mb(geojson.stat().st_size)}, {'written' if changed else 'unchanged'}")
    if doc["count"] > 5000:
        say(f"export  {geojson.name}: WARNING {doc['count']} points; the browser loads the whole file, keep it to a "
            "few thousand (a shorter date range or fewer sources)")
    bars = []
    if cfg.fires.periods:
        if harvest_ctx is None:  # config.py requires a harvest block with periods; kept as a guard
            raise ConfigError(f"{cfg.path}: field 'fires.periods' needs a harvest block")
        for period in cfg.fires.periods:
            bar = fires_mod.period_bar(period, doc["asked"][1], doc["detections"], harvest_ctx,
                                       doc["settings"]["sources"], HARVEST_LAYER)
            bars.append(bar)
            say(fires_mod.bar_report(bar))
    return [overlay], bars


def _remove_unreferenced(folder: Path, layers: list[dict], stacks: list[dict]) -> None:
    """Delete rasters that the new site.json no longer names (a date or pair dropped from the granule
    list), so they are not published and counted against the size budget forever."""
    urls = [item["url"] for layer in layers for item in layer["items"]] + [s["url"] for s in stacks]
    keep = {url.rsplit("/", 1)[-1] for url in urls}
    for old in sorted(folder.glob("*.tif")):
        if old.name.startswith(".") or old.name in keep:  # dot-files: another write's temporary file
            continue
        old.unlink()
        say(f"export: removed {old.name}: site.json no longer refers to it")


def manifest_stage(layout: Layout) -> Path:
    path, changed = manifest_mod.write_manifest(layout.data_dir)
    say(f"manifest: {path} {'written' if changed else 'unchanged'}")
    return path


def validate_stage(layout: Layout) -> int:
    errors = manifest_mod.validate(layout.data_dir)
    for e in errors:
        say(f"INVALID {e}")
    say("validate: OK" if not errors else f"validate: {len(errors)} problem(s)")
    return 0 if not errors else 1


def run_site(cfg: SiteConfig, layout: Layout, force: bool = False) -> int:
    t0 = time.perf_counter()
    if cfg.harvest is not None:  # a date typed wrong should stop the run now, not after fetch and process
        check_harvest_dates(cfg, [g["date"] for g in load_granule_list(cfg.id, layout.sites_dir)["granules"]],
                            "the dates of the granule list")
    fetch_site(cfg, layout, force)
    process_site(cfg, layout, force)
    analyse_site(cfg, layout, force)
    try:
        fires_site(cfg, layout, force)
    except fires_mod.FiresError as exc:
        # Nothing else depends on FIRMS: a wrong key, a rate limit or an outage must not keep the radar layers
        # from being published. (The `fires` command on its own still stops with the error.) The message never
        # holds the key (fires.FiresError).
        say(f"WARNING: fires: {exc}. The run goes on without new fire detections: export uses those fetched "
            "before with the same fires settings, if there are any, and otherwise leaves the fires overlay and "
            f"the fire bars out. Run `{command('fires', '--site', cfg.id)}` again later.")
    qa_site(cfg, layout, force)
    export_site(cfg, layout, force)
    manifest_stage(layout)
    code = validate_stage(layout)
    say(f"run {cfg.id}: {time.perf_counter() - t0:.1f} s in total")
    return code


def inspect_product(url_or_path: str, access: str, mask: bool = True) -> dict:
    stats: dict = {}
    t0 = time.perf_counter()
    with open_granule(url_or_path, access, stats=stats) as h5:
        facts = read_facts(h5)
        report = facts.to_dict()
        if mask:
            report["unique_mask_values"] = {f: unique_mask_values(h5, f) for f in facts.grids
                                            if facts.grids[f].has_mask}
    report["seconds"] = round(time.perf_counter() - t0, 2)
    report["bytes_fetched"] = stats.get("bytes_fetched", 0)
    return report


def _site_command(stage):
    def handler(args: argparse.Namespace) -> int:
        cfg = load_site(args.site)
        result = stage(cfg, default_layout(), args.force)
        return result if isinstance(result, int) else 0
    return handler


def _inspect_command(args: argparse.Namespace) -> int:
    report = inspect_product(args.product, args.access, mask=not args.skip_mask)
    print(json.dumps(report, indent=2))
    return 0


def register(subparsers) -> None:
    """Add the core commands to the pipeline's command-line parser (see pipeline/cli.py)."""
    for name, stage, text in [
        ("fetch", fetch_site, "read the site's window from every granule in its list"),
        ("process", process_site, "mask, multilook and grid-check the fetched windows"),
        ("analyse", analyse_site, "the harvest analysis, if the site file sets a harvest block: "
                                  "work/<site>/analysis/harvest.json and harvest_classes.tif"),
        ("fires", fires_site, "fetch NASA FIRMS fire detections, if the site file sets a fires block (needs "
                              "FIRMS_MAP_KEY in .env; without it, says how to get one and carries on; stops when "
                              "FIRMS fails, where `run` warns and goes on)"),
        ("marker", marker_site, "the marker test: which polarization, HH or HV, should draw the harvest map, by the "
                                "rule fixed before any fire data was analysed (docs/METHODS.md, section 6); writes "
                                "work/<site>/analysis/marker.json and changes no setting. Needs analyse, and fires "
                                "run once every day of the window has ended in UTC; not part of run"),
        ("qa", qa_site, "write histogram and thumbnail PNGs for each date under work/<site>/qa/, and run the "
                        "stable-target check if the site file sets stable_target"),
        ("export", export_site, "write the web-ready COGs, stats.json and site.json"),
        ("run", run_site, "all stages for one site, then manifest and validate"),
    ]:
        p = subparsers.add_parser(name, help=text, description=text)
        p.add_argument("--site", required=True, help="site id: the name of pipeline/sites/<id>.yaml")
        p.add_argument("--force", action="store_true", help="redo outputs even if they exist and validate")
        p.set_defaults(func=_site_command(stage))

    p = subparsers.add_parser("manifest", help="assemble web/public/data/manifest.json from every site.json")
    p.set_defaults(func=lambda args: (manifest_stage(default_layout()), 0)[1])
    p = subparsers.add_parser("validate", help="check the manifest, stats and every raster against the contract")
    p.set_defaults(func=lambda args: validate_stage(default_layout()))

    p = subparsers.add_parser("inspect", help="print what is inside a product file (local path or URL)")
    p.add_argument("product", help="local .h5 path or https URL taken from the catalog")
    p.add_argument("--access", choices=["public", "earthdata"], default="public")
    p.add_argument("--skip-mask", action="store_true",
                   help="do not read the whole mask (it is large in real files)")
    p.set_defaults(func=_inspect_command)


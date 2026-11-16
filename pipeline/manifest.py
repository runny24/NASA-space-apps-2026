"""Assemble web/public/data/manifest.json from each site's site.json, and validate everything.

The manifest is the only thing the web app knows about the data (docs/DATA_CONTRACT.md). Validation
runs the JSON Schemas in contract/ and then the numbered rules at the end of DATA_CONTRACT.md that a
schema cannot express. Each problem message starts with the rule number, so a failing check is easy
to look up.
"""

from __future__ import annotations

import json
import re
import subprocess
from datetime import UTC, datetime
from itertools import pairwise
from pathlib import Path

import jsonschema
import numpy as np
import rasterio

from pipeline import __version__
from pipeline.encode import NODATA
from pipeline.export import check_raster
from pipeline.hints import command
from pipeline.paths import REPO_ROOT, contract_dir
from pipeline.rasters import read_json, write_json_if_changed

MANIFEST = "manifest.json"
SITE_FILE = "site.json"
DATE_PATTERN = re.compile(r"^[0-9]{4}-[0-9]{2}-[0-9]{2}$")
AI_NOTE = ("The processing code of this pipeline was written with AI assistance (Anthropic Claude, in "
           "Claude Code); see AI_USE.md. The data values are computed by that code from the products "
           "listed for each site; no value is generated or invented by AI.")


def utc_now() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def _git(*args: str) -> str | None:
    """Output of a read-only git command in the repository, or None when git is missing or fails."""
    try:
        out = subprocess.run(["git", *args], cwd=REPO_ROOT, capture_output=True, text=True, timeout=10,
                             check=False)
    except (OSError, subprocess.SubprocessError):
        return None
    return out.stdout if out.returncode == 0 else None


def git_commit() -> str | None:
    """Short hash of the checked-out commit, if git is available (read-only).

    "+uncommitted" is appended when `git status --porcelain -- pipeline contract` lists anything: a modified,
    staged, deleted or untracked (not ignored) file anywhere under pipeline/ or contract/. That includes the
    site files and granule lists in pipeline/sites/ and the tests, not only the code, because then the commit
    alone does not hold everything that made the data. It is also appended when git status fails.
    """
    head = (_git("rev-parse", "--short", "HEAD") or "").strip()
    if not head:
        return None
    status = _git("status", "--porcelain", "--", "pipeline", "contract")
    if status is None or status.strip():  # unknown counts as uncommitted: never claim more than we know
        return head + "+uncommitted"
    return head


def generator_block() -> dict:
    block = {"name": "nisar-surface-change pipeline", "version": __version__, "ai_assisted": True, "note": AI_NOTE}
    commit = git_commit()
    if commit:
        block["git_commit"] = commit
    return block


def url_join(*parts: str) -> str:
    """Manifest URLs always use forward slashes, whatever the operating system."""
    return "/".join(p.strip("/") for p in parts)


def acquisition(sidecar: dict) -> dict:
    """One entry of a site's `dates`, from what fetch recorded. Dates, times and polarizations come
    from the file itself; name, version and release from the granule list."""
    facts = sidecar["facts"]
    entry = {
        "date": sidecar["date"],
        "datetime": sidecar["datetime"],
        "granule": sidecar["granule"],
        "version": sidecar["version"],
        "release": sidecar["release"],
        "pols": facts["grids"][sidecar["frequency"]]["polarizations"],
    }
    if sidecar.get("bandwidth_mhz") is not None:
        entry["bandwidth_mhz"] = sidecar["bandwidth_mhz"]
    if sidecar.get("full_frame") is not None:
        entry["full_frame"] = sidecar["full_frame"]
    if facts.get("mission_id") and facts["mission_id"].upper() != "NISAR":
        entry["notes"] = (f"Acquired by {facts['mission_id']} {facts['instrument']}, not by NISAR; "
                          f"product specification {facts['spec_version']}.")
    return entry


def site_fragment(cfg, granule_list: dict, sidecars: list[dict], layers: list[dict], stacks: list[dict],
                  stats_url: str, overlays: list[dict] | None = None, story: list[dict] | None = None) -> dict:
    """This site's object in the manifest (`#/$defs/site` in contract/manifest.schema.json). `overlays` and
    `story` are written only when there are some."""
    releases = sorted({s["release"] for s in sidecars})
    collections = sorted({s["collection"] for s in sidecars if s.get("collection")})
    grid = sidecars[0]["facts"]["grids"][sidecars[0]["frequency"]]
    source = {
        "product": f"NISAR L2 {cfg.product}",
        "collection": ", ".join(collections),
        "release": releases[0] if len(releases) == 1 else "mixed",
        "stack": granule_list["stack"],
        "direction": granule_list["direction"],
        "frequency": cfg.frequency,
        "posting_m": grid["x_spacing"],
        "working_resolution_m": cfg.working_resolution_m,
        "native_epsg": grid["epsg"],
        "citation": cfg.citation,
    }
    site = {"id": cfg.id, "title": cfg.title}
    if cfg.summary:
        site["summary"] = cfg.summary
    site["is_sample"] = cfg.is_sample
    if cfg.notice:
        site["notice"] = cfg.notice
    site.update({
        "bounds": list(cfg.bbox),
        "source": source,
        "dates": [acquisition(s) for s in sidecars],
        "missing_passes": granule_list.get("missing_passes", []),
        "layers": layers,
        "stacks": stacks,
        "stats": stats_url,
    })
    if overlays:
        site["overlays"] = overlays
    if story:
        site["story"] = story
    return site


def assemble(data_dir: Path) -> dict:
    sites = []
    for site_file in _site_files(data_dir):
        sites.append(read_json(site_file))
    # The app opens the first site when the address names none, so real sites come before sample sites.
    sites.sort(key=lambda s: (bool(s.get("is_sample")), s.get("id", "")))
    return {"schema": 1, "generated_at": utc_now(), "generator": generator_block(), "sites": sites}


def _site_files(data_dir: Path) -> list[Path]:
    """Every <site>/site.json, skipping folders whose name starts with a dot (not sites)."""
    return sorted(p for p in data_dir.glob(f"*/{SITE_FILE}") if not p.parent.name.startswith("."))


def write_manifest(data_dir: Path) -> tuple[Path, bool]:
    """Write manifest.json; returns (path, whether it changed)."""
    path = data_dir / MANIFEST
    return path, write_json_if_changed(path, assemble(data_dir))


def _schema(name: str) -> dict:
    return read_json(contract_dir() / name)


def schema_errors(document: dict, schema_name: str) -> list[str]:
    validator = jsonschema.Draft202012Validator(_schema(schema_name), format_checker=jsonschema.FormatChecker())
    return [f"schema {schema_name}: at /{'/'.join(str(p) for p in err.absolute_path)}: {err.message}"
            for err in sorted(validator.iter_errors(document), key=lambda e: list(e.absolute_path))]


def _resolve(url: str, data_dir: Path) -> Path | None:
    """Local file a manifest URL points at, or None for an absolute http(s) URL."""
    if url.startswith(("https://", "http://")):
        return None
    return data_dir.joinpath(*url.split("/"))


def rule_errors(manifest: dict, data_dir: Path, check_files: bool = True) -> list[str]:
    """The numbered rules of docs/DATA_CONTRACT.md that JSON Schema cannot express."""
    errors: list[str] = []
    sites = manifest.get("sites", [])

    ids = [s.get("id") for s in sites]
    for dup in sorted({i for i in ids if ids.count(i) > 1}):
        errors.append(f"rule 1: site id {dup!r} appears more than once")

    for site in sites:
        sid = site.get("id")
        where = f"site {sid}"
        layer_ids = [layer.get("id") for layer in site.get("layers", [])]
        for dup in sorted({i for i in layer_ids if layer_ids.count(i) > 1}):
            errors.append(f"rule 1: {where}: layer id {dup!r} appears more than once")

        dates = [d.get("date") for d in site.get("dates", [])]
        if any(a >= b for a, b in pairwise(dates)):
            errors.append(f"rule 2: {where}: dates must be strictly ascending with one entry per date: {dates}")
        date_set = set(dates)

        for layer in site.get("layers", []):
            lid = layer.get("id")
            for item in layer.get("items", []):
                if layer.get("kind") == "per-date" and item.get("date") not in date_set:
                    errors.append(f"rule 3: {where}: layer {lid}: date {item.get('date')} is not in dates")
                if layer.get("kind") == "pair":
                    ref, sec = item.get("reference"), item.get("secondary")
                    if ref not in date_set or sec not in date_set:
                        errors.append(f"rule 3: {where}: layer {lid}: pair {ref}/{sec} not both in dates")
                    elif not ref < sec:
                        errors.append(f"rule 3: {where}: layer {lid}: reference {ref} is not earlier than {sec}")

        per_date = {layer.get("id") for layer in site.get("layers", []) if layer.get("kind") == "per-date"}
        for stack in site.get("stacks", []):
            band_dates = stack.get("band_dates", [])
            if stack.get("layer") not in per_date:
                errors.append(f"rule 4: {where}: stack layer {stack.get('layer')!r} is not a per-date layer")
            if any(a >= b for a, b in pairwise(band_dates)):
                errors.append(f"rule 4: {where}: stack band_dates are not ascending: {band_dates}")
            if not set(band_dates) <= date_set:
                errors.append(f"rule 4: {where}: stack band_dates {sorted(set(band_dates) - date_set)} not in dates")
            path = _resolve(stack.get("url", ""), data_dir)
            if check_files and path is not None and path.is_file():
                with rasterio.open(path) as src:
                    if src.count != len(band_dates):
                        errors.append(f"rule 4: {where}: stack file has {src.count} bands but "
                                      f"{len(band_dates)} band_dates")

        encodings = [(f"layer {layer.get('id')}", layer.get("encoding") or {}) for layer in site.get("layers", [])]
        encodings += [(f"stack {s.get('layer')}", s.get("encoding") or {}) for s in site.get("stacks", [])]
        for label, encoding in encodings:
            if encoding.get("type") == "categorical-uint8":
                values = [c.get("value") for c in encoding.get("classes", [])]
                for dup in sorted({v for v in values if values.count(v) > 1}):
                    errors.append(f"rule 10: {where}: {label}: class value {dup} is listed more than once")

        for gap in site.get("missing_passes", []):
            if gap.get("date") in date_set:
                errors.append(f"rule 5: {where}: missing pass {gap.get('date')} is also in dates")

        release = site.get("source", {}).get("release")
        if release != "mixed":
            for acq in site.get("dates", []):
                if acq.get("release") != release:
                    errors.append(f"rule 6: {where}: {acq.get('date')} has release {acq.get('release')!r} "
                                  f"but the site says {release!r} (use 'mixed' if releases differ)")

        is_sample = bool(site.get("is_sample", False))
        if is_sample and (not site.get("notice") or release != "sample"):
            errors.append(f"rule 7: {where}: is_sample is true, so notice must be present and release 'sample'")
        if not is_sample and release == "sample":
            errors.append(f"rule 7: {where}: release is 'sample' but is_sample is not true")

        overlay_ids = [o.get("id") for o in site.get("overlays", [])]
        for dup in sorted({i for i in overlay_ids if overlay_ids.count(i) > 1}):
            errors.append(f"rule 11: {where}: overlay id {dup!r} appears more than once")
        errors.extend(story_errors(site))

        if check_files:
            errors.extend(_file_errors(site, data_dir))
            for overlay in site.get("overlays", []):
                errors.extend(overlay_errors(site, overlay, data_dir))
    return errors


# How far outside the site's bounds an overlay point may lie, in degrees (about 1 km): FIRMS selects detections
# by their pixel centre, and coordinates are rounded to 5 decimals.
OVERLAY_MARGIN_DEG = 0.01


def overlay_errors(site: dict, overlay: dict, data_dir: Path) -> list[str]:
    """Rule 11 for one overlay: its file exists and is a GeoJSON FeatureCollection of Point features inside the
    site's bounds (widened by OVERLAY_MARGIN_DEG); with date_property, every feature has a YYYY-MM-DD date there,
    within date_range when that is given; with count, the number of features matches it."""
    where = f"rule 11: site {site.get('id')}: overlay {overlay.get('id')}"
    url = overlay.get("url", "")
    if "\\" in url:
        return [f"{where}: URL {url!r} must use forward slashes"]
    path = _resolve(url, data_dir)
    if path is None:
        return []  # hosted elsewhere; see the TODO in _file_errors
    if not path.is_file():
        return [f"{where}: {url} does not exist"]
    try:
        doc = read_json(path)
    except (OSError, ValueError) as exc:
        return [f"{where}: {url} is not readable JSON ({exc})"]
    if not isinstance(doc, dict) or doc.get("type") != "FeatureCollection" or not isinstance(doc.get("features"), list):
        return [f"{where}: {url} is not a GeoJSON FeatureCollection"]
    w, s, e, n = site.get("bounds", (-180, -90, 180, 90))
    m = OVERLAY_MARGIN_DEG
    prop, date_range = overlay.get("date_property"), overlay.get("date_range")
    problems: dict[str, list[int]] = {}

    def note(kind: str, i: int) -> None:
        problems.setdefault(kind, []).append(i)

    for i, feature in enumerate(doc["features"]):
        geometry = feature.get("geometry") if isinstance(feature, dict) else None
        coords = geometry.get("coordinates") if isinstance(geometry, dict) else None
        if (not isinstance(feature, dict) or feature.get("type") != "Feature" or not isinstance(geometry, dict)
                or geometry.get("type") != "Point" or not isinstance(coords, list) or len(coords) < 2
                or not all(isinstance(c, (int, float)) and not isinstance(c, bool) for c in coords[:2])):
            note("is not a Point feature with [longitude, latitude]", i)
            continue
        lon, lat = coords[0], coords[1]
        if not (w - m <= lon <= e + m and s - m <= lat <= n + m):
            note(f"lies outside the site's bounds (with a {m:g} degree margin)", i)
        if prop:
            value = (feature.get("properties") or {}).get(prop)
            if not isinstance(value, str) or not DATE_PATTERN.match(value):
                note(f"has no YYYY-MM-DD date in property {prop!r}", i)
            elif date_range and not date_range[0] <= value <= date_range[1]:
                note(f"has a date outside date_range {date_range}", i)
    errors = [f"{where}: {len(idx)} feature(s) {kind} (first: feature {idx[0]})" for kind, idx in problems.items()]
    if overlay.get("count") is not None and overlay["count"] != len(doc["features"]):
        errors.append(f"{where}: count is {overlay['count']} but {url} holds {len(doc['features'])} features")
    return errors


def story_errors(site: dict) -> list[str]:
    """Rule 12: every story step names layers, dates and overlays that exist in the site."""
    where = f"rule 12: site {site.get('id')}"
    layers = {layer.get("id"): layer for layer in site.get("layers", [])}
    overlays = {o.get("id") for o in site.get("overlays", [])}
    errors: list[str] = []
    ids = [step.get("id") for step in site.get("story", [])]
    for dup in sorted({i for i in ids if ids.count(i) > 1}):
        errors.append(f"{where}: story step id {dup!r} appears more than once")
    for step in site.get("story", []):
        label = f"{where}: story step {step.get('id')}"
        lid = step.get("layer")
        has_date, has_pair = "date" in step, "reference" in step or "secondary" in step
        if lid is None:
            if has_date or has_pair:
                errors.append(f"{label}: names a date or a pair but no layer")
        elif lid not in layers:
            errors.append(f"{label}: layer {lid!r} is not a layer of the site")
        else:
            layer = layers[lid]
            kind, items = layer.get("kind"), layer.get("items", [])
            if has_date and kind != "per-date":
                errors.append(f"{label}: gives a date, but layer {lid} is {kind}, not per-date")
            elif has_date and step["date"] not in {item.get("date") for item in items}:
                errors.append(f"{label}: layer {lid} has no file for {step['date']}")
            if has_pair and kind != "pair":
                errors.append(f"{label}: gives a pair, but layer {lid} is {kind}, not pair")
            elif has_pair and (step.get("reference"), step.get("secondary")) not in {
                    (item.get("reference"), item.get("secondary")) for item in items}:
                errors.append(f"{label}: layer {lid} has no file for the pair {step.get('reference')} to "
                              f"{step.get('secondary')}")
        for oid in step.get("overlays", []):
            if oid not in overlays:
                errors.append(f"{label}: overlay {oid!r} is not an overlay of the site")
    return errors


def bar_errors(site: dict, stats: dict) -> list[str]:
    """Rule 13: a bar's layer is a layer of the site, and every category's class is one of that layer's classes."""
    where = f"rule 13: site {site.get('id')}"
    layers = {layer.get("id"): layer for layer in site.get("layers", [])}
    errors: list[str] = []
    ids = [bar.get("id") for bar in stats.get("bars", [])]
    for dup in sorted({i for i in ids if ids.count(i) > 1}):
        errors.append(f"{where}: bar id {dup!r} appears more than once")
    for bar in stats.get("bars", []):
        label = f"{where}: bar {bar.get('id')}"
        lid, values = bar.get("layer"), None
        if lid is not None:
            layer = layers.get(lid)
            encoding = (layer or {}).get("encoding") or {}
            if layer is None:
                errors.append(f"{label}: layer {lid!r} is not a layer of the site")
            elif encoding.get("type") == "categorical-uint8":
                values = {c.get("value") for c in encoding.get("classes", [])}
        for category in bar.get("categories", []):
            if "class" not in category:
                continue
            if lid is None:
                errors.append(f"{label}: category {category.get('label')!r} gives a class but the bar names no layer")
            elif lid in layers and values is None:
                errors.append(f"{label}: category {category.get('label')!r} gives a class but layer {lid} is not "
                              "categorical")
            elif values is not None and category["class"] not in values:
                errors.append(f"{label}: class {category['class']} ({category.get('label')!r}) is not a class of "
                              f"layer {lid}")
    return errors


def _file_errors(site: dict, data_dir: Path) -> list[str]:
    where = f"site {site.get('id')}"
    errors: list[str] = []
    urls = [("stats", site["stats"])] if site.get("stats") else []
    rasters = [(f"layer {layer.get('id')}", item.get("url", ""), layer.get("encoding"))
               for layer in site.get("layers", []) for item in layer.get("items", [])]
    rasters += [(f"stack {s.get('layer')}", s.get("url", ""), s.get("encoding")) for s in site.get("stacks", [])]
    bounds = tuple(site.get("bounds", ())) or None
    for label, url in urls + [(label, url) for label, url, _ in rasters]:
        if "\\" in url:
            errors.append(f"rule 8: {where}: {label}: URL {url!r} must use forward slashes")
            continue
        path = _resolve(url, data_dir)
        if path is None:
            continue  # TODO(builder): if data is ever hosted elsewhere, check absolute URLs with a HEAD request
        if not path.is_file():
            errors.append(f"rule 8: {where}: {label}: {url} does not exist")
    for label, url, encoding in rasters:
        path = _resolve(url, data_dir)
        if path is None or not path.is_file():
            continue
        for problem in check_raster(path, bounds=bounds):
            rule = "rule 9" if "does not overlap" in problem else "rule 8"
            errors.append(f"{rule}: {where}: {label}: {problem}")
        problem = encoding_problem(path, encoding)
        if problem:
            errors.append(f"rule 8: {where}: {label}: {problem}; run "
                          f"`{command('export', '--site', str(site.get('id')))}` again")
        problem = categorical_problem(path, encoding)
        if problem:
            errors.append(f"rule 10: {where}: {label}: {problem}")
    return errors


def _footprints(fine: int, coarse: int) -> tuple[np.ndarray, np.ndarray]:
    """Along one axis of an overview that turns `fine` pixels into `coarse` ones: for each coarse pixel, the
    first index and the end index (exclusive) of the fine pixels under it. Each covers fine / coarse of them,
    which is not a whole number when a side is odd."""
    ratio = fine / coarse
    i = np.arange(coarse)
    return (np.floor(i * ratio).astype(np.intp).clip(0, fine),
            np.ceil((i + 1) * ratio).astype(np.intp).clip(0, fine))


def _present(fine: np.ndarray, value: int, shape: tuple[int, int]) -> np.ndarray:
    """For each pixel of an overview of `shape` made from the band `fine`: whether `value` occurs among the fine
    pixels under it (counted with a summed-area table)."""
    table = np.zeros((fine.shape[0] + 1, fine.shape[1] + 1), dtype=np.int64)
    table[1:, 1:] = (fine == value).cumsum(axis=0).cumsum(axis=1)
    r0, r1 = _footprints(fine.shape[0], shape[0])
    c0, c1 = _footprints(fine.shape[1], shape[1])
    count = table[np.ix_(r1, c1)] - table[np.ix_(r0, c1)] - table[np.ix_(r1, c0)] + table[np.ix_(r0, c0)]
    return count > 0


def _strays(full: np.ndarray, finer: np.ndarray | None, overview: np.ndarray) -> int:
    """The pixels of an overview (one band) that hold a value, not nodata, found neither among the pixels under
    them at full resolution nor among those under them in the next finer overview (`finer`, None for the
    first overview)."""
    strays = 0
    for value in np.unique(overview).tolist():
        if value == NODATA:
            continue
        found = _present(full, value, overview.shape)
        if finer is not None:
            found |= _present(finer, value, overview.shape)
        strays += int(((overview == value) & ~found).sum())
    return strays


def categorical_problem(path: Path, encoding: dict | None) -> str | None:
    """For a categorical-uint8 encoding, what makes the file show something that is not one of its classes:

    - a pixel value, at full resolution or in any overview, that is neither nodata nor a listed class (the app
      could not label it);
    - an overview pixel whose value occurs nowhere under it, neither in the next finer level nor at full
      resolution. Averaging classes makes such pixels even when the average is itself a listed class (the mean
      of classes 4 and 6 is 5), so this is what catches an overview built by averaging. A nearest-neighbour
      overview takes every pixel from the pixels under it: in the level before it (GDAL builds each level from
      the one before) or, built another way, at full resolution. "Under it" is the overview pixel's exact
      footprint, which is not a whole number of pixels when a side is odd.

    None when the encoding is not categorical or the file has neither problem."""
    if not encoding or encoding.get("type") != "categorical-uint8":
        return None
    allowed = {NODATA} | {c.get("value") for c in encoding.get("classes", [])}
    found: dict[int, str] = {}
    with rasterio.open(path) as src:
        levels = len(src.overviews(1))
        full = src.read()
    for value in np.unique(full).tolist():
        found.setdefault(value, "full resolution")
    finer, strays = None, []
    for level in range(levels):
        with rasterio.open(path, overview_level=level) as src:
            overview = src.read()
        for value in np.unique(overview).tolist():
            found.setdefault(value, f"overview {level + 1}")
        n = sum(_strays(full[b], None if finer is None else finer[b], overview[b]) for b in range(overview.shape[0]))
        if n:
            strays.append(f"{n} pixel(s) of overview {level + 1}")
        finer = overview
    problems = []
    foreign = sorted(v for v in found if v not in allowed)
    if foreign:
        problems.append("holds pixel values that are not among its classes: "
                        + ", ".join(f"{v} (first seen at {found[v]})" for v in foreign))
    if strays:
        problems.append(f"{', '.join(strays)} hold a class that none of the pixels under them holds, as when "
                        "classes are averaged; build the overviews by nearest neighbour")
    return f"{path.name}: " + "; ".join(problems) if problems else None


def encoding_problem(path: Path, expected: dict | None) -> str | None:
    """The app decodes a file with the manifest's encoding only. A file made with another encoding (for
    example left over from an earlier config) would show wrong numbers without any error, so its own
    ENCODING tag must say the same thing."""
    with rasterio.open(path) as src:
        text = src.tags().get("ENCODING")
    if text is None:
        return f"{path.name}: has no ENCODING tag, so nothing shows which encoding it was written with"
    try:
        found = json.loads(text)
    except ValueError:
        return f"{path.name}: ENCODING tag is not readable JSON: {text!r}"
    if found != expected:
        return (f"{path.name}: ENCODING tag {found} differs from the manifest's {expected}, so the app would "
                "decode it wrongly")
    return None


def validate(data_dir: Path) -> list[str]:
    """Everything the `validate` command checks. Empty list = all good."""
    path = data_dir / MANIFEST
    if not path.is_file():
        return [f"{path} does not exist; run `{command('manifest')}` first"]
    manifest = read_json(path)
    errors = schema_errors(manifest, "manifest.schema.json")
    if errors:
        return errors  # the rules assume the shape the schema guarantees
    for site in manifest["sites"]:
        if site.get("stats"):
            stats_path = _resolve(site["stats"], data_dir)
            if stats_path is not None and stats_path.is_file():
                stats = read_json(stats_path)
                problems = schema_errors(stats, "stats.schema.json")
                errors += [f"site {site['id']}: {e}" for e in problems]
                if not problems:
                    errors += bar_errors(site, stats)
    on_disk = {p.parent.name: read_json(p) for p in _site_files(data_dir)}
    in_manifest = {s["id"]: s for s in manifest["sites"]}
    if on_disk != in_manifest:
        errors.append(f"manifest.json is out of date with the site.json files (folders {sorted(on_disk)}, "
                      f"manifest {sorted(in_manifest)}); run `{command('manifest')}`")
    return errors + rule_errors(manifest, data_dir)

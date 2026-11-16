"""EXPLORATORY, ADDED AFTER SEEING THE DATA. Not part of the method fixed in the brief; it changes no definition and
no number of results.json.

Why: the run's offset guard (optical_check.offset_check) could not check three of the usable dates (2026-10-08,
2026-10-23, 2026-11-02): the scene classification gives no vegetation pixel in the window on them. On those dates
the share of red values below 1000 over all pixels was also low (9.4 %, 2.2 %, 0.1 %, against 30 to 83 % on the
other usable dates). Two explanations fit that: the values still hold the +1000 offset (a wrong unit, a bug to fix),
or the scenes are bright in red (haze, smoke or thin cloud that the scene classification did not flag; or bare
ground). This looks at three things, after the run:

1. dark targets, read again from the scenes: the red and NIR values of water (SCL 6) and the 1st percentile and
   median of all pixels, per usable date;
2. the change of the cell-mean values (from the run's cache) between a date and its clear neighbours, by quarter of
   the window: a missed offset adds the same 1000 to every pixel of both bands, haze does not;
3. steps 5 to 9 again (optical_check.analyse, unchanged) without the dates the guard could not check (fewer than
   OFFSET_CHECK_MIN_PIXELS vegetation pixels, the guard's own rule, fixed before the run): a sensitivity look, not
   a result of the method.

    python research/optical_check/exploratory_unit_check.py    # writes exploratory_results.json next to this file

AI-written (Claude Opus 5.5, Anthropic).
"""

from __future__ import annotations

import datetime as dt
import json

import numpy as np
import optical_check as oc

PAIRS = (("2026-10-08", "2026-10-03"), ("2026-10-08", "2026-10-18"), ("2026-10-23", "2026-10-18"),
         ("2026-10-23", "2026-10-28"), ("2026-11-02", "2026-10-28"), ("2026-11-02", "2026-11-07"))


def stats(values: np.ndarray) -> dict | None:
    v = np.asarray(values)
    if v.size == 0:
        return None
    p1, med = (float(x) for x in np.percentile(v, (1, 50)))
    return {"n": int(v.size), "p1": p1, "median": med, "share_below_1000": float((v < oc.OFFSET_DN).mean())}


def dark_targets(day: str, items: list[dict], inputs: dict) -> dict:
    with oc._env():
        granules = [oc.read_granule(it, inputs["transform"], inputs["shape"]) for it in items]
    red, nir, scl, _ = oc.mosaic([(g["red"], g["nir"], g["scl"]) for g in granules])
    data = (red != oc.NODATA_DN) & (nir != oc.NODATA_DN)
    water = data & (scl == 6)
    return {"water_scl6": {"red": stats(red[water]), "nir": stats(nir[water])},
            "all_pixels": {"red": stats(red[data]), "nir": stats(nir[data])}}


def cell_mean_dn(scene: dict) -> tuple[np.ndarray, np.ndarray]:
    count = scene["count"].astype(np.float64)
    ok = oc.has_value(scene["count"])
    red = np.where(ok, scene["sum_red"] / np.maximum(count, 1), np.nan)
    nir = np.where(ok, scene["sum_nir"] / np.maximum(count, 1), np.nan)
    return red, nir


def by_quarter(diff: np.ndarray) -> list[list[float | None]]:
    rows, cols = diff.shape
    out = []
    for i in range(4):
        row = []
        for j in range(4):
            part = diff[i * rows // 4:(i + 1) * rows // 4, j * cols // 4:(j + 1) * cols // 4]
            row.append(round(float(np.nanmedian(part)), 1) if np.isfinite(part).any() else None)
        out.append(row)
    return out


def main() -> dict:
    inputs = oc.read_inputs()
    cat = oc.catalog(inputs["site_box"], refresh=False)
    by_day, _ = oc.granules_by_day(cat["items"])
    scenes = {day: oc.load_or_read_scene(day, items, inputs["transform"], inputs["shape"])
              for day, items in by_day.items()}
    if not all(s["cached"] for s in scenes.values()):
        raise SystemExit("run optical_check.py run first: this works on its cache")
    run = json.loads((oc.HERE / "results.json").read_text(encoding="utf-8"))
    usable_days = run["analysis"]["usable_days"]

    # 1. Dark targets on every usable date.
    dark = {}
    for day in usable_days:
        dark[day] = dark_targets(day, by_day[day], inputs)
        d = dark[day]
        print(f"{day}  vegetation px {scenes[day]['meta']['vegetation_pixels']:>8}  water NIR median "
              f"{d['water_scl6']['nir']['median']:.0f} ({d['water_scl6']['nir']['share_below_1000']:.1%} below 1000)  "
              f"all red p1 {d['all_pixels']['red']['p1']:.0f} median {d['all_pixels']['red']['median']:.0f}  "
              f"all NIR p1 {d['all_pixels']['nir']['p1']:.0f} median {d['all_pixels']['nir']['median']:.0f}",
              flush=True)

    # 2. The change of the cell means between a date and a clear neighbour.
    shifts = []
    for a, b in PAIRS:
        ra, na = cell_mean_dn(scenes[a])
        rb, nb = cell_mean_dn(scenes[b])
        shifts.append({"day": a, "minus": b, "red_median": float(np.nanmedian(ra - rb)),
                       "nir_median": float(np.nanmedian(na - nb)), "red_by_quarter": by_quarter(ra - rb),
                       "nir_by_quarter": by_quarter(na - nb)})
        print(f"{a} minus {b}: cell-mean red {shifts[-1]['red_median']:+.0f}, NIR {shifts[-1]['nir_median']:+.0f}; "
              f"red by quarter {shifts[-1]['red_by_quarter']}")

    # 3. Steps 5 to 9 without the dates the offset guard could not check.
    kept = [s for day, s in scenes.items() if s["meta"]["vegetation_pixels"] >= oc.OFFSET_CHECK_MIN_PIXELS]
    left_out = [day for day, s in scenes.items() if s["meta"]["vegetation_pixels"] < oc.OFFSET_CHECK_MIN_PIXELS]
    sens = oc.analyse(kept, inputs["classes"], inputs["stable"], inputs["radar_by_pass"])
    print("sensitivity: dates left out", left_out, "usable", sens["usable_days"])
    for name, th in sens["thresholds"].items():
        print(f"  {name} = {th['threshold']}")
        tab = sens["tables"][name]
        if tab is None:
            continue
        for r in tab["no_harvest_seen"]:
            print(f"    {r['polarization']} {r['day_kind']} {r['day']}: cut {r.get('share_cut')}")
        for r in tab["cut_share_by_pass"]:
            print(f"    pass {r['pass']} {r['side']} {r['day']}: cut {r.get('share_cut')}")
    sensitivity = {"rule": ("the run's scenes without the dates with fewer than OFFSET_CHECK_MIN_PIXELS (1000) "
                            "vegetation pixels (SCL 4) in the window, the offset guard's own rule; then "
                            "optical_check.analyse unchanged (thresholds recomputed by the brief's rules on the "
                            "remaining usable dates)"),
                   "dates_left_out": left_out, "usable_days": sens["usable_days"], "pass_days": sens["pass_days"],
                   "thresholds": sens["thresholds"],
                   "tables": {name: (None if tab is None else {k: tab[k] for k in ("no_harvest_seen",
                                                                                    "cut_share_by_pass",
                                                                                    "pair_ending_on_pass",
                                                                                    "cut_day_counts")})
                              for name, tab in sens["tables"].items()}}
    return {"label": "EXPLORATORY, ADDED AFTER SEEING THE DATA; not a result of the method fixed in the brief",
            "generator": "research/optical_check/exploratory_unit_check.py, " + oc.GENERATOR.split(", ", 1)[1],
            "run_at": dt.datetime.now(dt.UTC).isoformat(timespec="seconds"),
            "vegetation_pixels": {day: s["meta"]["vegetation_pixels"] for day, s in scenes.items()},
            "dark_targets": dark, "cell_mean_shifts": shifts, "sensitivity_without_unchecked_dates": sensitivity,
            "credit": "Contains modified Copernicus Sentinel data 2026"}


if __name__ == "__main__":
    result = main()
    path = oc.HERE / "exploratory_results.json"
    path.write_text(json.dumps(oc._jsonable(result), indent=1) + "\n", encoding="utf-8")
    print(f"wrote {path}")

"""Fire detections (pipeline/fires.py, the fires stage, the fires overlay and the fire bars), the validate rules
for overlays, story steps and bars (11 to 13), and the display per polarization.

No test touches the network: FIRMS is a fake that answers from CSV text built here. Every coordinate is a
SYNTHETIC position on the synthetic grid of synth.py (about 118.0 W 34.8 N, chosen for the tests, not a place
of the team's), and every detection is invented for the tests.
"""

from __future__ import annotations

import copy
import datetime as dt
import io
import re
import shutil
import urllib.error
from types import SimpleNamespace

import numpy as np
import pytest
import yaml
from affine import Affine
from pyproj import Transformer

from pipeline import fires as fires_mod
from pipeline.config import load_site
from pipeline.manifest import MANIFEST, bar_errors, rule_errors, schema_errors, story_errors, validate
from pipeline.qa import target_pixels
from pipeline.rasters import read_geotiff, read_json, write_json
from pipeline.stages import (
    DETECTIONS_FILE,
    HARVEST_RASTER,
    export_site,
    fires_site,
    manifest_stage,
    run_site,
    validate_stage,
)
from pipeline.tests.conftest import DATES, SITE_ID, make_synthetic_site
from pipeline.tests.synth import SynthGrid
from pipeline.tests.test_end_to_end import H_DATES, _copy_run, _edit_site, _harvest_site

KEY = "SYNTHETICKEY0123456789abcdefABCD"  # a made-up key; the tests check it never leaves the request
NOW = dt.datetime(2026, 11, 14, 12, 0, tzinfo=dt.UTC)
HEADER = ("latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,confidence,version,bright_ti5,frp,"
          "daynight")
_TO_LONLAT = Transformer.from_crs("EPSG:32611", "EPSG:4326", always_xy=True)


def lonlat(row: float, col: float) -> tuple[float, float]:
    """lon, lat of a position (row, column) of the SYNTHETIC grid (20 m pixels from 400000, 3857000, UTM 11N)."""
    return _TO_LONLAT.transform(400000.0 + 20.0 * col, 3857000.0 - 20.0 * row)


def det(where: tuple[float, float], date: str, time: str = "0842", sat: str = "N20", conf: str = "n",
        frp: str = "3.5", dn: str = "D") -> dict:
    lon, lat = where
    return {"lat": lat, "lon": lon, "date": date, "time": time, "sat": sat, "conf": conf, "frp": frp, "dn": dn}


def csv_text(rows: list[dict]) -> str:
    """A CSV in the columns of FIRMS's VIIRS attribute table, with SYNTHETIC rows."""
    lines = [HEADER] + [f"{r['lat']:.5f},{r['lon']:.5f},331.2,0.39,0.36,{r['date']},{r['time']},{r['sat']},{r['conf']},"
                        f"2.0NRT,291.4,{r['frp']},{r['dn']}" for r in rows]
    return "\n".join(lines) + "\n"


class FakeFirms:
    """Stands in for fires.http_get: answers area API requests from SYNTHETIC rows by source and records them."""

    def __init__(self, rows: dict[str, list[dict]] | None = None, fail_on: int | None = None):
        self.rows, self.fail_on, self.requests, self.now = rows or {}, fail_on, [], NOW

    def __call__(self, url: str) -> bytes:
        head, rest = url.split("/api/area/csv/")
        assert head == "https://firms.modaps.eosdis.nasa.gov"
        key, source, area, days, first = rest.split("/")
        assert key == KEY and 1 <= int(days) <= fires_mod.MAX_DAYS
        assert len(area.split(",")) == 4
        self.requests.append((source, first, int(days)))
        if self.fail_on is not None and len(self.requests) == self.fail_on:
            raise OSError(f"connection reset while reading {url}")
        last = (dt.date.fromisoformat(first) + dt.timedelta(days=int(days) - 1)).isoformat()
        return csv_text([r for r in self.rows.get(source, []) if first <= r["date"] <= last]).encode()


@pytest.fixture
def firms(monkeypatch):
    """Install a FakeFirms (and a fixed clock, and the key) for one test."""
    def install(rows=None, fail_on=None) -> FakeFirms:
        fake = FakeFirms(rows, fail_on)
        monkeypatch.setattr(fires_mod, "http_get", fake)
        monkeypatch.setattr(fires_mod, "utc_now", lambda: fake.now)
        monkeypatch.setenv(fires_mod.ENV_KEY, KEY)
        return fake
    return install


# Steps 1 to 4: plan, request, parse, merge ------------------------------------------------------------------

def test_chunks_cover_every_day_in_requests_of_at_most_the_limit():
    first, last = dt.date(2026, 9, 15), dt.date(2026, 11, 13)
    plan = fires_mod.chunks(first, last)
    assert all(1 <= days <= 5 for _, days in plan) and len(plan) == 12
    days = [start + dt.timedelta(days=i) for start, n in plan for i in range(n)]
    assert days == [first + dt.timedelta(days=i) for i in range((last - first).days + 1)]  # each day once, in order
    assert fires_mod.chunks(first, first) == [(first, 1)]
    assert fires_mod.chunks(first, first + dt.timedelta(days=6)) == [(first, 5), (first + dt.timedelta(days=5), 2)]


def test_the_last_day_asked_is_yesterday_until_the_end_has_passed():
    assert fires_mod.last_day("2026-11-20", dt.date(2026, 11, 14)) == dt.date(2026, 11, 13)
    assert fires_mod.last_day("2026-11-10", dt.date(2026, 11, 14)) == dt.date(2026, 11, 10)


def test_request_url_has_the_documented_shape():
    url = fires_mod.request_url(KEY, "VIIRS_NOAA20_NRT", (-118.1, 34.7, -117.9, 34.9), dt.date(2026, 9, 15), 5)
    assert url == (f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{KEY}/VIIRS_NOAA20_NRT/"
                   "-118.1,34.7,-117.9,34.9/5/2026-09-15")
    with pytest.raises(ValueError, match="1 to 5 days"):
        fires_mod.request_url(KEY, "VIIRS_NOAA20_NRT", (-118.1, 34.7, -117.9, 34.9), dt.date(2026, 9, 15), 6)


SAMPLE_CSV = (  # SYNTHETIC rows in FIRMS's columns, plus a column the parser does not use
    "latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,"
    "bright_ti5,frp,daynight\n"
    "34.81234,-118.01234,340.2,0.4,0.37,2026-09-16,18,N20,VIIRS,n,2.0NRT,290.1,4.25,N\n"
    "34.80001,-118.02002,367.0,0.5,0.41,2026-09-16,0842,N21,VIIRS,h,2.0NRT,300.3,12.5,D\n"
    "34.79999,-118.03003,333.3,0.4,0.37,2026-09-17,2041,N,VIIRS,l,2.0NRT,288.8,,N\n")


def test_parse_reads_the_documented_columns():
    rows = fires_mod.parse_csv(SAMPLE_CSV.encode(), "VIIRS_NOAA20_NRT")
    assert rows[0] == {"lat": 34.81234, "lon": -118.01234, "date": "2026-09-16", "time_utc": "00:18",
                       "satellite": "NOAA-20", "confidence": "nominal", "frp_mw": 4.25, "daynight": "night",
                       "source": "VIIRS_NOAA20_NRT"}
    assert [(r["time_utc"], r["satellite"], r["confidence"], r["daynight"]) for r in rows[1:]] == [
        ("08:42", "NOAA-21", "high", "day"), ("20:41", "Suomi NPP", "low", "night")]
    assert rows[2]["frp_mw"] is None  # an empty FRP stays empty, it is not made 0
    assert fires_mod.parse_csv((HEADER + "\n").encode(), "VIIRS_NOAA20_NRT") == []  # no detection is an answer


@pytest.mark.parametrize("bad, message", [
    ("north,-118.0,1,1,1,2026-09-16,0842,N20,n,2,1,1,D", "line 2 of the CSV cannot be read"),
    ("34.8,-118.0,1,1,1,16/09/2026,0842,N20,n,2,1,1,D", "line 2"),
    ("34.8,-118.0,1,1,1,2026-09-16,2575,N20,n,2,1,1,D", "acq_time '2575' is not a time of day"),
    ("134.8,-118.0,1,1,1,2026-09-16,0842,N20,n,2,1,1,D", "is not a place"),
])
def test_a_row_that_cannot_be_read_stops_the_run(bad, message):
    with pytest.raises(fires_mod.FiresError, match=re.escape(message)):
        fires_mod.parse_csv(f"{HEADER}\n{bad}\n".encode(), "VIIRS_NOAA20_NRT")


def test_an_answer_that_is_not_detections_is_refused_without_the_key(monkeypatch):
    monkeypatch.setattr(fires_mod, "http_get", lambda url: f"Invalid MAP_KEY. (request {url})".encode())
    with pytest.raises(fires_mod.FiresError) as err:
        fires_mod.fetch_chunk(KEY, "VIIRS_NOAA20_NRT", (-118.1, 34.7, -117.9, 34.9), dt.date(2026, 9, 15), 5)
    text = str(err.value)
    assert "Invalid MAP_KEY" in text and "not a CSV of fire detections" in text and "VIIRS_NOAA20_NRT" in text
    assert KEY not in text and "[MAP_KEY]" in text


def _http_error(url: str) -> Exception:
    return urllib.error.HTTPError(url, 403, f"Forbidden: {url}", {}, io.BytesIO(f"refused {url}".encode()))


@pytest.mark.parametrize("make_error", [_http_error, lambda url: OSError(f"timed out reading {url}"),
                                        lambda url: ValueError(f"bad URL {url}")])
def test_request_errors_never_carry_the_key(monkeypatch, make_error):
    def failing(url):
        raise make_error(url)
    monkeypatch.setattr(fires_mod, "http_get", failing)
    with pytest.raises(fires_mod.FiresError) as err:
        fires_mod.fetch_chunk(KEY, "VIIRS_NOAA21_NRT", (-118.1, 34.7, -117.9, 34.9), dt.date(2026, 9, 15), 5)
    assert KEY not in str(err.value) and "VIIRS_NOAA21_NRT 2026-09-15..2026-09-19" in str(err.value)
    # The original error (whose text holds the URL) is not chained, so even a full traceback cannot show it.
    assert err.value.__cause__ is None and err.value.__context__ is None


def test_the_key_is_read_from_the_environment():
    assert fires_mod.map_key({}) == (None, fires_mod.NO_KEY)
    assert fires_mod.map_key({"FIRMS_MAP_KEY": "  "}) == (None, fires_mod.NO_KEY)
    assert fires_mod.map_key({"FIRMS_MAP_KEY": f" {KEY} "}) == (KEY, None)
    key, problem = fires_mod.map_key({"FIRMS_MAP_KEY": "abc def/ghi"})
    assert key is None and "abc" not in problem and "not used" in problem
    assert "https://firms.modaps.eosdis.nasa.gov/api/map_key/" in fires_mod.NO_KEY and ".env" in fires_mod.NO_KEY


def test_the_same_detection_from_two_sources_is_kept_once():
    a = fires_mod.parse_csv(csv_text([det((-118.0, 34.8), "2026-09-16"), det((-118.0, 34.8), "2026-09-16", "0843"),
                                      det((-118.0, 34.8), "2026-09-16")]).encode(), "VIIRS_NOAA20_NRT")
    b = fires_mod.parse_csv(csv_text([det((-118.0, 34.8), "2026-09-16", frp="9.9"),  # same pixel, pass, satellite
                                      det((-118.0, 34.8), "2026-09-16", sat="N21")]).encode(), "VIIRS_NOAA20_SP")
    kept, dropped = fires_mod.merge([("VIIRS_NOAA20_NRT", a), ("VIIRS_NOAA20_SP", b)])
    assert dropped == {"VIIRS_NOAA20_NRT": 1, "VIIRS_NOAA20_SP": 1}
    assert len(kept) == 3 and [d["source"] for d in kept].count("VIIRS_NOAA20_SP") == 1
    assert next(d for d in kept if d["time_utc"] == "08:42" and d["satellite"] == "NOAA-20")["frp_mw"] == 3.5


# Steps 5 and 6: attribution and density ---------------------------------------------------------------------

def test_attribution_is_exact_on_a_hand_built_grid():
    # 6 x 6 cells of 100 m: row 0 has no data, then class 1 in columns 0-2 and class 2 in columns 3-5.
    classes = np.zeros((6, 6), dtype=np.uint8)
    classes[1:, :3], classes[1:, 3:] = 1, 2
    transform = Affine(100.0, 0.0, 0.0, 0.0, -100.0, 600.0)
    # A: the 375 m square spans x 50..425 and, from the top, 50..425: columns and rows take 50, 100, 100, 100, 25 m.
    # B: half of the square lies west of the grid. C: the whole square lies off the grid.
    result = fires_mod.attribute([237.5, 0.0, -1000.0], [362.5, 300.0, 300.0], classes, transform, [1, 2, 3])
    side2 = 375.0 ** 2
    assert result["by_class"][1] == pytest.approx(325 * 250 / side2 + 0.5, rel=1e-12)
    assert result["by_class"][2] == pytest.approx(325 * 125 / side2, rel=1e-12)
    assert result["by_class"][3] == 0.0  # a listed class without cells
    assert result["no_data"] == pytest.approx(50 * 375 / side2, rel=1e-12)
    assert result["outside"] == pytest.approx(1.5, rel=1e-12)
    total = sum(result["by_class"].values()) + result["no_data"] + result["outside"]
    assert total == pytest.approx(3.0, rel=1e-12) and result["detections"] == 3
    # Cells outside the region (here columns 4 and 5, as if outside the site box) take nothing: A's 25 m strip on
    # column 4 goes to "outside".
    region = np.ones((6, 6), dtype=bool)
    region[:, 4:] = False
    clipped = fires_mod.attribute([237.5], [362.5], classes, transform, [1, 2], region=region)
    assert clipped["by_class"][2] == pytest.approx(325 * 100 / side2, rel=1e-12)
    assert clipped["by_class"][1] == pytest.approx(325 * 250 / side2, rel=1e-12)
    assert clipped["outside"] == pytest.approx(25 * 375 / side2, rel=1e-12)
    assert clipped["no_data"] == pytest.approx(50 * 350 / side2, rel=1e-12)  # row 0, columns 0 to 3 only
    with pytest.raises(ValueError, match=r"values \[2\] that are not listed"):
        fires_mod.attribute([237.5], [362.5], classes, transform, [1])


def test_poisson_interval_matches_known_values():
    assert fires_mod.poisson_interval(0) == (0.0, pytest.approx(-np.log(0.025), rel=1e-9))  # 3.6889
    assert fires_mod.poisson_interval(1) == (pytest.approx(-np.log(0.975), rel=1e-9), pytest.approx(5.5716, abs=1e-4))
    assert fires_mod.poisson_interval(10) == (pytest.approx(4.7954, abs=1e-4), pytest.approx(18.3904, abs=1e-4))
    lo2, hi2 = fires_mod.poisson_interval(2)
    lo, hi = fires_mod.poisson_interval(2.5)  # a shared count is not a whole number
    lo3, hi3 = fires_mod.poisson_interval(3)
    assert lo2 < lo < lo3 and hi2 < hi < hi3


def test_density_of_a_class_without_area_is_null():
    assert fires_mod.density(0.0, 0.0) == {"value": None, "low": None, "high": None}
    d = fires_mod.density(10.0, 2.0)
    assert (d["value"], d["low"], d["high"]) == (5.0, pytest.approx(4.7954 / 2, abs=1e-4),
                                                 pytest.approx(18.3904 / 2, abs=1e-4))


def test_period_text():
    assert fires_mod.period_text("2026-11-05", "2026-11-14") == "5 to 14 November 2026"
    assert fires_mod.period_text("2026-10-29", "2026-11-04") == "29 October to 4 November 2026"
    assert fires_mod.period_text("2026-12-30", "2027-01-02") == "30 December 2026 to 2 January 2027"
    assert fires_mod.period_text("2026-11-05", "2026-11-05") == "5 November 2026"


# The fires stage on a small SYNTHETIC site ------------------------------------------------------------------

SMALL_FIRES = {"start": "2026-09-01", "end": "2026-09-12", "sources": ["VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT"]}
INSIDE = lonlat(300, 300)  # the middle of the synthetic grid, inside the site box


def _small_site(root, fires: dict | None = None):
    return make_synthetic_site(root, site={"fires": {**SMALL_FIRES, **(fires or {})}})


def _cfg(layout):
    return load_site(SITE_ID, layout.sites_dir)


def _fires_dir(layout):
    return layout.site_work(SITE_ID) / "fires"


def test_fires_stage_respects_the_day_limit_and_resumes_from_the_cache(tmp_path, firms, capsys):
    fake = firms({"VIIRS_NOAA20_NRT": [det(INSIDE, "2026-09-02"), det(INSIDE, "2026-09-11", "0901")],
                  "VIIRS_NOAA21_NRT": [det(INSIDE, "2026-09-07", "0800", sat="N21")]})
    layout = _small_site(tmp_path)
    doc = fires_site(_cfg(layout), layout)
    plan = [("2026-09-01", 5), ("2026-09-06", 5), ("2026-09-11", 2)]
    assert sorted(fake.requests) == sorted((s, d, n) for s in SMALL_FIRES["sources"] for d, n in plan)
    assert doc["count"] == 3 and doc["asked"] == ["2026-09-01", "2026-09-12"]
    assert [d["date"] for d in doc["detections"]] == ["2026-09-02", "2026-09-07", "2026-09-11"]
    assert {d["source"] for d in doc["detections"]} == {"VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT"}
    out = _fires_dir(layout) / DETECTIONS_FILE
    made = out.stat().st_mtime_ns
    fake.requests.clear()
    assert fires_site(_cfg(layout), layout) == doc  # every request settled: nothing is asked again
    assert fake.requests == [] and out.stat().st_mtime_ns == made
    assert "0 fetched, 3 from the cache" in capsys.readouterr().out
    fires_site(_cfg(layout), layout, force=True)  # --force asks again for everything
    assert len(fake.requests) == 6


def test_recent_days_are_asked_again_and_days_not_ended_wait(tmp_path, firms, capsys):
    fake = firms()
    layout = _small_site(tmp_path, {"start": "2026-11-08", "end": "2026-11-20"})
    doc = fires_site(_cfg(layout), layout)  # on 14 November: up to 13 November
    assert doc["asked"] == ["2026-11-08", "2026-11-13"]
    assert sorted(fake.requests) == sorted((s, d, n) for s in SMALL_FIRES["sources"]
                                           for d, n in [("2026-11-08", 5), ("2026-11-13", 1)])
    assert "the days after 2026-11-13 (to 2026-11-20) have not ended yet" in capsys.readouterr().out
    fake.requests.clear()
    fires_site(_cfg(layout), layout)  # the same day: 8-12 November had settled, 13 November had not
    assert sorted(fake.requests) == [(s, "2026-11-13", 1) for s in SMALL_FIRES["sources"]]
    fake.requests.clear()
    fake.now = NOW + dt.timedelta(days=10)
    doc = fires_site(_cfg(layout), layout)
    assert doc["asked"] == ["2026-11-08", "2026-11-20"]
    assert sorted(fake.requests) == sorted((s, d, n) for s in SMALL_FIRES["sources"]
                                           for d, n in [("2026-11-13", 5), ("2026-11-18", 3)])


def test_a_cached_answer_settles_by_utc_date_and_is_refused_when_changed(tmp_path, monkeypatch):
    box, source, first = (-118.1, 34.7, -117.9, 34.9), "VIIRS_NOAA20_NRT", dt.date(2026, 11, 8)
    body = csv_text([det(INSIDE, "2026-11-09")]).encode()
    # Last day 12 November. Asked on 13 November: too soon. Asked at 00:30 UTC on 14 November: settled, because
    # the rule counts UTC dates (two days after the last day), not hours since it ended.
    for fetched, status in [(dt.datetime(2026, 11, 13, 23, 59, tzinfo=dt.UTC), "recent"),
                            (dt.datetime(2026, 11, 14, 0, 30, tzinfo=dt.UTC), "settled")]:
        monkeypatch.setattr(fires_mod, "utc_now", lambda fetched=fetched: fetched)
        fires_mod.save_chunk(tmp_path, KEY, source, box, first, 5, body, 1)
        assert fires_mod.chunk_status(tmp_path, source, box, first, 5, dt.date(2026, 11, 20)) == status
    # A cached CSV that changed after its record was written (same size, other content) is not reused.
    csv = tmp_path / f"{fires_mod.chunk_name(source, first, 5)}.csv"
    csv.write_bytes(body.replace(b"2026-11-09", b"2026-11-10"))
    assert csv.stat().st_size == len(body)
    assert fires_mod.chunk_status(tmp_path, source, box, first, 5, dt.date(2026, 11, 20)) == "missing"


def test_an_interrupted_fetch_resumes_with_what_is_missing(tmp_path, firms):
    fake = firms(fail_on=4)
    layout = _small_site(tmp_path)
    with pytest.raises(fires_mod.FiresError, match="connection reset") as err:
        fires_site(_cfg(layout), layout)
    assert KEY not in str(err.value)
    assert len(list(_fires_dir(layout).glob("*.csv"))) == 3 and not (_fires_dir(layout) / DETECTIONS_FILE).exists()
    done = set(fake.requests[:3])
    fake.fail_on, fake.requests = None, []
    fires_site(_cfg(layout), layout)
    assert len(fake.requests) == 3 and not done & set(fake.requests)


def test_the_key_never_reaches_output_files_or_errors(tmp_path, firms, capsys, caplog):
    firms({"VIIRS_NOAA20_NRT": [det(INSIDE, "2026-09-02")]})
    layout = _small_site(tmp_path)
    fires_site(_cfg(layout), layout)
    captured = capsys.readouterr()
    assert KEY not in captured.out + captured.err + caplog.text
    files = [p for p in tmp_path.rglob("*") if p.is_file()]
    assert all(KEY not in p.name and KEY.encode() not in p.read_bytes() for p in files)
    record = read_json(_fires_dir(layout) / "VIIRS_NOAA20_NRT_2026-09-01_5d.json")
    assert record["request"].startswith("https://firms.modaps.eosdis.nasa.gov/api/area/csv/[MAP_KEY]/VIIRS_NOAA20_NRT/")


def test_without_a_key_the_stage_says_how_to_get_one_and_carries_on(tmp_path, firms, monkeypatch, capsys):
    fake = firms()
    monkeypatch.delenv(fires_mod.ENV_KEY)
    layout = _small_site(tmp_path)
    capsys.readouterr()
    assert fires_site(_cfg(layout), layout) is None
    lines = [line for line in capsys.readouterr().out.splitlines() if line]
    assert len(lines) == 1 and lines[0].startswith("fires: skipped: no FIRMS_MAP_KEY is set")
    assert fires_mod.KEY_URL in lines[0] and fake.requests == []


def test_without_a_key_the_cache_and_earlier_detections_are_used(tmp_path, firms, monkeypatch, capsys):
    fake = firms({"VIIRS_NOAA20_NRT": [det(INSIDE, "2026-09-02")]})
    layout = _small_site(tmp_path)
    first = fires_site(_cfg(layout), layout)
    monkeypatch.delenv(fires_mod.ENV_KEY)
    fake.requests = []
    capsys.readouterr()
    assert fires_site(_cfg(layout), layout) == first  # every request is cached and settled: no key needed
    assert "skipped" not in capsys.readouterr().out
    (_fires_dir(layout) / "VIIRS_NOAA21_NRT_2026-09-06_5d.csv").unlink()  # a cached answer lost
    assert fires_site(_cfg(layout), layout) == first and fake.requests == []
    assert "Keeping the detections fetched before" in capsys.readouterr().out
    _edit_site(layout, fires={**SMALL_FIRES, "end": "2026-09-20"})  # more days wanted, but no key to ask with
    assert fires_site(_cfg(layout), layout) is None  # other settings: the old detections do not match them
    assert "fires: skipped: no FIRMS_MAP_KEY" in capsys.readouterr().out


def test_a_key_that_cannot_be_one_is_not_used_or_shown(tmp_path, firms, monkeypatch, capsys):
    fake = firms()
    monkeypatch.setenv(fires_mod.ENV_KEY, "SECRET VALUE")
    layout = _small_site(tmp_path)
    assert fires_site(_cfg(layout), layout) is None
    out = capsys.readouterr().out
    assert "SECRET" not in out and "not used" in out and fake.requests == []


def test_new_sources_or_box_ask_only_for_what_they_change(tmp_path, firms):
    fake = firms()
    layout = _small_site(tmp_path)
    fires_site(_cfg(layout), layout)
    fake.requests = []
    _edit_site(layout, fires={**SMALL_FIRES, "sources": [*SMALL_FIRES["sources"], "VIIRS_NOAA20_SP"]})
    doc = fires_site(_cfg(layout), layout)
    assert {s for s, _, _ in fake.requests} == {"VIIRS_NOAA20_SP"} and len(fake.requests) == 3
    assert list(doc["sources"]) == [*SMALL_FIRES["sources"], "VIIRS_NOAA20_SP"]
    fake.requests = []
    w, s, e, n = _cfg(layout).bbox
    _edit_site(layout, bbox=[w, s, round(e - 0.01, 5), n])
    fires_site(_cfg(layout), layout)  # cached answers were for another box
    assert len(fake.requests) == 9


def test_points_outside_the_box_are_left_out_and_counted(tmp_path, firms, capsys):
    w, s, e, n = SynthGrid().lonlat_bounds(margin_px=60)
    firms({"VIIRS_NOAA20_NRT": [det(INSIDE, "2026-09-02"), det((e + 0.05, (s + n) / 2), "2026-09-02", "0843")]})
    layout = _small_site(tmp_path)
    doc = fires_site(_cfg(layout), layout)
    assert doc["count"] == 1 and doc["outside_box"] == 1 and doc["sources"]["VIIRS_NOAA20_NRT"]["rows"] == 2
    assert "1 outside the box left out" in capsys.readouterr().out


# The whole chain on the SYNTHETIC harvest site, with fires ---------------------------------------------------

E2E_FIRES = {"start": "2026-10-01", "end": "2026-10-20",
             "sources": ["VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT", "VIIRS_NOAA20_SP"],
             "periods": [["2026-10-06", "2026-10-17"], ["2026-10-18", "2026-10-20"]]}
P3, ST, TW, ND = lonlat(370, 160), lonlat(370, 340), lonlat(130, 130), lonlat(300, 520)  # see H_REGIONS
_W, _S, _E, _N = SynthGrid().lonlat_bounds(margin_px=60)
E2E_ROWS = {
    "VIIRS_NOAA20_NRT": [det(P3, "2026-10-08"), det(P3, "2026-10-09", "0824"), det(TW, "2026-10-07", "2010", dn="N"),
                         det(ND, "2026-10-11", "0830"), det(P3, "2026-10-02", "0850"),
                         det((_E + 0.05, (_S + _N) / 2), "2026-10-09", "0824")],  # outside the site box
    "VIIRS_NOAA21_NRT": [det(P3, "2026-10-08", "0752", sat="N21"), det(ST, "2026-10-10", "0800", sat="N21"),
                         det(TW, "2026-10-12", "0805", sat="N21", conf="h")],
    "VIIRS_NOAA20_SP": [det(P3, "2026-10-08")],  # the same detection as the first NRT row
}
# In the first period: three on rice harvested in the third pair (class 3), one on standing rice (class 4), two
# on the town (class 6, not rice), one on columns outside the swath (no data). 2 October is outside the period.
E2E_EXPECTED_N = {3: 3, 4: 1, 6: 2, 1: 0, 2: 0, 5: 0}


@pytest.fixture(scope="module")
def fires_run(tmp_path_factory):
    layout = _harvest_site(tmp_path_factory.mktemp("fires"))
    _edit_site(layout, fires=E2E_FIRES)
    with pytest.MonkeyPatch.context() as mp:
        fake = FakeFirms(E2E_ROWS)
        mp.setattr(fires_mod, "http_get", fake)
        mp.setattr(fires_mod, "utc_now", lambda: fake.now)
        mp.setenv(fires_mod.ENV_KEY, KEY)
        code = run_site(load_site(SITE_ID, layout.sites_dir), layout)
    assert code == 0
    return SimpleNamespace(layout=layout, fake=fake, data=layout.site_data(SITE_ID))


def _site(run) -> dict:
    return read_json(run.data / "site.json")


def test_fires_site_runs_end_to_end_and_validates(fires_run):
    assert validate(fires_run.layout.data_dir) == []
    assert len(fires_run.fake.requests) == 3 * 4  # 20 days in 4 requests, for each of 3 sources
    doc = read_json(_fires_dir(fires_run.layout) / DETECTIONS_FILE)
    assert doc["count"] == 8 and doc["outside_box"] == 1
    assert doc["sources"] == {"VIIRS_NOAA20_NRT": {"rows": 6, "duplicates": 0, "kept": 5},
                              "VIIRS_NOAA21_NRT": {"rows": 3, "duplicates": 0, "kept": 3},
                              "VIIRS_NOAA20_SP": {"rows": 1, "duplicates": 1, "kept": 0}}
    files = [p for p in fires_run.layout.data_dir.parent.rglob("*") if p.is_file()]
    assert all(KEY.encode() not in p.read_bytes() for p in files)


def test_overlay_entry_and_points_follow_the_contract(fires_run):
    overlay = _site(fires_run)["overlays"][0]
    assert schema_errors({"schema": 1, "generated_at": "2026-11-14T00:00:00Z",
                          "generator": {"name": "t", "ai_assisted": True, "note": "t"},
                          "sites": [_site(fires_run)]}, "manifest.schema.json") == []
    assert (overlay["id"], overlay["kind"], overlay["url"]) == ("fires", "points", f"{SITE_ID}/fires.geojson")
    assert overlay["date_property"] == "date" and overlay["date_range"] == ["2026-10-01", "2026-10-20"]
    assert overlay["count"] == 8 and overlay["color"] == "#d55e00" and overlay["credit"] == fires_mod.CREDIT
    assert overlay["credit"].startswith("We acknowledge the use of data and/or imagery from NASA's Fire Information")
    assert overlay["description"] == fires_mod.DESCRIPTION
    assert "not a fire's exact place, its size or a count" in overlay["description"]
    assert "between passes or under thick smoke" in overlay["description"]
    assert {f["name"] for f in overlay["fields"]} == set(fires_mod.DETECTION_FIELDS)
    assert next(f for f in overlay["fields"] if f["name"] == "frp_mw")["unit"] == "MW"
    assert "1 dropped" in overlay["method"] and "Left out: 1 detection" in overlay["method"]
    points = read_json(fires_run.data / "fires.geojson")
    assert points["type"] == "FeatureCollection" and len(points["features"]) == overlay["count"]
    assert overlay["bytes"] == (fires_run.data / "fires.geojson").stat().st_size
    for feature in points["features"]:
        lon, lat = feature["geometry"]["coordinates"]
        assert (lon, lat) == (round(lon, 5), round(lat, 5)) and feature["geometry"]["type"] == "Point"
        assert set(feature["properties"]) == set(fires_mod.DETECTION_FIELDS)
        assert "2026-10-01" <= feature["properties"]["date"] <= "2026-10-20"
    first = points["features"][0]["properties"]
    assert first == {"date": "2026-10-02", "time_utc": "08:50", "satellite": "NOAA-20", "confidence": "nominal",
                     "frp_mw": 3.5, "daynight": "day", "source": "VIIRS_NOAA20_NRT"}


def _brute_force(codes: np.ndarray, region: np.ndarray, transform: Affine, x: float, y: float,
                 steps: int = 150) -> dict:
    """The share of a 375 m square on each value of the cells in the region, by sampling the square on a 2.5 m
    lattice (independent of fires.attribute)."""
    offsets = (np.arange(steps) + 0.5) * 375.0 / steps - 187.5
    xs, ys = np.meshgrid(x + offsets, y + offsets)
    cols = np.floor((xs - transform.c) / transform.a).astype(int)
    rows = np.floor((transform.f - ys) / -transform.e).astype(int)
    on = (rows >= 0) & (rows < codes.shape[0]) & (cols >= 0) & (cols < codes.shape[1])
    on[on] &= region[rows[on], cols[on]]
    values = codes[rows[on], cols[on]]
    return {int(v): float((values == v).sum()) / steps ** 2 for v in np.unique(values)}


def test_fire_bars_share_detections_by_class_area(fires_run):
    stats = read_json(fires_run.data / "stats.json")
    first, second = stats["bars"]
    assert first["id"] == "fires-2026-10-06-2026-10-17" and first["layer"] == "harvest-wave"
    assert first["unit"] == "detections per km2" and "6 to 17 October 2026" in first["title"]
    layer = next(la for la in _site(fires_run)["layers"] if la["id"] == "harvest-wave")
    assert [c["class"] for c in first["categories"]] == [c["value"] for c in layer["encoding"]["classes"]]
    assert [c["label"] for c in first["categories"]] == [c["label"] for c in layer["encoding"]["classes"]]

    bands, info = read_geotiff(fires_run.layout.site_work(SITE_ID) / "analysis" / HARVEST_RASTER)
    codes = bands[0]  # HH, the marker
    region, _ = target_pixels(tuple(_site(fires_run)["bounds"]), info["crs"], info["transform"], codes.shape)
    assert 0 < region.sum() < region.size  # the product grid reaches a little beyond the site box
    to_utm = Transformer.from_crs("EPSG:4326", info["crs"], always_xy=True)
    in_period = [r for rows in E2E_ROWS.values() for r in rows
                 if "2026-10-06" <= r["date"] <= "2026-10-17" and _W <= r["lon"] <= _E]
    in_period = list({(r["sat"], r["date"], r["time"]): r for r in in_period}.values())  # the duplicate once
    assert len(in_period) == 7
    expected: dict[int, float] = {}
    for r in in_period:
        x, y = to_utm.transform(round(r["lon"], 5), round(r["lat"], 5))
        for v, share in _brute_force(codes, region, info["transform"], x, y).items():
            expected[v] = expected.get(v, 0.0) + share
    for c in first["categories"]:
        area = int(((codes == c["class"]) & region).sum()) * 0.01  # 100 m cells inside the box, product grid
        assert area > 0
        mass = c["value"] * area
        assert mass == pytest.approx(expected.get(c["class"], 0.0), abs=0.02), c["label"]
        assert c["n"] == E2E_EXPECTED_N[c["class"]] == round(mass)
        low, high = fires_mod.poisson_interval(mass)
        assert (c["low"], c["high"]) == (pytest.approx(low / area), pytest.approx(high / area))
    no_data = float(re.search(r"Of their area, ([\d.]+) % fell on cells without a class", first["region"]).group(1))
    assert no_data == pytest.approx(100 * expected.get(0, 0.0) / 7, abs=0.1) and no_data > 10
    assert "7 detections" in first["region"] and "lower bound on the real uncertainty" in first["method"]
    assert "chi2(0.025; 2n)/2 to chi2(0.975; 2n+2)/2" in first["method"]
    # The shared count is rarely whole, and for such a count the formula is not an exact interval: say so.
    assert "Garwood's chi-square formula" in first["method"] and "(exact for whole counts)" in first["method"]
    assert "exact 95 % Poisson interval" not in first["method"]
    # The bars are always on screen, so each names FIRMS in its title and ends its method with FIRMS's
    # acknowledgement, the same sentence as the overlay's credit.
    for bar in (first, second):
        assert "VIIRS fire detections (NASA FIRMS) per km2" in bar["title"]
        assert bar["method"].endswith(" Details: docs/METHODS.md, section 6. Credit: " + fires_mod.CREDIT)
    # The second period has no detection: zero density, with an interval that is not zero.
    for c in second["categories"]:
        assert c["value"] == 0.0 and c["n"] == 0 and c["low"] == 0.0 and c["high"] > 0


def test_a_second_run_asks_nothing_and_changes_nothing(fires_run, tmp_path, monkeypatch):
    layout = _copy_run(fires_run.layout, tmp_path)
    fake = FakeFirms(E2E_ROWS)
    monkeypatch.setattr(fires_mod, "http_get", fake)
    monkeypatch.setattr(fires_mod, "utc_now", lambda: fake.now)
    monkeypatch.setenv(fires_mod.ENV_KEY, KEY)
    files = [p for root in (layout.work_dir, layout.data_dir) for p in root.rglob("*") if p.is_file()]
    before = {p: (p.stat().st_mtime_ns, p.stat().st_size) for p in files}
    assert run_site(load_site(SITE_ID, layout.sites_dir), layout) == 0
    assert fake.requests == []
    assert {p: (p.stat().st_mtime_ns, p.stat().st_size) for p in files} == before


def test_run_without_a_key_publishes_no_overlay_and_carries_on(fires_run, tmp_path, monkeypatch, capsys):
    layout = _copy_run(fires_run.layout, tmp_path)
    shutil.rmtree(_fires_dir(layout))
    monkeypatch.delenv(fires_mod.ENV_KEY, raising=False)
    monkeypatch.setattr(fires_mod, "http_get", FakeFirms())  # would fail the key assertion if it were called
    assert run_site(load_site(SITE_ID, layout.sites_dir), layout) == 0
    out = capsys.readouterr().out
    assert "fires: skipped: no FIRMS_MAP_KEY is set" in out
    assert "the fires overlay and the fire bars are left out" in out
    site = read_json(layout.site_data(SITE_ID) / "site.json")
    assert "overlays" not in site and not (layout.site_data(SITE_ID) / "fires.geojson").exists()
    assert "bars" not in read_json(layout.site_data(SITE_ID) / "stats.json")


def test_periods_past_the_last_fetched_day(fires_run, tmp_path, monkeypatch):
    # On 14 November (UTC) the last day that has ended is 13 November. A period that runs past it covers only the
    # days fetched and says so; a period that starts after it has no values at all.
    layout = _copy_run(fires_run.layout, tmp_path)
    _edit_site(layout, fires={**E2E_FIRES, "end": "2026-11-20",
                              "periods": [["2026-11-10", "2026-11-16"], ["2026-11-15", "2026-11-18"]]})
    rows = {**E2E_ROWS, "VIIRS_NOAA20_NRT": [*E2E_ROWS["VIIRS_NOAA20_NRT"], det(P3, "2026-11-12", "0830")]}
    fake = FakeFirms(rows)
    monkeypatch.setattr(fires_mod, "http_get", fake)
    monkeypatch.setattr(fires_mod, "utc_now", lambda: fake.now)
    monkeypatch.setenv(fires_mod.ENV_KEY, KEY)
    cfg = load_site(SITE_ID, layout.sites_dir)
    assert fires_site(cfg, layout)["asked"] == ["2026-10-01", "2026-11-13"]
    export_site(cfg, layout)
    manifest_stage(layout)
    assert validate(layout.data_dir) == []
    partial, empty = read_json(layout.site_data(SITE_ID) / "stats.json")["bars"]
    assert partial["id"] == "fires-2026-11-10-2026-11-16" and "10 to 13 November 2026" in partial["title"]
    assert "UTC dates from 2026-11-10 to 2026-11-13: 1 detection." in partial["region"]
    assert partial["region"].endswith("The period asked runs to 2026-11-16, but detections were fetched only to "
                                      "2026-11-13.")
    assert all(c["value"] is not None and "low" in c and "high" in c for c in partial["categories"])
    assert sum(c["n"] for c in partial["categories"]) == 1
    assert empty["id"] == "fires-2026-11-15-2026-11-18" and "15 to 18 November 2026" in empty["title"]
    assert empty["region"].endswith("fetched only to 2026-11-13, so no value is given.")
    for c in empty["categories"]:
        assert c["value"] is None and "low" not in c and "high" not in c and c["n"] == 0
        assert c["note"] == "no day of this period had been fetched"


def test_run_goes_on_when_firms_fails(fires_run, tmp_path, monkeypatch, capsys):
    # A wrong or expired key (FIRMS answers it with a line of text), the rate limit or an outage must not keep the
    # radar layers and the harvest map from being published: run warns and goes on.
    layout = _copy_run(fires_run.layout, tmp_path)
    shutil.rmtree(_fires_dir(layout))
    shutil.rmtree(layout.site_data(SITE_ID))  # so export has to write every file again
    monkeypatch.setattr(fires_mod, "http_get", lambda url: b"Invalid MAP_KEY.")
    monkeypatch.setattr(fires_mod, "utc_now", lambda: NOW)
    monkeypatch.setenv(fires_mod.ENV_KEY, KEY)
    capsys.readouterr()
    assert run_site(load_site(SITE_ID, layout.sites_dir), layout) == 0
    out = capsys.readouterr().out
    warnings = [line for line in out.splitlines() if line.startswith("WARNING: fires:")]
    assert len(warnings) == 1 and "Invalid MAP_KEY" in warnings[0] and "leaves the fires overlay" in warnings[0]
    assert KEY not in out
    site = read_json(layout.site_data(SITE_ID) / "site.json")
    assert {la["id"] for la in site["layers"]} == {"hh", "hv", "harvest-wave"}
    assert all((layout.data_dir / item["url"]).is_file() for la in site["layers"] for item in la["items"])
    assert "overlays" not in site and "bars" not in read_json(layout.site_data(SITE_ID) / "stats.json")
    assert validate(layout.data_dir) == []


def test_removing_the_fires_block_removes_the_overlay(fires_run, tmp_path):
    layout = _copy_run(fires_run.layout, tmp_path)
    path = layout.sites_dir / f"{SITE_ID}.yaml"
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    del data["fires"]
    path.write_text(yaml.safe_dump(data, sort_keys=False), encoding="utf-8")
    cfg = load_site(SITE_ID, layout.sites_dir)
    assert fires_site(cfg, layout) is None and not (_fires_dir(layout) / DETECTIONS_FILE).exists()
    export_site(cfg, layout)
    assert not (layout.site_data(SITE_ID) / "fires.geojson").exists()
    manifest_stage(layout)
    assert validate_stage(layout) == 0


# validate: rules 11 (overlays), 12 (story steps) and 13 (bars) ------------------------------------------------

@pytest.fixture
def published(fires_run, tmp_path):
    data = tmp_path / "data"
    shutil.copytree(fires_run.layout.data_dir, data)
    return SimpleNamespace(data=data, manifest=read_json(data / MANIFEST))


def _overlay(m):
    return m["sites"][0]["overlays"][0]


OVERLAY_BREAKAGES = {
    "missing file": (lambda m: _overlay(m).update(url=f"{SITE_ID}/nothing.geojson"), None, "does not exist"),
    "count": (lambda m: _overlay(m).update(count=9), None, "count is 9 but"),
    "date range": (lambda m: _overlay(m).update(date_range=["2026-10-05", "2026-10-20"]), None,
                   "1 feature(s) has a date outside date_range"),
    "duplicate id": (lambda m: m["sites"][0]["overlays"].append(copy.deepcopy(_overlay(m))), None,
                     "overlay id 'fires' appears more than once"),
    "outside bounds": (None, lambda g: g["features"][3]["geometry"].update(coordinates=[0.0, 0.0]),
                       "1 feature(s) lies outside the site's bounds (with a 0.01 degree margin) (first: feature 3)"),
    "no date": (None, lambda g: g["features"][2]["properties"].pop("date"), "has no YYYY-MM-DD date in property"),
    "not a point": (None, lambda g: g["features"][0]["geometry"].update(type="LineString"), "is not a Point feature"),
    "not a collection": (None, lambda g: g.update(type="Feature"), "is not a GeoJSON FeatureCollection"),
}


@pytest.mark.parametrize("name", list(OVERLAY_BREAKAGES))
def test_validate_rule_11_fails_when_an_overlay_is_broken(published, name):
    in_manifest, in_file, message = OVERLAY_BREAKAGES[name]
    assert rule_errors(published.manifest, published.data) == []
    if in_manifest:
        in_manifest(published.manifest)
    if in_file:
        path = published.data / SITE_ID / "fires.geojson"
        points = read_json(path)
        in_file(points)
        write_json(path, points)
    errors = rule_errors(published.manifest, published.data)
    assert any(e.startswith(f"rule 11: site {SITE_ID}: overlay ") and message in e for e in errors), errors


def test_points_just_outside_the_bounds_are_within_the_margin(published):
    path = published.data / SITE_ID / "fires.geojson"
    points = read_json(path)
    w = published.manifest["sites"][0]["bounds"][0]
    points["features"][0]["geometry"]["coordinates"][0] = w - 0.005
    write_json(path, points)
    assert rule_errors(published.manifest, published.data) == []


STORY_BREAKAGES = [
    ({"layer": "nope"}, "layer 'nope' is not a layer of the site"),
    ({"layer": "hh", "date": "1999-01-01"}, "layer hh has no file for 1999-01-01"),
    ({"layer": "harvest-wave", "date": H_DATES[3]}, "gives a date, but layer harvest-wave is static, not per-date"),
    ({"layer": "hh", "reference": H_DATES[2], "secondary": H_DATES[3]}, "gives a pair, but layer hh is per-date"),
    ({"overlays": ["smoke"]}, "overlay 'smoke' is not an overlay of the site"),
    ({"date": H_DATES[3]}, "names a date or a pair but no layer"),
]


@pytest.mark.parametrize("step, message", STORY_BREAKAGES)
def test_validate_rule_12_fails_when_a_story_step_names_what_does_not_exist(published, step, message):
    site = published.manifest["sites"][0]
    site["story"] = [{"id": "fine", "title": "T", "text": "X", "layer": "hh", "date": H_DATES[3],
                      "overlays": ["fires"]}]
    assert story_errors(site) == []
    site["story"].append({"id": "broken", "title": "T", "text": "X", **step})
    errors = rule_errors(published.manifest, published.data)
    assert any(e.startswith(f"rule 12: site {SITE_ID}: story step broken: ") and message in e for e in errors), errors
    site["story"].append(dict(site["story"][0]))
    assert any("story step id 'fine' appears more than once" in e for e in story_errors(site))


@pytest.mark.parametrize("edit, message", [
    (lambda b: b["categories"][0].update({"class": 99}), "class 99 ("),
    (lambda b: b.update(layer="nope"), "layer 'nope' is not a layer of the site"),
    (lambda b: b.update(layer="hh"), "gives a class but layer hh is not categorical"),
    (lambda b: b.pop("layer"), "gives a class but the bar names no layer"),
])
def test_validate_rule_13_fails_when_a_bar_names_a_class_that_does_not_exist(published, edit, message):
    site = published.manifest["sites"][0]
    stats_path = published.data / SITE_ID / "stats.json"
    stats = read_json(stats_path)
    assert bar_errors(site, stats) == []
    edit(stats["bars"][0])
    errors = bar_errors(site, stats)
    assert any(e.startswith(f"rule 13: site {SITE_ID}: bar fires-2026-10-06-2026-10-17: ") and message in e
               for e in errors), errors
    write_json(stats_path, stats)
    assert any(e.startswith("rule 13:") for e in validate(published.data))


def test_validate_rule_12_checks_the_pair_of_a_pair_layer(synthetic_run):
    # The synthetic site of conftest.py has a change layer, with the pairs of consecutive dates only.
    site = read_json(synthetic_run.data / "site.json")
    items = next(la for la in site["layers"] if la["id"] == "hh-change")["items"]
    site["story"] = [{"id": "pair", "title": "T", "text": "X", "layer": "hh-change",
                      "reference": items[0]["reference"], "secondary": items[0]["secondary"]}]
    assert story_errors(site) == []
    site["story"].append({"id": "skip", "title": "T", "text": "X", "layer": "hh-change", "reference": DATES[0],
                          "secondary": DATES[2]})
    assert story_errors(site) == [f"rule 12: site {SITE_ID}: story step skip: layer hh-change has no file for the "
                                  f"pair {DATES[0]} to {DATES[2]}"]


def test_story_from_the_site_file_is_copied_and_checked(fires_run, tmp_path):
    layout = _copy_run(fires_run.layout, tmp_path)
    story = [{"id": "step-one", "title": "T", "text": "X", "layer": "harvest-wave",
              "overlays": ["fires"], "view": {"center": [-118.0, 34.8], "zoom": 11}},
             {"id": "step-two", "title": "T", "text": "X", "layer": "hh", "date": H_DATES[3]}]
    _edit_site(layout, story=story)
    cfg = load_site(SITE_ID, layout.sites_dir)
    export_site(cfg, layout)
    manifest_stage(layout)
    assert validate_stage(layout) == 0
    assert read_json(layout.site_data(SITE_ID) / "site.json")["story"] == story
    _edit_site(layout, story=[{"id": "step-one", "title": "T", "text": "X", "layer": "hh", "date": "2026-01-01"}])
    export_site(load_site(SITE_ID, layout.sites_dir), layout)
    manifest_stage(layout)
    assert validate_stage(layout) == 1
    assert any(e.startswith("rule 12:") for e in validate(layout.data_dir))


# C. The display range per polarization is a hint in the manifest only --------------------------------------

def test_display_by_polarization_rewrites_no_raster(fires_run, tmp_path):
    layout = _copy_run(fires_run.layout, tmp_path)
    data = layout.site_data(SITE_ID)
    kept = [p for p in data.iterdir() if p.name not in ("site.json",)]
    before = {p.name: (p.stat().st_mtime_ns, p.read_bytes()) for p in kept}
    manifest = layout.data_dir / MANIFEST
    old_manifest = read_json(manifest)
    style = yaml.safe_load((layout.sites_dir / f"{SITE_ID}.yaml").read_text(encoding="utf-8"))["backscatter"]
    _edit_site(layout, backscatter={**style, "display_by_polarization": {"HV": {"min": -30, "max": -8,
                                                                              "ramp": "grey"}}})
    export_site(load_site(SITE_ID, layout.sites_dir), layout)
    manifest_stage(layout)
    assert {p.name: (p.stat().st_mtime_ns, p.read_bytes()) for p in kept} == before  # rasters, stats, points
    assert any(p.suffix == ".tif" for p in kept) and (data / "stats.json") in kept
    layers = {la["id"]: la for la in read_json(data / "site.json")["layers"]}
    assert layers["hv"]["display"] == {"min": -30.0, "max": -8.0, "ramp": "grey"}
    assert layers["hh"]["display"] == {"min": style["display"]["min"], "max": style["display"]["max"],
                                       "ramp": style["display"]["ramp"]}
    new_manifest = read_json(manifest)
    assert new_manifest["sites"] != old_manifest["sites"]
    assert validate(layout.data_dir) == []

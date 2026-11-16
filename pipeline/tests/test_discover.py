"""Offline tests of stack choice, missing-pass arithmetic and the granule list writer."""

import dataclasses
import json
import socket
from pathlib import Path
from types import SimpleNamespace

import pytest

from pipeline import cmr, discover, hints

FIXTURES = Path(__file__).parent / "fixtures" / "cmr"
EDGE = "gcov_083_A_008_edge_point.json"
PARTIAL_1017 = "NISAR_L2_PR_GCOV_033_083_A_008_4005_DHDH_A_20261017T223633_20261017T223641_P05023_N_P_J_001"


@pytest.fixture(autouse=True)
def no_network(monkeypatch):
    def refuse(*args, **kwargs):
        raise AssertionError("tests must not touch the network")

    monkeypatch.setattr(socket.socket, "connect", refuse)


def granules(name=EDGE):
    items = json.loads((FIXTURES / name).read_text(encoding="utf-8"))["items"]
    return [cmr.parse_umm(item) for item in items]


def site(**changes):
    """A stand-in for config.SiteConfig with only the attributes discover uses."""
    values = {"id": "test-site", "bbox": (104.2, 11.9, 104.4, 12.1), "product": "GCOV", "frequency": "A",
              "stack": None, "releases": ["validated", "provisional"], "polarizations": ["HH", "HV"],
              "access": "earthdata"}
    values.update(changes)
    return SimpleNamespace(**values)


def test_missing_passes_on_real_dates():
    # The fixture keeps 4 of the stack's 11 dates, so 5 passes in between are missing from it.
    starts = [g.start for g in cmr.dedupe(granules())]
    assert discover.missing_passes(starts) == [
        {"date": "2026-08-06", "reason": discover.GAP_REASON},
        {"date": "2026-08-30", "reason": discover.NO_PRODUCT_REASON},
        {"date": "2026-09-11", "reason": discover.NO_PRODUCT_REASON},
        {"date": "2026-09-23", "reason": discover.NO_PRODUCT_REASON},
        {"date": "2026-10-05", "reason": discover.NO_PRODUCT_REASON},
    ]


def test_missing_passes_gap_edges_and_midnight_drift():
    # A pass predicted for 2026-07-27 23:59:50 is after the gap began (22:03), so it is in the gap. The
    # next real pass lands 20 s later than predicted, on the next calendar date, and still counts.
    assert discover.missing_passes(["2026-07-15T23:59:50Z", "2026-08-09T00:00:10Z"]) == [
        {"date": "2026-07-27", "reason": discover.GAP_REASON}]
    # Predicted at 21:00 on 27 July: before the gap began, so the product is simply missing.
    assert discover.missing_passes(["2026-07-15T21:00:00Z", "2026-08-08T21:00:00Z"]) == [
        {"date": "2026-07-27", "reason": discover.NO_PRODUCT_REASON}]
    # A pass whose only granule was excluded is not reported as "no product".
    assert discover.missing_passes(["2026-06-24T11:31:00Z", "2026-07-18T11:31:05Z"],
                                   {"2026-07-06T11:31:02Z": "lacks HV on frequency A (has HH)"}) == [
        {"date": "2026-07-06", "reason": "a product exists but was excluded: lacks HV on frequency A (has HH)"}]
    # One acquisition, or a gap-free series, has nothing missing.
    assert discover.missing_passes(["2026-07-15T21:00:00Z"]) == []
    assert discover.missing_passes(["2026-06-19T22:36:37Z", "2026-07-01T22:36:36Z"]) == []


def test_select_and_granule_list_shape():
    chosen, excluded = discover.select_granules(granules(), site(), "083_A_008")
    assert [g.date for g in chosen] == ["2026-07-25", "2026-08-18", "2026-10-17", "2026-10-29"]
    assert excluded == [{"name": PARTIAL_1017, "reason": excluded[0]["reason"]}]
    assert "same pass as" in excluded[0]["reason"]

    data = discover.granule_list(site(), "083_A_008", chosen, excluded, generated_at="2026-11-14T18:00:00Z")
    assert list(data) == ["site", "generated_at", "product", "stack", "direction", "query", "granules",
                          "missing_passes", "excluded"]
    assert data["query"] == {"bbox": [104.2, 11.9, 104.4, 12.1], "releases": ["validated", "provisional"]}
    assert data["direction"] == "ascending"
    first = data["granules"][0]
    assert list(first) == ["name", "date", "start", "release", "collection", "version", "counter", "pols",
                           "bandwidth_mhz", "full_frame", "url", "browse", "size_bytes"]
    assert first["pols"] == ["HH", "HV"] and first["bandwidth_mhz"] == 20.0 and first["full_frame"] is True
    assert first["url"].endswith(first["name"] + ".h5")
    assert [g["release"] for g in data["granules"]] == ["provisional"] * 3 + ["validated"]
    assert data["missing_passes"][0] == {"date": "2026-08-06", "reason": discover.GAP_REASON}


def test_dates_lacking_polarizations_are_excluded():
    chosen, excluded = discover.select_granules(granules(), site(polarizations=["HH", "VV"]), "083_A_008")
    assert chosen == []
    # Every granule is checked, the partial strip of 2026-10-17 included, so each has its own reason.
    assert sum("lacks VV on frequency A (has HH+HV)" in e["reason"] for e in excluded) == 5


def full_1017():
    return next(g for g in granules() if g.date == "2026-10-17" and g.full_frame)


def test_preferred_copy_lacking_a_polarization_does_not_hide_a_usable_sibling():
    # The validated copy of a pass wins the duplicate ranking but has HH only; the provisional copy of
    # the same pass has the HH+HV the site needs. The date must be kept, using the provisional copy.
    usable = full_1017()
    hh_only = dataclasses.replace(usable, name=usable.name.replace("DHDH", "SHSH"), release="validated",
                                  pols_a=("HH",))
    chosen, excluded = discover.select_granules([hh_only, usable], site(), "083_A_008")
    assert [g.name for g in chosen] == [usable.name]
    assert excluded == [{"name": hh_only.name, "reason": "lacks HV on frequency A (has HH)"}]


def test_preferred_partial_strip_outside_the_box_does_not_hide_the_full_frame():
    # The validated copy is a partial strip that misses the site box; the provisional full frame of the
    # same pass covers it. The date must be kept, using the full frame.
    full = full_1017()
    strip = next(g for g in granules() if g.date == "2026-10-17" and not g.full_frame)
    strip = dataclasses.replace(strip, release="validated")
    north_box = (104.2, 12.6, 104.4, 12.8)  # inside the full frame, north of the strip
    assert cmr.preference(strip) < cmr.preference(full) and cmr.covers_bbox(full, north_box)
    chosen, excluded = discover.select_granules([strip, full], site(bbox=north_box), "083_A_008")
    assert [g.name for g in chosen] == [full.name]
    assert excluded == [{"name": strip.name, "reason": "partial frame that may not cover the site box"}]


def test_missing_passes_include_excluded_passes_outside_the_chosen_range():
    chosen = ["2026-09-11T10:00:00Z", "2026-09-23T10:00:02Z"]
    unusable = {"2026-08-30T10:00:01Z": "lacks HV on frequency A (has HH)",
                "2026-10-05T09:59:58Z": "partial frame that may not cover the site box",
                # an excluded copy of a pass that also has a chosen granule is not missing
                "2026-09-11T10:00:03Z": "lacks HV on frequency A (has HH)"}
    assert discover.missing_passes(chosen, unusable) == [
        {"date": "2026-08-30", "reason": "a product exists but was excluded: lacks HV on frequency A (has HH)"},
        {"date": "2026-10-05",
         "reason": "a product exists but was excluded: partial frame that may not cover the site box"},
    ]
    # With a single chosen date the excluded passes on either side are still reported.
    assert [m["date"] for m in discover.missing_passes(chosen[:1], unusable)] == ["2026-08-30", "2026-09-23",
                                                                                  "2026-10-05"]


def test_partial_frame_outside_box_is_excluded():
    only_partial = [g for g in granules() if g.date == "2026-10-17" and not g.full_frame]
    north_box = (104.2, 12.6, 104.4, 12.8)  # north of the southern strip
    chosen, excluded = discover.select_granules(only_partial, site(bbox=north_box), "083_A_008")
    assert chosen == [] and excluded[0]["reason"] == "partial frame that may not cover the site box"


def test_write_granule_list_is_utf8_lf_and_readable_by_config(tmp_path):
    chosen, excluded = discover.select_granules(granules(), site(), "083_A_008")
    path = tmp_path / "test-site.granules.json"
    discover.write_granule_list(path, discover.granule_list(site(), "083_A_008", chosen, excluded))
    raw = path.read_bytes()
    assert b"\r\n" not in raw and raw.endswith(b"\n")
    assert json.loads(raw.decode("utf-8"))["site"] == "test-site"
    pytest.importorskip("yaml")
    config = pytest.importorskip("pipeline.config")
    loaded = config.load_granule_list("test-site", sites_root=tmp_path)  # the core agent's reader
    assert len(loaded["granules"]) == 4


def test_coverage_lines():
    text = "\n".join(discover.coverage_lines(granules(), "header"))
    assert " ".join(text.split()).startswith("header 083_A_008 ascending 4 dates 2026-07-25 .. 2026-10-29")
    assert "releases provisional x3, validated x1" in text and "full frames 4/4" in text
    # The partial strip of 2026-10-17 is counted, not silently dropped: discover may use such a copy.
    assert "+1 other copies on the same dates" in text


def test_coverage_shows_polarizations_of_every_copy():
    # The preferred (validated) copy of a pass has HH only; the provisional copy has HH+HV. Coverage
    # must not hide the HV that discover would find.
    usable = full_1017()
    hh_only = dataclasses.replace(usable, name=usable.name.replace("DHDH", "SHSH"), release="validated",
                                  pols_a=("HH",))
    text = "\n".join(discover.coverage_lines([hh_only, usable], "header"))
    assert "pol HH+HV x1" in text and "releases validated x1" in text


def test_recommendation_names_best_stack_and_reasons():
    gs = granules() + granules("gcov_duplicates.json")
    lines = discover.recommendation_lines(discover.rank_stacks(gs, site()), site())
    text = "\n".join(lines)
    assert "Recommended: 083_A_008" in text
    assert "3 usable dates within one release (provisional)" in text
    assert "one bandwidth mode (20+5 MHz)" in text
    assert "Next: " + hints.command("discover", "--site", "test-site", "--stack", "083_A_008") in text
    assert "may leave 'stack: null'; discover --stack records the stack" in text
    assert hints.POWERSHELL_NOTE in text and "python -m" not in text


def test_run_discover_writes_file_and_warns_about_mixed_releases(monkeypatch, tmp_path, capsys):
    config = pytest.importorskip("pipeline.config")
    monkeypatch.setattr(config, "load_site", lambda site_id: site(id=site_id, stack="083_A_008"))
    monkeypatch.setattr(config, "granules_path", lambda site_id: tmp_path / f"{site_id}.granules.json")
    monkeypatch.setattr(cmr, "search_granules", lambda *a, **k: granules())
    code = discover.run_discover(SimpleNamespace(site="test-site", stack=None))
    out = capsys.readouterr().out
    assert code == 0 and (tmp_path / "test-site.granules.json").is_file()
    assert "MORE THAN ONE RELEASE" in out and "missing pass 2026-08-06: instrument data gap" in out
    # How to keep one release: the release with the most dates, the exact line, and the command.
    assert "provisional has the most dates (3 of 4)" in out
    assert "pipeline/sites/test-site.yaml" in out and "!!   releases: [provisional]" in out
    assert hints.command("discover", "--site", "test-site", "--stack", "083_A_008") in out
    assert out.count(hints.POWERSHELL_NOTE) == 1 and "python -m" not in out

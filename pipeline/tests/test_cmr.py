"""Offline tests of catalog parsing and selection, on small real CMR responses saved in fixtures/cmr/."""

import dataclasses
import json
import socket
import ssl
import urllib.error
import urllib.request
from pathlib import Path

import pytest

from pipeline import cmr

FIXTURES = Path(__file__).parent / "fixtures" / "cmr"


@pytest.fixture(autouse=True)
def no_network(monkeypatch):
    def refuse(*args, **kwargs):
        raise AssertionError("tests must not touch the network")

    monkeypatch.setattr(socket.socket, "connect", refuse)


def load(name):
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))["items"]


def granules(name):
    return [cmr.parse_umm(item) for item in load(name)]


def by_name(gs):
    return {g.name: g for g in gs}


EDGE_FULL_1017 = "NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001"
EDGE_PART_1017 = "NISAR_L2_PR_GCOV_033_083_A_008_4005_DHDH_A_20261017T223633_20261017T223641_P05023_N_P_J_001"


def test_parse_name_gcov():
    f = cmr.parse_name(EDGE_FULL_1017)
    assert (f["product"], f["cycle"], f["track"], f["direction"], f["frame"]) == ("GCOV", 33, 83, "ascending", 8)
    assert f["stack"] == "083_A_008"
    assert f["pols_a"] == ("HH", "HV") and f["pols_b"] == ("HH", "HV")
    assert (f["bandwidth_mhz_a"], f["bandwidth_mhz_b"]) == (20.0, 5.0)
    assert f["start"] == "2026-10-17T22:36:33Z"
    assert (f["version"], f["full_frame"], f["counter"], f["production"]) == ("P05023", True, 1, "PR")


def test_parse_name_pair_product_and_band_b_only():
    gunw = cmr.parse_name(
        "NISAR_L2_PR_GUNW_032_141_D_085_033_2000_SH_20261009T235335_20261009T235349_"
        "20261021T235335_20261021T235349_P05036_N_P_J_001")
    assert gunw["start"] == "2026-10-09T23:53:35Z"  # the reference (first) acquisition
    assert gunw["pols_a"] == ("HH",) and gunw["pols_b"] == () and gunw["bandwidth_mhz_b"] is None
    assert gunw["full_frame"] is False
    nasv = cmr.parse_name("NISAR_L2_PR_GCOV_035_098_A_010_0005_NASV_M_20261111T233557_20261111T233632_P05036_N_F_J_001")
    assert nasv["pols_a"] == () and nasv["pols_b"] == ("VV",) and nasv["bandwidth_mhz_a"] is None


def test_parse_name_rejects_other_names():
    with pytest.raises(ValueError):
        cmr.parse_name("S1A_IW_GRDH_1SDV_20261017T000000")


def test_parse_umm_reads_catalog_attributes():
    g = by_name(granules("gcov_083_A_008_edge_point.json"))[EDGE_FULL_1017]
    assert g.product == "GCOV" and g.release == "provisional"
    assert g.collection == "NISAR_L2_GCOV_PROVISIONAL_V1"
    assert (g.stack, g.direction, g.date) == ("083_A_008", "ascending", "2026-10-17")
    assert g.start == "2026-10-17T22:36:33Z"
    assert (g.version, g.counter, g.full_frame, g.urgent) == ("P05023", 1, True, False)
    assert g.pols_a == ("HH", "HV") and g.bandwidth_mhz_a == 20.0
    assert g.size_bytes == 1900019712
    assert g.data_url == ("https://nisar.asf.earthdatacloud.nasa.gov/NISAR/NISAR_L2_GCOV_PROVISIONAL_V1/"
                          f"{g.name}/{g.name}.h5")
    assert g.browse_urls[0].endswith("_LATLON.png")
    assert all(u.startswith("https://") for u in g.browse_urls)
    assert g.polygon[0] == g.polygon[-1] and len(g.polygon) == 5
    assert cmr.mode_label(g) == "20+5"


def test_partial_frame_attribute_and_validated_release():
    gs = by_name(granules("gcov_083_A_008_edge_point.json"))
    assert gs[EDGE_PART_1017].full_frame is False
    assert gs[EDGE_PART_1017].bandwidth_mhz_a == 40.0
    validated = [g for g in gs.values() if g.release == "validated"]
    assert [g.date for g in validated] == ["2026-10-29"] and validated[0].version == "P05036"


def test_no_frequency_a_urgent_and_pair_records():
    nasv, ur, gunw = granules("mixed_products.json")
    assert nasv.pols_a == () and nasv.bandwidth_mhz_a is None and nasv.pols_b == ("VV",)
    assert cmr.bandwidth_mhz(nasv, "B") == 5.0 and cmr.mode_label(nasv) == "5"
    assert ur.urgent is True and ur.release == "provisional" and ur.collection == "NISAR_UR_L2"
    assert gunw.product == "GUNW" and gunw.release == "provisional" and gunw.pols_a == ("HH",)
    assert gunw.data_url.endswith(gunw.name + ".h5")


def test_dedupe_prefers_release_then_counter_then_full_frame():
    kept, dropped = cmr.split_duplicates(granules("gcov_duplicates.json"))
    names = {g.name for g in kept}
    # the same pass in two collections: validated wins
    assert "NISAR_L2_PR_GCOV_033_137_D_080_2005_DHDH_A_20261021T171116_20261021T171150_P05036_N_F_J_001" in names
    # a re-issue: the higher counter wins
    assert any(n.startswith("NISAR_L2_PR_GCOV_006_149_A_022") and n.endswith("_002") for n in names)
    # same release and counter: the quad-pol granule beats the HH-only one
    assert any("062_D_079_2005_QPDH_A" in n for n in names)
    assert len(kept) == 3 and len(dropped) == 3
    assert all("which was kept" in reason for _, reason in dropped)


def test_dedupe_keeps_full_frame_over_partial_strip_of_same_second():
    kept = cmr.dedupe(granules("gcov_083_A_008_edge_point.json"))
    assert EDGE_FULL_1017 in {g.name for g in kept} and EDGE_PART_1017 not in {g.name for g in kept}
    assert [g.date for g in kept] == ["2026-07-25", "2026-08-18", "2026-10-17", "2026-10-29"]


def test_parse_name_of_the_sample_granule():
    # The example in parse_name's docstring: the sample site's first date.
    f = cmr.parse_name("NISAR_L2_PR_GCOV_001_030_A_019_2800_SHNA_A_20081012T060911_20081012T060925_D00404_N_F_J_001")
    assert (f["stack"], f["cycle"], f["start"]) == ("030_A_019", 1, "2008-10-12T06:09:11Z")
    assert f["pols_a"] == ("HH",) and f["pols_b"] == () and f["bandwidth_mhz_a"] == 28.0


def test_dedupe_drops_urgent_response():
    kept = cmr.dedupe(granules("mixed_products.json"))
    assert all(not g.urgent for g in kept) and len(kept) == 2


def test_group_by_stack():
    groups = cmr.group_by_stack(granules("gcov_duplicates.json"))
    assert list(groups) == ["062_D_079", "137_D_080", "149_A_022"]
    assert all(len(v) == 2 for v in groups.values())
    assert groups["137_D_080"][0].start <= groups["137_D_080"][1].start


def test_covers_bbox():
    gs = by_name(granules("gcov_083_A_008_edge_point.json"))
    full, part = gs[EDGE_FULL_1017], gs[EDGE_PART_1017]
    small_box = (104.2, 11.9, 104.4, 12.1)
    assert cmr.covers_bbox(full, small_box) is True
    assert cmr.covers_bbox(part, (104.2, 12.4, 104.4, 12.8)) is False  # north of the strip
    assert cmr.covers_bbox(dataclasses.replace(full, polygon=()), small_box) is None  # cannot tell


def test_search_pages_with_search_after(monkeypatch):
    """Paging logic with the network replaced: 5 items served 2 per page, as CMR would."""
    items = load("gcov_083_A_008_edge_point.json")
    calls = []

    def fake_fetch(url, search_after):
        calls.append((url, search_after))
        start = 0 if search_after is None else int(search_after)
        page = items[start:start + 2]
        return {"items": page}, str(start + 2)

    monkeypatch.setattr(cmr, "PAGE_SIZE", 2)
    monkeypatch.setattr(cmr, "_fetch_page", fake_fetch)
    found = cmr.search_granules("gcov", point=(10.0, 20.0), stack="083_A_008")
    assert len(found) == 5 and len(calls) == 3
    assert [c[1] for c in calls] == [None, "2", "4"]
    url = calls[0][0]
    assert "C3622241360-ASF" in url and "C2854338529-ASF" in url and "C3622214170-ASF" not in url
    assert "point=10.0%2C20.0" in url and "STACK_ID%2C083_A_008" in url and "page_size=2" in url


def test_search_rejects_bad_input():
    with pytest.raises(ValueError):
        cmr.search_granules("GCOV")  # no point, box or stack
    with pytest.raises(ValueError):
        cmr.search_granules("GCOV", point=(20.0, 100.0))  # latitude and longitude swapped
    with pytest.raises(ValueError):
        cmr.search_granules("SME2", point=(0, 0), releases=("validated",))  # no validated SME2 yet


def test_network_errors_retry_then_explain(monkeypatch):
    attempts, waits = [], []

    def failing_urlopen(*args, **kwargs):
        attempts.append(1)
        raise urllib.error.URLError("simulated: no route to host")

    monkeypatch.setattr(urllib.request, "urlopen", failing_urlopen)
    monkeypatch.setattr(cmr.time, "sleep", waits.append)
    with pytest.raises(cmr.CatalogError, match="after 3 tries"):
        cmr.search_granules("GCOV", point=(10.0, 20.0))
    assert len(attempts) == 3 and waits == [2.0, 4.0]


def test_certificate_failure_is_not_retried(monkeypatch):
    attempts = []

    def failing_urlopen(*args, **kwargs):
        attempts.append(1)
        raise urllib.error.URLError(ssl.SSLCertVerificationError("simulated"))

    monkeypatch.setattr(urllib.request, "urlopen", failing_urlopen)
    with pytest.raises(cmr.CatalogError, match="npm run setup"):
        cmr.search_granules("GCOV", point=(10.0, 20.0))
    assert len(attempts) == 1

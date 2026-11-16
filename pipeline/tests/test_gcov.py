"""Window arithmetic and reading a GCOV file. The classic mistakes here are a flipped y axis and a
half-pixel shift, because the file stores pixel centres and its rows run north to south."""

from __future__ import annotations

import json

import h5py
import numpy as np
import pytest

from pipeline.access import open_granule
from pipeline.gcov import (
    EXCEPTION_SUMMARY_METHOD,
    PixelWindow,
    WindowError,
    describe_exception_code,
    describe_exceptions,
    exception_code,
    exception_flag,
    has_focus_bits,
    pixel_window,
    read_exception_window,
    read_facts,
    read_window,
    start_datetime,
    summarise_exceptions,
    unique_mask_values,
    window_transform,
)
from pipeline.tests.synth import (
    EXCEPTION_DESCRIPTION,
    EXCEPTION_DESCRIPTION_1_5,
    BrightSpot,
    SynthGrid,
    write_1_5_format_gcov,
    write_real_format_gcov,
    write_synthetic_gcov,
)

# A small grid: 100 columns, 50 rows, 20 m pixels. Centres start at x=100010 and y=200990, so the
# outer edges are x=100000 (left) and y=201000 (top).
X0, DX, NX = 100010.0, 20.0, 100
Y0, DY, NY = 200990.0, -20.0, 50


def test_window_on_pixel_edges():
    win = pixel_window(X0, DX, NX, Y0, DY, NY, (100040.0, 200500.0, 100100.0, 200960.0))
    assert win == PixelWindow(row0=2, row1=25, col0=2, col1=5, clipped=False)


def test_window_rows_count_down_from_the_north():
    # ymax picks the FIRST row: the northernmost box gives row 0, a box further south a larger row.
    north = pixel_window(X0, DX, NX, Y0, DY, NY, (100000.0, 200980.0, 100020.0, 201000.0))
    south = pixel_window(X0, DX, NX, Y0, DY, NY, (100000.0, 200000.0, 100020.0, 200020.0))
    assert (north.row0, north.row1) == (0, 1)
    assert (south.row0, south.row1) == (49, 50)


def test_window_inside_pixels_takes_every_touched_pixel():
    win = pixel_window(X0, DX, NX, Y0, DY, NY, (100045.0, 200505.0, 100095.0, 200955.0))
    assert (win.col0, win.col1, win.row0, win.row1) == (2, 5, 2, 25)


def test_transform_origin_is_half_a_pixel_before_the_first_centre():
    win = pixel_window(X0, DX, NX, Y0, DY, NY, (100040.0, 200500.0, 100100.0, 200960.0))
    t = window_transform(X0, DX, Y0, DY, win)
    assert (t.c, t.f) == (100040.0, 200960.0)  # x[2] - 10 and y[2] + 10
    assert (t.a, t.e) == (20.0, -20.0)
    # The centre of the window's first pixel maps back exactly to the file's coordinates.
    cx, cy = t @ (0.5, 0.5)
    assert (cx, cy) == (X0 + 2 * DX, Y0 + 2 * DY)


def test_window_partly_outside_is_clipped():
    win = pixel_window(X0, DX, NX, Y0, DY, NY, (99000.0, 200500.0, 100100.0, 202000.0))
    assert win.clipped and win.col0 == 0 and win.row0 == 0


def test_window_outside_is_rejected():
    with pytest.raises(WindowError, match="outside the product grid"):
        pixel_window(X0, DX, NX, Y0, DY, NY, (500000.0, 200500.0, 500100.0, 200960.0))


def test_ascending_y_is_rejected():
    with pytest.raises(WindowError, match="descend"):
        pixel_window(X0, DX, NX, Y0, 20.0, NY, (100040.0, 200500.0, 100100.0, 200960.0))


def test_facts_come_from_the_file(tmp_path):
    path = write_synthetic_gcov(tmp_path / "synthetic_a.h5", "2026-06-07", convention="subswath")
    with open_granule(path) as h5:
        facts = read_facts(h5)
        assert unique_mask_values(h5, "A", rows_per_step=128) == [0, 1, 2, 255]
    assert facts.spec_version == "1.5.0"
    assert facts.frequencies == ["A"]
    grid = facts.grids["A"]
    assert grid.polarizations == ["HH"] and grid.covariance_terms == ["HHHH"]
    assert (grid.epsg, grid.x_spacing, grid.y_spacing, grid.shape) == (32611, 20.0, -20.0, (600, 600))
    assert facts.page_size == 1024 * 1024
    assert start_datetime(facts) == ("2026-06-07", "2026-06-07T06:00:00Z")


def test_read_window_georeferences_the_bright_spot(tmp_path):
    grid, spot = SynthGrid(), BrightSpot()
    path = write_synthetic_gcov(tmp_path / "synthetic_b.h5", "2026-06-07", grid=grid, spot=spot)
    with open_granule(path) as h5:
        facts = read_facts(h5)
        win = read_window(h5, facts, grid.lonlat_bounds(margin_px=60), "A", ["HHHH"])
    power = win.terms["HHHH"]
    rows, cols = np.nonzero(power > 0.5)  # the spot is 0 dB = 1.0; the background is about 0.03
    x, y = win.transform @ (cols.mean() + 0.5, rows.mean() + 0.5)
    assert (x, y) == pytest.approx(spot.centre_xy(grid), abs=1e-6)
    assert win.mask is not None and win.mask.shape == power.shape


def test_missing_term_is_reported(tmp_path):
    path = write_synthetic_gcov(tmp_path / "synthetic_c.h5", "2026-06-07")
    with open_granule(path) as h5:
        facts = read_facts(h5)
        with pytest.raises(WindowError, match="HVHV"):
            read_window(h5, facts, SynthGrid().lonlat_bounds(60), "A", ["HVHV"])
        with pytest.raises(WindowError, match="frequency B"):
            read_window(h5, facts, SynthGrid().lonlat_bounds(60), "B", ["HHHH"])


# What was seen in the first real file (specification 1.6.0, 14 November 2026), rebuilt synthetically.

def test_facts_of_a_file_in_the_real_format(tmp_path):
    path = write_real_format_gcov(tmp_path / "synthetic_real.h5", "2026-06-07")
    with open_granule(path) as h5:
        facts = read_facts(h5)
    assert facts.spec_version == "1.6.0" and facts.frequencies == ["A", "B"]
    a, b = facts.grids["A"], facts.grids["B"]
    for grid in (a, b):
        assert grid.polarizations == ["HH", "HV"] and grid.covariance_terms == ["HHHH", "HVHV"]
        assert grid.has_mask and grid.has_exception_mask
    assert (a.x_spacing, b.x_spacing, a.shape, b.shape) == (20.0, 80.0, (600, 600), (150, 150))
    # B covers the same area: the outer edges agree, the first centres do not.
    assert a.x_first - a.x_spacing / 2 == b.x_first - b.x_spacing / 2
    assert a.y_first - a.y_spacing / 2 == b.y_first - b.y_spacing / 2
    assert facts.has_input_data_exception is False
    report = facts.to_dict()
    assert report["has_input_data_exception"] is False and report["grids"]["B"]["has_exception_mask"] is True


def test_old_sample_format_records_no_exception_facts(tmp_path):
    path = write_synthetic_gcov(tmp_path / "synthetic_old.h5", "2026-06-07", convention="zero-valid")
    with open_granule(path) as h5:
        facts = read_facts(h5)
    assert facts.has_input_data_exception is None  # no such field: unknown, not "no exceptions"
    assert facts.grids["A"].has_exception_mask is False
    assert facts.to_dict()["has_input_data_exception"] is None


@pytest.mark.parametrize("stored, expected", [
    (0, False), (2, True), (True, True), (False, False), (b"True", True), (b"0", False), ("false", False),
    ("2", True),
])
def test_exception_flag_is_read_from_every_storage_type(tmp_path, stored, expected):
    path = write_real_format_gcov(tmp_path / "synthetic_flag.h5", "2026-06-07", exception_flag=stored)
    with open_granule(path) as h5:
        assert read_facts(h5).has_input_data_exception is expected


def test_unreadable_exception_flag_is_unknown_and_said_so(tmp_path, capsys):
    path = write_real_format_gcov(tmp_path / "synthetic_odd.h5", "2026-06-07", exception_flag="maybe")
    with open_granule(path) as h5:
        assert read_facts(h5).has_input_data_exception is None
    assert "cannot read hasInputDataException" in capsys.readouterr().err


@pytest.mark.parametrize("value, expected", [
    (np.uint8(0), False), (np.uint8(2), True), (0, False), (1, True), (np.int64(-1), True),
    (np.bool_(True), True), (np.bool_(False), False), (True, True),
    (b"True", True), (b"FALSE", False), (np.bytes_(b"0"), False), (b" 2 ", True), (bytearray(b"1"), True),
    ("true", True), ("False", False), ("0", False), ("yes", True),
    (np.array(0, dtype=np.uint8), False), (np.array([2], dtype=np.uint8), True), (np.array([b"True"]), True),
    (np.float32(0.0), False), (1.0, True),
    ("maybe", None), ("", None), (b"", None), (np.array([0, 1]), None), (float("nan"), None), (None, None),
])
def test_exception_flag_values(value, expected):
    assert exception_flag(value) is expected


@pytest.mark.parametrize("value, expected", [
    (np.uint8(0), 0), (np.uint8(2), 2), (2, 2), (np.array([2], dtype=np.uint8), 2), (np.array(0, np.uint8), 0),
    (b"2", 2), (" 2 ", 2), (2.0, 2), (np.float32(0.0), 0),
    (True, None), (np.bool_(False), None), (b"True", None), ("maybe", None), (2.5, None), (float("nan"), None),
    (np.array([0, 2]), None), (None, None),
])
def test_exception_code_keeps_the_number_the_flag_holds(value, expected):
    # hasInputDataException is a code, not only a flag: flagged real 1.5.0 files hold 2 (sample slip).
    code = exception_code(value)
    assert code == expected and type(code) is type(expected)  # an int, never a bool or a numpy scalar


def test_exception_code_in_words():
    assert describe_exception_code(2) == "code 2 (NISAR LSAR qFSP-H1 sample slip)"
    assert describe_exception_code(0) == "code 0 (no anomaly)"
    assert "not one of the documented codes" in describe_exception_code(6)
    assert "no numeric code" in describe_exception_code(None)


# The exception mask's layout, as seen on real files of one site on 14 November 2026: specification 1.5.0
# (uint8, short description, no _FillValue, flag 0 or 2) and 1.6.0 (uint16, focus bits, _FillValue 65535).

def test_builder_writes_the_1_5_0_exception_layout_as_in_the_real_files(tmp_path):
    path = write_1_5_format_gcov(tmp_path / "synthetic_15.h5", "2026-06-07", exception_flag=2)
    with h5py.File(path, "r") as h5:
        flag = h5["/science/LSAR/identification/hasInputDataException"]
        assert flag.dtype == np.uint8 and flag[()] == 2
        assert h5["/science/LSAR/identification/productSpecificationVersion"][()] == b"1.5.0"
        ds = h5["/science/LSAR/GCOV/grids/frequencyA/inputDataExceptionMask"]
        assert ds.dtype == np.uint8 and "_FillValue" not in ds.attrs and ds.attrs["valid_min"] == 0
        assert ds.attrs["description"] == ("Bitwise OR of input data exception codes for each image pixel "
                                           "(0: no anomaly, 2: NISAR LSAR qFSP-H1 sample slip)")
        assert set(np.unique(ds[()]).tolist()) == {0}  # a good pixel is 0 in this layout
    clean = write_1_5_format_gcov(tmp_path / "synthetic_15_clean.h5", "2026-06-07")
    with h5py.File(clean, "r") as h5:
        flag = h5["/science/LSAR/identification/hasInputDataException"]
        assert flag.dtype == np.uint8 and flag[()] == 0


@pytest.mark.parametrize("write, kwargs, spec, layout", [
    (write_1_5_format_gcov, {"exception_flag": 2}, "1.5.0", ("uint8", False, None)),
    (write_real_format_gcov, {}, "1.6.0", ("uint16", True, 65535)),
    # The layout is read from the file, not from its version number:
    (write_real_format_gcov, {"exception_layout": "1.5.0"}, "1.6.0", ("uint8", False, None)),
    (write_1_5_format_gcov, {"exception_layout": "1.6.0"}, "1.5.0", ("uint16", True, 65535)),
])
def test_facts_read_the_exception_layout_from_each_file(tmp_path, write, kwargs, spec, layout):
    path = write(tmp_path / "synthetic_layout.h5", "2026-06-07", **kwargs)
    with open_granule(path) as h5:
        facts = read_facts(h5)
    assert facts.spec_version == spec
    for grid in facts.grids.values():
        assert (grid.exception_dtype, grid.exception_focus_bits, grid.exception_fill) == layout
    report = facts.to_dict()["grids"]["A"]
    assert (report["exception_dtype"], report["exception_focus_bits"], report["exception_fill"]) == layout


def test_facts_record_the_raw_exception_code_and_its_meaning(tmp_path):
    flagged = write_1_5_format_gcov(tmp_path / "synthetic_code2.h5", "2026-06-07", exception_flag=2)
    clean = write_real_format_gcov(tmp_path / "synthetic_code0.h5", "2026-06-07")
    with open_granule(flagged) as h5:
        facts = read_facts(h5)
    assert facts.has_input_data_exception is True
    assert facts.input_data_exception_code == 2
    assert facts.input_data_exception_meaning == "NISAR LSAR qFSP-H1 sample slip"
    with open_granule(clean) as h5:
        facts = read_facts(h5)
    assert (facts.has_input_data_exception, facts.input_data_exception_code) == (False, 0)
    assert facts.input_data_exception_meaning == "no anomaly"
    old = write_synthetic_gcov(tmp_path / "synthetic_nocode.h5", "2026-06-07", convention="zero-valid")
    with open_granule(old) as h5:
        facts = read_facts(h5)
    assert facts.input_data_exception_code is None and facts.input_data_exception_meaning is None


@pytest.mark.parametrize("description, dtype, expected", [
    (EXCEPTION_DESCRIPTION, np.uint16, True),  # 1.6.0
    (EXCEPTION_DESCRIPTION_1_5, np.uint8, False),  # 1.5.0
    (EXCEPTION_DESCRIPTION_1_5, np.uint16, False),  # wide enough, but the description lists no focus bits
    (EXCEPTION_DESCRIPTION, np.uint8, False),  # listed, but a uint8 cannot hold bit 256
    (EXCEPTION_DESCRIPTION, np.float32, False),
    ("Also includes OR of validity mask bits", np.uint16, True),  # matched loosely
    ("bits (256: hh, 512: hv)", np.uint16, True),
    ("", np.uint16, False),
])
def test_focus_bits_are_present_only_when_the_description_lists_them(description, dtype, expected):
    assert has_focus_bits(description, dtype) is expected


def test_exception_window_is_the_data_window(tmp_path):
    grid = SynthGrid()
    marks = {(300, 250): 770, (200, 400): 256}
    path = write_real_format_gcov(tmp_path / "synthetic_win.h5", "2026-06-07", exceptions=marks)
    with open_granule(path) as h5:
        facts = read_facts(h5)
        win = read_window(h5, facts, grid.lonlat_bounds(margin_px=60), "A", ["HHHH", "HVHV"])
        exc = read_exception_window(h5, "A", win.pixels)
        win_b = read_window(h5, facts, grid.lonlat_bounds(margin_px=60), "B", ["HHHH"])
        exc_b = read_exception_window(h5, "B", win_b.pixels)
    assert exc.dtype == np.uint16 and exc.shape == win.terms["HHHH"].shape
    for (row, col), value in marks.items():
        assert exc[row - win.pixels.row0, col - win.pixels.col0] == value
    assert np.count_nonzero((exc != 768) & (exc != 65535)) == len(marks)
    assert exc_b.shape == win_b.terms["HHHH"].shape and set(np.unique(exc_b).tolist()) == {768, 65535}


# The 1.6.0 layout as the real file holds it: focus bits present, _FillValue 65535.
L16 = {"focus_bits": True, "fill": 65535}
# The 1.5.0 layout as the real files hold it: no focus bits, no _FillValue.
L15 = {"focus_bits": False, "fill": None}


def test_summary_of_a_clean_window_like_the_real_one():
    summary = summarise_exceptions(np.full((40, 50), 768, dtype=np.uint16), ["HH", "HV"], **L16)
    assert summary["values"] == [{"value": 768, "count": 2000}] and summary["values_left_out"] == 0
    assert summary["anomaly_share"] == 0.0
    assert summary["not_fully_focused_share"] == {"HH": 0.0, "HV": 0.0}
    assert (summary["pixels"], summary["fill_pixels"], summary["counted_pixels"]) == (2000, 0, 2000)
    assert summary["focus_bits"] is True and summary["fill_value"] == 65535


def test_summary_counts_anomaly_and_focus_bits_and_leaves_out_fill():
    values = np.array([768] * 10 + [770, 258, 256, 0, 512, 65535, 65535], dtype=np.uint16).reshape(1, -1)
    summary = summarise_exceptions(values, ["HH", "HV"], **L16)
    assert summary["counted_pixels"] == 15 and summary["fill_pixels"] == 2
    assert summary["anomaly_pixels"] == 2  # 770 and 258 carry code 2 (sample slip)
    assert summary["not_fully_focused_pixels"] == {"HH": 2, "HV": 3}  # HH: 0, 512; HV: 258, 256, 0
    assert summary["anomaly_share"] == 2 / 15
    assert summary["not_fully_focused_share"] == {"HH": 2 / 15, "HV": 3 / 15}
    assert summary["values"] == [{"value": v, "count": c} for v, c in
                                 [(768, 10), (65535, 2), (0, 1), (256, 1), (258, 1), (512, 1), (770, 1)]]
    json.dumps(summary)  # goes into the sidecar as it is


def test_summary_trap_zero_is_not_good():
    # "No anomaly" is not "good": a 0 has no focus bit, so nothing about it is fully focused. This is also
    # what a chunk the processor never wrote reads as (the HDF5 creation fill value is 0).
    summary = summarise_exceptions(np.zeros(8, dtype=np.uint16), ["HH", "HV"], **L16)
    assert summary["anomaly_share"] == 0.0
    assert summary["not_fully_focused_share"] == {"HH": 1.0, "HV": 1.0}
    # Only the polarizations asked for are counted: an HH-only file is good at 256.
    assert summarise_exceptions(np.full(4, 256, np.uint16), ["HH"], **L16)["not_fully_focused_share"] == {"HH": 0.0}


def test_summary_caps_the_list_of_values_and_says_how_many_were_left_out():
    values = np.repeat(np.arange(768, 798, dtype=np.uint16), np.arange(30, 0, -1))  # 30 values, counts 30..1
    summary = summarise_exceptions(values, ["HH"], listed=5, **L16)
    assert [v["value"] for v in summary["values"]] == [768, 769, 770, 771, 772]
    assert summary["values_left_out"] == 25
    assert summary["pixels_in_values_left_out"] == sum(range(1, 26))
    assert sum(v["count"] for v in summary["values"]) + summary["pixels_in_values_left_out"] == values.size


def test_summary_of_nothing_but_fill_has_no_shares():
    summary = summarise_exceptions(np.full((3, 3), 65535, dtype=np.uint16), ["HH", "HV"], **L16)
    assert summary["counted_pixels"] == 0 and summary["anomaly_share"] is None
    assert summary["not_fully_focused_share"] == {"HH": None, "HV": None}
    assert "n/a" in describe_exceptions(summary)


def test_summary_refuses_what_it_cannot_judge():
    with pytest.raises(ValueError, match="XX"):
        summarise_exceptions(np.full(3, 768, np.uint16), ["HH", "XX"], **L16)
    with pytest.raises(TypeError):
        summarise_exceptions(np.full(3, 768.0), ["HH"], **L16)


def test_describe_exceptions_gives_the_counts_and_shares():
    values = np.array([768] * 6 + [770, 256], dtype=np.uint16)
    text = describe_exceptions(summarise_exceptions(values, ["HH", "HV"], **L16))
    assert text.startswith("1 of 8 px (12.5%) carry an anomaly bit")
    assert "not fully focused: HH 0 px, HV 1 px (12.5%)" in text and "(0 fill px of value 65535 left out)" in text


REAL_WINDOW_PX = 2_424_249  # the real 31 km window of 14 November 2026 (mask 1 and mask 0 pixels)


def test_describe_exceptions_never_rounds_a_count_to_zero():
    # At the size of the real window one pixel is 0.00004 %: printed to three decimals, 12 flagged pixels
    # read 0.000 %, the same as a clean window.
    values = np.full(REAL_WINDOW_PX, 768, dtype=np.uint16)
    values[:12] = 770  # anomaly code 2 (sample slip)
    values[12:24] = 512  # HH not fully focused
    text = describe_exceptions(summarise_exceptions(values, ["HH", "HV"], **L16))
    assert text.startswith(f"12 of {REAL_WINDOW_PX} px (0.00049%) carry an anomaly bit")
    assert "not fully focused: HH 12 px (0.00049%), HV 0 px" in text
    one = np.full(REAL_WINDOW_PX, 768, dtype=np.uint16)
    one[0] = 770
    assert describe_exceptions(summarise_exceptions(one, ["HH", "HV"], **L16)).startswith(
        f"1 of {REAL_WINDOW_PX} px (0.000041%) carry")
    # A flagged file whose window holds nothing flagged says so, instead of printing shares of zero.
    clean = describe_exceptions(summarise_exceptions(np.full(REAL_WINDOW_PX, 768, np.uint16), ["HH", "HV"], **L16))
    assert clean.startswith(f"0 of {REAL_WINDOW_PX} px carry an anomaly bit; every pixel is fully focused in HH, HV")
    assert "0.000%" not in text + clean


# The 1.5.0 layout: no focus bits, so a bit that is off says nothing about focusing.

def test_summary_of_a_clean_1_5_0_window_has_no_focus_numbers():
    # What the five flagged real 1.5.0 dates held inside the site's window: 0 everywhere.
    summary = summarise_exceptions(np.zeros((40, 50), dtype=np.uint8), ["HH", "HV"], **L15)
    assert summary["focus_bits"] is False and summary["fill_value"] is None
    assert summary["not_fully_focused_pixels"] is None and summary["not_fully_focused_share"] is None
    assert (summary["pixels"], summary["fill_pixels"], summary["counted_pixels"]) == (2000, 0, 2000)
    assert summary["anomaly_pixels"] == 0 and summary["anomaly_share"] == 0.0
    assert summary["values"] == [{"value": 0, "count": 2000}]
    assert summary["method"] == EXCEPTION_SUMMARY_METHOD
    text = describe_exceptions(summary)
    assert text.startswith("0 of 2000 px carry an anomaly bit; this product version's exception mask carries no "
                           "focus information")
    assert "not fully focused" not in text and "100.0%" not in text
    assert "no fill value" in text
    json.dumps(summary)


def test_summary_of_a_1_5_0_window_counts_the_sample_slip_pixels_exactly():
    values = np.zeros(REAL_WINDOW_PX, dtype=np.uint8)
    values[:7] = 2  # code 2, sample slip
    summary = summarise_exceptions(values, ["HH", "HV"], **L15)
    assert summary["anomaly_pixels"] == 7 and summary["anomaly_share"] == 7 / REAL_WINDOW_PX
    assert summary["not_fully_focused_pixels"] is None and summary["not_fully_focused_share"] is None
    assert summary["values"] == [{"value": 0, "count": REAL_WINDOW_PX - 7}, {"value": 2, "count": 7}]
    text = describe_exceptions(summary)
    assert text.startswith(f"7 of {REAL_WINDOW_PX} px (0.00029%) carry an anomaly bit")
    assert "not fully focused" not in text and "no focus information" in text


def test_without_focus_bits_any_non_zero_value_is_an_anomaly_and_polarizations_need_no_focus_bit():
    values = np.array([0, 0, 2, 1, 128], dtype=np.uint8)
    summary = summarise_exceptions(values, ["HH", "XX"], **L15)  # no focus bit is looked up, so XX is fine
    assert summary["anomaly_pixels"] == 3


def test_the_fill_value_is_the_files_own():
    # No _FillValue (1.5.0): no value is fill, not even 255 or 65535.
    summary = summarise_exceptions(np.array([0, 0, 255], dtype=np.uint8), ["HH"], **L15)
    assert (summary["fill_pixels"], summary["counted_pixels"]) == (0, 3)
    # 65535 does not fit a uint8: nothing is fill, and nothing fails.
    summary = summarise_exceptions(np.array([0, 2], dtype=np.uint8), ["HH"], focus_bits=False, fill=65535)
    assert (summary["fill_pixels"], summary["anomaly_pixels"]) == (0, 1)
    # Whatever the file says is fill is left out, and nothing else.
    values = np.array([768, 768, 7, 65535], dtype=np.uint16)
    summary = summarise_exceptions(values, ["HH", "HV"], focus_bits=True, fill=7)
    assert (summary["fill_pixels"], summary["counted_pixels"], summary["fill_value"]) == (1, 3, 7)
    assert summary["anomaly_pixels"] == 1  # 65535 is not fill here, and its low bits are set

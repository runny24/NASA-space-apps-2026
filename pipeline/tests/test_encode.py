"""The 8-bit encoding of docs/DATA_CONTRACT.md."""

from __future__ import annotations

import numpy as np
import pytest

from pipeline.encode import clip_report, decode, encode, encoding_json, step


def test_end_points_and_nodata():
    codes = encode(np.array([-35.0, 5.0, np.nan]), -35, 5)
    assert codes.dtype == np.uint8
    assert codes.tolist() == [1, 255, 0]
    assert np.isnan(decode(np.array([0]), -35, 5)[0])


def test_round_trip_within_half_a_step():
    values = np.linspace(-35, 5, 10001)
    back = decode(encode(values, -35, 5), -35, 5)
    assert np.max(np.abs(back - values)) <= step(-35, 5) / 2 + 1e-9


def test_every_code_decodes_and_re_encodes_to_itself():
    codes = np.arange(1, 256, dtype=np.uint8)
    assert (encode(decode(codes, -10, 10), -10, 10) == codes).all()


def test_clipping_and_report():
    values = np.array([-50.0, -35.0, 0.0, 5.0, 9.0, 12.0, np.nan])
    codes = encode(values, -35, 5)
    assert codes.tolist() == [1, 1, 223, 255, 255, 255, 0]
    report = clip_report(values, -35, 5)
    assert report.valid == 6
    assert report.below == pytest.approx(1 / 6)
    assert report.above == pytest.approx(2 / 6)
    assert clip_report(np.array([np.nan]), -35, 5).valid == 0


def test_formula_matches_the_contract_example():
    # pixel = 1 + round(254 * (physical - lo) / (hi - lo)); -15 dB in -35..5 is 1 + 127 = 128
    assert encode(np.array([-15.0]), -35, 5)[0] == 128
    assert encoding_json(-35, 5) == {"type": "linear-uint8", "nodata": 0, "lo": -35, "hi": 5}


def test_bad_range_is_rejected():
    with pytest.raises(ValueError):
        encode(np.array([1.0]), 5, 5)

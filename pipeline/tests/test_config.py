"""Site files: the real ones load, and mistakes are reported with the file and field name."""

from __future__ import annotations

import re

import pytest
import yaml

from pipeline.config import (
    RAMPS,
    ConfigError,
    Display,
    Fires,
    Harvest,
    StableTarget,
    check_harvest_dates,
    load_granule_list,
    load_site,
    parse_site,
    sites_dir,
)
from pipeline.paths import REPO_ROOT


def test_sample_site_and_template_load():
    sample = load_site("sample")
    assert sample.is_sample and sample.releases == ["sample"] and sample.access == "public"
    assert sample.notice.startswith("Sample data, not a NISAR observation.")
    assert load_granule_list("sample")["stack"] == sample.stack
    template = yaml.safe_load((sites_dir() / "_template.yaml").read_text(encoding="utf-8"))
    parsed = parse_site(template, sites_dir() / "_template.yaml")
    assert len(parsed.releases) == 1  # two releases give a mixed series, which TASKS T4 forbids
    assert parsed.series_min_coverage == 0.8
    assert sample.backscatter.description is None and sample.change.description is None
    assert sample.citation.endswith("Original ALOS-1 PALSAR data © JAXA/METI 2008.")


def _base() -> dict:
    return yaml.safe_load((sites_dir() / "_template.yaml").read_text(encoding="utf-8"))


@pytest.mark.parametrize("field, value, message", [
    ("bbox", [10, 0, 5, 1], "west < east"),
    ("frequency", "C", "A or B"),
    ("stack", "83_A_8", "track_direction_frame"),
    ("polarizations", ["HH", "XX"], "polarizations"),
    ("releases", ["sample"], "is_sample"),
    ("working_resolution_m", "forty", "expected float"),
    ("change_boxcar_px", 4, "odd"),
    ("id", "My Site", "lower-case"),
])
def test_bad_fields_name_the_field(tmp_path, field, value, message):
    data = _base()
    data[field] = value
    with pytest.raises(ConfigError, match=message) as err:
        parse_site(data, tmp_path / "x.yaml")
    assert f"'{field}'" in str(err.value) and "x.yaml" in str(err.value)


def test_unknown_field_is_an_error(tmp_path):
    data = _base()
    data["bbbox"] = [0, 0, 1, 1]
    with pytest.raises(ConfigError, match="bbbox"):
        parse_site(data, tmp_path / "x.yaml")


def test_sample_needs_a_notice(tmp_path):
    data = _base()
    data.update(is_sample=True, releases=["sample"])
    with pytest.raises(ConfigError, match="notice"):
        parse_site(data, tmp_path / "x.yaml")


def test_missing_site_file_says_where(tmp_path):
    with pytest.raises(ConfigError, match="no such site file"):
        load_site("nowhere", tmp_path)


def _style(**display) -> dict:
    return {"encoding": {"lo": -35, "hi": 5}, "display": {"min": -25, "max": 0, "ramp": "grey", **display}}


@pytest.mark.parametrize("block, message", [
    (_style(ramp="gray-ish"), "unknown colour ramp 'gray-ish'; the app knows grey, viridis"),
    (_style(min=0, max=-25), "display.max': must be greater than min"),
    (_style(min=0, max=0), "display.max': must be greater than min"),
    ({**_style(), "encoding": {"lo": 5, "hi": -35}}, "encoding.hi': must be greater than lo"),
    ({**_style(), "description": "  "}, "backscatter.description': is empty"),
])
def test_bad_layer_styles_are_rejected(tmp_path, block, message):
    data = _base()
    data["backscatter"] = block
    with pytest.raises(ConfigError, match=re.escape(message)):
        parse_site(data, tmp_path / "x.yaml")


def test_layer_description_is_the_teams_text(tmp_path):
    data = _base()
    data["change"]["description"] = "Written by the team."
    assert parse_site(data, tmp_path / "x.yaml").change.description == "Written by the team."


@pytest.mark.parametrize("value", [0, 1.5])
def test_series_min_coverage_is_a_fraction(tmp_path, value):
    data = _base()
    data["series_min_coverage"] = value
    with pytest.raises(ConfigError, match=re.escape("series_min_coverage': must be in (0, 1]")):
        parse_site(data, tmp_path / "x.yaml")


# The template's placeholder bbox is [0.0, 0.0, 0.4, 0.3]; the target boxes below are synthetic numbers inside
# or outside it, not places.

def test_stable_target_is_optional_and_read_with_a_default_tolerance(tmp_path):
    assert parse_site(_base(), tmp_path / "x.yaml").stable_target is None  # the template leaves it commented out
    data = _base()
    data["stable_target"] = {"name": "  a synthetic target  ", "bbox": [0.1, 0.1, 0.2, 0.2]}
    target = parse_site(data, tmp_path / "x.yaml").stable_target
    assert target == StableTarget(name="a synthetic target", bbox=(0.1, 0.1, 0.2, 0.2), tolerance_db=1.0)
    data["stable_target"]["tolerance_db"] = 2
    assert parse_site(data, tmp_path / "x.yaml").stable_target.tolerance_db == 2.0
    data["stable_target"] = None  # an empty `stable_target:` line: no check
    assert parse_site(data, tmp_path / "x.yaml").stable_target is None


def test_template_explains_the_stable_target_with_placeholders_only():
    text = (sites_dir() / "_template.yaml").read_text(encoding="utf-8")
    block = text[text.index("# Stable-target check"):]
    assert "dense forest or a city" in block and "#   bbox: [west, south, east, north]" in block
    assert not re.search(r"bbox: \[-?\d", block)  # no numbers that could be read as a real place


@pytest.mark.parametrize("target, message", [
    ({"bbox": [0.1, 0.1, 0.2, 0.2]}, "stable_target.name': is required"),
    ({"name": "  ", "bbox": [0.1, 0.1, 0.2, 0.2]}, "stable_target.name': is empty"),
    ({"name": "t"}, "stable_target.bbox': is required"),
    ({"name": "t", "bbox": [0.1, 0.1, 0.2]}, "stable_target.bbox': expected [west, south, east, north]"),
    ({"name": "t", "bbox": [0.2, 0.1, 0.1, 0.2]}, "stable_target.bbox': expected west < east"),
    ({"name": "t", "bbox": [0.5, 0.1, 0.6, 0.2]}, "stable_target.bbox': must lie inside the site's bbox"),
    ({"name": "t", "bbox": [0.3, 0.1, 0.5, 0.2]}, "stable_target.bbox': must lie inside the site's bbox"),
    ({"name": "t", "bbox": [0.1, 0.1, 0.2, 0.2], "tolerance_db": 0}, "stable_target.tolerance_db': must be a positive"),
    ({"name": "t", "bbox": [0.1, 0.1, 0.2, 0.2], "tolerance_db": -1.0}, "tolerance_db': must be a positive"),
    ({"name": "t", "bbox": [0.1, 0.1, 0.2, 0.2], "tolerance_db": "one"}, "tolerance_db': expected float"),
    ({"name": "t", "bbox": [0.1, 0.1, 0.2, 0.2], "tolerance": 1.0}, "unknown field(s) stable_target.tolerance"),
    ("a synthetic target", "stable_target': expected dict"),
])
def test_bad_stable_target_names_the_field(tmp_path, target, message):
    data = _base()
    data["stable_target"] = target
    with pytest.raises(ConfigError, match=re.escape(message)) as err:
        parse_site(data, tmp_path / "x.yaml")
    assert "x.yaml" in str(err.value)


# The harvest block. Dates and boxes below are synthetic: the template's placeholder bbox is [0, 0, 0.4, 0.3].

SITE_DATES = ["2026-06-01", "2026-06-13", "2026-08-24", "2026-09-05", "2026-09-17", "2026-09-29"]


def _with_harvest(**harvest) -> dict:
    data = _base()
    data["working_resolution_m"] = 20
    data["stable_target"] = {"name": "a synthetic target", "bbox": [0.1, 0.1, 0.2, 0.2]}
    data["harvest"] = {"flood_dates": SITE_DATES[:2], "peak_dates": [SITE_DATES[2]], "passes": SITE_DATES[3:],
                       **harvest}
    return data


def test_harvest_is_optional_and_read_with_defaults(tmp_path):
    assert parse_site(_base(), tmp_path / "x.yaml").harvest is None  # the template leaves it commented out
    h = parse_site(_with_harvest(), tmp_path / "x.yaml").harvest
    assert h == Harvest(cell_m=100.0, marker="HH", flood_dates=tuple(SITE_DATES[:2]), peak_dates=(SITE_DATES[2],),
                        passes=tuple(SITE_DATES[3:]), false_alarm=0.02, rice_rise_db=None,
                        stable_boxes=((0.1, 0.1, 0.2, 0.2),), stable_boxes_from="stable_target")
    assert h.pairs == [(SITE_DATES[3], SITE_DATES[4]), (SITE_DATES[4], SITE_DATES[5])]
    own = parse_site(_with_harvest(marker="HV", cell_m=60, rice_rise_db=6, false_alarm=0.05,
                                   stable_boxes=[[0.01, 0.01, 0.02, 0.02], [0.3, 0.2, 0.35, 0.25]],
                                   title="Our title", description=" Our words. "), tmp_path / "x.yaml").harvest
    assert (own.marker, own.cell_m, own.rice_rise_db, own.false_alarm) == ("HV", 60.0, 6.0, 0.05)
    assert own.stable_boxes == ((0.01, 0.01, 0.02, 0.02), (0.3, 0.2, 0.35, 0.25))
    assert own.stable_boxes_from == "stable_boxes" and (own.title, own.description) == ("Our title", "Our words.")


def test_harvest_dates_may_be_written_without_quotes(tmp_path):
    text = (sites_dir() / "_template.yaml").read_text(encoding="utf-8") + (
        "stable_target: {name: t, bbox: [0.1, 0.1, 0.2, 0.2]}\n"
        "harvest:\n  cell_m: 120\n  flood_dates: [2026-06-01]\n  peak_dates: [2026-08-24]\n"
        "  passes: [2026-09-05, 2026-09-17, 2026-09-29]\n")
    h = parse_site(yaml.safe_load(text), tmp_path / "x.yaml").harvest  # YAML reads these as dates, not text
    assert h.flood_dates == ("2026-06-01",) and h.passes == ("2026-09-05", "2026-09-17", "2026-09-29")


@pytest.mark.parametrize("harvest, message", [
    ({"passes": SITE_DATES[3:5]}, "harvest.passes': needs at least 3 dates, got 2"),
    ({"marker": "VV"}, "harvest.marker': must be one of HH, HV, got 'VV'"),
    ({"marker": "hh"}, "harvest.marker': must be one of HH, HV, got 'hh'"),
    ({"passes": [SITE_DATES[4], SITE_DATES[3], SITE_DATES[5]]}, "harvest.passes': must be in ascending order"),
    ({"peak_dates": [SITE_DATES[1], SITE_DATES[2]]}, "harvest.peak_dates': 2026-06-13 is also a flood date"),
    ({"flood_dates": ["2026-6-1"]}, "harvest.flood_dates': expected dates written YYYY-MM-DD, got '2026-6-1'"),
    ({"flood_dates": ["2026-02-30"]}, "harvest.flood_dates': '2026-02-30' is not a calendar date"),
    ({"flood_dates": [SITE_DATES[0], SITE_DATES[0]]}, "harvest.flood_dates': names a date more than once"),
    ({"peak_dates": []}, "harvest.peak_dates': needs at least 1 date, got 0"),
    ({"cell_m": 90}, "harvest.cell_m': must be a whole multiple of working_resolution_m (20 m), got 90"),
    ({"cell_m": 10}, "harvest.cell_m': must be a whole multiple of working_resolution_m (20 m), got 10"),
    ({"false_alarm": 0.5}, "harvest.false_alarm': must be a fraction between 0 and 0.5"),
    ({"false_alarm": 0}, "harvest.false_alarm': must be a fraction between 0 and 0.5"),
    ({"rice_rise_db": "high"}, "harvest.rice_rise_db': expected 'auto' or a number of dB, got 'high'"),
    ({"rice_rise_db": -2}, "harvest.rice_rise_db': must be a positive number of dB"),
    ({"stable_boxes": []}, "harvest.stable_boxes': is empty"),
    ({"stable_boxes": [[0.5, 0.1, 0.6, 0.2]]}, "harvest.stable_boxes': box 0 [0.5, 0.1, 0.6, 0.2] must lie inside"),
    ({"stable_boxes": [[0.1, 0.1, 0.2]]}, "harvest.stable_boxes[0]': expected [west, south, east, north]"),
    ({"pases": SITE_DATES[3:]}, "unknown field(s) harvest.pases"),
    ({"description": "  "}, "harvest.description': is empty"),
    ({"marker": True}, "harvest.marker': expected str, got a true/false value"),
])
def test_bad_harvest_settings_name_the_field(tmp_path, harvest, message):
    with pytest.raises(ConfigError, match=re.escape(message)) as err:
        parse_site(_with_harvest(**harvest), tmp_path / "x.yaml")
    assert "x.yaml" in str(err.value)


def test_harvest_needs_stable_ground_and_both_polarizations(tmp_path):
    data = _with_harvest()
    del data["stable_target"]
    with pytest.raises(ConfigError, match=re.escape("harvest.stable_boxes': is required when the site has no "
                                                    "stable_target")):
        parse_site(data, tmp_path / "x.yaml")
    data["harvest"]["stable_boxes"] = [[0.1, 0.1, 0.2, 0.2]]
    assert parse_site(data, tmp_path / "x.yaml").harvest.stable_boxes_from == "stable_boxes"
    data["polarizations"] = ["HH"]
    with pytest.raises(ConfigError, match=re.escape("harvest.marker': the harvest analysis computes both HH and "
                                                    "HV, but the site's polarizations ['HH'] lack HV")):
        parse_site(data, tmp_path / "x.yaml")


def test_every_harvest_date_must_be_a_site_date(tmp_path):
    cfg = parse_site(_with_harvest(passes=[SITE_DATES[3], "2026-09-18", SITE_DATES[5]]), tmp_path / "x.yaml")
    with pytest.raises(ConfigError, match=re.escape("field 'harvest.passes': 2026-09-18 is not among the site's "
                                                    "dates (2026-06-01, ")) as err:
        check_harvest_dates(cfg, SITE_DATES)
    assert "x.yaml" in str(err.value)
    check_harvest_dates(parse_site(_with_harvest(), tmp_path / "x.yaml"), SITE_DATES)  # all known: no error
    check_harvest_dates(parse_site(_base(), tmp_path / "x.yaml"), [])  # no harvest block: nothing to check


def test_template_explains_the_harvest_block_with_placeholders_only():
    text = (sites_dir() / "_template.yaml").read_text(encoding="utf-8")
    block = text[text.index("# Harvest analysis"):]
    for name in ("cell_m", "marker", "flood_dates", "peak_dates", "passes", "false_alarm", "rice_rise_db",
                 "stable_boxes", "title", "description"):
        assert f"#   {name}:" in block, name
    assert "BEFORE the harvest" in block and "docs/METHODS.md" in block
    assert not re.search(r"\d{4}-\d{2}-\d{2}", block)  # no dates of a real season
    assert not re.search(r"\[\[?-?\d", block)  # and no numbers that could be read as a place


# The fires block, the story and the display per polarization. Dates are synthetic.

FIRES = {"start": "2026-09-01", "end": "2026-09-30", "sources": ["VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT"]}


def test_fires_is_optional_and_read_as_written(tmp_path):
    assert parse_site(_base(), tmp_path / "x.yaml").fires is None
    data = _with_harvest()
    data["fires"] = {**FIRES, "periods": [["2026-09-05", "2026-09-14"], ["2026-09-15", "2026-09-15"]],
                     "title": "Our title", "description": " Our words. "}
    f = parse_site(data, tmp_path / "x.yaml").fires
    assert f == Fires(start="2026-09-01", end="2026-09-30", sources=("VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT"),
                      periods=(("2026-09-05", "2026-09-14"), ("2026-09-15", "2026-09-15")), title="Our title",
                      description="Our words.")
    overlay_only = _base()
    overlay_only["fires"] = dict(FIRES)  # no periods: the overlay alone, which needs no harvest block
    assert parse_site(overlay_only, tmp_path / "x.yaml").fires.periods == ()
    text = (sites_dir() / "_template.yaml").read_text(encoding="utf-8") + (
        "fires: {start: 2026-09-01, end: 2026-09-30, sources: [VIIRS_NOAA20_NRT]}\n")
    assert parse_site(yaml.safe_load(text), tmp_path / "x.yaml").fires.start == "2026-09-01"  # unquoted dates


@pytest.mark.parametrize("fires, message", [
    ({"end": "2026-08-31"}, "fires.end': 2026-08-31 is before start 2026-09-01"),
    ({"sources": ["MODIS_NRT"]}, "fires.sources': expected a non-empty list of distinct FIRMS source names"),
    ({"sources": []}, "fires.sources': expected a non-empty list"),
    ({"sources": ["VIIRS_NOAA20_NRT", "VIIRS_NOAA20_NRT"]}, "fires.sources': expected a non-empty list of distinct"),
    ({"start": "2026-9-1"}, "fires.start': expected dates written YYYY-MM-DD"),
    ({"periods": [["2026-09-05"]]}, "fires.periods[0]': expected [first day, last day]"),
    ({"periods": [["2026-09-10", "2026-09-05"]]}, "fires.periods[0]': the last day 2026-09-05 is before"),
    ({"periods": [["2026-08-25", "2026-09-05"]]}, "fires.periods[0]': [2026-08-25, 2026-09-05] must lie inside"),
    ({"periods": [["2026-09-05", "2026-09-06"]] * 2}, "fires.periods': names the same period more than once"),
    ({"source": ["VIIRS_NOAA20_NRT"]}, "unknown field(s) fires.source"),
    ({"title": " "}, "fires.title': is empty"),
])
def test_bad_fires_settings_name_the_field(tmp_path, fires, message):
    data = _with_harvest()
    data["fires"] = {**FIRES, **fires}
    with pytest.raises(ConfigError, match=re.escape(message)) as err:
        parse_site(data, tmp_path / "x.yaml")
    assert "x.yaml" in str(err.value)


def test_fire_periods_need_a_harvest_block(tmp_path):
    data = _base()
    data["fires"] = {**FIRES, "periods": [["2026-09-05", "2026-09-14"]]}
    with pytest.raises(ConfigError, match=re.escape("fires.periods': compare fire density across the classes of "
                                                    "the harvest-wave layer, so the site needs a harvest block")):
        parse_site(data, tmp_path / "x.yaml")


STEP = {"id": "first-step", "title": "A title", "text": "Some text."}


def test_story_is_copied_as_written(tmp_path):
    assert parse_site(_base(), tmp_path / "x.yaml").story == ()
    data = _base()
    data["story"] = [
        {**STEP, "layer": "hh", "date": "2026-09-05", "overlays": ["fires"],
         "view": {"center": [0.2, 0.15], "zoom": 11}},
        {"id": "second", "title": "T", "text": "X", "layer": "hh-change", "reference": "2026-09-05",
         "secondary": "2026-09-17"},
        {"id": "third", "title": "T", "text": "X"},
    ]
    story = parse_site(data, tmp_path / "x.yaml").story
    assert [dict(s) for s in story] == data["story"]
    text = (sites_dir() / "_template.yaml").read_text(encoding="utf-8") + (
        "story:\n  - {id: a, title: T, text: X, layer: hh, date: 2026-09-05}\n")
    assert parse_site(yaml.safe_load(text), tmp_path / "x.yaml").story[0]["date"] == "2026-09-05"


@pytest.mark.parametrize("step, message", [
    ({"id": "Bad Id"}, "story[0].id': use lower-case"),
    ({"title": " "}, "story[0].title': is empty"),
    ({"date": "2026-09-05"}, "story[0].layer': is required when the step names a date or a pair"),
    ({"layer": "hh", "reference": "2026-09-05"}, "story[0].reference': reference and secondary come together"),
    ({"layer": "hh", "date": "2026-09-05", "reference": "2026-09-05", "secondary": "2026-09-17"},
     "story[0].date': a step shows either one date"),
    ({"overlays": ["fires", "fires"]}, "story[0].overlays': expected distinct overlay ids"),
    ({"view": {"center": [0.2, 95], "zoom": 3}}, "story[0].view.center': expected [longitude, latitude]"),
    ({"view": {"center": [0.2, 0.1], "zoom": 30}}, "story[0].view.zoom': expected a web-map zoom"),
    ({"txt": "x"}, "unknown field(s) story[0].txt"),
])
def test_bad_story_steps_name_the_field(tmp_path, step, message):
    data = _base()
    data["story"] = [{**STEP, **step}]
    with pytest.raises(ConfigError, match=re.escape(message)):
        parse_site(data, tmp_path / "x.yaml")


def test_story_step_ids_are_unique(tmp_path):
    data = _base()
    data["story"] = [STEP, dict(STEP)]
    with pytest.raises(ConfigError, match=re.escape("story': step id first-step appears more than once")):
        parse_site(data, tmp_path / "x.yaml")


def test_display_by_polarization_replaces_the_display_of_one_layer(tmp_path):
    data = _base()
    data["backscatter"]["display_by_polarization"] = {"HV": {"min": -30, "max": -8, "ramp": "grey"}}
    bs = parse_site(data, tmp_path / "x.yaml").backscatter
    assert bs.display_for("HV") == Display(min=-30.0, max=-8.0, ramp="grey")
    assert bs.display_for("HH") == bs.display == Display(min=-25.0, max=0.0, ramp="grey")


@pytest.mark.parametrize("by_pol, message", [
    ({"VV": {"min": -30, "max": -8, "ramp": "grey"}}, "backscatter.display_by_polarization': 'VV' is not one of"),
    ({"HV": {"min": -8, "max": -30, "ramp": "grey"}}, "display_by_polarization.HV.max': must be greater than min"),
    ({"HV": {"min": -30, "max": -8, "ramp": "rainbow"}}, "display_by_polarization.HV.ramp': unknown colour ramp"),
    ({"HV": {"min": -30, "max": -8}}, "display_by_polarization.HV.ramp': is required"),
    ({"HV": -30}, "display_by_polarization.HV': expected {min"),
])
def test_bad_display_by_polarization_names_the_field(tmp_path, by_pol, message):
    data = _base()
    data["backscatter"]["display_by_polarization"] = by_pol
    with pytest.raises(ConfigError, match=re.escape(message)):
        parse_site(data, tmp_path / "x.yaml")


def test_template_explains_fires_and_story_with_placeholders_only():
    text = (sites_dir() / "_template.yaml").read_text(encoding="utf-8")
    block = text[text.index("# Fire detections"):]
    for name in ("start", "end", "sources", "periods", "title", "description"):
        assert f"#   {name}:" in block, name
    assert "FIRMS_MAP_KEY" in block and "# story:" in block and "docs/METHODS.md" in block
    assert "display_by_polarization" in text
    assert not re.search(r"\d{4}-\d{2}-\d{2}", block)


def test_ramp_names_match_the_web_app():
    text = (REPO_ROOT / "web" / "src" / "map" / "ramps.ts").read_text(encoding="utf-8")
    body = text[text.index("RAMPS"):]
    body = body[:body.index("};")]
    names = re.findall(r"^\s*'?([A-Za-z0-9-]+)'?\s*:\s*\[", body, flags=re.MULTILINE)
    assert sorted(names) == sorted(RAMPS)

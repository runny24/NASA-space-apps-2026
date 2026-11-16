"""The story in the team's site file is valid before anything is exported.

`validate` cannot tell: it reads only the published data, which has no story until `export` copies it there. So
this reads pipeline/sites/tarn-taran.yaml with the pipeline's own loader and runs rule 12 of
docs/DATA_CONTRACT.md (`story_errors`) and the manifest schema (`#/$defs/storyStep`) on its steps, against
the layers, dates and overlays of the published web/public/data/tarn-taran/site.json. Read only: nothing is
written.
"""

from __future__ import annotations

import copy

import pytest

from pipeline.config import load_site
from pipeline.manifest import MANIFEST, schema_errors, story_errors
from pipeline.paths import default_layout
from pipeline.rasters import read_json

SITE_ID = "tarn-taran"
SITE_FILE = f"pipeline/sites/{SITE_ID}.yaml"


def _published_site() -> dict:
    return read_json(default_layout().site_data(SITE_ID) / "site.json")


def _with_story(site: dict, steps: list[dict]) -> dict:
    """The published site as `export` would write it with these steps: the site file's story replaces any."""
    return {**site, "story": steps}


@pytest.fixture(scope="module")
def steps() -> list[dict]:
    story = [dict(step) for step in load_site(SITE_ID).story]
    assert story, f"{SITE_FILE} has no story: this test checks its steps"
    return story


def test_story_names_only_what_the_published_site_has(steps):
    errors = story_errors(_with_story(_published_site(), steps))
    assert errors == [], (f"{SITE_FILE}: the story names a layer, date or overlay that the published site "
                          f"(web/public/data/{SITE_ID}/site.json) does not have:\n  " + "\n  ".join(errors))


def test_story_steps_match_the_manifest_schema(steps):
    manifest = read_json(default_layout().data_dir / MANIFEST)
    index = next(i for i, s in enumerate(manifest["sites"]) if s["id"] == SITE_ID)
    manifest["sites"][index] = _with_story(_published_site(), steps)
    errors = schema_errors(manifest, "manifest.schema.json")
    assert errors == [], (f"{SITE_FILE}: the story does not fit #/$defs/storyStep of "
                          "contract/manifest.schema.json:\n  " + "\n  ".join(errors))


# The check above must be able to fail on this very site: a step that names what is not published is caught.
# 2026-07-07 is one of the site's missing passes (a product with no data here), so no layer has a file for it.
@pytest.mark.parametrize("change, message", [
    ({"layer": "vv"}, "layer 'vv' is not a layer of the site"),
    ({"layer": "hh", "date": "2026-07-07"}, "layer hh has no file for 2026-07-07"),
    ({"layer": "harvest-wave", "date": "2026-11-04"}, "gives a date, but layer harvest-wave is static"),
    ({"overlays": ["smoke"]}, "overlay 'smoke' is not an overlay of the site"),
])
def test_a_step_naming_what_is_not_published_fails(steps, change, message):
    broken = copy.deepcopy(steps)
    broken[0] = {k: v for k, v in broken[0].items() if k not in ("layer", "date")} | change
    errors = story_errors(_with_story(_published_site(), broken))
    assert any(f"story step {broken[0]['id']}: {message}" in e for e in errors), errors

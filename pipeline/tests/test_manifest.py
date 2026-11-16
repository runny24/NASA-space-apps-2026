"""The manifest passes its schema, and each rule of docs/DATA_CONTRACT.md fails when broken on purpose."""

from __future__ import annotations

import copy
import subprocess

import pytest

from pipeline import manifest as manifest_mod
from pipeline.manifest import MANIFEST, rule_errors, schema_errors, url_join, validate
from pipeline.rasters import read_json, write_json


@pytest.fixture
def manifest(synthetic_run):
    return read_json(synthetic_run.layout.data_dir / MANIFEST)


def test_valid_manifest_passes(manifest, synthetic_run):
    assert schema_errors(manifest, "manifest.schema.json") == []
    assert rule_errors(manifest, synthetic_run.layout.data_dir) == []
    assert manifest["generator"]["ai_assisted"] is True


def test_real_sites_come_before_sample_sites(tmp_path):
    # The app opens manifest.sites[0] when the address names no site: a visitor must land on a real site.
    for site_id, is_sample in (("a-sample", True), ("m-real", False), ("b-real", False), ("c-sample", True)):
        write_json(tmp_path / site_id / "site.json", {"id": site_id, "is_sample": is_sample})
    order = [s["id"] for s in manifest_mod.assemble(tmp_path)["sites"]]
    assert order == ["b-real", "m-real", "a-sample", "c-sample"]


def test_urls_use_forward_slashes(manifest):
    site = manifest["sites"][0]
    urls = [i["url"] for layer in site["layers"] for i in layer["items"]] + [s["url"] for s in site["stacks"]]
    assert all("\\" not in u and u.startswith(site["id"] + "/") for u in urls)
    assert url_join("a", "b/", "/c.tif") == "a/b/c.tif"


def test_schema_catches_a_missing_field(manifest):
    broken = copy.deepcopy(manifest)
    del broken["sites"][0]["source"]["stack"]
    assert any("stack" in e for e in schema_errors(broken, "manifest.schema.json"))


def _site(m):
    return m["sites"][0]


BREAKAGES = {
    "rule 1": lambda m: m["sites"].append(copy.deepcopy(_site(m))),
    "rule 1 ": lambda m: _site(m)["layers"].append(copy.deepcopy(_site(m)["layers"][0])),
    "rule 2": lambda m: _site(m)["dates"].reverse(),
    "rule 3": lambda m: _site(m)["layers"][0]["items"][0].update(date="1999-01-01"),
    "rule 3 ": lambda m: _site(m)["layers"][1]["items"][0].update(
        reference=_site(m)["layers"][1]["items"][0]["secondary"],
        secondary=_site(m)["layers"][1]["items"][0]["reference"]),
    "rule 4": lambda m: _site(m)["stacks"][0].update(band_dates=_site(m)["stacks"][0]["band_dates"][:-1]),
    "rule 4 ": lambda m: _site(m)["stacks"][0].update(layer="hh-change"),
    "rule 5": lambda m: _site(m)["missing_passes"].append({"date": _site(m)["dates"][0]["date"], "reason": "x"}),
    "rule 6": lambda m: _site(m)["dates"][0].update(release="provisional"),
    "rule 7": lambda m: _site(m).pop("notice"),
    "rule 7 ": lambda m: _site(m).update(is_sample=False),
    "rule 8": lambda m: _site(m)["layers"][0]["items"][0].update(url="synthetic-test/missing.tif"),
    "rule 8 ": lambda m: _site(m)["layers"][0]["items"][0].update(url="synthetic-test\\hh_2026-06-07.tif"),
    "rule 8  ": lambda m: _site(m)["layers"][0].update(encoding={**_site(m)["layers"][0]["encoding"], "hi": 20}),
    "rule 8   ": lambda m: _site(m)["stacks"][0].update(encoding={**_site(m)["stacks"][0]["encoding"], "lo": -40}),
    "rule 9": lambda m: _site(m).update(bounds=[10.0, 10.0, 10.1, 10.1]),
    "rule 10": lambda m: _site(m)["layers"][0].update(encoding={"type": "categorical-uint8", "nodata": 0, "classes": [
        {"value": 1, "label": "a", "color": "#000000"}, {"value": 1, "label": "b", "color": "#ffffff"}]}),
}


@pytest.mark.parametrize("rule", list(BREAKAGES))
def test_each_rule_fails_when_broken(manifest, synthetic_run, rule):
    broken = copy.deepcopy(manifest)
    BREAKAGES[rule](broken)
    errors = rule_errors(broken, synthetic_run.layout.data_dir)
    assert any(e.startswith(rule.strip() + ":") for e in errors), errors


def test_validate_reports_a_stale_manifest(synthetic_run, tmp_path):
    import shutil

    data = tmp_path / "data"
    shutil.copytree(synthetic_run.layout.data_dir, data)
    site = read_json(data / "synthetic-test" / "site.json")
    site["title"] = "changed after the manifest was built"
    write_json(data / "synthetic-test" / "site.json", site)
    assert any("out of date" in e for e in validate(data))


def test_encoding_mismatch_names_the_file(manifest, synthetic_run):
    broken = copy.deepcopy(manifest)
    BREAKAGES["rule 8  "](broken)
    errors = [e for e in rule_errors(broken, synthetic_run.layout.data_dir) if "ENCODING" in e]
    assert len(errors) == len(_site(broken)["layers"][0]["items"])
    assert "decode it wrongly" in errors[0] and "npm run pipeline -- export --site synthetic-test" in errors[0]


def _fake_git(head: str, status: str | None):
    def run(args, **kwargs):
        if "rev-parse" in args:
            return subprocess.CompletedProcess(args, 0, head, "")
        assert args[-3:] == ["--", "pipeline", "contract"]
        if status is None:
            return subprocess.CompletedProcess(args, 128, "", "fatal")
        return subprocess.CompletedProcess(args, 0, status, "")
    return run


@pytest.mark.parametrize("status, expected", [
    ("", "abc1234"),
    (" M pipeline/stages.py\n", "abc1234+uncommitted"),
    ("?? contract/new.json\n", "abc1234+uncommitted"),
    (None, "abc1234+uncommitted"),  # status failed: do not claim the tree is clean
])
def test_git_commit_says_when_the_code_is_not_committed(monkeypatch, status, expected):
    monkeypatch.setattr(manifest_mod.subprocess, "run", _fake_git("abc1234\n", status))
    assert manifest_mod.git_commit() == expected


def test_git_commit_without_git(monkeypatch):
    def missing(*args, **kwargs):
        raise FileNotFoundError("git")
    monkeypatch.setattr(manifest_mod.subprocess, "run", missing)
    assert manifest_mod.git_commit() is None
    assert "git_commit" not in manifest_mod.generator_block()

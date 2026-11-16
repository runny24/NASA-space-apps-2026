"""Opening products, spotting a login page, the .env loader and the command line. Offline: the only
server used is a throwaway one on this computer's loopback address."""

from __future__ import annotations

import json
import os
import platform
import sys
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from types import SimpleNamespace

import pytest

from pipeline import access, auth, cmr, hints
from pipeline.access import LoginRequiredError, open_granule
from pipeline.cli import build_parser, main
from pipeline.paths import load_env_file
from pipeline.tests.synth import write_1_5_format_gcov, write_real_format_gcov, write_synthetic_gcov


class _LoginServer(BaseHTTPRequestHandler):
    """Answers like the NASA archive does without credentials: a redirect to the login host."""

    def do_GET(self):  # noqa: N802 (name required by http.server)
        if self.path.startswith("/redirect"):
            self.send_response(302)
            self.send_header("Location", "https://urs.earthdata.nasa.gov/oauth/authorize?client_id=x")
            self.end_headers()
        else:
            body = b"<!DOCTYPE html><html><body>Earthdata Login</body></html>"
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    def log_message(self, *args):
        pass


@pytest.fixture
def login_server():
    server = HTTPServer(("127.0.0.1", 0), _LoginServer)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{server.server_port}"
    server.shutdown()
    server.server_close()


@pytest.mark.parametrize("path", ["/redirect/file.h5", "/page/file.h5"])
def test_login_page_is_reported_plainly(login_server, path, no_credentials):
    with pytest.raises(LoginRequiredError, match="auth-check"), open_granule(login_server + path, "public"):
        pass


def test_local_file_opens_and_reports_no_network(tmp_path):
    path = write_synthetic_gcov(tmp_path / "synthetic_x.h5", "2026-06-07")
    stats = {}
    with open_granule(path, "public", stats=stats) as h5:
        assert "/science/LSAR/GCOV/grids/frequencyA/HHHH" in h5
    assert stats["bytes_fetched"] == 0
    with pytest.raises(FileNotFoundError), open_granule(tmp_path / "missing.h5"):
        pass


def test_env_file_loads_without_overriding(tmp_path, monkeypatch):
    env = tmp_path / ".env"
    lines = ["# comment", "PIPELINE_TEST_A=one", 'export PIPELINE_TEST_B="two words"', "PIPELINE_TEST_C=set",
             "PIPELINE_TEST_D="]
    env.write_text("\n".join(lines) + "\n", encoding="utf-8")
    monkeypatch.setenv("PIPELINE_TEST_C", "already")
    for key in ("PIPELINE_TEST_A", "PIPELINE_TEST_B", "PIPELINE_TEST_D"):
        monkeypatch.delenv(key, raising=False)
    loaded = load_env_file(env)
    assert loaded == ["PIPELINE_TEST_A", "PIPELINE_TEST_B"]
    assert os.environ["PIPELINE_TEST_A"] == "one" and os.environ["PIPELINE_TEST_B"] == "two words"
    assert os.environ["PIPELINE_TEST_C"] == "already"
    assert "PIPELINE_TEST_D" not in os.environ
    for key in loaded:
        monkeypatch.delenv(key)


def test_a_broken_command_module_does_not_take_the_others_down(capsys):
    parser = build_parser(("pipeline.does_not_exist", "pipeline.stages"))
    assert "unavailable" in capsys.readouterr().err
    assert parser.parse_args(["validate"]).func


def test_inspect_prints_file_facts(tmp_path, capsys):
    path = write_synthetic_gcov(tmp_path / "synthetic_y.h5", "2026-06-07", convention="zero-valid")
    assert main(["inspect", str(path)]) == 0
    report = json.loads(capsys.readouterr().out)
    assert report["spec_version"] == "1.2.1"
    assert report["unique_mask_values"] == {"A": [0, 255]}
    assert report["page_size"] == 1024 * 1024
    assert report["mission_id"] == "SYNTHETIC"
    # Like NASA's samples: no exception flag (null, not false) and no exception mask.
    assert report["has_input_data_exception"] is None
    assert report["grids"]["A"]["has_exception_mask"] is False


def test_inspect_prints_the_exception_facts_of_a_real_format_file(tmp_path, capsys):
    path = write_real_format_gcov(tmp_path / "synthetic_z.h5", "2026-06-07", exception_flag=2)
    assert main(["inspect", str(path), "--skip-mask"]) == 0
    report = json.loads(capsys.readouterr().out)
    assert report["spec_version"] == "1.6.0" and report["has_input_data_exception"] is True
    assert {f: g["has_exception_mask"] for f, g in report["grids"].items()} == {"A": True, "B": True}
    assert report["input_data_exception_code"] == 2
    assert report["input_data_exception_meaning"] == "NISAR LSAR qFSP-H1 sample slip"
    a = report["grids"]["A"]
    assert (a["exception_dtype"], a["exception_focus_bits"], a["exception_fill"]) == ("uint16", True, 65535)


def test_inspect_prints_the_exception_code_and_layout_of_a_1_5_0_file(tmp_path, capsys):
    path = write_1_5_format_gcov(tmp_path / "synthetic_15.h5", "2026-06-07", exception_flag=2)
    assert main(["inspect", str(path), "--skip-mask"]) == 0
    report = json.loads(capsys.readouterr().out)
    assert report["spec_version"] == "1.5.0" and report["has_input_data_exception"] is True
    assert report["input_data_exception_code"] == 2
    assert report["input_data_exception_meaning"] == "NISAR LSAR qFSP-H1 sample slip"
    a = report["grids"]["A"]
    assert (a["exception_dtype"], a["exception_focus_bits"], a["exception_fill"]) == ("uint8", False, None)


def test_errors_become_one_line_and_exit_code_1(capsys):
    assert main(["fetch", "--site", "no-such-site"]) == 1
    assert "no such site file" in capsys.readouterr().err


# Made-up test values, not a real account.
FAKE_TOKEN = "FAKE-TEST-TOKEN-not-a-real-token-1234567890"
FAKE_USER = "fake_test_user_x7"
FAKE_PASSWORD = "FAKE-test-password-9876"


@pytest.fixture
def no_credentials(monkeypatch, tmp_path):
    """An empty home folder and no Earthdata variables, whatever this computer has."""
    home = tmp_path / "home"
    home.mkdir()
    monkeypatch.setenv("HOME", str(home))
    monkeypatch.setenv("USERPROFILE", str(home))  # what Path.home() reads on Windows
    for name in (auth.ENV_TOKEN, auth.ENV_USERNAME, auth.ENV_PASSWORD, "NETRC"):
        monkeypatch.delenv(name, raising=False)
    return home


def test_earthdata_without_any_credentials_names_every_route(no_credentials):
    with pytest.raises(LoginRequiredError) as caught, open_granule("https://example.invalid/x.h5", "earthdata"):
        pass
    text = str(caught.value)
    assert text.startswith("No Earthdata credentials found")
    assert "EARTHDATA_TOKEN=<your token> in the .env file" in text
    assert "EARTHDATA_USERNAME and EARTHDATA_PASSWORD in the same .env file" in text
    assert "a netrc file at " in text and hints.command("auth-check") in text and hints.POWERSHELL_NOTE in text
    assert "python -m" not in text


def test_refused_token_is_called_refused(login_server, no_credentials, monkeypatch):
    monkeypatch.setenv(auth.ENV_TOKEN, FAKE_TOKEN)
    with pytest.raises(LoginRequiredError) as caught, open_granule(login_server + "/redirect/f.h5", "earthdata"):
        pass
    text = str(caught.value)
    assert "Earthdata refused EARTHDATA_TOKEN (expired or mistyped)" in text
    assert hints.command("auth-check") in text and FAKE_TOKEN not in text
    assert "put EARTHDATA_TOKEN" not in text  # never ask for what is already set


def test_public_access_with_credentials_present_does_not_ask_for_them(login_server, no_credentials, monkeypatch):
    monkeypatch.setenv(auth.ENV_TOKEN, FAKE_TOKEN)
    with pytest.raises(LoginRequiredError) as caught, open_granule(login_server + "/redirect/f.h5", "public"):
        pass
    text = str(caught.value)
    assert "credentials found (environment variable EARTHDATA_TOKEN) were not used" in text
    assert "access: earthdata" in text and "No Earthdata credentials found" not in text and FAKE_TOKEN not in text


def _fake_download_stack(monkeypatch):
    """Stand-ins for earthaccess and fsspec that record how the download logged in."""
    used = {}

    def login(strategy):
        used["strategy"] = strategy
        used["token variable visible"] = auth.ENV_TOKEN in os.environ
        return SimpleNamespace(authenticated=True)

    session = SimpleNamespace(kwargs={})
    monkeypatch.setitem(sys.modules, "earthaccess", SimpleNamespace(
        login=login, get_fsspec_https_session=lambda: session))
    fsspec = pytest.importorskip("fsspec")
    monkeypatch.setattr(fsspec, "filesystem", lambda *a, **k: used.update(strategy="token", headers=k["headers"]))
    return used


@pytest.mark.parametrize("setup", ["token", "environment", "netrc", "broken token, then netrc",
                                   "broken token, then user name and password"])
def test_download_logs_in_exactly_as_auth_check_reports(setup, no_credentials, monkeypatch, capsys):
    netrc_name = "_netrc" if platform.system() == "Windows" else ".netrc"
    if setup == "token":
        monkeypatch.setenv(auth.ENV_TOKEN, FAKE_TOKEN)
    if "broken token" in setup:
        monkeypatch.setenv(auth.ENV_TOKEN, "FAKE-TOKEN-first-half\nFAKE-TOKEN-second-half")
    if setup in ("environment", "broken token, then user name and password"):
        monkeypatch.setenv(auth.ENV_USERNAME, FAKE_USER)
        monkeypatch.setenv(auth.ENV_PASSWORD, FAKE_PASSWORD)
    # A netrc file is present in every case; it is used only when nothing comes before it.
    (no_credentials / netrc_name).write_text(
        f"machine {auth.URS_HOST} login {FAKE_USER} password {FAKE_PASSWORD}\n", encoding="utf-8")

    probed = []
    monkeypatch.setattr(cmr, "latest_granule", lambda *a, **k: cmr.Granule(
        name="NISAR_L2_PR_GCOV_001_030_A_019_2800_SHNA_A_20081012T060911_20081012T060925_D00404_N_F_J_001",
        product="GCOV", release="validated", collection="TEST", stack="030_A_019", direction="ascending",
        start="2008-10-12T06:09:11Z", date="2008-10-12", version="D00404", counter=1, pols_a=("HH",),
        pols_b=(), bandwidth_mhz_a=28.0, full_frame=True, urgent=False, size_bytes=None,
        data_url="https://example.invalid/test.h5", browse_urls=(), polygon=()))
    monkeypatch.setattr(auth, "probe_download", lambda url, source: probed.append(source) or
                        auth.ProbeResult(True, 206, "example.invalid", ""))
    auth.run_auth_check(SimpleNamespace())
    reported = probed[0]
    assert f"Using: {reported.where} (the download logs in the same way)" in capsys.readouterr().out

    used = _fake_download_stack(monkeypatch)
    source = access.login_source()
    access._earthdata_filesystem({}, source)
    assert (source.where, source.strategy) == (reported.where, reported.strategy)
    assert used["strategy"] == reported.strategy == {
        "token": "token", "environment": "environment", "netrc": "netrc", "broken token, then netrc": "netrc",
        "broken token, then user name and password": "environment"}[setup]
    if reported.strategy == "token":
        assert used["headers"]["Authorization"] == f"Bearer {FAKE_TOKEN}"
    else:
        # earthaccess would prefer any EARTHDATA_TOKEN variable, even a broken one; it must not see it.
        assert used["token variable visible"] is False
    assert ("broken" not in setup) or "FAKE-TOKEN-first-half" in os.environ[auth.ENV_TOKEN]  # restored after

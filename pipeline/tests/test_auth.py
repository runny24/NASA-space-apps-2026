"""Offline tests of credential discovery and of auth-check's promise never to print a secret.

Every credential below is a made-up test value, not a real account.
"""

import os
import socket
from pathlib import Path
from types import SimpleNamespace

import pytest

from pipeline import auth, cmr, hints

FAKE_TOKEN = "FAKE-TEST-TOKEN-not-a-real-token-1234567890"
FAKE_USER = "fake_test_user_x7"
FAKE_PASSWORD = "FAKE-test-password-9876"


@pytest.fixture(autouse=True)
def isolated(monkeypatch, tmp_path):
    """No network, an empty home folder, and no Earthdata variables from the real environment."""
    def refuse(*args, **kwargs):
        raise AssertionError("tests must not touch the network")

    monkeypatch.setattr(socket.socket, "connect", refuse)
    home = tmp_path / "home"
    home.mkdir()
    monkeypatch.setenv("HOME", str(home))
    monkeypatch.setenv("USERPROFILE", str(home))  # what Path.home() reads on Windows
    for name in (auth.ENV_TOKEN, auth.ENV_USERNAME, auth.ENV_PASSWORD, "NETRC"):
        monkeypatch.delenv(name, raising=False)
    return home


def test_find_credentials_order_and_secret_hidden(monkeypatch, isolated):
    as_os(monkeypatch, "Linux")
    assert auth.find_credentials() is None
    (isolated / ".netrc").write_text(f"machine urs.earthdata.nasa.gov login {FAKE_USER} password {FAKE_PASSWORD}\n")
    assert auth.find_credentials().where.startswith("netrc file")
    monkeypatch.setenv(auth.ENV_USERNAME, FAKE_USER)
    monkeypatch.setenv(auth.ENV_PASSWORD, FAKE_PASSWORD)
    assert auth.find_credentials().kind == "password" and "environment" in auth.find_credentials().where
    monkeypatch.setenv(auth.ENV_TOKEN, FAKE_TOKEN)
    found = auth.find_credentials()
    assert found.kind == "token" and found.secret is None and FAKE_TOKEN not in repr(found)
    assert auth.find_credentials(include_secret=True).secret == FAKE_TOKEN
    assert FAKE_TOKEN not in repr(auth.find_credentials(include_secret=True))


NETRC_CRLF = (f"machine other.example login a password b\r\nmachine urs.earthdata.nasa.gov\r\n"
              f"  login {FAKE_USER}\r\n  password {FAKE_PASSWORD}\r\n")


def as_os(monkeypatch, system):
    """Make both this module and earthaccess believe they run on `system` ("Windows", "Darwin", "Linux")."""
    monkeypatch.setattr(auth.platform, "system", lambda: system)


@pytest.mark.parametrize("system", ["Windows", "Darwin", "Linux"])
@pytest.mark.parametrize("netrc_variable", [None, "custom-netrc"])
def test_netrc_path_is_the_file_the_download_reads(monkeypatch, isolated, system, netrc_variable):
    earthaccess_auth = pytest.importorskip("earthaccess.auth")
    as_os(monkeypatch, system)
    if netrc_variable:
        monkeypatch.setenv("NETRC", str(isolated / netrc_variable))
    assert auth.netrc_path(Path.home(), os.environ) == earthaccess_auth.netrc_path()


def test_windows_reads_only__netrc_and_crlf_is_fine(monkeypatch, isolated):
    # What Windows Notepad writes by default: CRLF line endings, here in the file called _netrc.
    as_os(monkeypatch, "Windows")
    (isolated / "_netrc").write_bytes(NETRC_CRLF.encode("utf-8"))
    found = auth.find_credentials(include_secret=True)
    assert found.where == f"netrc file {isolated / '_netrc'}" and found.strategy == "netrc"
    assert found.secret == (FAKE_USER, FAKE_PASSWORD)


@pytest.mark.parametrize("system, present, read", [("Windows", ".netrc", "_netrc"), ("Linux", "_netrc", ".netrc")])
def test_netrc_under_the_other_name_is_not_used_and_must_be_renamed(monkeypatch, isolated, system, present, read):
    as_os(monkeypatch, system)
    (isolated / present).write_text(NETRC_CRLF, encoding="utf-8")
    sources, notes = auth.scan_credentials()
    assert sources == []
    assert f"found {isolated / present}, but on this computer the download reads {isolated / read}: " \
           f"rename it to {read}" in notes


def test_netrc_with_a_byte_order_mark_is_rejected_with_an_instruction(monkeypatch, isolated):
    as_os(monkeypatch, "Windows")
    (isolated / "_netrc").write_bytes(("\ufeff" + NETRC_CRLF).encode("utf-8"))
    sources, notes = auth.scan_credentials()
    assert sources == []
    assert any("byte-order mark" in n and "'UTF-8' (not 'UTF-8 with BOM')" in n for n in notes)


def test_netrc_variable_pointing_nowhere_does_not_fall_back(monkeypatch, isolated):
    (isolated / ".netrc").write_text(NETRC_CRLF, encoding="utf-8")
    monkeypatch.setenv("NETRC", str(isolated / "missing"))
    sources, notes = auth.scan_credentials()
    assert sources == []
    assert f"NETRC is set to {isolated / 'missing'}, but that file does not exist" in notes
    assert f"{isolated / '.netrc'} is not read because NETRC is set to {isolated / 'missing'}" in notes


def test_netrc_parse_error_never_quotes_the_file(monkeypatch, isolated):
    as_os(monkeypatch, "Linux")
    (isolated / ".netrc").write_text(f"machine urs.earthdata.nasa.gov login {FAKE_USER} {FAKE_PASSWORD}\n",
                                     encoding="utf-8")
    sources, notes = auth.scan_credentials()
    assert sources == [] and "not a valid netrc file" in "\n".join(notes)
    assert FAKE_PASSWORD not in "\n".join(notes) and FAKE_USER not in "\n".join(notes)


def test_near_misses_are_explained(monkeypatch, isolated):
    as_os(monkeypatch, "Windows")
    monkeypatch.setenv(auth.ENV_TOKEN, "")
    monkeypatch.setenv(auth.ENV_USERNAME, FAKE_USER)
    (isolated / "_netrc.txt").write_text("machine urs.earthdata.nasa.gov login a password b\n")
    sources, notes = auth.scan_credentials()
    assert sources == []
    text = "\n".join(notes)
    assert "EARTHDATA_TOKEN is set but empty" in text
    assert "EARTHDATA_USERNAME is set but EARTHDATA_PASSWORD is not" in text
    assert "rename it to _netrc with no .txt ending" in text
    (isolated / "_netrc").write_text("machine example.org login a password b\n")
    assert "no complete line for machine urs.earthdata.nasa.gov" in "\n".join(auth.scan_credentials()[1])


TWO_LINE_TOKEN = "FAKE-TEST-TOKEN-first-half\nFAKE-TEST-TOKEN-second-half"


def test_two_line_token_is_rejected_without_showing_it(monkeypatch, capsys, isolated):
    monkeypatch.setenv(auth.ENV_TOKEN, TWO_LINE_TOKEN + "\n")
    sources, notes = auth.scan_credentials()
    assert sources == []
    assert any("contains a space or a line break, so it was not used" in n for n in notes)
    monkeypatch.setattr(cmr, "latest_granule", lambda *a, **k: fake_granule())
    used = []
    monkeypatch.setattr(auth, "probe_download", lambda url, source: used.append(source) or
                        auth.ProbeResult(False, 401, auth.URS_HOST, "HTTP Basic: Access denied."))
    assert auth.run_auth_check(SimpleNamespace()) == 1
    captured = capsys.readouterr()
    assert used == [None]  # the broken token was never sent
    for part in TWO_LINE_TOKEN.split("\n"):
        assert part not in captured.out + captured.err


def test_probe_never_lets_a_header_error_carry_the_token():
    # Even if a broken token reached the probe, the error text must not contain it.
    source = auth.CredentialSource("token", "test", TWO_LINE_TOKEN, "token")
    result = auth.probe_download("https://example.invalid/file.h5", source)
    assert not result.ok and "could not be sent (ValueError)" in result.detail
    for part in TWO_LINE_TOKEN.split("\n"):
        assert part not in result.detail


def fake_granule():
    return cmr.Granule(
        name="NISAR_L2_PR_GCOV_000_000_A_000_2005_DHDH_A_20260101T000000_20260101T000001_P00000_N_F_J_001",
        product="GCOV", release="validated", collection="TEST", stack="000_A_000", direction="ascending",
        start="2026-01-01T00:00:00Z", date="2026-01-01", version="P00000", counter=1, pols_a=("HH",), pols_b=(),
        bandwidth_mhz_a=20.0, full_frame=True, urgent=False, size_bytes=None,
        data_url="https://example.invalid/test.h5", browse_urls=(), polygon=())


@pytest.mark.parametrize("result", [
    auth.ProbeResult(False, 401, auth.URS_HOST, f"server echoed {FAKE_TOKEN} {FAKE_USER} {FAKE_PASSWORD}"),
    auth.ProbeResult(True, 206, "example.invalid", ""),
    auth.ProbeResult(False, None, "example.invalid", f"network down near {FAKE_PASSWORD}"),
])
def test_auth_check_never_prints_a_secret(monkeypatch, capsys, isolated, result):
    monkeypatch.setenv(auth.ENV_TOKEN, FAKE_TOKEN)
    monkeypatch.setenv(auth.ENV_USERNAME, FAKE_USER)
    monkeypatch.setenv(auth.ENV_PASSWORD, FAKE_PASSWORD)
    (isolated / ".netrc").write_text(f"machine urs.earthdata.nasa.gov login {FAKE_USER} password {FAKE_PASSWORD}\n")
    used = []
    monkeypatch.setattr(cmr, "latest_granule", lambda *a, **k: fake_granule())
    monkeypatch.setattr(auth, "probe_download", lambda url, source: used.append(source) or result)
    code = auth.run_auth_check(SimpleNamespace())
    captured = capsys.readouterr()
    output = captured.out + captured.err
    for secret in (FAKE_TOKEN, FAKE_USER, FAKE_PASSWORD):
        assert secret not in output
    assert "found: environment variable EARTHDATA_TOKEN" in output
    assert used[0].kind == "token" and used[0].secret == FAKE_TOKEN  # the token was really used
    assert code == (0 if result.ok else 1)


def test_auth_check_without_credentials_explains_next_steps(monkeypatch, capsys):
    monkeypatch.setattr(cmr, "latest_granule", lambda *a, **k: fake_granule())
    monkeypatch.setattr(auth, "probe_download",
                        lambda url, source: auth.ProbeResult(False, 401, auth.URS_HOST, "HTTP Basic: Access denied."))
    assert auth.run_auth_check(SimpleNamespace()) == 1
    out = capsys.readouterr().out
    assert "none found" in out and "As expected without credentials" in out
    assert "Alaska Satellite Facility Data Access" in out and "_netrc" in out and ".netrc" in out
    assert "Run this check again: " + hints.command("auth-check") in out and hints.POWERSHELL_NOTE in out
    assert "python -m" not in out


def test_register_adds_command():
    import argparse

    parser = argparse.ArgumentParser()
    auth.register(parser.add_subparsers(dest="command"))
    args = parser.parse_args(["auth-check"])
    assert args.func is auth.run_auth_check

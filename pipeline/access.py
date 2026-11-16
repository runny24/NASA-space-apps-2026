"""Open a NISAR HDF5 product, local or over HTTPS, without downloading the whole file.

Real GCOV files are 2 to 8.5 GB, but a site needs only a small window of them. h5py can read an HDF5
file through any file-like object, and fsspec gives us one that fetches byte ranges over HTTPS on demand.
The cache setting matters a lot: NISAR files store their metadata in 4 MiB pages, and fetching in 4 MiB
blocks opened the public 172 MB sample in about 2 s and 13 MB, against 25 s and 111 MB with fsspec's
defaults (measured; see docs/ARCHITECTURE.md).
"""

from __future__ import annotations

import os
import ssl
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

import certifi
import h5py

from pipeline import auth, hints

BLOCK_SIZE = 4 * 1024 * 1024
HDF5_SIGNATURE = b"\x89HDF\r\n\x1a\n"
LOGIN_HOST = "urs.earthdata.nasa.gov"
USER_AGENT = "nisar-surface-change-pipeline/0.1 (research client)"


class LoginRequiredError(RuntimeError):
    """No Earthdata credentials were found, or the server sent a login page or redirect instead of the file."""


def _auth_check_hint() -> str:
    return f"Run `{hints.command('auth-check')}` to test the login step by step {hints.POWERSHELL_NOTE}."


def _no_credentials_message(notes: list[str]) -> str:
    """Every route the pipeline accepts, so nobody is sent down one route while another would suit them."""
    lines = [
        "No Earthdata credentials found. Real NISAR data needs ONE of these:",
        f"  - {auth.ENV_TOKEN}=<your token> in the .env file at the repository root (copy .env.example to .env)",
        f"  - {auth.ENV_USERNAME} and {auth.ENV_PASSWORD} in the same .env file",
        f"  - a netrc file at {auth.netrc_path(Path.home(), os.environ)} with the line: "
        f"machine {auth.URS_HOST} login YOUR_USERNAME password YOUR_PASSWORD",
    ]
    lines += [f"  note: {note}" for note in notes]
    lines.append(_auth_check_hint())
    return "\n".join(lines)


def _login_message(url: str, access: str = "public") -> str:
    """Why the archive asked for a login, judged from the credentials this computer has, so the message
    never asks for something that is already set. Never contains a secret."""
    sources, notes = auth.scan_credentials()
    source = sources[0] if sources else None
    head = f"The server asked for an Earthdata login instead of sending the HDF5 file:\n  {url}\n"
    if access == "public":
        how = "Set access: earthdata in the site file (for inspect, add --access earthdata)."
        if source is None:
            return f"{head}This file needs a login. {how}\n{_no_credentials_message(notes)}"
        return (f"{head}This file needs a login, but it was asked for with public access, so the credentials "
                f"found ({source.where}) were not used. {how}")
    if source is None:
        return head + _no_credentials_message(notes)
    if source.strategy == "token":
        return (f"{head}Earthdata refused {auth.ENV_TOKEN} (expired or mistyped). Generate a new token in "
                f"your Earthdata Login profile (https://{auth.URS_HOST}), replace the value after "
                f"{auth.ENV_TOKEN}= in the .env file. " + _auth_check_hint())
    return (f"{head}Earthdata Login did not accept the credentials from {source.where}, or the account has "
            "not yet accepted the 'Alaska Satellite Facility Data Access' agreement. " + _auth_check_hint())


def login_source() -> auth.CredentialSource:
    """The credentials the download uses: exactly the source auth-check reports as "Using:".

    Both call auth.find_credentials, so auth-check and the download can never disagree about where the
    login comes from. Raises LoginRequiredError, naming every accepted route, when there is none.
    """
    source = auth.find_credentials(include_secret=True)
    if source is None:
        raise LoginRequiredError(_no_credentials_message(auth.scan_credentials()[1]))
    return source


def _scrubbed(text: str, source: auth.CredentialSource) -> str:
    """Error text from a login library can echo what it was given; never let a credential reach the screen."""
    secrets = [source.secret] if isinstance(source.secret, str) else list(source.secret or ())
    for secret in secrets:
        if secret and len(secret) >= 3:
            text = text.replace(secret, "[hidden]")
    return text


def ssl_context() -> ssl.SSLContext:
    # certifi's CA bundle, because the python.org installer for macOS ships without CA certificates
    # (HTTPS then fails with CERTIFICATE_VERIFY_FAILED until "Install Certificates" is run). Using one
    # bundle everywhere makes Windows, macOS and Linux behave the same.
    return ssl.create_default_context(cafile=certifi.where())


def is_url(url_or_path: str | os.PathLike) -> bool:
    return str(url_or_path).startswith(("https://", "http://"))


def _preflight(url: str, headers: dict, access: str) -> None:
    """One small request that does not follow redirects, to spot a login redirect early.

    Without it, a missing login shows up deep inside h5py as an unhelpful "file signature not found".
    The NASA sample host answers with a redirect to its CDN, which is fine; only a redirect to the
    Earthdata login host means credentials are missing.
    """
    import requests  # imported here: only remote reads need it

    resp = requests.get(url, headers={**headers, "Range": "bytes=0-7"}, allow_redirects=False,
                        timeout=60, verify=certifi.where())
    try:
        location = resp.headers.get("Location", "")
        if resp.status_code in (401, 403) or (resp.is_redirect and LOGIN_HOST in location):
            raise LoginRequiredError(_login_message(url, access))
        if resp.status_code == 404:
            raise FileNotFoundError(f"The server says this file does not exist (HTTP 404): {url}")
        if not resp.is_redirect and resp.status_code >= 400:
            raise RuntimeError(f"HTTP {resp.status_code} for {url}")
        if not resp.is_redirect and "text/html" in resp.headers.get("Content-Type", ""):
            raise LoginRequiredError(_login_message(url, access))
    finally:
        resp.close()


def _public_filesystem(headers: dict):
    import fsspec

    return fsspec.filesystem("http", headers=headers, skip_instance_cache=True, ssl=ssl_context())


@contextmanager
def _without_token_variable() -> Iterator[None]:
    """Hide EARTHDATA_TOKEN while earthaccess logs in with a user name and password.

    earthaccess's "environment" strategy prefers EARTHDATA_TOKEN whenever the variable exists, even when
    it is empty or was rejected by auth-check (for example a token with a line break). We only reach this
    path when auth-check chose the user name and password, so the login must use them too.
    """
    saved = os.environ.pop(auth.ENV_TOKEN, None)
    try:
        yield
    finally:
        if saved is not None:
            os.environ[auth.ENV_TOKEN] = saved


def _earthdata_filesystem(headers: dict, source: auth.CredentialSource):
    """Authenticated fsspec filesystem for real NISAR data, logging in with `source` (see login_source).

    Written from ASF's NISAR Cookbook (Bearer token header) and the NISAR Data User Guide (earthaccess
    session). Verified with a real Earthdata account on Saturday 14 November 2026: both routes, the token as a
    Bearer header and the user name with password (from .env) through earthaccess, opened a real granule and
    read its facts and a window, including the redirect to the signed download URL. Not verified yet: an
    expired token (open_granule's preflight should report it as refused; that message is tested only against
    a stand-in server on this computer) and the netrc route. Re-test with
    `npm run pipeline -- auth-check` and `npm run pipeline -- inspect <url> --access earthdata`.
    """
    import fsspec

    if source.strategy == "token":
        # aiohttp drops the Authorization header when the archive redirects to another host (the
        # signed CDN URL), which is what that host expects.
        return fsspec.filesystem("http", headers={**headers, "Authorization": f"Bearer {source.secret}"},
                                 skip_instance_cache=True, ssl=ssl_context())

    import earthaccess  # heavy import; only needed on this path

    strategy = source.strategy  # "environment" or "netrc", exactly as auth-check reported
    try:
        with _without_token_variable():
            login = earthaccess.login(strategy=strategy)
    except Exception as exc:  # earthaccess raises several types; all mean the same thing here
        raise LoginRequiredError(_scrubbed(f"Earthdata login failed using {source.where}: {exc}\n", source)
                                 + _auth_check_hint()) from None
    if not getattr(login, "authenticated", False):
        raise LoginRequiredError(f"Earthdata login failed using {source.where}. " + _auth_check_hint())
    fs = earthaccess.get_fsspec_https_session()
    fs.kwargs.setdefault("ssl", ssl_context())  # same CA bundle as the public path
    return fs


@contextmanager
def open_granule(url_or_path: str | os.PathLike, access: str = "public",
                 stats: dict | None = None) -> Iterator[h5py.File]:
    """Open a product file read-only and yield an h5py.File.

    url_or_path: a local path, or an https URL taken from the catalog (never built by hand).
    access: "public" (no credentials, e.g. NASA's sample files) or "earthdata" (real NISAR data).
    stats: optional dict; on exit it receives "bytes_fetched" (bytes requested over the network).
    """
    if access not in ("public", "earthdata"):
        raise ValueError(f"access must be 'public' or 'earthdata', got {access!r}")

    if not is_url(url_or_path):
        path = Path(url_or_path)
        if not path.is_file():
            raise FileNotFoundError(f"No such product file: {path}")
        with h5py.File(path, "r") as h5:
            yield h5
        if stats is not None:
            stats["bytes_fetched"] = 0
        return

    url = str(url_or_path)
    headers = {"User-Agent": USER_AGENT}
    source = login_source() if access == "earthdata" else None
    if source is None:
        _preflight(url, headers, access)
        fs = _public_filesystem(headers)
    else:
        if source.strategy == "token":
            _preflight(url, {**headers, "Authorization": f"Bearer {source.secret}"}, access)
        fs = _earthdata_filesystem(headers, source)

    try:
        remote = fs.open(url, "rb", cache_type="blockcache", block_size=BLOCK_SIZE)
    except FileNotFoundError as exc:
        # fsspec reports a login page it cannot size as "not found"; say what is more likely.
        if access == "earthdata":
            raise LoginRequiredError(_login_message(url, access)) from exc
        raise
    try:
        head = remote.read(len(HDF5_SIGNATURE))
        if head != HDF5_SIGNATURE:
            if head.lstrip().startswith(b"<"):
                raise LoginRequiredError(_login_message(url, access))
            raise OSError(f"Not an HDF5 file (first bytes {head!r}): {url}")
        remote.seek(0)
        with h5py.File(remote, "r") as h5:
            yield h5
    finally:
        if stats is not None:
            stats["bytes_fetched"] = int(getattr(remote.cache, "total_requested_bytes", 0) or 0)
        remote.close()

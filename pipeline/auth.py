"""Command "auth-check": are this computer's Earthdata Login credentials present, and do they work?

Searching NASA's catalog is public, but reading a NISAR data file needs a free Earthdata Login account
that has accepted the "Alaska Satellite Facility Data Access" agreement. This command:

1. lists which credential sources are present, without ever printing a secret;
2. finds one recent real GCOV file through the catalog;
3. asks the archive for that file's first 8 bytes with the first credentials found, and checks that they
   are the HDF5 file signature;
4. says in plain words what happened and what to do next.

Why a ranged GET and not a HEAD request: the archive answers HEAD with the real file size even with no
login at all, so only reading bytes proves the login works.
"""

from __future__ import annotations

import http.client
import http.cookiejar
import netrc
import os
import platform
import ssl
import stat
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field, replace
from pathlib import Path

from pipeline import cmr, hints

URS_HOST = "urs.earthdata.nasa.gov"
ENV_TOKEN = "EARTHDATA_TOKEN"
ENV_USERNAME = "EARTHDATA_USERNAME"
ENV_PASSWORD = "EARTHDATA_PASSWORD"
HDF5_SIGNATURE = b"\x89HDF\r\n\x1a\n"
TIMEOUT_S = 60


@dataclass(frozen=True)
class CredentialSource:
    """One place credentials were found. `secret` stays None unless the caller asked for it by name.

    kind is "token" (secret is the token) or "password" (secret is (username, password)). repr=False keeps
    the secret out of any accidental print or log line. strategy says how the download logs in with it:
    "token" (pipeline/access.py sends it as a Bearer header), "environment" or "netrc" (the earthaccess
    login strategies of those names).
    """

    kind: str
    where: str
    secret: object = field(default=None, repr=False, compare=False)
    strategy: str = ""


def netrc_path(home: Path, environ, system: str | None = None) -> Path:
    """The one netrc file the download reads, found exactly as earthaccess 0.19 finds it: the file named
    by the NETRC variable if it is set, otherwise "_netrc" in the home folder on Windows and ".netrc"
    elsewhere. auth-check looks only here, so it can never pass with a file the download ignores."""
    system = platform.system() if system is None else system
    if environ.get("NETRC"):
        return Path(environ["NETRC"])
    return home / ("_netrc" if system == "Windows" else ".netrc")


def _netrc_source(path: Path, notes: list[str]) -> CredentialSource | None:
    """Read the netrc file with Python's own netrc module, the parser the download uses (through
    earthaccess and tinynetrc), so a file that parser rejects is rejected here too."""
    try:
        raw = path.read_bytes()
    except OSError as error:
        notes.append(f"{path} exists but could not be read ({error.strerror})")
        return None
    if raw.startswith(b"\xef\xbb\xbf"):
        # Notepad's "UTF-8 with BOM" adds three invisible bytes at the start that the parser refuses.
        notes.append(f"{path} starts with a byte-order mark (BOM), which the download cannot read. Open it "
                     "in Notepad, choose File > Save As, set Encoding to 'UTF-8' (not 'UTF-8 with BOM') "
                     "and save it again")
        return None
    try:
        parsed = netrc.netrc(str(path))
    except netrc.NetrcParseError as error:
        # Only the line number: the parser's own message can quote a word of the file, maybe the password.
        notes.append(f"{path} is not a valid netrc file (problem near line {error.lineno}); it needs one "
                     f"line: machine {URS_HOST} login YOUR_USERNAME password YOUR_PASSWORD")
        return None
    except (OSError, ValueError):
        notes.append(f"{path} could not be read as text; save it again as plain UTF-8")
        return None
    login, _account, password = parsed.hosts.get(URS_HOST) or ("", "", "")
    if not login or not password:
        notes.append(f"{path} exists but has no complete line for machine {URS_HOST}")
        return None
    return CredentialSource("password", f"netrc file {path}", (login, password), "netrc")


def scan_credentials(
    environ=None, home: Path | None = None, system: str | None = None
) -> tuple[list[CredentialSource], list[str]]:
    """Every credential source present (with secrets), in the order the download uses them, and
    plain-language notes about near misses. Notes never contain a secret."""
    environ = os.environ if environ is None else environ
    home = Path.home() if home is None else home
    system = platform.system() if system is None else system
    sources: list[CredentialSource] = []
    notes: list[str] = []

    token = (environ.get(ENV_TOKEN) or "").strip()
    if token and any(c.isspace() for c in token):
        # A token wrapped onto two lines (or with a space) would be rejected by the server, and an HTTP
        # library that refuses such a header quotes the whole value in its error. So it is never used.
        notes.append(f"{ENV_TOKEN} contains a space or a line break, so it was not used (its value is not "
                     "shown). Paste the token again on one line, with nothing else after the = sign")
    elif token:
        sources.append(CredentialSource("token", f"environment variable {ENV_TOKEN}", token, "token"))
    elif ENV_TOKEN in environ:
        notes.append(f"{ENV_TOKEN} is set but empty")

    user, password = environ.get(ENV_USERNAME, "").strip(), environ.get(ENV_PASSWORD, "").strip()
    if user and password:
        sources.append(CredentialSource("password", f"environment variables {ENV_USERNAME} and {ENV_PASSWORD}",
                                        (user, password), "environment"))
    elif user or password:
        present, absent = (ENV_USERNAME, ENV_PASSWORD) if user else (ENV_PASSWORD, ENV_USERNAME)
        notes.append(f"{present} is set but {absent} is not; both are needed")

    path = netrc_path(home, environ, system)
    if environ.get("NETRC"):
        if not path.is_file():
            notes.append(f"NETRC is set to {path}, but that file does not exist")
        for name in (".netrc", "_netrc"):
            if (home / name).is_file() and home / name != path:
                notes.append(f"{home / name} is not read because NETRC is set to {path}")
    else:
        other = home / (".netrc" if path.name == "_netrc" else "_netrc")
        if other.is_file():
            notes.append(f"found {other}, but on this computer the download reads {path}: "
                         f"rename it to {path.name}")
    if path.with_name(path.name + ".txt").is_file():
        notes.append(f"found {path.name}.txt in {path.parent}: rename it to {path.name} with no .txt ending")
    if path.is_file():
        source = _netrc_source(path, notes)
        if source is not None:
            sources.append(source)
            if os.name == "posix" and path.stat().st_mode & (stat.S_IRWXG | stat.S_IRWXO):
                notes.append(f"{path} can be read by other users; run: chmod 600 {path}")
    return sources, notes


def find_credentials(
    *, include_secret: bool = False, environ=None, home: Path | None = None
) -> CredentialSource | None:
    """The credentials the pipeline uses, in the same order as earthaccess: EARTHDATA_TOKEN, then
    EARTHDATA_USERNAME with EARTHDATA_PASSWORD, then the netrc file. None if there are none. auth-check
    tests exactly this source and pipeline/access.py downloads with exactly this source, so the two agree.

    By default the result says only what kind of credential was found and where. Pass include_secret=True
    to get the token or (username, password) in `.secret`, and never print it.
    """
    sources, _ = scan_credentials(environ, home)
    if not sources:
        return None
    return sources[0] if include_secret else replace(sources[0], secret=None)


@dataclass(frozen=True)
class ProbeResult:
    ok: bool
    status: int | None
    final_host: str
    detail: str  # short server message or error, for the explanation


def probe_download(url: str, source: CredentialSource | None) -> ProbeResult:
    """Ask for bytes 0-7 of a data file, logging in the way the archive expects.

    Verified with real credentials on Saturday 14 November 2026: auth-check passed with a token sent as a
    Bearer header, through the archive's redirect to the signed download link (the 8 bytes were the HDF5
    signature). The same day the pipeline's download (pipeline/access.py) read a real granule with the token
    and with a user name and password (through earthaccess). Not verified yet: an expired token (what the
    archive then answers, and whether explain() words it right), and this function's own user-name-and-
    password branch (Basic auth to Earthdata Login), which has no recorded result of its own.
    The flow, from NASA's documented behaviour and the tests run on 2026-11-13/14:
    - The archive answers a request without a session with a redirect to urs.earthdata.nasa.gov.
    - With a username and password, Earthdata Login asks for HTTP Basic auth, then redirects back to the
      archive, which sets a session cookie and redirects again to a signed download link. So we keep a
      cookie jar and offer the password ONLY to urs.earthdata.nasa.gov.
    - With a token, we send "Authorization: Bearer <token>" to the archive. It is attached as an
      "unredirected" header so it is not forwarded to the signed download host, which would reject it.
    """
    handlers: list = [urllib.request.HTTPSHandler(context=cmr.ssl_context()),
                      urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar())]
    request = urllib.request.Request(url, headers={"User-Agent": cmr.USER_AGENT, "Range": "bytes=0-7"})
    if source is not None and source.kind == "password":
        username, password = source.secret
        passwords = urllib.request.HTTPPasswordMgrWithDefaultRealm()
        passwords.add_password(None, f"https://{URS_HOST}", username, password)
        handlers.append(urllib.request.HTTPBasicAuthHandler(passwords))
    elif source is not None and source.kind == "token":
        request.add_unredirected_header("Authorization", f"Bearer {source.secret}")
    opener = urllib.request.build_opener(*handlers)
    try:
        with opener.open(request, timeout=TIMEOUT_S) as response:
            first = response.read(8)  # never more than 8 bytes, even if the server ignores the Range
            host = urllib.parse.urlparse(response.geturl()).hostname or ""
            ok = response.status in (200, 206) and first == HDF5_SIGNATURE
            return ProbeResult(ok, response.status, host, "" if ok else f"first bytes were {first[:8]!r}")
    except urllib.error.HTTPError as error:
        host = urllib.parse.urlparse(error.geturl() or url).hostname or ""
        try:
            body = error.read(300).decode("utf-8", "replace")
        except OSError:
            body = ""
        return ProbeResult(False, error.code, host, " ".join(body.split())[:200])
    except (urllib.error.URLError, TimeoutError, ConnectionError) as error:
        host = urllib.parse.urlparse(url).hostname or ""
        if isinstance(getattr(error, "reason", None), ssl.SSLCertVerificationError):
            return ProbeResult(False, None, host, cmr.CERTIFICATE_HELP.format(host=host))
        return ProbeResult(False, None, host, str(error))
    except (ValueError, http.client.HTTPException) as error:
        # The text of these errors can quote a request header, which holds the credential. Name the type only.
        host = urllib.parse.urlparse(url).hostname or ""
        return ProbeResult(False, None, host, f"the request could not be sent ({type(error).__name__})")


def explain(result: ProbeResult, source: CredentialSource | None) -> list[str]:
    """What the probe result means, in words a teammate can act on."""
    if result.ok:
        return ["PASS: read the first 8 bytes of a real NISAR file; they are the HDF5 signature.",
                "This computer can download NISAR data."]
    lines = []
    if result.status is None:
        lines.append(f"Could not reach the NISAR archive ({result.detail}). Check the internet connection "
                     "or a firewall blocking nasa.gov, then try again.")
    elif result.final_host == URS_HOST and result.status == 401:
        if source is None:
            lines.append("As expected without credentials: the archive sent the request to Earthdata Login, "
                         "which answered 401 Unauthorized.")
        elif source.kind == "token":
            lines.append("Earthdata Login did not accept the token (401). It is probably expired or "
                         "mistyped: generate a new token in your Earthdata Login profile.")
        else:
            lines.append(f"Earthdata Login refused the username and password (401). Server said: "
                         f"{result.detail or 'nothing'}. Check them by signing in at https://{URS_HOST}.")
    elif result.final_host == URS_HOST:
        # Inferred, not observed: a sign-in or approval web page instead of the file.
        lines.append(f"Earthdata Login answered with a web page (HTTP {result.status}) instead of the file. "
                     "This usually means the account has not yet accepted the 'Alaska Satellite Facility "
                     "Data Access' agreement.")
    elif result.status in (401, 403):
        lines.append(f"The archive recognised the request but refused it (HTTP {result.status}): "
                     f"{result.detail or 'no message'}. Accept the 'Alaska Satellite Facility Data Access' "
                     "agreement in your Earthdata Login profile, then try again.")
    else:
        lines.append(f"Unexpected answer: HTTP {result.status} from {result.final_host}. {result.detail}")
    return lines


def next_steps(home: Path, environ=None) -> list[str]:
    environ = os.environ if environ is None else environ
    return [
        "What a teammate does once (about 10 minutes):",
        f"  1. Create a free account at https://{URS_HOST}/users/new",
        "  2. Signed in there, open your profile's agreements (EULAs) and accept",
        "     'Alaska Satellite Facility Data Access'.",
        "  3. Give the pipeline your login in ONE of these two ways:",
        "     a) Token: in your Earthdata Login profile choose 'Generate Token' and copy it. Copy .env.example",
        "        to .env in the repository root and put the token after EARTHDATA_TOKEN= (.env is never",
        "        committed). Tokens expire; generate a new one when this check says it was refused.",
        "     b) netrc file, one line:",
        f"          machine {URS_HOST} login YOUR_USERNAME password YOUR_PASSWORD",
        "        Windows: save it as C:\\Users\\<your user name>\\_netrc (in Notepad choose 'All files'",
        "        so it is not saved as _netrc.txt).",
        "        macOS/Linux: save it as ~/.netrc, then run: chmod 600 ~/.netrc",
        f"        On this computer the download reads exactly this file: {netrc_path(home, environ)}",
        "  4. Run this check again: " + hints.command("auth-check"),
        "     " + hints.POWERSHELL_NOTE,
    ]


def _scrub(text: str, secrets: list[str]) -> str:
    """Belt and braces: even if a server echoes a credential back, it never reaches the screen."""
    for secret in secrets:
        if secret and len(secret) >= 3:
            text = text.replace(secret, "[hidden]")
    return text


def run_auth_check(args) -> int:
    home = Path.home()
    sources, notes = scan_credentials(home=home)
    secrets = []
    for s in sources:
        secrets += [s.secret] if isinstance(s.secret, str) else list(s.secret)
    out: list[str] = ["Earthdata Login credential sources (values are never shown):"]
    out += [f"  found: {s.where} ({s.kind})" for s in sources] or ["  none found"]
    out += [f"  note: {n}" for n in notes]
    from_env = any(s.where.startswith("environment") for s in sources)
    if not from_env and (Path(__file__).resolve().parent.parent / ".env").is_file():
        out.append("  note: a .env file exists at the repository root but gave no credentials; check that "
                   "the names in it are spelled exactly as in .env.example and the values are filled in")
    source = sources[0] if sources else None
    out.append(f"Using: {source.where} (the download logs in the same way)" if source
               else "Using: no credentials (to show what the archive says)")

    try:
        granule = cmr.latest_granule("GCOV", "validated") or cmr.latest_granule("GCOV", "provisional")
    except cmr.CatalogError as error:
        granule = None
        out.append(f"Could not search the catalog: {error}")
    if granule is None:
        out.append("No test file found, so the login could not be tried.")
        print(_scrub("\n".join(out + next_steps(home)), secrets))
        return 1
    out.append(f"Test file: {granule.name}.h5 ({granule.release}, {granule.date})")
    out.append("Asking the archive for its first 8 bytes ...")
    result = probe_download(granule.data_url, source)
    out += explain(result, source)
    if not result.ok:
        out += next_steps(home)
    print(_scrub("\n".join(out), secrets))
    return 0 if result.ok else 1


def register(subparsers) -> None:
    p = subparsers.add_parser(
        "auth-check", help="check Earthdata Login credentials with one small download",
        description="List which Earthdata credential sources are present (never their values), then try to "
                    "read the first 8 bytes of one recent NISAR file and explain the result.")
    p.set_defaults(func=run_auth_check)


if __name__ == "__main__":
    # For trying this module on its own: node scripts/py.mjs -m pipeline.auth
    try:
        from pipeline.paths import load_env_file

        load_env_file()
    except ImportError:
        pass
    sys.exit(run_auth_check(None))

# Recovered digest: "coldread" (cold read of BUILD_PROMPT.md as the coding agent)

Written 2026-11-14 by a recovery pass over three interrupted review runs. Nothing was re-run for this digest. Every item marked *ran* quotes output that is saved in a scratch file or in a transcript tool result from 13 and 14 November; the recovery pass itself made only local reads (directory listings, two JSON files, PNG headers, the saved images).

**The question this digest answers:** what would stall a coding agent that follows the brief in its first two hours, what failed when sketches D1, D3, D5 and the login and Range-request steps were actually run, and what the fix is.

## Read this first

1. **The official repository is empty and `research/` is not in it.** The brief's `research/...` paths point at the pre-hackathon repository. Use absolute paths or copy the folder in (Section 1, stall 1).
2. **Do not copy `earthaccess.login()` from sketch D3 as written.** Without credentials it waits for keyboard input and can hang an unattended job. Use `strategy="environment"` or `strategy="netrc"` (stall 3).
3. **GitHub Pages needs a human first.** Someone with admin rights has to make the repository public and switch Pages on; the GitHub CLI is not installed here; the remote has no branch yet (stall 5).
4. **The GIBS quick-look layer was serving garbled tiles for some places on 14 November around 07:52 UTC**, with HTTP 200. Check it before building the first slice on it, and keep the preview-PNG overlay as a second fallback (stall 7).
5. **Sketch D1 runs, but repeats dates, mixes stacks and crashes on a CMR error.** Small fixes listed (stall 6).
6. **Sketch D5 runs as written; sketch D3's arithmetic is right but its edge cases fail silently.** Python's built-in web server does not do Range requests; both Vite servers do (stalls 9 to 11).

Nothing in this digest proposes a place, a concept or a feature. The sample points used in the tests (for example lon 104.05, lat 12.95, stack `083_A_008`) are rows of the brief's Appendix A that the test agents picked as fixtures.

## 0. Provenance and limits

- Brief that was checked: `<prehackathon-repo>/research/BUILD_PROMPT.md` (851 lines, 58,558 bytes; its first line still reads "version 1 ... Hands-on verification results and review not yet folded in").
- Task given to each attempt: review the brief through the lens "cold read as the coding agent": walk the first eight hours literally and report every stall, guess, wrong command or missing step.
- Transcript times are UTC; scratch file times are local (CST, UTC-6). Tool calls are numbered from 0 in order of appearance in each transcript; the digest cites them as "attempt N, tool call M".

| Attempt | Transcript | When (CST) | Tool calls | Scratch folder | Outcome |
|---|---|---|---|---|---|
| 1 | `<transcripts>/wf_79c71ecc-a87/agent-af9cd04a0e46630ca.jsonl` | 13 Nov 20:53 to 21:07 | 36 | `<scratch>/review/cold-read` | Read brief, checkpoint, rules; ran 24 hands-on checks; cut off by the usage limit with nothing written |
| 2 | `<transcripts>/wf_79c71ecc-a87/agent-ac697a7d245fe6ed9.jsonl` | 14 Nov 01:41 to 02:01 | 56 | `<scratch>/review/cold-read-coding-agent` | Found `research/` had moved; re-read; repeated and extended the checks; cut off by the usage limit with nothing written |
| 3 | `<transcripts>/wf_79c71ecc-a87/agent-ac653e4abf3e3d002.jsonl` | 14 Nov 06:41 | 2 | none | Listed the (empty) official clone, then cut off; established nothing |

**No conclusions were written by any attempt.** The only assistant text block in each transcript is the limit notice, and all thinking blocks are empty. Every statement below is therefore reconstructed from commands and their outputs; where a conclusion is drawn that the agents never wrote, the output it rests on is quoted next to it.

Evidence classes used below: **ran** (a saved output shows it being run and what it printed), **docs** (read in documentation, a fetched page or a package registry), **belief** (asserted with no evidence found).

Not established by these runs: anything that needs Earthdata credentials (none were available: sketch D3 against a real file, Harmony jobs, GDAL over HTTP), any deploy to GitHub Pages, sketch D2 in a browser, and the whole reading-based half of the review (ambiguities in the prose, what to cut).

How far the runs got, in short: Three attempts at the same task (cold read of the brief as the coding agent), all cut off by usage limits before writing a single finding: the only assistant text in each transcript is the limit notice and every thinking block is empty, so everything here is reconstructed from the commands that were run and their outputs. Attempt 1 (13 Nov, 20:53-21:07 CST, 36 tool calls) and attempt 2 (14 Nov, 01:41-02:01 CST, 56 tool calls) between them ran sketches D1, D3 (window arithmetic on a synthetic file only), D4 and D5, the no-credential login paths, Range requests on three local servers, GIBS and CMR probes, package installs, and read the GitHub Pages, FortiGuard and Harmony pages; attempt 3 (14 Nov, 06:41 CST) made two calls and established nothing. Never done: anything with real Earthdata credentials, any deploy, and the reading-based part of the review (ambiguities, contradictions, what to cut).

## 1. Stall list for the first two hours, in the order of the brief's Section 10

### Stall 1. `research/` is not in the official repository

- **Where in the brief:** Sections 0, 1.2, 6.1, 10 step 1, Appendix A.
- **What happens:** `python3 research/nisar_coverage.py <lon> <lat>` fails from the official clone, and `research/CHECKPOINT.md` and the evidence folders the brief points to are not there.
- **Evidence:** *ran*: `ls: <official-repo>/research/: No such file or directory` (attempt 2, tool call 0, 14 Nov 01:41 CST). `find` located the files only under `<prehackathon-repo>/research/` (attempt 2, tool call 3). At 21:00 CST on 13 Nov the folder was still in the official clone, untracked: `?? research/` (attempt 1, tool call 11). Local `ls` during recovery: the official clone holds only `.git`; `## No commits yet on main...origin/main [gone]`.
- **Fix:** Run the script by absolute path, `python3 <prehackathon-repo>/research/nisar_coverage.py <lon> <lat>` (0.5 s, stock Python, lon first), or copy `research/` into the official repository in the first commit, which is what Section 6.1's layout assumes. Write the choice into `PROGRESS.md`.

### Stall 2. First commit and push; no GitHub CLI

- **Where in the brief:** Section 10 step 2.
- **What happens:** The official clone has no commits and its upstream branch does not exist, so a plain `git push` has nothing to track. `gh` is not installed, so Pages settings and workflow runs cannot be handled from the command line.
- **Evidence:** *ran*: `## No commits yet on main...origin/main [gone]`, remote `https://github.com/runny24/NASA-space-apps-2026.git`, `gh not found` (attempt 1, tool call 11). Whether this machine can push was not tested.
- **Fix:** `git push -u origin main` for the first push. Use the GitHub web interface (a teammate) for repository visibility, Pages settings and watching Actions runs, or install `gh` first.

### Stall 3. Earthdata login test

- **Where in the brief:** Section 10 step 3; Appendix D3; Section 4.5.
- **What happens:** Sketch D3's bare `earthaccess.login()` prompts for a username when it finds no credentials. With stdin closed it dies with `EOFError`; with stdin open but idle it waits (the test's 12 s watchdog ended it at 11.7 s). The next line, `earthaccess.get_fsspec_https_session()`, then fails with `AttributeError: 'NoneType' object has no attribute 'get_fsspec_session'`, which says nothing about login.
- **Evidence:** *ran*: `Enter your Earthdata Login username: login() raised EOFError EOF when reading a line 0.0s`; `Enter your Earthdata Login username: raised EOFError 11.7s`; `open/read raised AttributeError 'NoneType' object has no attribute 'get_fsspec_session'` (attempt 2, tool calls 37 and 38; same result in attempt 1, tool call 21).
- **Fix:** Use `earthaccess.login(strategy="environment")` or `strategy="netrc"`: missing credentials raise `LoginStrategyUnavailable` in 0.0 s with a message naming the missing file or variables; wrong credentials raise `LoginAttemptFailure` in 0.2 s. Run unattended commands with `< /dev/null`. For the brief's "one small authenticated request" use the curl probe in Section 8.3; without credentials it prints `http=401 bytes=27` (body `HTTP Basic: Access denied.`). The success path was never seen: no credentials were available.

### Stall 4. Disk and bandwidth

- **Where in the brief:** Section 10 step 4; Section 1.2.
- **What happens:** The brief says about 42 GB free; the probe found 30 GiB. The only transfer measured was a 4 MB preview at about 3 MB/s.
- **Evidence:** *ran*: `/dev/disk3s5   460Gi   390Gi    30Gi    93%` (attempt 1, tool call 18); `speed=3041816B/s` on a 4,080,968-byte file (attempt 2, tool call 22).
- **Fix:** Measure again at kickoff on a large file. Plan for windowed reads; whole-file downloads of 6 to 7 GB granules do not fit a ten-date stack on this disk.

### Stall 5. Deploying the hello map; the FortiGuard request

- **Where in the brief:** Section 10 step 5; Section 6.6.
- **What happens:** Two steps need a person. (a) GitHub Pages has to be switched on by someone with admin or maintainer rights, in a public repository; the `configure-pages` action can do it only with a token other than the default `GITHUB_TOKEN`. (b) The FortiGuard form requires a name, email and company and has a CAPTCHA.
- **Evidence:** *docs*: saved GitHub pages and `configure_pages_action.yml` in `<scratch>/review/cold-read/web/`; form fields `input name text None required`, `input email text None required`, `input company text None required`, `input code hidden None required`, `captcha 71` (attempt 1, tool call 28). No deploy was attempted by any run.
- **Fix:** Ask a teammate now to (1) make the repository public and set Settings, Pages, Source to "GitHub Actions", and (2) file the FortiGuard request at `https://www.fortiguard.com/faq/wfratingsubmit` once the URL exists. Limits to design for: site at most 1 GB, deploy at most 10 minutes, files over 100 MiB blocked by GitHub, no Git LFS on Pages.

### Stall 6. Listing stacks and dates with sketch D1

- **Where in the brief:** Section 10 step 6; Appendix D1.
- **What happens:** D1 runs as written, but: it repeats a date when a granule was reprocessed (`_001` and `_002`); it throws `TypeError: Cannot read properties of undefined (reading 'entry')` on any CMR error because `res.ok` is never checked; it returns every stack at the point, ascending and descending together; it leaves out the beta collection, so its counts are lower than Appendix A's.
- **Evidence:** *ran*: `entries 22 ms 225`; `distinct stack+UTC-day 56 of 58`; `THREW TypeError Cannot read properties of undefined (reading 'entry')`; `148_A_023 11 2026-06-24:QPDH:2005 ...` against Appendix A's 18 dates (attempt 2, tool call 21); the duplicate pair in `<scratch>/review/cold-read/cmr_k.json` (attempt 1, tool call 24).
- **Fix:** Keep the request and the regex. Add a `res.ok` check, filter to the chosen stack, keep one entry per stack and UTC day (validated over provisional, then the highest counter), and use `time_start.slice(0, 10)` as the date. An untested patch is in Section 9.

### Stall 7. The first deployed slice on GIBS tiles

- **Where in the brief:** Section 7 row H1 to H3; Section 4.6; Appendix D2.
- **What happens:** (a) The date in the tile URL is the UTC acquisition date; converting pass times to local dates gives empty tiles. (b) Dates outside the layer's time domain return HTTP 404, and zoom 14 returns 400, so the date list and `maxzoom: 13` both matter for a clean console. (c) On 14 Nov, 07:51 to 07:54 UTC, some tiles came back different on every request: garbled PNGs served as HTTP 200 under an unchanged ETag, and occasional HTTP 500. Other tiles were stable.
- **Evidence:** *ran*: `2026-06-19 code=200 size=138873`, `2026-06-20 code=200 size=288`, `2026-08-01 code=404 size=196`, `z14 code=400 size=226` (attempt 1, tool call 16); `TonleSap   2026-10-17 z9  237/403: distinct=4/4  200:188124:RGBA  200:197677:RGBA  200:50911:P  200:215824:RGBA` against `Chicago    2026-10-22 z9  190/131: distinct=1/4  200:103162:RGB ...` (attempt 2, tool call 32). Renderings: `<scratch>/review/cold-read-coding-agent/net/rep/variants_1017.png` (garbled), `<scratch>/review/cold-read/tile_2026-10-17.png` (good).
- **Fix:** Take dates from CMR, as UTC, and drop any outside the time domain (Section 8.7 lists it). Before depending on the layer, run the stability check of Section 8.7 on the team's own tiles: four requests, identical bytes, PNG colour type 2. Keep the preview-PNG overlay (sketch D4, reproduced in Section 8.6) ready as the second no-login layer.

### Stall 8. Python environment

- **Where in the brief:** Section 6.1.
- **What happens:** The brief's package list installs cleanly but omits packages its own plan uses: PyYAML for `sites/<site>.yaml`, matplotlib for the histogram and thumbnail check, pytest, Pillow for preview PNGs, and harmony-py for the Harmony option. The first `import yaml` fails.
- **Evidence:** *ran*: after `pip install h5py numpy scipy pyproj rasterio rio-cogeo earthaccess asf_search` (14.4 s, 321 MB), a `pip list` filtered for `pyyaml|matplotlib|pillow|harmony|xarray|pytest|...` printed none of them (attempt 2, tool call 36).
- **Fix:** `/opt/anaconda3/bin/python3 -m venv .venv` then install the brief's eight plus `pyyaml matplotlib pytest pillow`. Versions that installed: h5py 3.16.0, numpy 2.5.4, scipy 1.18.1, pyproj 3.8.0, rasterio 1.5.2 (bundled GDAL 3.12.2), rio-cogeo 7.0.4, earthaccess 0.19.0, asf_search 14.1.0.

### Stall 9. Local server for COG range reads

- **Where in the brief:** Section 6.6.
- **What happens:** The brief leaves Python's built-in server "unverified". It does not honour Range: it returns 200 and the whole file.
- **Evidence:** *ran*: `== python http.server  brief's command: curl -r 0-99 -I / HTTP/1.0 200 OK Content-Length: 300000`; both Vite servers: `HTTP/1.1 206 Partial Content Content-Length: 100 Content-Range: bytes 0-99/300000 Accept-Ranges: bytes` (attempt 2, tool call 50; same in attempt 1, tool call 26).
- **Fix:** Test COGs only through `vite` or `vite preview` (Vite 8.3.8 tested). The brief's check command `curl -r 0-99 -I <url>` works as written.

### Stall 10. Reading a window with sketch D3

- **Where in the brief:** Appendix D3; Section 6.2 stage 2; Section 4.7.
- **What happens:** On a synthetic file the window and geotransform are right. But a bbox outside the frame raises a bare `IndexError`, a bbox partly outside returns a silently truncated array, and requested terms missing from the file are silently dropped (the HH-only dates of Section 4.7 would pass unnoticed).
- **Evidence:** *ran*: `inside: keys ['HHHH', 'mask'] shape (1012, 1000) epsg 32648 gt (320000.0, 20.0, 0.0, 1490120.0, 0.0, -20.0)`; `outside: raised IndexError index 3000 is out of bounds for axis 0 with size 3000`; `partly outside: shape (1015, 500) (asked for 1500 columns)` (attempt 1, tool call 22). Not run against a real file.
- **Fix:** Keep the arithmetic. Add an explicit error when the window is empty, record when it is smaller than requested, and report missing terms. Keep `test_d3.py` (Section 8.2) as the unit test the brief asks for ("the window arithmetic (y descends)").

### Stall 11. Writing COGs with sketch D5

- **Where in the brief:** Appendix D5; Section 6.3.
- **What happens:** It works as written. Surprises: a `DeprecationWarning` for `web_optimized`; the output grid is snapped to a web-mercator zoom and padded to tile edges (20 m becomes 19.11 m at zoom 13, 40 m becomes 38.22 m at zoom 12), so the COG is larger than its source; blocks are 512 x 512 where the COG protocol's README recommends 256; overviews are averages of dB codes, not of power.
- **Evidence:** *ran*: `cog_translate ok in 0.4s`; `crs EPSG:3857 dtype ('uint8',) nodata 0.0 size 2816 x 3072 res [38.22, 38.22] overviews [2, 4, 8] block [(512, 512)] compress deflate`; `validate: True`; `file 6.25 MB for 6.67 M valid px (plus overviews) -> 0.94 bytes per valid full-res pixel`; `16 looks: ... = 0.14 dB`, ` 4 looks: ... = 0.57 dB`, `mixed water/bright pixel: dB of mean power -8.9 vs mean of dB -15.0` (attempt 2, tool call 39); `rio cogeo validate` prints `... is a valid cloud optimized GeoTIFF` (attempt 1, tool call 20).
- **Fix:** Use the call as written; budget about 1 byte per valid pixel per date per layer (6 MB for 100 x 100 km at 40 m); set the AI-disclosure tags on the source (they survive); read click values at full resolution (omit the zoom argument of `locationValues`) and compute charted statistics in the pipeline from linear power.

### Stall 12. Harmony in the 45-minute bake-off

- **Where in the brief:** Section 4.5 path 2; Section 6.2.
- **What happens:** The page the brief cites describes only the Earthdata Search web interface. There is no API or harmony-py recipe on it, EPSG:3857 is not an output option, and harmony-py is not in the package list.
- **Evidence:** *docs*: keyword counts on the fetched page `harmony-py 0`, `Request( 0`, `curl  0` (attempt 1, tool call 32); page text in attempt 1, tool calls 33 and 34; saved page `<scratch>/review/cold-read/web/harmony.html`.
- **Fix:** On this evidence, try the h5py-over-HTTPS path first and keep Harmony as a fallback a teammate can drive through Earthdata Search. Another topic's digest may hold hands-on Harmony results; prefer those.

## 2. Facts

**F1** (ran). The official clone <official-repo> has no research/ folder and no commits; the brief, CHECKPOINT.md, evidence/ and nisar_coverage.py exist only under <prehackathon-repo>/research/. Every `research/...` path in the brief (Sections 0, 6.1, 10 step 1, Appendix A) is dangling from the official repo.

> Evidence: `ls: <official-repo>/research/: No such file or directory` (attempt 2, call 0, 14 Nov 01:41 CST); local ls during recovery shows only .git and `## No commits yet on main...origin/main [gone]`

**F2** (ran). Build machine as probed 13 Nov 21:00 CST: macOS 26.6.2 arm64, Node v22.15.0, npm, Python 3.12.2 at /opt/anaconda3/bin/python3, git at /opt/homebrew/bin/git, caffeinate present, GitHub CLI absent, 30 GiB free on the data volume (the brief says about 42 GB), clock on US Central time.

> Evidence: `gh not found`, `v22.15.0`, `Python 3.12.2`, `Fri Nov 13 21:00:59 CST 2026` (attempt 1, call 11); `/dev/disk3s5   460Gi   390Gi    30Gi    93%` (attempt 1, call 18)

**F3** (ran). research/nisar_coverage.py works by absolute path in about 0.5 s with stock Python (argument order: lon, then lat) and queries beta, provisional and validated collections. Misuse gives raw tracebacks: no arguments raises IndexError, swapped lat/lon gives HTTP 400; a point with no data prints 0 stack(s).

> Evidence: `083_A_008   11 dates  2026-06-19 .. 2026-10-29  pol=HH+HV  bw=20+5 MHz  ~1896 MB/file  releases={'P': 10, 'V': 1}` in `0.535 total`; `IndexError: list index out of range`; `urllib.error.HTTPError: HTTP Error 400: Bad Request`; `GCOV at lon=-150.0 lat=-40.0: 0 stack(s)` (attempt 2, call 20)

**F4** (ran). Sketch D1 runs unmodified under Node 22 against live CMR: 22 entries in about 0.2 s at the Appendix A sample point, 58 in 0.3 s and 34 in 0.7 s at two others. CMR answers with access-control-allow-origin: * and a cmr-hits header. D1's pol field exposes per-date polarization changes inside one stack (148_D_082 alternates DHDH and SHSH, i.e. HH+HV and HH only).

> Evidence: `entries 22 ms 225`, `entries 58 ms 296`, `entries 34 ms 667`, `148_D_082 11 2026-06-24:DHDH:2005 2026-07-06:SHSH:2005 ...` (attempt 2, call 21); `access-control-allow-origin: *`, `cmr-hits: 11` (attempt 1, call 13)

**F5** (ran). D1 as written has four defects for a date stepper: it repeats a date when a granule was reprocessed (counters _001 and _002 with the same start time); it never checks res.ok, so a CMR error (for example lon and lat swapped, HTTP 400) surfaces as an opaque TypeError; it returns every stack at the point, ascending and descending together; and it leaves out the beta collection, so it lists fewer dates than Appendix A and nisar_coverage.py (Chicago sample, stack 148_A_023: 11 dates from 2026-06-24 against Appendix A's 18 from 2025-11-08). A point with no data returns an empty array.

> Evidence: `distinct stack+UTC-day 56 of 58`; `THREW TypeError Cannot read properties of undefined (reading 'entry')`; `148_A_023 11 2026-06-24:QPDH:2005 ...`; `entries 0 ms 188` (attempt 2, call 21); two CMR entries `..._20260619T045817_20260619T045836_P05023_N_P_J_001` and `..._J_002`, both `2026-06-19T04:58:17.000Z` (attempt 1, call 24)

**F6** (ran). CMR granules.json entry shape: granule_size is a string in MB; polygons is a nested array holding one string of lat lon pairs; each entry has 52 links (5 marked inherited) including one https data# .h5, one s3#, and seven https browse# PNGs (_LATLON, _LATLON_thumbnail, _NATIVE, _NATIVE_A_HHHH, _NATIVE_A_HVHV, _NATIVE_B_HHHH, _NATIVE_B_HVHV); about 25 KB of JSON per entry. The data URL's collection segment is NISAR_L2_GCOV_PROVISIONAL_V1 for provisional and NISAR_L2_GCOV_V1 for validated granules.

> Evidence: <scratch>/review/cold-read/cmr_point.json (11 entries, 276,717 bytes; granule_size '1777.8144416809082'); `7 ('browse#', False, 'https', 'png')` (attempt 1, call 14); `https://nisar.asf.earthdatacloud.nasa.gov/NISAR/NISAR_L2_GCOV_V1/NISAR_L2_PR_GCOV_034_083_A_008_2005_DHDH_M_20261029T223634_20261029T223708_P05036_N_F_J_001/...h5` (attempt 1, call 13)

**F7** (ran). Without login a data URL answers 302 to urs.earthdata.nasa.gov/oauth/authorize; following it ends in HTTP 401 with the 27-byte body HTTP Basic: Access denied. With wrong credentials in ~/.netrc, curl -n -L ends in 401 with an 81-byte error text. The granule's QA_SUMMARY.csv is behind login too. A downloader that follows redirects and saves the body would store those few bytes under an .h5 name.

> Evidence: `no-follow: http=302 bytes=0 redirect=https://urs.earthdata.nasa.gov/oauth/authorize?client_id=...`, `follow:    http=401 bytes=27`, `HTTP Basic: Access denied.` (attempt 2, call 22); `http=401 bytes=81` (attempt 2, call 38); `== QA_SUMMARY.csv no auth` then `HTTP/2 302` (attempt 1, call 15)

**F8** (ran). A granule's _LATLON browse PNG downloads without login through one redirect as binary/octet-stream: 4,080,968 bytes, 1880 x 1847 RGB, in 1.3 to 1.5 s (about 2.8 to 3.0 MB/s on this network; a small file, so only a rough lower bound on bandwidth). The copies in research/evidence/previews are downscaled to 1000 x 982.

> Evidence: `browse: http=200 bytes=4080968 type=binary/octet-stream redirects=1 time=1.341622s speed=3041816B/s`; `browse.png: PNG image data, 1880 x 1847, 8-bit/color RGB, non-interlaced` (attempt 2, call 22); `browse_tonlesap_2026-06-19.png RGBA (1000, 982) 1225992` (attempt 2, call 28)

**F9** (ran). earthaccess 0.19.0: the bare earthaccess.login() of sketch D3 (default strategy 'all') falls through to an interactive prompt when it finds no credentials. With stdin closed it raises EOFError at once; with stdin open but idle it blocks until stdin closes (11.7 s under a 12 s watchdog), so an unattended job would hang.

> Evidence: `Enter your Earthdata Login username: login() raised EOFError EOF when reading a line 0.0s` (stdin from /dev/null; attempt 2, call 37); `Enter your Earthdata Login username: raised EOFError 11.7s` (sleep 12 piped into stdin; attempt 2, call 38)

**F10** (ran). earthaccess.login(strategy='netrc') and strategy='environment' never prompt: missing credentials raise LoginStrategyUnavailable in 0.0 s with a message naming the missing file or variables; wrong credentials raise LoginAttemptFailure in 0.2 s. After a failed login, earthaccess.get_fsspec_https_session() raises an AttributeError that does not mention login. A world-readable (mode 644) .netrc was still used by both earthaccess and curl.

> Evidence: `netrc -> raised LoginStrategyUnavailable ('No .netrc found at .../py/emptyhome/.netrc',) 0.0s`; `open/read raised AttributeError 'NoneType' object has no attribute 'get_fsspec_session'` (attempt 2, call 37); `netrc login raised LoginAttemptFailure Authentication with Earthdata Login failed with: ...` after `0.2s`, with the test .netrc created by `chmod 644` (attempt 2, call 38)

**F11** (ran). Sketch D3's read_window arithmetic is right on a synthetic HDF5 laid out like Section 4.4 (pixel-centre coordinates, y descending): the window and the GDAL geotransform match the expected values. Its edge cases fail quietly: a bbox wholly outside the frame raises a bare IndexError, a bbox partly outside returns a truncated array with no warning (500 of 1500 columns), and requested terms missing from the file are dropped silently. Never run against a real file.

> Evidence: `inside: keys ['HHHH', 'mask'] shape (1012, 1000) epsg 32648 gt (320000.0, 20.0, 0.0, 1490120.0, 0.0, -20.0)` with `-> gt origin should be 320000.0 1490120.0`; `outside: raised IndexError index 3000 is out of bounds for axis 0 with size 3000`; `partly outside: shape (1015, 500) (asked for 1500 columns)` (attempt 1, call 22; script <scratch>/review/cold-read/d3/test_d3.py)

**F12** (ran). Sketch D5 runs exactly as written with rio-cogeo 7.0.4 and rasterio 1.5.2 (bundled GDAL 3.12.2, no system GDAL): 0.4 s for a 2500 x 2500 uint8 raster; output is EPSG:3857, nodata 0, internal overviews 2/4/8, 512 x 512 blocks, deflate; it passes cog_validate and the rio cogeo validate command. The call emits a DeprecationWarning for web_optimized. Tags written on the source with update_tags survive into the COG, so the AI-assistance tag Section 2 asks for can be set once on the source.

> Evidence: `cog_translate ok in 0.4s`; `crs EPSG:3857 dtype ('uint8',) nodata 0.0 size 2816 x 3072 res [38.22, 38.22] overviews [2, 4, 8] block [(512, 512)] compress deflate`; `validate: True`; `tags survive cog_translate: {'AI_ASSISTED': 'yes', ...` (attempt 2, call 39); `.../d5/dst_cog.tif is a valid cloud optimized GeoTIFF`; `DeprecationWarning: 'web_optomized' option is deprecated and will be removed in 6.0.` (attempt 1, call 20)

**F13** (ran). With web_optimized=True the output is snapped to the WebMercatorQuad grid and padded to tile boundaries: 20 m UTM input becomes zoom 13 at 19.11 m (2000 x 2000 px grows to 2304 x 2560), 40 m input becomes zoom 12 at 38.22 m (2500 x 2500 grows to 2816 x 3072). On synthetic 16-look speckle the COG costs 0.94 bytes per valid full-resolution pixel including overviews: 6.25 MB for one 100 x 100 km layer at 40 m.

> Evidence: `size 2304 2560 res (19.109257071294063, 19.109257071294063)` with `'TILING_SCHEME_ZOOM_LEVEL': '13'` (attempt 1, call 20); `file 6.25 MB for 6.67 M valid px (plus overviews) -> 0.94 bytes per valid full-res pixel; src deflate 4.20 MB` with `'TILING_SCHEME_ZOOM_LEVEL': '12'` (attempt 2, call 39)

**F14** (ran). Averaging the 8-bit dB codes, which is what D5's overview_resampling='average' does, is not averaging linear power: the mean of dB sits below the dB of mean power by 0.14 dB for 16-look speckle, by 0.57 dB for 4-look speckle, and by 6 dB for a pixel that is half open water (-24 dB) and half bright target (-6 dB).

> Evidence: `16 looks: 10log10(mean power) - mean(10log10 power) = 0.14 dB`; ` 4 looks: 10log10(mean power) - mean(10log10 power) = 0.57 dB`; `mixed water/bright pixel: dB of mean power -8.9 vs mean of dB -15.0` (attempt 2, call 39)

**F15** (ran). Range requests: the Vite 8.3.8 dev server and vite preview both answer the brief's command curl -r 0-99 -I with 206 and Content-Range (HEAD and GET). Python's built-in http.server ignores Range and returns 200 with the whole file. Tested in both attempts with the same result.

> Evidence: `== vite dev      brief's command: curl -r 0-99 -I` then `HTTP/1.1 206 Partial Content Content-Length: 100 Content-Range: bytes 0-99/300000 Accept-Ranges: bytes`; `== python http.server  brief's command: curl -r 0-99 -I` then `HTTP/1.0 200 OK Content-Length: 300000` (attempt 2, call 50; same in attempt 1, call 26)

**F16** (ran). GIBS NISAR layer status codes: a date inside the layer's time domain with no pass over the tile gives HTTP 200 and a 288-byte empty PNG; a date outside the time domain gives HTTP 404 with a 196-byte HTML body; zoom 14 gives HTTP 400. Time domain on 14 Nov: 2025-10-29/2026-03-01, 2026-03-04/2026-03-29, 2026-04-01/2026-04-12, 2026-04-14/2026-07-27, 2026-08-10/2026-11-11 (default 2026-11-11). Tiles carry access-control-allow-origin: * and cache-control no-store, and expose the headers layer-identifier-actual and layer-time-actual (for 2026-10-17 the actual layer was NISAR_L2_Geocoded_Polarimetric_Covariance_Provisional_v1_STD).

> Evidence: `2026-06-20 code=200 size=288 ct=image/png`; `2026-08-01 code=404 size=196 ct=text/html; charset=iso-8859-1`; `z14 code=400 size=226`; `cache-control: max-age=0, no-store, no-cache, must-revalidate` (attempt 1, call 16); `Value 2025-10-29/2026-03-01/P1D` to `Value 2026-08-10/2026-11-11/P1D` (attempt 2, call 23; saved capabilities <scratch>/review/cold-read-coding-agent/net/caps.xml)

**F17** (ran). The GIBS date is the UTC date of the acquisition, not the local date. The sample stack's pass starts at 22:36 UTC on 19 June (already 20 June local time at that site); the tile for 2026-06-19 has imagery and the tile for 2026-06-20 is the empty one.

> Evidence: CMR time_start `2026-06-19T22:36:37.000Z` (attempt 1, call 13); `2026-06-19 code=200 size=138873 ct=image/png` and `2026-06-20 code=200 size=288 ct=image/png` (attempt 1, call 16)

**F18** (ran). On 14 Nov, 07:51 to 07:54 UTC, the GIBS NISAR layer was unreliable for some tiles: the same URL returned different bytes on successive requests (8 requests, 8 different MD5 sums; PNG colour types 6, 3 and 4 instead of 2; garbled when rendered) and sometimes HTTP 500; four differing responses carried the same ETag. Affected in the sample: z9, z11 and z13 over Tonle Sap (2026-06-19 and 2026-10-17; also z9 on 2026-10-29), z11 and z13 over Mexico City (2026-10-13), z11 over Kilauea (2026-10-17). Stable (identical bytes 4 times out of 4, colour type 2): every z7 tile tested, all Chicago tiles z7 to z13 (2026-10-22), Mexico City z9, Kilauea z9 and z13, and the MODIS true-colour layer. Five hours earlier (03:01 UTC) two z8 tiles over Tonle Sap were normal.

> Evidence: `2026-10-29  http=500 bytes=527 type=text/html; charset=iso-8859-1` (attempt 2, call 22); `TonleSap   2026-10-17 z9  237/403: distinct=4/4  200:188124:RGBA  200:197677:RGBA  200:50911:P  200:215824:RGBA` against `Chicago    2026-10-22 z9  190/131: distinct=1/4  200:103162:RGB  200:103162:RGB  200:103162:RGB  200:103162:RGB` (attempt 2, call 32); `modis 0 200 17575 0da82cdf` three times (attempt 2, call 31); garbled rendering saved at <scratch>/review/cold-read-coding-agent/net/rep/variants_1017.png

**F19** (ran). The brief's Python package list installs from wheels into a fresh venv on this Mac in about 14 s (321 MB) with no system GDAL: h5py 3.16.0, numpy 2.5.4, scipy 1.18.1, pyproj 3.8.0, rasterio 1.5.2 (GDAL 3.12.2), rio-cogeo 7.0.4, earthaccess 0.19.0, asf_search 14.1.0, fsspec 2026.9.0, aiohttp 3.14.5, morecantile 7.1.0. It does not bring in PyYAML, matplotlib, pytest, Pillow, xarray or harmony-py, which the brief's own plan uses (YAML site configs, histograms and thumbnails, tests, browse PNG handling, the Harmony option).

> Evidence: pip list filtered for those names printed only aiohttp, asf_search, earthaccess, fsspec, h5py, morecantile, numpy, pyproj, rasterio, requests, rio-cogeo and scipy; then `rasterio 1.5.2 GDAL 3.12.2`, `14.437 total`, `321M` (attempt 2, call 36)

**F20** (docs). npm registry on 14 Nov: maplibre-gl latest is 6.18.0 and dist-tag latest-5 is 5.24.1; @geomatico/maplibre-cog-protocol 0.10.0 (peer maplibre-gl ^4.5.0 || ^5.0.0 || ^6.0.0, depends on geotiff ^3.0.5, MIT); geotiff 3.0.5; @mapbox/mapbox-gl-sync-move 0.4.0; vite 8.3.8 (needs Node ^20.19.0 || >=22.12.0); react 19.3.1; typescript 7.0.2; create-vite 9.3.4. Installing maplibre-gl@5.24.1, the COG protocol 0.10.0 and sync-move 0.4.0 together succeeded in about 1 s.

> Evidence: npm view output: `maplibre-gl                          latest=6.18.0`, dist-tags latest-5 5.24.1, vite engines node ^20.19.0 || >=22.12.0 (attempt 2, call 35; create-vite in attempt 1, call 17); the install itself ran: `added 47 packages in 1s` (attempt 2, call 40)

**F21** (docs). From the README shipped in @geomatico/maplibre-cog-protocol 0.10.0: COGs must be EPSG:3857 (anything else throws); raster sources should set tileSize 256; 256 x 256 internal blocks are recommended (D5's deflate profile writes 512); locationValues(url, {latitude, longitude}, zoom?) returns one number per band with scale and offset applied and NaN on nodata or outside the image, reading full resolution when zoom is omitted and the nearest overview when it is given; colour ramps use `#color:<scheme>,<min>,<max>,<modifiers>` with c for continuous; setColorFunction is keyed by the source URL without the cog:// prefix; nodata has to be declared on the source file before warping.

> Evidence: <scratch>/review/cold-read-coding-agent/npm/node_modules/@geomatico/maplibre-cog-protocol/README.md (687 lines; its sections on pixel values and on COG generation were printed in attempt 2, calls 40 and 41)

**F22** (ran). Sketch D4 reproduces. Applied literally to the 2026-06-19 browse PNG of stack 083_A_008 it gives west 102.3867, east 105.5263, north 14.3419, south 11.3329, within 0.0007 degrees (under half a pixel) of the brief's numbers. Pixel size is about 181 m. 0.05 % of pixels inside the footprint are pure black and would become holes when black is made transparent.

> Evidence: `D4 result: west 102.3867 east 105.5263 north 14.3419 south 11.3329`; `brief says: west 102.3865 east 105.5270 north 14.3420 south 11.3330`; `deg per px: lon 0.001670 lat 0.001629  -> approx 181 m`; `black pixels inside the footprint polygon: 0.05% of footprint` (attempt 2, call 51)

**F23** (docs). The FortiGuard web-filter request form (the link on the official submission guide page) asks for the site URL, a category, and the requester's name, email and company, and carries a CAPTCHA. It is a job for a human teammate, not for the agent.

> Evidence: Fields scraped from https://www.fortiguard.com/faq/wfratingsubmit: `input url text None required`, `input name text None required`, `input email text None required`, `input company text None required`, `input code hidden None required`, `captcha 71` (attempt 1, call 28; saved page <scratch>/review/cold-read/web/forti.html)

**F24** (docs). GitHub Pages, per GitHub's documentation: the free plan needs a public repository; choosing the publishing source needs admin or maintainer rights; the configure-pages action can switch Pages on only with a token other than GITHUB_TOKEN; a published site may be at most 1 GB; deployments time out after 10 minutes; soft limits are 100 GB of bandwidth a month and 10 builds an hour (the latter not applied to custom Actions workflows); GitHub warns about files above 50 MiB and blocks files above 100 MiB; Git LFS cannot be used with Pages. Latest action releases on 14 Nov: checkout v7.0.1, setup-node v7.1.0, configure-pages v6.0.0, upload-pages-artifact v5.0.0, deploy-pages v5.0.1 (the official static starter workflow still pins checkout@v4, configure-pages@v5, upload-pages-artifact@v3 and deploy-pages@v5).

> Evidence: Saved pages in <scratch>/review/cold-read/web/ (pages_limits.html, pages_source.html, large_files.html, lfs.html, configure_pages_action.yml with its input named enablement), extracted in attempt 1, calls 29 to 31; `actions/configure-pages          v6.0.0 2026-03-25T17:00:49Z` and four sibling lines from the GitHub API (attempt 2, call 49)

**F25** (docs). The data guide's Harmony page (the URL the brief cites) documents only the Earthdata Search point-and-click route: it has no API call and no harmony-py example. Output is COG only; reprojection targets are EPSG:4326, 3031, 3413 and the UTM zones, not EPSG:3857; spatial subsetting is the search's own spatial filter.

> Evidence: Keyword counts on the fetched page: `harmony-py 0`, `Request( 0`, `curl  0` (attempt 1, call 32); page text printed in attempt 1, calls 33 and 34; saved page <scratch>/review/cold-read/web/harmony.html

**F26** (docs). The challenge statement names change-detection maps, time-series animations, dashboards, image sliders, web maps and story maps. It does not name 'click a place to chart its history', which Section 1.1 lists under 'the challenge names these'.

> Evidence: Challenge page text printed in attempt 2, calls 46 and 47, from <scratch>/pages/challenge_rsc.txt

**F27** (ran). Pointer to another topic's workspace, read but not produced by the cold-read agent: a parallel browser verification loaded MapLibre GL JS 6.18.0 with the COG protocol under the Vite dev server in headless Chrome (WebGL 2, no default export, worker served from maplibre-gl-worker.mjs, no page errors), and locationValues returned the stored value both at full resolution and at zoom 8. This bears on Section 6.5's advice to start on 5.24.1 unless a quick test shows version 6 working; take the details from that topic's own digest.

> Evidence: Printed in attempt 2, call 54: maplibreVersion 6.18.0, hasDefaultExport false, pageErrors empty, and a query with expected 30 returning 30 at full resolution and at z8; files t00_stdout.txt and t02_results.json in <scratch>/verify/browser/shots/

**F28** (belief). Unverified: that with valid credentials the probe `curl -n -L -b jar -c jar -r 0-7 <h5 url>` returns http=206 and 8 bytes equal to the HDF5 signature, that earthaccess.login(strategy='netrc') returns authenticated=True, and that D3 reads a real file over HTTPS. Also unverified: the test label's assumption that an agent harness or nohup job presents the open, idle stdin under which login() hangs.

> Evidence: No run shows it: no credentials were available, and every authenticated path was exercised only with missing or fake credentials (attempt 1, call 21; attempt 2, calls 37 and 38). The stdin label is the agent's own wording in attempt 2, call 38.

## 3. Corrections to the brief

Severity: **blocks-build** (following the brief as written fails), **wrong-result** (it runs but gives wrong data or a wrong claim), **minor**.

### C1. Sections 0, 1.2, 6.1, 10 step 1, Appendix A (every `research/...` path) [blocks-build]

- **The brief says:** The evidence trail is in `research/CHECKPOINT.md`; offer to run `python3 research/nisar_coverage.py <lon> <lat>`; the layout shows research/ inside the repository cloned at <official-repo>.
- **Actually:** The official clone is empty (no commits, no research/). The folder was moved to <prehackathon-repo>/research/ between 21:00 CST on 13 Nov and 01:41 CST on 14 Nov. Section 10 step 1's command fails from the official repo; by absolute path it runs in 0.5 s.
- **Evidence:** `ls: <official-repo>/research/: No such file or directory` (attempt 2, call 0); `?? research/` in the official clone at 21:00 CST on 13 Nov (attempt 1, call 11); recovery-time ls: `## No commits yet on main...origin/main [gone]`

### C2. Appendix D3 and Section 4.5 (earthaccess.login()) [blocks-build]

- **The brief says:** `earthaccess.login()   # ~/.netrc, or EARTHDATA_TOKEN, or EARTHDATA_USERNAME + EARTHDATA_PASSWORD` followed by `fs = earthaccess.get_fsspec_https_session()`
- **Actually:** With no usable credentials the bare call prompts on stdin: EOFError if stdin is closed, an indefinite block if stdin is open and idle. The next line then fails with an AttributeError about 'NoneType' and get_fsspec_session. earthaccess.login(strategy='netrc') or strategy='environment' fails in 0.0 to 0.2 s with LoginStrategyUnavailable or LoginAttemptFailure and a readable message. The authenticated path itself was never run.
- **Evidence:** `Enter your Earthdata Login username: raised EOFError 11.7s` under a 12 s watchdog (attempt 2, call 38); `netrc -> raised LoginStrategyUnavailable ('No .netrc found at ...',) 0.0s` and `open/read raised AttributeError 'NoneType' object has no attribute 'get_fsspec_session'` (attempt 2, call 37)

### C3. Section 6.6 and Section 10 step 5 (deploy to GitHub Pages) [blocks-build]

- **The brief says:** GitHub Pages is the default; set the build's base path, and the repository must be public; deploy a map centred on the team's place to the public URL.
- **Actually:** A step is missing: someone with admin or maintainer rights has to switch Pages on (Settings, Pages, Source: GitHub Actions) before the first workflow run, because the configure-pages action cannot do it with the default GITHUB_TOKEN. The GitHub CLI is not installed on the build machine, the remote has no branch yet (first push needs -u), and deployments time out after 10 minutes. No run attempted a deploy.
- **Evidence:** <scratch>/review/cold-read/web/configure_pages_action.yml (input enablement needs a token other than GITHUB_TOKEN) and <scratch>/review/cold-read/web/pages_source.html; `gh not found` and `## No commits yet on main...origin/main [gone]` (attempt 1, call 11)

### C4. Section 4.6 and Section 7, row H1 to H3 (the fallback that always exists) [wrong-result]

- **The brief says:** GIBS serves the NISAR layer as tiles, and the first deployed slice is the GIBS layer stepping through the pass dates, described as the fallback that always exists.
- **Actually:** On 14 Nov, 07:51 to 07:54 UTC, some tiles of this layer came back different on every request: garbled PNGs (colour types 6, 3 or 4) served as HTTP 200 under an unchanged ETag, and now and then HTTP 500. Other tiles (all z7, all Chicago tiles, MODIS) were stable. At 03:01 UTC the same day two z8 tiles were normal. Not re-tested since. The app would show garbage without any error.
- **Evidence:** `TonleSap   2026-10-17 z9  237/403: distinct=4/4  200:188124:RGBA  200:197677:RGBA  200:50911:P  200:215824:RGBA`; `TonleSap   2026-06-19 z13 3798/6463: distinct=3/4  200:194788:RGBA  500:527:notimg  500:527:notimg  200:44422:P`; `Chicago    2026-10-22 z13 3045/2101: distinct=1/4  200:153443:RGB  200:153443:RGB  200:153443:RGB  200:153443:RGB` (attempt 2, call 32)

### C5. Appendix D1 [wrong-result]

- **The brief says:** Pass dates at a point, from the browser. Request and response shape verified with curl; this JavaScript has not been run. The function maps feed.entry straight to a list.
- **Actually:** It runs as written, but (1) it repeats a date when a granule was reprocessed (_001 and _002), (2) it throws a TypeError about reading 'entry' of undefined on any CMR error because res.ok is never checked, (3) it mixes all stacks at the point, and (4) it leaves out the beta collection, so its counts differ from Appendix A.
- **Evidence:** `distinct stack+UTC-day 56 of 58`; `THREW TypeError Cannot read properties of undefined (reading 'entry')`; `148_A_023 11 2026-06-24:QPDH:2005 ...` (attempt 2, call 21); the duplicate pair in <scratch>/review/cold-read/cmr_k.json

### C6. Section 4.6 (GIBS dates and empty tiles) [minor]

- **The brief says:** Dates available: 2025-10-29 to 2026-11-11 with the gaps above. A date with no pass over your area returns an empty 288-byte tile rather than an error.
- **Actually:** True only inside the layer's time domain. Outside it the server returns HTTP 404 (196-byte HTML): observed for 2026-08-01, 2026-11-12 and 2027-01-01. Besides the 28 July to 9 August gap the brief knows about, the domain is missing 2026-03-02, 03-03, 03-30, 03-31 and 04-13. Zoom 14 returns HTTP 400. The date in the URL is the UTC acquisition date.
- **Evidence:** `2026-08-01 code=404 size=196 ct=text/html; charset=iso-8859-1`, `z14 code=400 size=226`, `2026-06-20 code=200 size=288 ct=image/png` (attempt 1, call 16); time-domain values in <scratch>/review/cold-read-coding-agent/net/caps.xml (attempt 2, call 23)

### C7. Appendix D3 (read_window) [wrong-result]

- **The brief says:** `c0, c1 = np.searchsorted(x, [min(xs), max(xs)])` ... `return out, epsg, (x[c0] - dx / 2, dx, 0.0, y[r0] - dy / 2, 0.0, dy)`
- **Actually:** The arithmetic and geotransform are right for a box inside the frame. A box wholly outside raises a bare IndexError; a box partly outside returns a silently truncated array; terms missing from the file are silently dropped. Section 4.7 asks to check the area is inside the footprint on every date, and the sketch gives no signal for that.
- **Evidence:** `outside: raised IndexError index 3000 is out of bounds for axis 0 with size 3000`; `partly outside: shape (1015, 500) (asked for 1500 columns)`; `inside: keys ['HHHH', 'mask'] ...` although HVHV was requested (attempt 1, call 22)

### C8. Section 6.6 (local testing) [minor]

- **The brief says:** (Whether Python's built-in server does is unverified; do not rely on it.)
- **Actually:** Settled: python3 -m http.server (Python 3.12) ignores Range and sends the whole file with 200. The Vite 8.3.8 dev server and vite preview both return 206 to the brief's exact curl command.
- **Evidence:** `== python http.server  brief's command: curl -r 0-99 -I` then `HTTP/1.0 200 OK Content-Length: 300000`; `== vite dev      brief's command: curl -r 0-99 -I` then `HTTP/1.1 206 Partial Content Content-Length: 100 Content-Range: bytes 0-99/300000 Accept-Ranges: bytes` (attempt 2, call 50)

### C9. Appendix D5 and Section 6.3 [minor]

- **The brief says:** Writing a web-ready COG. Not run here. ... Then `rio cogeo validate dst`.
- **Actually:** It runs as written and validates (function and command). It prints a DeprecationWarning for web_optimized. The output grid is snapped to a web-mercator zoom and padded to tile edges, so it is not the input resolution or size (20 m becomes 19.11 m at zoom 13; 40 m becomes 38.22 m at zoom 12) and the file is larger than its source. Blocks are 512 x 512 where the COG protocol README recommends 256. Tags set on the source survive.
- **Evidence:** `cog_translate ok in 0.4s`, `size 2304 2560 res (19.109257071294063, 19.109257071294063)`, `4163615 d5/dst_cog.tif` against `2931493 d5/src_utm.tif`, `DeprecationWarning: 'web_optomized' option is deprecated and will be removed in 6.0.` (attempt 1, call 20); `tags survive cog_translate: {'AI_ASSISTED': 'yes', ...` (attempt 2, call 39)

### C10. Section 6.3 and Appendix D5 (overview_resampling='average') against Section 5 (work in linear power, show in decibels) [minor]

- **The brief says:** Overviews of the 8-bit dB-coded COG are built with overview_resampling='average'; Section 5 says to average linear values and only then convert to dB.
- **Actually:** The overviews are means of dB codes. The bias against true power averaging is 0.14 dB (16 looks) to 0.57 dB (4 looks) on uniform ground and about 6 dB on a mixed water and bright pixel. Fine for display; any value read from an overview level is not a power average. locationValues reads full resolution only when its zoom argument is omitted.
- **Evidence:** `16 looks: 10log10(mean power) - mean(10log10 power) = 0.14 dB`, ` 4 looks: 10log10(mean power) - mean(10log10 power) = 0.57 dB`, `mixed water/bright pixel: dB of mean power -8.9 vs mean of dB -15.0` (attempt 2, call 39); README of the COG protocol package in <scratch>/review/cold-read-coding-agent/npm/node_modules/@geomatico/maplibre-cog-protocol/README.md

### C11. Section 6.1 (Python package list) [minor]

- **The brief says:** Use a project-local Python environment with pip wheels: h5py, numpy, scipy, pyproj, rasterio, rio-cogeo, earthaccess, asf_search.
- **Actually:** That list installs cleanly (14 s, 321 MB) but leaves out packages the brief's own plan uses: PyYAML (`sites/<site>.yaml`), matplotlib (histogram and thumbnail check), pytest (tests), Pillow (browse PNGs, D4) and harmony-py (Harmony option).
- **Evidence:** pip list after the install, filtered for pyyaml, matplotlib, pillow, pytest, xarray and harmony among others, printed none of them (attempt 2, call 36)

### C12. Section 1.2 (Machines) [minor]

- **The brief says:** one known laptop has macOS, Node 22, Python 3.12, no GDAL, about 42 GB free disk
- **Actually:** 30 GiB were free on 13 Nov at 21:00 CST, measured before these runs created their scratch environments. The GitHub CLI is not installed. Node is 22.15.0, which satisfies Vite 8's engine range.
- **Evidence:** `/dev/disk3s5   460Gi   390Gi    30Gi    93%` (attempt 1, call 18); `gh not found`, `v22.15.0` (attempt 1, call 11)

### C13. Section 6.6 and Section 10 step 5 (FortiGuard) [minor]

- **The brief says:** File the FortiGuard classification request. (as a step for the agent)
- **Actually:** The form needs a person: required name, email and company fields plus a CAPTCHA. The agent can prepare the URL and a category suggestion; a teammate has to submit it at https://www.fortiguard.com/faq/wfratingsubmit.
- **Evidence:** `input name text None required`, `input email text None required`, `input company text None required`, `input code hidden None required`, `captcha 71` (attempt 1, call 28)

### C14. Section 4.5, access path 2 (Harmony) [minor]

- **The brief says:** Harmony extracts GCOV, GUNW, GOFF and SME2 layers as Cloud-Optimized GeoTIFFs with bounding-box subsetting and reprojection.
- **Actually:** The cited page shows only the Earthdata Search web interface, with no API or harmony-py recipe; reprojection does not offer EPSG:3857, so the pipeline would still have to warp; subsetting is tied to the search's spatial filter. harmony-py (1.8.0 on PyPI) is not in the brief's package list.
- **Evidence:** `harmony-py 0`, `Request( 0`, `curl  0` (keyword counts, attempt 1, call 32); saved page <scratch>/review/cold-read/web/harmony.html; `harmony-py (1.8.0)` (attempt 1, call 18)

### C15. Section 4.5 (access without login) [minor]

- **The brief says:** Without login the data URL redirects to a sign-in page.
- **Actually:** It answers 302 to the Earthdata authorize URL, and a client that follows it gets HTTP 401 with a 27-byte body (HTTP Basic: Access denied.), or an 81-byte error text with wrong credentials. Downloads must be checked (status, size, HDF5 signature) and not trusted on exit code.
- **Evidence:** `follow:    http=401 bytes=27 final=https://urs.earthdata.nasa.gov/oauth/authorize?...` (attempt 2, call 22); `http=401 bytes=81` (attempt 2, call 38)

### C16. Section 4.6 (public preview PNGs) [minor]

- **The brief says:** Every granule has `<granule>_LATLON.png` plus `_LATLON_thumbnail.png` (100 x 100).
- **Actually:** CMR lists seven browse PNGs per GCOV granule: the two above plus _NATIVE.png and one per channel and band (_NATIVE_A_HHHH, _NATIVE_A_HVHV, _NATIVE_B_HHHH, _NATIVE_B_HVHV). Only _LATLON.png was actually fetched (4.1 MB at full size, 1880 x 1847).
- **Evidence:** `browse# nisar.asf.earthdatacloud.nasa.gov BROWSE _NATIVE_A_HHHH.png` and six sibling lines (attempt 1, call 14); `browse: http=200 bytes=4080968` (attempt 2, call 22)

### C17. Section 1.1 (feature checklist) [minor]

- **The brief says:** Features we want (the challenge names these; tick what applies and add your own), followed by six items including: click a place to chart its history.
- **Actually:** The challenge statement names change-detection maps, time-series animations, dashboards, image sliders, web maps and story maps. Clicking a place to chart its history is the brief's own addition, not the challenge's wording.
- **Evidence:** Challenge text printed in attempt 2, calls 46 and 47 (from the session scratchpad file pages/challenge_rsc.txt)

## 4. Recommendations

**R1. Earthdata login in pipeline code.** Never the bare earthaccess.login(). Try earthaccess.login(strategy='environment'), then strategy='netrc', inside try/except, and stop with a message telling the teammate what to fix. Start every unattended pipeline command with stdin from /dev/null.

Why: The default strategy prompts on stdin and blocked for the full 12 s watchdog with an idle stdin; the two named strategies fail in 0.0 to 0.2 s with clear exceptions (LoginStrategyUnavailable, LoginAttemptFailure); with stdin closed any stray prompt becomes an immediate EOFError.

**R2. The one small authenticated request of Section 10 step 3.** `curl -s -n -L -b jar.txt -c jar.txt -r 0-7 -o probe.bin -w 'http=%{http_code} bytes=%{size_download}\n' '<granule .h5 URL>'`, then check that probe.bin is 8 bytes starting with the HDF5 signature. Read http=401 bytes=27 as no credentials sent, and a 401 with a longer error text as an account or password problem.

Why: This command ran (with fake credentials) and gives distinct, readable failure signatures; it needs no Python environment. The success signature (206, 8 bytes) is expected but was never observed.

**R3. Where the coverage script and evidence are read from.** Either call `python3 <prehackathon-repo>/research/nisar_coverage.py <lon> <lat>` by absolute path, or copy research/ into the official repo in the first post-kickoff commit; record the choice in PROGRESS.md.

Why: The official clone has no research/ folder, and the brief's relative paths assume it does.

**R4. Pass-date list in the web app (D1).** Keep D1's request and regex. Add: throw on !res.ok with CMR's message; filter to the chosen stack; keep one entry per stack and UTC day (validated over provisional, then highest counter); use time_start.slice(0, 10) (UTC) as the date everywhere, including the GIBS URL; handle an empty result.

Why: D1 as written returned 58 entries for 56 distinct passes, threw an opaque TypeError on an HTTP 400, and mixes ascending with descending stacks; GIBS tiles are keyed by the UTC date.

**R5. Using GIBS for the first deployed slice.** Raster source with tileSize 256 and maxzoom 13; offer only CMR pass dates that fall inside the layer's time domain; before relying on it, fetch each tile the default view needs four times and require identical bytes and PNG colour type 2; keep the browse-PNG overlay (D4) ready as the second no-login layer; treat tile errors as no imagery in the interface.

Why: Zoom 14 returns 400 and out-of-domain dates return 404; on 14 Nov some tiles were garbled yet served as 200, or returned 500, and the stability check that exposed it takes seconds.

**R6. Window reader (D3).** Keep the index arithmetic and geotransform. Add a clear error when the bbox misses the frame (c0 >= c1 or r0 >= r1), record when the returned shape is smaller than the requested box, and report which requested terms were absent. Keep the synthetic-file test as the unit test for y descending and the geotransform.

Why: The arithmetic passed on a synthetic file, but outside boxes raised a bare IndexError and partly-outside boxes were silently truncated, which would pass unnoticed into a time series.

**R7. COG writer (D5) and working resolution.** Use the D5 call as written (rio-cogeo 7.0.4, rasterio 1.5.2); expect the web_optimized DeprecationWarning; set AI-disclosure tags on the source with update_tags; validate with rio cogeo validate. Budget 1 byte per valid pixel: about 6 MB per date and layer for 100 x 100 km at 40 m, and by pixel count about four times that at 20 m (the 20 m figure was not measured). Expect the output grid at 38.22 m (zoom 12) or 19.11 m (zoom 13), padded to tile edges.

Why: All of this was measured on synthetic speckle with the brief's exact call; the size figure decides how many dates and layers fit under the 1 GB Pages limit.

**R8. Click queries and charted statistics.** Call locationValues(url, {latitude, longitude}) without the zoom argument, and compute every charted statistic in the pipeline from linear power, not from the 8-bit COG or its overviews.

Why: Overviews average dB codes (0.14 to 0.57 dB low on uniform ground, about 6 dB off at water edges), and the README says the zoom argument makes locationValues read an overview.

**R9. Local server for COG testing.** vite (dev) or vite preview only; never python -m http.server.

Why: Both Vite servers returned 206 with Content-Range; Python's server returned 200 with the full body, which hides range-read bugs and downloads whole files.

**R10. Python environment.** /opt/anaconda3/bin/python3 -m venv .venv, then pip install h5py numpy scipy pyproj rasterio rio-cogeo earthaccess asf_search pyyaml matplotlib pytest pillow (add harmony-py only if Harmony is tried). Freeze the versions that installed: h5py 3.16.0, numpy 2.5.4, scipy 1.18.1, pyproj 3.8.0, rasterio 1.5.2, rio-cogeo 7.0.4, earthaccess 0.19.0, asf_search 14.1.0.

Why: The first eight installed from wheels in 14 s with GDAL 3.12.2 bundled; the last four are needed by the brief's own steps and were not pulled in as dependencies.

**R11. Web dependencies.** npm install maplibre-gl@5.24.1 @geomatico/maplibre-cog-protocol@0.10.0 @mapbox/mapbox-gl-sync-move@0.4.0 with vite 8.3.8 on Node 22.15.0; always name the maplibre-gl version.

Why: That exact install succeeded (47 packages, 1 s); an unpinned install resolves to maplibre-gl 6.18.0, the ESM-only line the brief says to avoid at first; Vite 8 needs Node ^20.19.0 or >=22.12.0, which the machine has.

**R12. GitHub Pages deployment.** Before the agent's first deploy a teammate with admin rights makes the repo public and sets Settings, Pages, Source to GitHub Actions. First push with git push -u origin main. Workflow: checkout, setup-node, build with the base path /NASA-space-apps-2026/, configure-pages, upload-pages-artifact (web/dist), deploy-pages, with permissions pages: write and id-token: write. Keep the artifact well under 1 GB and the deploy under 10 minutes; no Git LFS.

Why: The workflow cannot enable Pages with the default token, the CLI that could do it is not installed, the remote has no branch yet, and GitHub documents the 1 GB, 10 minute and no-LFS limits. None of this was exercised by a run.

**R13. FortiGuard classification request.** Hand it to a teammate as soon as the URL exists, with the URL and a suggested category; do not attempt it from the agent.

Why: The form requires a name, email and company and a CAPTCHA.

**R14. Order of the access bake-off (Section 6.2).** On this topic's evidence alone: try the h5py-over-HTTPS path first and treat Harmony as a teammate-driven fallback through Earthdata Search.

Why: The cited Harmony page gives no programmatic recipe, offers no EPSG:3857 output and harmony-py is not installed, so it is the path most likely to eat the 45-minute box; other topics' digests may hold hands-on Harmony results that override this.

**R15. Disk and download planning.** Plan for windowed reads only; do not queue whole-file downloads of 40+5 MHz stacks on this laptop without first freeing space and measuring bandwidth on a large file.

Why: 30 GiB were free (not 42 GB) and the only measured transfer was about 3 MB/s on a 4 MB file; ten 6 to 7 GB files would neither fit comfortably nor finish quickly.

## 5. Artifacts

The scratch folders are under `/private/tmp` and can be cleared by a reboot; that is why the code is reproduced in Section 8.

**A1.** `<scratch>/review/cold-read-coding-agent/d1/d1.mjs`

- What: Sketch D1 verbatim plus a small command-line harness; ran under Node 22 against live CMR.
- Reuse: `node d1.mjs <lon> <lat>`. The function body is the brief's; add the res.ok check and de-duplication before using it in the app. Full text is in the digest, Section 8.1.

**A2.** `<scratch>/review/cold-read/d3/test_d3.py`

- What: Builds a synthetic GCOV-like HDF5 (synthetic.h5 beside it) and exercises D3's read_window inside, outside and across the frame edge.
- Reuse: Run with a venv python and an output path. Turn the three cases into pytest tests; swap FakeFS for the real fsspec session once credentials exist. Full text in the digest, Section 8.2.

**A3.** `<scratch>/review/cold-read-coding-agent/py/login_probe.py`

- What: Probes earthaccess login behaviour with no credentials; login_hang.py and login_netrc.py beside it cover the idle-stdin and wrong-password cases.
- Reuse: `env -i HOME=<empty dir> PATH=/usr/bin:/bin <venv>/bin/python login_probe.py < /dev/null`. With real credentials, run it with the normal HOME to see the success path, which no run has seen. Full text in the digest, Section 8.3.

**A4.** `<scratch>/review/cold-read-coding-agent/py/test_d5.py`

- What: Section 6.3 encoding plus the D5 call on synthetic 16-look speckle, with size, tag-survival and overview-bias measurements; outputs in the out/ folder beside it. An earlier, shorter version is <scratch>/review/cold-read/d5/test_d5.py.
- Reuse: `python test_d5.py <outdir>`. The encode line and the read-back checks are reusable as pipeline code and tests; change N, pixel size and CRS to match the real window. Full text in the digest, Section 8.4.

**A5.** `<scratch>/review/cold-read-coding-agent/web/range`

- What: Minimal Vite 8.3.8 project with a 300 kB blob used for the Range test of vite dev, vite preview and python http.server (logs dev.log, prev.log, py.log). Attempt 1's equivalent is <scratch>/review/cold-read/vite-range.
- Reuse: The test command is in the digest, Section 8.5; point it at the real project's dev and preview ports and at the deployed URL.

**A6.** `<scratch>/review/cold-read-coding-agent/net/caps.xml`

- What: GIBS WMTS capabilities for epsg3857/best, fetched 14 Nov 07:51 UTC (5.8 MB).
- Reuse: Parse offline for any layer's time domain and tile matrix set with the snippet in the digest, Section 8.7; refetch from https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml for current dates.

**A7.** `<scratch>/review/cold-read-coding-agent/net/rep`

- What: 24 repeated downloads of one GIBS tile on three dates plus side-by-side renderings (variants_1017.png, variants_0619.png); ../scope/four.png shows good and bad tiles together; <scratch>/review/cold-read/tile_2026-10-17.png is a known-good tile.
- Reuse: Evidence for the GIBS instability. The stability-check script that produced the scope table is in the digest, Section 8.7; rerun it with the team's own place, dates and zooms.

**A8.** `<scratch>/review/cold-read/cmr_point.json`

- What: Real CMR granules.json responses: 11 entries for one stack (headers in headers_cmr.txt beside it) and, in cmr_k.json beside it, 5 entries including two reprocessed duplicates.
- Reuse: Fixtures for unit-testing the pass-list parser and the de-duplication offline, and for a mock manifest.

**A9.** `<scratch>/review/cold-read-coding-agent/net/browse.png`

- What: Full-size _LATLON browse PNG (1880 x 1847, 4.08 MB) of granule NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223637_20260619T223711_P05023_N_F_J_001.
- Reuse: Input for the D4 georeferencing script in the digest, Section 8.6; expected result west 102.3867, east 105.5263, north 14.3419, south 11.3329.

**A10.** `<scratch>/review/cold-read/web`

- What: Saved pages: GitHub Pages limits and publishing source, large files, Git LFS, the configure-pages action.yml, the FortiGuard form and the Harmony page of the NISAR data guide.
- Reuse: Read offline to cite limits in docs/SOURCES.md; all were fetched 13 Nov about 21:05 CST.

**A11.** `<scratch>/review/cold-read-coding-agent/py/venv`

- What: Ready virtual environment with the brief's Python package list (321 MB; rasterio 1.5.2 with GDAL 3.12.2, rio-cogeo 7.0.4, earthaccess 0.19.0, h5py 3.16.0). <scratch>/review/cold-read/venv is a twin built with the same install command.
- Reuse: Usable at once for experiments through its bin/python, but it sits under /private/tmp and can vanish; create the project's own .venv for the build.

**A12.** `<scratch>/review/cold-read-coding-agent/npm`

- What: npm project with maplibre-gl 5.24.1, @geomatico/maplibre-cog-protocol 0.10.0 and @mapbox/mapbox-gl-sync-move 0.4.0 installed, including the COG protocol README.
- Reuse: Read node_modules/@geomatico/maplibre-cog-protocol/README.md offline for the API; copy the dependency lines from package.json.

**A13.** `https://cmr.earthdata.nasa.gov/search/granules.json?collection_concept_id=C2854338529-ASF&collection_concept_id=C3622241360-ASF&point=104.05,12.95&page_size=2000&attribute[]=string,STACK_ID,083_A_008&sort_key=start_date`

- What: CMR query that returned 11 entries with CORS headers (curl needs -g because of the brackets).
- Reuse: Change point and STACK_ID; add `&temporal=<start>,<end>` to narrow. No login.

**A14.** `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/NISAR_L2_Geocoded_Polarimetric_Covariance/default/{YYYY-MM-DD}/GoogleMapsCompatible_Level13/{z}/{y}/{x}.png`

- What: GIBS tile template that returned imagery (z/y/x order, UTC date, zoom 13 at most).
- Reuse: Tile indices for a lon/lat: x = int((lon+180)/360*2^z), y = int((1-asinh(tan(lat_in_radians))/pi)/2*2^z). Check stability before relying on it.

**A15.** `<transcripts>/wf_79c71ecc-a87/agent-ac697a7d245fe6ed9.jsonl`

- What: Transcript of attempt 2 (the fullest); attempt 1 is agent-af9cd04a0e46630ca.jsonl and attempt 3 is agent-ac653e4abf3e3d002.jsonl in the same folder.
- Reuse: JSONL; tool calls are numbered from 0 in order of appearance, which is how the digest cites them (attempt N, call M). No assistant prose exists in any of the three.

## 6. Things that were tried and did not work

1. **Finish the cold-read review and return findings (all three attempts).** Cut off by usage limits before any finding was written: `You've hit your 5-hour limit · resets 1:40am (America/Chicago)` (attempt 1), `You've hit your 5-hour limit · resets 6:40am (America/Chicago)` (attempt 2), `You've hit your Fable limit · resets 2pm (America/Chicago). Switch to another model to continue.` (attempt 3, after two tool calls).
2. **Open research/ in the official clone (attempts 2 and 3).** `ls: <official-repo>/research/: No such file or directory`. Attempt 2 found it under <prehackathon-repo>; attempt 3 stopped there.
3. **Bare earthaccess.login() with an empty HOME and no EARTHDATA_* variables.** Prompted `Enter your Earthdata Login username:`; EOFError `EOF when reading a line` with stdin closed; blocked 11.7 s (until the watchdog closed stdin) with an idle stdin.
4. **`earthaccess.get_fsspec_https_session()` and `fs.open(<h5 url>)` without a successful login.** `AttributeError 'NoneType' object has no attribute 'get_fsspec_session'`.
5. **earthaccess.login(strategy='netrc') with a fake account in ~/.netrc.** LoginAttemptFailure after 0.2 s; Earthdata Login answered error invalid_account_status: `Profile has no password in the system, please reset your password and log back in`.
6. **Range request (bytes 0-7) on a GCOV .h5 URL with no credentials, and with fake credentials via curl -n.** 302 to urs.earthdata.nasa.gov/oauth/authorize, then `http=401 bytes=27` with body `HTTP Basic: Access denied.`; with the fake account `http=401 bytes=81`.
7. **D3 read_window with a bbox outside, and partly outside, the frame (synthetic file).** `IndexError index 3000 is out of bounds for axis 0 with size 3000`; partly outside returned shape (1015, 500) where 1500 columns were asked for, with no warning.
8. **D1 with lon and lat swapped (node d1.mjs 12.95 104.05).** `THREW TypeError Cannot read properties of undefined (reading 'entry')` (CMR had answered HTTP 400).
9. **nisar_coverage.py with no arguments, and with lat/lon swapped.** `IndexError: list index out of range`; `urllib.error.HTTPError: HTTP Error 400: Bad Request` (raw tracebacks, no usage message).
10. **Range request against python3 -m http.server.** `HTTP/1.0 200 OK Content-Length: 300000` (whole file, no Content-Range).
11. **GIBS NISAR tile for 2026-10-29 at z9/237/403.** First request `http=500 bytes=527` (HTML 500 Internal Server Error); three retries gave 200 with 44443, 44443 and 200876 bytes, i.e. different content for one URL.
12. **Fetching one GIBS NISAR tile eight times on each of three dates.** 2026-10-17: eight different MD5 sums in eight requests; 2026-10-29: four; 2026-06-19: five; mixes of RGBA, palette and grey-alpha PNGs that render as noise.
13. **GIBS tiles at zoom 14 and for dates outside the layer's time domain (2026-08-01, 2026-11-12, 2027-01-01).** `z14 code=400 size=226`; `code=404 size=196 ct=text/html; charset=iso-8859-1`.
14. **Finding a ready-to-run Harmony request on https://nisar-docs.asf.alaska.edu/harmony.** None there: zero matches for harmony-py, Request( and curl; the page covers only the Earthdata Search interface.
15. **Locating the GitHub CLI on the build machine.** `gh not found`.

## 7. Open questions

1. Is the GIBS NISAR layer still returning garbled or 500 tiles? It was only observed on 14 Nov, 07:51 to 07:54 UTC, and the cause is unknown. Rerun the four-request stability check on the team's own tiles before building the first slice on it.
2. Does sketch D3 work against a real GCOV file over HTTPS? Never run (no credentials): the HDF5 layout of Section 4.4, the blockcache setting with earthaccess's session, the time to read one window, and whether the ASF data-access agreement is required all remain unverified.
3. What does a successful Earthdata login look like on this machine (is ~/.netrc or a token in place)? Only the missing-credential and wrong-credential paths were seen.
4. Is the official GitHub repository public, is Pages switched on, and can this machine push? The remote had no branch (origin/main [gone]), the GitHub CLI is missing, and no deploy was attempted.
5. Should research/ be copied into the official repository (as Section 6.1's layout assumes) or left in the pre-hackathon repository and referenced by absolute path?
6. rio-cogeo's suggested replacement for web_optimized (the tms option), a 256 x 256 block profile, and the warp resampling used by cog_translate were not tried.
7. Are the _NATIVE*.png previews downloadable without login like _LATLON.png, and are they georeferenced in the product's own projection? Only _LATLON.png was fetched.
8. The reading-based half of the review was never written down: ambiguities and contradictions in the prose, whether Sections 7 and 8 can be checked, whether the box at the top is enough for a human teammate, and what to cut from the 9,000 words. Nothing of it can be recovered from the transcripts.
9. Schedule (from the request that triggered this recovery, not from the recovered runs): the team says it presents at 3:00 pm on Sunday and wants most of the project together by Sunday morning, while Section 7 puts feature freeze at Sunday 15:00 and the demo work after it. Section 7 needs re-basing with the team.
10. Section 1.1 (the team's concept) and the time-zone line of Section 1.2 are still blank in the brief; the machine's clock is on US Central time.
11. Sketch D2 (the GIBS layer in MapLibre) and the COG protocol in a real browser were not run by this topic; a parallel browser verification workspace exists and should be read from its own digest.

## 8. Code that ran, verbatim, with its output

In the shell commands, `W=` and `S=` are the scratch folders of the attempts; replace them with your own folder. `/opt/anaconda3/bin/python3` is the machine's Python 3.12; `./venv/bin/python` is the scratch venv with the brief's package list. Outputs are copied from the transcripts; places where the recovery pass shortened them are marked.

### 8.1 Sketch D1 with a command-line harness

File: `<scratch>/review/cold-read-coding-agent/d1/d1.mjs` (attempt 2). The function is the brief's Appendix D1 unchanged; the part after the marker comment is the test harness. Ran under Node v22.15.0.

````js
// Throwaway: sketch D1 copied verbatim from the brief (Appendix D1), run under Node 22.
const GCOV = ['C2854338529-ASF', 'C3622241360-ASF']; // provisional, validated
export async function nisarPasses(lon, lat) {
  const p = new URLSearchParams({ point: `${lon},${lat}`, page_size: '2000', sort_key: 'start_date' });
  GCOV.forEach((c) => p.append('collection_concept_id', c));
  const res = await fetch(`https://cmr.earthdata.nasa.gov/search/granules.json?${p}`);
  const { feed } = await res.json();
  return feed.entry.map((e) => {
    const m = e.title.match(/_GCOV_(\d{3})_(\d{3})_([AD])_(\d{3})_(\d{4})_(\w{4})_/);
    return {
      name: e.title, start: e.time_start, cycle: m[1], stack: `${m[2]}_${m[3]}_${m[4]}`, mode: m[5], pol: m[6],
      polygon: e.polygons?.[0]?.[0], // "lat lon lat lon ..."
      browse: e.links.filter((l) => l.rel.endsWith('browse#') && l.href.startsWith('https')).map((l) => l.href),
    };
  });
}
// ---- harness below is mine, not from the brief
const [lon, lat] = process.argv.slice(2).map(Number);
const t = Date.now();
try {
  const r = await nisarPasses(lon, lat);
  console.log('entries', r.length, 'ms', Date.now() - t);
  const by = {};
  for (const e of r) (by[e.stack] ??= []).push(e.start.slice(0, 10) + ':' + e.pol + ':' + e.mode);
  for (const [k, v] of Object.entries(by)) console.log(' ', k, v.length, v.join(' '));
  const days = r.map((e) => e.stack + ' ' + e.start.slice(0, 10));
  console.log('distinct stack+UTC-day', new Set(days).size, 'of', days.length);
  if (r.length) { console.log('first name:', r[0].name); console.log('first start:', r[0].start); console.log('browse links:', r[0].browse); console.log('polygon:', r[0].polygon); }
} catch (e) { console.log('THREW', e.constructor.name, e.message); }
````

Invocation (end of attempt 2, tool call 21):

````bash
cd "$W/d1" && node --version && echo "== Tonle Sap" && node d1.mjs 104.05 12.95; echo "== Kilauea (partial frames, 29 dates)"; node d1.mjs -155.28 19.41 | head -12; echo "== Chicago quad-pol"; node d1.mjs -87.65 41.85 | head -8; echo "== open ocean"; node d1.mjs -150 -40; echo "== swapped lat/lon"; node d1.mjs 12.95 104.05
````

Output:

````text
v22.15.0
== Tonle Sap
entries 22 ms 225
  083_A_008 11 2026-06-19:DHDH:2005 2026-07-01:DHDH:2005 2026-07-13:DHDH:2005 2026-07-25:DHDH:2005 2026-08-18:DHDH:2005 2026-08-30:DHDH:2005 2026-09-11:DHDH:2005 2026-09-23:DHDH:2005 2026-10-05:DHDH:2005 2026-10-17:DHDH:2005 2026-10-29:DHDH:2005
  148_D_082 11 2026-06-24:DHDH:2005 2026-07-06:SHSH:2005 2026-07-18:DHDH:2005 2026-08-11:DHDH:2005 2026-08-23:SHSH:2005 2026-09-04:DHDH:2005 2026-09-16:SHSH:2005 2026-09-28:DHDH:2005 2026-10-10:SHSH:2005 2026-10-22:DHDH:2005 2026-11-03:SHSH:2005
distinct stack+UTC-day 22 of 22
first name: NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223637_20260619T223711_P05023_N_F_J_001
first start: 2026-06-19T22:36:37.000Z
browse links: [
  'https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223637_20260619T223711_P05023_N_F_J_001/NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223637_20260619T223711_P05023_N_F_J_001_LATLON.png',
  'https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223637_20260619T223711_P05023_N_F_J_001/NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223637_20260619T223711_P05023_N_F_J_001_LATLON_thumbnail.png',
  'https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223637_20260619T223711_P05023_N_F_J_001/NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223637_20260619T223711_P05023_N_F_J_001_NATIVE.png',
  'https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223637_20260619T223711_P05023_N_F_J_001/NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223637_20260619T223711_P05023_N_F_J_001_NATIVE_A_HHHH.png',
  'https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223637_20260619T223711_P05023_N_F_J_001/NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223637_20260619T223711_P05023_N_F_J_001_NATIVE_A_HVHV.png',
  'https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223637_20260619T223711_P05023_N_F_J_001/NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223637_20260619T223711_P05023_N_F_J_001_NATIVE_B_HHHH.png',
  'https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223637_20260619T223711_P05023_N_F_J_001/NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223637_20260619T223711_P05023_N_F_J_001_NATIVE_B_HVHV.png'
]
polygon: 12.07019 105.39936 14.15457 104.89399 13.61372 102.62722 11.53813 103.14859 12.07019 105.39936
== Kilauea (partial frames, 29 dates)
entries 58 ms 296
  072_D_079 29 2025-11-03:DHDH:4005 2025-11-15:DHDH:4005 2025-11-27:DHDH:4005 2025-12-09:DHDH:4005 2025-12-21:DHDH:4005 2026-01-02:DHDH:4005 2026-01-14:DHDH:4005 2026-01-26:DHDH:4005 2026-02-07:DHDH:4005 2026-02-19:DHDH:4005 2026-03-15:DHDH:4005 2026-03-27:DHDH:4005 2026-04-08:DHDH:4005 2026-04-20:DHDH:4005 2026-05-02:DHDH:4005 2026-05-14:DHDH:4005 2026-05-26:DHDH:4005 2026-06-19:DHDH:4005 2026-06-19:DHDH:4005 2026-07-01:DHDH:4005 2026-07-13:DHDH:4005 2026-08-18:DHDH:4005 2026-08-30:DHDH:4005 2026-09-11:DHDH:4005 2026-09-23:DHDH:4005 2026-10-05:DHDH:4005 2026-10-17:DHDH:4005 2026-10-29:DHDH:4005 2026-11-10:DHDH:4005
  151_A_011 29 2025-11-08:DHDH:4005 2025-11-20:DHDH:4005 2025-12-02:DHDH:4005 2025-12-14:DHDH:4005 2025-12-26:DHDH:4005 2026-01-07:DHDH:4005 2026-01-19:DHDH:4005 2026-01-31:DHDH:4005 2026-02-12:DHDH:4005 2026-02-24:DHDH:4005 2026-03-08:DHDH:4005 2026-03-20:DHDH:4005 2026-04-25:DHDH:4005 2026-05-07:DHDH:4005 2026-05-19:DHDH:4005 2026-05-31:DHDH:4005 2026-06-12:DHDH:4005 2026-06-24:DHDH:4005 2026-06-24:DHDH:4005 2026-07-06:DHDH:4005 2026-07-18:DHDH:4005 2026-08-11:DHDH:4005 2026-08-23:DHDH:4005 2026-09-04:DHDH:4005 2026-09-16:DHDH:4005 2026-09-28:DHDH:4005 2026-10-10:DHDH:4005 2026-10-22:DHDH:4005 2026-11-03:DHDH:4005
distinct stack+UTC-day 56 of 58
first name: NISAR_L2_PR_GCOV_004_072_D_079_4005_DHDH_A_20251103T045814_20251103T045834_P05023_N_P_J_001
first start: 2025-11-03T04:58:14.000Z
browse links: [
  'https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_004_072_D_079_4005_DHDH_A_20251103T045814_20251103T045834_P05023_N_P_J_001/NISAR_L2_PR_GCOV_004_072_D_079_4005_DHDH_A_20251103T045814_20251103T045834_P05023_N_P_J_001_LATLON.png',
  'https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_004_072_D_079_4005_DHDH_A_20251103T045814_20251103T045834_P05023_N_P_J_001/NISAR_L2_PR_GCOV_004_072_D_079_4005_DHDH_A_20251103T045814_20251103T045834_P05023_N_P_J_001_LATLON_thumbnail.png',
  'https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_004_072_D_079_4005_DHDH_A_20251103T045814_20251103T045834_P05023_N_P_J_001/NISAR_L2_PR_GCOV_004_072_D_079_4005_DHDH_A_20251103T045814_20251103T045834_P05023_N_P_J_001_NATIVE.png',
  'https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_004_072_D_079_4005_DHDH_A_20251103T045814_20251103T045834_P05023_N_P_J_001/NISAR_L2_PR_GCOV_004_072_D_079_4005_DHDH_A_20251103T045814_20251103T045834_P05023_N_P_J_001_NATIVE_A_HHHH.png',
  'https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_004_072_D_079_4005_DHDH_A_20251103T045814_20251103T045834_P05023_N_P_J_001/NISAR_L2_PR_GCOV_004_072_D_079_4005_DHDH_A_20251103T045814_20251103T045834_P05023_N_P_J_001_NATIVE_A_HVHV.png',
== Chicago quad-pol
entries 34 ms 667
  047_A_023 11 2026-06-17:QPDH:2005 2026-06-29:QPDH:2005 2026-07-11:QPDH:2005 2026-07-23:QPDH:2005 2026-08-16:QPDH:2005 2026-08-28:QPDH:2005 2026-09-09:QPDH:2005 2026-09-21:QPDH:2005 2026-10-03:QPDH:2005 2026-10-15:QPDH:2005 2026-10-27:QPDH:2005
  084_D_067 11 2026-06-20:QPDH:2005 2026-07-02:QPDH:2005 2026-07-14:QPDH:2005 2026-07-26:QPDH:2005 2026-08-19:QPDH:2005 2026-08-31:QPDH:2005 2026-09-12:QPDH:2005 2026-09-24:QPDH:2005 2026-10-06:QPDH:2005 2026-10-18:QPDH:2005 2026-10-30:QPDH:2005
  148_A_022 1 2026-06-24:QPDH:2005
  148_A_023 11 2026-06-24:QPDH:2005 2026-07-06:QPDH:2005 2026-07-18:QPDH:2005 2026-08-11:QPDH:2005 2026-08-23:QPDH:2005 2026-09-04:QPDH:2005 2026-09-16:QPDH:2005 2026-09-28:QPDH:2005 2026-10-10:QPDH:2005 2026-10-22:QPDH:2005 2026-11-03:QPDH:2005
distinct stack+UTC-day 34 of 34
first name: NISAR_L2_PR_GCOV_023_047_A_023_2005_QPDH_A_20260617T104911_20260617T104946_P05023_F_F_J_001
first start: 2026-06-17T10:49:11.000Z
== open ocean
entries 0 ms 188
distinct stack+UTC-day 0 of 0
== swapped lat/lon
THREW TypeError Cannot read properties of undefined (reading 'entry')
````

The duplicate pair behind "56 of 58" (attempt 1, tool call 24):

````bash
cd <scratch>/review/cold-read && /usr/bin/curl -sS -A "coverage-check" -g -o cmr_k.json 'https://cmr.earthdata.nasa.gov/search/granules.json?collection_concept_id=C2854338529-ASF&collection_concept_id=C3622241360-ASF&point=-155.28,19.41&page_size=2000&sort_key=start_date&temporal=2026-06-10T00:00:00Z,2026-06-30T00:00:00Z' && /opt/anaconda3/bin/python3 - <<'EOF'
import json
for e in json.load(open('cmr_k.json'))['feed']['entry']:
    print(e['title'], e['time_start'], e['time_end'], e['granule_size'][:6], e['collection_concept_id'])
EOF
````

````text
NISAR_L2_PR_GCOV_022_151_A_011_4005_DHDH_A_20260612T155043_20260612T155101_P05023_N_P_J_001 2026-06-12T15:50:43.000Z 2026-06-12T15:51:01.999Z 2637.6 C2854338529-ASF
NISAR_L2_PR_GCOV_023_072_D_079_4005_DHDH_A_20260619T045817_20260619T045836_P05023_N_P_J_001 2026-06-19T04:58:17.000Z 2026-06-19T04:58:36.999Z 2693.8 C2854338529-ASF
NISAR_L2_PR_GCOV_023_072_D_079_4005_DHDH_A_20260619T045817_20260619T045836_P05023_N_P_J_002 2026-06-19T04:58:17.000Z 2026-06-19T04:58:36.999Z 2693.8 C2854338529-ASF
NISAR_L2_PR_GCOV_023_151_A_011_4005_DHDH_A_20260624T155042_20260624T155100_P05023_N_P_J_001 2026-06-24T15:50:42.000Z 2026-06-24T15:51:00.999Z 2629.7 C2854338529-ASF
NISAR_L2_PR_GCOV_023_151_A_011_4005_DHDH_A_20260624T155042_20260624T155100_P05023_N_P_J_002 2026-06-24T15:50:42.000Z 2026-06-24T15:51:00.999Z 2629.7 C2854338529-ASF
````

### 8.2 Sketch D3: window arithmetic on a synthetic HDF5

File: `<scratch>/review/cold-read/d3/test_d3.py` (attempt 1). `read_window` is the brief's sketch D3 unchanged; `FakeFS` stands in for the fsspec session. No network, no credentials. It needs `h5py`, `numpy`, `pyproj`.

````python
"""Throwaway: exercise the window arithmetic of sketch D3 against a synthetic local HDF5 laid out like the
brief's Section 4.4 table. Not project code; no network."""
import h5py, numpy as np, sys
from pyproj import Transformer

path = sys.argv[1]
epsg = 32648
x = 300000.0 + 10.0 + 20.0 * np.arange(3000)            # pixel centres, ascending
y = 1500000.0 - 10.0 - 20.0 * np.arange(2500)           # pixel centres, descending
with h5py.File(path, "w") as h:
    g = h.create_group("/science/LSAR/GCOV/grids/frequencyA")
    g["xCoordinates"] = x; g["yCoordinates"] = y
    g.create_dataset("projection", data=np.uint32(epsg))
    rows, cols = np.meshgrid(np.arange(2500), np.arange(3000), indexing="ij")
    g.create_dataset("HHHH", data=(rows * 10000 + cols).astype("float32"), chunks=(512, 512), compression="gzip")
    g.create_dataset("mask", data=np.ones((2500, 3000), "uint8"), chunks=(512, 512), compression="gzip")

class FakeFS:                      # stands in for earthaccess.get_fsspec_https_session()
    def open(self, url, mode="rb", **kw): return open(url, mode)
fs = FakeFS()

def read_window(url, bbox, freq="A", terms=("HHHH", "HVHV")):   # body copied verbatim from the brief, D3
    with fs.open(url, mode="rb", cache_type="blockcache", block_size=8 * 1024 * 1024) as f, \
         h5py.File(f, "r") as h5:
        g = h5[f"/science/LSAR/GCOV/grids/frequency{freq}"]
        x, y = g["xCoordinates"][:], g["yCoordinates"][:]        # pixel centres, metres; y descends
        epsg = int(g["projection"][()])
        w, s, e, n = bbox
        xs, ys = Transformer.from_crs(4326, epsg, always_xy=True).transform([w, e, w, e], [s, s, n, n])
        c0, c1 = np.searchsorted(x, [min(xs), max(xs)])
        r0, r1 = np.searchsorted(-y, [-max(ys), -min(ys)])
        out = {t: g[t][r0:r1, c0:c1] for t in terms if t in g}
        out["mask"] = g["mask"][r0:r1, c0:c1]
        dx, dy = float(x[1] - x[0]), float(y[1] - y[0])           # dy is negative
        return out, epsg, (x[c0] - dx / 2, dx, 0.0, y[r0] - dy / 2, 0.0, dy)

inv = Transformer.from_crs(epsg, 4326, always_xy=True)
# a box well inside the frame
w, s = inv.transform(320000, 1470000); e, n = inv.transform(340000, 1490000)
out, code, gt = read_window(path, (w, s, e, n))
a = out["HHHH"]
print("inside: keys", sorted(out), "shape", a.shape, "epsg", code, "gt", tuple(round(float(v), 3) for v in gt))
r0, c0 = int(a[0, 0] // 10000), int(a[0, 0] % 10000)
print("  first pixel row/col", r0, c0, "centre", x[c0], y[r0], "-> gt origin should be", x[c0] - 10, y[r0] + 10)
print("  covers x", gt[0], gt[0] + gt[1] * a.shape[1], " y", gt[3], gt[3] + gt[5] * a.shape[0])
# a box entirely outside the frame
out, code, gt2 = None, None, None
try:
    w2, s2 = inv.transform(500000, 1470000); e2, n2 = inv.transform(520000, 1490000)
    out, code, gt2 = read_window(path, (w2, s2, e2, n2))
    print("outside: shape", out["HHHH"].shape, "gt", gt2)
except Exception as ex:
    print("outside: raised", type(ex).__name__, ex)
# a box that sticks out past the east edge
w3, s3 = inv.transform(350000, 1470000); e3, n3 = inv.transform(380000, 1490000)
out, code, gt3 = read_window(path, (w3, s3, e3, n3))
print("partly outside: shape", out["HHHH"].shape, "(asked for 1500 columns)")
````

Invocation and output (attempt 1, tool call 22):

````bash
./venv/bin/python d3/test_d3.py d3/synthetic.h5 2>&1 | tail -12
````

````text
inside: keys ['HHHH', 'mask'] shape (1012, 1000) epsg 32648 gt (320000.0, 20.0, 0.0, 1490120.0, 0.0, -20.0)
  first pixel row/col 494 1000 centre 320010.0 1490110.0 -> gt origin should be 320000.0 1490120.0
  covers x 320000.0 340000.0  y 1490120.0 1469880.0
outside: raised IndexError index 3000 is out of bounds for axis 0 with size 3000
partly outside: shape (1015, 500) (asked for 1500 columns)
````

### 8.3 Earthdata login behaviour without credentials

File: `<scratch>/review/cold-read-coding-agent/py/login_probe.py` (attempt 2).

````python
"""Throwaway: what does the brief's D3 line `earthaccess.login()` do when no credentials exist (empty HOME, no env vars)?"""
import time, inspect, earthaccess
print("earthaccess", earthaccess.__version__, "login signature:", inspect.signature(earthaccess.login))
t = time.time()
try:
    a = earthaccess.login()
    print("login() returned", type(a).__name__, "authenticated=", getattr(a, "authenticated", None), "%.1fs" % (time.time() - t))
except BaseException as e:
    print("login() raised", type(e).__name__, str(e)[:300].replace("\n", " "), "%.1fs" % (time.time() - t))
for strategy in ("environment", "netrc"):
    t = time.time()
    try:
        a = earthaccess.login(strategy=strategy)
        print(strategy, "-> returned", type(a).__name__, "authenticated=", getattr(a, "authenticated", None), "%.1fs" % (time.time() - t))
    except BaseException as e:
        print(strategy, "-> raised", type(e).__name__, str(e)[:300].replace("\n", " "), "%.1fs" % (time.time() - t))
try:
    fs = earthaccess.get_fsspec_https_session()
    print("get_fsspec_https_session ->", type(fs).__name__)
    url = "https://nisar.asf.earthdatacloud.nasa.gov/NISAR/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223637_20260619T223711_P05023_N_F_J_001/NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223637_20260619T223711_P05023_N_F_J_001.h5"
    t = time.time()
    with fs.open(url, mode="rb", cache_type="blockcache", block_size=8 * 1024 * 1024) as f:
        b = f.read(8); print("first 8 bytes without login:", b, "%.1fs" % (time.time() - t))
except BaseException as e:
    print("open/read raised", type(e).__name__, str(e)[:300].replace("\n", " "))
````

Invocation and output (attempt 2, tool call 37): empty HOME, no `EARTHDATA_*` variables, stdin closed.

````bash
env -i HOME="$W/py/emptyhome" PATH="/usr/bin:/bin" "$W/py/venv/bin/python" login_probe.py < /dev/null 2>&1 | tail -12; echo "== exit: $?"
````

````text
== stdin closed (/dev/null), empty HOME, no EARTHDATA_* env
earthaccess 0.19.0 login signature: (strategy: str = 'all', persist: bool = False, system: earthaccess.system.System = System(cmr_base_url='https://cmr.earthdata.nasa.gov/search/', status_url='https://status.earthdata.nasa.gov/', status_api_url='https://status.earthdata.nasa.gov/api/v1/statuses', edl_hostname='urs.earthdata.nasa.gov')) -> earthaccess.auth.Auth
Enter your Earthdata Login username: login() raised EOFError EOF when reading a line 0.0s
environment -> raised LoginStrategyUnavailable ("Either the environment variables EARTHDATA_USERNAME and EARTHDATA_PASSWORD must both be set, or EARTHDATA_TOKEN must be set for the 'environment' login strategy.",) 0.0s
netrc -> raised LoginStrategyUnavailable ('No .netrc found at <scratch>/review/cold-read-coding-agent/py/emptyhome/.netrc',) 0.0s
open/read raised AttributeError 'NoneType' object has no attribute 'get_fsspec_session'
== exit: 0
````

Idle-stdin and wrong-credential cases, with the curl probe (attempt 2, tool call 38). This command writes `login_hang.py`, `login_netrc.py` and a throwaway `.netrc` holding a made-up account; all three files are in `<scratch>/review/cold-read-coding-agent/py/`.

````bash
W=<scratch>/review/cold-read-coding-agent; cd "$W/py"; cat > login_hang.py <<'EOF'
import time, earthaccess
t=time.time()
try:
    a=earthaccess.login(); print("returned", a, "%.1fs"%(time.time()-t))
except BaseException as e:
    print("raised", type(e).__name__, "%.1fs"%(time.time()-t))
EOF
echo "== stdin is an open pipe that never sends anything (like an agent harness or nohup job); 12 s watchdog"; ( sleep 12 | env -i HOME="$W/py/emptyhome" PATH="/usr/bin:/bin" "$W/py/venv/bin/python" login_hang.py ) 2>&1 | tail -3
echo "== bad netrc permissions case"; mkdir -p "$W/py/badhome" && printf 'machine urs.earthdata.nasa.gov login nobody password notapassword\n' > "$W/py/badhome/.netrc" && chmod 644 "$W/py/badhome/.netrc"; cat > login_netrc.py <<'EOF'
import time, earthaccess
t=time.time()
try:
    a=earthaccess.login(strategy="netrc"); print("netrc login returned authenticated=", a.authenticated, "%.1fs"%(time.time()-t))
except BaseException as e:
    print("netrc login raised", type(e).__name__, str(e)[:300].replace("\n"," "), "%.1fs"%(time.time()-t))
EOF
env -i HOME="$W/py/badhome" PATH="/usr/bin:/bin" "$W/py/venv/bin/python" login_netrc.py < /dev/null 2>&1 | tail -3; echo "-- curl with world-readable netrc and fake creds:"; env -i HOME="$W/py/badhome" PATH="/usr/bin:/bin" /usr/bin/curl -s -n -L -b "$W/py/c.txt" -c "$W/py/c.txt" -r 0-7 -o "$W/py/probe_fake.bin" -w "http=%{http_code} bytes=%{size_download}\n" "https://nisar.asf.earthdatacloud.nasa.gov/NISAR/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223637_20260619T223711_P05023_N_F_J_001/NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223637_20260619T223711_P05023_N_F_J_001.h5"; head -c 120 "$W/py/probe_fake.bin" | LC_ALL=C tr -c '[:print:]\n' '.'; echo; rm -f "$W/py/c.txt"
````

````text
== stdin is an open pipe that never sends anything (like an agent harness or nohup job); 12 s watchdog
Enter your Earthdata Login username: raised EOFError 11.7s
== bad netrc permissions case
{"error":"invalid_account_status","error_description":"Profile has no password in the system, please reset your password and log back in"}
NoneType: None
netrc login raised LoginAttemptFailure Authentication with Earthdata Login failed with: {"error":"invalid_account_status","error_description":"Profile has no password in the system, please reset your password and log back in"} 0.2s
-- curl with world-readable netrc and fake creds:
http=401 bytes=81
Profile has no password in the system, please reset your password and log back in
````

The same curl probe is the suggested "one small authenticated request" for Section 10 step 3. With a real `~/.netrc` it should print `http=206 bytes=8` and the 8 bytes should be the HDF5 signature (`\x89HDF\r\n\x1a\n`). That success case is a belief: it was never observed.

````bash
curl -s -n -L -b jar.txt -c jar.txt -r 0-7 -o probe.bin -w "http=%{http_code} bytes=%{size_download}\n" "<granule .h5 URL>"
````

Unauthenticated responses for data, QA and preview URLs (attempt 1, tool call 15):

````bash
cd <scratch>/review/cold-read && G=NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223637_20260619T223711_P05023_N_F_J_001 && B=https://nisar.asf.earthdatacloud.nasa.gov && C=NISAR_L2_GCOV_PROVISIONAL_V1 && echo "== h5 range, no auth, no follow" && /usr/bin/curl -sS -A "access-check" -r 0-7 -o /dev/null -D - "$B/NISAR/$C/$G/$G.h5" | grep -i -E '^HTTP|^location|^content-type|^www-auth' | cut -c1-220 && echo "== h5 range, no auth, follow" && /usr/bin/curl -sS -A "access-check" -L -r 0-7 -o probe.bin -w 'final_code=%{http_code} url=%{url_effective} size=%{size_download} ct=%{content_type}\n' "$B/NISAR/$C/$G/$G.h5" | cut -c1-300; head -c 200 probe.bin | LC_ALL=C tr -c '[:print:]\n' '.' | head -5; echo; echo "== QA_SUMMARY.csv no auth" && /usr/bin/curl -sS -A "access-check" -o /dev/null -D - "$B/NISAR/$C/$G/${G}_QA_SUMMARY.csv" | grep -i -E '^HTTP|^location' | cut -c1-200; echo "== browse png, follow" && /usr/bin/curl -sS -A "access-check" -L -o browse.png -w 'final_code=%{http_code} size=%{size_download} speed=%{speed_download}B/s time=%{time_total}s ct=%{content_type} redirects=%{num_redirects}\n' "$B/BROWSE/$C/$G/${G}_LATLON.png"; file browse.png
````

````text
== h5 range, no auth, no follow
HTTP/2 302 
content-type: application/json
location: https://urs.earthdata.nasa.gov/oauth/authorize?client_id=qpa3q_b7OJ32gGjwA9DxHg&response_type=code&redirect_uri=https://nisar.asf.earthdatacloud.nasa.gov/login&state=%2FNISAR%2FNISAR_L2_GCOV_PROVISIONAL_V1%2FNI
== h5 range, no auth, follow
final_code=401 url=https://urs.earthdata.nasa.gov/oauth/authorize?client_id=qpa3q_b7OJ32gGjwA9DxHg&response_type=code&redirect_uri=https://nisar.asf.earthdatacloud.nasa.gov/login&state=%2FNISAR%2FNISAR_L2_GCOV_PROVISIONAL_V1%2FNISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223637_20260619T22371
HTTP Basic: Access denied.

== QA_SUMMARY.csv no auth
HTTP/2 302 
location: https://urs.earthdata.nasa.gov/oauth/authorize?client_id=qpa3q_b7OJ32gGjwA9DxHg&response_type=code&redirect_uri=https://nisar.asf.earthdatacloud.nasa.gov/login&state=%2FNISAR%2FNISAR_L2_GCOV
== browse png, follow
final_code=200 size=4080968 speed=2789932B/s time=1.462748s ct=binary/octet-stream redirects=1
browse.png: PNG image data, 1880 x 1847, 8-bit/color RGB, non-interlaced
````

### 8.4 Sketch D5 and the Section 6.3 encoding on synthetic data

File: `<scratch>/review/cold-read-coding-agent/py/test_d5.py` (attempt 2). The `cog_translate` call is the brief's sketch D5 unchanged. It needs `numpy`, `rasterio`, `rio-cogeo`.

````python
"""Throwaway check of sketch D5 and the Section 6.3 encoding on synthetic speckle. Not project code."""
import sys, time, inspect, os
import numpy as np, rasterio
from rasterio.transform import from_origin
from rio_cogeo.cogeo import cog_translate, cog_validate
from rio_cogeo.profiles import cog_profiles
import rio_cogeo
print("rio_cogeo", rio_cogeo.__version__, "rasterio", rasterio.__version__, "gdal", rasterio.__gdal_version__)
print("cog_translate params:", list(inspect.signature(cog_translate).parameters))
out = sys.argv[1]
rng = np.random.default_rng(0)
N = 2500                                   # 2500 x 2500 px at 40 m = 100 x 100 km
# synthetic gamma0: smooth "scene" (three surface classes) times multi-look speckle (16 looks -> ~1.1 dB sd)
yy, xx = np.mgrid[0:N, 0:N]
scene_db = -12 + 5 * np.sin(xx / 300.0) * np.cos(yy / 420.0)
scene_db[(xx - 1200) ** 2 + (yy - 1300) ** 2 < 350 ** 2] = -24          # "open water"
lin = (10 ** (scene_db / 10) * rng.gamma(16.0, 1 / 16.0, (N, N))).astype("float32")
lin[:, :120] = np.nan; lin[:80, :] = np.nan                                # nodata collar
db = 10 * np.log10(lin)
lo, hi = -25.0, 0.0
enc = np.where(np.isfinite(db), np.clip(1 + np.round(254 * (db - lo) / (hi - lo)), 1, 255), 0).astype("uint8")
src = f"{out}/src_utm.tif"
prof = dict(driver="GTiff", height=N, width=N, count=1, dtype="uint8", crs="EPSG:32648",
            transform=from_origin(400000, 1450000, 40, 40), nodata=0, tiled=True, compress="deflate")
with rasterio.open(src, "w", **prof) as d:
    d.write(enc, 1)
    d.update_tags(AI_ASSISTED="yes", SOFTWARE_NOTE="processing code written with AI assistance; see AI_USE.md")
dst = f"{out}/dst_cog.tif"
t = time.time()
# ---- the call exactly as written in the brief's D5
cog_translate(src, dst, cog_profiles.get("deflate"), web_optimized=True, nodata=0,
              overview_resampling="average", in_memory=False)
print("cog_translate ok in %.1fs" % (time.time() - t))
with rasterio.open(dst) as d:
    print("crs", d.crs, "dtype", d.dtypes, "nodata", d.nodata, "size", d.width, "x", d.height, "res", [round(r, 2) for r in d.res],
          "overviews", d.overviews(1), "block", d.block_shapes, "compress", d.profile.get("compress"))
    a = d.read(1)
    print("zeros %", round(100 * (a == 0).mean(), 1), "min nonzero", a[a > 0].min(), "max", a.max())
    print("tags survive cog_translate:", d.tags())
    npx = int((a > 0).sum())
print("validate:", cog_validate(dst)[0])
sz = os.path.getsize(dst)
print(f"file {sz/1e6:.2f} MB for {npx/1e6:.2f} M valid px (plus overviews) -> {sz/npx:.2f} bytes per valid full-res pixel; src deflate {os.path.getsize(src)/1e6:.2f} MB")
# what resampling did the warp use, and what do averaged overviews do to the dark target?
with rasterio.open(dst) as d:
    ov = d.read(1, out_shape=(d.height // 8, d.width // 8))   # reads an overview level
    full = d.read(1).astype(float); full[full == 0] = np.nan
print("dB of 'water' disc centre, full-res mean of codes -> dB:", round(lo + (np.nanmean(full[full.shape[0]//2-20:full.shape[0]//2+20, full.shape[1]//2-60:full.shape[1]//2-20]) - 1) * (hi - lo) / 254, 2))
# compare: mean of dB (what averaging 8-bit codes does) vs dB of mean power (what Section 5 asks for), for 16-look speckle
x = rng.gamma(16.0, 1 / 16.0, 10_000_000)
print("16 looks: 10log10(mean power) - mean(10log10 power) = %.2f dB" % (10 * np.log10(x.mean()) - (10 * np.log10(x)).mean()))
x = rng.gamma(4.0, 1 / 4.0, 10_000_000)
print(" 4 looks: 10log10(mean power) - mean(10log10 power) = %.2f dB" % (10 * np.log10(x.mean()) - (10 * np.log10(x)).mean()))
# mixed pixel: half water (-24 dB) half flooded vegetation (-6 dB)
p = np.array([10 ** (-24 / 10), 10 ** (-6 / 10)])
print("mixed water/bright pixel: dB of mean power %.1f vs mean of dB %.1f" % (10 * np.log10(p.mean()), np.mean([-24, -6])))
````

Invocation and output (attempt 2, tool call 39; warning lines were filtered out by the `grep`):

````bash
./venv/bin/python test_d5.py out 2>&1 | grep -v -i "warning" | tail -22
````

````text
  cog_translate(src, dst, cog_profiles.get("deflate"), web_optimized=True, nodata=0,
Reading input: out/src_utm.tif

Adding overviews...
Updating dataset tags...
Writing output to: out/dst_cog.tif
rio_cogeo 7.0.4 rasterio 1.5.2 gdal 3.12.2
cog_translate params: ['source', 'dst_path', 'dst_kwargs', 'indexes', 'nodata', 'dtype', 'add_mask', 'overview_level', 'overview_resampling', 'web_optimized', 'tms', 'zoom_level_strategy', 'zoom_level', 'aligned_levels', 'resampling', 'in_memory', 'config', 'allow_intermediate_compression', 'forward_band_tags', 'forward_ns_tags', 'quiet', 'progress_out', 'temporary_compression', 'colormap', 'additional_cog_metadata', 'use_cog_driver', 'decimation_base']
cog_translate ok in 0.4s
crs EPSG:3857 dtype ('uint8',) nodata 0.0 size 2816 x 3072 res [38.22, 38.22] overviews [2, 4, 8] block [(512, 512)] compress deflate
zeros % 22.9 min nonzero 1 max 222
tags survive cog_translate: {'AI_ASSISTED': 'yes', 'OVERVIEW_RESAMPLING': 'AVERAGE', 'SOFTWARE_NOTE': 'processing code written with AI assistance; see AI_USE.md', 'TILING_SCHEME_NAME': 'WebMercatorQuad', 'TILING_SCHEME_ZOOM_LEVEL': '12', 'AREA_OR_POINT': 'Area'}
validate: True
file 6.25 MB for 6.67 M valid px (plus overviews) -> 0.94 bytes per valid full-res pixel; src deflate 4.20 MB
dB of 'water' disc centre, full-res mean of codes -> dB: -23.95
16 looks: 10log10(mean power) - mean(10log10 power) = 0.14 dB
 4 looks: 10log10(mean power) - mean(10log10 power) = 0.57 dB
mixed water/bright pixel: dB of mean power -8.9 vs mean of dB -15.0
````

Earlier, shorter version: `<scratch>/review/cold-read/d5/test_d5.py` (attempt 1), which also ran the `rio cogeo validate` command and shows the deprecation warning.

````python
"""Throwaway check of sketch D5 and the 6.3 encoding on synthetic data. Not project code."""
import sys, time, inspect
import numpy as np, rasterio
from rasterio.transform import from_origin
from rio_cogeo.cogeo import cog_translate, cog_validate
from rio_cogeo.profiles import cog_profiles
import rio_cogeo
print("rio_cogeo", rio_cogeo.__version__, "rasterio", rasterio.__version__, "gdal", rasterio.__gdal_version__)
print("cog_translate params:", list(inspect.signature(cog_translate).parameters))
out = sys.argv[1]
rng = np.random.default_rng(0)
# synthetic gamma0 in linear power, 2000 x 2000 at 20 m in UTM 48N, with a NaN collar
lin = rng.gamma(4.0, 0.02, (2000, 2000)).astype("float32")
lin[:, :150] = np.nan; lin[:100, :] = np.nan
db = 10 * np.log10(lin)
lo, hi = -25.0, 0.0
enc = np.where(np.isfinite(db), np.clip(1 + np.round(254 * (db - lo) / (hi - lo)), 1, 255), 0).astype("uint8")
src = f"{out}/src_utm.tif"
prof = dict(driver="GTiff", height=2000, width=2000, count=1, dtype="uint8", crs="EPSG:32648",
            transform=from_origin(400000, 1450000, 20, 20), nodata=0, tiled=True, compress="deflate")
with rasterio.open(src, "w", **prof) as d: d.write(enc, 1)
dst = f"{out}/dst_cog.tif"
t = time.time()
cog_translate(src, dst, cog_profiles.get("deflate"), web_optimized=True, nodata=0,
              overview_resampling="average", in_memory=False, quiet=True)
print("cog_translate ok in %.1fs" % (time.time() - t))
with rasterio.open(dst) as d:
    print("crs", d.crs, "dtype", d.dtypes, "nodata", d.nodata, "size", d.width, d.height, "res", d.res,
          "overviews", d.overviews(1), "block", d.block_shapes, "interleave", d.profile.get("interleave"))
    a = d.read(1)
    print("zeros %", round(100 * (a == 0).mean(), 1), "min nonzero", a[a > 0].min(), "max", a.max())
    print("tags", d.tags())
print("validate:", cog_validate(dst))
````

````bash
./venv/bin/python d5/test_d5.py d5 2>&1 | tail -20; ./venv/bin/rio cogeo validate d5/dst_cog.tif 2>&1 | tail -3; ls -la d5/*.tif | awk '{print $5, $9}'
````

````text
<scratch>/review/cold-read/d5/test_d5.py:24: DeprecationWarning: 'web_optomized' option is deprecated and will be removed in 6.0. Please use the `tms` option
  cog_translate(src, dst, cog_profiles.get("deflate"), web_optimized=True, nodata=0,
rio_cogeo 7.0.4 rasterio 1.5.2 gdal 3.12.2
cog_translate params: ['source', 'dst_path', 'dst_kwargs', 'indexes', 'nodata', 'dtype', 'add_mask', 'overview_level', 'overview_resampling', 'web_optimized', 'tms', 'zoom_level_strategy', 'zoom_level', 'aligned_levels', 'resampling', 'in_memory', 'config', 'allow_intermediate_compression', 'forward_band_tags', 'forward_ns_tags', 'quiet', 'progress_out', 'temporary_compression', 'colormap', 'additional_cog_metadata', 'use_cog_driver', 'decimation_base']
cog_translate ok in 0.4s
crs EPSG:3857 dtype ('uint8',) nodata 0.0 size 2304 2560 res (19.109257071294063, 19.109257071294063) overviews [2, 4, 8] block [(512, 512)] interleave band
zeros % 30.8 min nonzero 1 max 222
tags {'OVERVIEW_RESAMPLING': 'AVERAGE', 'TILING_SCHEME_NAME': 'WebMercatorQuad', 'TILING_SCHEME_ZOOM_LEVEL': '13', 'AREA_OR_POINT': 'Area'}
validate: (True, [], [])
<scratch>/review/cold-read/d5/dst_cog.tif is a valid cloud optimized GeoTIFF
4163615 d5/dst_cog.tif
2931493 d5/src_utm.tif
````

### 8.5 Range requests: Vite dev, Vite preview, Python http.server

Attempt 2, tool call 50 (project folder `<scratch>/review/cold-read-coding-agent/web/range`):

````bash
W=<scratch>/review/cold-read-coding-agent; mkdir -p "$W/web/range/public" && cd "$W/web/range" && npm init -y >/dev/null 2>&1 && npm install --no-audit --no-fund vite@8.3.8 2>&1 | tail -1 && printf '<!doctype html><html><body><script type="module">console.log(1)</script></body></html>' > index.html && head -c 300000 /dev/urandom > public/blob.bin && npx vite build 2>&1 | tail -2; (npx vite --port 5311 --strictPort --host 127.0.0.1 > dev.log 2>&1 & echo $! > dev.pid); (npx vite preview --port 5312 --strictPort --host 127.0.0.1 > prev.log 2>&1 & echo $! > prev.pid); (cd public && /opt/anaconda3/bin/python3 -m http.server 5313 --bind 127.0.0.1 > ../py.log 2>&1 & echo $! > ../py.pid); sleep 4; for port in 5311 5312 5313; do case $port in 5311) n="vite dev    ";; 5312) n="vite preview";; 5313) n="python http.server";; esac; echo "== $n  brief's command: curl -r 0-99 -I"; /usr/bin/curl -s -r 0-99 -I "http://127.0.0.1:$port/blob.bin" | grep -i -E "^HTTP|content-range|content-length|accept-ranges" | tr -d '\r' | paste -sd' ' -; echo "   GET with Range:"; /usr/bin/curl -s -r 0-99 -o /dev/null -w "   http=%{http_code} bytes=%{size_download}\n" "http://127.0.0.1:$port/blob.bin"; done; for f in dev.pid prev.pid py.pid; do kill "$(cat $f)" 2>/dev/null; done; sleep 1; pkill -f "vite --port 5311" 2>/dev/null; pkill -f "vite preview --port 5312" 2>/dev/null; pkill -f "http.server 5313" 2>/dev/null; echo done
````

````text
added 15 packages in 2s

✓ built in 27ms
== vite dev      brief's command: curl -r 0-99 -I
HTTP/1.1 206 Partial Content Content-Length: 100 Content-Range: bytes 0-99/300000 Accept-Ranges: bytes
   GET with Range:
   http=206 bytes=100
== vite preview  brief's command: curl -r 0-99 -I
HTTP/1.1 206 Partial Content Content-Length: 100 Content-Range: bytes 0-99/300000 Accept-Ranges: bytes
   GET with Range:
   http=206 bytes=100
== python http.server  brief's command: curl -r 0-99 -I
HTTP/1.0 200 OK Content-Length: 300000
   GET with Range:
   http=200 bytes=300000
done
````

Attempt 1 ran the same test with a 1 MiB file and got the same three answers (tool call 26):

````text
== vite dev: HEAD with Range (the brief's command: curl -r 0-99 -I)
HTTP/1.1 206 Partial Content
Content-Length: 100
Content-Range: bytes 0-99/1048576
Accept-Ranges: bytes
== vite dev: GET with Range
HTTP/1.1 206 Partial Content
Content-Length: 100
Content-Range: bytes 0-99/1048576
Accept-Ranges: bytes
== vite preview: HEAD with Range
HTTP/1.1 206 Partial Content
Content-Length: 100
Content-Range: bytes 0-99/1048576
Accept-Ranges: bytes
== vite preview: GET with Range
HTTP/1.1 206 Partial Content
Content-Length: 100
Content-Range: bytes 0-99/1048576
Accept-Ranges: bytes
== python http.server: GET with Range
HTTP/1.0 200 OK
Content-Length: 1048576
done
````

### 8.6 Sketch D4 followed literally on a downloaded preview PNG

Attempt 2, tool call 51. It needs Pillow and numpy (it used the Anaconda Python, which has both) and `browse.png` from Section 8.7. The polygon string is the granule's CMR polygon (lat lon pairs).

````bash
W=<scratch>/review/cold-read-coding-agent; cd "$W/net" && /opt/anaconda3/bin/python3 - <<'EOF'
# Throwaway: follow sketch D4 literally on the 2026-06-19 browse PNG of stack 083_A_008.
from PIL import Image
import numpy as np
a=np.asarray(Image.open('browse.png').convert('RGB')); H,W=a.shape[:2]
nb=a.any(axis=2)
cols=np.where(nb.any(axis=0))[0]; rows=np.where(nb.any(axis=1))[0]
xl,xr,yt,yb=cols[0],cols[-1],rows[0],rows[-1]
poly="12.07019 105.39936 14.15457 104.89399 13.61372 102.62722 11.53813 103.14859 12.07019 105.39936".split()
lats=list(map(float,poly[0::2])); lons=list(map(float,poly[1::2]))
lon_min,lon_max,lat_min,lat_max=min(lons),max(lons),min(lats),max(lats)
dlon=(lon_max-lon_min)/(xr-xl); west=lon_min-xl*dlon; east=west+W*dlon
dlat=(lat_max-lat_min)/(yb-yt); north=lat_max+yt*dlat; south=north-H*dlat
print('image',W,H,'footprint cols',xl,xr,'rows',yt,yb,'non-black fraction %.3f'%nb.mean())
print('D4 result: west %.4f east %.4f north %.4f south %.4f'%(west,east,north,south))
print('brief says: west 102.3865 east 105.5270 north 14.3420 south 11.3330')
print('deg per px: lon %.6f lat %.6f  -> approx %.0f m'%(dlon,dlat,dlat*111320))
# interior black pixels (open water) that a "make black transparent" step would punch out
inside=np.zeros_like(nb); 
from PIL import ImageDraw
im=Image.new('1',(W,H),0)
# footprint polygon in pixel coords from the CMR polygon
px=[((lo-west)/dlon,(north-la)/dlat) for la,lo in zip(lats,lons)]
ImageDraw.Draw(im).polygon(px,fill=1); inside=np.asarray(im).astype(bool)
print('black pixels inside the footprint polygon: %.2f%% of footprint (these become holes if all black is made transparent)'%(100*(~nb & inside).sum()/inside.sum()))
EOF
````

````text
image 1880 1847 footprint cols 144 1804 rows 115 1721 non-black fraction 0.528
D4 result: west 102.3867 east 105.5263 north 14.3419 south 11.3329
brief says: west 102.3865 east 105.5270 north 14.3420 south 11.3330
deg per px: lon 0.001670 lat 0.001629  -> approx 181 m
black pixels inside the footprint polygon: 0.05% of footprint (these become holes if all black is made transparent)
````

### 8.7 GIBS tiles: status codes, stability check, time domain

First look, 13 Nov 21:01 CST (attempt 1, tool call 16); also fetches the keyless basemap style:

````bash
cd <scratch>/review/cold-read && T='https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/NISAR_L2_Geocoded_Polarimetric_Covariance/default' && for d in 2026-06-19 2026-06-20 2026-10-17 2026-08-01 2026-11-12 2027-01-01; do /usr/bin/curl -sS -A "tile-check" -o tile_$d.png -w "$d code=%{http_code} size=%{size_download} ct=%{content_type}\n" "$T/$d/GoogleMapsCompatible_Level13/8/118/201.png"; done; echo "== z14 (over max)"; /usr/bin/curl -sS -A "tile-check" -o /dev/null -w "z14 code=%{http_code} size=%{size_download}\n" "$T/2026-06-19/GoogleMapsCompatible_Level13/14/7600/12900.png"; echo "== headers"; /usr/bin/curl -sS -A "tile-check" -o /dev/null -D - "$T/2026-06-19/GoogleMapsCompatible_Level13/8/118/201.png" | grep -i -E '^HTTP|cache-control|access-control|content-type'; echo "== openfreemap"; /usr/bin/curl -sS -A "style-check" -o ofm.json -w "code=%{http_code} size=%{size_download} ct=%{content_type}\n" https://tiles.openfreemap.org/styles/liberty; /opt/anaconda3/bin/python3 -c "
import json;d=json.load(open('ofm.json'));print(d.get('version'), list(d.get('sources',{}).keys()), d.get('glyphs'), d.get('sprite'))"
````

````text
2026-06-19 code=200 size=138873 ct=image/png
2026-06-20 code=200 size=288 ct=image/png
2026-10-17 code=200 size=146467 ct=image/png
2026-08-01 code=404 size=196 ct=text/html; charset=iso-8859-1
2026-11-12 code=404 size=196 ct=text/html; charset=iso-8859-1
2027-01-01 code=404 size=196 ct=text/html; charset=iso-8859-1
== z14 (over max)
z14 code=400 size=226
== headers
HTTP/2 200 
content-type: image/png
cache-control: max-age=0, no-store, no-cache, must-revalidate
access-control-expose-headers: layer-identifier-request, layer-identifier-actual, layer-time-request, layer-time-actual
access-control-allow-origin: *
x-content-type-options: nosniff
== openfreemap
code=200 size=43311 ct=application/json
8 ['ne2_shaded', 'openmaptiles'] https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf https://tiles.openfreemap.org/sprites/ofm_f384/ofm
````

Second look, 14 Nov 01:51 CST (attempt 2, tool call 22): tile for the sample point at z9, the data URL without login, the preview PNG.

````bash
W=<scratch>/review/cold-read-coding-agent; cd "$W/net"; 
# tile z/y/x for lon 104.05 lat 12.95 at z=9
/opt/anaconda3/bin/python3 -c "
import math
lon,lat,z=104.05,12.95,9
n=2**z; x=int((lon+180)/360*n); y=int((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*n); print(z,y,x)" > zyx.txt; read Z Y X < zyx.txt; echo "z/y/x = $Z/$Y/$X";
for d in 2026-10-17 2026-10-18 2026-10-29 2026-08-01 2026-11-12; do
  /usr/bin/curl -s -o "tile_$d.png" -w "$d  http=%{http_code} bytes=%{size_download} type=%{content_type}\n" "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/NISAR_L2_Geocoded_Polarimetric_Covariance/default/$d/GoogleMapsCompatible_Level13/$Z/$Y/$X.png"; done
echo "== headers of one tile"; /usr/bin/curl -s -D - -o /dev/null "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/NISAR_L2_Geocoded_Polarimetric_Covariance/default/2026-10-17/GoogleMapsCompatible_Level13/$Z/$Y/$X.png" | grep -i -E "^(HTTP|cache-control|access-control|content-type|content-length)"
echo "== data URL without login (what an agent sees when credentials are missing)"
U="https://nisar.asf.earthdatacloud.nasa.gov/NISAR/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223637_20260619T223711_P05023_N_F_J_001/NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223637_20260619T223711_P05023_N_F_J_001.h5"
/usr/bin/curl -s -r 0-7 -o probe_nologin.bin -D hdr_nologin.txt -w "no-follow: http=%{http_code} bytes=%{size_download} redirect=%{redirect_url}\n" "$U" | cut -c1-300
/usr/bin/curl -s -L -r 0-7 -o probe_nologin_follow.bin -w "follow:    http=%{http_code} bytes=%{size_download} final=%{url_effective}\n" "$U" | cut -c1-300
echo "-- body (first 200 bytes) when following redirects:"; head -c 200 probe_nologin_follow.bin | LC_ALL=C tr -c '[:print:]\n' '.'; echo
echo "== browse PNG without login"
B="https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223637_20260619T223711_P05023_N_F_J_001/NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223637_20260619T223711_P05023_N_F_J_001_LATLON.png"
/usr/bin/curl -s -L -o browse.png -w "browse: http=%{http_code} bytes=%{size_download} type=%{content_type} redirects=%{num_redirects} time=%{time_total}s speed=%{speed_download}B/s\n" "$B"; file browse.png | cut -c1-120
````

````text
z/y/x = 9/237/403
2026-10-17  http=200 bytes=198271 type=image/png
2026-10-18  http=200 bytes=288 type=image/png
2026-10-29  http=500 bytes=527 type=text/html; charset=iso-8859-1
2026-08-01  http=404 bytes=196 type=text/html; charset=iso-8859-1
2026-11-12  http=404 bytes=196 type=text/html; charset=iso-8859-1
== headers of one tile
HTTP/2 200 
content-type: image/png
content-length: 50911
cache-control: max-age=0, no-store, no-cache, must-revalidate
access-control-expose-headers: layer-identifier-request, layer-identifier-actual, layer-time-request, layer-time-actual
access-control-allow-origin: *
== data URL without login (what an agent sees when credentials are missing)
no-follow: http=302 bytes=0 redirect=https://urs.earthdata.nasa.gov/oauth/authorize?client_id=qpa3q_b7OJ32gGjwA9DxHg&response_type=code&redirect_uri=https://nisar.asf.earthdatacloud.nasa.gov/login&state=%2FNISAR%2FNISAR_L2_GCOV_PROVISIONAL_V1%2FNISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223
follow:    http=401 bytes=27 final=https://urs.earthdata.nasa.gov/oauth/authorize?client_id=qpa3q_b7OJ32gGjwA9DxHg&response_type=code&redirect_uri=https://nisar.asf.earthdatacloud.nasa.gov/login&state=%2FNISAR%2FNISAR_L2_GCOV_PROVISIONAL_V1%2FNISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T22363
-- body (first 200 bytes) when following redirects:
HTTP Basic: Access denied.

== browse PNG without login
browse: http=200 bytes=4080968 type=binary/octet-stream redirects=1 time=1.341622s speed=3041816B/s
browse.png: PNG image data, 1880 x 1847, 8-bit/color RGB, non-interlaced
````

Retries and the layer's time domain (attempt 2, tool call 23):

````bash
W=<scratch>/review/cold-read-coding-agent; cd "$W/net"; echo "== 500 body"; cat tile_2026-10-29.png | head -c 600; echo; echo "== retries of 2026-10-29 at several zooms"; for i in 1 2 3; do /usr/bin/curl -s -o /dev/null -w "z9 try$i http=%{http_code} bytes=%{size_download}\n" "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/NISAR_L2_Geocoded_Polarimetric_Covariance/default/2026-10-29/GoogleMapsCompatible_Level13/9/237/403.png"; done; /usr/bin/curl -s -o /dev/null -w "z8 http=%{http_code} bytes=%{size_download}\n" "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/NISAR_L2_Geocoded_Polarimetric_Covariance/default/2026-10-29/GoogleMapsCompatible_Level13/8/118/201.png"; /usr/bin/curl -s -o /dev/null -w "z10 http=%{http_code} bytes=%{size_download}\n" "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/NISAR_L2_Geocoded_Polarimetric_Covariance/default/2026-10-29/GoogleMapsCompatible_Level13/10/474/807.png"; /usr/bin/curl -s -o /dev/null -w "z7 http=%{http_code} bytes=%{size_download}\n" "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/NISAR_L2_Geocoded_Polarimetric_Covariance/default/2026-10-29/GoogleMapsCompatible_Level13/7/59/100.png"; echo "== other validated-era pass dates at this tile (148_D_082: 10-22, 11-03)"; for d in 2026-10-22 2026-11-03 2026-10-05 2026-06-19; do /usr/bin/curl -s -o /dev/null -w "$d z9 http=%{http_code} bytes=%{size_download}\n" "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/NISAR_L2_Geocoded_Polarimetric_Covariance/default/$d/GoogleMapsCompatible_Level13/9/237/403.png"; done; echo "== capabilities time dimension for the layer"; /usr/bin/curl -s "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml" -o caps.xml -w "caps http=%{http_code} bytes=%{size_download}\n"; /opt/anaconda3/bin/python3 - <<'EOF'
import re
s=open('<scratch>/review/cold-read-coding-agent/net/caps.xml',encoding='utf-8',errors='replace').read()
i=s.find('<ows:Identifier>NISAR_L2_Geocoded_Polarimetric_Covariance</ows:Identifier>')
print('found at',i)
j=s.rfind('<Layer>',0,i); k=s.find('</Layer>',i)
blk=s[j:k]
for tag in ('ows:Title','Default','Value','TileMatrixSet>','Format'):
    for m in re.finditer(r'<%s[^>]*>([^<]*)<'%tag.rstrip('>'), blk):
        print(tag, m.group(1)[:200])
EOF
````

````text
== 500 body
<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN">
<html><head>
<title>500 Internal Server Error</title>
</head><body>
<h1>Internal Server Error</h1>
<p>The server encountered an internal error or
misconfiguration and was unable to complete
your request.</p>
<p>Please contact the server administrator at 
 root@localhost to inform them of the time this error occurred,
 and the actions you performed just before this error.</p>
<p>More information about this error may be available
in the server error log.</p>
</body></html>

== retries of 2026-10-29 at several zooms
z9 try1 http=200 bytes=44443
z9 try2 http=200 bytes=44443
z9 try3 http=200 bytes=200876
z8 http=200 bytes=143297
z10 http=200 bytes=85011
z7 http=200 bytes=113142
== other validated-era pass dates at this tile (148_D_082: 10-22, 11-03)
2026-10-22 z9 http=200 bytes=86206
2026-11-03 z9 http=200 bytes=83837
2026-10-05 z9 http=200 bytes=49161
2026-06-19 z9 http=200 bytes=242672
== capabilities time dimension for the layer
caps http=200 bytes=5842320
found at 2916271
ows:Title NISAR Normalized Radar Backscatter (False Color, GCOV, Best)
ows:Title default
Default 2026-11-11
Value 2025-10-29/2026-03-01/P1D
Value 2026-03-04/2026-03-29/P1D
Value 2026-04-01/2026-04-12/P1D
Value 2026-04-14/2026-07-27/P1D
Value 2026-08-10/2026-11-11/P1D
TileMatrixSet> 
Format image/png
````

Same tile, eight requests each on three dates (attempt 2, tool call 24):

````bash
W=<scratch>/review/cold-read-coding-agent; mkdir -p "$W/net/rep" && cd "$W/net/rep"; for d in 2026-10-17 2026-10-29 2026-06-19; do echo "== $d z9/237/403, 8 requests"; for i in 1 2 3 4 5 6 7 8; do /usr/bin/curl -s -o "t_${d}_$i.png" -w "%{http_code} %{size_download} " "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/NISAR_L2_Geocoded_Polarimetric_Covariance/default/$d/GoogleMapsCompatible_Level13/9/237/403.png"; md5 -q "t_${d}_$i.png"; done; done
````

````text
== 2026-10-17 z9/237/403, 8 requests
200 200907 2376a6d99217306cf0357647dbc5bb84
200 192616 059921acc08af32b0881d70aa586e3d8
200 50656 00c4c83aa8a481b87b44039239d6d97c
200 50911 992fcbb59b9ad70f754ce6b637c1b937
200 249248 c3afe9a8a66ed1a3fe548bd79c27f125
200 188510 149533aa7fbdef4aaffe1255113b340e
200 50657 d5a667b5cae13f156699456ea093c382
200 201404 1c8732eab15a040a276409ba3dbd8125
== 2026-10-29 z9/237/403, 8 requests
200 44188 d5c0056aff6361aa9c1e607315180fe5
200 44188 d5c0056aff6361aa9c1e607315180fe5
200 203511 59148dc3651c657b8757cf3a074ec213
200 44189 8b698672ee034a05116350e90d17b39a
200 44189 8b698672ee034a05116350e90d17b39a
200 44188 d5c0056aff6361aa9c1e607315180fe5
200 44188 d5c0056aff6361aa9c1e607315180fe5
200 204228 bf0a4de9969b180d3f23f192fe6ec489
== 2026-06-19 z9/237/403, 8 requests
200 120471 4cad3ce03e5df659766d19c13d6296d1
200 195987 6c421564e0635dc1d19e06352c9a4d51
200 120471 4cad3ce03e5df659766d19c13d6296d1
200 49681 55fe4ba2946e0431f6b187112e3fe877
200 49680 b9dc0626a38d43e0293dac0f647ab864
200 120471 4cad3ce03e5df659766d19c13d6296d1
200 49935 f6975bf536ea8f31ad3fd374908b1639
200 49681 55fe4ba2946e0431f6b187112e3fe877
````

Pixel comparison of those downloads (attempt 2, tool call 25; it also wrote the side-by-side images `variants_1017.png` and `variants_0619.png` in `<scratch>/review/cold-read-coding-agent/net/rep/`):

````bash
W=<scratch>/review/cold-read-coding-agent; cd "$W/net/rep"; /opt/anaconda3/bin/python3 - <<'EOF'
import glob, os
from PIL import Image
import numpy as np
base=os.getcwd()
for d in ('2026-10-17','2026-10-29','2026-06-19'):
    print('==',d)
    ref=None
    for f in sorted(glob.glob(f't_{d}_*.png')):
        im=Image.open(f); a=np.asarray(im.convert('RGBA')).astype(int)
        alpha0=(a[...,3]==0).mean()
        desc=f"{f} mode={im.mode} size={im.size} bytes={os.path.getsize(f)} transparent={alpha0:.2%} meanRGB={a[...,:3].reshape(-1,3).mean(0).round(1).tolist()}"
        if ref is None: ref=a
        else: desc+=f" maxabsdiff_vs_first={np.abs(a-ref).max()} frac_px_diff={(np.abs(a-ref).sum(-1)>0).mean():.2%}"
        print(desc)
# make a side by side of the three distinct variants on 2026-10-17
ims=[Image.open(f't_2026-10-17_{i}.png').convert('RGBA') for i in (1,3,5)]
W=sum(i.width for i in ims)+20; canvas=Image.new('RGBA',(W,ims[0].height),(255,0,255,255)); x=0
for i in ims: canvas.paste(i,(x,0)); x+=i.width+10
canvas.save('variants_1017.png')
ims=[Image.open(f't_2026-06-19_{i}.png').convert('RGBA') for i in (1,2,4)]
canvas=Image.new('RGBA',(W,ims[0].height),(255,0,255,255)); x=0
for i in ims: canvas.paste(i,(x,0)); x+=i.width+10
canvas.save('variants_0619.png')
EOF
````

````text
== 2026-10-17
t_2026-10-17_1.png mode=RGBA size=(256, 256) bytes=200907 transparent=0.78% meanRGB=[53.8, 114.8, 53.0]
t_2026-10-17_2.png mode=RGBA size=(256, 256) bytes=192616 transparent=0.78% meanRGB=[76.9, 77.0, 76.0] maxabsdiff_vs_first=245 frac_px_diff=24.22%
t_2026-10-17_3.png mode=P size=(256, 256) bytes=50656 transparent=0.00% meanRGB=[0.0, 0.0, 0.0] maxabsdiff_vs_first=255 frac_px_diff=100.00%
t_2026-10-17_4.png mode=P size=(256, 256) bytes=50911 transparent=100.00% meanRGB=[0.0, 0.0, 0.0] maxabsdiff_vs_first=255 frac_px_diff=100.00%
t_2026-10-17_5.png mode=RGBA size=(256, 256) bytes=249248 transparent=1.77% meanRGB=[82.7, 83.0, 81.9] maxabsdiff_vs_first=255 frac_px_diff=24.22%
t_2026-10-17_6.png mode=RGBA size=(256, 256) bytes=188510 transparent=24.73% meanRGB=[53.2, 53.3, 52.3] maxabsdiff_vs_first=255 frac_px_diff=24.22%
t_2026-10-17_7.png mode=P size=(256, 256) bytes=50657 transparent=0.20% meanRGB=[0.0, 0.0, 0.0] maxabsdiff_vs_first=255 frac_px_diff=100.00%
t_2026-10-17_8.png mode=RGBA size=(256, 256) bytes=201404 transparent=7.41% meanRGB=[89.0, 85.7, 88.5] maxabsdiff_vs_first=255 frac_px_diff=24.22%
== 2026-10-29
t_2026-10-29_1.png mode=P size=(256, 256) bytes=44188 transparent=0.00% meanRGB=[0.0, 0.0, 0.0]
t_2026-10-29_2.png mode=P size=(256, 256) bytes=44188 transparent=0.00% meanRGB=[0.0, 0.0, 0.0] maxabsdiff_vs_first=0 frac_px_diff=0.00%
t_2026-10-29_3.png mode=RGBA size=(256, 256) bytes=203511 transparent=18.03% meanRGB=[64.4, 60.8, 63.3] maxabsdiff_vs_first=255 frac_px_diff=100.00%
t_2026-10-29_4.png mode=P size=(256, 256) bytes=44189 transparent=0.63% meanRGB=[0.0, 0.0, 0.0] maxabsdiff_vs_first=255 frac_px_diff=0.63%
t_2026-10-29_5.png mode=P size=(256, 256) bytes=44189 transparent=0.63% meanRGB=[0.0, 0.0, 0.0] maxabsdiff_vs_first=255 frac_px_diff=0.63%
t_2026-10-29_6.png mode=P size=(256, 256) bytes=44188 transparent=0.00% meanRGB=[0.0, 0.0, 0.0] maxabsdiff_vs_first=0 frac_px_diff=0.00%
t_2026-10-29_7.png mode=P size=(256, 256) bytes=44188 transparent=0.00% meanRGB=[0.0, 0.0, 0.0] maxabsdiff_vs_first=0 frac_px_diff=0.00%
t_2026-10-29_8.png mode=RGBA size=(256, 256) bytes=204228 transparent=0.78% meanRGB=[90.7, 96.9, 97.4] maxabsdiff_vs_first=255 frac_px_diff=100.00%
== 2026-06-19
t_2026-06-19_1.png mode=LA size=(256, 256) bytes=120471 transparent=0.00% meanRGB=[79.0, 79.0, 79.0]
t_2026-06-19_2.png mode=RGBA size=(256, 256) bytes=195987 transparent=20.68% meanRGB=[61.0, 61.0, 60.0] maxabsdiff_vs_first=242 frac_px_diff=100.00%
t_2026-06-19_3.png mode=LA size=(256, 256) bytes=120471 transparent=0.00% meanRGB=[79.0, 79.0, 79.0] maxabsdiff_vs_first=0 frac_px_diff=0.00%
t_2026-06-19_4.png mode=P size=(256, 256) bytes=49681 transparent=0.29% meanRGB=[0.0, 0.0, 0.0] maxabsdiff_vs_first=254 frac_px_diff=100.00%
t_2026-06-19_5.png mode=P size=(256, 256) bytes=49680 transparent=0.00% meanRGB=[0.0, 0.0, 0.0] maxabsdiff_vs_first=254 frac_px_diff=100.00%
t_2026-06-19_6.png mode=LA size=(256, 256) bytes=120471 transparent=0.00% meanRGB=[79.0, 79.0, 79.0] maxabsdiff_vs_first=0 frac_px_diff=0.00%
t_2026-06-19_7.png mode=P size=(256, 256) bytes=49935 transparent=100.00% meanRGB=[0.0, 0.0, 0.0] maxabsdiff_vs_first=237 frac_px_diff=100.00%
t_2026-06-19_8.png mode=P size=(256, 256) bytes=49681 transparent=0.29% meanRGB=[0.0, 0.0, 0.0] maxabsdiff_vs_first=254 frac_px_diff=100.00%
````

Same test through `urllib`, with response headers and a MODIS control (attempt 2, tool call 31):

````bash
W=<scratch>/review/cold-read-coding-agent; cd "$W/net"; P=<scratch>/review/cold-read; /opt/anaconda3/bin/python3 - <<EOF
from PIL import Image
import numpy as np, os, urllib.request, hashlib, io
for f in ['$P/tile_2026-06-19.png','$P/tile_2026-10-17.png']:
    im=Image.open(f); a=np.asarray(im.convert('RGB')).astype(int)
    print('prior run', os.path.basename(f), im.mode, im.size, os.path.getsize(f), 'meanRGB', a.reshape(-1,3).mean(0).round(1).tolist())
Image.open('$P/tile_2026-10-17.png').convert('RGB').save('prior_1017.png')
# fetch with urllib instead of curl
u='https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/NISAR_L2_Geocoded_Polarimetric_Covariance/default/2026-10-17/GoogleMapsCompatible_Level13/9/237/403.png'
for i in range(4):
    r=urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'tile-check'}),timeout=60); b=r.read()
    im=Image.open(io.BytesIO(b)); a=np.asarray(im.convert('RGB')).astype(int)
    print('urllib', i, r.status, len(b), hashlib.md5(b).hexdigest()[:8], im.mode, 'meanRGB', a.reshape(-1,3).mean(0).round(1).tolist(), dict((k,v) for k,v in r.headers.items() if k.lower() in ('content-type','content-length','layer-time-actual','layer-identifier-actual','etag','last-modified','x-cache','via','server')))
# an established layer for comparison
u2='https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/2026-10-17/GoogleMapsCompatible_Level9/7/59/100.jpg'
for i in range(3):
    r=urllib.request.urlopen(urllib.request.Request(u2,headers={'User-Agent':'tile-check'}),timeout=60); b=r.read()
    print('modis', i, r.status, len(b), hashlib.md5(b).hexdigest()[:8])
open('modis.jpg','wb').write(b)
EOF
````

````text
/opt/anaconda3/lib/python3.12/site-packages/PIL/Image.py:1056: UserWarning: Palette images with Transparency expressed in bytes should be converted to RGBA images
  warnings.warn(
prior run tile_2026-06-19.png RGB (256, 256) 138873 meanRGB [90.6, 104.1, 38.8]
prior run tile_2026-10-17.png RGB (256, 256) 146467 meanRGB [93.4, 100.1, 50.1]
urllib 0 200 205083 c80f6efb RGBA meanRGB [90.7, 88.1, 88.7] {'Content-Type': 'image/png', 'Content-Length': '205083', 'Server': 'ServerTokens ProductOnly', 'Layer-Identifier-Actual': 'NISAR_L2_Geocoded_Polarimetric_Covariance_Provisional_v1_STD', 'Layer-Time-Actual': '2026-10-17T00:00:00Z', 'ETag': 'iamh4ofnsjjsq', 'X-Cache': 'Miss from cloudfront', 'Via': '1.1 5d2526b77825bee194092d2be11f25e8.cloudfront.net (CloudFront)'}
urllib 1 200 50911 992fcbb5 P meanRGB [0.0, 0.0, 0.0] {'Content-Type': 'image/png', 'Content-Length': '50911', 'Server': 'ServerTokens ProductOnly', 'Layer-Identifier-Actual': 'NISAR_L2_Geocoded_Polarimetric_Covariance_Provisional_v1_STD', 'Layer-Time-Actual': '2026-10-17T00:00:00Z', 'ETag': 'iamh4ofnsjjsq', 'X-Cache': 'Miss from cloudfront', 'Via': '1.1 4e57852c986c2252d34e70e1ba3c2142.cloudfront.net (CloudFront)'}
urllib 2 200 50911 992fcbb5 P meanRGB [0.0, 0.0, 0.0] {'Content-Type': 'image/png', 'Content-Length': '50911', 'Server': 'ServerTokens ProductOnly', 'Layer-Identifier-Actual': 'NISAR_L2_Geocoded_Polarimetric_Covariance_Provisional_v1_STD', 'Layer-Time-Actual': '2026-10-17T00:00:00Z', 'ETag': 'iamh4ofnsjjsq', 'X-Cache': 'Miss from cloudfront', 'Via': '1.1 4e57852c986c2252d34e70e1ba3c2142.cloudfront.net (CloudFront)'}
urllib 3 200 188309 b1ba2bba RGBA meanRGB [53.2, 53.4, 52.3] {'Content-Type': 'image/png', 'Content-Length': '188309', 'Server': 'ServerTokens ProductOnly', 'Layer-Identifier-Actual': 'NISAR_L2_Geocoded_Polarimetric_Covariance_Provisional_v1_STD', 'Layer-Time-Actual': '2026-10-17T00:00:00Z', 'ETag': 'iamh4ofnsjjsq', 'X-Cache': 'Miss from cloudfront', 'Via': '1.1 f0918630ee5f3aab0f199d1c8faeb60e.cloudfront.net (CloudFront)'}
modis 0 200 17575 0da82cdf
modis 1 200 17575 0da82cdf
modis 2 200 17575 0da82cdf
````

**Stability check across places, dates and zooms (attempt 2, tool call 32). This is the script to reuse:** change `cases` to the team's place and dates.

````bash
W=<scratch>/review/cold-read-coding-agent; mkdir -p "$W/net/scope" && cd "$W/net/scope"; /opt/anaconda3/bin/python3 - <<'EOF'
import urllib.request, hashlib, io, math, collections, time
from PIL import Image
import numpy as np, warnings
warnings.simplefilter('ignore')
def zyx(lon,lat,z):
    n=2**z; return z,int((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*n),int((lon+180)/360*n)
def get(layer,date,z,y,x,ext='png',lvl='GoogleMapsCompatible_Level13'):
    u=f'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/{layer}/default/{date}/{lvl}/{z}/{y}/{x}.{ext}'
    try:
        r=urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'tile-check'}),timeout=60); b=r.read(); return r.status,b
    except urllib.error.HTTPError as e: return e.code,e.read()
L='NISAR_L2_Geocoded_Polarimetric_Covariance'
cases=[('TonleSap',104.05,12.95,'2026-10-17'),('TonleSap',104.05,12.95,'2026-06-19'),('Chicago',-87.65,41.85,'2026-10-22'),('MexicoCity',-99.1,19.4,'2026-10-13'),('Kilauea',-155.28,19.41,'2026-10-17')]
for name,lon,lat,date in cases:
    for z in (7,9,11,13):
        _,y,x=zyx(lon,lat,z); res=[]
        for i in range(4):
            st,b=get(L,date,z,y,x)
            try:
                im=Image.open(io.BytesIO(b)); mode=im.mode
            except Exception: mode='notimg'
            res.append((st,len(b),mode,hashlib.md5(b).hexdigest()[:6]))
        distinct=len(set(r[3] for r in res))
        print(f'{name:10s} {date} z{z:<2d} {y}/{x}: distinct={distinct}/4  '+'  '.join(f'{st}:{n}:{m}' for st,n,m,_ in res))
EOF
````

````text
TonleSap   2026-10-17 z7  59/100: distinct=1/4  200:111936:RGB  200:111936:RGB  200:111936:RGB  200:111936:RGB
TonleSap   2026-10-17 z9  237/403: distinct=4/4  200:188124:RGBA  200:197677:RGBA  200:50911:P  200:215824:RGBA
TonleSap   2026-10-17 z11 949/1615: distinct=4/4  200:137008:RGBA  200:194270:RGBA  200:151422:RGBA  200:170728:RGBA
TonleSap   2026-10-17 z13 3798/6463: distinct=3/4  200:168369:RGBA  200:43636:P  200:43636:P  200:167631:RGBA
TonleSap   2026-06-19 z7  59/100: distinct=1/4  200:105388:RGB  200:105388:RGB  200:105388:RGB  200:105388:RGB
TonleSap   2026-06-19 z9  237/403: distinct=2/4  200:49935:P  200:49935:P  200:227644:RGBA  200:49935:P
TonleSap   2026-06-19 z11 949/1615: distinct=4/4  200:21811:P  200:21557:P  200:118991:RGBA  500:527:notimg
TonleSap   2026-06-19 z13 3798/6463: distinct=3/4  200:194788:RGBA  500:527:notimg  500:527:notimg  200:44422:P
Chicago    2026-10-22 z7  47/32: distinct=1/4  200:143102:RGB  200:143102:RGB  200:143102:RGB  200:143102:RGB
Chicago    2026-10-22 z9  190/131: distinct=1/4  200:103162:RGB  200:103162:RGB  200:103162:RGB  200:103162:RGB
Chicago    2026-10-22 z11 761/525: distinct=1/4  200:122755:RGB  200:122755:RGB  200:122755:RGB  200:122755:RGB
Chicago    2026-10-22 z13 3045/2101: distinct=1/4  200:153443:RGB  200:153443:RGB  200:153443:RGB  200:153443:RGB
MexicoCity 2026-10-13 z7  56/28: distinct=1/4  200:113948:RGB  200:113948:RGB  200:113948:RGB  200:113948:RGB
MexicoCity 2026-10-13 z9  227/115: distinct=1/4  200:142516:RGB  200:142516:RGB  200:142516:RGB  200:142516:RGB
MexicoCity 2026-10-13 z11 911/460: distinct=4/4  200:203626:RGBA  200:194318:RGBA  200:227906:RGBA  200:194939:RGBA
MexicoCity 2026-10-13 z13 3645/1840: distinct=4/4  500:527:notimg  200:199749:RGBA  200:198731:RGBA  200:203526:RGBA
Kilauea    2026-10-17 z7  56/8: distinct=1/4  200:64529:RGB  200:64529:RGB  200:64529:RGB  200:64529:RGB
Kilauea    2026-10-17 z9  227/35: distinct=1/4  200:87481:RGB  200:87481:RGB  200:87481:RGB  200:87481:RGB
Kilauea    2026-10-17 z11 911/140: distinct=4/4  200:192229:RGBA  200:63517:P  200:63771:P  200:239662:RGBA
Kilauea    2026-10-17 z13 3645/562: distinct=1/4  200:171316:RGB  200:171316:RGB  200:171316:RGB  200:171316:RGB
````

How to read it: `distinct=1/4` with mode `RGB` is a healthy tile; `RGBA`, `P`, `notimg` or more than one distinct hash is the fault. A PNG's colour type is the byte at zero-based offset 25 of the file (2 = RGB; the faulty tiles had 6, 3 or 4).

Other NISAR-related layers in the capabilities document (attempt 2, tool call 55): `NISAR_L2_Geocoded_Polarimetric_Covariance`, `OrbitTracks_NISAR_Ascending`, `OrbitTracks_NISAR_Descending`. The layer's only tile matrix set is `GoogleMapsCompatible_Level13`, its format `image/png`.

### 8.8 CMR: the query, the entry shape, the links

Attempt 1, tool call 13 (the full output, 32 KB, is saved at `<claude-projects>/c2a86af5-ec6b-4200-871d-99ccc3f8dde9/tool-results/bvd7o4c62.txt`; the response itself is `<scratch>/review/cold-read/cmr_point.json`):

````bash
cd <scratch>/review/cold-read && /usr/bin/curl -sS -A "coverage-check" -D headers_cmr.txt -o cmr_point.json 'https://cmr.earthdata.nasa.gov/search/granules.json?collection_concept_id=C2854338529-ASF&collection_concept_id=C3622241360-ASF&point=104.05,12.95&page_size=2000&attribute[]=string,STACK_ID,083_A_008&sort_key=start_date' -g && grep -i -E 'cmr-hits|cmr-search-after|access-control|HTTP/' headers_cmr.txt; /opt/anaconda3/bin/python3 - <<'EOF'
import json
d=json.load(open('cmr_point.json'))
es=d['feed']['entry']
print(len(es))
e=es[0]
print(sorted(e.keys()))
print(e['title']); print(e['time_start']); print(e.get('granule_size')); print(e.get('polygons')); print(e.get('data_center'), e.get('dataset_id'), e.get('collection_concept_id'))
for l in e['links']:
    print(l.get('rel'), l.get('href'), l.get('title','')[:40], l.get('inherited',''))
print('---last')
e=es[-1]
print(e['title'], e['time_start'], e.get('collection_concept_id'))
for l in e['links']:
    if not l.get('inherited'): print(l.get('rel'), l.get('href'))
EOF
````

````text
HTTP/2 200 
access-control-allow-origin: *
cmr-search-after: [1793313394000,4407934813]
cmr-hits: 11
access-control-expose-headers: CMR-Hits, CMR-Request-Id, X-Request-Id, CMR-Scroll-Id, CMR-Search-After, CMR-Timed-Out, CMR-Shapefile-Original-Point-Count, CMR-Shapefile-Simplified-Point-Count
11
['browse_flag', 'collection_concept_id', 'coordinate_system', 'data_center', 'dataset_id', 'day_night_flag', 'granule_size', 'id', 'links', 'online_access_flag', 'orbit_calculated_spatial_domains', 'original_format', 'polygons', 'producer_granule_id', 'time_end', 'time_start', 'title', 'updated']
NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223637_20260619T223711_P05023_N_F_J_001
2026-06-19T22:36:37.000Z
1777.8144416809082
[['12.07019 105.39936 14.15457 104.89399 13.61372 102.62722 11.53813 103.14859 12.07019 105.39936']]
ASF NISAR Provisional Geocoded Polarimetric Covariance Product (Version 1) C2854338529-ASF
http://esipfed.org/ns/fedsearch/1.1/data# https://nisar.asf.earthdatacloud.nasa.gov/NISAR/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223637_20260619T223711_P05023_N_F_J_001/NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223637_20260619T223711_P05023_N_F_J_001.h5 Download NISAR_L2_PR_GCO [...]
http://esipfed.org/ns/fedsearch/1.1/s3# s3://sds-n-cumulus-prod-nisar-products/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223637_20260619T223711_P05023_N_F_J_001/NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223637_20260619T223711_P05023_N_F_J_001.h5 This link provides direct download  [...]
http://esipfed.org/ns/fedsearch/1.1/browse# https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223637_20260619T223711_P05023_N_F_J_001/NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223637_20260619T223711_P05023_N_F_J_001_LATLON.png Download NISA [...]
````

Link types of one entry (attempt 1, tool call 14):

````bash
cd <scratch>/review/cold-read && /opt/anaconda3/bin/python3 - <<'EOF'
import json, collections
d=json.load(open('cmr_point.json'))
es=d['feed']['entry']
e=es[0]
c=collections.Counter()
for l in e['links']:
    c[(l.get('rel').rsplit('/',1)[-1], bool(l.get('inherited')), l['href'].split('://')[0], l['href'].rsplit('.',1)[-1][:12])]+=1
for k,v in sorted(c.items()): print(v,k)
print('--- non-inherited hrefs (tail of path)')
for l in e['links']:
    if not l.get('inherited'):
        print(l['rel'].rsplit('/',1)[-1], l['href'].split('/')[2], l['href'].split('/')[3], l['href'].rsplit('_J_001',1)[-1])
print('--- titles/time/coll')
for e in es:
    print(e['title'][-45:], e['time_start'], e['collection_concept_id'], e['granule_size'][:7])
EOF
````

````text
7 ('browse#', False, 'https', 'png')
7 ('browse#', False, 's3', 'png')
1 ('data#', False, 'https', 'h5')
1 ('data#', True, 'https', 'edu/')
1 ('data#', True, 'https', 'gov/search/g')
1 ('documentation#', True, 'https', 'edu/gcov/')
1 ('documentation#', True, 'https', 'pdf')
1 ('metadata#', False, 'https', 'csv')
1 ('metadata#', False, 'https', 'gov/s3creden')
1 ('metadata#', False, 'https', 'h5')
3 ('metadata#', False, 'https', 'json')
6 ('metadata#', False, 'https', 'kml')
1 ('metadata#', False, 'https', 'log')
1 ('metadata#', False, 'https', 'pdf')
1 ('metadata#', False, 'https', 'xml')
1 ('metadata#', False, 'https', 'yaml')
1 ('metadata#', False, 's3', 'csv')
1 ('metadata#', False, 's3', 'h5')
3 ('metadata#', False, 's3', 'json')
6 ('metadata#', False, 's3', 'kml')
1 ('metadata#', False, 's3', 'log')
1 ('metadata#', False, 's3', 'pdf')
1 ('metadata#', False, 's3', 'xml')
1 ('metadata#', False, 's3', 'yaml')
1 ('metadata#', True, 'https', 'gov/')
1 ('s3#', False, 's3', 'h5')
--- non-inherited hrefs (tail of path)
data# nisar.asf.earthdatacloud.nasa.gov NISAR .h5
s3# sds-n-cumulus-prod-nisar-products NISAR_L2_GCOV_PROVISIONAL_V1 .h5
browse# nisar.asf.earthdatacloud.nasa.gov BROWSE _LATLON.png
browse# sds-n-cumulus-prod-nisar-browse NISAR_L2_GCOV_PROVISIONAL_V1 _LATLON.png
browse# nisar.asf.earthdatacloud.nasa.gov BROWSE _LATLON_thumbnail.png
browse# sds-n-cumulus-prod-nisar-browse NISAR_L2_GCOV_PROVISIONAL_V1 _LATLON_thumbnail.png
browse# nisar.asf.earthdatacloud.nasa.gov BROWSE _NATIVE.png
browse# sds-n-cumulus-prod-nisar-browse NISAR_L2_GCOV_PROVISIONAL_V1 _NATIVE.png
browse# nisar.asf.earthdatacloud.nasa.gov BROWSE _NATIVE_A_HHHH.png
browse# sds-n-cumulus-prod-nisar-browse NISAR_L2_GCOV_PROVISIONAL_V1 _NATIVE_A_HHHH.png
browse# nisar.asf.earthdatacloud.nasa.gov BROWSE _NATIVE_A_HVHV.png
browse# sds-n-cumulus-prod-nisar-browse NISAR_L2_GCOV_PROVISIONAL_V1 _NATIVE_A_HVHV.png
browse# nisar.asf.earthdatacloud.nasa.gov BROWSE _NATIVE_B_HHHH.png
browse# sds-n-cumulus-prod-nisar-browse NISAR_L2_GCOV_PROVISIONAL_V1 _NATIVE_B_HHHH.png
browse# nisar.asf.earthdatacloud.nasa.gov BROWSE _NATIVE_B_HVHV.png
browse# sds-n-cumulus-prod-nisar-browse NISAR_L2_GCOV_PROVISIONAL_V1 _NATIVE_B_HVHV.png
metadata# nisar.asf.earthdatacloud.nasa.gov NISAR .h5.iso.xml
metadata# sds-n-cumulus-prod-nisar-products NISAR_L2_GCOV_PROVISIONAL_V1 .h5.iso.xml
metadata# nisar.asf.earthdatacloud.nasa.gov NISAR .rc.yaml
metadata# sds-n-cumulus-prod-nisar-products NISAR_L2_GCOV_PROVISIONAL_V1 .rc.yaml
metadata# nisar.asf.earthdatacloud.nasa.gov NISAR _LATLON.kml
metadata# sds-n-cumulus-prod-nisar-products NISAR_L2_GCOV_PROVISIONAL_V1 _LATLON.kml
metadata# nisar.asf.earthdatacloud.nasa.gov NISAR _NATIVE.kml
metadata# sds-n-cumulus-prod-nisar-products NISAR_L2_GCOV_PROVISIONAL_V1 _NATIVE.kml
metadata# nisar.asf.earthdatacloud.nasa.gov NISAR _NATIVE_A_HHHH.kml
metadata# sds-n-cumulus-prod-nisar-products NISAR_L2_GCOV_PROVISIONAL_V1 _NATIVE_A_HHHH.kml
metadata# nisar.asf.earthdatacloud.nasa.gov NISAR _NATIVE_A_HVHV.kml
metadata# sds-n-cumulus-prod-nisar-products NISAR_L2_GCOV_PROVISIONAL_V1 _NATIVE_A_HVHV.kml
metadata# nisar.asf.earthdatacloud.nasa.gov NISAR _NATIVE_B_HHHH.kml
metadata# sds-n-cumulus-prod-nisar-products NISAR_L2_GCOV_PROVISIONAL_V1 _NATIVE_B_HHHH.kml
metadata# nisar.asf.earthdatacloud.nasa.gov NISAR _NATIVE_B_HVHV.kml
metadata# sds-n-cumulus-prod-nisar-products NISAR_L2_GCOV_PROVISIONAL_V1 _NATIVE_B_HVHV.kml
metadata# nisar.asf.earthdatacloud.nasa.gov NISAR _QA_REPORT.pdf
metadata# sds-n-cumulus-prod-nisar-products NISAR_L2_GCOV_PROVISIONAL_V1 _QA_REPORT.pdf
metadata# nisar.asf.earthdatacloud.nasa.gov NISAR _QA_STATS.h5
metadata# sds-n-cumulus-prod-nisar-products NISAR_L2_GCOV_PROVISIONAL_V1 _QA_STATS.h5
metadata# nisar.asf.earthdatacloud.nasa.gov NISAR _QA_SUMMARY.csv
metadata# sds-n-cumulus-prod-nisar-products NISAR_L2_GCOV_PROVISIONAL_V1 _QA_SUMMARY.csv
metadata# nisar.asf.earthdatacloud.nasa.gov NISAR-JPL-PRIVATE-DATA .context.json
metadata# sds-n-cumulus-prod-nisar-jpl-private-data NISAR_L2_GCOV_PROVISIONAL_V1 .context.json
metadata# nisar.asf.earthdatacloud.nasa.gov NISAR-JPL-PRIVATE-DATA .dataset.json
metadata# sds-n-cumulus-prod-nisar-jpl-private-data NISAR_L2_GCOV_PROVISIONAL_V1 .dataset.json
metadata# nisar.asf.earthdatacloud.nasa.gov NISAR-JPL-PRIVATE-DATA .h5.log
metadata# sds-n-cumulus-prod-nisar-jpl-private-data NISAR_L2_GCOV_PROVISIONAL_V1 .h5.log
metadata# nisar.asf.earthdatacloud.nasa.gov NISAR-JPL-PRIVATE-DATA .met.json
metadata# sds-n-cumulus-prod-nisar-jpl-private-data NISAR_L2_GCOV_PROVISIONAL_V1 .met.json
metadata# nisar.asf.earthdatacloud.nasa.gov s3credentials https://nisar.asf.earthdatacloud.nasa.gov/s3credentials
--- titles/time/coll
60619T223637_20260619T223711_P05023_N_F_J_001 2026-06-19T22:36:37.000Z C2854338529-ASF 1777.81
60701T223636_20260701T223711_P05023_N_F_J_001 2026-07-01T22:36:36.000Z C2854338529-ASF 1822.11
60713T223636_20260713T223710_P05023_N_F_J_001 2026-07-13T22:36:36.000Z C2854338529-ASF 1777.73
60725T223635_20260725T223709_P05023_N_F_J_001 2026-07-25T22:36:35.000Z C2854338529-ASF 1773.73
60818T223634_20260818T223708_P05023_N_F_J_001 2026-08-18T22:36:34.000Z C2854338529-ASF 1777.77
60830T223633_20260830T223708_P05023_N_F_J_001 2026-08-30T22:36:33.000Z C2854338529-ASF 1822.08
60911T223633_20260911T223708_P05023_N_F_J_001 2026-09-11T22:36:33.000Z C2854338529-ASF 1826.17
60923T223633_20260923T223708_P05023_N_F_J_001 2026-09-23T22:36:33.000Z C2854338529-ASF 1826.38
61005T223633_20261005T223708_P05023_N_F_J_001 2026-10-05T22:36:33.000Z C2854338529-ASF 1826.29
61017T223633_20261017T223708_P05023_N_F_J_001 2026-10-17T22:36:33.000Z C2854338529-ASF 1826.34
61029T223634_20261029T223708_P05036_N_F_J_001 2026-10-29T22:36:34.000Z C3622241360-ASF 1777.87
````

The coverage helper against live CMR, with its failure modes (attempt 2, tool call 20):

````bash
W=<scratch>/review/cold-read-coding-agent; mkdir -p "$W"/{cov,d1,net,npm,py,web} && cd "$W/cov" && echo "== coverage script, Tonle Sap point from Appendix A" && time /opt/anaconda3/bin/python3 -B <prehackathon-repo>/research/nisar_coverage.py 104.05 12.95 2>&1 | head -30; echo "== bad args"; /opt/anaconda3/bin/python3 -B <prehackathon-repo>/research/nisar_coverage.py 2>&1 | tail -3; echo "== ocean point (no data)"; /opt/anaconda3/bin/python3 -B <prehackathon-repo>/research/nisar_coverage.py -150 -40 2>&1 | tail -5; echo "== lat/lon swapped (common mistake)"; /opt/anaconda3/bin/python3 -B <prehackathon-repo>/research/nisar_coverage.py 12.95 104.05 2>&1 | tail -5
````

````text
== coverage script, Tonle Sap point from Appendix A
GCOV at lon=104.05 lat=12.95: 2 stack(s)
  083_A_008   11 dates  2026-06-19 .. 2026-10-29  pol=HH+HV  bw=20+5 MHz  ~1896 MB/file  releases={'P': 10, 'V': 1}
             06-19 07-01 07-13 07-25 08-18 08-30 09-11 09-23 10-05 10-17 10-29
  148_D_082   11 dates  2026-06-24 .. 2026-11-03  pol=HH/HH+HV  bw=20+5 MHz  ~1896 MB/file  releases={'P': 9, 'V': 2}
             06-24 07-06 07-18 08-11 08-23 09-04 09-16 09-28 10-10 10-22 11-03
/opt/anaconda3/bin/python3 -B  104.05 12.95 2>&1  0.05s user 0.02s system 13% cpu 0.535 total
head -30  0.00s user 0.00s system 0% cpu 0.535 total
== bad args
    main(float(sys.argv[1]), float(sys.argv[2]), sys.argv[3].upper() if len(sys.argv) > 3 else "GCOV")
               ~~~~~~~~^^^
IndexError: list index out of range
== ocean point (no data)
GCOV at lon=-150.0 lat=-40.0: 0 stack(s)
== lat/lon swapped (common mistake)
    result = func(*args)
             ^^^^^^^^^^^
  File "/opt/anaconda3/lib/python3.12/urllib/request.py", line 639, in http_error_default
    raise HTTPError(req.full_url, code, msg, hdrs, fp)
urllib.error.HTTPError: HTTP Error 400: Bad Request
````

### 8.9 Versions and installs

Machine and repository state, 13 Nov 21:00 CST (attempt 1, tool call 11):

````bash
mkdir -p <scratch>/review/cold-read && cd <scratch>/review/cold-read && pwd && ls -la .. 2>&1 | head -30; echo ---; ls -la <official-repo>/research/evidence/previews/; echo ---; git -C <official-repo> status --short --branch 2>&1 | head -20; git -C <official-repo> remote -v 2>&1; git -C <official-repo> log --oneline -5 2>&1 | head; echo ---; date; sw_vers 2>/dev/null; uname -m; which caffeinate gh git node npm python3; node --version; /opt/anaconda3/bin/python3 --version
````

````text
<scratch>/review/cold-read
total 0
drwxr-xr-x@  7 <user>  wheel   224 Nov 13 21:00 .
drwx------@ 41 <user>  wheel  1312 Nov 13 20:54 ..
drwxr-xr-x@  2 <user>  wheel    64 Nov 13 21:00 cold-read
drwxr-xr-x@  6 <user>  wheel   192 Nov 13 21:00 fact-checker
drwxr-xr-x@  9 <user>  wheel   288 Nov 13 20:57 geo-frontend-engineer
drwxr-xr-x@  6 <user>  wheel   192 Nov 13 21:00 rules-compliance
drwxr-xr-x@  2 <user>  wheel    64 Nov 13 20:54 sar-science
---
total 10080
drwxr-xr-x@ 8 <user>  staff      256 Nov 13 19:45 .
drwxr-xr-x@ 4 <user>  staff      128 Nov 13 19:45 ..
-rw-r--r--@ 1 <user>  staff  1122436 Nov 13 19:45 browse_illinois_quadpol_2026-08-11.png
-rw-r--r--@ 1 <user>  staff  1225992 Nov 13 19:45 browse_tonlesap_2026-06-19.png
-rw-r--r--@ 1 <user>  staff  1220703 Nov 13 19:45 browse_tonlesap_2026-10-29.png
-rw-r--r--@ 1 <user>  staff   320691 Nov 13 19:45 gibs_tonlesap_2026-06-19.png
-rw-r--r--@ 1 <user>  staff   325243 Nov 13 19:45 gibs_tonlesap_2026-10-29.png
-rw-r--r--@ 1 <user>  staff   928059 Nov 13 19:45 gunw_mexicocity_2026-03-11.png
---
## No commits yet on main...origin/main [gone]
?? research/
origin	https://github.com/runny24/NASA-space-apps-2026.git (fetch)
origin	https://github.com/runny24/NASA-space-apps-2026.git (push)
fatal: your current branch 'main' does not have any commits yet
---
Fri Nov 13 21:00:59 CST 2026
ProductName:		macOS
ProductVersion:		26.6.2
BuildVersion:		25G83
arm64
/usr/bin/caffeinate
gh not found
/opt/homebrew/bin/git
/usr/local/bin/node
/usr/local/bin/npm
/opt/anaconda3/bin/python3
v22.15.0
Python 3.12.2
````

npm registry (attempt 2, tool call 35; attempt 1, tool call 17 agrees and adds `create-vite latest=9.3.4`, `@playwright/test latest=1.65.1`):

````bash
cd <scratch>/review/cold-read-coding-agent/npm && for p in maplibre-gl @geomatico/maplibre-cog-protocol geotiff @mapbox/mapbox-gl-sync-move @maplibre/maplibre-gl-compare vite react typescript gh-pages playwright; do printf "%-36s latest=%s\n" "$p" "$(npm view $p version 2>/dev/null)"; done; echo "== maplibre-gl dist-tags and 5.x tail"; npm view maplibre-gl dist-tags --json 2>/dev/null; npm view maplibre-gl versions --json 2>/dev/null | /opt/anaconda3/bin/python3 -c "import json,sys; v=json.load(sys.stdin); print('5.x tail:',[x for x in v if x.startswith('5.') and '-' not in x][-4:]); print('6.x tail:',[x for x in v if x.startswith('6.') and '-' not in x][-3:])"; echo "== cog protocol peer deps / engines"; npm view @geomatico/maplibre-cog-protocol@0.10.0 peerDependencies dependencies license --json 2>/dev/null; echo "== vite engines"; npm view vite engines --json 2>/dev/null; echo "== maplibre 5.24.1 engines/type/main"; npm view maplibre-gl@5.24.1 engines type main module --json 2>/dev/null; echo "== sync-move"; npm view @mapbox/mapbox-gl-sync-move version time.modified license --json 2>/dev/null
````

````text
maplibre-gl                          latest=6.18.0
@geomatico/maplibre-cog-protocol     latest=0.10.0
geotiff                              latest=3.0.5
@mapbox/mapbox-gl-sync-move          latest=0.4.0
@maplibre/maplibre-gl-compare        latest=0.5.0
vite                                 latest=8.3.8
react                                latest=19.3.1
typescript                           latest=7.0.2
gh-pages                             latest=6.3.0
playwright                           latest=1.65.1
== maplibre-gl dist-tags and 5.x tail
{
  "v1": "1.15.3",
  "next": "6.0.0-22",
  "latest": "6.18.0",
  "latest-5": "5.24.1"
}
5.x tail: ['5.22.0', '5.23.0', '5.24.0', '5.24.1']
6.x tail: ['6.16.0', '6.17.0', '6.18.0']
== cog protocol peer deps / engines
{
  "peerDependencies": {
    "maplibre-gl": "^4.5.0 || ^5.0.0 || ^6.0.0"
  },
  "dependencies": {
    "geotiff": "^3.0.5",
    "d3-scale": "^4.0.2",
    "quick-lru": "^7.1.0",
    "@mapbox/sphericalmercator": "^2.0.2"
  },
  "license": "MIT"
}
== vite engines
{
  "node": "^20.19.0 || >=22.12.0"
}
== maplibre 5.24.1 engines/type/main
{
  "engines": {
    "npm": ">=8.1.0",
    "node": ">=16.14.0"
  },
  "type": "module",
  "main": "dist/maplibre-gl.js"
}
== sync-move
{
  "version": "0.4.0",
  "time.modified": "2026-11-09T14:52:33.321Z",
  "license": "ISC"
}
````

Installing the pinned map libraries (attempt 2, tool call 40). The command went on to scan the package README; that part of the output is left out here, the README is at `<scratch>/review/cold-read-coding-agent/npm/node_modules/@geomatico/maplibre-cog-protocol/README.md`.

````bash
cd "$W/npm" && npm init -y >/dev/null 2>&1 && ( time npm install --no-audit --no-fund maplibre-gl@5.24.1 @geomatico/maplibre-cog-protocol@0.10.0 @mapbox/mapbox-gl-sync-move@0.4.0 2>&1 | tail -3 ) 2>&1 | tail -6
````

````text
added 47 packages in 1s
npm install --no-audit --no-fund maplibre-gl@5.24.1   2>&1  0.76s user 0.68s system 121% cpu 1.190 total
tail -3  0.00s user 0.00s system 0% cpu 1.189 total
````

PyPI latest versions (attempt 1, tool call 18):

````bash
cd <scratch>/review/cold-read && for p in earthaccess asf_search rasterio rio-cogeo h5py pyproj numpy scipy fsspec aiohttp harmony-py; do /opt/anaconda3/bin/python3 -m pip index versions "$p" 2>/dev/null | head -1; done; /opt/anaconda3/bin/python3 -m pip --version; df -h /private/tmp | tail -1
````

````text
earthaccess (0.19.0)
asf_search (14.1.0)
rasterio (1.5.2)
rio-cogeo (7.0.4)
h5py (3.16.0)
pyproj (3.8.0)
numpy (2.5.4)
scipy (1.18.1)
fsspec (2026.9.0)
aiohttp (3.14.5)
harmony-py (1.8.0)
pip 24.2 from /opt/anaconda3/lib/python3.12/site-packages/pip (python 3.12)
/dev/disk3s5   460Gi   390Gi    30Gi    93%    3.6M  313M    1%   /System/Volumes/Data
````

Fresh venv with the brief's package list (attempt 2, tool call 36):

````bash
W=<scratch>/review/cold-read-coding-agent; cd "$W/py" && /opt/anaconda3/bin/python3 -m venv venv 2>&1 | tail -2; ( time ./venv/bin/pip install --disable-pip-version-check -q h5py numpy scipy pyproj rasterio rio-cogeo earthaccess asf_search ) 2>&1 | tail -8; ./venv/bin/pip list --disable-pip-version-check 2>/dev/null | grep -i -E "^(h5py|numpy|scipy|pyproj|rasterio|rio-cogeo|earthaccess|asf.search|fsspec|aiohttp|morecantile|pyyaml|PyYAML|matplotlib|pillow|harmony|xarray|pytest|requests) " ; ./venv/bin/python -c "import rasterio; print('rasterio', rasterio.__version__, 'GDAL', rasterio.__gdal_version__); import sys; print(sys.version)"; du -sh venv | cut -f1
````

````text
./venv/bin/pip install --disable-pip-version-check -q h5py numpy scipy pyproj  10.90s user 2.12s system 90% cpu 14.437 total
aiohttp               3.14.5
asf_search            14.1.0
earthaccess           0.19.0
fsspec                2026.9.0
h5py                  3.16.0
morecantile           7.1.0
numpy                 2.5.4
pyproj                3.8.0
rasterio              1.5.2
requests              2.34.2
rio-cogeo             7.0.4
scipy                 1.18.1
rasterio 1.5.2 GDAL 3.12.2
3.12.2 | packaged by conda-forge | (main, Feb 16 2024, 20:54:21) [Clang 16.0.6 ]
321M
````

GitHub Pages action releases (attempt 2, tool call 49). The command also printed GitHub's starter workflow `pages/static.yml` from `actions/starter-workflows`; it is not reproduced here. Its shape: triggers on push to the default branch and `workflow_dispatch`; permissions `contents: read`, `pages: write`, `id-token: write`; one job in the `github-pages` environment that runs checkout, configure-pages, upload-pages-artifact and deploy-pages.

````bash
for r in actions/checkout actions/setup-node actions/configure-pages actions/upload-pages-artifact actions/deploy-pages; do printf "%-32s " "$r"; /usr/bin/curl -s -H "User-Agent: version-check" "https://api.github.com/repos/$r/releases/latest" | /opt/anaconda3/bin/python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('tag_name'), d.get('published_at'), (d.get('message') or '')[:80])"; done
````

````text
actions/checkout                 v7.0.1 2026-07-20T15:10:05Z 
actions/setup-node               v7.1.0 2026-10-08T02:52:34Z 
actions/configure-pages          v6.0.0 2026-03-25T17:00:49Z 
actions/upload-pages-artifact    v5.0.0 2026-04-10T18:22:59Z 
actions/deploy-pages             v5.0.1 2026-09-01T21:31:19Z 
````

FortiGuard form fields (attempt 1, tool call 28; field list only, the page text is left out):

````text
200 128440 https://www.fortiguard.com/faq/wfratingsubmit
128435
input q text Search FortiGuard required
input q text Search FortiGuard required
input url text None required
select categorysuggestion None None required
input screenshot file None 
input name text None required
input email text None required
input company text None required
textarea comment None None 
input code hidden None required
input hash hidden None 
input expires_at hidden None 
input encoded_ip hidden None 
input contact_me checkbox None 
captcha 71
recaptcha 0
turnstile 0
hcaptcha 0
sign in 0
log in 0
login 0
````

## 9. Fix sketches written during recovery: NOT RUN

These follow directly from the outputs above but were written by the recovery pass and have not been executed. Test before trusting them.

### 9.1 D1 with error check, stack filter and de-duplication (untested)

````js
const GCOV = ['C2854338529-ASF', 'C3622241360-ASF']; // provisional, validated (beta would be C3622214170-ASF)
const RANK = { 'C3622241360-ASF': 2, 'C2854338529-ASF': 1 };   // validated over provisional

export async function nisarPasses(lon, lat, stack /* optional, e.g. '083_A_008' */) {
  const p = new URLSearchParams({ point: `${lon},${lat}`, page_size: '2000', sort_key: 'start_date' });
  GCOV.forEach((c) => p.append('collection_concept_id', c));
  const res = await fetch(`https://cmr.earthdata.nasa.gov/search/granules.json?${p}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.feed) throw new Error(`CMR search failed (${res.status}): ${(body.errors || []).join('; ')}`);
  const best = new Map();                                        // one pass per stack and UTC day
  for (const e of body.feed.entry) {
    const m = e.title.match(/_GCOV_(\d{3})_(\d{3})_([AD])_(\d{3})_(\d{4})_(\w{4})_/);
    if (!m) continue;
    const pass = {
      name: e.title, start: e.time_start, date: e.time_start.slice(0, 10),   // UTC date: this is the GIBS date
      cycle: m[1], stack: `${m[2]}_${m[3]}_${m[4]}`, mode: m[5], pol: m[6],
      release: RANK[e.collection_concept_id] ?? 0, counter: Number(e.title.slice(-3)),
      polygon: e.polygons?.[0]?.[0],                                          // "lat lon lat lon ..."
      browse: e.links.filter((l) => l.rel.endsWith('browse#') && l.href.startsWith('https')).map((l) => l.href),
    };
    if (stack && pass.stack !== stack) continue;
    const key = `${pass.stack} ${pass.date}`;
    const old = best.get(key);
    if (!old || pass.release > old.release || (pass.release === old.release && pass.counter > old.counter)) best.set(key, pass);
  }
  return [...best.values()];                                     // may be empty: callers must handle that
}
````

Assumptions to check when it is first run: that CMR's JSON error body has an `errors` array (the test only showed that `feed` was missing), and that `collection_concept_id` is present on every entry (it was in the saved response).

### 9.2 Non-interactive Earthdata login (untested with real credentials)

````python
import earthaccess

def login_or_stop():
    """Never prompts. In earthaccess 0.19.0 both strategies were seen to fail fast: LoginStrategyUnavailable in 0.0 s
    when credentials are absent, LoginAttemptFailure in 0.2 s when they are wrong."""
    last = None
    for strategy in ("environment", "netrc"):          # EARTHDATA_TOKEN or EARTHDATA_USERNAME/PASSWORD, then ~/.netrc
        try:
            auth = earthaccess.login(strategy=strategy)
            if getattr(auth, "authenticated", False):
                return auth
        except Exception as exc:                       # the two exception classes named above
            last = exc
    raise SystemExit(f"Earthdata login failed: {last}\nFix ~/.netrc (machine urs.earthdata.nasa.gov login <user> "
                     "password <password>) or set EARTHDATA_TOKEN, then rerun.")
````

### 9.3 Guards for D3's read_window (untested)

Insert after the two `np.searchsorted` lines, before any dataset is read:

````python
        if c0 >= c1 or r0 >= r1:
            raise ValueError(f"bbox {bbox} does not intersect this frame "
                             f"(x {x[0]:.0f}..{x[-1]:.0f}, y {y[-1]:.0f}..{y[0]:.0f}, EPSG:{epsg})")
        dx, dy = float(x[1] - x[0]), float(y[1] - y[0])
        want = (round((max(ys) - min(ys)) / abs(dy)), round((max(xs) - min(xs)) / abs(dx)))   # rows, cols asked for
        clipped = (r1 - r0) < want[0] - 1 or (c1 - c0) < want[1] - 1    # True when the bbox sticks out of the frame
        missing = [t for t in terms if t not in g]                       # e.g. HVHV on an HH-only date
````

Return `clipped` and `missing` with the arrays, or log them per date, so a partial or HH-only date cannot slip into a time series unnoticed.


# Recovered digest: NASA Harmony for NISAR GCOV windows (topic "harmony")

Written 2026-11-14 from the scratch files and transcripts of an interrupted research run. Nothing was
re-run for this digest, no package was installed and no network request was made. The brief being
checked is `<prehackathon-repo>/research/BUILD_PROMPT.md`,
Section 4.5, access path 2 ("NASA Harmony").

Evidence labels used throughout:

- **ran**: a saved output, log or transcript tool result shows the thing being run and what it printed.
- **docs**: read in documentation, a package registry, a GitHub issue or source code. Not executed.
- **belief**: asserted without evidence I could find. Marked where it occurs.

Sources (read-only):

- Scratch folder: `<scratch>/verify/harmony`
  (`scripts/`, `out/`, `mock/`, `pages/`, `downloads/`, `repos/`, and `prior_run_20261113/`, which holds
  the outputs of the second attempt, moved aside by the third).
- Transcripts in `<transcripts>/wf_0472d927-435`:
  `agent-a9905564ad9861fe6.jsonl` (first attempt, 44 tool calls), `agent-a6f8b12e2bbd50095.jsonl`
  (second, 123 tool calls), `agent-a4dd2ffbe1add4f11.jsonl` (third, 113 tool calls).

## 0. How far the run got

Three attempts (2026-11-13 19:38-19:46 and 20:41-21:07, 2026-11-14 01:41-02:01 local time) each stopped on a usage limit before writing a report, so the transcripts hold no conclusions, only tool calls and their outputs. The evidence gathering was nearly complete: live Harmony capabilities for all 44 NISAR collections, harmony-py 1.8.0 inspected and the requests built offline, unauthenticated probes, the deployed service code (harmony-gdal 0.0.3, GDAL 3.13.3) run locally on synthetic granules with COG validation, and a check of alternatives. No real Harmony job was ever submitted (no credentials), so real output, turnaround time and the EULA requirement remain unverified.

The only assistant text in each transcript is the line "You've hit your 5-hour limit". The agents'
reasoning was not saved, so every conclusion below is drawn from what their commands printed. Where a
conclusion is mine and not printed by a command, it says so.

Two limits apply to everything in Section 4 ("what comes back"):

1. **No real Harmony job was run.** There were no Earthdata Login credentials.
2. **No real NISAR file was opened.** The service's code was run locally on two *synthetic* HDF5 files
   that imitate the GCOV layout. The service code and GDAL version are the deployed ones; the data are not.

## 1. Bottom line for the builder

- Harmony can return exactly what pipeline stage 2 wants: for each granule and each layer, one float32
  GeoTIFF (a valid COG) cut to a lat/lon box, in the granule's native UTM projection, on the source pixel
  lattice, with the HDF5 values untouched (linear gamma-naught) and NaN as nodata. **ran**, on synthetic data.
- It needs Earthdata Login for every job. Only the capabilities, versions and docs endpoints are public. **ran**
- The request is short and is given in Section 2. harmony-py 1.8.0 accepts it. It has never been submitted. **ran** (client side)
- The service reached production on 2026-11-09 and is at version 0.0.3. Treat it as unproven. **docs**
- It is not fast by design: for each date the service downloads the whole 2 to 8 GB granule inside AWS
  before cutting the window. The only timing on record (older service chain) is 68 minutes for 14 granules. **docs**
- Do not ask it to reproject. EPSG:3857 is refused and reprojected dates do not line up. **ran**
- Do not let it choose granules from a box and a date range. Pick the granule ids yourself. **ran**
- harmony-py does not read `EARTHDATA_TOKEN`, and `Client()` does not complain when you are not logged
  in. Use the check in Section 5. **ran** / **docs**
- There is no other server-side subsetter for NISAR (no OPeNDAP; HyP3 is Sentinel-1 only). **ran** / **docs**
- Suggested role: a time-boxed candidate in the access bake-off, started first and left running, with the
  h5py partial read as the default plan. This is my recommendation from the evidence; the interrupted
  agents never wrote one.

## 2. The exact request

### 2.1 harmony-py request code that was run (built and validated offline, never submitted)

The script below builds the requests with a placeholder token and prints the URL harmony-py would send.
It ran in a Python 3.12 venv with harmony-py 1.8.0. `is_valid: True | errors: []` for all six.

**File:** `<scratch>/verify/harmony/scripts/build_nisar_requests.py`

````python
#!/usr/bin/env python3
"""Build (NOT submit) harmony-py requests for NISAR GCOV HHHH + HVHV and print the exact
URL / curl form harmony-py would send. No network traffic, no credentials: a placeholder
token is used and auth validation is disabled.
Run:  env -i PATH=/usr/bin:/bin venv/bin/python -I scripts/build_nisar_requests.py
"""
import datetime as dt
from urllib.parse import unquote

from harmony import BBox, Client, Collection, Request, CapabilitiesRequest

client = Client(token="PLACEHOLDER_EDL_TOKEN", should_validate_auth=False)

GCOV_PROVISIONAL = "C2854338529-ASF"   # NISAR_L2_GCOV_PROVISIONAL_V1
GCOV_VALIDATED = "C3622241360-ASF"     # NISAR_L2_GCOV_V1
HHHH = "/science/LSAR/GCOV/grids/frequencyA/HHHH"   # UMM-Var V4137651715-ASF
HVHV = "/science/LSAR/GCOV/grids/frequencyA/HVHV"   # UMM-Var V4137651725-ASF
AOI = BBox(w=-118.5, s=33.9, e=-118.1, n=34.2)


def show(title, request):
    print("=" * 100)
    print(title)
    print("is_valid:", request.is_valid(), "| errors:", request.error_messages())
    url = client.request_as_url(request)
    print("URL (encoded):\n ", url)
    print("URL (decoded):\n ", unquote(url))
    print("curl:\n ", client.request_as_curl(request))


# 1. one granule, two layers, bbox subset, native projection
show("1) one granule + bbox, HHHH+HVHV by UMM-Var name",
     Request(collection=Collection(id=GCOV_PROVISIONAL),
             granule_id=["G4381234094-ASF"],
             spatial=AOI,
             variables=[HHHH, HVHV],
             format="image/tiff"))

# 2. same but variables by UMM-Var concept id
show("2) one granule + bbox, HHHH+HVHV by UMM-Var concept id",
     Request(collection=Collection(id=GCOV_PROVISIONAL),
             granule_id=["G4381234094-ASF"],
             spatial=AOI,
             variables=["V4137651715-ASF", "V4137651725-ASF"],
             format="image/tiff"))

# 3. date range over a bbox (Harmony does the CMR granule search itself)
show("3) date range + bbox, HHHH+HVHV, capped at 20 granules",
     Request(collection=Collection(id=GCOV_PROVISIONAL),
             spatial=AOI,
             temporal={"start": dt.datetime(2026, 9, 1), "stop": dt.datetime(2026, 10, 21)},
             variables=[HHHH, HVHV],
             format="image/tiff",
             max_results=20,
             skip_preview=True))

# 4. date range + bbox + reprojection to EPSG:4326
show("4) date range + bbox + reprojection to EPSG:4326",
     Request(collection=Collection(id=GCOV_VALIDATED),
             spatial=AOI,
             temporal={"start": dt.datetime(2026, 10, 21), "stop": dt.datetime(2026, 11, 14)},
             variables=[HHHH, HVHV],
             crs="EPSG:4326",
             format="image/tiff"))

# 5. restrict to one track/frame with a granule-name wildcard (track 106 ascending, frame 019)
show("5) granule_name wildcard (track 106 A frame 019) + bbox",
     Request(collection=Collection(id=GCOV_PROVISIONAL),
             granule_name=["NISAR_L2_PR_GCOV_*_106_A_019_*"],
             spatial=AOI,
             variables=[HHHH, HVHV],
             format="image/tiff"))

# 6. capabilities request (the only one that needs no login server-side)
show("6) capabilities request", CapabilitiesRequest(collection_id=GCOV_PROVISIONAL))
````

What it printed (title, validity, and the two URL forms; the long multipart `curl` dumps are left out).
**File:** `<scratch>/verify/harmony/out/build_nisar_requests.txt`

````
1) one granule + bbox, HHHH+HVHV by UMM-Var name
is_valid: True | errors: []
URL (encoded):
  https://harmony.earthdata.nasa.gov/C2854338529-ASF/ogc-api-coverages/1.0.0/collections/parameter_vars/coverage/rangeset?forceAsync=true&subset=lat%2833.9%3A34.2%29&subset=lon%28-118.5%3A-118.1%29&label=harmony-py&granuleId=G4381234094-ASF&format=image%2Ftiff&variable=%2Fscience%2FLSAR%2FGCOV%2Fgrids%2FfrequencyA%2FHHHH&variable=%2Fscience%2FLSAR%2FGCOV%2Fgrids%2FfrequencyA%2FHVHV
URL (decoded):
  https://harmony.earthdata.nasa.gov/C2854338529-ASF/ogc-api-coverages/1.0.0/collections/parameter_vars/coverage/rangeset?forceAsync=true&subset=lat(33.9:34.2)&subset=lon(-118.5:-118.1)&label=harmony-py&granuleId=G4381234094-ASF&format=image/tiff&variable=/science/LSAR/GCOV/grids/frequencyA/HHHH&variable=/science/LSAR/GCOV/grids/frequencyA/HVHV

2) one granule + bbox, HHHH+HVHV by UMM-Var concept id
is_valid: True | errors: []
URL (encoded):
  https://harmony.earthdata.nasa.gov/C2854338529-ASF/ogc-api-coverages/1.0.0/collections/parameter_vars/coverage/rangeset?forceAsync=true&subset=lat%2833.9%3A34.2%29&subset=lon%28-118.5%3A-118.1%29&label=harmony-py&granuleId=G4381234094-ASF&format=image%2Ftiff&variable=V4137651715-ASF&variable=V4137651725-ASF
URL (decoded):
  https://harmony.earthdata.nasa.gov/C2854338529-ASF/ogc-api-coverages/1.0.0/collections/parameter_vars/coverage/rangeset?forceAsync=true&subset=lat(33.9:34.2)&subset=lon(-118.5:-118.1)&label=harmony-py&granuleId=G4381234094-ASF&format=image/tiff&variable=V4137651715-ASF&variable=V4137651725-ASF

3) date range + bbox, HHHH+HVHV, capped at 20 granules
is_valid: True | errors: []
URL (encoded):
  https://harmony.earthdata.nasa.gov/C2854338529-ASF/ogc-api-coverages/1.0.0/collections/parameter_vars/coverage/rangeset?forceAsync=true&subset=lat%2833.9%3A34.2%29&subset=lon%28-118.5%3A-118.1%29&subset=time%28%222026-09-01T00%3A00%3A00%22%3A%222026-10-21T00%3A00%3A00%22%29&label=harmony-py&format=image%2Ftiff&maxResults=20&skipPreview=true&variable=%2Fscience%2FLSAR%2FGCOV%2Fgrids%2FfrequencyA%2FHHHH&variable=%2Fscience%2FLSAR%2FGCOV%2Fgrids%2FfrequencyA%2FHVHV
URL (decoded):
  https://harmony.earthdata.nasa.gov/C2854338529-ASF/ogc-api-coverages/1.0.0/collections/parameter_vars/coverage/rangeset?forceAsync=true&subset=lat(33.9:34.2)&subset=lon(-118.5:-118.1)&subset=time("2026-09-01T00:00:00":"2026-10-21T00:00:00")&label=harmony-py&format=image/tiff&maxResults=20&skipPreview=true&variable=/science/LSAR/GCOV/grids/frequencyA/HHHH&variable=/science/LSAR/GCOV/grids/frequencyA/HVHV

4) date range + bbox + reprojection to EPSG:4326
is_valid: True | errors: []
URL (encoded):
  https://harmony.earthdata.nasa.gov/C3622241360-ASF/ogc-api-coverages/1.0.0/collections/parameter_vars/coverage/rangeset?forceAsync=true&subset=lat%2833.9%3A34.2%29&subset=lon%28-118.5%3A-118.1%29&subset=time%28%222026-10-21T00%3A00%3A00%22%3A%222026-11-14T00%3A00%3A00%22%29&label=harmony-py&outputcrs=EPSG%3A4326&format=image%2Ftiff&variable=%2Fscience%2FLSAR%2FGCOV%2Fgrids%2FfrequencyA%2FHHHH&variable=%2Fscience%2FLSAR%2FGCOV%2Fgrids%2FfrequencyA%2FHVHV
URL (decoded):
  https://harmony.earthdata.nasa.gov/C3622241360-ASF/ogc-api-coverages/1.0.0/collections/parameter_vars/coverage/rangeset?forceAsync=true&subset=lat(33.9:34.2)&subset=lon(-118.5:-118.1)&subset=time("2026-10-21T00:00:00":"2026-11-14T00:00:00")&label=harmony-py&outputcrs=EPSG:4326&format=image/tiff&variable=/science/LSAR/GCOV/grids/frequencyA/HHHH&variable=/science/LSAR/GCOV/grids/frequencyA/HVHV

5) granule_name wildcard (track 106 A frame 019) + bbox
is_valid: True | errors: []
URL (encoded):
  https://harmony.earthdata.nasa.gov/C2854338529-ASF/ogc-api-coverages/1.0.0/collections/parameter_vars/coverage/rangeset?forceAsync=true&subset=lat%2833.9%3A34.2%29&subset=lon%28-118.5%3A-118.1%29&label=harmony-py&granuleName=NISAR_L2_PR_GCOV_%2A_106_A_019_%2A&format=image%2Ftiff&variable=%2Fscience%2FLSAR%2FGCOV%2Fgrids%2FfrequencyA%2FHHHH&variable=%2Fscience%2FLSAR%2FGCOV%2Fgrids%2FfrequencyA%2FHVHV
URL (decoded):
  https://harmony.earthdata.nasa.gov/C2854338529-ASF/ogc-api-coverages/1.0.0/collections/parameter_vars/coverage/rangeset?forceAsync=true&subset=lat(33.9:34.2)&subset=lon(-118.5:-118.1)&label=harmony-py&granuleName=NISAR_L2_PR_GCOV_*_106_A_019_*&format=image/tiff&variable=/science/LSAR/GCOV/grids/frequencyA/HHHH&variable=/science/LSAR/GCOV/grids/frequencyA/HVHV

6) capabilities request
is_valid: True | errors: []
URL (encoded):
  https://harmony.earthdata.nasa.gov/capabilities?collectionid=C2854338529-ASF
URL (decoded):
  https://harmony.earthdata.nasa.gov/capabilities?collectionid=C2854338529-ASF
````


The granule used, `G4381234094-ASF`, is the real provisional granule
`NISAR_L2_PR_GCOV_033_106_A_019_4005_DHDH_A_20261019T130003_20261019T130038_P05023_N_F_J_001` (7.0 GB, Los
Angeles, track 106 ascending, frame 019), taken from the CMR search saved in
`<scratch>/verify/harmony/out/cmr_gcov_search_provisional_LA.txt`.

### 2.2 How harmony-py arguments map to the REST parameters

Read off the script above and its printed URLs. **ran**

| harmony-py `Request(...)` argument | REST form harmony-py 1.8.0 produced | Note |
|---|---|---|
| `collection=Collection(id="C2854338529-ASF")` | first path segment, `/C2854338529-ASF/ogc-api-coverages/1.0.0/...` | Concept id. Harmony's docs and NASA's regression tests also use the short name (`NISAR_L2_GCOV_PROVISIONAL_V1`) here |
| `variables=[...]` | path `.../collections/parameter_vars/coverage/rangeset` plus one `variable=` per layer | UMM-Var name (full HDF5 path with leading slash) or concept id (`V4137651715-ASF`) |
| `granule_id=["G4381234094-ASF"]` | `granuleId=G4381234094-ASF` | CMR granule concept id |
| `granule_name=["NISAR_L2_PR_GCOV_*_106_A_019_*"]` | `granuleName=NISAR_L2_PR_GCOV_*_106_A_019_*` | `*` and `?` wildcards |
| `spatial=BBox(w=-118.5, s=33.9, e=-118.1, n=34.2)` | `subset=lat(33.9:34.2)&subset=lon(-118.5:-118.1)` | degrees, west south east north |
| `temporal={"start": datetime, "stop": datetime}` | `subset=time("2026-09-01T00:00:00":"2026-10-21T00:00:00")` | selects granules; the service does not cut in time |
| `crs="EPSG:4326"` | `outputcrs=EPSG:4326` | avoid, see Section 4 |
| `format="image/tiff"` | `format=image/tiff` | the only extraction format |
| `max_results=20` | `maxResults=20` | caps input granules |
| `skip_preview=True` | `skipPreview=true` | only matters near 300 granules |
| (always added) | `forceAsync=true`, `label=harmony-py` | every harmony-py request is asynchronous |

### 2.3 End to end: login check, submit, wait, download. UNTESTED as a whole

No job could be submitted, so this has not run. It is assembled from pieces that did run or are quoted
from documentation:

- request construction: `scripts/build_nisar_requests.py` above (**ran**, client side);
- login check: `scripts/harmony_py_auth_check.py`, Appendix A (**ran** without credentials);
- `submit` returning the job id, `wait_for_processing`, `download_all`, `status`: harmony-py 1.8.0
  signatures printed in `out/inspect_harmony_py.txt` and NASA's regression test in Section 2.5 (**docs**).

```python
# UNTESTED as a whole: run it once on a single granule with real credentials before building on it.
import os
from pathlib import Path

from harmony import BBox, Client, Collection, JobsRequest, Request

GCOV_PROVISIONAL = "C2854338529-ASF"   # NISAR_L2_GCOV_PROVISIONAL_V1
GCOV_VALIDATED = "C3622241360-ASF"     # NISAR_L2_GCOV_V1
LAYERS = [
    "/science/LSAR/GCOV/grids/frequencyA/HHHH",
    "/science/LSAR/GCOV/grids/frequencyA/HVHV",
    "/science/LSAR/GCOV/grids/frequencyA/mask",
]


def harmony_client() -> Client:
    token = os.environ.get("EARTHDATA_TOKEN")            # harmony-py does NOT read this by itself
    client = Client(token=token) if token else Client()  # else ~/.netrc, or EDL_USERNAME + EDL_PASSWORD
    jobs = client.submit(JobsRequest(limit=1))            # Client() never fails on its own; this is the real check
    if not (isinstance(jobs, dict) and "count" in jobs):
        raise SystemExit("Not logged in to Harmony: fix ~/.netrc or EARTHDATA_TOKEN, and accept the ASF EULA")
    return client


def fetch_window(client, collection_id, granule_ids, bbox_wsen, out_dir):
    """bbox_wsen = (west, south, east, north) in degrees. One job per stack. Returns local file paths."""
    w, s, e, n = bbox_wsen
    request = Request(
        collection=Collection(id=collection_id),
        granule_id=list(granule_ids),        # CMR granule concept ids, e.g. "G4381234094-ASF"
        spatial=BBox(w=w, s=s, e=e, n=n),
        variables=LAYERS,                    # never leave the default ["all"]
        format="image/tiff",                 # no crs=: keep the native UTM lattice
    )
    if not request.is_valid():
        raise ValueError(request.error_messages())
    job_id = client.submit(request)          # asynchronous jobs return the job id string
    print("Harmony job", job_id)             # write it to PROGRESS.md: results stay on the server 30 days
    client.wait_for_processing(job_id, show_progress=True)
    status = client.status(job_id)
    print(status.get("status"), status.get("message"))   # watch for complete_with_errors and paused
    Path(out_dir).mkdir(parents=True, exist_ok=True)
    return [f.result() for f in client.download_all(job_id, directory=str(out_dir), overwrite=False)]
```

Things the snippet relies on, with their evidence:

- `client.submit(request)` returns `body['jobID']` for asynchronous jobs. **docs** (harmony-py `client.py`, `submit`).
- `wait_for_processing` raises `ProcessingFailedException` on status `failed`, and simply returns on
  `paused` (after one line on stderr) or `canceled`. **docs** (harmony-py `client.py`).
- `download_all(job_id, directory='', overwrite=False)` yields futures whose `.result()` is the local file
  name. With `overwrite=False` an existing file is kept even if it is truncated. **docs** (its docstring).
- Local file names get the numeric work-item id as a prefix. **ran** (`out/harmony_py_download_name.txt`).

### 2.4 Raw REST form. UNTESTED

The URL is the one harmony-py printed for request 1 (**ran**, built only). The header and the polling
endpoint are from Harmony's documentation (**docs**, `<scratch>/verify/harmony/pages/harmony/docs.txt`).

```bash
# submit (returns JSON that includes "jobID")
curl -sS -L -H "Authorization: Bearer $EARTHDATA_TOKEN" \
  "https://harmony.earthdata.nasa.gov/C2854338529-ASF/ogc-api-coverages/1.0.0/collections/parameter_vars/coverage/rangeset?forceAsync=true&subset=lat%2833.9%3A34.2%29&subset=lon%28-118.5%3A-118.1%29&label=harmony-py&granuleId=G4381234094-ASF&format=image%2Ftiff&variable=%2Fscience%2FLSAR%2FGCOV%2Fgrids%2FfrequencyA%2FHHHH&variable=%2Fscience%2FLSAR%2FGCOV%2Fgrids%2FfrequencyA%2FHVHV"

# poll: fields "status", "progress", "message", "dataExpiration", "links"; data files are the links with rel == "data"
curl -sS -H "Authorization: Bearer $EARTHDATA_TOKEN" "https://harmony.earthdata.nasa.gov/jobs/<jobID>"

# with ~/.netrc instead of a token, Harmony's docs use:  curl -Lnbj "<url>"
```

Without credentials the first call answers `http=303` with a redirect to
`https://urs.earthdata.nasa.gov/oauth/authorize` (**ran**, `out/probe_unauthenticated.txt`).

### 2.5 NASA's own request code for this service (docs)

The Harmony regression tests contain the only "official" harmony-py requests for NISAR that the run
found. They pass the collection by short name and the granule by name. The default environment in the
notebook is UAT, and the suite is registered for UAT and SIT only, not for production
(`config/services_tests_config_prod.json` has no `hga` entry). **docs**

**File:** `<scratch>/verify/harmony/repos/nasa_harmony-regression-tests/test/hga/HGA_Regression.ipynb`, cell [6] (code)

*(Third-party code not reproduced here: see the source named above, which carries its own licence.)*

**File:** `<scratch>/verify/harmony/repos/nasa_harmony-regression-tests/test/hga/HGA_Regression.ipynb`, cell [9] (code)

*(Third-party code not reproduced here: see the source named above, which carries its own licence.)*

**File:** `<scratch>/verify/harmony/repos/nasa_harmony-regression-tests/test/hga/HGA_Regression.ipynb`, cell [11] (code)

*(Third-party code not reproduced here: see the source named above, which carries its own licence.)*

**File:** `<scratch>/verify/harmony/repos/nasa_harmony-regression-tests/test/hga/utility.py`

*(Third-party code not reproduced here: see the source named above, which carries its own licence.)*


What these tests tell a builder (my reading of the cells above):

- `GCOV_MULTI_VARIABLE_EXTRACT` asks for `frequencyB/VVVV` and `frequencyB/HHHH` from a `0005_NASV` granule
  (frequency A absent, frequency B VV only) and expects **1** file: the missing layer is skipped.
- `GCOV_MULTI_VARIABLE_EXTRACT_MISSING` asks for two layers that are both absent and expects the job to
  **fail**.
- `GCOV_EXTRACT_ALL` (no variables) expects 4 files for that granule: every layer present is extracted.
- `GCOV_SPATIAL_SUBSET_CONTAINED` expects bounds `(801360.0, 2324960.0, 811840.0, 2336080.0)` in EPSG:32627,
  all multiples of the 80 m posting: the output stays on the source lattice. This agrees with the local test.

Two more request examples written by the service's developers (**docs**, quoted from the saved GitHub JSON):

ASFHyP3/harmony-gdal issue 54 (the request that failed in UAT with `Maximum TIFF file size exceeded` before v0.0.3). **File:** `<scratch>/verify/harmony/out/github/ASFHyP3_harmony-gdal_issues_state_all_per_page_100.json`

*(Third-party code not reproduced here: see the source named above, which carries its own licence.)*

nasa/harmony pull request 975, comment of 2026-10-14 (confirmed by its author to work against CMR UAT). **File:** `<scratch>/verify/harmony/out/github/nasa_harmony_issue_975_comments.json`

*(Third-party code not reproduced here: see the source named above, which carries its own licence.)*


## 3. Collections, layers and capabilities

Queried live without login on 2026-11-13 and again on 2026-11-14 (`/capabilities?collectionId=...` for
all 44 ASF collections whose short name starts with NISAR). The two runs gave identical summaries. **ran**

| Short name | Concept id | Variables | Harmony services |
|---|---|---|---|
| `NISAR_L2_GCOV_BETA_V1` | `C3622214170-ASF` | 20 | nasa/harmony-gdal-adapter, asf/nisar-py |
| `NISAR_L2_GCOV_PROVISIONAL_V1` | `C2854338529-ASF` | 20 | nasa/harmony-gdal-adapter, asf/nisar-py |
| `NISAR_L2_GCOV_V1` | `C3622241360-ASF` | 20 | nasa/harmony-gdal-adapter, asf/nisar-py |
| `NISAR_L2_GOFF_BETA_V1` | `C2850263910-ASF` | 43 | nasa/harmony-gdal-adapter |
| `NISAR_L2_GOFF_PROVISIONAL_V1` | `C2854341702-ASF` | 43 | nasa/harmony-gdal-adapter |
| `NISAR_L2_GOFF_V1` | `C3622250865-ASF` | 43 | nasa/harmony-gdal-adapter |
| `NISAR_L2_GUNW_BETA_V1` | `C2850261892-ASF` | 23 | nasa/harmony-gdal-adapter |
| `NISAR_L2_GUNW_PROVISIONAL_V1` | `C2854335566-ASF` | 23 | nasa/harmony-gdal-adapter |
| `NISAR_L2_GUNW_V1` | `C3622247503-ASF` | 23 | nasa/harmony-gdal-adapter |
| `NISAR_L3_SME2_BETA_V1` | `C2850265000-ASF` | 13 | nasa/harmony-gdal-adapter |
| `NISAR_L3_SME2_PROVISIONAL_V1` | `C2854344945-ASF` | 13 | nasa/harmony-gdal-adapter |

The other 33 NISAR collections return `n_services=0`: all Level 0 and Level 1 products, GSLC (three
collections), `NISAR_UR_L1`, `NISAR_UR_L2` (urgent response), DEM, water mask and auxiliary collections.

For every supported collection the capabilities say the same thing:

```
subsetting={'bbox': True, 'dimension': False, 'shape': False, 'temporal': False, 'variable': True}
reprojection.supported=True crs=[3031,3413,4326,32601-32660,32701-32760] interp=[]
other summary keys: {'averaging': {'time': False, 'area': False}, 'concatenation': False, ...}
```

GCOV additionally lists `PNG`; that is the `asf/nisar-py` browse-image service, which does no extraction.
ASF's guide says the PNG option "will be greyed out and non-selectable for most users". **docs**

GCOV layer names and UMM-Var concept ids (identical for Beta, Provisional and Validated). **ran**

| Layer | UMM-Var name | Concept id |
|---|---|---|
| HH power, frequency A | `/science/LSAR/GCOV/grids/frequencyA/HHHH` | `V4137651715-ASF` |
| HV power, frequency A | `/science/LSAR/GCOV/grids/frequencyA/HVHV` | `V4137651725-ASF` |
| VH power, frequency A | `/science/LSAR/GCOV/grids/frequencyA/VHVH` | `V4137651763-ASF` |
| VV power, frequency A | `/science/LSAR/GCOV/grids/frequencyA/VVVV` | `V4137651771-ASF` |
| mask, frequency A | `/science/LSAR/GCOV/grids/frequencyA/mask` | `V4137651736-ASF` |
| number of looks, A | `/science/LSAR/GCOV/grids/frequencyA/numberOfLooks` | `V4137651748-ASF` |
| gamma-to-sigma factor, A | `/science/LSAR/GCOV/grids/frequencyA/rtcGammaToSigmaFactor` | `V4137651754-ASF` |
| HH power, frequency B (80 m) | `/science/LSAR/GCOV/grids/frequencyB/HHHH` | `V4137650465-ASF` |
| HV power, frequency B | `/science/LSAR/GCOV/grids/frequencyB/HVHV` | `V4137650467-ASF` |
| mask, frequency B | `/science/LSAR/GCOV/grids/frequencyB/mask` | `V4137650471-ASF` |

The full list for GCOV, GUNW, GOFF and SME2 is in Appendix B (`out/harmony_variables_by_collection.txt`).
Harmony matches a requested variable against the UMM-Var name or the concept id exactly
(`doesPathMatch` in `repos/harmony/services/harmony/app/util/variables.ts`: `s === v.umm.Name || s === v.meta['concept-id']`). **docs**

ASF's guide (`<scratch>/verify/harmony/pages/nisar-docs/harmony.txt`, fetched 2026-11-14) in its own words. **docs**

> This service provides Variable Subsetting, which extracts two-dimensional datasets from the
> /science/LSAR/$product-type/grids/ group as stand-alone Cloud-Optimized GeoTIFF (COG) files.

> Because the HDF5 files are more compressed, users who want access to multiple layers for the full file
> extent may be better served by downloading the full HD5 file, as they are more efficient to download than
> extracted GeoTIFF files.

> If no datasets are selected, every gridded dataset available in the list of variables will be extracted
> to individual GeoTIFFs, which will increase processing time.

> GeoTIFFs will be generated for any selected datasets that are present in the product, and any selected
> datasets that are not present will be ignored.

> By default, the Output Projection Selection option is set to No Reprojection and the output files are in
> the same coordinate system as the source HDF5 file.

## 4. What comes back

Method (**ran**): the second attempt built a conda-forge environment with GDAL 3.13.3 and the HDF5
driver and installed the service code at tag v0.0.3; the third attempt checked that the installed code is
identical to the tag (which equals upstream `main`; the production image is `asfhyp3/harmony-gdal:0.0.3`
per `/versions`) and re-ran everything. Both generated two synthetic "dates" of one track/frame on one
10 m UTM 11N lattice with slightly different extents, and drove the code the way the service does
(`RecipeInputOptions` -> `build_recipe` -> `execute_recipe`). The two runs' check results are identical
(`out/check_service_outputs.txt` and `out/cog_validate.txt` match the copies in `prior_run_20261113/out/`).
The service's image pins `gdal ==3.13.3`, `libgdal-hdf5 ==3.13.3`, `hdf5 ==2.2.0` (`environment.yml`),
the same GDAL as the local run.

Results (all on synthetic data; logs in Appendix B):

| Question | Answer | Evidence line |
|---|---|---|
| File per layer or multi-band? | One single-band file per variable per granule | `bands=1`; one `OK` line per variable in `out/run_service_recipes.txt` |
| Format | GeoTIFF with COG layout, LZW, 512 x 512 tiles, internal overviews, no predictor; passes `rio-cogeo` 7.0.4 validation | `valid_cog=True errors=[] warnings=[]`; `IMAGE_STRUCTURE={'LAYOUT': 'COG', 'COMPRESSION': 'LZW', 'INTERLEAVE': 'BAND', 'OVERVIEW_RESAMPLING': 'CUBIC'}` |
| Data type and nodata | float32 with nodata NaN for the covariance layers; mask is uint8 with nodata 255 | `dtype=Float32 nodata=nan`; `frequencyA_mask: ... dtype=Byte nodata=255.0` |
| Units | Values are copied, not scaled: kept pixels are bit-identical to the HDF5 values, so linear gamma-naught power | `kept values bit-identical to source=True` |
| Projection and grid without `crs` | Source CRS (UTM zone of the granule), source pixel size, origin on the source lattice | `offset from source origin (px)=(579.000000,633.000000) on source lattice=True` |
| Is the box exact? | No. Extent is the pixel-snapped envelope of the lat/lon box, and pixels of that rectangle outside the lat/lon box are set to nodata | `requested bbox in UTM 11N: x 370784.00..384765.10 ...` / `delivered extent (date 1): x 370790.00..384760.00 ...` / `NaN pixels inside delivered rectangle (date 1): 38353 of 1573022` |
| Two dates, box inside both granules | Identical geotransform and size | `TWO DATES, same bbox: geotransform identical=True size identical=True` |
| Two dates, box crossing the granule edge | Box is clipped to each granule; sizes and origins differ by whole pixels | `sizes=(618, 1225) vs (611, 1222)` / `origin difference in pixels: dx=7.000000 dy=3.000000` |
| Box outside the granule | Error | `FAIL bbox_outside    builtins.AssertionError: Subset polygon and source polygon do not overlap` |
| Reprojection to EPSG:4326 of whole granules | Dates no longer share a grid | `reproject_4326: two dates geotransform identical=False; pixel size identical=False; origin offset in output pixels dx=7.5522 dy=2.7029` |
| Reprojection to EPSG:3857 | Refused | `UnsupportedProjectionError: Requested projection is unsupported: EPSG:3857.` |
| Layer absent from the file | `MissingVariableError` in the recipe code; the service catches it and skips the layer | `Missing variable in input file: //science/LSAR/GCOV/grids/frequencyA/VVVV.` |
| File size | About 1.45 times the raw float32 array | `size_MB=9.13` for 1397 x 1126; `size_MB=46.11` for 3000 x 2600 |
| File name | `<granule>_science_LSAR_GCOV_grids_frequencyA_HHHH_subsetted.tif` with a box; no `_subsetted` without one | names in `out/run_service_recipes.txt` |
| Speed of the GDAL step | At most 1.0 s per layer on a 55 MB synthetic file (not the real cost: see Section 6) | `OK   bbox            GdalWarpRecipe         0.2s     9.13 MB` |

The recipe the service built for a box request, as printed by the service code. **ran**

```
Recipe(inner=GdalWarpRecipe(warp_options=GdalWarpOptions(spatial_subset=GdalWarpCutlineSpatialSubset(
           cutline_wkt='POLYGON ((-118.4 34.05,-118.4 34.15,-118.25 34.15,-118.25 34.05,-118.4 34.05))',
           cutline_srs='EPSG:4326', cutline_where=None, cutline_sql=None, cutline_blend=None, crop_to_cutline=True),
       target_srs=None, source_srs=None, src_alpha=None, dst_alpha=None, multithreaded=True, copy_metadata=True),
   gdal_options=GdalOptions(input_options=GdalInputOptions(driver='HDF5',
           dataset_path='//science/LSAR/GCOV/grids/frequencyA/HHHH',
           input_file_path='mock/h5/NISAR_L2_PR_GCOV_MOCK_..._001.h5', virtual_filesystem=None),
       output_options=GdalOutputOptions(output_type='COG', output_file_path='mock/out/bbox/..._HHHH_subsetted.tif',
           creation_options={'BIGTIFF': 'IF_SAFER', 'NUM_THREADS': 'ALL_CPUS'}), config_options=None)))
```

(Whitespace condensed by me; the verbatim print is in Appendix B.) So the GDAL input string is
`HDF5:"<file>"://science/LSAR/GCOV/grids/frequencyA/HHHH`, the same form the brief gives for access path 3.

Two points that are inference, not test results:

- The recipe sets no resampling method. **docs** (`gdal.py`, `_WarpOptions` has no resampling key.) That
  GDAL then uses nearest neighbour when it reprojects is my general knowledge of GDAL. **belief**
- Overviews carry `OVERVIEW_RESAMPLING=CUBIC`. **ran** That this makes them unsuitable for linear-power
  statistics is my inference; the run did not test it.

Why real dates of one stack should share a lattice (**docs**, not tested on real files): the GCOV
specification, Appendix B, says "NISAR L2 products will be generated on a pre-defined Track/Frame system",
and the processor's geogrid code snaps start coordinates to multiples of `x_snap` / `y_snap`
(`downloads/isce3/python_packages_nisar_workflows_geogrid.py`, lines 294-298). The values used in
production were not seen.

## 5. Login, and what works without it

Probe results, no credentials, redirects not followed. **ran** (`out/probe_unauthenticated.txt`, `out/probe_sidecars.txt`)

| Endpoint | Without login |
|---|---|
| `https://harmony.earthdata.nasa.gov/` , `/docs`, `/versions` | 200 |
| `/capabilities?collectionId=...` (also `?shortName=...`) | 200 |
| any `/<collection>/ogc-api-coverages/...` request, EDR `/cube`, `/jobs`, `/jobs/<id>`, `/cloud-access`, `/workflow-ui`, `/service-results/...` | 303 to `urs.earthdata.nasa.gov/oauth/authorize` |
| CMR collection, granule and variable searches | 200 |
| ASF `.h5`, `.h5.iso.xml`, `.rc.yaml`, every `.kml`, `QA_REPORT.pdf`, `QA_SUMMARY.csv`, `QA_STATS.h5`, `/s3credentials` | 302 to Earthdata Login |
| ASF `/BROWSE/.../<granule>_LATLON.png`, `_LATLON_thumbnail.png`, `_NATIVE.png`, `_NATIVE_A_HHHH.png`, `_NATIVE_A_HVHV.png`, `_NATIVE_B_HHHH.png` | 303 to CloudFront, then 200 |

harmony-py 1.8.0 behaviour. **ran** (`out/harmony_py_no_login.txt`, `out/harmony_py_auth_check.txt`)

```
--- A) Client() with no credentials (validates against /jobs)
UNEXPECTED: client created and validated
--- C) submit() of a NISAR GCOV request, no login
request.is_valid(): True
builtins.Exception: Harmony returned a non-JSON response. This may indicate an authentication failure. Try using a token ...
```

```
return value: None
stdout printed by harmony-py (first 80 chars): 'Request is successful. Raw response: <!DOCTYPE html>\n<!--[if lt IE 7]><html clas'
AUTHENTICATED: False
bogus token -> builtins.Exception: ('Unauthorized', 'Error: You are not authorized to access the requested resource')
```

Why `Client()` passes: its validation fetches `<root>/jobs` and accepts HTTP 200, and the unauthenticated
redirect ends on the login page with 200. **docs** (`harmony/auth.py`, `validate_auth`; `harmony/config.py`, `edl_validation_url`)

Where harmony-py looks for credentials, in order. **docs** (`harmony/auth.py`, `create_session`)

1. `Client(token="...")`: sent as `Authorization: Bearer`.
2. `Client(auth=("user", "password"))`.
3. Environment variables `EDL_USERNAME` and `EDL_PASSWORD` (also read from a `.env` file in the working directory).
4. `~/.netrc` entry for `urs.earthdata.nasa.gov`.

It does not look at `EARTHDATA_TOKEN`, `EARTHDATA_USERNAME` or `EARTHDATA_PASSWORD`.

EULA. **docs** ASF's Cookbook (`downloads/cookbook/notebooks_set_up_Earthdata_Login.md`): "You must have an
Earthdata Login account and accept the `Alaska Satellite Facility Data Access` EULA (End User License
Agreement) to access NISAR data." The service downloads the granule with the requesting user's token
(`harmony_service.py` lines 56-61), so expect a Harmony job to need it too. Not tested.

## 6. Limits, timing and maturity

Everything in this section is **docs** (documentation, GitHub, source). None of it was observed on a job.

- **Whole-granule download per date.** `harmony_service.py` calls
  `download(url=granule_url, destination_dir=temp_dir, ..., access_token=self.message.accessToken)` and only
  then builds the GDAL recipe. The cost of a job is the granule size, not the window size.
- **Timing on record is for the older chain.** nasa/harmony issue 905 (May 2026, `net2cog`): 14 GCOV
  granules, all variables. First try: "10 succeeded and 4 failed over the course of 40 minutes" (the four
  10 m granules ran out of memory). After the memory limit went to 20 Gi: "All 14 granules succeed now.
  Most still required retries ... End-to-end runtime was 68 minutes." The same ASF developer: "68 minutes
  to process my 14-granule request is long enough to minimize the value of using the service". A Harmony
  team member logged one granule download at 3 min 11 s ("I think the downloads are long, but not the
  main issue at this point. About 3 min.").
- **Work-item timeout.** `services/work-failer/app/workers/failer.ts` gives the three GCOV collections 35
  minutes under the service key `net2cog`; any other service falls back to `DEFAULT_TIMEOUT_SECONDS=300`.
  The new adapter's image is `asfhyp3/harmony-gdal`, which that table does not list. Whether production
  has a different setting is unknown. This is my reading of the source, flagged as an open question.
- **Preview pause.** Harmony docs: "The current threshold in this environment for the number of granules
  that will trigger automatic pausing of a job is 300." `skipPreview=true` avoids it.
- **Result retention.** `export const EXPIRATION_DAYS = 30;` (`services/harmony/app/models/job.ts`); the job
  status carries `dataExpiration`.
- **Retries and partial failure.** `WORK_ITEM_RETRY_LIMIT=5`; `ignoreErrors` "Defaults to true"; harmony-py
  lists `complete_with_errors` among the terminal job statuses.
- **Granule limits.** The adapter's entry in `config/services-prod.yml` sets no `granule_limit` and no
  `maximum_sync_granules`. Source defaults: `MAX_SYNCHRONOUS_GRANULES=1`, `MAX_GRANULE_LIMIT=10000000`.
  Defaults are not proof of production values (the docs say 300 for the preview threshold, the default file says 100).
- **Maturity.** Releases of `ASFHyP3/harmony-gdal`: v0.0.1 2026-10-13, v0.0.2 2026-10-26 (COG output),
  v0.0.3 2026-11-06 ("Enable multithreading and BigTiff creation for NISAR"). nasa/harmony pull request
  989, "Release Harmony GDAL Adapter to Production", merged 2026-11-09. README: "Currently the Harmony GDAL
  Adapter is in early development status and only supports NISAR data." ASF roadmap: "NISAR Dataset
  Spatial Subsetting and Reprojection for GCOV, GUNW, GOFF, SME2 ... Complete | Nov 2026".
- **Known failure fixed in 0.0.3.** Issue 54: extracting `frequencyA/numberOfLooks` from a full 10 m
  granule (40,680 x 40,608 pixels) failed in UAT with "Maximum TIFF file size exceeded. Use BIGTIFF=YES
  creation option."; 0.0.3 sets `BIGTIFF=IF_SAFER`.

## 7. Choosing granules, and why not to leave it to Harmony

**ran** (`out/cmr_gcov_search_provisional_LA.txt`; tally computed from that file during recovery)

A box of 0.4 x 0.3 degrees over Los Angeles (`-118.5,33.9,-118.1,34.2`) in the provisional GCOV collection:

- 104 granules, 678.6 GB in total;
- five stacks: `013_D_071` (26), `034_A_019` (26), `114_D_071` (25), `106_A_019` (24), `013_D_072` (3);
- two acquisitions present twice, with counters `_001` and `_002` (2026-06-21 on `106_A_019`, 2026-06-22 on `114_D_071`);
- two dates with mode `0005` and polarization `NADV` (frequency B only, V transmit, 0.32 and 0.35 GB),
  on 2025-12-12 (`114_D_071`) and 2025-12-17 (`013_D_071`), inside stacks that are otherwise `4005` `DHDH`;
- stack `106_A_019` alone: 24 granules from 2025-12-23 to 2026-10-19, 166.5 GB.

A request with only a box and a date range would have Harmony download and cut all of them. Pick one
stack, drop duplicates (keep the highest counter), drop dates whose mode or polarization does not fit, and
pass the granule concept ids.

A date range still works as a filter. **docs**, read in the saved Harmony source, not run: the service
chooser treats spatial and temporal subsetting as optional (`requiredFilterFns` in
`services/harmony/app/models/services/index.ts` leaves them out; the fallback message is "Data in output
files may extend outside the spatial and temporal bounds you requested."), and the time range goes into
the CMR granule query (`cmr-granule-locator.ts`: `cmrQuery.temporal = ...`). A request with a time range
therefore takes this best-effort branch (`shouldTemporalSubset` is true whenever a time range is given,
and the adapter reports `temporal: False`). Whether the box is still applied in that branch was not
verified, which is one more reason to pass granule ids and no time range.

## 8. Alternatives to Harmony

- **OPeNDAP: none.** **ran** (`out/check_opendap_and_tools.txt`) The three GCOV collections have service
  associations for the two Harmony services only and no tool association; `URLs mentioning opendap/dmrpp: 0`
  across 104 granules; `opendap_links_in_5_newest=0` for each collection.
- **HyP3: not for NISAR yet.** **docs** "These services are currently only available for Sentinel-1
  datasets." (`prior_run_20261113/pages/other/hyp3_docs_home.txt`). ASF's roadmap lists NISAR HyP3 products
  as unscheduled.
- **OpenScienceLab / OpenSARLab.** **docs** "Signing up is free and includes access to ASF's OpenSARLab";
  it is a JupyterHub running in AWS (its sign-in page is hosted in us-west-2), a place to run code and not
  a subsetting service. Whether code there can use the S3 links directly was not checked. No approval step
  or quota was stated on the pages read. Not tried.
- **NISAR HDF5 spatial subsetting in Harmony** (HDF5 in, HDF5 out): roadmap says "Pending | 2027". **docs**
- **Local GDAL.** **ran** on synthetic data: GDAL 3.13.3 with `libgdal-hdf5` from conda-forge does the same
  cut locally (Appendix D has the commands). ASF's guide says "GDAL's vsicurl virtual file system driver
  allows users to subset NISAR HDF5 files without downloading the entire HDF5 file first or leveraging
  Harmony services." **docs**; remote reads of real files were not tested here.

## 9. Facts (structured result)

**F1. [ran]** Harmony production serves 11 NISAR collections, all through one service chain, nasa/harmony-gdal-adapter (UMM-S S4389714698-ASF, image asfhyp3/harmony-gdal:0.0.3): GCOV Beta C3622214170-ASF, Provisional C2854338529-ASF, Validated C3622241360-ASF; GUNW C2850261892-ASF, C2854335566-ASF, C3622247503-ASF; GOFF C2850263910-ASF, C2854341702-ASF, C3622250865-ASF; SME2 C2850265000-ASF, C2854344945-ASF. The other 33 NISAR collections, including GSLC, all Level 1 and urgent-response NISAR_UR_L2 (C2887502657-ASF), have no Harmony service.

- Evidence: <scratch>/verify/harmony/out/harmony_capabilities_summary.txt: 'NISAR_L2_GCOV_PROVISIONAL_V1 C2854338529-ASF http=200 ... n_variables=20 n_services=2 services=['nasa/harmony-gdal-adapter', 'asf/nisar-py']' and 'NISAR_UR_L2 C2887502657-ASF http=200 ... n_variables=0 n_services=0 services=[]'; <scratch>/verify/harmony/out/fetch_service_metadata.txt: 'nasa/harmony-gdal-adapter    image=asfhyp3/harmony-gdal tag=0.0.3'

**F2. [ran]** For GCOV the service offers bounding-box and variable subsetting, and reprojection only to EPSG:4326, 3031, 3413 and the UTM zones 32601-32660 and 32701-32760. Shape, temporal and dimension subsetting, concatenation and a choice of interpolation are not offered. Extraction output is image/tiff only; the PNG format listed for GCOV belongs to the separate asf/nisar-py browse service.

- Evidence: <scratch>/verify/harmony/out/harmony_capabilities_summary.txt: 'subsetting={'bbox': True, 'dimension': False, 'shape': False, 'temporal': False, 'variable': True}' and 'reprojection.supported=True crs=[3031,3413,4326,32601-32660,32701-32760] interp=[]'

**F3. [ran]** Layers are named by the full HDF5 path with a leading slash (the UMM-Var name) or by UMM-Var concept id. GCOV has 20 variables, identical in name and id across Beta, Provisional and Validated. Frequency A: HHHH V4137651715-ASF, HVHV V4137651725-ASF, VHVH V4137651763-ASF, VVVV V4137651771-ASF, mask V4137651736-ASF, numberOfLooks V4137651748-ASF, rtcGammaToSigmaFactor V4137651754-ASF, plus six off-diagonal terms. Frequency B: HHHH V4137650465-ASF, HVHV V4137650467-ASF, VHVH V4137650477-ASF, VVVV V4137650481-ASF, mask V4137650471-ASF, numberOfLooks V4137650474-ASF, rtcGammaToSigmaFactor V4137650475-ASF.

- Evidence: <scratch>/verify/harmony/out/harmony_variables_by_collection.txt: 'variable list (names + UMM-Var concept ids) identical across these collections: True; count=20' and '/science/LSAR/GCOV/grids/frequencyA/HHHH  V4137651715-ASF'

**F4. [ran]** The harmony-py request for one granule, two layers and a bounding box in the native projection is Request(collection=Collection(id='C2854338529-ASF'), granule_id=['G4381234094-ASF'], spatial=BBox(w=-118.5, s=33.9, e=-118.1, n=34.2), variables=['/science/LSAR/GCOV/grids/frequencyA/HHHH', '/science/LSAR/GCOV/grids/frequencyA/HVHV'], format='image/tiff'). harmony-py 1.8.0 validates it and sends it to https://harmony.earthdata.nasa.gov/C2854338529-ASF/ogc-api-coverages/1.0.0/collections/parameter_vars/coverage/rangeset with forceAsync=true, subset=lat(33.9:34.2), subset=lon(-118.5:-118.1), granuleId, format=image/tiff and one variable= parameter per layer. Date range (subset=time), outputcrs, granuleName wildcards, maxResults and skipPreview variants were built the same way. All were validated client-side only; none was submitted.

- Evidence: <scratch>/verify/harmony/out/build_nisar_requests.txt: '1) one granule + bbox, HHHH+HVHV by UMM-Var name / is_valid: True | errors: []' followed by the decoded URL '...rangeset?forceAsync=true&subset=lat(33.9:34.2)&subset=lon(-118.5:-118.1)&label=harmony-py&granuleId=G4381234094-ASF&format=image/tiff&variable=/science/LSAR/GCOV/grids/frequencyA/HHHH&variable=/science/LSAR/GCOV/grids/frequencyA/HVHV'

**F5. [ran]** No Harmony job was run in any attempt. Without credentials every coverage, EDR, job, result and cloud-access endpoint answers 303 to the Earthdata Login page; only the landing page, /docs, /versions and /capabilities are public. Real service output, turnaround time and behaviour on real NISAR files are therefore unverified.

- Evidence: <scratch>/verify/harmony/out/probe_unauthenticated.txt: 'coverages request (NISAR GCOV)     http=303 redirect=https://urs.earthdata.nasa.gov/oauth/authorize?<query-elided>' and 'capabilities collectionId          http=200'

**F6. [ran]** harmony-py's Client() does not fail when no credentials exist, because its validation request receives the login page with HTTP 200. The failure appears at submit() as 'Harmony returned a non-JSON response. This may indicate an authentication failure.' A reliable check is client.submit(JobsRequest(limit=1)): it returns a dict with a 'count' key only when logged in, returns None without login, and raises ('Unauthorized', ...) with a bad token.

- Evidence: <scratch>/verify/harmony/out/harmony_py_no_login.txt: 'UNEXPECTED: client created and validated'; <scratch>/verify/harmony/out/harmony_py_auth_check.txt: 'AUTHENTICATED: False' and 'bogus token -> builtins.Exception: ('Unauthorized', 'Error: You are not authorized to access the requested resource')'

**F7. [docs]** harmony-py 1.8.0 takes credentials from Client(token=...), Client(auth=(user, password)), the environment variables EDL_USERNAME and EDL_PASSWORD (also loaded from a .env file in the working directory), or ~/.netrc for urs.earthdata.nasa.gov. It does not read EARTHDATA_TOKEN, EARTHDATA_USERNAME or EARTHDATA_PASSWORD.

- Evidence: <scratch>/verify/harmony/venv_fresh/lib/python3.12/site-packages/harmony/auth.py lines 128-142: 'edl_username = config.EDL_USERNAME' ... 'if token: session = SessionWithHeaderRedirection(token=token)' ... 'elif edl_username and edl_password:'; config.py line 51 'load_dotenv()'

**F8. [ran]** Output of the deployed service code (harmony_gdal_adapter 0.0.3, source identical to tag v0.0.3, with GDAL 3.13.3, run locally on two synthetic GCOV-like granules): one single-band float32 Cloud-Optimized GeoTIFF per variable per granule, LZW, 512-pixel tiles, internal overviews, nodata NaN (the mask layer comes out uint8 with nodata 255). Without reprojection it stays in the granule's UTM zone on the source pixel lattice and the kept pixel values are bit-identical to the HDF5 values, so units stay linear gamma-naught power. All eight output kinds pass rio-cogeo validation.

- Evidence: <scratch>/verify/harmony/out/check_service_outputs.txt: '20260913 frequencyA_HHHH: size=(1397, 1126) origin=(370790.0, 3779670.0) pixel=(10.0, -10.0) dtype=Float32 nodata=nan epsg=32611' and 'on source lattice=True values identical to the same source window=True layout=COG compression=LZW predictor=None block=[512, 512] overviews=[(698, 563), (349, 281)] bands=1'; <scratch>/verify/harmony/out/cog_validate.txt: 'valid_cog=True errors=[] warnings=[]'

**F9. [ran]** The bounding box is applied as a latitude/longitude polygon cutline with crop-to-cutline. The delivered rectangle therefore carries nodata wedges along its edges (2.4 percent of pixels in the test), and the box is first clipped to the granule extent, so at a granule edge two dates return different sizes and origins while staying on the same lattice. A box that misses the granule raises AssertionError.

- Evidence: <scratch>/verify/harmony/out/check_service_outputs.txt: 'NaN pixels inside delivered rectangle (date 1): 38353 of 1573022 (corners outside the lat/lon box are cut to nodata by the cutline)' and 'TWO DATES, same bbox at the edge: geotransform identical=False sizes=(618, 1225) vs (611, 1222)' and 'origin difference in pixels: dx=7.000000 dy=3.000000 (integer => still the same lattice)'

**F10. [ran]** Two dates that share a pixel lattice and fully contain the box come back with identical geotransform and size. Server-side reprojection breaks this: reprojecting whole granules to EPSG:4326 gave different pixel sizes and a non-integer offset between the two dates. EPSG:3857 is rejected by the service.

- Evidence: <scratch>/verify/harmony/out/check_service_outputs.txt: 'TWO DATES, same bbox: geotransform identical=True size identical=True' and 'reproject_4326: two dates geotransform identical=False; pixel size identical=False; origin offset in output pixels dx=7.5522 dy=2.7029'; <scratch>/verify/harmony/out/run_service_recipes.txt: 'FAIL bbox_3857       harmony_gdal_adapter.exceptions.UnsupportedProjectionError: Requested projection is unsupported: EPSG:3857.'

**F11. [docs]** A requested variable that the granule does not contain is skipped without an error and produces no file; if none of the requested variables exists, that granule's work item fails with 'None of the requested variables are present in the source file.' If no variables are given, every listed variable is extracted, and harmony-py's default is variables=['all'].

- Evidence: <scratch>/verify/harmony/repos/harmony-gdal_v0.0.3/src/harmony_gdal_adapter/harmony_service.py lines 104-106 'except MissingVariableError: self.logger.info('Variable is not present in source dataset, skipping.'); continue' and lines 120-121 'if result.assets == {}: raise EmptyOutputError'; <scratch>/verify/harmony/pages/nisar-docs/harmony.txt: 'any selected datasets that are not present will be ignored'

**F12. [ran]** Output file names are <granule>_science_LSAR_GCOV_grids_frequencyA_HHHH_subsetted.tif for a bounding-box request, and the same without _subsetted when no box is given (reprojection adds no suffix). harmony-py saves each file with the numeric work-item id prefixed, downloads 3 files in parallel and polls job status every 3 seconds.

- Evidence: <scratch>/verify/harmony/out/harmony_py_download_name.txt: 'local file name: 123456789_NISAR_L2_PR_GCOV_033_106_A_019_4005_DHDH_A_20261019T130003_20261019T130038_P05023_N_F_J_001_science_LSAR_GCOV_grids_frequencyA_HHHH_subsetted.tif' and 'NUM_REQUESTS_WORKERS (parallel downloads): 3 | DOWNLOAD_CHUNK_SIZE: 4194304' and 'check_interval (s): 3.0'

**F13. [ran]** Delivered COGs are larger than the raw float32 array: 9.13 MB for 1397 x 1126 pixels (6.3 MB raw) and 46.1 MB for 3000 x 2600 (31.2 MB raw), about 1.45 times, from LZW without a predictor plus overviews. Measured on synthetic data. At that ratio a 100 x 100 km window at 20 m is roughly 150 MB per layer per date, and four times that at 10 m.

- Evidence: <scratch>/verify/harmony/out/cog_validate.txt: 'bbox            ...cience_LSAR_GCOV_grids_frequencyA_HHHH_subsetted.tif valid_cog=True errors=[] warnings=[] size_MB=9.13' with 'Width': 1397, 'Height': 1126, and 'extract ... size_MB=46.11' with 'Width': 3000, 'Height': 2600

**F14. [docs]** For every granule the service first downloads the whole HDF5 file with the requesting user's token and then runs gdal.Translate or gdal.Warp on the local copy; it does not read remotely. The only timing on record is for the previous NISAR chain (net2cog, May 2026): 14 granules with all variables took 68 minutes with retries, of which about 3 minutes per granule was download. No timing exists for the current adapter.

- Evidence: <scratch>/verify/harmony/repos/harmony-gdal_v0.0.3/src/harmony_gdal_adapter/harmony_service.py lines 56-61 'granule_filename = download(url=granule_url, destination_dir=temp_dir, logger=self.logger, access_token=self.message.accessToken)'; <scratch>/verify/harmony/out/github/nasa_harmony_issue_905_comments.json: 'All 14 granules succeed now. Most still required retries, but they're at least all passing. End-to-end runtime was 68 minutes.'

**F15. [docs]** The service is days old in production: harmony-gdal v0.0.1 was released 2026-10-13, v0.0.3 on 2026-11-06 (adding BIGTIFF after 'Maximum TIFF file size exceeded' on a full 10 m layer), and the pull request releasing it to Harmony production was merged 2026-11-09. Its README says it is in 'early development status'. ASF's roadmap marks spatial subsetting and reprojection as completed in November 2026. The production regression-test configuration does not list the adapter's test suite.

- Evidence: <scratch>/verify/harmony/out/github/ASFHyP3_harmony-gdal_releases_per_page_20.json (v0.0.3 published 2026-11-06T23:19:08Z, v0.0.1 2026-10-13T23:51:43Z); <scratch>/verify/harmony/out/github/nasa_harmony_issue_989.json ('Release Harmony GDAL Adapter to Production', merged_at 2026-11-09T21:40:36Z); <scratch>/verify/harmony/repos/harmony-gdal_v0.0.3/README.md: 'Currently the Harmony GDAL Adapter is in early development status and only supports NISAR data.'

**F16. [docs]** Limits read in documentation and source, none observed on a job: requests reaching the threshold of 300 input granules auto-pause for a preview unless skipPreview=true; result files are deleted 30 days after the job was created; failed work items are retried up to 5 times and ignoreErrors defaults to true, so a job can finish as 'complete_with_errors'; no per-service granule limit is configured for the adapter in services-prod.yml. The default work-item timeout in source is 300 seconds and the 35-minute NISAR override is keyed to the old service name net2cog, so the timeout that applies to the new adapter is unknown.

- Evidence: <scratch>/verify/harmony/pages/harmony/docs.txt: 'Note: The current threshold in this environment for the number of granules that will trigger automatic pausing of a job is 300.'; <scratch>/verify/harmony/repos/harmony/services/harmony/app/models/job.ts line 26 'export const EXPIRATION_DAYS = 30;'; <scratch>/verify/harmony/repos/harmony/services/work-failer/app/workers/failer.ts lines 39-52 'const NISAR_TIMEOUT_MINUTES: number = 35;' under the key 'net2cog'

**F17. [ran]** Letting Harmony pick granules by box and date is expensive and messy. A 0.4 x 0.3 degree box over Los Angeles matches 104 provisional GCOV granules totalling 679 GB, from five stacks (013_D_071, 013_D_072, 034_A_019, 106_A_019, 114_D_071), including two reprocessed duplicates (counters _001 and _002 of one acquisition) and two frequency-B-only dates (mode 0005, polarization NADV, 0.3 GB) inside otherwise 4005 DHDH stacks. One stack alone, 106_A_019, is 24 granules and 167 GB.

- Evidence: <scratch>/verify/harmony/out/cmr_gcov_search_provisional_LA.txt: 'CMR-Hits: 104 returned: 104'; 'G4244992188-ASF  2026-06-21T13:00:07.000000Z  ..._P05023_N_F_J_001  h5_size_GB=6.824' next to 'G4275299786-ASF  2026-06-21T13:00:07.000000Z  ..._P05023_N_F_J_002  h5_size_GB=6.824'; 'NISAR_L2_PR_GCOV_007_114_D_071_0005_NADV_A_20251212T024855_20251212T024930_P05023_N_F_J_001  h5_size_GB=0.323'

**F18. [docs]** A time range in a request still works as a granule filter although the service reports temporal subsetting as unsupported: Harmony treats spatial and temporal subsetting as best-effort when it chooses a service and passes the time range to its CMR granule query. Such a request takes the best-effort branch, and whether the box is still applied there was not verified. This comes from reading Harmony's source in the saved clone (partly during this recovery); it was not run.

- Evidence: <scratch>/verify/harmony/repos/harmony/services/harmony/app/models/services/index.ts: the list requiredFilterFns omits filterTemporalSubsettingMatches, and 'const bestEffortMessage = 'Data in output files may extend outside the spatial and temporal bounds you requested.';'; <scratch>/verify/harmony/repos/harmony/services/harmony/app/middleware/cmr-granule-locator.ts line 207 'cmrQuery.temporal = `${start || ''},${end || ''}`;'

**F19. [ran]** There is no OPeNDAP access for NISAR GCOV. CMR lists no OPeNDAP link and no tool association for the three GCOV collections, for the 104 Los Angeles granules, or for the 5 newest granules of each collection.

- Evidence: <scratch>/verify/harmony/out/check_opendap_and_tools.txt: 'URLs mentioning opendap/dmrpp: 0' and 'NISAR_L2_GCOV_PROVISIONAL_V1: hits=163672 newest_start=2026-10-21T20:37:40.000000Z opendap_links_in_5_newest=0'

**F20. [docs]** No other server-side subsetting exists for NISAR, so Harmony is the only one. ASF's HyP3 on-demand service is Sentinel-1 only and NISAR products there are unscheduled. OpenScienceLab (OpenSARLab) is a free-signup JupyterHub in AWS, a place to run code and not a subsetting service; it was not tried. ASF's roadmap puts Harmony HDF5-to-HDF5 spatial subsetting in 2027.

- Evidence: <scratch>/verify/harmony/prior_run_20261113/pages/other/hyp3_docs_home.txt lines 577-578: 'These services are currently only available for Sentinel-1 datasets'; <scratch>/verify/harmony/pages/nisar-docs/roadmap.txt: the row 'NISAR HDF5 Spatial Subsetting' ends '| Pending | 2027'

**F21. [ran]** A local GDAL 3.13.3 with the HDF5 driver was built on this Mac (arm64, no system GDAL) with micromamba from conda-forge: python=3.14 gdal=3.13.3 libgdal-hdf5=3.13.3 libgdal-netcdf=3.13.3 h5py numpy pip. In it the service's exact code path, HDF5:"file.h5"://science/LSAR/GCOV/grids/frequencyA/HHHH into gdal.Warp with a cutline and the COG driver, took at most 1.0 second per layer on 55 MB synthetic files, and the service's own reference outputs were reproduced with equal grids and data.

- Evidence: <scratch>/verify/harmony/out/run_service_recipes.txt: 'harmony_gdal_adapter 0.0.3 | GDAL 3.13.3' and 'OK   bbox            GdalWarpRecipe         0.2s     9.13 MB'; <transcripts>/wf_0472d927-435/agent-a6f8b12e2bbd50095.jsonl tool result toolu_01BPj1KpTueRjmzGR6j8T8GV: 'output_spatial_subset_bounding_box.tif           grid_equal=True data_equal=True'

**F22. [docs]** ASF's NISAR Cookbook states that NISAR data access needs an Earthdata Login account that has accepted the 'Alaska Satellite Facility Data Access' EULA. The NISAR Data User Guide pages do not mention it. Whether a Harmony job fails without the EULA was not tested; because the service downloads the granule with the user's token, assume it is needed.

- Evidence: <scratch>/verify/harmony/downloads/cookbook/notebooks_set_up_Earthdata_Login.md: 'You must have an Earthdata Login account and accept the `Alaska Satellite Facility Data Access` {abbr}`EULA (End User License Agreement)` to access NISAR data.'

**F23. [ran]** Public without login (303 redirect to a CloudFront URL): _LATLON.png, _LATLON_thumbnail.png, _NATIVE.png, _NATIVE_A_HHHH.png, _NATIVE_A_HVHV.png and _NATIVE_B_HHHH.png under /BROWSE/; four of them were also downloaded with HTTP 200. Login required (302 to Earthdata Login): the .h5, .h5.iso.xml, .rc.yaml, every .kml, QA_REPORT.pdf, QA_SUMMARY.csv, QA_STATS.h5 and /s3credentials.

- Evidence: <scratch>/verify/harmony/out/probe_sidecars.txt: 'BROWSE/<granule>_NATIVE_A_HHHH.png http=303 redirect=https://d1mv8zhcvry6x4.cloudfront.net/...' and 'NISAR/<granule>_LATLON.kml         http=302 redirect=https://urs.earthdata.nasa.gov/...'

## 10. Corrections to the brief (structured result)

**C1. Section 4.5 Access, 'Data needs a free Earthdata Login' bullet (and item 3 of the team box)** (severity: blocks-build)

- Brief says: Login is supplied through ~/.netrc, or EARTHDATA_TOKEN, or EARTHDATA_USERNAME and EARTHDATA_PASSWORD; the team should have 'a ~/.netrc line or a token'.
- Actually: Those variable names belong to earthaccess. harmony-py reads ~/.netrc, EDL_USERNAME and EDL_PASSWORD, or an explicit Client(token=...) or Client(auth=...). With only EARTHDATA_TOKEN set, Client() still reports success and the first submit fails with 'Harmony returned a non-JSON response', which looks like a service fault. This blocks the Harmony path only, and only for token-only setups; the fix is Client(token=os.environ['EARTHDATA_TOKEN']) plus a JobsRequest check.
- Evidence: <scratch>/verify/harmony/venv_fresh/lib/python3.12/site-packages/harmony/auth.py lines 128-142 (EDL_USERNAME, EDL_PASSWORD, token, auth, netrc only); <scratch>/verify/harmony/out/harmony_py_no_login.txt: 'UNEXPECTED: client created and validated' then 'builtins.Exception: Harmony returned a non-JSON response. This may indicate an authentication failure.'

**C2. Section 4.5 Access, 'Three ways to get just your window', item 2 (NASA Harmony); also 6.3** (severity: minor)

- Brief says: Harmony 'extracts GCOV, GUNW, GOFF and SME2 layers as Cloud-Optimized GeoTIFFs with bounding-box subsetting and reprojection. Needs login. (unverified: no job was run)'.
- Actually: The capability is confirmed live for 11 collections and the request form is confirmed client-side, but still no job has been run. Reprojection is limited to EPSG:4326, 3031, 3413 and UTM zones; EPSG:3857 is rejected, so Harmony cannot deliver the EPSG:3857 COGs of Section 6.3 and the local warp stays. Reprojected outputs of different dates are not pixel-aligned. Output is one float32 single-band COG per layer per granule, never multi-band, and each is about 1.45 times the raw array size.
- Evidence: <scratch>/verify/harmony/out/harmony_capabilities_summary.txt: 'reprojection.supported=True crs=[3031,3413,4326,32601-32660,32701-32760]'; <scratch>/verify/harmony/out/run_service_recipes.txt: 'UnsupportedProjectionError: Requested projection is unsupported: EPSG:3857.'; <scratch>/verify/harmony/out/check_service_outputs.txt: 'reproject_4326: two dates geotransform identical=False; pixel size identical=False'

**C3. Section 6.2 Pipeline stages, step 3 (Process)** (severity: minor)

- Brief says: 'Put every date on one identical grid; dates of one stack should already share it, so assert that instead of assuming.'
- Actually: With Harmony box outputs the lattice is shared but the extent need not be: the box is clipped to each granule's extent and cut along the lat/lon box edges, so sizes and origins can differ by whole pixels between dates and the edges hold NaN wedges. Assert equal pixel size and lattice phase, then paste each date into one fixed window; an assertion on equal shape or geotransform can fail at frame edges. Shown on synthetic granules only.
- Evidence: <scratch>/verify/harmony/out/check_service_outputs.txt: 'TWO DATES, same bbox at the edge: geotransform identical=False sizes=(618, 1225) vs (611, 1222)' and 'origin difference in pixels: dx=7.000000 dy=3.000000 (integer => still the same lattice)'

**C4. Section 4.7 Things that will bite, first bullet (and the mode and polarization codes in 4.3)** (severity: minor)

- Brief says: 'Polarization and mode change between dates of one stack. Some dates are HH only; some switch between 20 and 40 MHz.'
- Actually: Some dates have no frequency A at all and are V-polarized: two Los Angeles stacks contain mode 0005, polarization NADV granules (0.3 GB) among 4005 DHDH ones. On such a date a request for frequencyA/HHHH yields no file, or a failed work item if no requested variable exists. Reprocessed duplicates of one acquisition (counters _001 and _002) also coexist in the provisional collection and both would be processed.
- Evidence: <scratch>/verify/harmony/out/cmr_gcov_search_provisional_LA.txt: 'G4275105470-ASF  2025-12-12T02:48:55.000000Z  NISAR_L2_PR_GCOV_007_114_D_071_0005_NADV_A_20251212T024855_20251212T024930_P05023_N_F_J_001  h5_size_GB=0.323' and the pair G4244992188-ASF (_001) and G4275299786-ASF (_002) for 2026-06-21T13:00:07

**C5. Section 4.1 table, BETA row** (severity: minor)

- Brief says: BETA covers 'a subset of frames, 2025-10-17 to 2026-01-20'.
- Actually: In CMR the GCOV beta collection starts 2025-10-12T18:25:08Z and ends 2026-01-20T15:59:30Z; the GUNW, GOFF and SME2 beta collections start 2025-10-17. Provisional GCOV runs 2025-10-29 to 2026-10-21 (163,672 granules) and validated GCOV 2026-10-21 to 2026-11-11, matching the brief. Validated GCOV is still being filled in: it grew from 14,069 to 14,720 granules between 2026-11-14 02:48 and 08:01 UTC with the newest acquisition still 2026-11-11, so re-query CMR during the event.
- Evidence: <scratch>/verify/harmony/out/cmr_granule_stats.txt: 'NISAR_L2_GCOV_BETA_V1 C3622214170-ASF hits=23527 / first: 2025-10-12T18:25:08.000000Z ... / last: 2026-01-20T15:59:30.000000Z' and 'NISAR_L2_GCOV_V1 C3622241360-ASF hits=14720'; <scratch>/verify/harmony/prior_run_20261113/out/cmr_granule_stats.txt: 'NISAR_L2_GCOV_V1 C3622241360-ASF hits=14069'

**C6. Section 4.2 Products, frame size sentence** (severity: minor)

- Brief says: 'A frame is about 240 by 240 km: 16704 x 17064 pixels at 20 m, 35928 x 36288 at 10 m.'
- Actually: Raster size varies by frame, so read it from the file. ASF's developer cites 40,680 x 40,608 pixels for a 10 m granule (8.1 GB) and 17,532 x 17,280 for a 20 m quad-pol granule (8.7 GB, the largest in the archive in May 2026), and expects about 31 percent of GCOV granules to be 80 m only, 46 percent 20 m and 23 percent 10 m.
- Evidence: <scratch>/verify/harmony/out/github/nasa_harmony_issue_905_comments.json: 'It's 8.1 GB with 10m pixels and its primary rasters are 40,680 x 40,608 pixels.' and 'I'm expecting the archive to have a distribution of ~31% granules with 80m pixels, ~46% 20m, ~23% 10m.'

**C7. Section 4.6, 'Every granule has public preview PNGs'** (severity: minor)

- Brief says: Lists <granule>_LATLON.png and _LATLON_thumbnail.png as the public previews.
- Actually: Four more are public the same way: _NATIVE.png (an RGB image in the native projection) and the per-layer greyscale images _NATIVE_A_HHHH.png, _NATIVE_A_HVHV.png and _NATIVE_B_HHHH.png. For one 4005 DHDH granule the A-layer images are 1952 x 1920 pixels, 8-bit greyscale, 1.4 to 1.5 MB. Every .kml still needs login, as the brief says.
- Evidence: <scratch>/verify/harmony/out/probe_sidecars.txt: 'BROWSE/<granule>_NATIVE_A_HHHH.png http=303 redirect=https://d1mv8zhcvry6x4.cloudfront.net/...'; <transcripts>/wf_0472d927-435/agent-a6f8b12e2bbd50095.jsonl tool result toolu_012pQUkLgqHhcAduUWW9V2Df: '_NATIVE_A_HHHH.png http=200 bytes=1522728' and 'PNG image data, 1952 x 1920, 8-bit grayscale'

**C8. Section 4.5 Access, 'Three ways to get just your window', item 3 (GDAL 3.13 or later)** (severity: minor)

- Brief says: GDAL 3.13 reads NISAR Level 2 as HDF5:"/vsicurl/https://...h5"://science/LSAR/GCOV/grids/frequencyA/HHHH, and 'on conda-forge the HDF5 driver is the separate package libgdal-hdf5. (unverified here)'.
- Actually: Partly verified. On this Mac a conda-forge environment with gdal=3.13.3 and libgdal-hdf5=3.13.3 (micromamba) has a working HDF5 driver, and the string form HDF5:"<local file>"://science/LSAR/GCOV/grids/frequencyA/HHHH is exactly what the Harmony service passes to GDAL; it gave correct georeferencing and NaN nodata on synthetic GCOV-like files. Still unverified: the /vsicurl form with Earthdata Login, and any real NISAR file.
- Evidence: <scratch>/verify/harmony/out/run_service_recipes.txt: 'harmony_gdal_adapter 0.0.3 | GDAL 3.13.3' and "dataset_path='//science/LSAR/GCOV/grids/frequencyA/HHHH'"; <scratch>/verify/harmony/out/check_service_outputs.txt: "20260913: {'size': (3000, 2600), 'bands': 1, 'dtype': 'Float32', 'nodata': nan, 'epsg': '32611', 'origin': (365000.0, 3786000.0), 'pixel': (10.0, -10.0)"

## 11. Recommendations (structured result)

**R1. Role of Harmony in the build**

- Choice: Run it as one candidate in the 45-minute access bake-off and start it first, in the background: one granule, HHHH + HVHV + mask, padded box. Adopt it for the whole stack only if that job finishes in under about 10 minutes and the files validate. Keep the h5py partial read as the default plan.
- Why: Its output is exactly what pipeline stage 2 wants (one native-UTM float32 COG per layer with untouched values), but the service reached production on 2026-11-09, this research never ran a job, it downloads the whole 2 to 8 GB granule server-side for every date, and the only timing on record is 68 minutes for 14 granules on the older chain.

**R2. Packages for the Harmony path**

- Choice: Python 3.12 venv with pip install harmony-py==1.8.0 rasterio==1.5.2 rio-cogeo==7.0.4 h5py==3.16.0 (numpy 2.5.4 and pyproj 3.8.0 come with them).
- Why: This exact set installed cleanly and ran every script on this Mac; 1.8.0 is the newest harmony-py on PyPI and the version NASA's own regression tests pin.

**R3. Authentication for harmony-py**

- Choice: Use ~/.netrc (chmod 600) or Client(token=os.environ['EARTHDATA_TOKEN']). Right after creating the client call client.submit(JobsRequest(limit=1)) and require a dict containing 'count'. Accept the 'Alaska Satellite Facility Data Access' EULA in the Earthdata profile first.
- Why: Client() succeeds without credentials and harmony-py ignores the EARTHDATA_* variables, so a missing login otherwise shows up later as a misleading non-JSON error.

**R4. Which granules to send**

- Choice: Resolve the stack in CMR first (one track, direction and frame; highest counter; same mode and polarization), then pass explicit granule_id=[...], one request per stack. Use granule_name=['NISAR_L2_PR_GCOV_*_106_A_019_*'] only as a shortcut, and never a bare box plus date range.
- Why: A small box matches several stacks, duplicate reprocessings and frequency-B-only dates (104 granules and 679 GB over Los Angeles), and every matched granule costs a full server-side download.

**R5. Variables**

- Choice: Always pass variables explicitly as full HDF5 paths with a leading slash: /science/LSAR/GCOV/grids/frequencyA/HHHH, .../frequencyA/HVHV and .../frequencyA/mask (frequencyB/... for the 80 m layers). Expect one .tif per variable per granule and fewer files on dates that lack a polarization.
- Why: The default is 'all' (up to 20 layers per granule, slower and larger), names must equal the UMM-Var name exactly, and missing variables are skipped without an error.

**R6. Reprojection**

- Choice: Do not pass crs. Take the native UTM output and do multilooking, dB conversion and the EPSG:3857 warp locally onto one fixed grid.
- Why: EPSG:3857 is rejected, the service's recipe sets no resampling method for linear power, and server-side reprojection gave grids that differ between dates, while the native output is bit-identical to the source on a shared lattice.

**R7. Bounding box and grid handling**

- Choice: Pad the requested box beyond the area of interest (for example by 0.02 degrees), then crop locally in UTM. Treat NaN as nodata, apply the mask layer (keep 1 to 5), and place each date into one fixed window by its geotransform instead of asserting equal array shapes.
- Why: The lat/lon cutline leaves NaN wedges inside the delivered rectangle, and clipping to each granule's extent changes size and origin between dates at frame edges.

**R8. Job handling and download**

- Choice: job_id = client.submit(request); client.wait_for_processing(job_id, show_progress=True); files = [f.result() for f in client.download_all(job_id, directory=raw_dir, overwrite=False)]. Then check client.status(job_id) for 'complete_with_errors' or 'paused', read granule and layer from each file name ignoring the numeric prefix, open every file with rasterio and re-download with overwrite=True if one fails. Write the job id into PROGRESS.md.
- Why: wait_for_processing returns without raising on a paused job, partial failures do not raise, a truncated download is not replaced while overwrite=False, and results stay on the server for 30 days, so a saved job id makes the fetch resumable.

**R9. Request size**

- Choice: One job per stack, well under 300 granules; pass skip_preview=True for anything near or above that. Submit several stacks as separate jobs rather than one mixed request.
- Why: At 300 input granules production pauses the job for a preview, and harmony-py then stops waiting without downloading anything.

**R10. Statistics and overviews from Harmony COGs**

- Choice: Read the full-resolution band for every number, and build your own averaged overviews when writing the web COGs.
- Why: The delivered overviews are cubic-resampled linear power (OVERVIEW_RESAMPLING=CUBIC), not the linear-domain averaging the brief's Section 5 requires.

**R11. Fallback when Harmony is slow or failing**

- Choice: Extract locally: the brief's h5py window read, or GDAL 3.13.3 from conda-forge (micromamba create -c conda-forge python=3.14 gdal=3.13.3 libgdal-hdf5=3.13.3 libgdal-netcdf=3.13.3 h5py numpy pip) with the source string HDF5:"<file>"://science/LSAR/GCOV/grids/frequencyA/HHHH. To see exactly what Harmony would return for a downloaded file, run scripts/run_service_recipes.py on it.
- Why: That environment was built and run on this Mac in minutes and carries the same GDAL version the service pins; nothing else server-side exists (no OPeNDAP, HyP3 is Sentinel-1 only).

## 12. Artifacts (structured result)

**A1.** `<scratch>/verify/harmony/scripts/build_nisar_requests.py`

- What: Builds six harmony-py requests for NISAR GCOV (one granule + box by variable name and by concept id; date range + box; date range + box + EPSG:4326; granule-name wildcard for one track/frame; capabilities) and prints the exact URL and curl form. Ran offline; output in <scratch>/verify/harmony/out/build_nisar_requests.txt.
- To reuse: Run with <scratch>/verify/harmony/venv_fresh/bin/python. Change AOI, the granule id list and the collection id; add '/science/LSAR/GCOV/grids/frequencyA/mask' to variables. To submit for real, replace the placeholder client with an authenticated Client() and call client.submit(request).

**A2.** `<scratch>/verify/harmony/scripts/harmony_py_auth_check.py`

- What: Shows the only dependable way to tell whether harmony-py is logged in: client.submit(JobsRequest(limit=1)) and test for a dict with 'count'. Ran without credentials (AUTHENTICATED: False).
- To reuse: Copy the check into the pipeline's login test. Drop the client.headers override and should_validate_auth=False; pass token= or rely on ~/.netrc.

**A3.** `<scratch>/verify/harmony/scripts/setup_venv.sh`

- What: Creates a Python 3.12 venv and installs harmony-py, rasterio, rio-cogeo, pypdf and h5py; prints pip freeze. Ran; resulting versions in <scratch>/verify/harmony/out/setup_venv.txt (harmony-py 1.8.0, rasterio 1.5.2, rio-cogeo 7.0.4, h5py 3.16.0, numpy 2.5.4).
- To reuse: Change the interpreter path /opt/anaconda3/bin/python3 and the venv location; pin the versions from out/setup_venv.txt.

**A4.** `<scratch>/verify/harmony/scripts/harmony_capabilities.py`

- What: Queries https://harmony.earthdata.nasa.gov/capabilities?collectionId=<id> for every NISAR collection without login and saves raw JSON to <scratch>/verify/harmony/out/caps/. With <scratch>/verify/harmony/scripts/harmony_variables_by_collection.py it produced the full variable list for GCOV, GUNW, GOFF and SME2 in <scratch>/verify/harmony/out/harmony_variables_by_collection.txt.
- To reuse: Re-run at the start of the build to confirm the service is still attached to the collection. Needs <scratch>/verify/harmony/out/cmr_nisar_collections.umm.json, which <scratch>/verify/harmony/scripts/cmr_nisar_collections.py writes.

**A5.** `<scratch>/verify/harmony/scripts/cmr_gcov_search.py`

- What: Unauthenticated CMR granule search for one collection over a box and optional time range; prints granule concept id, start time, granule name and HDF5 size, and saves the raw UMM JSON. Ran for Los Angeles (104 granules).
- To reuse: python3 -I scripts/cmr_gcov_search.py <collection-concept-id> <w,s,e,n> [<start>,<stop>] [page_size]. The concept ids it prints are what Request(granule_id=[...]) needs. It does not page beyond page_size and does not dedupe counters or split stacks.

**A6.** `<scratch>/verify/harmony/scripts/run_service_recipes.py`

- What: Drives the deployed Harmony service code (harmony_gdal_adapter 0.0.3) on local HDF5 files exactly as the service does and writes the GeoTIFFs Harmony would return. Ran on synthetic granules; log in <scratch>/verify/harmony/out/run_service_recipes.txt, sample outputs under <scratch>/verify/harmony/mock/out/.
- To reuse: Run with <scratch>/verify/harmony/mamba/env/bin/python (Python 3.14, GDAL 3.13.3, service code installed from <scratch>/verify/harmony/repos/harmony-gdal_v0.0.3) and a writable HOME. Point the first argument at a folder holding a real downloaded GCOV .h5 and edit BBOX_INSIDE, BBOX_EDGE and the variable list. <scratch>/verify/harmony/scripts/make_mock_gcov.py makes the synthetic inputs.

**A7.** `<scratch>/verify/harmony/scripts/check_service_outputs.py`

- What: Compares returned GeoTIFFs with the source HDF5 grids: lattice offset, pixel size, nodata, bit-identity of kept values, alignment of two dates, effect of reprojection. Ran; result in <scratch>/verify/harmony/out/check_service_outputs.txt.
- To reuse: Needs osgeo.gdal 3.13 with the HDF5 driver (<scratch>/verify/harmony/mamba/env). The two date tokens D1, D2, the corner coordinates of the test box and EPSG:32611 are hard-coded; change them for real data. Use it on the first real Harmony result to confirm the lattice claim.

**A8.** `<scratch>/verify/harmony/scripts/cog_validate.py`

- What: Validates GeoTIFFs as COGs with rio-cogeo 7.0.4 and prints the profile; <scratch>/verify/harmony/scripts/inspect_tif.py prints CRS, origin, pixel size, nodata, tiling, overviews, tags and value range with rasterio. Both ran; outputs in <scratch>/verify/harmony/out/cog_validate.txt and <scratch>/verify/harmony/out/inspect_tif_mock.txt.
- To reuse: venv/bin/python -I scripts/cog_validate.py '<glob>' and scripts/inspect_tif.py file.tif. Use on every Harmony download and on the pipeline's own web COGs. In rio-cogeo 7 the compression is cog_info(p).Compression, not .Profile.Compression.

**A9.** `<scratch>/verify/harmony/scripts/probe_unauthenticated.sh`

- What: curl probe of Harmony, CMR and ASF endpoints with no credentials, not following redirects; shows which answer 200 and which redirect to Earthdata Login. <scratch>/verify/harmony/scripts/probe_sidecars.sh does the same for every file of one granule. Outputs in <scratch>/verify/harmony/out/probe_unauthenticated.txt and <scratch>/verify/harmony/out/probe_sidecars.txt.
- To reuse: Change the granule name G and collection C. Add -n (netrc) and -L -b -j to turn a probe into an authenticated request.

**A10.** `<scratch>/verify/harmony/scripts/check_opendap_and_tools.py`

- What: Checks CMR collection and granule metadata for OPeNDAP links and tool associations for the three GCOV collections. Ran; result in <scratch>/verify/harmony/out/check_opendap_and_tools.txt (none found).
- To reuse: Edit the GCOV dict to test GUNW, GOFF or SME2 collections.

**A11.** `<scratch>/verify/harmony/repos/nasa_harmony-regression-tests/test/hga/HGA_Regression.ipynb`

- What: NASA's own regression notebook for this service: harmony-py requests for GCOV, GUNW, GOFF and SME2 (variable extraction, multi-variable, missing variable, reprojection, box subsets) with expected CRS, file counts and bounds, and the submit, wait, result_urls, download sequence in utility.py. The closest thing to official request code for NISAR.
- To reuse: Read with python3 -I <scratch>/verify/harmony/scripts/nb_cells.py <notebook>. Its default environment is UAT; for production use Client() and the production granule names in the test cases. It is registered for UAT and SIT only, not for production.

**A12.** `https://harmony.earthdata.nasa.gov/capabilities?collectionId=C2854338529-ASF`

- What: Public, no-login JSON describing what Harmony can do for a collection: services, subsetting and reprojection flags, output formats and the variable list with concept ids. Also public: https://harmony.earthdata.nasa.gov/versions (deployed image tags) and https://harmony.earthdata.nasa.gov/docs.
- To reuse: Swap the concept id (C3622241360-ASF for validated GCOV) or use ?shortName=NISAR_L2_GCOV_V1. Fetch it first if a job fails, to see whether the service is still attached.

**A13.** `<scratch>/recovered/harmony.md`

- What: This digest. Besides everything in this result it holds every script verbatim, the saved outputs verbatim, NASA's regression-test request code, the service's NISAR recipe, and an end-to-end harmony-py snippet (login check, submit, wait, download) that is assembled from the tested pieces but has not been run.
- To reuse: Section 2 has the request code. The end-to-end snippet is marked UNTESTED: run it once with real credentials on a single granule before building on it.

## 13. Things tried that did not work (structured result)

**X1.** Tried: Submitting a NISAR GCOV subsetting request to production Harmony without credentials, by curl and by harmony-py 1.8.0

- Outcome: curl: 'http=303 redirect=https://urs.earthdata.nasa.gov/oauth/authorize'. harmony-py: 'builtins.Exception: Harmony returned a non-JSON response. This may indicate an authentication failure. Try using a token for authentication when creating your Client or check that your .netrc file contains valid credentials for the Earthdata Login host'. No job was created in any attempt.

**X2.** Tried: Reprojection to EPSG:3857 with the deployed service code

- Outcome: harmony_gdal_adapter.exceptions.UnsupportedProjectionError: Requested projection is unsupported: EPSG:3857.

**X3.** Tried: A bounding box that does not overlap the granule, with the deployed service code

- Outcome: builtins.AssertionError: Subset polygon and source polygon do not overlap

**X4.** Tried: Requesting frequencyA/VVVV from a dual-pol HH+HV file, with the deployed recipe code

- Outcome: harmony_gdal_adapter.exceptions.MissingVariableError: Missing variable in input file: //science/LSAR/GCOV/grids/frequencyA/VVVV. In the real service this exception is caught and the variable is skipped.

**X5.** Tried: Running the service's own pytest suite at tag v0.0.3 in the local GDAL 3.13.3 environment

- Outcome: '6 failed, 7 passed'. The six failures are whole-file comparisons that differ only in one metadata tag ('_NCProperties': h5netcdf=1.8.3 locally, 1.8.2 in the reference files); a follow-up comparison printed grid_equal=True data_equal=True for all six outputs.

**X6.** Tried: Reading compression from rio-cogeo 7.0.4 as cog_info(path).Profile.Compression

- Outcome: AttributeError: 'Profile' object has no attribute 'Compression'. Fixed by using cog_info(path).Compression and Profile.model_dump() (scripts/cog_validate.py).

**X7.** Tried: First version of the output check compared the whole delivered window with the source window

- Outcome: Printed 'values identical to the same source window=False' because the cutline turns edge pixels into nodata. Fixed to compare only the kept pixels, which are bit-identical.

**X8.** Tried: Web search for an Earthdata Forum thread on NISAR Harmony problems and for an official harmony-py example requesting NISAR HHHH

- Outcome: Neither found. The only NISAR request examples located are NASA's regression notebook, ASFHyP3/harmony-gdal issue 54 and a comment on nasa/harmony pull request 975.

**X9.** Tried: Searching the NISAR Data User Guide pages for the EULA requirement

- Outcome: No mention of an EULA or data-access agreement in the guide; only the ASF Cookbook file set_up_Earthdata_Login.md states it.

**X10.** Tried: Three successive agent runs of the whole verification task

- Outcome: Each ended with 'You've hit your 5-hour limit' before writing a report. The third re-ran every script; its outputs matched the second run's apart from cosmetic differences (set ordering, multipart boundaries, timings) and newly ingested validated granules.

## 14. Open questions (structured result)

1. Does a real Harmony job on production succeed for a 2 to 8 GB GCOV granule, and how long does one granule take? The source default work-item timeout is 300 seconds and the 35-minute NISAR override is keyed to the old net2cog service name.
2. Is the 'Alaska Satellite Facility Data Access' EULA required for Harmony jobs, and what error appears without it?
3. Do real GCOV granules of one stack share an identical pixel lattice, so that box outputs line up across dates? Shown only with synthetic files; the processor has snap-to-grid parameters but the production values were not seen.
4. Does GDAL's HDF5 driver georeference a real NISAR GCOV file exactly as it did the synthetic one (EPSG, half-pixel origin, NaN nodata)? No real file was opened.
5. What do the job status and links look like when some granules fail (complete_with_errors)? NASA's test helper skips result URLs ending in .txt, which suggests an extra text file can appear.
6. How many granules does Harmony process in parallel for one user, and is there a per-user rate or concurrency limit? Nothing was found in the documentation read.
7. Which production settings differ from the source defaults? The preview threshold is 300 in the production docs but 100 in env-defaults, so other defaults (timeouts, retries) may differ too.
8. How does the service write the complex off-diagonal covariance terms (HHHV and the like) to a COG? Not tested.
9. Date-range requests take Harmony's best-effort branch (read in source only). Is the box still applied there, does the job message warn that output may extend outside the requested bounds, and does the time filter behave as expected?

## Appendix A. Scripts, verbatim

All of these ran in the interrupted sessions (their outputs are in `out/`). Interpreters used:

- `venv_fresh/bin/python`: Python 3.12.2 venv made by `scripts/setup_venv.sh` (harmony-py 1.8.0,
  rasterio 1.5.2, rio-cogeo 7.0.4, h5py 3.16.0, numpy 2.5.4, pyproj 3.8.0, pypdf 7.1.0).
- `mamba/env/bin/python`: Python 3.14.10 conda-forge environment (GDAL 3.13.3, libgdal-hdf5 3.13.3,
  hdf5 2.2.0, harmony_gdal_adapter 0.0.3, harmony-service-lib 3.0.0, kcl-lib 0.13.2, xarray 2026.9.0,
  h5netcdf 1.8.3). Appendix D has the commands that built it.
- `/opt/anaconda3/bin/python3 -I` for the standard-library scripts.

### scripts/build_nisar_requests.py

Shown in Section 2.1.

### scripts/harmony_py_auth_check.py

**File:** `<scratch>/verify/harmony/scripts/harmony_py_auth_check.py`

````python
#!/usr/bin/env python3
"""How to tell whether harmony-py is REALLY authenticated.  Run without credentials:
  env -i PATH=/usr/bin:/bin HOME=/nonexistent venv/bin/python -I scripts/harmony_py_auth_check.py
With credentials the JobsRequest call returns a dict that has a 'count' key."""
import contextlib
import io

from harmony import Client, JobsRequest

client = Client(should_validate_auth=False)      # Client() would behave the same: see harmony_py_no_login.py
client.headers = {"User-Agent": "generic-research-client/1.0"}
buf = io.StringIO()
with contextlib.redirect_stdout(buf):
    result = client.submit(JobsRequest(limit=1))
printed = buf.getvalue()
print("return value:", repr(result) if not isinstance(result, dict) else {k: result[k] for k in list(result)[:3]})
print("stdout printed by harmony-py (first 80 chars):", repr(printed[:80]))
authenticated = isinstance(result, dict) and "count" in result
print("AUTHENTICATED:", authenticated)

# bogus bearer token
client2 = Client(token="not-a-real-token")       # no exception: validation is skipped when a token is given
client2.headers = {"User-Agent": "generic-research-client/1.0"}
try:
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        r2 = client2.submit(JobsRequest(limit=1))
    print("bogus token -> return:", repr(r2)[:200], "| printed:", repr(buf.getvalue()[:120]))
except Exception as e:  # noqa: BLE001
    print(f"bogus token -> {type(e).__module__}.{type(e).__name__}: {str(e)[:300]}")
````


### scripts/harmony_py_no_login.py

**File:** `<scratch>/verify/harmony/scripts/harmony_py_no_login.py`

````python
#!/usr/bin/env python3
"""What harmony-py does against PRODUCTION Harmony when NO Earthdata Login credentials exist.
Run with an empty environment and a non-existent HOME so that no .netrc / .env / env vars are read:

  env -i PATH=/usr/bin:/bin HOME=/nonexistent venv/bin/python -I scripts/harmony_py_no_login.py

A) Client() with default auth validation        -> which exception?
B) CapabilitiesRequest via harmony-py            -> works without login?
C) submit() of a NISAR GCOV subsetting Request   -> where does it stop?  (No job can be created.)
"""
import json
import traceback

import harmony
from harmony import BBox, CapabilitiesRequest, Client, Collection, Request

GENERIC_UA = {"User-Agent": "generic-research-client/1.0"}

print("harmony-py", harmony.__version__)
print("\n--- A) Client() with no credentials (validates against /jobs)")
try:
    Client()
    print("UNEXPECTED: client created and validated")
except Exception as e:  # noqa: BLE001
    print(f"{type(e).__module__}.{type(e).__name__}: {e}")

client = Client(should_validate_auth=False)
client.headers = dict(GENERIC_UA)  # stop harmony-py from adding platform details to the User-Agent

print("\n--- B) capabilities through harmony-py, no login")
try:
    caps = client.submit(CapabilitiesRequest(collection_id="C2854338529-ASF"))
    print("shortName:", caps["shortName"], "| capabilitiesVersion:", caps["capabilitiesVersion"])
    print("summary.subsetting:", json.dumps(caps["summary"]["subsetting"]))
    print("summary.outputFormats:", json.dumps(caps["summary"]["outputFormats"]))
    print("services:", [s["name"] for s in caps["services"]])
    wanted = [v for v in caps["variables"] if v["name"].endswith(("frequencyA/HHHH", "frequencyA/HVHV"))]
    for v in wanted:
        print("variable:", v["name"], "->", v["href"].rsplit("/", 1)[-1])
except Exception as e:  # noqa: BLE001
    print(f"{type(e).__module__}.{type(e).__name__}: {e}")

print("\n--- C) submit() of a NISAR GCOV request, no login")
request = Request(
    collection=Collection(id="C2854338529-ASF"),
    granule_id=["G4381234094-ASF"],
    spatial=BBox(w=-118.5, s=33.9, e=-118.1, n=34.2),
    variables=["/science/LSAR/GCOV/grids/frequencyA/HHHH", "/science/LSAR/GCOV/grids/frequencyA/HVHV"],
    format="image/tiff",
)
print("request.is_valid():", request.is_valid())
try:
    out = client.submit(request)
    print("UNEXPECTED: submit returned", str(out)[:300])
except Exception as e:  # noqa: BLE001
    msg = str(e)
    # do not print the long OAuth query string
    cut = msg.find("?")
    print(f"{type(e).__module__}.{type(e).__name__}: {msg[:cut] if cut > 0 else msg[:300]}")
    tb = traceback.extract_tb(e.__traceback__)
    print("raised in:", tb[-1].name, "<-", tb[-2].name if len(tb) > 1 else "")
````


### scripts/harmony_py_download_name.py

**File:** `<scratch>/verify/harmony/scripts/harmony_py_download_name.py`

````python
#!/usr/bin/env python3
"""Offline check of the local file name harmony-py gives a downloaded Harmony result
(no network).  Run: env -i PATH=/usr/bin:/bin venv/bin/python -I scripts/harmony_py_download_name.py"""
from harmony import Client

c = Client(token="PLACEHOLDER_EDL_TOKEN", should_validate_auth=False)
url = ("https://harmony.earthdata.nasa.gov/service-results/harmony-prod-staging/public/"
       "0f8fad5b-d9cb-469f-a165-70867728950e/123456789/"
       "NISAR_L2_PR_GCOV_033_106_A_019_4005_DHDH_A_20261019T130003_20261019T130038_P05023_N_F_J_001"
       "_science_LSAR_GCOV_grids_frequencyA_HHHH_subsetted.tif")
print("result URL (illustrative job/work-item ids):", url)
print("local file name:", c.get_download_filename_from_url(url))
print("NUM_REQUESTS_WORKERS (parallel downloads):", c.config.NUM_REQUESTS_WORKERS, "| DOWNLOAD_CHUNK_SIZE:", c.config.DOWNLOAD_CHUNK_SIZE)
print("check_interval (s):", c.check_interval)
````


### scripts/inspect_harmony_py.py

**File:** `<scratch>/verify/harmony/scripts/inspect_harmony_py.py`

````python
#!/usr/bin/env python3
"""Inspect the installed harmony-py API (no network, no credentials).
Run: venv/bin/python -I scripts/inspect_harmony_py.py"""
import inspect
import importlib.metadata as md

import harmony
from harmony import client as hclient, request as hrequest

print("harmony-py version:", md.version("harmony-py"), "| harmony.__version__ =", getattr(harmony, "__version__", None))
print("harmony.__all__ / public names:", [n for n in dir(harmony) if not n.startswith("_")])
print()
for cls_name in ("Client", "Request", "CapabilitiesRequest", "JobsRequest", "AddLabelsRequest", "DeleteLabelsRequest",
                 "Collection", "BBox", "WKT", "Dimension", "Environment", "LinkType"):
    obj = getattr(harmony, cls_name, None)
    if obj is None:
        print(f"--- {cls_name}: NOT PRESENT")
        continue
    print(f"--- {cls_name}")
    try:
        print("   signature:", inspect.signature(obj))
    except (TypeError, ValueError) as e:
        print("   (no signature)", e)
    doc = inspect.getdoc(obj) or ""
    print("   doc:", "\n        ".join(doc.splitlines()))
    if cls_name in ("Environment", "LinkType"):
        print("   members:", [(m.name, m.value) for m in obj])

print()
print("=== Client public methods ===")
for name, fn in inspect.getmembers(harmony.Client, predicate=inspect.isfunction):
    if name.startswith("_"):
        continue
    first = (inspect.getdoc(fn) or "").splitlines()[:1]
    print(f"  {name}{inspect.signature(fn)}\n      {first[0] if first else ''}")

print()
print("=== module-level constants in harmony.client ===")
for n in dir(hclient):
    v = getattr(hclient, n)
    if n.isupper() or isinstance(v, (int, float, str)) and not n.startswith("__"):
        print(f"  {n} = {v!r}")
print()
print("=== Hostnames per Environment ===")
for n in dir(hclient):
    if "HOST" in n.upper():
        print(" ", n, "=", getattr(hclient, n))
````


### scripts/setup_venv.sh

**File:** `<scratch>/verify/harmony/scripts/setup_venv.sh`

````bash
#!/bin/bash
# Create a fresh Python 3.12 virtualenv inside the task folder and install harmony-py from PyPI,
# plus the helpers used by the inspection scripts (rasterio + rio-cogeo to inspect / validate
# GeoTIFFs, pypdf to read the GCOV product specification).  No credentials involved.
# Usage: bash scripts/setup_venv.sh [venv-dir-name]     (default: venv_fresh)
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
VENV="$HERE/${1:-venv_fresh}"
export PIP_CACHE_DIR="$HERE/.pipcache" PIP_DISABLE_PIP_VERSION_CHECK=1
date -u
/opt/anaconda3/bin/python3 -m venv "$VENV"
"$VENV/bin/python" -m pip install --quiet --upgrade pip
"$VENV/bin/python" -m pip install --quiet harmony-py rasterio rio-cogeo pypdf h5py
echo "--- python: $("$VENV/bin/python" --version)"
echo "--- pip freeze"
"$VENV/bin/python" -m pip freeze
echo "--- newest harmony-py on PyPI"
"$VENV/bin/python" -m pip index versions harmony-py 2>/dev/null | head -3 || true
````


### scripts/harmony_capabilities.py

**File:** `<scratch>/verify/harmony/scripts/harmony_capabilities.py`

````python
#!/usr/bin/env python3
"""Query https://harmony.earthdata.nasa.gov/capabilities for every ASF NISAR
collection listed in out/cmr_nisar_collections.umm.json (no login needed) and
print a compact summary. Raw responses saved to out/caps/<concept-id>.json
Run: python3 -I scripts/harmony_capabilities.py [version]"""
import json, os, sys, urllib.request, urllib.error, time

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = "generic-research-client/1.0"
ver = sys.argv[1] if len(sys.argv) > 1 else None
outdir = os.path.join(HERE, "out", "caps" + ("_v" + ver if ver else ""))
os.makedirs(outdir, exist_ok=True)
cols = json.load(open(os.path.join(HERE, "out", "cmr_nisar_collections.umm.json")))["items"]
rows = sorted((c["umm"]["ShortName"], c["meta"]["concept-id"]) for c in cols)

def crs_summary(projs):
    codes = sorted(int(p["crs"].split(":")[1]) for p in projs)
    # compress to ranges
    out, start, prev = [], None, None
    for c in codes:
        if start is None:
            start = prev = c
        elif c == prev + 1:
            prev = c
        else:
            out.append((start, prev)); start = prev = c
    if start is not None:
        out.append((start, prev))
    return ",".join(str(a) if a == b else f"{a}-{b}" for a, b in out)

for short, cid in rows:
    url = f"https://harmony.earthdata.nasa.gov/capabilities?collectionId={cid}"
    if ver:
        url += f"&version={ver}"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            body = r.read(); code = r.status
    except urllib.error.HTTPError as e:
        body = e.read(); code = e.code
    open(os.path.join(outdir, cid + ".json"), "wb").write(body)
    try:
        d = json.loads(body)
    except Exception:
        print(f"{short} {cid} http={code} non-JSON: {body[:200]!r}")
        continue
    if code != 200:
        print(f"{short} {cid} http={code} {json.dumps(d)[:300]}")
        continue
    if ver:
        print(f"{short} {cid} http={code} keys={list(d.keys())}")
        print("   ", json.dumps({k: v for k, v in d.items() if k not in ('variables','services')})[:1500])
        continue
    s = d.get("summary", {})
    sub = s.get("subsetting", {})
    rep = s.get("reprojection", {})
    svcs = d.get("services", [])
    print(f"{short} {cid} http={code}")
    print(f"    subsetting={sub}")
    print(f"    reprojection.supported={rep.get('supported')} crs=[{crs_summary(rep.get('supportedProjections', []))}] interp={rep.get('supportedInterpolationMethods') or rep.get('interpolationMethods')}")
    print(f"    other summary keys: { {k: v for k, v in s.items() if k not in ('subsetting','reprojection')} }")
    print(f"    outputFormats={d.get('outputFormats')}")
    print(f"    n_variables={len(d.get('variables', []))} n_services={len(svcs)} services={[x.get('name') for x in svcs]}")
    time.sleep(0.3)
````


### scripts/harmony_variables_by_collection.py

**File:** `<scratch>/verify/harmony/scripts/harmony_variables_by_collection.py`

````python
#!/usr/bin/env python3
"""Summarise the raw /capabilities responses saved by scripts/harmony_capabilities.py
(out/caps/<concept-id>.json): which Harmony services and which UMM-Var variables each
Harmony-enabled NISAR collection has, and whether the variable list (names AND concept ids)
is the same for the Beta / Provisional / Validated collection of a product type.
No network. Run: python3 -I scripts/harmony_variables_by_collection.py"""
import glob
import json
import os
import re

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
caps = {}
for p in sorted(glob.glob(os.path.join(HERE, "out", "caps", "*.json"))):
    d = json.load(open(p))
    if d.get("services"):
        caps[d["shortName"]] = d

by_type = {}
for short, d in sorted(caps.items()):
    svc = [(s["name"], s["href"].rsplit("/", 1)[-1], [f["mimeType"] for f in s["capabilities"]["outputFormats"]]) for s in d["services"]]
    print(f"=== {short} {d['conceptId']}: services={svc}")
    ptype = re.search(r"_L\d_([A-Z0-9]+)_", short).group(1)
    by_type.setdefault(ptype, {})[short] = [(v["name"], v["href"].rsplit("/", 1)[-1]) for v in d["variables"]]

print()
for ptype, cols in by_type.items():
    lists = list(cols.values())
    same = all(sorted(x) == sorted(lists[0]) for x in lists)
    print(f"--- {ptype}: collections={list(cols)}")
    print(f"    variable list (names + UMM-Var concept ids) identical across these collections: {same}; count={len(lists[0])}")
    for name, vid in sorted(lists[0], key=lambda t: t[0].lower()):
        print(f"    {name}  {vid}")
````


### scripts/fetch_service_metadata.py

**File:** `<scratch>/verify/harmony/scripts/fetch_service_metadata.py`

````python
#!/usr/bin/env python3
"""Fetch (no login) the public metadata that describes the NISAR Harmony services:
  * https://harmony.earthdata.nasa.gov/versions            -> deployed image + tag per service chain
  * CMR UMM-S records of the two services associated with the NISAR collections
  * CMR UMM-Var records of the GCOV frequencyA variables HHHH, HVHV, mask, numberOfLooks, rtcGammaToSigmaFactor
Raw responses go to out/; a summary is printed.
Run: python3 -I scripts/fetch_service_metadata.py"""
import json
import os
import urllib.request

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, "out")
UA = "generic-research-client/1.0"


def get(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=90) as r:
        body = r.read()
        status = r.status
    open(os.path.join(OUT, dest), "wb").write(body)
    return status, json.loads(body)


code, versions = get("https://harmony.earthdata.nasa.gov/versions", "harmony_versions.json")
print(f"/versions http={code} service chains={len(versions)}")
for v in versions:
    if any(k in v["name"].lower() for k in ("gdal", "nisar", "query-cmr", "opera")):
        for im in v["images"]:
            print(f"   {v['name']:28s} image={im.get('image')} tag={im.get('tag')} "
                  f"imageDigest={str(im.get('imageDigest'))[:30]} lastUpdated={im.get('lastUpdated')}")

for sid in ("S4389714698-ASF", "S4166720787-ASF"):
    code, d = get(f"https://cmr.earthdata.nasa.gov/search/concepts/{sid}.umm_json", f"umm_s_{sid}.json")
    print(f"\nUMM-S {sid} http={code}")
    for k in ("Name", "LongName", "Version", "Type", "Description", "URL"):
        print(f"   {k}: {d.get(k)}")
    so = d.get("ServiceOptions", {})
    print("   ServiceOptions.Subset:", json.dumps(so.get("Subset")))
    print("   ServiceOptions.VariableAggregationSupportedMethods:", so.get("VariableAggregationSupportedMethods"))
    print("   ServiceOptions.SupportedReformattings:", json.dumps(so.get("SupportedReformattings")))
    print("   ServiceOptions.InterpolationTypes:", so.get("InterpolationTypes"))
    projs = [p.get("ProjectionAuthority") or p.get("ProjectionName") for p in so.get("SupportedOutputProjections", [])]
    print(f"   ServiceOptions.SupportedOutputProjections: n={len(projs)} first={projs[:4]} last={projs[-3:]}")
    print("   OperationMetadata:", json.dumps(d.get("OperationMetadata"))[:600])
    print("   other keys:", [k for k in d if k not in ("ServiceOptions",)])

for vid in ("V4137651715-ASF", "V4137651725-ASF", "V4137651736-ASF", "V4137651748-ASF", "V4137651754-ASF"):
    code, d = get(f"https://cmr.earthdata.nasa.gov/search/concepts/{vid}.umm_json", f"umm_var_{vid}.json")
    print(f"\nUMM-Var {vid} http={code}: {json.dumps(d)}")
````


### scripts/cmr_nisar_collections.py

**File:** `<scratch>/verify/harmony/scripts/cmr_nisar_collections.py`

````python
#!/usr/bin/env python3
"""List every ASF collection in CMR whose short name starts with NISAR (no login).
Saves the raw UMM-JSON to out/cmr_nisar_collections.umm.json and prints
short name, concept id, and the UMM-S service / UMM-Var association counts.
Run: python3 -I scripts/cmr_nisar_collections.py"""
import json, os, urllib.request, urllib.parse

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = "generic-research-client/1.0"
q = urllib.parse.urlencode({"provider": "ASF", "short_name": "NISAR*", "options[short_name][pattern]": "true", "page_size": 200})
url = "https://cmr.earthdata.nasa.gov/search/collections.umm_json?" + q
req = urllib.request.Request(url, headers={"User-Agent": UA})
with urllib.request.urlopen(req, timeout=120) as r:
    hits = r.headers.get("CMR-Hits")
    body = r.read()
os.makedirs(os.path.join(HERE, "out"), exist_ok=True)
open(os.path.join(HERE, "out", "cmr_nisar_collections.umm.json"), "wb").write(body)
d = json.loads(body)
print("URL:", url)
print("CMR-Hits:", hits, "items:", len(d["items"]))
rows = []
for it in d["items"]:
    m, u = it["meta"], it["umm"]
    assoc = m.get("associations", {})
    rows.append((u["ShortName"], u.get("Version"), m["concept-id"], len(assoc.get("services", [])), len(assoc.get("variables", [])),
                 ",".join(assoc.get("services", [])), m.get("revision-date", "")[:10], m.get("granule-count")))
for r in sorted(rows):
    print("{:34s} v{:3s} {:18s} services={} variables={:3d} [{}] rev={} ".format(*r[:7]))
````


### scripts/cmr_granule_stats.py

**File:** `<scratch>/verify/harmony/scripts/cmr_granule_stats.py`

````python
#!/usr/bin/env python3
"""Unauthenticated CMR granule statistics for the Harmony-enabled NISAR collections:
hit count, earliest and latest granule start time. Run: python3 -I scripts/cmr_granule_stats.py"""
import json, urllib.request, urllib.parse
UA = "generic-research-client/1.0"
COLS = [
 ("NISAR_L2_GCOV_BETA_V1", "C3622214170-ASF"), ("NISAR_L2_GCOV_PROVISIONAL_V1", "C2854338529-ASF"), ("NISAR_L2_GCOV_V1", "C3622241360-ASF"),
 ("NISAR_L2_GUNW_BETA_V1", "C2850261892-ASF"), ("NISAR_L2_GUNW_PROVISIONAL_V1", "C2854335566-ASF"), ("NISAR_L2_GUNW_V1", "C3622247503-ASF"),
 ("NISAR_L2_GOFF_BETA_V1", "C2850263910-ASF"), ("NISAR_L2_GOFF_PROVISIONAL_V1", "C2854341702-ASF"), ("NISAR_L2_GOFF_V1", "C3622250865-ASF"),
 ("NISAR_L3_SME2_BETA_V1", "C2850265000-ASF"), ("NISAR_L3_SME2_PROVISIONAL_V1", "C2854344945-ASF"),
]
def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=90) as r:
        return r.headers, json.loads(r.read())
for short, cid in COLS:
    out = {}
    for label, sort in (("first", "start_date"), ("last", "-start_date")):
        q = urllib.parse.urlencode({"collection_concept_id": cid, "page_size": 1, "sort_key": sort})
        h, d = get("https://cmr.earthdata.nasa.gov/search/granules.umm_json?" + q)
        out["hits"] = h.get("CMR-Hits")
        it = d["items"][0] if d["items"] else None
        if it:
            t = it["umm"].get("TemporalExtent", {}).get("RangeDateTime", {})
            out[label] = (t.get("BeginningDateTime"), it["umm"]["GranuleUR"], it["meta"]["concept-id"])
    print(f"{short} {cid} hits={out.get('hits')}")
    for k in ("first", "last"):
        if k in out:
            print(f"    {k}: {out[k][0]}  {out[k][1]}  {out[k][2]}")
````


### scripts/cmr_gcov_search.py

**File:** `<scratch>/verify/harmony/scripts/cmr_gcov_search.py`

````python
#!/usr/bin/env python3
"""Unauthenticated CMR granule search for a NISAR collection over a bbox / time range.
Prints concept id, granule UR, start time, size and the data URLs; saves raw JSON.
Usage:
  python3 -I scripts/cmr_gcov_search.py <collection-concept-id> <w,s,e,n> [<start>,<stop>] [page_size]
Example:
  python3 -I scripts/cmr_gcov_search.py C2854338529-ASF -118.5,33.9,-118.1,34.2 2026-06-01T00:00:00Z,2026-11-14T00:00:00Z 50
"""
import json, os, sys, urllib.request, urllib.parse

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = "generic-research-client/1.0"
cid = sys.argv[1]
bbox = sys.argv[2]
temporal = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] else None
page_size = int(sys.argv[4]) if len(sys.argv) > 4 else 50
params = {"collection_concept_id": cid, "bounding_box": bbox, "page_size": page_size, "sort_key": "start_date"}
if temporal:
    params["temporal"] = temporal
url = "https://cmr.earthdata.nasa.gov/search/granules.umm_json?" + urllib.parse.urlencode(params)
req = urllib.request.Request(url, headers={"User-Agent": UA})
with urllib.request.urlopen(req, timeout=120) as r:
    hits = r.headers.get("CMR-Hits")
    body = r.read()
tag = f"{cid}_{bbox.replace(',', '_')}"
out = os.path.join(HERE, "out", f"cmr_granules_{tag}.json")
open(out, "wb").write(body)
d = json.loads(body)
print("URL:", url)
print("CMR-Hits:", hits, "returned:", len(d["items"]), "saved:", out)
for it in d["items"]:
    u, m = it["umm"], it["meta"]
    t = u.get("TemporalExtent", {}).get("RangeDateTime", {})
    sizes = [(a.get("Name"), a.get("SizeInBytes") or a.get("Size"), a.get("SizeUnit")) for a in u.get("DataGranule", {}).get("ArchiveAndDistributionInformation", [])]
    urls = [(x.get("Type"), x.get("URL")) for x in u.get("RelatedUrls", [])]
    h5 = [s for s in sizes if str(s[0]).endswith(".h5")]
    size_gb = (h5[0][1] / 1e9) if h5 and isinstance(h5[0][1], (int, float)) else None
    print(f"{m['concept-id']}  {t.get('BeginningDateTime')}  {u['GranuleUR']}  h5_size_GB={size_gb if size_gb is None else round(size_gb, 3)}")
if d["items"]:
    it = d["items"][0]
    print("\nFirst granule RelatedUrls:")
    for x in it["umm"].get("RelatedUrls", []):
        print("   ", x.get("Type"), x.get("URL"))
    print("First granule spatial:", json.dumps(it["umm"].get("SpatialExtent"))[:900])
    print("First granule AdditionalAttributes:", json.dumps(it["umm"].get("AdditionalAttributes"))[:1500])
````


### scripts/probe_unauthenticated.sh

**File:** `<scratch>/verify/harmony/scripts/probe_unauthenticated.sh`

````bash
#!/bin/bash
# Probe which Harmony / CMR / ASF endpoints answer WITHOUT Earthdata Login.
# No credentials are sent (-q ignores ~/.curlrc, no -n so ~/.netrc is never read),
# redirects are NOT followed, generic User-Agent.
# Usage: bash scripts/probe_unauthenticated.sh
UA="generic-research-client/1.0"
probe() {  # label, url
  local label="$1" url="$2"
  local out
  out=$(curl -q -sS -o /dev/null -A "$UA" --max-time 60 \
        -w "http=%{http_code} redirect=%{redirect_url} type=%{content_type} bytes=%{size_download}" "$url" 2>&1)
  # shorten the EDL redirect so the line stays readable
  out=$(printf '%s' "$out" | sed -E 's#(redirect=https://[^/]+/[^?]*)\?[^ ]*#\1?<query-elided>#')
  printf '%-34s %s\n    %s\n' "$label" "$out" "$url"
}
H=https://harmony.earthdata.nasa.gov
C=C2854338529-ASF
VARS='variable=%2Fscience%2FLSAR%2FGCOV%2Fgrids%2FfrequencyA%2FHHHH&variable=%2Fscience%2FLSAR%2FGCOV%2Fgrids%2FfrequencyA%2FHVHV'
date -u
probe "harmony landing"                 "$H/"
probe "harmony docs"                    "$H/docs"
probe "harmony versions"                "$H/versions"
probe "capabilities collectionId"       "$H/capabilities?collectionId=$C"
probe "capabilities collectionid (lc)"  "$H/capabilities?collectionid=$C"
probe "capabilities shortName"          "$H/capabilities?shortName=NISAR_L2_GCOV_PROVISIONAL_V1"
probe "capabilities v2"                 "$H/capabilities?collectionId=$C&version=2"
probe "swagger coverages api"           "$H/docs/api"
probe "swagger edr api"                 "$H/docs/edr-api"
probe "coverages request (NISAR GCOV)"  "$H/$C/ogc-api-coverages/1.0.0/collections/parameter_vars/coverage/rangeset?forceAsync=true&subset=lat(33.9%3A34.2)&subset=lon(-118.5%3A-118.1)&granuleId=G4381234094-ASF&format=image%2Ftiff&$VARS"
probe "coverages landing for coll."     "$H/$C/ogc-api-coverages/1.0.0/"
probe "coverages collections list"      "$H/$C/ogc-api-coverages/1.0.0/collections"
probe "edr cube request (NISAR GCOV)"   "$H/ogc-api-edr/1.1.0/collections/$C/cube?bbox=-118.5,33.9,-118.1,34.2&granuleId=G4381234094-ASF&f=image%2Ftiff&parameter-name=V4137651715-ASF,V4137651725-ASF"
probe "jobs list"                       "$H/jobs"
probe "job status (random uuid)"        "$H/jobs/00000000-0000-4000-8000-000000000000"
probe "stac (random uuid)"              "$H/stac/00000000-0000-4000-8000-000000000000"
probe "cloud-access"                    "$H/cloud-access"
probe "workflow-ui"                     "$H/workflow-ui"
probe "service-results (random key)"    "$H/service-results/harmony-prod-staging/public/nasa/harmony-gdal-adapter/x/y.tif"
echo
echo "--- CMR (metadata) ---"
probe "cmr collection concept"          "https://cmr.earthdata.nasa.gov/search/concepts/$C.umm_json"
probe "cmr granule search"              "https://cmr.earthdata.nasa.gov/search/granules.json?collection_concept_id=$C&page_size=1"
probe "cmr variables for collection"    "https://cmr.earthdata.nasa.gov/search/variables.umm_json?keyword=$C&page_size=5"
echo
echo "--- ASF data distribution (one real GCOV granule) ---"
G=NISAR_L2_PR_GCOV_033_106_A_019_4005_DHDH_A_20261019T130003_20261019T130038_P05023_N_F_J_001
probe "asf h5 download"                 "https://nisar.asf.earthdatacloud.nasa.gov/NISAR/NISAR_L2_GCOV_PROVISIONAL_V1/$G/$G.h5"
probe "asf browse png (NATIVE_A_HHHH)"  "https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1/$G/${G}_NATIVE_A_HHHH.png"
probe "asf browse png (LATLON)"         "https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1/$G/${G}_LATLON.png"
probe "asf iso.xml metadata"            "https://nisar.asf.earthdatacloud.nasa.gov/NISAR/NISAR_L2_GCOV_PROVISIONAL_V1/$G/$G.h5.iso.xml"
probe "asf s3credentials endpoint"      "https://nisar.asf.earthdatacloud.nasa.gov/s3credentials"
````


### scripts/probe_sidecars.sh

**File:** `<scratch>/verify/harmony/scripts/probe_sidecars.sh`

````bash
#!/bin/bash
# Which files that CMR lists for a NISAR GCOV granule can be fetched WITHOUT Earthdata Login?
# No credentials are sent (-q: no ~/.curlrc; no -n: ~/.netrc never read); redirects are not followed.
# Usage: bash scripts/probe_sidecars.sh
UA="generic-research-client/1.0"
G=NISAR_L2_PR_GCOV_033_106_A_019_4005_DHDH_A_20261019T130003_20261019T130038_P05023_N_F_J_001
C=NISAR_L2_GCOV_PROVISIONAL_V1
B=https://nisar.asf.earthdatacloud.nasa.gov
date -u
for rel in \
  "NISAR/$C/$G/$G.h5" "NISAR/$C/$G/$G.h5.iso.xml" "NISAR/$C/$G/$G.rc.yaml" \
  "NISAR/$C/$G/${G}_NATIVE.kml" "NISAR/$C/$G/${G}_LATLON.kml" "NISAR/$C/$G/${G}_NATIVE_A_HHHH.kml" \
  "NISAR/$C/$G/${G}_QA_REPORT.pdf" "NISAR/$C/$G/${G}_QA_SUMMARY.csv" "NISAR/$C/$G/${G}_QA_STATS.h5" \
  "BROWSE/$C/$G/${G}_NATIVE.png" "BROWSE/$C/$G/${G}_LATLON.png" "BROWSE/$C/$G/${G}_LATLON_thumbnail.png" \
  "BROWSE/$C/$G/${G}_NATIVE_A_HHHH.png" "BROWSE/$C/$G/${G}_NATIVE_A_HVHV.png" "BROWSE/$C/$G/${G}_NATIVE_B_HHHH.png" \
  "BROWSE/$C/$G/${G}_NATIVE.kml" "BROWSE/$C/$G/${G}_NATIVE.png.aux.xml" \
  "s3credentials" "s3credentialsREADME"; do
  out=$(curl -q -sS -o /dev/null -A "$UA" --max-time 60 -w "http=%{http_code} redirect=%{redirect_url}" "$B/$rel" 2>&1 \
        | sed -E 's#(redirect=https://[^/]+)/.*#\1/...#')
  printf '%-34s %s\n' "${rel/$C\/$G\/$G/<granule>}" "$out"
done
````


### scripts/check_opendap_and_tools.py

**File:** `<scratch>/verify/harmony/scripts/check_opendap_and_tools.py`

````python
#!/usr/bin/env python3
"""Does CMR advertise OPeNDAP (or any other server-side access service / tool) for the NISAR GCOV
collections?  All requests are unauthenticated CMR metadata queries.
  1. Collection UMM-C RelatedUrls + service/tool/variable associations for the three GCOV collections.
  2. For the granules saved by cmr_gcov_search.py: every distinct RelatedUrl (Type, Subtype) pair and
     any URL that mentions opendap / dmrpp.
  3. CMR-wide count of granule links of Subtype 'OPENDAP DATA' via the granule-level umm_json for 5
     newest granules of each GCOV collection.
  4. UMM-T tools associated with the collections (e.g. Earthdata Search, Worldview).
Run: python3 -I scripts/check_opendap_and_tools.py"""
import collections
import glob
import json
import os
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = "generic-research-client/1.0"
GCOV = {"NISAR_L2_GCOV_BETA_V1": "C3622214170-ASF", "NISAR_L2_GCOV_PROVISIONAL_V1": "C2854338529-ASF",
        "NISAR_L2_GCOV_V1": "C3622241360-ASF"}


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=90) as r:
        return r.headers, json.loads(r.read())


print("=== 1. collection-level RelatedUrls and associations")
for short, cid in GCOV.items():
    _, d = get(f"https://cmr.earthdata.nasa.gov/search/collections.umm_json?concept_id={cid}")
    it = d["items"][0]
    umm, meta = it["umm"], it["meta"]
    print(f"{short} {cid} revision-date={meta.get('revision-date')}")
    print("   associations:", {k: v for k, v in meta.get("associations", {}).items() if k != "variables"},
          "| n_variables:", len(meta.get("associations", {}).get("variables", [])))
    for u in umm.get("RelatedUrls", []):
        print(f"   {u.get('URLContentType')} / {u.get('Type')} / {u.get('Subtype')}: {u.get('URL')}")
    print("   DirectDistributionInformation:", json.dumps(umm.get("DirectDistributionInformation"))[:400])
    print("   CollectionProgress:", umm.get("CollectionProgress"), "| ProcessingLevel:", umm.get("ProcessingLevel", {}).get("Id"),
          "| UseConstraints:", json.dumps(umm.get("UseConstraints"))[:300], "| AccessConstraints:", json.dumps(umm.get("AccessConstraints"))[:300])
    for tid in meta.get("associations", {}).get("tools", []):
        _, t = get(f"https://cmr.earthdata.nasa.gov/search/concepts/{tid}.umm_json")
        print(f"   tool {tid}: {t.get('Name')} | {t.get('Type')} | {t.get('URL', {}).get('URLValue')}")

print("\n=== 2. RelatedUrl types across saved granule search results")
for path in sorted(glob.glob(os.path.join(HERE, "out", "cmr_granules_*.json"))):
    d = json.load(open(path))
    kinds = collections.Counter()
    opendap = []
    for it in d["items"]:
        for u in it["umm"].get("RelatedUrls", []):
            ext = u["URL"].rsplit("/", 1)[-1].split(".", 1)[-1] if "." in u["URL"].rsplit("/", 1)[-1] else ""
            kinds[(u.get("Type"), u.get("Subtype"), u["URL"].split(":", 1)[0])] += 1
            if "opendap" in u["URL"].lower() or "dmrpp" in u["URL"].lower() or (u.get("Subtype") or "").upper().startswith("OPENDAP"):
                opendap.append(u["URL"])
    print(os.path.basename(path), "granules:", len(d["items"]))
    for k, n in sorted(kinds.items(), key=lambda kv: -kv[1]):
        print(f"   {n:5d}  Type={k[0]!r} Subtype={k[1]!r} scheme={k[2]}")
    print("   URLs mentioning opendap/dmrpp:", len(opendap))

print("\n=== 3. newest granules of each GCOV collection: any OPeNDAP link?")
for short, cid in GCOV.items():
    q = urllib.parse.urlencode({"collection_concept_id": cid, "page_size": 5, "sort_key": "-start_date"})
    h, d = get("https://cmr.earthdata.nasa.gov/search/granules.umm_json?" + q)
    n_od = sum(1 for it in d["items"] for u in it["umm"].get("RelatedUrls", [])
               if "opendap" in u["URL"].lower() or (u.get("Subtype") or "").upper().startswith("OPENDAP"))
    newest = d["items"][0]["umm"]["TemporalExtent"]["RangeDateTime"]["BeginningDateTime"] if d["items"] else None
    print(f"{short}: hits={h.get('CMR-Hits')} newest_start={newest} opendap_links_in_5_newest={n_od}")
````


### scripts/make_mock_gcov.py

**File:** `<scratch>/verify/harmony/scripts/make_mock_gcov.py`

````python
#!/usr/bin/env python3
"""Create two synthetic NISAR-GCOV-like HDF5 granules ("two dates of one track/frame") that
share one 10 m UTM pixel lattice but have slightly different extents, so the behaviour of the
deployed Harmony GDAL Adapter code (asfhyp3/harmony-gdal v0.0.3) can be tested offline.

The layout follows the mock used by the service's own test-suite (tests/mock/gcov.py in
https://github.com/ASFHyP3/harmony-gdal): groups /science/LSAR/GCOV/grids/frequency[A|B] with
float32 covariance layers, xCoordinates/yCoordinates (pixel centres) and a CF 'projection'
variable.  Additions here: realistic 10 m (freq A) / 80 m (freq B) posting, NaN fill outside a
slanted swath edge, linear-power values, a ubyte mask with fill value 255.

THIS IS SYNTHETIC DATA.  It is not a NISAR product; it only exercises the GDAL code path.

Run:  mamba/env/bin/python -I scripts/make_mock_gcov.py <output-dir>
"""
import sys
from pathlib import Path

import numpy as np
from osgeo import osr
from xarray import DataArray, DataTree, Dataset, Variable

osr.UseExceptions()
EPSG = 32611  # UTM 11N (Los Angeles)


def coord(dim, values, is_x):
    return Variable(dims=dim, data=np.asarray(values, dtype="float64"), attrs={
        "standard_name": "projection_x_coordinate" if is_x else "projection_y_coordinate",
        "long_name": f'{"X" if is_x else "Y"} coordinates of projection',
        "units": "meters", "pixel_coordinate_convention": "center"})


def projection(epsg):
    srs = osr.SpatialReference()
    srs.ImportFromEPSG(epsg)
    return DataArray(epsg, attrs={
        "epsg_code": str(epsg), "spatial_ref": srs.ExportToWkt(), "ellipsoid": "WGS84",
        "semi_major_axis": srs.GetSemiMajor(), "inverse_flattening": srs.GetInvFlattening(),
        "false_easting": srs.GetProjParm(osr.SRS_PP_FALSE_EASTING, 0.0),
        "false_northing": srs.GetProjParm(osr.SRS_PP_FALSE_NORTHING, 0.0),
        "grid_mapping_name": (srs.GetAttrValue("PROJECTION") or "unknown").lower()})


def layer_values(xc, yc, date_factor, pol_factor):
    """Deterministic linear-power 'gamma0' as a function of absolute map coordinates."""
    xx, yy = np.meshgrid(xc, yc)
    base = 0.05 + 0.04 * np.sin(xx / 900.0) * np.cos(yy / 700.0) + 0.02 * np.cos((xx + yy) / 150.0)
    v = (base * date_factor * pol_factor).astype("float32")
    # slanted swath edge: everything "left" of a line is outside the acquisition -> NaN
    outside = (xx - xc[0]) + 0.35 * (yc[0] - yy) < 2500.0
    v[outside] = np.nan
    return v, outside


def freq_group(x_ul_center, y_ul_center, step, ncols, nrows, date_factor, with_fill=True):
    xc = x_ul_center + step * np.arange(ncols)
    yc = y_ul_center - step * np.arange(nrows)
    hh, outside = layer_values(xc, yc, date_factor, 1.0)
    hv, _ = layer_values(xc, yc, date_factor, 0.25)
    mask = np.where(outside, 255, 1).astype("uint8")
    dims = ("yCoordinates", "xCoordinates")
    return Dataset({
        "HHHH": Variable(dims, hh, attrs={"grid_mapping": "projection", "units": "1",
                                          "long_name": "Geocoded polarimetric covariance term HHHH"}),
        "HVHV": Variable(dims, hv, attrs={"grid_mapping": "projection", "units": "1",
                                          "long_name": "Geocoded polarimetric covariance term HVHV"}),
        "mask": Variable(dims, mask, attrs={"grid_mapping": "projection", "long_name": "Valid samples subswath mask"}),
        "xCoordinates": coord("xCoordinates", xc, True),
        "yCoordinates": coord("yCoordinates", yc, False),
        "xCoordinateSpacing": float(step), "yCoordinateSpacing": -float(step),
        "listOfPolarizations": ("phony_dim_0", ["HH", "HV"]),
        "projection": projection(EPSG)})


def write(path, a_origin, a_shape, b_origin, b_shape, date_factor, start):
    dt = DataTree.from_dict({
        "/": Dataset(attrs={"mission_name": "NISAR", "note": "SYNTHETIC test file, not a NISAR product"}),
        "/science/LSAR/GCOV/grids/frequencyA": freq_group(*a_origin, 10.0, *a_shape, date_factor),
        "/science/LSAR/GCOV/grids/frequencyB": freq_group(*b_origin, 80.0, *b_shape, date_factor),
        "/science/LSAR/identification": Dataset({"productType": "GCOV", "missionId": "NISAR",
                                                 "zeroDopplerStartTime": start}),
    })
    enc_a = {k: {"chunksizes": (512, 512), "compression": "gzip"} for k in ("HHHH", "HVHV")}
    enc_a["mask"] = {"chunksizes": (512, 512), "compression": "gzip", "_FillValue": np.uint8(255)}
    enc_b = {k: {"chunksizes": (128, 128), "compression": "gzip"} for k in ("HHHH", "HVHV")}
    enc_b["mask"] = {"chunksizes": (128, 128), "compression": "gzip", "_FillValue": np.uint8(255)}
    dt.to_netcdf(filepath=path, engine="h5netcdf", encoding={
        "/science/LSAR/GCOV/grids/frequencyA": enc_a, "/science/LSAR/GCOV/grids/frequencyB": enc_b})
    print("wrote", path, f"{path.stat().st_size / 1e6:.1f} MB")


out = Path(sys.argv[1])
out.mkdir(parents=True, exist_ok=True)
# Date 1: freq A upper-left pixel CENTRE at (365005, 3785995) -> pixel edges on multiples of 10 m.
write(out / "NISAR_L2_PR_GCOV_MOCK_106_A_019_4005_DHDH_A_20260913T130003_20260913T130038_P05023_N_F_J_001.h5",
      (365005.0, 3785995.0), (3000, 2600), (365040.0, 3785960.0), (375, 325), 1.00, "2026-09-13T13:00:03")
# Date 2: SAME lattice, but the granule starts 7 px further east / 3 px further south and is smaller.
write(out / "NISAR_L2_PR_GCOV_MOCK_106_A_019_4005_DHDH_A_20261007T130003_20261007T130038_P05023_N_F_J_001.h5",
      (365075.0, 3785965.0), (2990, 2590), (365040.0, 3785960.0), (375, 325), 1.30, "2026-10-07T13:00:03")
````


### scripts/run_service_recipes.py

**File:** `<scratch>/verify/harmony/scripts/run_service_recipes.py`

````python
#!/usr/bin/env python3
"""Run the deployed Harmony GDAL Adapter code (harmony_gdal_adapter 0.0.3 = image
asfhyp3/harmony-gdal:0.0.3 reported by https://harmony.earthdata.nasa.gov/versions) on the
synthetic GCOV granules, driving it exactly the way HarmonyAdapter.process_item does:
RecipeInputOptions -> build_recipe (KCL nisar.k) -> execute_recipe (gdal.Translate / gdal.Warp),
with output names from harmony_service_lib.util.generate_output_filename.

Run:  mamba/env/bin/python -I scripts/run_service_recipes.py <mock-dir> <output-dir>
"""
import sys
import time
from pathlib import Path
from pprint import pformat

import harmony_gdal_adapter
from harmony_gdal_adapter.build_recipes import RecipeInputOptions, build_recipe
from harmony_gdal_adapter.gdal import execute_recipe
from harmony_service_lib.util import generate_output_filename
from osgeo import gdal

mock_dir, out_dir = Path(sys.argv[1]), Path(sys.argv[2])
out_dir.mkdir(parents=True, exist_ok=True)
print("harmony_gdal_adapter", harmony_gdal_adapter.__version__, "| GDAL", gdal.__version__)

HHHH = "/science/LSAR/GCOV/grids/frequencyA/HHHH"
HVHV = "/science/LSAR/GCOV/grids/frequencyA/HVHV"
MASK = "/science/LSAR/GCOV/grids/frequencyA/mask"
HHHH_B = "/science/LSAR/GCOV/grids/frequencyB/HHHH"
VVVV = "/science/LSAR/GCOV/grids/frequencyA/VVVV"  # not present in the mock (dual-pol H)

# Harmony passes subset.bbox as [west, south, east, north] in degrees.
BBOX_INSIDE = [-118.40, 34.05, -118.25, 34.15]      # fully inside both granules
BBOX_EDGE = [-118.60, 34.10, -118.40, 34.30]        # sticks out past the granule's W / N edge
BBOX_OUTSIDE = [-117.0, 35.0, -116.9, 35.1]         # no overlap at all

CASES = [
    # (case name, variables, bbox, target_srs)
    ("extract", [HHHH], None, None),
    ("bbox", [HHHH, HVHV, MASK, HHHH_B, VVVV], BBOX_INSIDE, None),
    ("bbox_edge", [HHHH], BBOX_EDGE, None),
    ("bbox_4326", [HHHH], BBOX_INSIDE, "EPSG:4326"),
    ("reproject_4326", [HHHH], None, "EPSG:4326"),
    ("bbox_outside", [HHHH], BBOX_OUTSIDE, None),
    ("bbox_3857", [HHHH], BBOX_INSIDE, "EPSG:3857"),
]

for h5 in sorted(mock_dir.glob("*.h5")):
    granule_name = h5.stem
    for case, variables, bbox, srs in CASES:
        d = out_dir / case
        d.mkdir(exist_ok=True)
        for var in variables:
            opts = RecipeInputOptions(input_filename=str(h5), output_filename="", collection_shortname="NISAR_L2_GCOV_PROVISIONAL_V1",
                                      output_type="image/tiff", variable_path=var.strip())
            if srs:
                opts.target_srs = srs
            if bbox:
                opts.spatial_extents_bounding_box = bbox
            name = generate_output_filename(filename=granule_name, variable_subset=[var], ext=".tif",
                                            is_subsetted=opts.spatial_extents_bounding_box is not None)
            opts.output_filename = str(d / name)
            t0 = time.time()
            try:
                recipe = build_recipe(opts)
                kind = type(recipe.inner).__name__
                execute_recipe(recipe)
                size = Path(opts.output_filename).stat().st_size
                print(f"OK   {case:15s} {kind:20s} {time.time() - t0:5.1f}s {size / 1e6:8.2f} MB  {name}")
                if case == "bbox" and var == HHHH and "20260913" in granule_name:
                    print("     recipe as built by KCL:\n     " + pformat(recipe).replace("\n", "\n     "))
            except Exception as e:  # report exactly what the service code raises
                print(f"FAIL {case:15s} {type(e).__module__}.{type(e).__name__}: {str(e)[:200]}  [{name}]")
````


### scripts/check_service_outputs.py

**File:** `<scratch>/verify/harmony/scripts/check_service_outputs.py`

````python
#!/usr/bin/env python3
"""Check the GeoTIFFs produced by scripts/run_service_recipes.py against the synthetic sources:
native lattice kept? pixel size? nodata? values untouched? two dates pixel-aligned? COG layout?

Run:  mamba/env/bin/python -I scripts/check_service_outputs.py <mock-dir> <output-dir>
"""
import sys
from pathlib import Path

import numpy as np
from osgeo import gdal, osr

gdal.UseExceptions()
mock_dir, out_dir = Path(sys.argv[1]), Path(sys.argv[2])
D1, D2 = "20260913", "20261007"


def src(date, var="//science/LSAR/GCOV/grids/frequencyA/HHHH"):
    h5 = next(p for p in mock_dir.glob("*.h5") if date in p.name)
    return gdal.Open(f'HDF5:"{h5}":{var}')


def describe(ds):
    gt = ds.GetGeoTransform()
    b = ds.GetRasterBand(1)
    srs = ds.GetSpatialRef()
    epsg = srs.GetAuthorityCode(None) if srs else None
    md = ds.GetMetadata("IMAGE_STRUCTURE")
    return dict(size=(ds.RasterXSize, ds.RasterYSize), bands=ds.RasterCount, dtype=gdal.GetDataTypeName(b.DataType),
                nodata=b.GetNoDataValue(), epsg=epsg, origin=(gt[0], gt[3]), pixel=(gt[1], gt[5]),
                block=b.GetBlockSize(), overviews=[(b.GetOverview(i).XSize, b.GetOverview(i).YSize) for i in range(b.GetOverviewCount())],
                layout=md.get("LAYOUT"), compression=md.get("COMPRESSION"), predictor=md.get("PREDICTOR"),
                colorinterp=gdal.GetColorInterpretationName(b.GetColorInterpretation()), mask_flags=b.GetMaskFlags())


def find(case, date, token):
    return next(p for p in (out_dir / case).glob("*.tif") if date in p.name and token in p.name)


print("GDAL", gdal.__version__)
print("\n--- SOURCE grids as GDAL's HDF5 driver reads them")
for date in (D1, D2):
    s = describe(src(date))
    print(f"  {date}: {s}")

print("\n--- 1. Plain extraction (gdal.Translate)")
for date in (D1, D2):
    o = gdal.Open(str(find("extract", date, "frequencyA_HHHH")))
    s, d = src(date), describe(o)
    same_gt = o.GetGeoTransform() == s.GetGeoTransform()
    same = np.array_equal(o.ReadAsArray(), s.ReadAsArray(), equal_nan=True)
    print(f"  {date}: {d}\n      geotransform identical to source: {same_gt}; pixel values identical to source: {same}; "
          f"NaN pixels: {int(np.isnan(o.ReadAsArray()).sum())}")
    print(f"      band metadata: {o.GetRasterBand(1).GetMetadata()}  unit={o.GetRasterBand(1).GetUnitType()!r}")

print("\n--- 2. Bounding-box subset, no reprojection (gdal.Warp cutline + crop_to_cutline)")
outs = {}
for date in (D1, D2):
    for token in ("frequencyA_HHHH", "frequencyA_HVHV", "frequencyA_mask", "frequencyB_HHHH"):
        p = find("bbox", date, token)
        o = gdal.Open(str(p))
        outs[(date, token)] = o
        d = describe(o)
        var = "//science/LSAR/GCOV/grids/" + token.replace("_", "/")
        s = src(date, var)
        sgt, ogt = s.GetGeoTransform(), o.GetGeoTransform()
        # offset of the output origin from the source lattice, in source pixels
        dx, dy = (ogt[0] - sgt[0]) / sgt[1], (ogt[3] - sgt[3]) / sgt[5]
        on_lattice = abs(dx - round(dx)) < 1e-9 and abs(dy - round(dy)) < 1e-9 and ogt[1] == sgt[1] and ogt[5] == sgt[5]
        vals_equal = None
        if on_lattice:
            xo, yo = int(round(dx)), int(round(dy))
            sa = s.ReadAsArray(xo, yo, o.RasterXSize, o.RasterYSize)
            oa = o.ReadAsArray()
            nod = d['nodata']
            cut = np.isnan(oa) if (nod is not None and np.isnan(nod)) else (oa == nod)
            src_cut = np.isnan(sa) if sa.dtype.kind == 'f' else (sa == nod)
            # pixels the cutline turned into nodata although the source had data there
            newly_cut = int((cut & ~src_cut).sum())
            vals_equal = bool(np.array_equal(sa[~cut], oa[~cut]))
            print(f"      [{token}] pixels kept={int((~cut).sum())} set to nodata by cutline={newly_cut} "
                  f"kept values bit-identical to source={vals_equal}")
        print(f"  {date} {token}: size={d['size']} origin={d['origin']} pixel={d['pixel']} dtype={d['dtype']} nodata={d['nodata']} "
              f"epsg={d['epsg']}\n      offset from source origin (px)=({dx:.6f},{dy:.6f}) on source lattice={on_lattice} "
              f"values identical to the same source window={vals_equal} layout={d['layout']} compression={d['compression']} "
              f"predictor={d['predictor']} block={d['block']} overviews={d['overviews']} bands={d['bands']}")
a, b = outs[(D1, "frequencyA_HHHH")], outs[(D2, "frequencyA_HHHH")]
print(f"  TWO DATES, same bbox: geotransform identical={a.GetGeoTransform() == b.GetGeoTransform()} "
      f"size identical={(a.RasterXSize, a.RasterYSize) == (b.RasterXSize, b.RasterYSize)}")
h, m = outs[(D1, "frequencyA_HHHH")], outs[(D1, "frequencyB_HHHH")]
print(f"  frequencyA vs frequencyB, same bbox: A origin={h.GetGeoTransform()[0], h.GetGeoTransform()[3]} size={h.RasterXSize, h.RasterYSize}; "
      f"B origin={m.GetGeoTransform()[0], m.GetGeoTransform()[3]} size={m.RasterXSize, m.RasterYSize}")
# requested bbox corners in UTM for reference
s4326, sutm = osr.SpatialReference(), osr.SpatialReference()
s4326.ImportFromEPSG(4326); s4326.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
sutm.ImportFromEPSG(32611)
ct = osr.CoordinateTransformation(s4326, sutm)
corners = [ct.TransformPoint(x, y)[:2] for x, y in ((-118.40, 34.05), (-118.40, 34.15), (-118.25, 34.15), (-118.25, 34.05))]
xs, ys = [c[0] for c in corners], [c[1] for c in corners]
print(f"  requested bbox in UTM 11N: x {min(xs):.2f}..{max(xs):.2f}, y {min(ys):.2f}..{max(ys):.2f}")
gt = a.GetGeoTransform()
print(f"  delivered extent (date 1): x {gt[0]:.2f}..{gt[0] + gt[1] * a.RasterXSize:.2f}, y {gt[3] + gt[5] * a.RasterYSize:.2f}..{gt[3]:.2f}")
arr = a.ReadAsArray()
print(f"  NaN pixels inside delivered rectangle (date 1): {int(np.isnan(arr).sum())} of {arr.size} "
      f"(corners outside the lat/lon box are cut to nodata by the cutline)")

print("\n--- 3. Bounding box overlapping the granule edge / swath gap")
for date in (D1, D2):
    o = gdal.Open(str(find("bbox_edge", date, "frequencyA_HHHH")))
    s = src(date)
    d = describe(o)
    sgt, ogt = s.GetGeoTransform(), o.GetGeoTransform()
    dx, dy = (ogt[0] - sgt[0]) / sgt[1], (ogt[3] - sgt[3]) / sgt[5]
    arr = o.ReadAsArray()
    print(f"  {date}: size={d['size']} origin={d['origin']} pixel={d['pixel']} nodata={d['nodata']} offset_px=({dx:.6f},{dy:.6f}) "
          f"NaN={int(np.isnan(arr).sum())}/{arr.size} zeros={int((arr == 0).sum())} min={np.nanmin(arr):.5f} max={np.nanmax(arr):.5f}")
a, b = gdal.Open(str(find("bbox_edge", D1, "frequencyA_HHHH"))), gdal.Open(str(find("bbox_edge", D2, "frequencyA_HHHH")))
print(f"  TWO DATES, same bbox at the edge: geotransform identical={a.GetGeoTransform() == b.GetGeoTransform()} "
      f"sizes={(a.RasterXSize, a.RasterYSize)} vs {(b.RasterXSize, b.RasterYSize)}")
ga, gb = a.GetGeoTransform(), b.GetGeoTransform()
print(f"  origin difference in pixels: dx={(gb[0] - ga[0]) / ga[1]:.6f} dy={(gb[3] - ga[3]) / ga[5]:.6f} (integer => still the same lattice)")

print("\n--- 4. Reprojection to EPSG:4326 (with and without bbox)")
for case in ("bbox_4326", "reproject_4326"):
    res = []
    for date in (D1, D2):
        o = gdal.Open(str(find(case, date, "frequencyA_HHHH")))
        d = describe(o)
        res.append(o.GetGeoTransform())
        arr = o.ReadAsArray()
        print(f"  {case} {date}: size={d['size']} origin={d['origin']} pixel={d['pixel']} epsg={d['epsg']} nodata={d['nodata']} "
              f"NaN={int(np.isnan(arr).sum())}/{arr.size} overviews={d['overviews']}")
    print(f"  {case}: two dates geotransform identical={res[0] == res[1]}; pixel size identical={res[0][1] == res[1][1] and res[0][5] == res[1][5]}; "
          f"origin offset in output pixels dx={(res[1][0] - res[0][0]) / res[0][1]:.4f} dy={(res[1][3] - res[0][3]) / res[0][5]:.4f}")
````


### scripts/cog_validate.py

**File:** `<scratch>/verify/harmony/scripts/cog_validate.py`

````python
#!/usr/bin/env python3
"""Validate GeoTIFFs as Cloud-Optimized GeoTIFFs with rio-cogeo (the validator the NASA
harmony-regression-tests use). Usage: venv/bin/python -I scripts/cog_validate.py <glob>"""
import glob, os, sys, warnings
import importlib.metadata as md

warnings.filterwarnings("ignore")
from rio_cogeo.cogeo import cog_info, cog_validate

print("rio-cogeo", md.version("rio-cogeo"))
for p in sorted(glob.glob(sys.argv[1])):
    valid, errors, warns = cog_validate(p)
    info = cog_info(p)
    print(f"{p.split('/')[-2]:15s} ...{os.path.basename(p)[-52:]:52s} valid_cog={valid} errors={errors} warnings={warns} "
          f"size_MB={os.path.getsize(p) / 1e6:.2f}\n      profile={info.Profile.model_dump()} n_ifd={len(info.IFD)} compression={info.Compression}")
````


### scripts/inspect_tif.py

**File:** `<scratch>/verify/harmony/scripts/inspect_tif.py`

````python
#!/usr/bin/env python3
"""Print grid / nodata / layout facts for GeoTIFFs (uses rasterio's bundled GDAL).
Usage: venv/bin/python -I scripts/inspect_tif.py file1.tif [file2.tif ...]"""
import sys

import numpy as np
import rasterio

for path in sys.argv[1:]:
    with rasterio.open(path) as ds:
        t = ds.transform
        print("=" * 90)
        print(path.split("/")[-1])
        print(f"  driver={ds.driver} size={ds.width}x{ds.height} bands={ds.count} dtypes={ds.dtypes} nodata={ds.nodatavals}")
        print(f"  crs={ds.crs}")
        print(f"  origin=({t.c}, {t.f}) pixel=({t.a}, {t.e}) rot=({t.b}, {t.d})")
        print(f"  bounds={tuple(ds.bounds)}")
        print(f"  block_shapes={ds.block_shapes} is_tiled={ds.profile.get('tiled')} compress={ds.profile.get('compress')} "
              f"interleave={ds.profile.get('interleave')} predictor={ds.tags(ns='IMAGE_STRUCTURE').get('PREDICTOR')}")
        print(f"  overviews(band1)={ds.overviews(1)} colorinterp={[c.name for c in ds.colorinterp]} mask_flags={ds.mask_flag_enums}")
        print(f"  IMAGE_STRUCTURE={ds.tags(ns='IMAGE_STRUCTURE')}")
        print(f"  dataset tags={ds.tags()}")
        print(f"  band1 tags={ds.tags(1)} descriptions={ds.descriptions} units={ds.units} scales={ds.scales} offsets={ds.offsets}")
        for b in range(1, ds.count + 1):
            a = ds.read(b)
            finite = np.isfinite(a) if a.dtype.kind == "f" else np.ones(a.shape, bool)
            print(f"  band{b}: min={a[finite].min() if finite.any() else None} max={a[finite].max() if finite.any() else None} "
                  f"n_nan={int((~finite).sum())} n_zero={int((a == 0).sum())} first_row[:6]={a[0, :6].tolist()} first_col[:4]={a[:4, 0].tolist()}")
````


### scripts/check_repos.sh

**File:** `<scratch>/verify/harmony/scripts/check_repos.sh`

````bash
#!/bin/bash
# Verify that the git clones under repos/ are unmodified and equal to what GitHub serves right now:
# for each clone compare the local HEAD of its branch with `git ls-remote`, show a clean/dirty
# working tree, and resolve the release tags that matter (harmony-gdal v0.0.3, harmony-py latest).
# The clones were made by an earlier run of this task (2026-11-13); this script is how the 2026-11-14
# session confirmed they match upstream. Equivalent commands to recreate them (run inside repos/):
#   git clone https://github.com/ASFHyP3/harmony-gdal.git ASFHyP3_harmony-gdal
#   git clone https://github.com/ASFHyP3/nisar-py.git ASFHyP3_nisar-py
#   git clone --depth 1 https://github.com/nasa/harmony.git harmony
#   git clone --depth 1 https://github.com/nasa/harmony-gdal-adapter.git nasa_harmony-gdal-adapter
#   git clone --depth 1 https://github.com/nasa/harmony-py.git nasa_harmony-py
#   git clone --depth 1 https://github.com/nasa/harmony-regression-tests.git nasa_harmony-regression-tests
#   git clone -q ASFHyP3_harmony-gdal harmony-gdal_v0.0.3 && git -C harmony-gdal_v0.0.3 checkout -q v0.0.3
# Usage: bash scripts/check_repos.sh
HERE="$(cd "$(dirname "$0")/.." && pwd)"
cd "$HERE/repos" || exit 1
date -u
check() {  # dir url
  local dir="$1" url="$2" br local_head remote_head dirty
  br=$(git -C "$dir" rev-parse --abbrev-ref HEAD)
  local_head=$(git -C "$dir" rev-parse HEAD)
  remote_head=$(git ls-remote "$url" "refs/heads/$br" | cut -f1)
  dirty=$(git -C "$dir" status --porcelain | wc -l | tr -d ' ')
  printf '%-32s branch=%-8s local=%s remote=%s %s modified_files=%s\n' "$dir" "$br" "$local_head" "$remote_head" \
    "$( [ -n "$remote_head" ] && [ "$local_head" = "$remote_head" ] && echo SAME_AS_UPSTREAM || echo DIFFERS )" "$dirty"
  git -C "$dir" log -1 --format='    last commit: %cI %s'
}
check ASFHyP3_harmony-gdal https://github.com/ASFHyP3/harmony-gdal.git
check ASFHyP3_nisar-py https://github.com/ASFHyP3/nisar-py.git
check harmony https://github.com/nasa/harmony.git
check nasa_harmony-gdal-adapter https://github.com/nasa/harmony-gdal-adapter.git
check nasa_harmony-py https://github.com/nasa/harmony-py.git
check nasa_harmony-regression-tests https://github.com/nasa/harmony-regression-tests.git
echo
echo "--- ASFHyP3/harmony-gdal tags upstream (the image deployed in Harmony production is asfhyp3/harmony-gdal:0.0.3)"
git ls-remote --tags https://github.com/ASFHyP3/harmony-gdal.git
echo "upstream refs/heads/main: $(git ls-remote https://github.com/ASFHyP3/harmony-gdal.git refs/heads/main | cut -f1)"
echo "local tag v0.0.3 commit:  $(git -C ASFHyP3_harmony-gdal rev-list -n1 v0.0.3)"
echo "harmony-gdal_v0.0.3 checkout HEAD: $(git -C harmony-gdal_v0.0.3 rev-parse HEAD) modified_files=$(git -C harmony-gdal_v0.0.3 status --porcelain | wc -l | tr -d ' ')"
echo
echo "--- nasa/harmony-py tags upstream (last 4)"
git ls-remote --tags https://github.com/nasa/harmony-py.git | tail -4
echo "--- ASFHyP3/nisar-py tags upstream (last 2)"
git ls-remote --tags https://github.com/ASFHyP3/nisar-py.git | tail -2
````


### scripts/fetch_nisar_docs.sh

**File:** `<scratch>/verify/harmony/scripts/fetch_nisar_docs.sh`

````bash
#!/bin/bash
# Fetch every page of https://nisar-docs.asf.alaska.edu (list taken from /myst.xref.json)
# as HTML and convert to text. No credentials, generic User-Agent.
set -u
HERE="$(cd "$(dirname "$0")/.." && pwd)"
UA="generic-research-client/1.0"
mkdir -p "$HERE/pages/nisar-docs"
/opt/anaconda3/bin/python3 -I -c '
import json,sys
d=json.load(open(sys.argv[1]))
seen=[]
for r in d["references"]:
    if r.get("kind")=="page" and r["url"] not in seen:
        seen.append(r["url"])
print("\n".join(seen))
' "$HERE/pages/myst.xref.json" | while read -r url; do
  slug="${url#/}"; [ -z "$slug" ] && slug="index"
  code=$(curl -sS -L -A "$UA" -o "$HERE/pages/nisar-docs/$slug.html" -w "%{http_code}" "https://nisar-docs.asf.alaska.edu$url")
  /opt/anaconda3/bin/python3 -I "$HERE/scripts/html2text.py" "$HERE/pages/nisar-docs/$slug.html" > "$HERE/pages/nisar-docs/$slug.txt"
  echo "$code $url $(wc -c < "$HERE/pages/nisar-docs/$slug.txt")"
done
````


### scripts/html2text.py

**File:** `<scratch>/verify/harmony/scripts/html2text.py`

````python
#!/usr/bin/env python3
"""Minimal HTML -> text dump (stdlib only). Usage: html2text.py file.html
Keeps link targets as [text](href) and marks <pre>/<code> blocks so that
documentation quotes can be reproduced verbatim."""
import sys, html
from html.parser import HTMLParser

class P(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out = []
        self.skip = 0
        self.href = []
        self.pre = 0
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in ("script", "style", "noscript", "svg"):
            self.skip += 1
        if self.skip:
            return
        if tag == "a":
            self.href.append(a.get("href"))
            self.out.append("[")
        if tag == "pre":
            self.pre += 1
            self.out.append("\n```\n")
        if tag in ("p", "div", "li", "tr", "br", "h1", "h2", "h3", "h4", "h5", "section", "table", "ul", "ol"):
            self.out.append("\n")
        if tag in ("h1", "h2", "h3", "h4", "h5"):
            self.out.append("#" * int(tag[1]) + " ")
        if tag == "img":
            self.out.append("<img alt=%r src=%r>" % (a.get("alt"), a.get("src")))
        if tag in ("td", "th"):
            self.out.append(" | ")
    def handle_endtag(self, tag):
        if tag in ("script", "style", "noscript", "svg"):
            self.skip = max(0, self.skip - 1)
            return
        if self.skip:
            return
        if tag == "a":
            h = self.href.pop() if self.href else None
            self.out.append("](%s)" % h)
        if tag == "pre":
            self.pre = max(0, self.pre - 1)
            self.out.append("\n```\n")
        if tag in ("p", "div", "li", "tr", "h1", "h2", "h3", "h4", "h5", "table"):
            self.out.append("\n")
    def handle_data(self, data):
        if self.skip:
            return
        self.out.append(data)

p = P()
p.feed(open(sys.argv[1], encoding="utf-8", errors="replace").read())
text = "".join(p.out)
import re
if True:
    # collapse blank-line runs but keep code blocks intact
    text = re.sub(r"\n[ \t]*\n[ \t\n]*", "\n\n", text)
print(text)
````


### scripts/spec_extract.py

**File:** `<scratch>/verify/harmony/scripts/spec_extract.py`

````python
#!/usr/bin/env python3
"""Extract the text of the public NISAR GCOV product specification PDF (JPL D-102274 Rev F) and print
every line that mentions the terms given on the command line, with page numbers and context.
Usage: venv_fresh/bin/python -I scripts/spec_extract.py <pdf> <txt-out> [regex ...]"""
import re
import sys

from pypdf import PdfReader

pdf, txt = sys.argv[1], sys.argv[2]
patterns = [re.compile(p, re.I) for p in sys.argv[3:]]
reader = PdfReader(pdf)
pages = [(i + 1, (page.extract_text() or "")) for i, page in enumerate(reader.pages)]
with open(txt, "w", encoding="utf-8") as f:
    for n, t in pages:
        f.write(f"\n\n===== page {n} =====\n{t}")
meta = reader.metadata or {}
print(f"pages={len(pages)} chars={sum(len(t) for _, t in pages)} title={meta.get('/Title')!r} created={meta.get('/CreationDate')!r}")
for pat in patterns:
    print(f"\n######## /{pat.pattern}/")
    hits = 0
    for n, t in pages:
        lines = t.splitlines()
        for i, line in enumerate(lines):
            if pat.search(line):
                hits += 1
                if hits <= 25:
                    ctx = " ⏎ ".join(s.strip() for s in lines[max(0, i - 1): i + 3])
                    print(f"  p{n}: {ctx[:420]}")
    print(f"  ({hits} matching lines)")
````


### scripts/nb_cells.py

**File:** `<scratch>/verify/harmony/scripts/nb_cells.py`

````python
#!/usr/bin/env python3
"""Print the markdown and code cells of Jupyter notebooks as plain text (stdlib only).
Usage: python3 -I scripts/nb_cells.py notebook.ipynb [...]"""
import json
import sys

for path in sys.argv[1:]:
    nb = json.load(open(path, encoding="utf-8"))
    print("=" * 30, path.split("/")[-1], "=" * 30)
    for i, c in enumerate(nb["cells"]):
        src = "".join(c["source"])
        print(f"--- [{i}] {c['cell_type']}")
        print(src)
````


### scripts/nb_grep.py

**File:** `<scratch>/verify/harmony/scripts/nb_grep.py`

````python
#!/usr/bin/env python3
"""Search the markdown/code cells of Jupyter notebooks for a regex and print matching cells (trimmed).
Outputs/embedded images are ignored.  Usage: python3 -I scripts/nb_grep.py '<regex>' notebook.ipynb [...]"""
import json
import re
import sys

pat = re.compile(sys.argv[1], re.I)
for path in sys.argv[2:]:
    nb = json.load(open(path, encoding="utf-8"))
    for i, c in enumerate(nb["cells"]):
        src = "".join(c["source"])
        if pat.search(src):
            print(f"=== {path.split('/')[-1]} [{i}] {c['cell_type']}")
            print(src[:2500])
````


## Appendix B. Saved outputs, verbatim

### out/setup_venv.txt

**File:** `<scratch>/verify/harmony/out/setup_venv.txt`

````
Sat Nov 14 07:50:03 UTC 2026
--- python: Python 3.12.2
--- pip freeze
affine==3.0.1
annotated-types==0.8.0
attrs==26.1.0
certifi==2026.10.23
charset-normalizer==3.5.2
click==8.5.1
curlify==3.0.0
h5py==3.16.0
harmony-py==1.8.0
idna==3.20
morecantile==7.1.0
numpy==2.5.4
progressbar2==4.7.0
pydantic==2.14.3
pydantic_core==2.50.4
pyparsing==3.3.3
pypdf==7.1.0
pyproj==3.8.0
python-dateutil==4.0.0
python-dotenv==1.2.4
python-utils==4.2.2
rasterio==1.5.2
requests==2.34.2
rio-cogeo==7.0.4
shapely==2.2.0
typing-inspection==0.4.5
typing_extensions==4.16.0
tzdata==2026.6
urllib3==2.8.0
--- newest harmony-py on PyPI
harmony-py (1.8.0)
Available versions: 1.8.0, 1.7.0, 1.6.0, 1.5.0, 1.4.0, 1.3.4, 1.3.3, 1.3.2, 1.3.1, 1.3.0, 1.2.0, 1.1.0, 1.0.0, 0.7.0, 0.6.0, 0.5.1, 0.5.0, 0.4.15, 0.4.14, 0.4.13, 0.4.12, 0.4.11, 0.4.10, 0.4.9, 0.4.8, 0.4.7, 0.4.6, 0.4.5, 0.4.4, 0.4.3, 0.4.2, 0.4.1, 0.4.0, 0.3.0, 0.2.0, 0.1.2, 0.1.1, 0.1.0, 0.0.1
  INSTALLED: 1.8.0
````


### out/harmony_py_no_login.txt

**File:** `<scratch>/verify/harmony/out/harmony_py_no_login.txt`

````
harmony-py 1.8.0

--- A) Client() with no credentials (validates against /jobs)
UNEXPECTED: client created and validated

--- B) capabilities through harmony-py, no login
shortName: NISAR_L2_GCOV_PROVISIONAL_V1 | capabilitiesVersion: 3
summary.subsetting: {"bbox": true, "dimension": false, "shape": false, "temporal": false, "variable": true}
summary.outputFormats: [{"name": "GEOTIFF", "mimeType": "image/tiff"}, {"name": "PNG", "mimeType": "image/png"}]
services: ['nasa/harmony-gdal-adapter', 'asf/nisar-py']
variable: /science/LSAR/GCOV/grids/frequencyA/HHHH -> V4137651715-ASF
variable: /science/LSAR/GCOV/grids/frequencyA/HVHV -> V4137651725-ASF

--- C) submit() of a NISAR GCOV request, no login
request.is_valid(): True
builtins.Exception: Harmony returned a non-JSON response. This may indicate an authentication failure. Try using a token for authentication when creating your Client or check that your .netrc file contains valid credentials for the Earthdata Login host (e.g. urs.earthdata.nasa.gov or uat.urs.earthdata.nasa.gov).
Raw re
raised in: get_json_from_response <- submit
````


### out/harmony_py_auth_check.txt

**File:** `<scratch>/verify/harmony/out/harmony_py_auth_check.txt`

````
return value: None
stdout printed by harmony-py (first 80 chars): 'Request is successful. Raw response: <!DOCTYPE html>\n<!--[if lt IE 7]><html clas'
AUTHENTICATED: False
bogus token -> builtins.Exception: ('Unauthorized', 'Error: You are not authorized to access the requested resource')
````


### out/harmony_py_download_name.txt

**File:** `<scratch>/verify/harmony/out/harmony_py_download_name.txt`

````
result URL (illustrative job/work-item ids): https://harmony.earthdata.nasa.gov/service-results/harmony-prod-staging/public/0f8fad5b-d9cb-469f-a165-70867728950e/123456789/NISAR_L2_PR_GCOV_033_106_A_019_4005_DHDH_A_20261019T130003_20261019T130038_P05023_N_F_J_001_science_LSAR_GCOV_grids_frequencyA_HHHH_subsetted.tif
local file name: 123456789_NISAR_L2_PR_GCOV_033_106_A_019_4005_DHDH_A_20261019T130003_20261019T130038_P05023_N_F_J_001_science_LSAR_GCOV_grids_frequencyA_HHHH_subsetted.tif
NUM_REQUESTS_WORKERS (parallel downloads): 3 | DOWNLOAD_CHUNK_SIZE: 4194304
check_interval (s): 3.0
````


### out/probe_unauthenticated.txt

**File:** `<scratch>/verify/harmony/out/probe_unauthenticated.txt`

````
Sat Nov 14 07:49:32 UTC 2026
harmony landing                    http=200 redirect= type=text/html; charset=utf-8 bytes=8023
    https://harmony.earthdata.nasa.gov/
harmony docs                       http=200 redirect= type=text/html; charset=utf-8 bytes=154699
    https://harmony.earthdata.nasa.gov/docs
harmony versions                   http=200 redirect= type=application/json; charset=utf-8 bytes=7873
    https://harmony.earthdata.nasa.gov/versions
capabilities collectionId          http=200 redirect= type=application/json; charset=utf-8 bytes=18264
    https://harmony.earthdata.nasa.gov/capabilities?collectionId=C2854338529-ASF
capabilities collectionid (lc)     http=200 redirect= type=application/json; charset=utf-8 bytes=18264
    https://harmony.earthdata.nasa.gov/capabilities?collectionid=C2854338529-ASF
capabilities shortName             http=200 redirect= type=application/json; charset=utf-8 bytes=18264
    https://harmony.earthdata.nasa.gov/capabilities?shortName=NISAR_L2_GCOV_PROVISIONAL_V1
capabilities v2                    http=200 redirect= type=application/json; charset=utf-8 bytes=3316
    https://harmony.earthdata.nasa.gov/capabilities?collectionId=C2854338529-ASF&version=2
swagger coverages api              http=301 redirect=https://harmony.earthdata.nasa.gov/docs/api/ type=text/html; charset=UTF-8 bytes=158
    https://harmony.earthdata.nasa.gov/docs/api
swagger edr api                    http=301 redirect=https://harmony.earthdata.nasa.gov/docs/edr-api/ type=text/html; charset=UTF-8 bytes=162
    https://harmony.earthdata.nasa.gov/docs/edr-api
coverages request (NISAR GCOV)     http=303 redirect=https://urs.earthdata.nasa.gov/oauth/authorize?<query-elided> type=text/plain; charset=utf-8 bytes=237
    https://harmony.earthdata.nasa.gov/C2854338529-ASF/ogc-api-coverages/1.0.0/collections/parameter_vars/coverage/rangeset?forceAsync=true&subset=lat(33.9%3A34.2)&subset=lon(-118.5%3A-118.1)&granuleId=G4381234094-ASF&format=image%2Ftiff&variable=%2Fscience%2FLSAR%2FGCOV%2Fgrids%2FfrequencyA%2FHHHH&variable=%2Fscience%2FLSAR%2FGCOV%2Fgrids%2FfrequencyA%2FHVHV
coverages landing for coll.        http=303 redirect=https://urs.earthdata.nasa.gov/oauth/authorize?<query-elided> type=text/plain; charset=utf-8 bytes=237
    https://harmony.earthdata.nasa.gov/C2854338529-ASF/ogc-api-coverages/1.0.0/
coverages collections list         http=303 redirect=https://urs.earthdata.nasa.gov/oauth/authorize?<query-elided> type=text/plain; charset=utf-8 bytes=237
    https://harmony.earthdata.nasa.gov/C2854338529-ASF/ogc-api-coverages/1.0.0/collections
edr cube request (NISAR GCOV)      http=303 redirect=https://urs.earthdata.nasa.gov/oauth/authorize?<query-elided> type=text/plain; charset=utf-8 bytes=237
    https://harmony.earthdata.nasa.gov/ogc-api-edr/1.1.0/collections/C2854338529-ASF/cube?bbox=-118.5,33.9,-118.1,34.2&granuleId=G4381234094-ASF&f=image%2Ftiff&parameter-name=V4137651715-ASF,V4137651725-ASF
jobs list                          http=303 redirect=https://urs.earthdata.nasa.gov/oauth/authorize?<query-elided> type=text/plain; charset=utf-8 bytes=237
    https://harmony.earthdata.nasa.gov/jobs
job status (random uuid)           http=303 redirect=https://urs.earthdata.nasa.gov/oauth/authorize?<query-elided> type=text/plain; charset=utf-8 bytes=237
    https://harmony.earthdata.nasa.gov/jobs/00000000-0000-4000-8000-000000000000
stac (random uuid)                 http=404 redirect= type=application/json; charset=utf-8 bytes=111
    https://harmony.earthdata.nasa.gov/stac/00000000-0000-4000-8000-000000000000
cloud-access                       http=303 redirect=https://urs.earthdata.nasa.gov/oauth/authorize?<query-elided> type=text/plain; charset=utf-8 bytes=237
    https://harmony.earthdata.nasa.gov/cloud-access
workflow-ui                        http=303 redirect=https://urs.earthdata.nasa.gov/oauth/authorize?<query-elided> type=text/plain; charset=utf-8 bytes=237
    https://harmony.earthdata.nasa.gov/workflow-ui
service-results (random key)       http=303 redirect=https://urs.earthdata.nasa.gov/oauth/authorize?<query-elided> type=text/plain; charset=utf-8 bytes=237
    https://harmony.earthdata.nasa.gov/service-results/harmony-prod-staging/public/nasa/harmony-gdal-adapter/x/y.tif

--- CMR (metadata) ---
cmr collection concept             http=200 redirect= type=application/vnd.nasa.cmr.umm+json;version=1.18.6; charset=utf-8 bytes=10672
    https://cmr.earthdata.nasa.gov/search/concepts/C2854338529-ASF.umm_json
cmr granule search                 http=200 redirect= type=application/json;charset=utf-8 bytes=25381
    https://cmr.earthdata.nasa.gov/search/granules.json?collection_concept_id=C2854338529-ASF&page_size=1
cmr variables for collection       http=200 redirect= type=application/vnd.nasa.cmr.umm_results+json;version=1.9.0; charset=utf-8 bytes=4882
    https://cmr.earthdata.nasa.gov/search/variables.umm_json?keyword=C2854338529-ASF&page_size=5

--- ASF data distribution (one real GCOV granule) ---
asf h5 download                    http=302 redirect=https://urs.earthdata.nasa.gov/oauth/authorize?<query-elided> type=application/json bytes=0
    https://nisar.asf.earthdatacloud.nasa.gov/NISAR/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_033_106_A_019_4005_DHDH_A_20261019T130003_20261019T130038_P05023_N_F_J_001/NISAR_L2_PR_GCOV_033_106_A_019_4005_DHDH_A_20261019T130003_20261019T130038_P05023_N_F_J_001.h5
asf browse png (NATIVE_A_HHHH)     http=303 redirect=https://d1mv8zhcvry6x4.cloudfront.net/s3-7fdfbcb0ce308dc58d08f97acb1f0590/sds-n-cumulus-prod-nisar-browse.s3.us-west-2.amazonaws.com/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_033_106_A_019_4005_DHDH_A_20261019T130003_20261019T130038_P05023_N_F_J_001/NISAR_L2_PR_GCOV_033_106_A_019_4005_DHDH_A_20261019T130003_20261019T130038_P05023_N_F_J_001_NATIVE_A_HHHH.png?<query-elided> type=application/json bytes=0
    https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_033_106_A_019_4005_DHDH_A_20261019T130003_20261019T130038_P05023_N_F_J_001/NISAR_L2_PR_GCOV_033_106_A_019_4005_DHDH_A_20261019T130003_20261019T130038_P05023_N_F_J_001_NATIVE_A_HHHH.png
asf browse png (LATLON)            http=303 redirect=https://d1mv8zhcvry6x4.cloudfront.net/s3-7fdfbcb0ce308dc58d08f97acb1f0590/sds-n-cumulus-prod-nisar-browse.s3.us-west-2.amazonaws.com/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_033_106_A_019_4005_DHDH_A_20261019T130003_20261019T130038_P05023_N_F_J_001/NISAR_L2_PR_GCOV_033_106_A_019_4005_DHDH_A_20261019T130003_20261019T130038_P05023_N_F_J_001_LATLON.png?<query-elided> type=application/json bytes=0
    https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_033_106_A_019_4005_DHDH_A_20261019T130003_20261019T130038_P05023_N_F_J_001/NISAR_L2_PR_GCOV_033_106_A_019_4005_DHDH_A_20261019T130003_20261019T130038_P05023_N_F_J_001_LATLON.png
asf iso.xml metadata               http=302 redirect=https://urs.earthdata.nasa.gov/oauth/authorize?<query-elided> type=application/json bytes=0
    https://nisar.asf.earthdatacloud.nasa.gov/NISAR/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_033_106_A_019_4005_DHDH_A_20261019T130003_20261019T130038_P05023_N_F_J_001/NISAR_L2_PR_GCOV_033_106_A_019_4005_DHDH_A_20261019T130003_20261019T130038_P05023_N_F_J_001.h5.iso.xml
asf s3credentials endpoint         http=302 redirect=https://urs.earthdata.nasa.gov/oauth/authorize?<query-elided> type=application/json bytes=0
    https://nisar.asf.earthdatacloud.nasa.gov/s3credentials
````


### out/probe_sidecars.txt

**File:** `<scratch>/verify/harmony/out/probe_sidecars.txt`

````
Sat Nov 14 07:53:28 UTC 2026
NISAR/<granule>.h5                 http=302 redirect=https://urs.earthdata.nasa.gov/...
NISAR/<granule>.h5.iso.xml         http=302 redirect=https://urs.earthdata.nasa.gov/...
NISAR/<granule>.rc.yaml            http=302 redirect=https://urs.earthdata.nasa.gov/...
NISAR/<granule>_NATIVE.kml         http=302 redirect=https://urs.earthdata.nasa.gov/...
NISAR/<granule>_LATLON.kml         http=302 redirect=https://urs.earthdata.nasa.gov/...
NISAR/<granule>_NATIVE_A_HHHH.kml  http=302 redirect=https://urs.earthdata.nasa.gov/...
NISAR/<granule>_QA_REPORT.pdf      http=302 redirect=https://urs.earthdata.nasa.gov/...
NISAR/<granule>_QA_SUMMARY.csv     http=302 redirect=https://urs.earthdata.nasa.gov/...
NISAR/<granule>_QA_STATS.h5        http=302 redirect=https://urs.earthdata.nasa.gov/...
BROWSE/<granule>_NATIVE.png        http=303 redirect=https://d1mv8zhcvry6x4.cloudfront.net/...
BROWSE/<granule>_LATLON.png        http=303 redirect=https://d1mv8zhcvry6x4.cloudfront.net/...
BROWSE/<granule>_LATLON_thumbnail.png http=303 redirect=https://d1mv8zhcvry6x4.cloudfront.net/...
BROWSE/<granule>_NATIVE_A_HHHH.png http=303 redirect=https://d1mv8zhcvry6x4.cloudfront.net/...
BROWSE/<granule>_NATIVE_A_HVHV.png http=303 redirect=https://d1mv8zhcvry6x4.cloudfront.net/...
BROWSE/<granule>_NATIVE_B_HHHH.png http=303 redirect=https://d1mv8zhcvry6x4.cloudfront.net/...
BROWSE/<granule>_NATIVE.kml        http=404 redirect=
BROWSE/<granule>_NATIVE.png.aux.xml http=404 redirect=
s3credentials                      http=302 redirect=https://urs.earthdata.nasa.gov/...
s3credentialsREADME                http=200 redirect=
````


### out/fetch_service_metadata.txt

**File:** `<scratch>/verify/harmony/out/fetch_service_metadata.txt`

````
/versions http=200 service chains=26
   nasa/harmony-gdal-adapter    image=harmonyservices/query-cmr tag=latest imageDigest=sha256:52597aab1bfcf03aced5f9b lastUpdated=2026-11-10T18:52:45Z
   nasa/harmony-gdal-adapter    image=asfhyp3/harmony-gdal tag=0.0.3 imageDigest=None lastUpdated=None
   asf/opera-rtc-s1-browse      image=harmonyservices/query-cmr tag=latest imageDigest=sha256:52597aab1bfcf03aced5f9b lastUpdated=2026-11-10T18:52:45Z
   asf/opera-rtc-s1-browse      image=asfhyp3/opera-rtc-s1-browse tag=0.5.4 imageDigest=None lastUpdated=None
   asf/opera-rtc-s1-browse      image=nasa/harmony-browse-image-generator tag=2.9.3 imageDigest=None lastUpdated=None
   asf/nisar-py                 image=harmonyservices/query-cmr tag=latest imageDigest=sha256:52597aab1bfcf03aced5f9b lastUpdated=2026-11-10T18:52:45Z
   asf/nisar-py                 image=asfhyp3/nisar-py tag=0.4.0 imageDigest=None lastUpdated=None
   asf/nisar-py                 image=nasa/harmony-browse-image-generator tag=2.9.3 imageDigest=None lastUpdated=None

UMM-S S4389714698-ASF http=200
   Name: Harmony GDAL Adapter
   LongName: Harmony GDAL Adapter
   Version: 4.0.0
   Type: Harmony
   Description: Harmony service supporting variable subsetting, spatial subsetting, and reprojection of NISAR L2-3 data products via gdalwarp.
   URL: {'URLValue': 'https://harmony.earthdata.nasa.gov'}
   ServiceOptions.Subset: {"SpatialSubset": {"BoundingBox": {"AllowMultipleValues": false}}, "VariableSubset": {"AllowMultipleValues": true}}
   ServiceOptions.VariableAggregationSupportedMethods: None
   ServiceOptions.SupportedReformattings: [{"SupportedOutputFormats": ["COG"], "SupportedInputFormat": "HDF5"}]
   ServiceOptions.InterpolationTypes: None
   ServiceOptions.SupportedOutputProjections: n=123 first=['EPSG:4326', 'EPSG:3413', 'EPSG:3031', 'EPSG:32601'] last=['EPSG:32758', 'EPSG:32759', 'EPSG:32760']
   OperationMetadata: null
   other keys: ['URL', 'Type', 'ServiceKeywords', 'ServiceOrganizations', 'Description', 'Version', 'Name', 'MetadataSpecification', 'LongName']

UMM-S S4166720787-ASF http=200
   Name: NISAR GCOV Browse
   LongName: NISAR GCOV Browse
   Version: 0.0.1
   Type: Harmony
   Description: Generates GIBS-compatible false color browse imagery for the NISAR_L2_GCOV_BETA_V1 collection.
   URL: {'URLValue': 'https://harmony.earthdata.nasa.gov'}
   ServiceOptions.Subset: null
   ServiceOptions.VariableAggregationSupportedMethods: None
   ServiceOptions.SupportedReformattings: [{"SupportedOutputFormats": ["PNG"], "SupportedInputFormat": "HDF5"}]
   ServiceOptions.InterpolationTypes: None
   ServiceOptions.SupportedOutputProjections: n=1 first=['Geographic'] last=['Geographic']
   OperationMetadata: null
   other keys: ['URL', 'Type', 'ServiceKeywords', 'ServiceOrganizations', 'LastUpdatedDate', 'Description', 'Version', 'Name', 'MetadataSpecification', 'LongName']

UMM-Var V4137651715-ASF http=200: {"Name": "/science/LSAR/GCOV/grids/frequencyA/HHHH", "LongName": "Frequency A HHHH", "Definition": "Covariance between HH and HH", "DataType": "float32", "MetadataSpecification": {"URL": "https://cdn.earthdata.nasa.gov/umm/variable/v1.9.0", "Name": "UMM-Var", "Version": "1.9.0"}}

UMM-Var V4137651725-ASF http=200: {"Name": "/science/LSAR/GCOV/grids/frequencyA/HVHV", "LongName": "Frequency A HVHV", "Definition": "Covariance between HV and HV", "DataType": "float32", "MetadataSpecification": {"URL": "https://cdn.earthdata.nasa.gov/umm/variable/v1.9.0", "Name": "UMM-Var", "Version": "1.9.0"}}

UMM-Var V4137651736-ASF http=200: {"Name": "/science/LSAR/GCOV/grids/frequencyA/mask", "LongName": "Frequency A Mask ", "Definition": "Mask indicating the subswath number associated with valid GCOV samples. A GCOV sample is only considered valid if it is generated from fully-focused radar samples. If at least one radar sample in the averaging set is partially focused or invalid, the corresponding mask pixel will contain the value `0`. GCOV pixels outside of the radar acquisition extent are filled with the value `255`", "DataType": "ubyte", "MetadataSpecification": {"URL": "https://cdn.earthdata.nasa.gov/umm/variable/v1.9.0", "Name": "UMM-Var", "Version": "1.9.0"}}

UMM-Var V4137651748-ASF http=200: {"Name": "/science/LSAR/GCOV/grids/frequencyA/numberOfLooks", "LongName": "Frequency A Number of Looks", "Definition": "Number of averaged radar-grid pixels for covariance estimation", "DataType": "float32", "MetadataSpecification": {"URL": "https://cdn.earthdata.nasa.gov/umm/variable/v1.9.0", "Name": "UMM-Var", "Version": "1.9.0"}}

UMM-Var V4137651754-ASF http=200: {"Name": "/science/LSAR/GCOV/grids/frequencyA/rtcGammaToSigmaFactor", "LongName": "Frequency A RTC Gamma to Sigma Factor", "Definition": "Radiometric terrain correction factor to normalize GCOV terms from gamma0 to sigma0", "DataType": "float32", "MetadataSpecification": {"URL": "https://cdn.earthdata.nasa.gov/umm/variable/v1.9.0", "Name": "UMM-Var", "Version": "1.9.0"}}
````


### out/harmony_variables_by_collection.txt

**File:** `<scratch>/verify/harmony/out/harmony_variables_by_collection.txt`

````
=== NISAR_L2_GCOV_BETA_V1 C3622214170-ASF: services=[('nasa/harmony-gdal-adapter', 'S4389714698-ASF', ['image/tiff']), ('asf/nisar-py', 'S4166720787-ASF', ['image/png'])]
=== NISAR_L2_GCOV_PROVISIONAL_V1 C2854338529-ASF: services=[('nasa/harmony-gdal-adapter', 'S4389714698-ASF', ['image/tiff']), ('asf/nisar-py', 'S4166720787-ASF', ['image/png'])]
=== NISAR_L2_GCOV_V1 C3622241360-ASF: services=[('nasa/harmony-gdal-adapter', 'S4389714698-ASF', ['image/tiff']), ('asf/nisar-py', 'S4166720787-ASF', ['image/png'])]
=== NISAR_L2_GOFF_BETA_V1 C2850263910-ASF: services=[('nasa/harmony-gdal-adapter', 'S4389714698-ASF', ['image/tiff'])]
=== NISAR_L2_GOFF_PROVISIONAL_V1 C2854341702-ASF: services=[('nasa/harmony-gdal-adapter', 'S4389714698-ASF', ['image/tiff'])]
=== NISAR_L2_GOFF_V1 C3622250865-ASF: services=[('nasa/harmony-gdal-adapter', 'S4389714698-ASF', ['image/tiff'])]
=== NISAR_L2_GUNW_BETA_V1 C2850261892-ASF: services=[('nasa/harmony-gdal-adapter', 'S4389714698-ASF', ['image/tiff'])]
=== NISAR_L2_GUNW_PROVISIONAL_V1 C2854335566-ASF: services=[('nasa/harmony-gdal-adapter', 'S4389714698-ASF', ['image/tiff'])]
=== NISAR_L2_GUNW_V1 C3622247503-ASF: services=[('nasa/harmony-gdal-adapter', 'S4389714698-ASF', ['image/tiff'])]
=== NISAR_L3_SME2_BETA_V1 C2850265000-ASF: services=[('nasa/harmony-gdal-adapter', 'S4389714698-ASF', ['image/tiff'])]
=== NISAR_L3_SME2_PROVISIONAL_V1 C2854344945-ASF: services=[('nasa/harmony-gdal-adapter', 'S4389714698-ASF', ['image/tiff'])]

--- GCOV: collections=['NISAR_L2_GCOV_BETA_V1', 'NISAR_L2_GCOV_PROVISIONAL_V1', 'NISAR_L2_GCOV_V1']
    variable list (names + UMM-Var concept ids) identical across these collections: True; count=20
    /science/LSAR/GCOV/grids/frequencyA/HHHH  V4137651715-ASF
    /science/LSAR/GCOV/grids/frequencyA/HHHV  V4132622337-ASF
    /science/LSAR/GCOV/grids/frequencyA/HHVH  V4137625794-ASF
    /science/LSAR/GCOV/grids/frequencyA/HHVV  V4137625795-ASF
    /science/LSAR/GCOV/grids/frequencyA/HVHV  V4137651725-ASF
    /science/LSAR/GCOV/grids/frequencyA/HVVH  V4137625796-ASF
    /science/LSAR/GCOV/grids/frequencyA/HVVV  V4137625797-ASF
    /science/LSAR/GCOV/grids/frequencyA/mask  V4137651736-ASF
    /science/LSAR/GCOV/grids/frequencyA/numberOfLooks  V4137651748-ASF
    /science/LSAR/GCOV/grids/frequencyA/rtcGammaToSigmaFactor  V4137651754-ASF
    /science/LSAR/GCOV/grids/frequencyA/VHVH  V4137651763-ASF
    /science/LSAR/GCOV/grids/frequencyA/VHVV  V4137625798-ASF
    /science/LSAR/GCOV/grids/frequencyA/VVVV  V4137651771-ASF
    /science/LSAR/GCOV/grids/frequencyB/HHHH  V4137650465-ASF
    /science/LSAR/GCOV/grids/frequencyB/HVHV  V4137650467-ASF
    /science/LSAR/GCOV/grids/frequencyB/mask  V4137650471-ASF
    /science/LSAR/GCOV/grids/frequencyB/numberOfLooks  V4137650474-ASF
    /science/LSAR/GCOV/grids/frequencyB/rtcGammaToSigmaFactor  V4137650475-ASF
    /science/LSAR/GCOV/grids/frequencyB/VHVH  V4137650477-ASF
    /science/LSAR/GCOV/grids/frequencyB/VVVV  V4137650481-ASF
--- GOFF: collections=['NISAR_L2_GOFF_BETA_V1', 'NISAR_L2_GOFF_PROVISIONAL_V1', 'NISAR_L2_GOFF_V1']
    variable list (names + UMM-Var concept ids) identical across these collections: True; count=43
    /science/LSAR/GOFF/grids/frequencyA/pixelOffsets/HH/layer1/alongTrackOffset  V4281408825-ASF
    /science/LSAR/GOFF/grids/frequencyA/pixelOffsets/HH/layer1/alongTrackOffsetVariance  V4281408539-ASF
    /science/LSAR/GOFF/grids/frequencyA/pixelOffsets/HH/layer1/correlationSurfacePeak  V4281408244-ASF
    /science/LSAR/GOFF/grids/frequencyA/pixelOffsets/HH/layer1/crossOffsetVariance  V4281407828-ASF
    /science/LSAR/GOFF/grids/frequencyA/pixelOffsets/HH/layer1/slantRangeOffset  V4281407552-ASF
    /science/LSAR/GOFF/grids/frequencyA/pixelOffsets/HH/layer1/slantRangeOffsetVariance  V4281407153-ASF
    /science/LSAR/GOFF/grids/frequencyA/pixelOffsets/HH/layer1/snr  V4281406777-ASF
    /science/LSAR/GOFF/grids/frequencyA/pixelOffsets/HH/layer2/alongTrackOffset  V4281406489-ASF
    /science/LSAR/GOFF/grids/frequencyA/pixelOffsets/HH/layer2/alongTrackOffsetVariance  V4281406349-ASF
    /science/LSAR/GOFF/grids/frequencyA/pixelOffsets/HH/layer2/correlationSurfacePeak  V4281405803-ASF
    /science/LSAR/GOFF/grids/frequencyA/pixelOffsets/HH/layer2/crossOffsetVariance  V4281405322-ASF
    /science/LSAR/GOFF/grids/frequencyA/pixelOffsets/HH/layer2/slantRangeOffset  V4281404978-ASF
    /science/LSAR/GOFF/grids/frequencyA/pixelOffsets/HH/layer2/slantRangeOffsetVariance  V4281404463-ASF
    /science/LSAR/GOFF/grids/frequencyA/pixelOffsets/HH/layer2/snr  V4281404202-ASF
    /science/LSAR/GOFF/grids/frequencyA/pixelOffsets/HH/layer3/alongTrackOffset  V4281404085-ASF
    /science/LSAR/GOFF/grids/frequencyA/pixelOffsets/HH/layer3/alongTrackOffsetVariance  V4281403814-ASF
    /science/LSAR/GOFF/grids/frequencyA/pixelOffsets/HH/layer3/correlationSurfacePeak  V4281403697-ASF
    /science/LSAR/GOFF/grids/frequencyA/pixelOffsets/HH/layer3/crossOffsetVariance  V4281403208-ASF
    /science/LSAR/GOFF/grids/frequencyA/pixelOffsets/HH/layer3/slantRangeOffset  V4281402925-ASF
    /science/LSAR/GOFF/grids/frequencyA/pixelOffsets/HH/layer3/slantRangeOffsetVariance  V4281402814-ASF
    /science/LSAR/GOFF/grids/frequencyA/pixelOffsets/HH/layer3/snr  V4281402128-ASF
    /science/LSAR/GOFF/grids/frequencyA/pixelOffsets/mask  V4281402014-ASF
    /science/LSAR/GOFF/grids/frequencyA/pixelOffsets/VV/layer1/alongTrackOffset  V4281401731-ASF
    /science/LSAR/GOFF/grids/frequencyA/pixelOffsets/VV/layer1/alongTrackOffsetVariance  V4281401357-ASF
    /science/LSAR/GOFF/grids/frequencyA/pixelOffsets/VV/layer1/correlationSurfacePeak  V4281401032-ASF
    /science/LSAR/GOFF/grids/frequencyA/pixelOffsets/VV/layer1/crossOffsetVariance  V4281400756-ASF
    /science/LSAR/GOFF/grids/frequencyA/pixelOffsets/VV/layer1/slantRangeOffset  V4281400616-ASF
    /science/LSAR/GOFF/grids/frequencyA/pixelOffsets/VV/layer1/slantRangeOffsetVariance  V4281399850-ASF
    /science/LSAR/GOFF/grids/frequencyA/pixelOffsets/VV/layer1/snr  V4281399718-ASF
    /science/LSAR/GOFF/grids/frequencyA/pixelOffsets/VV/layer2/alongTrackOffset  V4281399443-ASF
    /science/LSAR/GOFF/grids/frequencyA/pixelOffsets/VV/layer2/alongTrackOffsetVariance  V4281398339-ASF
    /science/LSAR/GOFF/grids/frequencyA/pixelOffsets/VV/layer2/correlationSurfacePeak  V4281397934-ASF
    /science/LSAR/GOFF/grids/frequencyA/pixelOffsets/VV/layer2/crossOffsetVariance  V4281397326-ASF
    /science/LSAR/GOFF/grids/frequencyA/pixelOffsets/VV/layer2/slantRangeOffset  V4281396998-ASF
    /science/LSAR/GOFF/grids/frequencyA/pixelOffsets/VV/layer2/slantRangeOffsetVariance  V4281396602-ASF
    /science/LSAR/GOFF/grids/frequencyA/pixelOffsets/VV/layer2/snr  V4281396440-ASF
    /science/LSAR/GOFF/grids/frequencyA/pixelOffsets/VV/layer3/alongTrackOffset  V4281395892-ASF
    /science/LSAR/GOFF/grids/frequencyA/pixelOffsets/VV/layer3/alongTrackOffsetVariance  V4281395780-ASF
    /science/LSAR/GOFF/grids/frequencyA/pixelOffsets/VV/layer3/correlationSurfacePeak  V4281395429-ASF
    /science/LSAR/GOFF/grids/frequencyA/pixelOffsets/VV/layer3/crossOffsetVariance  V4281395079-ASF
    /science/LSAR/GOFF/grids/frequencyA/pixelOffsets/VV/layer3/slantRangeOffset  V4281394942-ASF
    /science/LSAR/GOFF/grids/frequencyA/pixelOffsets/VV/layer3/slantRangeOffsetVariance  V4281394239-ASF
    /science/LSAR/GOFF/grids/frequencyA/pixelOffsets/VV/layer3/snr  V4281393507-ASF
--- GUNW: collections=['NISAR_L2_GUNW_BETA_V1', 'NISAR_L2_GUNW_PROVISIONAL_V1', 'NISAR_L2_GUNW_V1']
    variable list (names + UMM-Var concept ids) identical across these collections: True; count=23
    /science/LSAR/GUNW/grids/frequencyA/pixelOffsets/HH/alongTrackOffset  V4276623893-ASF
    /science/LSAR/GUNW/grids/frequencyA/pixelOffsets/HH/correlationSurfacePeak  V4276620706-ASF
    /science/LSAR/GUNW/grids/frequencyA/pixelOffsets/HH/slantRangeOffset  V4276623395-ASF
    /science/LSAR/GUNW/grids/frequencyA/pixelOffsets/mask  V4276622107-ASF
    /science/LSAR/GUNW/grids/frequencyA/pixelOffsets/VV/alongTrackOffset  V4276621449-ASF
    /science/LSAR/GUNW/grids/frequencyA/pixelOffsets/VV/correlationSurfacePeak  V4276618769-ASF
    /science/LSAR/GUNW/grids/frequencyA/pixelOffsets/VV/slantRangeOffset  V4276618272-ASF
    /science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/HH/coherenceMagnitude  V4276617706-ASF
    /science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/HH/connectedComponents  V4276616939-ASF
    /science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/HH/ionospherePhaseScreen  V4276616457-ASF
    /science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/HH/ionospherePhaseScreenUncertainty  V4276615639-ASF
    /science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/HH/unwrappedPhase  V4276614052-ASF
    /science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/mask  V4276613262-ASF
    /science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/VV/coherenceMagnitude  V4276612492-ASF
    /science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/VV/connectedComponents  V4276611492-ASF
    /science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/VV/ionospherePhaseScreen  V4276610980-ASF
    /science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/VV/ionospherePhaseScreenUncertainty  V4276610466-ASF
    /science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/VV/unwrappedPhase  V4276609228-ASF
    /science/LSAR/GUNW/grids/frequencyA/wrappedInterferogram/HH/coherenceMagnitude  V4276608050-ASF
    /science/LSAR/GUNW/grids/frequencyA/wrappedInterferogram/HH/wrappedInterferogram  V4276607228-ASF
    /science/LSAR/GUNW/grids/frequencyA/wrappedInterferogram/mask  V4276606384-ASF
    /science/LSAR/GUNW/grids/frequencyA/wrappedInterferogram/VV/coherenceMagnitude  V4276605391-ASF
    /science/LSAR/GUNW/grids/frequencyA/wrappedInterferogram/VV/wrappedInterferogram  V4276603357-ASF
--- SME2: collections=['NISAR_L3_SME2_BETA_V1', 'NISAR_L3_SME2_PROVISIONAL_V1']
    variable list (names + UMM-Var concept ids) identical across these collections: True; count=13
    /science/LSAR/SME2/grids/ancillaryData/localIncidenceAngle  V4279683352-ASF
    /science/LSAR/SME2/grids/radarData/frequencyA/sigma0HH  V4279686481-ASF
    /science/LSAR/SME2/grids/radarData/frequencyA/sigma0HV  V4279686083-ASF
    /science/LSAR/SME2/grids/radarData/frequencyA/sigma0VH  V4279685913-ASF
    /science/LSAR/SME2/grids/radarData/frequencyA/sigma0VV  V4279685826-ASF
    /science/LSAR/SME2/grids/radarData/frequencyB/sigma0HH  V4279685471-ASF
    /science/LSAR/SME2/grids/radarData/frequencyB/sigma0HV  V4279685356-ASF
    /science/LSAR/SME2/grids/radarData/frequencyB/sigma0VH  V4279684990-ASF
    /science/LSAR/SME2/grids/radarData/frequencyB/sigma0VV  V4279684621-ASF
    /science/LSAR/SME2/grids/retrievalQualityFlag  V4279684368-ASF
    /science/LSAR/SME2/grids/soilMoisture  V4279589680-ASF
    /science/LSAR/SME2/grids/soilMoistureUncertainty  V4279684340-ASF
    /science/LSAR/SME2/grids/surfaceQualityFlag  V4279683997-ASF
````


### out/run_service_recipes.txt

**File:** `<scratch>/verify/harmony/out/run_service_recipes.txt`

````
harmony_gdal_adapter 0.0.3 | GDAL 3.13.3
OK   extract         GdalTranslateRecipe    1.0s    46.11 MB  NISAR_L2_PR_GCOV_MOCK_106_A_019_4005_DHDH_A_20260913T130003_20260913T130038_P05023_N_F_J_001_science_LSAR_GCOV_grids_frequencyA_HHHH.tif
OK   bbox            GdalWarpRecipe         0.2s     9.13 MB  NISAR_L2_PR_GCOV_MOCK_106_A_019_4005_DHDH_A_20260913T130003_20260913T130038_P05023_N_F_J_001_science_LSAR_GCOV_grids_frequencyA_HHHH_subsetted.tif
     recipe as built by KCL:
     Recipe(inner=GdalWarpRecipe(warp_options=GdalWarpOptions(spatial_subset=GdalWarpCutlineSpatialSubset(cutline_wkt='POLYGON '
                                                                                                                      '((-118.4 '
                                                                                                                      '34.05,-118.4 '
                                                                                                                      '34.15,-118.25 '
                                                                                                                      '34.15,-118.25 '
                                                                                                                      '34.05,-118.4 '
                                                                                                                      '34.05))',
                                                                                                          cutline_srs='EPSG:4326',
                                                                                                          cutline_where=None,
                                                                                                          cutline_sql=None,
                                                                                                          cutline_blend=None,
                                                                                                          crop_to_cutline=True),
                                                              target_srs=None,
                                                              source_srs=None,
                                                              src_alpha=None,
                                                              dst_alpha=None,
                                                              multithreaded=True,
                                                              copy_metadata=True),
                                 gdal_options=GdalOptions(input_options=GdalInputOptions(driver='HDF5',
                                                                                         dataset_path='//science/LSAR/GCOV/grids/frequencyA/HHHH',
                                                                                         input_file_path='mock/h5/NISAR_L2_PR_GCOV_MOCK_106_A_019_4005_DHDH_A_20260913T130003_20260913T130038_P05023_N_F_J_001.h5',
                                                                                         virtual_filesystem=None),
                                                          output_options=GdalOutputOptions(output_type='COG',
                                                                                           output_file_path='mock/out/bbox/NISAR_L2_PR_GCOV_MOCK_106_A_019_4005_DHDH_A_20260913T130003_20260913T130038_P05023_N_F_J_001_science_LSAR_GCOV_grids_frequencyA_HHHH_subsetted.tif',
                                                                                           creation_options={'BIGTIFF': 'IF_SAFER',
                                                                                                             'NUM_THREADS': 'ALL_CPUS'}),
                                                          config_options=None)))
OK   bbox            GdalWarpRecipe         0.2s     9.13 MB  NISAR_L2_PR_GCOV_MOCK_106_A_019_4005_DHDH_A_20260913T130003_20260913T130038_P05023_N_F_J_001_science_LSAR_GCOV_grids_frequencyA_HVHV_subsetted.tif
OK   bbox            GdalWarpRecipe         0.1s     0.03 MB  NISAR_L2_PR_GCOV_MOCK_106_A_019_4005_DHDH_A_20260913T130003_20260913T130038_P05023_N_F_J_001_science_LSAR_GCOV_grids_frequencyA_mask_subsetted.tif
OK   bbox            GdalWarpRecipe         0.0s     0.12 MB  NISAR_L2_PR_GCOV_MOCK_106_A_019_4005_DHDH_A_20260913T130003_20260913T130038_P05023_N_F_J_001_science_LSAR_GCOV_grids_frequencyB_HHHH_subsetted.tif
FAIL bbox            harmony_gdal_adapter.exceptions.MissingVariableError: Missing variable in input file: //science/LSAR/GCOV/grids/frequencyA/VVVV.   [NISAR_L2_PR_GCOV_MOCK_106_A_019_4005_DHDH_A_20260913T130003_20260913T130038_P05023_N_F_J_001_science_LSAR_GCOV_grids_frequencyA_VVVV_subsetted.tif]
OK   bbox_edge       GdalWarpRecipe         0.1s     3.73 MB  NISAR_L2_PR_GCOV_MOCK_106_A_019_4005_DHDH_A_20260913T130003_20260913T130038_P05023_N_F_J_001_science_LSAR_GCOV_grids_frequencyA_HHHH_subsetted.tif
OK   bbox_4326       GdalWarpRecipe         0.2s     8.81 MB  NISAR_L2_PR_GCOV_MOCK_106_A_019_4005_DHDH_A_20260913T130003_20260913T130038_P05023_N_F_J_001_science_LSAR_GCOV_grids_frequencyA_HHHH_subsetted.tif
OK   reproject_4326  GdalWarpRecipe         0.9s    43.34 MB  NISAR_L2_PR_GCOV_MOCK_106_A_019_4005_DHDH_A_20260913T130003_20260913T130038_P05023_N_F_J_001_science_LSAR_GCOV_grids_frequencyA_HHHH.tif
FAIL bbox_outside    builtins.AssertionError: Subset polygon and source polygon do not overlap  [NISAR_L2_PR_GCOV_MOCK_106_A_019_4005_DHDH_A_20260913T130003_20260913T130038_P05023_N_F_J_001_science_LSAR_GCOV_grids_frequencyA_HHHH_subsetted.tif]
FAIL bbox_3857       harmony_gdal_adapter.exceptions.UnsupportedProjectionError: Requested projection is unsupported: EPSG:3857.  [NISAR_L2_PR_GCOV_MOCK_106_A_019_4005_DHDH_A_20260913T130003_20260913T130038_P05023_N_F_J_001_science_LSAR_GCOV_grids_frequencyA_HHHH_subsetted.tif]
OK   extract         GdalTranslateRecipe    0.8s    45.70 MB  NISAR_L2_PR_GCOV_MOCK_106_A_019_4005_DHDH_A_20261007T130003_20261007T130038_P05023_N_F_J_001_science_LSAR_GCOV_grids_frequencyA_HHHH.tif
OK   bbox            GdalWarpRecipe         0.2s     9.12 MB  NISAR_L2_PR_GCOV_MOCK_106_A_019_4005_DHDH_A_20261007T130003_20261007T130038_P05023_N_F_J_001_science_LSAR_GCOV_grids_frequencyA_HHHH_subsetted.tif
OK   bbox            GdalWarpRecipe         0.2s     9.12 MB  NISAR_L2_PR_GCOV_MOCK_106_A_019_4005_DHDH_A_20261007T130003_20261007T130038_P05023_N_F_J_001_science_LSAR_GCOV_grids_frequencyA_HVHV_subsetted.tif
OK   bbox            GdalWarpRecipe         0.1s     0.03 MB  NISAR_L2_PR_GCOV_MOCK_106_A_019_4005_DHDH_A_20261007T130003_20261007T130038_P05023_N_F_J_001_science_LSAR_GCOV_grids_frequencyA_mask_subsetted.tif
OK   bbox            GdalWarpRecipe         0.0s     0.12 MB  NISAR_L2_PR_GCOV_MOCK_106_A_019_4005_DHDH_A_20261007T130003_20261007T130038_P05023_N_F_J_001_science_LSAR_GCOV_grids_frequencyB_HHHH_subsetted.tif
FAIL bbox            harmony_gdal_adapter.exceptions.MissingVariableError: Missing variable in input file: //science/LSAR/GCOV/grids/frequencyA/VVVV.   [NISAR_L2_PR_GCOV_MOCK_106_A_019_4005_DHDH_A_20261007T130003_20261007T130038_P05023_N_F_J_001_science_LSAR_GCOV_grids_frequencyA_VVVV_subsetted.tif]
OK   bbox_edge       GdalWarpRecipe         0.1s     3.67 MB  NISAR_L2_PR_GCOV_MOCK_106_A_019_4005_DHDH_A_20261007T130003_20261007T130038_P05023_N_F_J_001_science_LSAR_GCOV_grids_frequencyA_HHHH_subsetted.tif
OK   bbox_4326       GdalWarpRecipe         0.2s     8.79 MB  NISAR_L2_PR_GCOV_MOCK_106_A_019_4005_DHDH_A_20261007T130003_20261007T130038_P05023_N_F_J_001_science_LSAR_GCOV_grids_frequencyA_HHHH_subsetted.tif
OK   reproject_4326  GdalWarpRecipe         0.9s    42.95 MB  NISAR_L2_PR_GCOV_MOCK_106_A_019_4005_DHDH_A_20261007T130003_20261007T130038_P05023_N_F_J_001_science_LSAR_GCOV_grids_frequencyA_HHHH.tif
FAIL bbox_outside    builtins.AssertionError: Subset polygon and source polygon do not overlap  [NISAR_L2_PR_GCOV_MOCK_106_A_019_4005_DHDH_A_20261007T130003_20261007T130038_P05023_N_F_J_001_science_LSAR_GCOV_grids_frequencyA_HHHH_subsetted.tif]
FAIL bbox_3857       harmony_gdal_adapter.exceptions.UnsupportedProjectionError: Requested projection is unsupported: EPSG:3857.  [NISAR_L2_PR_GCOV_MOCK_106_A_019_4005_DHDH_A_20261007T130003_20261007T130038_P05023_N_F_J_001_science_LSAR_GCOV_grids_frequencyA_HHHH_subsetted.tif]
````


### out/check_service_outputs.txt

**File:** `<scratch>/verify/harmony/out/check_service_outputs.txt`

````
GDAL 3.13.3

--- SOURCE grids as GDAL's HDF5 driver reads them
  20260913: {'size': (3000, 2600), 'bands': 1, 'dtype': 'Float32', 'nodata': nan, 'epsg': '32611', 'origin': (365000.0, 3786000.0), 'pixel': (10.0, -10.0), 'block': [512, 512], 'overviews': [], 'layout': None, 'compression': 'DEFLATE', 'predictor': None, 'colorinterp': 'Undefined', 'mask_flags': 8}
  20261007: {'size': (2990, 2590), 'bands': 1, 'dtype': 'Float32', 'nodata': nan, 'epsg': '32611', 'origin': (365070.0, 3785970.0), 'pixel': (10.0, -10.0), 'block': [512, 512], 'overviews': [], 'layout': None, 'compression': 'DEFLATE', 'predictor': None, 'colorinterp': 'Undefined', 'mask_flags': 8}

--- 1. Plain extraction (gdal.Translate)
  20260913: {'size': (3000, 2600), 'bands': 1, 'dtype': 'Float32', 'nodata': nan, 'epsg': '32611', 'origin': (365000.0, 3786000.0), 'pixel': (10.0, -10.0), 'block': [512, 512], 'overviews': [(1500, 1300), (750, 650), (375, 325)], 'layout': 'COG', 'compression': 'LZW', 'predictor': None, 'colorinterp': 'Gray', 'mask_flags': 8}
      geotransform identical to source: True; pixel values identical to source: True; NaN pixels: 89750
      band metadata: {'grid_mapping': 'projection', 'long_name': 'Geocoded polarimetric covariance term HHHH', 'units': '1', '_FillValue': 'nan', '_Netcdf4Coordinates': '0 1', '_Netcdf4Dimid': '0'}  unit=''
  20261007: {'size': (2990, 2590), 'bands': 1, 'dtype': 'Float32', 'nodata': nan, 'epsg': '32611', 'origin': (365070.0, 3785970.0), 'pixel': (10.0, -10.0), 'block': [512, 512], 'overviews': [(1495, 1295), (747, 647), (373, 323)], 'layout': 'COG', 'compression': 'LZW', 'predictor': None, 'colorinterp': 'Gray', 'mask_flags': 8}
      geotransform identical to source: True; pixel values identical to source: True; NaN pixels: 89750
      band metadata: {'grid_mapping': 'projection', 'long_name': 'Geocoded polarimetric covariance term HHHH', 'units': '1', '_FillValue': 'nan', '_Netcdf4Coordinates': '0 1', '_Netcdf4Dimid': '0'}  unit=''

--- 2. Bounding-box subset, no reprojection (gdal.Warp cutline + crop_to_cutline)
      [frequencyA_HHHH] pixels kept=1534669 set to nodata by cutline=38353 kept values bit-identical to source=True
  20260913 frequencyA_HHHH: size=(1397, 1126) origin=(370790.0, 3779670.0) pixel=(10.0, -10.0) dtype=Float32 nodata=nan epsg=32611
      offset from source origin (px)=(579.000000,633.000000) on source lattice=True values identical to the same source window=True layout=COG compression=LZW predictor=None block=[512, 512] overviews=[(698, 563), (349, 281)] bands=1
      [frequencyA_HVHV] pixels kept=1534669 set to nodata by cutline=38353 kept values bit-identical to source=True
  20260913 frequencyA_HVHV: size=(1397, 1126) origin=(370790.0, 3779670.0) pixel=(10.0, -10.0) dtype=Float32 nodata=nan epsg=32611
      offset from source origin (px)=(579.000000,633.000000) on source lattice=True values identical to the same source window=True layout=COG compression=LZW predictor=None block=[512, 512] overviews=[(698, 563), (349, 281)] bands=1
      [frequencyA_mask] pixels kept=1534669 set to nodata by cutline=38353 kept values bit-identical to source=True
  20260913 frequencyA_mask: size=(1397, 1126) origin=(370790.0, 3779670.0) pixel=(10.0, -10.0) dtype=Byte nodata=255.0 epsg=32611
      offset from source origin (px)=(579.000000,633.000000) on source lattice=True values identical to the same source window=True layout=COG compression=LZW predictor=None block=[512, 512] overviews=[(698, 563), (349, 281)] bands=1
      [frequencyB_HHHH] pixels kept=23909 set to nodata by cutline=277 kept values bit-identical to source=True
  20260913 frequencyB_HHHH: size=(174, 139) origin=(370840.0, 3779600.0) pixel=(80.0, -80.0) dtype=Float32 nodata=nan epsg=32611
      offset from source origin (px)=(73.000000,80.000000) on source lattice=True values identical to the same source window=True layout=COG compression=LZW predictor=None block=[512, 512] overviews=[] bands=1
      [frequencyA_HHHH] pixels kept=1534669 set to nodata by cutline=38353 kept values bit-identical to source=True
  20261007 frequencyA_HHHH: size=(1397, 1126) origin=(370790.0, 3779670.0) pixel=(10.0, -10.0) dtype=Float32 nodata=nan epsg=32611
      offset from source origin (px)=(572.000000,630.000000) on source lattice=True values identical to the same source window=True layout=COG compression=LZW predictor=None block=[512, 512] overviews=[(698, 563), (349, 281)] bands=1
      [frequencyA_HVHV] pixels kept=1534669 set to nodata by cutline=38353 kept values bit-identical to source=True
  20261007 frequencyA_HVHV: size=(1397, 1126) origin=(370790.0, 3779670.0) pixel=(10.0, -10.0) dtype=Float32 nodata=nan epsg=32611
      offset from source origin (px)=(572.000000,630.000000) on source lattice=True values identical to the same source window=True layout=COG compression=LZW predictor=None block=[512, 512] overviews=[(698, 563), (349, 281)] bands=1
      [frequencyA_mask] pixels kept=1534669 set to nodata by cutline=38353 kept values bit-identical to source=True
  20261007 frequencyA_mask: size=(1397, 1126) origin=(370790.0, 3779670.0) pixel=(10.0, -10.0) dtype=Byte nodata=255.0 epsg=32611
      offset from source origin (px)=(572.000000,630.000000) on source lattice=True values identical to the same source window=True layout=COG compression=LZW predictor=None block=[512, 512] overviews=[(698, 563), (349, 281)] bands=1
      [frequencyB_HHHH] pixels kept=23909 set to nodata by cutline=277 kept values bit-identical to source=True
  20261007 frequencyB_HHHH: size=(174, 139) origin=(370840.0, 3779600.0) pixel=(80.0, -80.0) dtype=Float32 nodata=nan epsg=32611
      offset from source origin (px)=(73.000000,80.000000) on source lattice=True values identical to the same source window=True layout=COG compression=LZW predictor=None block=[512, 512] overviews=[] bands=1
  TWO DATES, same bbox: geotransform identical=True size identical=True
  frequencyA vs frequencyB, same bbox: A origin=(370790.0, 3779670.0) size=(1397, 1126); B origin=(370840.0, 3779600.0) size=(174, 139)
  requested bbox in UTM 11N: x 370784.00..384765.10, y 3768404.62..3779673.15
  delivered extent (date 1): x 370790.00..384760.00, y 3768410.00..3779670.00
  NaN pixels inside delivered rectangle (date 1): 38353 of 1573022 (corners outside the lat/lon box are cut to nodata by the cutline)

--- 3. Bounding box overlapping the granule edge / swath gap
  20260913: size=(618, 1225) origin=(364840.0, 3786380.0) pixel=(10.0, -10.0) nodata=nan offset_px=(-16.000000,-38.000000) NaN=143868/757050 zeros=0 min=-0.01000 max=0.10963
  20261007: size=(611, 1222) origin=(364910.0, 3786350.0) pixel=(10.0, -10.0) nodata=nan offset_px=(-16.000000,-38.000000) NaN=143498/746642 zeros=0 min=-0.01300 max=0.14252
  TWO DATES, same bbox at the edge: geotransform identical=False sizes=(618, 1225) vs (611, 1222)
  origin difference in pixels: dx=7.000000 dy=3.000000 (integer => still the same lattice)

--- 4. Reprojection to EPSG:4326 (with and without bbox)
  bbox_4326 20260913: size=(1511, 1008) origin=(-118.40000000000002, 34.15002291812168) pixel=(9.927231835095933e-05, -9.922908543818965e-05) epsg=4326 nodata=nan NaN=461/1523088 overviews=[(755, 504), (377, 252)]
  bbox_4326 20261007: size=(1511, 1008) origin=(-118.40000000000002, 34.15002291812168) pixel=(9.927231835095933e-05, -9.922908543818965e-05) epsg=4326 nodata=nan NaN=461/1523088 overviews=[(755, 504), (377, 252)]
  bbox_4326: two dates geotransform identical=True; pixel size identical=True; origin offset in output pixels dx=0.0000 dy=-0.0000
  reproject_4326 20260913: size=(3248, 2351) origin=(-118.4653569387347, 34.20974762382088) pixel=(0.00010119932015705675, -0.00010119932015705675) epsg=4326 nodata=nan NaN=278271/7636048 overviews=[(1624, 1175), (812, 587), (406, 293)]
  reproject_4326 20261007: size=(3237, 2341) origin=(-118.46459266326607, 34.209474092940496) pixel=(0.00010120392073019788, -0.00010120392073019788) epsg=4326 nodata=nan NaN=274028/7577817 overviews=[(1618, 1170), (809, 585), (404, 292)]
  reproject_4326: two dates geotransform identical=False; pixel size identical=False; origin offset in output pixels dx=7.5522 dy=2.7029
````


### out/cog_validate.txt

**File:** `<scratch>/verify/harmony/out/cog_validate.txt`

````
rio-cogeo 7.0.4
bbox            ...cience_LSAR_GCOV_grids_frequencyA_HHHH_subsetted.tif valid_cog=True errors=[] warnings=[] size_MB=9.13
      profile={'Bands': 1, 'Width': 1397, 'Height': 1126, 'Tiled': True, 'Dtype': 'float32', 'Interleave': 'BAND', 'AlphaBand': False, 'InternalMask': False, 'Nodata': nan, 'ColorInterp': ('gray',), 'ColorMap': False, 'Scales': (1.0,), 'Offsets': (0.0,)} n_ifd=3 compression=LZW
bbox            ...cience_LSAR_GCOV_grids_frequencyA_HVHV_subsetted.tif valid_cog=True errors=[] warnings=[] size_MB=9.13
      profile={'Bands': 1, 'Width': 1397, 'Height': 1126, 'Tiled': True, 'Dtype': 'float32', 'Interleave': 'BAND', 'AlphaBand': False, 'InternalMask': False, 'Nodata': nan, 'ColorInterp': ('gray',), 'ColorMap': False, 'Scales': (1.0,), 'Offsets': (0.0,)} n_ifd=3 compression=LZW
bbox            ...cience_LSAR_GCOV_grids_frequencyA_mask_subsetted.tif valid_cog=True errors=[] warnings=[] size_MB=0.03
      profile={'Bands': 1, 'Width': 1397, 'Height': 1126, 'Tiled': True, 'Dtype': 'uint8', 'Interleave': 'BAND', 'AlphaBand': False, 'InternalMask': False, 'Nodata': 255.0, 'ColorInterp': ('gray',), 'ColorMap': False, 'Scales': (1.0,), 'Offsets': (0.0,)} n_ifd=3 compression=LZW
bbox            ...cience_LSAR_GCOV_grids_frequencyB_HHHH_subsetted.tif valid_cog=True errors=[] warnings=[] size_MB=0.12
      profile={'Bands': 1, 'Width': 174, 'Height': 139, 'Tiled': True, 'Dtype': 'float32', 'Interleave': 'BAND', 'AlphaBand': False, 'InternalMask': False, 'Nodata': nan, 'ColorInterp': ('gray',), 'ColorMap': False, 'Scales': (1.0,), 'Offsets': (0.0,)} n_ifd=1 compression=LZW
bbox_4326       ...cience_LSAR_GCOV_grids_frequencyA_HHHH_subsetted.tif valid_cog=True errors=[] warnings=[] size_MB=8.81
      profile={'Bands': 1, 'Width': 1511, 'Height': 1008, 'Tiled': True, 'Dtype': 'float32', 'Interleave': 'BAND', 'AlphaBand': False, 'InternalMask': False, 'Nodata': nan, 'ColorInterp': ('gray',), 'ColorMap': False, 'Scales': (1.0,), 'Offsets': (0.0,)} n_ifd=3 compression=LZW
bbox_edge       ...cience_LSAR_GCOV_grids_frequencyA_HHHH_subsetted.tif valid_cog=True errors=[] warnings=[] size_MB=3.73
      profile={'Bands': 1, 'Width': 618, 'Height': 1225, 'Tiled': True, 'Dtype': 'float32', 'Interleave': 'BAND', 'AlphaBand': False, 'InternalMask': False, 'Nodata': nan, 'ColorInterp': ('gray',), 'ColorMap': False, 'Scales': (1.0,), 'Offsets': (0.0,)} n_ifd=3 compression=LZW
extract         ..._F_J_001_science_LSAR_GCOV_grids_frequencyA_HHHH.tif valid_cog=True errors=[] warnings=[] size_MB=46.11
      profile={'Bands': 1, 'Width': 3000, 'Height': 2600, 'Tiled': True, 'Dtype': 'float32', 'Interleave': 'BAND', 'AlphaBand': False, 'InternalMask': False, 'Nodata': nan, 'ColorInterp': ('gray',), 'ColorMap': False, 'Scales': (1.0,), 'Offsets': (0.0,)} n_ifd=4 compression=LZW
reproject_4326  ..._F_J_001_science_LSAR_GCOV_grids_frequencyA_HHHH.tif valid_cog=True errors=[] warnings=[] size_MB=43.34
      profile={'Bands': 1, 'Width': 3248, 'Height': 2351, 'Tiled': True, 'Dtype': 'float32', 'Interleave': 'BAND', 'AlphaBand': False, 'InternalMask': False, 'Nodata': nan, 'ColorInterp': ('gray',), 'ColorMap': False, 'Scales': (1.0,), 'Offsets': (0.0,)} n_ifd=4 compression=LZW
````


### out/inspect_tif_mock.txt

**File:** `<scratch>/verify/harmony/out/inspect_tif_mock.txt`

````
==========================================================================================
NISAR_L2_PR_GCOV_MOCK_106_A_019_4005_DHDH_A_20260913T130003_20260913T130038_P05023_N_F_J_001_science_LSAR_GCOV_grids_frequencyA_HHHH_subsetted.tif
  driver=GTiff size=1397x1126 bands=1 dtypes=('float32',) nodata=(nan,)
  crs=EPSG:32611
  origin=(370790.0, 3779670.0) pixel=(10.0, -10.0) rot=(0.0, 0.0)
  bounds=(370790.0, 3768410.0, 384760.0, 3779670.0)
  block_shapes=[(512, 512)] is_tiled=True compress=lzw interleave=band predictor=None
  overviews(band1)=[2, 4] colorinterp=['gray'] mask_flags=([<MaskFlags.nodata: 8>],)
  IMAGE_STRUCTURE={'LAYOUT': 'COG', 'COMPRESSION': 'LZW', 'INTERLEAVE': 'BAND', 'OVERVIEW_RESAMPLING': 'CUBIC'}
  dataset tags={'mission_name': 'NISAR', 'note': 'SYNTHETIC test file, not a NISAR product', '_NCProperties': 'version=2,h5netcdf=1.8.3,hdf5=2.2.0,h5py=3.16.0', 'AREA_OR_POINT': 'Area'}
  band1 tags={'grid_mapping': 'projection', 'long_name': 'Geocoded polarimetric covariance term HHHH', 'units': '1', '_FillValue': 'nan', '_Netcdf4Coordinates': '0 1', '_Netcdf4Dimid': '0'} descriptions=(None,) units=(None,) scales=(1.0,) offsets=(0.0,)
  band1: min=-0.009998336434364319 max=0.10963355749845505 n_nan=38353 n_zero=0 first_row[:6]=[nan, nan, nan, nan, nan, nan] first_col[:4]=[nan, nan, nan, nan]
==========================================================================================
NISAR_L2_PR_GCOV_MOCK_106_A_019_4005_DHDH_A_20260913T130003_20260913T130038_P05023_N_F_J_001_science_LSAR_GCOV_grids_frequencyA_mask_subsetted.tif
  driver=GTiff size=1397x1126 bands=1 dtypes=('uint8',) nodata=(255.0,)
  crs=EPSG:32611
  origin=(370790.0, 3779670.0) pixel=(10.0, -10.0) rot=(0.0, 0.0)
  bounds=(370790.0, 3768410.0, 384760.0, 3779670.0)
  block_shapes=[(512, 512)] is_tiled=True compress=lzw interleave=band predictor=None
  overviews(band1)=[2, 4] colorinterp=['gray'] mask_flags=([<MaskFlags.nodata: 8>],)
  IMAGE_STRUCTURE={'LAYOUT': 'COG', 'COMPRESSION': 'LZW', 'INTERLEAVE': 'BAND', 'OVERVIEW_RESAMPLING': 'CUBIC'}
  dataset tags={'mission_name': 'NISAR', 'note': 'SYNTHETIC test file, not a NISAR product', '_NCProperties': 'version=2,h5netcdf=1.8.3,hdf5=2.2.0,h5py=3.16.0', 'AREA_OR_POINT': 'Area'}
  band1 tags={'grid_mapping': 'projection', 'long_name': 'Valid samples subswath mask', '_FillValue': '255', '_Netcdf4Coordinates': '0 1', '_Netcdf4Dimid': '0'} descriptions=(None,) units=(None,) scales=(1.0,) offsets=(0.0,)
  band1: min=1 max=255 n_nan=0 n_zero=0 first_row[:6]=[255, 255, 255, 255, 255, 255] first_col[:4]=[255, 255, 255, 255]
````


### out/make_mock_gcov.txt

**File:** `<scratch>/verify/harmony/out/make_mock_gcov.txt`

````
wrote mock/h5/NISAR_L2_PR_GCOV_MOCK_106_A_019_4005_DHDH_A_20260913T130003_20260913T130038_P05023_N_F_J_001.h5 55.4 MB
wrote mock/h5/NISAR_L2_PR_GCOV_MOCK_106_A_019_4005_DHDH_A_20261007T130003_20261007T130038_P05023_N_F_J_001.h5 54.9 MB
````


### out/check_opendap_and_tools.txt

**File:** `<scratch>/verify/harmony/out/check_opendap_and_tools.txt`

````
=== 1. collection-level RelatedUrls and associations
NISAR_L2_GCOV_BETA_V1 C3622214170-ASF revision-date=2026-10-08T20:08:11.246Z
   associations: {'services': ['S4166720787-ASF', 'S4389714698-ASF'], 'citations': ['CIT4321028774-ESDIS']} | n_variables: 20
   DistributionURL / GET DATA / VERTEX: https://search.asf.alaska.edu/
   DistributionURL / GET DATA / Earthdata Search: https://search.earthdata.nasa.gov/search/granules?p=C3622214170-ASF
   CollectionURL / PROJECT HOME PAGE / None: https://nisar.jpl.nasa.gov/
   PublicationURL / VIEW RELATED INFORMATION / USER'S GUIDE: https://nisar-docs.asf.alaska.edu/gcov/
   PublicationURL / VIEW RELATED INFORMATION / DATA PRODUCT SPECIFICATION: https://cumulus.asf.earthdatacloud.nasa.gov/PUBLIC/DATA/NISAR/NISAR_D-102274_RevF_NASA_SDS_Product_Specification_L2_GCOV_w-esigs.pdf
   DirectDistributionInformation: {"S3BucketAndObjectPrefixNames": ["sds-n-cumulus-prod-nisar-products/NISAR_L2_GCOV_BETA_V1/"], "S3CredentialsAPIEndpoint": "https://nisar.asf.earthdatacloud.nasa.gov/s3credentials", "S3CredentialsAPIDocumentationURL": "https://nisar.asf.earthdatacloud.nasa.gov/s3credentialsREADME", "Region": "us-west-2"}
   CollectionProgress: ACTIVE | ProcessingLevel: 2 | UseConstraints: null | AccessConstraints: null
NISAR_L2_GCOV_PROVISIONAL_V1 C2854338529-ASF revision-date=2026-10-08T20:11:31.768Z
   associations: {'services': ['S4389714698-ASF', 'S4166720787-ASF'], 'visualizations': ['VIS4295253210-ESDIS']} | n_variables: 20
   DistributionURL / GET DATA / VERTEX: https://search.asf.alaska.edu/
   DistributionURL / GET DATA / Earthdata Search: https://search.earthdata.nasa.gov/search/granules?p=C2854338529-ASF
   CollectionURL / PROJECT HOME PAGE / None: https://nisar.jpl.nasa.gov/
   PublicationURL / VIEW RELATED INFORMATION / USER'S GUIDE: https://nisar-docs.asf.alaska.edu/gcov/
   PublicationURL / VIEW RELATED INFORMATION / DATA PRODUCT SPECIFICATION: https://cumulus.asf.earthdatacloud.nasa.gov/PUBLIC/DATA/NISAR/NISAR_D-102274_RevF_NASA_SDS_Product_Specification_L2_GCOV_w-esigs.pdf
   DirectDistributionInformation: {"S3BucketAndObjectPrefixNames": ["sds-n-cumulus-prod-nisar-products/NISAR_L2_GCOV_PROVSIONAL_V1/"], "S3CredentialsAPIEndpoint": "https://nisar.asf.earthdatacloud.nasa.gov/s3credentials", "S3CredentialsAPIDocumentationURL": "https://nisar.asf.earthdatacloud.nasa.gov/s3credentialsREADME", "Region": "us-west-2"}
   CollectionProgress: ACTIVE | ProcessingLevel: 2 | UseConstraints: null | AccessConstraints: null
NISAR_L2_GCOV_V1 C3622241360-ASF revision-date=2026-11-04T20:18:32.905Z
   associations: {'services': ['S4389714698-ASF', 'S4166720787-ASF']} | n_variables: 20
   DistributionURL / GET DATA / VERTEX: https://search.asf.alaska.edu/
   DistributionURL / GET DATA / Earthdata Search: https://search.earthdata.nasa.gov/search/granules?p=C3622241360-ASF
   CollectionURL / PROJECT HOME PAGE / None: https://nisar.jpl.nasa.gov/
   PublicationURL / VIEW RELATED INFORMATION / USER'S GUIDE: https://nisar-docs.asf.alaska.edu/gcov/
   PublicationURL / VIEW RELATED INFORMATION / DATA PRODUCT SPECIFICATION: https://cumulus.asf.earthdatacloud.nasa.gov/PUBLIC/DATA/NISAR/NISAR_D-102274_RevF_NASA_SDS_Product_Specification_L2_GCOV_w-esigs.pdf
   DirectDistributionInformation: {"S3BucketAndObjectPrefixNames": ["sds-n-cumulus-prod-nisar-products/NISAR_L2_GCOV_V1/"], "S3CredentialsAPIEndpoint": "https://nisar.asf.earthdatacloud.nasa.gov/s3credentials", "S3CredentialsAPIDocumentationURL": "https://nisar.asf.earthdatacloud.nasa.gov/s3credentialsREADME", "Region": "us-west-2"}
   CollectionProgress: ACTIVE | ProcessingLevel: 2 | UseConstraints: {"LicenseURL": {"Name": "NASA ESDIS Data Use and Citation Guidance", "Linkage": "https://www.earthdata.nasa.gov/engage/open-data-services-software-policies/data-use-guidance"}, "FreeAndOpenData": true} | AccessConstraints: null

=== 2. RelatedUrl types across saved granule search results
cmr_granules_C2854338529-ASF_-118.5_33.9_-118.1_34.2.json granules: 104
    1244  Type='EXTENDED METADATA' Subtype=None scheme=https
    1244  Type='EXTENDED METADATA' Subtype=None scheme=s3
     724  Type='GET RELATED VISUALIZATION' Subtype=None scheme=https
     724  Type='GET RELATED VISUALIZATION' Subtype=None scheme=s3
     312  Type='VIEW RELATED INFORMATION' Subtype='PRODUCT QUALITY ASSESSMENT' scheme=https
     312  Type='VIEW RELATED INFORMATION' Subtype='PRODUCT QUALITY ASSESSMENT' scheme=s3
     104  Type='GET DATA' Subtype=None scheme=https
     104  Type='GET DATA VIA DIRECT ACCESS' Subtype=None scheme=s3
     104  Type='VIEW RELATED INFORMATION' Subtype=None scheme=https
   URLs mentioning opendap/dmrpp: 0

=== 3. newest granules of each GCOV collection: any OPeNDAP link?
NISAR_L2_GCOV_BETA_V1: hits=23527 newest_start=2026-01-20T15:59:30.000000Z opendap_links_in_5_newest=0
NISAR_L2_GCOV_PROVISIONAL_V1: hits=163672 newest_start=2026-10-21T20:37:40.000000Z opendap_links_in_5_newest=0
NISAR_L2_GCOV_V1: hits=14719 newest_start=2026-11-11T23:36:27.000000Z opendap_links_in_5_newest=0
````


### out/cmr_granule_stats.txt

**File:** `<scratch>/verify/harmony/out/cmr_granule_stats.txt`

````
NISAR_L2_GCOV_BETA_V1 C3622214170-ASF hits=23527
    first: 2025-10-12T18:25:08.000000Z  NISAR_L2_PR_GCOV_002_109_D_063_4005_DHDH_A_20251012T182508_20251012T182531_X05010_N_P_J_001  G4062016788-ASF
    last: 2026-01-20T15:59:30.000000Z  NISAR_L2_PR_GCOV_010_165_D_100_2005_DHDH_M_20260120T155930_20260120T155950_X05010_N_P_J_001  G4059041445-ASF
NISAR_L2_GCOV_PROVISIONAL_V1 C2854338529-ASF hits=163672
    first: 2025-10-29T11:11:30.000000Z  NISAR_L2_PR_GCOV_004_004_A_018_4005_DHDH_A_20251029T111130_20251029T111153_P05023_N_P_J_001  G4273153436-ASF
    last: 2026-10-21T20:37:40.000000Z  NISAR_L2_PR_GCOV_033_139_D_091_4005_DHDH_A_20261021T203740_20261021T203744_P05023_N_P_J_001  G4385200937-ASF
NISAR_L2_GCOV_V1 C3622241360-ASF hits=14720
    first: 2026-10-21T17:07:21.000000Z  NISAR_L2_PR_GCOV_033_137_D_073_2005_DHDH_A_20261021T170721_20261021T170733_P05036_N_P_J_001  G4403987890-ASF
    last: 2026-11-11T23:36:27.000000Z  NISAR_L2_PR_GCOV_035_098_A_010_2005_DVDV_A_20261111T233627_20261111T233632_P05036_N_P_J_001  G4411427733-ASF
NISAR_L2_GUNW_BETA_V1 C2850261892-ASF hits=10217
    first: 2025-10-17T12:48:36.000000Z  NISAR_L2_PR_GUNW_003_005_A_013_004_4000_SH_20251017T124836_20251017T124857_20251029T124836_20251029T124858_X05010_N_P_J_001  G4058278779-ASF
    last: 2026-01-08T13:03:26.000000Z  NISAR_L2_PR_GUNW_009_163_A_142_010_7700_SH_20260108T130326_20260108T130349_20260120T130327_20260120T130349_X05010_N_P_J_001  G4058720126-ASF
NISAR_L2_GUNW_PROVISIONAL_V1 C2854335566-ASF hits=94150
    first: 2025-10-29T11:11:30.000000Z  NISAR_L2_PR_GUNW_004_004_A_018_006_4000_SH_20251029T111130_20251029T111153_20251122T111119_20251122T111153_P05023_N_P_J_001  G4273994533-ASF
    last: 2026-10-09T20:37:40.000000Z  NISAR_L2_PR_GUNW_032_139_D_091_033_4000_SH_20261009T203740_20261009T203744_20261021T203740_20261021T203744_P05023_N_P_J_001  G4385197481-ASF
NISAR_L2_GUNW_V1 C3622247503-ASF hits=140
    first: 2026-09-27T23:50:27.000000Z  NISAR_L2_PR_GUNW_031_141_D_079_033_2000_SH_20260927T235027_20260927T235044_20261021T235028_20261021T235045_P05036_N_P_J_001  G4409732956-ASF
    last: 2026-10-09T23:53:35.000000Z  NISAR_L2_PR_GUNW_032_141_D_085_033_2000_SH_20261009T235335_20261009T235349_20261021T235335_20261021T235349_P05036_N_P_J_001  G4409727248-ASF
NISAR_L2_GOFF_BETA_V1 C2850263910-ASF hits=3666
    first: 2025-10-17T12:54:33.000000Z  NISAR_L2_PR_GOFF_003_005_A_024_004_4000_SH_20251017T125433_20251017T125508_20251029T125434_20251029T125509_X05009_N_F_J_001  G4058294516-ASF
    last: 2026-01-08T13:03:26.000000Z  NISAR_L2_PR_GOFF_009_163_A_142_010_7700_SH_20260108T130326_20260108T130349_20260120T130327_20260120T130349_X05010_N_P_J_001  G4058736144-ASF
NISAR_L2_GOFF_PROVISIONAL_V1 C2854341702-ASF hits=27717
    first: 2025-10-29T12:18:24.000000Z  NISAR_L2_PR_GOFF_004_004_A_136_006_7700_SH_20251029T121824_20251029T121857_20251122T121825_20251122T121857_P05023_N_P_J_001  G4273939392-ASF
    last: 2026-10-09T18:43:17.000000Z  NISAR_L2_PR_GOFF_032_138_D_066_033_2000_SH_20261009T184317_20261009T184352_20261021T184317_20261021T184352_P05023_N_F_J_001  G4385390315-ASF
NISAR_L2_GOFF_V1 C3622250865-ASF hits=32
    first: 2026-10-09T20:57:10.000000Z  NISAR_L2_PR_GOFF_032_139_D_126_033_4000_SH_20261009T205710_20261009T205743_20261021T205708_20261021T205743_P05036_N_F_J_001  G4409730844-ASF
    last: 2026-10-09T23:36:33.000000Z  NISAR_L2_PR_GOFF_032_141_D_055_033_7700_SH_20261009T233633_20261009T233713_20261021T233633_20261021T233713_P05036_N_P_J_001  G4409730512-ASF
NISAR_L3_SME2_BETA_V1 C2850265000-ASF hits=13881
    first: 2025-10-17T12:48:36.000000Z  NISAR_L3_PR_SME2_003_005_A_013_4005_DHDH_A_20251017T124836_20251017T124857_X05010_N_P_J_001  G4058212074-ASF
    last: 2026-01-20T15:59:30.000000Z  NISAR_L3_PR_SME2_010_165_D_100_2005_DHDH_M_20260120T155930_20260120T155950_X05010_N_P_J_001  G4059050230-ASF
NISAR_L3_SME2_PROVISIONAL_V1 C2854344945-ASF hits=103943
    first: 2025-10-29T11:11:30.000000Z  NISAR_L3_PR_SME2_004_004_A_018_4005_DHDH_A_20251029T111130_20251029T111153_P05023_N_P_J_001  G4276418277-ASF
    last: 2026-10-21T20:37:40.000000Z  NISAR_L3_PR_SME2_033_139_D_091_4005_DHDH_A_20261021T203740_20261021T203744_P05023_N_P_J_001  G4385214205-ASF
````


### out/cmr_nisar_collections_summary.txt

**File:** `<scratch>/verify/harmony/out/cmr_nisar_collections_summary.txt`

````
URL: https://cmr.earthdata.nasa.gov/search/collections.umm_json?provider=ASF&short_name=NISAR%2A&options%5Bshort_name%5D%5Bpattern%5D=true&page_size=200
CMR-Hits: 44 items: 44
NISAR_ANC_AUX                      v1   C3622222871-ASF    services=0 variables=  0 [] rev=2026-02-04 
NISAR_COP                          v1   C2727904608-ASF    services=0 variables=  0 [] rev=2026-07-25 
NISAR_DEM                          v1   C3803703055-ASF    services=0 variables=  0 [] rev=2026-07-28 
NISAR_L0B_CRSD_PROVISIONAL_V1      v1   C2853091612-ASF    services=0 variables=  0 [] rev=2026-09-14 
NISAR_L0B_CRSD_V1                  v1   C3622254588-ASF    services=0 variables=  0 [] rev=2026-11-03 
NISAR_L0B_RRSD_PROVISIONAL_V1      v1   C2853089814-ASF    services=0 variables=  0 [] rev=2026-09-14 
NISAR_L0B_RRSD_V1                  v1   C3622265756-ASF    services=0 variables=  0 [] rev=2026-11-03 
NISAR_L1_RIFG_BETA_V1              v1   C2850234202-ASF    services=0 variables=  0 [] rev=2026-03-09 
NISAR_L1_RIFG_PROVISIONAL_V1       v1   C2853147928-ASF    services=0 variables=  0 [] rev=2026-08-05 
NISAR_L1_RIFG_V1                   v1   C3622229381-ASF    services=0 variables=  0 [] rev=2026-11-03 
NISAR_L1_ROFF_BETA_V1              v1   C2850237619-ASF    services=0 variables=  0 [] rev=2026-03-09 
NISAR_L1_ROFF_PROVISIONAL_V1       v1   C2853156054-ASF    services=0 variables=  0 [] rev=2026-08-05 
NISAR_L1_ROFF_V1                   v1   C3622241997-ASF    services=0 variables=  0 [] rev=2026-11-03 
NISAR_L1_RSLC_BETA_V1              v1   C2850225585-ASF    services=0 variables=  0 [] rev=2026-10-08 
NISAR_L1_RSLC_PROVISIONAL_V1       v1   C2853145197-ASF    services=0 variables=  0 [] rev=2026-10-08 
NISAR_L1_RSLC_V1                   v1   C3622236985-ASF    services=0 variables=  0 [] rev=2026-11-05 
NISAR_L1_RUNW_BETA_V1              v1   C2850235455-ASF    services=0 variables=  0 [] rev=2026-03-09 
NISAR_L1_RUNW_PROVISIONAL_V1       v1   C2853153429-ASF    services=0 variables=  0 [] rev=2026-08-05 
NISAR_L1_RUNW_V1                   v1   C3622237369-ASF    services=0 variables=  0 [] rev=2026-11-04 
NISAR_L2_GCOV_BETA_V1              v1   C3622214170-ASF    services=2 variables= 20 [S4166720787-ASF,S4389714698-ASF] rev=2026-10-08 
NISAR_L2_GCOV_PROVISIONAL_V1       v1   C2854338529-ASF    services=2 variables= 20 [S4389714698-ASF,S4166720787-ASF] rev=2026-10-08 
NISAR_L2_GCOV_V1                   v1   C3622241360-ASF    services=2 variables= 20 [S4389714698-ASF,S4166720787-ASF] rev=2026-11-04 
NISAR_L2_GOFF_BETA_V1              v1   C2850263910-ASF    services=1 variables= 43 [S4389714698-ASF] rev=2026-03-09 
NISAR_L2_GOFF_PROVISIONAL_V1       v1   C2854341702-ASF    services=1 variables= 43 [S4389714698-ASF] rev=2026-08-05 
NISAR_L2_GOFF_V1                   v1   C3622250865-ASF    services=1 variables= 43 [S4389714698-ASF] rev=2026-11-04 
NISAR_L2_GSLC_BETA_V1              v1   C2850259510-ASF    services=0 variables=  0 [] rev=2026-10-08 
NISAR_L2_GSLC_PROVISIONAL_V1       v1   C2854332392-ASF    services=0 variables=  0 [] rev=2026-10-08 
NISAR_L2_GSLC_V1                   v1   C3622244601-ASF    services=0 variables=  0 [] rev=2026-11-04 
NISAR_L2_GUNW_BETA_V1              v1   C2850261892-ASF    services=1 variables= 23 [S4389714698-ASF] rev=2026-01-22 
NISAR_L2_GUNW_PROVISIONAL_V1       v1   C2854335566-ASF    services=1 variables= 23 [S4389714698-ASF] rev=2026-08-05 
NISAR_L2_GUNW_V1                   v1   C3622247503-ASF    services=1 variables= 23 [S4389714698-ASF] rev=2026-11-06 
NISAR_L3_SME2_BETA_V1              v1   C2850265000-ASF    services=1 variables= 13 [S4389714698-ASF] rev=2026-01-23 
NISAR_L3_SME2_PROVISIONAL_V1       v1   C2854344945-ASF    services=1 variables= 13 [S4389714698-ASF] rev=2026-08-06 
NISAR_LRCLK_UTC                    v1   C3632501432-ASF    services=0 variables=  0 [] rev=2026-07-25 
NISAR_OE                           v1   C2727908375-ASF    services=0 variables=  0 [] rev=2026-02-17 
NISAR_OROST                        v1   C2727911748-ASF    services=0 variables=  0 [] rev=2026-07-25 
NISAR_RP                           v1   C2727912431-ASF    services=0 variables=  0 [] rev=2026-07-25 
NISAR_STUF                         v1   C3622233495-ASF    services=0 variables=  0 [] rev=2026-07-25 
NISAR_TEC                          v1   C3622219145-ASF    services=0 variables=  0 [] rev=2026-07-25 
NISAR_UR_L0B_RRSD                  v1   C2887469134-ASF    services=0 variables=  0 [] rev=2026-07-21 
NISAR_UR_L1                        v1   C2887499907-ASF    services=0 variables=  0 [] rev=2026-09-22 
NISAR_UR_L2                        v1   C2887502657-ASF    services=0 variables=  0 [] rev=2026-09-22 
NISAR_VWC                          v1   C4066106685-ASF    services=0 variables=  0 [] rev=2026-06-27 
NISAR_WATERMASK                    v1   C3807638962-ASF    services=0 variables=  0 [] rev=2026-02-23 
````


### out/check_repos.txt

**File:** `<scratch>/verify/harmony/out/check_repos.txt`

````
Sat Nov 14 07:47:57 UTC 2026
ASFHyP3_harmony-gdal             branch=develop  local=9c5e5d88bb39ba43915a040198bd88417838db1c remote=9c5e5d88bb39ba43915a040198bd88417838db1c SAME_AS_UPSTREAM modified_files=0
    last commit: 2026-11-06T15:19:54-08:00 Merge pull request #59 from ASFHyP3/lily/fix-changelog
ASFHyP3_nisar-py                 branch=develop  local=9602459f28c3aa17033f03407a7a8b7c7312e1e9 remote=9602459f28c3aa17033f03407a7a8b7c7312e1e9 SAME_AS_UPSTREAM modified_files=0
    last commit: 2026-06-02T13:29:38-08:00 Merge pull request #31 from ASFHyP3/dependabot/github_actions/github-actions-deps-125b76be62
harmony                          branch=main     local=3b459a8b81c25fe9dad57b68365d575add2dfaee remote=3b459a8b81c25fe9dad57b68365d575add2dfaee SAME_AS_UPSTREAM modified_files=0
    last commit: 2026-11-12T17:31:02-05:00 HARMONY-2510: Fix vulnerabilities in harmonyservices/harmony image (#1008)
nasa_harmony-gdal-adapter        branch=main     local=3e7c5b6d1e409624091f684fe2bfd29c4b1c3f21 remote=3e7c5b6d1e409624091f684fe2bfd29c4b1c3f21 SAME_AS_UPSTREAM modified_files=0
    last commit: 2026-04-24T10:24:20-04:00 [pre-commit.ci] pre-commit autoupdate (#68)
nasa_harmony-py                  branch=main     local=3078eda1cfbfe18f892a857df96ac41a144dfa08 remote=3078eda1cfbfe18f892a857df96ac41a144dfa08 SAME_AS_UPSTREAM modified_files=0
    last commit: 2026-10-05T09:12:33-04:00 HARMONY-2449: Support paging through the job output links and getting output links while a job is still running.
nasa_harmony-regression-tests    branch=main     local=5d4fa1901f6940b03bdf9ca5a25f41abae292929 remote=5d4fa1901f6940b03bdf9ca5a25f41abae292929 SAME_AS_UPSTREAM modified_files=0
    last commit: 2026-11-10T16:50:57-05:00 HARMONY-2508: Fix subset-band-name regression test failure. (#344)

--- ASFHyP3/harmony-gdal tags upstream (the image deployed in Harmony production is asfhyp3/harmony-gdal:0.0.3)
02b7d083f5331e4ac204804114166825058902dc	refs/tags/v0.0.0
e19218c2e655532dd88f9f033e2620b417337e0e	refs/tags/v0.0.0^{}
bd7ca9612e0f4450000970eb4ee01cee7ba18cac	refs/tags/v0.0.1
2a42f4ac81e19d514337d9647390c588b2f897a9	refs/tags/v0.0.1^{}
2e39cb45763e9ea691d1c6de849e1fcd094e9e63	refs/tags/v0.0.2
881105a5a03ea9d7c8c7afd0430c27e1ca948be0	refs/tags/v0.0.2^{}
36235d1c1ca7b14bdab1c220c5c71b6d6c0b7541	refs/tags/v0.0.3
8d24a3d61cffa367ea9ae4f0faa8c14c527e3311	refs/tags/v0.0.3^{}
upstream refs/heads/main: 8d24a3d61cffa367ea9ae4f0faa8c14c527e3311
local tag v0.0.3 commit:  8d24a3d61cffa367ea9ae4f0faa8c14c527e3311
harmony-gdal_v0.0.3 checkout HEAD: 8d24a3d61cffa367ea9ae4f0faa8c14c527e3311 modified_files=0

--- nasa/harmony-py tags upstream (last 4)
399c752a9aa4d14213508cc6f547daea943a9419	refs/tags/v1.6.0
cf576dc699b1b46cdff0df3152c49a666868dec4	refs/tags/v1.7.0
3078eda1cfbfe18f892a857df96ac41a144dfa08	refs/tags/v1.8.0
e9ccd992a34fdb4e065267baee5d061181b22bb6	refs/tags/v1756beta
--- ASFHyP3/nisar-py tags upstream (last 2)
a3af88bf0ea956d69601b7f16308e0ea5eb9da49	refs/tags/v0.4.0
5a991053d683e77cb2c4a6c74cbf63ce077f7b72	refs/tags/v0.4.0^{}
````


### out/harmony_capabilities_summary.txt (supported collections in full; unsupported ones reduced to one line each)

**File:** `<scratch>/verify/harmony/out/harmony_capabilities_summary.txt`

````
NISAR_ANC_AUX C3622222871-ASF http=200   -> subsetting all False, n_variables=0 n_services=0
NISAR_COP C2727904608-ASF http=200   -> subsetting all False, n_variables=0 n_services=0
NISAR_DEM C3803703055-ASF http=200   -> subsetting all False, n_variables=0 n_services=0
NISAR_L0B_CRSD_PROVISIONAL_V1 C2853091612-ASF http=200   -> subsetting all False, n_variables=0 n_services=0
NISAR_L0B_CRSD_V1 C3622254588-ASF http=200   -> subsetting all False, n_variables=0 n_services=0
NISAR_L0B_RRSD_PROVISIONAL_V1 C2853089814-ASF http=200   -> subsetting all False, n_variables=0 n_services=0
NISAR_L0B_RRSD_V1 C3622265756-ASF http=200   -> subsetting all False, n_variables=0 n_services=0
NISAR_L1_RIFG_BETA_V1 C2850234202-ASF http=200   -> subsetting all False, n_variables=0 n_services=0
NISAR_L1_RIFG_PROVISIONAL_V1 C2853147928-ASF http=200   -> subsetting all False, n_variables=0 n_services=0
NISAR_L1_RIFG_V1 C3622229381-ASF http=200   -> subsetting all False, n_variables=0 n_services=0
NISAR_L1_ROFF_BETA_V1 C2850237619-ASF http=200   -> subsetting all False, n_variables=0 n_services=0
NISAR_L1_ROFF_PROVISIONAL_V1 C2853156054-ASF http=200   -> subsetting all False, n_variables=0 n_services=0
NISAR_L1_ROFF_V1 C3622241997-ASF http=200   -> subsetting all False, n_variables=0 n_services=0
NISAR_L1_RSLC_BETA_V1 C2850225585-ASF http=200   -> subsetting all False, n_variables=0 n_services=0
NISAR_L1_RSLC_PROVISIONAL_V1 C2853145197-ASF http=200   -> subsetting all False, n_variables=0 n_services=0
NISAR_L1_RSLC_V1 C3622236985-ASF http=200   -> subsetting all False, n_variables=0 n_services=0
NISAR_L1_RUNW_BETA_V1 C2850235455-ASF http=200   -> subsetting all False, n_variables=0 n_services=0
NISAR_L1_RUNW_PROVISIONAL_V1 C2853153429-ASF http=200   -> subsetting all False, n_variables=0 n_services=0
NISAR_L1_RUNW_V1 C3622237369-ASF http=200   -> subsetting all False, n_variables=0 n_services=0
NISAR_L2_GCOV_BETA_V1 C3622214170-ASF http=200
    subsetting={'bbox': True, 'dimension': False, 'shape': False, 'temporal': False, 'variable': True}
    reprojection.supported=True crs=[3031,3413,4326,32601-32660,32701-32760] interp=[]
    other summary keys: {'averaging': {'time': False, 'area': False}, 'concatenation': False, 'outputFormats': [{'name': 'GEOTIFF', 'mimeType': 'image/tiff'}, {'name': 'PNG', 'mimeType': 'image/png'}]}
    outputFormats=None
    n_variables=20 n_services=2 services=['nasa/harmony-gdal-adapter', 'asf/nisar-py']
NISAR_L2_GCOV_PROVISIONAL_V1 C2854338529-ASF http=200
    subsetting={'bbox': True, 'dimension': False, 'shape': False, 'temporal': False, 'variable': True}
    reprojection.supported=True crs=[3031,3413,4326,32601-32660,32701-32760] interp=[]
    other summary keys: {'averaging': {'time': False, 'area': False}, 'concatenation': False, 'outputFormats': [{'name': 'GEOTIFF', 'mimeType': 'image/tiff'}, {'name': 'PNG', 'mimeType': 'image/png'}]}
    outputFormats=None
    n_variables=20 n_services=2 services=['nasa/harmony-gdal-adapter', 'asf/nisar-py']
NISAR_L2_GCOV_V1 C3622241360-ASF http=200
    subsetting={'bbox': True, 'dimension': False, 'shape': False, 'temporal': False, 'variable': True}
    reprojection.supported=True crs=[3031,3413,4326,32601-32660,32701-32760] interp=[]
    other summary keys: {'averaging': {'time': False, 'area': False}, 'concatenation': False, 'outputFormats': [{'name': 'GEOTIFF', 'mimeType': 'image/tiff'}, {'name': 'PNG', 'mimeType': 'image/png'}]}
    outputFormats=None
    n_variables=20 n_services=2 services=['nasa/harmony-gdal-adapter', 'asf/nisar-py']
NISAR_L2_GOFF_BETA_V1 C2850263910-ASF http=200
    subsetting={'bbox': True, 'dimension': False, 'shape': False, 'temporal': False, 'variable': True}
    reprojection.supported=True crs=[3031,3413,4326,32601-32660,32701-32760] interp=[]
    other summary keys: {'averaging': {'time': False, 'area': False}, 'concatenation': False, 'outputFormats': [{'name': 'GEOTIFF', 'mimeType': 'image/tiff'}]}
    outputFormats=None
    n_variables=43 n_services=1 services=['nasa/harmony-gdal-adapter']
NISAR_L2_GOFF_PROVISIONAL_V1 C2854341702-ASF http=200
    subsetting={'bbox': True, 'dimension': False, 'shape': False, 'temporal': False, 'variable': True}
    reprojection.supported=True crs=[3031,3413,4326,32601-32660,32701-32760] interp=[]
    other summary keys: {'averaging': {'time': False, 'area': False}, 'concatenation': False, 'outputFormats': [{'name': 'GEOTIFF', 'mimeType': 'image/tiff'}]}
    outputFormats=None
    n_variables=43 n_services=1 services=['nasa/harmony-gdal-adapter']
NISAR_L2_GOFF_V1 C3622250865-ASF http=200
    subsetting={'bbox': True, 'dimension': False, 'shape': False, 'temporal': False, 'variable': True}
    reprojection.supported=True crs=[3031,3413,4326,32601-32660,32701-32760] interp=[]
    other summary keys: {'averaging': {'time': False, 'area': False}, 'concatenation': False, 'outputFormats': [{'name': 'GEOTIFF', 'mimeType': 'image/tiff'}]}
    outputFormats=None
    n_variables=43 n_services=1 services=['nasa/harmony-gdal-adapter']
NISAR_L2_GSLC_BETA_V1 C2850259510-ASF http=200   -> subsetting all False, n_variables=0 n_services=0
NISAR_L2_GSLC_PROVISIONAL_V1 C2854332392-ASF http=200   -> subsetting all False, n_variables=0 n_services=0
NISAR_L2_GSLC_V1 C3622244601-ASF http=200   -> subsetting all False, n_variables=0 n_services=0
NISAR_L2_GUNW_BETA_V1 C2850261892-ASF http=200
    subsetting={'bbox': True, 'dimension': False, 'shape': False, 'temporal': False, 'variable': True}
    reprojection.supported=True crs=[3031,3413,4326,32601-32660,32701-32760] interp=[]
    other summary keys: {'averaging': {'time': False, 'area': False}, 'concatenation': False, 'outputFormats': [{'name': 'GEOTIFF', 'mimeType': 'image/tiff'}]}
    outputFormats=None
    n_variables=23 n_services=1 services=['nasa/harmony-gdal-adapter']
NISAR_L2_GUNW_PROVISIONAL_V1 C2854335566-ASF http=200
    subsetting={'bbox': True, 'dimension': False, 'shape': False, 'temporal': False, 'variable': True}
    reprojection.supported=True crs=[3031,3413,4326,32601-32660,32701-32760] interp=[]
    other summary keys: {'averaging': {'time': False, 'area': False}, 'concatenation': False, 'outputFormats': [{'name': 'GEOTIFF', 'mimeType': 'image/tiff'}]}
    outputFormats=None
    n_variables=23 n_services=1 services=['nasa/harmony-gdal-adapter']
NISAR_L2_GUNW_V1 C3622247503-ASF http=200
    subsetting={'bbox': True, 'dimension': False, 'shape': False, 'temporal': False, 'variable': True}
    reprojection.supported=True crs=[3031,3413,4326,32601-32660,32701-32760] interp=[]
    other summary keys: {'averaging': {'time': False, 'area': False}, 'concatenation': False, 'outputFormats': [{'name': 'GEOTIFF', 'mimeType': 'image/tiff'}]}
    outputFormats=None
    n_variables=23 n_services=1 services=['nasa/harmony-gdal-adapter']
NISAR_L3_SME2_BETA_V1 C2850265000-ASF http=200
    subsetting={'bbox': True, 'dimension': False, 'shape': False, 'temporal': False, 'variable': True}
    reprojection.supported=True crs=[3031,3413,4326,32601-32660,32701-32760] interp=[]
    other summary keys: {'averaging': {'time': False, 'area': False}, 'concatenation': False, 'outputFormats': [{'name': 'GEOTIFF', 'mimeType': 'image/tiff'}]}
    outputFormats=None
    n_variables=13 n_services=1 services=['nasa/harmony-gdal-adapter']
NISAR_L3_SME2_PROVISIONAL_V1 C2854344945-ASF http=200
    subsetting={'bbox': True, 'dimension': False, 'shape': False, 'temporal': False, 'variable': True}
    reprojection.supported=True crs=[3031,3413,4326,32601-32660,32701-32760] interp=[]
    other summary keys: {'averaging': {'time': False, 'area': False}, 'concatenation': False, 'outputFormats': [{'name': 'GEOTIFF', 'mimeType': 'image/tiff'}]}
    outputFormats=None
    n_variables=13 n_services=1 services=['nasa/harmony-gdal-adapter']
NISAR_LRCLK_UTC C3632501432-ASF http=200   -> subsetting all False, n_variables=0 n_services=0
NISAR_OE C2727908375-ASF http=200   -> subsetting all False, n_variables=0 n_services=0
NISAR_OROST C2727911748-ASF http=200   -> subsetting all False, n_variables=0 n_services=0
NISAR_RP C2727912431-ASF http=200   -> subsetting all False, n_variables=0 n_services=0
NISAR_STUF C3622233495-ASF http=200   -> subsetting all False, n_variables=0 n_services=0
NISAR_TEC C3622219145-ASF http=200   -> subsetting all False, n_variables=0 n_services=0
NISAR_UR_L0B_RRSD C2887469134-ASF http=200   -> subsetting all False, n_variables=0 n_services=0
NISAR_UR_L1 C2887499907-ASF http=200   -> subsetting all False, n_variables=0 n_services=0
NISAR_UR_L2 C2887502657-ASF http=200   -> subsetting all False, n_variables=0 n_services=0
NISAR_VWC C4066106685-ASF http=200   -> subsetting all False, n_variables=0 n_services=0
NISAR_WATERMASK C3807638962-ASF http=200   -> subsetting all False, n_variables=0 n_services=0
````


### out/cmr_gcov_search_provisional_LA.txt (header and the 104 granule lines; the RelatedUrls dump of the first granule is left out)

**File:** `<scratch>/verify/harmony/out/cmr_gcov_search_provisional_LA.txt`

````
URL: https://cmr.earthdata.nasa.gov/search/granules.umm_json?collection_concept_id=C2854338529-ASF&bounding_box=-118.5%2C33.9%2C-118.1%2C34.2&page_size=200&sort_key=start_date
CMR-Hits: 104 returned: 104 saved: <scratch>/verify/harmony/out/cmr_granules_C2854338529-ASF_-118.5_33.9_-118.1_34.2.json
G4271425742-ASF  2025-11-23T02:40:35.000000Z  NISAR_L2_PR_GCOV_006_013_D_071_4005_DHDH_A_20251123T024035_20251123T024113_P05023_N_F_J_001  h5_size_GB=7.369
G4271431271-ASF  2025-11-24T13:08:24.000000Z  NISAR_L2_PR_GCOV_006_034_A_019_4005_DHDH_A_20251124T130824_20251124T130859_P05023_N_F_J_001  h5_size_GB=6.463
G4271487773-ASF  2025-11-30T02:48:55.000000Z  NISAR_L2_PR_GCOV_006_114_D_071_4005_DHDH_A_20251130T024855_20251130T024929_P05023_F_F_J_001  h5_size_GB=5.989
G4271545608-ASF  2025-12-05T02:40:36.000000Z  NISAR_L2_PR_GCOV_007_013_D_071_4005_DHDH_A_20251205T024036_20251205T024113_P05023_N_F_J_001  h5_size_GB=7.214
G4271540937-ASF  2025-12-05T02:41:09.000000Z  NISAR_L2_PR_GCOV_007_013_D_072_4005_DHDH_A_20251205T024109_20251205T024144_P05023_N_F_J_001  h5_size_GB=4.912
G4275119024-ASF  2025-12-06T13:08:25.000000Z  NISAR_L2_PR_GCOV_007_034_A_019_4005_DHDH_A_20251206T130825_20251206T130900_P05023_N_F_J_001  h5_size_GB=6.484
G4275105470-ASF  2025-12-12T02:48:55.000000Z  NISAR_L2_PR_GCOV_007_114_D_071_0005_NADV_A_20251212T024855_20251212T024930_P05023_N_F_J_001  h5_size_GB=0.323
G4275117762-ASF  2025-12-17T02:40:36.000000Z  NISAR_L2_PR_GCOV_008_013_D_071_0005_NADV_A_20251217T024036_20251217T024114_P05023_N_F_J_001  h5_size_GB=0.348
G4275133783-ASF  2025-12-18T13:08:26.000000Z  NISAR_L2_PR_GCOV_008_034_A_019_4005_DHDH_A_20251218T130826_20251218T130900_P05023_N_F_J_001  h5_size_GB=6.308
G4275131166-ASF  2025-12-23T13:00:06.000000Z  NISAR_L2_PR_GCOV_008_106_A_019_4005_DHDH_A_20251223T130006_20251223T130041_P05023_N_F_J_001  h5_size_GB=7.004
G4275129527-ASF  2025-12-24T02:48:56.000000Z  NISAR_L2_PR_GCOV_008_114_D_071_4005_DHDH_A_20251224T024856_20251224T024931_P05023_N_F_J_001  h5_size_GB=6.296
G4275126342-ASF  2025-12-29T02:40:37.000000Z  NISAR_L2_PR_GCOV_009_013_D_071_4005_DHDH_A_20251229T024037_20251229T024115_P05023_N_F_J_001  h5_size_GB=7.437
G4275149738-ASF  2025-12-30T13:08:26.000000Z  NISAR_L2_PR_GCOV_009_034_A_019_4005_DHDH_A_20251230T130826_20251230T130901_P05023_N_F_J_001  h5_size_GB=6.476
G4275130650-ASF  2026-01-04T13:00:07.000000Z  NISAR_L2_PR_GCOV_009_106_A_019_4005_DHDH_A_20260104T130007_20260104T130041_P05023_N_F_J_001  h5_size_GB=6.828
G4275129043-ASF  2026-01-11T13:08:27.000000Z  NISAR_L2_PR_GCOV_010_034_A_019_4005_DHDH_A_20260111T130827_20260111T130902_P05023_N_F_J_001  h5_size_GB=6.489
G4275152683-ASF  2026-01-17T02:48:57.000000Z  NISAR_L2_PR_GCOV_010_114_D_071_4005_DHDH_A_20260117T024857_20260117T024932_P05023_N_F_J_001  h5_size_GB=6.149
G4275140599-ASF  2026-01-22T02:40:38.000000Z  NISAR_L2_PR_GCOV_011_013_D_071_4005_DHDH_A_20260122T024038_20260122T024116_P05023_N_F_J_001  h5_size_GB=7.332
G4273517912-ASF  2026-01-23T13:08:27.000000Z  NISAR_L2_PR_GCOV_011_034_A_019_4005_DHDH_A_20260123T130827_20260123T130902_P05023_N_F_J_001  h5_size_GB=6.489
G4273491870-ASF  2026-01-28T13:00:08.000000Z  NISAR_L2_PR_GCOV_011_106_A_019_4005_DHDH_A_20260128T130008_20260128T130042_P05023_N_F_J_001  h5_size_GB=6.82
G4275181434-ASF  2026-01-29T02:48:57.000000Z  NISAR_L2_PR_GCOV_011_114_D_071_4005_DHDH_A_20260129T024857_20260129T024932_P05023_N_F_J_001  h5_size_GB=6.157
G4275151217-ASF  2026-02-03T02:40:39.000000Z  NISAR_L2_PR_GCOV_012_013_D_071_4005_DHDH_A_20260203T024039_20260203T024116_P05023_N_F_J_001  h5_size_GB=7.214
G4275145388-ASF  2026-02-03T02:41:12.000000Z  NISAR_L2_PR_GCOV_012_013_D_072_4005_DHDH_A_20260203T024112_20260203T024147_P05023_N_F_J_001  h5_size_GB=4.916
G4273497286-ASF  2026-02-04T13:08:28.000000Z  NISAR_L2_PR_GCOV_012_034_A_019_4005_DHDH_A_20260204T130828_20260204T130903_P05023_N_F_J_001  h5_size_GB=6.489
G4275161451-ASF  2026-02-09T13:00:09.000000Z  NISAR_L2_PR_GCOV_012_106_A_019_4005_DHDH_A_20260209T130009_20260209T130043_P05023_N_F_J_001  h5_size_GB=6.816
G4273503628-ASF  2026-02-10T02:48:58.000000Z  NISAR_L2_PR_GCOV_012_114_D_071_4005_DHDH_A_20260210T024858_20260210T024933_P05023_N_F_J_001  h5_size_GB=6.166
G4275139642-ASF  2026-02-15T02:40:39.000000Z  NISAR_L2_PR_GCOV_013_013_D_071_4005_DHDH_A_20260215T024039_20260215T024117_P05023_N_F_J_001  h5_size_GB=7.365
G4273529401-ASF  2026-02-16T13:08:28.000000Z  NISAR_L2_PR_GCOV_013_034_A_019_4005_DHDH_A_20260216T130828_20260216T130903_P05023_N_F_J_001  h5_size_GB=6.459
G4275221441-ASF  2026-02-21T13:00:09.000000Z  NISAR_L2_PR_GCOV_013_106_A_019_4005_DHDH_A_20260221T130009_20260221T130044_P05023_N_F_J_001  h5_size_GB=7.009
G4275228727-ASF  2026-02-22T02:48:59.000000Z  NISAR_L2_PR_GCOV_013_114_D_071_4005_DHDH_A_20260222T024859_20260222T024933_P05023_N_F_J_001  h5_size_GB=5.981
G4275152616-ASF  2026-02-27T02:40:39.000000Z  NISAR_L2_PR_GCOV_014_013_D_071_4005_DHDH_A_20260227T024039_20260227T024117_P05023_N_F_J_001  h5_size_GB=7.395
G4275158971-ASF  2026-02-28T13:08:29.000000Z  NISAR_L2_PR_GCOV_014_034_A_019_4005_DHDH_A_20260228T130829_20260228T130903_P05023_N_F_J_001  h5_size_GB=6.308
G4275176536-ASF  2026-03-05T13:00:09.000000Z  NISAR_L2_PR_GCOV_014_106_A_019_4005_DHDH_A_20260305T130009_20260305T130044_P05023_F_F_J_001  h5_size_GB=7.004
G4275178841-ASF  2026-03-06T02:48:59.000000Z  NISAR_L2_PR_GCOV_014_114_D_071_4005_DHDH_A_20260306T024859_20260306T024934_P05023_N_F_J_001  h5_size_GB=6.132
G4275182523-ASF  2026-03-11T02:40:40.000000Z  NISAR_L2_PR_GCOV_015_013_D_071_4005_DHDH_A_20260311T024040_20260311T024118_P05023_N_F_J_001  h5_size_GB=7.353
G4275188360-ASF  2026-03-12T13:08:29.000000Z  NISAR_L2_PR_GCOV_015_034_A_019_4005_DHDH_A_20260312T130829_20260312T130904_P05023_N_F_J_001  h5_size_GB=6.48
G4275260678-ASF  2026-03-17T13:00:10.000000Z  NISAR_L2_PR_GCOV_015_106_A_019_4005_DHDH_A_20260317T130010_20260317T130044_P05023_N_F_J_001  h5_size_GB=6.82
G4275279112-ASF  2026-03-18T02:48:59.000000Z  NISAR_L2_PR_GCOV_015_114_D_071_4005_DHDH_A_20260318T024859_20260318T024934_P05023_N_F_J_001  h5_size_GB=6.145
G4275216819-ASF  2026-03-23T02:40:40.000000Z  NISAR_L2_PR_GCOV_016_013_D_071_4005_DHDH_A_20260323T024040_20260323T024118_P05023_N_F_J_001  h5_size_GB=7.357
G4275213354-ASF  2026-03-24T13:08:29.000000Z  NISAR_L2_PR_GCOV_016_034_A_019_4005_DHDH_A_20260324T130829_20260324T130904_P05023_N_F_J_001  h5_size_GB=6.476
G4275292993-ASF  2026-04-04T02:40:40.000000Z  NISAR_L2_PR_GCOV_017_013_D_071_4005_DHDH_A_20260404T024040_20260404T024118_P05023_N_F_J_001  h5_size_GB=7.386
G4275252755-ASF  2026-04-05T13:08:29.000000Z  NISAR_L2_PR_GCOV_017_034_A_019_4005_DHDH_A_20260405T130829_20260405T130904_P05023_N_F_J_001  h5_size_GB=6.455
G4275172625-ASF  2026-04-10T13:00:10.000000Z  NISAR_L2_PR_GCOV_017_106_A_019_4005_DHDH_A_20260410T130010_20260410T130045_P05023_N_F_J_001  h5_size_GB=7.009
G4275161519-ASF  2026-04-11T02:49:00.000000Z  NISAR_L2_PR_GCOV_017_114_D_071_4005_DHDH_A_20260411T024900_20260411T024934_P05023_N_F_J_001  h5_size_GB=5.948
G4275297795-ASF  2026-04-16T02:40:40.000000Z  NISAR_L2_PR_GCOV_018_013_D_071_4005_DHDH_A_20260416T024040_20260416T024118_P05023_N_F_J_001  h5_size_GB=7.353
G4275305548-ASF  2026-04-17T13:08:29.000000Z  NISAR_L2_PR_GCOV_018_034_A_019_4005_DHDH_A_20260417T130829_20260417T130904_P05023_N_F_J_001  h5_size_GB=6.476
G4275200935-ASF  2026-04-22T13:00:10.000000Z  NISAR_L2_PR_GCOV_018_106_A_019_4005_DHDH_A_20260422T130010_20260422T130044_P05023_N_F_J_001  h5_size_GB=6.824
G4273850556-ASF  2026-04-23T02:48:59.000000Z  NISAR_L2_PR_GCOV_018_114_D_071_4005_DHDH_A_20260423T024859_20260423T024934_P05023_N_F_J_001  h5_size_GB=6.119
G4275305500-ASF  2026-04-28T02:40:40.000000Z  NISAR_L2_PR_GCOV_019_013_D_071_4005_DHDH_A_20260428T024040_20260428T024117_P05023_N_F_J_001  h5_size_GB=7.202
G4275304307-ASF  2026-04-28T02:41:13.000000Z  NISAR_L2_PR_GCOV_019_013_D_072_4005_DHDH_A_20260428T024113_20260428T024148_P05023_N_F_J_001  h5_size_GB=4.895
G4275300883-ASF  2026-04-29T13:08:29.000000Z  NISAR_L2_PR_GCOV_019_034_A_019_4005_DHDH_A_20260429T130829_20260429T130904_P05023_N_F_J_001  h5_size_GB=6.493
G4275270895-ASF  2026-05-04T13:00:09.000000Z  NISAR_L2_PR_GCOV_019_106_A_019_4005_DHDH_A_20260504T130009_20260504T130044_P05023_N_F_J_001  h5_size_GB=7.009
G4275207669-ASF  2026-05-05T02:48:59.000000Z  NISAR_L2_PR_GCOV_019_114_D_071_4005_DHDH_A_20260505T024859_20260505T024934_P05023_N_F_J_001  h5_size_GB=6.09
G4275308890-ASF  2026-05-10T02:40:39.000000Z  NISAR_L2_PR_GCOV_020_013_D_071_4005_DHDH_A_20260510T024039_20260510T024117_P05023_N_F_J_001  h5_size_GB=7.357
G4275303341-ASF  2026-05-11T13:08:28.000000Z  NISAR_L2_PR_GCOV_020_034_A_019_4005_DHDH_A_20260511T130828_20260511T130903_P05023_N_F_J_001  h5_size_GB=6.472
G4275257353-ASF  2026-05-16T13:00:09.000000Z  NISAR_L2_PR_GCOV_020_106_A_019_4005_DHDH_A_20260516T130009_20260516T130043_P05023_N_F_J_001  h5_size_GB=6.828
G4275223942-ASF  2026-05-17T02:48:58.000000Z  NISAR_L2_PR_GCOV_020_114_D_071_4005_DHDH_A_20260517T024858_20260517T024933_P05023_N_F_J_001  h5_size_GB=6.115
G4275313568-ASF  2026-05-22T02:40:38.000000Z  NISAR_L2_PR_GCOV_021_013_D_071_4005_DHDH_A_20260522T024038_20260522T024116_P05023_N_F_J_001  h5_size_GB=7.378
G4275308661-ASF  2026-05-23T13:08:28.000000Z  NISAR_L2_PR_GCOV_021_034_A_019_4005_DHDH_A_20260523T130828_20260523T130902_P05023_N_F_J_001  h5_size_GB=6.321
G4275281657-ASF  2026-05-28T13:00:08.000000Z  NISAR_L2_PR_GCOV_021_106_A_019_4005_DHDH_A_20260528T130008_20260528T130043_P05023_N_F_J_001  h5_size_GB=7.004
G4275289271-ASF  2026-05-29T02:48:58.000000Z  NISAR_L2_PR_GCOV_021_114_D_071_4005_DHDH_A_20260529T024858_20260529T024932_P05023_N_F_J_001  h5_size_GB=5.96
G4275309030-ASF  2026-06-03T02:40:38.000000Z  NISAR_L2_PR_GCOV_022_013_D_071_4005_DHDH_A_20260603T024038_20260603T024115_P05023_N_F_J_001  h5_size_GB=7.189
G4275303496-ASF  2026-06-04T13:08:27.000000Z  NISAR_L2_PR_GCOV_022_034_A_019_4005_DHDH_A_20260604T130827_20260604T130902_P05023_N_F_J_001  h5_size_GB=6.501
G4275295517-ASF  2026-06-09T13:00:07.000000Z  NISAR_L2_PR_GCOV_022_106_A_019_4005_DHDH_A_20260609T130007_20260609T130042_P05023_N_F_J_001  h5_size_GB=7.004
G4275286666-ASF  2026-06-10T02:48:57.000000Z  NISAR_L2_PR_GCOV_022_114_D_071_4005_DHDH_A_20260610T024857_20260610T024932_P05023_N_F_J_001  h5_size_GB=6.094
G4275308399-ASF  2026-06-15T02:40:37.000000Z  NISAR_L2_PR_GCOV_023_013_D_071_4005_DHDH_A_20260615T024037_20260615T024115_P05023_N_F_J_001  h5_size_GB=7.34
G4274494142-ASF  2026-06-16T13:08:26.000000Z  NISAR_L2_PR_GCOV_023_034_A_019_4005_DHDH_A_20260616T130826_20260616T130901_P05023_N_F_J_001  h5_size_GB=6.484
G4244992188-ASF  2026-06-21T13:00:07.000000Z  NISAR_L2_PR_GCOV_023_106_A_019_4005_DHDH_A_20260621T130007_20260621T130041_P05023_N_F_J_001  h5_size_GB=6.824
G4275299786-ASF  2026-06-21T13:00:07.000000Z  NISAR_L2_PR_GCOV_023_106_A_019_4005_DHDH_A_20260621T130007_20260621T130041_P05023_N_F_J_002  h5_size_GB=6.824
G4246334457-ASF  2026-06-22T02:48:56.000000Z  NISAR_L2_PR_GCOV_023_114_D_071_4005_DHDH_A_20260622T024856_20260622T024931_P05023_N_F_J_001  h5_size_GB=6.099
G4275294772-ASF  2026-06-22T02:48:56.000000Z  NISAR_L2_PR_GCOV_023_114_D_071_4005_DHDH_A_20260622T024856_20260622T024931_P05023_N_F_J_002  h5_size_GB=6.099
G4242954098-ASF  2026-06-27T02:40:36.000000Z  NISAR_L2_PR_GCOV_024_013_D_071_4005_DHDH_A_20260627T024036_20260627T024114_P05023_N_F_J_001  h5_size_GB=7.361
G4251168557-ASF  2026-06-28T13:08:25.000000Z  NISAR_L2_PR_GCOV_024_034_A_019_4005_DHDH_A_20260628T130825_20260628T130900_P05023_N_F_J_001  h5_size_GB=6.472
G4247561882-ASF  2026-07-03T13:00:06.000000Z  NISAR_L2_PR_GCOV_024_106_A_019_4005_DHDH_A_20260703T130006_20260703T130041_P05023_N_F_J_001  h5_size_GB=7.013
G4247898464-ASF  2026-07-04T02:48:56.000000Z  NISAR_L2_PR_GCOV_024_114_D_071_4005_DHDH_A_20260704T024856_20260704T024930_P05023_N_F_J_001  h5_size_GB=5.935
G4248679502-ASF  2026-07-09T02:40:36.000000Z  NISAR_L2_PR_GCOV_025_013_D_071_4005_DHDH_A_20260709T024036_20260709T024113_P05023_N_F_J_001  h5_size_GB=7.202
G4249560764-ASF  2026-07-10T13:08:25.000000Z  NISAR_L2_PR_GCOV_025_034_A_019_4005_DHDH_A_20260710T130825_20260710T130900_P05023_N_F_J_001  h5_size_GB=6.497
G4257392408-ASF  2026-07-15T13:00:05.000000Z  NISAR_L2_PR_GCOV_025_106_A_019_4005_DHDH_A_20260715T130005_20260715T130040_P05023_N_F_J_001  h5_size_GB=7.009
G4254088971-ASF  2026-07-16T02:48:55.000000Z  NISAR_L2_PR_GCOV_025_114_D_071_4005_DHDH_A_20260716T024855_20260716T024930_P05023_N_F_J_001  h5_size_GB=6.078
G4258327281-ASF  2026-07-21T02:40:35.000000Z  NISAR_L2_PR_GCOV_026_013_D_071_4005_DHDH_A_20260721T024035_20260721T024113_P05023_N_F_J_001  h5_size_GB=7.34
G4260079303-ASF  2026-07-22T13:08:24.000000Z  NISAR_L2_PR_GCOV_026_034_A_019_4005_DHDH_A_20260722T130824_20260722T130859_P05023_N_F_J_001  h5_size_GB=6.484
G4264785815-ASF  2026-07-27T13:00:05.000000Z  NISAR_L2_PR_GCOV_026_106_A_019_4005_DHDH_A_20260727T130005_20260727T130039_P05023_N_F_J_001  h5_size_GB=6.824
G4283358557-ASF  2026-08-14T02:40:34.000000Z  NISAR_L2_PR_GCOV_028_013_D_071_4005_DHDH_A_20260814T024034_20260814T024111_P05023_N_F_J_001  h5_size_GB=7.202
G4284099404-ASF  2026-08-15T13:08:23.000000Z  NISAR_L2_PR_GCOV_028_034_A_019_4005_DHDH_A_20260815T130823_20260815T130858_P05023_N_F_J_001  h5_size_GB=6.489
G4287210614-ASF  2026-08-20T13:00:03.000000Z  NISAR_L2_PR_GCOV_028_106_A_019_4005_DHDH_A_20260820T130003_20260820T130038_P05023_N_F_J_001  h5_size_GB=7.0
G4287832318-ASF  2026-08-21T02:48:53.000000Z  NISAR_L2_PR_GCOV_028_114_D_071_4005_DHDH_A_20260821T024853_20260821T024928_P05023_N_F_J_001  h5_size_GB=6.119
G4293238820-ASF  2026-08-26T02:40:33.000000Z  NISAR_L2_PR_GCOV_029_013_D_071_4005_DHDH_A_20260826T024033_20260826T024111_P05023_N_F_J_001  h5_size_GB=7.386
G4291605360-ASF  2026-08-27T13:08:23.000000Z  NISAR_L2_PR_GCOV_029_034_A_019_4005_DHDH_A_20260827T130823_20260827T130857_P05023_N_F_J_001  h5_size_GB=6.317
G4297426374-ASF  2026-09-01T13:00:03.000000Z  NISAR_L2_PR_GCOV_029_106_A_019_4005_DHDH_A_20260901T130003_20260901T130038_P05023_N_F_J_001  h5_size_GB=7.013
G4297867263-ASF  2026-09-02T02:48:53.000000Z  NISAR_L2_PR_GCOV_029_114_D_071_4005_DHDH_A_20260902T024853_20260902T024928_P05023_N_F_J_001  h5_size_GB=6.103
G4303162318-ASF  2026-09-07T02:40:33.000000Z  NISAR_L2_PR_GCOV_030_013_D_071_4005_DHDH_A_20260907T024033_20260907T024111_P05023_N_F_J_001  h5_size_GB=7.378
G4306523933-ASF  2026-09-08T13:08:22.000000Z  NISAR_L2_PR_GCOV_030_034_A_019_4005_DHDH_A_20260908T130822_20260908T130857_P05023_N_F_J_001  h5_size_GB=6.463
G4312009782-ASF  2026-09-13T13:00:03.000000Z  NISAR_L2_PR_GCOV_030_106_A_019_4005_DHDH_A_20260913T130003_20260913T130038_P05023_N_F_J_001  h5_size_GB=7.004
G4312691947-ASF  2026-09-14T02:48:53.000000Z  NISAR_L2_PR_GCOV_030_114_D_071_4005_DHDH_A_20260914T024853_20260914T024927_P05023_N_F_J_001  h5_size_GB=5.973
G4318204319-ASF  2026-09-19T02:40:33.000000Z  NISAR_L2_PR_GCOV_031_013_D_071_4005_DHDH_A_20260919T024033_20260919T024111_P05023_F_F_J_001  h5_size_GB=7.374
G4320033412-ASF  2026-09-20T13:08:23.000000Z  NISAR_L2_PR_GCOV_031_034_A_019_4005_DHDH_A_20260920T130823_20260920T130857_P05023_N_F_J_001  h5_size_GB=6.317
G4326013074-ASF  2026-09-25T13:00:03.000000Z  NISAR_L2_PR_GCOV_031_106_A_019_4005_DHDH_A_20260925T130003_20260925T130038_P05023_N_F_J_001  h5_size_GB=7.004
G4326370120-ASF  2026-09-26T02:48:53.000000Z  NISAR_L2_PR_GCOV_031_114_D_071_4005_DHDH_A_20260926T024853_20260926T024927_P05023_N_F_J_001  h5_size_GB=5.977
G4335988957-ASF  2026-10-01T02:40:33.000000Z  NISAR_L2_PR_GCOV_032_013_D_071_4005_DHDH_A_20261001T024033_20261001T024111_P05023_N_F_J_001  h5_size_GB=7.378
G4352244316-ASF  2026-10-07T13:00:03.000000Z  NISAR_L2_PR_GCOV_032_106_A_019_4005_DHDH_A_20261007T130003_20261007T130038_P05023_N_F_J_001  h5_size_GB=7.004
G4354132133-ASF  2026-10-08T02:48:53.000000Z  NISAR_L2_PR_GCOV_032_114_D_071_4005_DHDH_A_20261008T024853_20261008T024928_P05023_N_F_J_001  h5_size_GB=6.107
G4366581033-ASF  2026-10-13T02:40:33.000000Z  NISAR_L2_PR_GCOV_033_013_D_071_4005_DHDH_A_20261013T024033_20261013T024111_P05023_N_F_J_001  h5_size_GB=7.399
G4370148709-ASF  2026-10-14T13:08:23.000000Z  NISAR_L2_PR_GCOV_033_034_A_019_4005_DHDH_A_20261014T130823_20261014T130857_P05023_N_F_J_001  h5_size_GB=6.304
G4381234094-ASF  2026-10-19T13:00:03.000000Z  NISAR_L2_PR_GCOV_033_106_A_019_4005_DHDH_A_20261019T130003_20261019T130038_P05023_N_F_J_001  h5_size_GB=7.004
G4382816750-ASF  2026-10-20T02:48:53.000000Z  NISAR_L2_PR_GCOV_033_114_D_071_4005_DHDH_A_20261020T024853_20261020T024928_P05023_N_F_J_001  h5_size_GB=6.132
````


### out/inspect_harmony_py.txt (version, public names, signatures, Client methods, constants; docstrings left out)

**File:** `<scratch>/verify/harmony/out/inspect_harmony_py.txt`

````
harmony-py version: 1.8.0 | harmony.__version__ = 1.8.0
harmony.__all__ / public names: ['AddLabelsRequest', 'BBox', 'BatchStatus', 'CapabilitiesRequest', 'Client', 'Collection', 'DeleteLabelsRequest', 'Dimension', 'Environment', 'JobsRequest', 'LinkType', 'PackageNotFoundError', 'Request', 'StepsRequest', 'WKT', 'auth', 'client', 'config', 'request', 's3_components', 'util', 'version']
--- Client
   signature: (*, auth: Optional[Tuple[str, str]] = None, should_validate_auth: bool = True, env: harmony.config.Environment = <Environment.PROD: 4>, token: str | None = None, check_interval: float = 3.0, download_timeout: float | tuple[float | None, float | None] | list[float | None] | None = None)
--- Request
   signature: (collection: harmony.request.Collection, *, spatial: Union[harmony.request.BBox, harmony.request.WKT] = None, temporal: Mapping[str, datetime.datetime] = None, dimensions: List[harmony.request.Dimension] = None, extend: List[str] = None, crs: str = None, destination_url: str = None, format: str = None, granule_id: List[str] = None, granule_name: List[str] = None, height: int = None, interpolation: str = None, max_results: int = None, scale_extent: List[float] = None, scale_size: List[float] = None, shape: Optional[Tuple[IO, str]] = None, variables: List[str] = ['all'], width: int = None, concatenate: bool = None, average: str = None, skip_preview: bool = None, ignore_errors: bool = None, grid: str = None, labels: List[str] = None, pixel_subset: bool = None, service_id: str = None)
--- CapabilitiesRequest
   signature: (**request_params)
--- JobsRequest
   signature: (*, page: int | None = None, limit: int | None = None, labels: Optional[List[str]] = None)
--- AddLabelsRequest
   signature: (*, labels: List[str], job_ids: List[str])
--- DeleteLabelsRequest
   signature: (*, labels: List[str], job_ids: List[str])
--- Collection
   signature: (id: str)
--- BBox
   signature: (w: float, s: float, e: float, n: float)
--- WKT
   signature: (wkt: str)
--- Dimension
   signature: (name: str, min: float = None, max: float = None)
--- Environment
   signature: (*values)
   members: [('LOCAL', 1), ('SIT', 2), ('UAT', 3), ('PROD', 4)]
--- LinkType
   signature: (*values)
   members: [('s3', 's3'), ('http', 'http'), ('https', 'https')]
=== Client public methods ===
  aws_credentials(self) -> dict
      Retrieve temporary AWS credentials for retrieving data in S3.
  cancel(self, job_id: str)
      Cancel a job.
  download(self, url: str, directory: str = '', overwrite: bool = False) -> concurrent.futures._base.Future
      Downloads data and saves it to a file asynchronously.
  download_all(self, job_id_or_result_json: Union[str, dict], directory: str = '', overwrite: bool = False) -> Generator[concurrent.futures._base.Future, NoneType, NoneType]
      Using a job_id, fetches all the data files from a finished job.
  download_batch(self, job_ids: List[str], directory: str = '', overwrite: bool = False) -> Mapping[str, List[concurrent.futures._base.Future]]
      Downloads the output files for a batch of jobs.
  download_intermediate_files(self, job_id: str, work_items: List[int], include_inputs: bool = True, include_outputs: bool = True, directory: str = '', overwrite: bool = False) -> Iterator[concurrent.futures._base.Future]
      Resolve and download the intermediate input and/or output files for
  get_download_filename_from_url(self, url: str) -> str
      For a given URL, returns the filename that will be used for download.
  iterator(self, job_id: str, directory: str = '', overwrite: bool = False) -> Iterator
      Create an iterator that will poll for data in the background and download it as
  job_status_message(self, job_id: str) -> str
      Extract the job status and message from job results.
  pause(self, job_id: str)
      Pause a job.
  progress(self, job_id: str) -> Tuple[int, str, str]
      Retrieve a submitted job's completion status in percent.
  read_text(self, url: str) -> str
      Uses the harmony-py Client session to fetch a URL.
  request_as_curl(self, request: harmony.request.BaseRequest) -> str
      Returns a curl command representation of the given request.
  request_as_url(self, request: harmony.request.BaseRequest) -> str
      Returns a URL string representation of the given request.
  result_json(self, job_id: str, show_progress: bool = False, link_type: harmony.request.LinkType = <LinkType.https: 'https'>) -> str
      Retrieve a job's final json output.
  result_urls(self, job_id: str, show_progress: bool = False, link_type: harmony.request.LinkType = <LinkType.https: 'https'>, page: int = None, limit: int = None, allow_incomplete: bool = False) -> Generator[str, NoneType, NoneType]
      Retrieve the data URLs for a job.
  resume(self, job_id: str)
      Resume a job.
  stac_catalog_url(self, job_id: str, show_progress: bool = False, link_type: harmony.request.LinkType = <LinkType.https: 'https'>) -> str
      Extract the STAC catalog URL from job results.
  status(self, job_id: str) -> dict
      Retrieve a submitted job's metadata from Harmony.
  submit(self, request: harmony.request.BaseRequest) -> <built-in function any>
      Submits a request to Harmony and returns the Harmony Job ID.
  submit_batch(self, requests: List[harmony.request.BaseRequest]) -> List[<built-in function any>]
      Submits a batch of requests to Harmony concurrently.
  wait_for_batch(self, job_ids: List[str], show_progress: bool = False) -> harmony.client.BatchStatus
      Waits for a batch of jobs to each reach a terminal state, polling all of them in
  wait_for_processing(self, job_id: str, show_progress: bool = False) -> None
      Retrieve a submitted job's completion status in percent.

=== module-level constants in harmony.client ===
  DEFAULT_JOB_LABEL = 'harmony-py'
  IO = <class 'typing.IO'>
  MAX_BATCH_STATUS_JOB_IDS = 2000
  MAX_INTERMEDIATE_FILE_DOWNLOADS = 50
  PRIVATE_FILE_LOCATION = '<private file location>'
  TERMINAL_JOB_STATUSES = {'complete_with_errors', 'failed', 'successful', 'paused', 'canceled'}
  UUID = <class 'uuid.UUID'>
  WKT = <class 'harmony.request.WKT'>
  harmony_version = '1.8.0'

=== Hostnames per Environment ===
````


## Appendix C. The deployed service's code (docs; this is what ran locally)

Tag v0.0.3 of `https://github.com/ASFHyP3/harmony-gdal`, commit `8d24a3d61cffa367ea9ae4f0faa8c14c527e3311`,
the same commit as upstream `main` on 2026-11-14 (`out/check_repos.txt`). License BSD-3-Clause.

### src/harmony_gdal_adapter/recipes/nisar.k

**File:** `<scratch>/verify/harmony/repos/harmony-gdal_v0.0.3/src/harmony_gdal_adapter/recipes/nisar.k`

````
import schema

collection_shortname = option("collection_shortname", 'str', False) or None
input_filename = option("input_filename", 'str')
target_srs = option("target_srs", 'str', False) or None
spatial_extents_wkt = option("spatial_extents_wkt", 'str', False) or None
spatial_extents_bounding_box = option("spatial_extents_bounding_box", 'list', False) or None
output_type = option("output_type", 'str')
output_filename = option("output_filename", 'str')
variable_path = option("variable_path", 'str')

assert not (spatial_extents_wkt is not None and spatial_extents_bounding_box is not None), "Invalid input options: spatial extents wkt string and bounding box specified"

_gdal_options = schema.GdalOptions {
    input_options = schema.GdalInputOptions {
        driver = "HDF5"
        dataset_path = "/${variable_path}"
        input_file_path = input_filename
    }
    output_options = schema.GdalOutputOptions {
        output_file_path = output_filename
        creation_options = {
            "BIGTIFF" = "IF_SAFER"
            "NUM_THREADS" = "ALL_CPUS"
        }
        output_type = "COG"
    }
}

recipe: schema.Recipe = schema.Recipe {
    if target_srs or spatial_extents_wkt or spatial_extents_bounding_box:
        inner = schema.GdalWarpRecipe {
            warp_options = schema.GdalWarpOptions {
                dst_alpha = None
                if spatial_extents_wkt:
                    spatial_subset = schema.GdalWarpCutlineSpatialSubset {
                        cutline_wkt = spatial_extents_wkt
                        crop_to_cutline = True
                    }
                elif spatial_extents_bounding_box:
                    spatial_subset = schema.GdalWarpBoundsSpatialSubset {
                        output_bounds = spatial_extents_bounding_box
                    }
                if target_srs:
                    target_srs = target_srs
            }
            gdal_options = _gdal_options
        }
    else:
        inner = schema.GdalTranslateRecipe {
            gdal_options: _gdal_options
        }
}
````


### src/harmony_gdal_adapter/harmony_service.py

**File:** `<scratch>/verify/harmony/repos/harmony-gdal_v0.0.3/src/harmony_gdal_adapter/harmony_service.py`

````python
"""Harmony service for the GDAL Adapter. This is the entrypoint for the Harmony CLI."""

import argparse
import tempfile
from dataclasses import dataclass
from os import getenv
from pathlib import Path
from pprint import pformat
from urllib.parse import urljoin, urlparse

import harmony_service_lib
import pystac
import requests
from harmony_service_lib.exceptions import HarmonyException
from harmony_service_lib.util import download, generate_output_filename, stage
from requests.exceptions import RequestException

import harmony_gdal_adapter
from harmony_gdal_adapter.build_recipes import RecipeInputOptions, build_recipe
from harmony_gdal_adapter.exceptions import (
    EmptyOutputError,
    HGANoRetryException,
    MissingVariableError,
    UnsupportedFileFormatError,
)
from harmony_gdal_adapter.gdal import execute_recipe


class HarmonyAdapter(harmony_service_lib.BaseHarmonyAdapter):
    """Harmony adapter for harmony-gdal-adapter."""

    def process_item(self, item: pystac.Item, source: harmony_service_lib.message.Source) -> pystac.Item:
        """Processes a single input item.

        Parameters
        ----------
        item : pystac.Item
            the item that should be processed
        source : harmony_service_lib.message.Source
            the input source defining the variables, if any, to subset from the item

        Returns:
        -------
        pystac.Item
            a STAC catalog whose metadata and assets describe the service output
        """
        if (requested_type := self.message.format.process('mime')) != 'image/tiff':
            raise UnsupportedFileFormatError(requested_type)

        self.logger.info(f'Harmony GDAL Adapter Version {harmony_gdal_adapter.__version__}')
        self.logger.info(f'Processing item {item.id}')

        granule_url = _get_asset_url(item, '.h5')

        with tempfile.TemporaryDirectory() as temp_dir:
            granule_filename = download(
                url=granule_url,
                destination_dir=temp_dir,
                logger=self.logger,
                access_token=self.message.accessToken,
            )

            granule_name = Path(urlparse(granule_url).path).stem

            result = item.clone()
            result.assets = {}

            variables = source.process('variables') or _get_mmt_variables(
                str(source.process('collection')), self.message.accessToken
            )

            for variable in variables:
                self.logger.info(f'Processing variable: {pformat(variable)}')
                input_options = RecipeInputOptions(
                    input_filename=granule_filename,
                    output_filename='',
                    collection_shortname=str(source.process('shortName')),
                    output_type=requested_type,
                    variable_path=variable.fullPath.strip(),
                )

                if (format := self.message.format) and (srs := format.srs) and (epsg := srs.epsg):
                    input_options.target_srs = epsg

                if (subset := self.message.subset) and (bounding_box := subset.bbox):
                    input_options.spatial_extents_bounding_box = bounding_box

                output_filename = generate_output_filename(
                    filename=granule_name,
                    variable_subset=[variable.fullPath],
                    ext='.tif',
                    is_subsetted=input_options.spatial_extents_bounding_box is not None,
                )
                input_options.output_filename = f'{temp_dir}/{output_filename}'

                self.logger.info(f'Building recipe with the following Input Options: {pformat(input_options)}')
                recipe = build_recipe(input_options)
                self.logger.info(f'Running the following GDAL Recipe: {pformat(recipe)}')

                try:
                    execute_recipe(recipe)
                except RuntimeError as e:
                    raise HGANoRetryException(str(e))
                except MissingVariableError:
                    self.logger.info('Variable is not present in source dataset, skipping.')
                    continue

                url = stage(
                    local_filename=input_options.output_filename,
                    remote_filename=output_filename,
                    mime='image/tiff',
                    location=self.message.stagingLocation,
                    logger=self.logger,
                )

                result.assets[variable.fullPath] = pystac.Asset(
                    url, title=output_filename, media_type=requested_type, roles=['data']
                )

            if result.assets == {}:
                raise EmptyOutputError

        return result


def _get_asset_url(item: pystac.Item, suffix: str) -> str:
    try:
        return next(asset.href for asset in item.assets.values() if asset.href.endswith(suffix))
    except StopIteration:
        raise HarmonyException(f'No {suffix} asset found for {item.id}')


@dataclass
class _MMTVariable:
    fullPath: str


def _get_mmt_variables(collection_concept_id: str, access_token: str) -> list[_MMTVariable]:
    cmr_url = getenv('CMR_ENDPOINT') or 'https://cmr.earthdata.nasa.gov'
    url = urljoin(cmr_url, '/search/variables.umm_json')

    params = {
        'keyword': collection_concept_id,
        'page_size': '2000',
    }

    header_params = {'Authorization': f'Bearer {access_token}', 'Client-Id': 'harmony-gdal-adapter'}

    try:
        response = requests.get(url, params=params, headers=header_params)
        response.raise_for_status()
    except RequestException as e:
        raise HarmonyException(f'Error while fetching variables from CMR: {e!s}')

    return [
        _MMTVariable(fullPath=variable['umm']['Name'])
        for variable in response.json()['items']
        if collection_concept_id in variable['meta']['associations']['collections']
    ]


def main() -> None:
    """Run the Harmony service."""
    parser = argparse.ArgumentParser(description='Run the Harmony service')
    harmony_service_lib.setup_cli(parser)
    args = parser.parse_args()
    harmony_service_lib.run_cli(parser, args, HarmonyAdapter)


if __name__ == '__main__':
    main()
````


### src/harmony_gdal_adapter/gdal.py

**File:** `<scratch>/verify/harmony/repos/harmony-gdal_v0.0.3/src/harmony_gdal_adapter/gdal.py`

````python
"""Execute GDAL recipes."""

from itertools import chain
from typing import TypedDict

from osgeo import gdal, ogr, osr
from osgeo.gdal import OpenEx, Translate, UseExceptions, Warp

from harmony_gdal_adapter.build_recipes import (
    GdalOutputOptions,
    GdalTranslateRecipe,
    GdalWarpBoundsSpatialSubset,
    GdalWarpCutlineSpatialSubset,
    GdalWarpRecipe,
    Recipe,
)
from harmony_gdal_adapter.exceptions import MissingVariableError, UnsupportedProjectionError


class _WarpOptions(TypedDict, total=False):
    format: str | None
    dstSRS: str | None
    srcSRS: str | None
    srcAlpha: bool | None
    dstAlpha: bool | None
    multithread: bool | None
    copyMetadata: bool | None
    outputBounds: list[float] | None
    outputBoundsSRS: str | None
    cutlineWKT: str | None
    cutlineSRS: str | None
    cutlineWhere: str | None
    cutlineSQL: str | None
    cutlineBlend: int | None
    cropToCutline: bool | None
    creationOptions: dict | None


def _validate_input_string(recipe: Recipe) -> None:
    input_options = recipe.inner.gdal_options.input_options
    truth_file = OpenEx(
        f'{input_options.virtual_filesystem or ""}{input_options.input_file_path}',
        allowed_drivers=[input_options.driver],
    )
    valid_input_strings = [dataset[0] for dataset in truth_file.GetSubDatasets()]

    if not any(input_options.dataset_path in valid_input_string for valid_input_string in valid_input_strings):
        raise MissingVariableError(input_options.dataset_path)


def _validate_srs(srs: str) -> None:
    valid_codes = ['EPSG:4326', 'EPSG:3031', 'EPSG:3413', 'EPSG:3412']

    for code in chain(range(32601, 32661), range(32701, 32761)):
        valid_codes.append(f'EPSG:{code}')

    if srs not in valid_codes:
        raise UnsupportedProjectionError(srs)


def _validate_recipe_input(recipe: Recipe) -> None:
    _validate_input_string(recipe)

    match recipe.inner:
        case GdalWarpRecipe() as warp_recipe:
            if (target_srs := warp_recipe.warp_options.target_srs) is not None:
                _validate_srs(target_srs)


def execute_recipe(recipe: Recipe) -> None:
    """Executes a built Recipe as a GDAL operation.

    Args:
        recipe (Recipe): The Recipe representing a given GDAL translate or warp operation.

    Returns:
        None
    """
    source_dataset = _build_input_string(recipe)
    destination_name = _build_output_string(recipe)
    UseExceptions()
    _validate_recipe_input(recipe)

    match recipe.inner:
        case GdalTranslateRecipe() as translate_recipe:
            _execute_gdal_translate_recipe(source_dataset, destination_name, translate_recipe)
        case GdalWarpRecipe() as warp_recipe:
            _execute_gdal_warp_recipe(source_dataset, destination_name, warp_recipe)
        case _:
            raise TypeError('recipe must be GdalTranslateRecipe or GdalWarpRecipe')


def _execute_gdal_translate_recipe(source_dataset: str, destination_name: str, recipe: GdalTranslateRecipe) -> None:
    translate_options = _build_gdal_translate_options(recipe)
    Translate(destination_name, source_dataset, **translate_options)


def _execute_gdal_warp_recipe(source_dataset: str, destination_name: str, recipe: GdalWarpRecipe) -> None:
    if isinstance(recipe.warp_options.spatial_subset, GdalWarpBoundsSpatialSubset):
        recipe.warp_options.spatial_subset = _convert_bounds_subset_to_cutline_subset(
            recipe.warp_options.spatial_subset
        )
    if recipe.warp_options.spatial_subset:
        recipe = _clip_spatial_extents(recipe)
    warp_options = _build_gdal_warp_options(recipe)
    Warp(destination_name, source_dataset, **warp_options)


def _build_input_string(recipe: Recipe) -> str:
    """Return input string file from recipe."""
    input_options = recipe.inner.gdal_options.input_options
    return f'{input_options.driver}:{input_options.virtual_filesystem or ""}"{input_options.input_file_path}":{input_options.dataset_path}'


def _build_output_string(recipe: Recipe) -> str:
    """Return output file path from recipe."""
    output_options = recipe.inner.gdal_options.output_options
    return str(output_options.output_file_path)


def _build_gdal_translate_options(recipe: GdalTranslateRecipe) -> _WarpOptions:
    translate_options = _build_gdal_output_options(recipe.gdal_options.output_options)
    return translate_options


def _build_gdal_warp_options(recipe: GdalWarpRecipe) -> _WarpOptions:
    input_warp_options = recipe.warp_options

    warp_options = _build_gdal_output_options(recipe.gdal_options.output_options)

    warp_options |= _WarpOptions(
        dstSRS=input_warp_options.target_srs,
        srcSRS=input_warp_options.source_srs,
        srcAlpha=input_warp_options.src_alpha,
        dstAlpha=input_warp_options.dst_alpha,
        multithread=input_warp_options.multithreaded,
        copyMetadata=input_warp_options.copy_metadata,
    )

    if spatial_subset := input_warp_options.spatial_subset:
        match spatial_subset:
            case GdalWarpBoundsSpatialSubset() as bounds:
                warp_options |= _WarpOptions(
                    outputBounds=bounds.output_bounds, outputBoundsSRS=bounds.output_bounds_srs
                )
            case GdalWarpCutlineSpatialSubset() as cutline:
                warp_options |= _WarpOptions(
                    cutlineWKT=cutline.cutline_wkt,
                    cutlineSRS=cutline.cutline_srs,
                    cutlineWhere=cutline.cutline_where,
                    cutlineSQL=cutline.cutline_sql,
                    cutlineBlend=cutline.cutline_blend,
                    cropToCutline=cutline.crop_to_cutline,
                )

    return warp_options


def _build_gdal_output_options(output_options: GdalOutputOptions) -> _WarpOptions:
    """Build gdalOptions dictionary."""
    gdal_output_options = _WarpOptions()
    gdal_output_options['format'] = output_options.output_type
    if output_options.creation_options is not None:
        gdal_output_options['creationOptions'] = output_options.creation_options
    return gdal_output_options


def _clip_spatial_extents(recipe: GdalWarpRecipe) -> GdalWarpRecipe:
    """Clip the spatial extents arguments to fit within the bounding box."""
    granule_polygon = _get_granule_polygon(recipe)
    match recipe.warp_options.spatial_subset:
        case GdalWarpBoundsSpatialSubset() as bounds_subset:
            recipe.warp_options.spatial_subset.output_bounds = _calculate_bounding_box_intersection(
                bounds_subset, granule_polygon
            )
        case GdalWarpCutlineSpatialSubset() as cutline_subset:
            recipe.warp_options.spatial_subset.cutline_wkt = _calculate_wkt_intersection(
                cutline_subset, granule_polygon
            )
    return recipe


def _calculate_wkt_intersection(cutline_subset: GdalWarpCutlineSpatialSubset, granule_polygon: ogr.Geometry) -> str:
    """Calculate the intersection of wkt spatial extent and granule extent."""
    subset_polygon = _create_polygon_from_wkt(cutline_subset.cutline_wkt, cutline_subset.cutline_srs)
    intersection_polygon = _calculate_polygon_intersection(subset_polygon, granule_polygon)
    intersection_wkt = intersection_polygon.ExportToWkt()
    return intersection_wkt


def _calculate_bounding_box_intersection(
    bounds_subset: GdalWarpBoundsSpatialSubset, granule_polygon: ogr.Geometry
) -> list[float]:
    """Calculate the intersection of bounding box spatial extent and granule extent."""
    subset_polygon = _create_polygon_from_bounding_box(bounds_subset.output_bounds, bounds_subset.output_bounds_srs)
    intersection_polygon = _calculate_polygon_intersection(subset_polygon, granule_polygon)
    intersection_envelope = intersection_polygon.GetEnvelope()
    # envelope is in format [minx, maxx, miny, maxy], must be rearranged to [minx, min, maxx, maxy]
    intersection_bounding_box = [
        intersection_envelope[0],
        intersection_envelope[2],
        intersection_envelope[1],
        intersection_envelope[3],
    ]
    return intersection_bounding_box


def _calculate_polygon_intersection(subset_polygon: ogr.Geometry, granule_polygon: ogr.Geometry) -> ogr.Geometry:
    """Calculate the intersection of subset polygon spatial extent and granule polygon extent."""
    assert subset_polygon.IsValid(), 'spatial extent polygon invalid'
    assert granule_polygon.IsValid(), 'source data polygon invalid'
    assert subset_polygon.Intersects(granule_polygon), 'Subset polygon and source polygon do not overlap'
    intersection_polygon = subset_polygon.Intersection(granule_polygon)
    return intersection_polygon


def _convert_bounds_subset_to_cutline_subset(
    bounds_subset: GdalWarpBoundsSpatialSubset,
) -> GdalWarpCutlineSpatialSubset:
    """Convert GdalWarpBoundsSpatialSubset to GdalWarpCutlineSpatialSubset."""
    polygon = _create_polygon_from_bounding_box(bounds_subset.output_bounds, bounds_subset.output_bounds_srs)
    wkt = polygon.ExportToWkt()
    cutline_subset = GdalWarpCutlineSpatialSubset(
        cutline_wkt=wkt, cutline_srs=bounds_subset.output_bounds_srs, crop_to_cutline=True
    )
    return cutline_subset


def _create_polygon_from_bounding_box(bounding_box: list[float], bounding_box_srs: str | None) -> ogr.Geometry:
    """Create polygon object from bounding box."""
    polygon_srs = osr.SpatialReference()
    polygon_srs.SetFromUserInput(bounding_box_srs)
    polygon = ogr.CreateGeometryFromEnvelope(*bounding_box)
    polygon.AssignSpatialReference(polygon_srs)
    return polygon


def _create_polygon_from_wkt(cutline_wkt: str, cutline_srs: str | None) -> ogr.Geometry:
    """Create polygon object from wkt string."""
    polygon_srs = osr.SpatialReference()
    polygon_srs.SetFromUserInput(cutline_srs)
    return ogr.CreateGeometryFromWkt(cutline_wkt, reference=polygon_srs)


def _get_granule_polygon(recipe: GdalWarpRecipe) -> ogr.Geometry:
    """Return granule spatial extents as a polygon in the SRS of the spatial subset."""
    # force longitude to x axis
    spatial_subset = recipe.warp_options.spatial_subset
    subset_srs = osr.SpatialReference()
    match spatial_subset:
        case GdalWarpBoundsSpatialSubset():
            subset_srs.SetFromUserInput(spatial_subset.output_bounds_srs)
        case GdalWarpCutlineSpatialSubset():
            subset_srs.SetFromUserInput(spatial_subset.cutline_srs)
    subset_srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    gdal_driver = recipe.gdal_options.input_options.driver
    if recipe.gdal_options.input_options.dataset_path:
        gdal_dataset_string = f'{gdal_driver}:{recipe.gdal_options.input_options.input_file_path}:{recipe.gdal_options.input_options.dataset_path}'
    else:
        gdal_dataset_string = f'{gdal_driver}:{recipe.gdal_options.input_options.input_file_path}'
    dataset = gdal.Open(gdal_dataset_string)
    dataset_extents = dataset.GetExtent(srs=subset_srs)
    dataset_bounding_box = [dataset_extents[0], dataset_extents[2], dataset_extents[1], dataset_extents[3]]
    granule_polygon = ogr.CreateGeometryFromEnvelope(*dataset_bounding_box)
    granule_polygon.AssignSpatialReference(subset_srs)
    return granule_polygon
````


The service's command-line tool, from its README (**docs**, not run by the agents; they called the Python
functions directly):

```bash
hga --input-filename "NISAR_L2_PR_GCOV_005_149_A_024_4005_DHDH_A_20251120T123755_20251120T123830_X05009_N_F_J_001.h5" --collection-shortname "foobar" --output-type GTiff --output-filename output.tif --variable-path "//science/LSAR/GCOV/grids/frequencyB/HHHH"

hga --input-filename NISAR_L2_PR_GCOV_030_106_A_027_4005_DHDH_A_20260913T130434_20260913T130510_P05023_N_F_J_001.h5 --collection-shortname "foobar" --output-type GTiff --output-filename "output_cropped.tif" --variable-path "//science/LSAR/GCOV/grids/frequencyB/HHHH" --spatial-extents "POLYGON((-125.1989 49.2151,-125.1461 49.2151,-125.1461 49.2583,-125.1989 49.2583,-125.1989 49.2151))"
```

## Appendix D. Commands that built the local GDAL environment (ran)

Copied from the tool calls of the second and third attempts (`agent-a6f8b12e2bbd50095.jsonl`,
`agent-a4dd2ffbe1add4f11.jsonl`) with output redirections removed; the first `git clone` line is from the
notes in `scripts/check_repos.sh`. `$T` is the task folder. macOS arm64, no system GDAL, about 35 GB free
disk at the time.

```bash
# 1. standalone micromamba (version 2.10.0 was fetched)
mkdir -p mamba/dl && cd mamba/dl && curl -q -sS -L -A "generic-research-client/1.0" -o micromamba.tar.bz2 \
  "https://micro.mamba.pm/api/micromamba/osx-arm64/latest" && tar -xjf micromamba.tar.bz2 && ./bin/micromamba --version

# 2. conda-forge environment with GDAL 3.13.3 and the HDF5 driver
T="$PWD" && export MAMBA_ROOT_PREFIX="$T/mamba/root" && env -i PATH=/usr/bin:/bin HOME="$T/mamba/home" \
  MAMBA_ROOT_PREFIX="$MAMBA_ROOT_PREFIX" "$T/mamba/dl/bin/micromamba" create --no-rc -y -p "$T/mamba/env" \
  --override-channels -c conda-forge "python=3.14" "gdal=3.13.3" "libgdal-hdf5=3.13.3" "libgdal-netcdf=3.13.3" h5py numpy pip

# 3. the deployed service code at tag v0.0.3, plus what the synthetic-file generator needs
git clone https://github.com/ASFHyP3/harmony-gdal.git repos/ASFHyP3_harmony-gdal
git clone -q --branch v0.0.3 "file://$T/repos/ASFHyP3_harmony-gdal" repos/harmony-gdal_v0.0.3
env -i PATH="$T/mamba/env/bin:/usr/bin:/bin" HOME="$T/mamba/home" PIP_CACHE_DIR="$T/mamba/pipcache" \
  "$T/mamba/env/bin/python" -m pip install --no-input "$T/repos/harmony-gdal_v0.0.3" xarray h5netcdf pytest

# 4. synthetic granules, service recipes, checks
env -i PATH="$T/mamba/env/bin:/usr/bin:/bin" HOME="$T/mamba/home" TMPDIR="$T/mamba/tmp" "$T/mamba/env/bin/python" -I scripts/make_mock_gcov.py "$T/mock/h5"
env -i PATH="$T/mamba/env/bin:/usr/bin:/bin" HOME="$T/mamba/home" TMPDIR="$T/mamba/tmp" "$T/mamba/env/bin/python" -I scripts/run_service_recipes.py "$T/mock/h5" "$T/mock/out"
env -i PATH=/usr/bin:/bin HOME="$T/mamba/home" TMPDIR="$T/mamba/tmp" "$T/mamba/env/bin/python" -I scripts/check_service_outputs.py mock/h5 mock/out
env -i PATH=/usr/bin:/bin HOME=/nonexistent venv_fresh/bin/python -I scripts/cog_validate.py "mock/out/*/*20260913*.tif"
```

What step 3 printed: `python 3.14.10`, `GDAL 3.13.3 3.13.3`, `harmony_gdal_adapter 0.0.3`,
`harmony-service-lib 3.0.0`, `kcl-lib 0.13.2`, `driver HDF5 True`, `driver netCDF True`, `driver COG True`,
`driver GTiff True`. The agents always pointed `HOME` at a writable folder, and a `.kcl` folder (from the
recipe library `kcl-lib`) appeared in it, so keep `HOME` writable when running the service code.

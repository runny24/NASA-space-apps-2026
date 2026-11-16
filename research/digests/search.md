# Recovered digest, topic "search": finding NISAR granules (raw CMR, asf_search, earthaccess)

Recovered on 2026-11-14 from an interrupted verification run of 2026-11-13/14. This digest reports only what
the saved outputs, scripts and transcript tool results show. Nothing was re-run to write it: only local reads
of saved files, plus one offline regex check that is labelled where it appears.

Paths used below

- `S` = `<scratch>/verify/search`
- `T` = `<transcripts>/wf_0472d927-435`
- Brief = `<prehackathon-repo>/research/BUILD_PROMPT.md`

`S` is under `/private/tmp` and can disappear on reboot or cleanup. All code that ran is therefore reproduced
verbatim in Section 5 and in the Appendix of this file.

Evidence labels: **[ran]** = a saved output or transcript tool result shows it being run and what it printed;
**[docs]** = read in documentation, a package registry or installed package source, not executed;
**[belief]** = asserted with no evidence found.

---

## 0. What was being checked, and how far it got

**Task given to the agents** (identical prompt in all three attempts; md5 of the prompt text matches): "confirm,
by running code, how to discover NISAR L2 GCOV granules for a study area in Python": asf_search, earthaccess,
raw CMR with pagination, pitfalls. No Earthdata Login credentials were available. Ground truth supplied to
them: at lon 104.05, lat 12.95 (Tonle Sap), stack `083_A_008` has exactly 11 GCOV granules, 2026-06-19 to
2026-10-29, 10 provisional and 1 validated.

**The agents were not given the brief.** They never saw Section 4.5, sketch D1 or `research/nisar_coverage.py`,
and ran none of them (a search of all three transcripts for `nisar_coverage`, `nisarPasses`, `BUILD_PROMPT`
and `collection_concept_id=` finds nothing; no file anywhere under the `verify/` scratch tree contains
`nisarPasses`). What this digest says about D1 and the brief is a comparison of their text against the
evidence these agents produced.

| Attempt | Transcript | UTC window (2026-11-14) | What it did |
|---|---|---|---|
| 1 | `T/agent-a5ca7b63565253c54.jsonl` | 01:38 to 01:46 | Built `S/venv`, read library source, wrote the first probes (`cmr_probe_01..03`, `asf_explore_01..03`, `ea_explore_01..02`). Outputs now in `S/out/prev_attempt/`. |
| 2 | `T/agent-aa08b10c271190d31.jsonl` | 02:41 to 03:07 | Did nearly all the work: every exploration script, the four `final_*` snippets, the three-path cross-check, access and browse probes, docs fetch, several one-off `curl` probes that exist only in the transcript. Outputs in `S/out/`. |
| 3 | `T/agent-aab06713c434836e1.jsonl` | 07:41 to 08:03 | Built a fresh venv (`S/venv_fresh`), re-ran every script (outputs in `S/out2/`; the four final snippets and the cross-check printed byte-identical output to attempt 2), added seven checks (`extra_checks`, `asf_constants`, `asf_polarization_check`, `pending_acquisition_check`, `partial_frame_point_check`, `untested_search_part_check`, `fetch_docs`). It was collecting quote lines for its report when it was cut off. |

All three ended on the session usage limit ("You've hit your 5-hour limit"). **No transcript contains a final
report or any assistant prose**: the only text block in each is the limit message. Everything below comes
from saved outputs and tool results. Nothing behind Earthdata Login was tested.

Local time on that machine is America/Chicago (UTC-6): file times such as "Nov 13 20:46" are 02:46 UTC on
14 November.

---

## 1. Bottom line for the builder

1. **Discovery needs no login and three independent paths agree exactly.** Raw CMR, `asf_search` 14.1.0 and
   `earthaccess` 0.19.0 returned the same 11 granule names for the ground-truth stack. Use raw CMR as the
   canonical path (no dependency, server-side filters on `STACK_ID` and `FULL_FRAME`).
2. **A point query does not give one granule per pass.** Expect up to four kinds of extra rows: partial-frame
   granules, the same acquisition in two maturity collections, re-issued copies with a higher counter, and
   mode variants (same stack and start second, different bandwidth or polarization). Section 4 gives the
   complete selection rule.
3. **In the browser use `granules.json`; in Python use `granules.umm_json`.** `granules.json` is gzip-compressed
   by CMR (roughly 1 KB per granule on the wire) but carries no additional attributes, so stack, mode,
   polarization, coverage, version and counter must be parsed from the granule name. `granules.umm_json` has
   every attribute but is about 30 KB per granule and is never compressed.
4. **Always send `page_size`** (the default is 10) and stop paging on a short page.
5. **The catalogue is still filling in.** Validated GCOV grew by 626 granules in five hours overnight, and the
   2026-11-10 pass over Tonle Sap had no GCOV yet at 07:57 UTC on 14 November. Query pass dates at build
   time; do not hard-code them.
6. **A login test must be a ranged GET.** `HEAD` and `fsspec` `fs.info()` on the `.h5` URL succeed with no
   credentials at all.
7. **A stale `EARTHDATA_TOKEN` breaks even searching** once `earthaccess.login()` has been called, and the
   default `earthaccess.login()` blocks on a keyboard prompt when no credentials are found.

---

## 2. Facts

### 2.1 Versions and environment

- **F1 [ran]** `pip install asf_search earthaccess` on Python 3.12.2 (macOS arm64) installed `asf_search`
  14.1.0 and `earthaccess` 0.19.0, both the latest on PyPI on 2026-11-14. `earthaccess` 0.19.0 declares
  `requires_python >=3.12`; `asf_search` 14.1.0 declares `>=3.10`. Neither installs `h5py`.
  Evidence (transcript attempt 3, row 301): `earthaccess latest on PyPI: 0.19.0 | requires_python: >=3.12 | 0.19.0 uploaded: 2026-09-04T00:37:55.801734Z` and
  `asf_search latest on PyPI: 14.1.0 | requires_python: >=3.10 | 14.1.0 uploaded: 2026-10-14T17:59:05.338197Z`.
  Full freeze (39 packages, identical in two independent installs): `S/logs/pip_freeze_venv_fresh.txt`,
  reproduced in Section 6.6.

### 2.2 The three discovery paths

- **F2 [ran]** All three paths work with no login and return identical results for the ground truth.
  Evidence `S/out2/crosscheck.txt`: `identical name sets across asf_search / earthaccess point / earthaccess bbox / raw CMR: True`,
  all seven `ground truth check` lines `PASS`, `earthaccess logged in: False`. The scripts were run under
  `env -i` with an empty `HOME`, so no `.netrc` or `EARTHDATA_*` variable could have been picked up
  (`S/run_fresh.sh`).
- **F3 [ran]** Raw CMR call that ran (Python stdlib, `S/scripts/final_cmr_stdlib.py`):
  `GET https://cmr.earthdata.nasa.gov/search/granules.umm_json?short_name[]=NISAR_L2_GCOV_BETA_V1&short_name[]=NISAR_L2_GCOV_PROVISIONAL_V1&short_name[]=NISAR_L2_GCOV_V1&attribute[]=string,STACK_ID,083_A_008&temporal=2026-06-01T00:00:00Z,2026-11-13T23:59:59Z&sort_key=start_date&page_size=200`
  plus either `&point=104.05,12.95` or `&attribute[]=string,FULL_FRAME,TRUE`. Output
  (`S/out2/final_cmr_stdlib.txt`): `STACK_ID alone : 33 granules (full + partial frames)`,
  `STACK_ID + point : 11 granules`, `STACK_ID + FULL_FRAME=TRUE : 11 granules`,
  `point and FULL_FRAME give the same set: True`. Brackets and commas were sent percent-encoded by
  `urllib.parse.urlencode` (`short_name%5B%5D=...`, `point=104.05%2C12.95`) and also literally with `curl -g`;
  both forms worked.
- **F4 [ran]** CMR refuses a granule query that names no collection. `point` alone, `attribute[]` alone and
  `granule_ur` alone each return HTTP 400:
  `{"errors":["The CMR does not allow querying across granules in all collections. To help optimize your search, you should limit your query using conditions that identify one or more collections, such as provider, provider_id, concept_id, collection_concept_id, short_name, version or entry_title. ..."]}`.
  `provider=ASF` is enough (`granule_ur=<name>&provider=ASF` gives HTTP 200; `provider=ASF&attribute[]=string,STACK_ID,083_A_008`
  gives 147 hits spread over the NISAR product types of that stack: RSLC, GSLC, GCOV and others). Evidence:
  transcript attempt 2 row 296; `S/out/prev_attempt/headers_probe.txt` (`cmr-hits: 147`).
- **F5 [ran]** `asf_search` call that ran and returned exactly the 11 (`S/scripts/final_asf_search.py`):
  `asf.search(dataset=asf.DATASET.NISAR, processingLevel=asf.PRODUCT_TYPE.GCOV, productionConfiguration=asf.PRODUCTION_CONFIGURATION.PRODUCTION, frameCoverage="FULL", intersectsWith="POINT(104.05 12.95)", start="2026-06-01T00:00:00Z", end="2026-11-13T23:59:59Z", relativeOrbit=83, frame=8, flightDirection=asf.FLIGHT_DIRECTION.ASCENDING)`.
  One call spans beta, provisional and validated. Results come back newest first. `asf.search_count(...)`
  answers in 0.1 s. Property names are in Section 6.3.
- **F6 [ran]** `earthaccess` call that ran and returned exactly the 11 after a client-side `FULL_FRAME` filter
  (`S/scripts/final_earthaccess.py`):
  `earthaccess.search_data(short_name=["NISAR_L2_GCOV_BETA_V1","NISAR_L2_GCOV_PROVISIONAL_V1","NISAR_L2_GCOV_V1"], point=(104.05, 12.95), temporal=("2026-06-01","2026-11-13"), granule_name="NISAR_L2_PR_GCOV_*_083_A_008_*")`.
  A list of short names works (a tuple does not). Results come back oldest first. Links:
  `g.data_links(access="external")` (HTTPS), `g.data_links(access="direct")` (S3), `g.dataviz_links` (browse,
  HTTPS and S3 mixed), `g.size` (a property, MB of all files: `1826.3`), `g.get_s3_credentials_endpoint()`.
  It paginates by itself: `search_data() returned 2492 granules (2492 unique) in 8.7s` (`S/out2/extra_checks.txt`).
- **F7 [ran]** `earthaccess` has no keyword for CMR additional attributes (`attribute=` raises
  `ValueError: Unknown key attribute`), but the query builder accepts them injected as a list:
  `q = earthaccess.granule_query().short_name([...]).temporal(...).sort_key("start_date"); q.params["attribute"] = ["string,STACK_ID,083_A_008", "string,FULL_FRAME,TRUE"]`
  then `q.hits()` gives 11 and `q.get_all()` returns the same `DataGranule` objects
  (`S/out2/final_earthaccess_attribute_filter.txt`: `hits: 11`).

### 2.3 Raw CMR behaviour

- **F8 [ran]** Pagination (`S/out2/cmr_probe_05_pagination.txt`):
  - no `page_size`: `HTTP 200 | CMR-Hits=33 | items returned=10`. The default page is 10 items.
  - `page_size=2000` works; `page_size=2001 -> HTTP 400 | body={"errors": ["page_size must be a number between 0 and 2000"]}`.
  - `CMR-Search-After` is returned on every non-empty page, including the last one
    (`page 4: HTTP 200 | items=3 | CMR-Hits=33 | CMR-Search-After=["asf",1793313424000,4407888022]`); the next
    request returns `items=0` and no header. Stop on a short page to save that request.
  - `page_num=1..4` returns the same 33 in the same order (`same order as search-after walk: True`) and needs
    no request header.
  - `page_num` together with the header: `HTTP 400 ... "page_num is not allowed with search-after"`.
  - a header from one query sent with a different sort: `HTTP 400 ... "search_after has 3 value(s) but sort has 2."`
  - a 487-granule walk at `page_size=200` took 2.4 s with no duplicates (`total=487 unique=487 in 2.4s`).
  - default order equals `sort_key=start_date` (oldest first); `sort_key=-start_date` reverses it.
  - `page_size=0` returns only the count: `cmr-hits: 480`, 33 bytes, 0.18 s (transcript attempt 2 row 383).
- **F9 [ran]** In Python, read CMR headers through the response object, not a plain dict. Header names arrive
  lower-case: `r.headers.get('CMR-Hits')` gives `3`, `dict(r.headers).get('CMR-Hits')` gives `None`
  (`S/out2/cmr_probe_04_umm_detail.txt`, first lines). This is why the early probe printed `CMR-Hits=None`.
- **F10 [ran]** CORS headers are present on CMR when a request carries an `Origin` header:
  `CMR granules.umm_json: HTTP 200 | Access-Control-Allow-Origin=* | Access-Control-Expose-Headers=CMR-Hits, CMR-Request-Id, X-Request-Id, CMR-Scroll-Id, CMR-Search-After, CMR-Timed-Out, ...`
  (`S/out2/extra_checks.txt`). So a script can read `CMR-Hits` and `CMR-Search-After`. This was observed with
  `urllib` and `curl`, not inside a real browser, and no preflight (`OPTIONS`) request was tried.
- **F11 [ran]** Size on the wire (transcript attempt 2 rows 383 and 387). For the same 11 granules:
  `umm_json` 329,882 bytes with no `content-encoding` even when `Accept-Encoding: gzip, br` was sent;
  `json` 15,426 bytes with `content-encoding: gzip`. For a 200-granule page: `umm_json` 5,916,913 bytes with or
  without `Accept-Encoding: gzip`; `json` 4,960,203 bytes uncompressed and 110,951 bytes gzipped.
- **F12 [ran]** Shape of a `granules.json` entry (`S/downloads/cmr_json/stack_full.json`, 11 entries, fetched
  with `curl -g --compressed`; one entry is reproduced in Section 6.2). Keys: `title`, `time_start`
  (`2026-10-17T22:36:33.000Z`), `time_end`, `polygons` (`[["lat lon lat lon ..."]]`), `granule_size` (a string,
  MiB of all files of the granule: `1826.3494901657104` for a 1,900,019,712-byte `.h5`),
  `collection_concept_id`, `id`, `producer_granule_id`, `updated`, `links`. There are **no additional
  attributes** in this format. `links` of one entry: 14 with `rel` ending `browse#` (7 HTTPS PNGs and their 7
  `s3://` twins), 32 `metadata#`, 1 `s3#`, 2 `documentation#`, and **3 ending `data#`, of which only one is
  the `.h5`**; the other two are collection-level links flagged `"inherited": true`
  (`https://search.asf.alaska.edu/` and an Earthdata Search URL).
- **F13 [ran]** UMM-G additional attributes on every GCOV granule (`S/out2/cmr_probe_04_umm_detail.txt`):
  `STACK_ID` (`083_A_008`), `TRACK_NUMBER`, `FRAME_NUMBER`, `ASCENDING_DESCENDING`, `FULL_FRAME` (`TRUE`/`FALSE`),
  `PRODUCTION_PIPELINE` (`PR`), `PRODUCT_TYPE` (`GCOV`), `FREQUENCIES`, `FREQUENCY_A_POLARIZATION` (list),
  `FREQUENCY_A_POLARIZATION_CONCAT` (`HH+HV`), `FREQUENCY_A_RANGE_BANDWIDTH`, the same three for `FREQUENCY_B`,
  `RANGE_BANDWIDTH_CONCAT` (`20+5`), `JOINT_OBSERVATION`, `ORBIT_TYPE` (`MOE`), `PROCESSING_CENTER`,
  `PROCESSING_LEVEL`, `PRODUCT_TYPE_DESC`, `PRODUCT_VERSION`. The CRID (`P05023`) and counter are under
  `DataGranule.Identifiers`. `STACK_ID` and `FULL_FRAME` were used directly as raw `attribute[]` filters with
  GET. `asf_search` filters on the others by POSTing them to the same endpoint, so they are usable as raw
  filters too: `attribute[]=int,TRACK_NUMBER,83`, `attribute[]=int,FRAME_NUMBER,8`,
  `attribute[]=string,ASCENDING_DESCENDING,ASCENDING`, `attribute[]=string,PRODUCT_TYPE,GCOV`,
  `attribute[]=string,PRODUCTION_PIPELINE,PR`, `attribute[]=string,FREQUENCY_A_POLARIZATION_CONCAT,HH+HV`,
  `attribute[]=string,RANGE_BANDWIDTH_CONCAT,20+5` (the translated query is printed in
  `S/out2/asf_explore_02.txt`; the mapping table is `asf_search/CMR/field_map.py`, read in transcript attempt 2).

### 2.4 Duplicates, partial frames, urgent response

- **F14 [ran]** Partial frames. Stack `083_A_008` has three GCOV granules on every date
  (`S/out2/cmr_probe_01.txt`, query A, 33 items): one full-frame mixed-mode granule at 20+5 MHz
  (`..._2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001`, 1.90 GB, latitude 11.46 to 14.14) and two
  partial-frame single-mode granules at 40+5 MHz covering the southern and northern strips
  (`..._4005_DHDH_A_20261017T223633_20261017T223641_..._N_P_J_001`, 1.91 GB, latitude 11.46 to 12.53;
  `..._4005_DHDH_A_20261017T223704_20261017T223708_..._N_P_J_001`, 1.18 GB, latitude 13.30 to 14.14).
  A point filter removes partial granules only when the point lies outside them
  (`S/out2/partial_frame_point_check.txt`): at lon 104.05, lat 12.95 `CMR-Hits=11 FULL_FRAME={'TRUE': 11}`; at
  lon 104.3, lat 12.0 `CMR-Hits=22 FULL_FRAME={'FALSE': 11, 'TRUE': 11}`. Adding
  `attribute[]=string,FULL_FRAME,TRUE` (or `frameCoverage='FULL'` in `asf_search`) gives 11 in both places.
- **F15 [ran]** The same acquisition can sit in two maturity collections.
  Beta and provisional: `distinct acquisitions: 520 | acquisitions returned more than once: 138`,
  `duplicate groups by collection mix: {('BETA_V1', 'PROVISIONAL_V1'): 137, ('BETA_V1', 'BETA_V1'): 1}` for a
  California box, November 2025 to January 2026 (`S/out2/asf_explore_05.txt`). The names differ only in the
  version field (`..._X05010_N_F_J_001` and `..._P05023_N_F_J_001`).
  Provisional and validated overlap on the hand-over day: 117 acquisitions with start times between
  2026-10-21 17:07 and 20:37 UTC are in both collections (`S/out2/misc_checks_2.txt`:
  `distinct (stack, start, full_frame, bandwidth): 4055 | present in BOTH collections: 117`).
  None of this affects the Tonle Sap test point.
- **F16 [ran]** Two more kinds of "twice" inside one collection.
  (a) Re-issued copies that differ only in the counter:
  `NISAR_L2_PR_GCOV_006_149_A_022_4005_DHDH_A_20251202T123652_20251202T123723_X05010_N_F_J_001` and `..._002`
  (`S/out2/cmr_probe_03_duplicates.txt`).
  (b) Mode variants: 7 of 480 acquisitions in a South-East Asia box in October 2026 have two production
  granules with the same stack, start second and coverage flag, same collection, same version, counter 001,
  but a different mode or polarization, for example
  `..._033_062_D_079_2005_SHSH_M_20261016T121922_20261016T121957_P05023_N_F_J_001` (HH only) and
  `..._033_062_D_079_2005_QPDH_A_20261016T121922_20261016T121956_P05023_N_F_J_001` (quad-pol), both flagged
  full frame, with stop times 1 to 8 seconds apart; and one partial pair `2005_DHDH_M` plus `4005_DHDH_A`.
  `S/out2/asf_explore_07.txt`: `n = 487 | distinct keys: 480 | keys with >1 granule: 7` and
  `with stopTime + rangeBandwidth in the key, keys with >1 granule: 0`.
- **F17 [ran]** Urgent-response GCOV products are in a separate collection, `NISAR_UR_L2`
  (`C2887502657-ASF`, 2,147 GCOV-typed granules), named `NISAR_L2_UR_GCOV_..._P05023_F_F_J_001`, orbit type
  `FOE`, served from a different path
  (`https://nisar.asf.earthdatacloud.nasa.gov/NISAR-UR/UR_L2_L_GCOV/<granule>/<granule>.h5`). They only appear
  through `asf_search` when `dataset=NISAR` and `processingLevel=GCOV` are used with no maturity or short-name
  filter: `collections={'NISAR_UR_L2': 32, 'NISAR_L2_GCOV_V1': 149, 'NISAR_L2_GCOV_PROVISIONAL_V1': 338}`,
  `UR acquisitions: 22 | of which also present as a PR granule: 20` (`S/out2/asf_explore_06.txt`). Any one of
  `productionConfiguration='PR'`, `dataMaturity=['BETA','PROVISIONAL','VALIDATED']` or
  `shortName=[three GCOV names]` removes them (each gives `n=487 ... productionConfiguration={'PR': 487}`).
  Raw CMR and `earthaccess` queries by the three GCOV short names or concept ids never return them.
- **F18 [docs]** `https://nisar-docs.asf.alaska.edu/urgent-response/` (saved as
  `S/docs_fetched/nisar_urgent-response.html`): "most standard NISAR products are not made available until
  36-72 hours after data acquisition"; urgent-response Level 2 products take about 6 hours; they "use
  lower-quality orbit ephemeris files" and have no ionospheric or tropospheric correction; "UR products are
  retained in the archive for 30 days, after which only the PR products will be available."
- **F19 [ran]** Polarization really does alternate between dates of one stack. The descending stack at the
  same point, `148_D_082`, has 11 dates of which 6 are `DHDH` (HH+HV) and 5 are `SHSH` (HH only: 07-06, 08-23,
  09-16, 10-10, 11-03) (`S/out2/cmr_probe_01.txt`, query C; `S/out2/asf_explore_03.txt`:
  `mainBandPolarization='HH', point only ... n=5`).

### 2.5 State of the archive

- **F20 [ran]** Collection extents from CMR at 2026-11-14 07:48 UTC (`S/out2/cmr_probe_02.txt`):
  `NISAR_L2_GCOV_BETA_V1: hits=23527 earliest=2025-10-12T18:25:08.000000Z latest=2026-01-20T15:59:30.000000Z`,
  `NISAR_L2_GCOV_PROVISIONAL_V1: hits=163672 earliest=2025-10-29T11:11:30.000000Z latest=2026-10-21T20:37:40.000000Z`,
  `NISAR_L2_GCOV_V1: hits=14692 earliest=2026-10-21T17:07:21.000000Z latest=2026-11-11T23:35:57.000000Z`.
  Version strings seen: `X05009`, `X05010` (beta), `P05023` (provisional, and urgent response), `P05036`
  (validated).
- **F21 [ran]** The archive is still filling. Between 02:46 and 07:48 UTC on 14 November validated GCOV went
  from 14,066 to 14,692 granules (`S/out/cmr_probe_02.txt` against `S/out2/cmr_probe_02.txt`) and the
  South-East Asia October box from 480 to 487. At 2026-11-14T07:57:22Z the 2026-11-10 pass of track 83 over
  the test point existed only as raw Level 0B; the newest GCOV was still 2026-10-29
  (`S/out2/pending_acquisition_check.txt`). Latency from `S/out2/misc_checks_2.txt`: acquired
  2026-10-17T22:36:33, produced 2026-10-19T21:40:01, in CMR 2026-10-19T21:46:19 (about two days); acquired
  2026-10-29T22:36:34, produced 2026-11-10T23:32:13 (twelve days, across the production pause).

### 2.6 Library traps that return nothing or the wrong thing without an error

- **F22 [ran]** `asf_search` 14.1.0 (`S/out2/asf_explore_04.txt`, `asf_explore_05.txt`, `asf_explore_08.txt`,
  `extra_checks.txt`, `asf_polarization_check.txt`):
  - `relativeOrbit` and `frame` are only translated to NISAR's `TRACK_NUMBER` and `FRAME_NUMBER` when the call
    also names NISAR through `dataset`, `platform` or `shortName`. With `collections=<three concept ids>` the
    translated query shows `int,PATH_NUMBER,83` and `int,CENTER_ESA_FRAME,8`, and either one makes the result
    `n=0` (`collections=` with `asfFrame=8` alone gives 11). `processingLevel='GCOV'` with `relativeOrbit=83,
    frame=8` and no dataset also gives `n=0`; the same call with `asfFrame=8` gives 11.
  - `flightDirection='A'` gives `n=0`; `'ascending'` works.
  - `polarization='HH+HV'` gives `n=0` for NISAR; use `mainBandPolarization=asf.POLARIZATION.HH_HV`. The result
    property `polarization` is `None` on all 519 results, as are `centerLat`, `centerLon`, `md5sum`.
  - a date-only `end` means midnight at the start of that day: `end='2026-10-29'` sent
    `2026-06-01T00:00:00Z,2026-10-29T00:00:00Z,` and returned 10 instead of 11. A UTC offset in the string is
    dropped, not converted (`'2026-06-01T00:00:00+07:00'` was sent as `2026-06-01T00:00:00Z`).
  - a point with latitude and longitude swapped is silently clamped (`'CLAMP': 'Clamped 1 value(s) to +/-90 latitude'`,
    a warning only) and returns 0.
  - `dataset=NISAR` with no `processingLevel` returned 4,086 items at the point, 3,961 of them `ASF_ECMWF_SMST`
    ancillary files; `dataset=asf.DATASET.NISAR_SCIENCE_PRODUCTS` returned 125.
  - `asf.REPORT_ERRORS` defaults to `True`: on a CMR error the package posts the search options and user agent
    to `search-error-report.asf.alaska.edu` ([docs], `asf_search/search/error_reporting.py`). The scripts set
    it to `False`.
- **F23 [ran]** `earthaccess` 0.19.0 (`S/out2/ea_explore_01.txt`, `ea_explore_03.txt`, `extra_checks.txt`):
  - a date-only `temporal` end is inclusive: `('2026-06-01','2026-10-29')` is sent as
    `2026-06-01T00:00:00Z,2026-10-29T23:59:59Z` and returns 11. This is the opposite of `asf_search`.
  - `short_name="NISAR_L2_GCOV*"` returns 0 with no error (no wildcard support).
  - `short_name=tuple(...)` raises `TypeError: DataGranules.short_name() takes 2 positional arguments but 4 were given`.
  - a clockwise polygon raises
    `RuntimeError: {"errors":["The polygon boundary points are listed in the wrong order. Points must be provided in counter-clockwise order."]}`
    (`asf_search` repairs winding itself and only warns).
  - `point` without a collection filter raises
    `RuntimeError: Spatial parameters must be accompanied by a collection filter (ex: short_name or entry_title).`
  - `earthaccess.open([], access="s3")` raises `TypeError: open() got an unexpected keyword argument 'access'`:
    that keyword is described only in the "latest" documentation, not in release 0.19.0. The "stable"
    documentation matches 0.19.0.
  - [docs] no `timeout` is passed on its search requests (`earthaccess/utils/_search.py`, `earthaccess/search.py`).

### 2.7 Where login starts

- **F24 [ran]** Without login, in `earthaccess` 0.19.0 (`S/out2/ea_explore_02.txt`): searching and all link
  accessors work; `earthaccess.open([g])` raises `AttributeError: 'NoneType' object has no attribute 'open'`;
  `earthaccess.get_fsspec_https_session()` raises `AttributeError: 'NoneType' object has no attribute 'get_fsspec_session'`;
  `earthaccess.download(...)` prints `You must call earthaccess.login() before you can download data` and
  returns `[]`; `login(strategy='environment')` and `login(strategy='netrc')` raise `LoginStrategyUnavailable`
  at once; plain `earthaccess.login()` prints `Enter your Earthdata Login username:` and, with stdin closed,
  dies with `EOFError: EOF when reading a line`.
- **F25 [docs]** Login methods in `earthaccess` 0.19.0 (`earthaccess/api.py` and `auth.py`, quoted in transcript
  attempt 3 rows 165 and 169): `strategy="environment"` reads `EARTHDATA_TOKEN`, or `EARTHDATA_USERNAME` and
  `EARTHDATA_PASSWORD` ("specifying a token takes precedence"); `strategy="netrc"` reads `~/.netrc` (`~/_netrc`
  on Windows) "or from the file specified by the `NETRC` environment variable", line format
  `machine urs.earthdata.nasa.gov login <username> password <password>`; the default `strategy="all"` tries
  `environment`, then `netrc`, then `interactive`. With a username and password it fetches a bearer token from
  `https://urs.earthdata.nasa.gov/api/users/find_or_create_token`.
- **F26 [ran]** A wrong or expired `EARTHDATA_TOKEN` is not detected at login and then breaks searching
  (`S/out2/ea_explore_04_dummy_token.txt`): `search before login -> 3 granules`;
  `login(strategy='environment') returned in 1.2s; authenticated = True`;
  `search after login attempt raised RuntimeError: {"errors":["Token does not exist"]}`.
- **F27 [ran]** What is public and what is not, for one granule (`S/out2/access_probe.txt`,
  `S/out2/browse_probe.txt`, `S/out2/extra_checks.txt`, transcript attempt 2 row 317):
  - Public: the seven browse PNGs under `/BROWSE/`. The request answers `303` to a signed CloudFront URL
    (`cache-control: private, max-age=3540` on the redirect), then `200` or `206`;
    `access-control-allow-origin: *` on both hops when an `Origin` header is sent; content type
    `binary/octet-stream`; range requests honoured. `_LATLON.png` is 1880 x 1847 RGB, 4.2 MB;
    `_NATIVE_A_HHHH.png` is 1880 x 1840 greyscale; `_LATLON_thumbnail.png` is 100 x 100, 14,600 bytes.
  - Login required (`302` to `https://urs.earthdata.nasa.gov/oauth/authorize`): the `.h5`, `.h5.iso.xml`,
    `.rc.yaml`, every `.kml`, `_QA_REPORT.pdf`, `_QA_STATS.h5`, `_QA_SUMMARY.csv`, the `NISAR-JPL-PRIVATE-DATA`
    files and `/s3credentials`.
- **F28 [ran]** `HEAD` on the `.h5` URL succeeds with no login: `303` to CloudFront, then `200` with
  `content-length: 1900019712`, `accept-ranges: bytes`, `last-modified`, `etag` (transcript attempt 2 row 467).
  Consequently `fsspec` `fs.info(url)` returns `{'size': 1900019712, ...}` unauthenticated while
  `fs.exists(url)` returns `False` and every read fails with
  `aiohttp.client_exceptions.ClientResponseError: 401, message='Unauthorized', url='https://urs.earthdata.nasa.gov/oauth/authorize?...`
  (`S/out2/unauth_read_probe.txt`). With `requests` the final status is 401 at `urs.earthdata.nasa.gov/oauth/authorize`
  and the body starts `HTTP Bas`; with `urllib` it is `HTTPError 401` carrying
  `WWW-Authenticate: Basic realm="Please enter your Earthdata Login credentials. ..."`. A fake bearer token gets
  the same `302` as no token (transcript attempt 2 row 463).
- **F29 [docs]** `earthaccess.open(granules)` in 0.19.0 already applies tuned read settings:
  `default_cache_type = "background"` and a block size of 16 MiB for files of 1 GB or more
  (`earthaccess/store.py` lines 111 to 154, transcript attempt 3 row 179); `get_fsspec_https_session()` sends
  `Authorization: Bearer <token>` with `trust_env=False`. ASF's own NISAR page
  (`https://nisar-docs.asf.alaska.edu/earthaccess/`, saved in `S/docs2/nisar_earthaccess.html`) uses
  `fs = earthaccess.get_fsspec_https_session()` and `fs.open(url, cache_type='background', block_size=16*1024*1024)`,
  and the ASF page on `asf_search` shows a second authenticated route with no `earthaccess`:
  `fsspec.filesystem('https', client_kwargs={'auth': aiohttp.BasicAuth(user, password)})`. None of this could be
  run: no credentials.

### 2.8 Sketch D1 against this evidence

- **F30 [ran, with the comparison done offline for this digest]** D1 was never executed. Its assumptions about
  the response match the saved `granules.json` file: `feed.entry[].title`, `time_start`,
  `polygons?.[0]?.[0]` is the "lat lon ..." string, and `links[].rel` ends in `browse#` with HTTPS and `s3://`
  twins. Its name regex `/_GCOV_(\d{3})_(\d{3})_([AD])_(\d{3})_(\d{4})_(\w{4})_/` matches all 75 distinct GCOV
  granule names found in `S/out2/*.txt` (checked with Python `re` while writing this digest), including
  `0005_NADV` names and urgent-response names. What D1 lacks is listed in Section 3, correction C1.

---

## 3. Corrections to the brief

Severity: **blocks-build** (following the brief as written fails), **wrong-result** (runs but gives wrong
data or a wrong claim), **minor**. Nothing found here blocks a build.

**C1. Appendix D, sketch D1 (and the search bullet of Section 4.5): a point query is not a list of passes.
Severity: wrong-result.**
The brief presents D1 as "Pass dates at a point" and returns every CMR entry. The evidence shows a point
query can return several entries for one pass of one stack: a partial-frame granule next to the full-frame
one when the point lies in an edge strip (lon 104.3, lat 12.0: `CMR-Hits=22 FULL_FRAME={'FALSE': 11, 'TRUE': 11}`
for 11 dates, `S/out2/partial_frame_point_check.txt`); the same acquisition in both the provisional and the
validated collection on 2026-10-21 (117 acquisitions, `S/out2/misc_checks_2.txt`); and mode variants with the
same start second (7 of 480, `S/out2/asf_explore_07.txt`). A date slider built straight from D1 would show
repeated dates. D1 also cannot remove them as written, because `granules.json` carries no `FULL_FRAME`
attribute and D1's regex does not capture the coverage flag, the version or the counter. Fix: add
`attribute[]=string,FULL_FRAME,TRUE` to the query (this ran against `granules.json`: 11 entries), parse the
rest of the name, and apply the selection rule in Section 4, R3. Smaller gaps in D1: no `res.ok` check (a
CMR error is `{"errors":[...]}` with HTTP 400, so `feed` is undefined); `browse` is an array of seven PNG URLs,
so choose by suffix (`_LATLON.png`), not by position. A revised sketch, not run, is in Section 5.13.

**C2. Section 4.3, last sentence ("When the same acquisition appears twice, keep validated over provisional
over beta, then the highest counter"). Severity: wrong-result.**
The rule is right for the two cases it names, and both exist (F15, F16a). It misses a third: two production
granules of one pass in the same collection with the same version and counter 001 that differ in mode or
polarization, for example `2005_SHSH_M` (HH only) and `2005_DHDH_A` or `2005_QPDH_A`, both flagged full frame
(F16b). Applied literally the rule leaves a tie, and a tie broken arbitrarily can pick the HH-only file and
lose HV for that date. Section 4.7 of the brief describes mode changes as producing "a partial granule plus a
mixed-mode one"; the run saw that pattern (a full-frame `M` granule at the lower bandwidth plus partial `A`
granules at the higher one, every date of `083_A_008`) and also the two-full-granules pattern.

**C3. Section 4.5, search bullet ("links (those whose `rel` ends in `data#`, `s3#` or `browse#`)").
Severity: wrong-result.**
In `granules.json` three links end in `data#`. Only one is the `.h5`. The other two are collection-level
links marked `"inherited": true` (`https://search.asf.alaska.edu/` and
`https://search.earthdata.nasa.gov/search/granules?p=C2854338529-ASF`). Filter with `!l.inherited` or require
the `.h5` suffix. The `browse#` links are 14: seven HTTPS and seven `s3://`. Evidence:
`S/downloads/cmr_json/stack_full.json`.

**C4. Section 10 step 3 and Section 4.5 ("Without login the data URL redirects to a sign-in page").
Severity: wrong-result if the login test is written with HEAD.**
True for `GET` (302 to `urs.earthdata.nasa.gov/oauth/authorize`, ending in 401). But `HEAD` on the same URL
succeeds with no credentials and returns the real `content-length`, and `fsspec` `fs.info(url)` therefore
"works" unauthenticated (F28). The "one small authenticated request" of step 3 must be a ranged `GET` that
reads bytes. Also, `.kml`, QA and metadata files need login too; only `/BROWSE/` PNGs are public.

**C5. Section 4.5 ("Without `productionConfiguration='PR'` you also get urgent-response duplicates").
Severity: minor.**
Only when the `asf_search` call has neither `dataMaturity` nor `shortName`. The brief's own example passes
`dataMaturity='PROVISIONAL'`, which already excludes the urgent-response collection
(`dataMaturity=['BETA','PROVISIONAL','VALIDATED']` gave `productionConfiguration={'PR': 487}`,
`S/out2/asf_explore_06.txt`). Urgent-response products are a separate collection (`NISAR_UR_L2`) that raw CMR
and `earthaccess` queries on the GCOV collections cannot return. Keeping `productionConfiguration='PR'` is
harmless.

**C6. Section 4.5, `asf_search` example. Severity: minor.**
The example was not run verbatim, but every keyword in it was exercised and accepted. As written
(`dataMaturity='PROVISIONAL'`) it returns the 10 provisional dates for Tonle Sap, not the 11 in Appendix A:
the 2026-10-29 pass is in the validated collection (`dataMaturity=['PROVISIONAL']` gave `n=10`,
`['VALIDATED']` gave `n=1`, `S/out2/asf_explore_03.txt`). It also has no `frameCoverage='FULL'`, so at a point
inside a partial-frame strip it returns two granules per date. The call depends on `dataset=` being present:
without it `frame=8` silently matches nothing (F22).

**C7. Section 4.5, "Page with the `CMR-Search-After` response header". Severity: minor.**
Correct. Add: the default `page_size` is 10; the header is present even on the last non-empty page, so end
on a short page; the header value must be sent back with the identical query; in a browser, sending it is a
custom request header and that preflight was not tested, whereas `page_num` paging needs no header and
returned the same rows in the same order (F8).

**C8. Section 4.5, `granule_size`. Severity: minor.**
In `granules.json` it is a string in MiB summed over every file of the granule (`"1826.3494901657104"` for a
1,900,019,712-byte `.h5` plus PNGs, QA files and metadata), the same number as `earthaccess` `g.size`. For
the size of the `.h5` alone use `SizeInBytes` of the entry named `<granule>.h5` in
`umm.DataGranule.ArchiveAndDistributionInformation` (as `nisar_coverage.py` and the final snippets do).

**C9. Section 4.5, authentication. Severity: minor.**
All three credential routes named in the brief are real ([docs], F25). Add: (a) plain `earthaccess.login()`
falls through to a keyboard prompt, so unattended jobs must pass `strategy="environment"` or
`strategy="netrc"`; (b) a bad `EARTHDATA_TOKEN` is accepted silently and then every CMR search made through
`earthaccess` fails with `Token does not exist` (F26).

**C10. Section 4.5, access option 1 (`cache_type="blockcache"`, `block_size=8*1024*1024`). Severity: minor,
[docs] only.**
`earthaccess.open(granules)` in 0.19.0 already uses `cache_type="background"` with 16 MiB blocks for files of
1 GB or more, and ASF's NISAR page uses the same two values with `get_fsspec_https_session()`. The slow
default the brief warns about is bare `fs.open(url)` with no arguments. Not run: no credentials.

**C11. Section 4.1 table and Section 4.3 name fields. Severity: minor.**
The earliest beta GCOV in CMR starts 2025-10-12T18:25:08Z, not 2025-10-17. Provisional and validated are not
cleanly split at 2026-10-21: provisional runs to 20:37:40 UTC that day and validated starts at 17:07:21 UTC,
with 117 acquisitions in both. Polarization codes seen beyond those the brief lists: `DV` (VV+VH), as in
`0005_NADV`; the data guide also defines `SV`, `CL`, `CR`. Urgent-response names use version `P05023` with
orbit flag `F`.

**C12. Section 6.1 environment, and the version line of Section 4.5. Severity: minor.**
`earthaccess` 0.19.0 requires Python 3.12 or newer. On a teammate's Python 3.10 or 3.11, `pip install earthaccess`
will resolve to an older release whose behaviour was not checked here. The known laptop (Python 3.12) is fine.

**C13. Appendix A and `research/nisar_coverage.py`. Severity: minor.**
Only the Tonle Sap row was re-verified (11 dates, 2026-06-19 to 2026-10-29, HH+HV, 20+5 MHz, 1.85 to 1.90 GB:
confirmed by all three paths). The script itself was not run by these agents. Reading it against the
evidence: its paging loop and header access are correct, but it applies no `FULL_FRAME` filter, so for a
point inside a partial-frame strip the `pol`, `bw`, `releases` and median-size fields of a stack blend
partial and full granules (the date count stays right because dates are a set). The Tonle Sap count will
become 12 when the 2026-11-10 pass is published.

---

## 4. Recommendations

**R1. Canonical discovery in the pipeline: raw CMR `granules.umm_json`, filtered server-side.**
Query the three GCOV short names with `attribute[]=string,STACK_ID,<stack>` and
`attribute[]=string,FULL_FRAME,TRUE`, `sort_key=start_date`, explicit `page_size`, paging as in
`final_cmr_stdlib.py` (Section 5.2). Why: no dependency and no login, it returns every attribute needed for
selection, and it agreed exactly with both libraries. Use `asf_search` or `earthaccess` when their objects
are wanted downstream (for example `earthaccess.open`), not for the choice of granules.

**R2. Discovery in the browser: `granules.json`, parse the name.**
Keep D1's endpoint (gzip makes it 20 to 50 times smaller than `umm_json`), add
`attribute[]=string,FULL_FRAME,TRUE`, check `res.ok`, take the release from `collection_concept_id`, and parse
mode, polarization, coverage, version and counter from `title`. A point never needs paging (22 rows at the
test point against a limit of 2000); for an area use `page_num`. Why: F11, F12, F8.

**R3. Selection rule for "one granule per pass of the chosen stack".**
1. Production only (`_PR_` in the name, or `PRODUCTION_PIPELINE=PR`). 2. Full frame only (`FULL_FRAME=TRUE`,
or `F` in the coverage position), unless the team deliberately wants a 40 MHz partial strip. 3. Group by
`STACK_ID` and the start time to the second. 4. Within a group prefer validated, then provisional, then
beta, by collection rather than by version string (validated version numbers will change). 5. Then prefer
the polarization the concept needs (`DH` or `QP` over `SH`). 6. Then the highest counter. 7. Check that the
area of interest lies inside the chosen granule's footprint polygon on every date, since two "full" variants
of one pass can differ in length. Why: F14, F15, F16.

**R4. Pin `asf_search==14.1.0` and `earthaccess==0.19.0` on Python 3.12, and list `h5py` separately.**
Why: these are the versions every result here was obtained with; 0.19.0 needs Python 3.12; neither package
installs `h5py`. The complete freeze is in Section 6.6.

**R5. `asf_search` idiom.** Always pass `dataset=asf.DATASET.NISAR` (or `shortName=[...]`) together with
`relativeOrbit` and `frame`; add `productionConfiguration=asf.PRODUCTION_CONFIGURATION.PRODUCTION` and
`frameCoverage="FULL"`; write `end` as a full timestamp (`"2026-11-13T23:59:59Z"`); sort the result yourself
(`results.sort(key=lambda p: p.properties["startTime"])`); read polarization from `mainBandPolarization`; set
`asf.REPORT_ERRORS = False`. Why: F5, F22.

**R6. `earthaccess` idiom.** Pass short names as a list; remember a date-only end is inclusive here; select a
stack with `granule_name="NISAR_L2_PR_GCOV_*_083_A_008_*_F_J_*"` (this glob ran and returns full frames only)
or with the injected attribute list of F7; do not call `login()` in code that only searches; in unattended
code call `earthaccess.login(strategy="netrc")` or `strategy="environment"` so a missing credential fails
immediately instead of prompting. Why: F6, F7, F23, F24.

**R7. Write the login test as a ranged read.** After `earthaccess.login(...)`, read the first eight bytes of
one `.h5` through `earthaccess.get_fsspec_https_session()` (`fs.cat_file(url, start=0, end=8)`) and require
the HDF5 signature. Without login that exact call raised `ClientResponseError: 401, message='Unauthorized'`
(observed); the success value was not observed (no credentials). Do not test with `HEAD`, `fs.info` or
`fs.exists`. Why: F28.

**R8. Prefer `~/.netrc` to a pasted token.** With a username and password `earthaccess` fetches and manages
the token itself. If `EARTHDATA_TOKEN` is used, validate it at once with one search after login, and unset a
stale one. Why: F26.

**R9. Query dates at build time and record when.** Write the chosen granule list with a "queried at" UTC
time, and re-run discovery before the final deploy. `S/scripts/pending_acquisition_check.py` shows whether a
newer acquisition is waiting for its GCOV. Why: F21. Note that `crosscheck.py` asserts "exactly 11 granules"
and will fail, correctly, once the 2026-11-10 pass is published.

**R10. Take calendar dates from the UTC start time** (`time_start.slice(0, 10)`), not from a local-time
conversion: the test stack is acquired at 22:36 UTC, which is the next calendar day in Cambodia. (Inference
from the observed time format; not something the run tested.)

**R11. Link to browse images through the `nisar.asf.earthdatacloud.nasa.gov/BROWSE/...` URL, never the
CloudFront URL it redirects to.** The redirect target is signed and the redirect is cached privately for
3540 seconds. Why: F27.

**R12. Leave urgent-response products out** unless rapid response is the concept; they are lower quality
and are deleted after 30 days, so links to them will not survive judging. Why: F17, F18.

**R13. Small Python habits that avoid wrong answers:** always send `page_size`; read headers with
`resp.headers.get(...)`, never `dict(resp.headers)`; use `page_size=0` or `asf.search_count()` for counts;
give a timeout on `urllib` and `requests` calls. Why: F8, F9.

**R14. For `nisar_coverage.py`,** add `("attribute[]", "string,FULL_FRAME,TRUE")` as an option (it must then
build the query from a list of pairs, since the key repeats) or print the coverage flag per granule, before
trusting its mode and size columns for a place. Why: C13.

---

## 5. Working code, verbatim

Every script below was run with `asf_search` 14.1.0, `earthaccess` 0.19.0 and Python 3.12.2 through the
runner in 5.1, which strips the environment (`env -i`, empty `HOME`) so that no credential could be picked
up. The four `final_*` scripts and `crosscheck.py` were run in two separate virtual environments about five
hours apart and printed identical output both times. Scripts are complete and unedited; outputs are
complete unless a note says they were shortened. Sections 5.12 and 5.13 contain code that was **not** run.

### 5.1 Runner

Source: `S/run_fresh.sh` (md5 `fd4df7ed5349c60528c6bbfff2420816`). Status: **ran** (it produced every file in `S/out2/`).

````sh
#!/bin/sh
# Runs a script from scripts/ with the python of venv_fresh/ and a scrubbed environment:
#   - env -i  : no inherited variables at all (so no EARTHDATA_USERNAME / EARTHDATA_PASSWORD / EARTHDATA_TOKEN / NETRC)
#   - HOME    : an empty folder, so there is no ~/.netrc for requests / earthaccess / asf_search to pick up
# Everything the script prints (stdout + stderr) is also saved to out2/<script name>.txt
# Usage: ./run_fresh.sh scripts/final_asf_search.py
HERE="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$HERE/emptyhome" "$HERE/tmp" "$HERE/out2"
NAME="$(basename "$1" .py)"
cd "$HERE" || exit 1
env -i HOME="$HERE/emptyhome" TMPDIR="$HERE/tmp" PATH="$HERE/venv_fresh/bin:/usr/bin:/bin" \
    LANG=en_US.UTF-8 PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 \
    "$HERE/venv_fresh/bin/python" "$@" </dev/null 2>&1 | tee "$HERE/out2/$NAME.txt"
````

Usage: `./run_fresh.sh scripts/final_cmr_stdlib.py`. To reuse, point the two `venv_fresh` paths at your own environment.

### 5.2 Raw CMR, Python standard library only

#### final_cmr_stdlib.py

Source: `S/scripts/final_cmr_stdlib.py` (md5 `34040fccc912b91b925b10b54fe145e7`). Status: **ran**.

````python
"""NISAR L2 GCOV discovery straight from NASA's CMR with the Python standard library only. No Earthdata Login needed."""
import json
import urllib.parse
import urllib.request

CMR = "https://cmr.earthdata.nasa.gov/search/granules.umm_json"
GCOV_SHORT_NAMES = ["NISAR_L2_GCOV_BETA_V1", "NISAR_L2_GCOV_PROVISIONAL_V1", "NISAR_L2_GCOV_V1"]


def cmr_granules(params, page_size=200):
    """Yield every UMM-G item matching `params` (a list of (key, value) pairs), paging with CMR-Search-After.

    CMR returns only 10 items when page_size is missing and refuses page_size > 2000. To get the next page, repeat the
    identical query with the CMR-Search-After response header of the previous page sent back as a request header.
    """
    query = urllib.parse.urlencode(params + [("page_size", str(page_size))])
    search_after = None
    while True:
        headers = {"User-Agent": "nisar-hackathon-app/1.0"}
        if search_after:
            headers["CMR-Search-After"] = search_after
        with urllib.request.urlopen(urllib.request.Request(f"{CMR}?{query}", headers=headers), timeout=60) as resp:
            search_after = resp.headers.get("CMR-Search-After")  # case-insensitive here; dict(resp.headers) is not
            items = json.load(resp)["items"]
        yield from items
        if len(items) < page_size or not search_after:  # a short page is the last page
            return


def describe(item):
    """Flatten one UMM-G item into the fields a time-series app needs."""
    umm = item["umm"]
    attr = {a["Name"]: a["Values"] for a in umm["AdditionalAttributes"]}
    urls = umm["RelatedUrls"]
    name = umm["GranuleUR"]
    return {
        "name": name,
        "start": umm["TemporalExtent"]["RangeDateTime"]["BeginningDateTime"],
        "collection": umm["CollectionReference"]["ShortName"],
        "track": int(attr["TRACK_NUMBER"][0]),
        "frame": int(attr["FRAME_NUMBER"][0]),
        "direction": attr["ASCENDING_DESCENDING"][0],
        "polarization": attr.get("FREQUENCY_A_POLARIZATION", []),  # frequency A (main band); absent if the granule has none
        "bandwidth": attr["RANGE_BANDWIDTH_CONCAT"][0],            # e.g. "20+5" MHz = frequency A + frequency B
        "full_frame": attr["FULL_FRAME"][0] == "TRUE",
        "size_bytes": next(f["SizeInBytes"] for f in umm["DataGranule"]["ArchiveAndDistributionInformation"] if f["Name"] == name + ".h5"),
        "https": next(u["URL"] for u in urls if u["Type"] == "GET DATA"),
        "s3": next(u["URL"] for u in urls if u["Type"] == "GET DATA VIA DIRECT ACCESS"),
        "browse": [u["URL"] for u in urls if u["Type"] == "GET RELATED VISUALIZATION" and u["URL"].startswith("https://")],
        "footprint_lonlat": [(p["Longitude"], p["Latitude"]) for p in umm["SpatialExtent"]["HorizontalSpatialDomain"]["Geometry"]["GPolygons"][0]["Boundary"]["Points"]],
    }


base = [("short_name[]", s) for s in GCOV_SHORT_NAMES] + [
    ("attribute[]", "string,STACK_ID,083_A_008"),  # track 083, Ascending, frame 008
    ("temporal", "2026-06-01T00:00:00Z,2026-11-13T23:59:59Z"),
    ("sort_key", "start_date"),
]
stack_only = [describe(i) for i in cmr_granules(base, page_size=10)]  # small page size on purpose: 4 requests
at_point = [describe(i) for i in cmr_granules(base + [("point", "104.05,12.95")])]  # lon,lat
full_frame = [describe(i) for i in cmr_granules(base + [("attribute[]", "string,FULL_FRAME,TRUE")])]

print("STACK_ID alone              :", len(stack_only), "granules (full + partial frames)")
print("STACK_ID + point            :", len(at_point), "granules")
print("STACK_ID + FULL_FRAME=TRUE  :", len(full_frame), "granules")
print("point and FULL_FRAME give the same set:", [g["name"] for g in at_point] == [g["name"] for g in full_frame])
for g in at_point:
    print(g["start"][:19] + "Z", g["collection"], f"track={g['track']} frame={g['frame']} {g['direction']}",
          "pol=" + "+".join(g["polarization"]), "bw=" + g["bandwidth"], f"{g['size_bytes'] / 1e9:.2f} GB", g["name"])
g = at_point[-2]
print("https :", g["https"])
print("s3    :", g["s3"])
print("browse:", g["browse"][0], f"(+{len(g['browse']) - 1} more)")
print("footprint (lon, lat):", g["footprint_lonlat"])
````

What it printed (`S/out2/final_cmr_stdlib.txt`):

````text
STACK_ID alone              : 33 granules (full + partial frames)
STACK_ID + point            : 11 granules
STACK_ID + FULL_FRAME=TRUE  : 11 granules
point and FULL_FRAME give the same set: True
2026-06-19T22:36:37Z NISAR_L2_GCOV_PROVISIONAL_V1 track=83 frame=8 ASCENDING pol=HH+HV bw=20+5 1.85 GB NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223637_20260619T223711_P05023_N_F_J_001
2026-07-01T22:36:36Z NISAR_L2_GCOV_PROVISIONAL_V1 track=83 frame=8 ASCENDING pol=HH+HV bw=20+5 1.90 GB NISAR_L2_PR_GCOV_024_083_A_008_2005_DHDH_M_20260701T223636_20260701T223711_P05023_N_F_J_001
2026-07-13T22:36:36Z NISAR_L2_GCOV_PROVISIONAL_V1 track=83 frame=8 ASCENDING pol=HH+HV bw=20+5 1.85 GB NISAR_L2_PR_GCOV_025_083_A_008_2005_DHDH_M_20260713T223636_20260713T223710_P05023_N_F_J_001
2026-07-25T22:36:35Z NISAR_L2_GCOV_PROVISIONAL_V1 track=83 frame=8 ASCENDING pol=HH+HV bw=20+5 1.85 GB NISAR_L2_PR_GCOV_026_083_A_008_2005_DHDH_M_20260725T223635_20260725T223709_P05023_N_F_J_001
2026-08-18T22:36:34Z NISAR_L2_GCOV_PROVISIONAL_V1 track=83 frame=8 ASCENDING pol=HH+HV bw=20+5 1.85 GB NISAR_L2_PR_GCOV_028_083_A_008_2005_DHDH_M_20260818T223634_20260818T223708_P05023_N_F_J_001
2026-08-30T22:36:33Z NISAR_L2_GCOV_PROVISIONAL_V1 track=83 frame=8 ASCENDING pol=HH+HV bw=20+5 1.90 GB NISAR_L2_PR_GCOV_029_083_A_008_2005_DHDH_M_20260830T223633_20260830T223708_P05023_N_F_J_001
2026-09-11T22:36:33Z NISAR_L2_GCOV_PROVISIONAL_V1 track=83 frame=8 ASCENDING pol=HH+HV bw=20+5 1.90 GB NISAR_L2_PR_GCOV_030_083_A_008_2005_DHDH_M_20260911T223633_20260911T223708_P05023_N_F_J_001
2026-09-23T22:36:33Z NISAR_L2_GCOV_PROVISIONAL_V1 track=83 frame=8 ASCENDING pol=HH+HV bw=20+5 1.90 GB NISAR_L2_PR_GCOV_031_083_A_008_2005_DHDH_M_20260923T223633_20260923T223708_P05023_N_F_J_001
2026-10-05T22:36:33Z NISAR_L2_GCOV_PROVISIONAL_V1 track=83 frame=8 ASCENDING pol=HH+HV bw=20+5 1.90 GB NISAR_L2_PR_GCOV_032_083_A_008_2005_DHDH_M_20261005T223633_20261005T223708_P05023_N_F_J_001
2026-10-17T22:36:33Z NISAR_L2_GCOV_PROVISIONAL_V1 track=83 frame=8 ASCENDING pol=HH+HV bw=20+5 1.90 GB NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001
2026-10-29T22:36:34Z NISAR_L2_GCOV_V1 track=83 frame=8 ASCENDING pol=HH+HV bw=20+5 1.85 GB NISAR_L2_PR_GCOV_034_083_A_008_2005_DHDH_M_20261029T223634_20261029T223708_P05036_N_F_J_001
https : https://nisar.asf.earthdatacloud.nasa.gov/NISAR/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001.h5
s3    : s3://sds-n-cumulus-prod-nisar-products/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001.h5
browse: https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001_LATLON.png (+6 more)
footprint (lon, lat): [(105.41857, 11.99121), (104.89877, 14.13511), (102.63217, 13.59435), (103.1681, 11.45942), (105.41857, 11.99121)]
````


### 5.3 asf_search

#### final_asf_search.py

Source: `S/scripts/final_asf_search.py` (md5 `f91e2b051c46db81c7ad10668c3d466a`). Status: **ran**.

````python
"""NISAR L2 GCOV discovery with asf_search (tested with 14.1.0). Searching needs no Earthdata Login."""
import asf_search as asf

results = asf.search(
    dataset=asf.DATASET.NISAR,              # "NISAR": one call spans the Beta, Provisional and Validated collections
    processingLevel=asf.PRODUCT_TYPE.GCOV,  # "GCOV"
    productionConfiguration=asf.PRODUCTION_CONFIGURATION.PRODUCTION,  # "PR": leaves out Urgent Response copies (NISAR_UR_L2)
    frameCoverage="FULL",                   # leaves out partial-frame granules
    intersectsWith="POINT(104.05 12.95)",   # WKT, longitude first; "POLYGON((lon lat, ...))" works the same way
    start="2026-06-01T00:00:00Z",
    end="2026-11-13T23:59:59Z",             # a date-only end ("2026-11-13") means 00:00:00Z, i.e. that day is left out
    relativeOrbit=83,                       # track
    frame=8,
    flightDirection=asf.FLIGHT_DIRECTION.ASCENDING,  # "ASCENDING"
)
results.sort(key=lambda p: p.properties["startTime"])  # asf_search returns newest first

print(f"{len(results)} granules")
for p in results:
    q = p.properties
    print(
        q["startTime"],
        q["collectionName"],
        f"track={q['pathNumber']} frame={q['frameNumber']} {q['flightDirection']}",
        "pol=" + "+".join(q["mainBandPolarization"] or ["none"]),  # frequency A; q["polarization"] is always None for NISAR
        "bw=" + "/".join(q["rangeBandwidth"] or ["none"]),          # MHz, frequency A + frequency B
        q["frameCoverage"],
        f"{q['bytes'][q['fileName']]['bytes'] / 1e9:.2f} GB",
        q["sceneName"],
    )

p = next(p for p in results if "20261017T223633" in p.properties["sceneName"])
q = p.properties
print("data URL (needs Earthdata Login):", q["url"])
print("S3 URI (us-west-2 only)         :", next(u for u in q["s3Urls"] if u.endswith(q["fileName"])))
print("browse PNGs (public)            :", *q["browse"], sep="\n    ")
print("footprint GeoJSON               :", p.geometry)
print("granule concept id              :", p.meta["concept-id"], "| collection concept id:", q["conceptID"])
````

What it printed (`S/out2/final_asf_search.txt`):

````text
11 granules
2026-06-19T22:36:37Z NISAR_L2_GCOV_PROVISIONAL_V1 track=83 frame=8 ASCENDING pol=HH+HV bw=20+5 Full 1.85 GB NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223637_20260619T223711_P05023_N_F_J_001
2026-07-01T22:36:36Z NISAR_L2_GCOV_PROVISIONAL_V1 track=83 frame=8 ASCENDING pol=HH+HV bw=20+5 Full 1.90 GB NISAR_L2_PR_GCOV_024_083_A_008_2005_DHDH_M_20260701T223636_20260701T223711_P05023_N_F_J_001
2026-07-13T22:36:36Z NISAR_L2_GCOV_PROVISIONAL_V1 track=83 frame=8 ASCENDING pol=HH+HV bw=20+5 Full 1.85 GB NISAR_L2_PR_GCOV_025_083_A_008_2005_DHDH_M_20260713T223636_20260713T223710_P05023_N_F_J_001
2026-07-25T22:36:35Z NISAR_L2_GCOV_PROVISIONAL_V1 track=83 frame=8 ASCENDING pol=HH+HV bw=20+5 Full 1.85 GB NISAR_L2_PR_GCOV_026_083_A_008_2005_DHDH_M_20260725T223635_20260725T223709_P05023_N_F_J_001
2026-08-18T22:36:34Z NISAR_L2_GCOV_PROVISIONAL_V1 track=83 frame=8 ASCENDING pol=HH+HV bw=20+5 Full 1.85 GB NISAR_L2_PR_GCOV_028_083_A_008_2005_DHDH_M_20260818T223634_20260818T223708_P05023_N_F_J_001
2026-08-30T22:36:33Z NISAR_L2_GCOV_PROVISIONAL_V1 track=83 frame=8 ASCENDING pol=HH+HV bw=20+5 Full 1.90 GB NISAR_L2_PR_GCOV_029_083_A_008_2005_DHDH_M_20260830T223633_20260830T223708_P05023_N_F_J_001
2026-09-11T22:36:33Z NISAR_L2_GCOV_PROVISIONAL_V1 track=83 frame=8 ASCENDING pol=HH+HV bw=20+5 Full 1.90 GB NISAR_L2_PR_GCOV_030_083_A_008_2005_DHDH_M_20260911T223633_20260911T223708_P05023_N_F_J_001
2026-09-23T22:36:33Z NISAR_L2_GCOV_PROVISIONAL_V1 track=83 frame=8 ASCENDING pol=HH+HV bw=20+5 Full 1.90 GB NISAR_L2_PR_GCOV_031_083_A_008_2005_DHDH_M_20260923T223633_20260923T223708_P05023_N_F_J_001
2026-10-05T22:36:33Z NISAR_L2_GCOV_PROVISIONAL_V1 track=83 frame=8 ASCENDING pol=HH+HV bw=20+5 Full 1.90 GB NISAR_L2_PR_GCOV_032_083_A_008_2005_DHDH_M_20261005T223633_20261005T223708_P05023_N_F_J_001
2026-10-17T22:36:33Z NISAR_L2_GCOV_PROVISIONAL_V1 track=83 frame=8 ASCENDING pol=HH+HV bw=20+5 Full 1.90 GB NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001
2026-10-29T22:36:34Z NISAR_L2_GCOV_V1 track=83 frame=8 ASCENDING pol=HH+HV bw=20+5 Full 1.85 GB NISAR_L2_PR_GCOV_034_083_A_008_2005_DHDH_M_20261029T223634_20261029T223708_P05036_N_F_J_001
data URL (needs Earthdata Login): https://nisar.asf.earthdatacloud.nasa.gov/NISAR/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001.h5
S3 URI (us-west-2 only)         : s3://sds-n-cumulus-prod-nisar-products/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001.h5
browse PNGs (public)            :
    https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001_LATLON.png
    https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001_LATLON_thumbnail.png
    https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001_NATIVE.png
    https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001_NATIVE_A_HHHH.png
    https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001_NATIVE_A_HVHV.png
    https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001_NATIVE_B_HHHH.png
    https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001_NATIVE_B_HVHV.png
footprint GeoJSON               : {'coordinates': [[[105.41857, 11.99121], [104.89877, 14.13511], [102.63217, 13.59435], [103.1681, 11.45942], [105.41857, 11.99121]]], 'type': 'Polygon'}
granule concept id              : G4378438775-ASF | collection concept id: C2854338529-ASF
````


### 5.4 earthaccess

#### final_earthaccess.py

Source: `S/scripts/final_earthaccess.py` (md5 `2426a46272be7e33683db41af1c1ec80`). Status: **ran**.

````python
"""NISAR L2 GCOV discovery with earthaccess (tested with 0.19.0). Searching needs no Earthdata Login."""
import earthaccess

# one short name per maturity level; pass a list (a tuple raises TypeError)
SHORT_NAMES = ["NISAR_L2_GCOV_BETA_V1", "NISAR_L2_GCOV_PROVISIONAL_V1", "NISAR_L2_GCOV_V1"]

granules = earthaccess.search_data(
    short_name=SHORT_NAMES,
    point=(104.05, 12.95),                          # (lon, lat); or bounding_box=(west, south, east, north)
    temporal=("2026-06-01", "2026-11-13"),          # a date-only end is inclusive (sent as 23:59:59Z)
    granule_name="NISAR_L2_PR_GCOV_*_083_A_008_*",  # production granules of track 083, Ascending, frame 008
)


def attrs(g):
    """CMR additional attributes as a dict of lists, e.g. {'TRACK_NUMBER': ['83'], 'FULL_FRAME': ['TRUE'], ...}"""
    return {a["Name"]: a["Values"] for a in g["umm"]["AdditionalAttributes"]}


def start(g):
    return g["umm"]["TemporalExtent"]["RangeDateTime"]["BeginningDateTime"]


granules = [g for g in granules if attrs(g)["FULL_FRAME"] == ["TRUE"]]  # drop partial-frame granules
granules.sort(key=start)

print(f"{len(granules)} granules; logged in: {earthaccess.__auth__.authenticated}")
for g in granules:
    a = attrs(g)
    h5 = next(f for f in g["umm"]["DataGranule"]["ArchiveAndDistributionInformation"] if f["Name"] == g["umm"]["GranuleUR"] + ".h5")
    print(
        start(g)[:19] + "Z",
        g["umm"]["CollectionReference"]["ShortName"],
        f"track={a['TRACK_NUMBER'][0]} frame={a['FRAME_NUMBER'][0]} {a['ASCENDING_DESCENDING'][0]}",
        "pol=" + "+".join(a.get("FREQUENCY_A_POLARIZATION", ["none"])),
        "bw=" + a["RANGE_BANDWIDTH_CONCAT"][0],
        f"{h5['SizeInBytes'] / 1e9:.2f} GB",
        g["umm"]["GranuleUR"],
    )

g = next(g for g in granules if "20261017T223633" in g["umm"]["GranuleUR"])
print("HTTPS data link (needs Earthdata Login):", g.data_links(access="external"))
print("S3 data link (us-west-2 only)          :", g.data_links(access="direct"))
print("browse PNGs (public)                   :", *[u for u in g.dataviz_links if u.startswith("https://")], sep="\n    ")
print("S3 credentials endpoint                :", g.get_s3_credentials_endpoint())
print("total size of all files, MB            :", round(g.size, 1))
````

What it printed (`S/out2/final_earthaccess.txt`):

````text
11 granules; logged in: False
2026-06-19T22:36:37Z NISAR_L2_GCOV_PROVISIONAL_V1 track=83 frame=8 ASCENDING pol=HH+HV bw=20+5 1.85 GB NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223637_20260619T223711_P05023_N_F_J_001
2026-07-01T22:36:36Z NISAR_L2_GCOV_PROVISIONAL_V1 track=83 frame=8 ASCENDING pol=HH+HV bw=20+5 1.90 GB NISAR_L2_PR_GCOV_024_083_A_008_2005_DHDH_M_20260701T223636_20260701T223711_P05023_N_F_J_001
2026-07-13T22:36:36Z NISAR_L2_GCOV_PROVISIONAL_V1 track=83 frame=8 ASCENDING pol=HH+HV bw=20+5 1.85 GB NISAR_L2_PR_GCOV_025_083_A_008_2005_DHDH_M_20260713T223636_20260713T223710_P05023_N_F_J_001
2026-07-25T22:36:35Z NISAR_L2_GCOV_PROVISIONAL_V1 track=83 frame=8 ASCENDING pol=HH+HV bw=20+5 1.85 GB NISAR_L2_PR_GCOV_026_083_A_008_2005_DHDH_M_20260725T223635_20260725T223709_P05023_N_F_J_001
2026-08-18T22:36:34Z NISAR_L2_GCOV_PROVISIONAL_V1 track=83 frame=8 ASCENDING pol=HH+HV bw=20+5 1.85 GB NISAR_L2_PR_GCOV_028_083_A_008_2005_DHDH_M_20260818T223634_20260818T223708_P05023_N_F_J_001
2026-08-30T22:36:33Z NISAR_L2_GCOV_PROVISIONAL_V1 track=83 frame=8 ASCENDING pol=HH+HV bw=20+5 1.90 GB NISAR_L2_PR_GCOV_029_083_A_008_2005_DHDH_M_20260830T223633_20260830T223708_P05023_N_F_J_001
2026-09-11T22:36:33Z NISAR_L2_GCOV_PROVISIONAL_V1 track=83 frame=8 ASCENDING pol=HH+HV bw=20+5 1.90 GB NISAR_L2_PR_GCOV_030_083_A_008_2005_DHDH_M_20260911T223633_20260911T223708_P05023_N_F_J_001
2026-09-23T22:36:33Z NISAR_L2_GCOV_PROVISIONAL_V1 track=83 frame=8 ASCENDING pol=HH+HV bw=20+5 1.90 GB NISAR_L2_PR_GCOV_031_083_A_008_2005_DHDH_M_20260923T223633_20260923T223708_P05023_N_F_J_001
2026-10-05T22:36:33Z NISAR_L2_GCOV_PROVISIONAL_V1 track=83 frame=8 ASCENDING pol=HH+HV bw=20+5 1.90 GB NISAR_L2_PR_GCOV_032_083_A_008_2005_DHDH_M_20261005T223633_20261005T223708_P05023_N_F_J_001
2026-10-17T22:36:33Z NISAR_L2_GCOV_PROVISIONAL_V1 track=83 frame=8 ASCENDING pol=HH+HV bw=20+5 1.90 GB NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001
2026-10-29T22:36:34Z NISAR_L2_GCOV_V1 track=83 frame=8 ASCENDING pol=HH+HV bw=20+5 1.85 GB NISAR_L2_PR_GCOV_034_083_A_008_2005_DHDH_M_20261029T223634_20261029T223708_P05036_N_F_J_001
HTTPS data link (needs Earthdata Login): ['https://nisar.asf.earthdatacloud.nasa.gov/NISAR/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001.h5']
S3 data link (us-west-2 only)          : ['s3://sds-n-cumulus-prod-nisar-products/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001.h5']
browse PNGs (public)                   :
    https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001_LATLON.png
    https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001_LATLON_thumbnail.png
    https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001_NATIVE.png
    https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001_NATIVE_A_HHHH.png
    https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001_NATIVE_A_HVHV.png
    https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001_NATIVE_B_HHHH.png
    https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001_NATIVE_B_HVHV.png
S3 credentials endpoint                : https://nisar.asf.earthdatacloud.nasa.gov/s3credentials
total size of all files, MB            : 1826.3
````


### 5.5 earthaccess query builder with additional-attribute filters

#### final_earthaccess_attribute_filter.py

Source: `S/scripts/final_earthaccess_attribute_filter.py` (md5 `ade343c8d4d90d4806444651d39e5190`). Status: **ran**.

````python
"""earthaccess (tested with 0.19.0) query builder with CMR additional-attribute filters: one track/frame stack,
full frames only, no spatial filter needed. No Earthdata Login needed."""
import earthaccess

query = (
    earthaccess.granule_query()
    .short_name(["NISAR_L2_GCOV_BETA_V1", "NISAR_L2_GCOV_PROVISIONAL_V1", "NISAR_L2_GCOV_V1"])
    .temporal("2026-06-01", "2026-11-13")
    .sort_key("start_date")
)
# earthaccess / python-cmr have no method for additional attributes, but list-valued params are sent as attribute[]=...
query.params["attribute"] = ["string,STACK_ID,083_A_008", "string,FULL_FRAME,TRUE"]

print("hits:", query.hits())
granules = query.get_all()  # list of earthaccess DataGranule, same objects as search_data() returns
for g in granules:
    print(g["umm"]["TemporalExtent"]["RangeDateTime"]["BeginningDateTime"][:10], g["umm"]["CollectionReference"]["ShortName"], g.data_links(access="external")[0].rsplit("/", 1)[-1])
````

What it printed (`S/out2/final_earthaccess_attribute_filter.txt`):

````text
hits: 11
2026-06-19 NISAR_L2_GCOV_PROVISIONAL_V1 NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223637_20260619T223711_P05023_N_F_J_001.h5
2026-07-01 NISAR_L2_GCOV_PROVISIONAL_V1 NISAR_L2_PR_GCOV_024_083_A_008_2005_DHDH_M_20260701T223636_20260701T223711_P05023_N_F_J_001.h5
2026-07-13 NISAR_L2_GCOV_PROVISIONAL_V1 NISAR_L2_PR_GCOV_025_083_A_008_2005_DHDH_M_20260713T223636_20260713T223710_P05023_N_F_J_001.h5
2026-07-25 NISAR_L2_GCOV_PROVISIONAL_V1 NISAR_L2_PR_GCOV_026_083_A_008_2005_DHDH_M_20260725T223635_20260725T223709_P05023_N_F_J_001.h5
2026-08-18 NISAR_L2_GCOV_PROVISIONAL_V1 NISAR_L2_PR_GCOV_028_083_A_008_2005_DHDH_M_20260818T223634_20260818T223708_P05023_N_F_J_001.h5
2026-08-30 NISAR_L2_GCOV_PROVISIONAL_V1 NISAR_L2_PR_GCOV_029_083_A_008_2005_DHDH_M_20260830T223633_20260830T223708_P05023_N_F_J_001.h5
2026-09-11 NISAR_L2_GCOV_PROVISIONAL_V1 NISAR_L2_PR_GCOV_030_083_A_008_2005_DHDH_M_20260911T223633_20260911T223708_P05023_N_F_J_001.h5
2026-09-23 NISAR_L2_GCOV_PROVISIONAL_V1 NISAR_L2_PR_GCOV_031_083_A_008_2005_DHDH_M_20260923T223633_20260923T223708_P05023_N_F_J_001.h5
2026-10-05 NISAR_L2_GCOV_PROVISIONAL_V1 NISAR_L2_PR_GCOV_032_083_A_008_2005_DHDH_M_20261005T223633_20261005T223708_P05023_N_F_J_001.h5
2026-10-17 NISAR_L2_GCOV_PROVISIONAL_V1 NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001.h5
2026-10-29 NISAR_L2_GCOV_V1 NISAR_L2_PR_GCOV_034_083_A_008_2005_DHDH_M_20261029T223634_20261029T223708_P05036_N_F_J_001.h5
````


### 5.6 Cross-check of the three paths against the ground truth

#### crosscheck.py

Source: `S/scripts/crosscheck.py` (md5 `8d01692344a73514db715065c4e917ab`). Status: **ran**.

````python
"""Cross-check: the three discovery paths must return the same 11 granules as the ground truth
(track 83, ascending, frame 8 at lon 104.05 lat 12.95; 2026-06-19 .. 2026-10-29; 10 Provisional + 1 Validated)."""
import json
import urllib.parse
import urllib.request
from collections import Counter

import asf_search as asf
import earthaccess

asf.REPORT_ERRORS = False
SHORT_NAMES = ["NISAR_L2_GCOV_BETA_V1", "NISAR_L2_GCOV_PROVISIONAL_V1", "NISAR_L2_GCOV_V1"]
EXAMPLE = "NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001"

# 1. asf_search
a = asf.search(dataset=asf.DATASET.NISAR, processingLevel=asf.PRODUCT_TYPE.GCOV, intersectsWith="POINT(104.05 12.95)",
               start="2026-06-01T00:00:00Z", end="2026-11-13T23:59:59Z", relativeOrbit=83, frame=8,
               flightDirection=asf.FLIGHT_DIRECTION.ASCENDING)
asf_set = {p.properties["sceneName"]: p.properties["collectionName"] for p in a}

# 2. earthaccess, point and bounding box
e = earthaccess.search_data(short_name=SHORT_NAMES, point=(104.05, 12.95), temporal=("2026-06-01", "2026-11-13"))
ea_point_all = Counter(g["umm"]["CollectionReference"]["ShortName"] for g in e)
ea_set = {g["umm"]["GranuleUR"]: g["umm"]["CollectionReference"]["ShortName"] for g in e if "_083_A_008_" in g["umm"]["GranuleUR"]}
b = earthaccess.search_data(short_name=SHORT_NAMES, bounding_box=(103.9, 12.8, 104.2, 13.1), temporal=("2026-06-01", "2026-11-13"))
ea_bbox_all = Counter(g["umm"]["CollectionReference"]["ShortName"] for g in b)
ea_bbox_set = {g["umm"]["GranuleUR"] for g in b if "_083_A_008_" in g["umm"]["GranuleUR"]}

# 3. raw CMR
params = [("short_name[]", s) for s in SHORT_NAMES] + [("attribute[]", "string,STACK_ID,083_A_008"), ("point", "104.05,12.95"), ("page_size", "100")]
req = urllib.request.Request("https://cmr.earthdata.nasa.gov/search/granules.umm_json?" + urllib.parse.urlencode(params),
                             headers={"User-Agent": "nisar-search-verify/1.0"})
with urllib.request.urlopen(req, timeout=60) as r:
    hits = r.headers.get("CMR-Hits")
    items = json.load(r)["items"]
cmr_set = {i["umm"]["GranuleUR"]: i["umm"]["CollectionReference"]["ShortName"] for i in items}

print("asf_search          :", len(asf_set), dict(Counter(asf_set.values())))
print("earthaccess (point) :", len(ea_set), dict(Counter(ea_set.values())), "| all stacks at the point:", sum(ea_point_all.values()), dict(ea_point_all))
print("earthaccess (bbox)  :", len(ea_bbox_set), "| all stacks in the box:", sum(ea_bbox_all.values()), dict(ea_bbox_all))
print("raw CMR             :", len(cmr_set), dict(Counter(cmr_set.values())), "| CMR-Hits header:", hits)
dates = sorted(n.split("_")[11][:8] for n in cmr_set)
print("dates:", dates)
print("identical name sets across asf_search / earthaccess point / earthaccess bbox / raw CMR:",
      set(asf_set) == set(ea_set) == ea_bbox_set == set(cmr_set))
checks = {
    "exactly 11 granules": len(cmr_set) == 11,
    "10 in Provisional": Counter(cmr_set.values())["NISAR_L2_GCOV_PROVISIONAL_V1"] == 10,
    "1 in Validated": Counter(cmr_set.values())["NISAR_L2_GCOV_V1"] == 1,
    "first date 2026-06-19": dates[0] == "20260619",
    "last date 2026-10-29": dates[-1] == "20261029",
    "example granule present": EXAMPLE in cmr_set,
    "collection concept ids": {i["meta"]["collection-concept-id"] for i in items} == {"C2854338529-ASF", "C3622241360-ASF"},
}
for k, v in checks.items():
    print(f"  ground truth check - {k}: {'PASS' if v else 'FAIL'}")
print("earthaccess logged in:", earthaccess.__auth__.authenticated)
````

What it printed (`S/out2/crosscheck.txt`):

````text
asf_search          : 11 {'NISAR_L2_GCOV_V1': 1, 'NISAR_L2_GCOV_PROVISIONAL_V1': 10}
earthaccess (point) : 11 {'NISAR_L2_GCOV_PROVISIONAL_V1': 10, 'NISAR_L2_GCOV_V1': 1} | all stacks at the point: 22 {'NISAR_L2_GCOV_PROVISIONAL_V1': 19, 'NISAR_L2_GCOV_V1': 3}
earthaccess (bbox)  : 11 | all stacks in the box: 22 {'NISAR_L2_GCOV_PROVISIONAL_V1': 19, 'NISAR_L2_GCOV_V1': 3}
raw CMR             : 11 {'NISAR_L2_GCOV_PROVISIONAL_V1': 10, 'NISAR_L2_GCOV_V1': 1} | CMR-Hits header: 11
dates: ['20260619', '20260701', '20260713', '20260725', '20260818', '20260830', '20260911', '20260923', '20261005', '20261017', '20261029']
identical name sets across asf_search / earthaccess point / earthaccess bbox / raw CMR: True
  ground truth check - exactly 11 granules: PASS
  ground truth check - 10 in Provisional: PASS
  ground truth check - 1 in Validated: PASS
  ground truth check - first date 2026-06-19: PASS
  ground truth check - last date 2026-10-29: PASS
  ground truth check - example granule present: PASS
  ground truth check - collection concept ids: PASS
earthaccess logged in: False
````


### 5.7 CMR pagination behaviour

#### cmr_probe_05_pagination.py

Source: `S/scripts/cmr_probe_05_pagination.py` (md5 `59805b8c259858e8312687dad33bcf85`). Status: **ran**.

````python
"""Raw-CMR probe 5 (stdlib only): pagination behaviour of granules.umm_json.
- default page size, maximum page size
- CMR-Search-After walk with a small page size on the 33-granule STACK_ID query, and what the last page looks like
- page_num alternative, mixing page_num with CMR-Search-After
- a 500+ granule query walked with page_size=200
- does the result order stay stable, are there duplicates across pages"""
import json
import time
import urllib.error
import urllib.parse
import urllib.request

UA = "nisar-search-verify/1.0"
CMR = "https://cmr.earthdata.nasa.gov/search/granules.umm_json"
GCOV = ["NISAR_L2_GCOV_BETA_V1", "NISAR_L2_GCOV_PROVISIONAL_V1", "NISAR_L2_GCOV_V1"]
STACK = [("short_name[]", s) for s in GCOV] + [("attribute[]", "string,STACK_ID,083_A_008")]


def get(params, search_after=None):
    url = f"{CMR}?{urllib.parse.urlencode(params)}"
    headers = {"User-Agent": UA}
    if search_after:
        headers["CMR-Search-After"] = search_after
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, r.headers, json.load(r)
    except urllib.error.HTTPError as e:
        return e.code, e.headers, json.loads(e.read().decode() or "{}")


def names(d):
    return [it["umm"]["GranuleUR"] for it in d.get("items", [])]


print("### 1. no page_size at all")
st, h, d = get(STACK)
print(f"  HTTP {st} | CMR-Hits={h.get('CMR-Hits')} | items returned={len(d['items'])} | CMR-Search-After present={h.get('CMR-Search-After') is not None}")

print("### 2. page_size=2000 (documented maximum) and page_size=2001")
st, h, d = get(STACK + [("page_size", "2000")])
print(f"  page_size=2000 -> HTTP {st} | items={len(d['items'])} | CMR-Search-After present={h.get('CMR-Search-After') is not None}")
st, h, d = get(STACK + [("page_size", "2001")])
print(f"  page_size=2001 -> HTTP {st} | body={json.dumps(d)[:200]}")

print("### 3. CMR-Search-After walk, page_size=10, on the 33-granule query")
sa, page, seen = None, 0, []
while True:
    st, h, d = get(STACK + [("page_size", "10")], sa)
    page += 1
    sa_new = h.get("CMR-Search-After")
    print(f"  page {page}: HTTP {st} | items={len(d['items'])} | CMR-Hits={h.get('CMR-Hits')} | CMR-Search-After={sa_new}")
    seen += names(d)
    if not d["items"] or sa_new is None:
        break
    sa = sa_new
print(f"  total collected={len(seen)} unique={len(set(seen))}")

print("### 4. page_num alternative (page_size=10, page_num=1..4)")
alt = []
for pn in (1, 2, 3, 4):
    st, h, d = get(STACK + [("page_size", "10"), ("page_num", str(pn))])
    alt += names(d)
    print(f"  page_num={pn}: HTTP {st} | items={len(d['items'])}")
print(f"  page_num walk: total={len(alt)} unique={len(set(alt))} | same order as search-after walk: {alt == seen}")

print("### 5. page_num together with a CMR-Search-After header")
st, h, d = get(STACK + [("page_size", "10"), ("page_num", "2")], seen and json.dumps(["asf", 1781908597000, 4250743928]))
print(f"  HTTP {st} | body={json.dumps(d)[:300]}")

print("### 6. changing the query between pages (search-after from one query used with another)")
st, h, d = get(STACK + [("page_size", "10")])
sa = h.get("CMR-Search-After")
st2, h2, d2 = get(STACK + [("page_size", "10"), ("sort_key", "-start_date")], sa)
print(f"  HTTP {st2} | items={len(d2.get('items', []))} | body head={json.dumps(d2)[:200]}")

print("### 7. larger walk: GCOV x3 over a South-East Asia box, October 2026, page_size=200")
BIG = [("short_name[]", s) for s in GCOV] + [("bounding_box", "95,5,110,25"), ("temporal", "2026-10-01T00:00:00Z,2026-11-01T00:00:00Z"), ("page_size", "200")]
sa, page, allnames, t0 = None, 0, [], time.time()
while True:
    t = time.time()
    st, h, d = get(BIG, sa)
    page += 1
    allnames += names(d)
    print(f"  page {page}: HTTP {st} | items={len(d['items'])} | CMR-Hits={h.get('CMR-Hits')} | took header={h.get('CMR-Took')} ms | wall={time.time()-t:.1f}s | search-after={h.get('CMR-Search-After')}")
    sa = h.get("CMR-Search-After")
    if not d["items"] or sa is None:
        break
print(f"  total={len(allnames)} unique={len(set(allnames))} in {time.time()-t0:.1f}s")

print("### 8. default sort order vs explicit sort_key=start_date (first 5 start times of the 33-granule query)")
for extra, label in (([], "default"), ([("sort_key", "start_date")], "sort_key=start_date"), ([("sort_key", "-start_date")], "sort_key=-start_date")):
    st, h, d = get(STACK + [("page_size", "5")] + extra)
    print(f"  {label:22}:", [it["umm"]["TemporalExtent"]["RangeDateTime"]["BeginningDateTime"][:19] for it in d["items"]])
````

What it printed (`S/out2/cmr_probe_05_pagination.txt`):

````text
### 1. no page_size at all
  HTTP 200 | CMR-Hits=33 | items returned=10 | CMR-Search-After present=True
### 2. page_size=2000 (documented maximum) and page_size=2001
  page_size=2000 -> HTTP 200 | items=33 | CMR-Search-After present=True
  page_size=2001 -> HTTP 400 | body={"errors": ["page_size must be a number between 0 and 2000"]}
### 3. CMR-Search-After walk, page_size=10, on the 33-granule query
  page 1: HTTP 200 | items=10 | CMR-Hits=33 | CMR-Search-After=["asf",1785018995000,4263267037]
  page 2: HTTP 200 | items=10 | CMR-Hits=33 | CMR-Search-After=["asf",1789166193000,4310498259]
  page 3: HTTP 200 | items=10 | CMR-Hits=33 | CMR-Search-After=["asf",1792276624000,4378226273]
  page 4: HTTP 200 | items=3 | CMR-Hits=33 | CMR-Search-After=["asf",1793313424000,4407888022]
  page 5: HTTP 200 | items=0 | CMR-Hits=33 | CMR-Search-After=None
  total collected=33 unique=33
### 4. page_num alternative (page_size=10, page_num=1..4)
  page_num=1: HTTP 200 | items=10
  page_num=2: HTTP 200 | items=10
  page_num=3: HTTP 200 | items=10
  page_num=4: HTTP 200 | items=3
  page_num walk: total=33 unique=33 | same order as search-after walk: True
### 5. page_num together with a CMR-Search-After header
  HTTP 400 | body={"errors": ["page_num is not allowed with search-after"]}
### 6. changing the query between pages (search-after from one query used with another)
  HTTP 400 | items=0 | body head={"errors": ["The search failed with error: [{:type \"illegal_argument_exception\", :reason \"search_after has 3 value(s) but sort has 2.\"}]. Please double check your search_after header."]}
### 7. larger walk: GCOV x3 over a South-East Asia box, October 2026, page_size=200
  page 1: HTTP 200 | items=200 | CMR-Hits=487 | took header=363 ms | wall=0.9s | search-after=["asf",1791929108000,4368845340]
  page 2: HTTP 200 | items=200 | CMR-Hits=487 | took header=426 ms | wall=1.0s | search-after=["asf",1793016231000,4410865001]
  page 3: HTTP 200 | items=87 | CMR-Hits=487 | took header=175 ms | wall=0.5s | search-after=["asf",1793487394000,4405864294]
  page 4: HTTP 200 | items=0 | CMR-Hits=487 | took header=38 ms | wall=0.1s | search-after=None
  total=487 unique=487 in 2.4s
### 8. default sort order vs explicit sort_key=start_date (first 5 start times of the 33-granule query)
  default               : ['2026-06-19T22:36:37', '2026-06-19T22:36:37', '2026-06-19T22:37:07', '2026-07-01T22:36:36', '2026-07-01T22:36:36']
  sort_key=start_date   : ['2026-06-19T22:36:37', '2026-06-19T22:36:37', '2026-06-19T22:37:07', '2026-07-01T22:36:36', '2026-07-01T22:36:36']
  sort_key=-start_date  : ['2026-10-29T22:37:04', '2026-10-29T22:36:34', '2026-10-29T22:36:34', '2026-10-17T22:37:04', '2026-10-17T22:36:33']
````


### 5.8 Partial frames at an edge-strip point

#### partial_frame_point_check.py

Source: `S/scripts/partial_frame_point_check.py` (md5 `abe9230cc82400c83c06f1cc4cfe80dc`). Status: **ran**.

````python
"""Does a point filter alone remove partial-frame granules? Try a point in the southern edge strip of frame 083_A_008
(lon 104.3, lat 12.0) and compare with the ground-truth point (lon 104.05, lat 12.95). stdlib + asf_search, no login."""
import json
import urllib.parse
import urllib.request
from collections import Counter

import asf_search as asf

asf.REPORT_ERRORS = False
GCOV = ["NISAR_L2_GCOV_BETA_V1", "NISAR_L2_GCOV_PROVISIONAL_V1", "NISAR_L2_GCOV_V1"]


def cmr(extra):
    params = [("short_name[]", s) for s in GCOV] + [("attribute[]", "string,STACK_ID,083_A_008"), ("page_size", "200")] + extra
    req = urllib.request.Request("https://cmr.earthdata.nasa.gov/search/granules.umm_json?" + urllib.parse.urlencode(params),
                                 headers={"User-Agent": "nisar-search-verify/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        hits = r.headers.get("CMR-Hits")
        items = json.load(r)["items"]
    cov = Counter(next(a["Values"][0] for a in i["umm"]["AdditionalAttributes"] if a["Name"] == "FULL_FRAME") for i in items)
    return hits, dict(cov)


for lon, lat in ((104.05, 12.95), (104.3, 12.0)):
    print(f"point lon={lon} lat={lat}")
    print("   raw CMR  STACK_ID + point                  : CMR-Hits=%s FULL_FRAME=%s" % cmr([("point", f"{lon},{lat}")]))
    print("   raw CMR  STACK_ID + point + FULL_FRAME=TRUE: CMR-Hits=%s FULL_FRAME=%s" % cmr([("point", f"{lon},{lat}"), ("attribute[]", "string,FULL_FRAME,TRUE")]))
    kw = dict(dataset=asf.DATASET.NISAR, processingLevel=asf.PRODUCT_TYPE.GCOV, intersectsWith=f"POINT({lon} {lat})",
              relativeOrbit=83, frame=8, flightDirection=asf.FLIGHT_DIRECTION.ASCENDING)
    a = asf.search(**kw)
    b = asf.search(frameCoverage="FULL", **kw)
    print("   asf_search track/frame/direction + point   : n=%d coverage=%s" % (len(a), dict(Counter(p.properties["frameCoverage"] for p in a))))
    print("   asf_search same + frameCoverage='FULL'     : n=%d coverage=%s" % (len(b), dict(Counter(p.properties["frameCoverage"] for p in b))))
````

What it printed (`S/out2/partial_frame_point_check.txt`):

````text
point lon=104.05 lat=12.95
   raw CMR  STACK_ID + point                  : CMR-Hits=11 FULL_FRAME={'TRUE': 11}
   raw CMR  STACK_ID + point + FULL_FRAME=TRUE: CMR-Hits=11 FULL_FRAME={'TRUE': 11}
   asf_search track/frame/direction + point   : n=11 coverage={'Full': 11}
   asf_search same + frameCoverage='FULL'     : n=11 coverage={'Full': 11}
point lon=104.3 lat=12.0
   raw CMR  STACK_ID + point                  : CMR-Hits=22 FULL_FRAME={'FALSE': 11, 'TRUE': 11}
   raw CMR  STACK_ID + point + FULL_FRAME=TRUE: CMR-Hits=11 FULL_FRAME={'TRUE': 11}
   asf_search track/frame/direction + point   : n=22 coverage={'Full': 11, 'Partial': 11}
   asf_search same + frameCoverage='FULL'     : n=11 coverage={'Full': 11}
````


### 5.9 Is a newer acquisition still waiting for its GCOV?

#### pending_acquisition_check.py

Source: `S/scripts/pending_acquisition_check.py` (md5 `518012f9464c40138c7a4a4de71c236e`). Status: **ran**.

````python
"""Is a newer acquisition of track 83 ascending at the test point waiting for its GCOV? (asf_search, no login)"""
import datetime

import asf_search as asf

asf.REPORT_ERRORS = False
print("checked at", datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"))
for level in ("RRSD", "RSLC", "GSLC", "GCOV"):
    res = asf.search(dataset=asf.DATASET.NISAR, processingLevel=level, intersectsWith="POINT(104.05 12.95)",
                     relativeOrbit=83, flightDirection=asf.FLIGHT_DIRECTION.ASCENDING, start="2026-10-25T00:00:00Z")
    print(f"{level}: {len(res)} granule(s) starting on or after 2026-10-25")
    for p in sorted(res, key=lambda p: p.properties["startTime"]):
        q = p.properties
        print("   ", q["startTime"], "| processed", q["processingDate"], "|", q["collectionName"], "|", q["sceneName"])
````

What it printed (`S/out2/pending_acquisition_check.txt`):

````text
checked at 2026-11-14T07:57:22Z
RRSD: 2 granule(s) starting on or after 2026-10-25
    2026-10-29T22:36:41Z | processed 2026-11-07T04:21:30Z | NISAR_L0B_RRSD_V1 | NISAR_L0_PR_RRSD_034_083_A_148S_20261029T223641_20261029T223701_P05036_F_J_001
    2026-11-10T22:36:41Z | processed 2026-11-11T01:10:04Z | NISAR_L0B_RRSD_V1 | NISAR_L0_PR_RRSD_035_083_A_148S_20261110T223641_20261110T223701_P05036_F_J_001
RSLC: 1 granule(s) starting on or after 2026-10-25
    2026-10-29T22:36:34Z | processed 2026-11-10T16:25:23Z | NISAR_L1_RSLC_V1 | NISAR_L1_PR_RSLC_034_083_A_008_2005_DHDH_M_20261029T223634_20261029T223708_P05036_N_F_J_001
GSLC: 1 granule(s) starting on or after 2026-10-25
    2026-10-29T22:36:34Z | processed 2026-11-10T18:06:22Z | NISAR_L2_GSLC_V1 | NISAR_L2_PR_GSLC_034_083_A_008_2005_DHDH_M_20261029T223634_20261029T223708_P05036_N_F_J_001
GCOV: 1 granule(s) starting on or after 2026-10-25
    2026-10-29T22:36:34Z | processed 2026-11-10T23:32:13Z | NISAR_L2_GCOV_V1 | NISAR_L2_PR_GCOV_034_083_A_008_2005_DHDH_M_20261029T223634_20261029T223708_P05036_N_F_J_001
````


### 5.10 Paged overlap between collections, and latency of the newest granules

#### misc_checks_2.py

Source: `S/scripts/misc_checks_2.py` (md5 `2bfdab9119131e6e8d58a0ec22a4d2a8`). Status: **ran**.

````python
"""Miscellaneous checks 2 (no login, stdlib only):
A. Provisional vs Validated GCOV overlap around the hand-over date, with full pagination (CMR-Search-After)
B. publication latency of the newest GCOV granules of stack 083_A_008 (acquisition start -> production -> CMR revision)"""
import json
import urllib.parse
import urllib.request
from collections import defaultdict

UA = "nisar-search-verify/1.0"
CMR = "https://cmr.earthdata.nasa.gov/search/granules.umm_json"


def walk(params, page_size=2000):
    q = urllib.parse.urlencode(params + [("page_size", str(page_size))])
    sa = None
    while True:
        h = {"User-Agent": UA}
        if sa:
            h["CMR-Search-After"] = sa
        with urllib.request.urlopen(urllib.request.Request(f"{CMR}?{q}", headers=h), timeout=180) as r:
            sa = r.headers.get("CMR-Search-After")
            hits = r.headers.get("CMR-Hits")
            items = json.load(r)["items"]
        yield from ((hits, i) for i in items)
        if len(items) < page_size or not sa:
            return


print("### A. Provisional vs Validated overlap, 2026-10-20 .. 2026-10-23, all pages")
groups = defaultdict(set)
for sn in ("NISAR_L2_GCOV_PROVISIONAL_V1", "NISAR_L2_GCOV_V1"):
    n, hits, first, last = 0, None, None, None
    for hits, it in walk([("short_name", sn), ("temporal", "2026-10-20T00:00:00Z,2026-10-23T00:00:00Z"), ("sort_key", "start_date")]):
        n += 1
        u = it["umm"]
        a = {x["Name"]: x["Values"] for x in u["AdditionalAttributes"]}
        s = u["TemporalExtent"]["RangeDateTime"]["BeginningDateTime"][:19]
        first = first or s
        last = s
        groups[(a["STACK_ID"][0], s, a["FULL_FRAME"][0], a["RANGE_BANDWIDTH_CONCAT"][0])].add(sn)
    print(f"  {sn}: CMR-Hits={hits} fetched={n} first start={first} last start={last}")
both = [k for k, v in groups.items() if len(v) > 1]
print(f"  distinct (stack, start, full_frame, bandwidth): {len(groups)} | present in BOTH collections: {len(both)}")
for k in both[:3]:
    print("    ", k)

print("\n### B. latency of the newest granules of stack 083_A_008 (full frames)")
params = [("short_name[]", "NISAR_L2_GCOV_PROVISIONAL_V1"), ("short_name[]", "NISAR_L2_GCOV_V1"),
          ("attribute[]", "string,STACK_ID,083_A_008"), ("attribute[]", "string,FULL_FRAME,TRUE"), ("sort_key", "-start_date")]
for _, it in list(walk(params, page_size=4))[:4]:
    u = it["umm"]
    print("  start", u["TemporalExtent"]["RangeDateTime"]["BeginningDateTime"][:19], "| produced", u["DataGranule"]["ProductionDateTime"][:19],
          "| CMR revision", it["meta"]["revision-date"][:19], "|", u["CollectionReference"]["ShortName"],
          "| provider dates:", [(d["Type"], d["Date"][:19]) for d in u.get("ProviderDates", [])])
````

What it printed (`S/out2/misc_checks_2.txt`):

````text
### A. Provisional vs Validated overlap, 2026-10-20 .. 2026-10-23, all pages
  NISAR_L2_GCOV_PROVISIONAL_V1: CMR-Hits=2492 fetched=2492 first start=2026-10-20T00:00:14 last start=2026-10-21T20:37:40
  NISAR_L2_GCOV_V1: CMR-Hits=1685 fetched=1685 first start=2026-10-21T17:07:21 last start=2026-10-22T23:48:26
  distinct (stack, start, full_frame, bandwidth): 4055 | present in BOTH collections: 117
     ('137_D_073', '2026-10-21T17:07:21', 'FALSE', '20+5')
     ('137_D_073', '2026-10-21T17:07:40', 'FALSE', '20+5')
     ('137_D_074', '2026-10-21T17:07:54', 'FALSE', '20+5')

### B. latency of the newest granules of stack 083_A_008 (full frames)
  start 2026-10-29T22:36:34 | produced 2026-11-10T23:32:13 | CMR revision 2026-11-10T23:36:04 | NISAR_L2_GCOV_V1 | provider dates: [('Insert', '2026-11-10T23:36:01'), ('Update', '2026-11-10T23:36:01')]
  start 2026-10-17T22:36:33 | produced 2026-10-19T21:40:01 | CMR revision 2026-10-19T21:46:19 | NISAR_L2_GCOV_PROVISIONAL_V1 | provider dates: [('Insert', '2026-10-19T21:46:16'), ('Update', '2026-10-19T21:46:16')]
  start 2026-10-05T22:36:33 | produced 2026-10-07T18:40:38 | CMR revision 2026-10-07T18:47:23 | NISAR_L2_GCOV_PROVISIONAL_V1 | provider dates: [('Insert', '2026-10-07T18:47:19'), ('Update', '2026-10-07T18:47:19')]
  start 2026-09-23T22:36:33 | produced 2026-09-25T18:33:56 | CMR revision 2026-09-25T18:39:36 | NISAR_L2_GCOV_PROVISIONAL_V1 | provider dates: [('Insert', '2026-09-25T18:39:34'), ('Update', '2026-09-25T18:39:34')]
````


### 5.11 Where login starts

#### access_probe.py (which related URLs redirect to login)

Source: `S/scripts/access_probe.py` (md5 `a45f50763f611bc5233f4b2cd460dd7e`). Status: **ran**.

````python
"""Where does Earthdata Login become necessary? (stdlib only, no credentials, redirects NOT followed)
For one GCOV granule taken from CMR, request each kind of related URL and print the HTTP status and, for redirects,
the redirect target host. Bodies are not downloaded (only the first bytes of small public files are read)."""
import json
import urllib.error
import urllib.parse
import urllib.request

UA = {"User-Agent": "nisar-search-verify/1.0"}
GRANULE = "NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001"


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


opener = urllib.request.build_opener(NoRedirect)


def probe(url, method="GET", extra=None):
    req = urllib.request.Request(url, headers={**UA, **(extra or {})}, method=method)
    try:
        r = opener.open(req, timeout=60)
        status, hdr = r.status, r.headers
        first = r.read(8) if method == "GET" else b""
        r.close()
    except urllib.error.HTTPError as e:
        status, hdr, first = e.code, e.headers, b""
    loc = hdr.get("Location")
    loc_short = None
    if loc:
        u = urllib.parse.urlparse(loc)
        loc_short = f"{u.scheme}://{u.netloc}{u.path}" + ("?<query omitted>" if u.query else "")
    return status, hdr.get("Content-Type"), hdr.get("Content-Length"), hdr.get("Content-Range"), loc_short, first


# 1. granule record from CMR (no login)
# (granule_ur alone gives HTTP 400: CMR insists on a collection-identifying condition such as provider or short_name)
q = urllib.parse.urlencode({"granule_ur": GRANULE, "provider": "ASF"})
with urllib.request.urlopen(urllib.request.Request(f"https://cmr.earthdata.nasa.gov/search/granules.umm_json?{q}", headers=UA), timeout=60) as r:
    item = json.load(r)["items"][0]
urls = item["umm"]["RelatedUrls"]
print("granule:", GRANULE, "| concept-id:", item["meta"]["concept-id"], "| related URLs:", len(urls))

seen_kinds = set()
for ru in urls:
    url = ru["URL"]
    if not url.startswith("https://"):
        continue
    tail = url.rsplit("/", 1)[-1].replace(GRANULE, "<G>")
    path_kind = urllib.parse.urlparse(url).path.split("/")[1]
    kind = (ru["Type"], path_kind, tail if tail.startswith("<G>") is False else tail.split("<G>")[1])
    if kind in seen_kinds:
        continue
    seen_kinds.add(kind)
    extra = {"Range": "bytes=0-7"}
    status, ctype, clen, crange, loc, first = probe(url, "GET", extra)
    print(f"\n[{ru['Type']}] /{path_kind}/.../{tail}")
    print(f"    GET (Range: bytes=0-7, no login, redirects not followed) -> HTTP {status} | Content-Type={ctype} | Content-Length={clen} | Content-Range={crange}")
    if loc:
        print(f"    redirect Location -> {loc}")
    if first:
        print(f"    first bytes: {first!r}")
````

What it printed (`S/out2/access_probe.txt`):

````text
granule: NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001 | concept-id: G4378438775-ASF | related URLs: 47

[GET DATA] /NISAR/.../<G>.h5
    GET (Range: bytes=0-7, no login, redirects not followed) -> HTTP 302 | Content-Type=application/json | Content-Length=0 | Content-Range=None
    redirect Location -> https://urs.earthdata.nasa.gov/oauth/authorize?<query omitted>

[GET RELATED VISUALIZATION] /BROWSE/.../<G>_LATLON.png
    GET (Range: bytes=0-7, no login, redirects not followed) -> HTTP 303 | Content-Type=application/json | Content-Length=0 | Content-Range=None
    redirect Location -> https://d1mv8zhcvry6x4.cloudfront.net/s3-7fdfbcb0ce308dc58d08f97acb1f0590/sds-n-cumulus-prod-nisar-browse.s3.us-west-2.amazonaws.com/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T22370 ...[cut]

[GET RELATED VISUALIZATION] /BROWSE/.../<G>_LATLON_thumbnail.png
    GET (Range: bytes=0-7, no login, redirects not followed) -> HTTP 303 | Content-Type=application/json | Content-Length=0 | Content-Range=None
    redirect Location -> https://d1mv8zhcvry6x4.cloudfront.net/s3-7fdfbcb0ce308dc58d08f97acb1f0590/sds-n-cumulus-prod-nisar-browse.s3.us-west-2.amazonaws.com/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T22370 ...[cut]

[GET RELATED VISUALIZATION] /BROWSE/.../<G>_NATIVE.png
    GET (Range: bytes=0-7, no login, redirects not followed) -> HTTP 303 | Content-Type=application/json | Content-Length=0 | Content-Range=None
    redirect Location -> https://d1mv8zhcvry6x4.cloudfront.net/s3-7fdfbcb0ce308dc58d08f97acb1f0590/sds-n-cumulus-prod-nisar-browse.s3.us-west-2.amazonaws.com/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T22370 ...[cut]

[GET RELATED VISUALIZATION] /BROWSE/.../<G>_NATIVE_A_HHHH.png
    GET (Range: bytes=0-7, no login, redirects not followed) -> HTTP 303 | Content-Type=application/json | Content-Length=0 | Content-Range=None
    redirect Location -> https://d1mv8zhcvry6x4.cloudfront.net/s3-7fdfbcb0ce308dc58d08f97acb1f0590/sds-n-cumulus-prod-nisar-browse.s3.us-west-2.amazonaws.com/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T22370 ...[cut]

[GET RELATED VISUALIZATION] /BROWSE/.../<G>_NATIVE_A_HVHV.png
    GET (Range: bytes=0-7, no login, redirects not followed) -> HTTP 303 | Content-Type=application/json | Content-Length=0 | Content-Range=None
    redirect Location -> https://d1mv8zhcvry6x4.cloudfront.net/s3-7fdfbcb0ce308dc58d08f97acb1f0590/sds-n-cumulus-prod-nisar-browse.s3.us-west-2.amazonaws.com/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T22370 ...[cut]

[GET RELATED VISUALIZATION] /BROWSE/.../<G>_NATIVE_B_HHHH.png
    GET (Range: bytes=0-7, no login, redirects not followed) -> HTTP 303 | Content-Type=application/json | Content-Length=0 | Content-Range=None
    redirect Location -> https://d1mv8zhcvry6x4.cloudfront.net/s3-7fdfbcb0ce308dc58d08f97acb1f0590/sds-n-cumulus-prod-nisar-browse.s3.us-west-2.amazonaws.com/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T22370 ...[cut]

[GET RELATED VISUALIZATION] /BROWSE/.../<G>_NATIVE_B_HVHV.png
    GET (Range: bytes=0-7, no login, redirects not followed) -> HTTP 303 | Content-Type=application/json | Content-Length=0 | Content-Range=None
    redirect Location -> https://d1mv8zhcvry6x4.cloudfront.net/s3-7fdfbcb0ce308dc58d08f97acb1f0590/sds-n-cumulus-prod-nisar-browse.s3.us-west-2.amazonaws.com/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T22370 ...[cut]

[EXTENDED METADATA] /NISAR/.../<G>.h5.iso.xml
    GET (Range: bytes=0-7, no login, redirects not followed) -> HTTP 302 | Content-Type=application/json | Content-Length=0 | Content-Range=None
    redirect Location -> https://urs.earthdata.nasa.gov/oauth/authorize?<query omitted>

[EXTENDED METADATA] /NISAR/.../<G>.rc.yaml
    GET (Range: bytes=0-7, no login, redirects not followed) -> HTTP 302 | Content-Type=application/json | Content-Length=0 | Content-Range=None
    redirect Location -> https://urs.earthdata.nasa.gov/oauth/authorize?<query omitted>

[EXTENDED METADATA] /NISAR/.../<G>_LATLON.kml
    GET (Range: bytes=0-7, no login, redirects not followed) -> HTTP 302 | Content-Type=application/json | Content-Length=0 | Content-Range=None
    redirect Location -> https://urs.earthdata.nasa.gov/oauth/authorize?<query omitted>

[EXTENDED METADATA] /NISAR/.../<G>_NATIVE.kml
    GET (Range: bytes=0-7, no login, redirects not followed) -> HTTP 302 | Content-Type=application/json | Content-Length=0 | Content-Range=None
    redirect Location -> https://urs.earthdata.nasa.gov/oauth/authorize?<query omitted>

[EXTENDED METADATA] /NISAR/.../<G>_NATIVE_A_HHHH.kml
    GET (Range: bytes=0-7, no login, redirects not followed) -> HTTP 302 | Content-Type=application/json | Content-Length=0 | Content-Range=None
    redirect Location -> https://urs.earthdata.nasa.gov/oauth/authorize?<query omitted>

[EXTENDED METADATA] /NISAR/.../<G>_NATIVE_A_HVHV.kml
    GET (Range: bytes=0-7, no login, redirects not followed) -> HTTP 302 | Content-Type=application/json | Content-Length=0 | Content-Range=None
    redirect Location -> https://urs.earthdata.nasa.gov/oauth/authorize?<query omitted>

[EXTENDED METADATA] /NISAR/.../<G>_NATIVE_B_HHHH.kml
    GET (Range: bytes=0-7, no login, redirects not followed) -> HTTP 302 | Content-Type=application/json | Content-Length=0 | Content-Range=None
    redirect Location -> https://urs.earthdata.nasa.gov/oauth/authorize?<query omitted>

[EXTENDED METADATA] /NISAR/.../<G>_NATIVE_B_HVHV.kml
    GET (Range: bytes=0-7, no login, redirects not followed) -> HTTP 302 | Content-Type=application/json | Content-Length=0 | Content-Range=None
    redirect Location -> https://urs.earthdata.nasa.gov/oauth/authorize?<query omitted>

[VIEW RELATED INFORMATION] /NISAR/.../<G>_QA_REPORT.pdf
    GET (Range: bytes=0-7, no login, redirects not followed) -> HTTP 302 | Content-Type=application/json | Content-Length=0 | Content-Range=None
    redirect Location -> https://urs.earthdata.nasa.gov/oauth/authorize?<query omitted>

[VIEW RELATED INFORMATION] /NISAR/.../<G>_QA_STATS.h5
    GET (Range: bytes=0-7, no login, redirects not followed) -> HTTP 302 | Content-Type=application/json | Content-Length=0 | Content-Range=None
    redirect Location -> https://urs.earthdata.nasa.gov/oauth/authorize?<query omitted>

[VIEW RELATED INFORMATION] /NISAR/.../<G>_QA_SUMMARY.csv
    GET (Range: bytes=0-7, no login, redirects not followed) -> HTTP 302 | Content-Type=application/json | Content-Length=0 | Content-Range=None
    redirect Location -> https://urs.earthdata.nasa.gov/oauth/authorize?<query omitted>

[EXTENDED METADATA] /NISAR-JPL-PRIVATE-DATA/.../<G>.context.json
    GET (Range: bytes=0-7, no login, redirects not followed) -> HTTP 302 | Content-Type=application/json | Content-Length=0 | Content-Range=None
    redirect Location -> https://urs.earthdata.nasa.gov/oauth/authorize?<query omitted>

[EXTENDED METADATA] /NISAR-JPL-PRIVATE-DATA/.../<G>.dataset.json
    GET (Range: bytes=0-7, no login, redirects not followed) -> HTTP 302 | Content-Type=application/json | Content-Length=0 | Content-Range=None
    redirect Location -> https://urs.earthdata.nasa.gov/oauth/authorize?<query omitted>

[EXTENDED METADATA] /NISAR-JPL-PRIVATE-DATA/.../<G>.h5.log
    GET (Range: bytes=0-7, no login, redirects not followed) -> HTTP 302 | Content-Type=application/json | Content-Length=0 | Content-Range=None
    redirect Location -> https://urs.earthdata.nasa.gov/oauth/authorize?<query omitted>

[EXTENDED METADATA] /NISAR-JPL-PRIVATE-DATA/.../<G>.met.json
    GET (Range: bytes=0-7, no login, redirects not followed) -> HTTP 302 | Content-Type=application/json | Content-Length=0 | Content-Range=None
    redirect Location -> https://urs.earthdata.nasa.gov/oauth/authorize?<query omitted>

[VIEW RELATED INFORMATION] /s3credentials/.../s3credentials
    GET (Range: bytes=0-7, no login, redirects not followed) -> HTTP 302 | Content-Type=application/json | Content-Length=0 | Content-Range=None
    redirect Location -> https://urs.earthdata.nasa.gov/oauth/authorize?<query omitted>
````

(Output shortened for this digest: long lines cut at 260 characters. Full file: `S/out2/access_probe.txt`.)


#### browse_probe.py (browse PNGs are public)

Source: `S/scripts/browse_probe.py` (md5 `31bef41b49b898114fa61ae3f725c1e8`). Status: **ran**.

````python
"""Are the browse PNGs really public? (stdlib only, no credentials, redirects followed)
Downloads the thumbnail fully and only the first bytes (Range request) of the larger browse images, then reads the
PNG header (signature + IHDR width/height). Saves the thumbnail into downloads/browse/."""
import os
import struct
import sys
import urllib.request

UA = {"User-Agent": "nisar-search-verify/1.0"}
G = "NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001"
BASE = f"https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1/{G}/{G}"
OUT = sys.argv[1] if len(sys.argv) > 1 else "downloads/browse"
os.makedirs(OUT, exist_ok=True)


def png_info(b):
    if b[:8] != b"\x89PNG\r\n\x1a\n":
        return "NOT A PNG: " + repr(b[:16])
    w, h, depth, ctype = struct.unpack(">IIBB", b[16:26])
    return f"PNG {w}x{h} px, bit depth {depth}, colour type {ctype} ({ {0:'grey',2:'RGB',3:'palette',4:'grey+alpha',6:'RGBA'}.get(ctype) })"


for suffix, full in (("_LATLON_thumbnail.png", True), ("_LATLON.png", False), ("_NATIVE.png", False), ("_NATIVE_A_HHHH.png", False)):
    url = BASE + suffix
    headers = dict(UA) if full else {**UA, "Range": "bytes=0-63"}
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=120) as r:
        body = r.read()
        final_host = urllib.request.urlparse(r.geturl()).netloc
        print(f"{suffix}: HTTP {r.status} via {final_host} | Content-Type={r.headers.get('Content-Type')} | "
              f"Content-Length={r.headers.get('Content-Length')} | Content-Range={r.headers.get('Content-Range')} | "
              f"Access-Control-Allow-Origin={r.headers.get('Access-Control-Allow-Origin')}")
        print("   ", png_info(body), "| bytes read:", len(body))
    if full:
        path = os.path.join(OUT, "thumbnail.png")
        with open(path, "wb") as f:
            f.write(body)
        print("    saved", path)
````

What it printed (`S/out2/browse_probe.txt`):

````text
_LATLON_thumbnail.png: HTTP 200 via d1mv8zhcvry6x4.cloudfront.net | Content-Type=binary/octet-stream | Content-Length=14600 | Content-Range=None | Access-Control-Allow-Origin=None
    PNG 100x100 px, bit depth 8, colour type 2 (RGB) | bytes read: 14600
    saved downloads2/browse/thumbnail.png
_LATLON.png: HTTP 206 via d1mv8zhcvry6x4.cloudfront.net | Content-Type=binary/octet-stream | Content-Length=64 | Content-Range=bytes 0-63/4247472 | Access-Control-Allow-Origin=None
    PNG 1880x1847 px, bit depth 8, colour type 2 (RGB) | bytes read: 64
_NATIVE.png: HTTP 206 via d1mv8zhcvry6x4.cloudfront.net | Content-Type=binary/octet-stream | Content-Length=64 | Content-Range=bytes 0-63/4727200 | Access-Control-Allow-Origin=None
    PNG 1880x1840 px, bit depth 8, colour type 2 (RGB) | bytes read: 64
_NATIVE_A_HHHH.png: HTTP 206 via d1mv8zhcvry6x4.cloudfront.net | Content-Type=binary/octet-stream | Content-Length=64 | Content-Range=bytes 0-63/1601869 | Access-Control-Allow-Origin=None
    PNG 1880x1840 px, bit depth 8, colour type 0 (grey) | bytes read: 64
````


`Access-Control-Allow-Origin=None` above is because this script sent no `Origin` header; with one, both hops answer `*` (see `extra_checks.py` in the Appendix and the `curl` probe A.20b).

#### unauth_read_probe.py (what a read without login looks like)

Source: `S/scripts/unauth_read_probe.py` (md5 `c9603eb0a89a8280742d9a6781262b9d`). Status: **ran**.

````python
"""What does an UNAUTHENTICATED partial read of the .h5 data URL look like from Python? (no credentials)
Shows the failure signature the team will see if login is missing: fsspec info() vs read, requests, urllib."""
import urllib.error
import urllib.request

import fsspec
import requests

UA = {"User-Agent": "nisar-search-verify/1.0"}
G = "NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001"
URL = f"https://nisar.asf.earthdatacloud.nasa.gov/NISAR/NISAR_L2_GCOV_PROVISIONAL_V1/{G}/{G}.h5"

print("### fsspec", fsspec.__version__, "(aiohttp), no credentials")
fs = fsspec.filesystem("https", client_kwargs={"headers": UA, "trust_env": False})
for label, fn in (("fs.exists(url)", lambda: fs.exists(URL)),
                  ("fs.info(url)", lambda: {k: v for k, v in fs.info(URL).items() if k in ("size", "type", "mimetype")}),
                  ("fs.cat_file(url, start=0, end=8)", lambda: fs.cat_file(URL, start=0, end=8)),
                  ("fs.open(url).read(8)", lambda: fs.open(URL, cache_type="background", block_size=4 * 1024 * 1024).read(8))):
    try:
        out = fn()
        print(f"  {label} -> {out!r}"[:300])
    except BaseException as exc:  # noqa: BLE001
        print(f"  {label} -> {type(exc).__module__}.{type(exc).__name__}: {str(exc)[:220]}")

print("### requests", requests.__version__, "GET with Range: bytes=0-7, redirects followed, no credentials")
s = requests.Session()
s.trust_env = False  # do not read any netrc / proxy settings
r = s.get(URL, headers={**UA, "Range": "bytes=0-7"}, timeout=60, stream=True)
print("  final status:", r.status_code, "| final host:", requests.utils.urlparse(r.url).netloc, "| path:", requests.utils.urlparse(r.url).path,
      "| Content-Type:", r.headers.get("Content-Type"), "| redirect chain:", [(h.status_code, requests.utils.urlparse(h.url).netloc) for h in r.history])
print("  first 8 bytes of body:", r.raw.read(8))
r.close()

print("### urllib GET with Range: bytes=0-7, redirects followed, no credentials")
try:
    with urllib.request.urlopen(urllib.request.Request(URL, headers={**UA, "Range": "bytes=0-7"}), timeout=60) as resp:
        print("  status:", resp.status, "| final host:", urllib.request.urlparse(resp.geturl()).netloc, "| Content-Type:", resp.headers.get("Content-Type"),
              "| first 8 bytes:", resp.read(8))
except urllib.error.HTTPError as e:
    print("  HTTPError", e.code, e.reason, "| final host:", urllib.request.urlparse(e.geturl()).netloc, "| WWW-Authenticate:", e.headers.get("WWW-Authenticate"))
````

What it printed (`S/out2/unauth_read_probe.txt`):

````text
### fsspec 2026.9.0 (aiohttp), no credentials
  fs.exists(url) -> False
  fs.info(url) -> {'size': 1900019712, 'mimetype': 'binary/octet-stream', 'type': 'file'}
  fs.cat_file(url, start=0, end=8) -> aiohttp.client_exceptions.ClientResponseError: 401, message='Unauthorized', url='https://urs.earthdata.nasa.gov/oauth/authorize?client_id=qpa3q_b7OJ32gGjwA9DxHg&response_type=code&redirect_uri=https://nisar.asf.earthdatacloud.nasa.gov/login&state=/NISAR/NISAR_L2_GCOV
  fs.open(url).read(8) -> aiohttp.client_exceptions.ClientResponseError: 401, message='Unauthorized', url='https://urs.earthdata.nasa.gov/oauth/authorize?client_id=qpa3q_b7OJ32gGjwA9DxHg&response_type=code&redirect_uri=https://nisar.asf.earthdatacloud.nasa.gov/login&state=/NISAR/NISAR_L2_GCOV
### requests 2.34.2 GET with Range: bytes=0-7, redirects followed, no credentials
  final status: 401 | final host: urs.earthdata.nasa.gov | path: /oauth/authorize | Content-Type: text/html; charset=utf-8 | redirect chain: [(302, 'nisar.asf.earthdatacloud.nasa.gov')]
  first 8 bytes of body: b'HTTP Bas'
### urllib GET with Range: bytes=0-7, redirects followed, no credentials
  HTTPError 401 Unauthorized | final host: urs.earthdata.nasa.gov | WWW-Authenticate: Basic realm="Please enter your Earthdata Login credentials. If you do not have a Earthdata Login, create one at https://urs.earthdata.nasa.gov//users/new"
````


### 5.12 NOT RUN: log in without a prompt and open one remote file

The agent wrote this from the `earthaccess` 0.19.0 source and documentation. It was parsed for syntax only (`untested_login_and_open.py: syntax OK (parsed only, NOT executed)`). Its search call alone was run, as the second script below.

#### untested_login_and_open.py

Source: `S/scripts/untested_login_and_open.py` (md5 `44cec48452f336ded5d1f95f81e8ef7c`). Status: **NOT RUN (syntax-checked only)**.

````python
"""UNTESTED: no Earthdata Login credentials were available, so this was never run end to end.
Assembled from the earthaccess 0.19.0 source and documentation. Log in without a prompt, then open one remote
GCOV .h5 for partial (HTTP range) reads."""
import earthaccess
import h5py  # pip install h5py (earthaccess does not install it)

# strategy="environment": EARTHDATA_TOKEN, or EARTHDATA_USERNAME + EARTHDATA_PASSWORD (a token takes precedence)
# strategy="netrc": ~/.netrc, or the file named by $NETRC, holding
#     machine urs.earthdata.nasa.gov login <username> password <password>
# With no strategy, login() tries environment, then netrc, then an interactive prompt (which blocks on a server).
earthaccess.login(strategy="environment")

granules = earthaccess.search_data(
    short_name=["NISAR_L2_GCOV_PROVISIONAL_V1", "NISAR_L2_GCOV_V1"],
    point=(104.05, 12.95),
    temporal=("2026-10-01", "2026-11-13"),
    granule_name="NISAR_L2_PR_GCOV_*_083_A_008_*_F_J_*",  # full frames of track 083, Ascending, frame 008
)

# Option A: earthaccess.open returns fsspec file-like objects (HTTPS when not running in AWS us-west-2).
files = earthaccess.open(granules[:1])
with h5py.File(files[0], "r") as h5:
    print(list(h5.keys()))

# Option B: an fsspec HTTPS filesystem that carries the Earthdata bearer token, with explicit cache settings.
fs = earthaccess.get_fsspec_https_session()
url = granules[0].data_links(access="external")[0]
with fs.open(url, cache_type="background", block_size=16 * 1024 * 1024) as f, h5py.File(f, "r") as h5:
    print(list(h5.keys()))
````


#### untested_search_part_check.py (only the search call of the script above)

Source: `S/scripts/untested_search_part_check.py` (md5 `4dbb87904b33eec76e117dd368c1666b`). Status: **ran**.

````python
"""Runs ONLY the search call of scripts/untested_login_and_open.py (no login) to confirm that part returns granules."""
import earthaccess

granules = earthaccess.search_data(
    short_name=["NISAR_L2_GCOV_PROVISIONAL_V1", "NISAR_L2_GCOV_V1"],
    point=(104.05, 12.95),
    temporal=("2026-10-01", "2026-11-13"),
    granule_name="NISAR_L2_PR_GCOV_*_083_A_008_*_F_J_*",  # full frames of track 083, Ascending, frame 008
)
print(len(granules), "granules; logged in:", earthaccess.__auth__.authenticated)
for g in granules:
    print("  ", g.data_links(access="external")[0].rsplit("/", 1)[-1])
````

What it printed (`S/out2/untested_search_part_check.txt`):

````text
3 granules; logged in: False
   NISAR_L2_PR_GCOV_032_083_A_008_2005_DHDH_M_20261005T223633_20261005T223708_P05023_N_F_J_001.h5
   NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001.h5
   NISAR_L2_PR_GCOV_034_083_A_008_2005_DHDH_M_20261029T223634_20261029T223708_P05036_N_F_J_001.h5
````


### 5.13 NOT RUN: sketch D1 revised in the light of this evidence

Written for this digest, not by the interrupted run, and never executed. It is the brief's D1 plus: a server-side full-frame filter, an error check, a full parse of the granule name, exclusion of inherited links, and the selection rule of recommendation R3.

````js
// NOT RUN (neither in a browser nor in Node). The brief's D1 with the gaps closed that the search run exposed.
// Checked offline only: the NAME regex matches all 75 GCOV granule names in the saved outputs, and every
// field read below exists in the saved granules.json response (Section 6.2).
const RELEASE = { 'C3622241360-ASF': 'validated', 'C2854338529-ASF': 'provisional' }; // beta is C3622214170-ASF: add only on purpose
const RANK = { validated: 2, provisional: 1, beta: 0 };
const NAME = /^NISAR_L2_(PR|UR|OD)_GCOV_(\d{3})_(\d{3})_([AD])_(\d{3})_(\d{4})_(\w{4})_([AM])_(\d{8}T\d{6})_(\d{8}T\d{6})_([A-Z]\d{5})_([PMNF])_([FP])_J_(\d{3})$/;

export async function nisarGranules(lon, lat, { fullFrameOnly = true } = {}) {
  const p = new URLSearchParams({ point: `${lon},${lat}`, page_size: '2000', sort_key: 'start_date' });
  Object.keys(RELEASE).forEach((c) => p.append('collection_concept_id', c)); // this repeated form is the brief's; see open question 2
  if (fullFrameOnly) p.append('attribute[]', 'string,FULL_FRAME,TRUE');      // drops partial-frame granules server-side
  const res = await fetch(`https://cmr.earthdata.nasa.gov/search/granules.json?${p}`);
  if (!res.ok) throw new Error(`CMR ${res.status}: ${await res.text()}`);     // errors are {"errors":[...]} with HTTP 400
  const { feed } = await res.json();
  return feed.entry.flatMap((e) => {
    const m = e.title.match(NAME);
    if (!m) return [];
    const https = (rel) => e.links
      .filter((l) => l.rel.endsWith(rel) && l.href.startsWith('https') && !l.inherited)
      .map((l) => l.href);
    const stack = `${m[3]}_${m[4]}_${m[5]}`;
    return [{
      name: e.title,
      start: e.time_start,                 // "2026-10-17T22:36:33.000Z"
      date: e.time_start.slice(0, 10),     // UTC calendar date
      passKey: `${stack}|${m[9]}`,         // stack + start second: the same for duplicates and for mode variants
      release: RELEASE[e.collection_concept_id],
      pipeline: m[1], cycle: m[2], stack,
      mode: m[6], pol: m[7], mixedMode: m[8] === 'M', version: m[11],
      fullFrame: m[13] === 'F', counter: Number(m[14]),
      polygon: e.polygons?.[0]?.[0],       // "lat lon lat lon ..."
      h5: https('data#').find((h) => h.endsWith('.h5')), // needs Earthdata Login
      browse: https('browse#'),            // seven PNGs; choose by suffix, e.g. h.endsWith('_LATLON.png')
    }];
  });
}

// One granule per pass: validated over provisional over beta, then the wanted polarization, then the highest counter.
// Use it on full-frame results: a partial granule can share its start second with the full one of the same pass.
export function onePerPass(granules, wantPol = 'DH') {
  const score = (g) => [RANK[g.release] ?? -1, g.pol.startsWith(wantPol) || g.pol.startsWith('QP') ? 1 : 0, g.counter];
  const better = (a, b) => {
    const x = score(a), y = score(b);
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] > y[i];
    return false;
  };
  const best = new Map();
  for (const g of granules) {
    if (g.pipeline !== 'PR') continue;
    if (!best.has(g.passKey) || better(g, best.get(g.passKey))) best.set(g.passKey, g);
  }
  return [...best.values()].sort((a, b) => a.start.localeCompare(b.start));
}
````

### 5.14 Request URLs that returned data

With `curl -g` the brackets and commas were sent literally; `urllib.parse.urlencode` percent-encodes them and that worked too. `URLSearchParams` in a browser encodes the same way, but no browser request was made.

- `https://cmr.earthdata.nasa.gov/search/granules.json?short_name[]=NISAR_L2_GCOV_PROVISIONAL_V1&short_name[]=NISAR_L2_GCOV_V1&attribute[]=string,STACK_ID,083_A_008&attribute[]=string,FULL_FRAME,TRUE&page_size=50` gave 11 entries (saved as `S/downloads/cmr_json/stack_full.json`).
- `https://cmr.earthdata.nasa.gov/search/granules.umm_json?short_name[]=NISAR_L2_GCOV_BETA_V1&short_name[]=NISAR_L2_GCOV_PROVISIONAL_V1&short_name[]=NISAR_L2_GCOV_V1&attribute[]=string,STACK_ID,083_A_008&point=104.05,12.95&page_size=100` gave 11 items (`S/out2/cmr_probe_01.txt`, query B, sent percent-encoded).
- `https://cmr.earthdata.nasa.gov/search/granules.umm_json?provider=ASF&attribute[]=string,STACK_ID,083_A_008&page_size=5` gave `cmr-hits: 147` (RSLC, GSLC, GCOV and other product types of the stack).
- `https://cmr.earthdata.nasa.gov/search/granules.umm_json?granule_ur=<granule name>&provider=ASF` gave one record.
- `https://cmr.earthdata.nasa.gov/search/collections.umm_json?short_name=NISAR_L2_GCOV*&options[short_name][pattern]=true&page_size=50` listed the three GCOV collections.
- `https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1/<G>/<G>_LATLON.png` with `<G>` = `NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001` gave a 1880 x 1847 PNG with no login.

---

## 6. Reference

### 6.1 URL patterns observed

| What | Pattern | Login |
|---|---|---|
| Data, HTTPS | `https://nisar.asf.earthdatacloud.nasa.gov/NISAR/<collection short name>/<granule>/<granule>.h5` | yes for GET; HEAD works without |
| Data, S3 | `s3://sds-n-cumulus-prod-nisar-products/<collection short name>/<granule>/<granule>.h5` | AWS us-west-2 only; credentials from `https://nisar.asf.earthdatacloud.nasa.gov/s3credentials` (login) |
| Browse | `https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/<collection short name>/<granule>/<granule>_LATLON.png`, also `_LATLON_thumbnail.png`, `_NATIVE.png`, `_NATIVE_A_HHHH.png`, `_NATIVE_A_HVHV.png`, `_NATIVE_B_HHHH.png`, `_NATIVE_B_HVHV.png` (for a dual-pol two-band granule) | no |
| Per-granule extras | same folder as the data: `<granule>.h5.iso.xml`, `.rc.yaml`, `_LATLON.kml`, `_NATIVE*.kml`, `_QA_REPORT.pdf`, `_QA_STATS.h5`, `_QA_SUMMARY.csv` | yes |
| Urgent-response data | `https://nisar.asf.earthdatacloud.nasa.gov/NISAR-UR/UR_L2_L_GCOV/<granule>/<granule>.h5` | not probed |

Collections: `NISAR_L2_GCOV_BETA_V1` = `C3622214170-ASF`; `NISAR_L2_GCOV_PROVISIONAL_V1` = `C2854338529-ASF`;
`NISAR_L2_GCOV_V1` = `C3622241360-ASF`; `NISAR_UR_L2` = `C2887502657-ASF` (all four listed by CMR and by
`earthaccess.search_datasets(keyword="NISAR GCOV")`). Also seen in results: provisional GSLC
`C2854332392-ASF`, provisional RSLC `C2853145197-ASF`.

An inherited `documentation#` link on every GCOV granule points at the Level 2 GCOV product specification:
`https://cumulus.asf.earthdatacloud.nasa.gov/PUBLIC/DATA/NISAR/NISAR_D-102274_RevF_NASA_SDS_Product_Specification_L2_GCOV_w-esigs.pdf`
(the link was seen in `S/downloads/cmr_json/stack_full.json`; it was not fetched).

### 6.2 One `granules.json` entry (from `S/downloads/cmr_json/stack_full.json`)

Fetched in attempt 2 with
`curl -sS -g --compressed -A "nisar-search-verify/1.0" "https://cmr.earthdata.nasa.gov/search/granules.json?short_name[]=NISAR_L2_GCOV_PROVISIONAL_V1&short_name[]=NISAR_L2_GCOV_V1&attribute[]=string,STACK_ID,083_A_008&attribute[]=string,FULL_FRAME,TRUE&page_size=50"`
(11 entries). The top level is `{"feed": {"updated": ..., "id": ..., "title": ..., "entry": [...]}}`. The first
entry, with `links` shortened to the first six and `<G>` standing for the granule name
`NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223637_20260619T223711_P05023_N_F_J_001`:

```json
{
  "browse_flag": true,
  "collection_concept_id": "C2854338529-ASF",
  "coordinate_system": "CARTESIAN",
  "data_center": "ASF",
  "dataset_id": "NISAR Provisional Geocoded Polarimetric Covariance Product (Version 1)",
  "day_night_flag": "UNSPECIFIED",
  "granule_size": "1777.8144416809082",
  "id": "G4250743928-ASF",
  "online_access_flag": true,
  "orbit_calculated_spatial_domains": [{"orbit_number": "4680"}],
  "original_format": "UMM_JSON",
  "polygons": [["12.07019 105.39936 14.15457 104.89399 13.61372 102.62722 11.53813 103.14859 12.07019 105.39936"]],
  "producer_granule_id": "<G>",
  "time_end": "2026-06-19T22:37:11.999Z",
  "time_start": "2026-06-19T22:36:37.000Z",
  "title": "<G>",
  "updated": "2026-07-17T18:06:18.450Z",
  "links": [
    {"rel": "http://esipfed.org/ns/fedsearch/1.1/data#", "hreflang": "en-US", "title": "Download <G>.h5",
     "href": "https://nisar.asf.earthdatacloud.nasa.gov/NISAR/NISAR_L2_GCOV_PROVISIONAL_V1/<G>/<G>.h5"},
    {"rel": "http://esipfed.org/ns/fedsearch/1.1/s3#", "hreflang": "en-US",
     "title": "This link provides direct download access via S3 to <G>.h5",
     "href": "s3://sds-n-cumulus-prod-nisar-products/NISAR_L2_GCOV_PROVISIONAL_V1/<G>/<G>.h5"},
    {"rel": "http://esipfed.org/ns/fedsearch/1.1/browse#", "hreflang": "en-US", "title": "Download <G>_LATLON.png",
     "href": "https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1/<G>/<G>_LATLON.png"},
    {"rel": "http://esipfed.org/ns/fedsearch/1.1/browse#", "hreflang": "en-US",
     "title": "This link provides direct download access via S3 to <G>_LATLON.png",
     "href": "s3://sds-n-cumulus-prod-nisar-browse/NISAR_L2_GCOV_PROVISIONAL_V1/<G>/<G>_LATLON.png"},
    {"rel": "http://esipfed.org/ns/fedsearch/1.1/browse#", "hreflang": "en-US", "title": "Download <G>_LATLON_thumbnail.png",
     "href": "https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1/<G>/<G>_LATLON_thumbnail.png"},
    {"rel": "http://esipfed.org/ns/fedsearch/1.1/browse#", "hreflang": "en-US",
     "title": "This link provides direct download access via S3 to <G>_LATLON_thumbnail.png",
     "href": "s3://sds-n-cumulus-prod-nisar-browse/NISAR_L2_GCOV_PROVISIONAL_V1/<G>/<G>_LATLON_thumbnail.png"}
  ]
}
```

The remaining 46 links of that entry: 10 more `browse#` (`_NATIVE.png`, `_NATIVE_A_HHHH.png`, `_NATIVE_A_HVHV.png`,
`_NATIVE_B_HHHH.png`, `_NATIVE_B_HVHV.png`, each as HTTPS and `s3://`), 32 `metadata#` (`.h5.iso.xml`, `.rc.yaml`,
`.kml` files and others, HTTPS and `s3://`), and four inherited collection-level links:
`data#` `https://search.asf.alaska.edu/`, `data#` `https://search.earthdata.nasa.gov/search/granules?p=C2854338529-ASF`,
`documentation#` `https://nisar-docs.asf.alaska.edu/gcov/`, `documentation#` the product specification PDF above.
The HTTPS `browse#` links arrive in this order: `_LATLON.png`, `_LATLON_thumbnail.png`, `_NATIVE.png`,
`_NATIVE_A_HHHH.png`, `_NATIVE_A_HVHV.png`, `_NATIVE_B_HHHH.png`, `_NATIVE_B_HVHV.png`.

### 6.3 `asf_search` result properties for a NISAR GCOV product (`S/out2/asf_explore_02.txt`)

`p.properties` of class `NISARProduct`: `sceneName` and `fileID` (granule name), `fileName` (`<granule>.h5`),
`startTime` and `stopTime` (`2026-10-17T22:36:33Z`), `pathNumber` (track, int 83), `frameNumber` (int 8),
`flightDirection` (`ASCENDING`), `processingLevel` (`GCOV`), `mainBandPolarization` (list, `['HH', 'HV']`; empty
on the 10 of 519 results that have no frequency A), `sideBandPolarization`, `rangeBandwidth` (list holding one
string, `['20+5']`), `frameCoverage` (`Full` or `Partial`), `productionConfiguration` (`PR` or `UR`),
`collectionName` (short name), `conceptID` (collection concept id), `crid` (`P05023`), `orbitType` (`MOE`),
`pgeVersion` (`R05.02.3`), `processingDate`, `orbit` (6410), `sensor` (`L-SAR`), `platform` (`NISAR`), `url` (HTTPS
`.h5`), `s3Urls`, `browse` (list of HTTPS PNG URLs), `additionalUrls`, `bytes`
(`{file name: {"bytes": int, "format": str}}`, so the `.h5` size is `q["bytes"][q["fileName"]]["bytes"]`),
`groupID`, `jointObservation`. Always `None` for NISAR: `polarization`, `centerLat`, `centerLon`, `md5sum`,
`granuleType`, `beamModeType`. `p.geometry` is a GeoJSON polygon in (lon, lat); `p.meta["concept-id"]` is the
granule concept id; `p.umm` is the raw UMM-G record. The result list has `geojson()`, `csv()`, `kml()`,
`searchComplete`, `raise_if_incomplete()`.

### 6.4 `asf_search` 14.1.0 constants (`S/out2/asf_constants.txt`, verbatim)

````text
asf_search 14.1.0
asf.DATASET: {'NISAR': 'NISAR', 'NISAR_SCIENCE_PRODUCTS': 'NISAR-SCIENCE-PRODUCTS'}
asf.PLATFORM: {'NISAR': 'NISAR'}
asf.PRODUCT_TYPE: {'RRSD': 'RRSD', 'RSLC': 'RSLC', 'RIFG': 'RIFG', 'RUNW': 'RUNW', 'ROFF': 'ROFF', 'GSLC': 'GSLC', 'GCOV': 'GCOV', 'GUNW': 'GUNW', 'GOFF': 'GOFF', 'SME2': 'SME2'}
asf.FLIGHT_DIRECTION: {'ASCENDING': 'ASCENDING', 'DESCENDING': 'DESCENDING'}
asf.PRODUCTION_CONFIGURATION: {'PRODUCTION': 'PR', 'URGENT_RESPONSE': 'UR', 'CUSTOM': 'OD'}
asf.RANGE_BANDWIDTH: {'BW_20': '20', 'BW_40': '40', 'BW_20_5': '20+5', 'BW_40_5': '40+5', 'BW_77': '77', 'BW_5': '5', 'BW_5_5': '5+5', 'BW_10': '10', 'BW_25': '25', 'BW_37': '37', 'BW_75': '75'}
asf.POLARIZATION: {'HH': 'HH', 'VV': 'VV', 'VV_VH': 'VV+VH', 'HH_HV': 'HH+HV', 'QUAD': 'quadrature', 'HH_HV_VH_VV': 'HH+HV+VH+VV'}
asf.constants.MATURITIES: {'BETA': 'BETA', 'PROVISIONAL': 'PROVISIONAL', 'VALIDATED': 'VALIDATED'}
asf.constants.INTERNAL.CMR_PAGE_SIZE = 250 | CMR_TIMEOUT = 30
asf.REPORT_ERRORS default = True
asf.search signature keywords: ['absoluteOrbit', 'asfFrame', 'beamMode', 'beamSwath', 'campaign', 'siteDescription', 'dataMaturity', 'maxDoppler', 'minDoppler', 'end', 'maxFaradayRotation', 'minFaradayRotation', 'flightDirection', 'flightLine', 'frame', 'granule_list', 'groupID', 'insarStackId', 'instrument', 'intersectsWith', 'lookDirection', 'offNadirAngle', 'platform', 'polarization', 'processingDate', 'processingLevel', 'product_list', 'relativeOrbit', 'season', 'start', 'ariaVersion', 'absoluteBurstID', 'relativeBurstID', 'fullBurstID', 'temporalBaselineDays', 'operaBurstID', 'frameCoverage', 'mainBandPolarization', 'sideBandPolarization', 'rangeBandwidth', 'jointObservation', 'productionConfiguration', 'dataset', 'collections', 'shortName', 'cmr_keywords', 'maxResults', 'tileID', 'session', 'opts']
````

Maturity constants are not top-level: `hasattr(asf, 'PROVISIONAL') = False`; use the strings or
`asf.constants.PROVISIONAL` (`S/out2/asf_explore_04.txt`). Spatial input: `intersectsWith=<WKT>` only;
`asf.search(point=...)` and `asf.search(bbox=...)` raise `TypeError`, although
`asf.ASFSearchOptions(point=[lon, lat])`, `bbox=[w, s, e, n]` and `circle=[lon, lat, radius_m]` are accepted
(`S/out2/asf_explore_08.txt`).

### 6.5 Granule name fields ([docs], `https://nisar-docs.asf.alaska.edu/gcov/`, saved text `S/docs2_text/nisar_gcov.txt`)

`NISAR_IL_PT_PROD_CYL_REL_P_FRM_MODE_POLE_S_StartDateTime_EndDateTime_CRID_A_C_LOC_CTR.EXT`:
`I` instrument (`L`), `L` level, `PT` processing type (`PR` production, `UR` urgent response, `OD` science
on-demand), `PROD` product, `CYL` 12-day cycle from 001, `REL` track 001 to 173, `P` direction `A` or `D`, `FRM`
frame 001 to 176, `MODE` two digits per band ("Possible values: 40, 20, 77, 05, or 00"; "00 only used if the
secondary band is missing"), `POLE` two letters per band (`SH` HH, `SV` VV, `DH` HH/HV, `DV` VV/VH, `CL`, `CR`
compact, `QP` quad, `NA` band absent), `S` source (`A` single mode, `M` mixed mode), start and end
`YYYYMMDDTHHMMSS` UTC, `CRID` version, `A` orbit fidelity (`P` precise, `M` medium, `N` near real-time, `F`
forecast), `C` coverage (`F` full, `P` partial), `LOC` (`J` JPL), `CTR` counter.
A stricter regex than D1's, checked offline against the 75 names in the saved outputs:
`^NISAR_L2_(PR|UR|OD)_GCOV_(\d{3})_(\d{3})_([AD])_(\d{3})_(\d{4})_(\w{4})_([AM])_(\d{8}T\d{6})_(\d{8}T\d{6})_([A-Z]\d{5})_([PMNF])_([FP])_J_(\d{3})$`.

### 6.6 Installed versions (`S/logs/pip_freeze_venv_fresh.txt`, verbatim; Python 3.12.2, pip 26.3, macOS arm64)

````text
aiobotocore==3.10.0
aiohappyeyeballs==2.7.1
aiohttp==3.14.5
aioitertools==0.13.0
aiosignal==1.4.0
asf_search==14.1.0
attrs==26.1.0
botocore==1.43.117
bounded-pool-executor==0.0.3
certifi==2026.10.23
charset-normalizer==3.5.2
dateparser==1.5.0
earthaccess==0.19.0
frozenlist==1.8.0
fsspec==2026.9.0
idna==3.20
importlib_resources==7.1.0
jmespath==1.1.0
multidict==7.2.1
multimethod==2.1
numpy==2.5.4
pqdm==0.2.0
propcache==0.5.4
python-cmr==0.13.0
python-dateutil==2.9.0.post0
pytz==2026.6
regex==2026.11.9
requests==2.34.2
s3fs==2026.9.0
shapely==2.2.0
six==1.17.0
tenacity==9.2.1
tinynetrc==1.3.1
tqdm==4.70.1
typing_extensions==4.16.0
tzlocal==5.4.5
urllib3==2.8.0
wrapt==2.5.2
yarl==1.25.1
````

---

## 7. Things that were tried and did not work

| Tried | Outcome |
|---|---|
| CMR `page_size=2001` | `HTTP 400`, `{"errors": ["page_size must be a number between 0 and 2000"]}` |
| CMR `page_num` plus a `CMR-Search-After` header | `HTTP 400`, `{"errors": ["page_num is not allowed with search-after"]}` |
| CMR `CMR-Search-After` from one query reused with a different sort | `HTTP 400`, `"search_after has 3 value(s) but sort has 2."` |
| CMR granule query with no collection condition (`granule_ur` only, `point` only, `attribute[]` only) | `HTTP 400`, `"The CMR does not allow querying across granules in all collections. ..."` |
| First provisional/validated overlap check without paging | fetched 2000 of 2492 and reported `present in BOTH collections: 0`; the paged re-run found 117 (`S/out2/misc_checks.txt` against `misc_checks_2.txt`) |
| `asf.search(point=(104.05, 12.95), ...)`, `asf.search(bbox=..., ...)` | `TypeError: search() got an unexpected keyword argument 'point'` (and `'bbox'`) |
| `asf.search(track=83, ...)` | `TypeError: search() got an unexpected keyword argument 'track'` |
| `asf.search(frameCoverage='TRUE', ...)` | `KeyError: 'T'` (accepted values start with F or P, any case) |
| `asf.search(collections=<3 GCOV concept ids>, relativeOrbit=83, frame=8, ...)` | `n=0`, no error |
| `asf.search(processingLevel='GCOV', relativeOrbit=83, frame=8, ...)` with no dataset, platform or shortName | `n=0`, no error (`asfFrame=8` gives 11) |
| `asf.search(..., flightDirection='A')` | `n=0`, no error |
| `asf.search(..., polarization='HH+HV')` on NISAR | `n=0`, no error |
| `asf.search(intersectsWith='POINT(12.95 104.05)')` (lat and lon swapped) | warning `Clamped 1 value(s) to +/-90 latitude`, `n=0` |
| `asf_search` with `CMR_TIMEOUT=0.001` | `asf_search.exceptions.ASFSearchError: Connection Error (Timeout): CMR took too long to respond. Set asf constant "asf_search.constants.INTERNAL.CMR_TIMEOUT" to increase.` (default is 30 s) |
| `earthaccess.search_data(short_name=<tuple of 3>, ...)` | `TypeError: DataGranules.short_name() takes 2 positional arguments but 4 were given` |
| `earthaccess.search_data(short_name='NISAR_L2_GCOV*', ...)` | `n=0`, no error |
| `earthaccess.search_data(point=..., temporal=...)` with no collection | `RuntimeError: Spatial parameters must be accompanied by a collection filter (ex: short_name or entry_title).` |
| `earthaccess.search_data(..., attribute='string,STACK_ID,083_A_008')` | `ValueError: Unknown key attribute` |
| `earthaccess.search_data(polygon=<clockwise ring>, ...)` | `RuntimeError: {"errors":["The polygon boundary points are listed in the wrong order. Points must be provided in counter-clockwise order."]}` |
| `earthaccess.open([], access="s3")` on 0.19.0 | `TypeError: open() got an unexpected keyword argument 'access'` |
| `earthaccess.open([g])` without login | `AttributeError: 'NoneType' object has no attribute 'open'` |
| `earthaccess.get_fsspec_https_session()` without login | `AttributeError: 'NoneType' object has no attribute 'get_fsspec_session'` |
| `earthaccess.download([g], local_path)` without login | prints `You must call earthaccess.login() before you can download data`, returns `[]` |
| `earthaccess.login()` with no credentials and no terminal | `EOFError: EOF when reading a line` after the prompt `Enter your Earthdata Login username:` |
| `earthaccess.login(strategy='environment')` with a fake `EARTHDATA_TOKEN`, then a search | login reports `authenticated = True`; the search raises `RuntimeError: {"errors":["Token does not exist"]}` |
| Reading the `.h5` with no login (`fsspec`, `requests`, `urllib`) | `ClientResponseError: 401, message='Unauthorized', url='https://urs.earthdata.nasa.gov/oauth/authorize?...`; `requests` final status 401; `urllib` `HTTPError 401 Unauthorized` |
| `earthaccess` "stable" how-to pages (`.../en/stable/user/howto/authenticate-with-environment-variables/` and two more) | `HTTP 404`; those pages exist only under `/en/latest/` (`S/out2/fetch_docs.txt`) |
| Finishing the task | all three attempts stopped on the usage limit before any report was written |

---

## 8. Open questions

1. Sketch D1 has still never been executed, in a browser or anywhere else. The CORS preflight needed to send
   `CMR-Search-After` as a request header from JavaScript was not tested (`page_num` avoids it).
2. The brief's exact raw form, `collection_concept_id=...&collection_concept_id=...` with no brackets, was not
   re-run by these agents; they used `short_name[]=`. (`earthaccess` `concept_id=[three ids]` and `asf_search`
   `collections=[three ids]` did return the expected 22 at the point.)
3. `research/nisar_coverage.py` was not run here, and no Appendix A row other than Tonle Sap was re-checked.
4. Nothing behind login was run: `earthaccess.login`, `earthaccess.open`, `get_fsspec_https_session`, any `h5py`
   read. `S/scripts/untested_login_and_open.py` was syntax-checked only; its search call alone was run.
5. Whether the two full-frame mode variants of one pass (`SHSH_M` and `DHDH_A` or `QPDH_A`) cover the same
   ground: their stop times differ by 1 to 8 seconds and their footprints were not compared.
6. When the 2026-11-10 pass of `083_A_008` (and other passes after 2026-11-06) will appear as GCOV.
7. Whether CMR rate-limits a busy client: no throttling was seen, but nothing was done to provoke it.
8. Urgent-response data URLs were listed but not probed for access.
9. `asf_search` with an authenticated session, and its `download` and `remotezip` helpers, were not tried.

---

## 9. Artifact index

All under `S`. Scripts are reproduced in Section 5 or the Appendix.

| Path | What | To reuse |
|---|---|---|
| `S/scripts/final_cmr_stdlib.py` | Raw CMR discovery, stdlib only, with paging and a `describe()` flattener | Change the `base` list (short names, `STACK_ID`, `temporal`); drop the demonstration `page_size=10` |
| `S/scripts/final_asf_search.py` | `asf_search` discovery of one stack | Change point, dates, `relativeOrbit`, `frame`, direction |
| `S/scripts/final_earthaccess.py` | `earthaccess` discovery with client-side full-frame filter | Change point, dates and the `granule_name` glob |
| `S/scripts/final_earthaccess_attribute_filter.py` | `earthaccess` query builder with injected `attribute[]` filters | Change the two attribute strings |
| `S/scripts/crosscheck.py` | Asserts the three paths agree and match the ground truth | A ready regression test; update the expected count when new dates are published |
| `S/scripts/cmr_probe_05_pagination.py` | Demonstrates every paging behaviour in F8 | Reference only |
| `S/scripts/partial_frame_point_check.py` | Shows partial frames at an edge-strip point | Change the two points and the stack |
| `S/scripts/pending_acquisition_check.py` | Lists L0B, RSLC, GSLC, GCOV after a date for a track at a point | Change point, track, direction, start date |
| `S/scripts/misc_checks_2.py` | Paged overlap check between collections; latency of newest granules | Its `walk()` is a compact paging generator |
| `S/scripts/access_probe.py`, `browse_probe.py`, `unauth_read_probe.py` | Where login becomes necessary; browse PNG headers; failure signatures | Change the granule name |
| `S/scripts/untested_login_and_open.py` | Login without a prompt, then open one `.h5` two ways. **Not run** | First thing to run once credentials exist |
| `S/run_fresh.sh` | Runs a script under `env -i` with an empty `HOME`, saving output | Point `PATH` at your venv |
| `S/downloads/cmr_json/stack_full.json` | A real `granules.json` response, 11 entries (276 KB) | Fixture or mock for the web app's CMR function |
| `S/out2/cmr_probe_B.json` | A real `granules.umm_json` response for the same 11 granules (390 KB) | Fixture for pipeline tests |
| `S/out2/cmr_probe_04_umm_detail.txt` | Full UMM-G dump of one full-frame and two partial granules | Reference for attribute and file names |
| `S/out2/*.txt` | Output of every script from the fresh-venv run | Evidence |
| `S/logs/pip_freeze_venv_fresh.txt` | Exact package versions | Basis for a requirements file |
| `S/docs2_text/*.txt`, `S/docs_text/*.txt` | Text of the ASF NISAR guide and `earthaccess` pages that were read | Reference |

---

## Appendix. Exploration scripts and their output

These are the scripts behind the facts in Section 2. All **ran**. They are exploratory, not templates; copy from Section 5 instead. They are reproduced because `S` may not survive.

### A.1 to A.4 Raw CMR probes

#### A.1 cmr_probe_01.py

Source: `S/scripts/cmr_probe_01.py` (md5 `fb0d294dcdae1fb5480c51d3d987f440`). Status: **ran**.

````python
"""Exploratory raw-CMR probe (stdlib only). Not the final snippet.
Checks: GCOV collections, STACK_ID filter with/without point, per-collection counts."""
import json
import urllib.parse
import urllib.request

UA = {"User-Agent": "nisar-search-verify/1.0"}
CMR = "https://cmr.earthdata.nasa.gov/search"


def get(path, params):
    url = f"{CMR}/{path}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return url, dict(r.headers), json.load(r)


# 1. collections whose short name matches NISAR_L2_GCOV*
url, hdr, d = get("collections.umm_json", [("short_name", "NISAR_L2_GCOV*"), ("options[short_name][pattern]", "true"), ("page_size", "50")])
print("COLLECTIONS", url)
for it in d["items"]:
    u = it["umm"]
    print("  ", it["meta"]["concept-id"], u["ShortName"], "v" + u["Version"], "granules:", it["meta"].get("granule-count"))

GCOV = ["NISAR_L2_GCOV_BETA_V1", "NISAR_L2_GCOV_PROVISIONAL_V1", "NISAR_L2_GCOV_V1"]


def gran(extra, label):
    params = [("provider", "ASF"), ("page_size", "100")] + [("short_name[]", s) for s in GCOV] + extra
    url, hdr, d = get("granules.umm_json", params)
    print(f"\n{label}\n  {url}\n  CMR-Hits={hdr.get('CMR-Hits')} items={len(d['items'])} search-after={hdr.get('CMR-Search-After')}")
    for it in d["items"]:
        u = it["umm"]
        print("  ", it["meta"]["collection-concept-id"], u["CollectionReference"].get("ShortName"), u["TemporalExtent"]["RangeDateTime"]["BeginningDateTime"], u["GranuleUR"])
    return d


a = gran([("attribute[]", "string,STACK_ID,083_A_008")], "A: GCOV x3 + STACK_ID=083_A_008 (no spatial)")
b = gran([("attribute[]", "string,STACK_ID,083_A_008"), ("point", "104.05,12.95")], "B: A + point=104.05,12.95")
c = gran([("point", "104.05,12.95")], "C: GCOV x3 + point only")
json.dump(b, open("out2/cmr_probe_B.json", "w"), indent=1)
````

What it printed (`S/out2/cmr_probe_01.txt`):

````text
COLLECTIONS https://cmr.earthdata.nasa.gov/search/collections.umm_json?short_name=NISAR_L2_GCOV%2A&options%5Bshort_name%5D%5Bpattern%5D=true&page_size=50
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 v1 granules: None
   C3622214170-ASF NISAR_L2_GCOV_BETA_V1 v1 granules: None
   C3622241360-ASF NISAR_L2_GCOV_V1 v1 granules: None

A: GCOV x3 + STACK_ID=083_A_008 (no spatial)
  https://cmr.earthdata.nasa.gov/search/granules.umm_json?provider=ASF&page_size=100&short_name%5B%5D=NISAR_L2_GCOV_BETA_V1&short_name%5B%5D=NISAR_L2_GCOV_PROVISIONAL_V1&short_name%5B%5D=NISAR_L2_GCOV_V1&attribute%5B%5D=string%2CSTACK_ID%2C083_A_008
  CMR-Hits=None items=33 search-after=None
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-06-19T22:36:37.000000Z NISAR_L2_PR_GCOV_023_083_A_008_4005_DHDH_A_20260619T223637_20260619T223644_P05023_N_P_J_001
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-06-19T22:36:37.000000Z NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223637_20260619T223711_P05023_N_F_J_001
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-06-19T22:37:07.000000Z NISAR_L2_PR_GCOV_023_083_A_008_4005_DHDH_A_20260619T223707_20260619T223711_P05023_N_P_J_001
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-07-01T22:36:36.000000Z NISAR_L2_PR_GCOV_024_083_A_008_4005_DHDH_A_20260701T223636_20260701T223643_P05023_N_P_J_001
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-07-01T22:36:36.000000Z NISAR_L2_PR_GCOV_024_083_A_008_2005_DHDH_M_20260701T223636_20260701T223711_P05023_N_F_J_001
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-07-01T22:37:06.000000Z NISAR_L2_PR_GCOV_024_083_A_008_4005_DHDH_A_20260701T223706_20260701T223711_P05023_N_P_J_001
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-07-13T22:36:36.000000Z NISAR_L2_PR_GCOV_025_083_A_008_2005_DHDH_M_20260713T223636_20260713T223710_P05023_N_F_J_001
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-07-13T22:36:36.000000Z NISAR_L2_PR_GCOV_025_083_A_008_4005_DHDH_A_20260713T223636_20260713T223642_P05023_N_P_J_001
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-07-13T22:37:05.000000Z NISAR_L2_PR_GCOV_025_083_A_008_4005_DHDH_A_20260713T223705_20260713T223710_P05023_N_P_J_001
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-07-25T22:36:35.000000Z NISAR_L2_PR_GCOV_026_083_A_008_4005_DHDH_A_20260725T223635_20260725T223642_P05023_N_P_J_001
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-07-25T22:36:35.000000Z NISAR_L2_PR_GCOV_026_083_A_008_2005_DHDH_M_20260725T223635_20260725T223709_P05023_N_F_J_001
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-07-25T22:37:05.000000Z NISAR_L2_PR_GCOV_026_083_A_008_4005_DHDH_A_20260725T223705_20260725T223709_P05023_N_P_J_001
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-08-18T22:36:34.000000Z NISAR_L2_PR_GCOV_028_083_A_008_4005_DHDH_A_20260818T223634_20260818T223641_P05023_N_P_J_001
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-08-18T22:36:34.000000Z NISAR_L2_PR_GCOV_028_083_A_008_2005_DHDH_M_20260818T223634_20260818T223708_P05023_N_F_J_001
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-08-18T22:37:04.000000Z NISAR_L2_PR_GCOV_028_083_A_008_4005_DHDH_A_20260818T223704_20260818T223708_P05023_N_P_J_001
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-08-30T22:36:33.000000Z NISAR_L2_PR_GCOV_029_083_A_008_4005_DHDH_A_20260830T223633_20260830T223640_P05023_N_P_J_001
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-08-30T22:36:33.000000Z NISAR_L2_PR_GCOV_029_083_A_008_2005_DHDH_M_20260830T223633_20260830T223708_P05023_N_F_J_001
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-08-30T22:37:04.000000Z NISAR_L2_PR_GCOV_029_083_A_008_4005_DHDH_A_20260830T223704_20260830T223708_P05023_N_P_J_001
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-09-11T22:36:33.000000Z NISAR_L2_PR_GCOV_030_083_A_008_4005_DHDH_A_20260911T223633_20260911T223640_P05023_N_P_J_001
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-09-11T22:36:33.000000Z NISAR_L2_PR_GCOV_030_083_A_008_2005_DHDH_M_20260911T223633_20260911T223708_P05023_N_F_J_001
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-09-11T22:37:03.000000Z NISAR_L2_PR_GCOV_030_083_A_008_4005_DHDH_A_20260911T223703_20260911T223708_P05023_N_P_J_001
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-09-23T22:36:33.000000Z NISAR_L2_PR_GCOV_031_083_A_008_4005_DHDH_A_20260923T223633_20260923T223640_P05023_N_P_J_001
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-09-23T22:36:33.000000Z NISAR_L2_PR_GCOV_031_083_A_008_2005_DHDH_M_20260923T223633_20260923T223708_P05023_N_F_J_001
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-09-23T22:37:03.000000Z NISAR_L2_PR_GCOV_031_083_A_008_4005_DHDH_A_20260923T223703_20260923T223708_P05023_N_P_J_001
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-10-05T22:36:33.000000Z NISAR_L2_PR_GCOV_032_083_A_008_4005_DHDH_A_20261005T223633_20261005T223641_P05023_N_P_J_001
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-10-05T22:36:33.000000Z NISAR_L2_PR_GCOV_032_083_A_008_2005_DHDH_M_20261005T223633_20261005T223708_P05023_N_F_J_001
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-10-05T22:37:04.000000Z NISAR_L2_PR_GCOV_032_083_A_008_4005_DHDH_A_20261005T223704_20261005T223708_P05023_N_P_J_001
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-10-17T22:36:33.000000Z NISAR_L2_PR_GCOV_033_083_A_008_4005_DHDH_A_20261017T223633_20261017T223641_P05023_N_P_J_001
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-10-17T22:36:33.000000Z NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-10-17T22:37:04.000000Z NISAR_L2_PR_GCOV_033_083_A_008_4005_DHDH_A_20261017T223704_20261017T223708_P05023_N_P_J_001
   C3622241360-ASF NISAR_L2_GCOV_V1 2026-10-29T22:36:34.000000Z NISAR_L2_PR_GCOV_034_083_A_008_4005_DHDH_A_20261029T223634_20261029T223641_P05036_N_P_J_001
   C3622241360-ASF NISAR_L2_GCOV_V1 2026-10-29T22:36:34.000000Z NISAR_L2_PR_GCOV_034_083_A_008_2005_DHDH_M_20261029T223634_20261029T223708_P05036_N_F_J_001
   C3622241360-ASF NISAR_L2_GCOV_V1 2026-10-29T22:37:04.000000Z NISAR_L2_PR_GCOV_034_083_A_008_4005_DHDH_A_20261029T223704_20261029T223708_P05036_N_P_J_001

B: A + point=104.05,12.95
  https://cmr.earthdata.nasa.gov/search/granules.umm_json?provider=ASF&page_size=100&short_name%5B%5D=NISAR_L2_GCOV_BETA_V1&short_name%5B%5D=NISAR_L2_GCOV_PROVISIONAL_V1&short_name%5B%5D=NISAR_L2_GCOV_V1&attribute%5B%5D=string%2CSTACK_ID%2C083_A_008&point=104.05%2C12.95
  CMR-Hits=None items=11 search-after=None
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-06-19T22:36:37.000000Z NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223637_20260619T223711_P05023_N_F_J_001
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-07-01T22:36:36.000000Z NISAR_L2_PR_GCOV_024_083_A_008_2005_DHDH_M_20260701T223636_20260701T223711_P05023_N_F_J_001
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-07-13T22:36:36.000000Z NISAR_L2_PR_GCOV_025_083_A_008_2005_DHDH_M_20260713T223636_20260713T223710_P05023_N_F_J_001
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-07-25T22:36:35.000000Z NISAR_L2_PR_GCOV_026_083_A_008_2005_DHDH_M_20260725T223635_20260725T223709_P05023_N_F_J_001
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-08-18T22:36:34.000000Z NISAR_L2_PR_GCOV_028_083_A_008_2005_DHDH_M_20260818T223634_20260818T223708_P05023_N_F_J_001
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-08-30T22:36:33.000000Z NISAR_L2_PR_GCOV_029_083_A_008_2005_DHDH_M_20260830T223633_20260830T223708_P05023_N_F_J_001
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-09-11T22:36:33.000000Z NISAR_L2_PR_GCOV_030_083_A_008_2005_DHDH_M_20260911T223633_20260911T223708_P05023_N_F_J_001
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-09-23T22:36:33.000000Z NISAR_L2_PR_GCOV_031_083_A_008_2005_DHDH_M_20260923T223633_20260923T223708_P05023_N_F_J_001
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-10-05T22:36:33.000000Z NISAR_L2_PR_GCOV_032_083_A_008_2005_DHDH_M_20261005T223633_20261005T223708_P05023_N_F_J_001
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-10-17T22:36:33.000000Z NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001
   C3622241360-ASF NISAR_L2_GCOV_V1 2026-10-29T22:36:34.000000Z NISAR_L2_PR_GCOV_034_083_A_008_2005_DHDH_M_20261029T223634_20261029T223708_P05036_N_F_J_001

C: GCOV x3 + point only
  https://cmr.earthdata.nasa.gov/search/granules.umm_json?provider=ASF&page_size=100&short_name%5B%5D=NISAR_L2_GCOV_BETA_V1&short_name%5B%5D=NISAR_L2_GCOV_PROVISIONAL_V1&short_name%5B%5D=NISAR_L2_GCOV_V1&point=104.05%2C12.95
  CMR-Hits=None items=22 search-after=None
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-06-19T22:36:37.000000Z NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223637_20260619T223711_P05023_N_F_J_001
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-06-24T11:31:10.000000Z NISAR_L2_PR_GCOV_023_148_D_082_2005_DHDH_M_20260624T113110_20260624T113144_P05023_N_F_J_001
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-07-01T22:36:36.000000Z NISAR_L2_PR_GCOV_024_083_A_008_2005_DHDH_M_20260701T223636_20260701T223711_P05023_N_F_J_001
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-07-06T11:31:09.000000Z NISAR_L2_PR_GCOV_024_148_D_082_2005_SHSH_M_20260706T113109_20260706T113144_P05023_N_F_J_001
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-07-13T22:36:36.000000Z NISAR_L2_PR_GCOV_025_083_A_008_2005_DHDH_M_20260713T223636_20260713T223710_P05023_N_F_J_001
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-07-18T11:31:08.000000Z NISAR_L2_PR_GCOV_025_148_D_082_2005_DHDH_M_20260718T113108_20260718T113143_P05023_N_F_J_001
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-07-25T22:36:35.000000Z NISAR_L2_PR_GCOV_026_083_A_008_2005_DHDH_M_20260725T223635_20260725T223709_P05023_N_F_J_001
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-08-11T11:31:07.000000Z NISAR_L2_PR_GCOV_027_148_D_082_2005_DHDH_M_20260811T113107_20260811T113142_P05023_N_F_J_001
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-08-18T22:36:34.000000Z NISAR_L2_PR_GCOV_028_083_A_008_2005_DHDH_M_20260818T223634_20260818T223708_P05023_N_F_J_001
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-08-23T11:31:07.000000Z NISAR_L2_PR_GCOV_028_148_D_082_2005_SHSH_M_20260823T113107_20260823T113141_P05023_N_F_J_001
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-08-30T22:36:33.000000Z NISAR_L2_PR_GCOV_029_083_A_008_2005_DHDH_M_20260830T223633_20260830T223708_P05023_N_F_J_001
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-09-04T11:31:06.000000Z NISAR_L2_PR_GCOV_029_148_D_082_2005_DHDH_M_20260904T113106_20260904T113141_P05023_N_F_J_001
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-09-11T22:36:33.000000Z NISAR_L2_PR_GCOV_030_083_A_008_2005_DHDH_M_20260911T223633_20260911T223708_P05023_N_F_J_001
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-09-16T11:31:06.000000Z NISAR_L2_PR_GCOV_030_148_D_082_2005_SHSH_M_20260916T113106_20260916T113141_P05023_N_F_J_001
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-09-23T22:36:33.000000Z NISAR_L2_PR_GCOV_031_083_A_008_2005_DHDH_M_20260923T223633_20260923T223708_P05023_N_F_J_001
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-09-28T11:31:06.000000Z NISAR_L2_PR_GCOV_031_148_D_082_2005_DHDH_M_20260928T113106_20260928T113141_P05023_N_F_J_001
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-10-05T22:36:33.000000Z NISAR_L2_PR_GCOV_032_083_A_008_2005_DHDH_M_20261005T223633_20261005T223708_P05023_N_F_J_001
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-10-10T11:31:06.000000Z NISAR_L2_PR_GCOV_032_148_D_082_2005_SHSH_M_20261010T113106_20261010T113141_P05023_N_F_J_001
   C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 2026-10-17T22:36:33.000000Z NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001
   C3622241360-ASF NISAR_L2_GCOV_V1 2026-10-22T11:31:06.000000Z NISAR_L2_PR_GCOV_033_148_D_082_2005_DHDH_M_20261022T113106_20261022T113141_P05036_N_F_J_001
   C3622241360-ASF NISAR_L2_GCOV_V1 2026-10-29T22:36:34.000000Z NISAR_L2_PR_GCOV_034_083_A_008_2005_DHDH_M_20261029T223634_20261029T223708_P05036_N_F_J_001
   C3622241360-ASF NISAR_L2_GCOV_V1 2026-11-03T11:31:07.000000Z NISAR_L2_PR_GCOV_034_148_D_082_2005_SHSH_M_20261103T113107_20261103T113141_P05036_N_F_J_001
````


#### A.2 cmr_probe_02.py

Source: `S/scripts/cmr_probe_02.py` (md5 `6e6abf141691cdf1fe907c5d3d33790c`). Status: **ran**.

````python
"""Exploratory raw-CMR probe 2 (stdlib only): where do GCOV-typed granules live, and date ranges per GCOV collection."""
import json
import urllib.parse
import urllib.request

UA = {"User-Agent": "nisar-search-verify/1.0"}
CMR = "https://cmr.earthdata.nasa.gov/search"


def get(path, params):
    url = f"{CMR}/{path}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.headers, json.load(r)


# every ASF collection whose short name starts with NISAR
hdr, d = get("collections.umm_json", [("provider", "ASF"), ("short_name", "NISAR*"), ("options[short_name][pattern]", "true"), ("page_size", "200")])
names = sorted((it["umm"]["ShortName"], it["meta"]["concept-id"]) for it in d["items"])
print("NISAR* collections at ASF:", len(names))
tot = 0
for sn, cid in names:
    hdr, g = get("granules.umm_json", [("collection_concept_id", cid), ("attribute[]", "string,PRODUCT_TYPE,GCOV"), ("page_size", "1")])
    hits = int(hdr["CMR-Hits"])
    if hits:
        tot += hits
        print(f"  {sn:34s} {cid:18s} GCOV-typed granules: {hits}")
print("  total GCOV-typed:", tot)

for sn in ["NISAR_L2_GCOV_BETA_V1", "NISAR_L2_GCOV_PROVISIONAL_V1", "NISAR_L2_GCOV_V1"]:
    out = []
    for key in ("start_date", "-start_date"):
        hdr, g = get("granules.umm_json", [("short_name", sn), ("sort_key", key), ("page_size", "1")])
        u = g["items"][0]["umm"]
        out.append(u["TemporalExtent"]["RangeDateTime"]["BeginningDateTime"])
    print(f"{sn}: hits={hdr['CMR-Hits']} earliest={out[0]} latest={out[1]}")
````

What it printed (`S/out2/cmr_probe_02.txt`):

````text
NISAR* collections at ASF: 44
  NISAR_L2_GCOV_BETA_V1              C3622214170-ASF    GCOV-typed granules: 23527
  NISAR_L2_GCOV_PROVISIONAL_V1       C2854338529-ASF    GCOV-typed granules: 163672
  NISAR_L2_GCOV_V1                   C3622241360-ASF    GCOV-typed granules: 14692
  NISAR_UR_L2                        C2887502657-ASF    GCOV-typed granules: 2147
  total GCOV-typed: 204038
NISAR_L2_GCOV_BETA_V1: hits=23527 earliest=2025-10-12T18:25:08.000000Z latest=2026-01-20T15:59:30.000000Z
NISAR_L2_GCOV_PROVISIONAL_V1: hits=163672 earliest=2025-10-29T11:11:30.000000Z latest=2026-10-21T20:37:40.000000Z
NISAR_L2_GCOV_V1: hits=14692 earliest=2026-10-21T17:07:21.000000Z latest=2026-11-11T23:35:57.000000Z
````


#### A.3 cmr_probe_03_duplicates.py

Source: `S/scripts/cmr_probe_03_duplicates.py` (md5 `d1e90400949c4f4f4827e67e666c3bbb`). Status: **ran**.

````python
"""Exploratory raw-CMR probe 3 (stdlib only): are the same acquisitions present in more than one GCOV maturity collection?
Takes 2000 Provisional granules from the Beta/Provisional overlap window and looks for Beta granules with the same
(STACK_ID, start second)."""
import json
import urllib.parse
import urllib.request
from collections import defaultdict

UA = {"User-Agent": "nisar-search-verify/1.0"}
CMR = "https://cmr.earthdata.nasa.gov/search"


def get(params):
    url = f"{CMR}/granules.umm_json?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.headers, json.load(r)


def attrs(u):
    return {a["Name"]: a["Values"] for a in u.get("AdditionalAttributes", [])}


def key(u):
    a = attrs(u)
    return (a.get("STACK_ID", ["?"])[0], u["TemporalExtent"]["RangeDateTime"]["BeginningDateTime"][:19], a.get("FULL_FRAME", ["?"])[0])


WINDOW = "2025-12-01T00:00:00Z,2025-12-03T00:00:00Z"
groups = defaultdict(list)
for sn in ["NISAR_L2_GCOV_BETA_V1", "NISAR_L2_GCOV_PROVISIONAL_V1", "NISAR_L2_GCOV_V1"]:
    hdr, d = get([("short_name", sn), ("temporal", WINDOW), ("page_size", "2000")])
    print(sn, "hits in window", WINDOW, "=", hdr["CMR-Hits"], "fetched", len(d["items"]))
    for it in d["items"]:
        groups[key(it["umm"])].append((sn, it["umm"]["GranuleUR"]))

multi = {k: v for k, v in groups.items() if len({sn for sn, _ in v}) > 1}
print("distinct (STACK_ID, start, full_frame) keys:", len(groups), "| keys present in >1 collection:", len(multi))
for k, v in list(multi.items())[:3]:
    print(" ", k)
    for sn, ur in v:
        print("     ", sn, ur)
same_coll_dupes = {k: v for k, v in groups.items() if len(v) > len({sn for sn, _ in v})}
print("keys with >1 granule inside the SAME collection:", len(same_coll_dupes))
for k, v in list(same_coll_dupes.items())[:3]:
    print(" ", k)
    for sn, ur in v:
        print("     ", sn, ur)
````

What it printed (`S/out2/cmr_probe_03_duplicates.txt`):

````text
NISAR_L2_GCOV_BETA_V1 hits in window 2025-12-01T00:00:00Z,2025-12-03T00:00:00Z = 565 fetched 565
NISAR_L2_GCOV_PROVISIONAL_V1 hits in window 2025-12-01T00:00:00Z,2025-12-03T00:00:00Z = 30 fetched 30
NISAR_L2_GCOV_V1 hits in window 2025-12-01T00:00:00Z,2025-12-03T00:00:00Z = 0 fetched 0
distinct (STACK_ID, start, full_frame) keys: 573 | keys present in >1 collection: 21
  ('128_D_069', '2025-12-01T02:06:10', 'TRUE')
      NISAR_L2_GCOV_BETA_V1 NISAR_L2_PR_GCOV_006_128_D_069_4005_DHDH_A_20251201T020610_20251201T020645_X05009_N_F_J_001
      NISAR_L2_GCOV_PROVISIONAL_V1 NISAR_L2_PR_GCOV_006_128_D_069_4005_DHDH_A_20251201T020610_20251201T020645_P05023_N_F_J_001
  ('128_D_072', '2025-12-01T02:07:51', 'TRUE')
      NISAR_L2_GCOV_BETA_V1 NISAR_L2_PR_GCOV_006_128_D_072_4005_DHDH_A_20251201T020751_20251201T020826_X05009_N_F_J_001
      NISAR_L2_GCOV_PROVISIONAL_V1 NISAR_L2_PR_GCOV_006_128_D_072_4005_DHDH_A_20251201T020751_20251201T020826_P05023_N_F_J_001
  ('134_A_016', '2025-12-01T11:35:10', 'FALSE')
      NISAR_L2_GCOV_BETA_V1 NISAR_L2_PR_GCOV_006_134_A_016_0005_NADV_A_20251201T113510_20251201T113519_X05009_N_P_J_001
      NISAR_L2_GCOV_PROVISIONAL_V1 NISAR_L2_PR_GCOV_006_134_A_016_0005_NADV_A_20251201T113510_20251201T113519_P05023_N_P_J_001
keys with >1 granule inside the SAME collection: 1
  ('149_A_022', '2025-12-02T12:36:52', 'TRUE')
      NISAR_L2_GCOV_BETA_V1 NISAR_L2_PR_GCOV_006_149_A_022_4005_DHDH_A_20251202T123652_20251202T123723_X05010_N_F_J_001
      NISAR_L2_GCOV_BETA_V1 NISAR_L2_PR_GCOV_006_149_A_022_4005_DHDH_A_20251202T123652_20251202T123723_X05010_N_F_J_002
````


#### A.4 cmr_probe_04_umm_detail.py

Source: `S/scripts/cmr_probe_04_umm_detail.py` (md5 `d7daff5a5cf60fb73940c477fb225034`). Status: **ran**.

````python
"""Raw-CMR probe 4 (stdlib only): header-name case, and the full UMM-G record of one full-frame and one partial-frame
granule of stack 083_A_008 (additional attributes, related URLs, file sizes)."""
import json
import urllib.parse
import urllib.request

UA = {"User-Agent": "nisar-search-verify/1.0"}
CMR = "https://cmr.earthdata.nasa.gov/search/granules.umm_json"
GCOV = ["NISAR_L2_GCOV_BETA_V1", "NISAR_L2_GCOV_PROVISIONAL_V1", "NISAR_L2_GCOV_V1"]

params = [("short_name[]", s) for s in GCOV] + [
    ("attribute[]", "string,STACK_ID,083_A_008"),
    ("temporal", "2026-10-17T00:00:00Z,2026-10-18T00:00:00Z"),
    ("page_size", "10"),
]
url = f"{CMR}?{urllib.parse.urlencode(params)}"
print("URL:", url)
req = urllib.request.Request(url, headers=UA)
with urllib.request.urlopen(req, timeout=60) as r:
    print("HTTP status:", r.status, "| HTTP version:", r.version)
    print("raw header names containing 'cmr':", [k for k in r.headers.keys() if "cmr" in k.lower()])
    print("r.headers.get('CMR-Hits') [case-insensitive message object]:", r.headers.get("CMR-Hits"))
    print("dict(r.headers).get('CMR-Hits') [plain dict, case-sensitive]:", dict(r.headers).get("CMR-Hits"))
    print("Content-Type:", r.headers.get("Content-Type"))
    d = json.load(r)

print("top-level keys:", list(d.keys()), "| hits:", d["hits"], "| took:", d["took"], "| items:", len(d["items"]))
for it in d["items"]:
    u = it["umm"]
    print("\n==========", u["GranuleUR"])
    print("meta:", json.dumps(it["meta"]))
    print("umm keys:", list(u.keys()))
    print("CollectionReference:", u["CollectionReference"])
    print("TemporalExtent:", u["TemporalExtent"])
    print("SpatialExtent:", json.dumps(u["SpatialExtent"]))
    print("OrbitCalculatedSpatialDomains:", u.get("OrbitCalculatedSpatialDomains"))
    print("Platforms:", json.dumps(u.get("Platforms")))
    print("DataGranule (minus files):", {k: v for k, v in u["DataGranule"].items() if k != "ArchiveAndDistributionInformation"})
    print("files (Name, SizeInBytes, Format):")
    for f in u["DataGranule"]["ArchiveAndDistributionInformation"]:
        print("    ", f.get("Name"), f.get("SizeInBytes"), f.get("Format"), f.get("Checksum", {}).get("Algorithm"))
    print("AdditionalAttributes:")
    for a in u.get("AdditionalAttributes", []):
        print("    ", a["Name"], "=", a["Values"])
    print("RelatedUrls (Type | Subtype | Format | URL):")
    for ru in u.get("RelatedUrls", []):
        print("    ", ru.get("Type"), "|", ru.get("Subtype"), "|", ru.get("Format"), "|", ru["URL"])
````

What it printed (`S/out2/cmr_probe_04_umm_detail.txt`):

````text
URL: https://cmr.earthdata.nasa.gov/search/granules.umm_json?short_name%5B%5D=NISAR_L2_GCOV_BETA_V1&short_name%5B%5D=NISAR_L2_GCOV_PROVISIONAL_V1&short_name%5B%5D=NISAR_L2_GCOV_V1&attribute%5B%5D=string%2CSTACK_ID%2C083_A_008&temporal=2026-10-17T00%3A00%3A00Z%2C2026-10-18T00%3A00%3A00Z&page_size=10
HTTP status: 200 | HTTP version: 11
raw header names containing 'cmr': ['cmr-request-id', 'cmr-request-id', 'cmr-search-after', 'cmr-hits', 'cmr-took']
r.headers.get('CMR-Hits') [case-insensitive message object]: 3
dict(r.headers).get('CMR-Hits') [plain dict, case-sensitive]: None
Content-Type: application/vnd.nasa.cmr.umm_results+json;version=1.6.7; charset=utf-8
top-level keys: ['hits', 'took', 'items'] | hits: 3 | took: 70 | items: 3

========== NISAR_L2_PR_GCOV_033_083_A_008_4005_DHDH_A_20261017T223633_20261017T223641_P05023_N_P_J_001
meta: {"concept-type": "granule", "concept-id": "G4378253080-ASF", "revision-id": 1, "native-id": "NISAR_L2_PR_GCOV_033_083_A_008_4005_DHDH_A_20261017T223633_20261017T223641_P05023_N_P_J_001", "collection-concept-id": "C2854338529-ASF", "provider-id": "ASF", "format": "application/vnd.nasa.cmr.umm+json", "revision-date": "2026-10-19T20:14:21.988Z"}
umm keys: ['TemporalExtent', 'OrbitCalculatedSpatialDomains', 'GranuleUR', 'AdditionalAttributes', 'SpatialExtent', 'ProviderDates', 'CollectionReference', 'PGEVersionClass', 'RelatedUrls', 'InputGranules', 'DataGranule', 'Platforms', 'MetadataSpecification']
CollectionReference: {'ShortName': 'NISAR_L2_GCOV_PROVISIONAL_V1', 'Version': '1'}
TemporalExtent: {'RangeDateTime': {'BeginningDateTime': '2026-10-17T22:36:33.000000Z', 'EndingDateTime': '2026-10-17T22:36:41.999342Z'}}
SpatialExtent: {"GranuleLocalities": ["Land", "Asia"], "HorizontalSpatialDomain": {"Geometry": {"GPolygons": [{"Boundary": {"Points": [{"Latitude": 11.9901, "Longitude": 105.41375}, {"Latitude": 12.52619, "Longitude": 105.28503}, {"Latitude": 11.99258, "Longitude": 103.03263}, {"Latitude": 11.45955, "Longitude": 103.16865}, {"Latitude": 11.9901, "Longitude": 105.41375}]}}]}}}
OrbitCalculatedSpatialDomains: [{'OrbitNumber': 6410}]
Platforms: [{"ShortName": "NISAR", "Instruments": [{"ShortName": "L-SAR", "Characteristics": [{"Name": "LookDirection", "Value": "LEFT"}]}]}]
DataGranule (minus files): {'DayNightFlag': 'Unspecified', 'ProductionDateTime': '2026-10-19T20:00:36.000000Z', 'Identifiers': [{'IdentifierType': 'ProducerGranuleId', 'Identifier': 'NISAR_L2_PR_GCOV_033_083_A_008_4005_DHDH_A_20261017T223633_20261017T223641_P05023_N_P_J_001'}, {'IdentifierType': 'Other', 'Identifier': 'ISCE3 0.25.16', 'IdentifierName': 'SASVersionId'}, {'IdentifierType': 'CRID', 'Identifier': 'P05023'}, {'IdentifierType': 'Other', 'Identifier': '1', 'IdentifierName': 'ProductCounter'}]}
files (Name, SizeInBytes, Format):
     NISAR_L2_PR_GCOV_033_083_A_008_4005_DHDH_A_20261017T223633_20261017T223641_P05023_N_P_J_001.h5 1908408320 HDF5 MD5
     NISAR_L2_PR_GCOV_033_083_A_008_4005_DHDH_A_20261017T223633_20261017T223641_P05023_N_P_J_001_LATLON.png 1191937 PNG MD5
     NISAR_L2_PR_GCOV_033_083_A_008_4005_DHDH_A_20261017T223633_20261017T223641_P05023_N_P_J_001_NATIVE.png 1327983 PNG MD5
     NISAR_L2_PR_GCOV_033_083_A_008_4005_DHDH_A_20261017T223633_20261017T223641_P05023_N_P_J_001_NATIVE_A_HHHH.png 452515 PNG MD5
     NISAR_L2_PR_GCOV_033_083_A_008_4005_DHDH_A_20261017T223633_20261017T223641_P05023_N_P_J_001_NATIVE_A_HVHV.png 441790 PNG MD5
     NISAR_L2_PR_GCOV_033_083_A_008_4005_DHDH_A_20261017T223633_20261017T223641_P05023_N_P_J_001_NATIVE_B_HHHH.png 229429 PNG MD5
     NISAR_L2_PR_GCOV_033_083_A_008_4005_DHDH_A_20261017T223633_20261017T223641_P05023_N_P_J_001_NATIVE_B_HVHV.png 225869 PNG MD5
     NISAR_L2_PR_GCOV_033_083_A_008_4005_DHDH_A_20261017T223633_20261017T223641_P05023_N_P_J_001.h5.iso.xml 117211 XML MD5
     NISAR_L2_PR_GCOV_033_083_A_008_4005_DHDH_A_20261017T223633_20261017T223641_P05023_N_P_J_001_QA_REPORT.pdf 260062 PDF MD5
     NISAR_L2_PR_GCOV_033_083_A_008_4005_DHDH_A_20261017T223633_20261017T223641_P05023_N_P_J_001_QA_STATS.h5 72648 HDF5 MD5
     NISAR_L2_PR_GCOV_033_083_A_008_4005_DHDH_A_20261017T223633_20261017T223641_P05023_N_P_J_001_QA_SUMMARY.csv 1441 CSV MD5
     NISAR_L2_PR_GCOV_033_083_A_008_4005_DHDH_A_20261017T223633_20261017T223641_P05023_N_P_J_001_LATLON.kml 573 KML MD5
     NISAR_L2_PR_GCOV_033_083_A_008_4005_DHDH_A_20261017T223633_20261017T223641_P05023_N_P_J_001_NATIVE.kml 568 KML MD5
     NISAR_L2_PR_GCOV_033_083_A_008_4005_DHDH_A_20261017T223633_20261017T223641_P05023_N_P_J_001_NATIVE_A_HHHH.kml 575 KML MD5
     NISAR_L2_PR_GCOV_033_083_A_008_4005_DHDH_A_20261017T223633_20261017T223641_P05023_N_P_J_001_NATIVE_A_HVHV.kml 575 KML MD5
     NISAR_L2_PR_GCOV_033_083_A_008_4005_DHDH_A_20261017T223633_20261017T223641_P05023_N_P_J_001_NATIVE_B_HHHH.kml 578 KML MD5
     NISAR_L2_PR_GCOV_033_083_A_008_4005_DHDH_A_20261017T223633_20261017T223641_P05023_N_P_J_001_NATIVE_B_HVHV.kml 578 KML MD5
     NISAR_L2_PR_GCOV_033_083_A_008_4005_DHDH_A_20261017T223633_20261017T223641_P05023_N_P_J_001.rc.yaml 5836 YAML MD5
AdditionalAttributes:
     ASCENDING_DESCENDING = ['ASCENDING']
     FRAME_NUMBER = ['8']
     FREQUENCIES = ['A', 'B']
     FREQUENCY_A_POLARIZATION = ['HH', 'HV']
     FREQUENCY_A_POLARIZATION_CONCAT = ['HH+HV']
     FREQUENCY_A_RANGE_BANDWIDTH = ['40']
     FREQUENCY_B_POLARIZATION = ['HH', 'HV']
     FREQUENCY_B_POLARIZATION_CONCAT = ['HH+HV']
     FREQUENCY_B_RANGE_BANDWIDTH = ['5']
     FULL_FRAME = ['FALSE']
     JOINT_OBSERVATION = ['FALSE']
     ORBIT_TYPE = ['MOE']
     PROCESSING_CENTER = ['JPL']
     PROCESSING_LEVEL = ['L2']
     PRODUCTION_PIPELINE = ['PR']
     PRODUCT_TYPE = ['GCOV']
     PRODUCT_TYPE_DESC = ['Geocoded Polarimetric Covariance']
     PRODUCT_VERSION = ['1.0.11']
     RANGE_BANDWIDTH_CONCAT = ['40+5']
     STACK_ID = ['083_A_008']
     TRACK_NUMBER = ['83']
RelatedUrls (Type | Subtype | Format | URL):

========== NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001
meta: {"concept-type": "granule", "concept-id": "G4378438775-ASF", "revision-id": 1, "native-id": "NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001", "collection-concept-id": "C2854338529-ASF", "provider-id": "ASF", "format": "application/vnd.nasa.cmr.umm+json", "revision-date": "2026-10-19T21:46:19.449Z"}
umm keys: ['TemporalExtent', 'OrbitCalculatedSpatialDomains', 'GranuleUR', 'AdditionalAttributes', 'SpatialExtent', 'ProviderDates', 'CollectionReference', 'PGEVersionClass', 'RelatedUrls', 'InputGranules', 'DataGranule', 'Platforms', 'MetadataSpecification']
CollectionReference: {'ShortName': 'NISAR_L2_GCOV_PROVISIONAL_V1', 'Version': '1'}
TemporalExtent: {'RangeDateTime': {'BeginningDateTime': '2026-10-17T22:36:33.000000Z', 'EndingDateTime': '2026-10-17T22:37:08.999342Z'}}
SpatialExtent: {"GranuleLocalities": ["Land", "Asia"], "HorizontalSpatialDomain": {"Geometry": {"GPolygons": [{"Boundary": {"Points": [{"Latitude": 11.99121, "Longitude": 105.41857}, {"Latitude": 14.13511, "Longitude": 104.89877}, {"Latitude": 13.59435, "Longitude": 102.63217}, {"Latitude": 11.45942, "Longitude": 103.1681}, {"Latitude": 11.99121, "Longitude": 105.41857}]}}]}}}
OrbitCalculatedSpatialDomains: [{'OrbitNumber': 6410}]
Platforms: [{"ShortName": "NISAR", "Instruments": [{"ShortName": "L-SAR", "Characteristics": [{"Name": "LookDirection", "Value": "LEFT"}]}]}]
DataGranule (minus files): {'DayNightFlag': 'Unspecified', 'ProductionDateTime': '2026-10-19T21:40:01.000000Z', 'Identifiers': [{'IdentifierType': 'ProducerGranuleId', 'Identifier': 'NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001'}, {'IdentifierType': 'Other', 'Identifier': 'ISCE3 0.25.16', 'IdentifierName': 'SASVersionId'}, {'IdentifierType': 'CRID', 'Identifier': 'P05023'}, {'IdentifierType': 'Other', 'Identifier': '1', 'IdentifierName': 'ProductCounter'}]}
files (Name, SizeInBytes, Format):
     NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001.h5 1900019712 HDF5 MD5
     NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001_LATLON.png 4247472 PNG MD5
     NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001_NATIVE.png 4727200 PNG MD5
     NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001_NATIVE_A_HHHH.png 1601869 PNG MD5
     NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001_NATIVE_A_HVHV.png 1545168 PNG MD5
     NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001_NATIVE_B_HHHH.png 900984 PNG MD5
     NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001_NATIVE_B_HVHV.png 871202 PNG MD5
     NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001.h5.iso.xml 117179 XML MD5
     NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001_QA_REPORT.pdf 952202 PDF MD5
     NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001_QA_STATS.h5 72586 HDF5 MD5
     NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001_QA_SUMMARY.csv 1441 CSV MD5
     NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001_LATLON.kml 571 KML MD5
     NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001_NATIVE.kml 571 KML MD5
     NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001_NATIVE_A_HHHH.kml 578 KML MD5
     NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001_NATIVE_A_HVHV.kml 578 KML MD5
     NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001_NATIVE_B_HHHH.kml 578 KML MD5
     NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001_NATIVE_B_HVHV.kml 578 KML MD5
     NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001.rc.yaml 5774 YAML MD5
AdditionalAttributes:
     ASCENDING_DESCENDING = ['ASCENDING']
     FRAME_NUMBER = ['8']
     FREQUENCIES = ['A', 'B']
     FREQUENCY_A_POLARIZATION = ['HH', 'HV']
     FREQUENCY_A_POLARIZATION_CONCAT = ['HH+HV']
     FREQUENCY_A_RANGE_BANDWIDTH = ['20']
     FREQUENCY_B_POLARIZATION = ['HH', 'HV']
     FREQUENCY_B_POLARIZATION_CONCAT = ['HH+HV']
     FREQUENCY_B_RANGE_BANDWIDTH = ['5']
     FULL_FRAME = ['TRUE']
     JOINT_OBSERVATION = ['FALSE']
     ORBIT_TYPE = ['MOE']
     PROCESSING_CENTER = ['JPL']
     PROCESSING_LEVEL = ['L2']
     PRODUCTION_PIPELINE = ['PR']
     PRODUCT_TYPE = ['GCOV']
     PRODUCT_TYPE_DESC = ['Geocoded Polarimetric Covariance']
     PRODUCT_VERSION = ['1.0.11']
     RANGE_BANDWIDTH_CONCAT = ['20+5']
     STACK_ID = ['083_A_008']
     TRACK_NUMBER = ['83']
RelatedUrls (Type | Subtype | Format | URL):

... [51 more lines not reproduced]
````

(Output shortened for this digest: filtered from 304 lines. Full file: `S/out2/cmr_probe_04_umm_detail.txt`.)


The `RelatedUrls` lines (47 per granule) are left out above; their kinds are listed in Section 5.11 (`access_probe.py`). The third record (the second partial granule) is not reproduced.

### A.5 to A.13 asf_search exploration

#### A.5 asf_explore_01.py

Source: `S/scripts/asf_explore_01.py` (md5 `d6f26fef75284b7fdb8264d110f85d10`). Status: **ran**.

````python
"""Exploration 1 of asf_search for NISAR GCOV (not the final snippet).
Tries several keyword combinations and prints counts + per-collection breakdown."""
import time
from collections import Counter

import asf_search as asf

print("asf_search", asf.__version__)
print("DATASET.NISAR =", repr(asf.DATASET.NISAR), "| DATASET.NISAR_SCIENCE_PRODUCTS =", repr(asf.DATASET.NISAR_SCIENCE_PRODUCTS))
print("PLATFORM.NISAR =", repr(asf.PLATFORM.NISAR), "| PRODUCT_TYPE.GCOV =", repr(asf.PRODUCT_TYPE.GCOV))
print("FLIGHT_DIRECTION.ASCENDING =", repr(asf.FLIGHT_DIRECTION.ASCENDING))
print("session headers:", dict(asf.ASFSession().headers))

WKT = "POINT(104.05 12.95)"
START, END = "2026-06-01T00:00:00Z", "2026-11-13T23:59:59Z"


def run(label, **kw):
    t = time.time()
    try:
        res = asf.search(**kw)
    except Exception as exc:  # noqa: BLE001
        print(f"\n### {label}\n  kwargs={kw}\n  EXCEPTION {type(exc).__name__}: {exc}")
        return None
    dt = time.time() - t
    cols = Counter(p.properties.get("collectionName") for p in res)
    types = Counter(p.properties.get("processingLevel") for p in res)
    stacks = Counter((p.properties.get("pathNumber"), p.properties.get("flightDirection"), p.properties.get("frameNumber")) for p in res)
    print(f"\n### {label}\n  kwargs={kw}\n  n={len(res)} in {dt:.1f}s searchComplete={res.searchComplete}")
    print("  collections:", dict(cols))
    print("  product types:", dict(types))
    print("  (track,dir,frame):", dict(stacks))
    return res


run("A dataset=NISAR + processingLevel=GCOV + point WKT + dates",
    dataset=asf.DATASET.NISAR, processingLevel=asf.PRODUCT_TYPE.GCOV, intersectsWith=WKT, start=START, end=END)
run("B platform=NISAR + processingLevel=GCOV + point WKT + dates",
    platform=asf.PLATFORM.NISAR, processingLevel=asf.PRODUCT_TYPE.GCOV, intersectsWith=WKT, start=START, end=END)
run("C processingLevel=GCOV only + point WKT + dates (no dataset/platform)",
    processingLevel=asf.PRODUCT_TYPE.GCOV, intersectsWith=WKT, start=START, end=END)
run("D shortName x3 + point WKT + dates",
    shortName=["NISAR_L2_GCOV_BETA_V1", "NISAR_L2_GCOV_PROVISIONAL_V1", "NISAR_L2_GCOV_V1"], intersectsWith=WKT, start=START, end=END)
run("E dataset=NISAR_SCIENCE_PRODUCTS + GCOV + point + dates",
    dataset=asf.DATASET.NISAR_SCIENCE_PRODUCTS, processingLevel=asf.PRODUCT_TYPE.GCOV, intersectsWith=WKT, start=START, end=END)
run("F dataset=NISAR + GCOV + point + dates + relativeOrbit=83 + frame=8 + ASCENDING",
    dataset=asf.DATASET.NISAR, processingLevel=asf.PRODUCT_TYPE.GCOV, intersectsWith=WKT, start=START, end=END,
    relativeOrbit=83, frame=8, flightDirection=asf.FLIGHT_DIRECTION.ASCENDING)
run("G same as F but asfFrame=8 instead of frame=8",
    dataset=asf.DATASET.NISAR, processingLevel=asf.PRODUCT_TYPE.GCOV, intersectsWith=WKT, start=START, end=END,
    relativeOrbit=83, asfFrame=8, flightDirection=asf.FLIGHT_DIRECTION.ASCENDING)
run("H track/frame/direction only, NO spatial filter (expect 33 incl. partial frames)",
    dataset=asf.DATASET.NISAR, processingLevel=asf.PRODUCT_TYPE.GCOV, start=START, end=END,
    relativeOrbit=83, frame=8, flightDirection=asf.FLIGHT_DIRECTION.ASCENDING)
run("I H + frameCoverage='FULL'",
    dataset=asf.DATASET.NISAR, processingLevel=asf.PRODUCT_TYPE.GCOV, start=START, end=END,
    relativeOrbit=83, frame=8, flightDirection=asf.FLIGHT_DIRECTION.ASCENDING, frameCoverage="FULL")
````

What it printed (`S/out2/asf_explore_01.txt`):

````text
asf_search 14.1.0
DATASET.NISAR = 'NISAR' | DATASET.NISAR_SCIENCE_PRODUCTS = 'NISAR-SCIENCE-PRODUCTS'
PLATFORM.NISAR = 'NISAR' | PRODUCT_TYPE.GCOV = 'GCOV'
FLIGHT_DIRECTION.ASCENDING = 'ASCENDING'
session headers: {'User-Agent': 'Python/3.12.2; requests/2.34.2; asf_search/14.1.0', 'Accept-Encoding': 'gzip, deflate', 'Accept': '*/*', 'Connection': 'keep-alive', 'Client-Id': 'asf_search_v14.1.0'}

### A dataset=NISAR + processingLevel=GCOV + point WKT + dates
  kwargs={'dataset': 'NISAR', 'processingLevel': 'GCOV', 'intersectsWith': 'POINT(104.05 12.95)', 'start': '2026-06-01T00:00:00Z', 'end': '2026-11-13T23:59:59Z'}
  n=22 in 0.4s searchComplete=True
  collections: {'NISAR_L2_GCOV_V1': 3, 'NISAR_L2_GCOV_PROVISIONAL_V1': 19}
  product types: {'GCOV': 22}
  (track,dir,frame): {(148, 'DESCENDING', 82): 11, (83, 'ASCENDING', 8): 11}

### B platform=NISAR + processingLevel=GCOV + point WKT + dates
  kwargs={'platform': 'NISAR', 'processingLevel': 'GCOV', 'intersectsWith': 'POINT(104.05 12.95)', 'start': '2026-06-01T00:00:00Z', 'end': '2026-11-13T23:59:59Z'}
  n=22 in 0.3s searchComplete=True
  collections: {'NISAR_L2_GCOV_V1': 3, 'NISAR_L2_GCOV_PROVISIONAL_V1': 19}
  product types: {'GCOV': 22}
  (track,dir,frame): {(148, 'DESCENDING', 82): 11, (83, 'ASCENDING', 8): 11}

### C processingLevel=GCOV only + point WKT + dates (no dataset/platform)
  kwargs={'processingLevel': 'GCOV', 'intersectsWith': 'POINT(104.05 12.95)', 'start': '2026-06-01T00:00:00Z', 'end': '2026-11-13T23:59:59Z'}
  n=22 in 0.3s searchComplete=True
  collections: {'NISAR_L2_GCOV_V1': 3, 'NISAR_L2_GCOV_PROVISIONAL_V1': 19}
  product types: {'GCOV': 22}
  (track,dir,frame): {(148, 'DESCENDING', 82): 11, (83, 'ASCENDING', 8): 11}

### D shortName x3 + point WKT + dates
  kwargs={'shortName': ['NISAR_L2_GCOV_BETA_V1', 'NISAR_L2_GCOV_PROVISIONAL_V1', 'NISAR_L2_GCOV_V1'], 'intersectsWith': 'POINT(104.05 12.95)', 'start': '2026-06-01T00:00:00Z', 'end': '2026-11-13T23:59:59Z'}
  n=22 in 0.2s searchComplete=True
  collections: {'NISAR_L2_GCOV_V1': 3, 'NISAR_L2_GCOV_PROVISIONAL_V1': 19}
  product types: {'GCOV': 22}
  (track,dir,frame): {(148, 'DESCENDING', 82): 11, (83, 'ASCENDING', 8): 11}

### E dataset=NISAR_SCIENCE_PRODUCTS + GCOV + point + dates
  kwargs={'dataset': 'NISAR-SCIENCE-PRODUCTS', 'processingLevel': 'GCOV', 'intersectsWith': 'POINT(104.05 12.95)', 'start': '2026-06-01T00:00:00Z', 'end': '2026-11-13T23:59:59Z'}
  n=22 in 0.3s searchComplete=True
  collections: {'NISAR_L2_GCOV_V1': 3, 'NISAR_L2_GCOV_PROVISIONAL_V1': 19}
  product types: {'GCOV': 22}
  (track,dir,frame): {(148, 'DESCENDING', 82): 11, (83, 'ASCENDING', 8): 11}

### F dataset=NISAR + GCOV + point + dates + relativeOrbit=83 + frame=8 + ASCENDING
  kwargs={'dataset': 'NISAR', 'processingLevel': 'GCOV', 'intersectsWith': 'POINT(104.05 12.95)', 'start': '2026-06-01T00:00:00Z', 'end': '2026-11-13T23:59:59Z', 'relativeOrbit': 83, 'frame': 8, 'flightDirection': 'ASCENDING'}
  n=11 in 0.3s searchComplete=True
  collections: {'NISAR_L2_GCOV_V1': 1, 'NISAR_L2_GCOV_PROVISIONAL_V1': 10}
  product types: {'GCOV': 11}
  (track,dir,frame): {(83, 'ASCENDING', 8): 11}

### G same as F but asfFrame=8 instead of frame=8
  kwargs={'dataset': 'NISAR', 'processingLevel': 'GCOV', 'intersectsWith': 'POINT(104.05 12.95)', 'start': '2026-06-01T00:00:00Z', 'end': '2026-11-13T23:59:59Z', 'relativeOrbit': 83, 'asfFrame': 8, 'flightDirection': 'ASCENDING'}
  n=11 in 0.2s searchComplete=True
  collections: {'NISAR_L2_GCOV_V1': 1, 'NISAR_L2_GCOV_PROVISIONAL_V1': 10}
  product types: {'GCOV': 11}
  (track,dir,frame): {(83, 'ASCENDING', 8): 11}

### H track/frame/direction only, NO spatial filter (expect 33 incl. partial frames)
  kwargs={'dataset': 'NISAR', 'processingLevel': 'GCOV', 'start': '2026-06-01T00:00:00Z', 'end': '2026-11-13T23:59:59Z', 'relativeOrbit': 83, 'frame': 8, 'flightDirection': 'ASCENDING'}
  n=33 in 0.3s searchComplete=True
  collections: {'NISAR_L2_GCOV_V1': 3, 'NISAR_L2_GCOV_PROVISIONAL_V1': 30}
  product types: {'GCOV': 33}
  (track,dir,frame): {(83, 'ASCENDING', 8): 33}

### I H + frameCoverage='FULL'
  kwargs={'dataset': 'NISAR', 'processingLevel': 'GCOV', 'start': '2026-06-01T00:00:00Z', 'end': '2026-11-13T23:59:59Z', 'relativeOrbit': 83, 'frame': 8, 'flightDirection': 'ASCENDING', 'frameCoverage': 'FULL'}
  n=11 in 0.2s searchComplete=True
  collections: {'NISAR_L2_GCOV_V1': 1, 'NISAR_L2_GCOV_PROVISIONAL_V1': 10}
  product types: {'GCOV': 11}
  (track,dir,frame): {(83, 'ASCENDING', 8): 11}
````


#### A.6 asf_explore_02.py

Source: `S/scripts/asf_explore_02.py` (md5 `3a86226b7b80f29620bfff934c474b9a`). Status: **ran**.

````python
"""Exploration 2: show the exact CMR query asf_search sends, and dump every property of one result."""
import json
import logging

import asf_search as asf

# ASF_LOGGER debug prints the translated CMR query
asf.ASF_LOGGER.setLevel(logging.DEBUG)
h = logging.StreamHandler()
h.setLevel(logging.DEBUG)
asf.ASF_LOGGER.addHandler(h)

opts = asf.ASFSearchOptions(
    dataset=asf.DATASET.NISAR,
    processingLevel=asf.PRODUCT_TYPE.GCOV,
    intersectsWith="POINT(104.05 12.95)",
    start="2026-06-01T00:00:00Z",
    end="2026-11-13T23:59:59Z",
    relativeOrbit=83,
    frame=8,
    flightDirection=asf.FLIGHT_DIRECTION.ASCENDING,
)
print("OPTS:", opts)

# what would be sent to CMR
from asf_search.CMR.subquery import build_subqueries
from asf_search.CMR.translate import translate_opts

subs = build_subqueries(opts)
print("number of subqueries:", len(subs))
for i, sq in enumerate(subs):
    t = translate_opts(sq)
    print(f"--- subquery {i}: {len(t)} CMR params")
    for k, v in t:
        print("    ", k, "=", v)

res = asf.search(opts=opts)
asf.ASF_LOGGER.setLevel(logging.WARNING)
print("\nN =", len(res), "| type of result:", type(res).__name__, "| type of item:", type(res[0]).__name__)
p = [r for r in res if "20261017T223633" in r.properties["sceneName"]][0]
print("\nALL PROPERTIES of", p.properties["sceneName"])
print(json.dumps(p.properties, indent=1, default=str))
print("\nGEOMETRY:", json.dumps(p.geometry))
print("\nmeta:", json.dumps(p.meta))
print("\nORDER of results (index, startTime, sceneName):")
for i, r in enumerate(res):
    print("  ", i, r.properties["startTime"], r.properties["sceneName"])
````

What it printed (`S/out2/asf_explore_02.txt`):

````text
OPTS: {
    "flightDirection": "ASCENDING",
    "frame": [
        8
    ],
    "intersectsWith": "POINT (104.0499999999999972 12.9499999999999993)",
    "processingLevel": [
        "GCOV"
    ],
    "relativeOrbit": [
        83
    ],
    "start": "2026-06-01T00:00:00Z",
    "end": "2026-11-13T23:59:59Z",
    "dataset": [
        "NISAR"
    ]
}
number of subqueries: 1
--- subquery 0: 68 CMR params
     attribute[] = string,ASCENDING_DESCENDING,ASCENDING
     attribute[] = int,FRAME_NUMBER,8
     attribute[] = int,TRACK_NUMBER,83
     shortName = ASF_ECMWF_SMST
     shortName = NISAR_ANC_AUX
     shortName = NISAR_COP
     shortName = NISAR_CUSTOM_PROVISIONAL_V1
     shortName = NISAR_DC_RADAR
     shortName = NISAR_EA_L0B_CRSD
     shortName = NISAR_EA_L0B_RRSD
     shortName = NISAR_EA_L1
     shortName = NISAR_EA_L2
     shortName = NISAR_EA_L3
     shortName = NISAR_L0A_RRST_BETA_V1
     shortName = NISAR_L0A_RRST_PROVISIONAL_V1
     shortName = NISAR_L0A_RRST_V1
     shortName = NISAR_L0B_RRSD_BETA_V1
     shortName = NISAR_L0B_RRSD_PROVISIONAL_V1
     shortName = NISAR_L0B_RRSD_V1
     shortName = NISAR_L1_RIFG_BETA_V1
     shortName = NISAR_L1_RIFG_PROVISIONAL_V1
     shortName = NISAR_L1_RIFG_V1
     shortName = NISAR_L1_ROFF_BETA_V1
     shortName = NISAR_L1_ROFF_PROVISIONAL_V1
     shortName = NISAR_L1_ROFF_V1
     shortName = NISAR_L1_RSLC_BETA_V1
     shortName = NISAR_L1_RSLC_PROVISIONAL_V1
     shortName = NISAR_L1_RSLC_V1
     shortName = NISAR_L1_RUNW_BETA_V1
     shortName = NISAR_L1_RUNW_PROVISIONAL_V1
     shortName = NISAR_L1_RUNW_V1
     shortName = NISAR_L2_GCOV_BETA_V1
     shortName = NISAR_L2_GCOV_PROVISIONAL_V1
     shortName = NISAR_L2_GCOV_V1
     shortName = NISAR_L2_GOFF_BETA_V1
     shortName = NISAR_L2_GOFF_PROVISIONAL_V1
     shortName = NISAR_L2_GOFF_V1
     shortName = NISAR_L2_GSLC_BETA_V1
     shortName = NISAR_L2_GSLC_PROVISIONAL_V1
     shortName = NISAR_L2_GSLC_V1
     shortName = NISAR_L2_GUNW_BETA_V1
     shortName = NISAR_L2_GUNW_PROVISIONAL_V1
     shortName = NISAR_L2_GUNW_V1
     shortName = NISAR_L3_SME2_BETA_V1
     shortName = NISAR_L3_SME2_PROVISIONAL_V1
     shortName = NISAR_L3_SME2_V1
     shortName = NISAR_LRCLK
     shortName = NISAR_LRCLK_UTC
     shortName = NISAR_NEN_RRST_BETA_V1
     shortName = NISAR_NEN_RRST_PROVISIONAL_V1
     shortName = NISAR_NEN_RRST_V1
     shortName = NISAR_OE
     shortName = NISAR_OROST
     shortName = NISAR_RP
     shortName = NISAR_STUF
     shortName = NISAR_TEC
     shortName = NISAR_UR_L0B_RRSD
     shortName = NISAR_UR_L1
     shortName = NISAR_UR_L2
     point = 104.0499999999999972,12.9499999999999993
     temporal = 2026-06-01T00:00:00Z,2026-11-13T23:59:59Z,
     attribute[] = string,PRODUCT_TYPE,GCOV
     page_size = 250
     options[temporal][and] = true
     sort_key[] = -end_date
     sort_key[] = granule_ur
     options[platform][ignore_case] = true
     provider = ASF
SEARCH: preprocessing opts: {
    "flightDirection": "ASCENDING",
    "frame": [
        8
N = 11 | type of result: ASFSearchResults | type of item: NISARProduct

ALL PROPERTIES of NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001
{
 "centerLat": null,
 "centerLon": null,
 "stopTime": "2026-10-17T22:37:08Z",
 "fileID": "NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001",
 "flightDirection": "ASCENDING",
 "pathNumber": 83,
 "processingLevel": "GCOV",
 "startTime": "2026-10-17T22:36:33Z",
 "sceneName": "NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001",
 "browse": [
 ],
 "platform": "NISAR",
 "md5sum": null,
 "frameNumber": 8,
 "granuleType": null,
 "orbit": 6410,
 "polarization": null,
 "processingDate": "2026-10-19T21:40:01Z",
 "sensor": "L-SAR",
 "pgeVersion": "R05.02.3",
 "crid": "P05023",
 "mainBandPolarization": [
  "HH",
  "HV"
 ],
 "sideBandPolarization": [
  "HH",
  "HV"
 ],
 "frameCoverage": "Full",
 "jointObservation": false,
 "rangeBandwidth": [
  "20+5"
 ],
 "productionConfiguration": "PR",
 "collectionName": "NISAR_L2_GCOV_PROVISIONAL_V1",
 "orbitType": "MOE",
 "fileName": "NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001.h5",
 "beamModeType": null,
 "additionalUrls": [
 ],
 "s3Urls": [
 ],
 "groupID": "NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001",
 "conceptID": "C2854338529-ASF"
}

GEOMETRY: {"coordinates": [[[105.41857, 11.99121], [104.89877, 14.13511], [102.63217, 13.59435], [103.1681, 11.45942], [105.41857, 11.99121]]], "type": "Polygon"}

meta: {"concept-type": "granule", "concept-id": "G4378438775-ASF", "revision-id": 1, "native-id": "NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001", "collection-concept-id": "C2854338529-ASF", "provider-id": "ASF", "format": "application/vnd.nasa.cmr.umm+json", "revision-date": "2026-10-19T21:46:19.449Z"}

ORDER of results (index, startTime, sceneName):
   0 2026-10-29T22:36:34Z NISAR_L2_PR_GCOV_034_083_A_008_2005_DHDH_M_20261029T223634_20261029T223708_P05036_N_F_J_001
   1 2026-10-17T22:36:33Z NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001
   2 2026-10-05T22:36:33Z NISAR_L2_PR_GCOV_032_083_A_008_2005_DHDH_M_20261005T223633_20261005T223708_P05023_N_F_J_001
   3 2026-09-23T22:36:33Z NISAR_L2_PR_GCOV_031_083_A_008_2005_DHDH_M_20260923T223633_20260923T223708_P05023_N_F_J_001
   4 2026-09-11T22:36:33Z NISAR_L2_PR_GCOV_030_083_A_008_2005_DHDH_M_20260911T223633_20260911T223708_P05023_N_F_J_001
   5 2026-08-30T22:36:33Z NISAR_L2_PR_GCOV_029_083_A_008_2005_DHDH_M_20260830T223633_20260830T223708_P05023_N_F_J_001
   6 2026-08-18T22:36:34Z NISAR_L2_PR_GCOV_028_083_A_008_2005_DHDH_M_20260818T223634_20260818T223708_P05023_N_F_J_001
   7 2026-07-25T22:36:35Z NISAR_L2_PR_GCOV_026_083_A_008_2005_DHDH_M_20260725T223635_20260725T223709_P05023_N_F_J_001
   8 2026-07-13T22:36:36Z NISAR_L2_PR_GCOV_025_083_A_008_2005_DHDH_M_20260713T223636_20260713T223710_P05023_N_F_J_001
   9 2026-07-01T22:36:36Z NISAR_L2_PR_GCOV_024_083_A_008_2005_DHDH_M_20260701T223636_20260701T223711_P05023_N_F_J_001
   10 2026-06-19T22:36:37Z NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223637_20260619T223711_P05023_N_F_J_001
````

(Output shortened for this digest: filtered from 736 lines. Full file: `S/out2/asf_explore_02.txt`.)


Left out above: the debug log between the translated query and the result, and every line holding a URL or a per-file size (so the `url`, `bytes`, `browse`, `additionalUrls` and `s3Urls` values are missing; Section 6.3 describes them).

#### A.7 asf_explore_03.py

Source: `S/scripts/asf_explore_03.py` (md5 `fe2f21d6154fb865db060d56dc2f598f`). Status: **ran**.

````python
"""Exploration 3: more asf_search variants (geo_search, dataMaturity, search_count, maxResults, NISAR filters, polygons)."""
import time
from collections import Counter

import asf_search as asf

WKT = "POINT(104.05 12.95)"
START, END = "2026-06-01T00:00:00Z", "2026-11-13T23:59:59Z"
BASE = dict(dataset=asf.DATASET.NISAR, processingLevel=asf.PRODUCT_TYPE.GCOV, start=START, end=END)
STACK = dict(relativeOrbit=83, frame=8, flightDirection=asf.FLIGHT_DIRECTION.ASCENDING)


def summarize(label, res, dt):
    cols = Counter(p.properties.get("collectionName") for p in res)
    cov = Counter(p.properties.get("frameCoverage") for p in res)
    bw = Counter(tuple(p.properties.get("rangeBandwidth") or []) for p in res)
    pol = Counter(tuple(p.properties.get("mainBandPolarization") or []) for p in res)
    print(f"\n### {label}\n  n={len(res)} in {dt:.1f}s complete={getattr(res, 'searchComplete', None)}")
    print("  collections:", dict(cols), "| coverage:", dict(cov), "| bandwidth:", dict(bw), "| freqA pol:", dict(pol))


def run(label, fn=asf.search, **kw):
    t = time.time()
    try:
        res = fn(**kw)
    except Exception as exc:  # noqa: BLE001
        print(f"\n### {label}\n  EXCEPTION {type(exc).__name__}: {exc}")
        return None
    summarize(label, res, time.time() - t)
    return res


run("geo_search(point) + stack", fn=asf.geo_search, intersectsWith=WKT, **BASE, **STACK)
run("dataMaturity=['PROVISIONAL']", intersectsWith=WKT, dataMaturity=["PROVISIONAL"], **BASE, **STACK)
run("dataMaturity=['VALIDATED']", intersectsWith=WKT, dataMaturity=["VALIDATED"], **BASE, **STACK)
run("dataMaturity=['BETA']", intersectsWith=WKT, dataMaturity=["BETA"], **BASE, **STACK)
run("dataMaturity='validated' (lowercase str)", intersectsWith=WKT, dataMaturity="validated", **BASE, **STACK)
run("maxResults=5", intersectsWith=WKT, maxResults=5, **BASE, **STACK)
run("rangeBandwidth=RANGE_BANDWIDTH.BW_20_5, no point", rangeBandwidth=asf.RANGE_BANDWIDTH.BW_20_5, **BASE, **STACK)
run("rangeBandwidth=RANGE_BANDWIDTH.BW_40_5, no point", rangeBandwidth=asf.RANGE_BANDWIDTH.BW_40_5, **BASE, **STACK)
run("mainBandPolarization=POLARIZATION.HH_HV, point only (both tracks)", intersectsWith=WKT, mainBandPolarization=asf.POLARIZATION.HH_HV, **BASE)
run("mainBandPolarization='HH', point only", intersectsWith=WKT, mainBandPolarization="HH", **BASE)
run("frameCoverage='PARTIAL', no point", frameCoverage="PARTIAL", **BASE, **STACK)
run("cmr_keywords STACK_ID, no point", cmr_keywords=[("attribute[]", "string,STACK_ID,083_A_008")], **BASE)
run("granule_list=[example name]", granule_list=["NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001"])
run("small polygon WKT (non-rectangle triangle) + stack",
    intersectsWith="POLYGON((103.9 12.8, 104.2 12.8, 104.05 13.1, 103.9 12.8))", **BASE, **STACK)
run("rectangle polygon WKT + stack (asf converts to bbox)",
    intersectsWith="POLYGON((103.9 12.8, 104.2 12.8, 104.2 13.1, 103.9 13.1, 103.9 12.8))", **BASE, **STACK)
run("clockwise polygon WKT + stack (asf should repair winding)",
    intersectsWith="POLYGON((103.9 12.8, 104.05 13.1, 104.2 12.8, 103.9 12.8))", **BASE, **STACK)
run("date-only strings start='2026-06-01', end='2026-11-13'", intersectsWith=WKT,
    dataset=asf.DATASET.NISAR, processingLevel=asf.PRODUCT_TYPE.GCOV, start="2026-06-01", end="2026-11-13", **STACK)
run("no dates at all + point + stack", intersectsWith=WKT, dataset=asf.DATASET.NISAR, processingLevel=asf.PRODUCT_TYPE.GCOV, **STACK)

t = time.time()
n = asf.search_count(intersectsWith=WKT, **BASE, **STACK)
print(f"\n### search_count(point + stack) -> {n!r} in {time.time()-t:.1f}s")
t = time.time()
n = asf.search_count(dataset=asf.DATASET.NISAR, processingLevel=asf.PRODUCT_TYPE.GCOV)
print(f"### search_count(all NISAR GCOV, global, all dates) -> {n!r} in {time.time()-t:.1f}s")
for m in ("BETA", "PROVISIONAL", "VALIDATED"):
    t = time.time()
    n = asf.search_count(dataset=asf.DATASET.NISAR, processingLevel=asf.PRODUCT_TYPE.GCOV, dataMaturity=[m])
    print(f"### search_count(all NISAR GCOV, dataMaturity={m}) -> {n!r} in {time.time()-t:.1f}s")
````

What it printed (`S/out2/asf_explore_03.txt`):

````text

### geo_search(point) + stack
  n=11 in 0.3s complete=True
  collections: {'NISAR_L2_GCOV_V1': 1, 'NISAR_L2_GCOV_PROVISIONAL_V1': 10} | coverage: {'Full': 11} | bandwidth: {('20+5',): 11} | freqA pol: {('HH', 'HV'): 11}

### dataMaturity=['PROVISIONAL']
  n=10 in 0.2s complete=True
  collections: {'NISAR_L2_GCOV_PROVISIONAL_V1': 10} | coverage: {'Full': 10} | bandwidth: {('20+5',): 10} | freqA pol: {('HH', 'HV'): 10}

### dataMaturity=['VALIDATED']
  n=1 in 0.1s complete=True
  collections: {'NISAR_L2_GCOV_V1': 1} | coverage: {'Full': 1} | bandwidth: {('20+5',): 1} | freqA pol: {('HH', 'HV'): 1}

### dataMaturity=['BETA']
  n=0 in 0.2s complete=True
  collections: {} | coverage: {} | bandwidth: {} | freqA pol: {}

### dataMaturity='validated' (lowercase str)
  n=1 in 0.2s complete=True
  collections: {'NISAR_L2_GCOV_V1': 1} | coverage: {'Full': 1} | bandwidth: {('20+5',): 1} | freqA pol: {('HH', 'HV'): 1}

### maxResults=5
  n=5 in 0.4s complete=True
  collections: {'NISAR_L2_GCOV_V1': 1, 'NISAR_L2_GCOV_PROVISIONAL_V1': 4} | coverage: {'Full': 5} | bandwidth: {('20+5',): 5} | freqA pol: {('HH', 'HV'): 5}

### rangeBandwidth=RANGE_BANDWIDTH.BW_20_5, no point
  n=11 in 0.2s complete=True
  collections: {'NISAR_L2_GCOV_V1': 1, 'NISAR_L2_GCOV_PROVISIONAL_V1': 10} | coverage: {'Full': 11} | bandwidth: {('20+5',): 11} | freqA pol: {('HH', 'HV'): 11}

### rangeBandwidth=RANGE_BANDWIDTH.BW_40_5, no point
  n=22 in 0.3s complete=True
  collections: {'NISAR_L2_GCOV_V1': 2, 'NISAR_L2_GCOV_PROVISIONAL_V1': 20} | coverage: {'Partial': 22} | bandwidth: {('40+5',): 22} | freqA pol: {('HH', 'HV'): 22}

### mainBandPolarization=POLARIZATION.HH_HV, point only (both tracks)
  n=17 in 0.2s complete=True
  collections: {'NISAR_L2_GCOV_V1': 2, 'NISAR_L2_GCOV_PROVISIONAL_V1': 15} | coverage: {'Full': 17} | bandwidth: {('20+5',): 17} | freqA pol: {('HH', 'HV'): 17}

### mainBandPolarization='HH', point only
  n=5 in 0.2s complete=True
  collections: {'NISAR_L2_GCOV_V1': 1, 'NISAR_L2_GCOV_PROVISIONAL_V1': 4} | coverage: {'Full': 5} | bandwidth: {('20+5',): 5} | freqA pol: {('HH',): 5}

### frameCoverage='PARTIAL', no point
  n=22 in 0.3s complete=True
  collections: {'NISAR_L2_GCOV_V1': 2, 'NISAR_L2_GCOV_PROVISIONAL_V1': 20} | coverage: {'Partial': 22} | bandwidth: {('40+5',): 22} | freqA pol: {('HH', 'HV'): 22}

### cmr_keywords STACK_ID, no point
  n=33 in 0.3s complete=True
  collections: {'NISAR_L2_GCOV_V1': 3, 'NISAR_L2_GCOV_PROVISIONAL_V1': 30} | coverage: {'Partial': 22, 'Full': 11} | bandwidth: {('40+5',): 22, ('20+5',): 11} | freqA pol: {('HH', 'HV'): 33}

### granule_list=[example name]
  n=1 in 0.2s complete=True
  collections: {'NISAR_L2_GCOV_PROVISIONAL_V1': 1} | coverage: {'Full': 1} | bandwidth: {('20+5',): 1} | freqA pol: {('HH', 'HV'): 1}

### small polygon WKT (non-rectangle triangle) + stack
  n=11 in 0.2s complete=True
  collections: {'NISAR_L2_GCOV_V1': 1, 'NISAR_L2_GCOV_PROVISIONAL_V1': 10} | coverage: {'Full': 11} | bandwidth: {('20+5',): 11} | freqA pol: {('HH', 'HV'): 11}

### rectangle polygon WKT + stack (asf converts to bbox)
  n=11 in 0.2s complete=True
  collections: {'NISAR_L2_GCOV_V1': 1, 'NISAR_L2_GCOV_PROVISIONAL_V1': 10} | coverage: {'Full': 11} | bandwidth: {('20+5',): 11} | freqA pol: {('HH', 'HV'): 11}
WARNING:asf_search:WKT REPAIR/VALIDATION: The following repairs were performed on the provided AOI:
["'type': 'REVERSE': 'report': Reversed polygon winding order"]

### clockwise polygon WKT + stack (asf should repair winding)
  n=11 in 0.2s complete=True
  collections: {'NISAR_L2_GCOV_V1': 1, 'NISAR_L2_GCOV_PROVISIONAL_V1': 10} | coverage: {'Full': 11} | bandwidth: {('20+5',): 11} | freqA pol: {('HH', 'HV'): 11}

### date-only strings start='2026-06-01', end='2026-11-13'
  n=11 in 0.2s complete=True
  collections: {'NISAR_L2_GCOV_V1': 1, 'NISAR_L2_GCOV_PROVISIONAL_V1': 10} | coverage: {'Full': 11} | bandwidth: {('20+5',): 11} | freqA pol: {('HH', 'HV'): 11}

### no dates at all + point + stack
  n=11 in 0.2s complete=True
  collections: {'NISAR_L2_GCOV_V1': 1, 'NISAR_L2_GCOV_PROVISIONAL_V1': 10} | coverage: {'Full': 11} | bandwidth: {('20+5',): 11} | freqA pol: {('HH', 'HV'): 11}

### search_count(point + stack) -> 11 in 0.1s
### search_count(all NISAR GCOV, global, all dates) -> 204030 in 0.1s
### search_count(all NISAR GCOV, dataMaturity=BETA) -> 23527 in 0.1s
### search_count(all NISAR GCOV, dataMaturity=PROVISIONAL) -> 163672 in 0.2s
### search_count(all NISAR GCOV, dataMaturity=VALIDATED) -> 14684 in 0.1s
````


#### A.8 asf_explore_04.py

Source: `S/scripts/asf_explore_04.py` (md5 `7c6a164f2d57d2c50a1807ac9344030a`). Status: **ran**.

````python
"""Exploration 4 of asf_search 14.1.0: which keyword combinations make relativeOrbit/frame work for NISAR,
what an unfiltered dataset=NISAR search returns, bad-value behaviour, exports."""
import json
import time
from collections import Counter

import asf_search as asf

asf.REPORT_ERRORS = False  # do not POST search-error reports to ASF from this test script

print("where the maturity constants live: hasattr(asf, 'PROVISIONAL') =", hasattr(asf, "PROVISIONAL"),
      "| hasattr(asf, 'MATURITIES') =", hasattr(asf, "MATURITIES"),
      "| asf.constants.PROVISIONAL =", repr(getattr(asf.constants, "PROVISIONAL", None)),
      "| asf.constants.MATURITIES.VALIDATED =", repr(asf.constants.MATURITIES.VALIDATED))
print("top-level constant modules:", [n for n in ("BEAMMODE", "FLIGHT_DIRECTION", "INSTRUMENT", "PLATFORM", "POLARIZATION",
      "PRODUCT_TYPE", "DATASET", "RANGE_BANDWIDTH", "PRODUCTION_CONFIGURATION", "MATURITIES") if hasattr(asf, n)])

WKT = "POINT(104.05 12.95)"
START, END = "2026-06-01T00:00:00Z", "2026-11-13T23:59:59Z"
GCOV_SHORT_NAMES = ["NISAR_L2_GCOV_BETA_V1", "NISAR_L2_GCOV_PROVISIONAL_V1", "NISAR_L2_GCOV_V1"]
GCOV_CONCEPT_IDS = ["C3622214170-ASF", "C2854338529-ASF", "C3622241360-ASF"]


def run(label, fn=asf.search, **kw):
    t = time.time()
    try:
        res = fn(**kw)
    except BaseException as exc:  # noqa: BLE001
        print(f"\n### {label}\n  EXCEPTION {type(exc).__name__}: {str(exc)[:400]}")
        return None
    dt = time.time() - t
    cols = Counter(p.properties.get("collectionName") for p in res)
    types = Counter(p.properties.get("processingLevel") for p in res)
    stacks = Counter((p.properties.get("pathNumber"), p.properties.get("flightDirection"), p.properties.get("frameNumber")) for p in res)
    cov = Counter(p.properties.get("frameCoverage") for p in res)
    print(f"\n### {label}\n  n={len(res)} in {dt:.1f}s | collections={dict(cols)}\n  types={dict(types)}\n  (track,dir,frame)={dict(stacks)} | coverage={dict(cov)}")
    return res


T = dict(start=START, end=END)
run("1 processingLevel=GCOV + relativeOrbit=83 + frame=8 + ASC + point  (NO dataset/platform/shortName)",
    processingLevel=asf.PRODUCT_TYPE.GCOV, relativeOrbit=83, frame=8, flightDirection="ASCENDING", intersectsWith=WKT, **T)
run("2 processingLevel=GCOV + relativeOrbit=83 + asfFrame=8 + ASC + point (NO dataset/platform/shortName)",
    processingLevel=asf.PRODUCT_TYPE.GCOV, relativeOrbit=83, asfFrame=8, flightDirection="ASCENDING", intersectsWith=WKT, **T)
run("3 platform=NISAR + GCOV + relativeOrbit=83 + frame=8 + ASC + point",
    platform=asf.PLATFORM.NISAR, processingLevel=asf.PRODUCT_TYPE.GCOV, relativeOrbit=83, frame=8, flightDirection="ASCENDING", intersectsWith=WKT, **T)
run("4 shortName=<3 GCOV> + relativeOrbit=83 + frame=8 + ASC + point (no processingLevel)",
    shortName=GCOV_SHORT_NAMES, relativeOrbit=83, frame=8, flightDirection="ASCENDING", intersectsWith=WKT, **T)
run("5 collections=<3 GCOV concept ids> + relativeOrbit=83 + frame=8 + ASC + point (no processingLevel)",
    collections=GCOV_CONCEPT_IDS, relativeOrbit=83, frame=8, flightDirection="ASCENDING", intersectsWith=WKT, **T)
run("6 collections=<3 GCOV concept ids> + relativeOrbit=83 + asfFrame=8 + ASC + point (no processingLevel)",
    collections=GCOV_CONCEPT_IDS, relativeOrbit=83, asfFrame=8, flightDirection="ASCENDING", intersectsWith=WKT, **T)
run("7 dataset=NISAR + point + dates, NO processingLevel (every NISAR product type at the point)",
    dataset=asf.DATASET.NISAR, intersectsWith=WKT, **T)
run("8 dataset=NISAR_SCIENCE_PRODUCTS + point + dates, NO processingLevel",
    dataset=asf.DATASET.NISAR_SCIENCE_PRODUCTS, intersectsWith=WKT, **T)
run("9 dataset=NISAR + GCOV + point + dataMaturity=[asf.constants.PROVISIONAL, asf.constants.VALIDATED]",
    dataset=asf.DATASET.NISAR, processingLevel=asf.PRODUCT_TYPE.GCOV, intersectsWith=WKT,
    dataMaturity=[asf.constants.PROVISIONAL, asf.constants.VALIDATED], **T)
run("10 frameCoverage='Full' (mixed case)", dataset=asf.DATASET.NISAR, processingLevel=asf.PRODUCT_TYPE.GCOV,
    relativeOrbit=83, frame=8, flightDirection="ASCENDING", frameCoverage="Full", **T)
run("11 frameCoverage='TRUE' (invalid value)", dataset=asf.DATASET.NISAR, processingLevel=asf.PRODUCT_TYPE.GCOV,
    relativeOrbit=83, frame=8, flightDirection="ASCENDING", frameCoverage="TRUE", **T)
run("12 flightDirection='A' (short form)", dataset=asf.DATASET.NISAR, processingLevel=asf.PRODUCT_TYPE.GCOV,
    relativeOrbit=83, frame=8, flightDirection="A", intersectsWith=WKT, **T)
run("13 flightDirection='ascending' (lower case)", dataset=asf.DATASET.NISAR, processingLevel=asf.PRODUCT_TYPE.GCOV,
    relativeOrbit=83, frame=8, flightDirection="ascending", intersectsWith=WKT, **T)
run("14 relativeOrbit=[83, 148] + point (two tracks in one call)", dataset=asf.DATASET.NISAR, processingLevel=asf.PRODUCT_TYPE.GCOV,
    relativeOrbit=[83, 148], intersectsWith=WKT, **T)
run("15 unknown keyword 'track=83' (expect error)", dataset=asf.DATASET.NISAR, processingLevel=asf.PRODUCT_TYPE.GCOV,
    track=83, intersectsWith=WKT, **T)
run("16 WKT with lat/lon swapped 'POINT(12.95 104.05)' (lat 104 is invalid)", dataset=asf.DATASET.NISAR,
    processingLevel=asf.PRODUCT_TYPE.GCOV, intersectsWith="POINT(12.95 104.05)", **T)
run("17 datetime objects for start/end", dataset=asf.DATASET.NISAR, processingLevel=asf.PRODUCT_TYPE.GCOV,
    relativeOrbit=83, frame=8, flightDirection="ASCENDING", intersectsWith=WKT,
    start=__import__("datetime").datetime(2026, 6, 1), end=__import__("datetime").datetime(2026, 11, 13, 23, 59, 59))

# exports and helpers on the result object
res = asf.search(dataset=asf.DATASET.NISAR, processingLevel=asf.PRODUCT_TYPE.GCOV, intersectsWith=WKT,
                 relativeOrbit=83, frame=8, flightDirection=asf.FLIGHT_DIRECTION.ASCENDING, **T)
gj = res.geojson()
print("\n### res.geojson(): type =", gj["type"], "| n features =", len(gj["features"]),
      "| feature keys =", list(gj["features"][0].keys()), "| geometry type =", gj["features"][0]["geometry"]["type"])
print("    geojson size (chars):", len(json.dumps(gj)))
print("### public attributes of ASFSearchResults:", [a for a in dir(res) if not a.startswith("_") and a not in dir(list)])
p = res[0]
print("### public attributes of NISARProduct:", [a for a in dir(p) if not a.startswith("_")])
print("### p.get_urls():", [u.rsplit("/", 1)[-1][-40:] for u in p.get_urls()] if hasattr(p, "get_urls") else "n/a")
print("### type(p.umm), keys:", type(p.umm).__name__, list(p.umm.keys()))
print("### res.searchOptions:", dict(res.searchOptions))
print("### res.searchComplete:", res.searchComplete)
````

What it printed (`S/out2/asf_explore_04.txt`):

````text
where the maturity constants live: hasattr(asf, 'PROVISIONAL') = False | hasattr(asf, 'MATURITIES') = False | asf.constants.PROVISIONAL = 'PROVISIONAL' | asf.constants.MATURITIES.VALIDATED = 'VALIDATED'
top-level constant modules: ['BEAMMODE', 'FLIGHT_DIRECTION', 'INSTRUMENT', 'PLATFORM', 'POLARIZATION', 'PRODUCT_TYPE', 'DATASET', 'RANGE_BANDWIDTH', 'PRODUCTION_CONFIGURATION']

### 1 processingLevel=GCOV + relativeOrbit=83 + frame=8 + ASC + point  (NO dataset/platform/shortName)
  n=0 in 0.8s | collections={}
  types={}
  (track,dir,frame)={} | coverage={}

### 2 processingLevel=GCOV + relativeOrbit=83 + asfFrame=8 + ASC + point (NO dataset/platform/shortName)
  n=11 in 0.6s | collections={'NISAR_L2_GCOV_V1': 1, 'NISAR_L2_GCOV_PROVISIONAL_V1': 10}
  types={'GCOV': 11}
  (track,dir,frame)={(83, 'ASCENDING', 8): 11} | coverage={'Full': 11}

### 3 platform=NISAR + GCOV + relativeOrbit=83 + frame=8 + ASC + point
  n=11 in 0.3s | collections={'NISAR_L2_GCOV_V1': 1, 'NISAR_L2_GCOV_PROVISIONAL_V1': 10}
  types={'GCOV': 11}
  (track,dir,frame)={(83, 'ASCENDING', 8): 11} | coverage={'Full': 11}

### 4 shortName=<3 GCOV> + relativeOrbit=83 + frame=8 + ASC + point (no processingLevel)
  n=11 in 0.4s | collections={'NISAR_L2_GCOV_V1': 1, 'NISAR_L2_GCOV_PROVISIONAL_V1': 10}
  types={'GCOV': 11}
  (track,dir,frame)={(83, 'ASCENDING', 8): 11} | coverage={'Full': 11}

### 5 collections=<3 GCOV concept ids> + relativeOrbit=83 + frame=8 + ASC + point (no processingLevel)
  n=0 in 0.2s | collections={}
  types={}
  (track,dir,frame)={} | coverage={}

### 6 collections=<3 GCOV concept ids> + relativeOrbit=83 + asfFrame=8 + ASC + point (no processingLevel)
  n=0 in 0.1s | collections={}
  types={}
  (track,dir,frame)={} | coverage={}

### 7 dataset=NISAR + point + dates, NO processingLevel (every NISAR product type at the point)
  n=4086 in 6.4s | collections={'ASF_ECMWF_SMST': 3961, 'NISAR_L0B_RRSD_V1': 4, 'NISAR_L2_GSLC_V1': 3, 'NISAR_L2_GCOV_V1': 3, 'NISAR_L1_RSLC_V1': 3, 'NISAR_L3_SME2_PROVISIONAL_V1': 19, 'NISAR_L2_GUNW_PROVISIONAL_V1': 17, 'NISAR_L2_GSLC_PROVISIONAL_V1': 19, 'NISAR_L2_GCOV_PROVISIONAL_V1': 19, 'NISAR_L1_RSLC_PROVISIONAL_V1': 19, 'NISAR_L0B_RRSD_PROVISIONAL_V1': 19}
  types={'ECMWF_SMST': 3961, 'RRSD': 23, 'GSLC': 22, 'GCOV': 22, 'RSLC': 22, 'SME2': 19, 'GUNW': 17}
  (track,dir,frame)={(None, None, None): 3961, (83, 'ASCENDING', None): 12, (148, 'DESCENDING', 82): 50, (148, 'DESCENDING', None): 11, (83, 'ASCENDING', 8): 52} | coverage={None: 3984, 'Full': 102}

### 8 dataset=NISAR_SCIENCE_PRODUCTS + point + dates, NO processingLevel
  n=125 in 0.9s | collections={'NISAR_L0B_RRSD_V1': 4, 'NISAR_L2_GSLC_V1': 3, 'NISAR_L2_GCOV_V1': 3, 'NISAR_L1_RSLC_V1': 3, 'NISAR_L3_SME2_PROVISIONAL_V1': 19, 'NISAR_L2_GUNW_PROVISIONAL_V1': 17, 'NISAR_L2_GSLC_PROVISIONAL_V1': 19, 'NISAR_L2_GCOV_PROVISIONAL_V1': 19, 'NISAR_L1_RSLC_PROVISIONAL_V1': 19, 'NISAR_L0B_RRSD_PROVISIONAL_V1': 19}
  types={'RRSD': 23, 'GSLC': 22, 'GCOV': 22, 'RSLC': 22, 'SME2': 19, 'GUNW': 17}
  (track,dir,frame)={(83, 'ASCENDING', None): 12, (148, 'DESCENDING', 82): 50, (148, 'DESCENDING', None): 11, (83, 'ASCENDING', 8): 52} | coverage={None: 23, 'Full': 102}

### 9 dataset=NISAR + GCOV + point + dataMaturity=[asf.constants.PROVISIONAL, asf.constants.VALIDATED]
  n=22 in 0.3s | collections={'NISAR_L2_GCOV_V1': 3, 'NISAR_L2_GCOV_PROVISIONAL_V1': 19}
  types={'GCOV': 22}
  (track,dir,frame)={(148, 'DESCENDING', 82): 11, (83, 'ASCENDING', 8): 11} | coverage={'Full': 22}

### 10 frameCoverage='Full' (mixed case)
  n=11 in 0.2s | collections={'NISAR_L2_GCOV_V1': 1, 'NISAR_L2_GCOV_PROVISIONAL_V1': 10}
  types={'GCOV': 11}
  (track,dir,frame)={(83, 'ASCENDING', 8): 11} | coverage={'Full': 11}

### 11 frameCoverage='TRUE' (invalid value)
  EXCEPTION KeyError: 'T'

### 12 flightDirection='A' (short form)
  n=0 in 0.2s | collections={}
  types={}
  (track,dir,frame)={} | coverage={}

### 13 flightDirection='ascending' (lower case)
  n=11 in 0.2s | collections={'NISAR_L2_GCOV_V1': 1, 'NISAR_L2_GCOV_PROVISIONAL_V1': 10}
  types={'GCOV': 11}
  (track,dir,frame)={(83, 'ASCENDING', 8): 11} | coverage={'Full': 11}

### 14 relativeOrbit=[83, 148] + point (two tracks in one call)
  n=22 in 0.4s | collections={'NISAR_L2_GCOV_V1': 3, 'NISAR_L2_GCOV_PROVISIONAL_V1': 19}
  types={'GCOV': 22}
  (track,dir,frame)={(148, 'DESCENDING', 82): 11, (83, 'ASCENDING', 8): 11} | coverage={'Full': 22}

### 15 unknown keyword 'track=83' (expect error)
  EXCEPTION TypeError: search() got an unexpected keyword argument 'track'
WARNING:asf_search:WKT REPAIR/VALIDATION: The following repairs were performed on the provided AOI:
["'type': 'CLAMP': 'report': 'Clamped 1 value(s) to +/-90 latitude'"]

### 16 WKT with lat/lon swapped 'POINT(12.95 104.05)' (lat 104 is invalid)
  n=0 in 0.1s | collections={}
  types={}
  (track,dir,frame)={} | coverage={}

### 17 datetime objects for start/end
  n=11 in 0.2s | collections={'NISAR_L2_GCOV_V1': 1, 'NISAR_L2_GCOV_PROVISIONAL_V1': 10}
  types={'GCOV': 11}
  (track,dir,frame)={(83, 'ASCENDING', 8): 11} | coverage={'Full': 11}

### res.geojson(): type = FeatureCollection | n features = 11 | feature keys = ['type', 'geometry', 'properties'] | geometry type = Polygon
    geojson size (chars): 182824
### public attributes of ASFSearchResults: ['csv', 'data', 'download', 'find_urls', 'geojson', 'get_products_by_subclass_type', 'json', 'jsonlite', 'jsonlite2', 'kml', 'metalink', 'raise_if_incomplete', 'searchComplete', 'searchOptions']
### public attributes of NISARProduct: ['BaselineCalcType', 'baseline', 'baseline_type', 'centroid', 'download', 'find_urls', 'geojson', 'geometry', 'get_baseline_calc_properties', 'get_classname', 'get_default_baseline_product_type', 'get_sort_keys', 'get_stack_opts', 'get_urls', 'has_baseline', 'is_valid_reference', 'meta', 'properties', 'remotezip', 'session', 'stack', 'translate_product', 'umm', 'umm_cast', 'umm_get']
### p.get_urls(): ['3634_20261029T223708_P05036_N_F_J_001.h5']
### type(p.umm), keys: dict ['TemporalExtent', 'OrbitCalculatedSpatialDomains', 'GranuleUR', 'AdditionalAttributes', 'SpatialExtent', 'ProviderDates', 'CollectionReference', 'PGEVersionClass', 'RelatedUrls', 'InputGranules', 'DataGranule', 'Platforms', 'MetadataSpecification']
### res.searchOptions: {'flightDirection': 'ASCENDING', 'frame': [8], 'intersectsWith': 'POINT (104.0499999999999972 12.9499999999999993)', 'processingLevel': ['GCOV'], 'relativeOrbit': [83], 'start': '2026-06-01T00:00:00Z', 'end': '2026-11-13T23:59:59Z', 'dataset': ['NISAR']}
### res.searchComplete: True
````


#### A.9 asf_explore_05.py

Source: `S/scripts/asf_explore_05.py` (md5 `da79169c211beef16a32fae5b061a45b`). Status: **ran**.

````python
"""Exploration 5 of asf_search 14.1.0: date-string handling, pagination on a large result set, search_generator,
timing, and a larger-area query that exposes cross-collection duplicates."""
import logging
import time
from collections import Counter, defaultdict

import asf_search as asf

asf.REPORT_ERRORS = False  # do not POST search-error reports to ASF from this test script

BASE = dict(dataset=asf.DATASET.NISAR, processingLevel=asf.PRODUCT_TYPE.GCOV)
STACK = dict(relativeOrbit=83, frame=8, flightDirection=asf.FLIGHT_DIRECTION.ASCENDING, intersectsWith="POINT(104.05 12.95)")

print("### A. how date strings are normalised (ASFSearchOptions -> what is sent as temporal)")
from asf_search.search.search_generator import preprocess_opts  # noqa: E402
from asf_search.CMR.translate import translate_opts  # noqa: E402
from asf_search.CMR.subquery import build_subqueries  # noqa: E402

for s, e in [("2026-06-01", "2026-10-29"),
             ("2026-06-01T00:00:00Z", "2026-10-29T23:59:59Z"),
             ("2026-06-01T00:00:00+07:00", "2026-10-29T00:00:00+07:00"),
             ("June 1 2026", "October 29 2026"),
             ("2026-06-01", None),
             (None, None)]:
    kw = {k: v for k, v in (("start", s), ("end", e)) if v is not None}
    opts = asf.ASFSearchOptions(**BASE, **STACK, **kw)
    preprocess_opts(opts)
    temporal = [v for k, v in translate_opts(build_subqueries(opts)[0]) if k == "temporal"]
    n = len(asf.search(**BASE, **STACK, **kw))
    print(f"  start={s!r:30} end={e!r:30} -> temporal sent: {temporal} -> n={n}")

print("\n### B. pagination: search_generator pages on a larger query (South-East Asia box, Oct 2026, GCOV)")
big = dict(**BASE, intersectsWith="POLYGON((95 5, 110 5, 110 25, 95 25, 95 5))", start="2026-10-01T00:00:00Z", end="2026-11-01T00:00:00Z")
t = time.time()
print("  search_count:", asf.search_count(**big), f"({time.time()-t:.1f}s)")
t = time.time()
total = 0
for i, page in enumerate(asf.search_generator(**big)):
    total += len(page)
    print(f"  page {i+1}: {len(page)} items, cumulative {total}, searchComplete={page.searchComplete}, t={time.time()-t:.1f}s")
t = time.time()
res = asf.search(**big)
print(f"  asf.search(same) -> {len(res)} in {time.time()-t:.1f}s, searchComplete={res.searchComplete}")
print("  collections:", dict(Counter(p.properties["collectionName"] for p in res)))
print("  coverage:", dict(Counter(p.properties["frameCoverage"] for p in res)))
print("  rangeBandwidth:", dict(Counter(tuple(p.properties["rangeBandwidth"]) for p in res)))
print("  mainBandPolarization:", dict(Counter(tuple(p.properties["mainBandPolarization"] or []) for p in res)))
print("  unique sceneName:", len({p.properties["sceneName"] for p in res}), "of", len(res))
t = time.time()
res5 = asf.search(**big, maxResults=300)
print(f"  maxResults=300 -> {len(res5)} in {time.time()-t:.1f}s")

print("\n### C. duplicates across maturity collections: same point as the ground truth is clean, so look at a place and")
print("       period where Beta and Provisional overlap (Dec 2025). Key = (track, direction, frame, startTime, coverage)")
dup = dict(**BASE, intersectsWith="POLYGON((-125 32, -114 32, -114 42, -125 42, -125 32))", start="2025-11-01T00:00:00Z", end="2026-01-31T00:00:00Z")
t = time.time()
res = asf.search(**dup)
print(f"  n={len(res)} in {time.time()-t:.1f}s | collections={dict(Counter(p.properties['collectionName'] for p in res))}")
groups = defaultdict(list)
for p in res:
    q = p.properties
    groups[(q["pathNumber"], q["flightDirection"], q["frameNumber"], q["startTime"], q["frameCoverage"])].append(q)
multi = {k: v for k, v in groups.items() if len(v) > 1}
print(f"  distinct acquisitions: {len(groups)} | acquisitions returned more than once: {len(multi)}")
shape = Counter(tuple(sorted(q["collectionName"].replace("NISAR_L2_GCOV_", "") for q in v)) for v in multi.values())
print("  duplicate groups by collection mix:", dict(shape))
for k, v in list(multi.items())[:2]:
    print("   ", k)
    for q in v:
        print("       ", q["collectionName"], q["crid"], q["sceneName"], "processed", q["processingDate"])
````

What it printed (`S/out2/asf_explore_05.txt`):

````text
### A. how date strings are normalised (ASFSearchOptions -> what is sent as temporal)
  start='2026-06-01'                   end='2026-10-29'                   -> temporal sent: ['2026-06-01T00:00:00Z,2026-10-29T00:00:00Z,'] -> n=10
  start='2026-06-01T00:00:00Z'         end='2026-10-29T23:59:59Z'         -> temporal sent: ['2026-06-01T00:00:00Z,2026-10-29T23:59:59Z,'] -> n=11
  start='2026-06-01T00:00:00+07:00'    end='2026-10-29T00:00:00+07:00'    -> temporal sent: ['2026-06-01T00:00:00Z,2026-10-29T00:00:00Z,'] -> n=10
  start='June 1 2026'                  end='October 29 2026'              -> temporal sent: ['2026-06-01T00:00:00Z,2026-10-29T00:00:00Z,'] -> n=10
  start='2026-06-01'                   end=None                           -> temporal sent: ['2026-06-01T00:00:00Z,2026-11-14T07:46:03.257948+00:00,'] -> n=11
  start=None                           end=None                           -> temporal sent: [] -> n=11

### B. pagination: search_generator pages on a larger query (South-East Asia box, Oct 2026, GCOV)
  search_count: 519 (0.1s)
  page 1: 250 items, cumulative 250, searchComplete=False, t=1.2s
  page 2: 250 items, cumulative 500, searchComplete=False, t=2.3s
  page 3: 19 items, cumulative 519, searchComplete=True, t=2.6s
  asf.search(same) -> 519 in 2.8s, searchComplete=True
  collections: {'NISAR_UR_L2': 32, 'NISAR_L2_GCOV_V1': 149, 'NISAR_L2_GCOV_PROVISIONAL_V1': 338}
  coverage: {'Full': 386, 'Partial': 133}
  rangeBandwidth: {('40+5',): 281, ('20+5',): 228, ('5',): 10}
  mainBandPolarization: {('HH', 'HV'): 463, ('VH', 'VV'): 1, (): 10, ('HH',): 39, ('HH', 'HV', 'VH', 'VV'): 6}
  unique sceneName: 519 of 519
  maxResults=300 -> 300 in 2.2s

### C. duplicates across maturity collections: same point as the ground truth is clean, so look at a place and
       period where Beta and Provisional overlap (Dec 2025). Key = (track, direction, frame, startTime, coverage)
  n=658 in 2.8s | collections={'NISAR_L2_GCOV_PROVISIONAL_V1': 196, 'NISAR_L2_GCOV_BETA_V1': 462}
  distinct acquisitions: 520 | acquisitions returned more than once: 138
  duplicate groups by collection mix: {('BETA_V1', 'PROVISIONAL_V1'): 137, ('BETA_V1', 'BETA_V1'): 1}
    (143, 'DESCENDING', 69, '2026-01-19T03:04:28Z', 'Full')
        NISAR_L2_GCOV_BETA_V1 X05010 NISAR_L2_PR_GCOV_010_143_D_069_4005_DHDH_A_20260119T030428_20260119T030503_X05010_N_F_J_001 processed 2026-02-11T13:48:56Z
        NISAR_L2_GCOV_PROVISIONAL_V1 P05023 NISAR_L2_PR_GCOV_010_143_D_069_4005_DHDH_A_20260119T030428_20260119T030503_P05023_N_F_J_001 processed 2026-08-07T17:36:25Z
    (143, 'DESCENDING', 67, '2026-01-19T03:03:20Z', 'Full')
        NISAR_L2_GCOV_BETA_V1 X05010 NISAR_L2_PR_GCOV_010_143_D_067_4005_DHDH_A_20260119T030320_20260119T030355_X05010_N_F_J_001 processed 2026-02-11T13:59:33Z
        NISAR_L2_GCOV_PROVISIONAL_V1 P05023 NISAR_L2_PR_GCOV_010_143_D_067_4005_DHDH_A_20260119T030320_20260119T030355_P05023_N_F_J_001 processed 2026-08-07T17:38:06Z
````


#### A.10 asf_explore_06.py

Source: `S/scripts/asf_explore_06.py` (md5 `8d6eb53758ee1840bc07c9b79f57ef5f`). Status: **ran**.

````python
"""Exploration 6 of asf_search 14.1.0: Urgent Response (NISAR_UR_L2) GCOV granules that dataset=NISAR also returns,
whether they duplicate production granules, and the filters that exclude them."""
import time
from collections import Counter, defaultdict

import asf_search as asf

asf.REPORT_ERRORS = False

AOI = "POLYGON((95 5, 110 5, 110 25, 95 25, 95 5))"
T = dict(start="2026-10-01T00:00:00Z", end="2026-11-01T00:00:00Z")
GCOV_SHORT_NAMES = ["NISAR_L2_GCOV_BETA_V1", "NISAR_L2_GCOV_PROVISIONAL_V1", "NISAR_L2_GCOV_V1"]


def key(q):
    return (q["pathNumber"], q["flightDirection"], q["frameNumber"], q["startTime"], q["frameCoverage"])


def show(label, **kw):
    t = time.time()
    res = asf.search(intersectsWith=AOI, **T, **kw)
    print(f"\n### {label}\n  n={len(res)} in {time.time()-t:.1f}s | collections={dict(Counter(p.properties['collectionName'] for p in res))}"
          f" | productionConfiguration={dict(Counter(p.properties['productionConfiguration'] for p in res))}")
    return res


res = show("dataset=NISAR + processingLevel=GCOV", dataset=asf.DATASET.NISAR, processingLevel=asf.PRODUCT_TYPE.GCOV)
ur = [p.properties for p in res if p.properties["collectionName"] == "NISAR_UR_L2"]
print("  example UR granules:")
for q in ur[:3]:
    print("    ", q["sceneName"], "| crid", q["crid"], "| orbitType", q["orbitType"], "| cov", q["frameCoverage"], "| bw", q["rangeBandwidth"], "| pol", q["mainBandPolarization"])
    print("       url:", q["url"])
groups = defaultdict(list)
for p in res:
    groups[key(p.properties)].append(p.properties)
multi = {k: v for k, v in groups.items() if len(v) > 1}
print(f"  distinct acquisitions: {len(groups)} | returned more than once: {len(multi)} | mixes:",
      dict(Counter(tuple(sorted(q['collectionName'].replace('NISAR_', '') for q in v)) for v in multi.values())))
ur_keys = {key(q) for q in ur}
print(f"  UR acquisitions: {len(ur_keys)} | of which also present as a PR granule: {sum(1 for k in ur_keys if any(q['collectionName'] != 'NISAR_UR_L2' for q in groups[k]))}")
for k, v in list(multi.items())[:2]:
    print("   ", k)
    for q in v:
        print("       ", q["collectionName"], q["productionConfiguration"], q["crid"], q["orbitType"], q["sceneName"])

show("dataset=NISAR + GCOV + productionConfiguration=asf.PRODUCTION_CONFIGURATION.PRODUCTION ('PR')",
     dataset=asf.DATASET.NISAR, processingLevel=asf.PRODUCT_TYPE.GCOV, productionConfiguration=asf.PRODUCTION_CONFIGURATION.PRODUCTION)
show("dataset=NISAR + GCOV + dataMaturity=['BETA','PROVISIONAL','VALIDATED']",
     dataset=asf.DATASET.NISAR, processingLevel=asf.PRODUCT_TYPE.GCOV, dataMaturity=["BETA", "PROVISIONAL", "VALIDATED"])
show("shortName=<3 GCOV short names> (no dataset, no processingLevel)", shortName=GCOV_SHORT_NAMES)
show("dataset=NISAR + GCOV + frameCoverage='FULL' + productionConfiguration='PR'",
     dataset=asf.DATASET.NISAR, processingLevel=asf.PRODUCT_TYPE.GCOV, frameCoverage="FULL", productionConfiguration="PR")
````

What it printed (`S/out2/asf_explore_06.txt`):

````text

### dataset=NISAR + processingLevel=GCOV
  n=519 in 3.1s | collections={'NISAR_UR_L2': 32, 'NISAR_L2_GCOV_V1': 149, 'NISAR_L2_GCOV_PROVISIONAL_V1': 338} | productionConfiguration={'UR': 32, 'PR': 487}
  example UR granules:
     NISAR_L2_UR_GCOV_034_112_A_014_4005_DHDH_A_20261031T225634_20261031T225708_P05023_F_F_J_001 | crid P05023 | orbitType FOE | cov Full | bw ['40+5'] | pol ['HH', 'HV']
       url: https://nisar.asf.earthdatacloud.nasa.gov/NISAR-UR/UR_L2_L_GCOV/NISAR_L2_UR_GCOV_034_112_A_014_4005_DHDH_A_20261031T225634_20261031T225708_P05023_F_F_J_001/NISAR_L2_UR_GCOV_034_112_A_014_4005_DHDH_A_20261031T225634_20261031T225708_P05023_F_F_J_001.h5
     NISAR_L2_UR_GCOV_034_112_A_013_4005_DHDH_A_20261031T225600_20261031T225635_P05023_F_F_J_001 | crid P05023 | orbitType FOE | cov Full | bw ['40+5'] | pol ['HH', 'HV']
       url: https://nisar.asf.earthdatacloud.nasa.gov/NISAR-UR/UR_L2_L_GCOV/NISAR_L2_UR_GCOV_034_112_A_013_4005_DHDH_A_20261031T225600_20261031T225635_P05023_F_F_J_001/NISAR_L2_UR_GCOV_034_112_A_013_4005_DHDH_A_20261031T225600_20261031T225635_P05023_F_F_J_001.h5
     NISAR_L2_UR_GCOV_034_112_A_012_4005_DHDH_A_20261031T225527_20261031T225601_P05023_F_F_J_001 | crid P05023 | orbitType FOE | cov Full | bw ['40+5'] | pol ['HH', 'HV']
       url: https://nisar.asf.earthdatacloud.nasa.gov/NISAR-UR/UR_L2_L_GCOV/NISAR_L2_UR_GCOV_034_112_A_012_4005_DHDH_A_20261031T225527_20261031T225601_P05023_F_F_J_001/NISAR_L2_UR_GCOV_034_112_A_012_4005_DHDH_A_20261031T225527_20261031T225601_P05023_F_F_J_001.h5
  distinct acquisitions: 482 | returned more than once: 27 | mixes: {('L2_GCOV_V1', 'UR_L2'): 10, ('L2_GCOV_V1', 'UR_L2', 'UR_L2'): 10, ('L2_GCOV_PROVISIONAL_V1', 'L2_GCOV_PROVISIONAL_V1'): 7}
  UR acquisitions: 22 | of which also present as a PR granule: 20
    (112, 'ASCENDING', 14, '2026-10-31T22:56:34Z', 'Full')
        NISAR_UR_L2 UR P05023 FOE NISAR_L2_UR_GCOV_034_112_A_014_4005_DHDH_A_20261031T225634_20261031T225708_P05023_F_F_J_001
        NISAR_L2_GCOV_V1 PR P05036 MOE NISAR_L2_PR_GCOV_034_112_A_014_4005_DHDH_A_20261031T225634_20261031T225708_P05036_N_F_J_001
    (112, 'ASCENDING', 13, '2026-10-31T22:56:00Z', 'Full')
        NISAR_UR_L2 UR P05023 FOE NISAR_L2_UR_GCOV_034_112_A_013_4005_DHDH_A_20261031T225600_20261031T225635_P05023_F_F_J_001
        NISAR_L2_GCOV_V1 PR P05036 MOE NISAR_L2_PR_GCOV_034_112_A_013_4005_DHDH_A_20261031T225600_20261031T225635_P05036_N_F_J_001

### dataset=NISAR + GCOV + productionConfiguration=asf.PRODUCTION_CONFIGURATION.PRODUCTION ('PR')
  n=487 in 2.3s | collections={'NISAR_L2_GCOV_V1': 149, 'NISAR_L2_GCOV_PROVISIONAL_V1': 338} | productionConfiguration={'PR': 487}

### dataset=NISAR + GCOV + dataMaturity=['BETA','PROVISIONAL','VALIDATED']
  n=487 in 2.5s | collections={'NISAR_L2_GCOV_V1': 149, 'NISAR_L2_GCOV_PROVISIONAL_V1': 338} | productionConfiguration={'PR': 487}

### shortName=<3 GCOV short names> (no dataset, no processingLevel)
  n=487 in 2.3s | collections={'NISAR_L2_GCOV_V1': 149, 'NISAR_L2_GCOV_PROVISIONAL_V1': 338} | productionConfiguration={'PR': 487}

### dataset=NISAR + GCOV + frameCoverage='FULL' + productionConfiguration='PR'
  n=357 in 1.9s | collections={'NISAR_L2_GCOV_V1': 104, 'NISAR_L2_GCOV_PROVISIONAL_V1': 253} | productionConfiguration={'PR': 357}
````


#### A.11 asf_explore_07.py

Source: `S/scripts/asf_explore_07.py` (md5 `54648ce7bc2245ac5b15f8866a10ef96`). Status: **ran**.

````python
"""Exploration 7 of asf_search 14.1.0: what distinguishes several production granules of the same acquisition inside
one collection (same track/direction/frame/start/coverage)."""
from collections import Counter, defaultdict

import asf_search as asf

asf.REPORT_ERRORS = False

res = asf.search(shortName=["NISAR_L2_GCOV_BETA_V1", "NISAR_L2_GCOV_PROVISIONAL_V1", "NISAR_L2_GCOV_V1"],
                 intersectsWith="POLYGON((95 5, 110 5, 110 25, 95 25, 95 5))",
                 start="2026-10-01T00:00:00Z", end="2026-11-01T00:00:00Z")
groups = defaultdict(list)
for p in res:
    q = p.properties
    groups[(q["pathNumber"], q["flightDirection"], q["frameNumber"], q["startTime"], q["frameCoverage"])].append(q)
multi = {k: v for k, v in groups.items() if len(v) > 1}
print("n =", len(res), "| distinct keys:", len(groups), "| keys with >1 granule:", len(multi))
for k, v in multi.items():
    print(k)
    for q in v:
        print("    ", q["collectionName"], "| crid", q["crid"], "| bw", q["rangeBandwidth"], "| pol", q["mainBandPolarization"],
              "| stop", q["stopTime"], "| processed", q["processingDate"], "|", q["sceneName"])

# a finer key: add stop time and bandwidth
fine = Counter((q["pathNumber"], q["flightDirection"], q["frameNumber"], q["startTime"], q["stopTime"], q["frameCoverage"],
                tuple(q["rangeBandwidth"])) for p in res for q in [p.properties])
print("with stopTime + rangeBandwidth in the key, keys with >1 granule:", sum(1 for c in fine.values() if c > 1))
````

What it printed (`S/out2/asf_explore_07.txt`):

````text
n = 487 | distinct keys: 480 | keys with >1 granule: 7
(62, 'DESCENDING', 79, '2026-10-16T12:19:22Z', 'Full')
     NISAR_L2_GCOV_PROVISIONAL_V1 | crid P05023 | bw ['20+5'] | pol ['HH'] | stop 2026-10-16T12:19:57Z | processed 2026-10-18T09:40:10Z | NISAR_L2_PR_GCOV_033_062_D_079_2005_SHSH_M_20261016T121922_20261016T121957_P05023_N_F_J_001
     NISAR_L2_GCOV_PROVISIONAL_V1 | crid P05023 | bw ['20+5'] | pol ['HH', 'HV', 'VH', 'VV'] | stop 2026-10-16T12:19:56Z | processed 2026-10-18T10:43:40Z | NISAR_L2_PR_GCOV_033_062_D_079_2005_QPDH_A_20261016T121922_20261016T121956_P05023_N_F_J_001
(47, 'DESCENDING', 78, '2026-10-15T11:20:33Z', 'Full')
     NISAR_L2_GCOV_PROVISIONAL_V1 | crid P05023 | bw ['20+5'] | pol ['HH'] | stop 2026-10-15T11:21:07Z | processed 2026-10-17T12:58:05Z | NISAR_L2_PR_GCOV_033_047_D_078_2005_SHSH_M_20261015T112033_20261015T112107_P05023_N_F_J_001
     NISAR_L2_GCOV_PROVISIONAL_V1 | crid P05023 | bw ['20+5'] | pol ['HH', 'HV'] | stop 2026-10-15T11:21:05Z | processed 2026-10-17T13:45:35Z | NISAR_L2_PR_GCOV_033_047_D_078_2005_DHDH_A_20261015T112033_20261015T112105_P05023_N_F_J_001
(33, 'DESCENDING', 78, '2026-10-14T12:02:10Z', 'Full')
     NISAR_L2_GCOV_PROVISIONAL_V1 | crid P05023 | bw ['20+5'] | pol ['HH'] | stop 2026-10-14T12:02:45Z | processed 2026-10-16T11:50:11Z | NISAR_L2_PR_GCOV_033_033_D_078_2005_SHSH_M_20261014T120210_20261014T120245_P05023_N_F_J_001
     NISAR_L2_GCOV_PROVISIONAL_V1 | crid P05023 | bw ['20+5'] | pol ['HH', 'HV'] | stop 2026-10-14T12:02:37Z | processed 2026-10-16T11:52:43Z | NISAR_L2_PR_GCOV_033_033_D_078_2005_DHDH_A_20261014T120210_20261014T120237_P05023_N_F_J_001
(148, 'DESCENDING', 84, '2026-10-10T11:32:13Z', 'Partial')
     NISAR_L2_GCOV_PROVISIONAL_V1 | crid P05023 | bw ['20+5'] | pol ['HH', 'HV'] | stop 2026-10-10T11:32:29Z | processed 2026-10-12T13:44:00Z | NISAR_L2_PR_GCOV_032_148_D_084_2005_DHDH_M_20261010T113213_20261010T113229_P05023_N_P_J_001
     NISAR_L2_GCOV_PROVISIONAL_V1 | crid P05023 | bw ['40+5'] | pol ['HH', 'HV'] | stop 2026-10-10T11:32:21Z | processed 2026-10-12T13:37:52Z | NISAR_L2_PR_GCOV_032_148_D_084_4005_DHDH_A_20261010T113213_20261010T113221_P05023_N_P_J_001
(148, 'DESCENDING', 78, '2026-10-10T11:28:52Z', 'Full')
     NISAR_L2_GCOV_PROVISIONAL_V1 | crid P05023 | bw ['20+5'] | pol ['HH'] | stop 2026-10-10T11:29:27Z | processed 2026-10-12T16:21:34Z | NISAR_L2_PR_GCOV_032_148_D_078_2005_SHSH_M_20261010T112852_20261010T112927_P05023_N_F_J_001
     NISAR_L2_GCOV_PROVISIONAL_V1 | crid P05023 | bw ['20+5'] | pol ['HH', 'HV'] | stop 2026-10-10T11:29:25Z | processed 2026-10-12T16:40:57Z | NISAR_L2_PR_GCOV_032_148_D_078_2005_DHDH_A_20261010T112852_20261010T112925_P05023_N_F_J_001
(134, 'DESCENDING', 78, '2026-10-09T12:10:29Z', 'Full')
     NISAR_L2_GCOV_PROVISIONAL_V1 | crid P05023 | bw ['20+5'] | pol ['HH'] | stop 2026-10-09T12:11:04Z | processed 2026-10-11T12:06:20Z | NISAR_L2_PR_GCOV_032_134_D_078_2005_SHSH_M_20261009T121029_20261009T121104_P05023_N_F_J_001
     NISAR_L2_GCOV_PROVISIONAL_V1 | crid P05023 | bw ['20+5'] | pol ['HH', 'HV'] | stop 2026-10-09T12:10:59Z | processed 2026-10-11T12:34:02Z | NISAR_L2_PR_GCOV_032_134_D_078_2005_DHDH_A_20261009T121029_20261009T121059_P05023_N_F_J_001
(119, 'DESCENDING', 78, '2026-10-08T11:12:13Z', 'Full')
     NISAR_L2_GCOV_PROVISIONAL_V1 | crid P05023 | bw ['20+5'] | pol ['HH'] | stop 2026-10-08T11:12:48Z | processed 2026-10-10T11:50:10Z | NISAR_L2_PR_GCOV_032_119_D_078_2005_SHSH_M_20261008T111213_20261008T111248_P05023_N_F_J_001
     NISAR_L2_GCOV_PROVISIONAL_V1 | crid P05023 | bw ['20+5'] | pol ['HH', 'HV'] | stop 2026-10-08T11:12:41Z | processed 2026-10-10T12:47:12Z | NISAR_L2_PR_GCOV_032_119_D_078_2005_DHDH_A_20261008T111213_20261008T111241_P05023_N_F_J_001
with stopTime + rangeBandwidth in the key, keys with >1 granule: 0
````


#### A.12 asf_explore_08.py

Source: `S/scripts/asf_explore_08.py` (md5 `754fc5fc60a9ff435ee2ba1f175fbe7a`). Status: **ran**.

````python
"""Exploration 8 of asf_search 14.1.0: non-WKT spatial inputs, the generic polarization keyword on NISAR,
exception type on a CMR timeout, in-place sort of the result object."""
import time

import asf_search as asf

asf.REPORT_ERRORS = False

BASE = dict(dataset=asf.DATASET.NISAR, processingLevel=asf.PRODUCT_TYPE.GCOV, start="2026-06-01T00:00:00Z", end="2026-11-13T23:59:59Z")
STACK = dict(relativeOrbit=83, frame=8, flightDirection=asf.FLIGHT_DIRECTION.ASCENDING)


def run(label, fn):
    t = time.time()
    try:
        res = fn()
        print(f"### {label}\n  n={len(res)} in {time.time()-t:.1f}s")
        return res
    except BaseException as exc:  # noqa: BLE001
        print(f"### {label}\n  EXCEPTION after {time.time()-t:.1f}s: {type(exc).__module__}.{type(exc).__name__}: {str(exc)[:260]}")


run("1 asf.search(point=(104.05, 12.95)) as a keyword", lambda: asf.search(point=(104.05, 12.95), **BASE, **STACK))
run("2 asf.search(bbox=(103.9, 12.8, 104.2, 13.1)) as a keyword", lambda: asf.search(bbox=(103.9, 12.8, 104.2, 13.1), **BASE, **STACK))
run("3 opts=ASFSearchOptions(point=[104.05, 12.95])", lambda: asf.search(opts=asf.ASFSearchOptions(point=[104.05, 12.95], **BASE, **STACK)))
run("4 opts=ASFSearchOptions(bbox=[103.9, 12.8, 104.2, 13.1])", lambda: asf.search(opts=asf.ASFSearchOptions(bbox=[103.9, 12.8, 104.2, 13.1], **BASE, **STACK)))
run("5 opts=ASFSearchOptions(circle=[104.05, 12.95, 1000])  (lon, lat, radius m)", lambda: asf.search(opts=asf.ASFSearchOptions(circle=[104.05, 12.95, 1000], **BASE, **STACK)))
run("6 asf.geo_search(intersectsWith='POINT(104.05 12.95)')", lambda: asf.geo_search(intersectsWith="POINT(104.05 12.95)", **BASE, **STACK))
run("7 WKT bounding rectangle POLYGON", lambda: asf.search(intersectsWith="POLYGON((103.9 12.8, 104.2 12.8, 104.2 13.1, 103.9 13.1, 103.9 12.8))", **BASE, **STACK))
run("8 generic polarization='HH+HV' keyword on NISAR (point + stack)", lambda: asf.search(intersectsWith="POINT(104.05 12.95)", polarization="HH+HV", **BASE, **STACK))
run("9 mainBandPolarization=asf.POLARIZATION.HH_HV (point + stack)", lambda: asf.search(intersectsWith="POINT(104.05 12.95)", mainBandPolarization=asf.POLARIZATION.HH_HV, **BASE, **STACK))

res = asf.search(intersectsWith="POINT(104.05 12.95)", **BASE, **STACK)
print("### 10 order as returned:", [p.properties["startTime"][:10] for p in res][:3], "...")
res.sort(key=lambda p: p.properties["startTime"])
print("   after res.sort(key=startTime):", [p.properties["startTime"][:10] for p in res][:3], "... type still", type(res).__name__)

print("### 11 timeout behaviour: asf.constants.INTERNAL.CMR_TIMEOUT default =", asf.constants.INTERNAL.CMR_TIMEOUT)
asf.constants.INTERNAL.CMR_TIMEOUT = 0.001
run("   search with CMR_TIMEOUT=0.001 s", lambda: asf.search(intersectsWith="POINT(104.05 12.95)", **BASE, **STACK))
asf.constants.INTERNAL.CMR_TIMEOUT = 30
run("   search again with CMR_TIMEOUT restored to 30 s", lambda: asf.search(intersectsWith="POINT(104.05 12.95)", **BASE, **STACK))
````

What it printed (`S/out2/asf_explore_08.txt`):

````text
### 1 asf.search(point=(104.05, 12.95)) as a keyword
  EXCEPTION after 0.0s: builtins.TypeError: search() got an unexpected keyword argument 'point'
### 2 asf.search(bbox=(103.9, 12.8, 104.2, 13.1)) as a keyword
  EXCEPTION after 0.0s: builtins.TypeError: search() got an unexpected keyword argument 'bbox'
### 3 opts=ASFSearchOptions(point=[104.05, 12.95])
  n=11 in 0.3s
### 4 opts=ASFSearchOptions(bbox=[103.9, 12.8, 104.2, 13.1])
  n=11 in 0.2s
### 5 opts=ASFSearchOptions(circle=[104.05, 12.95, 1000])  (lon, lat, radius m)
  n=11 in 0.2s
### 6 asf.geo_search(intersectsWith='POINT(104.05 12.95)')
  n=11 in 0.2s
### 7 WKT bounding rectangle POLYGON
  n=11 in 0.2s
### 8 generic polarization='HH+HV' keyword on NISAR (point + stack)
  n=0 in 0.1s
### 9 mainBandPolarization=asf.POLARIZATION.HH_HV (point + stack)
  n=11 in 0.2s
### 10 order as returned: ['2026-10-29', '2026-10-17', '2026-10-05'] ...
   after res.sort(key=startTime): ['2026-06-19', '2026-07-01', '2026-07-13'] ... type still ASFSearchResults
### 11 timeout behaviour: asf.constants.INTERNAL.CMR_TIMEOUT default = 30
ERROR:asf_search:Connection Error (Timeout): CMR took too long to respond. Set asf constant "asf_search.constants.INTERNAL.CMR_TIMEOUT" to increase. (url='https://cmr.earthdata.nasa.gov/search/granules.umm_json', timeout=0.001)
WARNING:asf_search:Automatic search error reporting is turned off,search errors will NOT be reported to ASF.
To enable automatic error reporting, set asf_search.REPORT_ERRORS to True
If you have any questions email uso@asf.alaska.edu
###    search with CMR_TIMEOUT=0.001 s
  EXCEPTION after 0.1s: asf_search.exceptions.ASFSearchError: Connection Error (Timeout): CMR took too long to respond. Set asf constant "asf_search.constants.INTERNAL.CMR_TIMEOUT" to increase. (url='https://cmr.earthdata.nasa.gov/search/granules.umm_json', timeout=0.001)
###    search again with CMR_TIMEOUT restored to 30 s
  n=11 in 0.2s
````


#### A.13a asf_constants.py (its output is Section 6.4)

Source: `S/scripts/asf_constants.py` (md5 `f445123b46fe42f1a3315f77089d6864`). Status: **ran**.

````python
"""Print the exact asf_search constant names/values relevant to NISAR (no network)."""
import asf_search as asf

print("asf_search", asf.__version__)
for mod_name in ("DATASET", "PLATFORM", "PRODUCT_TYPE", "FLIGHT_DIRECTION", "PRODUCTION_CONFIGURATION", "RANGE_BANDWIDTH", "POLARIZATION"):
    mod = getattr(asf, mod_name)
    items = {k: v for k, v in vars(mod).items() if k.isupper() and isinstance(v, (str, tuple, list))}
    if mod_name in ("DATASET", "PLATFORM"):
        items = {k: v for k, v in items.items() if "NISAR" in k}
    if mod_name == "PRODUCT_TYPE":
        wanted = ("GCOV", "GSLC", "GUNW", "GOFF", "RSLC", "RIFG", "RUNW", "ROFF", "RRSD", "SME2")
        items = {k: v for k, v in items.items() if k in wanted}
    if mod_name == "POLARIZATION":
        items = {k: v for k, v in items.items() if k in ("HH", "HV", "VV", "VH", "HH_HV", "VV_VH", "HH_HV_VH_VV", "QUAD")}
    print(f"asf.{mod_name}: {items}")
m = asf.constants.MATURITIES
print("asf.constants.MATURITIES:", {k: v for k, v in vars(m).items() if k.isupper()})
print("asf.constants.INTERNAL.CMR_PAGE_SIZE =", asf.constants.INTERNAL.CMR_PAGE_SIZE, "| CMR_TIMEOUT =", asf.constants.INTERNAL.CMR_TIMEOUT)
print("asf.REPORT_ERRORS default =", asf.REPORT_ERRORS)
import inspect
print("asf.search signature keywords:", [p for p in inspect.signature(asf.search).parameters])
````


#### A.13b asf_polarization_check.py

Source: `S/scripts/asf_polarization_check.py` (md5 `28452511dd35faa1ad2268a6a554c75b`). Status: **ran**.

````python
"""Is the generic 'polarization' property ever filled for NISAR GCOV results? (519-granule SE Asia query, Oct 2026)"""
from collections import Counter

import asf_search as asf

asf.REPORT_ERRORS = False
res = asf.search(dataset=asf.DATASET.NISAR, processingLevel=asf.PRODUCT_TYPE.GCOV,
                 intersectsWith="POLYGON((95 5, 110 5, 110 25, 95 25, 95 5))",
                 start="2026-10-01T00:00:00Z", end="2026-11-01T00:00:00Z")
print("n =", len(res))
for key in ("polarization", "centerLat", "centerLon", "md5sum", "granuleType", "beamModeType"):
    print(f"  {key}: values = {dict(Counter(repr(p.properties.get(key)) for p in res))}")
print("  mainBandPolarization None/empty:", sum(1 for p in res if not p.properties.get("mainBandPolarization")),
      "| sideBandPolarization None/empty:", sum(1 for p in res if not p.properties.get("sideBandPolarization")))
print("  rangeBandwidth values:", dict(Counter(tuple(p.properties["rangeBandwidth"]) for p in res)))
print("  url None:", sum(1 for p in res if not p.properties.get("url")), "| browse empty:", sum(1 for p in res if not p.properties.get("browse")))
print("  type of pathNumber/frameNumber:", {type(p.properties["pathNumber"]).__name__ for p in res}, {type(p.properties["frameNumber"]).__name__ for p in res})
ok = sum(1 for p in res if p.properties["fileName"] in p.properties["bytes"])
print("  bytes[fileName] present for", ok, "of", len(res))
````

What it printed (`S/out2/asf_polarization_check.txt`):

````text
n = 519
  polarization: values = {'None': 519}
  centerLat: values = {'None': 519}
  centerLon: values = {'None': 519}
  md5sum: values = {'None': 519}
  granuleType: values = {'None': 519}
  beamModeType: values = {'None': 519}
  mainBandPolarization None/empty: 10 | sideBandPolarization None/empty: 0
  rangeBandwidth values: {('40+5',): 281, ('20+5',): 228, ('5',): 10}
  url None: 0 | browse empty: 0
  type of pathNumber/frameNumber: {'int'} {'int'}
  bytes[fileName] present for 519 of 519
````


### A.14 to A.17 earthaccess exploration

#### A.14 ea_explore_01.py

Source: `S/scripts/ea_explore_01.py` (md5 `5ab607990f598a26773c88d5d68a6246`). Status: **ran**.

````python
"""Exploration 1 of earthaccess for NISAR GCOV (no login). Not the final snippet."""
import time
from collections import Counter

import earthaccess

print("earthaccess", earthaccess.__version__)
print("authenticated before any login call:", earthaccess.__auth__.authenticated)

POINT = (104.05, 12.95)  # (lon, lat)
TEMPORAL = ("2026-06-01", "2026-11-13")
SHORT_NAMES = ["NISAR_L2_GCOV_BETA_V1", "NISAR_L2_GCOV_PROVISIONAL_V1", "NISAR_L2_GCOV_V1"]


def name(g):
    return g["umm"]["GranuleUR"]


def run(label, **kw):
    t = time.time()
    try:
        res = earthaccess.search_data(**kw)
    except Exception as exc:  # noqa: BLE001
        print(f"\n### {label}\n  kwargs={kw}\n  EXCEPTION {type(exc).__name__}: {str(exc)[:300]}")
        return []
    dt = time.time() - t
    cols = Counter(g["umm"]["CollectionReference"]["ShortName"] for g in res)
    stacks = Counter(name(g).split("_")[5:8].__str__() for g in res)
    print(f"\n### {label}\n  kwargs={kw}\n  n={len(res)} in {dt:.1f}s | collections={dict(cols)} | track/dir/frame={dict(stacks)}")
    return res


per = {}
for sn in SHORT_NAMES:
    per[sn] = run(f"A short_name={sn} + point + temporal", short_name=sn, point=POINT, temporal=TEMPORAL)
run("B short_name=<list of 3> + point + temporal (undocumented: list)", short_name=SHORT_NAMES, point=POINT, temporal=TEMPORAL)
run("C concept_id=<list of 3 collection ids> + point + temporal",
    concept_id=["C3622214170-ASF", "C2854338529-ASF", "C3622241360-ASF"], point=POINT, temporal=TEMPORAL)
run("D short_name wildcard 'NISAR_L2_GCOV*' + point + temporal", short_name="NISAR_L2_GCOV*", point=POINT, temporal=TEMPORAL)
run("E Provisional + bounding_box around the point + temporal",
    short_name="NISAR_L2_GCOV_PROVISIONAL_V1", bounding_box=(103.9, 12.8, 104.2, 13.1), temporal=TEMPORAL)
run("F Provisional + point + temporal + granule_name wildcard for track 83 A frame 8",
    short_name="NISAR_L2_GCOV_PROVISIONAL_V1", point=POINT, temporal=TEMPORAL, granule_name="NISAR_L2_PR_GCOV_*_083_A_008_*")
run("G Provisional + granule_name wildcard only (no spatial): expect 30 incl. partial frames",
    short_name="NISAR_L2_GCOV_PROVISIONAL_V1", temporal=TEMPORAL, granule_name="NISAR_L2_PR_GCOV_*_083_A_008_*")
run("H Provisional + granule_name wildcard full-frame only '*_083_A_008_*_F_J_*'",
    short_name="NISAR_L2_GCOV_PROVISIONAL_V1", temporal=TEMPORAL, granule_name="NISAR_L2_PR_GCOV_*_083_A_008_*_F_J_*")
run("I count=3 on Provisional + point", count=3, short_name="NISAR_L2_GCOV_PROVISIONAL_V1", point=POINT, temporal=TEMPORAL)
run("J point without any collection filter (expect error)", point=POINT, temporal=TEMPORAL)
run("K attribute kwarg (expect error: not a DataGranules method)",
    short_name="NISAR_L2_GCOV_PROVISIONAL_V1", attribute="string,STACK_ID,083_A_008")
print("\nauthenticated after searches:", earthaccess.__auth__.authenticated)
````

What it printed (`S/out2/ea_explore_01.txt`):

````text
earthaccess 0.19.0
authenticated before any login call: False

### A short_name=NISAR_L2_GCOV_BETA_V1 + point + temporal
  kwargs={'short_name': 'NISAR_L2_GCOV_BETA_V1', 'point': (104.05, 12.95), 'temporal': ('2026-06-01', '2026-11-13')}
  n=0 in 0.3s | collections={} | track/dir/frame={}

### A short_name=NISAR_L2_GCOV_PROVISIONAL_V1 + point + temporal
  kwargs={'short_name': 'NISAR_L2_GCOV_PROVISIONAL_V1', 'point': (104.05, 12.95), 'temporal': ('2026-06-01', '2026-11-13')}
  n=19 in 0.5s | collections={'NISAR_L2_GCOV_PROVISIONAL_V1': 19} | track/dir/frame={"['083', 'A', '008']": 10, "['148', 'D', '082']": 9}

### A short_name=NISAR_L2_GCOV_V1 + point + temporal
  kwargs={'short_name': 'NISAR_L2_GCOV_V1', 'point': (104.05, 12.95), 'temporal': ('2026-06-01', '2026-11-13')}
  n=3 in 0.4s | collections={'NISAR_L2_GCOV_V1': 3} | track/dir/frame={"['148', 'D', '082']": 2, "['083', 'A', '008']": 1}

### B short_name=<list of 3> + point + temporal (undocumented: list)
  kwargs={'short_name': ['NISAR_L2_GCOV_BETA_V1', 'NISAR_L2_GCOV_PROVISIONAL_V1', 'NISAR_L2_GCOV_V1'], 'point': (104.05, 12.95), 'temporal': ('2026-06-01', '2026-11-13')}
  n=22 in 0.5s | collections={'NISAR_L2_GCOV_PROVISIONAL_V1': 19, 'NISAR_L2_GCOV_V1': 3} | track/dir/frame={"['083', 'A', '008']": 11, "['148', 'D', '082']": 11}

### C concept_id=<list of 3 collection ids> + point + temporal
  kwargs={'concept_id': ['C3622214170-ASF', 'C2854338529-ASF', 'C3622241360-ASF'], 'point': (104.05, 12.95), 'temporal': ('2026-06-01', '2026-11-13')}
  n=22 in 0.5s | collections={'NISAR_L2_GCOV_PROVISIONAL_V1': 19, 'NISAR_L2_GCOV_V1': 3} | track/dir/frame={"['083', 'A', '008']": 11, "['148', 'D', '082']": 11}

### D short_name wildcard 'NISAR_L2_GCOV*' + point + temporal
  kwargs={'short_name': 'NISAR_L2_GCOV*', 'point': (104.05, 12.95), 'temporal': ('2026-06-01', '2026-11-13')}
  n=0 in 0.2s | collections={} | track/dir/frame={}

### E Provisional + bounding_box around the point + temporal
  kwargs={'short_name': 'NISAR_L2_GCOV_PROVISIONAL_V1', 'bounding_box': (103.9, 12.8, 104.2, 13.1), 'temporal': ('2026-06-01', '2026-11-13')}
  n=19 in 0.5s | collections={'NISAR_L2_GCOV_PROVISIONAL_V1': 19} | track/dir/frame={"['083', 'A', '008']": 10, "['148', 'D', '082']": 9}

### F Provisional + point + temporal + granule_name wildcard for track 83 A frame 8
  kwargs={'short_name': 'NISAR_L2_GCOV_PROVISIONAL_V1', 'point': (104.05, 12.95), 'temporal': ('2026-06-01', '2026-11-13'), 'granule_name': 'NISAR_L2_PR_GCOV_*_083_A_008_*'}
  n=10 in 0.5s | collections={'NISAR_L2_GCOV_PROVISIONAL_V1': 10} | track/dir/frame={"['083', 'A', '008']": 10}

### G Provisional + granule_name wildcard only (no spatial): expect 30 incl. partial frames
  kwargs={'short_name': 'NISAR_L2_GCOV_PROVISIONAL_V1', 'temporal': ('2026-06-01', '2026-11-13'), 'granule_name': 'NISAR_L2_PR_GCOV_*_083_A_008_*'}
  n=30 in 0.5s | collections={'NISAR_L2_GCOV_PROVISIONAL_V1': 30} | track/dir/frame={"['083', 'A', '008']": 30}

### H Provisional + granule_name wildcard full-frame only '*_083_A_008_*_F_J_*'
  kwargs={'short_name': 'NISAR_L2_GCOV_PROVISIONAL_V1', 'temporal': ('2026-06-01', '2026-11-13'), 'granule_name': 'NISAR_L2_PR_GCOV_*_083_A_008_*_F_J_*'}
  n=10 in 0.4s | collections={'NISAR_L2_GCOV_PROVISIONAL_V1': 10} | track/dir/frame={"['083', 'A', '008']": 10}

### I count=3 on Provisional + point
  kwargs={'count': 3, 'short_name': 'NISAR_L2_GCOV_PROVISIONAL_V1', 'point': (104.05, 12.95), 'temporal': ('2026-06-01', '2026-11-13')}
  n=3 in 0.3s | collections={'NISAR_L2_GCOV_PROVISIONAL_V1': 3} | track/dir/frame={"['083', 'A', '008']": 2, "['148', 'D', '082']": 1}

### J point without any collection filter (expect error)
  kwargs={'point': (104.05, 12.95), 'temporal': ('2026-06-01', '2026-11-13')}
  EXCEPTION RuntimeError: Spatial parameters must be accompanied by a collection filter (ex: short_name or entry_title).

### K attribute kwarg (expect error: not a DataGranules method)
  kwargs={'short_name': 'NISAR_L2_GCOV_PROVISIONAL_V1', 'attribute': 'string,STACK_ID,083_A_008'}
  EXCEPTION ValueError: Unknown key attribute

authenticated after searches: False
````


#### A.15 ea_explore_02.py

Source: `S/scripts/ea_explore_02.py` (md5 `f68abb52a8ca690417b106f6114f7b65`). Status: **ran**.

````python
"""Exploration 2 of earthaccess (no login): link accessors, sizes, and what fails without login.
Run with an empty HOME and no EARTHDATA_* variables so no credential lookup can succeed."""
import os
import sys

import earthaccess

print("HOME =", os.environ.get("HOME"), "| NETRC =", os.environ.get("NETRC"),
      "| EARTHDATA_* set:", [k for k in os.environ if k.startswith("EARTHDATA")])

res = earthaccess.search_data(
    short_name=["NISAR_L2_GCOV_PROVISIONAL_V1", "NISAR_L2_GCOV_V1"],
    point=(104.05, 12.95),
    temporal=("2026-06-01", "2026-11-13"),
    granule_name="NISAR_L2_PR_GCOV_*_083_A_008_*",
)
print("n =", len(res), "| type:", type(res).__name__, "of", type(res[0]).__name__, "| cloud_hosted:", res[0].cloud_hosted)
g = [r for r in res if "20261017T223633" in r["umm"]["GranuleUR"]][0]
print("top-level keys:", list(g.keys()))
print("meta:", g["meta"])
print("GranuleUR:", g["umm"]["GranuleUR"])
print("data_links():", g.data_links())
print("data_links(access='direct'):", g.data_links(access="direct"))
print("data_links(access='external'):", g.data_links(access="external"))
viz = g.dataviz_links
print("dataviz_links: n =", len(viz))
for v in viz:
    print("   ", v.replace(g["umm"]["GranuleUR"], "<GRANULE>"))
print("size (MB, all files):", g.size, "| g['size']:", g["size"])
h5 = [f for f in g["umm"]["DataGranule"]["ArchiveAndDistributionInformation"] if f["Name"].endswith(".h5") and "QA_STATS" not in f["Name"]]
print("main .h5 SizeInBytes:", h5[0]["SizeInBytes"])
print("get_s3_credentials_endpoint():", g.get_s3_credentials_endpoint())
print("order of results (start time, name tail):")
for r in res:
    print("   ", r["umm"]["TemporalExtent"]["RangeDateTime"]["BeginningDateTime"], r["umm"]["CollectionReference"]["ShortName"])

print("\n--- what fails without login ---")
print("earthaccess.__auth__.authenticated:", earthaccess.__auth__.authenticated, "| earthaccess.__store__:", earthaccess.__store__)
for label, fn in [
    ("earthaccess.open([g])", lambda: earthaccess.open([g])),
    ("earthaccess.download([g], local_path)", lambda: earthaccess.download([g], local_path=os.path.join(os.environ["HOME"], "dl"))),
    ("earthaccess.get_fsspec_https_session()", lambda: earthaccess.get_fsspec_https_session()),
    ("earthaccess.get_requests_https_session()", lambda: earthaccess.get_requests_https_session()),
    ("earthaccess.get_s3_credentials(results=[g])", lambda: earthaccess.get_s3_credentials(results=[g])),
    ("earthaccess.get_edl_token()", lambda: earthaccess.get_edl_token()),
    ("earthaccess.login(strategy='environment')", lambda: earthaccess.login(strategy="environment")),
    ("earthaccess.login(strategy='netrc')", lambda: earthaccess.login(strategy="netrc")),
    ("earthaccess.login()  [strategy='all', stdin=/dev/null]", lambda: earthaccess.login()),
]:
    try:
        out = fn()
        print(f"{label} -> returned {out!r}"[:400])
    except BaseException as exc:  # noqa: BLE001
        print(f"{label} -> {type(exc).__name__}: {str(exc)[:300]}")
print("authenticated at end:", earthaccess.__auth__.authenticated)
sys.stdout.flush()
````

What it printed (`S/out2/ea_explore_02.txt`):

````text
HOME = <scratch>/verify/search/emptyhome | NETRC = None | EARTHDATA_* set: []
n = 11 | type: list of DataGranule | cloud_hosted: True
top-level keys: ['meta', 'umm', 'size']
meta: {'concept-type': 'granule', 'concept-id': 'G4378438775-ASF', 'revision-id': 1, 'native-id': 'NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001', 'collection-concept-id': 'C2854338529-ASF', 'provider-id': 'ASF', 'format': 'application/vnd.nasa.cmr.umm+json', 'revision-date': '2026-10-19T21:46:19.449Z'}
GranuleUR: NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001
data_links(): ['https://nisar.asf.earthdatacloud.nasa.gov/NISAR/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001.h5']
data_links(access='direct'): ['s3://sds-n-cumulus-prod-nisar-products/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001.h5']
data_links(access='external'): ['https://nisar.asf.earthdatacloud.nasa.gov/NISAR/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001.h5']
dataviz_links: n = 14
    https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1/<GRANULE>/<GRANULE>_LATLON.png
    s3://sds-n-cumulus-prod-nisar-browse/NISAR_L2_GCOV_PROVISIONAL_V1/<GRANULE>/<GRANULE>_LATLON.png
    https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1/<GRANULE>/<GRANULE>_LATLON_thumbnail.png
    s3://sds-n-cumulus-prod-nisar-browse/NISAR_L2_GCOV_PROVISIONAL_V1/<GRANULE>/<GRANULE>_LATLON_thumbnail.png
    https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1/<GRANULE>/<GRANULE>_NATIVE.png
    s3://sds-n-cumulus-prod-nisar-browse/NISAR_L2_GCOV_PROVISIONAL_V1/<GRANULE>/<GRANULE>_NATIVE.png
    https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1/<GRANULE>/<GRANULE>_NATIVE_A_HHHH.png
    s3://sds-n-cumulus-prod-nisar-browse/NISAR_L2_GCOV_PROVISIONAL_V1/<GRANULE>/<GRANULE>_NATIVE_A_HHHH.png
    https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1/<GRANULE>/<GRANULE>_NATIVE_A_HVHV.png
    s3://sds-n-cumulus-prod-nisar-browse/NISAR_L2_GCOV_PROVISIONAL_V1/<GRANULE>/<GRANULE>_NATIVE_A_HVHV.png
    https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1/<GRANULE>/<GRANULE>_NATIVE_B_HHHH.png
    s3://sds-n-cumulus-prod-nisar-browse/NISAR_L2_GCOV_PROVISIONAL_V1/<GRANULE>/<GRANULE>_NATIVE_B_HHHH.png
    https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1/<GRANULE>/<GRANULE>_NATIVE_B_HVHV.png
    s3://sds-n-cumulus-prod-nisar-browse/NISAR_L2_GCOV_PROVISIONAL_V1/<GRANULE>/<GRANULE>_NATIVE_B_HVHV.png
size (MB, all files): 1826.3494901657104 | g['size']: 1826.3494901657104
main .h5 SizeInBytes: 1900019712
get_s3_credentials_endpoint(): https://nisar.asf.earthdatacloud.nasa.gov/s3credentials
order of results (start time, name tail):
    2026-06-19T22:36:37.000000Z NISAR_L2_GCOV_PROVISIONAL_V1
    2026-07-01T22:36:36.000000Z NISAR_L2_GCOV_PROVISIONAL_V1
    2026-07-13T22:36:36.000000Z NISAR_L2_GCOV_PROVISIONAL_V1
    2026-07-25T22:36:35.000000Z NISAR_L2_GCOV_PROVISIONAL_V1
    2026-08-18T22:36:34.000000Z NISAR_L2_GCOV_PROVISIONAL_V1
    2026-08-30T22:36:33.000000Z NISAR_L2_GCOV_PROVISIONAL_V1
    2026-09-11T22:36:33.000000Z NISAR_L2_GCOV_PROVISIONAL_V1
    2026-09-23T22:36:33.000000Z NISAR_L2_GCOV_PROVISIONAL_V1
    2026-10-05T22:36:33.000000Z NISAR_L2_GCOV_PROVISIONAL_V1
    2026-10-17T22:36:33.000000Z NISAR_L2_GCOV_PROVISIONAL_V1
    2026-10-29T22:36:34.000000Z NISAR_L2_GCOV_V1

--- what fails without login ---
earthaccess.__auth__.authenticated: False | earthaccess.__store__: None
earthaccess.open([g]) -> AttributeError: 'NoneType' object has no attribute 'open'
You must call earthaccess.login() before you can download data
Traceback (most recent call last):
  File "<scratch>/verify/search/venv_fresh/lib/python3.12/site-packages/earthaccess/api.py", line 430, in download
    return earthaccess.__store__.get(
           ^^^^^^^^^^^^^^^^^^^^^^^^^
AttributeError: 'NoneType' object has no attribute 'get'
earthaccess.download([g], local_path) -> returned []
earthaccess.get_fsspec_https_session() -> AttributeError: 'NoneType' object has no attribute 'get_fsspec_session'
earthaccess.get_requests_https_session() -> AttributeError: 'NoneType' object has no attribute 'get_requests_session'
earthaccess.get_s3_credentials(results=[g]) -> returned {}
earthaccess.get_edl_token() -> returned None
earthaccess.login(strategy='environment') -> LoginStrategyUnavailable: ("Either the environment variables EARTHDATA_USERNAME and EARTHDATA_PASSWORD must both be set, or EARTHDATA_TOKEN must be set for the 'environment' login strategy.",)
earthaccess.login(strategy='netrc') -> LoginStrategyUnavailable: ('No .netrc found at <scratch>/verify/search/emptyhome/.netrc',)
Enter your Earthdata Login username: earthaccess.login()  [strategy='all', stdin=/dev/null] -> EOFError: EOF when reading a line
authenticated at end: False
````


#### A.16 ea_explore_03.py

Source: `S/scripts/ea_explore_03.py` (md5 `d8ac5f699fbeeeb644be2e54145e134d`). Status: **ran**.

````python
"""Exploration 3 of earthaccess 0.19.0 (no login): signatures, date handling, list vs tuple, polygon, query builder with
an injected additional-attribute filter, sort_key, collection discovery, geo interface."""
import inspect
import time
from collections import Counter

import earthaccess

print("earthaccess", earthaccess.__version__)
for fn in (earthaccess.search_data, earthaccess.login, earthaccess.open, earthaccess.download,
           earthaccess.get_fsspec_https_session, earthaccess.get_requests_https_session, earthaccess.get_s3_filesystem):
    print(f"  signature {fn.__name__}{inspect.signature(fn)}")
print("  signature DataGranule.data_links", inspect.signature(earthaccess.DataGranule.data_links))

POINT = (104.05, 12.95)
SHORT_NAMES = ["NISAR_L2_GCOV_BETA_V1", "NISAR_L2_GCOV_PROVISIONAL_V1", "NISAR_L2_GCOV_V1"]
STACK_GLOB = "NISAR_L2_PR_GCOV_*_083_A_008_*"


def name(g):
    return g["umm"]["GranuleUR"]


def start(g):
    return g["umm"]["TemporalExtent"]["RangeDateTime"]["BeginningDateTime"]


def run(label, **kw):
    t = time.time()
    try:
        res = earthaccess.search_data(**kw)
    except BaseException as exc:  # noqa: BLE001
        print(f"\n### {label}\n  EXCEPTION {type(exc).__name__}: {str(exc)[:500]}")
        return []
    cols = Counter(g["umm"]["CollectionReference"]["ShortName"] for g in res)
    print(f"\n### {label}\n  n={len(res)} in {time.time()-t:.1f}s | collections={dict(cols)}")
    if res:
        print(f"  first={start(res[0])} last={start(res[-1])}")
    return res


# --- date handling: is a date-only end inclusive?
run("1 temporal=('2026-06-01','2026-10-29') date-only end = day of the last acquisition (22:36 UTC)",
    short_name=SHORT_NAMES, point=POINT, granule_name=STACK_GLOB, temporal=("2026-06-01", "2026-10-29"))
run("2 temporal=('2026-06-01','2026-10-29T00:00:00Z') explicit midnight end",
    short_name=SHORT_NAMES, point=POINT, granule_name=STACK_GLOB, temporal=("2026-06-01", "2026-10-29T00:00:00Z"))
q = earthaccess.DataGranules().short_name(SHORT_NAMES).temporal("2026-06-01", "2026-10-29")
print("  -> temporal param sent to CMR for ('2026-06-01','2026-10-29'):", q.params["temporal"])

# --- list vs tuple for several short names
run("3 short_name as a TUPLE of 3 (tuples are unpacked into positional args)",
    short_name=tuple(SHORT_NAMES), point=POINT, temporal=("2026-06-01", "2026-11-13"))
q = earthaccess.DataGranules().parameters(short_name=SHORT_NAMES, point=POINT, temporal=("2026-06-01", "2026-11-13"))
print("\n  URL built for short_name=<list> + point + temporal:\n   ", q._build_url())

# --- polygon: counter-clockwise vs clockwise
ccw = [(103.9, 12.8), (104.2, 12.8), (104.2, 13.1), (103.9, 13.1), (103.9, 12.8)]
run("4 polygon counter-clockwise + stack glob", short_name=SHORT_NAMES, polygon=ccw, granule_name=STACK_GLOB,
    temporal=("2026-06-01", "2026-11-13"))
run("5 polygon CLOCKWISE + stack glob", short_name=SHORT_NAMES, polygon=ccw[::-1], granule_name=STACK_GLOB,
    temporal=("2026-06-01", "2026-11-13"))

# --- sort_key through search_data
r = run("6 sort_key='-start_date' (newest first)", short_name=SHORT_NAMES, point=POINT, granule_name=STACK_GLOB,
        temporal=("2026-06-01", "2026-11-13"), sort_key="-start_date")
r = run("7 no sort_key (default order)", short_name=SHORT_NAMES, point=POINT, temporal=("2026-06-01", "2026-11-13"))
print("  default order (collection, start):", [(g["umm"]["CollectionReference"]["ShortName"][-14:], start(g)[:10]) for g in r])

# --- query builder + injected CMR additional-attribute filters (no dedicated earthaccess method exists)
q = (earthaccess.granule_query()
     .short_name(SHORT_NAMES)
     .temporal("2026-06-01", "2026-11-13"))
q.params["attribute"] = ["string,STACK_ID,083_A_008", "string,FULL_FRAME,TRUE"]  # python-cmr renders list params as attribute[]=...
print("\n### 8 granule_query() + q.params['attribute'] = [STACK_ID, FULL_FRAME=TRUE] (no spatial filter)")
print("  URL:", q._build_url())
print("  hits():", q.hits())
res8 = q.get_all()
print("  get_all():", len(res8), Counter(g["umm"]["CollectionReference"]["ShortName"] for g in res8))
q = earthaccess.granule_query().short_name(SHORT_NAMES).temporal("2026-06-01", "2026-11-13")
q.params["attribute"] = ["string,STACK_ID,083_A_008"]
print("### 9 same with STACK_ID only: hits() =", q.hits())

# --- collection discovery without knowing short names
for kw in (dict(keyword="NISAR GCOV"), dict(short_name="NISAR_L2_GCOV_V1"), dict(keyword="NISAR GCOV", provider="ASF")):
    t = time.time()
    try:
        cols = earthaccess.search_datasets(**kw)
        print(f"\n### 10 search_datasets({kw}) -> {len(cols)} in {time.time()-t:.1f}s")
        for c in cols[:8]:
            print("    ", c["meta"]["concept-id"], c["umm"]["ShortName"], "v" + str(c["umm"].get("Version")))
    except BaseException as exc:  # noqa: BLE001
        print(f"\n### 10 search_datasets({kw}) EXCEPTION {type(exc).__name__}: {str(exc)[:300]}")

# --- geo interface and repr
g = res8[0]
gi = g.__geo_interface__
print("\n### 11 __geo_interface__ keys:", list(gi.keys()), "| geometry type:", gi.get("geometry", {}).get("type") if isinstance(gi.get("geometry"), dict) else gi.get("type"))
print("### 12 repr(DataGranule):\n", repr(g)[:700])
print("\nauthenticated at end:", earthaccess.__auth__.authenticated)
````

What it printed (`S/out2/ea_explore_03.txt`):

````text
earthaccess 0.19.0
  signature search_data(count: int = -1, **kwargs: Any) -> list[earthaccess.results.DataGranule]
  signature login(strategy: str = 'all', persist: bool = False, system: earthaccess.system.System = System(cmr_base_url='https://cmr.earthdata.nasa.gov/search/', status_url='https://status.earthdata.nasa.gov/', status_api_url='https://status.earthdata.nasa.gov/api/v1/statuses', edl_hostname='urs.earthdata.nasa.gov')) -> earthaccess.auth.Auth
  signature open(granules: list[str] | list[earthaccess.results.DataGranule], provider: str | None = None, *, credentials_endpoint: str | None = None, show_progress: bool | None = None, pqdm_kwargs: collections.abc.Mapping[str, typing.Any] | None = None, open_kwargs: dict[str, typing.Any] | None = None) -> list[fsspec.spec.AbstractFileSystem]
  signature download(granules: earthaccess.results.DataGranule | list[earthaccess.results.DataGranule] | str | list[str], local_path: pathlib.Path | str | None = None, provider: str | None = None, threads: int = 8, *, show_progress: bool | None = None, credentials_endpoint: str | None = None, pqdm_kwargs: collections.abc.Mapping[str, typing.Any] | None = None, force: bool = False) -> list[pathlib.Path]
  signature get_fsspec_https_session() -> fsspec.spec.AbstractFileSystem
  signature get_requests_https_session() -> requests.sessions.Session
  signature get_s3_filesystem(daac: str | None = None, provider: str | None = None, results: earthaccess.results.DataGranule | None = None, endpoint: str | None = None) -> s3fs.core.S3FileSystem
  signature DataGranule.data_links (self, access: str | None = None, in_region: bool = False) -> list[str]

### 1 temporal=('2026-06-01','2026-10-29') date-only end = day of the last acquisition (22:36 UTC)
  n=11 in 0.4s | collections={'NISAR_L2_GCOV_PROVISIONAL_V1': 10, 'NISAR_L2_GCOV_V1': 1}
  first=2026-06-19T22:36:37.000000Z last=2026-10-29T22:36:34.000000Z

### 2 temporal=('2026-06-01','2026-10-29T00:00:00Z') explicit midnight end
  n=10 in 0.4s | collections={'NISAR_L2_GCOV_PROVISIONAL_V1': 10}
  first=2026-06-19T22:36:37.000000Z last=2026-10-17T22:36:33.000000Z
  -> temporal param sent to CMR for ('2026-06-01','2026-10-29'): ['2026-06-01T00:00:00Z,2026-10-29T23:59:59Z']

### 3 short_name as a TUPLE of 3 (tuples are unpacked into positional args)
  EXCEPTION TypeError: DataGranules.short_name() takes 2 positional arguments but 4 were given

  URL built for short_name=<list> + point + temporal:
    https://cmr.earthdata.nasa.gov/search/granules.umm_json?short_name[]=NISAR_L2_GCOV_BETA_V1&short_name[]=NISAR_L2_GCOV_PROVISIONAL_V1&short_name[]=NISAR_L2_GCOV_V1&point[]=104.05,12.95&temporal[]=2026-06-01T00:00:00Z,2026-11-13T23:59:59Z

### 4 polygon counter-clockwise + stack glob
  n=11 in 0.4s | collections={'NISAR_L2_GCOV_PROVISIONAL_V1': 10, 'NISAR_L2_GCOV_V1': 1}
  first=2026-06-19T22:36:37.000000Z last=2026-10-29T22:36:34.000000Z

### 5 polygon CLOCKWISE + stack glob
  EXCEPTION RuntimeError: {"errors":["The polygon boundary points are listed in the wrong order. Points must be provided in counter-clockwise order."]}

### 6 sort_key='-start_date' (newest first)
  n=11 in 0.4s | collections={'NISAR_L2_GCOV_V1': 1, 'NISAR_L2_GCOV_PROVISIONAL_V1': 10}
  first=2026-10-29T22:36:34.000000Z last=2026-06-19T22:36:37.000000Z

### 7 no sort_key (default order)
  n=22 in 0.5s | collections={'NISAR_L2_GCOV_PROVISIONAL_V1': 19, 'NISAR_L2_GCOV_V1': 3}
  first=2026-06-19T22:36:37.000000Z last=2026-11-03T11:31:07.000000Z
  default order (collection, start): [('PROVISIONAL_V1', '2026-06-19'), ('PROVISIONAL_V1', '2026-06-24'), ('PROVISIONAL_V1', '2026-07-01'), ('PROVISIONAL_V1', '2026-07-06'), ('PROVISIONAL_V1', '2026-07-13'), ('PROVISIONAL_V1', '2026-07-18'), ('PROVISIONAL_V1', '2026-07-25'), ('PROVISIONAL_V1', '2026-08-11'), ('PROVISIONAL_V1', '2026-08-18'), ('PROVISIONAL_V1', '2026-08-23'), ('PROVISIONAL_V1', '2026-08-30'), ('PROVISIONAL_V1', '2026-09-04'), ('PROVISIONAL_V1', '2026-09-11'), ('PROVISIONAL_V1', '2026-09-16'), ('PROVISIONAL_V1', '2026-09-23'), ('PROVISIONAL_V1', '2026-09-28'), ('PROVISIONAL_V1', '2026-10-05'), ('PROVISIONAL_V1', '2026-10-10'), ('PROVISIONAL_V1', '2026-10-17'), ('SAR_L2_GCOV_V1', '2026-10-22'), ('SAR_L2_GCOV_V1', '2026-10-29'), ('SAR_L2_GCOV_V1', '2026-11-03')]

### 8 granule_query() + q.params['attribute'] = [STACK_ID, FULL_FRAME=TRUE] (no spatial filter)
  URL: https://cmr.earthdata.nasa.gov/search/granules.umm_json?short_name[]=NISAR_L2_GCOV_BETA_V1&short_name[]=NISAR_L2_GCOV_PROVISIONAL_V1&short_name[]=NISAR_L2_GCOV_V1&temporal[]=2026-06-01T00:00:00Z,2026-11-13T23:59:59Z&attribute[]=string,STACK_ID,083_A_008&attribute[]=string,FULL_FRAME,TRUE
  hits(): 11
  get_all(): 11 Counter({'NISAR_L2_GCOV_PROVISIONAL_V1': 10, 'NISAR_L2_GCOV_V1': 1})
### 9 same with STACK_ID only: hits() = 33

### 10 search_datasets({'keyword': 'NISAR GCOV'}) -> 4 in 0.3s
     C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 v1
     C3622214170-ASF NISAR_L2_GCOV_BETA_V1 v1
     C2887502657-ASF NISAR_UR_L2 v1
     C3622241360-ASF NISAR_L2_GCOV_V1 v1

### 10 search_datasets({'short_name': 'NISAR_L2_GCOV_V1'}) -> 1 in 0.3s
     C3622241360-ASF NISAR_L2_GCOV_V1 v1

### 10 search_datasets({'keyword': 'NISAR GCOV', 'provider': 'ASF'}) -> 4 in 0.3s
     C2854338529-ASF NISAR_L2_GCOV_PROVISIONAL_V1 v1
     C3622214170-ASF NISAR_L2_GCOV_BETA_V1 v1
     C2887502657-ASF NISAR_UR_L2 v1
     C3622241360-ASF NISAR_L2_GCOV_V1 v1

### 11 __geo_interface__ keys: ['type', 'coordinates'] | geometry type: MultiPolygon
### 12 repr(DataGranule):
 Collection: {'ShortName': 'NISAR_L2_GCOV_PROVISIONAL_V1', 'Version': '1'}
Spatial coverage: {'GranuleLocalities': ['Land', 'Asia'], 'HorizontalSpatialDomain': {'Geometry': {'GPolygons': [{'Boundary': {'Points': [{'Latitude': 12.07019, 'Longitude': 105.39936}, {'Latitude': 14.15457, 'Longitude': 104.89399}, {'Latitude': 13.61372, 'Longitude': 102.62722}, {'Latitude': 11.53813, 'Longitude': 103.14859}, {'Latitude': 12.07019, 'Longitude': 105.39936}]}}]}}}
Temporal coverage: {'RangeDateTime': {'BeginningDateTime': '2026-06-19T22:36:37.000000Z', 'EndingDateTime': '2026-06-19T22:37:11.999342Z'}}
Size(MB): 1777.8144416809082
Data: ['https://nisar.asf.earthdatacloud.nasa.gov/NISAR/NISAR_L2_GCOV_PRO

authenticated at end: False
````


#### A.17 ea_explore_04_dummy_token.py

Source: `S/scripts/ea_explore_04_dummy_token.py` (md5 `53e021e2f4c1ef4f6118768a8f3b6b64`). Status: **ran**.

````python
"""Exploration 4 of earthaccess 0.19.0: what happens when EARTHDATA_TOKEN holds an invalid / expired token.
Uses an obviously fake token string (no real credential is involved)."""
import os
import time

import earthaccess

os.environ["EARTHDATA_TOKEN"] = "this-is-not-a-real-token"  # fake on purpose

KW = dict(short_name="NISAR_L2_GCOV_V1", point=(104.05, 12.95), temporal=("2026-06-01", "2026-11-13"))

print("before login: authenticated =", earthaccess.__auth__.authenticated)
print("search before login ->", len(earthaccess.search_data(**KW)), "granules")

t = time.time()
try:
    auth = earthaccess.login(strategy="environment")
    print(f"login(strategy='environment') returned in {time.time()-t:.1f}s; authenticated = {auth.authenticated}; "
          f"earthaccess.__store__ is None = {earthaccess.__store__ is None}")
except BaseException as exc:  # noqa: BLE001
    print(f"login(strategy='environment') raised after {time.time()-t:.1f}s: {type(exc).__name__}: {str(exc)[:300]}")
print("after login attempt: authenticated =", earthaccess.__auth__.authenticated)

try:
    res = earthaccess.search_data(**KW)
    print("search after login attempt ->", len(res), "granules")
except BaseException as exc:  # noqa: BLE001
    print(f"search after login attempt raised {type(exc).__name__}: {str(exc)[:300]}")
````

What it printed (`S/out2/ea_explore_04_dummy_token.txt`):

````text
before login: authenticated = False
search before login -> 3 granules
login(strategy='environment') returned in 1.2s; authenticated = True; earthaccess.__store__ is None = False
after login attempt: authenticated = True
search after login attempt raised RuntimeError: {"errors":["Token does not exist"]}
````


### A.18 and A.19 Mixed checks

#### A.18 extra_checks.py

Source: `S/scripts/extra_checks.py` (md5 `2c00e128baaa9f21f73644194ae5b8fe`). Status: **ran**.

````python
"""Extra checks (no login):
1. asf_search: why does collections=<concept ids> return 0? Show the CMR parameters it is translated to, and try it
   with and without the track/frame filters.
2. earthaccess 0.19.0: does open() accept the access="s3" keyword that the "latest" docs describe?
3. earthaccess automatic pagination past one CMR page (a query with more than 2000 hits).
4. CORS: do CMR and the public browse PNG host answer a browser-style request that carries an Origin header?
"""
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter

import asf_search as asf
import earthaccess
from asf_search.CMR.subquery import build_subqueries
from asf_search.CMR.translate import translate_opts

asf.REPORT_ERRORS = False
UA = "nisar-search-verify/1.0"
WKT = "POINT(104.05 12.95)"
T = dict(start="2026-06-01T00:00:00Z", end="2026-11-13T23:59:59Z")
IDS = ["C3622214170-ASF", "C2854338529-ASF", "C3622241360-ASF"]

print("### 1. asf_search collections=<3 GCOV collection concept ids>")
for label, kw in (
    ("collections + point + dates", dict(collections=IDS, intersectsWith=WKT, **T)),
    ("collections + point + dates + relativeOrbit=83", dict(collections=IDS, intersectsWith=WKT, relativeOrbit=83, **T)),
    ("collections + point + dates + flightDirection", dict(collections=IDS, intersectsWith=WKT, flightDirection="ASCENDING", **T)),
    ("collections + point + dates + frame=8", dict(collections=IDS, intersectsWith=WKT, frame=8, **T)),
    ("collections + point + dates + asfFrame=8", dict(collections=IDS, intersectsWith=WKT, asfFrame=8, **T)),
    ("collections + platform=NISAR + point + dates + relativeOrbit=83 + frame=8", dict(collections=IDS, platform=asf.PLATFORM.NISAR, intersectsWith=WKT, relativeOrbit=83, frame=8, **T)),
):
    opts = asf.ASFSearchOptions(**kw)
    sent = [(k, v) for k, v in translate_opts(build_subqueries(opts)[0]) if k not in ("page_size", "provider", "temporal", "point")]
    res = asf.search(**kw)
    print(f"  {label}: n={len(res)}")
    print(f"      CMR params sent (minus page_size/provider/temporal/point): {sent}")

print("\n### 2. earthaccess", earthaccess.__version__, "open(..., access='s3')")
try:
    earthaccess.open([], access="s3")
    print("  accepted")
except BaseException as exc:  # noqa: BLE001
    print(f"  {type(exc).__name__}: {exc}")

print("\n### 3. earthaccess pagination: Provisional GCOV, 2026-10-20 .. 2026-10-23 (more than one 2000-item CMR page)")
q = earthaccess.granule_query().short_name("NISAR_L2_GCOV_PROVISIONAL_V1").temporal("2026-10-20T00:00:00Z", "2026-10-23T00:00:00Z")
print("  hits():", q.hits())
t = time.time()
res = earthaccess.search_data(short_name="NISAR_L2_GCOV_PROVISIONAL_V1", temporal=("2026-10-20T00:00:00Z", "2026-10-23T00:00:00Z"))
names = [g["umm"]["GranuleUR"] for g in res]
print(f"  search_data() returned {len(res)} granules ({len(set(names))} unique) in {time.time()-t:.1f}s")
t = time.time()
res = earthaccess.search_data(count=5, short_name="NISAR_L2_GCOV_PROVISIONAL_V1", temporal=("2026-10-20T00:00:00Z", "2026-10-23T00:00:00Z"))
print(f"  search_data(count=5) returned {len(res)} granules in {time.time()-t:.1f}s")

print("\n### 4. CORS headers when the request carries Origin: http://localhost:5173")
G = "NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001"


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


opener = urllib.request.build_opener(NoRedirect)
targets = {
    "CMR granules.umm_json": "https://cmr.earthdata.nasa.gov/search/granules.umm_json?" + urllib.parse.urlencode(
        [("short_name", "NISAR_L2_GCOV_V1"), ("attribute[]", "string,STACK_ID,083_A_008"), ("page_size", "1")]),
    "browse PNG (distribution host, before redirect)": f"https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1/{G}/{G}_LATLON_thumbnail.png",
}
for label, url in list(targets.items()):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Origin": "http://localhost:5173"})
    try:
        r = opener.open(req, timeout=60)
        status, h = r.status, r.headers
        r.close()
    except urllib.error.HTTPError as e:
        status, h = e.code, e.headers
    print(f"  {label}: HTTP {status} | Access-Control-Allow-Origin={h.get('Access-Control-Allow-Origin')} | "
          f"Access-Control-Expose-Headers={h.get('Access-Control-Expose-Headers')}")
    loc = h.get("Location")
    if loc:
        req2 = urllib.request.Request(loc, headers={"User-Agent": UA, "Origin": "http://localhost:5173", "Range": "bytes=0-7"})
        with urllib.request.urlopen(req2, timeout=60) as r2:
            print(f"      after redirect to {urllib.parse.urlparse(loc).netloc}: HTTP {r2.status} | "
                  f"Access-Control-Allow-Origin={r2.headers.get('Access-Control-Allow-Origin')} | Content-Type={r2.headers.get('Content-Type')}")
````

What it printed (`S/out2/extra_checks.txt`):

````text
### 1. asf_search collections=<3 GCOV collection concept ids>
  collections + point + dates: n=22
      CMR params sent (minus page_size/provider/temporal/point): [('echo_collection_id[]', 'C3622214170-ASF'), ('echo_collection_id[]', 'C2854338529-ASF'), ('echo_collection_id[]', 'C3622241360-ASF'), ('options[temporal][and]', 'true'), ('sort_key[]', '-end_date'), ('sort_key[]', 'granule_ur'), ('options[platform][ignore_case]', 'true')]
  collections + point + dates + relativeOrbit=83: n=0
      CMR params sent (minus page_size/provider/temporal/point): [('attribute[]', 'int,PATH_NUMBER,83'), ('echo_collection_id[]', 'C3622214170-ASF'), ('echo_collection_id[]', 'C2854338529-ASF'), ('echo_collection_id[]', 'C3622241360-ASF'), ('options[temporal][and]', 'true'), ('sort_key[]', '-end_date'), ('sort_key[]', 'granule_ur'), ('options[platform][ignore_case]', 'true')]
  collections + point + dates + flightDirection: n=11
      CMR params sent (minus page_size/provider/temporal/point): [('attribute[]', 'string,ASCENDING_DESCENDING,ASCENDING'), ('echo_collection_id[]', 'C3622214170-ASF'), ('echo_collection_id[]', 'C2854338529-ASF'), ('echo_collection_id[]', 'C3622241360-ASF'), ('options[temporal][and]', 'true'), ('sort_key[]', '-end_date'), ('sort_key[]', 'granule_ur'), ('options[platform][ignore_case]', 'true')]
  collections + point + dates + frame=8: n=0
      CMR params sent (minus page_size/provider/temporal/point): [('attribute[]', 'int,CENTER_ESA_FRAME,8'), ('echo_collection_id[]', 'C3622214170-ASF'), ('echo_collection_id[]', 'C2854338529-ASF'), ('echo_collection_id[]', 'C3622241360-ASF'), ('options[temporal][and]', 'true'), ('sort_key[]', '-end_date'), ('sort_key[]', 'granule_ur'), ('options[platform][ignore_case]', 'true')]
  collections + point + dates + asfFrame=8: n=11
      CMR params sent (minus page_size/provider/temporal/point): [('attribute[]', 'int,FRAME_NUMBER,8'), ('echo_collection_id[]', 'C3622214170-ASF'), ('echo_collection_id[]', 'C2854338529-ASF'), ('echo_collection_id[]', 'C3622241360-ASF'), ('options[temporal][and]', 'true'), ('sort_key[]', '-end_date'), ('sort_key[]', 'granule_ur'), ('options[platform][ignore_case]', 'true')]
  collections + platform=NISAR + point + dates + relativeOrbit=83 + frame=8: n=11
      CMR params sent (minus page_size/provider/temporal/point): [('attribute[]', 'int,FRAME_NUMBER,8'), ('attribute[]', 'int,TRACK_NUMBER,83'), ('echo_collection_id[]', 'C3622214170-ASF'), ('echo_collection_id[]', 'C2854338529-ASF'), ('echo_collection_id[]', 'C3622241360-ASF'), ('shortName', 'NISAR_L0B_RRSD_BETA_V1'), ('shortName', 'NISAR_L0B_RRSD_PROVISIONAL_V1'), ('shortName', 'NISAR_L0B_RRSD_V1'), ('shortName', 'NISAR_L1_RIFG_BETA_V1'), ('shortName', 'NISAR_L1_RIFG_PROVISIONAL_V1'), ('shortName', 'NISAR_L1_RIFG_V1'), ('shortName', 'NISAR_L1_ROFF_BETA_V1'), ('shortName', 'NISAR_L1_ROFF_PROVISIONAL_V1'), ('shortName', 'NISAR_L1_ROFF_V1'), ('shortName', 'NISAR_L1_RSLC_BETA_V1'), ('shortName ...[cut]

### 2. earthaccess 0.19.0 open(..., access='s3')
  TypeError: open() got an unexpected keyword argument 'access'

### 3. earthaccess pagination: Provisional GCOV, 2026-10-20 .. 2026-10-23 (more than one 2000-item CMR page)
  hits(): 2492
  search_data() returned 2492 granules (2492 unique) in 8.7s
  search_data(count=5) returned 5 granules in 0.3s

### 4. CORS headers when the request carries Origin: http://localhost:5173
  CMR granules.umm_json: HTTP 200 | Access-Control-Allow-Origin=* | Access-Control-Expose-Headers=CMR-Hits, CMR-Request-Id, X-Request-Id, CMR-Scroll-Id, CMR-Search-After, CMR-Timed-Out, CMR-Shapefile-Original-Point-Count, CMR-Shapefile-Simplified-Point-Count
  browse PNG (distribution host, before redirect): HTTP 303 | Access-Control-Allow-Origin=* | Access-Control-Expose-Headers=*
      after redirect to d1mv8zhcvry6x4.cloudfront.net: HTTP 206 | Access-Control-Allow-Origin=* | Content-Type=binary/octet-stream
````

(Output shortened for this digest: long lines cut at 700 characters. Full file: `S/out2/extra_checks.txt`.)


#### A.19 misc_checks.py

Source: `S/scripts/misc_checks.py` (md5 `15daa5acbcd77bf9e09b9686565d2d65`). Status: **ran**.

````python
"""Miscellaneous checks (no login):
1. fsspec HTTPS range read of a PUBLIC browse PNG through the same distribution host (the .h5 itself needs login)
2. do Provisional and Validated GCOV collections overlap (same acquisition in both)?
3. raw (L0B RRSD) acquisitions vs GCOV granules at the test point: is a newer acquisition still waiting for its GCOV?
4. requests: case-insensitive access to CMR headers"""
import json
import struct
import time
import urllib.parse
import urllib.request
from collections import Counter, defaultdict

import asf_search as asf
import fsspec
import requests

asf.REPORT_ERRORS = False
UA = {"User-Agent": "nisar-search-verify/1.0"}
G = "NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001"

print("### 1. fsspec", fsspec.__version__, "range read of the public _LATLON.png browse image")
url = f"https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1/{G}/{G}_LATLON.png"
fs = fsspec.filesystem("https", client_kwargs={"headers": UA})
t = time.time()
try:
    info = fs.info(url)
    print(f"  fs.info -> size={info.get('size')} type={info.get('type')} ({time.time()-t:.1f}s)")
    t = time.time()
    with fs.open(url, cache_type="background", block_size=4 * 1024 * 1024) as f:
        head = f.read(26)
        f.seek(info["size"] - 12)
        tail = f.read(12)
    w, h = struct.unpack(">II", head[16:24])
    print(f"  first 8 bytes={head[:8]!r} -> PNG {w}x{h}; last chunk tag={tail[4:8]!r} ({time.time()-t:.1f}s)")
except BaseException as exc:  # noqa: BLE001
    print(f"  EXCEPTION {type(exc).__name__}: {str(exc)[:300]}")

print("\n### 2. Provisional vs Validated overlap (both collections, 2026-10-20 .. 2026-10-23)")


def cmr(params):
    req = urllib.request.Request("https://cmr.earthdata.nasa.gov/search/granules.umm_json?" + urllib.parse.urlencode(params), headers=UA)
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.headers, json.load(r)


groups = defaultdict(set)
for sn in ("NISAR_L2_GCOV_PROVISIONAL_V1", "NISAR_L2_GCOV_V1"):
    h, d = cmr([("short_name", sn), ("temporal", "2026-10-20T00:00:00Z,2026-10-23T00:00:00Z"), ("page_size", "2000")])
    print(f"  {sn}: hits={h.get('CMR-Hits')} fetched={len(d['items'])}")
    for it in d["items"]:
        a = {x["Name"]: x["Values"] for x in it["umm"]["AdditionalAttributes"]}
        groups[(a["STACK_ID"][0], it["umm"]["TemporalExtent"]["RangeDateTime"]["BeginningDateTime"][:19], a["FULL_FRAME"][0], a["RANGE_BANDWIDTH_CONCAT"][0])].add(sn)
both = [k for k, v in groups.items() if len(v) > 1]
print(f"  distinct (stack, start, full_frame, bandwidth): {len(groups)} | present in BOTH collections: {len(both)}")

print("\n### 3. acquisitions at POINT(104.05 12.95), track 83 ascending: L0B RRSD vs RSLC vs GCOV start dates")
for level in ("RRSD", "RSLC", "GCOV"):
    res = asf.search(dataset=asf.DATASET.NISAR, processingLevel=level, intersectsWith="POINT(104.05 12.95)", relativeOrbit=83,
                     flightDirection="ASCENDING", start="2026-06-01T00:00:00Z", end="2026-11-14T23:59:59Z")
    days = sorted({p.properties["startTime"][:10] for p in res})
    print(f"  {level}: {len(res)} granules on {len(days)} days; last 3 days: {days[-3:]}; collections={dict(Counter(p.properties['collectionName'] for p in res))}")

print("\n### 4. requests", requests.__version__, "header access")
r = requests.get("https://cmr.earthdata.nasa.gov/search/granules.umm_json",
                 params=[("short_name", "NISAR_L2_GCOV_V1"), ("attribute[]", "string,STACK_ID,083_A_008"), ("page_size", "1")],
                 headers=UA, timeout=60)
print("  status", r.status_code, "| r.headers['CMR-Hits'] =", r.headers["CMR-Hits"], "| r.headers.get('cmr-search-after') =", r.headers.get("cmr-search-after"),
      "| Content-Encoding =", r.headers.get("Content-Encoding"), "| bytes =", len(r.content))
````

What it printed (`S/out2/misc_checks.txt`):

````text
### 1. fsspec 2026.9.0 range read of the public _LATLON.png browse image
  fs.info -> size=4247472 type=file (0.8s)
  first 8 bytes=b'\x89PNG\r\n\x1a\n' -> PNG 1880x1847; last chunk tag=b'IEND' (2.7s)

### 2. Provisional vs Validated overlap (both collections, 2026-10-20 .. 2026-10-23)
  NISAR_L2_GCOV_PROVISIONAL_V1: hits=2492 fetched=2000
  NISAR_L2_GCOV_V1: hits=1685 fetched=1685
  distinct (stack, start, full_frame, bandwidth): 3681 | present in BOTH collections: 0

### 3. acquisitions at POINT(104.05 12.95), track 83 ascending: L0B RRSD vs RSLC vs GCOV start dates
  RRSD: 12 granules on 12 days; last 3 days: ['2026-10-17', '2026-10-29', '2026-11-10']; collections={'NISAR_L0B_RRSD_V1': 2, 'NISAR_L0B_RRSD_PROVISIONAL_V1': 10}
  RSLC: 11 granules on 11 days; last 3 days: ['2026-10-05', '2026-10-17', '2026-10-29']; collections={'NISAR_L1_RSLC_V1': 1, 'NISAR_L1_RSLC_PROVISIONAL_V1': 10}
  GCOV: 11 granules on 11 days; last 3 days: ['2026-10-05', '2026-10-17', '2026-10-29']; collections={'NISAR_L2_GCOV_V1': 1, 'NISAR_L2_GCOV_PROVISIONAL_V1': 10}

### 4. requests 2.34.2 header access
  status 200 | r.headers['CMR-Hits'] = 3 | r.headers.get('cmr-search-after') = ["asf",1793313394000,4407897535] | Content-Encoding = None | bytes = 29497
````


Note on A.19 part 2: it fetched one page (2000 of 2492) and so reported 0 overlaps; the paged version in Section 5.10 found 117.

### A.20 One-off `curl` probes that exist only in the transcript

#### A.20a CMR errors for granule queries with no collection filter

Transcript attempt 2 (`T/agent-aa08b10c271190d31.jsonl`), command at row 295, result at row 296. Status: **ran**.

Command:

````sh
cd <scratch>/verify/search && G=NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001 && echo "--- granule_ur only:" && curl -sS -A "nisar-search-verify/1.0" -w "\nHTTP %{http_code}\n" "https://cmr.earthdata.nasa.gov/search/granules.umm_json?granule_ur=$G" | cut -c1-600 && echo "--- granule_ur + provider=ASF:" && curl -sS -A "nisar-search-verify/1.0" -o /dev/null -w "HTTP %{http_code} size=%{size_download}\n" "https://cmr.earthdata.nasa.gov/search/granules.umm_json?granule_ur=$G&provider=ASF" && echo "--- point only (no collection filter):" && curl -sS -A "nisar-search-verify/1.0" -w "\nHTTP %{http_code}\n" "https://cmr.earthdata.nasa.gov/search/granules.umm_json?point=104.05,12.95&page_size=1" | cut -c1-600 && echo "--- attribute only (no collection filter):" && curl -sS -G -A "nisar-search-verify/1.0" -w "\nHTTP %{http_code}\n" --data-urlencode "attribute[]=string,STACK_ID,083_A_008" --data-urlencode "page_size=1" "https://cmr.earthdata.nasa.gov/search/granules.umm_json" | cut -c1-600
````

Result:

````text
--- granule_ur only:
{"errors":["The CMR does not allow querying across granules in all collections. To help optimize your search, you should limit your query using conditions that identify one or more collections, such as provider, provider_id, concept_id, collection_concept_id, short_name, version or entry_title. For any questions please contact cmr-support@nasa.gov."]}
HTTP 400
--- granule_ur + provider=ASF:
HTTP 200 size=30069
--- point only (no collection filter):
{"errors":["The CMR does not allow querying across granules in all collections. To help optimize your search, you should limit your query using conditions that identify one or more collections, such as provider, provider_id, concept_id, collection_concept_id, short_name, version or entry_title. For any questions please contact cmr-support@nasa.gov."]}
HTTP 400
--- attribute only (no collection filter):
{"errors":["The CMR does not allow querying across granules in all collections. To help optimize your search, you should limit your query using conditions that identify one or more collections, such as provider, provider_id, concept_id, collection_concept_id, short_name, version or entry_title. For any questions please contact cmr-support@nasa.gov."]}
HTTP 400
````


#### A.20b CORS headers on a browse PNG (both hops) and on CMR

Transcript attempt 2 (`T/agent-aa08b10c271190d31.jsonl`), command at row 316, result at row 317. Status: **ran**.

Command:

````sh
cd <scratch>/verify/search && G=NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001 && U="https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1/$G/${G}_LATLON_thumbnail.png" && echo "=== GET with Origin header, following redirects; response headers of each hop:" && curl -sS -L -A "nisar-search-verify/1.0" -H "Origin: http://localhost:3000" -o /dev/null -D - "$U" | grep -i -E "^(HTTP/|access-control|content-type|location: https://[^/]+|vary|cache-control|content-length|x-cache)" | sed -E 's#(location: https://[^/]+/).*#\1<path+signed query omitted>#I' && echo "=== CMR search endpoint with Origin header:" && curl -sS -A "nisar-search-verify/1.0" -H "Origin: http://localhost:3000" -o /dev/null -D - "https://cmr.earthdata.nasa.gov/search/granules.umm_json?short_name=NISAR_L2_GCOV_V1&page_size=1" | grep -i -E "^(HTTP/|access-control)"
````

Result:

````text
=== GET with Origin header, following redirects; response headers of each hop:
HTTP/2 303 
content-type: application/json
content-length: 0
location: https://d1mv8zhcvry6x4.cloudfront.net/<path+signed query omitted>
cache-control: private, max-age=3540
x-cache: Miss from cloudfront
access-control-allow-origin: *
access-control-expose-headers: *
HTTP/2 200 
content-type: binary/octet-stream
content-length: 14600
x-cache: Miss from cloudfront
access-control-allow-origin: *
access-control-expose-headers: *
=== CMR search endpoint with Origin header:
HTTP/2 200 
access-control-allow-origin: *
access-control-expose-headers: CMR-Hits, CMR-Request-Id, X-Request-Id, CMR-Scroll-Id, CMR-Search-After, CMR-Timed-Out, CMR-Shapefile-Original-Point-Count, CMR-Shapefile-Simplified-Point-Count
````


#### A.20c CMR response size with and without gzip, and a count-only request

Transcript attempt 2 (`T/agent-aa08b10c271190d31.jsonl`), command at row 382, result at row 383. Status: **ran**.

Command:

````sh
cd <scratch>/verify/search && Q='short_name[]=NISAR_L2_GCOV_BETA_V1&short_name[]=NISAR_L2_GCOV_PROVISIONAL_V1&short_name[]=NISAR_L2_GCOV_V1&bounding_box=95,5,110,25&temporal=2026-10-01T00:00:00Z,2026-11-01T00:00:00Z&page_size=200' && for fmt in umm_json json; do echo "--- granules.$fmt, page_size=200, identity encoding:"; curl -sS -g -A "nisar-search-verify/1.0" -o /dev/null -w "HTTP %{http_code} bytes=%{size_download} time=%{time_total}s\n" "https://cmr.earthdata.nasa.gov/search/granules.$fmt?$Q"; echo "--- granules.$fmt, page_size=200, Accept-Encoding: gzip:"; curl -sS -g -A "nisar-search-verify/1.0" -H "Accept-Encoding: gzip" -o /dev/null -w "HTTP %{http_code} bytes=%{size_download} time=%{time_total}s\n" "https://cmr.earthdata.nasa.gov/search/granules.$fmt?$Q"; done; echo "--- hits only (page_size=0):"; curl -sS -g -A "nisar-search-verify/1.0" -D - -o /dev/null -w "HTTP %{http_code} bytes=%{size_download} time=%{time_total}s\n" "https://cmr.earthdata.nasa.gov/search/granules.umm_json?${Q/page_size=200/page_size=0}" | grep -i -E "^(cmr-hits|HTTP )"
````

Result:

````text
--- granules.umm_json, page_size=200, identity encoding:
HTTP 200 bytes=5916913 time=1.571544s
--- granules.umm_json, page_size=200, Accept-Encoding: gzip:
HTTP 200 bytes=5916913 time=2.181565s
--- granules.json, page_size=200, identity encoding:
HTTP 200 bytes=4960203 time=1.685860s
--- granules.json, page_size=200, Accept-Encoding: gzip:
HTTP 200 bytes=110951 time=1.935041s
--- hits only (page_size=0):
cmr-hits: 480
HTTP 200 bytes=33 time=0.180282s
````


#### A.20d `granules.json` against `granules.umm_json`: headers, compression, entry shape

Transcript attempt 2 (`T/agent-aa08b10c271190d31.jsonl`), command at row 386, result at row 387. Status: **ran**.

Command:

````sh
cd <scratch>/verify/search && Q='short_name[]=NISAR_L2_GCOV_PROVISIONAL_V1&short_name[]=NISAR_L2_GCOV_V1&attribute[]=string,STACK_ID,083_A_008&attribute[]=string,FULL_FRAME,TRUE&page_size=50' && for fmt in umm_json json; do echo "--- $fmt response headers with Accept-Encoding: gzip, br"; curl -sS -g -A "nisar-search-verify/1.0" -H "Accept-Encoding: gzip, br" -o /dev/null -D - -w "bytes=%{size_download}\n" "https://cmr.earthdata.nasa.gov/search/granules.$fmt?$Q" | grep -i -E "^(HTTP|content-type|content-encoding|content-length|cmr-hits|bytes=)"; done; mkdir -p downloads/cmr_json && curl -sS -g --compressed -A "nisar-search-verify/1.0" -o downloads/cmr_json/stack_full.json "https://cmr.earthdata.nasa.gov/search/granules.json?$Q" && ./venv/bin/python -I - <<'EOF'
import json
d = json.load(open("downloads/cmr_json/stack_full.json"))
e = d["feed"]["entry"]
print("granules.json: entries =", len(e))
x = [k for k in e if "20261017T223633" in k["title"]][0]
print("entry keys:", sorted(x.keys()))
for k in sorted(x.keys()):
    if k == "links":
        continue
    print(f"  {k}: {str(x[k])[:220]}")
print("  links (rel | type | title | href tail):")
for l in x["links"]:
    print("     ", l.get("rel", "").rsplit("/", 1)[-1], "|", l.get("type"), "|", l.get("title"), "|", l["href"][:40] + "..." + l["href"][-28:], "| inherited" if l.get("inherited") else "")
EOF
````

Result:

````text
--- umm_json response headers with Accept-Encoding: gzip, br
HTTP/2 200 
content-type: application/vnd.nasa.cmr.umm_results+json;version=1.6.7; charset=utf-8
content-length: 329882
cmr-hits: 11
bytes=329882
--- json response headers with Accept-Encoding: gzip, br
HTTP/2 200 
content-type: application/json;charset=utf-8
content-encoding: gzip
cmr-hits: 11
bytes=15426
granules.json: entries = 11
entry keys: ['browse_flag', 'collection_concept_id', 'coordinate_system', 'data_center', 'dataset_id', 'day_night_flag', 'granule_size', 'id', 'links', 'online_access_flag', 'orbit_calculated_spatial_domains', 'original_format', 'polygons', 'producer_granule_id', 'time_end', 'time_start', 'title', 'updated']
  browse_flag: True
  collection_concept_id: C2854338529-ASF
  coordinate_system: CARTESIAN
  data_center: ASF
  dataset_id: NISAR Provisional Geocoded Polarimetric Covariance Product (Version 1)
  day_night_flag: UNSPECIFIED
  granule_size: 1826.3494901657104
  id: G4378438775-ASF
  online_access_flag: True
  orbit_calculated_spatial_domains: [{'orbit_number': '6410'}]
  original_format: UMM_JSON
  polygons: [['11.99121 105.41857 14.13511 104.89877 13.59435 102.63217 11.45942 103.1681 11.99121 105.41857']]
  producer_granule_id: NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001
  time_end: 2026-10-17T22:37:08.999Z
  time_start: 2026-10-17T22:36:33.000Z
  title: NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001
  updated: 2026-10-19T21:46:16.667Z
  links (rel | type | title | href tail):
... [52 more lines not reproduced]
````


#### A.20e Data URL with no token and with a fake bearer token

Transcript attempt 2 (`T/agent-aa08b10c271190d31.jsonl`), command at row 462, result at row 463. Status: **ran**.

Command:

````sh
cd <scratch>/verify/search && G=NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001 && U="https://nisar.asf.earthdatacloud.nasa.gov/NISAR/NISAR_L2_GCOV_PROVISIONAL_V1/$G/$G.h5" && echo "=== .h5 with NO Authorization header (no redirect following):" && curl -sS -A "nisar-search-verify/1.0" -H "Range: bytes=0-7" -o /dev/null -D - "$U" | grep -i -E "^(HTTP/|location|www-authenticate|content-type|content-length)" | sed -E 's#(location: https://[^?]+)\?.*#\1?<query omitted>#I' && echo "=== .h5 with a FAKE bearer token (no redirect following):" && curl -sS -A "nisar-search-verify/1.0" -H "Authorization: Bearer this-is-not-a-real-token" -H "Range: bytes=0-7" -D - "$U" | head -c 1200 | sed -E 's#(location: https://[^?]+)\?.*#\1?<query omitted>#I' | cut -c1-400; echo; echo "=== HEAD on .h5 (no auth):"; curl -sS -I -A "nisar-search-verify/1.0" "$U" | grep -i -E "^(HTTP/|location|content-length)" | sed -E 's#(location: https://[^?]+)\?.*#\1?<query omitted>#I'
````

Result:

````text
=== .h5 with NO Authorization header (no redirect following):
HTTP/2 302 
content-type: application/json
content-length: 0
location: https://urs.earthdata.nasa.gov/oauth/authorize?<query omitted>
=== .h5 with a FAKE bearer token (no redirect following):
HTTP/2 302 
content-type: application/json
content-length: 0
location: https://urs.earthdata.nasa.gov/oauth/authorize?<query omitted>
date: Sat, 14 Nov 2026 03:06:42 GMT
x-amzn-remapped-date: Sat, 14 Nov 2026 03:06:42 GMT
x-amzn-requestid: 71b96cc8-1bb1-4c21-914b-c23cb1dee85c
x-amzn-remapped-x-amzn-requestid: 5be6bb39-42ca-4bb5-83f1-d9b5306c2c6c
x-xss-protection: 1; mode=block
strict-transport-security: max-age=31536000; includeSubDomains; preload
x-amzn-remapped-content-length: 0
x-frame-options: SAMEORIGIN
x-amzn-remapped-connection: keep-alive
x-request-id: 0463bc37-5453-4b9b-91a7-07f6d2e9d04e
x-amz-apigw-id: Gz16hHZVvHcEL2Q=
x-amzn-remapped-server: Server
x-content-type-options: nosniff
x-amzn-trace-id: Root=1-6af7d042-667136ae133cac1723b0df82;Parent=2c9e3974b15c2e62;Sampled=0;Lineage=1:0d5f9511:0
x-amzn-remapped-x-forw
=== HEAD on .h5 (no auth):
HTTP/2 303 
content-length: 0
location: https://d1mv8zhcvry6x4.cloudfront.net/head-7fdfbcb0ce308dc58d08f97acb1f0590/sds-n-cumulus-prod-nisar-products.s3.us-west-2.amazonaws.com/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001.h5?<query omitted>
````


#### A.20f HEAD on the data URL with no login, following the redirect

Transcript attempt 2 (`T/agent-aa08b10c271190d31.jsonl`), command at row 466, result at row 467. Status: **ran**.

Command:

````sh
cd <scratch>/verify/search && G=NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001 && U="https://nisar.asf.earthdatacloud.nasa.gov/NISAR/NISAR_L2_GCOV_PROVISIONAL_V1/$G/$G.h5" && echo "=== HEAD on the .h5 data URL, no login, following the redirect (HEAD only):" && curl -sS -I -L -A "nisar-search-verify/1.0" "$U" | grep -i -E "^(HTTP/|content-length|content-type|last-modified|etag|accept-ranges|x-cache)" | cut -c1-200
````

Result:

````text
=== HEAD on the .h5 data URL, no login, following the redirect (HEAD only):
HTTP/2 303 
content-type: application/json
content-length: 0
x-cache: Miss from cloudfront
HTTP/2 200 
content-type: binary/octet-stream
content-length: 1900019712
last-modified: Mon, 19 Oct 2026 21:45:54 GMT
etag: "a65b155089048d5ed4fd613275722c0e-8"
accept-ranges: bytes
x-cache: Miss from cloudfront
````


### A.21 Not reproduced

`S/scripts/html2text.py` and `S/scripts/fetch_docs.py` (helpers that downloaded documentation pages and turned them into text; the fetched pages are in `S/docs2/`, `S/docs_fetched/`, text in `S/docs2_text/`, `S/docs_text/`). The first attempt's outputs are in `S/out/prev_attempt/` and the second attempt's in `S/out/`; they match `S/out2/` except for counts that grew as the archive filled (Section 2.5) and timings.


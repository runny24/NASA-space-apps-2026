# research/digests/

The full record of the capability tests and reviews that were run the night before kickoff, one file per
topic. `../ERRATA.md` and `../VERIFIED_FACTS.md` are the short versions; come here when you need the detail
behind a fact: the exact command, the output it printed, or the test code.

| File | Topic |
|---|---|
| `search.md` | Finding granules in NASA's catalog (CMR, asf_search, earthaccess): calls that ran, duplicates, paging |
| `cookbook.md` | What is inside NISAR product files, NASA's public sample files, reading a window, streaming timings, what needs login |
| `harmony.md` | NASA's Harmony subsetting service for NISAR: request shape, what could be confirmed without login |
| `cog.md` | Writing Cloud-Optimized GeoTIFFs and reading pixels from them: options tested, sizes, range-request servers |
| `browser.md` | MapLibre GL JS 6 with the COG protocol in a real browser: imports, date switching, swipe view, pixel query, preview-image overlay |
| `engineering.md` | Review of the brief's engineering blueprint and code sketches, with what failed when run |
| `science.md` | Review of the brief's SAR science and data facts, with numeric checks (speckle, thresholds, areas) |
| `rules.md` | The hackathon rules checked against the live pages |
| `coldread.md` | What stalled a fresh agent following the brief |
| `factcheck.md` | The brief's factual claims checked one by one |

## How to read them

- **When they were made.** The tests and reviews ran from about 19:30 on 2026-11-13 to 02:00 on
  2026-11-14, before kickoff, in temporary folders outside any repository. The agents running them were cut
  off before reporting. These digests were written on 2026-11-14, after kickoff, from the outputs and
  transcripts those runs left behind. The temporary folders no longer exist.
- **Evidence classes.** Every fact is marked **ran** (a saved output shows it being run), **docs** (read in
  documentation or a package registry) or **belief** / unverified. Treat anything not marked "ran" as a lead.
- **The code in them is not project code.** The digests reproduce the throwaway test scripts so an
  experiment can be repeated. Nothing in this repository imports or was copied from them; the project's
  code was written after kickoff. They are not maintained and several examples are known to be wrong (that
  is what `../ERRATA.md` lists).
- **Places named in them are test subjects.** Many tests used one place as a worked example and others
  for coverage checks.
- **Paths.** `<scratch>/...` and `<transcripts>/...` stand for the deleted temporary folders and the test
  sessions' transcripts. Local folder paths and a user name were replaced by placeholders before publishing.
- **Third-party code is not reproduced.** Where a digest quoted code from someone else's repository (ASF's
  NISAR Cookbook, NASA's Harmony regression tests, the ISCE+ course), the quotation was replaced by a
  pointer; the digest still names the repository, file and commit so you can read it at the source.
- **Everything ran on one Mac** (Apple Silicon, Node 22, Python 3.12) with no Earthdata account. Nothing
  behind NASA's login was exercised and nothing ran on Windows.

All of it was produced with AI assistance (Claude, in Claude Code). See `AI_USE.md` at the repository root.

# CLAUDE.md

Team entry for the 2026 NASA Space Apps Challenge, challenge "Dancing with the SARs": an interactive app
that uses NISAR radar data to track and visualize surface change. You are the team's engineering partner.

**Clock (Central Time):** hackathon Sat 14 Nov 09:00 to Sun 15 Nov 23:59. Most of the project together by
Sunday morning. Feature freeze Sun 10:00. Live pitch Sun 15:00. Final submission by Sun 21:00.

## Read in this order

**Taking over as lead builder?** Start with `docs/HANDOFF_ORCHESTRATOR.md` (written Saturday 14 November,
17:25). It is written for any agent, whatever its model.

1. `PROGRESS.md`: where things stand right now. Update it at every gate and before any long job.
2. `docs/HANDOFF.md`: what the scaffold gives you, what was verified and how, what was not, known traps.
3. `docs/TASKS.md`: the ordered backlog with done-when lines, gates and the cut order.
4. `docs/CONCEPT.md`: the concept. `docs/TEAM_CHECKLIST.md`: what only people can do.
5. `docs/ARCHITECTURE.md` and `docs/DATA_CONTRACT.md`: how the code is organised and the one contract
   between pipeline and app.
6. Reference only, opened when a task needs it: `research/ERRATA.md`, `research/VERIFIED_FACTS.md`,
   `research/digests/` (the full test records behind those two: exact commands, outputs and test code,
   one file per topic; grep them, do not read them whole) and `research/BUILD_PROMPT.md` (a long
   pre-kickoff brief with known errors; the errata and the code win).
   The brief's schedule and "first hour" (its sections 7 and 10) are superseded by `docs/TASKS.md`: do not
   follow them.

## Rules that do not bend

- **Honest data.** Never invent values, dates or imagery. Quick-look pictures are not measurements.
  Missing passes show as missing. Sample or synthetic data is always labelled and never passed off as
  NISAR. Compare only images from one stack and one release, or say otherwise on screen.
- **No NASA logos, insignia lettering or mission patches**, including in screenshots. Credit in text.
- **Open licences only** (MIT, BSD, Apache-2.0, ISC and similar). Add every new dataset, library and
  resource to `docs/SOURCES.md` with URL and licence. Not allowed: highcharts, mapbox-gl, GPL code.
- **No secrets in git.** Credentials live in `.env` (git-ignored) or the user's netrc. Never print them.
- **Never go dark.** `main` deploys automatically, after the deploy workflow has run the full check suite
  itself; if that fails, the previous version stays up. Run `npm run check` before every push and look at
  the deployed page after it. Raw downloads stay in `work/` (git-ignored); only web-ready files are committed.

## Commands (same on Windows, macOS, Linux; run from the repository root)

```
npm run doctor                         # prerequisites and credentials, with fixes
npm run setup                          # .venv + web dependencies
npm run check                          # lint + tests + contract + data validation + size budget (CI runs this)
npm run dev                            # app at http://localhost:5173
npm run build / npm run preview        # production build / serve it
npm run e2e                            # browser smoke test against the production build
npm run live-check                     # the public page as a visitor sees it: fresh Chrome, a click, screenshots
npm run pipeline -- <command> [args]   # python -m pipeline ...: coverage, discover, auth-check, inspect,
                                       #   fetch, process, export, manifest, validate, qa, run
npm run sample                         # rebuild the sample site (public files, no login)
npm run gen:contract                   # regenerate TypeScript types after editing contract/*.schema.json
```

Serve the app only with `npm run dev` or `npm run preview`: other static servers may ignore HTTP range
requests, which breaks reading rasters.

PowerShell can swallow the `--` separator. These direct forms work in every shell:
`node scripts/py.mjs -m pipeline <args>`, `node scripts/tasks.mjs dev --port 5199`,
`node scripts/setup.mjs --python <path>`. Ports are fixed (dev 5173, preview and e2e 4173).

## How to work here

- **Thin vertical slices.** One date on the public map end to end before ten; one layer before five.
- **Verify by running.** Open the page, click it, read the console, look at the QA thumbnails. Report "ran
  it and saw this" separately from "expected to work".
- **State lives on disk.** This build outlasts a context window. `PROGRESS.md` holds the current phase,
  what is deployed, decisions and why, what is in flight, and open questions for the team.
- **Changing the data format** means editing `contract/*.schema.json`, running `npm run gen:contract`, and
  updating the pipeline writer and the app in the same commit.
- **Science rules are enforced by tests** (`docs/ARCHITECTURE.md`, "Science rules the code enforces"). If a
  shortcut would break one, do not take it.
- **Talk to the team in short notes** at each gate: what is live (URL), what you verified, what is next,
  and at most three decisions you need, each with your recommendation.
- **Token budget.** The team asked to save tokens: "use Opus for the majority of coding tasks". Delegate
  routine coding and mechanical edits to Opus subagents; keep the main session for decisions, integration
  and verification.
- **Windows.** The build machine is a Windows PC. Use the `npm run` commands (they find the virtual
  environment themselves); do not add shell scripts, Makefiles or symlinks; build paths with `pathlib` or
  `node:path`; close files before replacing them. CI runs the checks on Windows on every push.
- **Commits:** small and often, on `main`, message says what and why.

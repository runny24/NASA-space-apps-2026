# research/

Research done **before** the hackathon started, kept here as written so anyone can see what was prepared and
when. (The only edit: local folder paths and a user name inside two notes were shortened to `~` and
placeholders before publishing.) The rules allow teams to review the resources and research the topic before kickoff; they do not allow
building. Nothing in this folder is project code, and the app does not import from it.

| File | What it is | When |
|---|---|---|
| `BUILD_PROMPT.md` | A long build brief: verified facts about NISAR data, science guardrails, an engineering blueprint and a schedule. Its Section 1 (the team's concept) was left blank on purpose | 2026-11-13, evening before kickoff |
| `CHECKPOINT.md` | The evidence trail behind the brief: what was checked, how, and what was not | 2026-11-13 |
| `nisar_coverage.py` | Dependency-free script that lists NISAR passes over a point from NASA's public catalog. `python research/nisar_coverage.py <lon> <lat>` | 2026-11-13 |
| `evidence/rules/` | Saved text of the official Space Apps rule pages, the challenge statement, the team formation guide, and the organizers' forum answer on what is allowed before kickoff | read 2026-11-13 and 14 |
| `evidence/previews/` | NASA's own public preview images of NISAR products (courtesy NASA/JPL-Caltech and ISRO, via the Alaska Satellite Facility and NASA GIBS), saved to see what the data looks like | 2026-11-13 |

Two files here were written **after** kickoff, on 2026-11-14, from the saved outputs of the tests run the
night before:

| File | What it is |
|---|---|
| `ERRATA.md` | 145 corrections to the brief: where its claims turned out wrong or incomplete when tested |
| `VERIFIED_FACTS.md` | What those tests established, each fact marked as run, read in documentation, or unverified |
| `digests/` | The full record behind those two files, one digest per topic: commands, outputs and the throwaway test scripts. See `digests/README.md` |

All of it was prepared with AI assistance (Claude, in Claude Code). See `AI_USE.md` at the repository root.

**The brief has known errors.** It was written before its claims were tested. Where it
disagrees with `ERRATA.md`, with `docs/`, or with the code, those win. Its schedule and "first hour"
(sections 7 and 10) are superseded by `docs/TASKS.md`.

**The brief's examples.** Its Section 1 (the team's concept) was left blank on purpose, but the rest of it
uses one place as a worked example, lists data coverage at many places, and assumes some features; the
preview images show a few of those places. They are research notes about where data exists.

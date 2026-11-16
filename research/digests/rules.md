# Recovered findings: rules and judging compliance (topic "rules")

Recovered on Saturday 2026-11-14, about 10:55 CST, from three interrupted `review:rules` runs of the night
before. Written for the builder who will scaffold and build from `BUILD_PROMPT.md`. This file stands on its
own: corrections to the brief, facts, recommendations, a rule reference with pointers, and the review
scripts that worked, verbatim.

## 0. How to read this

**What survived, and what did not.** None of the three runs returned a report. In all three transcripts the
reasoning blocks are empty and the only assistant text is a usage-limit message. What survives is what the
runs *did*: the live rule pages they fetched and saved, the scripts they wrote, and the outputs those
scripts printed. So in this file:

- **ran** means a transcript tool result or a saved output shows it being run and what it printed.
- **docs** means I read it in the rule-page text those runs fetched and saved (or in the identical copies
  in the repository). The comparison of that text with the brief is mine; no reviewer wrote it down.
- **belief** means asserted somewhere with no evidence I could find.
- No finding here had a second, adversarial check. The workflow planned a "skeptic" pass after each
  reviewer; it never ran for this topic.

**Quoting.** Rule text is paraphrased here, not reproduced, with `file:line` pointers to the verbatim
wording. One short sentence is quoted verbatim (section 3, C2). When the exact words matter, open the
pointer.

**Short names used for paths**

| Name | Path |
|---|---|
| BRIEF | `<prehackathon-repo>/research/BUILD_PROMPT.md` |
| SG | `<prehackathon-repo>/research/evidence/rules/project-submission-guide.txt` |
| JG | `<prehackathon-repo>/research/evidence/rules/judging-awards-guide.txt` |
| FAQ | `<prehackathon-repo>/research/evidence/rules/participant-faqs.txt` |
| LEGAL | `<prehackathon-repo>/research/evidence/rules/legal.txt` |
| CHECKPOINT | `<prehackathon-repo>/research/CHECKPOINT.md` |
| S1 | `<scratch>/review/rules-compliance` (run 1 scratch) |
| S2 | `<scratch>/review/rules-and-judging-compliance` (run 2 scratch) |
| TF | `S2/text/www.spaceappschallenge.org_resources_team-formation-guide_.txt` (Team Formation Guide, live text) |
| GH | `S2/text/github.com_nasa_spaceapps_discussions_1827.txt` (organizers' answer, GitHub Discussion #1827) |
| CH | `S2/text/challenge_dump.txt` (challenge page: statement at lines 60 to 76, resources at 78 to 96) |
| NB | `S2/fetched2/nasa_brand_guidelines.txt` (nasa.gov brand guidelines) |
| FG | `S2/fetched2/fortiguard_form.txt` (FortiGuard request form) |
| T1 | `<transcripts>/wf_79c71ecc-a87/agent-ad865c59bbedd4759.jsonl` (run 1) |
| T2 | same folder, `agent-a26db1bb7c80457fa.jsonl` (run 2) |
| T3 | same folder, `agent-aa2c1fcc352e5dcf2.jsonl` (run 3) |

SG, JG, FAQ and LEGAL are durable copies and the line numbers below refer to them. Byte-identical copies
(same sha256) now also sit in the official repository at
`<official-repo>/research/evidence/rules/`, so the same line numbers
work there. S1 and S2 live under `/private/tmp` and can vanish at a reboot (recommendation R13).
"T2 row 164" means zero-based row 164 of that JSONL file, which is line 165 in an editor.

**State of the repositories while this was written (read-only look, 10:55 CST; not part of the recovered
evidence).** The official repository has one commit, `d50364c`, dated 2026-11-14 10:53:38 -0600, holding
`LICENSE` (Apache 2.0), `AI_USE.md`, `README.md`, housekeeping files and `research/`. Its copy of the brief
differs from the reviewed one only on line 85 (a local path), so brief line numbers below fit both copies.

## 1. How far the runs got

| Run | When (CST) | Work done | How it ended |
|---|---|---|---|
| 1 (T1) | Nov 13, 20:53 to 21:07 | 43 tool calls: read brief and rule pages; quote check against the four saved pages; fetched the live pages, Discussion #1827 and the FortiGuard form; showed the saved copies equal live; registry licence lookup; grep for the brief's running example; redirect check of resource links | "You've hit your 5-hour limit · resets 1:40am (America/Chicago)" |
| 2 (T2) | Nov 14, 01:41 to 02:01 | 58 tool calls: found the brief had moved to the pre-hackathon repository; refetched everything; second saved-versus-live comparison; quote check extended to the challenge page, Discussion #1827 and the Team Formation Guide; npm licences including two non-OSI ones; OpenFreeMap terms; NASA brand guidelines; FortiGuard form fields; repository state; schedule arithmetic | "You've hit your 5-hour limit · resets 6:40am (America/Chicago)" |
| 3 (T3) | Nov 14, 06:41 | none | "You've hit your Fable limit · resets 2pm (America/Chicago). Switch to another model to continue." |

The brief that was reviewed is the one still at BRIEF: sha256
`a6d97c5d486b8ffdfdfda7b1c871f4aa5f24b82f23541e05723e0d1a6211ec05`, 58558 bytes, 851 lines, modified
Nov 13 21:39:20 (T2 row 199; confirmed again while writing this). Its first line still says the review is
"not yet folded in". That is still true: no rules finding ever reached the brief.

## 2. What to act on first (ranked by damage)

1. **The schedule in the brief is built on the global deadline only.** The team says the bulk must be
   together by Sunday morning and they present at 3:00 pm Sunday. The brief's feature freeze is at that
   same hour and its demo and page work come after it. Ask the Local Lead today for the local judging
   time, format and any earlier local deadline (C1, R1).
2. **Saving is not submitting, and a late save can void the entry.** Someone must click "Submit for
   Judging" before Sunday 23:59 local; tick both attestations; fill every required field. Submit early,
   resubmit, and stop touching the page well before midnight (C2, C3, R2).
3. **Judges never see the answer in the SI form field.** They see what the project itself discloses
   (watermarks, descriptive text, metadata). The disclosure has to live in the repository and the app
   (C6, R3).
4. **Demo limits are hard.** At most 30 seconds of video or 7 slides; over the limit means no Global
   Judging. The demo is mandatory and must be hosted outside the Space Apps site (R8).
5. **Licence and citations.** OSI-licensed or unrestricted material only; licences identified in the
   documentation; every source cited. Two libraries a builder might reach for are not OSI-licensed (R5).
6. **A teammate files the FortiGuard request, not the agent.** The form needs a name, an email and a
   captcha (C7, R10).
7. **The concept stays the team's.** The scaffold must not default to the brief's worked example or
   pre-select features (C10, R4).
8. **Pre-kickoff research is allowed; say so openly.** Keep it labelled, cite it, and write project code
   after kickoff (R12, open question 3).

## 3. Corrections to the brief

Severity: **blocks-build** (following the brief as written fails), **wrong-result** (it runs but gives a
wrong outcome or a wrong claim), **minor**. No rules finding blocks the build. Brief line numbers are true
file line numbers.

| # | Severity | Brief section | The brief says | What is true | Evidence |
|---|---|---|---|---|---|
| C1 | wrong-result | 0, 3 (last paragraph), 7 | One clock only: "H30 \| **Feature freeze** (Sunday 15:00)", "Submitted by H36 (Sunday 21:00)", demo and project-page work in H30 to H36; and "A judge will probably spend a few minutes at most" | The submission guide tells teams to check with their Local Lead, because local judging and awards can follow a different timetable from the global submission window. First-round judging is done by Local Judges organised by the Local Lead. The team's own request for this run says the majority must be together by Sunday morning and they present at 3:00 pm, which is the brief's H30. Followed as written, the freeze lands on the presentation, and the demo, page text and link tests come after it. The sentence about how long a judge spends has no source in any rule page | SG:47; JG:55, JG:81; FAQ:88-89; the user request relayed to this recovery run |
| C2 | wrong-result | 0 (line 36), 7 (row H36 to H39) | "Anything saved after the deadline is not judged." | Three things are missing. (i) Saving is not submitting: "Save Progress" keeps changes visible to the team only, and the "Submit for Judging" button must be clicked before Sunday 23:59 local. (ii) The guide's wording is harsher than the brief's: "Any projects saved or submitted past this deadline will not be eligible for judging." (Project Submission Guide, spaceappschallenge.org, dated November 13, 2026). Read literally, a late save endangers the whole entry, not only the late edit. (iii) After the first submission every later save replaces what is judged, so a half-finished edit saved at 23:58 is the judged version | SG:59, SG:133, SG:138-139 |
| C3 | wrong-result | 8 (finish line), 9 (submission package) | Neither section mentions the submit click, the attestations, required fields or team eligibility | A team can tick every item in Section 8 and still be ineligible. Missing: the "Submit for Judging" click; two tick-box attestations (the requirements were read and the terms accepted; the work is the team's own, every outside resource is listed in the References field including open-source code, text and images, and nothing copyrighted was used without permission); all required fields complete; every member registered, in the same Local Event, not waitlisted, and on the team's Members tab; no likeness of anyone under 18 in the demo or project; the demo is mandatory and must be hosted externally | SG:105-107, SG:130-138; JG:49-57; LEGAL:47, LEGAL:65-67 |
| C4 | minor | Box, item 1 (lines 10-11) | "the organizers add" the disqualification warning, with no source; `research/evidence/rules/` holds no copy of it | The sentence is verbatim, but it is not on any of the four saved pages. It comes from the Global Organizing Team's reply of Nov 5, 2026 in GitHub Discussion nasa/spaceapps #1827 (labelled "GO Team Answered"). That reply and the Team Formation Guide are also the authority for the list of what is allowed before kickoff | T2 row 164: `L10: [VERBATIM in go-team-1827-live]`; T1 row 62: `L11   MISS ::` against all four saved pages; GH:146-148; TF:139; CHECKPOINT:35 has the URL |
| C5 | minor | 9, table row "Detailed Project Description" (line 643) | The quotation of this prompt closes with a question mark right after "did you use" | The guide's last question does not stop there; it continues, asking what was used in developing the project. The brief's version is a truncated quote | T2 row 164: `L642: [NOT FOUND]` with `nearest in submission-guide: 0.99`; SG:89 |
| C6 | minor | 2 (lines 121-122) | "The team will answer the "Use of SI" form field from it." | The field is labelled Use of Super Intelligence (SI). Its answer is collected for statistics and is not shown to judges. Judges see the indicators inside the project (watermarks, descriptive text, metadata) and assess originality, intent and execution from the SI-assisted parts the team identifies there. The brief's README, About-page and metadata plan is therefore the part that counts for scoring, and it should say so. The FAQ also makes a description of how SI tools were used mandatory for every submission | SG:90-97; FAQ:132; T1 row 62: `L122  OK   {'project-submission-guide.txt': 'case-insensitive only'}  :: Use of SI` |
| C7 | minor | 6.6 (lines 569-570), 10 step 5 (line 672), 7 row H30 to H36 ("FortiGuard confirmation") | The agent files the FortiGuard request and later checks a confirmation | The form requires a person's name and email and sits behind a captcha, so a teammate must file it. The guide asks for a best-fit category and N/A as company name. The request is optional. The guide promises no confirmation; it says the classification is FortiGuard's decision | SG:68-72; T1 row 130: `input name text required`, `input email text required`, `captcha mentions: 71`; T2 rows 187, 191 |
| C8 | minor | 0 (line 36), 7 (line 576) | "39 hours"; "H39 the deadline" | Kickoff to deadline is 38 h 59 min. H39 is Monday 00:00, one minute after the cut-off. H30 (Sunday 15:00) and H36 (Sunday 21:00) are right | T2 row 211: `deadline - kickoff = 1 day, 14:59:00 = 38.983333333333334 h` and `H39 = Monday 00:00` |
| C9 | minor | 9, first bullet (line 648) | A Global Award needs one NASA data item or resource (it quotes the form guidance) | Verbatim, but the organizers' reply is narrower: the NASA data source must be one of those in the Resources listed for the challenge, and every source, NASA data included, must be cited as a reference. NISAR data reached through ASF Vertex or Earthdata Search qualifies, because both are on the challenge's Resources tab; name them in the NASA Data field | GH:150; CH:80-88 |
| C10 | minor | 1.1 (line 71), 6.5, 7, 8, appendices | "Features we want (the challenge names these; ...)" including "click a place to chart its history" | The challenge text names change-detection maps, time-series animations, dashboards, image sliders, web maps and story maps. It does not name click-to-chart. Outside Section 1.1 the brief also fixes a compare view (lines 539, 584), click-to-inspect with per-pixel history (496-497, 544, 583, 617), charts (584, 628), a second place (585) and animation (601), and it uses one place as the worked example throughout (Tonle Sap, stack 083_A_008: lines 243, 254, 289, 305, 515-521, 701, 713, 719, 796, 838). The risk is that the brief supplies part of the concept, which the SI rule reserves for the team. No reviewer adjudicated this | CH:67, CH:73-75; T1 row 142 (grep output); CHECKPOINT:88-90 (the checklist was meant to hold only features the challenge names) |
| C11 | minor | 2, "Licence and citations" (lines 131-135); 6.5 (line 533) | Third-party material must be freely available or OSI-licensed; "A small charting library you are fluent in" | Also required: the licences of third-party materials must be identified in the documentation submitted with the solution, or NASA will not accept or post it; missing citations can cost nominations and awards. Library choice must stay inside OSI licences: Highcharts and mapbox-gl are not | LEGAL:51; T2 row 168: `highcharts \| 13.1.1 \| https://www.highcharts.com/license`, `mapbox-gl \| 3.35.0 \| SEE LICENSE IN LICENSE.txt` |
| C12 | minor | 6.5 (lines 555-556) | "basemap credits as the provider requires" | For OpenFreeMap the credit is automatic only inside MapLibre. In video or print it must be added by hand, which covers the demo video, slides and screenshots on the project page | T2 row 172 (openfreemap.org, HTTP 200) |
| C13 | minor | 2 (line 128) | "No NASA logos, flags or mission patches anywhere in the app or the demo." | Correct; keep it. NASA's brand guidelines, which the guide's branding sentence links to, add: no lettering styled like the insignia typeface or the "worm" logotype; mission, project and program identifiers are not public domain. This also applies to screenshots that happen to contain a NASA logo | NB:375, NB:423, NB:438; link target in T2 row 176 |
| C14 | minor | Appendix C | Resource URLs | Four URLs are the redirect targets of the links printed on the challenge's Resources tab (they work). The CONAE "SAOCOM Catalogue Registration" link is missing. The Resources tab also carries a notice that the data-use terms of non-U.S.-government sites must be followed | T1 row 146; CH:78, CH:96 |

Everything else the brief quotes from the rule pages checked out word for word (fact F2).

## 4. Facts

| # | Claim | Kind | Evidence |
|---|---|---|---|
| F1 | The four saved rule pages in `research/evidence/rules/` matched the live pages at both check times (Nov 13 about 21:02 CST and Nov 14 about 01:47 CST). No sentence differed apart from whitespace introduced by text extraction. The three guides carry the date stamp November 13, 2026. Nobody has re-checked since 01:47 CST Nov 14 | ran | T2 row 113: `=== legal` / `saved sentences 83, live sentences 83; only in saved 0, only in live 0`; T1 row 116: `##### judging-awards-guide.txt` / `saved sentences 127, live sentences 127; only in saved 0, only in live 0` |
| F2 | Run 2 checked 54 quoted strings in the brief: 35 are verbatim in a source. Of the 19 "NOT FOUND", one is a real misquote (C5), two are script artefacts (F3), and 16 are not rule quotations at all (science quotations, a layer title, the brief's own phrases), which this topic did not check. Apart from C5, the only rule-quote issues are the phrase "Use of SI", which is not the field's label (C6), and the missing source for the disqualification warning (C4) | ran | T2 row 164, e.g. `L114: [VERBATIM in submission-guide]`, `L179: [VERBATIM in submission-guide]`; T1 row 62 (58 strings against the four saved pages only) |
| F3 | Two "NOT FOUND" lines in run 2's quote check (brief lines 175 and 644, the two quotes that contain " ... ") are script artefacts, not misquotes. Run 1's checker, which splits on the ellipsis, found both verbatim | ran | T1 row 62: `L175  OK   {'judging-awards-guide.txt': 'verbatim'}`, `L644  OK   {'project-submission-guide.txt': 'verbatim'}` |
| F4 | The challenge-statement quotations in Section 0 are verbatim on the live challenge page (last published 2026-11-13T03:46:20Z; identical extraction at both fetches: 16 chunks, 47433 characters) | ran | T2 row 164: `L26: [VERBATIM in challenge-live]`, `L28: [VERBATIM in challenge-live]`, `L31: [VERBATIM in challenge-live]`; T1 row 100: `"lastPublishedAt":"2026-11-13T03:46:20.609386Z"` |
| F5 | Three sources agree on the pre-kickoff rule. The FAQ forbids starting work on the challenges before the hackathon. The Team Formation Guide says not to begin the project until Nov 14, 9:00 a.m. local. The organizers' reply in Discussion #1827 asks teams not to start their projects before Saturday 9 a.m. local time of the Local Event (Universal Event: the Team Owner's local time), warns that teams who work ahead risk disqualification, and lists what is allowed beforehand: selecting a challenge, reviewing the resources, researching the topic, forming the team | docs | FAQ:121; TF:139; GH:146-148 |
| F6 | When last inspected by run 2 (Nov 14, 01:42 to 01:55 CST, before kickoff) the official repository had no commits and no files. The pre-hackathon repository held only `research/` (brief, checkpoint, six preview PNGs, four rule pages, `nisar_coverage.py`) in one commit, `a9398d1`, dated 2026-11-13 21:12:59 -0600 and already pushed to `origin/main`. CHECKPOINT says nothing was built for the project before kickoff | ran | T2 row 195: `* main                a9398d1 [origin/main] checkpoint 11-13-26 21:12`; T2 row 33: `No commits yet`; CHECKPOINT:27-28 |
| F7 | Submission mechanics. The Project tab appears only at kickoff (Saturday 9:00 a.m., time zone of the team's Local Event; Universal Event teams use the Team Owner's local time). "Save Progress" keeps changes visible to the team only. Judging requires clicking "Submit for Judging" before Sunday Nov 15, 11:59 p.m. local. Editing and resubmitting is allowed until the end, and judges review whatever was saved last. The edit "Lock" is advisory: a teammate can remove it and overwrite unpublished changes | docs | SG:45-46, SG:56, SG:59-60, SG:133, SG:138-139; TF:67, TF:130 |
| F8 | Local events can run on a different clock. The submission guide tells teams to check with their Local Lead because local judging and awards can be scheduled differently from the global submission window; the judging guide refers deadline questions to the Local Lead; the FAQ says to submit by the Local Event's own ending time and to look at the Local Event's page for its schedule. First-round judging is by Local Judges organised by the Local Lead, who may also give local awards | docs | SG:47; JG:55, JG:81-82; FAQ:88-89 |
| F9 | The project form has exactly eight fields, the same eight the brief lists: Project Name; High-Level Project Summary; Link to Project Demo; Link to Final Project; Detailed Project Description; Use of Super Intelligence (SI); NASA Data; Space Agency Partner Data and Other References. Submitting also needs two tick-box attestations. Images can be uploaded or pasted (JPG, PNG, GIF, up to 10 MB); videos and documents cannot | docs | SG:73-102, SG:62, SG:136-137; full attestation wording at JG:56-57 |
| F10 | SI (AI) rules. SI tools are permitted as an accelerator. SI must not be the source of the team's idea. Nothing generated may include or alter NASA branding or design elements. Teams must show where and how SI was used: a visible watermark on generated images and videos; an acknowledgement in descriptive text and in metadata for generated audio, code and data. The answer in the form field is not shown to judges; the in-project indicators are. The FAQ requires every submission to describe how SI tools were used | docs | SG:91-97; FAQ:129-132 |
| F11 | Demo rules. Mandatory. A video of at most 30 seconds or a deck of at most seven slides counting title and intro slides; over the limit means not eligible for Global Judging. Hosted externally behind a public link (the site takes no video or slide uploads). English, or a non-English video with English subtitles; slides must be in English. Slides must cover team name, member names and the chosen challenge. No image, video, audio or likeness of anyone under 18. A submitted video must be the team's own work and must not infringe third-party rights | docs | SG:105-108, SG:113-125, SG:134; LEGAL:65-67 |
| F12 | Eligibility for Global Judging. Answer one official challenge. Every member registered for the event, in the same Local Event (not waitlisted) or the Universal Event, and listed on the team's Members tab; no new members after submission closes. At most six members; at least one for a Local Event team, two for a Universal Event team. All required fields complete; demo within limits; English; submitted before the deadline; both attestations ticked. Teams are also reviewed under NASA's China funding restriction (affiliation with Chinese-owned entities, universities included) | docs | JG:49-58; SG:130-133; TF:57; FAQ:124; LEGAL:37 |
| F13 | Licence terms. Posted solutions are made available for others to download or use. Original content must carry no restriction or an OSI-approved licence; if none is named NASA distributes it under Apache 2.0. Non-NASA materials must be publicly and freely available with no restrictions, or OSI-licensed. Their licences must be identified in the documentation submitted with the solution, otherwise NASA will not accept or post it. Every source must be cited, open-source ones included, and NASA may remove nominations or awards from teams that do not cite | docs | LEGAL:48-51 |
| F14 | Registry licences of the libraries the brief names (latest versions on Nov 13 and 14). npm: maplibre-gl 6.18.0 BSD-3-Clause; @geomatico/maplibre-cog-protocol 0.10.0 MIT; geotiff 3.0.5 MIT; @mapbox/mapbox-gl-sync-move 0.4.0 ISC; @maplibre/maplibre-gl-compare 0.5.0 ISC; vite 8.3.8 MIT; react 19.3.1 MIT; typescript 7.0.2 Apache-2.0. PyPI: h5py 3.16.0 BSD-3-Clause; numpy 2.5.4 BSD-3-Clause with 0BSD, MIT, Zlib and CC0-1.0 parts; scipy 1.18.1 BSD; pyproj 3.8.0 MIT; rasterio 1.5.2 BSD-3-Clause; rio-cogeo 7.0.4 BSD-3-Clause; earthaccess 0.19.0 MIT; asf-search 14.1.0 BSD. Not OSI: highcharts 13.1.1 and mapbox-gl 3.35.0 | ran | T1 row 138; T2 row 168: `highcharts \| 13.1.1 \| https://www.highcharts.com/license`, `mapbox-gl \| 3.35.0 \| SEE LICENSE IN LICENSE.txt`; JSON in `S2/npm/` |
| F15 | OpenFreeMap, the brief's basemap: the project is MIT-licensed, the map data is from OpenStreetMap, attribution is required. MapLibre adds the credit on the map automatically; in video or print it must be added by hand. Required credit text: `OpenFreeMap © OpenMapTiles Data from OpenStreetMap` (the OpenFreeMap part is optional) | ran | T2 row 172: `200 12268 https://openfreemap.org/` and the attribution and licence lines printed after it |
| F16 | NASA branding. The submission guide's branding sentence links to NASA's brand guidelines. Those say the insignia ("meatball"), logotype ("worm") and seal need explicit permission for any use, are barred from pages NASA does not sponsor, and may not suggest endorsement; lettering that resembles the insignia typeface or the worm is not permitted; mission, project and program identifiers and crew and mission emblems are not public domain. A separate "NASA Data Insignia" exists for products that use public NASA data; its guidelines were not fetched | docs | NB:363, NB:374-375, NB:423, NB:436-438, NB:447; T2 row 176 (the link target `https://www.nasa.gov/nasa-brand-center/brand-guidelines/`) |
| F17 | FortiGuard. The guide recommends, and does not require, a Web Filter Classification request for a newly created website, with a best-fit category (it names education, personal websites and blogs, reference, web-based application) and N/A as company name; the outcome is FortiGuard's decision. The form at `https://www.fortiguard.com/faq/wfratingsubmit` requires URL, suggested category, name, email and company name; a screenshot (max 2 MB) and a comment are optional; a captcha widget guards it | ran | T1 row 130: `input url text required`, `select categorysuggestion None required`, `input name text required`, `input email text required`, `input company text required`, `captcha mentions: 71`; T2 rows 187, 191; SG:68-72 |
| F18 | Global Award data rule. The form guidance requires some NASA data or resource, one at minimum. The organizers' reply narrows it to a NASA data source from the challenge's own Resources, and requires every source to be cited. The Resources tab lists nine NASA resources (Earthdata Search, ASF Data Search Vertex, NISAR Data User Guide, Intro to Remote Sensing, Intro to SAR, ARSET trainings, NISAR StoryMaps, NISAR Applications White Papers, UAVSAR Postcards) and partner resources from CSA (RCM data, a SAR Python tutorial, RADARSAT-1 data) and CONAE (SAOCOM catalogue and its registration page). ESA and ISRO are both 2026 Space Agency Partners | docs | SG:99, SG:102; GH:150; CH:78-96 |
| F19 | Four official resource links redirect in one hop, HTTP 200, to the URLs the brief gives in Appendix C (Intro to Remote Sensing, ARSET, StoryMaps, White Papers) | ran | T1 row 146: `https://appliedsciences.nasa.gov/get-involved/training` / `-> 200 hops=1 final=https://www.earthdata.nasa.gov/data/projects/arset` |
| F20 | Clock arithmetic: Saturday 09:00 to Sunday 23:59 is 38 h 59 min; H30 is Sunday 15:00, H36 is Sunday 21:00, H39 is Monday 00:00 | ran | T2 row 211: `H30 = Sunday 15:00`, `H36 = Sunday 21:00`, `H39 = Monday 00:00` |
| F21 | Results calendar: Global Nominees Dec 3, 2026; Global Finalists and Honorable Mentions Dec 17, 2026; Global Winners Jan 26, 2027. Ten Global Awards: Best Use of Science, Best Use of Data, Best Use of Technology, Galactic Impact, Best Mission Concept, Most Inspirational, Best Storytelling, Global Connection, Art & Technology, Local Impact | docs | JG:79, JG:87, JG:90-100 |
| F22 | Questions to organizers go on Space Apps Connect, which is the GitHub Discussions of `github.com/nasa/spaceapps`. The Team Formation Guide says challenge and data questions can be asked there during the hackathon | ran | T2 row 88: `https://github.com/nasa/spaceapps	Space Apps Connect`; TF:142 |
| F23 | The site's index pages return no content without JavaScript, but each guide has a direct URL that returns full HTML, and the challenge page carries its text in embedded Next.js data. All 11 direct URLs returned HTTP 200 to `/usr/bin/curl` | ran | T2 row 100 (eleven lines beginning `200`); T1 row 82 |
| F24 | "The Anaconda curl fails TLS on spaceappschallenge.org; use /usr/bin/curl" was stated in the reviewers' task prompt. Every fetch in the transcripts used `/usr/bin/curl` and succeeded; no failing Anaconda run is recorded | belief | T1 row 1 (task prompt) |

## 5. Recommendations

| # | Decision | Choice | Why |
|---|---|---|---|
| R1 | Schedule baseline | Re-base Section 7 on the local event. Feature-complete and deployed by Sunday morning; presentation at 15:00; first global submission made long before that. A teammate asks the Local Lead today for the local judging time and format and for any local deadline earlier than 23:59 | The guide says local times may differ (SG:47) and the team's stated schedule puts the presentation at the brief's H30 |
| R2 | Submission procedure | Once the Project tab exists: fill all eight fields with true text, tick both attestations and click "Submit for Judging" on Saturday. Resubmit as the content improves. One named person edits. Final resubmit by Sunday 21:00 local at the latest. Nobody opens the edit page in the last hour | Saved-but-not-submitted work is invisible to judges; whatever was saved last is what gets judged; a save after the deadline makes the project ineligible; the edit lock can be removed by a teammate |
| R3 | SI disclosure | Put it inside the product: a README section, an About or AI-use page in the app, and the `AI_USE.md` log. For metadata keep the `Co-Authored-By:` trailer on AI-written commits, the `generator` block in `manifest.json` and a tag in exported rasters. Generate no images, video or audio; if one is added, watermark it visibly. Nothing generated may carry NASA branding | Judges see only in-project indicators (SG:97); code and data need both descriptive text and metadata (SG:96) |
| R4 | Concept ownership | Keep the scaffold site-agnostic and feature-agnostic: places come from `pipeline/sites/<site>.yaml` and the manifest, with no default place. Leave Section 1.1 to the team and keep their own words in the repository. Do not offer the brief's worked example as a choice | SI may not originate the idea (SG:92); judges weigh originality from what the team identifies as its own |
| R5 | Licence and dependencies | Keep the Apache-2.0 `LICENSE` unless the team names another OSI licence. Keep `docs/SOURCES.md` with name, URL, licence and where used, and mirror it into the References field. Take dependencies only from the OSI-licensed set in F14. Do not add `highcharts` or `mapbox-gl`. Run the registry lookup in section 10.7 for every new dependency | LEGAL:49-51; registry outputs in F14 |
| R6 | Basemap credit | Keep MapLibre's attribution control visible in the app. Put `OpenFreeMap © OpenMapTiles Data from OpenStreetMap` on demo video frames, slides and page screenshots that show the basemap | OpenFreeMap's terms (F15) |
| R7 | Branding | Text credits only (NASA/JPL-Caltech, ISRO, ASF DAAC, NASA GIBS). No NASA insignia, worm, seal, mission patch or mission mark. No NASA-style display lettering. Crop NASA logos out of screenshots | SG:93 and NASA's brand guidelines (F16) |
| R8 | Demo | Choose video or slides now and give it an owner. Video at most 30 seconds measured on the exported file, or at most 7 slides counting title and intro. Host it externally with a public link. English. Slides show team name, member names and the challenge. Nobody under 18 appears. No third-party music or footage | Over-limit entries lose Global Judging (SG:125); SG:105-108, SG:134; LEGAL:65 |
| R9 | Links | Open the demo link, the final-project link and the repository in a private window on a second device before every submit. The repository stays public | SG:63-66 |
| R10 | FortiGuard request | A teammate files it once the public URL is live: URL; category Education, Reference, Personal Websites and Blogs or Web-based Applications, whichever fits; Company Name N/A; own name and email; captcha. The agent only supplies the URL and a screenshot under 2 MB | Form fields (F17); the request is optional |
| R11 | NASA Data field | Name the challenge resources actually used by their official names and URLs (ASF Data Search Vertex `https://search.asf.alaska.edu/`, NASA Earthdata Search `https://search.earthdata.nasa.gov/search`, NISAR Data User Guide `https://nisar-docs.asf.alaska.edu/`), then collections, granule names and dates. List ISRO and ESA under partner data only if their data is really used | The organizers' wording ties Global Award eligibility to the challenge's Resources (GH:150) |
| R12 | Pre-kickoff material | Keep `research/` labelled as pre-kickoff, AI-assisted research. Cite it in `docs/SOURCES.md` and in the SI disclosure. Write project code after kickoff instead of copying scratch test code | Research before kickoff is allowed (GH:148); the originality attestation requires outside resources to be listed (JG:57). Not settled by the runs; see open question 3 |
| R13 | Evidence hygiene | Copy the text files that exist only in scratch (TF, GH, CH lines 60 to 96, NB, FG) into `research/evidence/rules/` of the official repository. Do **not** commit either `fortiguard_form.html`: a hidden form field in it holds the requester's encoded IP address | `/private/tmp` can be cleared; privacy |
| R14 | Re-verify before the final submit | Re-fetch the four rule pages with `/usr/bin/curl` and run `cmp_text.py` against the saved copies (sections 10.1 to 10.3) | The guides were republished on Nov 13; the last check was 01:47 CST Nov 14 |
| R15 | Fetching the rule pages | `/usr/bin/curl -sS -L -A "Mozilla/5.0 (compatible; rules-review/1.0)" --max-time 60`, the direct URLs in section 10.1, and `/opt/anaconda3/bin/python3 -I` for the scripts. The challenge page needs `rsc_text.py` then `rsc_dump.py` | All eleven fetches returned 200 this way (F23) |

## 6. Rule reference (paraphrased, with pointers)

**Before kickoff.** Allowed: choose a challenge, review the resources, research the topic, form the team
(GH:148). Not allowed: starting the project (FAQ:121, TF:139, GH:146). Teams that work ahead risk
disqualification (GH:147). Start is Saturday 9:00 a.m., local time of the Local Event; for the Universal
Event, the Team Owner's local time (GH:146, SG:45-46). The Team Formation Guide adds that a finished, fully
built project is not expected after two days (TF:140).

**Times.** Submission opens Saturday Nov 14, 9:00 a.m. and closes Sunday Nov 15, 11:59 p.m., in the time
zone of the team's Local Event (SG:45). Local judging and awards may be at other times (SG:47). Members can
be added until the hackathon ends (TF:63) and not after submission closes (JG:51). Results: Dec 3, Dec 17,
Jan 26, 2027 (JG:79, 87, 100).

**Project form.** All content in English (SG:132).

| Field (exact label) | What it asks | Pointer |
|---|---|---|
| Project Name | the project's name | SG:74-75 |
| High-Level Project Summary | what was developed, how it addresses the challenge, why it matters | SG:76-77 |
| Link to Project Demo | public link to a deck of at most 7 slides or a video of at most 30 seconds, hosted externally, no password, permission or registration | SG:78-80 |
| Link to Final Project | public link to the final project (a website, hosting service or code repository), no password, permission or registration | SG:81-82 |
| Detailed Project Description | what it does, how it works, its benefits, what the team hopes to achieve, and the tools, languages, hardware or software used in developing it | SG:83-89 |
| Use of Super Intelligence (SI) | whether SI tools were used and how; not shown to judges | SG:90-97 |
| NASA Data | specific NASA data and resources used; one at minimum is needed for a Global Award | SG:98-99 |
| Space Agency Partner Data and Other References | every dataset, resource and tool used, including code, text and images even when open source or free; partner-agency data is encouraged | SG:100-102 |

Then two tick boxes (SG:136-137, wording at JG:56-57) and the "Submit for Judging" button (SG:138). Which
fields the live form marks as required is not stated in the guide.

**SI.** SG:91-97, FAQ:129-132. See F10.

**Demo.** SG:103-125. Suggested video beats: names and team at 0:00, the challenge and why at 0:02, title
and tagline at 0:05, how it works with images or a prototype and the role of NASA and partner data at 0:10,
the future from 0:20 to 0:30 (SG:113-117). The brief's summary of these beats is accurate.

**Judging.** Five criteria scored 1 to 5 at every level: Impact, Creativity, Validity, Relevance,
Presentation (JG:60-75). The guide asks for equal attention to presentation (JG:76). The brief's quotations
of the criteria are verbatim (F2).

**Team.** F12.

**Licence and third-party material.** F13, LEGAL:48-51. Not accepted in a submission: commercial promotion,
material the team has no right to publish, personally identifiable information, names or likenesses of
anyone under 18 (LEGAL:38-47).

**Branding.** F16.

**FortiGuard.** F17, SG:68-72.

**Challenge.** The task: an interactive application built on NISAR radar data that tracks and shows at
least one kind of surface change somewhere on Earth. The statement asks teams to pick a study area,
download NISAR data from the listed resources, optionally add optical or GIS context, present the findings
in an interactive medium, hypothesise the physical drivers, say which polarizations show the change, and
name future uses of NISAR (CH:60-76). Difficulty tags: Advanced, Intermediate. Resources: CH:78-96.

## 7. Artifacts

| Path | What it is | To reuse |
|---|---|---|
| `S2/scripts/html2text.py` | HTML to plain text, one block per line; `--links` lists link targets with their text. Ran on all fetched pages | `python3 -I html2text.py page.html > page.txt`. No dependencies |
| `S2/scripts/cmp_text.py` | Sentence-level, order-insensitive comparison of two text files after normalising quotes, dashes and whitespace. Printed the saved-equals-live results in F1 | `python3 -I cmp_text.py <saved.txt> <live.txt>`. One differing navigation sentence per page is an extraction artefact |
| `S2/scripts/quote_check.py` | Checks every double-quoted string in a markdown file against named source texts. Printed the results in F2 and F4 | Two known defects: quotes containing " ... " are reported NOT FOUND (its normaliser deletes the space before the dots, so the split never fires), and line numbers are one too low after the bare `>` line at brief line 8. Check elided quotes by hand or with the run 1 version |
| `S1/quote_check.py` | Run 1's checker. Handles elided quotes correctly and reports true line numbers | `python3 quote_check.py <brief.md> <rules_dir> [extra.txt ...]`. Sources are every `*.txt` in the directory plus the extras; pass CH and GH as extras |
| `S2/scripts/rsc_text.py`, `S2/scripts/rsc_dump.py`, `S2/scripts/rsc_strings.py` | Extract the text of a Next.js page from its embedded data, then render it readable. Produced CH | `rsc_text.py in.html out.txt`, then `rsc_dump.py out.txt > dump.txt` |
| `S1/live_vs_saved.py`, `S1/html2text.py`, `S1/rsc_text.py` | Run 1's earlier versions of the same tools | Superseded by the S2 versions |
| `S2/text/*.txt` (17 files) | Text of the live pages fetched Nov 14 01:47 CST (home, 2026 page, challenges index, challenge page, brand, legal, resources index, the four guides, Space Apps Connect guide with no content, partner list, Discussion #1827) plus the three challenge extractions | Read directly. The repository holds only four of these |
| `S2/text/challenge_dump.txt` | Challenge statement (lines 60 to 76) and Resources tab with link targets (lines 78 to 96) | Copy those lines into the repository's evidence folder |
| `S2/fetched2/nasa_brand_guidelines.txt`, `S2/fetched2/fortiguard_form.txt` | nasa.gov brand guidelines text; FortiGuard form text with the full category list | Read directly. Do not publish the two `fortiguard_form.html` files (encoded IP in a hidden field) |
| `S2/npm/*.json` (7 files) | npm registry `latest` records: version, licence, module type, peer dependencies | Read the `version` and `license` fields |
| `S1/live/*` | Run 1's fetches of Nov 13 21:00 CST, including `challenge_tab_18.txt` (challenge statement) and `gh_discussion_1827.txt` | Earlier snapshot of the same pages |
| SG, JG, FAQ, LEGAL | Durable verbatim copies of the four rule pages, shown equal to live twice | The line numbers in this file refer to them |
| Section 10 of this file | The fetch loops, comparison commands and lookups, verbatim | Change the `W=`, `R=` and `E=` paths |

**URLs that returned HTTP 200 to `/usr/bin/curl`** (T2 rows 81, 100, 172, 180; T1 rows 66, 90, 108, 130):

- `https://www.spaceappschallenge.org/resources/project-submission-guide/`
- `https://www.spaceappschallenge.org/resources/judging-awards-guide/`
- `https://www.spaceappschallenge.org/resources/participant-faqs/`
- `https://www.spaceappschallenge.org/resources/team-formation-guide/`
- `https://www.spaceappschallenge.org/resources/space-apps-connect-guide/` (200, but no readable content extracted)
- `https://www.spaceappschallenge.org/legal/`
- `https://www.spaceappschallenge.org/brand/`
- `https://www.spaceappschallenge.org/2026/`
- `https://www.spaceappschallenge.org/2026/challenges/dancing-with-the-sars/`
- `https://www.spaceappschallenge.org/2026/space-agency-partners/`
- `https://github.com/nasa/spaceapps/discussions/1827`
- `https://www.fortiguard.com/faq/wfratingsubmit`
- `https://www.nasa.gov/nasa-brand-center/brand-guidelines/`
- `https://openfreemap.org/`

## 8. Things tried that did not work

| Tried | Outcome |
|---|---|
| Three attempts at the rules review | None returned findings. Runs 1 and 2 ended with "You've hit your 5-hour limit"; run 3 ended at once with "You've hit your Fable limit · resets 2pm (America/Chicago). Switch to another model to continue." |
| Looking up the existing web-filter category of `github.io` (`https://www.fortiguard.com/webfilter?q=github.io&version=9`) | `403 https://www.fortiguard.com/webfilter?q=github.io&version=9 0` (T1 row 134). The category of a GitHub Pages site is unknown |
| Reading the challenge list and the resources list from their index pages | The static HTML holds only empty-state messages (T1 row 82, T2 row 92). The pages load their data from `https://api.spaceappschallenge.org/graphql`. The direct page URLs work |
| Reading the challenge page as plain text | Only the title came out (T1 row 93). The body is in embedded Next.js data; `rsc_text.py` plus `rsc_dump.py` recovered it |
| Reading the Space Apps Connect Guide | The text extraction gave 3 lines of site chrome (342 bytes). Its content was never read |
| Run 2 opening the brief at the path in its task prompt | `ls: <official-repo>/research/: No such file or directory` (T2 row 18). The folder had been moved to the pre-hackathon repository; the run found it there with identical sizes |
| Run 2's `quote_check.py` on quotes containing " ... " | Two false "NOT FOUND" results (F3) |
| `echo ==== ...` as an output separator in zsh | `(eval):16: === not found`; the rest of that command did not run (T1 row 82). Quote the separator |

## 9. Open questions the runs did not settle

1. **The local event.** Which Local Event and time zone the team is registered in; when and how local
   judging happens (the team says they present at 3:00 pm Sunday); whether the local deadline is earlier
   than 23:59; whether a live pitch has its own time limit. Only the Local Lead can answer (SG:47).
2. **Required fields.** Which of the eight fields the live form marks as required. Visible only when logged
   in after kickoff.
3. **Pre-kickoff artefacts.** Whether AI-assisted research written before kickoff (the brief,
   `research/nisar_coverage.py`, throwaway verification scripts) may be carried into the project
   repository, and how to disclose it. Run 2 was inspecting the two repositories when it was cut off. No
   organizer statement covers pre-written helper code; Space Apps Connect is the place to ask (F22).
4. **Watermarks on AI-authored graphics.** Whether a diagram drawn by AI-written code, an AI-edited video,
   or a chart of real data rendered by AI-written code counts as an SI-generated image or video that needs
   a visible watermark. The guide does not say. The cautious course is to label any illustrative graphic
   that an AI authored.
5. **OpenStreetMap data and the third-party clause.** The terms want non-NASA materials to be publicly and
   freely available with no restrictions, or OSI-licensed. OpenStreetMap data carries an attribution
   requirement under a data licence that is not an OSI software licence. Run 2 fetched OpenFreeMap's terms
   and drew no conclusion.
6. **Whether a `github.io` project site needs a FortiGuard request at all.** The guide speaks of a newly
   created website; the lookup failed with 403.
7. **The NASA Data Insignia.** NASA's guidelines mention an insignia for products that use public NASA
   data. Its rules were not fetched. Until someone reads them, use no insignia.
8. **The Space Apps logo.** The site's brand page offers logo downloads with usage rules; whether the team
   may put it in the app or demo was not examined.
9. **No second check.** None of the corrections above went through the planned skeptic pass.
10. **Rule pages since 01:47 CST Nov 14.** Not re-fetched after kickoff.

## 10. Code that worked, verbatim

Each block names the file or transcript row it came from. Paths inside the commands point at the scratch
folders of the interrupted runs; change them before reuse. Run Python with
`/opt/anaconda3/bin/python3 -I`.

### 10.1 Fetch the live pages (T2 row 99)

Printed `200` for all eleven URLs.

From transcript T2, row 99 (`<transcripts>/wf_79c71ecc-a87/agent-a26db1bb7c80457fa.jsonl`):

````bash
W="<scratch>/review/rules-and-judging-compliance"; cd "$W/fetched" && for u in "https://www.spaceappschallenge.org/2026/" "https://www.spaceappschallenge.org/2026/challenges/dancing-with-the-sars/" "https://www.spaceappschallenge.org/resources/project-submission-guide/" "https://www.spaceappschallenge.org/resources/judging-awards-guide/" "https://www.spaceappschallenge.org/resources/participant-faqs/" "https://www.spaceappschallenge.org/resources/team-formation-guide/" "https://www.spaceappschallenge.org/resources/space-apps-connect-guide/" "https://www.spaceappschallenge.org/brand/" "https://www.spaceappschallenge.org/legal/" "https://www.spaceappschallenge.org/2026/space-agency-partners/" "https://github.com/nasa/spaceapps/discussions/1827"; do n=$(echo "$u" | sed -E 's#https?://##; s#[/?&=]+#_#g'); /usr/bin/curl -sS -L -A "Mozilla/5.0 (compatible; rules-review/1.0)" --max-time 60 -o "$n.html" -w "%{http_code} %{size_download} %{url_effective}\n" "$u"; done; ls -la
````

### 10.2 `html2text.py` (from `S2/scripts/html2text.py`) and the conversion command (T2 row 103)

File: `<scratch>/review/rules-and-judging-compliance/scripts/html2text.py`

````python
"""Convert a saved HTML file to plain text (one block per line) and optionally list links.

Usage: python3 -I html2text.py <file.html> [--links]
Reads the file as data only; never executes anything from it.
"""
import sys
from html.parser import HTMLParser

BLOCK = {"p", "div", "li", "h1", "h2", "h3", "h4", "h5", "h6", "br", "tr", "section", "article",
         "header", "footer", "ul", "ol", "table", "td", "th", "blockquote", "summary", "details"}
SKIP = {"script", "style", "noscript", "svg", "template"}


class T(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out = []
        self.skip = 0
        self.links = []
        self._href = None
        self._atext = []

    def handle_starttag(self, tag, attrs):
        if tag in SKIP:
            self.skip += 1
            return
        if tag in BLOCK:
            self.out.append("\n")
        if tag == "a":
            self._href = dict(attrs).get("href")
            self._atext = []

    def handle_endtag(self, tag):
        if tag in SKIP:
            self.skip = max(0, self.skip - 1)
            return
        if tag in BLOCK:
            self.out.append("\n")
        if tag == "a" and self._href is not None:
            self.links.append((" ".join("".join(self._atext).split()), self._href))
            self._href = None

    def handle_data(self, data):
        if self.skip:
            return
        self.out.append(data)
        if self._href is not None:
            self._atext.append(data)


def main():
    path = sys.argv[1]
    want_links = "--links" in sys.argv[2:]
    with open(path, "r", encoding="utf-8", errors="replace") as fh:
        html = fh.read()
    p = T()
    p.feed(html)
    if want_links:
        for text, href in p.links:
            print(f"{href}\t{text}")
        return
    text = "".join(p.out)
    for line in text.split("\n"):
        line = " ".join(line.split())
        if line:
            print(line)


if __name__ == "__main__":
    main()
````

From transcript T2, row 103 (`<transcripts>/wf_79c71ecc-a87/agent-a26db1bb7c80457fa.jsonl`):

````bash
W="<scratch>/review/rules-and-judging-compliance"; PY=/opt/anaconda3/bin/python3; mkdir -p "$W/text"; cd "$W/fetched"; for f in *.html; do $PY -I "$W/scripts/html2text.py" "$f" > "$W/text/${f%.html}.txt"; done; wc -l -c "$W"/text/*.txt
````

### 10.3 `cmp_text.py` (from `S2/scripts/cmp_text.py`) and the comparison command (T2 row 112)

File: `<scratch>/review/rules-and-judging-compliance/scripts/cmp_text.py`

````python
"""Compare two plain-text files sentence by sentence (order-insensitive) after normalising
quotes, dashes and whitespace.

Usage: python3 -I cmp_text.py <saved.txt> <live.txt>
"""
import re
import sys


def norm(s):
    for a, b in (("’", "'"), ("‘", "'"), ("“", '"'), ("”", '"'), ("‑", "-"),
                 ("–", "-"), ("—", "-"), (" ", " ")):
        s = s.replace(a, b)
    return re.sub(r"\s+", " ", s).strip()


def sents(path):
    with open(path, encoding="utf-8", errors="replace") as fh:
        t = norm(fh.read())
    # tighten spaces before punctuation so "word ." equals "word."
    t = re.sub(r"\s+([.,;:!?)])", r"\1", t)
    parts = re.split(r"(?<=[.!?:])\s+", t)
    return [p.strip() for p in parts if len(p.strip()) > 12]


def main():
    a, b = sents(sys.argv[1]), sents(sys.argv[2])
    sa, sb = set(a), set(b)
    only_a = [x for x in a if x not in sb]
    only_b = [x for x in b if x not in sa]
    print(f"saved sentences {len(a)}, live sentences {len(b)}; only in saved {len(only_a)}, only in live {len(only_b)}")
    for x in only_a:
        print("  SAVED ONLY:", x[:500])
    for x in only_b:
        print("  LIVE ONLY :", x[:500])


if __name__ == "__main__":
    main()
````

From transcript T2, row 112 (`<transcripts>/wf_79c71ecc-a87/agent-a26db1bb7c80457fa.jsonl`):

````bash
W="<scratch>/review/rules-and-judging-compliance"; PY=/opt/anaconda3/bin/python3; E="<prehackathon-repo>/research/evidence/rules"; for p in project-submission-guide judging-awards-guide participant-faqs; do echo "=== $p"; $PY -I "$W/scripts/cmp_text.py" "$E/$p.txt" "$W/text/www.spaceappschallenge.org_resources_${p}_.txt"; done; echo "=== legal"; $PY -I "$W/scripts/cmp_text.py" "$E/legal.txt" "$W/text/www.spaceappschallenge.org_legal_.txt"
````

### 10.4 Challenge page extraction: `rsc_text.py`, `rsc_dump.py`, `rsc_strings.py` (from `S2/scripts/`)

Run as `python3 -I rsc_text.py <challenge.html> challenge_rsc.txt` (printed `16 chunks, 47433 chars`), then
`python3 -I rsc_dump.py challenge_rsc.txt > challenge_dump.txt`.

File: `<scratch>/review/rules-and-judging-compliance/scripts/rsc_text.py`

````python
"""Extract the text carried in a Next.js page's embedded flight-data chunks.

Usage: python3 -I rsc_text.py <in.html> <out.txt>
Treats the input purely as data.
"""
import json
import re
import sys


def main():
    with open(sys.argv[1], encoding="utf-8", errors="replace") as fh:
        s = fh.read()
    chunks = re.findall(r'self\.__next_f\.push\(\[1,"(.*?)"\]\)</script>', s, flags=re.S)
    out = []
    for c in chunks:
        try:
            out.append(json.loads('"' + c + '"'))
        except Exception:
            out.append(c)
    joined = "".join(out)
    with open(sys.argv[2], "w", encoding="utf-8") as fh:
        fh.write(joined)
    print(len(chunks), "chunks,", len(joined), "chars")


if __name__ == "__main__":
    main()
````

File: `<scratch>/review/rules-and-judging-compliance/scripts/rsc_dump.py`

````python
"""Dump a decoded Next.js flight-data text file as readable text: unescape one more JSON level
where possible, turn block tags into newlines, strip other tags, keep link targets inline.

Usage: python3 -I rsc_dump.py <rsc.txt>
"""
import html
import re
import sys

with open(sys.argv[1], encoding="utf-8", errors="replace") as fh:
    s = fh.read()
# undo one level of JSON escaping that remains inside the flight data
s = s.replace('\\u003c', '<').replace('\\u003e', '>').replace('\\u0026', '&').replace('\\"', '"').replace('\\n', '\n')
s = re.sub(r'<a[^>]*href="([^"]*)"[^>]*>(.*?)</a>', lambda m: f"{m.group(2)} [{m.group(1)}]", s, flags=re.S)
s = re.sub(r"<(/?)(p|h[1-6]|li|ul|ol|br|div|tr|td|th)\b[^>]*>", "\n", s)
s = re.sub(r"<[^>]+>", "", s)
s = html.unescape(s)
for line in s.split("\n"):
    line = " ".join(line.split())
    if line:
        print(line)
````

File: `<scratch>/review/rules-and-judging-compliance/scripts/rsc_strings.py`

````python
"""List long JSON string literals found in a decoded Next.js flight-data text file,
with HTML tags stripped, one block per line. Also prints link hrefs found in them.

Usage: python3 -I rsc_strings.py <rsc.txt> [minlen]
"""
import html
import json
import re
import sys


def strip_html(s):
    s = re.sub(r"<(/?)(p|h[1-6]|li|ul|ol|br|div|tr|td|th)\b[^>]*>", "\n", s)
    links = re.findall(r'<a[^>]*href="([^"]*)"[^>]*>(.*?)</a>', s, flags=re.S)
    s = re.sub(r"<[^>]+>", "", s)
    s = html.unescape(s)
    return s, [(re.sub(r"<[^>]+>", "", t), h) for h, t in links]


def main():
    path = sys.argv[1]
    minlen = int(sys.argv[2]) if len(sys.argv) > 2 else 80
    with open(path, encoding="utf-8", errors="replace") as fh:
        s = fh.read()
    seen = set()
    for m in re.finditer(r'"((?:[^"\\]|\\.)*)"', s, flags=re.S):
        raw = m.group(1)
        if len(raw) < minlen:
            continue
        try:
            val = json.loads('"' + raw + '"')
        except Exception:
            val = raw
        if val in seen:
            continue
        seen.add(val)
        if val.startswith("/_next/") or val.startswith("$") or "static/chunks" in val:
            continue
        text, links = strip_html(val)
        print("-----")
        for line in text.split("\n"):
            line = " ".join(line.split())
            if line:
                print(line)
        for t, h in links:
            print(f"   [link] {t} -> {h}")


if __name__ == "__main__":
    main()
````

### 10.5 Quote checker, run 2 (from `S2/scripts/quote_check.py`) and its command (T2 row 163)

Known defects: false NOT FOUND on quotes containing " ... "; line numbers one too low after brief line 8.

File: `<scratch>/review/rules-and-judging-compliance/scripts/quote_check.py`

````python
"""Check every double-quoted string in the brief against the source texts, word for word.

Usage: python3 -I quote_check.py <brief.md> <name=path> [<name=path> ...]

Normalises curly quotes, dashes, non-breaking characters and whitespace, and removes spaces
before punctuation (an artefact of text extraction). A quote counts as verbatim when the whole
normalised string (minus a trailing comma or full stop that the brief places inside the quote
marks) occurs in a source. Quotes containing " ... " are checked piece by piece, in order.
"""
import difflib
import re
import sys


def norm(s):
    for a, b in (("’", "'"), ("‘", "'"), ("“", '"'), ("”", '"'), ("‑", "-"),
                 ("–", "-"), ("—", "-"), (" ", " "), ("‐", "-")):
        s = s.replace(a, b)
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"\s+([.,;:!?)])", r"\1", s)
    s = re.sub(r"\(\s+", "(", s)
    return s.strip()


def best_window(needle, hay):
    """Closest region of hay to needle (rough), for reporting near-misses."""
    words = needle.split()
    if not words:
        return ""
    anchor = max(words, key=len)
    best, best_ratio = "", 0.0
    for m in re.finditer(re.escape(anchor), hay):
        start = max(0, m.start() - len(needle))
        end = min(len(hay), m.end() + len(needle))
        window = hay[start:end]
        sm = difflib.SequenceMatcher(None, needle, window, autojunk=False)
        blk = sm.find_longest_match(0, len(needle), 0, len(window))
        ratio = blk.size / max(1, len(needle))
        if ratio > best_ratio:
            best_ratio = ratio
            lo = max(0, blk.b - blk.a - 10)
            best = window[lo: lo + len(needle) + 40]
    return f"{best_ratio:.2f} :: {best}"


def main():
    brief_path = sys.argv[1]
    sources = {}
    for arg in sys.argv[2:]:
        name, path = arg.split("=", 1)
        with open(path, encoding="utf-8", errors="replace") as fh:
            sources[name] = norm(fh.read())
    with open(brief_path, encoding="utf-8") as fh:
        lines = fh.read().split("\n")

    # join the brief into one string but remember line numbers by scanning paragraph-wise
    text = "\n".join(lines)
    # drop fenced code blocks so that code strings are not treated as quotations
    text_nocode = re.sub(r"```.*?```", lambda m: "\n" * m.group(0).count("\n"), text, flags=re.S)
    # markdown quote prefix ("> ") breaks quotes that wrap over lines in the team box
    text_nocode = re.sub(r"(?m)^>\s?", "", text_nocode)
    for m in re.finditer(r'"([^"\n]*(?:\n[^"\n]*){0,3})"', text_nocode):
        q = m.group(1)
        if len(q.strip()) < 12:
            continue
        line_no = text_nocode.count("\n", 0, m.start()) + 1
        nq = norm(q)
        nq_core = nq.rstrip(",.")
        pieces = [p.strip() for p in re.split(r"\s\.\.\.\s", nq_core)]
        found_in = []
        for name, hay in sources.items():
            pos, ok = 0, True
            for p in pieces:
                i = hay.find(p, pos)
                if i < 0:
                    ok = False
                    break
                pos = i + len(p)
            if ok:
                found_in.append(name)
        status = "VERBATIM in " + ", ".join(found_in) if found_in else "NOT FOUND"
        print(f"L{line_no}: [{status}] \"{nq}\"")
        if not found_in:
            for name, hay in sources.items():
                print(f"      nearest in {name}: {best_window(nq_core, hay)}")


if __name__ == "__main__":
    main()
````

From transcript T2, row 163 (`<transcripts>/wf_79c71ecc-a87/agent-a26db1bb7c80457fa.jsonl`):

````bash
W="<scratch>/review/rules-and-judging-compliance"; PY=/opt/anaconda3/bin/python3; R="<prehackathon-repo>/research"; $PY -I "$W/scripts/quote_check.py" "$R/BUILD_PROMPT.md" "submission-guide=$R/evidence/rules/project-submission-guide.txt" "faq=$R/evidence/rules/participant-faqs.txt" "judging-guide=$R/evidence/rules/judging-awards-guide.txt" "legal=$R/evidence/rules/legal.txt" "challenge-live=$W/text/challenge_dump.txt" "go-team-1827-live=$W/text/github.com_nasa_spaceapps_discussions_1827.txt" "team-formation-live=$W/text/www.spaceappschallenge.org_resources_team-formation-guide_.txt" 2>&1 | grep -v '^      nearest in \(legal\|team-formation-live\|faq\)' | cut -c1-420
````

### 10.6 Quote checker, run 1 (from `S1/quote_check.py`)

Handles elided quotes. Run as
`python3 quote_check.py <brief.md> <dir with the four rule .txt files> [extra text files]`.

File: `<scratch>/review/rules-compliance/quote_check.py`

````python
"""Check every double-quoted string in the brief against the saved rule pages.

Usage: python3 quote_check.py <brief.md> <rules_dir> [extra_text_file ...]
Prints, per quote: which source(s) contain it verbatim (after normalising typographic
quotes, dashes and whitespace), or NOT FOUND plus the closest matching window.
"""
import difflib
import pathlib
import re
import sys


def norm(s: str) -> str:
    s = s.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    s = s.replace("‑", "-").replace("–", "-").replace("—", "-").replace(" ", " ")
    s = re.sub(r"\s+", " ", s)
    return s.strip()


def best_window(needle: str, hay: str) -> str:
    """Closest window in hay, found with a coarse word-level sliding search."""
    words = hay.split(" ")
    n = max(3, len(needle.split(" ")))
    best, best_ratio = "", 0.0
    for i in range(0, max(1, len(words) - n + 1)):
        cand = " ".join(words[i:i + n + 3])
        r = difflib.SequenceMatcher(None, needle.lower(), cand.lower()).ratio()
        if r > best_ratio:
            best, best_ratio = cand, r
    return f"{best_ratio:.2f} | {best}"


def main(brief_path, rules_dir, extras):
    brief_lines = pathlib.Path(brief_path).read_text(encoding="utf-8").splitlines()
    sources = {p.name: norm(p.read_text(encoding="utf-8")) for p in sorted(pathlib.Path(rules_dir).glob("*.txt"))}
    for e in extras:
        p = pathlib.Path(e)
        sources[p.name] = norm(p.read_text(encoding="utf-8", errors="replace"))

    # Join wrapped prose so quotes spanning line breaks are caught, but keep line numbers.
    text = "\n".join(brief_lines)
    in_code = False
    cleaned = []
    for ln in brief_lines:
        if ln.strip().startswith("```"):
            in_code = not in_code
            cleaned.append("")
            continue
        cleaned.append("" if in_code else ln)
    joined = "\n".join(cleaned)
    # line number lookup by character offset
    offsets, pos = [], 0
    for ln in cleaned:
        offsets.append(pos)
        pos += len(ln) + 1

    def line_of(off):
        lo, hi = 0, len(offsets) - 1
        while lo < hi:
            mid = (lo + hi + 1) // 2
            if offsets[mid] <= off:
                lo = mid
            else:
                hi = mid - 1
        return lo + 1

    for m in re.finditer(r'"([^"]{6,400}?)"', joined, flags=re.S):
        raw = m.group(1)
        q = norm(raw.replace("\n> ", " ").replace("\n>", " ").replace("\n", " "))
        # strip trailing punctuation that typographic convention moves inside the quotes
        q_core = q.rstrip(",.")
        parts = [p.strip() for p in q_core.split("...") if p.strip()]
        hits = {}
        for name, hay in sources.items():
            ok = all(p in hay for p in parts)
            ci = all(p.lower() in hay.lower() for p in parts)
            if ok:
                hits[name] = "verbatim"
            elif ci:
                hits[name] = "case-insensitive only"
        ln = line_of(m.start())
        if hits:
            print(f"L{ln:<4} OK   {hits}  :: {q}")
        else:
            print(f"L{ln:<4} MISS :: {q}")
            for name, hay in sources.items():
                print(f"        closest in {name}: {best_window(q_core, hay)[:260]}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3:])
````

### 10.7 Registry licence lookup (T1 row 137)

Printed the npm and PyPI lines summarised in F14. Add package names to the two lists.

From transcript T1, row 137 (`<transcripts>/wf_79c71ecc-a87/agent-ad865c59bbedd4759.jsonl`):

````bash
cd "<scratch>/review/rules-compliance" && /opt/anaconda3/bin/python3 -I - <<'EOF'
import json, urllib.request, urllib.parse
UA = {"User-Agent": "licence-check"}
def get(url):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r:
            return json.load(r)
    except Exception as e:
        return {"_error": str(e)}
print("npm:")
for p in ["maplibre-gl", "@geomatico/maplibre-cog-protocol", "geotiff", "@mapbox/mapbox-gl-sync-move", "@maplibre/maplibre-gl-compare", "vite", "react", "typescript"]:
    d = get("https://registry.npmjs.org/" + urllib.parse.quote(p, safe="@") + "/latest")
    print(f"  {p:38s} {d.get('version')}  licence={d.get('license')}  {d.get('_error','')}")
print("pypi:")
for p in ["h5py", "numpy", "scipy", "pyproj", "rasterio", "rio-cogeo", "earthaccess", "asf-search"]:
    d = get(f"https://pypi.org/pypi/{p}/json")
    info = d.get("info", {})
    lic = info.get("license_expression") or (info.get("license") or "")[:60]
    cls = [c for c in (info.get("classifiers") or []) if c.startswith("License")]
    print(f"  {p:14s} {info.get('version')}  licence={lic!r}  classifiers={cls}  {d.get('_error','')}")
EOF
````

The run 2 variant that saved the npm records and exposed the two non-OSI licences (T2 row 167):

From transcript T2, row 167 (`<transcripts>/wf_79c71ecc-a87/agent-a26db1bb7c80457fa.jsonl`):

````bash
cd <scratch>/review/rules-and-judging-compliance && mkdir -p npm && for p in "@mapbox/mapbox-gl-sync-move" "@geomatico/maplibre-cog-protocol" "maplibre-gl" "geotiff" "@maplibre/maplibre-gl-compare" "highcharts" "mapbox-gl"; do f="npm/$(echo "$p" | tr '/@' '__').json"; /usr/bin/curl -sS --max-time 40 -H "Accept: application/vnd.npm.install-v1+json" -o /dev/null -w "" "https://registry.npmjs.org/$p" ; /usr/bin/curl -sS --max-time 40 -o "$f" "https://registry.npmjs.org/$(echo "$p" | sed 's#/#%2F#')/latest"; /opt/anaconda3/bin/python3 -I -c "
import json,sys
d=json.load(open(sys.argv[1]))
print(sys.argv[2], '|', d.get('version'), '|', d.get('license'))
" "$f" "$p"; done
````

### 10.8 FortiGuard form fields (T1 row 129)

Prints the form's inputs and which are required. The saved HTML holds an encoded IP address; keep it out
of any repository.

From transcript T1, row 129 (`<transcripts>/wf_79c71ecc-a87/agent-ad865c59bbedd4759.jsonl`):

````bash
cd "<scratch>/review/rules-compliance" && code=$(/usr/bin/curl -sS -L --max-time 40 -A "Mozilla/5.0 (compatible; rules-check)" -o live/fortiguard_form.html -w "%{http_code} %{url_effective} %{size_download}" "https://www.fortiguard.com/faq/wfratingsubmit" 2>&1); echo "$code"; /opt/anaconda3/bin/python3 -I html2text.py live/fortiguard_form.html live/fortiguard_form.txt; /opt/anaconda3/bin/python3 -I - <<'EOF'
import re
s = open("live/fortiguard_form.html", encoding="utf-8", errors="replace").read()
t = open("live/fortiguard_form.txt", encoding="utf-8").read()
i = t.find("Web Filter")
print(t[:200].replace("\n", " | "))
for kw in ("Rating Request", "URL", "Email", "Name", "Company", "Category", "captcha", "Comment", "24", "hours", "business day"):
    for m in list(re.finditer(kw, t))[:3]:
        print("==", kw, "::", t[max(0, m.start()-150): m.start()+250].replace("\n", " | "))
print("form inputs:")
for m in re.finditer(r"<(input|select|textarea)\b[^>]*>", s, flags=re.I):
    tag = m.group(0)
    name = re.search(r'name="([^"]+)"', tag); typ = re.search(r'type="([^"]+)"', tag); req = "required" in tag.lower()
    print("   ", m.group(1), name.group(1) if name else None, typ.group(1) if typ else None, "required" if req else "")
print("captcha mentions:", len(re.findall(r"captcha|turnstile|hcaptcha", s, flags=re.I)))
EOF
````

### 10.9 Redirect check of resource links (T1 row 145)

From transcript T1, row 145 (`<transcripts>/wf_79c71ecc-a87/agent-ad865c59bbedd4759.jsonl`):

````bash
cd "<scratch>/review/rules-compliance" && for u in "https://www.earthdata.nasa.gov/learn/earth-observation-data-basics/remote-sensing" "https://www.earthdata.nasa.gov/learn/earth-observation-data-basics" "https://appliedsciences.nasa.gov/get-involved/training" "https://www.earthdata.nasa.gov/data/projects/arset" "https://nisar.jpl.nasa.gov/applications/arcgis-storymaps/" "https://science.nasa.gov/mission/nisar/arcgis-storymaps/" "https://nisar.jpl.nasa.gov/applications/societal-benefit/" "https://science.nasa.gov/mission/nisar/societal-benefits/"; do out=$(/usr/bin/curl -sS -L --max-time 30 -A "Mozilla/5.0 (compatible; link-check)" -o /dev/null -w "%{http_code} hops=%{num_redirects} final=%{url_effective}" "$u" 2>&1); echo "$u"; echo "    -> $out"; done
````

### 10.10 Schedule arithmetic (T2 row 210)

From transcript T2, row 210 (`<transcripts>/wf_79c71ecc-a87/agent-a26db1bb7c80457fa.jsonl`):

````bash
/opt/anaconda3/bin/python3 -I -c "
from datetime import datetime, timedelta
k = datetime(2026,11,14,9,0)
d = datetime(2026,11,15,23,59)
print('kickoff weekday', k.strftime('%A'), '| deadline weekday', d.strftime('%A'))
print('deadline - kickoff =', d-k, '=', (d-k).total_seconds()/3600, 'h')
for h in (1,3,8,10,14,20,22,24,26,30,36,39):
    print(f'H{h:>2} =', (k+timedelta(hours=h)).strftime('%A %H:%M'))
"
````

### 10.11 Run 1's saved-versus-live comparison (from `S1/live_vs_saved.py`, command at T1 row 115)

Same method as 10.3, kept because its output is the Nov 13 evidence in F1.

File: `<scratch>/review/rules-compliance/live_vs_saved.py`

````python
"""Compare the saved rule pages with the live fetch, sentence by sentence, order-insensitive.
Usage: live_vs_saved.py <saved.txt> <live.txt>"""
import re, sys
def norm(s):
    s = s.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    s = s.replace("‑", "-").replace("–", "-").replace("—", "-").replace(" ", " ")
    return re.sub(r"\s+", " ", s).strip()
def sents(path):
    t = norm(open(path, encoding="utf-8", errors="replace").read())
    parts = re.split(r"(?<=[.!?:])\s+", t)
    return [p.strip() for p in parts if len(p.strip()) > 12]
a, b = sents(sys.argv[1]), sents(sys.argv[2])
sa, sb = set(a), set(b)
only_saved = [x for x in a if x not in sb]
only_live = [x for x in b if x not in sa]
print(f"saved sentences {len(a)}, live sentences {len(b)}; only in saved {len(only_saved)}, only in live {len(only_live)}")
for x in only_saved[:40]:
    print("  SAVED ONLY:", x[:300])
for x in only_live[:40]:
    print("  LIVE ONLY :", x[:300])
````

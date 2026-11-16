# Our concept

## Before the Smoke

**In one sentence:** Before the Smoke shows, one radar pass at a time, which rice fields in Punjab NISAR has
seen harvested, and checks NASA's fire detections to see whether the stubble fires follow, so the teams that
run Punjab's straw machines can send them where the harvest happened this week.

**First line of the pitch:** "Punjab's fields dance twice a year: wheat in winter, rice in the monsoon. The
second dance ends in fire."

## Our concept

- **Place or places:** southern Tarn Taran district, Punjab, India, from Patti to the Harike wetland; the
  box reaches across the Sutlej river into Ferozepur district.
  - Box `[74.78, 31.08, 75.08, 31.34]` (west, south, east, north), about 29 × 29 km. Site id `tarn-taran`.
  - Tarn Taran had more farm fires than any other Punjab district in 2026: 676 by 10 November.
  - Checked: all four corners are inside stack 156_A_017 on all 26 dates and inside stack 084_A_017 on all
    16. A box centred on Tarn Taran town fails: its north corners are outside the frame on up to 22 of the
    26 dates. Confirm with `discover`.
- **The change we want to show there, and over what dates:**
  - Stack 156_A_017 (checked): HH and HV, 40+5 MHz (10 m pixels), a full frame on every date, passes at
    00:13 UTC (05:43 local time). 24 provisional dates from 2025-11-21 to 2026-10-11, then validated dates
    on 2026-10-23 and 2026-11-04. Missing passes: 2026-02-13, 04-02, 04-14 and 07-31 (the archive's gap);
    the app shows them as missing.
  - That is a full farm year: wheat from November to April, the paddies flooded for transplanting in June,
    the rice growing, and the rice harvest.
  - **The change we analyse:** the rice harvest across four passes, 29 Sep → 11 Oct → 23 Oct → 4 Nov 2026.
  - **The independent check:** NASA FIRMS fire detections (VIIRS, 375 m pixels), 15 Sep to 14 Nov 2026.
  - **Mixed release:** the series switches from provisional to validated data between 11 and 23 October.
    The site lists both releases, the app labels the site "mixed", and we check that a stable target (Patti
    town) does not jump across that boundary (`docs/TASKS.md`, T4).
  - **Stretch goal:** stack 084_A_017 (checked: HH and HV, 40+5 MHz, full frames; provisional to
    2026-10-18, validated on 2026-10-30 and 11-11) adds passes on 6, 18 and 30 October and 11 November: a
    look every 5 to 7 days through the harvest, and one 3 days after Diwali. It would be a second site in
    the app. The two stacks are never differenced; only their harvest dates are compared.
- **Why it matters and who it is for:**
  - Farmers have two to three weeks between the rice harvest and sowing wheat, and burning is the cheapest
    way to clear the straw. Punjab reported about 5,500 farm fires by 11 November 2026, already more than in
    all of 2025, including 1,152 on Diwali (8 November) alone.
  - The smoke reaches Punjab's own villages first and adds to Delhi's: stubble smoke was about 14 % of
    Delhi's PM2.5 on average over 1 to 8 November 2026 (IITM data, analysed by CSE), one source among
    several.
  - Machines that make burning unnecessary exist (Super Seeders, balers), but every farmer needs them in the
    same two weeks. The satellite signal in use today is the fire count, which arrives after the fire. It
    may also miss fires lit after the early-afternoon satellite passes; ISRO researchers reported this, and
    others dispute it.
  - **For:** district crop-residue officers and the custom-hiring centres that rent out machines, deciding
    where machines go next week; pollution-board field teams planning outreach; reporters and researchers
    explaining the smoke season; teachers.
  - **What they do differently:** act on the area NISAR saw harvested about two days earlier, not on
    yesterday's fires. Checked: routine NISAR products appeared in NASA's catalog 47 to 61 hours after each
    pass (the passes of 24 and 29 September, 6, 11 and 18 October, and 11 November). The 4 November pass
    appeared only on 8 November, because production paused from 23 October to 6 November.
- **What a visitor should understand or be able to do after two minutes:**
  1. Press play and watch a year of this district in 12-day steps.
  2. Click any spot and see its year as a curve with two humps: the two dances.
  3. Open the Harvest Wave map: when each 100 m cell was harvested, and how much rice still stood on
     4 November.
  4. Turn on the fires and read one number: how dense the fires are in the newest harvest, compared with
     older harvest and standing rice.

  The takeaway: the harvest calendar is the fire calendar, and radar sees the harvest through smoke and
  before dawn.
- **What ours adds that NASA Worldview does not:** Worldview shows NISAR pictures with a time slider. Ours
  adds measured backscatter in dB and the year's curve for any spot; a harvest map with its threshold and
  false-alarm rate published; the link to NASA's fire record, set up as a test that could fail; the measured
  two-day delay, which is what makes the map usable for decisions; and plain explanations written for a
  named user.
- **Local or personal context we will add:** if a teammate has family or friends in Punjab, Haryana or
  Delhi, their story is the first line of the pitch. Otherwise: the 2009 groundwater laws, which pushed rice
  transplanting later, and with it the harvest and the burning into November, when the air stagnates
  (Balwinder-Singh et al., Nature Sustainability, 2019). And NISAR is a joint NASA and ISRO satellite: an
  Indian problem, seen by a satellite both agencies built and checked against NASA's fire data.
- **Features we want.** Only two things are new to build; the rest already exists or is the first to cut.
  - [x] interactive change-detection map: the Harvest Wave layer (new; one class per harvest window, a
        `categorical-uint8` static layer)
  - [x] time-series animation: the year in 26 steps (the date stepper exists; add a play button)
  - [ ] dashboard: not needed
  - [ ] image slider (before / after): swipe 29 September against 4 November (a tested stub exists).
        **Second to cut.**
  - [x] web map (exists)
  - [x] story map: four guided steps (two dances → the June flood → the harvest wave → the fires), then
        free exploration. **First to cut.**
  - [x] other: NASA FIRMS fire overlay and one chart, "fires after harvest" (new)
- **The three questions the challenge asks every team**:
  - *What physical drivers do we think are behind what we see, or do not see, in the radar data?* What we
    expect: while rice grows in standing water, the radar bounces off the water and then off the stems, so
    HH rises; as the leaves fill in, HV rises. At transplanting, flooded fields reflect the radar away like
    a mirror: the darkest passes of the year. The combine removes leaves and stems, so both drop within one
    pass. Wheat brings a second rise from December to March. Human drivers: legal transplanting dates,
    short-duration rice varieties, combines that leave loose straw, the short window, too few machines,
    festival timing. What we do not see: the smoke, which radar passes through, and the flames, which come
    and go between passes.
  - *Which polarizations highlight these changes?* HH shows the water-and-stem double bounce and the June
    flood; HV shows the leafy canopy. We expect draining a field before harvest to lower HH while HV holds,
    and the harvest to lower HV. So HV marks the harvest.
  - *What future applications of NISAR are possible?* A weekly harvest outlook for scheduling machines, from
    NISAR's two-day products; with IITM's smoke forecasts, where and when smoke will start; tracking wheat
    sowing and straw removal; testing whether burned and unburned stubble look different to the radar,
    which would let burned fields be counted whatever hour they burned; crop calendars wherever monsoon
    clouds block optical satellites.
- **Project name and tagline:** **Before the Smoke.** "NISAR sees Punjab's rice harvest through haze and
  before dawn. Can that get straw machines to the fields before the fires?"

## How we test it, and what would prove us wrong

- **Hypothesis 1: the harvest is visible.** On 100 m cells (10 × 10 pixels, averaged in linear power), a
  harvested rice cell shows a drop in HV larger than a threshold between two passes. The threshold comes from
  this site's own data: no more than 2 % of cells on stable ground (Patti town, orchards, canal banks) may
  cross it between any two passes. Rice cells are those dark from flooding on at least one pass from 13 June
  to 19 July and bright with canopy by late September. Prediction: the harvested share rises across the four
  passes towards the state's reported progress (press reports of state data gave 85 %, then 94 %, of the
  rice area harvested in early to mid November; the dates still need confirming). **Wrong if** rice cells
  change no more than stable ground does.
- **Hypothesis 2: the fires follow the harvest.** From 5 to 14 November (Diwali included), fires are densest
  where the 4 November map shows harvest since 23 October, less dense where the harvest came before
  11 October (probably sown with wheat by then), and least dense where rice was still standing. Repeat the
  test for the two earlier windows. **Wrong if** the densities do not differ by more than their
  uncertainty. This is a hindcast, not a forecast: the radar data were recorded before the fires, but our
  analysis is done afterwards.
- **Independent checks:** NASA FIRMS fire detections (VIIRS on Suomi NPP, NOAA-20 and NOAA-21); optical HLS
  imagery on NASA GIBS, for spot checks; Punjab's harvest-progress figures; the district's official rice
  area, to check the rice mask.
- **Limits we state on screen:** 12 days between looks (6 with the second stack); a 100 m cell covers
  several fields, and a fire pixel is 375 m wide; fire counts may miss evening fires; the series mixes two
  releases; only one season, so there is no earlier NISAR year to compare with; a hindcast, not a forecast.
- **We map land, not farmers:** no names, no land records. The intended use is sending machines and advice,
  not penalties.

## Risks, and the test that settles the main one by Saturday 19:00

1. **How strong the harvest signal is over rice.** Published L-band studies report backscatter falling from
   maturity to harvest, but none found so far measures how big the drop is. Right after Gate A, compare
   29 September with 4 November on 100 m cells: rice cells should fall by several dB more than Patti town.
   If they do not, either tell the year (the two dances) and show the fires as description only, or move to
   Champaign, Illinois: stacks 148_A_022 and 084_D_068 (checked: quad-pol, full frames; place the box
   between the black gap bands), with USDA's weekly harvest progress as the check and the same harvest code.
2. **The release boundary between 11 and 23 October.** Compare Patti town on all four passes and report any
   jump. If it is more than 1 dB, raise the threshold for that pair of passes and say so on screen.
3. **The fire data needs a free FIRMS key** (`docs/TEAM_CHECKLIST.md`, item 2). The FIRMS area API takes a
   bounding box and at most 5 days per request.
4. **Read time** (estimated, not measured): 10 m pixels are 3 to 4 times the data of the 20 m test window
   that took about 20 s, so about a minute per date and roughly 30 minutes for all 26. Start with the
   4 harvest passes and the 4 passes of June and July.

## 30-second video

1. The year plays: "Punjab's fields dance twice a year."
2. The harvest wave builds pass by pass: "In October the rice comes off, and a two-week clock starts."
3. The fires appear: "NASA's fire satellites see the fires. NISAR saw the harvest first."
4. The result of Hypothesis 2, the site URL and the data credit. Take that number from the analysis; do not
   script it before it exists.

## Sources for the facts above

Found through web searches on 14 November 2026. Check them before quoting them on the project page, and add
the ones we use to `docs/SOURCES.md`.

- Farm fires in 2026: [ThePrint/PTI, 5,517 cases](https://theprint.in/india/punjab-stubble-burning-cases-rise-to-5517-1259-firs-registered/3096778/);
  [ThePrint/PTI, district counts on 10 November](https://theprint.in/india/punjab-records-345-fresh-farm-fires/3095525/);
  [DD News, 1,152 fires on Diwali](https://ddnews.gov.in/en/punjab-records-1152-farm-fires-on-diwali-highest-single-day-surge-this-season/).
  Outlets differ on the exact totals.
- Delhi's PM2.5 sources, 1 to 8 November 2026: [CSE's analysis of IITM data](https://www.cseindia.org/cse-releases-early-winter-post-diwali-air-pollution-analysis-for-delhi-ncr-13335).
- The 2009 groundwater laws and November burning: [Balwinder-Singh et al. 2019, Nature Sustainability](https://www.nature.com/articles/s41893-019-0304-4).
- Fires lit after the afternoon passes: [ThePrint on the ISRO study](https://theprint.in/environment/are-farm-fires-going-uncounted-isro-study-suggests-farmers-have-figured-out-a-way-to-evade-satellites/2797583/)
  and [the dispute](https://theprint.in/environment/farmers-outwitting-satellite-detection-images-show-stubble-burning-peak-post-afternoon-hours/2359525/).
- [NASA FIRMS area API](https://firms.modaps.eosdis.nasa.gov/api/area/).
- Fallback check: [USDA NASS Illinois crop progress reports](https://www.nass.usda.gov/Statistics_by_State/Illinois/Publications/Crop_Progress_&_Condition/).
- L-band rice, leads found by search and not read in full: [JAXA ALOS proceedings](https://www.eorc.jaxa.jp/ALOS/conf/Proc_PIsymp2007/contents/proceedings/Agriculture/AGR05.pdf);
  [Remote Sensing 18(2):370](https://doi.org/10.3390/rs18020370).
- The facts marked "checked" (coverage, dates, frame corners, delays): queries of NASA's public catalog
  (CMR) on 14 November.

## Logistics
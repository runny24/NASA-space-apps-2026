// The About panel. Its text was written with AI and checked by a teammate on 15 November 2026.
// The numbers were checked on 14 November 2026 against docs/METHODS.md (sections 4 to 6), the
// published stats.json and site.json, the optical cross-check's limit against its part of section 6
// ("Optical cross-check", added in commit 50da4da), and AI_USE.md for the AI block; what the
// repository did not support was taken out, not adjusted.
// A native <dialog> opened with showModal() gives focus trapping, Escape to close and a backdrop
// for free, which keeps it keyboard-accessible without extra code; on closing, the browser also
// returns focus to the button that opened it. The folds are native <details>, which open with
// Enter and Space.

import { useEffect, useRef, type ReactNode, type Ref } from 'react';

export const REPOSITORY_URL = 'https://github.com/runny24/NASA-space-apps-2026';

/** The three questions the challenge asks every team, word for word, in the order it asks them. */
export const CHALLENGE_QUESTIONS = [
  'What physical drivers are behind what we see, or do not see, in the radar data?',
  'Which polarizations highlight these changes?',
  'What future applications of NISAR are possible?',
] as const;

/** What the closed disclosure of the harvest map's method says. */
export const METHOD_FOLD_SUMMARY = 'The method in five steps';

/** One block of the panel's text. `id` names the block for the tests. */
function Block(props: { id: string; children: ReactNode }) {
  return (
    <div className="about-block" data-block={props.id}>
      {props.children}
    </div>
  );
}

const ANSWERS: readonly ReactNode[] = [
  <p key="drivers">
    Hypotheses. The site&apos;s mean HH rises twice: with the wheat, December to March, and more strongly with the rice, from
    August. Between them: a low in late April and a dip at the late-June flood. Flooded fields may mirror the radar away; rice
    in water may bounce it off water and stems. From 29 September to 4 November many rice cells fell sharply and Patti town
    almost never did: consistent with the cut. Much harvest went unseen: perhaps a strict threshold, mixed cells or straw left
    lying.
  </p>,
  <p key="polarizations">
    The concept expected HV to mark the harvest; which one does is not settled. In the harvest analysis HH dated harvests to
    every pair of passes from 29 September, HV mostly to the last pair. The fire test could not tell them apart (HH left
    68.4&nbsp;% of the fire weight on rice it still called not harvested, HV 72.2&nbsp;%), so the rule&apos;s fallback
    chose HV. Untested: HH may mark the cutting and HV what follows, or HH the draining and HV the harvest. The rice mask uses
    HH.
  </p>,
  <p key="future">
    Possibilities, none tested. A harvest map made soon after each pass could help send straw machines where the rice came
    off, if it missed far less harvest than ours. Passes from a second NISAR track could shorten the 12 days between looks.
    Radar might tell burned from unburned stubble, counting burns at any hour. It could track wheat sowing, straw removal and
    crop calendars under monsoon cloud. That fires follow the harvest was not supported here for 5 to 14 November, for this
    map at this scale.
  </p>,
];

export function AboutDialog(props: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (props.open && !dialog.open) {
      dialog.showModal();
      // showModal() focuses the first control, which may sit far down a long text: on a phone that
      // opens the dialog scrolled past its own title. Start at the title; Tab still reaches the
      // folds, the link and the Close button.
      title.current?.focus();
    }
    if (!props.open && dialog.open) dialog.close();
  }, [props.open]);
  return (
    <dialog ref={ref} className="about" aria-labelledby="about-title" onClose={props.onClose}>
      {/* The text is in the page only while the panel is open, so that its words are never found in
          the page behind it. */}
      {props.open && <AboutText ref={title} />}
    </dialog>
  );
}

/** The panel's text; `ref` goes to its title, which takes the focus when the panel opens. */
function AboutText({ ref }: { ref: Ref<HTMLHeadingElement> }) {
  return (
    <>
      <h2 id="about-title" ref={ref} tabIndex={-1}>
        About
      </h2>
      <section>
        <h3>What this is</h3>
        <Block id="what">
          <p>
            A year of NISAR radar, November 2025 to November 2026, over rice and wheat fields in southern Tarn Taran and part of
            Ferozepur district, Punjab. The Harvest wave map shows between which two passes, from 29 September 2026 on, each
            100&nbsp;m rice cell&apos;s HV signal first fell sharply. Our first result: the map misses much of the harvest, and
            its harvest dates do not sort NASA&apos;s fire detections.
          </p>
        </Block>
      </section>
      <section>
        <h3>The challenge&apos;s three questions</h3>
        {CHALLENGE_QUESTIONS.map((question, i) => (
          <details key={question} className="about-fold about-question">
            <summary>{question}</summary>
            <Block id={`question-${i + 1}`}>{ANSWERS[i]}</Block>
          </details>
        ))}
      </section>
      <section>
        <h3>How the harvest map is made</h3>
        <details className="about-fold about-method">
          <summary>{METHOD_FOLD_SUMMARY}</summary>
          <Block id="method">
            <ol>
              <li>
                Rice: 100&nbsp;m cells whose HH rose by at least 7.40&nbsp;dB from the June and July flood to the late-August
                and September canopy.
              </li>
              <li>Change: each cell&apos;s fall between consecutive passes, 17 September to 4 November 2026.</li>
              <li>
                Threshold: the stricter of two thresholds set at a 2&nbsp;% false-alarm rate, on Patti town in any pair and on
                standing rice from 17 to 29 September (HH 3.52&nbsp;dB, HV 1.59&nbsp;dB).
              </li>
              <li>
                Harvest pair: the first pair from 29 September with a fall past it. HV draws the map: the fire test could not
                tell HH from HV, so the rule&apos;s fallback chose it (our log records the rule as fixed before any fire data
                was analysed).
              </li>
              <li>Fires: NASA FIRMS detections per km² on each class of the map, with 95&nbsp;% intervals.</li>
            </ol>
          </Block>
        </details>
      </section>
      <section>
        <h3>Limits</h3>
        <Block id="limits">
          <ul>
            <li>
              The map misses much of the harvest: &ldquo;no harvest seen&rdquo; means the radar saw no sharp fall, not that the
              rice was still standing.
            </li>
            <li>One look every 12 days, from two data releases; missing passes stay missing.</li>
            <li>A 100&nbsp;m cell covers several fields; a fire pixel is nominally 375&nbsp;m wide.</li>
            <li>Fire counts may miss fires between satellite passes.</li>
            <li>One season only: no earlier NISAR year to compare.</li>
            <li>A hindcast, not a forecast: radar recorded before the fires, analysed afterwards.</li>
            <li>The rice mask has not been checked against official rice area.</li>
            <li>
              Pictures are for looking; numbers come from the click readout; a point&apos;s history is a mean over a coarser
              cell. Dates are UTC.
            </li>
            <li>
              An optical check on Copernicus Sentinel-2 data suggests that about half to four fifths of the cells the harvest map
              calls &ldquo;no harvest seen&rdquo; had lost their green by 4 November; three of its dates look hazy, and greenness
              alone cannot tell a cut field from a ripe one.
            </li>
          </ul>
        </Block>
      </section>
      <section>
        <h3>Data and credits</h3>
        <Block id="credits">
          <p>
            NISAR data courtesy NASA/JPL-Caltech and ISRO, distributed by the Alaska Satellite Facility DAAC. Fire detections:
            NASA FIRMS (VIIRS); FIRMS&apos;s full acknowledgement is in the legend while the fire detections are switched on.
            The optical cross-check used Copernicus Sentinel-2 data (ESA): contains modified Copernicus Sentinel data 2026.
            Basemap: OpenFreeMap &copy; OpenMapTiles Data from OpenStreetMap. This project is not affiliated with or endorsed by
            NASA.
          </p>
        </Block>
      </section>
      <section>
        <h3>How AI was used</h3>
        <Block id="ai">
          <p>
            We used Claude (Anthropic) in Claude Code, with the models Claude Fable 5.2 and Claude Opus 5.5, as an engineering
            assistant: before the event to research NISAR data access; during it to write and review the pipeline, this app and
            the documentation, to run the analyses and to find the official harvest figures. No image, video or audio is
            AI-generated. AI_USE.md in the project&apos;s repository is the running record.
          </p>
        </Block>
      </section>
      <p>
        Source code (Apache-2.0):{' '}
        <a href={REPOSITORY_URL} target="_blank" rel="noreferrer">
          {REPOSITORY_URL}
        </a>
      </p>
      <form method="dialog">
        <button type="submit">Close</button>
      </form>
    </>
  );
}

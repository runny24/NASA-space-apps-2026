// The story panel (docs/MOTION_AND_STORY_BRIEF.md, section 7.5). On a desktop it takes exactly the
// place of the side column, which stays in the page under it, asleep (inert); on a phone it takes the
// place of the panels under the map. A solid dark surface, so the contrast of its text never depends
// on the map.
//
// What it always keeps in view, because these are honest states (web/MOTION.md, rule 11): the site's
// data credit, the mixed-release warning on every step of a mixed-release site, the cover included
// and whatever the layer (a static layer of such a site, such as a harvest map, is itself built by
// comparing passes of both releases, and the tool's own warning is asleep under the panel), and, for
// an overlay that is on, its caption, the sentence that it is not a NISAR measurement and its credit
// in full (the legend that normally carries them is asleep under the panel).
//
// The navigation bar is outside the block keyed by the step's id, so Next is the same element from
// step to step and keeps the focus (Enter and Space keep working).

import type { CSSProperties, ReactNode } from 'react';
import { BRANDING } from '../branding';
import type { Layer, Site, StoryStep } from '../contract/manifest';
import { OverlayDot } from '../components/Overlays';
import { MIXED_RELEASE_WARNING } from '../components/StatsPanel';
import { OVERLAY_NOT_NISAR } from '../state/overlayPeriod';
import type { OverlayView } from '../state/overlayView';
import { StoryProgress } from './StoryProgress';
import { coverEyebrow, coverFigures, stepCount, storyParagraphs } from './storyModel';
import type { SequenceControl } from './useStory';

/**
 * A title as words for the cover, each in a span.story-word that carries its index as --i (the delay
 * of its rise, story.css). The white space between the words stays text, exactly as in the title, so
 * the heading reads, wraps and copies as one sentence and its textContent is the title.
 */
export function TitleWords(props: { text: string }) {
  // Split with a capture group: words at the even places, the white space between them at the odd.
  return props.text.split(/(\s+)/).map((part, k) =>
    k % 2 === 1 ? (
      part
    ) : part === '' ? null : (
      <span key={k} className="story-word" style={{ '--i': k / 2 } as CSSProperties}>
        {part}
      </span>
    ),
  );
}

/** A step's text, as React text (never HTML), one paragraph per blank-line-separated block. */
export function StoryText(props: { text: string; className: string }) {
  return (
    <div className={props.className} data-testid="story-text">
      {storyParagraphs(props.text).map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}

/** The cover's real figures, from the manifest, as plain numerals (they never count up). */
function CoverFigures(props: { site: Site }) {
  const figures = coverFigures(props.site);
  if (figures.length === 0) return null;
  return (
    <ul className="story-figures" data-testid="story-figures">
      {figures.map((f) => (
        <li key={f.label}>
          <span className="story-figure-value">{f.value}</span> <span className="story-figure-label">{f.label}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * What the step's data offers beside the words, chosen by what is on the map, never by the step's
 * id: the classes of a layer with classes; for each overlay that is on, its caption (the same view the
 * map's filter uses), its credit in full, and once the sentence that it is not a NISAR measurement.
 * Nothing otherwise. First, for a per-date layer with a dB series, the year's curve (StoryCurve.tsx).
 */
function StepFigure(props: { layer: Layer | null; overlayViews: readonly OverlayView[]; curve: ReactNode }) {
  const { layer, overlayViews, curve } = props;
  const classes = layer?.kind === 'static' && layer.encoding.type === 'categorical-uint8' ? layer.encoding.classes : null;
  if (!classes && overlayViews.length === 0 && !curve) return null;
  return (
    <div className="story-figure" data-testid="story-figure">
      {curve}
      {classes && layer && (
        <ul className="story-classes" aria-label={`Classes of ${layer.title}`}>
          {classes.map((c) => (
            <li key={c.value}>
              <span className="story-swatch" style={{ background: c.color }} aria-hidden="true" />
              {c.label}
            </li>
          ))}
        </ul>
      )}
      {overlayViews.map((v) => (
        <div key={v.overlay.id} className="story-overlay" data-overlay={v.overlay.id}>
          <p className="story-overlay-caption">
            <OverlayDot color={v.color} />
            {v.caption ?? `${v.overlay.title}: could not be loaded, so nothing is drawn.`}
          </p>
          <p className="story-overlay-credit">Credit: {v.overlay.credit}</p>
        </div>
      ))}
      {overlayViews.length > 0 && <p className="story-overlay-note">{OVERLAY_NOT_NISAR}</p>}
    </div>
  );
}

export interface StoryPanelProps {
  /** Pending: the manifest is not here yet, so the panel says only that it is loading. */
  pending: boolean;
  site: Site | null;
  steps: readonly StoryStep[];
  index: number;
  /** The layer on the map (the step's). */
  layer: Layer | null;
  /** The overlays on the map, as the map draws them. */
  overlayViews: readonly OverlayView[];
  /** The year's curve of the layer on the map (StoryCurve.tsx), or null; never shown on the cover. */
  curve?: ReactNode;
  /** A desktop: the cover's eyebrow, title, text and buttons are on the map (StoryCover). */
  coverOnMap: boolean;
  /** The step's sequence button (play, pause, go on, play again), or null when the step is a cut. */
  control: SequenceControl | null;
  onControl: () => void;
  onNext: () => void;
  onBack: () => void;
  onGoTo: (index: number) => void;
  onExit: () => void;
}

export function StoryPanel(props: StoryPanelProps) {
  const { site, steps, index, layer } = props;
  const step = steps[index];
  if (props.pending || !site || !step) {
    return (
      <section className="story-panel" aria-label="Story" aria-busy="true" data-testid="story-panel">
        <p className="story-eyebrow">{BRANDING.name}</p>
        <p className="story-loading">Loading…</p>
      </section>
    );
  }
  const isCover = index === 0;
  // On a desktop the cover's words and buttons are on the map; the panel beside it keeps the rest.
  const wordsOnMap = isCover && props.coverOnMap;
  const last = index === steps.length - 1;
  const credit = site.source.citation ?? site.source.product;
  // Every step of a mixed-release site, whatever the layer: a static layer of it compares passes too.
  const warn = site.source.release === 'mixed';
  return (
    <section className="story-panel" role="region" aria-labelledby="story-step-title" data-testid="story-panel">
      <div className="story-top">
        <StoryProgress steps={steps} index={index} onGoTo={props.onGoTo} />
        {/* Small, at the top right, on every step; on the cover it is in the bar at the foot instead. */}
        {!isCover && (
          <button type="button" className="story-quiet story-exit" data-testid="story-exit" onClick={props.onExit}>
            Explore the map
          </button>
        )}
      </div>
      <div className="story-step" key={step.id}>
        {!wordsOnMap && (
          <p className="story-eyebrow" data-testid="story-eyebrow">
            {isCover ? coverEyebrow(site) : stepCount(index, steps.length)}
          </p>
        )}
        {!wordsOnMap && (
          <>
            <h2 id="story-step-title" className={isCover ? 'story-title story-title-cover' : 'story-title'} tabIndex={-1} data-testid="story-title">
              {isCover ? <TitleWords text={step.title} /> : step.title}
            </h2>
            {/* Right under the title, so it is in view without scrolling however long the text is
                (on a phone the panel's end is far below the first screen). */}
            {warn && (
              <p className="story-warning" data-testid="story-warning">
                {MIXED_RELEASE_WARNING}
              </p>
            )}
            <StoryText className="story-text" text={step.text} />
          </>
        )}
        {/* On a step with a sequence, always: what is on the map, in words (the place of the picture drawn,
            or the days shown). While that has no words (a file still loading), its row stays, empty and
            hidden, so nothing under it moves. */}
        {props.control &&
          (props.control.progress ? (
            <p className="story-sequence" data-testid="story-sequence">
              {props.control.progress}
            </p>
          ) : (
            <p className="story-sequence story-sequence-empty" data-testid="story-sequence-empty" aria-hidden="true">
              {'\u00a0'}
            </p>
          ))}
        {isCover && <CoverFigures site={site} />}
        <StepFigure layer={layer} overlayViews={props.overlayViews} curve={isCover ? null : props.curve} />
        {/* The desktop cover's title is on the map: here the warning follows the figures, in view. */}
        {warn && wordsOnMap && (
          <p className="story-warning" data-testid="story-warning">
            {MIXED_RELEASE_WARNING}
          </p>
        )}
      </div>
      <p className="story-credit" data-testid="story-credit">
        Data: {credit}
      </p>
      {/* Each slot keeps its element from step to step (Start becomes Next), so focus stays on it. */}
      {!wordsOnMap && (
        <div className="story-nav">
          {isCover ? (
            <button type="button" className="story-quiet story-exit" data-testid="story-exit" onClick={props.onExit}>
              Explore the map
            </button>
          ) : (
            <button type="button" className="story-quiet" data-testid="story-back" onClick={props.onBack}>
              Back
            </button>
          )}
          {/* Between Back and Next, in a slot of its own, so Next stays the same element. */}
          {props.control && !isCover ? (
            <button type="button" className="story-quiet story-play" data-testid="story-play" data-action={props.control.action} onClick={props.onControl}>
              {props.control.label}
            </button>
          ) : null}
          {isCover ? (
            <button type="button" className="story-cta" data-testid="story-start" data-story-primary="" onClick={props.onNext}>
              Start the story
            </button>
          ) : (
            <button type="button" className="story-cta" data-testid="story-next" data-story-primary="" onClick={props.onNext}>
              {last ? 'Explore the map' : 'Next'}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

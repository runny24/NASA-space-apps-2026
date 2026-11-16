// The cover on a desktop: a dark scrim over the map, inside .map-wrap at the stacking level of the
// notes, so MapLibre's corners stay above it and its credit line stays readable and clickable. It
// carries the eyebrow (the place and the period, from the data), the first step's title, its text
// and the two ways on. The story panel beside it carries the figures and the credit.
// On a phone there is no scrim: the panel below the map carries everything.
//
// Pending (the manifest is not here yet): the same surface from the first frame, with the app's name
// and a quiet "Loading…", so the tool never flashes before the cover.

import { BRANDING } from '../branding';
import type { Site, StoryStep } from '../contract/manifest';
import { coverEyebrow } from './storyModel';
import { StoryText, TitleWords } from './StoryPanel';

export function StoryCover(props: { site: Site | null; step: StoryStep | null; onStart: () => void; onExit: () => void }) {
  const { site, step } = props;
  return (
    <div className="story-cover" data-testid="story-cover">
      <div className="story-cover-block">
        {site && step ? (
          <>
            <p className="story-eyebrow" data-testid="story-eyebrow">
              {coverEyebrow(site)}
            </p>
            <h2 id="story-step-title" className="story-cover-title" tabIndex={-1} data-testid="story-title">
              <TitleWords text={step.title} />
            </h2>
            <StoryText className="story-cover-text" text={step.text} />
            <div className="story-cover-actions">
              <button type="button" className="story-cta" data-testid="story-start" data-story-primary="" onClick={props.onStart}>
                Start the story
              </button>
              <button type="button" className="story-quiet story-exit" data-testid="story-exit" onClick={props.onExit}>
                Explore the map
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="story-cover-title">{BRANDING.name}</p>
            <p className="story-loading">Loading…</p>
          </>
        )}
      </div>
    </div>
  );
}

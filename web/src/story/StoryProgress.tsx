// One segment per step of the story, each a button that goes to its step; the current one is amber
// and taller (a shape, not only a colour) and carries aria-current="step". The steps ahead carry a
// class of their own, so they can be drawn dimmer than the steps behind (story.css).

import type { StoryStep } from '../contract/manifest';
import { stepCount } from './storyModel';

export function StoryProgress(props: { steps: readonly StoryStep[]; index: number; onGoTo: (index: number) => void }) {
  const { steps, index } = props;
  return (
    <ol className="story-progress" data-testid="story-progress" aria-label="Steps of the story">
      {steps.map((s, i) => (
        <li key={s.id}>
          <button
            type="button"
            className={i > index ? 'story-progress-step story-progress-ahead' : 'story-progress-step'}
            aria-current={i === index ? 'step' : undefined}
            aria-label={`${stepCount(i, steps.length)}: ${s.title}`}
            onClick={() => props.onGoTo(i)}
          >
            <span className="story-progress-mark" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ol>
  );
}

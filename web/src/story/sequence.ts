// What plays when the story arrives at a step: the passes in between, one real picture after
// another (the flip-book), and then the overlays that build up one real day at a time
// (docs/MOTION_AND_STORY_BRIEF.md, section 7.3, rules 3 and 4; web/MOTION.md, rule 4). Pure
// functions over a step's plan (story/storyModel.ts, planStep); story/useStory.ts holds the timers
// and waits for the map.
//
// Every state a sequence passes through is real and says on screen what it is:
// - a frame of the flip-book is one acquisition of the step's layer, named by the stamp once the map
//   has drawn it (never a blend of two);
// - while frames play, the overlays that are still to build are not on the map at all;
// - a tick of the build is one calendar day, whether or not it holds a point, and the caption's
//   count comes from the same capped window as the map's filter (state/overlayPeriod.ts, capWindow).

import type { Overlay, Site } from '../contract/manifest';
import { addDays, buildPeriod, overlayWindow, type OverlayCap } from '../state/overlayPeriod';
import type { OverlayLoad } from '../state/overlayView';
import { dayNumber } from '../state/timeline';
import type { StepPlan, StepState } from './storyModel';

/** What a step plays: the frames of its flip-book (null: none) and the overlays that build after them. */
export interface StepSequence {
  /** Item indexes of the step's layer, in date order, ending on the step's own item. */
  frames: number[] | null;
  /** Ids of the overlays that build up day by day once the last frame is shown. */
  build: string[];
}

/** The sequence of a plan, or null when the step is a cut (nothing plays). */
export function stepSequence(plan: StepPlan): StepSequence | null {
  const frames = plan.frames && plan.frames.length >= 2 ? [...plan.frames] : null;
  if (!frames && plan.buildOverlays.length === 0) return null;
  return { frames, build: [...plan.buildOverlays] };
}

/**
 * What the map shows while frame `frame` of the flip-book is up: that item of the step's layer,
 * with the overlays that are still to build left off (they are shown from their first day, or not
 * at all). Without frames: the step's own item.
 */
export function frameState(state: StepState, sequence: StepSequence, frame: number): StepState {
  return {
    ...state,
    itemIndex: sequence.frames?.[frame] ?? state.itemIndex,
    overlays: sequence.frames ? state.overlays.filter((id) => !sequence.build.includes(id)) : [...state.overlays],
  };
}

/** The words of the button that starts a sequence which did not start by itself, or plays it again. */
export function sequenceLabel(sequence: StepSequence, played: boolean): string {
  if (played) return 'Play again';
  return sequence.frames ? `Play these ${sequence.frames.length} passes` : 'Play day by day';
}

/** The calendar one step's overlays build through. */
export interface BuildClock {
  /** The first day of the earliest period. */
  first: string;
  /** How many days the build takes: day 0 is `first`, the last day of the latest period is day `days - 1`. */
  days: number;
  /** Each building overlay's own period, both ends included. */
  periods: ReadonlyMap<string, { first: string; last: string }>;
}

/**
 * The calendar for building `overlayIds` on the step's final state: each overlay's period is what
 * the app would show of it there (its uncapped window), and its end comes from the loaded points
 * only where the window has none. Null while no overlay has a period: its file is still loading and
 * the window alone does not say, the file failed, or it holds no dated point; then nothing builds.
 */
export function buildClock(site: Site, state: StepState, overlayIds: readonly string[], loadOf: (overlay: Overlay) => OverlayLoad | undefined): BuildClock | null {
  const layer = site.layers.find((l) => l.id === state.layerId) ?? null;
  const periods = new Map<string, { first: string; last: string }>();
  for (const overlay of site.overlays ?? []) {
    if (!overlayIds.includes(overlay.id)) continue;
    const load = loadOf(overlay);
    const period = buildPeriod(overlayWindow(overlay, layer, state.itemIndex), load?.status === 'ready' ? load.loaded.points : []);
    if (period) periods.set(overlay.id, period);
  }
  if (periods.size === 0) return null;
  const all = [...periods.values()];
  const first = all.map((p) => p.first).sort()[0]!;
  const last = all.map((p) => p.last).sort().at(-1)!;
  return { first, days: dayNumber(last) - dayNumber(first) + 1, periods };
}

/** The calendar day shown when `tick` days after the first have been added (held to the calendar). */
export function clockDay(clock: BuildClock, tick: number): string {
  return addDays(clock.first, Math.max(0, Math.min(Math.floor(tick), clock.days - 1)));
}

/**
 * The cap of each building overlay at `tick`: shown from its own first day up to the calendar day,
 * never past its own last. An overlay whose period starts after that day gets an empty period (it
 * shows no point and counts 0) until its first day comes.
 */
export function capsAt(clock: BuildClock, tick: number): Map<string, OverlayCap> {
  const day = clockDay(clock, tick);
  const caps = new Map<string, OverlayCap>();
  for (const [id, period] of clock.periods) caps.set(id, { first: period.first, upTo: day < period.last ? day : period.last });
  return caps;
}

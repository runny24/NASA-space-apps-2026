// The story's state machine (docs/MOTION_AND_STORY_BRIEF.md, section 7; web/MOTION.md). It lives in
// App: App gives it the manifest, the site on screen, the map, what the map has drawn, the overlays'
// files and a way to show a selection; it gives back where the story is and what the visitor can do.
//
// - status: 'pending' from the first frame when the address asks for the story (story/storyUrl.ts)
//   and the manifest is not here yet; then 'open' when the site has steps, else 'closed', silently.
//   'off' in the address: 'closed' from the start.
// - Entering a step sets the app's selection to that step's resolved state (storyModel.ts,
//   stepStates: the same picture however the visitor got there), through App's `apply`, which also
//   stops the tool's playback; then the camera moves (stage.ts), once MapView has framed the site;
//   phase 'moving' until the map's moveend, then 'playing' while a sequence runs, then 'resting'.
// - A sequence (story/sequence.ts) starts by itself only when the visitor comes forward from the
//   step before, and never under reduced motion: the passes in between, one real picture after
//   another, then the overlays that build one real day at a time. Each frame waits for the map to say
//   its picture is on it before its dwell starts (the tool's own pace, state/playback.ts), and the
//   build waits for the overlay's file and the step's picture. Arriving any other way shows the
//   step's final state, with a button that plays the sequence.
// - Next (or the right arrow) while the camera moves or a sequence runs ends both at once, at the
//   step's real final state; the next press goes on. So no beat can make a presenter wait.
// - Closing keeps what the step put on the map (its final state, also in the middle of a sequence),
//   so any step is a starting point for exploring; except the cover, whose far view and first date
//   are no place to start: closed from the cover, by any way, the tool gets what a visitor who opens
//   it directly gets (the effect after the camera's below), framed by a jump.
// - Every effect that does something cleans up after itself (a timer, a listener or a stage per
//   effect), so any step can be left at any moment and React's strict mode (effects run twice in
//   development) leaves nothing behind. No free-running async chains.
// - Everything done to the map goes through stage.ts, inside try/catch: a throw is logged and the
//   story closes, leaving the map to the visitor.

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { prefersReducedMotion } from '../components/MapView';
import type { Manifest, Overlay, Site, StoryStep } from '../contract/manifest';
import type { PictureOnMap } from '../map/dataLayers';
import { formatDay, type OverlayCap } from '../state/overlayPeriod';
import type { OverlayLoad } from '../state/overlayView';
import { msUntilStep } from '../state/playback';
import { resolveSelection, type Selection } from '../state/urlState';
import { buildClock, capsAt, clockDay, frameState, sequenceLabel, stepSequence, type StepSequence } from './sequence';
import { Stage, frameForTool, nightLook } from './stage';
import { hasStory, openingIndex, planStep, siteCamera, stepAnnouncement, stepSelection, stepStates, storySteps, type StepState } from './storyModel';
import { storyIntent, type StoryIntent } from './storyUrl';
import { COVER_SITE_OFFSET, FIRE_DAY_MS, NIGHT_MS, OUTLINE_FADE_MS, RING_ECHOES } from './timing';

export type StoryStatus = 'closed' | 'pending' | 'open';
export type StoryPhase = 'moving' | 'playing' | 'resting';

/** A sequence under way (it may be paused, or waiting for the camera to arrive). */
interface Playing {
  /** The flip-book first, then the overlays that build. */
  part: 'frames' | 'build';
  /** Index into the sequence's frames of the frame asked for. */
  frame: number;
  /** Days added to the building overlays so far, minus one (0: the first day alone). */
  tick: number;
  paused: boolean;
  /** When the frame asked for became the one asked for, or playing went on (performance.now()). */
  since: number;
}

const startOf = (sequence: StepSequence, now: number): Playing => ({ part: sequence.frames ? 'frames' : 'build', frame: 0, tick: 0, paused: false, since: now });

interface State {
  status: StoryStatus;
  /** The story's site, while open. */
  siteId: string | null;
  index: number;
  /** The step the visitor came from; null when the story opened at this step (the camera jumps then). */
  from: number | null;
  phase: StoryPhase;
  /** Counts every entry into a step, so an effect can tell a re-entry from a re-render. */
  run: number;
  /** The sequence under way on this step, if any. */
  play: Playing | null;
  /** A sequence has ended on this step since it was entered: the button says "Play again". */
  played: boolean;
  /** Whether the story was ever open: the live region says "Exploring the map" only after it was. */
  wasOpen: boolean;
}

type Action =
  /** The manifest arrived and the address asked for the story: open (only while still pending). */
  | { type: 'arrive'; siteId: string; index: number }
  /** The header's Story button: open the cover of the site on screen. */
  | { type: 'open'; siteId: string; index: number }
  | { type: 'enter'; index: number; play: Playing | null }
  /** The camera has arrived for entry `run`. */
  | { type: 'arrived'; run: number; now: number }
  /** The flip-book goes on to frame `frame`. */
  | { type: 'frame'; run: number; frame: number; now: number }
  /** The last frame is shown: the overlays start to build. */
  | { type: 'build'; run: number; now: number }
  /** One more day of the build. */
  | { type: 'tick'; run: number }
  | { type: 'pause'; paused: boolean; now: number }
  /** Play the step's sequence from its start. */
  | { type: 'replay'; play: Playing }
  /** The step is at its final state: a sequence ended, or Next cut it and the camera short. */
  | { type: 'finish' }
  | { type: 'close' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'arrive':
      if (state.status !== 'pending') return state;
      return { ...state, status: 'open', siteId: action.siteId, index: action.index, from: null, phase: 'moving', run: state.run + 1, play: null, played: false, wasOpen: true };
    case 'open':
      return { ...state, status: 'open', siteId: action.siteId, index: action.index, from: null, phase: 'moving', run: state.run + 1, play: null, played: false, wasOpen: true };
    case 'enter':
      if (state.status !== 'open') return state;
      return { ...state, index: action.index, from: state.index, phase: 'moving', run: state.run + 1, play: action.play, played: false };
    case 'arrived':
      if (state.status !== 'open' || action.run !== state.run || state.phase !== 'moving') return state;
      return state.play ? { ...state, phase: 'playing', play: { ...state.play, since: action.now } } : { ...state, phase: 'resting' };
    case 'frame':
      if (state.status !== 'open' || action.run !== state.run || state.play?.part !== 'frames') return state;
      return { ...state, play: { ...state.play, frame: action.frame, since: action.now } };
    case 'build':
      if (state.status !== 'open' || action.run !== state.run || state.play?.part !== 'frames') return state;
      return { ...state, play: { ...state.play, part: 'build', tick: 0, since: action.now } };
    case 'tick':
      if (state.status !== 'open' || action.run !== state.run || state.play?.part !== 'build') return state;
      return { ...state, play: { ...state.play, tick: state.play.tick + 1 } };
    case 'pause':
      return state.play ? { ...state, play: { ...state.play, paused: action.paused, since: action.now } } : state;
    case 'replay':
      if (state.status !== 'open' || state.phase === 'moving') return state;
      return { ...state, phase: 'playing', play: action.play };
    case 'finish':
      if (state.status !== 'open') return state;
      return { ...state, phase: 'resting', play: null, played: state.played || state.play !== null };
    case 'close':
      return state.status === 'closed' ? state : { ...state, status: 'closed', phase: 'resting', play: null };
  }
}

const initialState = (intent: StoryIntent): State => ({
  status: intent.kind === 'off' ? 'closed' : 'pending',
  siteId: null,
  index: 0,
  from: null,
  phase: 'resting',
  run: 0,
  play: null,
  played: false,
  wasOpen: false,
});

/** Keys belong to these elements (text fields and menus). */
function typingIn(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.matches('input, select, textarea, [contenteditable], [contenteditable] *');
}

export interface StoryOptions {
  /** The manifest, once loaded. */
  manifest: Manifest | null;
  /** The site on screen. */
  site: Site | null;
  /** The site MapView has framed (its onFramed): the story takes the camera only after that. */
  framedSite: string | null;
  /** The map, once it exists (MapHandle.map). */
  getMap: () => MapLibreMap | null;
  /** Show this selection: App stops the tool's playback and sets it (through noteSelection). */
  apply: (selection: Selection) => void;
  /** The About dialog is open: the story's keys stand down. */
  aboutOpen: boolean;
  /** The picture on the map now, as the map reports it (App's pictureShown): sequences wait for it. */
  picture: PictureOnMap | null;
  /** An overlay's file as the app has it (useOverlayFiles): undefined until it has answered. */
  loadOf: (overlay: Overlay) => OverlayLoad | undefined;
  /** A desktop: the cover's words lie over the map, so the cover frames the site clear of them. */
  coverOnMap: boolean;
}

/** The one button between Back and Next that plays, pauses or replays the step's sequence. */
export interface SequenceControl {
  /** What a press does: start it (or start it again), pause it, or go on. */
  action: 'play' | 'pause' | 'resume';
  label: string;
  /**
   * What is on the map, in words, on a step with a sequence: the place in the flip-book of the
   * picture the map has drawn ("Pass 7 of 20"; "Pass 20 of 20" at rest), or the days shown ("Day 18
   * of 61: 2 October 2026" while it builds; the last day at rest). Null only while the picture drawn
   * is not a frame or the points are not there yet (StoryPanel then keeps the line's row empty).
   */
  progress: string | null;
}

export interface Story {
  status: StoryStatus;
  /** What the address asked for when the page opened (the pending surfaces differ for the cover). */
  intent: StoryIntent;
  phase: StoryPhase;
  /** Counts every entry into a step (focus follows it). */
  run: number;
  /** The step shown; 0 is the cover. */
  index: number;
  /** The story's site, while open (null while pending or closed). */
  site: Site | null;
  steps: StoryStep[];
  /** One resolved state per step (stepStates). */
  states: StepState[];
  /** The step shown, while open. */
  step: StoryStep | null;
  /** The site on screen has a story (the header's Story button shows). */
  available: boolean;
  /** For the one polite live region: "Step 3 of 9: <title>", "Exploring the map", or ''. */
  announcement: string;
  /** The step's sequence button, or null when the step is a cut. */
  control: SequenceControl | null;
  /**
   * The cap on an overlay that is building up day by day, or null: App gives it to overlayView, so
   * the caption's count and the map's filter come from the same capped window.
   */
  capOf: (overlayId: string) => OverlayCap | null;
  /**
   * The manifest has arrived and `tool` is what the map would open with: returns the selection to
   * show first, which is the opening step's when the address asks for the story and the site has
   * one (so no other date's picture is fetched or shown before it).
   */
  arrive: (manifest: Manifest, tool: Selection | null) => Selection | null;
  /** The manifest could not be loaded: the story closes, silently. */
  fail: () => void;
  /** While the camera moves or a sequence runs: end both at the step's final state. Else the next step; on the last step, close the story. */
  next: () => void;
  back: () => void;
  goTo: (index: number) => void;
  /** Back to the cover. */
  home: () => void;
  /** Close the story, keeping what the step put on the map (from the cover: the tool as it opens). */
  exit: () => void;
  /** Open the cover of the site on screen (the header's Story button). */
  open: () => void;
  /** The sequence button: play, pause, go on, or play again. */
  toggle: () => void;
}

export function useStory({ manifest, site, framedSite, getMap, apply, aboutOpen, picture, loadOf, coverOnMap }: StoryOptions): Story {
  // Read once, when the page opens.
  const [intent] = useState(() => storyIntent(window.location.search));
  const [state, dispatch] = useReducer(reducer, intent, initialState);
  const stageRef = useRef<Stage | null>(null);

  const storySite = useMemo(
    () => (state.status === 'closed' || state.siteId === null ? null : (manifest?.sites.find((s) => s.id === state.siteId) ?? null)),
    [manifest, state.status, state.siteId],
  );
  const steps = useMemo(() => storySteps(storySite), [storySite]);
  const states = useMemo(() => (manifest && storySite ? stepStates(manifest, storySite) : []), [manifest, storySite]);
  const step = state.status === 'open' ? (steps[state.index] ?? null) : null;

  /** What the step at `index` plays when the visitor arrives from the step before it; null: a cut. */
  const sequenceAt = useCallback(
    (index: number): StepSequence | null => {
      const [current, currentState, previous, previousState] = [steps[index], states[index], steps[index - 1], states[index - 1]];
      if (!storySite || !current || !currentState || !previous || !previousState) return null;
      return stepSequence(planStep({ step: previous, state: previousState }, { step: current, state: currentState }, storySite));
    },
    [storySite, steps, states],
  );
  const sequence = useMemo(() => (state.status === 'open' ? sequenceAt(state.index) : null), [state.status, state.index, sequenceAt]);

  // Closing keeps what the step puts on the map: while a sequence is under way that is the step's
  // final state, never the pass or the day the sequence had reached.
  const exit = useCallback(() => {
    const target = states[state.index];
    if (state.status === 'open' && state.play !== null && storySite && target) apply(stepSelection(storySite, target));
    dispatch({ type: 'close' });
  }, [states, state.status, state.index, state.play, storySite, apply]);
  /** Something the story did to the map threw: say so in the console and give the map back. */
  const stop = useCallback((err: unknown) => {
    console.error('The story stopped because of an error; the map is shown instead:', err);
    dispatch({ type: 'close' });
  }, []);

  const arrive = useCallback(
    (loaded: Manifest, tool: Selection | null): Selection | null => {
      if (intent.kind === 'off' || !tool || !hasStory(tool.site)) {
        dispatch({ type: 'close' });
        return tool;
      }
      const index = openingIndex(storySteps(tool.site), intent); // an unknown id opens the cover
      const opening = stepStates(loaded, tool.site)[index];
      if (!opening) {
        dispatch({ type: 'close' });
        return tool;
      }
      dispatch({ type: 'arrive', siteId: tool.site.id, index });
      return stepSelection(tool.site, opening);
    },
    [intent],
  );
  const fail = useCallback(() => dispatch({ type: 'close' }), []);

  const enter = useCallback(
    (index: number) => {
      const target = states[index];
      if (state.status !== 'open' || !storySite || !target) return;
      // A sequence starts by itself only for a visitor who comes forward from the step before, and
      // never under reduced motion (read at this moment). Otherwise the step shows its final state.
      const plays = index === state.index + 1 && !prefersReducedMotion() ? sequenceAt(index) : null;
      apply(stepSelection(storySite, plays ? frameState(target, plays, 0) : target));
      dispatch({ type: 'enter', index, play: plays ? startOf(plays, performance.now()) : null });
    },
    [states, state.status, state.index, storySite, apply, sequenceAt],
  );
  /** The step's real final state at once: its own picture and overlays, the camera where it was going. */
  const finish = useCallback(() => {
    const target = states[state.index];
    if (state.status !== 'open' || !storySite || !target) return;
    apply(stepSelection(storySite, target));
    try {
      stageRef.current?.finish();
    } catch (err) {
      stop(err);
      return;
    }
    dispatch({ type: 'finish' });
  }, [states, state.status, state.index, storySite, apply, stop]);
  const next = useCallback(() => {
    // A sequence is under way (or waiting for the camera): end it at its final state; the next press
    // goes on. A camera move alone never holds Next back: the next step starts from where it is.
    if (state.play !== null) finish();
    else if (state.index >= steps.length - 1) exit();
    else enter(state.index + 1);
  }, [state.play, state.index, steps.length, finish, exit, enter]);
  const back = useCallback(() => {
    if (state.index > 0) enter(state.index - 1);
  }, [state.index, enter]);
  const home = useCallback(() => enter(0), [enter]);
  const open = useCallback(() => {
    if (!manifest || !site || !hasStory(site)) return;
    const cover = stepStates(manifest, site)[0];
    if (!cover) return;
    apply(stepSelection(site, cover));
    dispatch({ type: 'open', siteId: site.id, index: 0 });
  }, [manifest, site, apply]);
  const toggle = useCallback(() => {
    if (state.play) {
      dispatch({ type: 'pause', paused: !state.play.paused, now: performance.now() });
      return;
    }
    const target = states[state.index];
    if (state.status !== 'open' || !storySite || !target || !sequence) return;
    apply(stepSelection(storySite, frameState(target, sequence, 0)));
    dispatch({ type: 'replay', play: startOf(sequence, performance.now()) });
  }, [state.play, state.status, state.index, states, storySite, sequence, apply]);

  // The map is the story's while it is not closed: a Stage takes it (inert) and gives it back.
  const taken = state.status !== 'closed';
  useEffect(() => {
    if (!taken) return;
    const map = getMap();
    if (!map) return;
    const stage = new Stage(map);
    stageRef.current = stage;
    try {
      stage.enter();
    } catch (err) {
      stop(err);
    }
    return () => {
      if (stageRef.current === stage) stageRef.current = null;
      try {
        stage.leave(prefersReducedMotion() ? 0 : NIGHT_MS);
      } catch (err) {
        console.error('The story could not give the map back in full:', err);
      }
    };
  }, [taken, getMap, stop]);

  // The camera, on every entry into a step, once MapView has framed the story's site (its own first
  // framing runs when the style is ready and would overwrite an earlier move). Night falls with the
  // first move. A step the visitor came to from another one is glided to; the step the story opened
  // at is jumped to, and so is every step under reduced motion. Once there, the site is marked: a
  // ring on the cover, its outline on a step.
  const { status, index, run, from } = state;
  useEffect(() => {
    if (status !== 'open' || !storySite || framedSite !== storySite.id) return;
    const stage = stageRef.current;
    const currentStep = steps[index];
    const currentState = states[index];
    if (!stage || !currentStep || !currentState) return;
    const previousStep = steps[index - 1];
    const previousState = states[index - 1];
    try {
      const reduced = prefersReducedMotion();
      stage.night(nightLook(), reduced ? 0 : NIGHT_MS);
      const plan = planStep(previousStep && previousState ? { step: previousStep, state: previousState } : null, { step: currentStep, state: currentState }, storySite);
      const cover = index === 0;
      return stage.go(plan.camera, { animate: from !== null && !reduced, offsetShare: cover && coverOnMap ? COVER_SITE_OFFSET : 0 }, () => {
        try {
          stage.mark(cover ? 'ring' : 'outline', storySite.bounds, { echoes: reduced ? 0 : RING_ECHOES, fadeMs: reduced ? 0 : OUTLINE_FADE_MS });
        } catch (err) {
          stop(err);
          return;
        }
        dispatch({ type: 'arrived', run, now: performance.now() });
      });
    } catch (err) {
      stop(err);
    }
  }, [status, index, run, from, storySite, framedSite, steps, states, coverOnMap, stop]);

  // The flip-book: the frame asked for stays until the map has had its picture on it for a dwell
  // (or, when it never comes, until the ceiling), then the next frame; after the last one the
  // overlays start to build, or the step is at its final state.
  const play = state.play;
  const stepState = status === 'open' ? states[index] : undefined;
  const framesPlay = status === 'open' && state.phase === 'playing' && play?.part === 'frames' && !play.paused ? play : null;
  const frameItem = framesPlay && sequence?.frames ? sequence.frames[framesPlay.frame] : undefined;
  const frameShown = frameItem !== undefined && stepState !== undefined && picture !== null && picture.layer.id === stepState.layerId && picture.index === frameItem;
  const shownSince = useRef<{ run: number; frame: number; at: number } | null>(null);
  useEffect(() => {
    if (!framesPlay || frameItem === undefined || !sequence?.frames || !storySite || !stepState) return;
    const now = performance.now();
    const seen = shownSince.current;
    if (!frameShown) shownSince.current = null;
    else if (!seen || seen.run !== run || seen.frame !== framesPlay.frame) shownSince.current = { run, frame: framesPlay.frame, at: now };
    const wait = msUntilStep({ shownAt: framesPlay.since, drawnAt: frameShown ? (shownSince.current?.at ?? now) : null, now });
    const frames = sequence.frames;
    const timer = setTimeout(() => {
      const following = framesPlay.frame + 1;
      if (following < frames.length) {
        apply(stepSelection(storySite, frameState(stepState, sequence, following)));
        dispatch({ type: 'frame', run, frame: following, now: performance.now() });
      } else if (sequence.build.length > 0) {
        apply(stepSelection(storySite, stepState));
        dispatch({ type: 'build', run, now: performance.now() });
      } else {
        dispatch({ type: 'finish' });
      }
    }, wait);
    return () => clearTimeout(timer);
  }, [framesPlay, frameItem, frameShown, sequence, storySite, stepState, run, apply]);

  // The build: one real day per tick, once the files of the overlays that build have answered and
  // the map has the step's picture on it. Days with no point still take their tick. An overlay
  // whose file failed, or holds no dated point, builds nothing: the step is then at its final state.
  const buildPlay = status === 'open' && state.phase === 'playing' && play?.part === 'build' && !play.paused ? play : null;
  const clock = useMemo(
    () => (storySite && stepState && sequence && sequence.build.length > 0 ? buildClock(storySite, stepState, sequence.build, loadOf) : null),
    [storySite, stepState, sequence, loadOf],
  );
  const filesAnswered = useMemo(
    () => storySite !== null && sequence !== null && (storySite.overlays ?? []).filter((o) => sequence.build.includes(o.id)).every((o) => loadOf(o) !== undefined),
    [storySite, sequence, loadOf],
  );
  const pictureThere =
    stepState !== undefined && (stepState.layerId === null || (picture !== null && picture.layer.id === stepState.layerId && picture.index === stepState.itemIndex));
  useEffect(() => {
    if (!buildPlay || !filesAnswered || !pictureThere) return;
    const days = clock?.days ?? 0;
    const timer = setTimeout(() => {
      if (buildPlay.tick + 1 >= days) dispatch({ type: 'finish' });
      else dispatch({ type: 'tick', run });
    }, FIRE_DAY_MS);
    return () => clearTimeout(timer);
  }, [buildPlay, filesAnswered, pictureThere, clock, run]);

  // While the overlays build, each is capped at the day reached. App gives the cap to overlayView.
  const caps = useMemo(() => (play?.part === 'build' && clock ? capsAt(clock, play.tick) : null), [play, clock]);
  const capOf = useCallback((overlayId: string): OverlayCap | null => caps?.get(overlayId) ?? null, [caps]);

  // The files of the overlays that build are on the map (their points can be drawn).
  const filesReady = useMemo(
    () => storySite !== null && sequence !== null && (storySite.overlays ?? []).filter((o) => sequence.build.includes(o.id)).every((o) => loadOf(o)?.status === 'ready'),
    [storySite, sequence, loadOf],
  );
  // On a step with a sequence the line is always there and always says what is on the map, so the
  // panel never jumps: for a flip-book the place among the step's frames of the picture the map has
  // DRAWN (never of the one asked for), "Pass 20 of 20" at rest on the step's own picture; for a
  // build the days shown, the day reached while it builds, the whole period at rest. While the
  // picture drawn is not a frame (a file still loading) or the points are not there yet, it has no
  // words (StoryPanel keeps its row).
  const control = useMemo<SequenceControl | null>(() => {
    if (status !== 'open' || !sequence) return null;
    const passLine = (): string | null => {
      if (!sequence.frames) return null;
      const drawn = picture !== null && !picture.failed && stepState !== undefined && picture.layer.id === stepState.layerId ? sequence.frames.indexOf(picture.index) : -1;
      return drawn >= 0 ? `Pass ${drawn + 1} of ${sequence.frames.length}` : null;
    };
    const dayLine = (tick: number): string | null =>
      clock && filesReady ? `Day ${Math.min(tick + 1, clock.days)} of ${clock.days}: ${formatDay(clockDay(clock, tick))}` : null;
    if (!play) {
      // At rest the step shows its final state: every pass played, every day built.
      const progress = sequence.build.length > 0 && clock ? dayLine(clock.days - 1) : passLine();
      return { action: 'play', label: sequenceLabel(sequence, state.played), progress };
    }
    const progress = play.part === 'frames' ? passLine() : dayLine(play.tick);
    return play.paused ? { action: 'resume', label: 'Play', progress } : { action: 'pause', label: 'Pause', progress };
  }, [status, sequence, play, state.played, picture, stepState, clock, filesReady]);

  // Closed from the cover ("Explore the map", Escape, an error: any way), the tool gets what a
  // visitor who opens it directly gets: the site's own first selection (its first layer at the
  // newest date, no overlay) and the site framed as MapView frames it, by a jump. Closed from any
  // other step, it keeps what the step put on the map, camera included. This runs once the close is
  // on the page: the stage has left, and the map's container has the tool's size again, which
  // frameForTool reads before it frames (on a phone the tool's map is taller than the story's).
  const before = useRef<StoryStatus>(status);
  const { siteId } = state;
  useEffect(() => {
    const was = before.current;
    before.current = status;
    if (was !== 'open' || status !== 'closed' || index !== 0 || !manifest || siteId === null) return;
    const tool = resolveSelection(manifest, { site: siteId });
    if (!tool || tool.site.id !== siteId) return;
    apply(tool);
    const map = getMap();
    if (!map) return;
    try {
      frameForTool(map, siteCamera(tool.site));
    } catch (err) {
      console.error('The story could not frame the site for the tool:', err);
    }
  }, [status, index, siteId, manifest, apply, getMap]);

  // The keys, on the whole window while the story is open (a presenter who clicked the page must
  // not lose them): Right and Page Down go on, Left and Page Up go back, Home returns to the cover,
  // Escape closes. They stand down for the About dialog, a modifier key, and text fields and menus.
  useEffect(() => {
    if (status !== 'open') return;
    const onKey = (e: KeyboardEvent) => {
      if (aboutOpen || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || typingIn(e.target)) return;
      const act =
        e.key === 'ArrowRight' || e.key === 'PageDown'
          ? next
          : e.key === 'ArrowLeft' || e.key === 'PageUp'
            ? back
            : e.key === 'Home'
              ? home
              : e.key === 'Escape'
                ? exit
                : null;
      if (!act) return;
      e.preventDefault();
      act();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [status, aboutOpen, next, back, home, exit]);

  const announcement = step ? stepAnnouncement(steps, index) : status === 'closed' && state.wasOpen ? 'Exploring the map' : '';

  return {
    status,
    intent,
    phase: state.phase,
    run,
    index,
    site: storySite,
    steps,
    states,
    step,
    available: hasStory(site),
    announcement,
    control,
    capOf,
    arrive,
    fail,
    next,
    back,
    goTo: enter,
    home,
    exit,
    open,
    toggle,
  };
}

// Play and pause through the dates of a per-date layer. The decisions (which date next, when to stop,
// how long to wait) are the pure functions of state/playback.ts; this hook only holds the timer and
// listens for the map saying that a date's picture is drawn (MapView's onDrawn).

import { useCallback, useEffect, useState } from 'react';
import { msUntilStep, nextPlayItem, playStart } from '../state/playback';
import type { TimelineEntry } from '../state/timeline';

export interface Playback {
  playing: boolean;
  /** Play from the date on screen (from the first date when on the last), or pause. */
  toggle: () => void;
  /** Start playing (does nothing when the layer cannot play). */
  play: () => void;
  /** Stop without announcing it: the person changed the date, the layer or the place themselves. */
  stop: () => void;
  /** For MapView's onDrawn: the map has drawn this item's picture (null: the picture is changing). */
  onDrawn: (itemIndex: number | null) => void;
  /** What a screen reader is told when playback has just stopped by itself or was paused, else ''. */
  announcement: string;
}

interface Run {
  /** The timeline being played: another layer or place has other entries, which stops playback. */
  entries: TimelineEntry[];
  /** When the current date became the one on screen (or Play was pressed on it). */
  shownAt: number;
}

export function usePlayback(entries: TimelineEntry[], itemIndex: number, select: (itemIndex: number) => void): Playback {
  const [run, setRun] = useState<Run | null>(null);
  const [drawn, setDrawn] = useState<{ itemIndex: number; at: number } | null>(null);
  const [stopped, setStopped] = useState<{ itemIndex: number; reason: 'end' | 'pause' } | null>(null);
  const playing = run !== null && run.entries === entries;

  const onDrawn = useCallback((index: number | null) => setDrawn(index === null ? null : { itemIndex: index, at: performance.now() }), []);

  const play = useCallback(() => {
    const start = playStart(entries, itemIndex);
    if (start < 0) return;
    setStopped(null);
    setRun({ entries, shownAt: performance.now() });
    if (start !== itemIndex) {
      setDrawn(null);
      select(start);
    }
  }, [entries, itemIndex, select]);

  const stop = useCallback(() => {
    setRun(null);
    setStopped(null);
  }, []);

  const toggle = useCallback(() => {
    if (!playing) return play();
    setRun(null);
    setStopped({ itemIndex, reason: 'pause' });
  }, [playing, play, itemIndex]);

  // One step: a dwell after the map has drawn the date on screen, or at the ceiling if it never does.
  useEffect(() => {
    if (!playing || !run) return;
    const drawnAt = drawn?.itemIndex === itemIndex ? drawn.at : null;
    const wait = msUntilStep({ shownAt: run.shownAt, drawnAt, now: performance.now() });
    const timer = setTimeout(() => {
      const next = nextPlayItem(entries, itemIndex);
      if (next === null) {
        setRun(null);
        setStopped({ itemIndex, reason: 'end' });
        return;
      }
      setDrawn(null);
      setRun({ entries, shownAt: performance.now() });
      select(next);
    }, wait);
    return () => clearTimeout(timer);
  }, [playing, run, drawn, itemIndex, entries, select]);

  const date = entries.find((e) => e.itemIndex === itemIndex)?.date;
  const announcement =
    !playing && stopped && stopped.itemIndex === itemIndex && date
      ? stopped.reason === 'end'
        ? `Played to the last date, ${date}.`
        : `Paused on ${date}.`
      : '';
  return { playing, toggle, play, stop, onDrawn, announcement };
}

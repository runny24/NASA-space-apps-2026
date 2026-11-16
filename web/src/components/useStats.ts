// The site's stats.json, loaded once per site and shared: the Statistics panel (StatsPanel.tsx) charts
// it, and the year's curve (YearCurve.tsx) draws its dB series above the timeline and in the story.
// One hook in App, so one request for each site's file, not one per reader.

import { useEffect, useState } from 'react';
import { loadStats, type Stats } from '../contract/stats';

/** A loaded stats file, or why it could not be loaded (a message fit to show a person). */
export interface StatsLoad {
  stats?: Stats;
  error?: string;
}

/**
 * The stats file at `href`, read once whenever `href` changes: null while it loads (and when there
 * is none, `href` null); then its contents or its error. An answer for an earlier `href` is never
 * returned for a newer one.
 */
export function useStats(href: string | null): StatsLoad | null {
  const [state, setState] = useState<({ href: string } & StatsLoad) | null>(null);
  useEffect(() => {
    if (href === null) return;
    let alive = true;
    loadStats(href)
      .then((stats) => alive && setState({ href, stats }))
      .catch((err: unknown) => alive && setState({ href, error: err instanceof Error ? err.message : String(err) }));
    return () => {
      alive = false;
    };
  }, [href]);
  return href !== null && state?.href === href ? state : null;
}

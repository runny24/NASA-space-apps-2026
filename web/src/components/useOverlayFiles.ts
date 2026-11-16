// Loads the file of each overlay the first time it is switched on, and keeps it. A file that failed
// is tried again whenever its overlay is switched on afresh (switched off and on, or the place left
// and chosen again), whenever the failure came; a change of layer or date with the overlay staying
// on does not fetch it again.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { resolveDataUrl, type Site } from '../contract/manifest';
import { loadOverlay, type Overlay } from '../contract/overlay';
import type { OverlayLoad } from '../state/overlayView';

/** One cache entry per file and date property (the points' days depend on both). */
const cacheKey = (overlay: Overlay, manifestHref: string) => `${resolveDataUrl(overlay.url, manifestHref)}\n${overlay.date_property ?? ''}`;

export interface OverlayFiles {
  /** The state of an overlay's file; undefined until it is first asked for (the app shows it as loading). */
  loadOf: (overlay: Overlay) => OverlayLoad | undefined;
}

export function useOverlayFiles(site: Site | null, on: readonly string[], manifestHref: string): OverlayFiles {
  const [loads, setLoads] = useState<Record<string, OverlayLoad>>({});
  // Files asked for (loading or answered), files whose answer was a failure, and the files wanted
  // at the last run of the effect (to tell an overlay switched on afresh from one that stayed on).
  const started = useRef(new Set<string>());
  const failed = useRef(new Set<string>());
  const wantedBefore = useRef(new Set<string>());
  const wanted = useMemo(() => (site?.overlays ?? []).filter((o) => on.includes(o.id)), [site, on]);

  useEffect(() => {
    const now = new Set<string>();
    for (const overlay of wanted) {
      const key = cacheKey(overlay, manifestHref);
      now.add(key);
      const afresh = !wantedBefore.current.has(key);
      if (started.current.has(key) && !(afresh && failed.current.has(key))) continue;
      started.current.add(key);
      failed.current.delete(key);
      // A new try: the old failure goes, so the app says it is loading.
      setLoads((all) => (key in all ? Object.fromEntries(Object.entries(all).filter(([k]) => k !== key)) : all));
      loadOverlay(resolveDataUrl(overlay.url, manifestHref), overlay.date_property)
        .then((loaded) => setLoads((all) => ({ ...all, [key]: { status: 'ready', loaded } })))
        .catch((err: unknown) => {
          failed.current.add(key);
          setLoads((all) => ({ ...all, [key]: { status: 'error', message: err instanceof Error ? err.message : String(err) } }));
        });
    }
    wantedBefore.current = now;
  }, [wanted, manifestHref]);

  const loadOf = useCallback((overlay: Overlay) => loads[cacheKey(overlay, manifestHref)], [loads, manifestHref]);
  return { loadOf };
}

// Whether a CSS media query matches now, following it as the window changes (a phone turned sideways).

import { useCallback, useSyncExternalStore } from 'react';
import { STACKED_LAYOUT_QUERY } from '../map/gestures';

/**
 * A short map in the stacked layout: a phone held sideways, or a desktop page zoomed to 200%. The map
 * there is about 130 to 250 px tall and its expanded credit line covers its lower half, so the notes
 * on the map (what the overlay's dots are, the loading note) cannot all fit on it: they go in a strip
 * right under the map instead (App.tsx), where they are never cut off.
 */
export const NOTES_UNDER_MAP_QUERY = '(max-width: 760px) and (max-height: 500px)';

/**
 * The stacked layout (a phone), at any height: the overlay's caption and its sentence on what a dot
 * is go in the strip right under the map, never in a box on it. On a 375 x 812 phone the box covered
 * about half of the dots it counts and took the taps meant for the map. The loading note, one short
 * line, stays on the map unless the map is short (NOTES_UNDER_MAP_QUERY), so the panels below do not
 * jump at every date.
 */
export const CAPTION_UNDER_MAP_QUERY = STACKED_LAYOUT_QUERY;

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);
}

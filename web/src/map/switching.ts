// How the map switches between the files of a layer (map/dataLayers.ts). Kept apart from MapLibre so
// that the browser tests can read the same numbers.

export const PRELOAD_LIMIT = 12;

/**
 * Layers with more files than PRELOAD_LIMIT keep one file's source on the map at a time. While the
 * next file loads, the previous date's picture stays on screen for at most this long; after it the
 * map shows nothing until the new file has loaded, so a file that never answers cannot leave one
 * date's picture on screen under another date's name.
 */
export const PREVIOUS_PICTURE_LIMIT_MS = 5000;

export type SwitchStrategy = 'preload-opacity' | 'one-source';

export function chooseStrategy(fileCount: number): SwitchStrategy {
  return fileCount <= PRELOAD_LIMIT ? 'preload-opacity' : 'one-source';
}

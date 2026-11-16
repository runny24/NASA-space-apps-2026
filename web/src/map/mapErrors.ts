// Problems the map reports while drawing data, and which of them still apply to what is on screen.
// A problem belongs either to one data file (shown only while that file is on screen) or, when no
// file is known, to the place, layer and date that were showing when it happened. So a problem
// disappears when the person moves on, instead of staying next to a layer that now draws fine.

export interface MapErrorReport {
  message: string;
  /** The data file the problem is about, when known. */
  url?: string;
}

export interface StoredMapError extends MapErrorReport {
  /** What was on screen when it happened (see selectionKey). */
  key: string;
}

/** Identifies what is on screen: place, layer and date or pair. */
export function selectionKey(siteId: string | undefined, layerId: string | undefined, itemIndex: number): string {
  return `${siteId ?? ''}|${layerId ?? ''}|${itemIndex}`;
}

/** The last part of a URL's path, so a message names the file without a long address. */
export function fileLabel(url: string): string {
  try {
    const name = new URL(url).pathname.split('/').pop();
    return name ? decodeURIComponent(name) : url;
  } catch {
    return url;
  }
}

/** How many problems to remember; more than this on one screen would not be read anyway. */
const KEEP = 20;

/**
 * Add a problem to the remembered ones. A newer problem about the same file (or, without a file,
 * about the same screen) replaces the older one.
 */
export function rememberMapError(stored: readonly StoredMapError[], report: MapErrorReport, key: string): StoredMapError[] {
  const same = (e: StoredMapError) => (report.url !== undefined ? e.url === report.url : e.url === undefined && e.key === key);
  return [...stored.filter((e) => !same(e)), { ...report, key }].slice(-KEEP);
}

/** The newest remembered problem about what is on screen now, or null. */
export function visibleMapError(stored: readonly StoredMapError[], shownUrl: string | undefined, key: string): string | null {
  for (let i = stored.length - 1; i >= 0; i--) {
    const e = stored[i]!;
    if (e.url !== undefined ? e.url === shownUrl : e.key === key) return e.message;
  }
  return null;
}

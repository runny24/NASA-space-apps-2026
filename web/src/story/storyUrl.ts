// The story's one parameter in the address, `story` (docs/MOTION_AND_STORY_BRIEF.md, section 7.6).
// Pure functions; App.tsx reads the intent once when the page opens and writes the query.
//
// | Address                                                              | Opens                        |
// | no site, layer, date, pair, overlays, lon, lat, z or play            | the cover (if there is one)  |
// | story=<step id>                                                      | that step (unknown: cover)   |
// | story=off, or any of the parameters above without `story`            | the map, exactly as before   |
//
// Shared links made before the story existed keep working: they carry `site`.

/** What the address asks of the story when the page opens. */
export type StoryIntent = { kind: 'off' } | { kind: 'cover' } | { kind: 'step'; id: string };

/** The keys that describe what the map shows. Any of them without `story` means "the map, as linked". */
const SELECTION_KEYS = ['site', 'layer', 'date', 'pair', 'overlays', 'lon', 'lat', 'z', 'play'] as const;

/**
 * What the query string asks of the story: `story=off` the map; `story=<id>` (not empty) that step,
 * whatever else the query holds; no `story` key: the map when any selection key is there, else the
 * cover. `manifest` (development only) and other keys never count.
 */
export function storyIntent(search: string): StoryIntent {
  const p = new URLSearchParams(search);
  const story = (p.get('story') ?? '').trim();
  if (story === 'off') return { kind: 'off' };
  if (story !== '') return { kind: 'step', id: story };
  return SELECTION_KEYS.some((key) => p.has(key)) ? { kind: 'off' } : { kind: 'cover' };
}

/**
 * The query string while the story is open at `stepId`: keeps the keys of `keep` the app does not
 * know (for example the development-only ?manifest=), drops every selection key and `play`, and sets
 * `story=<stepId>`, plus `site=<siteId>` when a site is given. App gives the site only when the
 * story's site is not the one a bare address opens, so that a reload still finds it.
 */
export function storyQuery(stepId: string, siteId: string | null, keep: string): string {
  const p = new URLSearchParams(keep);
  for (const key of [...SELECTION_KEYS, 'story']) p.delete(key);
  if (siteId) p.set('site', siteId);
  p.set('story', stepId);
  return `?${p.toString()}`;
}

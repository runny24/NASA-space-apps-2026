// The story's clock (docs/MOTION_AND_STORY_BRIEF.md, section 6). The CSS durations are the --dur-*
// tokens in styles/motion.css; these are the ones JavaScript needs.

/** A camera flight, when the zoom changes by more than CAMERA_FLY_ZOOM_CHANGE. */
export const CAMERA_FLY_MS = 3200;
/** A camera ease, for smaller moves. */
export const CAMERA_EASE_MS = 1400;
/** A zoom change larger than this is a flight; smaller, an ease. */
export const CAMERA_FLY_ZOOM_CHANGE = 3;
/** Padding round a site's bounds when the camera frames them, as MapView frames a site. */
export const BOUNDS_PADDING_PX = 40;
/** Night falling over the basemap, and lifting again (the CSS token --dur-5). */
export const NIGHT_MS = 900;
/** The site's outline fading in once the camera has arrived. */
export const OUTLINE_FADE_MS = 400;
/** How many times the ring on the cover pulses before it stays still. */
export const RING_ECHOES = 3;
/**
 * On a desktop the cover's words lie over the left of the map, so the site is framed to the right
 * of the map's centre by this share of the map's width.
 */
export const COVER_SITE_OFFSET = 0.24;
/** One real day of an overlay building up, day by day. */
export const FIRE_DAY_MS = 120;
/** One class of a layer with classes appearing, in legend order (slice 6). */
export const CLASS_BEAT_MS = 900;

// The flip-book (slice 3) plays at the tool's own pace, so there is one pace in the app, not two:
// it waits for the map to say each picture is drawn, then dwells, and gives up after the ceiling.
export { PLAY_CEILING_MS, PLAY_DWELL_MS } from '../state/playback';

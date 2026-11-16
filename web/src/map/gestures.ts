// Whether a one-finger drag over the map moves the map or scrolls the page.
//
// On a phone the map sits on top of a scrolling column (styles.css, the max-width: 760px block). If
// the map takes every drag, a finger that lands on it can never scroll past it to the controls.
// MapLibre's cooperative gestures fix that: one finger scrolls the page, two fingers move the map.
// But they also make a mouse wheel scroll the page unless Ctrl (or Cmd) is held, which would make
// the desktop worse. So they are on only for a touch screen (coarse primary pointer) in the stacked
// layout; in the side-by-side layout the page does not scroll, so there is nothing to trap.

/** The stacked (phone) layout. styles.css uses the same query; a unit test keeps the two in step. */
export const STACKED_LAYOUT_QUERY = '(max-width: 760px)';
/** A primary pointer that is a finger, not a mouse or a pen. */
export const COARSE_POINTER_QUERY = '(pointer: coarse)';

export function wantsCooperativeGestures(device: { coarsePointer: boolean; stackedLayout: boolean }): boolean {
  return device.coarsePointer && device.stackedLayout;
}

/** The part of MapLibre's CooperativeGesturesHandler used here. */
export interface GestureToggle {
  enable(): void;
  disable(): void;
}

type MediaQuery = Pick<MediaQueryList, 'matches' | 'addEventListener' | 'removeEventListener'>;

/**
 * Switch cooperative gestures on or off for this device now, and again whenever it changes (a
 * phone turned sideways can leave the stacked layout). Returns a function that stops following.
 */
export function followDevice(toggle: GestureToggle, matchMedia: (query: string) => MediaQuery): () => void {
  const coarse = matchMedia(COARSE_POINTER_QUERY);
  const stacked = matchMedia(STACKED_LAYOUT_QUERY);
  const apply = () => {
    if (wantsCooperativeGestures({ coarsePointer: coarse.matches, stackedLayout: stacked.matches })) toggle.enable();
    else toggle.disable();
  };
  apply();
  coarse.addEventListener('change', apply);
  stacked.addEventListener('change', apply);
  return () => {
    coarse.removeEventListener('change', apply);
    stacked.removeEventListener('change', apply);
  };
}

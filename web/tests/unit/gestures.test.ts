import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { COARSE_POINTER_QUERY, followDevice, STACKED_LAYOUT_QUERY, wantsCooperativeGestures } from '../../src/map/gestures';

const css = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'styles.css'), 'utf8');

/** A stand-in for window.matchMedia whose answers the test can change, firing 'change' like a browser. */
function fakeMedia(initial: Record<string, boolean>) {
  const state = { ...initial };
  const listeners = new Map<string, Set<() => void>>();
  const matchMedia = (query: string) => ({
    get matches() {
      return state[query] ?? false;
    },
    addEventListener: (_type: string, fn: () => void) => {
      if (!listeners.has(query)) listeners.set(query, new Set());
      listeners.get(query)!.add(fn);
    },
    removeEventListener: (_type: string, fn: () => void) => listeners.get(query)?.delete(fn),
  });
  const set = (query: string, value: boolean) => {
    state[query] = value;
    listeners.get(query)?.forEach((fn) => fn());
  };
  const listenerCount = () => [...listeners.values()].reduce((n, s) => n + s.size, 0);
  return { matchMedia: matchMedia as unknown as Parameters<typeof followDevice>[1], set, listenerCount };
}

function fakeToggle() {
  const calls: string[] = [];
  return { calls, enable: () => calls.push('enable'), disable: () => calls.push('disable') };
}

describe('cooperative gestures', () => {
  it('are on only for a touch screen in the stacked phone layout', () => {
    expect(wantsCooperativeGestures({ coarsePointer: true, stackedLayout: true })).toBe(true);
    // A desktop with a mouse keeps wheel zoom, even in a narrow window.
    expect(wantsCooperativeGestures({ coarsePointer: false, stackedLayout: true })).toBe(false);
    expect(wantsCooperativeGestures({ coarsePointer: false, stackedLayout: false })).toBe(false);
    // A tablet in the side-by-side layout: the page does not scroll, so the map traps nothing.
    expect(wantsCooperativeGestures({ coarsePointer: true, stackedLayout: false })).toBe(false);
  });

  it('follow the device as it changes, and stop when asked', () => {
    const media = fakeMedia({ [COARSE_POINTER_QUERY]: true, [STACKED_LAYOUT_QUERY]: true });
    const toggle = fakeToggle();
    const stop = followDevice(toggle, media.matchMedia);
    expect(toggle.calls).toEqual(['enable']);
    media.set(STACKED_LAYOUT_QUERY, false); // the phone is turned sideways into the wide layout
    expect(toggle.calls.at(-1)).toBe('disable');
    media.set(STACKED_LAYOUT_QUERY, true);
    expect(toggle.calls.at(-1)).toBe('enable');
    stop();
    expect(media.listenerCount()).toBe(0);
    const before = toggle.calls.length;
    media.set(COARSE_POINTER_QUERY, false);
    expect(toggle.calls.length).toBe(before);
  });

  it('switch them off on a desktop from the start', () => {
    const toggle = fakeToggle();
    followDevice(toggle, fakeMedia({ [COARSE_POINTER_QUERY]: false, [STACKED_LAYOUT_QUERY]: true }).matchMedia);
    expect(toggle.calls).toEqual(['disable']);
  });

  it('use the same breakpoint as the stacked layout in styles.css', () => {
    expect(css).toContain(`@media ${STACKED_LAYOUT_QUERY} {`);
  });
});

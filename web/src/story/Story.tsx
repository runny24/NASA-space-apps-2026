// What ties the story's pieces into the page (App.tsx places them): an error boundary of its own, so a
// story that throws closes and leaves the map to the visitor instead of taking the page down, and
// where keyboard focus goes when the story opens, moves on and closes.

import { Component, useEffect, useRef, type ReactNode } from 'react';
import type { StoryStatus } from './useStory';

/**
 * Wraps each piece of the story. If one throws while drawing, it draws nothing, logs the error and
 * calls `onError` (App closes the story, so the map and the tool come back). It is mounted only while
 * the story is not closed, so the next opening starts afresh.
 */
export class StoryBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: unknown): void {
    console.error('The story stopped because of an error; the map is shown instead:', error);
    this.props.onError();
  }

  override render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

/** The button the story's focus goes to: "Start the story" on the cover, Next on every other step. */
const PRIMARY = '[data-story-primary]';
/** The story's navigation: focus that is on one of these controls stays there from step to step. */
const NAVIGATION = '.story-nav, .story-progress';

/**
 * Focus and scrolling, by the story's status and its entries into steps (`run`):
 * - opening (from the address or the Story button): focus on the primary button;
 * - a new step: focus left alone when it is on a control of the story's navigation that still
 *   exists (Next keeps it, so Enter and Space go on), otherwise on the primary button;
 * - on opening and on every new step, the page's scrolling column (`.main`, which scrolls on a
 *   phone) and the panel (which scrolls on a desktop) go back to the top at once, so the map and the
 *   step's title are what the visitor sees first;
 * - closing: focus on the site's title in the side column (`#site-title`, which takes focus with
 *   tabIndex -1), once the column is no longer inert. Not when the story closes without ever having
 *   been open (a site without a story).
 * Every focus set here uses preventScroll: on a phone, focusing a button in the sticky bar at the
 * foot of a long panel would otherwise scroll the column past the map.
 */
export function useStoryFocus(status: StoryStatus, run: number): void {
  const before = useRef<StoryStatus>(status);
  useEffect(() => {
    const was = before.current;
    before.current = status;
    if (status === 'open') {
      const active = document.activeElement;
      const keep = was === 'open' && active instanceof HTMLElement && active.isConnected && active.closest(NAVIGATION) !== null;
      if (!keep) document.querySelector<HTMLElement>(PRIMARY)?.focus({ preventScroll: true });
      for (const el of document.querySelectorAll<HTMLElement>('.main, .story-panel')) el.scrollTo({ top: 0, behavior: 'instant' });
    } else if (status === 'closed' && was === 'open') {
      document.getElementById('site-title')?.focus({ preventScroll: true });
    }
  }, [status, run]);
}

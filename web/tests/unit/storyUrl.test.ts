// The story's parameter in the address (src/story/storyUrl.ts; docs/MOTION_AND_STORY_BRIEF.md, 7.6).
import { describe, expect, it } from 'vitest';
import { storyIntent, storyQuery } from '../../src/story/storyUrl';

describe('what the address asks of the story', () => {
  it('the bare address (and one with only keys the app does not know) opens the cover', () => {
    for (const search of ['', '?', '?manifest=x.json', '?utm_source=y', '?story=', '?story=%20']) expect(storyIntent(search), search).toEqual({ kind: 'cover' });
  });

  it('any key of what the map shows, without `story`, opens the map as linked (old shared links keep working)', () => {
    for (const key of ['site=a', 'layer=b', 'date=2026-07-01', 'pair=a_b', 'overlays=x', 'lon=1', 'lat=2', 'z=3', 'play=1', 'story=&site=a'])
      expect(storyIntent(`?${key}`), key).toEqual({ kind: 'off' });
  });

  it('story=off opens the map, whatever else is there', () => {
    expect(storyIntent('?story=off')).toEqual({ kind: 'off' });
    expect(storyIntent('?story=off&site=a')).toEqual({ kind: 'off' });
  });

  it('story=<id> opens that step, whatever else is there (the app opens the cover for an id it does not know)', () => {
    expect(storyIntent('?story=step-3')).toEqual({ kind: 'step', id: 'step-3' });
    expect(storyIntent('?site=a&layer=b&story=step-3&lon=1&lat=2&z=3')).toEqual({ kind: 'step', id: 'step-3' });
    expect(storyIntent('?story=no-such-step')).toEqual({ kind: 'step', id: 'no-such-step' });
  });
});

describe('the query while the story is open', () => {
  it('keeps unknown keys, drops every selection key and play, and sets story', () => {
    const query = storyQuery('s1', null, '?manifest=m.json&site=a&layer=b&date=c&pair=p&overlays=o&lon=1&lat=2&z=3&play=1&story=old');
    expect(query).toBe('?manifest=m.json&story=s1');
  });

  it('names the site only when given one', () => {
    expect(new URLSearchParams(storyQuery('s1', 'other-site', '')).get('site')).toBe('other-site');
    expect(new URLSearchParams(storyQuery('s1', null, '?site=old')).has('site')).toBe(false);
  });

  it('opens the same step again (a reload, a copied link)', () => {
    expect(storyIntent(storyQuery('s2', 'x', '?layer=y'))).toEqual({ kind: 'step', id: 's2' });
    expect(storyIntent(storyQuery('s2', null, ''))).toEqual({ kind: 'step', id: 's2' });
  });
});

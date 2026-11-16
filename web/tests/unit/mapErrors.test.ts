import { describe, expect, it } from 'vitest';
import { fileLabel, rememberMapError, selectionKey, visibleMapError } from '../../src/map/mapErrors';

const A = 'https://example.org/data/sample/hh_2008-10-12.tif';
const B = 'https://example.org/data/sample/hh_2008-11-27.tif';

describe('map errors', () => {
  const here = selectionKey('sample', 'hh', 0);
  const there = selectionKey('sample', 'hh', 1);

  it('names the file, not the whole address', () => {
    expect(fileLabel(A)).toBe('hh_2008-10-12.tif');
  });

  it('shows a file problem only while that file is on screen', () => {
    const stored = rememberMapError([], { message: 'Could not load hh_2008-10-12.tif: 404', url: A }, here);
    expect(visibleMapError(stored, A, here)).toMatch(/hh_2008-10-12\.tif/);
    expect(visibleMapError(stored, B, there)).toBeNull();
  });

  it('keeps one file problem when another file fails later', () => {
    let stored = rememberMapError([], { message: 'A failed', url: A }, here);
    stored = rememberMapError(stored, { message: 'B failed', url: B }, here);
    expect(visibleMapError(stored, A, here)).toBe('A failed');
    expect(visibleMapError(stored, B, there)).toBe('B failed');
  });

  it('shows a problem without a file only on the screen where it happened', () => {
    const stored = rememberMapError([], { message: 'Map error' }, here);
    expect(visibleMapError(stored, A, here)).toBe('Map error');
    expect(visibleMapError(stored, B, there)).toBeNull();
    expect(visibleMapError(stored, A, selectionKey('other', 'hh', 0))).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { checkManifest, loadManifest, manifestUrl, resolveDataUrl } from '../../src/contract/manifest';
import { buildManifest } from '../fixtures/synthetic.mjs';

const clone = () => structuredClone(buildManifest()) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

describe('manifest guard', () => {
  it('accepts the synthetic fixture', () => {
    expect(checkManifest(buildManifest())).toMatchObject({ ok: true });
  });

  it('accepts a manifest with no sites', () => {
    expect(checkManifest({ ...clone(), sites: [] })).toMatchObject({ ok: true });
  });

  it('rejects a different schema version with a clear message', () => {
    const r = checkManifest({ ...clone(), schema: 2 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problems[0]).toMatch(/schema 1/);
  });

  it('rejects things that are not manifests', () => {
    expect(checkManifest(null).ok).toBe(false);
    expect(checkManifest('<!doctype html>').ok).toBe(false);
  });

  it.each([
    ['bounds with three numbers', (m: any) => (m.sites[0].bounds = [1, 2, 3])], // eslint-disable-line @typescript-eslint/no-explicit-any
    ['a per-date item without a date', (m: any) => delete m.sites[0].layers[0].items[0].date], // eslint-disable-line @typescript-eslint/no-explicit-any
    ['an unknown encoding', (m: any) => (m.sites[0].layers[0].encoding = { type: 'float32' })], // eslint-disable-line @typescript-eslint/no-explicit-any
    ['a sample site without a notice', (m: any) => delete m.sites[0].notice], // eslint-disable-line @typescript-eslint/no-explicit-any
    ['a stack without resolution', (m: any) => delete m.sites[0].stacks[0].resolution_m], // eslint-disable-line @typescript-eslint/no-explicit-any
    ['a static layer with two items', (m: any) => m.sites[0].layers[2].items.push({ url: 'x.tif' })], // eslint-disable-line @typescript-eslint/no-explicit-any
    ['a view centred off the map', (m: any) => (m.sites[0].view = { center: [10, 999], zoom: 9 })], // eslint-disable-line @typescript-eslint/no-explicit-any
    ['a view with a longitude beyond 180', (m: any) => (m.sites[0].view = { center: [242, 10], zoom: 9 })], // eslint-disable-line @typescript-eslint/no-explicit-any
    ['a view with one coordinate', (m: any) => (m.sites[0].view = { center: [10], zoom: 9 })], // eslint-disable-line @typescript-eslint/no-explicit-any
    ['a view with zoom 40', (m: any) => (m.sites[0].view = { center: [10, 10], zoom: 40 })], // eslint-disable-line @typescript-eslint/no-explicit-any
    ['a display range with min above max', (m: any) => (m.sites[0].layers[0].display = { min: 0, max: -25 })], // eslint-disable-line @typescript-eslint/no-explicit-any
  ])('rejects %s and says where', (_name, breakIt) => {
    const m = clone();
    breakIt(m);
    const r = checkManifest(m);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problems.join('\n')).toMatch(/sites\[0\]/);
  });

  it('accepts a view the map can show', () => {
    const m = clone();
    m.sites[0].view = { center: [-30, 20], zoom: 9 };
    expect(checkManifest(m)).toMatchObject({ ok: true });
  });

  it('explains a reversed display range in words', () => {
    const m = clone();
    m.sites[0].layers[0].display = { min: 0, max: -25 };
    const r = checkManifest(m);
    if (r.ok) throw new Error('expected a problem');
    expect(r.problems.join('\n')).toMatch(/display: min \(0\) must be less than max \(-25\)/);
  });
});

describe('manifest URL', () => {
  const base = 'https://example.org/app/';
  it('defaults to data/manifest.json next to the page', () => {
    expect(manifestUrl({ baseURI: base, search: '', dev: false })).toBe('https://example.org/app/data/manifest.json');
  });
  it('uses VITE_MANIFEST_URL when set', () => {
    expect(manifestUrl({ baseURI: base, search: '', envUrl: 'other/m.json', dev: false })).toBe('https://example.org/app/other/m.json');
  });
  it('honours ?manifest= only in development and only on the same origin', () => {
    expect(manifestUrl({ baseURI: base, search: '?manifest=fx/m.json', dev: true })).toBe('https://example.org/app/fx/m.json');
    expect(manifestUrl({ baseURI: base, search: '?manifest=fx/m.json', dev: false })).toBe('https://example.org/app/data/manifest.json');
    expect(manifestUrl({ baseURI: base, search: '?manifest=https://evil.example/m.json', dev: true })).toBe(
      'https://example.org/app/data/manifest.json',
    );
  });
  it('resolves data URLs against the manifest, not the page', () => {
    expect(resolveDataUrl('site/a.tif', 'https://example.org/app/data/manifest.json')).toBe('https://example.org/app/data/site/a.tif');
  });
});

describe('loadManifest', () => {
  const respond = (body: string, status = 200) => (async () => new Response(body, { status })) as typeof fetch;
  it('loads a good manifest', async () => {
    await expect(loadManifest('m.json', respond(JSON.stringify(buildManifest())))).resolves.toMatchObject({ schema: 1 });
  });
  it('explains an HTTP error', async () => {
    await expect(loadManifest('m.json', respond('', 404))).rejects.toThrow(/HTTP 404/);
  });
  it('explains an HTML page served instead of JSON', async () => {
    await expect(loadManifest('m.json', respond('<!doctype html><html></html>'))).rejects.toThrow(/not valid JSON/);
  });
});

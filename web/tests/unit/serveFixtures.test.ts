// The fixture server (scripts/serve-synthetic-fixtures.ts) on a real HTTP server: what it answers
// at /synthetic-fixtures/ and, with SERVE_FIXTURES_AS_DATA=1, at /data/ in front of the build's data.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createFixtureHandler, FIXTURES_AS_DATA_ENV, serveSyntheticFixtures } from '../../scripts/serve-synthetic-fixtures.ts';

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'fixtures-'));
  mkdirSync(path.join(dir, 'site'));
  writeFileSync(path.join(dir, 'manifest.json'), '{"synthetic":true}');
  writeFileSync(path.join(dir, 'site', 'a.tif'), Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** Starts a server whose handler falls through to one that answers "from the build". */
async function serve(asData: boolean): Promise<{ url: string; server: Server }> {
  const handler = createFixtureHandler(dir, { asData });
  const server = createServer((req, res) =>
    handler(req, res, () => {
      res.statusCode = 200;
      res.end('from the build');
    }),
  );
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, server };
}

describe('the fixture server', () => {
  it('without SERVE_FIXTURES_AS_DATA, /data/ is left to the build and the fixtures stay at /synthetic-fixtures/', async () => {
    const { url, server } = await serve(false);
    try {
      expect(await (await fetch(`${url}/data/manifest.json`)).text()).toBe('from the build');
      expect(await (await fetch(`${url}/synthetic-fixtures/manifest.json`)).text()).toBe('{"synthetic":true}');
    } finally {
      server.close();
    }
  });

  it('with it, /data/ serves the fixtures, and a file they lack is a 404, never the build’s file', async () => {
    const { url, server } = await serve(true);
    try {
      const manifest = await fetch(`${url}/data/manifest.json`);
      expect(manifest.headers.get('content-type')).toBe('application/json');
      expect(await manifest.text()).toBe('{"synthetic":true}');
      for (const missing of ['/data/real-site/site.json', '/data/site', '/data/..%2Fsecret.json', '/data/']) {
        const response = await fetch(`${url}${missing}`);
        expect(response.status, missing).toBe(404);
        expect(await response.text(), missing).not.toBe('from the build');
      }
      // Everything outside /data/ still reaches the build.
      expect(await (await fetch(`${url}/index.html`)).text()).toBe('from the build');
    } finally {
      server.close();
    }
  });

  it('answers byte ranges at /data/ as COG readers need', async () => {
    const { url, server } = await serve(true);
    try {
      const response = await fetch(`${url}/data/site/a.tif`, { headers: { Range: 'bytes=2-4' } });
      expect(response.status).toBe(206);
      expect(response.headers.get('content-range')).toBe('bytes 2-4/10');
      expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([2, 3, 4]);
    } finally {
      server.close();
    }
  });

  it('reads the environment variable when the plugin is made, and only the value "1" turns it on', async () => {
    const before = process.env[FIXTURES_AS_DATA_ENV];
    const used: Record<string, boolean> = {};
    try {
      for (const value of ['1', '0', 'true', undefined]) {
        if (value === undefined) delete process.env[FIXTURES_AS_DATA_ENV];
        else process.env[FIXTURES_AS_DATA_ENV] = value;
        const plugin = serveSyntheticFixtures(dir);
        let middleware: ((req: unknown, res: unknown, next: () => void) => void) | undefined;
        const fakeServer = { config: { logger: { warn: () => undefined } }, middlewares: { use: (fn: typeof middleware) => (middleware = fn) } };
        (plugin.configurePreviewServer as unknown as (s: unknown) => void)(fakeServer);
        let fellThrough = false;
        const res = { statusCode: 0, setHeader: () => undefined, end: () => undefined };
        middleware!({ url: '/data/nothing-here.json', headers: {} }, res, () => (fellThrough = true));
        used[String(value)] = !fellThrough;
      }
    } finally {
      if (before === undefined) delete process.env[FIXTURES_AS_DATA_ENV];
      else process.env[FIXTURES_AS_DATA_ENV] = before;
    }
    expect(used).toEqual({ '1': true, '0': false, true: false, undefined: false });
  });
});

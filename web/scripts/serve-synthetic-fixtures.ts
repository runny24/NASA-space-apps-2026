// A Vite plugin that serves the SYNTHETIC test fixtures (tests/fixtures/synthetic-out/) at
// /synthetic-fixtures/ on the dev server and on `vite preview`. It never copies them into the
// build, so synthetic data cannot be deployed by accident.
//
// With the environment variable SERVE_FIXTURES_AS_DATA=1 it also serves the same folder at /data/,
// in front of the build's own data folder: the browser tests (playwright.config.ts) set it, so they
// run the unchanged production build on the fixtures instead of on web/public/data. A file the
// fixtures lack is then a 404, never the real file. Without the variable nothing changes.
//
// Why hand-written: COG readers fetch byte ranges and need "206 Partial Content" answers. This
// small handler supports exactly the single-range requests they send, with no extra dependency.

import { createReadStream, statSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import type { Plugin } from 'vite';

const ROUTE = '/synthetic-fixtures/';
const DATA_ROUTE = '/data/';
export const FIXTURES_AS_DATA_ENV = 'SERVE_FIXTURES_AS_DATA';

const TYPES: Record<string, string> = {
  '.json': 'application/json',
  '.geojson': 'application/geo+json',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
};

type Handler = (req: IncomingMessage, res: ServerResponse, next: () => void) => void;

function notFound(res: ServerResponse) {
  res.statusCode = 404;
  res.end('Not found. Run `npm run fixtures` to generate the synthetic fixtures.');
}

/**
 * The request handler. `asData` adds the /data/ route; there a request the fixtures cannot answer
 * is a 404 and never falls through to the build's own data.
 */
export function createFixtureHandler(rootDir: string, options: { asData: boolean }): Handler {
  const root = path.resolve(rootDir);
  return (req, res, next) => {
    const urlPath = decodeURIComponent((req.url ?? '').split('?')[0] ?? '');
    let relative: string;
    let strict: boolean;
    const at = urlPath.indexOf(ROUTE);
    if (at !== -1) {
      relative = urlPath.slice(at + ROUTE.length);
      strict = false;
    } else if (options.asData && urlPath.startsWith(DATA_ROUTE)) {
      relative = urlPath.slice(DATA_ROUTE.length);
      strict = true;
    } else return next();
    const file = path.resolve(root, ...relative.split('/'));
    // Refuse anything that escapes the fixture folder (for example "../").
    if (!file.startsWith(root + path.sep)) return strict ? notFound(res) : next();
    let size: number;
    try {
      const info = statSync(file);
      if (!info.isFile()) return strict ? notFound(res) : next();
      size = info.size;
    } catch {
      return notFound(res);
    }
    res.setHeader('Content-Type', TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'no-store');
    const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
    if (match && (match[1] !== '' || match[2] !== '')) {
      // "bytes=a-b", "bytes=a-" or the suffix form "bytes=-n".
      let start = match[1] === '' ? size - Number(match[2]) : Number(match[1]);
      let end = match[1] === '' || match[2] === '' ? size - 1 : Number(match[2]);
      start = Math.max(0, start);
      end = Math.min(size - 1, end);
      if (start > end) {
        res.statusCode = 416;
        res.setHeader('Content-Range', `bytes */${size}`);
        res.end();
        return;
      }
      res.statusCode = 206;
      res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
      res.setHeader('Content-Length', String(end - start + 1));
      if (req.method === 'HEAD') return void res.end();
      createReadStream(file, { start, end }).pipe(res);
      return;
    }
    res.statusCode = 200;
    res.setHeader('Content-Length', String(size));
    if (req.method === 'HEAD') return void res.end();
    createReadStream(file).pipe(res);
  };
}

export function serveSyntheticFixtures(rootDir: string, options: { asData?: boolean } = {}): Plugin {
  const asData = options.asData ?? process.env[FIXTURES_AS_DATA_ENV] === '1';
  const handler = createFixtureHandler(rootDir, { asData });
  const announce = (logger: { warn: (msg: string) => void }) => {
    if (asData) logger.warn(`${FIXTURES_AS_DATA_ENV}=1: serving the SYNTHETIC test fixtures at /data/ instead of the real data.`);
  };
  return {
    name: 'serve-synthetic-fixtures',
    configureServer(server) {
      announce(server.config.logger);
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      announce(server.config.logger);
      server.middlewares.use(handler);
    },
  };
}

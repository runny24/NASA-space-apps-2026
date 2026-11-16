// The name and tagline: one constant (src/branding.ts), filled into index.html at build time. The
// browser tests check that the page shows them (e2e/startup.spec.ts: title, meta description, header).

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BRAND_PLACEHOLDERS, escapeHtml, fillBrandPlaceholders } from '../../scripts/brandHtml';
import { BRANDING } from '../../src/branding';

const web = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const indexHtml = readFileSync(path.join(web, 'index.html'), 'utf8');

/** Every source file of the vitest suite (tests/, without the fixture files it writes). */
function testSources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'synthetic-out' ? [] : testSources(file);
    return /\.(ts|mjs|js)$/.test(entry.name) ? [file] : [];
  });
}

describe('branding', () => {
  it('is not compared with the concept: a reworded line there must not block a deploy', () => {
    // Teammates edit the concept (docs/CONCEPT.md) directly on GitHub, and these tests are part of
    // `npm run check`, which gates every deploy. src/branding.ts is the one source of the name and
    // tagline; its comment names the line of the concept they were copied from.
    const readsTheConcept = /['"`]CONCEPT\.md['"`]|docs[\\/]CONCEPT\.md['"`]/;
    const sources = testSources(path.join(web, 'tests'));
    expect(sources.length).toBeGreaterThan(10);
    for (const file of sources) expect(readFileSync(file, 'utf8'), path.relative(web, file)).not.toMatch(readsTheConcept);
  });

  it('index.html takes its title and meta description from placeholders, not from written-out text', () => {
    expect(indexHtml).toContain(`<title>${BRAND_PLACEHOLDERS.name}</title>`);
    expect(indexHtml).toContain(`<meta name="description" content="${BRAND_PLACEHOLDERS.tagline}" />`);
    expect(indexHtml).not.toContain(BRANDING.name);
  });

  it('fills them in, escaped for HTML', () => {
    const html = fillBrandPlaceholders(indexHtml, BRANDING);
    expect(html).toContain(`<title>${BRANDING.name}</title>`);
    expect(html).toContain(`content="${BRANDING.tagline.replace("'", '&#39;')}"`);
    expect(html).not.toMatch(/__BRAND_/);
    const tricky = fillBrandPlaceholders(indexHtml, { name: 'A <b> & "c"', tagline: `it's "x" & <y>` });
    expect(tricky).toContain('<title>A &lt;b&gt; &amp; &quot;c&quot;</title>');
    expect(tricky).toContain('content="it&#39;s &quot;x&quot; &amp; &lt;y&gt;"');
  });

  it('refuses a page that has lost a placeholder', () => {
    expect(() => fillBrandPlaceholders('<title>x</title>', BRANDING)).toThrow(/__BRAND_NAME__/);
  });

  it('escapes the five HTML-significant characters', () => {
    expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;');
  });

  it('no "working title" is left in the app', () => {
    for (const file of ['src/App.tsx', 'src/components/AboutDialog.tsx', 'index.html', 'src/styles.css']) {
      expect(readFileSync(path.join(web, file), 'utf8'), file).not.toMatch(/working title|title-tag/i);
    }
  });
});

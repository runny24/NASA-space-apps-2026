// The story's colours, computed rather than eyeballed, the way colours.test.ts does for styles.css:
// text contrast on the story's own surfaces (WCAG 2, 4.5:1), marks and control edges (3:1), and the
// rule that interface colours are never data colours (web/MOTION.md, rule 8).

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { hexToRgb } from '../../src/map/ramps';

const src = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'src');
const css = readFileSync(path.join(src, 'story', 'story.css'), 'utf8');
const appCss = readFileSync(path.join(src, 'styles.css'), 'utf8');

/** The #rrggbb custom properties declared in every :root block of a stylesheet. */
function rootColours(source: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const block of source.matchAll(/:root\s*\{([^}]*)\}/g))
    for (const m of block[1]!.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) out[m[1]!] = m[2]!.toLowerCase();
  return out;
}

/**
 * The declarations of every top-level rule (outside @media) whose selector list includes exactly
 * `selector`, joined: `.a, .b { … }` counts for `.b`.
 */
function rule(source: string, selector: string): string {
  const top = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@media[^{]*\{(?:[^{}]*\{[^}]*\})*\s*\}/g, '');
  return [...top.matchAll(/([^{}]+)\{([^}]*)\}/g)]
    .filter((m) => m[1]!.split(',').map((s) => s.trim()).includes(selector))
    .map((m) => m[2]!)
    .join('\n');
}

const toLinear = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex: string) => {
  const [r, g, b] = hexToRgb(hex).map(toLinear) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG 2 contrast ratio, 1 to 21. */
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const c = rootColours(css);
const app = rootColours(appCss);

it('computes the WCAG ratio correctly', () => {
  expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
  expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
});

describe('text on the story surfaces (at least 4.5:1)', () => {
  const pairs: [string, string, string][] = [
    ['story-text', 'story-bg', 'the text of the panel, the cover and the date stamp'],
    ['story-muted', 'story-bg', 'the eyebrow, the credit, the figure labels, "Loading…"'],
    ['story-text', 'story-raised', 'Back and "Explore the map", the figure box'],
    ['story-muted', 'story-raised', "the overlay's credit and sentence in the figure box"],
    ['story-cta-text', 'story-cta-bg', 'Start the story and Next'],
    ['story-warning', 'story-bg', 'the mixed-release warning'],
  ];
  for (const [fg, bg, what] of pairs) {
    it(`${what}: --${fg} on --${bg}`, () => {
      expect(c[fg], `--${fg} is not a #rrggbb colour in a :root block of story.css`).toBeDefined();
      expect(c[bg], `--${bg} is not a #rrggbb colour in a :root block of story.css`).toBeDefined();
      expect(contrast(c[fg]!, c[bg]!)).toBeGreaterThanOrEqual(4.5);
    });
  }

  it('the rules use those colours', () => {
    expect(rule(css, '.story-panel')).toMatch(/background: var\(--story-bg\)/);
    expect(rule(css, '.story-panel')).toMatch(/color: var\(--story-text\)/);
    expect(rule(css, '.story-cover-block')).toMatch(/background: var\(--story-bg\)/);
    expect(rule(css, '.story-stamp')).toMatch(/background: var\(--story-bg\)/);
    expect(rule(css, '.story-stamp')).toMatch(/color: var\(--story-text\)/);
    expect(rule(css, '.story-eyebrow')).toMatch(/color: var\(--story-muted\)/);
    expect(rule(css, '.story-credit')).toMatch(/color: var\(--story-muted\)/);
    expect(rule(css, '.story-cta')).toMatch(/background: var\(--story-cta-bg\)/);
    expect(rule(css, '.story-cta')).toMatch(/color: var\(--story-cta-text\)/);
    expect(rule(css, '.story-quiet')).toMatch(/background: var\(--story-raised\)/);
    expect(rule(css, '.story-quiet')).toMatch(/color: var\(--story-text\)/);
    expect(rule(css, '.story-warning')).toMatch(/color: var\(--story-warning\)/);
  });

  it('the panel is solid, so its contrast never depends on the map behind it', () => {
    expect(c['story-bg']).toMatch(/^#[0-9a-f]{6}$/);
    expect(rule(css, '.story-panel')).not.toMatch(/opacity|rgba|transparent|color-mix/);
  });
});

describe('marks and control edges on the story surfaces (at least 3:1)', () => {
  it('the current step segment (amber) and the others stand out on the panel', () => {
    expect(contrast(c['story-accent']!, c['story-bg']!)).toBeGreaterThanOrEqual(3);
    expect(contrast(c['story-muted']!, c['story-bg']!)).toBeGreaterThanOrEqual(3);
    expect(rule(css, ".story-progress-step[aria-current='step'] .story-progress-mark")).toMatch(/background: var\(--story-accent\)/);
    expect(rule(css, '.story-progress-mark')).toMatch(/background: var\(--story-muted\)/);
  });

  it("the buttons' edges: the filled one by its fill, the quiet ones by a muted border", () => {
    expect(contrast(c['story-cta-bg']!, c['story-bg']!)).toBeGreaterThanOrEqual(3);
    expect(contrast(c['story-muted']!, c['story-bg']!)).toBeGreaterThanOrEqual(3);
    expect(contrast(c['story-muted']!, c['story-raised']!)).toBeGreaterThanOrEqual(3);
    expect(rule(css, '.story-quiet')).toMatch(/border: 1px solid var\(--story-muted\)/);
  });

  it("the warning's bar and the stamp's edge", () => {
    expect(contrast(c['story-warning']!, c['story-bg']!)).toBeGreaterThanOrEqual(3);
    expect(rule(css, '.story-warning')).toMatch(/border-left: 3px solid var\(--story-warning\)/);
    expect(rule(css, '.story-stamp')).toMatch(/border: 1px solid var\(--story-muted\)/);
  });

  it("the app's amber focus ring stands out on the story's surfaces", () => {
    expect(contrast(app.focus!, c['story-bg']!)).toBeGreaterThanOrEqual(3);
    expect(contrast(app.focus!, c['story-raised']!)).toBeGreaterThanOrEqual(3);
  });
});

describe('interface colours are not data colours (MOTION.md, rule 8)', () => {
  // The fire dots and the harvest classes of the real site (docs/MOTION_AND_STORY_BRIEF.md, Appendix A).
  const DATA = ['#d55e00', '#440154', '#3b528b', '#21918c', '#fde725', '#b8a3d8', '#d9d9d9'];

  it('no story token is a data colour', () => {
    for (const [name, hex] of Object.entries(c)) expect(DATA, `--${name}`).not.toContain(hex);
  });

  it('"where you are" is the app\'s amber', () => {
    expect(c['story-accent']).toBe(app.focus);
    expect(c['story-accent']).toBe('#ffb000');
  });
});

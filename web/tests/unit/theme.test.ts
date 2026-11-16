// The design tokens of src/styles.css, checked in both themes: the light one (the first :root block)
// and the dark one (the :root block under prefers-color-scheme: dark, laid over the light values).
// Computed, not eyeballed: WCAG 2 contrast of every pair of colours the interface puts together.
// tests/unit/colours.test.ts checks the light theme's basic pairs and the data colours; this file
// adds the dark theme and the pairs the design pass introduced (web/DESIGN.md).

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { hexToRgb } from '../../src/map/ramps';

const src = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'src');
const css = readFileSync(path.join(src, 'styles.css'), 'utf8');
const motionCss = readFileSync(path.join(src, 'styles', 'motion.css'), 'utf8');

type Tokens = Record<string, string>;

/** The #rrggbb custom properties declared in a block of declarations. */
const hexTokens = (block: string): Tokens =>
  Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1]!, m[2]!.toLowerCase()]));

const lightBlock = /:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
const darkBlock = /@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
const light = hexTokens(lightBlock);
const dark: Tokens = { ...light, ...hexTokens(darkBlock) };
const THEMES: [string, Tokens][] = [
  ['light', light],
  ['dark', dark],
];

/** The declarations of the first rule whose selector is exactly `selector`. */
function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
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

// Text: 4.5:1.
const TEXT_PAIRS: [string, string, string][] = [
  ['text', 'panel', 'body text'],
  ['text', 'bg', 'text on the page background'],
  ['text', 'inset', 'text on a quiet area (the date readout, the value read)'],
  ['text', 'notice-bg', 'the sample notice'],
  ['muted', 'panel', 'secondary text in panels'],
  ['muted', 'bg', 'secondary text on the page background ("Loading data")'],
  ['muted', 'inset', 'secondary text on a quiet area (the missing passes, a static layer note)'],
  ['accent', 'panel', 'secondary button text'],
  ['accent', 'inset', 'secondary button text under the pointer'],
  ['accent-text', 'accent', 'primary button text'],
  ['accent-text', 'accent-hover', 'primary button text under the pointer'],
  ['link', 'panel', 'a link'],
  ['link', 'bg', 'a link on the page background (the page shown after a crash)'],
  ['error', 'panel', 'error text'],
  ['error', 'error-bg', 'error text in its callout'],
  ['warning', 'panel', 'warning text'],
  ['warning', 'notice-bg', 'warning text in its callout (mixed releases)'],
  ['header-text', 'header-bg', 'the name'],
  ['header-muted', 'header-bg', 'the tagline'],
];

// Marks, rims and the edges of controls: 3:1.
const MARK_PAIRS: [string, string, string][] = [
  ['control-line', 'panel', 'the edge of a menu or an outlined button'],
  ['control-line', 'inset', 'the edge of a control on a quiet area'],
  ['control-line', 'bg', 'the edge of a control on the page background'],
  ['header-line', 'header-bg', 'the edge of the About button'],
  ['data', 'inset', 'a chart line on its frame'],
  ['data', 'panel', 'a data mark on a panel'],
  ['tick-available', 'panel', 'a timeline mark'],
  ['tick-missing', 'panel', 'a missing pass on the timeline'],
  ['text', 'panel', 'the rim of a legend swatch'],
  ['notice-line', 'panel', 'the bar of a callout'],
  ['bar', 'panel', 'a bar of the statistics panel'],
  ['text', 'bar', 'the whisker drawn over a bar'],
  ['muted', 'panel', 'the zero line of the bars'],
];

describe('design tokens', () => {
  it('the dark theme is found, and changes only tokens the light theme defines', () => {
    const darkOnly = hexTokens(darkBlock);
    expect(Object.keys(darkOnly).length).toBeGreaterThan(10);
    for (const name of Object.keys(darkOnly)) expect(light[name], `--${name} is not a light token`).toBeDefined();
    // A dark override of a colour token must be a hex colour too: any other form would be skipped
    // by the parser above, and the dark checks below would then run on the light value.
    for (const [, name, value] of darkBlock.matchAll(/--([\w-]+):\s*([^;]+);/g))
      if (light[name!]) expect(value!.trim(), `--${name} in the dark theme`).toMatch(/^#[0-9a-fA-F]{6}$/);
    // Surfaces and text really differ, so the test below checks two themes and not one twice.
    for (const name of ['bg', 'panel', 'inset', 'text', 'muted', 'accent', 'accent-text']) expect(dark[name], name).not.toBe(light[name]);
  });

  it('the roles keep their names: the rules use the tokens', () => {
    expect(rule('a')).toContain('color: var(--link)');
    expect(rule('.chart-line')).toContain('stroke: var(--data)');
    expect(rule('.chart-dot')).toContain('fill: var(--data)');
    expect(rule('.tick-current')).toContain('background: var(--highlight)');
    expect(rule('.header')).toContain('background: var(--header-bg)');
    expect(rule('.tagline')).toContain('color: var(--header-muted)');
    expect(rule('#map .maplibregl-ctrl-attrib')).toContain('color: var(--map-ink)');
    // The pairs checked below name these parts: their rules must really take those tokens.
    for (const selector of ['.missing-list', '.bars-tick', '.bars-note', '.overlay-map-note']) expect(rule(selector), selector).toContain('color: var(--muted)');
    expect(rule('.chart-label')).toContain('fill: var(--muted)');
    expect(rule(':focus-visible')).toContain('outline: 3px solid var(--focus)');
    expect(rule('.tick-current:focus-visible')).toContain('outline: 3px solid var(--focus)');
    expect(rule('.series figcaption')).toContain('color: var(--muted)');
  });
});

for (const [theme, c] of THEMES) {
  describe(`${theme} theme: text contrast (WCAG 2, at least 4.5:1)`, () => {
    for (const [fg, bg, what] of TEXT_PAIRS) {
      it(`${what}: --${fg} on --${bg}`, () => {
        expect(c[fg], `--${fg} is not a #rrggbb colour`).toBeDefined();
        expect(c[bg], `--${bg} is not a #rrggbb colour`).toBeDefined();
        expect(contrast(c[fg]!, c[bg]!)).toBeGreaterThanOrEqual(4.5);
      });
    }
  });

  describe(`${theme} theme: marks, rims and control edges (at least 3:1)`, () => {
    for (const [fg, bg, what] of MARK_PAIRS) {
      it(`${what}: --${fg} on --${bg}`, () => {
        expect(c[fg], `--${fg} is not a #rrggbb colour`).toBeDefined();
        expect(c[bg], `--${bg} is not a #rrggbb colour`).toBeDefined();
        expect(contrast(c[fg]!, c[bg]!)).toBeGreaterThanOrEqual(3);
      });
    }

    it('the focus ring: amber or its edge stands out on every surface it can land on', () => {
      // The ring is amber between two bands of --focus-edge. The two differ clearly, and on each
      // surface at least one of them does: panels, the page, the header, MapLibre's white buttons
      // and a black radar image.
      expect(contrast(c.focus!, c['focus-edge']!)).toBeGreaterThanOrEqual(3);
      for (const surface of [c.panel!, c.bg!, c.inset!, c['header-bg']!, '#ffffff', '#000000']) {
        expect(Math.max(contrast(c.focus!, surface), contrast(c['focus-edge']!, surface)), surface).toBeGreaterThanOrEqual(3);
      }
    });

    it('the date on screen: its amber mark or its rim stands out on the panel', () => {
      expect(rule('.tick-current')).toContain('outline: 2px solid var(--focus-edge)');
      expect(Math.max(contrast(c.highlight!, c.panel!), contrast(c['focus-edge']!, c.panel!))).toBeGreaterThanOrEqual(3);
    });
  });
}

describe('in every theme', () => {
  it("the credit line on the map keeps dark text on MapLibre's white", () => {
    expect(contrast(light['map-ink']!, '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(dark['map-ink']).toBe(light['map-ink']);
  });

  it('a contrast theme (forced colours) keeps the colours that carry meaning', () => {
    expect(rule('.swatch')).toContain('forced-color-adjust: none');
    expect(rule('.ramp')).toContain('forced-color-adjust: none');
    expect(rule('.overlay-dot')).toContain('forced-color-adjust: none');
    // Timeline marks: an acquisition stays filled, a date the layer lacks stays hollow, the date on
    // screen takes the theme's highlight, and an unavailable Previous or Next is greyed.
    const forced = /@media \(forced-colors: active\) \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
    const forcedRule = (selector: string) =>
      new RegExp(`\\n  ${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(forced)?.[1] ?? '';
    expect(forcedRule('.tick-available')).toContain('forced-color-adjust: none');
    expect(forcedRule('.tick-available')).toContain('background: CanvasText');
    expect(forcedRule('.tick-not-in-layer')).toContain('background: Canvas;');
    expect(forcedRule('.tick-current')).toContain('background: Highlight');
    expect(forced).toMatch(/button\[aria-disabled='true'\],\n {2}\.stepper button\[aria-disabled='true'\] \{[^}]*GrayText/);
    expect(forcedRule('.header')).toContain('border-bottom: 1px solid CanvasText');
  });

  it('timeline marks never animate, though they are buttons', () => {
    // Buttons ease their colours under the pointer (styles/motion.css); a mark is a button too, and
    // must not: the easing leaves .tick out, and .tick says so itself.
    expect(motionCss).toContain(':where(button:not(.tick))');
    expect(rule('.tick')).toContain('transition: none');
  });
});

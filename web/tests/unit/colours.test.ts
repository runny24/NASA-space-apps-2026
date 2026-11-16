// Colour checks, computed rather than eyeballed: text contrast of the stylesheet's colours (WCAG 2
// formula), and colour scales that keep their meaning for people with red-green colour blindness
// (protanopia and deuteranopia, simulated with the Machado, Oliveira and Fernandes 2009 matrices).

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEFAULT_OVERLAY_COLOR } from '../../src/map/overlayLayers';
import { hexToRgb, RAMPS, rampFor } from '../../src/map/ramps';
import { OVERLAY_COLOR, SYN_CLASS_ENCODING, SYN_HH_DISPLAY, SYN_HV_DISPLAY } from '../fixtures/synthetic.mjs';

const css = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'styles.css'), 'utf8');

/** The #rrggbb custom properties declared in :root. */
function rootColours(source: string): Record<string, string> {
  const root = /:root\s*\{([^}]*)\}/.exec(source)?.[1] ?? '';
  return Object.fromEntries([...root.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1]!, m[2]!.toLowerCase()]));
}

/** The declarations of the first rule whose selector is exactly `selector`. */
function rule(source: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(source)?.[1] ?? '';
}

const toLinear = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const linearRgb = (hex: string) => hexToRgb(hex).map(toLinear) as [number, number, number];
const luminance = ([r, g, b]: [number, number, number]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** WCAG 2 contrast ratio, 1 to 21. */
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(linearRgb(a)), luminance(linearRgb(b))].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

// Machado et al. 2009, severity 1.0, applied to linear RGB.
const SIMULATIONS: Record<string, number[]> = {
  'normal vision': [1, 0, 0, 0, 1, 0, 0, 0, 1],
  protanopia: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  deuteranopia: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
};

/** CIE L*a*b* (D65) of a colour as seen with the given simulation matrix. */
function lab(hex: string, m: number[]): [number, number, number] {
  const c = linearRgb(hex);
  const [r, g, b] = [0, 1, 2].map((i) => Math.min(1, Math.max(0, m[3 * i]! * c[0] + m[3 * i + 1]! * c[1] + m[3 * i + 2]! * c[2]))) as [
    number,
    number,
    number,
  ];
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
  const y = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
  const z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

/** CIE76 colour difference (distance in L*a*b*) between two colours seen with the same simulation. */
function deltaE(a: string, b: string, m: number[]): number {
  const [la, lb] = [lab(a, m), lab(b, m)];
  return Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2]);
}

/**
 * People without red-green vision still see blue against yellow (b* in L*a*b*). A diverging ramp
 * keeps its two sides apart for them when every pair of stops at the same distance from the centre
 * differs clearly in b*. Blue against orange or brown passes; red against green does not.
 */
function smallestBlueYellowGap(stops: readonly string[], m: number[]): number {
  let smallest = Infinity;
  for (let i = 0; i < Math.floor(stops.length / 2); i++) {
    smallest = Math.min(smallest, Math.abs(lab(stops[i]!, m)[2] - lab(stops[stops.length - 1 - i]!, m)[2]));
  }
  return smallest;
}
const BLUE_YELLOW_GAP = 15;

/** The stops of a ramp and 32 colours between each two, interpolated in sRGB. */
function rampShades(stops: readonly string[]): string[] {
  const hex = (rgb: number[]) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
  const out: string[] = [];
  for (let i = 0; i + 1 < stops.length; i++) {
    const [a, b] = [hexToRgb(stops[i]!), hexToRgb(stops[i + 1]!)];
    for (let k = 0; k <= 32; k++) out.push(hex(a.map((v, j) => v + ((b[j]! - v) * k) / 32)));
  }
  return out;
}

// Every ramp the app knows, by kind. A new ramp must be added to one list, and is then checked.
const DIVERGING = ['blue-orange', 'blue-red', 'BrewerPuOr11', 'BrewerRdBu11', 'BrewerBrBG11'];
const SEQUENTIAL = ['grey', 'viridis', 'BrewerGreys9'];

describe('text contrast (WCAG 2, at least 4.5:1 for body text)', () => {
  const c = rootColours(css);
  const pairs: [string, string, string][] = [
    ['text', 'panel', 'body text'],
    ['text', 'bg', 'text on the page background'],
    ['text', 'notice-bg', 'the sample notice'],
    ['muted', 'panel', 'secondary text in panels'],
    ['muted', 'bg', 'secondary text on the page background ("Loading data")'],
    ['accent', 'panel', 'secondary button text'],
    ['accent-text', 'accent', 'primary button text'],
    ['error', 'panel', 'error text'],
    ['warning', 'panel', 'warning text (mixed releases)'],
  ];
  for (const [fg, bg, what] of pairs) {
    it(`${what}: --${fg} on --${bg}`, () => {
      expect(c[fg], `--${fg} is not a #rrggbb colour in :root`).toBeDefined();
      expect(c[bg], `--${bg} is not a #rrggbb colour in :root`).toBeDefined();
      expect(contrast(c[fg]!, c[bg]!)).toBeGreaterThanOrEqual(4.5);
    });
  }

  it('the text rules use those colours', () => {
    expect(rule(css, '.warning')).toContain('color: var(--warning)');
    expect(rule(css, '.error')).toContain('color: var(--error)');
    expect(rule(css, '.muted')).toContain('color: var(--muted)');
    expect(rule(css, 'button.secondary')).toContain('color: var(--accent)');
  });

  it('computes the WCAG ratio correctly', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });
});

describe('state colours (at least 3:1 for marks and rings)', () => {
  const c = rootColours(css);
  it('the focus ring stands out on white panels and on dark radar images', () => {
    // Amber alone is 1.8:1 on white, so the ring carries a dark edge.
    expect(contrast(c['focus-edge']!, c.panel!)).toBeGreaterThanOrEqual(3);
    expect(contrast(c.focus!, '#000000')).toBeGreaterThanOrEqual(3);
    expect(contrast(c.focus!, c['focus-edge']!)).toBeGreaterThanOrEqual(3);
    expect(rule(css, ':focus-visible')).toContain('var(--focus-edge)');
  });

  it('timeline marks stand out on the panel', () => {
    expect(contrast(c['tick-available']!, c.panel!)).toBeGreaterThanOrEqual(3);
    expect(contrast(c['tick-missing']!, c.panel!)).toBeGreaterThanOrEqual(3);
  });

  it('a missing pass differs from an acquisition in shape, not only in colour', () => {
    // Hatched fill and a dashed rim, against the solid dot of an acquisition.
    expect(rule(css, '.tick-missing')).toMatch(/repeating-linear-gradient/);
    expect(rule(css, '.tick-missing')).toMatch(/dashed/);
    expect(rule(css, '.tick-available')).not.toMatch(/dashed/);
  });
});

describe('the bars of the statistics panel (components/BarsFigure.tsx)', () => {
  const c = rootColours(css);
  const normal = SIMULATIONS['normal vision']!;

  it('stand out on the panel, and the dark whisker stands out on them (3:1 each)', () => {
    expect(c.bar, '--bar is not a #rrggbb colour in :root').toBeDefined();
    expect(contrast(c.bar!, c.panel!)).toBeGreaterThanOrEqual(3);
    expect(contrast(c.bar!, c.text!)).toBeGreaterThanOrEqual(3);
    expect(rule(css, '.bars-bar')).toContain('background: var(--bar)');
    expect(rule(css, '.bars-whisker')).toContain('var(--text)');
  });

  it('are neutral: neither red nor green (CIE L*a*b* hue)', () => {
    const [, a, b] = lab(c.bar!, normal);
    expect(a, 'a*: not green').toBeGreaterThan(-10);
    const hue = (Math.atan2(b, a) * 180) / Math.PI;
    // Reds and oranges lie between about -20 and 70 degrees of hue, greens between about 100 and 200.
    expect(hue < -20 && hue > -160, `hue ${hue.toFixed(0)}`).toBe(true);
  });

  it('draw every line as a border, so a contrast theme (which drops backgrounds) still shows the bar, the whisker and its caps', () => {
    expect(rule(css, '.bars-bar')).toMatch(/border: 1px solid/);
    expect(rule(css, '.bars-zero-value')).toMatch(/border-left: 2px solid/);
    expect(rule(css, '.bars-whisker')).toMatch(/border-top: 2px solid/);
    expect(rule(css, '.bars-whisker::before,\n.bars-whisker::after')).toMatch(/border-left: 2px solid/);
    expect(rule(css, '.bars-zero-line')).toMatch(/border-left: 1px solid/);
  });
});

describe('colour ramps survive red-green colour blindness', () => {
  it('every ramp is classified, so none escapes these checks', () => {
    expect([...DIVERGING, ...SEQUENTIAL].sort()).toEqual(Object.keys(RAMPS).sort());
  });

  for (const name of DIVERGING) {
    it(`${name}: lightest at the centre, and its two sides stay apart for every vision`, () => {
      const stops = RAMPS[name]!;
      const lightness = stops.map((s) => lab(s, SIMULATIONS['normal vision']!)[0]);
      expect(Math.max(...lightness)).toBe(lightness[(stops.length - 1) / 2]);
      for (const [vision, m] of Object.entries(SIMULATIONS)) {
        expect(smallestBlueYellowGap(stops, m), vision).toBeGreaterThanOrEqual(BLUE_YELLOW_GAP);
      }
    });
  }

  for (const name of SEQUENTIAL) {
    it(`${name}: lightness runs one way, so the order reads without any hue`, () => {
      const lightness = RAMPS[name]!.map((s) => lab(s, SIMULATIONS['normal vision']!)[0]);
      const steps = lightness.slice(1).map((l, i) => l - lightness[i]!);
      expect(steps.every((d) => d > 0) || steps.every((d) => d < 0)).toBe(true);
    });
  }

  it('the simulation itself is right: red and green, far apart in normal vision, look alike without red-green vision', () => {
    // The ramp checks above could pass with a plausible typo in a matrix; this one cannot. The
    // colours are the two ends of ColorBrewer's 5-class RdYlGn.
    const [red, green] = ['#d7191c', '#1a9641'];
    expect(deltaE(red, green, SIMULATIONS['normal vision']!)).toBeGreaterThan(100);
    expect(deltaE(red, green, SIMULATIONS.protanopia!)).toBeLessThan(30);
    expect(deltaE(red, green, SIMULATIONS.deuteranopia!)).toBeLessThan(30);
    // The control: the protanopia matrix transposed leaves them clearly apart, so the check sees it.
    const transposed = [0, 3, 6, 1, 4, 7, 2, 5, 8].map((i) => SIMULATIONS.protanopia![i]!);
    expect(deltaE(red, green, transposed)).toBeGreaterThan(30);
  });

  it('the side-by-side rule rejects a red-green ramp (ColorBrewer RdYlGn)', () => {
    // Both of its ends lean yellow (positive b*), so it fails even in normal vision: this shows the
    // rule at work, not the simulation, which the test above checks.
    const redYellowGreen = ['#a50026', '#d73027', '#f46d43', '#fdae61', '#fee08b', '#ffffbf', '#d9ef8b', '#a6d96a', '#66bd63', '#1a9850', '#006837'];
    expect(smallestBlueYellowGap(redYellowGreen, SIMULATIONS.deuteranopia!)).toBeLessThan(BLUE_YELLOW_GAP);
    expect(smallestBlueYellowGap(redYellowGreen, SIMULATIONS.protanopia!)).toBeLessThan(BLUE_YELLOW_GAP);
  });
});

describe("the synthetic fixture's class and overlay colours", () => {
  // The fixture's colours are what the legend, the overlay and the bars are tested with, so they
  // keep the same rules as real data: apart for every vision, and never red against green.
  const classes = SYN_CLASS_ENCODING.classes.map((c) => c.color);
  const all = [...classes, OVERLAY_COLOR];

  for (const [vision, m] of Object.entries(SIMULATIONS)) {
    it(`every two of them stay apart with ${vision}`, () => {
      for (let a = 0; a < all.length; a++) {
        for (let b = a + 1; b < all.length; b++) {
          expect(deltaE(all[a]!, all[b]!, m), `${all[a]} vs ${all[b]}`).toBeGreaterThanOrEqual(20);
        }
      }
    });
  }

  // The overlay is drawn on the per-date radar layers, so a fill in its colour must never be the
  // colour of a radar pixel: it stays apart from every colour of their ramps (ends included).
  const radarRamps = [...new Set([SYN_HH_DISPLAY.ramp, SYN_HV_DISPLAY.ramp])];
  for (const ramp of radarRamps) {
    const shades = rampShades(rampFor({ display: { min: 0, max: 1, ramp } }));
    for (const [vision, m] of Object.entries(SIMULATIONS)) {
      it(`the overlay colour stays apart from every colour of the ${ramp} ramp with ${vision}`, () => {
        const nearest = Math.min(...shades.map((s) => deltaE(OVERLAY_COLOR, s, m)));
        expect(nearest, `${OVERLAY_COLOR} against the ${ramp} ramp`).toBeGreaterThanOrEqual(20);
      });
    }
  }

  it('none is red against green: no pair has one strongly red and one strongly green (CIE a*)', () => {
    const a = all.map((hex) => lab(hex, SIMULATIONS['normal vision']!)[1]);
    expect(a.some((v) => v > 25) && a.some((v) => v < -25), a.map((v) => v.toFixed(0)).join(', ')).toBe(false);
    // The control: ColorBrewer's red and green ends are caught.
    const control = ['#d7191c', '#1a9641'].map((hex) => lab(hex, SIMULATIONS['normal vision']!)[1]);
    expect(control.some((v) => v > 25) && control.some((v) => v < -25)).toBe(true);
  });
});

describe('the default overlay colour (an overlay whose manifest gives none)', () => {
  const normal = SIMULATIONS['normal vision']!;
  for (const ramp of ['grey', 'BrewerGreys9']) {
    const shades = rampShades(rampFor({ display: { min: 0, max: 1, ramp } }));
    for (const [vision, m] of Object.entries(SIMULATIONS)) {
      it(`stays apart from every colour of the ${ramp} ramp with ${vision}`, () => {
        const nearest = Math.min(...shades.map((s) => deltaE(DEFAULT_OVERLAY_COLOR, s, m)));
        expect(nearest).toBeGreaterThanOrEqual(20);
      });
    }
  }

  it('is not a grey, not a red and not a green (CIE L*a*b* chroma and hue)', () => {
    const [, a, b] = lab(DEFAULT_OVERLAY_COLOR, normal);
    expect(Math.hypot(a, b), 'chroma').toBeGreaterThan(40);
    expect(a, 'a*: not green').toBeGreaterThan(0);
    // Reds and oranges lie between about -20 and 70 degrees of hue; this one lies outside.
    const hue = (Math.atan2(b, a) * 180) / Math.PI;
    expect(hue < -20 || hue > 70, `hue ${hue.toFixed(0)}`).toBe(true);
    // The control: a plain red is caught.
    const [, ra, rb] = lab('#d7191c', normal);
    const redHue = (Math.atan2(rb, ra) * 180) / Math.PI;
    expect(redHue > -20 && redHue < 70).toBe(true);
  });
});

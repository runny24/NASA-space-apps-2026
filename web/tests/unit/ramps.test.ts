import { describe, expect, it } from 'vitest';
import type { CategoricalEncoding } from '../../src/contract/encoding';
import type { Layer } from '../../src/contract/manifest';
import { classColorTable, cogSourceUrl, rampFor, rampLimits, RAMPS } from '../../src/map/ramps';

const backscatter = {
  encoding: { type: 'linear-uint8', nodata: 0, lo: -35, hi: 5 },
  display: { min: -25, max: 0, ramp: 'grey' },
} as Pick<Layer, 'encoding' | 'display'>;

describe('ramps', () => {
  it('builds a continuous cog:// URL with pixel-code limits', () => {
    expect(cogSourceUrl('https://x.org/a.tif', backscatter)).toBe('cog://https://x.org/a.tif#color:["#000000","#ffffff"],65,223,c');
  });

  it('converts limits when a file declares a GDAL scale and offset', () => {
    const scale = 40 / 254;
    const limits = rampLimits(backscatter, { scale, offset: -35 - scale });
    expect(limits.min).toBeCloseTo(-25, 0);
    expect(limits.max).toBeCloseTo(0, 0);
  });

  it('falls back by kind of scale for an unknown ramp name', () => {
    expect(rampFor({ display: { min: 0, max: 1, ramp: 'nope' } })).toBe(RAMPS.grey);
    expect(rampFor({ display: { min: -1, max: 1, ramp: 'nope', diverging: true } })).toBe(RAMPS['blue-orange']);
    expect(rampFor({ display: { min: 0, max: 1, ramp: 'Gray' } })).toBe(RAMPS.grey);
  });

  it('knows the ColorBrewer names the pipeline writes', () => {
    expect(rampFor({ display: { min: -6, max: 6, ramp: 'BrewerPuOr11', diverging: true } })).toBe(RAMPS.BrewerPuOr11);
    expect(rampFor({ display: { min: -25, max: 0, ramp: 'BrewerGreys9' } })).toBe(RAMPS.BrewerGreys9);
  });

  it('never pairs pure red with pure green at the ends of a ramp', () => {
    for (const stops of Object.values(RAMPS)) {
      const ends = [stops[0], stops[stops.length - 1]].join(' ');
      expect(ends.includes('#ff0000') && ends.includes('#00ff00')).toBe(false);
    }
  });

  it('gives categorical layers a plain URL and a colour table with transparent nodata', () => {
    const enc: CategoricalEncoding = { type: 'categorical-uint8', nodata: 0, classes: [{ value: 2, label: 'b', color: '#e69f00' }] };
    expect(cogSourceUrl('https://x.org/c.tif', { encoding: enc })).toBe('cog://https://x.org/c.tif');
    const table = classColorTable(enc);
    expect(Array.from(table.subarray(8, 12))).toEqual([0xe6, 0x9f, 0x00, 255]);
    expect(Array.from(table.subarray(0, 4))).toEqual([0, 0, 0, 0]);
  });
});

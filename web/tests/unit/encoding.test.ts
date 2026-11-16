import { describe, expect, it } from 'vitest';
import {
  classOf,
  clippedSide,
  decodeLinear,
  describeCode,
  displayRangeToCodes,
  encodeLinear,
  type CategoricalEncoding,
  type LinearEncoding,
} from '../../src/contract/encoding';

const DB: LinearEncoding = { type: 'linear-uint8', nodata: 0, lo: -35, hi: 5 };

describe('linear-uint8 encoding (docs/DATA_CONTRACT.md)', () => {
  it('maps code 1 to lo and 255 to hi', () => {
    expect(decodeLinear(1, DB)).toBe(-35);
    expect(decodeLinear(255, DB)).toBe(5);
  });

  it('treats 0 and out-of-range codes as nodata, never as a number', () => {
    expect(decodeLinear(0, DB)).toBeNull();
    expect(decodeLinear(256, DB)).toBeNull();
    expect(decodeLinear(Number.NaN, DB)).toBeNull();
  });

  it('round-trips every code', () => {
    for (let code = 1; code <= 255; code++) expect(encodeLinear(decodeLinear(code, DB)!, DB)).toBe(code);
  });

  it('round-trips values to within half a step', () => {
    const step = (DB.hi - DB.lo) / 254;
    for (const v of [-35, -20.04, -12.008, 0, 4.99]) {
      expect(Math.abs(decodeLinear(encodeLinear(v, DB), DB)! - v)).toBeLessThanOrEqual(step / 2 + 1e-9);
    }
  });

  it('clips values outside [lo, hi] to 1..255 so 0 stays nodata', () => {
    expect(encodeLinear(-100, DB)).toBe(1);
    expect(encodeLinear(100, DB)).toBe(255);
  });

  it('converts a display range in dB to pixel codes', () => {
    // -25 dB: 1 + round(254 * 10 / 40) = 1 + round(63.5) = 65; 0 dB: 1 + round(254 * 35 / 40) = 223
    expect(displayRangeToCodes({ min: -25, max: 0 }, DB)).toEqual({ min: 65, max: 223, reversed: false });
  });

  it('flags a downward encoding as reversed', () => {
    const down: LinearEncoding = { type: 'linear-uint8', nodata: 0, lo: 5, hi: -35 };
    expect(displayRangeToCodes({ min: -25, max: 0 }, down)).toEqual({ min: 33, max: 192, reversed: true });
  });

  it('shows the end codes as bounds, because values beyond lo and hi were clipped to them', () => {
    expect(describeCode(255, DB, 'dB')).toBe('5.0 dB or more');
    expect(describeCode(1, DB, 'dB')).toBe('-35.0 dB or less');
    expect(describeCode(254, DB, 'dB')).toBe('4.8 dB');
    expect(describeCode(2, DB, 'dB')).toBe('-34.8 dB');
    expect(clippedSide(128, DB)).toBeNull();
  });

  it('swaps the bound words for a downward encoding', () => {
    const down: LinearEncoding = { type: 'linear-uint8', nodata: 0, lo: 5, hi: -35 };
    expect(clippedSide(255, down)).toBe('below');
    expect(describeCode(255, down, 'dB')).toBe('-35.0 dB or less');
    expect(describeCode(1, down, 'dB')).toBe('5.0 dB or more');
  });

  it('describes values with units and nodata as "no data"', () => {
    expect(describeCode(128, DB, 'dB')).toBe('-15.0 dB');
    expect(describeCode(0, DB, 'dB')).toBe('no data');
    expect(describeCode(null, DB, 'dB')).toBe('no data');
  });
});

describe('categorical-uint8 encoding', () => {
  const CLASSES: CategoricalEncoding = {
    type: 'categorical-uint8',
    nodata: 0,
    classes: [
      { value: 1, label: 'water', color: '#0072b2' },
      { value: 2, label: 'land', color: '#e69f00' },
    ],
  };
  it('looks up class labels', () => {
    expect(classOf(2, CLASSES)?.label).toBe('land');
    expect(describeCode(1, CLASSES, '')).toBe('water');
  });
  it('shows nodata and unknown codes as "no data"', () => {
    expect(classOf(0, CLASSES)).toBeNull();
    expect(describeCode(7, CLASSES, '')).toBe('no data');
  });
});

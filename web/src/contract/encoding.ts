// Pixel codes <-> physical values, exactly as docs/DATA_CONTRACT.md ("Pixel values") defines them.
// Files hold uint8 codes: 0 is nodata, 1..255 are values. The manifest's `encoding` says what a
// code means. Everything the app shows to a person goes through these functions.

import type { Encoding, Layer } from './manifest';

export type LinearEncoding = Extract<Encoding, { type: 'linear-uint8' }>;
export type CategoricalEncoding = Extract<Encoding, { type: 'categorical-uint8' }>;

export const NODATA = 0;

/** Code -> physical value for linear-uint8. Returns null for nodata (0) or anything outside 1..255. */
export function decodeLinear(code: number, enc: LinearEncoding): number | null {
  if (!Number.isFinite(code) || code < 1 || code > 255) return null;
  return enc.lo + ((code - 1) * (enc.hi - enc.lo)) / 254;
}

/** Physical value -> code for linear-uint8, clipped to 1..255 (0 stays reserved for nodata). */
export function encodeLinear(value: number, enc: LinearEncoding): number {
  const code = 1 + Math.round((254 * (value - enc.lo)) / (enc.hi - enc.lo));
  return Math.min(255, Math.max(1, code));
}

/**
 * A layer's display range (physical units) as pixel codes for the colour ramp.
 * The cog:// protocol compares its ramp limits with the stored codes, not with dB, so passing
 * dB limits would paint everything one colour. If the encoding runs downwards (hi < lo) the codes
 * come out swapped; `reversed` then tells the caller to flip the ramp so the colours still follow
 * the physical values.
 */
export function displayRangeToCodes(
  display: { min: number; max: number },
  enc: LinearEncoding,
): { min: number; max: number; reversed: boolean } {
  const a = encodeLinear(display.min, enc);
  const b = encodeLinear(display.max, enc);
  return a <= b ? { min: a, max: b, reversed: false } : { min: b, max: a, reversed: true };
}

/** The class a categorical code stands for, or null for nodata and unknown codes. */
export function classOf(code: number, enc: CategoricalEncoding) {
  if (code === NODATA) return null;
  return enc.classes.find((c) => c.value === code) ?? null;
}

/**
 * Decimal places worth showing: the last digit is about the size of one encoding step (0.16 dB for
 * the usual -35..5 dB range gives 1 decimal), never more than 2. More digits would be false precision.
 */
export function decimalsFor(enc: LinearEncoding): number {
  const step = Math.abs(enc.hi - enc.lo) / 254;
  if (step <= 0) return 2;
  return Math.min(2, Math.max(0, Math.round(-Math.log10(step))));
}

/** A number with its unit, e.g. "-12.3 dB". */
export function formatValue(value: number, unit: string, decimals: number): string {
  const text = value.toFixed(decimals);
  return unit ? `${text} ${unit}` : text;
}

/**
 * Which side of the encoded range a code was clipped at, or null when it is an ordinary value.
 * Values beyond lo or hi are stored as the end codes 1 and 255, so those two codes mean "this much
 * or less" and "this much or more", not an exact number. 'below' means the true value is at or
 * below the decoded one. When the encoding runs downwards (hi < lo) the ends swap.
 */
export type ClippedSide = 'below' | 'above';

export function clippedSide(code: number | null, enc: Encoding): ClippedSide | null {
  if (enc.type !== 'linear-uint8' || (code !== 1 && code !== 255)) return null;
  const upwards = enc.hi > enc.lo;
  if (code === 255) return upwards ? 'above' : 'below';
  return upwards ? 'below' : 'above';
}

/** The words after a clipped value: " or less", " or more", or nothing. */
export function clippedSuffix(side: ClippedSide | null | undefined): string {
  if (side === 'below') return ' or less';
  if (side === 'above') return ' or more';
  return '';
}

/**
 * A code as text a person can read: "-12.3 dB", "5.0 dB or more" for a clipped end code, a class
 * label, or "no data". Never shows nodata as 0 (docs/ARCHITECTURE.md, rules for the app).
 */
export function describeCode(code: number | null, enc: Encoding, unit: string): string {
  if (code === null || !Number.isFinite(code)) return 'no data';
  if (enc.type === 'categorical-uint8') return classOf(code, enc)?.label ?? 'no data';
  const value = decodeLinear(code, enc);
  if (value === null) return 'no data';
  return formatValue(value, unit, decimalsFor(enc)) + clippedSuffix(clippedSide(code, enc));
}

/** Convenience for a layer. */
export function describeLayerCode(code: number | null, layer: Pick<Layer, 'encoding' | 'unit'>): string {
  return describeCode(code, layer.encoding, layer.unit);
}

// A number from a statistics file as text a person can read: enough significant digits that a
// small rate keeps its size (0.0123 stays 0.0123, never 0.01 or 0), no exponent for ordinary values,
// whole numbers and counts left whole, trailing zeros trimmed, and no locale (the same text on every
// machine, like the dates elsewhere in the app).

/** Significant digits shown by default: enough for a value that carries an uncertainty interval. */
export const SIGNIFICANT_DIGITS = 3;

/** Below this size a value is not ordinary any more, and exponent notation is clearer than zeros. */
const SMALLEST_PLAIN = 1e-6;

/**
 * `value` with about `significant` significant digits: 0.0123 -> "0.0123", 12.345 -> "12.3",
 * 0.19 -> "0.19", 12345 -> "12345" (the integer part is never rounded away), 0 -> "0".
 */
export function formatNumber(value: number, significant = SIGNIFICANT_DIGITS): string {
  if (!Number.isFinite(value)) return String(value);
  if (value === 0) return '0';
  const size = Math.abs(value);
  if (size < SMALLEST_PLAIN) return trimZeros(value.toPrecision(significant));
  const decimals = Math.max(0, significant - 1 - Math.floor(Math.log10(size)));
  return trimZeros(value.toFixed(decimals));
}

/** "0.1900" -> "0.19", "7.00" -> "7", "1.50e-7" -> "1.5e-7"; whole numbers are left alone. */
function trimZeros(text: string): string {
  const [mantissa = text, exponent] = text.split('e');
  const trimmed = mantissa.includes('.') ? mantissa.replace(/0+$/, '').replace(/\.$/, '') : mantissa;
  // "-0" can only come from rounding a tiny negative number; it is still zero.
  const clean = trimmed === '-0' ? '0' : trimmed;
  return exponent === undefined ? clean : `${clean}e${exponent}`;
}

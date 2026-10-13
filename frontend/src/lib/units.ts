// Weights are stored in kg to the gram (rule 1) and shown in the user's unit.

export type Unit = 'lb' | 'kg';

export const KG_PER_LB = 0.45359237;

/** A weight entered in `unit`, in kg rounded to the gram, as the API stores it. */
export function toKg(value: number, unit: Unit): number {
  const kg = unit === 'kg' ? value : value * KG_PER_LB;
  return Math.round(kg * 1000) / 1000;
}

/** A stored kg weight in `unit`, unrounded. Round only for display (formatWeight). */
export function fromKg(kg: number, unit: Unit): number {
  return unit === 'kg' ? kg : kg / KG_PER_LB;
}

/** At most one decimal, without a trailing ".0": 172, 78.5. */
export function formatWeight(value: number): string {
  return String(Math.round(value * 10) / 10);
}

// Plausible adult bodyweights; anything outside is almost certainly a typo.
const BODYWEIGHT_RANGE: Record<Unit, [number, number]> = { lb: [45, 660], kg: [20, 300] };

export type Parsed = { ok: true; value: number } | { ok: false; message: string };

function parseNumber(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  return Number(normalized);
}

/** Reads a bodyweight typed in `unit`. */
export function parseBodyweight(text: string, unit: Unit): Parsed {
  const value = parseNumber(text);
  if (value === null) return { ok: false, message: 'Enter your bodyweight.' };
  const [min, max] = BODYWEIGHT_RANGE[unit];
  if (value < min || value > max) {
    return { ok: false, message: `Enter a bodyweight between ${min} and ${max} ${unit}.` };
  }
  return { ok: true, value };
}

/** What a typed weight becomes when the unit is switched. Non-numbers are left as typed. */
export function convertInput(text: string, from: Unit, to: Unit): string {
  const value = parseNumber(text);
  if (value === null || from === to) return text;
  return formatWeight(fromKg(toKg(value, from), to));
}

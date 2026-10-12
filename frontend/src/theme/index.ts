// The app's theme, built from design/tokens.json. Never hard-code a color, font or radius
// outside this folder. Amber (accent) means you, today and the main action; ice (ghost)
// means your past self. Never use either decoratively.

import tokens from '../../../design/tokens.json';

import { type FontFamily, fontFiles } from './fontFiles';

export { fontFiles };

export const colors = tokens.color;
export const chart = tokens.chart;
export const radius = tokens.radius;
export const space = tokens.space;
export const frame = tokens.frame;

/** A static Archivo instance. `width` is the design's font-stretch percent. */
export function font(weight: number, width = 100): { fontFamily: FontFamily } {
  const fontFamily = `Archivo-${width}-${weight}` as FontFamily;
  if (__DEV__ && !(fontFamily in fontFiles)) {
    throw new Error(`No ${fontFamily} font. Add (${width}, ${weight}) to scripts/make-fonts.py.`);
  }
  return { fontFamily };
}

/** CSS line-height and em letter-spacing are relative; React Native wants pixels. */
const lineHeight = (size: number, ratio: number) => Math.round(size * ratio);
const em = (size: number, value: number) => size * value;

const body = tokens.font.body;
const numbers = tokens.font.numbers;
const headings = tokens.font.headings;

export const type = {
  body: {
    ...font(body.weight),
    fontSize: body.size,
    lineHeight: lineHeight(body.size, body.lineHeight),
  },
  small: {
    ...font(body.weight),
    fontSize: tokens.font.small.size,
    lineHeight: lineHeight(tokens.font.small.size, body.lineHeight),
  },
  /** Condensed, heavy, tabular figures (baked into the font). Line height 1. */
  number: {
    ...font(numbers.weight, numbers.widthPercent),
  },
  h1: {
    ...font(headings.weight, headings.widthPercent),
    fontSize: 30,
    lineHeight: lineHeight(30, 1.1),
    letterSpacing: em(30, -0.01),
  },
  h2: {
    ...font(650, 92),
    fontSize: 17,
    lineHeight: lineHeight(17, 1.25),
  },
  /** Bottom tab labels (07). */
  tabLabel: {
    ...font(600),
    fontSize: 11,
    lineHeight: lineHeight(11, body.lineHeight),
  },
} as const;

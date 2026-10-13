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
  /** The 16 px muted line under a title (01, 02, sign-in, sign-up). */
  lead: {
    ...font(body.weight),
    fontSize: 16,
    lineHeight: 16 * body.lineHeight,
  },
  /** 14 px notes and info-box text (02). */
  note: {
    ...font(body.weight),
    fontSize: 14,
    lineHeight: 14 * body.lineHeight,
  },
  /** The big title on Welcome (01). */
  display: {
    ...font(headings.weight, headings.widthPercent),
    fontSize: 42,
    lineHeight: lineHeight(42, 1.1),
    letterSpacing: em(42, -0.01),
  },
  /** The unit after a big number, like "lb" on 02. */
  unitSuffix: {
    ...font(600),
    fontSize: 20,
    lineHeight: lineHeight(20, 1.3),
  },
  /** Field and section labels (.label), and small emphasis like "Today" on 01. */
  label: {
    ...font(600),
    fontSize: tokens.font.small.size,
    lineHeight: 18,
  },
  /** Text typed into a field (.field). */
  field: {
    ...font(600),
    fontSize: 17,
  },
  /** Primary button label: 17 px (.btn on 07–11) or 16 px (`buttonMedium`, .btn on 01–02). */
  button: {
    ...font(650),
    fontSize: 17,
    lineHeight: 22,
  },
  buttonMedium: {
    ...font(650),
    fontSize: 16,
    lineHeight: 22,
  },
  /** Secondary and text button labels (.btn2). */
  buttonSecondary: {
    ...font(600),
    fontSize: 15,
    lineHeight: 20,
  },
  /** Chip labels (.chip). */
  chip: {
    ...font(550),
    fontSize: 14,
    lineHeight: 18,
  },
  /** Segmented control labels (.seg): 15 px, or 17 px on 52 px segments (02). */
  segment: {
    ...font(600),
    fontSize: 15,
    lineHeight: 20,
  },
  segmentLarge: {
    ...font(650),
    fontSize: 17,
    lineHeight: 22,
  },
  /** The sync status pill on Today (07). */
  pill: {
    ...font(600),
    fontSize: 12,
    lineHeight: 16,
  },
  /** Small text sitting in a 15 px line, so its line is body height (04's "6 exercises"). */
  smallInBody: {
    ...font(body.weight),
    fontSize: tokens.font.small.size,
    lineHeight: lineHeight(body.size, body.lineHeight),
  },
  /** Body text at 600: the date on Today (07). */
  bodyStrong: {
    ...font(600),
    fontSize: body.size,
    lineHeight: lineHeight(body.size, body.lineHeight),
  },
  /** Today's day name (07): 38 px. */
  dayTitle: {
    ...font(headings.weight, headings.widthPercent),
    fontSize: 38,
    lineHeight: lineHeight(38, 1.1),
    letterSpacing: em(38, -0.01),
  },
  /** 13 px at 650: today's day in the rotation strip (07). */
  labelHeavy: {
    ...font(650),
    fontSize: tokens.font.small.size,
    lineHeight: 18,
  },
  /** Screen titles in a header row (04, 06): 24 px. */
  h1Small: {
    ...font(headings.weight, headings.widthPercent),
    fontSize: 24,
    lineHeight: lineHeight(24, 1.1),
    letterSpacing: em(24, -0.01),
  },
  /** Card and row titles: 18 px (03, 04), 16 px (`rowTitle`, 06). 17 px is `h2` (05). */
  cardTitle: {
    ...font(650, 92),
    fontSize: 18,
    lineHeight: 18 * 1.25,
  },
  rowTitle: {
    ...font(650, 92),
    fontSize: 16,
    lineHeight: 20,
  },
  /** Small tags: day names (03), muscle and equipment (05), rest (05). */
  tag: {
    ...font(550),
    fontSize: 12,
    lineHeight: 12 * body.lineHeight,
  },
  /** The search field on 06. */
  search: {
    ...font(body.weight),
    fontSize: 17,
  },
  /** A stepper button label, like −15 / +15 (.tbtn). */
  stepper: {
    ...font(650),
    fontSize: 15,
    lineHeight: 20,
  },
  /** The "Overload" wordmark next to the mark (01). */
  wordmark: {
    ...font(750, 80),
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: 0.2,
  },
} as const;

/**
 * A big number in the number face (`.num`): line height 1, so it sits tight against its
 * label. `tracking` is the design's letter-spacing in em (01 and 02 use -0.005), resolved at
 * this size; pass `trackingSize` to resolve it at another size, as CSS does for a nested
 * span (the "×" on 01 inherits the number's tracking).
 */
export function figure(size: number, tracking = 0, trackingSize = size) {
  return {
    ...type.number,
    fontSize: size,
    lineHeight: size,
    letterSpacing: em(trackingSize, tracking),
  };
}

/** The design's number tracking (01, 02): letter-spacing -0.005em. */
export const NUMBER_TRACKING = -0.005;

/** The light "×" between a weight and its reps ("20 × 6"), at `size`, inside a number of
 * `numberSize` whose tracking it inherits. */
export function figureTimes(size: number, numberSize: number) {
  return { ...figure(size, NUMBER_TRACKING, numberSize), ...font(300, 68) };
}

/** Sizes of the big numbers in the designs. `times*` place the "×" (01: 52 px raised 8 px
 * beside 80 px numbers, 72 px raised 12 px beside 120 px ones). */
export const figures = {
  welcomeLastTime: { size: 80, timesSize: 52, timesGap: 8, timesRaise: 8 },
  welcomeToday: { size: 120, timesSize: 72, timesGap: 10, timesRaise: 12 },
  /** The bodyweight input on 02. */
  bodyweight: 64,
  /** Best set last time on Today (07). */
  lastTime: 20,
  /** The day number in its circle on 04. */
  dayStep: 17,
  /** The rest length in the exercise options sheet. */
  restValue: 32,
} as const;

export type SetFigureSize = (typeof figures)['welcomeLastTime' | 'welcomeToday'];

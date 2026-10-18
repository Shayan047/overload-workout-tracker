import { Platform } from 'react-native';

/**
 * Review mode: open the web build with `?review=1` and every screen shows fixed sample data
 * (the bicep curl sample, Friday October 9, the Arnold split) instead of the user's own, and
 * animations jump to their end. scripts/screenshot.mjs uses it so screenshots line up with
 * the designs. It's read once at startup, so it lasts while you navigate.
 */
export const isReviewMode: boolean =
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('review') === '1';

/** Friday, October 9, 2026, 6:05 PM local time: "today" in the designs. */
export const REVIEW_NOW = new Date(2026, 9, 9, 18, 5);

/** The current time; fixed to REVIEW_NOW in review mode. Use this instead of `new Date()`. */
export function now(): Date {
  return isReviewMode ? new Date(REVIEW_NOW) : new Date();
}

/** Tells the screenshot script the screen has rendered with its fonts. Web only. */
export function markReviewReady(): void {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    document.documentElement.dataset.reviewReady = 'true';
  }
}

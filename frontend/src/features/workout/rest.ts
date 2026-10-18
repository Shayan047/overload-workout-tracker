// The rest timer, from timestamps only: the end time is stored, never a running count, so
// it stays right when the app is in the background or killed. Rest lengths are never
// recorded (rule 5); this lives on the phone only.

export type Rest = {
  /** The exercise row whose set started it. */
  rowId: string;
  endsAt: string;
  /** The full length, after any ±15. */
  totalSeconds: number;
};

/** Haptic at this many seconds left. */
export const WARN_AT_SECONDS = 10;

export function startRest(rowId: string, seconds: number, now: Date): Rest {
  return { rowId, endsAt: new Date(now.getTime() + seconds * 1000).toISOString(), totalSeconds: seconds };
}

/** Whole seconds left, rounded up, so "0:00" shows only once it's over. */
export function remainingSeconds(rest: Rest, now: Date): number {
  return Math.max(0, Math.ceil((new Date(rest.endsAt).getTime() - now.getTime()) / 1000));
}

/** The share of the rest still to go (the bar on 08). */
export function restProgress(rest: Rest, now: Date): number {
  return rest.totalSeconds > 0 ? remainingSeconds(rest, now) / rest.totalSeconds : 0;
}

/** +15 / −15. Taking off what's left ends the rest (null). */
export function adjustRest(rest: Rest, deltaSeconds: number, now: Date): Rest | null {
  if (remainingSeconds(rest, now) + deltaSeconds <= 0) return null;
  return {
    ...rest,
    endsAt: new Date(new Date(rest.endsAt).getTime() + deltaSeconds * 1000).toISOString(),
    totalSeconds: rest.totalSeconds + deltaSeconds,
  };
}

/** Which haptic is due now, given those already given. */
export function dueAlert(rest: Rest, now: Date, given: { warned: boolean; ended: boolean }): 'warn' | 'end' | null {
  const left = remainingSeconds(rest, now);
  if (left === 0) return given.ended ? null : 'end';
  if (left <= WARN_AT_SECONDS && rest.totalSeconds > WARN_AT_SECONDS && !given.warned) return 'warn';
  return null;
}

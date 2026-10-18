import { adjustRest, dueAlert, remainingSeconds, restProgress, startRest } from '../rest';

const T0 = new Date(2026, 9, 9, 18, 4, 17);
const at = (seconds: number) => new Date(T0.getTime() + seconds * 1000);

describe('the rest timer works from timestamps, so backgrounding never breaks it', () => {
  const rest = startRest('row-1', 90, T0);

  test('starting: ends after the exercise’s rest length', () => {
    expect(rest).toEqual({ rowId: 'row-1', endsAt: at(90).toISOString(), totalSeconds: 90 });
  });

  test('remaining time counts down to 0 and stays there', () => {
    expect(remainingSeconds(rest, T0)).toBe(90);
    expect(remainingSeconds(rest, at(43))).toBe(47);
    expect(remainingSeconds(rest, at(42.4))).toBe(48); // rounds up: "0:01" until it's over
    expect(remainingSeconds(rest, at(95))).toBe(0);
  });

  test('progress is the share left: 0:47 of 1:30 is 52%', () => {
    expect(restProgress(rest, at(43))).toBeCloseTo(0.522, 3);
    expect(restProgress(rest, at(200))).toBe(0);
  });

  test('+15 and −15 move the end and the total', () => {
    expect(adjustRest(rest, 15, at(43))).toEqual({ rowId: 'row-1', endsAt: at(105).toISOString(), totalSeconds: 105 });
    expect(adjustRest(rest, -15, at(43))).toEqual({ rowId: 'row-1', endsAt: at(75).toISOString(), totalSeconds: 75 });
  });

  test('−15 with 15 s or less left ends the rest', () => {
    expect(adjustRest(rest, -15, at(76))).toBeNull();
  });
});

describe('alerts: a haptic at 10 s left and at the end, each once', () => {
  const rest = startRest('row-1', 90, T0);
  const none = { warned: false, ended: false };

  test('nothing before 10 s left', () => {
    expect(dueAlert(rest, at(79), none)).toBeNull();
  });

  test('10 s left warns once', () => {
    expect(dueAlert(rest, at(80), none)).toBe('warn');
    expect(dueAlert(rest, at(81), { warned: true, ended: false })).toBeNull();
  });

  test('the end, once; a late check (back from the background) skips the warning', () => {
    expect(dueAlert(rest, at(90), { warned: true, ended: false })).toBe('end');
    expect(dueAlert(rest, at(120), none)).toBe('end');
    expect(dueAlert(rest, at(121), { warned: false, ended: true })).toBeNull();
  });

  test('a rest of 10 s or less only alerts at the end', () => {
    const short = startRest('row-1', 10, T0);
    expect(dueAlert(short, T0, none)).toBeNull();
  });
});

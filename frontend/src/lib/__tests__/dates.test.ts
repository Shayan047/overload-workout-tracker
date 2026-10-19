import { localDate } from '../dates';

test('localDate is the calendar day where the user is, as YYYY-MM-DD', () => {
  expect(localDate(new Date(2026, 9, 9, 23, 59))).toBe('2026-10-09');
  expect(localDate(new Date(2026, 0, 3, 0, 1))).toBe('2026-01-03');
});

import { detailText, nextText } from '../restOver';

describe('the rest-over alert names the next set (26, 27)', () => {
  const next = { name: 'Bicep curl', setNumber: 3, planned: 4, lastTime: '20 × 5' };

  test('the detail line: exercise, set and how many are planned', () => {
    expect(detailText(next)).toBe('Bicep curl, set 3 of 4 next');
  });

  test('an extra set past the plan drops the "of"', () => {
    expect(detailText({ ...next, setNumber: 5 })).toBe('Bicep curl, set 5 next');
  });

  test('after the last exercise there is no next set', () => {
    expect(detailText(null)).toBe('Time to finish your workout');
  });

  test('the plain text (lock screen, screen readers, iOS) adds last time', () => {
    expect(nextText(next)).toBe('Bicep curl, set 3 of 4 next. Last time 20 × 5.');
    expect(nextText({ ...next, lastTime: null })).toBe('Bicep curl, set 3 of 4 next.');
    expect(nextText(null)).toBe('Time to finish your workout.');
  });
});

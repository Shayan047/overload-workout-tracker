import { convertInput, formatWeight, fromKg, parseBodyweight, toKg } from '../units';

describe('toKg / fromKg', () => {
  test('pounds are stored in kg to the gram (rule 1)', () => {
    expect(toKg(10, 'lb')).toBe(4.536);
    expect(toKg(172, 'lb')).toBe(78.018);
    expect(toKg(78.5, 'kg')).toBe(78.5);
  });

  test('converting back shows the number the user entered', () => {
    expect(fromKg(toKg(172, 'lb'), 'lb')).toBeCloseTo(172, 2);
    expect(fromKg(78.018, 'kg')).toBe(78.018);
  });
});

describe('formatWeight', () => {
  test('one decimal at most, no trailing .0', () => {
    expect(formatWeight(172)).toBe('172');
    expect(formatWeight(171.95)).toBe('172');
    expect(formatWeight(78.04)).toBe('78');
    expect(formatWeight(78.45)).toBe('78.5');
  });
});

describe('parseBodyweight', () => {
  test('reads a number in the chosen unit', () => {
    expect(parseBodyweight('172', 'lb')).toEqual({ ok: true, value: 172 });
    expect(parseBodyweight(' 78.5 ', 'kg')).toEqual({ ok: true, value: 78.5 });
  });

  test('accepts a comma as the decimal separator', () => {
    expect(parseBodyweight('78,5', 'kg')).toEqual({ ok: true, value: 78.5 });
  });

  test('asks for a number when it is empty or not a number', () => {
    expect(parseBodyweight('', 'lb')).toEqual({ ok: false, message: 'Enter your bodyweight.' });
    expect(parseBodyweight('abc', 'lb')).toEqual({ ok: false, message: 'Enter your bodyweight.' });
    expect(parseBodyweight('1.2.3', 'lb')).toEqual({ ok: false, message: 'Enter your bodyweight.' });
  });

  test('rejects weights no adult has, in the unit shown', () => {
    expect(parseBodyweight('20', 'lb')).toEqual({
      ok: false,
      message: 'Enter a bodyweight between 45 and 660 lb.',
    });
    expect(parseBodyweight('400', 'kg')).toEqual({
      ok: false,
      message: 'Enter a bodyweight between 20 and 300 kg.',
    });
  });
});

describe('convertInput', () => {
  test('switching units converts what was typed', () => {
    expect(convertInput('172', 'lb', 'kg')).toBe('78');
    expect(convertInput('78', 'kg', 'lb')).toBe('172');
    expect(convertInput('80', 'kg', 'lb')).toBe('176.4');
  });

  test('leaves anything that is not a number alone', () => {
    expect(convertInput('', 'lb', 'kg')).toBe('');
    expect(convertInput('abc', 'lb', 'kg')).toBe('abc');
    expect(convertInput('172', 'lb', 'lb')).toBe('172');
  });
});

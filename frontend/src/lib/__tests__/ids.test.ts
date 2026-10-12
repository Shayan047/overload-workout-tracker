import { derivedId, newId } from '../ids';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

test('newId makes distinct v4 UUIDs', () => {
  const a = newId();
  const b = newId();
  expect(a).toMatch(UUID);
  expect(a[14]).toBe('4');
  expect(a).not.toBe(b);
});

test('derivedId matches the backend, so preset rows created offline get the same ids', () => {
  // Python: uuid.uuid5(UUID("11111111-2222-4333-8444-555555555555"), "day:0") and "day:2:exercise:1"
  const split = '11111111-2222-4333-8444-555555555555';
  expect(derivedId(split, 'day:0')).toBe('8ec520e9-e8f9-5f0f-be6e-7ea280c63772');
  expect(derivedId(split, 'day:2:exercise:1')).toBe('916a7074-117c-57a6-98ac-0aff04018329');
});

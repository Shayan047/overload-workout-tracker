import type { OutboxEntry } from '../outbox';
import {
  pendingWorkoutIds,
  withPendingBodyweight,
  withPendingHistory,
  withPendingWorkouts,
  type WorkoutHistoryItem,
  type WorkoutSummary,
} from '../pendingWrites';

const workout = (id: string, ended_at: string | null): WorkoutSummary => ({
  id,
  split_day_id: 'day-1',
  title: 'Push',
  started_at: '2026-10-09T17:00:00.000Z',
  ended_at,
  bodyweight_kg: 78,
});

const entry = (method: OutboxEntry['method'], path: string, body?: unknown): OutboxEntry => ({
  id: path,
  method,
  path,
  body,
  createdAt: '2026-10-09T18:00:00.000Z',
});

describe('withPendingWorkouts: a refresh never undoes a workout the server has not received', () => {
  test('a finish still waiting to be sent stays finished', () => {
    const server = [workout('w-1', null)];
    const pending = [
      entry('PUT', '/workouts/w-1', { ...workout('w-1', '2026-10-09T18:00:00.000Z'), id: undefined }),
      entry('PUT', '/sets/s-1', {}),
    ];
    expect(withPendingWorkouts(server, pending)).toEqual([workout('w-1', '2026-10-09T18:00:00.000Z')]);
  });

  test('a workout the server has never seen is added; its bodyweight falls back to the server’s rule', () => {
    const body = { split_day_id: 'day-1', title: 'Push', started_at: '2026-10-09T17:00:00.000Z' };
    expect(withPendingWorkouts([], [entry('PUT', '/workouts/w-2', body)])).toEqual([
      { id: 'w-2', ...body, ended_at: null, bodyweight_kg: 0 },
    ]);
  });

  test('a delete waiting to be sent hides the workout', () => {
    expect(withPendingWorkouts([workout('w-1', null)], [entry('DELETE', '/workouts/w-1')])).toEqual([]);
  });
});

describe('history and bodyweight keep what the phone has not sent yet', () => {
  const item = (id: string, started: string, sets = 20): WorkoutHistoryItem => ({
    ...workout(id, `${started}T19:00:00.000Z`),
    started_at: `${started}T18:00:00.000Z`,
    sets,
    ahead: 1,
    compared: 2,
  });

  test('pending workouts: ids with a workout write still in the outbox', () => {
    const pending = [entry('PUT', '/workouts/w-1', {}), entry('PUT', '/sets/s-1', {}), entry('DELETE', '/workouts/w-2')];
    expect([...pendingWorkoutIds(pending)].sort()).toEqual(['w-1', 'w-2']);
  });

  test('a recap made on the phone stays until the server has the workout, newest first', () => {
    const server = [item('w-1', '2026-10-07')];
    const cached = [item('w-3', '2026-10-09'), item('w-1', '2026-10-07', 99), item('w-0', '2026-10-01')];
    const pending = [entry('PUT', '/workouts/w-3', {})];
    expect(withPendingHistory(server, cached, pending).map((w) => [w.id, w.sets])).toEqual([
      ['w-3', 20],
      ['w-1', 20],
    ]);
  });

  test('a workout deleted on the phone leaves history at once', () => {
    expect(withPendingHistory([item('w-1', '2026-10-07')], [], [entry('DELETE', '/workouts/w-1')])).toEqual([]);
  });

  test('bodyweight logged offline stays; the local value wins while it is unsent', () => {
    const server = [{ id: 'b-1', weight_kg: 78, measured_on: '2026-10-01' }];
    const cached = [
      { id: 'b-1', weight_kg: 77.5, measured_on: '2026-10-01' },
      { id: 'b-2', weight_kg: 78.2, measured_on: '2026-10-09' },
    ];
    const pending = [entry('PUT', '/bodyweight-entries/b-1', {}), entry('PUT', '/bodyweight-entries/b-2', {})];
    expect(withPendingBodyweight(server, cached, pending)).toEqual(cached);
    expect(withPendingBodyweight(server, cached, [])).toEqual(server);
  });
});

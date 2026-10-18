import type { OutboxEntry } from '../outbox';
import { withPendingWorkouts, type WorkoutSummary } from '../pendingWrites';

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

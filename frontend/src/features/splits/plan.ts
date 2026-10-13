// "Save split": the outbox writes that turn the saved split into the draft. Only what
// changed is written. Order matters for the API's reference checks: the split, then its
// days, then their exercises, then deletions (exercises before days; deleting a day also
// deletes its exercises on the server).

import type { OutboxEntry } from '@/api/outbox';

import type { SplitDraft } from './draft';

export type Write = Pick<OutboxEntry, 'method' | 'path' | 'body'>;

export function planSplitWrites(original: SplitDraft | null, draft: SplitDraft): Write[] {
  const writes: Write[] = [];
  const deletes: Write[] = [];

  const splitBody = { name: draft.name.trim(), repeat_mode: draft.repeatMode };
  if (!original || original.name.trim() !== splitBody.name || original.repeatMode !== draft.repeatMode) {
    writes.push({ method: 'PUT', path: `/splits/${draft.id}`, body: splitBody });
  }

  const oldDays = new Map(original?.days.map((day, position) => [day.id, { day, position }]));
  const oldRows = new Map(
    original?.days.flatMap((day) => day.exercises.map((e, position) => [e.id, { e, dayId: day.id, position }] as const)),
  );

  draft.days.forEach((day, position) => {
    const body = { split_id: draft.id, name: day.name.trim(), position, weekday: day.weekday };
    const old = oldDays.get(day.id);
    if (!old || old.day.name.trim() !== body.name || old.position !== position || old.day.weekday !== day.weekday) {
      writes.push({ method: 'PUT', path: `/split-days/${day.id}`, body });
    }
  });

  draft.days.forEach((day) => {
    day.exercises.forEach((e, position) => {
      const body = { split_day_id: day.id, exercise_id: e.exerciseId, position, rest_seconds: e.restSeconds };
      const old = oldRows.get(e.id);
      if (
        !old ||
        old.dayId !== day.id ||
        old.position !== position ||
        old.e.exerciseId !== e.exerciseId ||
        old.e.restSeconds !== e.restSeconds
      ) {
        writes.push({ method: 'PUT', path: `/split-day-exercises/${e.id}`, body });
      }
    });
  });

  const keptDays = new Set(draft.days.map((d) => d.id));
  const keptRows = new Set(draft.days.flatMap((d) => d.exercises.map((e) => e.id)));
  for (const [rowId, { dayId }] of oldRows) {
    if (keptDays.has(dayId) && !keptRows.has(rowId)) {
      deletes.push({ method: 'DELETE', path: `/split-day-exercises/${rowId}` });
    }
  }
  for (const dayId of oldDays.keys()) {
    if (!keptDays.has(dayId)) deletes.push({ method: 'DELETE', path: `/split-days/${dayId}` });
  }

  return [...writes, ...deletes];
}

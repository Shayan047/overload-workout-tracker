// The split being edited, shared by Edit split (04), Edit a day (05) and Add exercises (06).
// Kept in memory: nothing is written until "Save split".

import { useSyncExternalStore } from 'react';

import { isReviewMode } from '@/review/reviewMode';
import { sampleSplitDraft } from '@/review/sampleData';

import type { SplitDraft } from './draft';

type State = {
  draft: SplitDraft;
  /** The split as saved, to write only what changed; null for a new split. */
  original: SplitDraft | null;
} | null;

let state: State = isReviewMode ? { draft: sampleSplitDraft, original: sampleSplitDraft } : null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export const draftStore = {
  get: (): State => state,
  start(draft: SplitDraft, original: SplitDraft | null) {
    state = { draft, original };
    emit();
  },
  update(edit: (draft: SplitDraft) => SplitDraft) {
    if (!state) return;
    state = { ...state, draft: edit(state.draft) };
    emit();
  },
  /** After saving: the draft is now what's saved. */
  saved() {
    if (!state) return;
    state = { draft: state.draft, original: state.draft };
    emit();
  },
  clear() {
    state = null;
    emit();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function useDraft(): State {
  return useSyncExternalStore(draftStore.subscribe, draftStore.get, draftStore.get);
}

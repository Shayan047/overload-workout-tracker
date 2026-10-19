import { useEffect } from 'react';
import { View } from 'react-native';

import { useSettings } from '@/api/settings';
import { useSplitTree } from '@/api/splits';
import { isReviewMode } from '@/review/reviewMode';
import { colors } from '@/theme';

import { draftFromTree } from './draft';
import { draftStore, useDraft } from './draftStore';
import { EditSplitScreen } from './EditSplitScreen';
import { PickSplitScreen } from './PickSplitScreen';

/** The Splits tab: your active split in Edit split (04), or Pick a split (03) if there's none. */
export function SplitsTab() {
  const settings = useSettings();
  const activeId = settings.data?.active_split_id ?? null;
  const tree = useSplitTree(activeId);
  const state = useDraft();

  useEffect(() => {
    // Start editing the active split, unless it's already being edited.
    if (tree.data && state?.draft.id !== tree.data.id) {
      const saved = draftFromTree(tree.data);
      draftStore.start(saved, saved);
    }
  }, [tree.data, state?.draft.id]);

  if (isReviewMode) return <EditSplitScreen mode="tab" />;
  if (!activeId) return <PickSplitScreen mode="app" />;
  if (!state || state.draft.id !== activeId) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  return <EditSplitScreen mode="tab" />;
}

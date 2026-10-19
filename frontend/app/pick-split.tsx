import { useLocalSearchParams } from 'expo-router';

import { PickSplitScreen } from '@/features/splits/PickSplitScreen';

export default function PickSplit() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  return <PickSplitScreen mode={mode === 'onboarding' ? 'onboarding' : 'app'} />;
}

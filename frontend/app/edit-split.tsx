import { useLocalSearchParams } from 'expo-router';

import { EditSplitScreen } from '@/features/splits/EditSplitScreen';

export default function EditSplit() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  return <EditSplitScreen mode={mode === 'onboarding' ? 'onboarding' : 'app'} />;
}

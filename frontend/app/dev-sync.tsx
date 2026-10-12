import { Redirect } from 'expo-router';

import { SyncCheckScreen } from '@/features/dev/SyncCheckScreen';

// Development builds only; release builds send anyone who lands here to Today.
export default function DevSync() {
  return __DEV__ ? <SyncCheckScreen /> : <Redirect href="/" />;
}

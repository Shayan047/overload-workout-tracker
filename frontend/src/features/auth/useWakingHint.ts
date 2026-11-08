import { useEffect, useState } from 'react';

import { WAKING_HINT_MS } from '@/api/config';

/** True once `busy` has lasted a few seconds: the free server is probably waking up (it
 * sleeps when idle and takes about a minute), so the button can say so. */
export function useWakingHint(busy: boolean): boolean {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!busy) {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), WAKING_HINT_MS);
    return () => clearTimeout(timer);
  }, [busy]);
  return slow;
}

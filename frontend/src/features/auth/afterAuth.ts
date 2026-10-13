import { router } from 'expo-router';

/** After signing in or up, start fresh on Today. Onboarding screens shared with the app
 * (Pick a split, Edit split…) would otherwise stay in the history underneath. */
export function goToTodayAfterAuth(): void {
  if (router.canDismiss()) router.dismissAll();
  router.replace('/');
}

import { requireOptionalNativeModule } from 'expo';

export type RestAlarmOptions = {
  /** When the rest ends, in epoch ms. */
  endsAt: number;
  title: string;
  /** The plain text: lock screen, screen readers. */
  body: string;
  /** The custom layout's line under the title: "Bicep curl, set 3 of 4 next". */
  detail: string;
  /** Last time's set of the same number, "20 × 5"; empty if none. */
  lastTime: string;
  /** The notification's main button: "Start set 3". */
  startLabel: string;
  /** The rest-over screen's deep link. */
  url: string;
  sound: boolean;
};

type RestAlarmModule = {
  /** An exact alarm at `endsAt`, replacing any earlier one. */
  schedule(options: RestAlarmOptions): void;
  cancel(): void;
  /** Clears the posted alert (Rest's over is on screen); the alarm itself is already done. */
  dismissAlert(): void;
  /** The rest end set by the banner's "+15 sec" while the app was away, once; null if none. */
  takeExtendedEnd(): number | null;
  /** Android 14+ asks the user to allow full-screen alerts; false until they do. */
  canUseFullScreen(): boolean;
  openFullScreenSettings(): void;
  setShowOverLockScreen(show: boolean): void;
  dismissKeyguard(): void;
  sendToBack(): void;
};

/** The rest-over alarm (Android). Null where the native module isn't built in: Expo Go, the
 * web build and iOS, which keep the scheduled notification instead. */
export const RestAlarm = requireOptionalNativeModule<RestAlarmModule>('RestAlarm');

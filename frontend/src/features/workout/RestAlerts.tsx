// The rest timer's alerts. While the app is open: a haptic at 10 s left and at the end.
// For a locked phone or another app, on Android builds with the RestAlarm module: an exact
// alarm that opens the rest-over screen (26) over the lock screen, or shows its banner (27)
// over another app. Elsewhere (Expo Go, iOS): a local notification scheduled for the end,
// with the sound when "Rest alert sound" is on.

import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { useSettings } from '@/api/settings';
import { useExercises } from '@/api/splits';
import { cachedLastSessions } from '@/api/workouts';
import { isReviewMode, now } from '@/review/reviewMode';

import { RestAlarm } from '../../../modules/rest-alarm';
import { setText } from './ghost';
import { dueAlert, type Rest } from './rest';
import { useWorkoutActions } from './useWorkoutActions';
import { currentExercise, setsFor } from './workout';
import { type Saved, useActiveWorkout } from './workoutStore';

const NOTIFICATION_ID = 'rest-timer';
// Android fixes a channel's sound when it's created, so sound on and off are two channels.
const CHANNEL = { sound: 'rest-timer', silent: 'rest-timer-silent' };
const supported = Platform.OS !== 'web' && !isReviewMode;

if (supported) {
  // In the foreground the timer card is on screen: no banner, just the sound (if any).
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => ({
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: notification.request.content.data?.sound === true,
      shouldSetBadge: false,
    }),
  });
}

let prepared: Promise<boolean> | null = null;

/** Asks for permission once and creates the Android channels. False if not allowed. */
/** Creates a channel. expo-notifications 58 creates the silent channel (sound: null) but then
 * fails to hand its settings back to JavaScript, so the call rejects although the channel
 * exists. Without this, that rejection stopped the permission request below and no rest
 * alert was ever scheduled. */
async function channel(id: string, options: Notifications.NotificationChannelInput) {
  try {
    await Notifications.setNotificationChannelAsync(id, options);
  } catch {
    // The channel was created; only its description failed to come back.
  }
}

function prepare(): Promise<boolean> {
  prepared ??= (async () => {
    // With the RestAlarm module the alarm has its own channels; these are only for the
    // scheduled notification (Expo Go).
    if (Platform.OS === 'android' && !RestAlarm) {
      await channel(CHANNEL.sound, {
        name: 'Rest timer',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 120, 250],
      });
      await channel(CHANNEL.silent, {
        name: 'Rest timer (silent)',
        importance: Notifications.AndroidImportance.HIGH,
        sound: null,
        vibrationPattern: [0, 250, 120, 250],
      });
    }
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    return (await Notifications.requestPermissionsAsync()).granted;
  })();
  return prepared;
}

export type NextUp = { name: string; setNumber: number; lastTime: string | null } | null;

/** The set that comes after the rest, with last time's set of the same number. */
export function nextUp(saved: Saved, names: Map<string, string>, lastTime: (exerciseId: string, setNumber: number) => string | null): NextUp {
  const next = currentExercise(saved.state, { focusId: saved.focusId });
  if (!next) return null;
  const setNumber = setsFor(saved.state, next.id).length + 1;
  return { name: names.get(next.exercise_id) ?? 'Your next exercise', setNumber, lastTime: lastTime(next.exercise_id, setNumber) };
}

/** "Bicep curl, set 3 next. Last time 20 × 5." (27). */
export function nextText(next: NextUp): string {
  if (!next) return 'Time to finish your workout.';
  return `${next.name}, set ${next.setNumber} next.${next.lastTime ? ` Last time ${next.lastTime}.` : ''}`;
}

async function schedule(rest: Rest, next: NextUp, sound: boolean) {
  if (!(await prepare())) return;
  const date = new Date(rest.endsAt);
  if (date.getTime() <= Date.now()) return;
  const body = nextText(next);
  if (RestAlarm) {
    RestAlarm.schedule({
      endsAt: date.getTime(),
      title: 'Rest’s over',
      body,
      startLabel: next ? `Start set ${next.setNumber}` : 'Open workout',
      url: Linking.createURL('rest-over'),
      sound,
    });
    return;
  }
  // The same identifier replaces any earlier one, even from before the app was killed.
  await Notifications.scheduleNotificationAsync({
    identifier: NOTIFICATION_ID,
    content: { title: 'Rest is over', body, sound: sound ? 'default' : false, data: { sound } },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
      channelId: sound ? CHANNEL.sound : CHANNEL.silent,
    },
  });
}

function cancel() {
  if (RestAlarm) return RestAlarm.cancel();
  void Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID).catch(() => undefined);
}

/** Mounted once at the root while signed in. */
export function RestAlerts() {
  const saved = useActiveWorkout();
  const settings = useSettings();
  const exercises = useExercises();
  const queryClient = useQueryClient();
  const actions = useWorkoutActions();
  const rest = saved?.rest ?? null;
  const sound = settings.data?.rest_alert_sound ?? true;
  const names = new Map((exercises.data ?? []).map((e) => [e.id, e.name]));
  const unit = settings.data?.unit ?? 'lb';
  const bodyweightIds = new Set((exercises.data ?? []).filter((e) => e.kind === 'bodyweight').map((e) => e.id));
  const lastTime = (exerciseId: string, setNumber: number) => {
    const set = cachedLastSessions(queryClient, [exerciseId])?.[0]?.sets.find((s) => s.set_number === setNumber);
    return set ? setText(set, unit, bodyweightIds.has(exerciseId)) : null;
  };
  const next = saved ? nextUp(saved, names, lastTime) : null;
  const nextKey = JSON.stringify(next);

  // The alert follows the timer: rescheduled on ±15, cancelled on skip or finish.
  useEffect(() => {
    if (!supported) return;
    if (rest) void schedule(rest, JSON.parse(nextKey) as NextUp, sound);
    else cancel();
  }, [rest, nextKey, sound]);

  // "+15 sec" on the rest-over banner while the app was away moved the alarm; the timer
  // follows when the app comes back.
  useEffect(() => {
    if (!supported || !RestAlarm) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      // Back in the app: a still-ringing alert has done its job.
      RestAlarm?.dismissAlert?.();
      const endsAt = RestAlarm?.takeExtendedEnd();
      if (endsAt) void actions.restAgain(15, new Date(endsAt));
    });
    return () => sub.remove();
  }, [actions]);

  // Haptics, each once per rest. A check on returning to the app catches an end missed in
  // the background (the notification already alerted) without buzzing again.
  const given = useRef({ endsAt: '', warned: false, ended: false });
  useEffect(() => {
    if (!supported || !rest) return;
    if (given.current.endsAt !== rest.endsAt) {
      // A new rest, or ±15: only alerts still ahead are given.
      given.current = { endsAt: rest.endsAt, warned: false, ended: false };
    }
    const tick = () => {
      const alert = dueAlert(rest, now(), given.current);
      if (alert === 'warn') {
        given.current.warned = true;
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else if (alert === 'end') {
        given.current.ended = given.current.warned = true;
        if (AppState.currentState === 'active') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    };
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [rest]);

  return null;
}

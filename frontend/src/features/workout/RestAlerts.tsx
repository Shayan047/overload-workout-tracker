// The rest timer's alerts. While the app is open: a haptic at 10 s left and at the end.
// For a locked phone or another app: a local notification scheduled for the end, with the
// sound when "Rest alert sound" is on. The notification also carries the sound in the
// foreground, so the app needs no audio library.

import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { useSettings } from '@/api/settings';
import { useExercises } from '@/api/splits';
import { isReviewMode, now } from '@/review/reviewMode';

import { dueAlert, type Rest } from './rest';
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
function prepare(): Promise<boolean> {
  prepared ??= (async () => {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL.sound, {
        name: 'Rest timer',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 120, 250],
      });
      await Notifications.setNotificationChannelAsync(CHANNEL.silent, {
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

/** What's next when the rest ends: "Set 3 of bicep curl is next." */
function nextText(saved: Saved, names: Map<string, string>): string {
  const next = currentExercise(saved.state, { focusId: saved.focusId });
  if (!next) return 'Time to finish your workout.';
  const name = names.get(next.exercise_id) ?? 'your next exercise';
  return `Set ${setsFor(saved.state, next.id).length + 1} of ${name.toLowerCase()} is next.`;
}

async function schedule(rest: Rest, body: string, sound: boolean) {
  if (!(await prepare())) return;
  const date = new Date(rest.endsAt);
  if (date.getTime() <= Date.now()) return;
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
  void Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID).catch(() => undefined);
}

/** Mounted once at the root while signed in. */
export function RestAlerts() {
  const saved = useActiveWorkout();
  const settings = useSettings();
  const exercises = useExercises();
  const rest = saved?.rest ?? null;
  const sound = settings.data?.rest_alert_sound ?? true;
  const names = new Map((exercises.data ?? []).map((e) => [e.id, e.name]));
  const body = saved ? nextText(saved, names) : '';

  // The notification follows the timer: rescheduled on ±15, cancelled on skip or finish.
  useEffect(() => {
    if (!supported) return;
    if (rest) void schedule(rest, body, sound);
    else cancel();
  }, [rest, body, sound]);

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

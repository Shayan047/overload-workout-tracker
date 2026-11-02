package expo.modules.restalarm

import android.app.ActivityManager
import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationCompat

/** What the rest-over alert shows, saved so the alarm can post it with the app closed. */
data class Alarm(
  val endsAt: Long,
  val title: String,
  val body: String,
  val startLabel: String,
  val url: String,
  val sound: Boolean,
)

/**
 * The rest-over alarm: an exact alarm at the end of the rest, then a full-screen notification
 * (the Clock app's pattern). With the phone locked or the screen off, Android opens the
 * rest-over screen; while another app is in use, it shows the notification as a banner with
 * "Start set N" and "+15 sec". If Overload itself is open, nothing is posted: the timer card
 * is on screen.
 */
object RestAlarm {
  private const val PREFS = "overload.rest-alarm"
  private const val NOTIFICATION_ID = 7301
  private const val CHANNEL_SOUND = "rest-over"
  private const val CHANNEL_SILENT = "rest-over-silent"
  const val ACTION_FIRE = "expo.modules.restalarm.FIRE"
  const val ACTION_EXTEND = "expo.modules.restalarm.EXTEND"
  const val EXTEND_SECONDS = 15

  private val vibration = longArrayOf(0, 400, 200, 400, 200, 400)

  fun save(context: Context, alarm: Alarm) {
    prefs(context).edit()
      .putLong("endsAt", alarm.endsAt)
      .putString("title", alarm.title)
      .putString("body", alarm.body)
      .putString("startLabel", alarm.startLabel)
      .putString("url", alarm.url)
      .putBoolean("sound", alarm.sound)
      .apply()
  }

  private fun load(context: Context): Alarm? {
    val p = prefs(context)
    val endsAt = p.getLong("endsAt", 0L)
    if (endsAt == 0L) return null
    return Alarm(
      endsAt,
      p.getString("title", "") ?: "",
      p.getString("body", "") ?: "",
      p.getString("startLabel", "") ?: "",
      p.getString("url", "") ?: "",
      p.getBoolean("sound", true),
    )
  }

  /** Sets the exact alarm for `endsAt` (epoch ms), replacing any earlier one. */
  fun schedule(context: Context, endsAt: Long) {
    val alarms = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val fire = broadcast(context, ACTION_FIRE)
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarms.canScheduleExactAlarms()) {
      // An alarm clock is exact and allowed while the phone dozes; its "show" intent opens the app.
      alarms.setAlarmClock(AlarmManager.AlarmClockInfo(endsAt, openApp(context, load(context)?.url)), fire)
    } else {
      alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, endsAt, fire)
    }
  }

  fun cancel(context: Context) {
    val alarms = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    alarms.cancel(broadcast(context, ACTION_FIRE))
    notifications(context).cancel(NOTIFICATION_ID)
    prefs(context).edit().remove("endsAt").apply()
  }

  /** The alarm went off: alert unless Overload is on screen. */
  fun fire(context: Context) {
    val alarm = load(context) ?: return
    if (isAppInForeground()) return
    ensureChannels(context)
    val open = openApp(context, alarm.url)
    val notification = NotificationCompat.Builder(context, if (alarm.sound) CHANNEL_SOUND else CHANNEL_SILENT)
      .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
      .setColor(0xFFFFA41B.toInt())
      .setContentTitle(alarm.title)
      .setContentText(alarm.body)
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setAutoCancel(true)
      .setContentIntent(open)
      .setFullScreenIntent(open, true)
      .addAction(0, alarm.startLabel, open)
      .addAction(0, "+$EXTEND_SECONDS sec", broadcast(context, ACTION_EXTEND))
      .setTimeoutAfter(10 * 60 * 1000L)
      .build()
    notifications(context).notify(NOTIFICATION_ID, notification)
  }

  /** "+15 sec" on the banner: rest a little longer without opening the app. */
  fun extend(context: Context) {
    val alarm = load(context) ?: return
    notifications(context).cancel(NOTIFICATION_ID)
    val endsAt = System.currentTimeMillis() + EXTEND_SECONDS * 1000L
    save(context, alarm.copy(endsAt = endsAt))
    prefs(context).edit().putLong("extendedEndsAt", endsAt).apply()
    schedule(context, endsAt)
  }

  /** A rest end set by "+15 sec" while the app was away, once; null if none. */
  fun takeExtendedEnd(context: Context): Long? {
    val p = prefs(context)
    val endsAt = p.getLong("extendedEndsAt", 0L)
    if (endsAt == 0L) return null
    p.edit().remove("extendedEndsAt").apply()
    return endsAt
  }

  fun canUseFullScreen(context: Context): Boolean =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE || notifications(context).canUseFullScreenIntent()

  fun fullScreenSettings(context: Context): Intent =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:${context.packageName}"))
    } else {
      Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
    }

  private fun ensureChannels(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = notifications(context)
    val alarmAudio = AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_ALARM)
      .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
      .build()
    manager.createNotificationChannel(
      NotificationChannel(CHANNEL_SOUND, "Rest over", NotificationManager.IMPORTANCE_HIGH).apply {
        description = "When a rest ends, with a sound"
        setSound(Settings.System.DEFAULT_NOTIFICATION_URI, alarmAudio)
        vibrationPattern = vibration
        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      },
    )
    manager.createNotificationChannel(
      NotificationChannel(CHANNEL_SILENT, "Rest over (silent)", NotificationManager.IMPORTANCE_HIGH).apply {
        description = "When a rest ends, vibration only"
        setSound(null, null)
        vibrationPattern = vibration
        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      },
    )
  }

  private fun isAppInForeground(): Boolean {
    val info = ActivityManager.RunningAppProcessInfo()
    ActivityManager.getMyMemoryState(info)
    return info.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
  }

  /** Opens the app's rest-over route (a deep link, so it works after the app was killed). */
  private fun openApp(context: Context, url: String?): PendingIntent {
    val intent = if (url.isNullOrEmpty()) {
      context.packageManager.getLaunchIntentForPackage(context.packageName) ?: Intent()
    } else {
      Intent(Intent.ACTION_VIEW, Uri.parse(url)).setPackage(context.packageName)
    }
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    return PendingIntent.getActivity(context, 1, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  private fun broadcast(context: Context, action: String): PendingIntent {
    val intent = Intent(context, RestAlarmReceiver::class.java).setAction(action)
    return PendingIntent.getBroadcast(context, action.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  private fun notifications(context: Context) =
    context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

  private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}

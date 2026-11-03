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
import android.os.SystemClock
import android.provider.Settings
import android.view.View
import android.widget.RemoteViews
import androidx.core.app.NotificationCompat

/** What the rest-over alert shows, saved so the alarm can post it with the app closed. */
data class Alarm(
  val endsAt: Long,
  val title: String,
  val body: String,
  /** "Bicep curl, set 3 of 4 next". */
  val detail: String,
  /** Last time's set of the same number, "20 × 5"; empty if none. */
  val lastTime: String,
  val startLabel: String,
  /** Rest's over (26): the alert itself opens it. */
  val url: String,
  /** The workout: "Start set N" goes straight there. */
  val startUrl: String,
  val sound: Boolean,
)

/**
 * The rest-over alarm: an exact alarm at the end of the rest, then a full-screen notification
 * (the Clock app's pattern). With the phone locked or the screen off, Android opens the
 * rest-over screen; while another app is in use, it shows the notification as a banner with
 * "Start set N" and "+15 sec". It rings and vibrates until acted on, for two minutes at most.
 * If Overload itself is open, nothing is posted: the timer card is on screen.
 */
object RestAlarm {
  private const val PREFS = "overload.rest-alarm"
  private const val NOTIFICATION_ID = 7301
  private const val CHANNEL_SOUND = "rest-over"
  private const val CHANNEL_SILENT = "rest-over-silent"
  const val ACTION_FIRE = "expo.modules.restalarm.FIRE"
  const val ACTION_EXTEND = "expo.modules.restalarm.EXTEND"
  const val EXTEND_SECONDS = 15
  private const val RING_FOR_MS = 2 * 60 * 1000L
  private const val REQUEST_OPEN = 1
  private const val REQUEST_START = 2

  private val vibration = longArrayOf(0, 400, 200, 400, 200, 400)

  fun save(context: Context, alarm: Alarm) {
    prefs(context).edit()
      .putLong("endsAt", alarm.endsAt)
      .putString("title", alarm.title)
      .putString("body", alarm.body)
      .putString("detail", alarm.detail)
      .putString("lastTime", alarm.lastTime)
      .putString("startLabel", alarm.startLabel)
      .putString("url", alarm.url)
      .putString("startUrl", alarm.startUrl)
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
      p.getString("detail", "") ?: "",
      p.getString("lastTime", "") ?: "",
      p.getString("startLabel", "") ?: "",
      p.getString("url", "") ?: "",
      p.getString("startUrl", "") ?: "",
      p.getBoolean("sound", true),
    )
  }

  /** Sets the exact alarm for `endsAt` (epoch ms), replacing any earlier one. */
  fun schedule(context: Context, endsAt: Long) {
    val alarms = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val fire = broadcast(context, ACTION_FIRE)
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarms.canScheduleExactAlarms()) {
      // An alarm clock is exact and allowed while the phone dozes; its "show" intent opens the app.
      alarms.setAlarmClock(AlarmManager.AlarmClockInfo(endsAt, openApp(context, load(context)?.url, REQUEST_OPEN)), fire)
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
    val open = openApp(context, alarm.url, REQUEST_OPEN)
    val notification = NotificationCompat.Builder(context, if (alarm.sound) CHANNEL_SOUND else CHANNEL_SILENT)
      .setSmallIcon(R.drawable.rest_over_icon)
      .setColor(context.getColor(R.color.rest_over_accent))
      // The plain text stays for the lock screen's public version and screen readers.
      .setContentTitle(alarm.title)
      .setContentText(alarm.body)
      .setStyle(NotificationCompat.DecoratedCustomViewStyle())
      .setCustomContentView(content(context, alarm, expanded = false))
      .setCustomHeadsUpContentView(content(context, alarm, expanded = false))
      .setCustomBigContentView(content(context, alarm, expanded = true))
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setAutoCancel(true)
      .setContentIntent(open)
      .setFullScreenIntent(open, true)
      .addAction(0, alarm.startLabel, openApp(context, alarm.startUrl, REQUEST_START))
      .addAction(0, "+$EXTEND_SECONDS sec", broadcast(context, ACTION_EXTEND))
      // Rings until acted on (like the Clock app's alarm), for two minutes at most.
      .setTimeoutAfter(RING_FOR_MS)
      .build()
    notification.flags = notification.flags or Notification.FLAG_INSISTENT
    // A new post, not an update of an earlier alert: Android only opens the full-screen
    // screen for a new one (an update of a still-showing alert stayed silent after "+15 sec").
    notifications(context).cancel(NOTIFICATION_ID)
    notifications(context).notify(NOTIFICATION_ID, notification)
  }

  /** The notification's content (27): Android draws the card, header and actions around it. */
  private fun content(context: Context, alarm: Alarm, expanded: Boolean): RemoteViews {
    val views = RemoteViews(context.packageName, if (expanded) R.layout.rest_over_expanded else R.layout.rest_over_collapsed)
    views.setTextViewText(R.id.rest_over_detail, alarm.detail)
    // The chronometer counts from a base on the elapsed-time clock: the end of the rest.
    val endedAgo = System.currentTimeMillis() - alarm.endsAt
    views.setChronometer(R.id.rest_over_overtime, SystemClock.elapsedRealtime() - endedAgo, "+%s", true)
    if (expanded) {
      if (alarm.lastTime.isEmpty()) views.setViewVisibility(R.id.rest_over_last, View.GONE)
      else views.setTextViewText(R.id.rest_over_last_set, alarm.lastTime)
    }
    return views
  }

  /** Rest's over is on screen: the alert has done its job. */
  fun dismissAlert(context: Context) {
    notifications(context).cancel(NOTIFICATION_ID)
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

  /** Opens one of the app's routes (a deep link, so it works after the app was killed). */
  private fun openApp(context: Context, url: String?, request: Int): PendingIntent {
    val intent = if (url.isNullOrEmpty()) {
      context.packageManager.getLaunchIntentForPackage(context.packageName) ?: Intent()
    } else {
      Intent(Intent.ACTION_VIEW, Uri.parse(url)).setPackage(context.packageName)
    }
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    return PendingIntent.getActivity(context, request, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  private fun broadcast(context: Context, action: String): PendingIntent {
    val intent = Intent(context, RestAlarmReceiver::class.java).setAction(action)
    return PendingIntent.getBroadcast(context, action.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  private fun notifications(context: Context) =
    context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

  private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}

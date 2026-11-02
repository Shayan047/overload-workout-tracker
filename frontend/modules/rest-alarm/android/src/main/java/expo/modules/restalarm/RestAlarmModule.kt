package expo.modules.restalarm

import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class AlarmOptions : Record {
  @Field var endsAt: Double = 0.0
  @Field var title: String = ""
  @Field var body: String = ""
  @Field var startLabel: String = ""
  @Field var url: String = ""
  @Field var sound: Boolean = true
}

/** The JavaScript side of RestAlarm (see RestAlarm.kt). */
class RestAlarmModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "No React context" }

  override fun definition() = ModuleDefinition {
    Name("RestAlarm")

    Function("schedule") { options: AlarmOptions ->
      val endsAt = options.endsAt.toLong()
      RestAlarm.save(context, Alarm(endsAt, options.title, options.body, options.startLabel, options.url, options.sound))
      RestAlarm.schedule(context, endsAt)
    }

    Function("cancel") {
      RestAlarm.cancel(context)
    }

    Function("takeExtendedEnd") {
      RestAlarm.takeExtendedEnd(context)?.toDouble()
    }

    Function("canUseFullScreen") {
      RestAlarm.canUseFullScreen(context)
    }

    Function("openFullScreenSettings") {
      context.startActivity(RestAlarm.fullScreenSettings(context).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    // The rest-over screen shows over the lock screen and turns the screen on; other screens don't.
    Function("setShowOverLockScreen") { show: Boolean ->
      val activity = appContext.currentActivity ?: return@Function
      activity.runOnUiThread {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
          activity.setShowWhenLocked(show)
          activity.setTurnScreenOn(show)
        }
      }
    }

    // "Start set": ask to unlock (if locked) on the way into the workout.
    Function("dismissKeyguard") {
      val activity = appContext.currentActivity ?: return@Function
      val keyguard = context.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
      activity.runOnUiThread {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) keyguard.requestDismissKeyguard(activity, null)
      }
    }

    // "+15 sec": back to whatever was on screen (the lock screen or the other app).
    Function("sendToBack") {
      val activity = appContext.currentActivity ?: return@Function
      activity.runOnUiThread { activity.moveTaskToBack(true) }
    }
  }
}

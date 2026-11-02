package expo.modules.restalarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Android calls this when the rest's alarm goes off, and for the banner's "+15 sec". */
class RestAlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      RestAlarm.ACTION_FIRE -> RestAlarm.fire(context)
      RestAlarm.ACTION_EXTEND -> RestAlarm.extend(context)
    }
  }
}

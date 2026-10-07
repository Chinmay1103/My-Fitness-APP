package expo.modules.smssender

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.telephony.SmsManager
import androidx.core.content.ContextCompat
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Sends a text message straight from the phone's SIM, without opening the messaging app, so a
 * heart-rate alert goes out even when nobody is looking at the phone. The app must already hold
 * SEND_SMS (asked for from JS). Normal SMS charges apply.
 */
class SmsSenderModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SmsSender")

    AsyncFunction("sendText") { phoneNumber: String, message: String ->
      val context = appContext.reactContext ?: throw CodedException("NO_CONTEXT", "App is not ready", null)
      if (ContextCompat.checkSelfPermission(context, Manifest.permission.SEND_SMS) != PackageManager.PERMISSION_GRANTED) {
        throw CodedException("NO_PERMISSION", "Sending SMS is not allowed", null)
      }
      val sms: SmsManager =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) context.getSystemService(SmsManager::class.java)
        else @Suppress("DEPRECATION") SmsManager.getDefault()
      // Long texts are split into parts and arrive as one message.
      val parts = sms.divideMessage(message)
      sms.sendMultipartTextMessage(phoneNumber, null, parts, null, null)
    }
  }
}

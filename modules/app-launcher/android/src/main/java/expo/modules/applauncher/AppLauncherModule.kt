package expo.modules.applauncher

import android.content.Intent
import android.net.Uri
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Opens a streaming app by package name, so a link goes to that app and never to the browser. The packages
// must be declared in the manifest's <queries> (plugins/withStreamingQueries.js) to be visible on Android 11+.
class AppLauncherModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AppLauncher")

    Function("isInstalled") { packageName: String ->
      val pm = appContext.reactContext?.packageManager ?: return@Function false
      pm.getLaunchIntentForPackage(packageName) != null
    }

    // False when the app can't take this link, so JS can fall back to the app's home screen.
    Function("openLink") { url: String, packageName: String ->
      val context = appContext.reactContext ?: return@Function false
      val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
      intent.setPackage(packageName)
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      try {
        (appContext.currentActivity ?: context).startActivity(intent)
        true
      } catch (e: Exception) {
        false
      }
    }

    Function("openApp") { packageName: String ->
      val context = appContext.reactContext ?: return@Function false
      val intent = context.packageManager.getLaunchIntentForPackage(packageName) ?: return@Function false
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      try {
        (appContext.currentActivity ?: context).startActivity(intent)
        true
      } catch (e: Exception) {
        false
      }
    }
  }
}

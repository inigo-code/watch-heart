import { requireOptionalNativeModule } from 'expo-modules-core';

type AppLauncherModule = {
  isInstalled(packageName: string): boolean;
  /** Opens this link inside that app; false if the app can't take it. */
  openLink(url: string, packageName: string): boolean;
  /** Opens the app on its home screen; false if it isn't installed. */
  openApp(packageName: string): boolean;
};

// Android-only native module (modules/app-launcher). Null on the web, and on builds before 1.4.0.
export const AppLauncher = requireOptionalNativeModule<AppLauncherModule>('AppLauncher');

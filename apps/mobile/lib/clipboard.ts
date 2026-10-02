import { requireOptionalNativeModule } from 'expo';

/**
 * Copies text to the clipboard; false when it couldn't. expo-clipboard throws as soon as it's
 * imported if its native part isn't in the build (an APK built before it was added), so it's
 * only loaded when present.
 */
export async function copyText(text: string): Promise<boolean> {
  if (!requireOptionalNativeModule('ExpoClipboard')) return false;
  try {
    const Clipboard = require('expo-clipboard') as typeof import('expo-clipboard');
    return await Clipboard.setStringAsync(text);
  } catch {
    return false;
  }
}

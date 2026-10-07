import { Linking, Platform, Share, ToastAndroid } from 'react-native';

import { copyText } from './clipboard';

/**
 * Opens a new Claude chat with `message` filled in. Uses claude.ai's `?q=` link, which the Claude
 * app or the browser opens. If that fails, falls back to the share sheet (pick Claude there).
 */
export async function openInClaude(message: string): Promise<void> {
  const url = `https://claude.ai/new?q=${encodeURIComponent(message)}`;
  try {
    await Linking.openURL(url);
  } catch {
    await shareToClaude(message);
  }
}

/**
 * Opens an existing Claude chat (`chatUrl`, from `parseChatLink`). Claude's links can't fill in a
 * message for an existing chat, so the question goes on the clipboard to paste there. On Android a
 * toast says so; it stays on screen over Claude, and the short pause lets it be read first. Returns
 * whether it was copied (not on a build without the clipboard module).
 */
export async function continueInClaude(chatUrl: string, message: string): Promise<boolean> {
  const copied = await copyText(message);
  if (copied && Platform.OS === 'android') {
    ToastAndroid.show('Copied — long-press the box and tap Paste', ToastAndroid.LONG);
    await new Promise((resolve) => setTimeout(resolve, PASTE_HINT_MS));
  }
  await Linking.openURL(chatUrl);
  return copied;
}

/** How long the "Copied" toast shows in the app before Claude opens over it. */
const PASTE_HINT_MS = 1200;

/** The Android share sheet with the message; choosing the Claude app starts a chat with it. */
export async function shareToClaude(message: string): Promise<void> {
  await Share.share({ message });
}

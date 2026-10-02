import { Linking, Share } from 'react-native';

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

/** The Android share sheet with the message; choosing the Claude app starts a chat with it. */
export async function shareToClaude(message: string): Promise<void> {
  await Share.share({ message });
}

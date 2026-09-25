import { GoogleAuthProvider, signInWithCredential, signOut as firebaseSignOut, type User } from 'firebase/auth/web-extension';
import { getAuth } from './firebase';
import { clearTagCache } from './tags';

/**
 * Google sign-in through Chrome's identity API, then into the same Firebase
 * project as the app, so links land under the same uid.
 */
export async function signIn(): Promise<User> {
  const { token } = await chrome.identity.getAuthToken({ interactive: true });
  if (!token) throw new Error('No Google token');
  try {
    const result = await signInWithCredential(getAuth(), GoogleAuthProvider.credential(null, token));
    return result.user;
  } catch (e) {
    // A stale cached token is the usual cause; drop it so the next try gets a fresh one.
    await chrome.identity.removeCachedAuthToken({ token });
    throw e;
  }
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(getAuth());
  try {
    const { token } = await chrome.identity.getAuthToken({ interactive: false });
    if (token) await chrome.identity.removeCachedAuthToken({ token });
  } catch {
    // No cached token.
  }
  await chrome.identity.clearAllCachedAuthTokens();
  await clearTagCache();
}

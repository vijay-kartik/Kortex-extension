import { GoogleAuthProvider, signInWithCredential, signOut as firebaseSignOut, type User } from 'firebase/auth/web-extension';
import { getAuth } from './firebase';
import type { GoogleTokens } from './googleOAuth';
import { clearLibraryCache } from './library';
import type { SignInResponse, WorkerRequest } from './messages';
import { clearTopicCache } from './topics';

/**
 * Google sign-in, then into the same Firebase project as the app, so links land
 * under the same uid. The Google step runs in the service worker (see
 * googleOAuth.ts), which also saves the session through the offscreen document
 * in case this popup closed meanwhile.
 */
export async function signIn(): Promise<User> {
  const request: WorkerRequest = { target: 'worker', type: 'sign-in' };
  const response: SignInResponse = await chrome.runtime.sendMessage(request);
  if (!response.ok) throw new Error(response.message);
  return signInWithTokens(response.tokens);
}

export async function signInWithTokens({ idToken, accessToken }: GoogleTokens): Promise<User> {
  const result = await signInWithCredential(getAuth(), GoogleAuthProvider.credential(idToken, accessToken));
  return result.user;
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(getAuth());
  await clearLibraryCache();
  await clearTopicCache();
}

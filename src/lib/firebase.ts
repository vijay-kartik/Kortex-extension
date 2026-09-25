import { initializeApp, type FirebaseApp } from 'firebase/app';
import { indexedDBLocalPersistence, initializeAuth, type Auth, type User } from 'firebase/auth/web-extension';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { firebaseConfig } from '../config';

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;

function getApp(): FirebaseApp {
  app ??= initializeApp(firebaseConfig);
  return app;
}

/**
 * Auth from the web-extension build (no remote scripts, as MV3 requires). The
 * session lives in the extension origin's IndexedDB, so the popup and the
 * offscreen document share it.
 */
export function getAuth(): Auth {
  auth ??= initializeAuth(getApp(), { persistence: indexedDBLocalPersistence });
  return auth;
}

/**
 * Firestore with the persistent IndexedDB cache, so a write made offline
 * survives the popup closing and uploads the next time Firestore runs online.
 * Multi-tab manager because the popup and the offscreen document can be open
 * at the same time.
 */
export function getDb(): Firestore {
  db ??= initializeFirestore(getApp(), {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
  return db;
}

/** Resolves once Auth has restored its session: the user, or null when signed out. */
export async function currentUser(): Promise<User | null> {
  const a = getAuth();
  await a.authStateReady();
  return a.currentUser;
}

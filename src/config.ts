/**
 * Firebase web app config for project kortex-a24b7 (Firebase console → Project
 * settings → Your apps → Web). These values are not secret. They come from `.env`
 * at build time; see `.env.example`.
 */
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: 'kortex-a24b7.firebaseapp.com',
  projectId: 'kortex-a24b7',
  storageBucket: 'kortex-a24b7.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/** How long to wait for Firestore to acknowledge a write before showing "offline". */
export const ACK_TIMEOUT_MS = 2000;
/** How long to spend reading a pasted page for its title and image. */
export const PAGE_READ_TIMEOUT_MS = 5000;
/** How long a doc lookup may wait on the network before falling back to the local cache. */
export const LOOKUP_TIMEOUT_MS = 2500;

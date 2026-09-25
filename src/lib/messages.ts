/** Messages between the popup, the service worker and the offscreen document. */

export type OffscreenRequest =
  | { target: 'offscreen'; type: 'save-link'; url: string }
  | { target: 'offscreen'; type: 'flush' };

export type SaveLinkResponse =
  | { ok: true; outcome: 'acked' | 'queued' | 'unchanged' }
  | { ok: false; reason: 'signed-out' | 'invalid' | 'error'; message?: string };

export type FlushResponse = { ok: boolean };

export type WorkerRequest = { target: 'worker'; type: 'saved' } | { target: 'worker'; type: 'queued' };

/** chrome.storage.session key: a link to prefill when the popup next opens. */
export const PREFILL_KEY = 'prefill';
/** chrome.storage.local key: set while writes may be waiting in Firestore's local queue. */
export const PENDING_KEY = 'pendingUpload';
/** chrome.alarms name that retries uploading queued writes. */
export const FLUSH_ALARM = 'flush-queued-writes';

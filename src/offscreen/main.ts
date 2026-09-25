/**
 * Offscreen document: Firestore and DOMParser for the service worker.
 * Handles right-click saves and uploading writes that were queued offline.
 * It shares the popup's Firebase session through the extension's IndexedDB.
 */
import { waitForPendingWrites } from 'firebase/firestore';
import { currentUser, getDb } from '../lib/firebase';
import { lookupLink, saveLink } from '../lib/links';
import { fetchPageMeta } from '../lib/meta';
import { isSavableUrl } from '../lib/linkKey';
import type { FlushResponse, OffscreenRequest, SaveLinkResponse } from '../lib/messages';

const FLUSH_TIMEOUT_MS = 20_000;

async function saveRightClicked(url: string): Promise<SaveLinkResponse> {
  if (!isSavableUrl(url)) return { ok: false, reason: 'invalid' };
  const user = await currentUser();
  if (!user) return { ok: false, reason: 'signed-out' };
  try {
    const [lookup, meta] = await Promise.all([
      lookupLink(user.uid, url),
      fetchPageMeta(url).catch(() => ({ title: null, imageUrl: null })),
    ]);
    // Right-click saves carry no tags, so an existing link is left as it is.
    const outcome = await saveLink(
      user.uid,
      lookup,
      { title: meta.title ?? url.trim(), imageUrl: meta.imageUrl, tags: [] },
      { keepActive: true },
    );
    return { ok: true, outcome };
  } catch (e) {
    return { ok: false, reason: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}

async function flushQueued(): Promise<FlushResponse> {
  const user = await currentUser();
  if (!user) return { ok: true }; // signed out: the queue belongs to nobody we can upload as
  try {
    await Promise.race([
      waitForPendingWrites(getDb()),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), FLUSH_TIMEOUT_MS)),
    ]);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

chrome.runtime.onMessage.addListener((message: OffscreenRequest, _sender, sendResponse) => {
  if (message?.target !== 'offscreen') return;
  const work = message.type === 'save-link' ? saveRightClicked(message.url) : flushQueued();
  work.then(sendResponse);
  return true;
});

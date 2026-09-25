/**
 * Service worker: the "Save link to Kortex" context menu, the toolbar badge,
 * and uploading writes that were queued offline. It stays free of Firebase;
 * anything that needs Firestore or DOMParser runs in the offscreen document.
 */
import { googleTokens } from '../lib/googleOAuth';
import { isSavableUrl } from '../lib/linkKey';
import {
  FLUSH_ALARM,
  PENDING_KEY,
  PREFILL_KEY,
  type FlushResponse,
  type OffscreenRequest,
  type SaveLinkResponse,
  type SignInResponse,
  type WorkerRequest,
} from '../lib/messages';

const MENU_ID = 'save-link-to-kortex';
const OFFSCREEN_URL = 'offscreen/index.html';
const SYNAPSE = '#7C8CFF';
const AMBER = '#EFB358';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: MENU_ID, title: 'Save link to Kortex', contexts: ['link'] });
  void resumeFlushIfPending();
});

chrome.runtime.onStartup.addListener(() => void resumeFlushIfPending());

// ---- Badge ----------------------------------------------------------------

let badgeTimer: ReturnType<typeof setTimeout> | undefined;

async function showBadge(text: string, color: string, clearAfterMs?: number): Promise<void> {
  clearTimeout(badgeTimer);
  await chrome.action.setBadgeBackgroundColor({ color });
  await chrome.action.setBadgeTextColor?.({ color: '#0B0E14' });
  await chrome.action.setBadgeText({ text });
  if (clearAfterMs) badgeTimer = setTimeout(() => void chrome.action.setBadgeText({ text: '' }), clearAfterMs);
}

const showSavedBadge = () => showBadge('✓', SYNAPSE, 3000);

// ---- Offscreen document -----------------------------------------------------

let creating: Promise<void> | undefined;
let offscreenUsers = 0;

async function withOffscreen<T>(fn: () => Promise<T>): Promise<T> {
  offscreenUsers++;
  try {
    const url = chrome.runtime.getURL(OFFSCREEN_URL);
    const existing = await chrome.runtime.getContexts({
      contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
      documentUrls: [url],
    });
    if (existing.length === 0) {
      creating ??= chrome.offscreen
        .createDocument({
          url: OFFSCREEN_URL,
          reasons: [chrome.offscreen.Reason.DOM_PARSER],
          justification: 'Read the title and image of a right-clicked link and save it to Firestore.',
        })
        .finally(() => (creating = undefined));
      await creating;
    }
    return await fn();
  } finally {
    offscreenUsers--;
    if (offscreenUsers === 0) await chrome.offscreen.closeDocument().catch(() => {});
  }
}

function toOffscreen<T>(message: OffscreenRequest): Promise<T> {
  return chrome.runtime.sendMessage(message);
}

// ---- Right-click save -------------------------------------------------------

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID || !info.linkUrl) return;
  void saveFromMenu(info.linkUrl, tab);
});

async function saveFromMenu(url: string, tab?: chrome.tabs.Tab): Promise<void> {
  let response: SaveLinkResponse;
  if (!isSavableUrl(url)) {
    response = { ok: false, reason: 'invalid' };
  } else {
    try {
      response = await withOffscreen(() => toOffscreen<SaveLinkResponse>({ target: 'offscreen', type: 'save-link', url }));
    } catch (e) {
      response = { ok: false, reason: 'error', message: String(e) };
    }
  }

  if (response.ok) {
    if (response.outcome === 'queued') await markPending();
    await showSavedBadge();
    return;
  }

  // Couldn't save without help: open the popup with the link filled in.
  await chrome.storage.session.set({ [PREFILL_KEY]: url });
  try {
    await chrome.action.openPopup(tab?.windowId ? { windowId: tab.windowId } : undefined);
  } catch {
    await showBadge('!', AMBER);
  }
}

// ---- Uploading queued writes --------------------------------------------------

async function markPending(): Promise<void> {
  await chrome.storage.local.set({ [PENDING_KEY]: true });
  await chrome.alarms.create(FLUSH_ALARM, { delayInMinutes: 0.5, periodInMinutes: 1 });
}

async function resumeFlushIfPending(): Promise<void> {
  const { [PENDING_KEY]: pending } = await chrome.storage.local.get(PENDING_KEY);
  if (pending) await chrome.alarms.create(FLUSH_ALARM, { delayInMinutes: 0.1, periodInMinutes: 1 });
}

let flushing = false;

async function flush(): Promise<void> {
  if (flushing || !navigator.onLine) return;
  flushing = true;
  try {
    const { ok } = await withOffscreen(() => toOffscreen<FlushResponse>({ target: 'offscreen', type: 'flush' }));
    if (ok) {
      await chrome.storage.local.remove(PENDING_KEY);
      await chrome.alarms.clear(FLUSH_ALARM);
    }
  } catch (e) {
    console.warn('Kortex: flush failed', e);
  } finally {
    flushing = false;
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === FLUSH_ALARM) void flush();
});

// ---- Sign-in ----------------------------------------------------------------

/**
 * Runs here rather than in the popup, which closes when the Google window takes
 * focus. The offscreen document signs in to Firebase so the session is saved
 * even if nobody is left to receive the response.
 */
async function signIn(): Promise<SignInResponse> {
  try {
    const tokens = await googleTokens();
    return await withOffscreen(() => toOffscreen<SignInResponse>({ target: 'offscreen', type: 'sign-in', tokens }));
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

// ---- Messages from the popup -------------------------------------------------

chrome.runtime.onMessage.addListener((message: WorkerRequest, _sender, sendResponse) => {
  if (message?.target !== 'worker') return;
  if (message.type === 'sign-in') {
    void signIn().then(sendResponse);
    return true;
  }
  const done = message.type === 'saved' ? showSavedBadge() : markPending().then(showSavedBadge);
  done.finally(() => sendResponse(true));
  return true;
});

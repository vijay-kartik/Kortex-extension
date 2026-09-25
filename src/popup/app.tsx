import { useEffect, useRef, useState } from 'preact/hooks';
import type { User } from 'firebase/auth/web-extension';
import { WifiOff } from 'lucide-preact';
import { signIn, signOut } from '../lib/auth';
import { currentUser } from '../lib/firebase';
import { sortTags, taggedSentence } from '../lib/linkDoc';
import { isSavableUrl } from '../lib/linkKey';
import { PREFILL_KEY, type WorkerRequest } from '../lib/messages';
import { cachedTags, noteSavedTags, refreshTags } from '../lib/tags';
import {
  AppIcon,
  Footnote,
  GoogleG,
  Header,
  Notice,
  PreviewCard,
  SuccessBadge,
  TonalButton,
  type Account,
} from './components';
import { Compose, type ComposeInit, type SavedLink } from './compose';

type Screen =
  | { kind: 'loading' }
  | { kind: 'signed-out' }
  | { kind: 'compose'; init: ComposeInit; key: number }
  | { kind: 'saved'; saved: SavedLink }
  | { kind: 'offline'; saved: SavedLink };

const AUTO_CLOSE_MS = 2000;

function accountOf(user: User): Account {
  const name = user.displayName || user.email || '?';
  return { email: user.email, initial: name.trim().charAt(0).toUpperCase() || '?' };
}

async function activeTabInit(prefill: string | null): Promise<ComposeInit> {
  if (prefill) return { kind: 'prefill', url: prefill };
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id !== undefined && tab.url && isSavableUrl(tab.url)) {
    return { kind: 'tab', tab: { id: tab.id, url: tab.url, title: tab.title ?? '' } };
  }
  return { kind: 'cant-save' };
}

function mergeTags(all: string[], added: string[]): string[] {
  const lower = new Set(all.map((t) => t.toLowerCase()));
  return sortTags([...all, ...added.filter((t) => !lower.has(t.toLowerCase()))]);
}

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [screen, setScreen] = useState<Screen>({ kind: 'loading' });
  const [allTags, setAllTags] = useState<string[]>([]);
  const prefill = useRef<string | null>(null);
  const composeKey = useRef(0);

  const openCompose = async (init?: ComposeInit) => {
    const next = init ?? (await activeTabInit(prefill.current));
    prefill.current = null;
    setScreen({ kind: 'compose', init: next, key: ++composeKey.current });
  };

  const loadTags = async (uid: string) => {
    setAllTags(await cachedTags(uid));
    try {
      setAllTags(await refreshTags(uid));
    } catch (e) {
      console.warn('Kortex: tag refresh failed', e);
    }
  };

  useEffect(() => {
    void chrome.action.setBadgeText({ text: '' });
    (async () => {
      const session = await chrome.storage.session.get(PREFILL_KEY);
      if (typeof session[PREFILL_KEY] === 'string') {
        prefill.current = session[PREFILL_KEY];
        await chrome.storage.session.remove(PREFILL_KEY);
      }
      const u = await currentUser();
      setUser(u);
      if (!u) {
        setScreen({ kind: 'signed-out' });
        return;
      }
      void loadTags(u.uid);
      await openCompose();
    })();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) window.close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const onSignedIn = async (u: User) => {
    setUser(u);
    void loadTags(u.uid);
    await openCompose();
  };

  const onSignOut = async () => {
    await signOut();
    setUser(null);
    setAllTags([]);
    setScreen({ kind: 'signed-out' });
  };

  const onSaved = (saved: SavedLink) => {
    if (user) void noteSavedTags(user.uid, saved.linkUid, saved.tags);
    setAllTags((all) => mergeTags(all, saved.tags));
    const message: WorkerRequest = { target: 'worker', type: saved.outcome === 'queued' ? 'queued' : 'saved' };
    void chrome.runtime.sendMessage(message).catch(() => {});
    setScreen(saved.outcome === 'queued' ? { kind: 'offline', saved } : { kind: 'saved', saved });
  };

  const saveAnother = () => void openCompose({ kind: 'blank' });

  return (
    <>
      <Header account={user ? accountOf(user) : undefined} onSignOut={onSignOut} />
      {screen.kind === 'signed-out' && <SignedOut onSignedIn={onSignedIn} />}
      {screen.kind === 'compose' && user && (
        <Compose key={screen.key} uid={user.uid} init={screen.init} allTags={allTags} onSaved={onSaved} />
      )}
      {screen.kind === 'saved' && <Saved saved={screen.saved} onAnother={saveAnother} />}
      {screen.kind === 'offline' && <Offline saved={screen.saved} onAnother={saveAnother} />}
    </>
  );
}

/** 01 — signed out. */
export function SignedOut({ onSignedIn }: { onSignedIn: (u: User) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      onSignedIn(await signIn());
    } catch (e) {
      console.error('Kortex: sign-in failed', e);
      const text = e instanceof Error ? e.message : '';
      setError(/cancel|did not approve|not signed in/i.test(text) ? 'Sign-in was cancelled.' : 'Couldn’t sign in. Try again.');
      setBusy(false);
    }
  };

  return (
    <div class="center" style={{ padding: '28px 16px 24px' }}>
      <AppIcon size={64} />
      <div class="heading" style={{ marginTop: 16 }}>
        Save links to Kortex
      </div>
      <div class="lede" style={{ marginTop: 6, width: 260 }}>
        Sign in with the Google account you use in the Kortex app.
      </div>
      <button class="button google" style={{ marginTop: 20 }} disabled={busy} onClick={go}>
        <GoogleG />
        Continue with Google
      </button>
      <div style={{ marginTop: 14, width: '100%' }}>
        {error ? <div class="error-text">{error}</div> : <Footnote>Your links stay in sync with the app</Footnote>}
      </div>
    </div>
  );
}

/** 03 — saved. Closes itself after 2s unless the pointer is over the popup. */
export function Saved({ saved, onAnother }: { saved: SavedLink; onAnother: () => void }) {
  useEffect(() => {
    const root = document.documentElement;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!root.matches(':hover')) window.close();
      }, AUTO_CLOSE_MS);
    };
    const hold = () => clearTimeout(timer);
    arm();
    root.addEventListener('mouseleave', arm);
    root.addEventListener('mouseenter', hold);
    return () => {
      clearTimeout(timer);
      root.removeEventListener('mouseleave', arm);
      root.removeEventListener('mouseenter', hold);
    };
  }, []);

  return (
    <div class="center" style={{ padding: '24px 16px 16px' }}>
      <SuccessBadge />
      <div class="heading" style={{ marginTop: 12 }}>
        {saved.updated ? 'Tags updated' : 'Saved to Links'}
      </div>
      <div class="lede" style={{ marginTop: 4, width: 280 }}>
        {taggedSentence(saved.tags)}It’ll show up in Kortex after the app’s next sync.
      </div>
      <div style={{ marginTop: 16, width: '100%' }}>
        <PreviewCard url={saved.url} title={saved.title} imageUrl={saved.imageUrl} />
      </div>
      <div style={{ marginTop: 16, width: '100%' }}>
        <TonalButton label="Save another link" onClick={onAnother} />
      </div>
      <button class="text-button" style={{ marginTop: 4 }} onClick={() => window.close()}>
        Done
      </button>
    </div>
  );
}

/** 08 — saved while offline; Firestore uploads the queued write later. */
export function Offline({ saved, onAnother }: { saved: SavedLink; onAnother: () => void }) {
  return (
    <div class="body">
      <Notice icon={<WifiOff size={18} />} title="You’re offline">
        Saved on this computer. It goes up to your account when you’re back online.
      </Notice>
      <PreviewCard url={saved.url} title={saved.title} imageUrl={saved.imageUrl} status="Saved · Waiting to upload" />
      <TonalButton label="Save another link" onClick={onAnother} />
    </div>
  );
}

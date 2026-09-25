import { useEffect, useRef, useState } from 'preact/hooks';
import type { User } from 'firebase/auth/web-extension';
import { WifiOff } from 'lucide-preact';
import { signIn, signOut } from '../lib/auth';
import { currentUser } from '../lib/firebase';
import { cachedLibrary, noteSaved, refreshLibrary, type Library } from '../lib/library';
import { taggedSentence } from '../lib/linkDoc';
import { isSavableUrl, linkUid, linkUrlKey } from '../lib/linkKey';
import { PREFILL_KEY, type WorkerRequest } from '../lib/messages';
import { recentFirst, type Topic } from '../lib/topicDoc';
import { cachedTopics, refreshTopics } from '../lib/topics';
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
import { Compose, type ComposeInit, type SavedLink, type TabInfo } from './compose';
import { Home } from './home';

type HomeTab = TabInfo & { linkUid: string };

type Screen =
  | { kind: 'loading' }
  | { kind: 'signed-out' }
  | { kind: 'home'; tab: HomeTab | null }
  | { kind: 'compose'; init: ComposeInit; key: number }
  | { kind: 'saved'; saved: SavedLink }
  | { kind: 'offline'; saved: SavedLink };

const AUTO_CLOSE_MS = 2000;

function accountOf(user: User): Account {
  const name = user.displayName || user.email || '?';
  return { email: user.email, initial: name.trim().charAt(0).toUpperCase() || '?' };
}

async function activeTab(): Promise<TabInfo | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id !== undefined && tab.url && isSavableUrl(tab.url)) return { id: tab.id, url: tab.url, title: tab.title ?? '' };
  return null;
}

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [screen, setScreen] = useState<Screen>({ kind: 'loading' });
  const [library, setLibrary] = useState<Library | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const composeKey = useRef(0);

  const openCompose = (init: ComposeInit) => setScreen({ kind: 'compose', init, key: ++composeKey.current });

  const openHome = async () => {
    const tab = await activeTab();
    setScreen({ kind: 'home', tab: tab && { ...tab, linkUid: await linkUid(linkUrlKey(tab.url)) } });
  };

  /** Right-click fallback goes straight to the save screen; otherwise the saved-links home. */
  const openStart = async (prefill: string | null) => {
    if (prefill) openCompose({ kind: 'prefill', url: prefill });
    else await openHome();
  };

  const loadLibrary = async (uid: string) => {
    const cached = await cachedLibrary(uid);
    if (cached) setLibrary(cached);
    try {
      setLibrary(await refreshLibrary(uid));
    } catch (e) {
      console.warn('Kortex: library refresh failed', e);
      setLibrary(cached ?? { links: [], tags: [] });
    }
  };

  const loadTopics = async (uid: string) => {
    setTopics(await cachedTopics(uid));
    try {
      setTopics(await refreshTopics(uid));
    } catch (e) {
      console.warn('Kortex: topic refresh failed', e);
    }
  };

  useEffect(() => {
    void chrome.action.setBadgeText({ text: '' });
    (async () => {
      let prefill: string | null = null;
      const session = await chrome.storage.session.get(PREFILL_KEY);
      if (typeof session[PREFILL_KEY] === 'string') {
        prefill = session[PREFILL_KEY];
        await chrome.storage.session.remove(PREFILL_KEY);
      }
      const u = await currentUser();
      setUser(u);
      if (!u) {
        setScreen({ kind: 'signed-out' });
        return;
      }
      void loadLibrary(u.uid);
      void loadTopics(u.uid);
      await openStart(prefill);
    })();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) window.close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const onSignedIn = async (u: User) => {
    setUser(u);
    void loadLibrary(u.uid);
    void loadTopics(u.uid);
    await openHome();
  };

  const onSignOut = async () => {
    await signOut();
    setUser(null);
    setLibrary(null);
    setTopics([]);
    setScreen({ kind: 'signed-out' });
  };

  const onSaved = (saved: SavedLink) => {
    if (user) {
      const link = { id: saved.linkUid, url: saved.url, title: saved.title, tags: saved.tags, createdAt: Date.now() };
      void noteSaved(user.uid, link).then(setLibrary);
    }
    const topic = saved.topic;
    // A topic the link went into moves to the front, as it does in the app.
    if (topic) setTopics((all) => recentFirst([...all.filter((t) => t.uid !== topic.uid), topic]));
    const message: WorkerRequest = { target: 'worker', type: saved.outcome === 'queued' ? 'queued' : 'saved' };
    void chrome.runtime.sendMessage(message).catch(() => {});
    setScreen(saved.outcome === 'queued' ? { kind: 'offline', saved } : { kind: 'saved', saved });
  };

  const saveAnother = () => openCompose({ kind: 'blank' });

  return (
    <>
      <Header account={user ? accountOf(user) : undefined} onSignOut={onSignOut} />
      {screen.kind === 'signed-out' && <SignedOut onSignedIn={onSignedIn} />}
      {screen.kind === 'home' && (
        <Home
          tab={screen.tab}
          links={library?.links ?? null}
          now={Date.now()}
          onSaveTab={() => screen.tab && openCompose({ kind: 'tab', tab: screen.tab })}
          onSaveUrl={(url) => openCompose({ kind: 'prefill', url })}
          onOpen={(link) => void chrome.tabs.create({ url: link.url })}
        />
      )}
      {screen.kind === 'compose' && user && (
        <Compose key={screen.key} uid={user.uid} init={screen.init} allTags={library?.tags ?? []} topics={topics} onSaved={onSaved} />
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
        {taggedSentence(saved.tags)}
        {saved.topic && `Added to ${saved.topic.name}. `}It’ll show up in Kortex after the app’s next sync.
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

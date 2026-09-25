import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { TriangleAlert } from 'lucide-preact';
import { cleanTags, formatAge, sortTags } from '../lib/linkDoc';
import { normalizeInput } from '../lib/linkKey';
import { lookupLink, saveLink, type LinkLookup, type SaveOutcome } from '../lib/links';
import { fetchPageMeta, readTabImage } from '../lib/meta';
import {
  Footnote,
  LinkField,
  Notice,
  PreviewCard,
  PreviewLoading,
  PrimaryButton,
  TagChips,
  TonalButton,
} from './components';

export interface TabInfo {
  id: number;
  url: string;
  title: string;
}

/** How the save screen starts: the current tab (02), a prefilled link, empty (04), or a tab that can't be saved (07). */
export type ComposeInit =
  | { kind: 'tab'; tab: TabInfo }
  | { kind: 'prefill'; url: string }
  | { kind: 'blank' }
  | { kind: 'cant-save' };

export interface SavedLink {
  url: string;
  linkUid: string;
  title: string;
  imageUrl: string | null;
  tags: string[];
  /** True when the link already existed and only its tags changed. */
  updated: boolean;
  outcome: SaveOutcome;
}

interface Meta {
  url: string;
  title: string | null;
  imageUrl: string | null;
  reading: boolean;
}

const TYPING_DELAY_MS = 400;

function uniqueByCase(tags: string[]): string[] {
  const seen = new Set<string>();
  return tags.filter((t) => {
    const k = t.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function Compose(props: {
  uid: string;
  init: ComposeInit;
  allTags: string[];
  onSaved: (saved: SavedLink) => void;
}) {
  const { uid, init } = props;
  const tab = init.kind === 'tab' ? init.tab : null;

  const [text, setText] = useState(init.kind === 'tab' ? init.tab.url : init.kind === 'prefill' ? init.url : '');
  const [edited, setEdited] = useState(init.kind !== 'tab');
  const link = useMemo(() => normalizeInput(text), [text]);
  const fromTab = !!tab && !edited;

  const [meta, setMeta] = useState<Meta | null>(null);
  const [lookup, setLookup] = useState<LinkLookup | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addedTags, setAddedTags] = useState<string[]>([]);
  const [tagEditing, setTagEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const lookups = useRef(new Map<string, Promise<LinkLookup>>());
  const tabImage = useRef<Promise<string | null> | null>(null);

  const getLookup = (url: string): Promise<LinkLookup> => {
    let p = lookups.current.get(url);
    if (!p) {
      p = lookupLink(uid, url);
      p.catch(() => lookups.current.delete(url));
      lookups.current.set(url, p);
    }
    return p;
  };

  useEffect(() => {
    if (init.kind === 'blank' || init.kind === 'cant-save') inputRef.current?.focus();
  }, []);

  // Title and image: from the tab itself, or by reading the pasted page.
  useEffect(() => {
    if (!link) {
      setMeta(null);
      return;
    }
    if (fromTab && tab) {
      setMeta({ url: link, title: tab.title || null, imageUrl: null, reading: false });
      tabImage.current ??= readTabImage(tab.id);
      let live = true;
      tabImage.current.then((imageUrl) => live && setMeta((m) => (m?.url === link ? { ...m, imageUrl } : m)));
      return () => void (live = false);
    }
    setMeta({ url: link, title: null, imageUrl: null, reading: true });
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchPageMeta(link, controller.signal)
        .catch(() => ({ title: null, imageUrl: null }))
        .then((m) => {
          if (!controller.signal.aborted) setMeta({ url: link, ...m, reading: false });
        });
    }, init.kind === 'prefill' && !edited ? 0 : TYPING_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [link, fromTab]);

  // Is it already in Links? One read per distinct link.
  useEffect(() => {
    setLookup(null);
    if (!link) return;
    let live = true;
    const timer = setTimeout(
      () => {
        getLookup(link)
          .then((l) => {
            if (!live) return;
            setLookup(l);
            if (l.existing.state === 'active') setSelected(new Set(l.existing.doc.tags.map((t) => t.toLowerCase())));
          })
          .catch((e) => console.warn('Kortex: lookup failed', e));
      },
      fromTab || (init.kind === 'prefill' && !edited) ? 0 : TYPING_DELAY_MS,
    );
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [link]);

  const active = lookup && lookup.url === link?.trim() && lookup.existing.state === 'active' ? lookup.existing.doc : null;

  const shownTags = useMemo(() => {
    const base = sortTags(uniqueByCase([...props.allTags, ...(active?.tags ?? [])]));
    const lower = new Set(base.map((t) => t.toLowerCase()));
    return [...base, ...addedTags.filter((t) => !lower.has(t.toLowerCase()))];
  }, [props.allTags, active, addedTags]);

  const toggle = (tag: string) => {
    const next = new Set(selected);
    const k = tag.toLowerCase();
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setSelected(next);
  };

  const addTag = (raw: string) => {
    const [tag] = cleanTags([raw], shownTags);
    if (!tag) return;
    if (!shownTags.some((t) => t.toLowerCase() === tag.toLowerCase())) setAddedTags([...addedTags, tag]);
    setSelected(new Set(selected).add(tag.toLowerCase()));
  };

  const save = async () => {
    if (!link || busy) return;
    setBusy(true);
    setError(null);
    try {
      const l = await getLookup(link);
      const existing = l.existing.state === 'active' ? l.existing.doc : null;
      const tags = cleanTags(
        shownTags.filter((t) => selected.has(t.toLowerCase())),
        shownTags,
      );
      let title: string;
      let imageUrl: string | null;
      if (existing) {
        title = existing.title || link;
        imageUrl = existing.imageUrl;
      } else {
        const m = meta?.url === link ? meta : null;
        title = m?.title || link;
        imageUrl = m?.imageUrl ?? null;
        if (fromTab && !imageUrl && tabImage.current) {
          imageUrl = await Promise.race([tabImage.current, new Promise<null>((r) => setTimeout(() => r(null), 800))]);
        }
      }
      const outcome = await saveLink(uid, l, { title, imageUrl, tags });
      props.onSaved({ url: l.url, linkUid: l.linkUid, title, imageUrl, tags, updated: !!existing, outcome });
    } catch (e) {
      console.error('Kortex: save failed', e);
      setError(e instanceof Error && /permission/i.test(e.message) ? 'Kortex couldn’t write to your account. Try signing in again.' : 'Couldn’t save this link. Try again.');
      setBusy(false);
    }
  };

  // Enter anywhere saves, except while typing a tag (that Enter adds the tag).
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.isComposing || e.defaultPrevented) return;
      if (e.target instanceof HTMLButtonElement) return; // let a focused button click
      if (tagEditing) return;
      e.preventDefault();
      void saveRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [tagEditing]);

  const paste = async () => {
    try {
      const value = (await navigator.clipboard.readText()).trim();
      if (value) {
        setText(value);
        setEdited(true);
      }
    } catch {
      // No clipboard access; the user can still paste with the keyboard.
    }
    inputRef.current?.focus();
  };

  const reading = !!meta?.reading && !active;
  const footnote = active
    ? 'Same page, same link — never saved twice'
    : reading
      ? 'Save works before the page is read'
      : 'Appears in the app after its next sync';

  return (
    <div class="body">
      {init.kind === 'cant-save' && !link && (
        <Notice icon={<TriangleAlert size={18} />} title="This page can’t be saved">
          Browser pages like chrome://extensions aren’t web links. Paste one instead.
        </Notice>
      )}

      <LinkField
        value={text}
        trailing={edited && text ? 'clear' : 'paste'}
        inputRef={inputRef}
        onInput={(v) => {
          setText(v);
          setEdited(true);
        }}
        onPaste={paste}
        onClear={() => {
          setText('');
          setEdited(true);
          inputRef.current?.focus();
        }}
      />

      {link && (
        <>
          {reading ? (
            <PreviewLoading />
          ) : (
            <PreviewCard
              url={link}
              title={active?.title || (meta?.url === link && meta.title) || link}
              imageUrl={active?.imageUrl ?? (meta?.url === link ? meta.imageUrl : null)}
              status={active ? `Already in Links · Saved ${formatAge(active.createdAt, Date.now())}` : undefined}
            />
          )}

          <TagChips
            tags={shownTags}
            selected={selected}
            onToggle={toggle}
            onAdd={addTag}
            onEditingChange={setTagEditing}
          />

          {active ? (
            <TonalButton label="Update tags" busy={busy} onClick={save} />
          ) : (
            <PrimaryButton label="Save to Links" busy={busy} onClick={save} />
          )}

          {error ? <div class="error-text">{error}</div> : <Footnote>{footnote}</Footnote>}
        </>
      )}
    </div>
  );
}

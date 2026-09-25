import { collection, getDocs, orderBy, query, Timestamp, where } from 'firebase/firestore';
import { getDb } from './firebase';
import { formatAge, sortTags, toExisting } from './linkDoc';
import { displayDomain } from './linkKey';

/**
 * A local index of the user's non-deleted links, for the saved-links list, its
 * search and the tag list (there is no tags collection). To keep reads low
 * (Spark plan) it lives in chrome.storage.local and only asks Firestore for
 * links whose `serverUpdatedAt` is after the newest one it has seen.
 */

const KEY = 'library';
/** Earlier versions cached only tags under this key; it's dropped so the index is built in full. */
const OLD_KEY = 'tagCache';

export interface LibraryLink {
  id: string;
  url: string;
  title: string;
  tags: string[];
  createdAt: number;
}

interface LibraryCache {
  uid: string;
  /** Newest serverUpdatedAt seen, as [seconds, nanoseconds]. Null before the first full read. */
  cursor: [number, number] | null;
  /** linkUid → link, non-deleted only. */
  links: Record<string, Omit<LibraryLink, 'id'>>;
}

export interface Library {
  /** Newest first. */
  links: LibraryLink[];
  tags: string[];
}

async function readCache(uid: string): Promise<LibraryCache> {
  const stored = (await chrome.storage.local.get(KEY))[KEY] as LibraryCache | undefined;
  return stored?.uid === uid ? stored : { uid, cursor: null, links: {} };
}

async function writeCache(cache: LibraryCache): Promise<void> {
  await chrome.storage.local.set({ [KEY]: cache });
  await chrome.storage.local.remove(OLD_KEY);
}

export function tagsOf(links: Iterable<{ tags: string[] }>): string[] {
  const byLower = new Map<string, string>();
  for (const { tags } of links) {
    for (const t of tags) if (t.trim() && !byLower.has(t.toLowerCase())) byLower.set(t.toLowerCase(), t);
  }
  return sortTags(byLower.values());
}

function libraryOf(cache: Pick<LibraryCache, 'links'>): Library {
  const links = Object.entries(cache.links)
    .map(([id, l]) => ({ id, ...l }))
    .sort((a, b) => b.createdAt - a.createdAt);
  return { links, tags: tagsOf(links) };
}

/** The index as last stored, instantly; null before the first full read (unknown, not empty). */
export async function cachedLibrary(uid: string): Promise<Library | null> {
  const cache = await readCache(uid);
  return cache.cursor ? libraryOf(cache) : null;
}

/**
 * Brings the index up to date: the first time reads every link once, after
 * that only links changed since the cursor. Returns the fresh library.
 */
export async function refreshLibrary(uid: string): Promise<Library> {
  const cache = await readCache(uid);
  const links = collection(getDb(), 'users', uid, 'links');
  const q = cache.cursor
    ? query(links, where('serverUpdatedAt', '>', new Timestamp(cache.cursor[0], cache.cursor[1])), orderBy('serverUpdatedAt'))
    : query(links);
  const snap = await getDocs(q);
  if (snap.metadata.fromCache) return libraryOf(cache); // offline: keep the cursor where it is

  for (const d of snap.docs) {
    const data = d.data();
    const existing = toExisting(data);
    if (existing.state === 'active') {
      const { url, title, tags, createdAt } = existing.doc;
      cache.links[d.id] = { url, title: title || url, tags: tags.filter((t) => t.trim() !== ''), createdAt };
    } else {
      delete cache.links[d.id];
    }

    const ts = data.serverUpdatedAt;
    if (ts instanceof Timestamp) {
      const c = cache.cursor;
      if (!c || ts.seconds > c[0] || (ts.seconds === c[0] && ts.nanoseconds > c[1])) cache.cursor = [ts.seconds, ts.nanoseconds];
    }
  }
  // An empty library still gets a cursor, so the next open doesn't read everything again.
  cache.cursor ??= [0, 0];
  await writeCache(cache);
  return libraryOf(cache);
}

/** Records a save made here, so the index is right before the next refresh. */
export async function noteSaved(uid: string, link: LibraryLink): Promise<Library> {
  const cache = await readCache(uid);
  const { id, ...rest } = link;
  // An update keeps the original save time.
  cache.links[id] = { ...rest, createdAt: cache.links[id]?.createdAt ?? rest.createdAt };
  await writeCache(cache);
  return libraryOf(cache);
}

export async function clearLibraryCache(): Promise<void> {
  await chrome.storage.local.remove([KEY, OLD_KEY]);
}

/** Every word of the query appears in the title, the domain or a tag (case-insensitive). */
export function matchesQuery(link: Pick<LibraryLink, 'url' | 'title' | 'tags'>, q: string): boolean {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = [link.title, displayDomain(link.url), ...link.tags].join('\n').toLowerCase();
  return words.every((w) => haystack.includes(w));
}

/** "ANDROID · 3D AGO": the link's tags, then its age, as on the saved-links cards. */
export function linkMeta(link: Pick<LibraryLink, 'tags' | 'createdAt'>, now: number): string {
  return [...link.tags.map((t) => t.toUpperCase()), formatAge(link.createdAt, now)].join(' · ');
}

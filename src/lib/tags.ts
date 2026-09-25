import { collection, getDocs, orderBy, query, Timestamp, where } from 'firebase/firestore';
import { getDb } from './firebase';
import { sortTags } from './linkDoc';

/**
 * The tag list is every tag on the user's non-deleted links; there is no tags
 * collection. To keep reads low (Spark plan) the extension caches each link's
 * tags in chrome.storage.local and only asks Firestore for links whose
 * `serverUpdatedAt` is after the newest one it has seen.
 */

const KEY = 'tagCache';

interface TagCache {
  uid: string;
  /** Newest serverUpdatedAt seen, as [seconds, nanoseconds]. Null before the first full read. */
  cursor: [number, number] | null;
  /** linkUid → tags, for non-deleted links that carry tags. */
  links: Record<string, string[]>;
}

async function readCache(uid: string): Promise<TagCache> {
  const stored = (await chrome.storage.local.get(KEY))[KEY] as TagCache | undefined;
  return stored?.uid === uid ? stored : { uid, cursor: null, links: {} };
}

async function writeCache(cache: TagCache): Promise<void> {
  await chrome.storage.local.set({ [KEY]: cache });
}

export function tagsOf(cache: Pick<TagCache, 'links'>): string[] {
  const byLower = new Map<string, string>();
  for (const tags of Object.values(cache.links)) {
    for (const t of tags) if (!byLower.has(t.toLowerCase())) byLower.set(t.toLowerCase(), t);
  }
  return sortTags(byLower.values());
}

/** Tags from the local cache, instantly. */
export async function cachedTags(uid: string): Promise<string[]> {
  return tagsOf(await readCache(uid));
}

/**
 * Brings the cache up to date: the first time reads every link once, after
 * that only links changed since the cursor. Returns the fresh tag list.
 */
export async function refreshTags(uid: string): Promise<string[]> {
  const cache = await readCache(uid);
  const links = collection(getDb(), 'users', uid, 'links');
  const q = cache.cursor
    ? query(links, where('serverUpdatedAt', '>', new Timestamp(cache.cursor[0], cache.cursor[1])), orderBy('serverUpdatedAt'))
    : query(links);
  const snap = await getDocs(q);
  if (snap.metadata.fromCache) return tagsOf(cache); // offline: keep the cursor where it is

  for (const d of snap.docs) {
    const data = d.data();
    const tags = Array.isArray(data.tags) ? data.tags.filter((t): t is string => typeof t === 'string' && t.trim() !== '') : [];
    if (data.deleted === true || tags.length === 0) delete cache.links[d.id];
    else cache.links[d.id] = tags;

    const ts = data.serverUpdatedAt;
    if (ts instanceof Timestamp) {
      const c = cache.cursor;
      if (!c || ts.seconds > c[0] || (ts.seconds === c[0] && ts.nanoseconds > c[1])) cache.cursor = [ts.seconds, ts.nanoseconds];
    }
  }
  // An empty library still gets a cursor, so the next open doesn't read everything again.
  cache.cursor ??= [0, 0];
  await writeCache(cache);
  return tagsOf(cache);
}

/** Records a save made here, so the list is right before the next refresh. */
export async function noteSavedTags(uid: string, linkUid: string, tags: string[]): Promise<void> {
  const cache = await readCache(uid);
  if (tags.length === 0) delete cache.links[linkUid];
  else cache.links[linkUid] = tags;
  await writeCache(cache);
}

export async function clearTagCache(): Promise<void> {
  await chrome.storage.local.remove(KEY);
}

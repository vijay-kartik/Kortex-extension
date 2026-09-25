import { doc, getDoc, getDocFromCache, serverTimestamp, setDoc, updateDoc, type DocumentSnapshot } from 'firebase/firestore';
import { ACK_TIMEOUT_MS, LOOKUP_TIMEOUT_MS } from '../config';
import { getDb } from './firebase';
import { linkUid, linkUrlKey } from './linkKey';
import { planSave, toExisting, type ExistingLink } from './linkDoc';

export interface LinkLookup {
  url: string;
  urlKey: string;
  linkUid: string;
  existing: ExistingLink;
}

export interface LinkContent {
  title: string;
  imageUrl: string | null;
  tags: string[];
}

export type SaveOutcome = 'acked' | 'queued' | 'unchanged';

function linkRef(uid: string, id: string) {
  return doc(getDb(), 'users', uid, 'links', id);
}

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

/**
 * Reads the link's doc (1 read). Falls back to the local cache when the network
 * is slow or offline, and treats an uncached doc as missing in that case.
 */
export async function lookupLink(uid: string, url: string): Promise<LinkLookup> {
  const urlKey = linkUrlKey(url);
  const id = await linkUid(urlKey);
  const ref = linkRef(uid, id);
  let snap: DocumentSnapshot | undefined;
  try {
    snap = await Promise.race([getDoc(ref), timeout(LOOKUP_TIMEOUT_MS)]);
  } catch {
    try {
      snap = await getDocFromCache(ref);
    } catch {
      snap = undefined;
    }
  }
  return { url: url.trim(), urlKey, linkUid: id, existing: toExisting(snap?.exists() ? snap.data() : undefined) };
}

/**
 * Writes the link per the data contract (section 5) and resolves without
 * waiting for the server: 'acked' when Firestore confirms within ~2s, 'queued'
 * when offline or unconfirmed (the write stays in the IndexedDB cache and
 * uploads later), 'unchanged' when there was nothing to write.
 * Rejects if Firestore refuses the write within that window.
 */
export async function saveLink(
  uid: string,
  lookup: LinkLookup,
  content: LinkContent,
  options: { keepActive?: boolean } = {},
): Promise<SaveOutcome> {
  const plan = planSave(
    lookup.existing,
    { url: lookup.url, urlKey: lookup.urlKey, ...content },
    Date.now(),
    serverTimestamp(),
    options,
  );
  if (plan.op === 'none') return 'unchanged';

  const ref = linkRef(uid, lookup.linkUid);
  const write = plan.op === 'set' ? setDoc(ref, plan.data) : updateDoc(ref, plan.data);
  write.catch((e) => console.warn('Kortex: write failed', e));

  if (!navigator.onLine) return 'queued';
  return Promise.race([
    write.then(() => 'acked' as const),
    new Promise<'queued'>((resolve) => setTimeout(() => resolve('queued'), ACK_TIMEOUT_MS)),
  ]);
}

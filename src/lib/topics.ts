import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { LOOKUP_TIMEOUT_MS } from '../config';
import { getDb } from './firebase';
import { ackOrQueue } from './links';
import { linkItemDoc, newTopicDoc, recentFirst, toTopic, type Topic } from './topicDoc';

/**
 * The user's topics, for the save screen's topic chips. Like the link index,
 * they're cached in chrome.storage.local and refreshed with only the topics
 * changed since the newest `serverUpdatedAt` seen, to keep reads low.
 */

const KEY = 'topics';

interface TopicCache {
  uid: string;
  cursor: [number, number] | null;
  topics: Record<string, Omit<Topic, 'uid'>>;
}

async function readCache(uid: string): Promise<TopicCache> {
  const stored = (await chrome.storage.local.get(KEY))[KEY] as TopicCache | undefined;
  return stored?.uid === uid ? stored : { uid, cursor: null, topics: {} };
}

async function writeCache(cache: TopicCache): Promise<void> {
  await chrome.storage.local.set({ [KEY]: cache });
}

function listOf(cache: TopicCache): Topic[] {
  return recentFirst(Object.entries(cache.topics).map(([uid, t]) => ({ uid, ...t })));
}

/** Topics as last stored, most recent first, instantly. */
export async function cachedTopics(uid: string): Promise<Topic[]> {
  return listOf(await readCache(uid));
}

/** Brings the cache up to date: every topic the first time, after that only changed ones. */
export async function refreshTopics(uid: string): Promise<Topic[]> {
  const cache = await readCache(uid);
  const topics = collection(getDb(), 'users', uid, 'topics');
  const q = cache.cursor
    ? query(topics, where('serverUpdatedAt', '>', new Timestamp(cache.cursor[0], cache.cursor[1])), orderBy('serverUpdatedAt'))
    : query(topics);
  const snap = await getDocs(q);
  if (snap.metadata.fromCache) return listOf(cache);

  for (const d of snap.docs) {
    const data = d.data();
    const topic = toTopic(d.id, data);
    if (topic) cache.topics[d.id] = { name: topic.name, updatedAt: topic.updatedAt };
    else delete cache.topics[d.id];

    const ts = data.serverUpdatedAt;
    if (ts instanceof Timestamp) {
      const c = cache.cursor;
      if (!c || ts.seconds > c[0] || (ts.seconds === c[0] && ts.nanoseconds > c[1])) cache.cursor = [ts.seconds, ts.nanoseconds];
    }
  }
  cache.cursor ??= [0, 0];
  await writeCache(cache);
  return listOf(cache);
}

export async function clearTopicCache(): Promise<void> {
  await chrome.storage.local.remove(KEY);
}

/**
 * Uids of the topics that already hold this link. Falls back to none when the
 * network is slow; adding the link again is then caught by the app's pull,
 * which drops an item for a link its topic already holds.
 */
export async function topicsHoldingLink(uid: string, linkUid: string): Promise<string[]> {
  const q = query(collection(getDb(), 'users', uid, 'topicItems'), where('linkUid', '==', linkUid));
  try {
    const snap = await Promise.race([
      getDocs(q),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), LOOKUP_TIMEOUT_MS)),
    ]);
    return snap.docs.filter((d) => d.data().deleted !== true).map((d) => d.data().topicUid as string);
  } catch {
    return [];
  }
}

/** An existing topic, or one to create with this name. */
export type TopicTarget = { kind: 'existing'; topic: Topic } | { kind: 'new'; name: string };

/**
 * Adds the saved link to a topic in one batch: creates the topic if it's new,
 * adds a link item, and marks the topic changed (as the app does, so it moves
 * to the top of the list). Resolves like saveLink: 'acked' or 'queued'.
 */
export async function addLinkToTopic(
  uid: string,
  link: { linkUid: string; url: string },
  target: TopicTarget,
): Promise<{ outcome: 'acked' | 'queued'; topic: Topic }> {
  const db = getDb();
  const now = Date.now();
  const batch = writeBatch(db);

  const topicUid = target.kind === 'existing' ? target.topic.uid : crypto.randomUUID();
  const topicRef = doc(db, 'users', uid, 'topics', topicUid);
  if (target.kind === 'new') {
    batch.set(topicRef, newTopicDoc(target.name, now, serverTimestamp()));
  } else {
    batch.update(topicRef, { updatedAt: now, serverUpdatedAt: serverTimestamp() });
  }
  const itemRef = doc(db, 'users', uid, 'topicItems', crypto.randomUUID());
  batch.set(itemRef, linkItemDoc(topicUid, link.linkUid, link.url, now, serverTimestamp()));

  const outcome = await ackOrQueue(batch.commit());
  const topic: Topic = { uid: topicUid, name: target.kind === 'existing' ? target.topic.name : target.name, updatedAt: now };

  const cache = await readCache(uid);
  cache.topics[topic.uid] = { name: topic.name, updatedAt: now };
  await writeCache(cache);
  return { outcome, topic };
}

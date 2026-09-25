/**
 * Topic and topic-item docs as the app's cloud sync defines them (Kortex app,
 * docs/CLOUD_SYNC_PLAN.md › Firestore layout):
 *   users/{uid}/topics/{topicUid}     name, purpose?, pinned, sections, createdAt, updatedAt, serverUpdatedAt, deleted
 *   users/{uid}/topicItems/{itemUid}  topicUid, type, addedAt, linkUid?, done, pinned, updatedAt, serverUpdatedAt, deleted
 * Uids are random UUIDs. A link item holds only `linkUid`; the link itself stays in Links.
 * Pure functions only, so the contract can be unit-tested without Firestore.
 */

export interface TopicDoc<Ts = unknown> {
  name: string;
  purpose: null;
  pinned: boolean;
  /** ItemType names; a new topic starts with none, as in the app. */
  sections: string[];
  createdAt: number;
  updatedAt: number;
  serverUpdatedAt: Ts;
  deleted: boolean;
}

/** The app's ItemType names that are backed by a Links entry. */
export type LinkItemType = 'Link' | 'Video';

export interface TopicItemDoc<Ts = unknown> {
  topicUid: string;
  type: LinkItemType;
  addedAt: number;
  linkUid: string;
  done: boolean;
  pinned: boolean;
  updatedAt: number;
  serverUpdatedAt: Ts;
  deleted: boolean;
}

export interface Topic {
  uid: string;
  name: string;
  /** When the topic or its items last changed; the picker lists the most recent first. */
  updatedAt: number;
}

/** Trimmed; null when blank (the app refuses a blank name). */
export function cleanTopicName(raw: string): string | null {
  const name = raw.trim();
  return name || null;
}

/** Topic names are unique ignoring case. */
export function findTopicByName<T extends Pick<Topic, 'name'>>(topics: T[], name: string): T | undefined {
  const lower = name.trim().toLowerCase();
  return topics.find((t) => t.name.toLowerCase() === lower);
}

export function recentFirst(topics: Iterable<Topic>): Topic[] {
  return [...topics].sort((a, b) => b.updatedAt - a.updatedAt || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

export function newTopicDoc<Ts>(name: string, now: number, serverTimestamp: Ts): TopicDoc<Ts> {
  return {
    name,
    purpose: null,
    pinned: false,
    sections: [],
    createdAt: now,
    updatedAt: now,
    serverUpdatedAt: serverTimestamp,
    deleted: false,
  };
}

export function linkItemDoc<Ts>(topicUid: string, linkUid: string, url: string, now: number, serverTimestamp: Ts): TopicItemDoc<Ts> {
  return {
    topicUid,
    type: linkItemType(url),
    addedAt: now,
    linkUid,
    done: false,
    pinned: false,
    updatedAt: now,
    serverUpdatedAt: serverTimestamp,
    deleted: false,
  };
}

/**
 * The app's DetectItemType, for link-backed items: known video addresses are
 * Video, anything else is a Link (a .pdf address is still a Link here, since a
 * Doc item needs a file the extension doesn't have).
 */
export function linkItemType(url: string): LinkItemType {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return 'Link';
  }
  const host = parsed.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
  const path = parsed.pathname.toLowerCase();
  switch (host) {
    case 'youtube.com':
      return path === '/watch' || ['/shorts/', '/live/', '/embed/'].some((p) => path.startsWith(p)) ? 'Video' : 'Link';
    case 'youtu.be':
      return path.length > 1 ? 'Video' : 'Link';
    case 'vimeo.com':
      return /^\/\d+\/?$/.test(path) ? 'Video' : 'Link';
    default:
      return 'Link';
  }
}

/** Reads a raw topic doc; null when deleted or malformed. */
export function toTopic(uid: string, data: Record<string, unknown> | undefined): Topic | null {
  if (!data || data.deleted === true) return null;
  if (typeof data.name !== 'string' || !data.name.trim()) return null;
  const updatedAt = typeof data.updatedAt === 'number' ? data.updatedAt : typeof data.createdAt === 'number' ? data.createdAt : 0;
  return { uid, name: data.name, updatedAt };
}

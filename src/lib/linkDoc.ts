/**
 * The Firestore link doc (users/{uid}/links/{linkUid}) and the rules for writing it.
 * Pure functions only, so the contract can be unit-tested without Firestore.
 */

export interface LinkDoc<Ts = unknown> {
  url: string;
  urlKey: string;
  title: string;
  tags: string[];
  imageUrl: string | null;
  imageHidden: boolean;
  createdAt: number;
  updatedAt: number;
  serverUpdatedAt: Ts;
  deleted: boolean;
}

/** What the extension knows about the doc before writing. */
export type ExistingLink =
  | { state: 'missing' }
  | { state: 'deleted' }
  | { state: 'active'; doc: Pick<LinkDoc, 'url' | 'title' | 'tags' | 'imageUrl' | 'createdAt'> };

export interface SaveInput {
  url: string;
  urlKey: string;
  title: string;
  imageUrl: string | null;
  tags: string[];
}

export type WritePlan<Ts> =
  | { op: 'set'; data: LinkDoc<Ts> }
  | { op: 'update'; data: Pick<LinkDoc<Ts>, 'tags' | 'updatedAt' | 'serverUpdatedAt'> }
  | { op: 'none' };

/**
 * Section 5 of the brief:
 * - missing or soft-deleted: write every field fresh (deleted: false);
 * - active: only `tags`, `updatedAt` and `serverUpdatedAt` change.
 * `keepActive` is for the right-click path, which has no tags to set and so
 * leaves an existing link untouched.
 */
export function planSave<Ts>(
  existing: ExistingLink,
  input: SaveInput,
  now: number,
  serverTimestamp: Ts,
  options: { keepActive?: boolean } = {},
): WritePlan<Ts> {
  if (existing.state === 'active') {
    if (options.keepActive) return { op: 'none' };
    return { op: 'update', data: { tags: input.tags, updatedAt: now, serverUpdatedAt: serverTimestamp } };
  }
  const url = input.url.trim();
  return {
    op: 'set',
    data: {
      url,
      urlKey: input.urlKey,
      title: input.title.trim() || url,
      tags: input.tags,
      imageUrl: input.imageUrl || null,
      imageHidden: false,
      createdAt: now,
      updatedAt: now,
      serverUpdatedAt: serverTimestamp,
      deleted: false,
    },
  };
}

/** Reads a raw Firestore doc into ExistingLink. */
export function toExisting(data: Record<string, unknown> | undefined): ExistingLink {
  if (!data) return { state: 'missing' };
  if (data.deleted === true) return { state: 'deleted' };
  return {
    state: 'active',
    doc: {
      url: typeof data.url === 'string' ? data.url : '',
      title: typeof data.title === 'string' ? data.title : '',
      tags: Array.isArray(data.tags) ? data.tags.filter((t): t is string => typeof t === 'string') : [],
      imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : null,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : 0,
    },
  };
}

/**
 * Tag names: trimmed, non-empty, deduplicated case-insensitively. A name that
 * already exists with different case takes the existing spelling.
 */
export function cleanTags(tags: string[], known: string[] = []): string[] {
  const spelling = new Map<string, string>();
  for (const k of known) {
    const t = k.trim();
    if (t && !spelling.has(t.toLowerCase())) spelling.set(t.toLowerCase(), t);
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const t = raw.trim();
    if (!t) continue;
    const lower = t.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    out.push(spelling.get(lower) ?? t);
  }
  return out;
}

export function sortTags(tags: Iterable<string>): string[] {
  return [...tags].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }) || a.localeCompare(b));
}

/** The app's age format: JUST NOW, 5M AGO, 3H AGO, 3D AGO, 2W AGO, 1MO AGO, 2Y AGO. */
export function formatAge(then: number, now: number): string {
  const minutes = Math.floor(Math.max(0, now - then) / 60_000);
  if (minutes < 1) return 'JUST NOW';
  if (minutes < 60) return `${minutes}M AGO`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}H AGO`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}D AGO`;
  if (days < 30) return `${Math.floor(days / 7)}W AGO`;
  if (days < 365) return `${Math.floor(days / 30)}MO AGO`;
  return `${Math.floor(days / 365)}Y AGO`;
}

/** "Tagged android." / "Tagged android and design." / "Tagged a, b and c." */
export function taggedSentence(tags: string[]): string {
  if (tags.length === 0) return '';
  if (tags.length === 1) return `Tagged ${tags[0]}. `;
  return `Tagged ${tags.slice(0, -1).join(', ')} and ${tags[tags.length - 1]}. `;
}

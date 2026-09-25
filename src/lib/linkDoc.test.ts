import { describe, expect, it } from 'vitest';
import { cleanTags, formatAge, planSave, sortTags, taggedSentence, toExisting, type SaveInput } from './linkDoc';

const TS = { sentinel: 'serverTimestamp' };
const NOW = 1_760_000_000_000;
const input: SaveInput = {
  url: '  https://example.com/post  ',
  urlKey: 'example.com/post',
  title: 'A post',
  imageUrl: 'https://example.com/og.png',
  tags: ['android'],
};

describe('planSave', () => {
  it('writes every field for a missing doc', () => {
    const plan = planSave({ state: 'missing' }, input, NOW, TS);
    expect(plan).toEqual({
      op: 'set',
      data: {
        url: 'https://example.com/post',
        urlKey: 'example.com/post',
        title: 'A post',
        tags: ['android'],
        imageUrl: 'https://example.com/og.png',
        imageHidden: false,
        createdAt: NOW,
        updatedAt: NOW,
        serverUpdatedAt: TS,
        deleted: false,
      },
    });
    if (plan.op === 'set') {
      expect(Object.keys(plan.data).sort()).toEqual(
        ['createdAt', 'deleted', 'imageHidden', 'imageUrl', 'serverUpdatedAt', 'tags', 'title', 'updatedAt', 'url', 'urlKey'],
      );
      expect(Number.isInteger(plan.data.createdAt)).toBe(true);
    }
  });

  it('writes a soft-deleted doc fresh, with deleted: false', () => {
    const plan = planSave({ state: 'deleted' }, input, NOW, TS);
    expect(plan.op).toBe('set');
    if (plan.op === 'set') {
      expect(plan.data.deleted).toBe(false);
      expect(plan.data.createdAt).toBe(NOW);
    }
  });

  it('only changes tags, updatedAt and serverUpdatedAt on an active doc', () => {
    const existing = toExisting({ url: 'https://example.com/post', title: 'Old', tags: ['x'], createdAt: 1, deleted: false });
    const plan = planSave(existing, { ...input, tags: ['design'] }, NOW, TS);
    expect(plan).toEqual({ op: 'update', data: { tags: ['design'], updatedAt: NOW, serverUpdatedAt: TS } });
  });

  it('right-click leaves an active doc alone', () => {
    const existing = toExisting({ tags: ['x'], deleted: false });
    expect(planSave(existing, { ...input, tags: [] }, NOW, TS, { keepActive: true })).toEqual({ op: 'none' });
    expect(planSave({ state: 'missing' }, { ...input, tags: [] }, NOW, TS, { keepActive: true }).op).toBe('set');
  });

  it('falls back to the address when there is no title or image', () => {
    const plan = planSave({ state: 'missing' }, { ...input, title: '  ', imageUrl: '' }, NOW, TS);
    if (plan.op !== 'set') throw new Error();
    expect(plan.data.title).toBe('https://example.com/post');
    expect(plan.data.imageUrl).toBeNull();
  });
});

describe('toExisting', () => {
  it('reads states', () => {
    expect(toExisting(undefined)).toEqual({ state: 'missing' });
    expect(toExisting({ deleted: true })).toEqual({ state: 'deleted' });
    expect(toExisting({ deleted: false, tags: ['a'] }).state).toBe('active');
  });
});

describe('tags', () => {
  it('trims, drops empties, dedupes case-insensitively and keeps existing spelling', () => {
    expect(cleanTags([' Android ', 'android', '', '  ', 'Design', 'new'], ['android', 'design'])).toEqual([
      'android',
      'design',
      'new',
    ]);
  });

  it('sorts alphabetically ignoring case', () => {
    expect(sortTags(['ticket', 'Android', 'design', 'to buy'])).toEqual(['Android', 'design', 'ticket', 'to buy']);
  });

  it('names tags in a sentence', () => {
    expect(taggedSentence([])).toBe('');
    expect(taggedSentence(['android'])).toBe('Tagged android. ');
    expect(taggedSentence(['a', 'b', 'c'])).toBe('Tagged a, b and c. ');
  });
});

describe('formatAge', () => {
  const m = 60_000;
  it.each([
    [0, 'JUST NOW'],
    [30_000, 'JUST NOW'],
    [5 * m, '5M AGO'],
    [3 * 60 * m, '3H AGO'],
    [3 * 1440 * m, '3D AGO'],
    [14 * 1440 * m, '2W AGO'],
    [31 * 1440 * m, '1MO AGO'],
    [400 * 1440 * m, '1Y AGO'],
  ])('%d ms ago -> %s', (ago, text) => {
    expect(formatAge(NOW - ago, NOW)).toBe(text);
  });
});

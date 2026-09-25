import { describe, expect, it } from 'vitest';
import { linkMeta, matchesQuery, tagsOf } from './library';

const link = {
  url: 'https://developer.android.com/develop/ui/compose/animation/introduction',
  title: 'Quick guide to Animations in Compose',
  tags: ['android', 'Design'],
};

describe('matchesQuery', () => {
  it('matches everything for an empty query', () => {
    expect(matchesQuery(link, '')).toBe(true);
    expect(matchesQuery(link, '   ')).toBe(true);
  });

  it('matches title, domain and tags, ignoring case', () => {
    expect(matchesQuery(link, 'ANIMATIONS')).toBe(true);
    expect(matchesQuery(link, 'developer.android')).toBe(true);
    expect(matchesQuery(link, 'design')).toBe(true);
  });

  it('needs every word to match somewhere', () => {
    expect(matchesQuery(link, 'compose android')).toBe(true);
    expect(matchesQuery(link, 'compose firebase')).toBe(false);
  });

  it('ignores the path, which the card does not show', () => {
    expect(matchesQuery(link, 'introduction')).toBe(false);
  });
});

describe('linkMeta', () => {
  const now = Date.UTC(2026, 8, 25);
  const day = 86_400_000;

  it('puts the tags, upper-cased, before the age', () => {
    expect(linkMeta({ tags: ['android'], createdAt: now - 3 * day }, now)).toBe('ANDROID · 3D AGO');
    expect(linkMeta({ tags: ['database', 'backend'], createdAt: now - 14 * day }, now)).toBe('DATABASE · BACKEND · 2W AGO');
  });

  it('shows only the age for an untagged link', () => {
    expect(linkMeta({ tags: [], createdAt: now - 7 * day }, now)).toBe('1W AGO');
  });
});

describe('tagsOf', () => {
  it('merges tags across links case-insensitively, keeping the first spelling', () => {
    expect(tagsOf([{ tags: ['Design', 'android'] }, { tags: ['design', 'to buy', ' '] }])).toEqual(['android', 'Design', 'to buy']);
  });
});

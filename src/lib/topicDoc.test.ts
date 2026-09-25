import { describe, expect, it } from 'vitest';
import { cleanTopicName, findTopicByName, linkItemDoc, linkItemType, newTopicDoc, recentFirst, toTopic } from './topicDoc';

const TS = { server: true };

describe('linkItemType (the app’s DetectItemType, link-backed)', () => {
  it.each([
    ['https://www.youtube.com/watch?v=abc', 'Video'],
    ['https://m.youtube.com/shorts/abc', 'Video'],
    ['https://youtube.com/live/abc', 'Video'],
    ['https://youtu.be/abc', 'Video'],
    ['https://vimeo.com/123456', 'Video'],
    ['https://www.youtube.com/@channel', 'Link'],
    ['https://youtu.be/', 'Link'],
    ['https://vimeo.com/channels/staffpicks', 'Link'],
    ['https://example.com/report.pdf', 'Link'],
    ['https://developer.android.com/develop/ui/compose/animation', 'Link'],
  ])('%s → %s', (url, type) => {
    expect(linkItemType(url)).toBe(type);
  });
});

describe('newTopicDoc', () => {
  it('writes every field the app pulls, with no purpose and no sections', () => {
    expect(newTopicDoc('Android dev', 1000, TS)).toEqual({
      name: 'Android dev',
      purpose: null,
      pinned: false,
      sections: [],
      createdAt: 1000,
      updatedAt: 1000,
      serverUpdatedAt: TS,
      deleted: false,
    });
  });
});

describe('linkItemDoc', () => {
  it('points at the link by uid and carries no copy of it', () => {
    expect(linkItemDoc('topic-1', 'link-1', 'https://youtu.be/abc', 2000, TS)).toEqual({
      topicUid: 'topic-1',
      type: 'Video',
      addedAt: 2000,
      linkUid: 'link-1',
      done: false,
      pinned: false,
      updatedAt: 2000,
      serverUpdatedAt: TS,
      deleted: false,
    });
  });
});

describe('topic names', () => {
  const topics = [
    { uid: 'a', name: 'Android dev', updatedAt: 1 },
    { uid: 'b', name: 'Reading list', updatedAt: 3 },
    { uid: 'c', name: 'backend', updatedAt: 3 },
  ];

  it('trims, and refuses a blank name', () => {
    expect(cleanTopicName('  Kitchen  ')).toBe('Kitchen');
    expect(cleanTopicName('   ')).toBeNull();
  });

  it('finds a topic ignoring case', () => {
    expect(findTopicByName(topics, ' android DEV ')?.uid).toBe('a');
    expect(findTopicByName(topics, 'Android')).toBeUndefined();
  });

  it('lists the most recently changed first, then by name', () => {
    expect(recentFirst(topics).map((t) => t.uid)).toEqual(['c', 'b', 'a']);
  });
});

describe('toTopic', () => {
  it('reads a topic doc', () => {
    expect(toTopic('x', { name: 'Home', updatedAt: 5, deleted: false })).toEqual({ uid: 'x', name: 'Home', updatedAt: 5 });
  });

  it('skips deleted and nameless docs', () => {
    expect(toTopic('x', { name: 'Home', deleted: true })).toBeNull();
    expect(toTopic('x', { name: '  ' })).toBeNull();
    expect(toTopic('x', undefined)).toBeNull();
  });

  it('falls back to createdAt when updatedAt is missing', () => {
    expect(toTopic('x', { name: 'Home', createdAt: 7 })?.updatedAt).toBe(7);
  });
});

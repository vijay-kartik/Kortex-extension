import { describe, expect, it } from 'vitest';
import { displayDomain, isSavableUrl, linkUid, linkUrlKey, normalizeInput } from './linkKey';

// Vectors from the implementation brief, section 6.3. These are the contract.
describe('linkUrlKey', () => {
  const base = linkUrlKey('https://example.com/post');

  it('base key', () => {
    expect(base).toBe('example.com/post');
  });

  it.each([
    'https://www.Example.com/post/',
    'http://example.com/post',
    'https://example.com/post#comments',
    'https://example.com/post?utm_source=x&utm_medium=social',
    'https://example.com/post?fbclid=abc',
    'https://example.com:443/post',
    '  https://example.com/post  ',
  ])('%j is the same page', (input) => {
    expect(linkUrlKey(input)).toBe(base);
  });

  it.each([
    'https://example.com/post?id=2',
    'https://example.com/Post',
    'https://example.com/post/2',
    'https://example.com:8080/post',
    'https://blog.example.com/post',
  ])('%j is a different page', (input) => {
    expect(linkUrlKey(input)).not.toBe(base);
  });

  it.each([
    ['https://example.com/search?utm_campaign=x&q=room&gclid=y&page=2', 'example.com/search?q=room&page=2'],
    ['https://example.com', 'example.com'],
    ['https://example.com/', 'example.com'],
    [' not a url ', 'not a url'],
    ['mailto:a@b.com', 'mailto:a@b.com'],
    ['https://münchen.de/straße', 'münchen.de/straße'],
  ])('%j -> %j', (input, key) => {
    expect(linkUrlKey(input)).toBe(key);
  });

  it('follows java.net.URL on the edges', () => {
    expect(linkUrlKey('HTTPS://user:pw@WWW.Example.com:80/a//?b=1&&UTM_x=2#f')).toBe('example.com/a?b=1');
    expect(linkUrlKey('https://example.com?q=1')).toBe('example.com?q=1');
    expect(linkUrlKey('https://example.com/a b?c d')).toBe('example.com/a b?c d');
    expect(linkUrlKey('https://example.com/?')).toBe('example.com');
    expect(linkUrlKey('https://example.com:abc/post')).toBe('https://example.com:abc/post');
    expect(linkUrlKey('https://example.com:/post')).toBe('example.com/post');
    expect(linkUrlKey('https://www.www.example.com')).toBe('www.example.com');
  });
});

describe('linkUid', () => {
  it.each([
    ['example.com/post', '1d990bb353ea3e44e1e1b66dc6c0b41f'],
    ['curaahome.com/products/curaa-automatic-pepper-grinder', '6b8f106dce806fa11f62324e43644b49'],
    ['google.com', 'd4c9d9027326271a89ce51fcaf328ed6'],
    ['news.ycombinator.com/item?id=1', '92237aeac6ebf5b11122597e3239e3dc'],
    ['münchen.de/straße', '366d475401ab8f89b62848fb9221bd5d'],
    ['not a url', 'd8b5bf9b9fd4760c61234d12614d80c9'],
  ])('%j -> %s', async (key, uid) => {
    expect(await linkUid(key)).toBe(uid);
  });

  it('end to end', async () => {
    expect(await linkUid(linkUrlKey('https://www.example.com/post/'))).toBe('1d990bb353ea3e44e1e1b66dc6c0b41f');
  });
});

describe('isSavableUrl / normalizeInput', () => {
  it.each(['chrome://extensions', 'file:///Users/a.txt', 'chrome://newtab/', 'about:blank', 'mailto:a@b.com', 'not a url', 'https://', ''])(
    '%j is not savable',
    (u) => {
      expect(isSavableUrl(u)).toBe(false);
      expect(normalizeInput(u)).toBeNull();
    },
  );

  it('accepts web links', () => {
    expect(isSavableUrl('https://chromewebstore.google.com/detail/x')).toBe(true);
    expect(normalizeInput('  https://example.com/post ')).toBe('https://example.com/post');
    expect(normalizeInput('example.com/post')).toBe('https://example.com/post');
    expect(normalizeInput('example.com:8080/post')).toBe('https://example.com:8080/post');
  });

  it('shows the domain as typed', () => {
    expect(displayDomain('https://www.Developer.Android.com/x')).toBe('developer.android.com');
    expect(displayDomain('https://münchen.de/straße')).toBe('münchen.de');
  });
});

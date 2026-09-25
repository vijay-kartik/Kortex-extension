import { PAGE_READ_TIMEOUT_MS } from '../config';

export interface PageMeta {
  title: string | null;
  imageUrl: string | null;
}

function absolute(href: string | null | undefined, base: string): string | null {
  const value = href?.trim();
  if (!value) return null;
  try {
    const u = new URL(value, base);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

function content(doc: Document, selector: string): string | null {
  return doc.querySelector(selector)?.getAttribute('content')?.trim() || null;
}

/** Title (`<title>`, then og:title) and og:image (then twitter:image) from a page's HTML. */
export function parseMeta(html: string, baseUrl: string): PageMeta {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const base = absolute(doc.querySelector('base[href]')?.getAttribute('href'), baseUrl) ?? baseUrl;
  const title =
    doc.querySelector('title')?.textContent?.replace(/\s+/g, ' ').trim() ||
    content(doc, 'meta[property="og:title"]') ||
    content(doc, 'meta[name="og:title"]');
  const image =
    content(doc, 'meta[property="og:image"]') ||
    content(doc, 'meta[property="og:image:url"]') ||
    content(doc, 'meta[name="twitter:image"]') ||
    content(doc, 'meta[property="twitter:image"]');
  return { title: title || null, imageUrl: absolute(image, base) };
}

/**
 * Fetches a pasted or right-clicked page and reads its title and image.
 * Gives up after ~5s; the caller then uses the address as the title.
 */
export async function fetchPageMeta(url: string, signal?: AbortSignal): Promise<PageMeta> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PAGE_READ_TIMEOUT_MS);
  signal?.addEventListener('abort', () => controller.abort(), { once: true });
  try {
    const res = await fetch(url, { signal: controller.signal, credentials: 'omit', redirect: 'follow' });
    if (!res.ok) return { title: null, imageUrl: null };
    const type = res.headers.get('content-type') ?? '';
    if (type && !/html|xml/i.test(type)) return { title: null, imageUrl: null };
    // Only the head matters; cap what we parse on very large pages.
    const html = (await res.text()).slice(0, 1_000_000);
    return parseMeta(html, res.url || url);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * og:image (or twitter:image) of an open tab, read by a one-off script.
 * Needs activeTab + scripting; returns null on pages the extension can't script.
 */
export async function readTabImage(tabId: number): Promise<string | null> {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const pick = (sel: string) => document.querySelector(sel)?.getAttribute('content')?.trim() || null;
        const raw =
          pick('meta[property="og:image"]') ||
          pick('meta[property="og:image:url"]') ||
          pick('meta[name="twitter:image"]') ||
          pick('meta[property="twitter:image"]');
        if (!raw) return null;
        try {
          return new URL(raw, document.baseURI).href;
        } catch {
          return null;
        }
      },
    });
    const value = result?.result;
    return typeof value === 'string' && /^https?:/i.test(value) ? value : null;
  } catch {
    return null;
  }
}

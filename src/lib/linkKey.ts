/**
 * Link identity. Must match the Android app's `linkUrlKey` / `linkUid` exactly,
 * because the shared id is what stops the app and the extension from creating
 * duplicate docs for the same page.
 *
 * The app parses with java.net.URL, which keeps host, path and query exactly as
 * typed. The WHATWG `URL` class does not (punycode hosts, percent-encoded paths,
 * `/` for a bare host), so this file splits the raw string the way Java does.
 */

interface JavaUrlParts {
  protocol: string;
  host: string;
  port: number; // -1 when absent
  path: string;
  query: string | null;
}

const SCHEME = /^([A-Za-z][A-Za-z0-9+.-]*):/;

/**
 * Mirrors the parts of `java.net.URL(String)` that `linkUrlKey` reads.
 * Returns null where Java would throw MalformedURLException.
 * Only http/https get a full parse; other schemes only need their name.
 */
function parseJavaUrl(spec: string): JavaUrlParts | null {
  const scheme = SCHEME.exec(spec);
  if (!scheme) return null;
  const protocol = scheme[1].toLowerCase();
  if (protocol !== 'http' && protocol !== 'https') {
    return { protocol, host: '', port: -1, path: '', query: null };
  }

  // java.net.URL strips the fragment first, then the query (first '?').
  let rest = spec.slice(scheme[0].length);
  const hash = rest.indexOf('#');
  if (hash !== -1) rest = rest.slice(0, hash);
  let query: string | null = null;
  const q = rest.indexOf('?');
  if (q !== -1) {
    query = rest.slice(q + 1);
    rest = rest.slice(0, q);
  }

  let host = '';
  let port = -1;
  let path = rest;
  if (rest.startsWith('//')) {
    const slash = rest.indexOf('/', 2);
    const end = slash === -1 ? rest.length : slash;
    const authority = rest.slice(2, end);
    path = rest.slice(end);

    let hostPort: string | null = authority;
    const at = authority.indexOf('@');
    if (at !== -1) {
      // More than one '@' leaves Java with no host at all.
      hostPort = at !== authority.lastIndexOf('@') ? null : authority.slice(at + 1);
    }
    if (hostPort !== null) {
      let portText: string | null = null;
      if (hostPort.startsWith('[')) {
        const close = hostPort.indexOf(']');
        if (close === -1) return null;
        host = hostPort.slice(0, close + 1);
        const after = hostPort.slice(close + 1);
        if (after.startsWith(':')) portText = after.slice(1);
        else if (after.length > 0) return null;
      } else {
        const colon = hostPort.indexOf(':');
        if (colon === -1) {
          host = hostPort;
        } else {
          host = hostPort.slice(0, colon);
          portText = hostPort.slice(colon + 1);
        }
      }
      if (portText) {
        // Integer.parseInt semantics: optional sign, decimal digits, 32-bit.
        if (!/^[+-]?\d+$/.test(portText)) return null;
        const n = Number(portText);
        if (n > 2147483647 || n < -1) return null;
        port = n;
      }
    }
  }
  return { protocol, host, port, path, query };
}

function isTrackingParam(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.startsWith('utm_') || lower === 'fbclid' || lower === 'gclid';
}

/** Kotlin `String.trim()`: strips leading/trailing whitespace. */
function kotlinTrim(s: string): string {
  return s.replace(/^\s+|\s+$/gu, '');
}

export function linkUrlKey(url: string): string {
  const trimmed = kotlinTrim(url);
  const parsed = parseJavaUrl(trimmed);
  if (!parsed) return trimmed;
  if (parsed.protocol !== 'http' && parsed.protocol !== 'https') return trimmed;

  let host = parsed.host.toLowerCase();
  if (host.startsWith('www.')) host = host.slice(4);
  const port = parsed.port !== -1 && parsed.port !== 80 && parsed.port !== 443 ? `:${parsed.port}` : '';
  const path = parsed.path.replace(/\/+$/, '');
  let query = '';
  if (parsed.query !== null) {
    const kept = parsed.query
      .split('&')
      .filter((part) => part.length > 0 && !isTrackingParam(part.split('=', 1)[0]));
    if (kept.length > 0) query = '?' + kept.join('&');
  }
  return host + port + path + query;
}

/** First 32 lowercase hex chars of SHA-256 over the UTF-8 bytes of `urlKey`. */
export async function linkUid(urlKey: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(urlKey));
  let hex = '';
  for (const b of new Uint8Array(digest)) hex += b.toString(16).padStart(2, '0');
  return hex.slice(0, 32);
}

/**
 * Whether the extension will save this address: http(s) with a host.
 * Uses the same raw split as `linkUrlKey`, plus the browser URL for validity.
 */
export function isSavableUrl(url: string): boolean {
  const trimmed = kotlinTrim(url);
  const parsed = parseJavaUrl(trimmed);
  if (!parsed || (parsed.protocol !== 'http' && parsed.protocol !== 'https')) return false;
  if (!parsed.host || /\s/.test(parsed.host)) return false;
  try {
    new URL(trimmed);
    return true;
  } catch {
    return false;
  }
}

/**
 * Turns what the user typed into an address to save: trims it, and adds
 * `https://` to something that looks like a bare domain ("example.com/post").
 * Returns null when it still isn't a savable link.
 */
export function normalizeInput(input: string): string | null {
  const trimmed = kotlinTrim(input);
  if (!trimmed) return null;
  if (isSavableUrl(trimmed)) return trimmed;
  if (!SCHEME.test(trimmed) || /^[^:/]+\.[^:/]+:\d/.test(trimmed)) {
    if (/^[\p{L}\p{N}-]+(\.[\p{L}\p{N}-]+)+(:\d+)?([/?#]|$)/u.test(trimmed)) {
      const withScheme = 'https://' + trimmed;
      if (isSavableUrl(withScheme)) return withScheme;
    }
  }
  return null;
}

/** Display domain for the preview card: host as typed (no punycode), without `www.`. */
export function displayDomain(url: string): string {
  const parsed = parseJavaUrl(kotlinTrim(url));
  return parsed ? parsed.host.toLowerCase().replace(/^www\./, '') : '';
}

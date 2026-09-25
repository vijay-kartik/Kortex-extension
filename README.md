# Kortex browser extension

Chrome (Manifest V3) extension that saves the current tab, or any pasted or right-clicked link, into the
signed-in user's Kortex **Links** library in Firestore (`users/{uid}/links/{linkUid}`). The Android app is the other writer,
so the extension follows the app's data contract exactly.

Designs: Figma `8CBjHcKRkTl4AroVOQlhL4`, page *Browser Extension — Mockups*, board `171:5`.

## Commands

```bash
npm install
npm test            # linkUrlKey / linkUid vectors, write rules, tags, age format
npm run build       # typecheck + build into dist/
npm run dev         # rebuild dist/ on change (development mode, with sourcemaps)
npm run preview:ui  # design QA gallery of every popup screen: http://localhost:5173/preview/
npm run icons       # re-render public/icons/*.png from the app icon artwork
```

Load it in Chrome: `chrome://extensions` → Developer mode → **Load unpacked** → pick `dist/`.

## One-time setup

1. **Firebase web app.** Firebase console → project `kortex-a24b7` → Project settings → Add app → Web. Copy
   `apiKey`, `appId` and `messagingSenderId` into `.env` (start from `.env.example`). These values aren't secret.
2. **Pin the extension id.** Generate a key and put the public key (base64, one line) in `EXTENSION_KEY`:
   ```bash
   openssl genrsa 2048 | openssl pkcs8 -topk8 -nocrypt -out key.pem
   ```
   ```bash
   openssl rsa -in key.pem -pubout -outform DER | base64 | tr -d '\n'
   ```
   Build, load unpacked, and note the extension id Chrome shows. It stays the same across reloads. Keep `key.pem` out of git.
3. **OAuth client.** Google Cloud console (project `kortex-a24b7`) → APIs & Services → Credentials → Create OAuth client ID →
   *Chrome extension*, with the id from step 2. Put the client id in `OAUTH_CLIENT_ID` and rebuild.
4. Google sign-in is already enabled in Firebase Auth. If the OAuth consent screen is in *Testing*, add your account as a
   test user.

## Layout

```
src/
  manifest.ts          Manifest V3, generated at build time (client id and key come from .env)
  config.ts            Firebase config and timeouts
  popup/               app.tsx (screens 01, 03, 08), compose.tsx (02, 04–07), components.tsx, popup.css
  background/index.ts  service worker: context menu, badge, retrying queued writes. No Firebase here.
  offscreen/main.ts    Firestore + DOMParser for the worker: right-click saves, uploading queued writes
  lib/
    linkKey.ts         linkUrlKey + linkUid (must match the app; see the tests)
    linkDoc.ts         doc shape and write rules (pure)
    links.ts           lookup (1 read) and save (1 write) against Firestore
    tags.ts            tag list with an incremental chrome.storage.local cache
    auth.ts            chrome.identity → Firebase Auth (web-extension build)
    meta.ts            title and og:image from a tab or a fetched page
  preview/             dev-only design QA gallery (not in the extension build)
  styles/tokens.css    Theme colours and fonts
```

## How it works

- **Identity.** `linkUrlKey` splits the raw string the way `java.net.URL` does, instead of using the WHATWG `URL`
  (which would punycode hosts and percent-encode paths). Every vector from the brief is a unit test. The vector
  `https://münchen.de/straße` → `münchen.de/straße` passes here, but **confirm it against the Kotlin function once**,
  since the app's tests don't cover it yet.
- **Writes.** When a link is entered, its doc is read once (1 read; if the network is slow or offline, the local cache
  is used). Missing or `deleted: true` docs get a full fresh write. Active docs only get `tags`, `updatedAt` and
  `serverUpdatedAt`. Timestamps are `Date.now()` millis, with `serverTimestamp()` on every write. Nothing is ever deleted
  or uploaded to Storage.
- **Offline.** Firestore uses the persistent IndexedDB cache. A save shows *Saved* (03) when the server acknowledges it
  within about 2s, and *Saved while offline* (08) otherwise. A queued write sets a flag and a `chrome.alarms` retry. Once a
  minute the worker opens the offscreen document, which runs `waitForPendingWrites` while online, so the write uploads
  without the user reopening the popup.
- **Right-click.** The worker hands the link to the offscreen document, which fetches the title and image (5s timeout)
  and writes with no tags. A link that's already saved is left untouched, so its tags are never cleared. On success the
  toolbar badge shows ✓ for 3s. If the user is signed out or the save fails, the popup opens prefilled (or, if it can't
  open, the badge shows "!" and the popup is prefilled next time it opens).
- **Tags.** The popup caches each link's tags in `chrome.storage.local` and queries only for links with
  `serverUpdatedAt` after the newest one it has seen. The first open reads the whole collection once, and each open
  after that costs 1+ reads.

## Decisions on the brief's open questions

1. **Host permissions.** `host_permissions` covers all http/https sites, rather than an optional permission on first
   paste. Requesting a permission from a popup can close the popup, and the right-click path has to read pages
   reliably. The cost is the broader install warning. The manifest also asks for `clipboardRead` so the clipboard icon
   can paste. Drop that permission if you'd rather avoid the extra warning; Cmd/Ctrl+V still works.
2. **Tags on right-click saves.** Not offered, as designed.
3. **Edge.** The same `dist/` build should load in Edge, but I haven't tested it there.

Small additions beyond the mocks:
- Typing a bare domain such as `example.com/post` saves it as `https://example.com/post`.
- Updating tags on an existing link shows "Tags updated" on the confirmation screen, instead of "Saved to Links".

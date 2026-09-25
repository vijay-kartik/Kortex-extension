/**
 * Manifest V3, generated at build time so the OAuth client id and the pinned
 * extension key come from `.env` instead of being committed.
 */
export function buildManifest(env: Record<string, string>, version: string) {
  const manifest: chrome.runtime.ManifestV3 = {
    manifest_version: 3,
    name: 'Kortex',
    description: 'Save the page you’re on, or any link, to your Kortex library.',
    version,
    minimum_chrome_version: '127',
    icons: { 16: 'icons/16.png', 32: 'icons/32.png', 48: 'icons/48.png', 128: 'icons/128.png' },
    action: {
      default_title: 'Save to Kortex',
      default_popup: 'popup/index.html',
      default_icon: { 16: 'icons/16.png', 32: 'icons/32.png' },
    },
    background: { service_worker: 'background.js', type: 'module' },
    permissions: ['activeTab', 'scripting', 'contextMenus', 'storage', 'identity', 'offscreen', 'alarms', 'clipboardRead'],
    // Needed to read the title and image of pasted and right-clicked links (see README: permissions).
    host_permissions: ['http://*/*', 'https://*/*'],
    commands: {
      _execute_action: { suggested_key: { default: 'Alt+Shift+K' }, description: 'Open Kortex' },
    },
    oauth2: {
      client_id: env.OAUTH_CLIENT_ID || 'SET_OAUTH_CLIENT_ID_IN_.env.apps.googleusercontent.com',
      scopes: ['openid', 'email', 'profile'],
    },
  };
  if (env.EXTENSION_KEY) (manifest as unknown as Record<string, unknown>).key = env.EXTENSION_KEY;
  return manifest;
}

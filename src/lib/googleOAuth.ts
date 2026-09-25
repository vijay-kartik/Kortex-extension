/**
 * Google OAuth through chrome.identity.launchWebAuthFlow. Unlike getAuthToken it
 * doesn't need the browser itself to be signed in to Google, so it works in any
 * Chromium browser. Runs in the service worker: the popup closes as soon as the
 * Google window takes focus. No Firebase here.
 */

export type GoogleTokens = { idToken: string; accessToken: string };

export async function googleTokens(): Promise<GoogleTokens> {
  const clientId = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID;
  if (!clientId) throw new Error('VITE_GOOGLE_WEB_CLIENT_ID is not set in .env');
  const nonce = crypto.randomUUID();
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: chrome.identity.getRedirectURL(), // https://<extension id>.chromiumapp.org/
    response_type: 'id_token token',
    scope: 'openid email profile',
    nonce,
    prompt: 'select_account',
  }).toString();

  const redirect = await chrome.identity.launchWebAuthFlow({ url: url.href, interactive: true });
  if (!redirect) throw new Error('No redirect from Google');
  const params = new URLSearchParams(new URL(redirect).hash.slice(1));
  const error = params.get('error');
  if (error) throw new Error(error === 'access_denied' ? 'The user did not approve access.' : error);

  const idToken = params.get('id_token');
  const accessToken = params.get('access_token');
  if (!idToken || !accessToken) throw new Error('No Google token');
  if (jwtPayload(idToken).nonce !== nonce) throw new Error('Google token nonce mismatch');
  return { idToken, accessToken };
}

function jwtPayload(jwt: string): Record<string, unknown> {
  const part = jwt.split('.')[1] ?? '';
  return JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
}

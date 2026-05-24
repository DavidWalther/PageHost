/**
 * AuthTokenManager - Manages access token lifecycle with automatic refresh.
 *
 * Usage:
 *   import { authenticatedFetch } from '/modules/authTokenManager.js';
 *   const response = await authenticatedFetch('/api/1.0/data/query/story', { method: 'GET' });
 */

const SESSION_STORAGE_KEY = 'code_exchange_response';
const REFRESH_TOKEN_KEY = 'refresh_token';
const REFRESH_ENDPOINT = '/api/1.0/auth/refresh';

let refreshPromise = null;

/**
 * Decodes a JWT payload without verification (client-side only).
 */
function decodeJwtPayload(token) {
  try {
    const payload = token.split('.')[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch (e) {
    return null;
  }
}

/**
 * Checks if the current access token is expired or about to expire.
 */
function isAccessTokenExpired() {
  const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!stored) {
    return true;
  }

  try {
    const data = JSON.parse(stored);
    const accessToken = data?.authenticationResult?.access?.access_token;
    if (!accessToken) {
      return true;
    }

    const payload = decodeJwtPayload(accessToken);
    if (!payload || !payload.exp) {
      return true;
    }

    const now = Math.floor(Date.now() / 1000);
    const buffer = 30; // refresh 30 seconds before expiry
    return payload.exp - buffer <= now;
  } catch (e) {
    return true;
  }
}

/**
 * Gets the current access token from session storage.
 */
function getAccessToken() {
  const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!stored) {
    return null;
  }
  try {
    const data = JSON.parse(stored);
    return data?.authenticationResult?.access?.access_token || null;
  } catch (e) {
    return null;
  }
}

/**
 * Attempts to refresh the access token using the stored refresh token.
 * Uses a shared promise to prevent parallel refresh requests.
 */
async function refreshAccessToken() {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = _doRefresh();
  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

async function _doRefresh() {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) {
    return false;
  }

  try {
    const response = await fetch(REFRESH_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return false;
    }

    const data = await response.json();

    // Update session storage with new access token
    const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (stored) {
      const existing = JSON.parse(stored);
      existing.authenticationResult.access = data.authenticationResult.access;
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(existing));
    }

    // Update localStorage with new refresh token
    const newRefreshToken = data?.authenticationResult?.refresh?.refresh_token;
    if (newRefreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, newRefreshToken);
    }

    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Wrapper around fetch that automatically handles token refresh.
 * On 401 response, attempts to refresh the token and retry the request once.
 */
export async function authenticatedFetch(url, options = {}) {
  // If token is expired, try to refresh before making the request
  if (isAccessTokenExpired()) {
    await refreshAccessToken();
  }

  const accessToken = getAccessToken();
  if (!accessToken) {
    throw new Error('No access token available');
  }

  const headers = { ...options.headers };
  headers['Authorization'] = `Bearer ${accessToken}`;

  const response = await fetch(url, { ...options, headers });

  // If we get 401, try refresh and retry once
  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      return response;
    }

    const newAccessToken = getAccessToken();
    if (!newAccessToken) {
      return response;
    }

    headers['Authorization'] = `Bearer ${newAccessToken}`;
    return fetch(url, { ...options, headers });
  }

  return response;
}

export { getAccessToken, isAccessTokenExpired, refreshAccessToken };

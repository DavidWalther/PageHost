/**
 * A signed-in session for UI tests that boot the whole application.
 *
 * The app reads its session from `sessionStorage.code_exchange_response`; the
 * scopes in it decide which actions are offered. The token is a dummy JWT with
 * a far expiry, so `authenticatedFetch` never tries a refresh — the client does
 * not check it otherwise.
 *
 * The session is written by an init script, i.e. before the app's own scripts
 * run on the next navigation: call `withSession` before `page.goto`.
 */

/** Dummy JWT that expires in `seconds` (an hour by default; negative: expired). */
function fakeJwt(seconds = 60 * 60) {
  const encode = (value) =>
    Buffer.from(JSON.stringify(value))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  const exp = Math.floor(Date.now() / 1000) + seconds;
  return `${encode({ alg: 'HS256' })}.${encode({ exp })}.signature`;
}

/** Signs the page in with the given scopes from its next navigation on. */
async function withSession(page, scopes) {
  await page.addInitScript(
    ([token, sessionScopes]) => {
      sessionStorage.setItem(
        'code_exchange_response',
        JSON.stringify({
          authenticationResult: {
            access: { access_token: token, scopes: sessionScopes },
          },
        })
      );
    },
    [fakeJwt(), scopes]
  );
}

module.exports = { fakeJwt, withSession };

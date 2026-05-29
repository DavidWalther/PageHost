/**
 * Registers default route mocks for all backend and external calls made by
 * custom-login-module. Individual tests can override routes after calling
 * setupDefaultMocks().
 */
async function setupDefaultMocks(page) {
  await page.route('**/metadata', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  );

  await page.route('**/data/query/story**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );

  await page.route('**/api/1.0/env/variables', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        auth: {
          google: {
            clientId: 'test-client-id',
            redirect_uri: 'http://localhost:4173',
            scope: 'openid email profile',
            response_type: 'code',
          },
        },
      }),
    })
  );

  await page.route('**/api/1.0/auth/refresh', (route) =>
    route.fulfill({ status: 401, body: '' })
  );

  await page.route('**/api/1.0/auth/logout', (route) =>
    route.fulfill({ status: 200, body: '' })
  );

  await page.route('**/sw.js', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: '' })
  );

  await page.route('https://accounts.google.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        issuer: 'https://accounts.google.com',
        authorization_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
        token_endpoint: 'https://oauth2.googleapis.com/token',
        jwks_uri: 'https://www.googleapis.com/oauth2/v3/certs',
        response_types_supported: ['code'],
        subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: ['RS256'],
      }),
    })
  );
}

module.exports = { setupDefaultMocks };

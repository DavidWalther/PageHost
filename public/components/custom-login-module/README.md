# custom-login-module

The application's **sign-in surface**: a Login button, a Logout button, and a
modal holding the Google sign-in. The OAuth2 round-trip itself is not here — it
lives in `oidc-component` (`/modules/oIdcComponent.js`), which this component
wraps and wires up.

Placed once, inside the settings modal (see `applications/bookstore`).

## Usage

```html
<custom-login-module></custom-login-module>
```

No attributes, no properties. **Which button shows follows from the session**:
`isLoggedIn` checks for `code_exchange_response` in `sessionStorage`, and the
other button is hidden.

On connect it calls `tryRestoreSession()` from
`/modules/authTokenManager.js`: an access token that has expired is renewed from
the refresh token in `localStorage` before anything is rendered. Without that
step a returning visitor would see a Login button although the session is still
valid.

## What it does itself, and what it delegates

| Step                      | Where it happens                                                                       |
| ------------------------- | -------------------------------------------------------------------------------------- |
| Provider round-trip, PKCE | `oidc-component`                                                                       |
| Provider configuration    | here — fetched from `GET /api/1.0/env/variables` on click                              |
| Code exchange             | `oidc-component` against `/api/1.0/oAuth2/codeexchange`                                |
| Sign-out callout          | here — `GET /api/1.0/auth/logout`, then `refresh_token` is removed from `localStorage` |
| Session storage           | `oidc-component` / `authTokenManager`                                                  |

The client id, redirect uri, scope and response type are **not** baked in. They
are fetched when the user clicks and handed to `oidc-component` through the
callback of its `click` event — the server stays the single source for them.

## Events it listens to

From `oidc-component`:

| Event           | Reaction                                                                |
| --------------- | ----------------------------------------------------------------------- |
| `click`         | fetch the provider config and hand it back through the event's callback |
| `authenticated` | clear the URL parameters of the round-trip and re-render                |
| `logout`        | call the logout endpoint, drop the refresh token, toast, re-render      |
| `rejected`      | toast "Authentication failed" and clear the round-trip from the history |

## Events it fires

| Event   | `detail`               | When                                       |
| ------- | ---------------------- | ------------------------------------------ |
| `toast` | `{ message, variant }` | After signing out, and on a failed sign-in |

Bubbles and composed, answered by `public/index.js`.

## Methods

| Method             | Description                             |
| ------------------ | --------------------------------------- |
| `showLoginModal()` | Opens the modal.                        |
| `hideLoginModal()` | Closes it.                              |
| `startLogout()`    | Delegates to `oidc-component.logout()`. |

## No self-registration

The modal states plainly that no new registrations are possible
("Neue Regisrierungen sind im Moment nicht möglich."). This is not decoration:
the backend rejects an unknown email with 401 `No new users allowed`, because
scopes hang on an identity row that somebody has to create. The notice keeps a
visitor from walking into that dead end.

> The sentence carries a typo in the source ("Regisrierungen"). It is quoted here
> verbatim because tests match on the rendered text.

## Known leftovers

- `handleOIDCAuthenticated` only clears the URL and re-renders; the comment in it
  still suggests storing tokens, which `authTokenManager` has long since taken
  over.
- The `.warning` rule in `static styles` contains `border-widht` — a typo, so the
  border width never applies. The notice still renders, only without that border.
- Button labels are English while the notice is German. The operator surface does
  not fix a language; only the visitor-facing surface does.

## Styling

SLDS styles come into the shadow root through `addGlobalStylesToShadowRoot` from
`/modules/global-styles.mjs`.

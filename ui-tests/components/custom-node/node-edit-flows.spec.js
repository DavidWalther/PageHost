const { test, expect } = require('@playwright/test');
const { mockBookstoreCallouts } = require('../../support/mock-callouts');
const { cacheLitBundle } = require('../../support/component-page');

/**
 * Bearbeiten am Knoten: Anlegen eines Inhalts und Löschen des Knotens.
 *
 * Diese Wege gehen über die **neuen** Objektnamen (`content`, `node`) und über
 * die neue Id. Genau daran hängt, ob die Umstellung durchgängig ist: bis
 * Schritt 11 hätte hier `paragraph`/`chapter` gestanden, und die Antwort wäre
 * mit der alten Id zurückgekommen.
 *
 * Die Buttons erscheinen nur mit den passenden Scopes — die Sitzung wird
 * deshalb vor dem Laden in den `sessionStorage` gelegt. Der Zugriffstoken ist
 * ein Attrappen-JWT mit ferner Ablaufzeit, damit `authenticatedFetch` keinen
 * Refresh versucht; geprüft wird er clientseitig ohnehin nicht.
 */

function fakeJwt() {
  const encode = (value) =>
    Buffer.from(JSON.stringify(value))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  const exp = Math.floor(Date.now() / 1000) + 60 * 60;
  return `${encode({ alg: 'HS256' })}.${encode({ exp })}.signature`;
}

async function openAsEditor(page) {
  await mockBookstoreCallouts(page);
  await cacheLitBundle(page);
  await page.addInitScript(
    ([token]) => {
      sessionStorage.setItem(
        'code_exchange_response',
        JSON.stringify({
          authenticationResult: {
            access: {
              access_token: token,
              scopes: ['read', 'edit', 'create', 'delete'],
            },
          },
        })
      );
    },
    [fakeJwt()]
  );
  await page.goto('/000c00000000000001');
  await expect(page.locator('app-bookstore')).toBeAttached();
}

/** Der untere Knoten — der mit den Inhalten. */
function contentNode(page) {
  return page.locator('custom-node[data-role="content"]');
}

test.describe('custom-node: Bearbeiten', () => {
  test('zeigt Anlegen und Löschen nur mit den passenden Scopes', async ({
    page,
  }) => {
    await openAsEditor(page);

    await expect(
      contentNode(page).locator('#button-create-content')
    ).toBeVisible();
    await expect(contentNode(page).locator('#button-delete')).toBeVisible();
  });

  test('ohne Sitzung fehlen beide Schaltflächen', async ({ page }) => {
    await mockBookstoreCallouts(page);
    await cacheLitBundle(page);
    await page.goto('/000c00000000000001');
    await expect(page.locator('app-bookstore')).toBeAttached();
    await expect(contentNode(page).locator('#node-name')).toHaveText(
      'Mock Chapter 1 for Story 1'
    );

    await expect(
      contentNode(page).locator('#button-create-content')
    ).toHaveCount(0);
    await expect(contentNode(page).locator('#button-delete')).toHaveCount(0);
  });

  test('Anlegen schickt object "content" mit der neuen Knoten-Id', async ({
    page,
  }) => {
    await openAsEditor(page);
    await expect(
      contentNode(page).locator('#button-create-content')
    ).toBeVisible();

    let sent = null;
    await page.route('**/api/1.0/data/change/**', (route) => {
      sent = JSON.parse(route.request().postData());
      return route.fulfill({
        json: { success: true, result: { id: '00cn00000000000099', name: '' } },
      });
    });

    await contentNode(page).locator('#button-create-content').click();

    await expect.poll(() => sent?.object).toBe('content');
    expect(sent.payload.node_id).toBe('000n00000000000001');
    // Kein `chapterId`, kein `storyId` — die gibt es im neuen Modell nicht mehr.
    expect(sent.payload).not.toHaveProperty('chapterId');
    expect(sent.payload).not.toHaveProperty('storyId');
  });

  test('Löschen schickt object "node" und räumt die Auswahl auf', async ({
    page,
  }) => {
    await openAsEditor(page);
    await expect(contentNode(page).locator('#button-delete')).toBeVisible();

    page.on('dialog', (dialog) => dialog.accept());

    let deleteUrl = null;
    await page.route('**/api/1.0/data/delete**', (route) => {
      deleteUrl = route.request().url();
      return route.fulfill({ json: { success: true } });
    });

    await contentNode(page).locator('#button-delete').click();

    await expect.poll(() => deleteUrl).toContain('object=node');
    expect(deleteUrl).toContain('id=000n00000000000001');

    // Der obere Knoten nimmt das gelöschte Kind aus seiner Auswahl.
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const app = document.querySelector('app-bookstore');
          const navigation = app.shadowRoot.querySelector(
            'custom-node[data-role="navigation"]'
          );
          return [
            ...navigation.shadowRoot.querySelectorAll(
              '#child-navigation button'
            ),
          ].map((button) => button.dataset.nodeId);
        })
      )
      .toEqual(['000n00000000000002']);
  });
});

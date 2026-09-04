import { authenticatedFetch } from '/modules/authTokenManager.js';

async function initializeApp() {
  const bodyElem = document.querySelector('body');

  // Wait for the custom element to be defined before creating it
  await customElements.whenDefined('app-bookstore');

  const mainApp = document.createElement('app-bookstore');
  attachQueryEventListener(mainApp);
  attachStorageEventListener(mainApp);
  attachSaveEventListener(mainApp);
  attachToastEventListener(mainApp);
  attachCreateEventListener(mainApp);
  attachPublishEventListener(mainApp);
  attachUnpublishEventListener(mainApp);
  attachClearServiceWorkerCacheEventListener(mainApp);

  bodyElem.appendChild(mainApp);
}
window.initializeApp = initializeApp;

function attachToastEventListener(element) {
  element.addEventListener('toast', (toastEvent) => {
    let callback = toastEvent.detail.callback;
    let message = toastEvent.detail.message;
    let variant = toastEvent.detail.variant;

    if (callback) {
      callback(null, { message, variant });
    } else {
      handleToastEvent(toastEvent);
    }
  });
}

function handleToastEvent(event) {
  event.stopPropagation();
  event.preventDefault();

  const { message, variant } = event.detail;
  showToast(message, variant);
}

function showToast(message, variant) {
  const toastContainer = document.createElement('div');
  toastContainer.style.width = '90%';
  toastContainer.style.textAlign = 'center';
  toastContainer.style.position = 'fixed';
  toastContainer.style.top = '10%';
  toastContainer.style.zIndex = '10';

  const toastElement = document.createElement('slds-toast');
  toastElement.setAttribute('state', variant);
  toastElement.textContent = message;
  toastContainer.appendChild(toastElement);

  const bodyElem = document.querySelector('body');
  bodyElem.appendChild(toastContainer);

  setTimeout(() => {
    toastContainer.parentNode.removeChild(toastContainer);
  }, 900);
}

function attachSaveEventListener(element) {
  element.addEventListener('save', (saveEvent) => {
    let callback = saveEvent.detail.callback;

    authenticatedFetch('/api/1.0/data/change/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(saveEvent.detail),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Server responded with status ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        callback(null, data);
      })
      .catch((error) => {
        console.error('Error during save callout:', error);
        callback(error, null);
      });
  });
}

function attachQueryEventListener(element) {
  element.addEventListener('query', (queryEvent) => {
    let callback = queryEvent.detail.callback;
    let eventpayload = queryEvent.detail.payload;
    fetchDatabase(eventpayload)
      .then((returnValue) => {
        callback(null, returnValue);
      })
      .catch((error) => {
        callback(error, null);
      });
  });
}

/**
 * Description:
 * This function listens for storage events. Depending on the action and storageType, it will read, write, or clear the storage.
 */
function attachStorageEventListener(element) {
  element.addEventListener('storage', (event) => {
    const { storageType, key, value, action, callback } = event.detail;
    if (storageType === 'session') {
      accessSessionStorage(key, action, value, callback);
    } else if (storageType === 'local') {
      if (action === 'read') {
        callback(localStorage.getItem(key));
      } else if (action === 'write') {
        localStorage.setItem(key, value);
      } else if (action === 'clear') {
        localStorage.removeItem(key);
      }
    }
  });
}

function accessSessionStorage(key, action, value, callback) {
  if (action === 'read') {
    let readValue = sessionStorage.getItem(key);
    if (callback) {
      callback(readValue);
    } else {
      return readValue;
    }
  }
  if (action === 'write') {
    sessionStorage.setItem(key, value);
  }
  if (action === 'clear') {
    sessionStorage.removeItem(key);
  }
}

function fetchDatabase(eventpayload) {
  let preparedHeaders = {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  };

  let authData = accessSessionStorage('code_exchange_response', 'read');
  authData = JSON.parse(authData);
  let useAuthFetch = !!(authData && authData.authenticationResult);

  const doFetch = (url, options) =>
    useAuthFetch ? authenticatedFetch(url, options) : fetch(url, options);

  return new Promise((resolve, reject) => {
    switch (eventpayload.object) {
      // Ein Knoten mit seinen Kindern, ein Inhalt mit seinen
      // Repraesentationen. Der Endpunkt liefert genau einen Datensatz; ein
      // unbekannter oder nicht sichtbarer ist ein leeres Objekt, kein Fehler.
      case 'node':
      case 'content': {
        doFetch(
          `/data/query/${eventpayload.object}?id=${encodeURIComponent(
            eventpayload.id
          )}`,
          preparedHeaders
        )
          .then((response) => response.json())
          .then(resolve)
          .catch(reject);
        break;
      }
      case 'contents': {
        doFetch(`/api/1.0/contents/all?depth=2`, preparedHeaders)
          .then((contentsResponse) => contentsResponse.json())
          .then((contents) => {
            resolve(contents.result);
          });
        break;
      }
      case 'metadata': {
        fetch('/metadata')
          .then((metadataResponse) => metadataResponse.json())
          .then((metadata) => {
            resolve(metadata);
          });
        break;
      }
      default: {
        reject('Invalid object');
      }
    }
  });
}

function attachCreateEventListener(element) {
  element.addEventListener('create', (createEvent) => {
    let callback = createEvent.detail.callback;

    authenticatedFetch('/api/1.0/data/change/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(createEvent.detail),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Server responded with status ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        callback(null, data);
      })
      .catch((error) => {
        console.error('Error during create callout:', error);
        callback(error, null);
      });
  });
}

function attachPublishEventListener(element) {
  element.addEventListener('publish', (publishEvent) => {
    let callback = publishEvent.detail.callback;

    authenticatedFetch('/api/1.0/actions/publish', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(publishEvent.detail.payload),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Server responded with status ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        callback(null, data);
      })
      .catch((error) => {
        console.error('Error during publispayloaout:', error);
        callback(error, null);
      });
  });
}

function attachUnpublishEventListener(element) {
  element.addEventListener('unpublish', (unpublishEvent) => {
    let callback = unpublishEvent.detail.callback;

    authenticatedFetch('/api/1.0/actions/unpublish', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(unpublishEvent.detail.payload),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Server responded with status ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        callback(null, data);
      })
      .catch((error) => {
        console.error('Error during unpublish callout:', error);
        callback(error, null);
      });
  });
}

/**
 * Setzt den Service Worker zurueck: Erst werden alle Caches der Origin
 * geloescht, dann alle Registrierungen deregistriert.
 *
 * Beides gehoert hierher, nicht in die Anwendung: Diese Ebene registriert den
 * Worker (siehe unten), also raeumt sie ihn auch weg. Ueber `caches.keys()` zu
 * gehen statt ueber den aktuellen Cache-Namen erwischt auch Reste aelterer
 * Versionen und bleibt gueltig, wenn sw.js seine Caches spaeter anders benennt.
 *
 * Das Deregistrieren ist der Teil, der den Precache wieder aufbaut: Ohne es
 * bliebe der Worker aktiv, `install` liefe bei unveraenderter Version nicht
 * erneut, und der Cache bliebe leer. Nach dem Neuladen greift die Registrierung
 * am Dateiende wieder und der Precache entsteht frisch.
 */
function attachClearServiceWorkerCacheEventListener(element) {
  element.addEventListener('service-worker-cache-clear', (clearEvent) => {
    const callback = clearEvent.detail.callback;

    deleteAllCaches()
      .then((cachesDeleted) =>
        unregisterServiceWorkers().then((workersUnregistered) => ({
          cachesDeleted,
          workersUnregistered,
        }))
      )
      .then((data) => {
        callback(null, data);
      })
      .catch((error) => {
        console.error('Error during service worker cache clear:', error);
        callback(error, null);
      });
  });
}

function deleteAllCaches() {
  if (!('caches' in window)) {
    return Promise.reject(
      new Error('Cache Storage steht in diesem Browser nicht zur Verfuegung')
    );
  }

  return caches
    .keys()
    .then((cacheNames) =>
      Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)))
    )
    .then((deletions) => deletions.length);
}

function unregisterServiceWorkers() {
  if (!('serviceWorker' in navigator)) {
    return Promise.resolve(0);
  }

  return navigator.serviceWorker
    .getRegistrations()
    .then((registrations) =>
      Promise.all(
        registrations.map((registration) => registration.unregister())
      )
    )
    .then((unregistrations) => unregistrations.length);
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {})
      .catch((error) => {
        console.error('Service Worker registration failed:', error);
      });
  });
}

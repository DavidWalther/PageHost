async function initializeApp() {
  const bodyElem = document.querySelector('body');

  // Wait for the custom element to be defined before creating it
  await customElements.whenDefined('app-bookstore');

  const mainApp =  document.createElement('app-bookstore');
  attachQueryEventListener(mainApp);
  attachStorageEventListener(mainApp);
  attachSaveEventListener(mainApp);
  attachToastEventListener(mainApp);
  attachCreateEventListener(mainApp);
  attachPublishEventListener(mainApp);

  bodyElem.appendChild(mainApp);
}


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
  this.showToast(message, variant);
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
    let authData = accessSessionStorage('code_exchange_response', 'read');
    authData = JSON.parse(authData);
    let authBearer = authData.authenticationResult?.access?.access_token

    fetch('/api/1.0/data/change/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authBearer}`
      },
      body: JSON.stringify(saveEvent.detail)
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      callback(null, data);
    })
    .catch(error => {
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
    }
  };

  let authData = accessSessionStorage('code_exchange_response', 'read');
  authData = JSON.parse(authData);
  if (authData && authData.authenticationResult) {
    let authBearer = authData.authenticationResult?.access?.access_token
    preparedHeaders.headers.Authorization = `Bearer ${authBearer}`
  }

  return new Promise((resolve, reject) => {
    switch (eventpayload.object) {
      case 'story': {
        let storyId = eventpayload.id;
        if(storyId) {
          // a single story is requested
          // the story and its chapters must be returned
          let fetchPromises = [];
          fetchPromises.push(
            fetch(`/data/query/story?id=${storyId}`)
              .then(storyResponse => {
                return storyResponse.json()
          }));

          Promise.all(fetchPromises).then(response => {
            let story = response[0];

            if(story ) {
              resolve(story);
            } else {
              resolve();
            }
          });
        } else {
          // all stories are requested
          fetch(`/data/query/story`)
          .then(allStoriesResponse => allStoriesResponse.json())
          .then(allStories => {
            resolve(allStories);
          });
        }
        break;
      }
      case 'chapter': {
        let chapterId = eventpayload.id;
        let fetchPromises = [];
        fetchPromises.push(
          fetch(`/data/query/chapter?id=${chapterId}`, preparedHeaders)
          .then(chapterResponse => {
            return chapterResponse.json()
        }));

        Promise.all(fetchPromises).then(response => {
          let chapterResponse = response[0];
          resolve(chapterResponse);
        });
        break;
      }
      case 'paragraph': {
        let paragraphId = eventpayload.id;
        fetch(`/data/query/paragraph?id=${paragraphId}`, preparedHeaders)
        .then(paragraphResponse => paragraphResponse.json())
        .then(paragraph => {
          if(!paragraph || paragraph.length === 0) { reject('No paragraph found');}

          if (Array.isArray(paragraph) ) {
            resolve(paragraph[0]);
          } else if (typeof paragraph === 'object'){
            resolve(paragraph);
          }
        });
        break;
      }
      case 'metadata': {
        fetch('/metadata')
        .then(metadataResponse => metadataResponse.json())
        .then(metadata => {
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
    let authData = accessSessionStorage('code_exchange_response', 'read');
    authData = JSON.parse(authData);
    let authBearer = authData.authenticationResult?.access?.access_token;

    fetch('/api/1.0/data/change/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authBearer}`
      },
      body: JSON.stringify(createEvent.detail)
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`Server responded with status ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        callback(null, data);
      })
      .catch(error => {
        console.error('Error during create callout:', error);
        callback(error, null);
      });
  });
}

function attachPublishEventListener(element) {
  element.addEventListener('publish', (publishEvent) => {
    let callback = publishEvent.detail.callback;
    let authData = accessSessionStorage('code_exchange_response', 'read');
    authData = JSON.parse(authData);
    let authBearer = authData.authenticationResult?.access?.access_token;

    fetch('/api/1.0/actions/publish', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authBearer}`
      },
      body: JSON.stringify(publishEvent.detail.payload)
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`Server responded with status ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        callback(null, data);
      })
      .catch(error => {
        console.error('Error during publispayloaout:', error);
        callback(error, null);
      });
  });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
    }).catch((error) => {
      console.error('Service Worker registration failed:', error);
    });
  });
}

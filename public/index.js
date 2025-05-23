function initializeApp() {
  const bodyElem = document.querySelector('body');

  //const mainApp =  document.createElement('custom-main-app');
  const mainApp =  document.createElement('app-bookstore');
  attachQueryEventListener(mainApp);
  attachStorageEventListener(mainApp);

  bodyElem.appendChild(mainApp);
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
      if (action === 'read') {
        callback(sessionStorage.getItem(key));
      } else if (action === 'write') {
        sessionStorage.setItem(key, value);
      } else if (action === 'clear') {
        sessionStorage.removeItem(key);
      }
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

function fetchDatabase(eventpayload) {
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
          fetch(`/data/query/chapter?id=${chapterId}`)
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
        fetch(`/data/query/paragraph?id=${paragraphId}`)
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

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      console.log('Service Worker registered with scope:', registration.scope);
    }).catch((error) => {
      console.error('Service Worker registration failed:', error);
    });
  });
}
// Service Worker for PageHost Application
// Version must match application version
const APP_VERSION = '3.7.1';
const CACHE_NAME = `app-cache-v${APP_VERSION}`;

// Static files to cache (all application resources from public folder)
const STATIC_FILES = [
  '/',
  '/index.js',
  '/sw.js',
  
  // Modules
  '/modules/global-styles.mjs',
  '/modules/oIdcComponent.js',
  
  // Styles
  '/styles/darkmode.css',
  
  // Applications
  '/applications/bookstore/bookstore.html',
  '/applications/bookstore/bookstore.js',
  
  // Custom Components
  '/components/custom-paragraph/custom-paragraph.js',
  '/components/custom-paragraph/delete-paragraph.api.js',
  '/components/custom-story/custom-story.js',
  '/components/custom-publishing/custom-publishing.js',
  '/components/global-header/global-header.js',
  '/components/custom-chapter/custom-chapter.js',
  '/components/custom-chapter/inValidTests/chapter.tests.js',
  
  // SLDS Components - JS
  '/slds-components/slds-combobox/slds-combobox.js',
  '/slds-components/slds-panel/slds-panel.js',
  '/slds-components/slds-spinner/slds-spinner.js',
  '/slds-components/slds-input/slds-input.js',
  '/slds-components/slds-global-header/slds-global-header.js',
  '/slds-components/slds-card/slds-card.js',
  '/slds-components/slds-toast/slds-toast.js',
  '/slds-components/slds-button-icon/slds-button-icon.js',
  '/slds-components/slds-toggle/toggle.js',
  '/slds-components/slds-modal/slds-modal.js',
  
  // SLDS Components - HTML Templates
  '/slds-components/slds-combobox/slds-combobox.html',
  '/slds-components/slds-panel/slds-panel.html',
  '/slds-components/slds-spinner/slds-spinner.html',
  '/slds-components/slds-input/slds-input.html',
  '/slds-components/slds-global-header/slds-global-header.html',
  '/slds-components/slds-card/slds-card.html',
  '/slds-components/slds-toast/slds-toast.html',
  '/slds-components/slds-button-icon/slds-button-icon.html',
  
  // External assets (referenced in IndexHtmlEndpointLogic.js)
  '/assets/styles/salesforce-lightning-design-system.min.css',
  
  // PWA essentials
  '/manifest.json'
];

// Install Event - Cache all static files
self.addEventListener('install', (event) => {
  console.log(`Service Worker v${APP_VERSION} installing...`);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log(`Caching ${STATIC_FILES.length} static files...`);
        return cache.addAll(STATIC_FILES);
      })
      .then(() => {
        console.log(`Service Worker v${APP_VERSION} installed successfully`);
      })
      .catch((error) => {
        console.error('Service Worker installation failed:', error);
      })
  );
  
  // Don't use skipWaiting() - update on next visit for complete setup
});

// Activate Event - Clean up old caches
self.addEventListener('activate', (event) => {
  console.log(`Service Worker v${APP_VERSION} activating...`);
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log(`Deleting old cache: ${cacheName}`);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log(`Service Worker v${APP_VERSION} activated`);
        return self.clients.claim();
      })
  );
});

// Fetch Event - Cache-first for static files, network-only for dynamic content
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Never cache dynamic content (always go to network)
  if (url.pathname.startsWith('/api/') || 
      url.pathname.startsWith('/data/') || 
      url.pathname === '/metadata') {
    // Let browser handle normally - no interception
    return;
  }
  
  // Cache-first strategy for all application resources
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // Return cached version if available
          return cachedResponse;
        }
        
        // Fall back to network if not in cache
        return fetch(event.request)
          .then((networkResponse) => {
            // Don't cache the response, just return it
            // (only pre-defined STATIC_FILES get cached during install)
            return networkResponse;
          });
      })
      .catch((error) => {
        console.error('Fetch failed for:', event.request.url, error);
        throw error;
      })
  );
});

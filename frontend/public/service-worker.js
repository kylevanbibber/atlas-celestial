/* eslint-disable no-restricted-globals */

// Cache name for the app
const CACHE_NAME = 'atlas-app-cache-v1';

// Assets to cache initially
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/static/js/main.chunk.js',
  '/static/js/0.chunk.js',
  '/static/js/bundle.js',
  '/manifest.json',
  '/favicon.ico',
  '/logo192.png',
  '/logo512.png'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker installing.');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activated.');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
          return null;
        })
      );
    })
  );
  return self.clients.claim();
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // For API requests, go to network first, then cache
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache the response if it's valid
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // If network fails, try from cache
          return caches.match(event.request);
        })
    );
  } else {
    // For non-API requests, try cache first, then network
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((response) => {
          // Cache the response
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        });
      })
    );
  }
});

// Push event - show notification
self.addEventListener('push', (event) => {
  try {
    console.log('🔔 Push event received');
    
    if (!event.data) {
      console.warn('⚠️ Push event received but no data');
      return;
    }

    const data = event.data.json();
    console.log('📱 Push notification data:', data);

    event.waitUntil(
      (async () => {
        try {
          // Check if any tabs are currently focused/active
          const clients = await self.clients.matchAll({ 
            type: 'window', 
            includeUncontrolled: true 
          });

          let hasVisibleClient = false;
          
          // Check if any client is currently visible/focused
          for (const client of clients) {
            // Send message to check if tab is active
            try {
              client.postMessage({ 
                type: 'CHECK_VISIBILITY',
                notification: data,
                timestamp: Date.now()
              });
              
              // For iOS PWAs, be more conservative about in-page notifications
              // since the app might be suspended even if the client appears focused
              const isIOSPWA = client.url.includes('display-mode=standalone') || 
                               /iPad|iPhone|iPod/.test(client.url);
              
              if (client.focused && client.visibilityState === 'visible' && !isIOSPWA) {
                hasVisibleClient = true;
                console.log('📱 Found active non-iOS tab, sending in-page notification');
                client.postMessage({ 
                  type: 'SHOW_IN_PAGE_NOTIFICATION',
                  notification: data,
                  timestamp: Date.now()
                });
              } else if (client.focused && client.visibilityState === 'visible' && isIOSPWA) {
                // For iOS PWA, double-check by trying to send a message
                // If the app is really active, it will handle the notification
                console.log('📱 iOS PWA detected, sending notification test');
                client.postMessage({ 
                  type: 'SHOW_IN_PAGE_NOTIFICATION',
                  notification: data,
                  timestamp: Date.now(),
                  fallbackToBrowser: true // Flag to show browser notification if not handled
                });
                
                // Wait a bit to see if the client responds, otherwise show browser notification
                setTimeout(() => {
                  if (!hasVisibleClient) {
                    console.log('📤 iOS PWA did not respond, showing browser notification');
                    self.registration.showNotification(data.title || 'Atlas Notification', {
                      body: data.message || data.body || 'New notification',
                      icon: '/logo192.png',
                      badge: '/logo192.png',
                      data: { 
                        url: data.link_url || '/',
                        id: data.id || Date.now(),
                        timestamp: Date.now()
                      },
                      vibrate: [200, 100, 200],
                      tag: `notification-${data.id || Date.now()}`,
                      requireInteraction: true,
                      silent: false
                    });
                  }
                }, 2000);
                
                hasVisibleClient = true; // Assume it will work for now
              }
            } catch (clientError) {
              console.warn('Could not communicate with client:', clientError);
            }
          }

          // Only show browser notification if no tabs are active/visible
          if (!hasVisibleClient || clients.length === 0) {
            console.log('📤 No active tabs found, showing browser notification');
            
            const options = {
              body: data.message || data.body || 'New notification',
              icon: '/logo192.png',
              badge: '/logo192.png',
              data: { 
                url: data.link_url || '/',
                id: data.id || Date.now(),
                timestamp: Date.now()
              },
              vibrate: [200, 100, 200],
              tag: `notification-${data.id || Date.now()}`,
              requireInteraction: true,
              silent: false,
              renotify: false
            };

            // Add iOS-specific handling for better compatibility
            if (data.badge) {
              options.badge = data.badge;
            }

            await self.registration.showNotification(data.title || 'Atlas Notification', options);
            console.log('✅ Browser notification shown successfully');
          }

          // Always notify all clients about the new notification for list updates
          for (const client of clients) {
            try {
              client.postMessage({ 
                type: 'NEW_NOTIFICATION',
                notification: data,
                timestamp: Date.now()
              });
            } catch (clientError) {
              console.warn('Could not send NEW_NOTIFICATION to client:', clientError);
            }
          }

        } catch (error) {
          console.error('❌ Error in push notification handling:', error);
          
          // Fallback: show browser notification if anything fails
          const fallbackOptions = {
            body: data.message || data.body || 'New notification',
            icon: '/logo192.png',
            tag: 'fallback-notification'
          };
          
          await self.registration.showNotification(data.title || 'Atlas Notification', fallbackOptions);
        }
      })()
    );

  } catch (error) {
    console.error('❌ Error handling push notification:', error);
    
    // Try to show a fallback notification
    event.waitUntil(
      self.registration.showNotification('New Notification', {
        body: 'You have a new notification',
        icon: '/logo192.png',
        tag: 'fallback-notification'
      }).catch(fallbackError => {
        console.error('❌ Even fallback notification failed:', fallbackError);
      })
    );
  }
});

// Notification click event - improved for iOS PWA
self.addEventListener('notificationclick', (event) => {
  console.log('🖱️ Notification clicked:', event.notification);
  
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/';
  const notificationData = event.notification.data || {};

  console.log('🔗 Opening URL:', urlToOpen);
  console.log('📦 Notification data:', notificationData);

  event.waitUntil(
    (async () => {
      try {
        // Get all window clients
        const clientList = await clients.matchAll({ 
          type: 'window',
          includeUncontrolled: true 
        });
        
        console.log(`👥 Found ${clientList.length} window clients`);

        // Look for an existing client that can be focused
        for (const client of clientList) {
          try {
            const clientUrl = new URL(client.url);
            
            // For React Router, we need to handle relative paths properly
            let targetUrl;
            if (urlToOpen.startsWith('/')) {
              // Relative path - construct full URL with same origin
              targetUrl = new URL(urlToOpen, client.url);
            } else if (urlToOpen.startsWith('http')) {
              // Absolute URL
              targetUrl = new URL(urlToOpen);
            } else {
              // Relative path without leading slash
              targetUrl = new URL('/' + urlToOpen, client.url);
            }
            
            // Check if client is from the same origin
            if (clientUrl.origin === targetUrl.origin) {
              console.log('🎯 Focusing existing client and navigating from', clientUrl.pathname, 'to', targetUrl.pathname);
              
              // Focus the client first
              await client.focus();
              
              // Send the notification click data to the client
              client.postMessage({
                type: 'NOTIFICATION_CLICKED',
                data: notificationData,
                url: urlToOpen,
                timestamp: Date.now()
              });
              
              // Always send navigation request for consistency
              client.postMessage({
                type: 'NAVIGATE_TO',
                url: urlToOpen
              });
              
              return;
            }
          } catch (clientError) {
            console.warn('⚠️ Error processing client:', clientError);
            // Continue to try other clients
          }
        }
        
        // No existing client found or could be focused, open new window
        console.log('🆕 Opening new window for:', urlToOpen);
        
        if (clients.openWindow) {
          try {
            // Construct the full URL properly for iOS PWA
            let fullUrl;
            if (urlToOpen.startsWith('/')) {
              // Relative path - construct with origin
              fullUrl = new URL(urlToOpen, self.location.origin).href;
            } else if (urlToOpen.startsWith('http')) {
              // Already a full URL
              fullUrl = urlToOpen;
            } else {
              // Relative path without leading slash
              fullUrl = new URL('/' + urlToOpen, self.location.origin).href;
            }
            
            console.log('🌐 Full URL to open:', fullUrl);
            
            const newClient = await clients.openWindow(fullUrl);
            if (newClient) {
              console.log('✅ New window opened successfully');
              
              // Send notification data to the new client after it loads
              setTimeout(() => {
                try {
                  newClient.postMessage({
                    type: 'NOTIFICATION_CLICKED',
                    data: notificationData,
                    url: urlToOpen,
                    timestamp: Date.now()
                  });
                } catch (msgError) {
                  console.warn('Could not send message to new client:', msgError);
                }
              }, 2000); // Wait 2 seconds for the app to load
            } else {
              console.error('❌ Failed to open new window');
            }
          } catch (openError) {
            console.error('❌ Error opening new window:', openError);
          }
        } else {
          console.error('❌ clients.openWindow is not available');
        }
        
      } catch (error) {
        console.error('❌ Error handling notification click:', error);
      }
    })()
  );
}); 
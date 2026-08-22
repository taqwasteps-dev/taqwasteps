// TaqwaSteps Service Worker v1.0
// Handles background push notifications

var CACHE_NAME = 'taqwasteps-v1';

// Install
self.addEventListener('install', function(e) {
  self.skipWaiting();
});

// Activate
self.addEventListener('activate', function(e) {
  e.waitUntil(clients.claim());
});

// Push notification received
self.addEventListener('push', function(e) {
  var data = {};
  try { data = e.data.json(); } catch(err) { data = { title: 'TaqwaSteps', body: e.data ? e.data.text() : 'Prayer reminder 🕌' }; }

  var title   = data.title || 'TaqwaSteps 🌙';
  var options = {
    body:    data.body || 'Prayer reminder',
    icon:    '/logo.png',
    badge:   '/logo.png',
    vibrate: [200, 100, 200, 100, 200],
    requireInteraction: true,
    data:    { url: data.url || '/' },
    actions: [
      { action: 'open',    title: '🕌 Open App' },
      { action: 'dismiss', title: 'Dismiss'     }
    ]
  };

  e.waitUntil(self.registration.showNotification(title, options));
});

// Notification click
self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  if (e.action === 'dismiss') return;

  var url = (e.notification.data && e.notification.data.url) ? e.notification.data.url : '/';

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].url.includes('taqwasteps.in') && 'focus' in list[i]) {
          return list[i].focus();
        }
      }
      if (clients.openWindow) return clients.openWindow('https://taqwasteps.in');
    })
  );
});

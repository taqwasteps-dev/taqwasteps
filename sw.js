// TaqwaSteps Service Worker v2
var CACHE = 'taqwasteps-v2';

self.addEventListener('install', function(e){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil(clients.claim()); });

// Push received from server
self.addEventListener('push', function(e){
  var data = {};
  try{ data = e.data.json(); }catch(err){ data = { title:'TaqwaSteps', body: e.data ? e.data.text() : 'Prayer reminder' }; }

  var options = {
    body:   data.body || 'Prayer reminder',
    icon:   '/logo.png',
    badge:  '/logo.png',
    tag:    data.tag || 'taqwasteps',
    renotify: true,
    requireInteraction: data.requireInteraction || false,
    data:   { url: data.url || '/webapp.html', prayer: data.prayer || '', type: data.type || '' },
    actions: [
      { action: 'pray',   title: 'Pray Now' },
      { action: 'snooze', title: 'Remind Later' }
    ]
  };
  e.waitUntil(self.registration.showNotification(data.title || 'TaqwaSteps', options));
});

// Notification clicked
self.addEventListener('notificationclick', function(e){
  e.notification.close();

  var action  = e.action;
  var data    = e.notification.data || {};
  var baseUrl = 'https://taqwasteps.in/webapp.html';

  if(action === 'snooze'){
    // Snooze: show another notification in 10 minutes
    e.waitUntil(
      new Promise(function(resolve){
        setTimeout(function(){
          self.registration.showNotification('TaqwaSteps', {
            body: 'Salah reminder — time to pray.',
            icon: '/logo.png',
            badge: '/logo.png',
            requireInteraction: true
          });
          resolve();
        }, 10 * 60 * 1000);
      })
    );
    return;
  }

  // 'pray' action or tap — open app
  e.waitUntil(
    clients.matchAll({ type:'window', includeUncontrolled:true }).then(function(list){
      for(var i = 0; i < list.length; i++){
        if(list[i].url.indexOf('taqwasteps.in') >= 0 && 'focus' in list[i]){
          list[i].postMessage({ type:'OPEN_SALAH', prayer: data.prayer });
          return list[i].focus();
        }
      }
      return clients.openWindow(baseUrl + (data.prayer ? '?prayer='+data.prayer : ''));
    })
  );
});

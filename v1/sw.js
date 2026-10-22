/* Home-Brace's service worker - phone and computer ALERTS only (22/10/2026, Cory: "yes for phone alerts we need that").
   No caching and no offline copy: every page still comes straight from the site. A push shows the alert; tapping it
   opens (or brings forward) the page it points to. Open pages are told too, so they can update. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', e => {
  let m = {};
  try { m = e.data ? e.data.json() : {}; } catch (_) { m = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(Promise.all([
    self.registration.showNotification(m.title || 'Home-Brace', {
      body: m.body || '', icon: '../assets/icons/icon-192.png',
      tag: m.tag || undefined, renotify: !!m.tag, data: { url: m.url || '' } }),
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(list => list.forEach(c => c.postMessage({ type: 'ph-alert', message: m })))
  ]));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || 'home.html', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const open = list.find(c => c.url === url);
    return open && open.focus ? open.focus() : self.clients.openWindow(url);
  }));
});

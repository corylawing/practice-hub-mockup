/* Practice Hub's service worker - phone and computer ALERTS only (22/10/2026, Jordan: "yes for phone alerts we need that").
   No page caching and no offline copy: every page still comes straight from the site. A push shows the alert; tapping it
   opens (or brings forward) the page it points to. Open pages are told too, so they can update. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

/* THE RED NUMBER ON THE APP ICON (20/11/2026, Jordan: on Android a chat message puts a red number on the app, "but it
   doesn't do that on my Iphone"). Android counts the alerts by itself; an iPhone (home-screen app, alerts on) only shows
   the number the app sets. Each alert adds one; opening Practice Hub sets it to the unread chats (user.js appBadge). The
   one number is kept in the browser's cache store - the only thing ever put there (still no copies of pages). */
const BADGE = 'ph-badge', BADGE_KEY = 'ph-badge-count';
function badgeAdd() {
  const nav = self.navigator;
  if (!nav || !nav.setAppBadge || !self.caches) return Promise.resolve();
  return caches.open(BADGE).then(c => c.match(BADGE_KEY).then(r => r ? r.text() : '0').then(v => {
    const n = Math.min(99, (parseInt(v, 10) || 0) + 1);
    return c.put(BADGE_KEY, new Response(String(n))).then(() => nav.setAppBadge(n));
  })).catch(() => {});
}

self.addEventListener('push', e => {
  let m = {};
  try { m = e.data ? e.data.json() : {}; } catch (_) { m = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(Promise.all([
    badgeAdd(),
    self.registration.showNotification(m.title || 'Practice Hub', {
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

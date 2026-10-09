/**
 * Money Bunny - Service Worker
 * Offline shell, background sync scaffold, push reminder hook
 *
 * Keep CACHE_NAME in sync with APP_VERSION in config.php (e.g. money-bunny-1.1.0).
 */

const CACHE_NAME = 'money-bunny-1.2.0';
const STATIC_ASSETS = [
    './',
    './index.php',
    './manifest.json',
    './assets/css/tailwind.css',
    './assets/css/app.css',
    './assets/js/utils.js',
    './assets/js/auth.js',
    './assets/js/offline.js',
    './assets/js/api.js',
    './assets/js/cycle-filter.js',
    './assets/js/app.js',
    './assets/js/components/charts.js',
    './assets/js/components/toast.js',
    './assets/js/pages/dashboard.js',
    './assets/js/pages/history.js',
    './assets/js/pages/statistics.js',
    './assets/js/pages/settings.js',
    './assets/js/pages/calendar.js',
    './assets/js/pages/search.js',
    './assets/icons/bill-bunny-logo.png',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) =>
            cache.addAll(STATIC_ASSETS).catch(() => {})
        )
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) =>
                Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
            )
            .then(() => self.clients.claim())
            .then(() => notifyClients({ type: 'mb-sw-updated', version: CACHE_NAME }))
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    if (event.request.method !== 'GET') return;

    if (url.pathname.includes('/api/')) {
        event.respondWith(
            fetch(event.request)
                .then((response) => response)
                .catch(() => caches.match(event.request))
        );
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cached) => {
            const fetchPromise = fetch(event.request).then((response) => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                }
                return response;
            }).catch(() => cached);

            return cached || fetchPromise;
        })
    );
});

/** Ask open clients to flush IndexedDB offline queue */
self.addEventListener('sync', (event) => {
    if (event.tag === 'mb-offline-sync') {
        event.waitUntil(notifyClients({ type: 'mb-sync-offline' }));
    }
});

/**
 * Scaffold for closed-PWA reminders.
 * Full Web Push needs VAPID keys + subscription storage on the server.
 */
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'mb-daily-reminder') {
        event.waitUntil(showDailyReminderScaffold());
    }
});

/** Client asks the SW to check/show the daily reminder (e.g. app was already open) */
self.addEventListener('message', (event) => {
    if (event.data?.type === 'mb-check-reminder') {
        event.waitUntil(showDailyReminderScaffold());
    }
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
            if (clients.length) {
                return clients[0].focus();
            }
            return self.clients.openWindow('./');
        })
    );
});

async function notifyClients(message) {
    const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
    clients.forEach((client) => client.postMessage(message));
}

async function showDailyReminderScaffold() {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (clients.some((c) => c.visibilityState === 'visible')) return;

    if (Notification.permission !== 'granted') return;

    await self.registration.showNotification('Money Bunny', {
        body: "Haven't added today's expenses.",
        icon: './assets/icons/bill-bunny-logo.png',
        tag: 'mb-daily-reminder',
        renotify: true,
    });
}

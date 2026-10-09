/**
 * Money Bunny - Offline write queue + read cache (IndexedDB)
 */

const OfflineQueue = {
    DB_NAME: 'moneybunny-offline',
    STORE: 'queue',
    CACHE_STORE: 'cache',
    DB_VERSION: 2,
    CACHE_TTL_MS: 7 * 24 * 60 * 60 * 1000,
    CACHEABLE_GETS: [
        'dashboard.php',
        'statistics.php',
        'expenses.php',
        'settings.php',
        'categories.php',
        'cycles.php',
        'calendar.php',
        'search.php',
    ],
    db: null,
    _syncing: false,

    async init() {
        if (!('indexedDB' in window)) return;

        this.db = await new Promise((resolve, reject) => {
            const req = indexedDB.open(this.DB_NAME, this.DB_VERSION);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.STORE)) {
                    db.createObjectStore(this.STORE, { keyPath: 'id', autoIncrement: true });
                }
                if (!db.objectStoreNames.contains(this.CACHE_STORE)) {
                    db.createObjectStore(this.CACHE_STORE, { keyPath: 'key' });
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });

        window.addEventListener('online', () => this.syncAll());
        if (navigator.onLine) await this.syncAll();

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', (e) => {
                if (e.data?.type === 'mb-sync-offline') this.syncAll();
            });
        }

        if ('serviceWorker' in navigator && 'SyncManager' in window) {
            try {
                const reg = await navigator.serviceWorker.ready;
                await reg.sync.register('mb-offline-sync');
            } catch (e) { /* optional */ }
        }
    },

    cacheKey(endpoint, method = 'GET') {
        return `${method}:${endpoint}`;
    },

    isCacheableGet(endpoint) {
        const base = endpoint.split('?')[0];
        return this.CACHEABLE_GETS.some((name) => base === name || base.endsWith('/' + name));
    },

    async getCached(key) {
        if (!this.db) return null;
        const row = await new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.CACHE_STORE, 'readonly');
            const req = tx.objectStore(this.CACHE_STORE).get(key);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
        if (!row) return null;
        if (Date.now() - row.cached_at > this.CACHE_TTL_MS) {
            await this.removeCached(key);
            return null;
        }
        return row.data;
    },

    async setCached(key, data) {
        if (!this.db) return;
        await new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.CACHE_STORE, 'readwrite');
            tx.objectStore(this.CACHE_STORE).put({
                key,
                data,
                cached_at: Date.now(),
            });
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
    },

    async removeCached(key) {
        if (!this.db) return;
        await new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.CACHE_STORE, 'readwrite');
            tx.objectStore(this.CACHE_STORE).delete(key);
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
    },

    async invalidateReadCaches() {
        if (!this.db) return;
        const keys = await new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.CACHE_STORE, 'readonly');
            const req = tx.objectStore(this.CACHE_STORE).getAllKeys();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
        await Promise.all(keys.map((key) => this.removeCached(key)));
    },

    async add(method, endpoint, body = null) {
        if (!this.db) throw new Error('Offline storage unavailable');

        const entry = {
            method,
            endpoint,
            body,
            created_at: Date.now(),
        };

        await new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.STORE, 'readwrite');
            tx.objectStore(this.STORE).add(entry);
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });

        Toast.show('Saved offline — will sync when online', 'info', 3000);
        window.App?.updateOfflineBadge?.();
    },

    async getAll() {
        if (!this.db) return [];
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.STORE, 'readonly');
            const req = tx.objectStore(this.STORE).getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    },

    async remove(id) {
        if (!this.db) return;
        await new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.STORE, 'readwrite');
            tx.objectStore(this.STORE).delete(id);
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
        window.App?.updateOfflineBadge?.();
    },

    async syncAll() {
        if (this._syncing || !navigator.onLine || !this.db) return;

        this._syncing = true;
        try {
            const items = await this.getAll();
            if (!items.length) return;

            let synced = 0;
            for (const item of items) {
                try {
                    await API.requestDirect(item.endpoint, {
                        method: item.method,
                        body: item.body ? JSON.stringify(item.body) : undefined,
                    });
                    await this.remove(item.id);
                    synced++;
                } catch (e) {
                    break;
                }
            }

            if (synced > 0) {
                Toast.show(`Synced ${synced} offline ${synced === 1 ? 'entry' : 'entries'}`);
                if (window.App?.state?.currentRoute === 'dashboard') {
                    await DashboardPage.refresh(App.state);
                }
            }
        } finally {
            this._syncing = false;
            window.App?.updateOfflineBadge?.();
        }
    },

    pendingCount() {
        return this.getAll().then(items => items.length);
    },
};

window.OfflineQueue = OfflineQueue;

/**
 * Money Bunny - API client
 * All backend communication via fetch (no page reloads)
 */

const API = {
    base: (window.MB_BASE || '') + '/api',

    authHeaders() {
        const token = window.Auth?.getToken?.() || '';
        return token ? { 'X-MB-Token': token } : {};
    },

    async requestDirect(endpoint, options = {}) {
        const url = `${this.base}/${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...this.authHeaders(),
                ...options.headers,
            },
            ...options,
        };

        const res = await fetch(url, config);
        const text = await res.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            if (text.trim().startsWith('<')) {
                throw new Error('Server error (PHP crash or hosting block). Try again in a minute.');
            }
            throw new Error('Server error — please try again');
        }

        if (res.status === 401 && window.Auth) {
            Auth.setToken('');
            localStorage.removeItem(Auth.PERSISTENT_TOKEN_KEY);
            Auth.showLockScreen();
            throw new Error('Session expired — enter PIN again');
        }

        if (!res.ok || data.success === false) {
            throw new Error(data.error || 'Request failed');
        }
        return data;
    },

    async request(endpoint, options = {}) {
        const method = (options.method || 'GET').toUpperCase();
        const isMutation = ['POST', 'PUT', 'DELETE'].includes(method);
        const bodyObj = options.body ? JSON.parse(options.body) : null;
        const cacheKey = window.OfflineQueue?.cacheKey?.(endpoint, method);

        if (method === 'GET' && window.OfflineQueue?.isCacheableGet?.(endpoint)) {
            try {
                const data = await this.requestDirect(endpoint, options);
                if (cacheKey) await OfflineQueue.setCached(cacheKey, data);
                return data;
            } catch (err) {
                const networkFail = !navigator.onLine
                    || err.name === 'TypeError'
                    || /failed to fetch|network|load failed/i.test(err.message || '');
                if (networkFail && cacheKey && window.OfflineQueue?.db) {
                    const cached = await OfflineQueue.getCached(cacheKey);
                    if (cached) {
                        return { ...cached, from_cache: true };
                    }
                }
                throw err;
            }
        }

        try {
            const data = await this.requestDirect(endpoint, options);
            if (isMutation) {
                await OfflineQueue?.invalidateReadCaches?.();
            }
            return data;
        } catch (err) {
            const networkFail = !navigator.onLine
                || err.name === 'TypeError'
                || /failed to fetch|network|load failed/i.test(err.message || '');
            if (networkFail && isMutation && window.OfflineQueue?.db) {
                await OfflineQueue.add(method, endpoint, bodyObj);
                return { success: true, offline: true };
            }
            if (!navigator.onLine) {
                throw new Error('You are offline. Changes will sync when back online.');
            }
            throw err;
        }
    },

    get(endpoint, params = {}) {
        const qs = new URLSearchParams(params).toString();
        const url = qs ? `${endpoint}?${qs}` : endpoint;
        return this.request(url);
    },

    post(endpoint, body) {
        return this.request(endpoint, { method: 'POST', body: JSON.stringify(body) });
    },

    put(endpoint, body) {
        return this.request(endpoint, { method: 'PUT', body: JSON.stringify(body) });
    },

    delete(endpoint, params = {}) {
        const qs = new URLSearchParams(params).toString();
        const url = qs ? `${endpoint}?${qs}` : endpoint;
        return this.request(url, { method: 'DELETE' });
    },

    getDashboard(params = {}) {
        return this.get('dashboard.php', params);
    },

    getCycles() {
        return this.get('cycles.php');
    },

    getExpenses(params = {}) {
        return this.get('expenses.php', params);
    },

    getExpense(id) {
        return this.get('expenses.php', { id });
    },

    addExpense(amount, category, expenseDate = null, type = 'expense', note = null) {
        const body = { amount, category, type };
        if (expenseDate) body.expense_date = expenseDate;
        if (note) body.note = note;
        return this.post('expenses.php', body);
    },

    updateExpense(id, data) {
        return this.put('expenses.php', { id, ...data });
    },

    deleteExpense(id) {
        return this.delete('expenses.php', { id });
    },

    getSettings() {
        return this.get('settings.php');
    },

    updateSettings(data) {
        return this.put('settings.php', data);
    },

    getCategories(params = {}) {
        return this.get('categories.php', params);
    },

    addCategory(data) {
        return this.post('categories.php', data);
    },

    updateCategory(slug, data) {
        return this.put('categories.php', { slug, ...data });
    },

    deleteCategory(slug) {
        return this.delete('categories.php', { slug });
    },

    getStatistics(params = {}) {
        return this.get('statistics.php', params);
    },

    search(params) {
        return this.get('search.php', params);
    },

    getCalendar(year, month, date = null) {
        const params = { year, month };
        if (date) params.date = date;
        return this.get('calendar.php', params);
    },

    getReports() {
        return this.get('reports.php');
    },

    getRecurring() {
        return this.get('recurring.php');
    },

    addRecurring(data) {
        return this.post('recurring.php', data);
    },

    updateRecurring(id, data) {
        return this.put('recurring.php', { id, ...data });
    },

    deleteRecurring(id) {
        return this.delete('recurring.php', { id });
    },

    async exportCsv(cycle = 'current') {
        const url = `${this.base}/reports.php?export=csv&cycle=${cycle}`;
        const res = await fetch(url, { headers: this.authHeaders() });
        if (res.status === 401 && window.Auth) {
            Auth.setToken('');
            localStorage.removeItem(Auth.PERSISTENT_TOKEN_KEY);
            Auth.showLockScreen();
            throw new Error('Session expired — enter PIN again');
        }
        if (!res.ok) {
            let msg = 'Export failed';
            try {
                const data = await MB.parseJsonResponse(res);
                msg = data.error || msg;
            } catch (e) {
                if (e.message) msg = e.message;
            }
            throw new Error(msg);
        }
        const blob = await res.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `money-bunny-${cycle}-cycle.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
    },

    async exportBackup(passphrase = null) {
        const url = `${this.base}/backup.php?action=export`;
        const res = await fetch(url, { headers: this.authHeaders() });
        if (res.status === 401 && window.Auth) {
            Auth.setToken('');
            localStorage.removeItem(Auth.PERSISTENT_TOKEN_KEY);
            Auth.showLockScreen();
            throw new Error('Session expired — enter PIN again');
        }
        if (!res.ok) {
            let msg = 'Backup export failed';
            try {
                const data = await MB.parseJsonResponse(res);
                msg = data.error || msg;
            } catch (e) {
                if (e.message) msg = e.message;
            }
            throw new Error(msg);
        }
        const payload = await res.json();
        let out = payload;
        let filename = `money-bunny-backup-${MB.todayLocal()}.json`;
        if (passphrase) {
            out = await MB.encryptBackup(payload, passphrase);
            filename = `money-bunny-backup-${MB.todayLocal()}.mbbackup.json`;
        }
        const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
    },

    importBackup(backup) {
        return this.requestDirect('backup.php', { method: 'POST', body: JSON.stringify({ action: 'import', backup }) });
    },

    importCsv(csv) {
        return this.requestDirect('backup.php', { method: 'POST', body: JSON.stringify({ action: 'import_csv', csv }) });
    },
};

window.API = API;

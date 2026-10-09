/**
 * Settings page - salary, currency, dark mode, PIN, categories, backup, recurring, reports
 */

const SettingsPage = {
    categories: [],

    async render(container, state) {
        container.innerHTML = `
            <div class="animate-fade-in space-y-4 pb-8">

                <!-- Essentials -->
                <details id="settings-essentials" open>
                    <summary class="settings-section-summary">Essentials</summary>
                    <div class="space-y-4 mt-3">

                        <!-- Budget Settings -->
                        <div class="card p-4 space-y-4">
                            <h2 class="font-bold text-bunny-700 dark:text-bunny-400">💼 Budget</h2>
                            <div class="p-3 rounded-xl bg-bunny-50 dark:bg-bunny-900/20 text-sm text-bunny-800 dark:text-bunny-300">
                                <p class="font-semibold mb-1">Salary starts a new cycle</p>
                                <p class="text-bunny-700/80 dark:text-bunny-400/80">Tap <strong>+</strong> → <strong>Income</strong> → <strong>💵 Salary</strong>. That amount and date become your new budget cycle.</p>
                            </div>
                            <div>
                                <label class="text-sm text-gray-500">Savings Goal (optional, per cycle)</label>
                                <input type="number" id="set-savings" class="input-field mt-1" inputmode="decimal" step="0.01" min="0" placeholder="0.00">
                            </div>
                            <button id="save-settings" class="w-full py-3 rounded-2xl bg-bunny-500 text-white font-semibold active:scale-98 transition-transform">Save Settings</button>
                        </div>

                        <!-- Appearance -->
                        <div class="card p-4">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="font-semibold">🌙 Dark Mode</p>
                                    <p class="text-xs text-gray-500">Easy on the eyes at night</p>
                                </div>
                                <label class="toggle">
                                    <input type="checkbox" id="set-dark-mode">
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                        </div>

                        <!-- PIN Lock -->
                        <div class="card p-4 space-y-3" id="pin-settings">
                            <div>
                                <p class="font-semibold">🔒 PIN Lock</p>
                                <p class="text-xs text-gray-500">Required to protect your data on this device</p>
                            </div>
                            <p id="pin-status-text" class="text-sm text-bunny-700 dark:text-bunny-400"></p>
                            <div id="pin-setup-fields" class="space-y-2 hidden">
                                <input type="password" inputmode="numeric" maxlength="6" id="pin-new" class="input-field" placeholder="New PIN (4–6 digits)" autocomplete="off">
                                <input type="password" inputmode="numeric" maxlength="6" id="pin-confirm" class="input-field" placeholder="Confirm PIN" autocomplete="off">
                                <button id="pin-set-btn" class="w-full py-3 rounded-2xl bg-bunny-500 text-white font-semibold">Set PIN</button>
                            </div>
                            <div id="pin-change-fields" class="space-y-2 hidden">
                                <input type="password" inputmode="numeric" maxlength="6" id="pin-old" class="input-field" placeholder="Current PIN" autocomplete="off">
                                <input type="password" inputmode="numeric" maxlength="6" id="pin-change-new" class="input-field" placeholder="New PIN (4–6 digits)" autocomplete="off">
                                <button id="pin-change-btn" class="w-full py-3 rounded-2xl bg-bunny-500 text-white font-semibold">Change PIN</button>
                                <button id="pin-remove-btn" class="w-full py-2 rounded-2xl text-red-500 text-sm font-medium hidden">Remove PIN</button>
                            </div>
                        </div>

                        <!-- Fingerprint unlock -->
                        <div class="card p-4 hidden" id="biometric-settings">
                            <div class="flex items-center justify-between gap-3">
                                <div>
                                    <p class="font-semibold">👆 Fingerprint unlock</p>
                                    <p id="biometric-status-text" class="text-xs text-gray-500 mt-0.5">Unlock with your phone fingerprint instead of PIN</p>
                                </div>
                                <label class="toggle">
                                    <input type="checkbox" id="set-biometric">
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                        </div>

                        <!-- Notifications -->
                        <div class="card p-4 space-y-3">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="font-semibold">🔔 Daily Reminder</p>
                                    <p class="text-xs text-gray-500">"Haven't added today's expenses"</p>
                                </div>
                                <label class="toggle">
                                    <input type="checkbox" id="set-notification">
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                            <div>
                                <label class="text-sm text-gray-500">Reminder Time</label>
                                <input type="time" id="set-notification-time" class="input-field mt-1">
                            </div>
                            <p class="text-xs text-gray-400 leading-relaxed">Works best while the app is open or recently used. Background reminders depend on your browser (limited on iOS Safari).</p>
                        </div>
                    </div>
                </details>

                <!-- Power features -->
                <details id="settings-power">
                    <summary class="settings-section-summary">Power features</summary>
                    <div class="space-y-4 mt-3">

                        <!-- Recurring Expenses -->
                        <div class="card p-4 space-y-3">
                            <h2 class="font-bold">🔁 Recurring Expenses</h2>
                            <div id="recurring-list" class="space-y-2"></div>
                            <div class="grid grid-cols-2 gap-2">
                                <input type="number" id="rec-amount" class="input-field" placeholder="0.00" inputmode="decimal" step="0.01" min="0.01">
                                <select id="rec-category" class="input-field"></select>
                            </div>
                            <div class="flex gap-2">
                                <button data-freq="monthly" class="rec-freq flex-1 py-2 rounded-xl bg-bunny-100 dark:bg-bunny-900/40 font-medium text-sm rec-freq-active">Monthly</button>
                                <button data-freq="weekly" class="rec-freq flex-1 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 font-medium text-sm">Weekly</button>
                            </div>
                            <div id="rec-day-month-wrap">
                                <label class="text-sm text-gray-500">Day of month</label>
                                <select id="rec-day-month" class="input-field mt-1"></select>
                            </div>
                            <div id="rec-day-week-wrap" class="hidden">
                                <label class="text-sm text-gray-500">Day of week</label>
                                <select id="rec-day-week" class="input-field mt-1">
                                    <option value="0">Sunday</option>
                                    <option value="1">Monday</option>
                                    <option value="2">Tuesday</option>
                                    <option value="3">Wednesday</option>
                                    <option value="4">Thursday</option>
                                    <option value="5">Friday</option>
                                    <option value="6">Saturday</option>
                                </select>
                            </div>
                            <button id="add-recurring" class="w-full py-3 rounded-2xl bg-bunny-500 text-white font-semibold">Add Recurring</button>
                        </div>

                        <!-- Reports -->
                        <div class="card p-4 space-y-3">
                            <h2 class="font-bold">📊 Reports</h2>
                            <div id="report-current" class="text-sm"></div>
                            <div id="report-previous" class="text-sm text-gray-500"></div>
                            <div class="flex gap-2">
                                <button id="export-current" class="flex-1 py-3 rounded-2xl bg-bunny-100 dark:bg-bunny-900/40 font-semibold text-sm">Export Current CSV</button>
                                <button id="export-previous" class="flex-1 py-3 rounded-2xl bg-gray-100 dark:bg-gray-800 font-semibold text-sm">Export Previous CSV</button>
                            </div>
                            <button id="share-story" class="w-full py-3 rounded-2xl bg-bunny-500 text-white font-semibold">📤 Share monthly story</button>
                        </div>

                        <!-- Categories -->
                        <div class="card p-4 space-y-3">
                            <h2 class="font-bold">🏷️ Categories</h2>
                            <p class="text-xs text-gray-500">Tap ★ to favorite · use ↑↓ to reorder · favorites show first in the add sheet</p>
                            <div id="category-manage-list" class="space-y-1"></div>
                            <div class="grid grid-cols-[3.5rem_1fr] gap-2">
                                <input type="text" id="new-cat-emoji" maxlength="8" placeholder="📦" class="input-field text-center text-lg" autocomplete="off">
                                <input type="text" id="new-cat-name" maxlength="40" placeholder="New category name" class="input-field" autocomplete="off">
                            </div>
                            <div class="flex gap-2">
                                <button data-cat-type="expense" class="new-cat-type flex-1 py-2 rounded-xl bg-bunny-100 dark:bg-bunny-900/40 font-medium text-sm new-cat-type-active">Expense</button>
                                <button data-cat-type="income" class="new-cat-type flex-1 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 font-medium text-sm">Income</button>
                            </div>
                            <button id="add-category" class="w-full py-3 rounded-2xl bg-bunny-500 text-white font-semibold">Add Category</button>
                        </div>

                        <!-- Backup & Restore -->
                        <div class="card p-4 space-y-3">
                            <h2 class="font-bold">💾 Backup &amp; Restore</h2>
                            <div>
                                <label class="text-sm text-gray-500">Optional passphrase (encrypts the backup file)</label>
                                <input type="password" id="backup-passphrase" class="input-field mt-1" placeholder="Leave blank for plain JSON" autocomplete="new-password">
                            </div>
                            <button id="backup-export" class="w-full py-3 rounded-2xl bg-bunny-100 dark:bg-bunny-900/40 font-semibold text-sm">Export Full Backup</button>
                            <div>
                                <label class="text-sm text-gray-500">Restore from backup file</label>
                                <input type="file" id="backup-import-file" accept="application/json,.json,.mbbackup" class="input-field mt-1 text-sm">
                            </div>
                            <div>
                                <label class="text-sm text-gray-500">Import CSV (date, amount, category, type, note)</label>
                                <input type="file" id="csv-import-file" accept=".csv,text/csv" class="input-field mt-1 text-sm">
                            </div>
                        </div>
                    </div>
                </details>

                <p class="text-center text-xs text-gray-400">Money Bunny v${window.MB_APP?.version || '1.0'}</p>
                <p class="text-center text-xs text-gray-400 mt-1">Personal expense tracker I built for my own use.</p>
            </div>
        `;

        this.selectedFreq = 'monthly';
        this.selectedCatType = 'expense';
        this.initRecurringDayPickers();
        await this.loadSettings(state);
        await this.loadCategories();
        await this.loadPinSettings();
        await this.loadBiometricSettings();
        await this.loadRecurring();
        await this.loadReports();
        this.bindEvents(state);
        this.bindPinEvents();
        this.bindBiometricEvents();
        this.bindCategoryEvents(state);
        this.bindBackupEvents(state);
        this.bindShareStory(state);
    },

    async loadCategories() {
        try {
            const res = await API.getCategories({ all: '1' });
            this.categories = res.data;
            const select = document.getElementById('rec-category');
            const editSelect = document.getElementById('edit-category');
            const expenseCats = this.categories.filter(c => c.type === 'expense' && !c.is_hidden);
            [select, editSelect].forEach(sel => {
                if (!sel) return;
                sel.innerHTML = expenseCats.map(c =>
                    `<option value="${c.slug}">${c.emoji} ${c.name}</option>`
                ).join('');
            });
            this.renderCategoryManageList();
        } catch (err) {
            Toast.show(err.message, 'error');
        }
    },

    renderCategoryManageList() {
        const list = document.getElementById('category-manage-list');
        if (!list) return;
        const favorites = App.state?.settings?.favorite_categories || [];
        const visible = this.categories
            .filter(c => !c.is_hidden)
            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

        if (!visible.length) {
            list.innerHTML = '<p class="text-sm text-gray-400">No categories</p>';
            return;
        }

        list.innerHTML = visible.map((c, idx) => {
            const isFav = favorites.includes(c.slug);
            return `
            <div class="flex items-center justify-between p-2.5 rounded-xl bg-bunny-50 dark:bg-gray-800" data-cat-row="${c.slug}">
                <button type="button" class="flex items-center gap-2 flex-1 min-w-0 text-left" data-fav-toggle="${c.slug}">
                    <span class="text-lg">${c.emoji}</span>
                    <span class="text-sm font-medium truncate">${MB.escapeHtml(c.name)}</span>
                    <span class="text-xs text-gray-400">${c.type === 'income' ? 'income' : ''}</span>
                </button>
                <div class="flex items-center gap-0.5 shrink-0">
                    <button type="button" class="cat-reorder-btn" data-move-cat="${c.slug}" data-dir="up" ${idx === 0 ? 'disabled' : ''} aria-label="Move up">↑</button>
                    <button type="button" class="cat-reorder-btn" data-move-cat="${c.slug}" data-dir="down" ${idx === visible.length - 1 ? 'disabled' : ''} aria-label="Move down">↓</button>
                    <button type="button" class="cat-fav-btn ${isFav ? 'cat-fav-btn-active' : ''}" data-fav-toggle="${c.slug}" aria-label="${isFav ? 'Remove favorite' : 'Add favorite'}" aria-pressed="${isFav}">★</button>
                    ${c.is_custom ? `<button type="button" class="text-red-500 text-xs px-2 py-1" data-del-cat="${c.slug}" aria-label="Delete category">✕</button>` : ''}
                </div>
            </div>`;
        }).join('');

        list.querySelectorAll('[data-fav-toggle]').forEach(el => {
            el.addEventListener('click', () => this.toggleFavorite(el.dataset.favToggle));
        });
        list.querySelectorAll('[data-move-cat]').forEach(btn => {
            btn.addEventListener('click', () => this.moveCategory(btn.dataset.moveCat, btn.dataset.dir));
        });
        list.querySelectorAll('[data-del-cat]').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!await MB.confirm('Delete this category? Existing entries move to "Other".', { title: 'Delete category?' })) return;
                try {
                    await API.deleteCategory(btn.dataset.delCat);
                    Toast.show('Category removed');
                    await this.loadCategories();
                    await App.loadCategories();
                } catch (err) {
                    Toast.show(err.message, 'error');
                }
            });
        });
    },

    async moveCategory(slug, dir) {
        const visible = this.categories
            .filter(c => !c.is_hidden)
            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
        const idx = visible.findIndex(c => c.slug === slug);
        if (idx < 0) return;
        const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= visible.length) return;

        const a = visible[idx];
        const b = visible[swapIdx];
        const orderA = a.sort_order ?? idx;
        const orderB = b.sort_order ?? swapIdx;
        try {
            await Promise.all([
                API.updateCategory(a.slug, { sort_order: orderB }),
                API.updateCategory(b.slug, { sort_order: orderA }),
            ]);
            await this.loadCategories();
            await App.loadCategories();
            MB.haptic();
        } catch (err) {
            Toast.show(err.message, 'error');
        }
    },

    async toggleFavorite(slug) {
        const settings = App.state?.settings;
        if (!settings) return;
        const current = new Set(settings.favorite_categories || []);
        if (current.has(slug)) {
            current.delete(slug);
        } else {
            if (current.size >= 8) {
                Toast.show('Up to 8 favorites — remove one first', 'error');
                return;
            }
            current.add(slug);
        }
        const favorite_categories = Array.from(current);
        try {
            const res = await API.updateSettings({ favorite_categories });
            if (!res.offline) App.state.settings = res.data;
            else settings.favorite_categories = favorite_categories;
            this.renderCategoryManageList();
        } catch (err) {
            Toast.show(err.message, 'error');
        }
    },

    bindCategoryEvents() {
        document.querySelectorAll('.new-cat-type').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.new-cat-type').forEach(b => {
                    b.classList.remove('new-cat-type-active', 'bg-bunny-100', 'dark:bg-bunny-900/40');
                    b.classList.add('bg-gray-100', 'dark:bg-gray-800');
                });
                btn.classList.add('new-cat-type-active', 'bg-bunny-100', 'dark:bg-bunny-900/40');
                btn.classList.remove('bg-gray-100', 'dark:bg-gray-800');
                this.selectedCatType = btn.dataset.catType;
            });
        });

        document.getElementById('add-category')?.addEventListener('click', async () => {
            const name = document.getElementById('new-cat-name')?.value.trim() || '';
            const emoji = document.getElementById('new-cat-emoji')?.value.trim() || '📦';
            if (!name) {
                Toast.show('Enter a category name', 'error');
                return;
            }
            try {
                await API.addCategory({ name, emoji, type: this.selectedCatType });
                document.getElementById('new-cat-name').value = '';
                document.getElementById('new-cat-emoji').value = '';
                Toast.show('Category added!');
                await this.loadCategories();
                await App.loadCategories();
            } catch (err) {
                Toast.show(err.message, 'error');
            }
        });
    },

    bindBackupEvents(state) {
        document.getElementById('backup-export')?.addEventListener('click', async () => {
            try {
                const passphrase = document.getElementById('backup-passphrase')?.value || '';
                await API.exportBackup(passphrase || null);
                Toast.show(passphrase ? 'Encrypted backup downloaded' : 'Backup downloaded');
            } catch (err) {
                Toast.show(err.message, 'error');
            }
        });

        document.getElementById('backup-import-file')?.addEventListener('change', async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
                const text = await file.text();
                let parsed = JSON.parse(text);
                if (parsed && parsed.encrypted === true) {
                    const passphrase = document.getElementById('backup-passphrase')?.value || '';
                    if (!passphrase) {
                        Toast.show('Enter the passphrase used to encrypt this backup', 'error');
                        return;
                    }
                    parsed = await MB.decryptBackup(parsed, passphrase);
                }
                if (!await MB.confirm('Restore this backup? It will replace all current expenses.', { title: 'Restore backup?' })) {
                    e.target.value = '';
                    return;
                }
                const res = await API.importBackup(parsed);
                Toast.show(`Restored ${res.data?.imported_expenses ?? 0} entries`);
                if (res.dashboard) state.dashboard = res.dashboard;
                await this.loadCategories();
                await App.loadCategories();
                await this.loadSettings(state);
                await this.loadReports();
            } catch (err) {
                Toast.show(err.message || 'Invalid backup file', 'error');
            } finally {
                e.target.value = '';
            }
        });

        document.getElementById('csv-import-file')?.addEventListener('change', async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
                const csv = await file.text();
                const res = await API.importCsv(csv);
                Toast.show(`Imported ${res.data?.imported ?? 0} rows`);
                if (res.dashboard) state.dashboard = res.dashboard;
                await this.loadReports();
            } catch (err) {
                Toast.show(err.message || 'CSV import failed', 'error');
            } finally {
                e.target.value = '';
            }
        });
    },

    bindShareStory(state) {
        document.getElementById('share-story')?.addEventListener('click', async () => {
            try {
                const res = await API.getStatistics();
                const d = res.data;
                const symbol = MB.currencySymbol(d.currency_symbol);
                const insights = d.insights || {};
                const lines = [
                    `🐰 Money Bunny — my cycle so far`,
                    `Spent: ${MB.formatMoney(d.current_cycle, symbol)}`,
                    `Saved: ${MB.formatMoney(d.cycle_saved || 0, symbol)}`,
                ];
                if (insights.salary_utilization) lines.push(`Salary used: ${insights.salary_utilization}%`);
                if (insights.story) lines.push(insights.story);
                if (insights.logging_streak >= 2) lines.push(`🔥 ${insights.logging_streak}-day logging streak`);
                const text = lines.join('\n');

                const blob = await MB.renderStoryImage({
                    spent: MB.formatMoney(d.current_cycle, symbol),
                    saved: MB.formatMoney(d.cycle_saved || 0, symbol),
                    utilization: insights.salary_utilization,
                    story: insights.story,
                    streak: insights.logging_streak,
                });

                if (blob && navigator.share && navigator.canShare) {
                    const file = new File([blob], 'money-bunny-story.png', { type: 'image/png' });
                    if (navigator.canShare({ files: [file] })) {
                        await navigator.share({ title: 'My Money Bunny story', text, files: [file] });
                        return;
                    }
                }

                if (blob) {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'money-bunny-story.png';
                    a.click();
                    URL.revokeObjectURL(url);
                }

                if (navigator.share) {
                    await navigator.share({ title: 'My Money Bunny story', text });
                } else if (navigator.clipboard?.writeText) {
                    await navigator.clipboard.writeText(text);
                    Toast.show(blob ? 'Story image saved + text copied' : 'Story copied to clipboard!');
                } else {
                    Toast.show(text, 'info', 6000);
                }
            } catch (err) {
                if (err.name !== 'AbortError') Toast.show(err.message || 'Could not share', 'error');
            }
        });
    },

    async loadSettings(state) {
        try {
            const res = await API.getSettings();
            const s = res.data;
            state.settings = s;

            const savingsEl = document.getElementById('set-savings');
            const darkEl = document.getElementById('set-dark-mode');
            const notifyEl = document.getElementById('set-notification');
            const notifyTimeEl = document.getElementById('set-notification-time');

            if (savingsEl) savingsEl.value = s.savings_goal ?? '';
            if (darkEl) darkEl.checked = !!s.dark_mode;
            if (notifyEl) notifyEl.checked = !!s.notification_reminder;
            if (notifyTimeEl) notifyTimeEl.value = s.notification_time || '20:00';

            MB.applyTheme(s.dark_mode);
        } catch (err) {
            Toast.show(err.message, 'error');
        }
    },

    async loadPinSettings() {
        try {
            const status = await Auth.checkStatus();
            const statusEl = document.getElementById('pin-status-text');
            const setupEl = document.getElementById('pin-setup-fields');
            const changeEl = document.getElementById('pin-change-fields');
            const removeBtn = document.getElementById('pin-remove-btn');

            if (status.pin_required) {
                if (statusEl) statusEl.textContent = 'PIN is enabled. Change it below.';
                setupEl?.classList.add('hidden');
                changeEl?.classList.remove('hidden');
                removeBtn?.classList.toggle('hidden', !App.state?.settings?.allow_pin_removal);
            } else {
                if (statusEl) statusEl.textContent = 'Setting up your PIN…';
                setupEl?.classList.remove('hidden');
                changeEl?.classList.add('hidden');
            }
        } catch (err) {
            Toast.show(err.message, 'error');
        }
        await this.loadBiometricSettings();
    },

    async loadBiometricSettings() {
        const card = document.getElementById('biometric-settings');
        const toggle = document.getElementById('set-biometric');
        const statusText = document.getElementById('biometric-status-text');
        if (!card || !toggle) return;

        let pinRequired = false;
        try {
            const status = await Auth.checkStatus();
            pinRequired = status.pin_required;
        } catch {
            card.classList.add('hidden');
            return;
        }

        const supported = Auth.isBiometricSupported();
        if (!pinRequired || !supported) {
            card.classList.add('hidden');
            return;
        }

        card.classList.remove('hidden');
        toggle.checked = Auth.isBiometricEnabled();
        if (statusText) {
            statusText.textContent = toggle.checked
                ? 'Fingerprint unlock is on — PIN still works as backup'
                : 'Unlock with your phone fingerprint instead of PIN';
        }
    },

    bindBiometricEvents() {
        document.getElementById('set-biometric')?.addEventListener('change', async (e) => {
            const toggle = e.target;
            const enabling = toggle.checked;

            if (enabling) {
                try {
                    await Auth.registerBiometric();
                    Toast.show('Fingerprint unlock enabled');
                } catch (err) {
                    toggle.checked = false;
                    Toast.show(err.message || 'Could not enable fingerprint', 'error');
                }
            } else {
                Auth.clearBiometric();
                Toast.show('Fingerprint unlock disabled');
            }

            await this.loadBiometricSettings();
        });
    },

    bindPinEvents() {
        document.getElementById('pin-set-btn')?.addEventListener('click', async () => {
            const pin = document.getElementById('pin-new')?.value.trim() || '';
            const confirm = document.getElementById('pin-confirm')?.value.trim() || '';
            if (!/^\d{4,6}$/.test(pin)) {
                Toast.show('PIN must be 4–6 digits', 'error');
                return;
            }
            if (pin !== confirm) {
                Toast.show('PINs do not match', 'error');
                return;
            }
            try {
                await Auth.setPin(pin);
                Toast.show('PIN enabled — you will need it on next visit');
                document.getElementById('pin-new').value = '';
                document.getElementById('pin-confirm').value = '';
                await this.loadPinSettings();
                await this.loadBiometricSettings();
            } catch (err) {
                Toast.show(err.message, 'error');
            }
        });

        document.getElementById('pin-change-btn')?.addEventListener('click', async () => {
            const oldPin = document.getElementById('pin-old')?.value.trim() || '';
            const pin = document.getElementById('pin-change-new')?.value.trim() || '';
            if (!/^\d{4,6}$/.test(pin)) {
                Toast.show('PIN must be 4–6 digits', 'error');
                return;
            }
            try {
                await Auth.setPin(pin, oldPin);
                Toast.show('PIN updated');
                document.getElementById('pin-old').value = '';
                document.getElementById('pin-change-new').value = '';
                await this.loadBiometricSettings();
            } catch (err) {
                Toast.show(err.message, 'error');
            }
        });

        document.getElementById('pin-remove-btn')?.addEventListener('click', async () => {
            const oldPin = document.getElementById('pin-old')?.value.trim() || '';
            if (!oldPin) {
                Toast.show('Enter current PIN to remove', 'error');
                return;
            }
            if (!await MB.confirm('Remove PIN? Anyone with the URL can access your data.', { title: 'Remove PIN?' })) return;
            try {
                await Auth.removePin(oldPin);
                Toast.show('PIN removed');
                document.getElementById('pin-old').value = '';
                await this.loadPinSettings();
                await this.loadBiometricSettings();
            } catch (err) {
                Toast.show(err.message, 'error');
            }
        });
    },

    initRecurringDayPickers() {
        const monthSelect = document.getElementById('rec-day-month');
        if (monthSelect && !monthSelect.options.length) {
            for (let d = 1; d <= 28; d++) {
                monthSelect.innerHTML += `<option value="${d}">${d}</option>`;
            }
            monthSelect.value = String(new Date().getDate());
        }
        const weekSelect = document.getElementById('rec-day-week');
        if (weekSelect) {
            weekSelect.value = String(new Date().getDay());
        }
        this.updateRecurringDayVisibility();
    },

    updateRecurringDayVisibility() {
        const isMonthly = this.selectedFreq === 'monthly';
        document.getElementById('rec-day-month-wrap')?.classList.toggle('hidden', !isMonthly);
        document.getElementById('rec-day-week-wrap')?.classList.toggle('hidden', isMonthly);
    },

    formatRecurringSchedule(r) {
        if (r.frequency === 'weekly') {
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const dow = r.day_of_week ?? 0;
            return `Every ${days[dow] || 'week'}`;
        }
        const dom = r.day_of_month ?? 1;
        return `Every ${dom}${dom === 1 ? 'st' : dom === 2 ? 'nd' : dom === 3 ? 'rd' : 'th'}`;
    },

    async loadRecurring() {
        try {
            const res = await API.getRecurring();
            const container = document.getElementById('recurring-list');
            if (!container) return;

            if (!res.data.length) {
                container.innerHTML = '<p class="text-sm text-gray-400">No recurring expenses</p>';
                return;
            }

            container.innerHTML = res.data.map(r => `
                <div class="flex items-center justify-between p-3 rounded-xl bg-bunny-50 dark:bg-gray-800">
                    <div class="flex items-center gap-2">
                        <span>${r.emoji}</span>
                        <div>
                            <p class="font-medium text-sm">${MB.formatMoney(r.amount)}</p>
                            <p class="text-xs text-gray-400">${this.formatRecurringSchedule(r)}</p>
                        </div>
                    </div>
                    <div class="flex gap-2">
                        <button data-toggle="${r.id}" class="text-xs px-2 py-1 rounded-lg ${r.is_active ? 'bg-bunny-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}">${r.is_active ? 'ON' : 'OFF'}</button>
                        <button data-del-rec="${r.id}" class="text-red-500 text-xs px-2">✕</button>
                    </div>
                </div>
            `).join('');

            container.querySelectorAll('[data-toggle]').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id = parseInt(btn.dataset.toggle);
                    const active = btn.textContent === 'ON';
                    await API.updateRecurring(id, { is_active: active ? 0 : 1 });
                    await this.loadRecurring();
                });
            });

            container.querySelectorAll('[data-del-rec]').forEach(btn => {
                btn.addEventListener('click', async () => {
                    await API.deleteRecurring(parseInt(btn.dataset.delRec));
                    await this.loadRecurring();
                    Toast.show('Removed');
                });
            });
        } catch (err) {
            Toast.show(err.message, 'error');
        }
    },

    async loadReports() {
        try {
            const res = await API.getReports();
            const { current, previous } = res.data;
            const sym = 'Rs.';

            const currentEl = document.getElementById('report-current');
            const previousEl = document.getElementById('report-previous');
            if (!currentEl || !previousEl) return;

            currentEl.innerHTML = current.cycle.has_salary
                ? `<p class="font-semibold mb-1">Current Cycle (${current.cycle.start_display} → ${current.cycle.end_display})</p>
                   <p>Salary: ${MB.formatMoney(current.salary, sym)} · Spent: ${MB.formatMoney(current.spent, sym)} · Saved: ${MB.formatMoney(current.saved, sym)}</p>`
                : '<p class="text-gray-400">Add salary via + → Income → Salary to start a cycle</p>';

            previousEl.innerHTML = previous.cycle.has_salary
                ? `<p class="font-semibold mb-1">Previous Cycle (${previous.cycle.start_display} → ${previous.cycle.end_display})</p>
                   <p>Salary: ${MB.formatMoney(previous.salary, sym)} · Spent: ${MB.formatMoney(previous.spent, sym)} · Saved: ${MB.formatMoney(previous.saved, sym)}</p>`
                : '<p class="text-gray-400">No previous cycle yet</p>';
        } catch (err) {
            Toast.show(err.message, 'error');
        }
    },

    bindEvents(state) {
        document.getElementById('save-settings')?.addEventListener('click', async () => {
            try {
                const savingsEl = document.getElementById('set-savings');
                const darkEl = document.getElementById('set-dark-mode');
                const notifyEl = document.getElementById('set-notification');
                const notifyTimeEl = document.getElementById('set-notification-time');

                const res = await API.updateSettings({
                    savings_goal: !savingsEl || savingsEl.value === '' ? null : MB.parseAmount(savingsEl.value),
                    dark_mode: darkEl?.checked ? 1 : 0,
                    notification_reminder: notifyEl?.checked ? 1 : 0,
                    notification_time: notifyTimeEl?.value || '20:00',
                });
                if (res.offline) return;

                state.settings = res.data;
                MB.applyTheme(res.data.dark_mode);
                await this.applyNotificationSettings(res.data);
                Toast.show('Settings saved!');
            } catch (err) {
                Toast.show(err.message, 'error');
            }
        });

        document.getElementById('set-notification')?.addEventListener('change', async (e) => {
            const notifyEl = e.target;
            const enabled = notifyEl.checked;
            const notifyTimeEl = document.getElementById('set-notification-time');

            try {
                const res = await API.updateSettings({
                    notification_reminder: enabled ? 1 : 0,
                    notification_time: notifyTimeEl?.value || '20:00',
                });
                if (res.offline) return;

                state.settings = res.data;
                await this.applyNotificationSettings(res.data);
                Toast.show(enabled ? 'Daily reminder on' : 'Daily reminder off');
            } catch (err) {
                notifyEl.checked = !enabled;
                Toast.show(err.message, 'error');
            }
        });

        document.getElementById('set-dark-mode')?.addEventListener('change', (e) => {
            MB.applyTheme(e.target.checked);
        });

        document.querySelectorAll('.rec-freq').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.rec-freq').forEach(b => {
                    b.classList.remove('rec-freq-active', 'bg-bunny-100', 'dark:bg-bunny-900/40');
                    b.classList.add('bg-gray-100', 'dark:bg-gray-800');
                });
                btn.classList.add('rec-freq-active', 'bg-bunny-100', 'dark:bg-bunny-900/40');
                btn.classList.remove('bg-gray-100', 'dark:bg-gray-800');
                this.selectedFreq = btn.dataset.freq;
                this.updateRecurringDayVisibility();
            });
        });

        document.getElementById('add-recurring')?.addEventListener('click', async () => {
            const amount = MB.parseAmount(document.getElementById('rec-amount').value);
            const category = document.getElementById('rec-category').value;
            if (!amount || amount <= 0) {
                Toast.show('Enter a valid amount', 'error');
                return;
            }
            const payload = { amount, category, frequency: this.selectedFreq };
            if (this.selectedFreq === 'monthly') {
                payload.day_of_month = parseInt(document.getElementById('rec-day-month')?.value || '1', 10);
            } else {
                payload.day_of_week = parseInt(document.getElementById('rec-day-week')?.value || '0', 10);
            }
            try {
                await API.addRecurring(payload);
                document.getElementById('rec-amount').value = '';
                await this.loadRecurring();
                Toast.show('Recurring added!');
            } catch (err) {
                Toast.show(err.message, 'error');
            }
        });

        document.getElementById('export-current')?.addEventListener('click', async () => {
            try {
                await API.exportCsv('current');
            } catch (err) {
                Toast.show(err.message, 'error');
            }
        });
        document.getElementById('export-previous')?.addEventListener('click', async () => {
            try {
                await API.exportCsv('previous');
            } catch (err) {
                Toast.show(err.message, 'error');
            }
        });
    },

    async applyNotificationSettings(settings) {
        if (!settings?.notification_reminder) return;

        if ('Notification' in window && Notification.permission === 'default') {
            await Notification.requestPermission();
        }
        await this.registerReminderSync();
    },

    async registerReminderSync() {
        if (!('serviceWorker' in navigator)) return;
        try {
            const reg = await navigator.serviceWorker.ready;
            if ('periodicSync' in reg) {
                await reg.periodicSync.register('mb-daily-reminder', {
                    minInterval: 24 * 60 * 60 * 1000,
                });
            }
        } catch (e) {
            // Browser may not support periodic background sync
        }
    },
};

window.SettingsPage = SettingsPage;

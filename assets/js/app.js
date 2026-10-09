/**
 * Money Bunny - Main application controller
 * SPA router, add expense sheet, edit modal, PWA install
 */

const App = {
    state: {
        dashboard: null,
        settings: null,
        categories: [],
        currency: 'Rs.',
        lastExpenses: [],
        currentRoute: 'dashboard',
        addType: 'expense',
        editType: 'expense',
    },

    routes: {
        dashboard: { title: 'Dashboard', page: DashboardPage, showNav: true },
        history: { title: 'History', page: HistoryPage, showNav: true },
        statistics: { title: 'Statistics', page: StatisticsPage, showNav: true },
        settings: { title: 'Settings', page: SettingsPage, showNav: true },
        calendar: { title: 'Calendar', page: CalendarPage, showNav: false },
        search: { title: 'Search', page: SearchPage, showNav: false },
    },

    deferredInstall: null,
    saving: false,
    editingId: null,
    addAmountRaw: '',
    addExpenseDate: null,
    fabLongPressTimer: null,
    fabLongPressTriggered: false,

    async init() {
        Toast.init();
        MB.applyTheme(true);
        this.bindNavigation();
        this.bindAddSheet();
        this.bindTypeToggle();
        this.bindEditModal();
        this.bindHeaderButtons();
        this.bindPWAInstall();
        this.bindEscapeToClose();
        this.setupConfirmSheet();
        this.setupCoach();
        this.setupOfflineBadge();
        this.setupServiceWorkerUpdates();
        await this.loadSettingsTheme();
        await this.loadCategories();
        this.setupNotifications();
        this.setupWeeklySummary();
        this.router();
        window.addEventListener('hashchange', () => this.router());
    },

    /** Hash-based client-side router */
    router() {
        const hash = window.location.hash.slice(1) || 'dashboard';
        const route = this.routes[hash] ? hash : 'dashboard';
        this.navigate(route);
    },

    async navigate(route) {
        const config = this.routes[route];
        if (!config) return;

        this.state.currentRoute = route;

        // Update header
        document.getElementById('page-title').textContent = config.title;
        document.getElementById('bottom-nav').style.display = config.showNav ? '' : 'none';

        // Update nav active state
        document.querySelectorAll('.nav-item').forEach(el => {
            const isActive = el.dataset.route === route;
            el.classList.toggle('nav-active', isActive);
        });

        // Render page
        const container = document.getElementById('main-content');
        container.innerHTML = '';
        await config.page.render(container, this.state);

        if (route === 'dashboard') this.maybeShowCoach();
    },

    bindNavigation() {
        document.querySelectorAll('.nav-item').forEach(el => {
            el.addEventListener('click', (e) => {
                MB.haptic();
            });
        });
    },

    bindHeaderButtons() {
        document.getElementById('btn-home')?.addEventListener('click', (e) => {
            MB.haptic();
            if (window.location.hash === '#dashboard' || window.location.hash === '') {
                e.preventDefault();
                this.navigate('dashboard');
            }
        });

        document.getElementById('btn-search')?.addEventListener('click', () => {
            window.location.hash = 'search';
        });
        document.getElementById('btn-calendar')?.addEventListener('click', () => {
            window.location.hash = 'calendar';
        });
    },

    async loadCategories() {
        try {
            const res = await API.getCategories();
            this.state.categories = res.data;
            this.renderCategoryGrid();
        } catch (err) {
            console.error('Failed to load categories', err);
        }
    },

    async loadSettingsTheme() {
        try {
            const res = await API.getSettings();
            this.state.settings = res.data;
            MB.applyTheme(res.data.dark_mode);
        } catch (err) { /* offline fallback */ }
    },

    // --- Quick Add Bottom Sheet ---

    bindTypeToggle() {
        document.getElementById('toggle-expense')?.addEventListener('click', () => this.setAddType('expense'));
        document.getElementById('toggle-income')?.addEventListener('click', () => this.setAddType('income'));

        document.getElementById('edit-toggle-expense')?.addEventListener('click', () => this.setEditType('expense'));
        document.getElementById('edit-toggle-income')?.addEventListener('click', () => this.setEditType('income'));
    },

    setAddType(type) {
        this.state.addType = type;
        MB.haptic();

        const expenseBtn = document.getElementById('toggle-expense');
        const incomeBtn = document.getElementById('toggle-income');
        const slider = document.getElementById('type-segment-slider');
        const amountInput = document.getElementById('add-amount');
        const title = document.getElementById('add-sheet-title');

        expenseBtn?.classList.toggle('type-segment-active', type === 'expense');
        incomeBtn?.classList.toggle('type-segment-active', type === 'income');
        expenseBtn?.setAttribute('aria-selected', type === 'expense' ? 'true' : 'false');
        incomeBtn?.setAttribute('aria-selected', type === 'income' ? 'true' : 'false');
        slider?.classList.toggle('is-income', type === 'income');

        if (amountInput) {
            amountInput.classList.toggle('text-orange-600', type === 'expense');
            amountInput.classList.toggle('dark:text-orange-400', type === 'expense');
            amountInput.classList.toggle('text-bunny-600', type === 'income');
            amountInput.classList.toggle('dark:text-bunny-400', type === 'income');
        }

        const amountDisplay = document.getElementById('add-amount-display');
        if (amountDisplay) {
            amountDisplay.classList.toggle('text-orange-600', type === 'expense');
            amountDisplay.classList.toggle('dark:text-orange-400', type === 'expense');
            amountDisplay.classList.toggle('text-bunny-600', type === 'income');
            amountDisplay.classList.toggle('dark:text-bunny-400', type === 'income');
        }

        if (title) {
            title.textContent = type === 'income' ? 'Add Income' : 'Add Expense';
        }

        document.getElementById('add-sheet')?.setAttribute('aria-label', type === 'income' ? 'Add income' : 'Add expense');

        const hint = document.getElementById('add-sheet-hint');
        if (hint) {
            hint.textContent = type === 'income'
                ? '💵 Salary starts a new budget cycle'
                : 'Tap category to save instantly';
        }

        this.renderCategoryGrid();
        this.updateRepeatLastButton();
    },

    setEditType(type) {
        this.state.editType = type;
        MB.haptic();

        document.getElementById('edit-toggle-expense')?.classList.toggle('type-segment-active', type === 'expense');
        document.getElementById('edit-toggle-income')?.classList.toggle('type-segment-active', type === 'income');
        document.getElementById('edit-type-slider')?.classList.toggle('is-income', type === 'income');

        this.populateEditCategories(type);
    },

    populateEditCategories(type, selectedSlug = null) {
        const catSelect = document.getElementById('edit-category');
        if (!catSelect) return;

        const categories = this.state.categories.filter(c => c.type === type);
        catSelect.innerHTML = categories.map(c =>
            `<option value="${c.slug}" ${c.slug === selectedSlug ? 'selected' : ''}>${c.emoji} ${c.name}</option>`
        ).join('');
    },

    resetAddAmount() {
        this.addAmountRaw = '';
        this.updateAddAmountDisplay();
    },

    updateAddAmountDisplay() {
        const display = document.getElementById('add-amount-display');
        const hidden = document.getElementById('add-amount');
        const raw = this.addAmountRaw;

        if (hidden) hidden.value = raw;
        if (!display) return;

        display.textContent = raw || '0.00';
        display.classList.toggle('opacity-40', !raw);
    },

    appendAddAmountDigit(digit) {
        let v = this.addAmountRaw;
        const dot = v.indexOf('.');

        if (dot !== -1 && v.length - dot > 2) return;

        if (!v && digit === '0') {
            v = '0';
        } else if (v === '0' && digit !== '0' && dot === -1) {
            v = digit;
        } else {
            v += digit;
        }

        this.addAmountRaw = v;
        this.updateAddAmountDisplay();
    },

    addAddAmountDecimal() {
        if (this.addAmountRaw.includes('.')) return;
        this.addAmountRaw = this.addAmountRaw || '0';
        this.addAmountRaw += '.';
        this.updateAddAmountDisplay();
    },

    backspaceAddAmount() {
        this.addAmountRaw = this.addAmountRaw.slice(0, -1);
        this.updateAddAmountDisplay();
    },

    getAddAmount() {
        const raw = this.addAmountRaw || document.getElementById('add-amount')?.value || '';
        if (String(raw).endsWith('.') || String(raw).endsWith(',')) {
            return NaN;
        }
        return MB.parseAmount(raw);
    },

    bindAddSheet() {
        const fab = document.getElementById('fab-add');
        const overlay = document.getElementById('sheet-overlay');

        fab?.addEventListener('click', () => {
            if (this.fabLongPressTriggered) {
                this.fabLongPressTriggered = false;
                return;
            }
            this.openAddSheet();
        });
        overlay?.addEventListener('click', () => this.closeAddSheet());

        document.getElementById('add-amount-keypad')?.addEventListener('click', (e) => {
            const digit = e.target.closest('[data-amt-digit]');
            if (digit) {
                MB.haptic();
                this.appendAddAmountDigit(digit.dataset.amtDigit);
                return;
            }
            if (e.target.closest('[data-amt-decimal]')) {
                MB.haptic();
                this.addAddAmountDecimal();
                return;
            }
            if (e.target.closest('[data-amt-back]')) {
                MB.haptic();
                this.backspaceAddAmount();
            }
        });

        document.getElementById('add-repeat-last')?.addEventListener('click', () => this.repeatLastEntry());
        document.getElementById('add-date')?.addEventListener('change', (e) => {
            this.addExpenseDate = e.target.value || MB.todayLocal();
        });

        document.getElementById('add-date-toggle')?.addEventListener('click', () => {
            document.getElementById('add-date-wrap')?.classList.toggle('hidden');
        });
        document.getElementById('add-note-toggle')?.addEventListener('click', () => {
            const wrap = document.getElementById('add-note-wrap');
            if (!wrap) return;
            const nowHidden = wrap.classList.toggle('hidden');
            if (!nowHidden) document.getElementById('add-note')?.focus();
        });

        this.bindFabLongPress();
    },

    bindFabLongPress() {
        const fab = document.getElementById('fab-add');
        if (!fab) return;

        const clearTimer = () => {
            if (this.fabLongPressTimer) {
                clearTimeout(this.fabLongPressTimer);
                this.fabLongPressTimer = null;
            }
        };

        fab.addEventListener('touchstart', () => {
            clearTimer();
            this.fabLongPressTimer = setTimeout(() => {
                this.fabLongPressTriggered = true;
                MB.haptic();
                this.openAddSheet(true);
            }, 550);
        }, { passive: true });

        fab.addEventListener('touchend', clearTimer);
        fab.addEventListener('touchmove', clearTimer);
        fab.addEventListener('touchcancel', clearTimer);
    },

    getAddDate() {
        return this.addExpenseDate || document.getElementById('add-date')?.value || MB.todayLocal();
    },

    updateRepeatLastButton() {
        const btn = document.getElementById('add-repeat-last');
        const last = MB.loadLastEntry();
        if (!btn) return;
        btn.disabled = !last;
        if (last) {
            const cat = this.state.categories.find(c => c.slug === last.category);
            const name = cat ? `${cat.emoji} ${cat.name}` : last.category;
            btn.textContent = `↩ Repeat ${name}`;
        } else {
            btn.textContent = '↩ Repeat last';
        }
    },

    async repeatLastEntry() {
        const last = MB.loadLastEntry();
        if (!last) {
            Toast.show('No previous entry to repeat', 'error');
            return;
        }
        MB.haptic();
        this.setAddType(last.type || 'expense');
        this.addAmountRaw = MB.formatAmountForInput(last.amount).replace(/\.00$/, '') || String(last.amount);
        this.updateAddAmountDisplay();
        await this.saveExpense(last.category, { fromRepeat: true });
    },

    openAddSheet(repeatLast = false) {
        MB.haptic();
        this.setAddType('expense');
        this.resetAddAmount();
        this.addExpenseDate = MB.todayLocal();
        const dateInput = document.getElementById('add-date');
        if (dateInput) dateInput.value = this.addExpenseDate;
        document.getElementById('add-date-wrap')?.classList.add('hidden');
        const noteInput = document.getElementById('add-note');
        if (noteInput) noteInput.value = '';
        document.getElementById('add-note-wrap')?.classList.add('hidden');
        this.updateRepeatLastButton();
        const sheet = document.getElementById('add-sheet');
        sheet.classList.remove('translate-y-full');
        sheet.classList.add('translate-y-0');
        const overlay = document.getElementById('sheet-overlay');
        overlay.classList.remove('opacity-0', 'pointer-events-none');
        overlay.classList.add('opacity-100');
        MB.trapFocus(sheet);
        if (repeatLast) {
            const last = MB.loadLastEntry();
            if (last) {
                this.setAddType(last.type || 'expense');
                this.addAmountRaw = MB.formatAmountForInput(last.amount);
                this.updateAddAmountDisplay();
            }
        }
    },

    closeAddSheet() {
        document.getElementById('add-sheet').classList.add('translate-y-full');
        document.getElementById('add-sheet').classList.remove('translate-y-0');
        const overlay = document.getElementById('sheet-overlay');
        overlay.classList.add('opacity-0', 'pointer-events-none');
        overlay.classList.remove('opacity-100');
        MB.releaseFocus();
    },

    /** Sort favorites first, then recently-used, then the rest (stable order preserved otherwise) */
    sortCategoriesByPreference(categories) {
        const favorites = this.state.settings?.favorite_categories || [];
        const recents = MB.getRecentCategories();
        const rank = (slug) => {
            const favIndex = favorites.indexOf(slug);
            if (favIndex !== -1) return favIndex;
            const recentIndex = recents.indexOf(slug);
            if (recentIndex !== -1) return favorites.length + recentIndex;
            return favorites.length + recents.length + 1;
        };
        return [...categories].sort((a, b) => rank(a.slug) - rank(b.slug));
    },

    renderCategoryGrid() {
        const grid = document.getElementById('category-grid');
        if (!grid) return;

        const type = this.state.addType;
        let categories = this.state.categories.filter(c => c.type === type);
        if (type === 'expense') {
            categories = this.sortCategoriesByPreference(categories);
        }
        const favorites = this.state.settings?.favorite_categories || [];
        const btnClass = type === 'income'
            ? 'cat-btn cat-btn-income flex items-center gap-3 p-4 rounded-2xl hover:bg-bunny-100 dark:hover:bg-bunny-900/40 active:scale-95 transition-all'
            : 'cat-btn flex items-center gap-3 p-4 rounded-2xl bg-bunny-50 dark:bg-gray-800 hover:bg-bunny-100 dark:hover:bg-gray-700 active:scale-95 transition-all';

        if (!categories.length) {
            grid.innerHTML = '<p class="text-center text-gray-400 col-span-2 py-4">No categories</p>';
            return;
        }

        grid.innerHTML = categories.map(cat => `
            <button type="button" data-category="${cat.slug}" class="${btnClass} relative">
                <span class="text-2xl">${cat.emoji}</span>
                <span class="font-semibold">${cat.name}</span>
                ${favorites.includes(cat.slug) ? '<span class="cat-fav-star" aria-hidden="true">★</span>' : ''}
            </button>
        `).join('');

        grid.querySelectorAll('.cat-btn').forEach(btn => {
            btn.addEventListener('click', () => this.saveExpense(btn.dataset.category));
        });
    },

    /** Instant save - no confirmation */
    async saveExpense(category, options = {}) {
        if (this.saving) return;

        const amount = this.getAddAmount();
        if (!Number.isFinite(amount) || amount <= 0) {
            Toast.show('Enter an amount first', 'error');
            return;
        }

        MB.haptic();
        const type = this.state.addType;
        const expenseDate = this.getAddDate();
        const note = document.getElementById('add-note')?.value.trim() || null;
        this.saving = true;
        document.querySelectorAll('.cat-btn').forEach(b => b.disabled = true);

        try {
            const res = await API.addExpense(amount, category, expenseDate, type, note);
            this.closeAddSheet();
            MB.pushRecentCategory(category);
            this.markOnboardingDone();

            if (res.offline) {
                MB.saveLastEntry({ amount, category, type, note });
                if (this.state.currentRoute === 'dashboard') {
                    await DashboardPage.refresh(this.state);
                } else if (this.state.currentRoute === 'history') {
                    await HistoryPage.load(this.state);
                }
                return;
            }

            this.state.dashboard = res.dashboard;
            MB.saveLastEntry(res.data || { amount, category, type, note });
            this.notifyRecurringApplied(res.dashboard);

            if (res.cycle_reset) {
                CycleFilter.setSelected(null);
                let msg = `💵 New cycle started! ${MB.formatMoney(amount, MB.currencySymbol(this.state.currency))}`;
                if (res.salary_replaced) {
                    msg += ' (replaced earlier salary today)';
                }
                Toast.show(msg, 'success', 3500);
            } else {
                const label = type === 'income' ? 'Income saved!' : (options.fromRepeat ? 'Repeated!' : 'Expense saved!');
                Toast.show(`${res.data.emoji} ${MB.formatMoney(amount, MB.currencySymbol(this.state.currency), type === 'income' ? { type: 'income' } : {})} — ${label}`);
            }

            // Refresh current page
            if (this.state.currentRoute === 'dashboard') {
                await DashboardPage.refresh(this.state);
            } else if (this.state.currentRoute === 'history') {
                await HistoryPage.load(this.state);
            } else if (this.state.currentRoute === 'statistics') {
                await StatisticsPage.load(this.state);
            }
        } catch (err) {
            Toast.show(err.message, 'error');
        } finally {
            this.saving = false;
            document.querySelectorAll('.cat-btn').forEach(b => b.disabled = false);
        }
    },

    async refreshDashboard() {
        if (this.state.currentRoute === 'dashboard') {
            await DashboardPage.refresh(this.state);
        }
    },

    // --- Edit Modal ---

    bindEditModal() {
        document.getElementById('edit-cancel')?.addEventListener('click', () => this.closeEditModal());
        document.getElementById('edit-overlay')?.addEventListener('click', () => this.closeEditModal());
        document.getElementById('edit-save')?.addEventListener('click', () => this.saveEdit());

        const editAmount = document.getElementById('edit-amount');
        editAmount?.addEventListener('input', () => {
            const sanitized = MB.sanitizeAmountInput(editAmount.value);
            if (sanitized !== editAmount.value) {
                editAmount.value = sanitized;
            }
        });
    },

    async openEditModal(id) {
        try {
            const res = await API.getExpense(id);
            const exp = res.data;
            if (!exp) {
                Toast.show('Entry not found', 'error');
                return;
            }

            this.editingId = id;
            this.setEditType(exp.type || 'expense');
            this.populateEditCategories(exp.type || 'expense', exp.category);

            document.getElementById('edit-id').value = id;
            document.getElementById('edit-amount').value = MB.formatAmountForInput(exp.amount);
            document.getElementById('edit-date').value = exp.expense_date;
            document.getElementById('edit-note').value = exp.note || '';

            const modal = document.getElementById('edit-modal');
            modal.classList.remove('opacity-0', 'pointer-events-none');
            modal.querySelector('.relative').classList.remove('translate-y-8');
            MB.trapFocus(modal);
        } catch (err) {
            Toast.show(err.message, 'error');
        }
    },

    closeEditModal() {
        this.editingId = null;
        const modal = document.getElementById('edit-modal');
        modal.classList.add('opacity-0', 'pointer-events-none');
        modal.querySelector('.relative').classList.add('translate-y-8');
        MB.releaseFocus();
    },

    async saveEdit() {
        const id = parseInt(document.getElementById('edit-id').value);
        const amount = MB.readAmountInput(document.getElementById('edit-amount'));
        const category = document.getElementById('edit-category').value;
        const expense_date = document.getElementById('edit-date').value;
        const note = (document.getElementById('edit-note')?.value || '').trim();
        const type = this.state.editType;

        if (!Number.isFinite(amount) || amount <= 0) {
            Toast.show('Invalid amount', 'error');
            return;
        }

        try {
            const res = await API.updateExpense(id, { amount, category, expense_date, type, note: note || null });
            this.closeEditModal();
            if (res.offline) {
                Toast.show('Saved offline — will sync when online', 'info', 3000);
            } else {
                Toast.show('Updated!');
            }
            this.router();
        } catch (err) {
            Toast.show(err.message, 'error');
        }
    },

    // --- PWA Install ---

    bindPWAInstall() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredInstall = e;
            const banner = document.getElementById('install-banner');
            if (banner && !localStorage.getItem('mb_install_dismissed')) {
                banner.classList.remove('hidden');
            }
        });

        document.getElementById('install-accept')?.addEventListener('click', async () => {
            if (this.deferredInstall) {
                this.deferredInstall.prompt();
                await this.deferredInstall.userChoice;
                this.deferredInstall = null;
            }
            document.getElementById('install-banner')?.classList.add('hidden');
        });

        document.getElementById('install-dismiss')?.addEventListener('click', () => {
            localStorage.setItem('mb_install_dismissed', '1');
            document.getElementById('install-banner')?.classList.add('hidden');
        });
    },

    // --- Daily notification reminder ---

    setupNotifications() {
        if (!('Notification' in window)) return;

        const checkReminder = async () => {
            try {
                const res = await API.getSettings();
                const s = res.data;
                if (!s.notification_reminder) return;

                const [h, m] = (s.notification_time || '20:00').split(':').map(Number);
                const now = new Date();
                if (now.getHours() !== h || now.getMinutes() !== m) return;

                const today = MB.todayLocal();
                const lastReminderDay = localStorage.getItem('mb_last_reminder_day');
                if (lastReminderDay === today) return;

                const expRes = await API.getExpenses({ date: today });
                const hasExpense = expRes.data.some(e => e.type === 'expense');
                if (!hasExpense) {
                    if (Notification.permission === 'granted') {
                        new Notification('Money Bunny', {
                            body: "Haven't added today's expenses.",
                            icon: MB.logoUrl(),
                        });
                        localStorage.setItem('mb_last_reminder_day', today);
                    }
                    if ('serviceWorker' in navigator) {
                        try {
                            const reg = await navigator.serviceWorker.ready;
                            reg.active?.postMessage({ type: 'mb-check-reminder' });
                        } catch (e) { /* optional */ }
                    }
                }
            } catch (err) { /* silent */ }
        };

        // Check every minute
        setInterval(checkReminder, 60000);
    },

    async setupWeeklySummary() {
        const now = new Date();
        if (now.getDay() !== 1) return;

        const weekKey = `mb_week_summary_${MB.todayLocal()}`;
        if (localStorage.getItem(weekKey)) return;

        try {
            const res = await API.getStatistics();
            const d = res.data;
            const symbol = MB.currencySymbol(d.currency_symbol);
            const spent = d.last_week || 0;
            const streak = d.insights?.logging_streak || 0;

            if (spent > 0) {
                const top = d.last_week_top_category;
                const topPart = top
                    ? ` · ${top.emoji} ${top.name}: ${MB.formatMoney(top.total, symbol)}`
                    : '';
                Toast.show(`📊 Last week you spent ${MB.formatMoney(spent, symbol)}${topPart}`, 'info', 5000);
            }
            if (streak >= 3) {
                setTimeout(() => {
                    Toast.show(`🔥 ${streak}-day logging streak — keep it up!`, 'success', 4000);
                }, spent > 0 ? 1200 : 0);
            }
            localStorage.setItem(weekKey, '1');
        } catch (e) { /* silent */ }
    },

    // --- Recurring-applied notice ---

    notifyRecurringApplied(dashboard) {
        const applied = dashboard?.recurring_applied;
        if (!Array.isArray(applied) || !applied.length) return;
        const cat = this.state.categories.find(c => c.slug === applied[0].category);
        const when = applied[0].expense_date === MB.todayLocal() ? 'today' : applied[0].expense_date;
        const label = applied.length === 1
            ? `${cat ? cat.emoji : '🔁'} Recurring ${cat ? cat.name : applied[0].category} applied ${when}`
            : `🔁 ${applied.length} recurring expenses applied ${when}`;
        Toast.show(label, 'info', 3500);
    },

    /** Gentle pace alert once per day when spending too fast */
    checkPaceAlert(dashboard) {
        if (!dashboard?.has_salary || dashboard.is_current_view === false) return;
        const pace = dashboard.insights?.pace_status;
        if (pace !== 'fast' && pace !== 'over') return;

        const key = `mb_pace_alert_${MB.todayLocal()}`;
        if (localStorage.getItem(key)) return;
        localStorage.setItem(key, pace);

        const symbol = MB.currencySymbol(dashboard.currency_symbol);
        if (pace === 'over') {
            Toast.show('⚠️ Cycle balance is used up — log carefully until next salary', 'error', 4500);
            return;
        }
        const days = dashboard.insights?.days_until_broke;
        const safe = MB.formatMoney(dashboard.daily_safe_spending || 0, symbol);
        const msg = days != null
            ? `⚡ Spending fast — ~${days} days of funds left. Safe pace: ${safe}/day`
            : `⚡ Spending faster than safe daily (${safe}/day)`;
        Toast.show(msg, 'info', 4500);
    },

    /** Celebrate streak milestones once */
    checkAchievements(insights) {
        if (!insights) return;
        const streak = insights.logging_streak || 0;
        const milestones = [
            { n: 3, key: 'mb_ach_streak_3', msg: '🏅 Achievement: 3-day logging streak!' },
            { n: 7, key: 'mb_ach_streak_7', msg: '🏅 Achievement: Week warrior — 7 days!' },
            { n: 30, key: 'mb_ach_streak_30', msg: '🏆 Achievement: Month master — 30 days!' },
        ];
        for (const m of milestones) {
            if (streak >= m.n && !localStorage.getItem(m.key)) {
                localStorage.setItem(m.key, '1');
                setTimeout(() => Toast.show(m.msg, 'success', 4000), 800);
                break;
            }
        }
    },

    // --- Onboarding coach ---

    setupCoach() {
        document.getElementById('coach-dismiss')?.addEventListener('click', () => {
            localStorage.setItem('mb_coach_dismissed', '1');
            this.hideCoach();
        });
        document.getElementById('coach-cta')?.addEventListener('click', () => {
            this.hideCoach();
            this.openAddSheet();
            this.setAddType('income');
        });
    },

    maybeShowCoach() {
        const overlay = document.getElementById('coach-overlay');
        if (!overlay) return;
        const dismissed = localStorage.getItem('mb_coach_dismissed');
        const onboardingDone = this.state.settings?.onboarding_done;
        const hasSalary = !!this.state.dashboard?.has_salary;
        overlay.classList.toggle('hidden', !!dismissed || !!onboardingDone || hasSalary);
    },

    hideCoach() {
        document.getElementById('coach-overlay')?.classList.add('hidden');
    },

    async markOnboardingDone() {
        if (this.state.settings?.onboarding_done) return;
        if (this.state.settings) this.state.settings.onboarding_done = 1;
        this.hideCoach();
        try {
            const res = await API.updateSettings({ onboarding_done: 1 });
            if (!res.offline && res.data) this.state.settings = res.data;
        } catch (e) { /* best-effort */ }
    },

    // --- Offline sync badge ---

    async updateOfflineBadge() {
        const badge = document.getElementById('offline-badge');
        const textEl = document.getElementById('offline-badge-text');
        if (!badge) return;
        const count = window.OfflineQueue ? await OfflineQueue.pendingCount() : 0;
        if (count > 0) {
            if (textEl) textEl.textContent = `${navigator.onLine ? 'Syncing' : 'Offline'} — ${count} pending`;
            badge.classList.remove('hidden');
            badge.classList.add('flex');
        } else {
            badge.classList.add('hidden');
            badge.classList.remove('flex');
        }
    },

    setupOfflineBadge() {
        this.updateOfflineBadge();
        window.addEventListener('online', () => this.updateOfflineBadge());
        window.addEventListener('offline', () => this.updateOfflineBadge());
        setInterval(() => this.updateOfflineBadge(), 15000);
    },

    // --- Custom confirm sheet / focus management ---

    setupConfirmSheet() {
        // MB.confirm manages its own lifecycle per-call; nothing to pre-bind here.
    },

    bindEscapeToClose() {
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            const addSheet = document.getElementById('add-sheet');
            if (addSheet && !addSheet.classList.contains('translate-y-full')) {
                this.closeAddSheet();
                return;
            }
            const editModal = document.getElementById('edit-modal');
            if (editModal && !editModal.classList.contains('pointer-events-none')) {
                this.closeEditModal();
            }
        });
    },

    // --- PWA update ---

    setupServiceWorkerUpdates() {
        if (!('serviceWorker' in navigator)) return;
        let refreshed = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshed) return;
            refreshed = true;
            Toast.show('Update available — refreshing…', 'info', 1500);
            setTimeout(() => window.location.reload(), 600);
        });
        navigator.serviceWorker.addEventListener('message', (e) => {
            if (e.data?.type === 'mb-sw-updated') {
                Toast.show('New version available — reload to update', 'info', 4000);
            }
        });
    },
};

document.addEventListener('DOMContentLoaded', async () => {
    await OfflineQueue.init();
    const unlocked = await Auth.gateAppStart();
    if (unlocked) {
        App._started = true;
        await App.init();
    }
});

window.App = App;

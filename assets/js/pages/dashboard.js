/**
 * Dashboard page - home screen with balance, progress, recent expenses
 */

const DashboardPage = {
    async render(container, state) {
        container.innerHTML = `
            <div class="animate-fade-in space-y-4">
                <div id="cycle-filter-mount"></div>

                <div id="viewing-past-banner" class="hidden card p-3 text-sm text-center bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200">
                    Viewing a past salary cycle — numbers below are for that period only
                </div>

                <div id="no-salary-banner" class="hidden card p-4 text-center bg-bunny-100 dark:bg-bunny-900/30 border-bunny-200 dark:border-bunny-800">
                    <p class="text-2xl mb-2">💵</p>
                    <p class="font-semibold text-bunny-800 dark:text-bunny-300">Start your first cycle</p>
                    <p class="text-sm text-bunny-700/80 dark:text-bunny-400/80 mt-1">Tap <strong>+</strong> → <strong>Income</strong> → <strong>Salary</strong></p>
                </div>

                <div id="dash-cycle-story" class="hidden card p-4 border border-bunny-200 dark:border-bunny-800 bg-bunny-50/80 dark:bg-bunny-950/40">
                    <div class="flex items-start justify-between gap-2">
                        <div>
                            <p class="text-xs font-semibold uppercase tracking-wide text-bunny-600 dark:text-bunny-400">Cycle wrap</p>
                            <p id="dash-cycle-story-title" class="font-bold mt-1">Last cycle summary</p>
                            <p id="dash-cycle-story-body" class="text-sm text-gray-600 dark:text-gray-300 mt-1"></p>
                        </div>
                        <button type="button" id="dash-cycle-story-dismiss" class="text-gray-400 text-sm px-2" aria-label="Dismiss">✕</button>
                    </div>
                </div>

                <!-- Hero card: remaining + safe daily + story + streak -->
                <div class="card p-5 text-center relative" id="dash-hero">
                    <div id="dash-streak-badge" class="hidden absolute top-3 right-3 items-center gap-1 px-2 py-1 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-300 text-xs font-bold">
                        🔥 <span id="dash-streak-count">0</span>
                    </div>
                    <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">Remaining Balance</p>
                    <p id="dash-remaining" class="text-4xl font-bold text-bunny-700 dark:text-bunny-400" data-value="0">
                        <span class="skeleton skeleton-text inline-block w-40 h-9 rounded-lg"></span>
                    </p>
                    <p id="dash-safe-daily" class="hidden text-sm text-bunny-600 dark:text-bunny-400 mt-2"></p>
                    <p id="dash-story" class="hidden text-sm text-gray-600 dark:text-gray-300 mt-3 px-2"></p>
                    <div id="dash-health-row" class="hidden items-center justify-center gap-2 mt-3">
                        <div class="h-1.5 w-24 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
                            <div id="dash-health-bar" class="h-full rounded-full transition-all duration-500" style="width: 50%"></div>
                        </div>
                        <span id="dash-pace-label" class="text-xs font-semibold text-gray-500 dark:text-gray-400"></span>
                    </div>
                    <div id="dash-achievements" class="hidden flex-wrap justify-center gap-1.5 mt-3"></div>
                </div>

                <!-- Details disclosure: secondary stats + progress bar -->
                <button type="button" id="dash-details-toggle" class="dash-details-toggle w-full flex items-center justify-between px-1 py-1 text-sm font-semibold text-gray-500 dark:text-gray-400" aria-expanded="false" aria-controls="dash-details">
                    <span>Details</span>
                    <svg id="dash-details-chevron" class="dash-details-chevron transition-transform" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                </button>
                <div id="dash-details" class="hidden space-y-3">
                    <!-- Stats grid -->
                    <div class="grid grid-cols-2 gap-3">
                        <div class="card p-4">
                            <p class="text-xs text-gray-500 dark:text-gray-400">Cycle Salary</p>
                            <p id="dash-salary" class="text-lg font-bold mt-1">—</p>
                        </div>
                        <div class="card p-4">
                            <p class="text-xs text-gray-500 dark:text-gray-400">Spent</p>
                            <p id="dash-spent" class="text-lg font-bold mt-1 text-orange-600 dark:text-orange-400">—</p>
                        </div>
                        <div class="card p-4">
                            <p class="text-xs text-gray-500 dark:text-gray-400">Extra Income</p>
                            <p id="dash-income" class="text-lg font-bold mt-1 text-bunny-600 dark:text-bunny-400">—</p>
                        </div>
                        <div class="card p-4">
                            <p class="text-xs text-gray-500 dark:text-gray-400">Saved</p>
                            <p id="dash-saved" class="text-lg font-bold mt-1 text-bunny-700 dark:text-bunny-300">—</p>
                        </div>
                        <div class="card p-4 col-span-2">
                            <p class="text-xs text-gray-500 dark:text-gray-400" id="dash-days-label">Day of Cycle</p>
                            <p id="dash-days" class="text-lg font-bold mt-1">—</p>
                        </div>
                    </div>

                    <!-- Progress bar -->
                    <div class="card p-4" id="dash-progress-card">
                        <div class="flex justify-between text-xs mb-2">
                            <span class="text-bunny-600 dark:text-bunny-400">Remaining <span id="dash-rem-pct">0</span>%</span>
                            <span class="text-orange-500">Spent <span id="dash-spent-pct">0</span>%</span>
                        </div>
                        <div class="h-3 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden flex">
                            <div id="dash-bar-rem" class="h-full bg-bunny-500 transition-all duration-500 rounded-l-full" style="width: 0%"></div>
                            <div id="dash-bar-spent" class="h-full bg-orange-400 transition-all duration-500 rounded-r-full" style="width: 0%"></div>
                        </div>
                    </div>
                </div>

                <!-- Recent -->
                <div>
                    <h2 class="text-lg font-bold mb-3">Recent <span class="text-xs font-normal text-gray-400">this cycle</span></h2>
                    <div id="recent-expenses" class="space-y-2">
                        <div class="skeleton skeleton-row"></div>
                        <div class="skeleton skeleton-row"></div>
                        <div class="skeleton skeleton-row"></div>
                    </div>
                </div>
            </div>
        `;

        CycleFilter.bindHeaderOpener('#cycle-filter-mount');
        await CycleFilter.mount(
            document.getElementById('cycle-filter-mount'),
            state,
            () => this.loadData(state)
        );

        document.getElementById('dash-details-toggle')?.addEventListener('click', () => {
            const panel = document.getElementById('dash-details');
            const chevron = document.getElementById('dash-details-chevron');
            const toggle = document.getElementById('dash-details-toggle');
            const nowHidden = panel?.classList.toggle('hidden');
            toggle?.setAttribute('aria-expanded', nowHidden ? 'false' : 'true');
            chevron?.classList.toggle('rotate-180', !nowHidden);
        });

        document.getElementById('dash-cycle-story-dismiss')?.addEventListener('click', () => {
            const start = state.dashboard?.cycle_start || state.dashboard?.cycle?.start;
            if (start) localStorage.setItem('mb_cycle_story_dismissed', start);
            document.getElementById('dash-cycle-story')?.classList.add('hidden');
        });

        await this.loadData(state);
    },

    async loadData(state) {
        try {
            const expParams = { limit: 20, ...CycleFilter.apiParams() };
            if (!CycleFilter.getSelected()) expParams.cycle = 'current';
            const [dashRes, expRes] = await Promise.all([
                API.getDashboard(CycleFilter.apiParams()),
                API.getExpenses(expParams),
            ]);

            const d = dashRes.data;
            const symbol = MB.currencySymbol(d.currency_symbol);
            const hasSalary = d.has_salary;

            state.dashboard = d;
            state.currency = symbol;

            document.getElementById('no-salary-banner')?.classList.toggle('hidden', hasSalary);
            document.getElementById('dash-progress-card')?.classList.toggle('hidden', !hasSalary);
            document.getElementById('viewing-past-banner')?.classList.toggle('hidden', d.is_current_view !== false);

            const safeDailyEl = document.getElementById('dash-safe-daily');
            if (safeDailyEl) {
                const showSafe = hasSalary && d.is_current_view !== false && (d.days_left || 0) > 0;
                safeDailyEl.classList.toggle('hidden', !showSafe);
                if (showSafe) {
                    const days = d.days_left || 0;
                    safeDailyEl.textContent = `Safe to spend ${MB.formatMoney(d.daily_safe_spending, symbol)}/day for ${days} day${days === 1 ? '' : 's'}`;
                }
            }

            if (d.cycle) CycleFilter.updateHeader(d.cycle);
            this.renderInsights(d, hasSalary);
            window.App?.notifyRecurringApplied?.(d);

            const daysLabel = document.getElementById('dash-days-label');
            if (daysLabel) {
                daysLabel.textContent = d.is_current_view === false ? 'Cycle Length' : 'Day of Cycle';
            }

            const remainingEl = document.getElementById('dash-remaining');
            if (remainingEl) {
                if (remainingEl._mbAnimFrame) {
                    cancelAnimationFrame(remainingEl._mbAnimFrame);
                    remainingEl._mbAnimFrame = null;
                }
                if (!hasSalary) {
                    remainingEl.textContent = '—';
                    remainingEl.dataset.value = '0';
                } else {
                    const remaining = MB.parseAmount(d.remaining_balance);
                    remainingEl.textContent = MB.formatMoney(remaining, 'Rs.');
                    remainingEl.dataset.value = String(remaining);
                }
            }

            this.setText('dash-salary', hasSalary ? MB.formatMoney(d.cycle_salary || d.monthly_salary, 'Rs.') : '—');
            this.setText('dash-spent', hasSalary ? MB.formatMoney(d.spent, 'Rs.') : '—');
            this.setText('dash-income', hasSalary ? MB.formatMoney(d.extra_income || d.income, 'Rs.', { type: 'income' }) : '—');
            this.setText('dash-saved', hasSalary ? MB.formatMoney(d.saved, 'Rs.') : '—');
            this.setText('dash-days', hasSalary
                ? (d.is_current_view === false ? `${d.days_elapsed} days` : `Day ${d.days_elapsed}`)
                : '—');
            this.setText('dash-rem-pct', d.remaining_percent);
            this.setText('dash-spent-pct', d.spent_percent);

            const barRem = document.getElementById('dash-bar-rem');
            const barSpent = document.getElementById('dash-bar-spent');
            if (barRem) barRem.style.width = d.remaining_percent + '%';
            if (barSpent) barSpent.style.width = d.spent_percent + '%';

            state.lastExpenses = expRes.data;
            this.renderRecent(expRes.data, symbol, state);
        } catch (err) {
            Toast.show(err.message, 'error');
        }
    },

    renderRecent(expenses, symbol, state) {
        const container = document.getElementById('recent-expenses');
        if (!container) return;

        if (!expenses.length) {
            container.innerHTML = `
                <div class="text-center py-8 text-gray-400">
                    ${MB.logoImg('mb-logo-md')}
                    <p class="mt-2">Tap + to add an entry</p>
                </div>`;
            return;
        }

        const groups = MB.groupExpensesByDate(expenses);
        let html = '';

        groups.slice(0, 5).forEach(([date, items]) => {
            html += `<p class="text-sm font-semibold text-gray-500 dark:text-gray-400 mt-3 mb-2">${MB.formatDateLabel(date)}</p>`;
            items.forEach(exp => {
                html += this.expenseRow(exp, symbol);
            });
        });

        container.innerHTML = html;
        this.bindExpenseEvents(container, state);
    },

    expenseRow(exp, symbol) {
        const amt = MB.formatTransactionAmount(exp.amount, symbol, exp.type);
        const isSalary = exp.category === 'inc_salary';
        const badge = exp.type === 'income'
            ? `<span class="income-badge ml-1">${isSalary ? 'Salary' : 'Income'}</span>`
            : '';
        return `
            <div class="swipe-item relative overflow-hidden rounded-2xl" data-id="${exp.id}" data-salary="${isSalary ? '1' : '0'}">
                <div class="swipe-delete absolute right-0 top-0 bottom-0 w-20 bg-red-500 flex items-center justify-center opacity-0 transition-opacity">
                    <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </div>
                <div class="swipe-content card p-4 flex items-center gap-3 transition-transform">
                    <div class="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" data-edit="${exp.id}">
                        <span class="text-2xl">${exp.emoji}</span>
                        <div class="flex-1 min-w-0">
                            <p class="font-medium truncate">${exp.category_name}${badge}</p>
                            ${MB.entrySubtitle(exp)}
                        </div>
                        <p class="font-bold text-lg ${amt.className}">${amt.text}</p>
                    </div>
                    <button type="button" class="btn-delete p-2 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0" aria-label="Delete">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                </div>
            </div>`;
    },

    bindExpenseEvents(container, state) {
        container.querySelectorAll('.swipe-item').forEach(el => {
            MB.initSwipeDelete(el, async () => {
                const id = parseInt(el.dataset.id);
                const isSalary = el.dataset.salary === '1';
                const ok = await MB.deleteEntry(id, isSalary, state);
                if (ok) el.remove();
            });
            MB.bindRowDelete(el, state);
        });

        container.querySelectorAll('[data-edit]').forEach(el => {
            el.addEventListener('click', () => {
                App.openEditModal(parseInt(el.dataset.edit));
            });
        });
    },

    setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    },

    renderInsights(d, hasSalary) {
        const insights = d.insights || {};

        const streakBadge = document.getElementById('dash-streak-badge');
        if (streakBadge) {
            const streak = insights.logging_streak || 0;
            streakBadge.classList.toggle('hidden', streak < 2);
            streakBadge.classList.toggle('flex', streak >= 2);
            this.setText('dash-streak-count', String(streak));
        }

        const storyEl = document.getElementById('dash-story');
        if (storyEl) {
            const show = hasSalary && d.is_current_view !== false && !!insights.story;
            storyEl.classList.toggle('hidden', !show);
            if (show) storyEl.textContent = insights.story;
        }

        const healthRow = document.getElementById('dash-health-row');
        if (healthRow) {
            const show = hasSalary && d.is_current_view !== false;
            healthRow.classList.toggle('hidden', !show);
            healthRow.classList.toggle('flex', show);
            if (show) {
                const score = insights.health_score ?? 50;
                const bar = document.getElementById('dash-health-bar');
                if (bar) {
                    bar.style.width = `${Math.max(4, score)}%`;
                    bar.style.background = score >= 70
                        ? '#22c55e'
                        : score >= 40 ? '#f59e0b' : '#ef4444';
                }
                const paceLabels = {
                    fast: '⚡ Spending fast',
                    slow: '🐢 Spending slow',
                    over: '⚠️ Over budget',
                    ok: '✅ On pace',
                };
                this.setText('dash-pace-label', paceLabels[insights.pace_status] || '');
            }
        }

        this.renderAchievements(insights, hasSalary && d.is_current_view !== false);
        this.renderCycleStoryCard(d, hasSalary);
        window.App?.checkPaceAlert?.(d);
        window.App?.checkAchievements?.(insights);
    },

    renderAchievements(insights, show) {
        const row = document.getElementById('dash-achievements');
        if (!row) return;
        if (!show) {
            row.classList.add('hidden');
            row.classList.remove('flex');
            return;
        }
        const badges = [];
        const streak = insights.logging_streak || 0;
        if (streak >= 3) badges.push({ id: 'streak3', label: '🔥 3-day streak' });
        if (streak >= 7) badges.push({ id: 'streak7', label: '🔥 Week warrior' });
        if (streak >= 30) badges.push({ id: 'streak30', label: '🏆 Month master' });
        if ((insights.salary_utilization || 0) > 0 && (insights.salary_utilization || 0) < 70 && insights.pace_status === 'slow') {
            badges.push({ id: 'saver', label: '🐷 Careful spender' });
        }
        if ((insights.health_score || 0) >= 80) {
            badges.push({ id: 'healthy', label: '💚 Healthy pace' });
        }
        if (!badges.length) {
            row.classList.add('hidden');
            row.classList.remove('flex');
            return;
        }
        row.classList.remove('hidden');
        row.classList.add('flex');
        row.innerHTML = badges.slice(0, 4).map((b) =>
            `<span class="achievement-chip" data-achievement="${b.id}">${b.label}</span>`
        ).join('');
    },

    async renderCycleStoryCard(d, hasSalary) {
        const card = document.getElementById('dash-cycle-story');
        if (!card || !hasSalary || d.is_current_view === false) {
            card?.classList.add('hidden');
            return;
        }

        const currentStart = d.cycle_start || d.cycle?.start;
        if (!currentStart) {
            card.classList.add('hidden');
            return;
        }
        if (localStorage.getItem('mb_cycle_story_dismissed') === currentStart) {
            card.classList.add('hidden');
            return;
        }

        // Show wrap only once per new cycle (when a previous cycle exists)
        try {
            const cyclesRes = await API.getCycles();
            const cycles = cyclesRes.data || [];
            if (cycles.length < 2) {
                card.classList.add('hidden');
                return;
            }
            const previous = cycles.find((c) => c.start && c.start !== currentStart);
            if (!previous) {
                card.classList.add('hidden');
                return;
            }

            const symbol = MB.currencySymbol(d.currency_symbol);
            const title = document.getElementById('dash-cycle-story-title');
            const body = document.getElementById('dash-cycle-story-body');
            if (title) title.textContent = `Last cycle · ${previous.month_label || previous.label || previous.start}`;
            if (body) {
                body.textContent = `Spent ${MB.formatMoney(previous.spent || 0, symbol)} · Saved ${MB.formatMoney(previous.saved || 0, symbol)}. New cycle is live — keep logging!`;
            }
            card.classList.remove('hidden');
        } catch (e) {
            card.classList.add('hidden');
        }
    },

    async refresh(state) {
        await CycleFilter.loadCycles(true);
        const mount = document.getElementById('cycle-filter-mount');
        if (mount) {
            CycleFilter.renderStrip(mount, state, () => this.loadData(state));
        }
        await this.loadData(state);
    },
};

window.DashboardPage = DashboardPage;

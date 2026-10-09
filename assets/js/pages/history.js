/**
 * History page - full expense list grouped by date
 */

const HistoryPage = {
    showAllTime: false,

    async render(container, state) {
        container.innerHTML = `
            <div class="animate-fade-in space-y-4">
                <div id="cycle-filter-mount"></div>

                <div class="flex items-center justify-between gap-2">
                    <p id="history-scope-label" class="text-sm font-semibold text-bunny-800 dark:text-bunny-300">This cycle</p>
                    <button type="button" id="history-all-toggle" class="text-xs font-medium px-3 py-1.5 rounded-xl bg-bunny-100 dark:bg-bunny-900/40 text-bunny-700 dark:text-bunny-300">
                        Show all time
                    </button>
                </div>

                <div id="history-list" class="space-y-2">
                    <div class="flex justify-center py-12">
                        <div class="animate-pulse text-bunny-500">Loading...</div>
                    </div>
                </div>
            </div>
        `;

        CycleFilter.bindHeaderOpener('#cycle-filter-mount');
        await CycleFilter.mount(
            document.getElementById('cycle-filter-mount'),
            state,
            () => this.load(state)
        );

        document.getElementById('history-all-toggle')?.addEventListener('click', () => {
            this.showAllTime = !this.showAllTime;
            MB.haptic();
            this.updateScopeLabel();
            this.load(state);
        });

        this.updateScopeLabel();
        await this.load(state);
    },

    updateScopeLabel() {
        const label = document.getElementById('history-scope-label');
        const toggle = document.getElementById('history-all-toggle');
        if (label) {
            label.textContent = this.showAllTime ? 'All time' : 'This cycle';
        }
        if (toggle) {
            toggle.textContent = this.showAllTime ? 'This cycle only' : 'Show all time';
        }
    },

    async load(state) {
        try {
            const params = { limit: 200 };
            if (!this.showAllTime) {
                Object.assign(params, CycleFilter.apiParams());
                if (!CycleFilter.getSelected()) params.cycle = 'current';
            }
            const res = await API.getExpenses(params);
            if (res.from_cache) {
                Toast.show('Showing cached data — offline', 'info', 2000);
            }
            state.lastExpenses = res.data;
            const symbol = MB.currencySymbol(state.currency || res.data[0]?.currency_symbol);
            this.renderList(res.data, symbol, state);
        } catch (err) {
            Toast.show(err.message, 'error');
        }
    },

    renderList(expenses, symbol, state) {
        const container = document.getElementById('history-list');
        if (!container) return;

        if (!expenses.length) {
            container.innerHTML = `
                <div class="text-center py-16 text-gray-400">
                    <span class="text-4xl">📋</span>
                    <p class="mt-3">${this.showAllTime ? 'No entries yet' : 'No entries this cycle'}</p>
                </div>`;
            return;
        }

        const groups = MB.groupExpensesByDate(expenses);
        let html = '';

        groups.forEach(([date, items]) => {
            const dayNet = items.reduce((s, e) => {
                return s + (e.type === 'income' ? e.amount : -e.amount);
            }, 0);
            const dayLabel = dayNet >= 0
                ? MB.formatMoney(dayNet, symbol, dayNet > 0 ? { type: 'income' } : {})
                : '-' + MB.formatMoney(Math.abs(dayNet), symbol);
            html += `
                <div class="mb-4">
                    <div class="flex justify-between items-center mb-2 px-1">
                        <p class="text-sm font-semibold text-gray-500 dark:text-gray-400">${MB.formatDateLabel(date)}</p>
                        <p class="text-sm font-medium ${dayNet >= 0 ? 'text-bunny-600' : 'text-orange-500'}">${dayLabel}</p>
                    </div>`;
            items.forEach(exp => {
                const amt = MB.formatTransactionAmount(exp.amount, symbol, exp.type);
                const badge = exp.type === 'income' ? ' <span class="income-badge">Income</span>' : '';
                html += `
                    <div class="swipe-item relative overflow-hidden rounded-2xl mb-2" data-id="${exp.id}" data-salary="${exp.category === 'inc_salary' ? '1' : '0'}">
                        <div class="swipe-delete absolute right-0 top-0 bottom-0 w-20 bg-red-500 flex items-center justify-center opacity-0 transition-opacity">
                            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </div>
                        <div class="swipe-content card p-4 flex items-center gap-3 transition-transform">
                            <div class="flex items-center gap-3 flex-1 cursor-pointer" data-edit="${exp.id}">
                                <span class="text-2xl">${exp.emoji}</span>
                                <div class="flex-1 min-w-0">
                                    <p class="font-medium truncate">${exp.category_name}${badge}</p>
                                    ${MB.entrySubtitle(exp, { showDate: !exp.note })}
                                </div>
                                <p class="font-bold text-lg ${amt.className}">${amt.text}</p>
                            </div>
                            <button type="button" class="btn-delete p-2 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0" aria-label="Delete">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                            </button>
                        </div>
                    </div>`;
            });
            html += '</div>';
        });

        container.innerHTML = html;

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

    async refresh(state) {
        await CycleFilter.loadCycles(true);
        const mount = document.getElementById('cycle-filter-mount');
        if (mount) {
            CycleFilter.renderStrip(mount, state, () => this.load(state));
        }
        await this.load(state);
    },
};

window.HistoryPage = HistoryPage;

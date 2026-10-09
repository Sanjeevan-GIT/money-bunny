/**
 * Statistics page - charts and spending summaries
 */

const StatisticsPage = {
    async render(container, state) {
        container.innerHTML = `
            <div class="animate-fade-in space-y-4">
                <div id="cycle-filter-mount"></div>

                <div id="stat-past-banner" class="hidden card p-3 text-sm text-center bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200">
                    Past cycle view — Today / This Week hidden; cycle stats below match the selected salary period
                </div>

                <!-- Insights: story, utilization, weekend vs weekday, top drains -->
                <div class="card p-4" id="stat-insights-card">
                    <p id="stat-story" class="hidden text-sm font-semibold text-bunny-800 dark:text-bunny-300 mb-3"></p>

                    <div class="mb-3">
                        <div class="flex justify-between text-xs mb-1.5">
                            <span class="text-gray-500 dark:text-gray-400">Salary used</span>
                            <span id="stat-utilization-pct" class="font-semibold">0%</span>
                        </div>
                        <div class="h-2 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
                            <div id="stat-utilization-bar" class="h-full rounded-full bg-bunny-500 transition-all duration-500" style="width: 0%"></div>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-3 mb-3" id="stat-weekend-row">
                        <div>
                            <p class="text-xs text-gray-500 dark:text-gray-400">📅 Weekday spend</p>
                            <p id="stat-weekday-spent" class="font-bold">—</p>
                        </div>
                        <div>
                            <p class="text-xs text-gray-500 dark:text-gray-400">🎉 Weekend spend</p>
                            <p id="stat-weekend-spent" class="font-bold">—</p>
                        </div>
                    </div>

                    <div id="stat-top-drains" class="flex flex-wrap gap-2"></div>
                </div>

                <div class="card p-4 bg-bunny-50 dark:bg-bunny-900/20 border-bunny-200 dark:border-bunny-800" id="week-summary-card">
                    <p class="text-sm font-semibold text-bunny-800 dark:text-bunny-300 mb-1">📊 This Week</p>
                    <p id="week-summary-text" class="text-sm text-gray-600 dark:text-gray-300">—</p>
                </div>

                <div class="grid grid-cols-1 gap-3" id="stat-quick-cards">
                    <div class="card p-4 flex justify-between items-center">
                        <div>
                            <p class="text-xs text-gray-500">Today</p>
                            <p id="stat-today" class="text-xl font-bold">—</p>
                        </div>
                        <span class="text-2xl">☀️</span>
                    </div>
                    <div class="card p-4 flex justify-between items-center">
                        <div>
                            <p class="text-xs text-gray-500">This Week</p>
                            <p id="stat-week" class="text-xl font-bold">—</p>
                        </div>
                        <span class="text-2xl">📅</span>
                    </div>
                    <div class="card p-4 flex justify-between items-center">
                        <div>
                            <p class="text-xs text-gray-500">Cycle Spent</p>
                            <p id="stat-cycle" class="text-xl font-bold text-orange-600 dark:text-orange-400">—</p>
                        </div>
                        <span class="text-2xl">💸</span>
                    </div>
                    <div class="card p-4 flex justify-between items-center">
                        <div>
                            <p class="text-xs text-gray-500">Cycle Saved</p>
                            <p id="stat-saved" class="text-xl font-bold text-bunny-600 dark:text-bunny-400">—</p>
                        </div>
                        <span class="text-2xl">🐷</span>
                    </div>
                    <div class="card p-4 flex justify-between items-center">
                        <div>
                            <p class="text-xs text-gray-500">Cycle Salary</p>
                            <p id="stat-salary" class="text-xl font-bold">—</p>
                        </div>
                        <span class="text-2xl">💵</span>
                    </div>
                </div>

                <div class="card p-4" id="top-category-card">
                    <p class="text-sm font-semibold mb-2">Top Category</p>
                    <div id="top-category" class="flex items-center gap-3">
                        <span class="text-3xl">—</span>
                        <div>
                            <p class="font-bold" id="top-cat-name">—</p>
                            <p class="text-sm text-gray-500" id="top-cat-amount">—</p>
                        </div>
                    </div>
                </div>

                <div class="card p-4">
                    <p class="text-sm font-semibold mb-3">By Category</p>
                    <div class="flex flex-col items-center">
                        <canvas id="pie-chart" width="200" height="200"></canvas>
                    </div>
                    <div id="category-legend" class="mt-4 space-y-2"></div>
                </div>

                <div class="card p-4">
                    <p class="text-sm font-semibold mb-3">Daily Spending (Cycle)</p>
                    <canvas id="bar-chart" class="w-full"></canvas>
                </div>

                <div class="card p-4" id="stat-last7-card">
                    <button type="button" id="stat-last7-toggle" class="w-full flex items-center justify-between text-sm font-semibold" aria-expanded="false" aria-controls="stat-last7-body">
                        <span>Last 7 Days</span>
                        <svg id="stat-last7-chevron" class="dash-details-chevron transition-transform" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                    </button>
                    <div id="stat-last7-body" class="hidden mt-3">
                        <canvas id="bar-chart-7" class="w-full"></canvas>
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

        document.getElementById('stat-last7-toggle')?.addEventListener('click', () => {
            const body = document.getElementById('stat-last7-body');
            const chevron = document.getElementById('stat-last7-chevron');
            const toggle = document.getElementById('stat-last7-toggle');
            const nowHidden = body?.classList.toggle('hidden');
            toggle?.setAttribute('aria-expanded', nowHidden ? 'false' : 'true');
            chevron?.classList.toggle('rotate-180', !nowHidden);
            if (!nowHidden && this._last7Data) {
                const bar7 = document.getElementById('bar-chart-7');
                if (bar7) Charts.drawBars(bar7, this._last7Data);
            }
        });

        await this.load(state);
    },

    setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    },

    renderStatInsights(d, symbol) {
        const insights = d.insights || {};

        const storyEl = document.getElementById('stat-story');
        if (storyEl) {
            const show = !!insights.story;
            storyEl.classList.toggle('hidden', !show);
            if (show) storyEl.textContent = insights.story;
        }

        const utilPct = insights.salary_utilization || 0;
        this.setText('stat-utilization-pct', `${utilPct}%`);
        const utilBar = document.getElementById('stat-utilization-bar');
        if (utilBar) {
            utilBar.style.width = `${Math.min(100, utilPct)}%`;
            utilBar.style.backgroundColor = utilPct > 90 ? '#ef4444' : utilPct > 70 ? '#f59e0b' : '';
        }

        this.setText('stat-weekday-spent', MB.formatMoney(insights.weekday_spent || 0, symbol));
        this.setText('stat-weekend-spent', MB.formatMoney(insights.weekend_spent || 0, symbol));

        const drainsEl = document.getElementById('stat-top-drains');
        if (drainsEl) {
            const drains = insights.top_drains || [];
            drainsEl.innerHTML = drains.length
                ? drains.map(t => `<span class="insight-chip">${t.emoji} ${t.name} · ${MB.formatMoney(t.total, symbol)}</span>`).join('')
                : '<span class="text-sm text-gray-400">No spending yet this cycle</span>';
        }

        document.getElementById('stat-insights-card')?.classList.toggle('hidden', !d.cycle_salary);
    },

    async load(state) {
        try {
            const res = await API.getStatistics(CycleFilter.apiParams());
            const d = res.data;
            const symbol = MB.currencySymbol(d.currency_symbol);
            state.currency = symbol;

            const isPast = d.is_current_view === false;
            document.getElementById('stat-past-banner')?.classList.toggle('hidden', !isPast);
            document.getElementById('week-summary-card')?.classList.toggle('hidden', isPast);
            document.getElementById('stat-quick-cards')?.querySelectorAll('.card').forEach((card, i) => {
                if (i < 2) card.classList.toggle('opacity-50', isPast);
            });
            document.getElementById('stat-last7-card')?.classList.toggle('hidden', isPast);

            if (d.cycle) CycleFilter.updateHeader(d.cycle);
            this.renderStatInsights(d, symbol);

            const weekSummary = document.getElementById('week-summary-text');
            if (weekSummary && !isPast) {
                if ((d.this_week || 0) > 0) {
                    const top = d.week_top_category;
                    const topPart = top
                        ? ` · Top: ${top.emoji} ${top.name} (${MB.formatMoney(top.total, symbol)})`
                        : '';
                    weekSummary.textContent = `You spent ${MB.formatMoney(d.this_week, symbol)} this week${topPart}`;
                } else {
                    weekSummary.textContent = 'No spending recorded this week yet';
                }
            }

            document.getElementById('stat-today').textContent = isPast ? '—' : MB.formatMoney(d.today, symbol);
            document.getElementById('stat-week').textContent = isPast ? '—' : MB.formatMoney(d.this_week, symbol);
            document.getElementById('stat-cycle').textContent = MB.formatMoney(d.current_cycle, symbol);
            document.getElementById('stat-saved').textContent = MB.formatMoney(d.cycle_saved || 0, symbol);
            document.getElementById('stat-salary').textContent = d.cycle_salary
                ? MB.formatMoney(d.cycle_salary, symbol)
                : '—';

            if (d.top_category) {
                document.getElementById('top-category').innerHTML = `
                    <span class="text-3xl">${d.top_category.emoji}</span>
                    <div>
                        <p class="font-bold">${d.top_category.name}</p>
                        <p class="text-sm text-gray-500">${MB.formatMoney(d.top_category.total, symbol)} (${d.top_category.percent}%)</p>
                    </div>`;
            } else {
                document.getElementById('top-category').innerHTML = `
                    <span class="text-3xl">—</span>
                    <div>
                        <p class="font-bold">—</p>
                        <p class="text-sm text-gray-500">No expenses this cycle</p>
                    </div>`;
            }

            const pieCanvas = document.getElementById('pie-chart');
            if (pieCanvas && d.by_category.length) {
                Charts.drawPie(pieCanvas, d.by_category);
            }

            const legend = document.getElementById('category-legend');
            if (legend) {
                legend.innerHTML = d.by_category.length
                    ? d.by_category.map((c, i) => {
                        const color = Charts.colorForCategory(c.category, i);
                        return `
                        <div class="flex justify-between text-sm items-center gap-2">
                            <span class="flex items-center gap-2 min-w-0">
                                <span class="chart-legend-dot" style="background-color:${color}"></span>
                                <span>${c.emoji} ${c.name}</span>
                            </span>
                            <span class="font-medium shrink-0">${MB.formatMoney(c.total, symbol)} (${c.percent}%)</span>
                        </div>`;
                    }).join('')
                    : '<p class="text-sm text-gray-500 text-center py-2">No spending in this cycle</p>';
            }

            const barCanvas = document.getElementById('bar-chart');
            if (barCanvas) Charts.drawBars(barCanvas, d.daily_spending);

            this._last7Data = d.last_7_days;
            const last7Body = document.getElementById('stat-last7-body');
            if (last7Body && !last7Body.classList.contains('hidden')) {
                const bar7 = document.getElementById('bar-chart-7');
                if (bar7 && !isPast) Charts.drawBars(bar7, d.last_7_days);
            }
        } catch (err) {
            Toast.show(err.message, 'error');
        }
    },
};

window.StatisticsPage = StatisticsPage;

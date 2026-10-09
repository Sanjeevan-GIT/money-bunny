/**
 * Money Bunny - Salary cycle filter (browse past budget cycles)
 */

const CycleFilter = {
    STORAGE_KEY: 'mb_cycle_start',
    cycles: [],
    currentStart: null,

    getSelected() {
        return sessionStorage.getItem(this.STORAGE_KEY) || null;
    },

    setSelected(start) {
        if (start) sessionStorage.setItem(this.STORAGE_KEY, start);
        else sessionStorage.removeItem(this.STORAGE_KEY);
    },

    apiParams() {
        const start = this.getSelected();
        return start ? { cycle_start: start } : {};
    },

    effectiveStart() {
        return this.getSelected() || this.currentStart || null;
    },

    async loadCycles(force = false) {
        if (this.cycles.length && !force) return this.cycles;
        const res = await API.getCycles();
        this.cycles = res.data || [];
        this.currentStart = res.current_start || null;
        return this.cycles;
    },

    findCycle(start) {
        if (!start) {
            return this.cycles.find(c => c.start === this.currentStart) || this.cycles[0] || null;
        }
        return this.cycles.find(c => c.start === start) || null;
    },

    formatCycleLabel(cycle) {
        if (!cycle?.has_salary) return 'No salary cycle';
        const live = cycle.is_open ? ' · Live' : '';
        return `${cycle.start_display} → ${cycle.end_display}${live}`;
    },

    updateHeader(cycle) {
        const btn = document.getElementById('cycle-label-btn');
        const text = document.getElementById('cycle-label-text');
        if (!btn || !text) return;

        if (!cycle?.has_salary) {
            text.textContent = 'No active cycle — add salary to start';
            btn.disabled = true;
            btn.classList.add('opacity-60');
            return;
        }

        btn.disabled = false;
        btn.classList.remove('opacity-60');
        text.textContent = this.formatCycleLabel(cycle);
    },

    statusTone(cycle) {
        if (!cycle?.has_salary) return 'neutral';
        const pct = Number(cycle.spent_percent) || 0;
        if (pct >= 90) return 'danger';
        if (pct >= 70) return 'warn';
        return 'good';
    },

    renderStrip(container, state, onChange) {
        if (!container) return;

        const selected = this.effectiveStart();
        const symbol = MB.currencySymbol(state.currency || 'Rs.');

        if (!this.cycles.length) {
            container.innerHTML = `
                <div class="cycle-filter-empty card p-4 text-center text-sm text-gray-500">
                    Add your first <strong>Salary</strong> income to start tracking cycles
                </div>`;
            return;
        }

        container.innerHTML = `
            <div class="cycle-filter-wrap">
                <div class="flex items-center justify-between mb-2 px-0.5">
                    <p class="text-sm font-semibold text-bunny-800 dark:text-bunny-300">Salary cycles</p>
                    <button type="button" id="cycle-filter-reset" class="text-xs font-medium text-bunny-600 dark:text-bunny-400 ${selected === this.currentStart ? 'hidden' : ''}">
                        Back to live
                    </button>
                </div>
                <div class="cycle-filter-scroll" id="cycle-filter-scroll">
                    ${this.cycles.map(cycle => this.renderChip(cycle, selected, symbol)).join('')}
                </div>
            </div>`;

        container.querySelectorAll('[data-cycle-start]').forEach(btn => {
            btn.addEventListener('click', () => {
                const start = btn.dataset.cycleStart;
                if (this.getSelected() === start || start === this.currentStart) {
                    this.setSelected(null);
                } else {
                    this.setSelected(start);
                }
                MB.haptic();
                if (typeof onChange === 'function') onChange();
            });
        });

        document.getElementById('cycle-filter-reset')?.addEventListener('click', () => {
            this.setSelected(null);
            MB.haptic();
            if (typeof onChange === 'function') onChange();
        });

        this.scrollToSelected(container, selected);
    },

    renderChip(cycle, selected, symbol) {
        const isActive = cycle.start === selected;
        const tone = this.statusTone(cycle);
        const spent = MB.formatMoney(cycle.spent || 0, symbol);
        const saved = MB.formatMoney(cycle.saved || 0, symbol);
        const liveBadge = cycle.is_open
            ? '<span class="cycle-chip-live">Live</span>'
            : '';

        return `
            <button type="button"
                data-cycle-start="${cycle.start}"
                class="cycle-chip ${isActive ? 'cycle-chip-active' : ''} cycle-chip-${tone}"
                aria-pressed="${isActive ? 'true' : 'false'}">
                <div class="flex items-center justify-between gap-2 mb-1">
                    <span class="cycle-chip-month">${cycle.month_label}</span>
                    ${liveBadge}
                </div>
                <p class="cycle-chip-range">${cycle.start_display} → ${cycle.end_display}</p>
                <div class="cycle-chip-stats">
                    <span class="text-orange-500 dark:text-orange-400">Spent ${spent}</span>
                    <span class="text-bunny-600 dark:text-bunny-400">Saved ${saved}</span>
                </div>
                <div class="cycle-chip-bar" aria-hidden="true">
                    <span style="width:${Math.min(100, cycle.spent_percent || 0)}%"></span>
                </div>
            </button>`;
    },

    scrollToSelected(container, selected) {
        const scroller = container.querySelector('#cycle-filter-scroll');
        const active = scroller?.querySelector('.cycle-chip-active');
        if (scroller && active) {
            const left = active.offsetLeft - 12;
            scroller.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
        }
    },

    bindHeaderOpener(containerSelector) {
        document.getElementById('cycle-label-btn')?.addEventListener('click', () => {
            const mount = document.querySelector(containerSelector);
            if (mount) {
                mount.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                mount.classList.add('cycle-filter-highlight');
                setTimeout(() => mount.classList.remove('cycle-filter-highlight'), 900);
            }
        });
    },

    async mount(container, state, onChange) {
        await this.loadCycles(true);
        this.renderStrip(container, state, onChange);
        const cycle = this.findCycle(this.effectiveStart());
        if (cycle) this.updateHeader(cycle);
    },
};

window.CycleFilter = CycleFilter;

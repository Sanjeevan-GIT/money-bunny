/**
 * Calendar page - spending highlights by day
 */

const CalendarPage = {
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    selectedDate: null,

    async render(container, state) {
        this.year = new Date().getFullYear();
        this.month = new Date().getMonth() + 1;
        this.selectedDate = null;

        container.innerHTML = `
            <div class="animate-fade-in space-y-4">
                <div class="flex items-center justify-between">
                    <button id="cal-prev" class="p-3 rounded-xl bg-white dark:bg-gray-900 shadow-sm active:scale-95">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
                    </button>
                    <h2 id="cal-title" class="text-lg font-bold"></h2>
                    <button id="cal-next" class="p-3 rounded-xl bg-white dark:bg-gray-900 shadow-sm active:scale-95">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
                    </button>
                </div>

                <div class="card p-3">
                    <div class="grid grid-cols-7 gap-1 text-center text-xs text-gray-400 mb-2">
                        <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
                    </div>
                    <div id="cal-grid" class="grid grid-cols-7 gap-1"></div>
                </div>

                <div id="cal-day-detail" class="hidden">
                    <h3 id="cal-day-title" class="font-bold mb-3"></h3>
                    <div id="cal-day-expenses" class="space-y-2"></div>
                </div>
            </div>
        `;

        document.getElementById('cal-prev')?.addEventListener('click', () => {
            this.month--;
            if (this.month < 1) { this.month = 12; this.year--; }
            this.load(state);
        });

        document.getElementById('cal-next')?.addEventListener('click', () => {
            this.month++;
            if (this.month > 12) { this.month = 1; this.year++; }
            this.load(state);
        });

        await this.load(state);
    },

    async load(state) {
        const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        document.getElementById('cal-title').textContent = `${monthNames[this.month - 1]} ${this.year}`;

        try {
            const res = await API.getCalendar(this.year, this.month);
            this.renderGrid(res.data.days);
        } catch (err) {
            Toast.show(err.message, 'error');
        }
    },

    renderGrid(days) {
        const grid = document.getElementById('cal-grid');
        if (!grid) return;

        const firstDay = new Date(this.year, this.month - 1, 1).getDay();
        const daysInMonth = new Date(this.year, this.month, 0).getDate();
        const today = MB.todayLocal();

        let html = '';

        // Empty cells before first day
        for (let i = 0; i < firstDay; i++) {
            html += '<div></div>';
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${this.year}-${String(this.month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayData = days[dateStr];
            const hasSpending = dayData && dayData.total > 0;
            const isToday = dateStr === today;
            const isSelected = dateStr === this.selectedDate;

            html += `
                <button data-date="${dateStr}" class="cal-day aspect-square rounded-xl flex flex-col items-center justify-center text-sm transition-all active:scale-95
                    ${isToday ? 'ring-2 ring-bunny-500' : ''}
                    ${isSelected ? 'bg-bunny-500 text-white' : hasSpending ? 'bg-bunny-200 dark:bg-bunny-900/50 text-bunny-800 dark:text-bunny-300' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}
                ">
                    <span class="font-medium">${d}</span>
                    ${hasSpending ? `<span class="text-[10px] opacity-70">${MB.parseAmount(dayData.total).toFixed(2)}</span>` : ''}
                </button>`;
        }

        grid.innerHTML = html;

        const appState = App.state;
        grid.querySelectorAll('.cal-day').forEach(btn => {
            btn.addEventListener('click', () => this.selectDay(btn.dataset.date, appState));
        });
    },

    async selectDay(dateStr, state) {
        this.selectedDate = dateStr;
        await this.load(state);

        try {
            const res = await API.getCalendar(this.year, this.month, dateStr);
            const detail = document.getElementById('cal-day-detail');
            const title = document.getElementById('cal-day-title');
            const list = document.getElementById('cal-day-expenses');
            const symbol = MB.currencySymbol(state.currency);

            detail.classList.remove('hidden');
            title.textContent = MB.formatDateLabel(dateStr);

            const expenses = res.data.expenses || [];
            if (!expenses.length) {
                list.innerHTML = '<p class="text-gray-400 text-sm">No expenses this day</p>';
                return;
            }

            list.innerHTML = expenses.map(exp => `
                <div class="card p-3 flex items-center gap-3 cursor-pointer" data-edit="${exp.id}">
                    <span class="text-xl">${exp.emoji}</span>
                    <span class="flex-1 font-medium">${exp.category_name}</span>
                    <span class="font-bold">${MB.formatMoney(exp.amount, symbol)}</span>
                </div>
            `).join('');

            list.querySelectorAll('[data-edit]').forEach(el => {
                el.addEventListener('click', () => App.openEditModal(parseInt(el.dataset.edit)));
            });
        } catch (err) {
            Toast.show(err.message, 'error');
        }
    },
};

window.CalendarPage = CalendarPage;

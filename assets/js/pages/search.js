/**
 * Search page - find expenses by amount, category, date
 */

const SearchPage = {
    async render(container, state) {
        container.innerHTML = `
            <div class="animate-fade-in space-y-4">
                <div class="relative">
                    <input type="search" id="search-input" class="input-field pl-10 text-lg" placeholder="Search amount, category, date..." autofocus>
                    <svg class="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                </div>

                <div class="flex gap-2 flex-wrap" id="search-filters">
                    <select id="filter-category" class="input-field text-sm flex-1 min-w-[120px]">
                        <option value="">All Categories</option>
                    </select>
                    <input type="date" id="filter-from" class="input-field text-sm">
                    <input type="date" id="filter-to" class="input-field text-sm">
                </div>

                <p id="search-count" class="text-sm text-gray-400"></p>
                <div id="search-results" class="space-y-2"></div>
            </div>
        `;

        await this.loadCategories();
        this.bindSearch(state);
    },

    async loadCategories() {
        try {
            const res = await API.getCategories();
            const select = document.getElementById('filter-category');
            if (select) {
                select.innerHTML = '<option value="">All Categories</option>' +
                    res.data.map(c => `<option value="${c.slug}">${c.emoji} ${c.name}</option>`).join('');
            }
        } catch (err) { /* silent */ }
    },

    bindSearch(state) {
        const input = document.getElementById('search-input');
        const category = document.getElementById('filter-category');
        const from = document.getElementById('filter-from');
        const to = document.getElementById('filter-to');

        const doSearch = MB.debounce(async () => {
            const params = {};
            const q = input.value.trim();
            if (q) params.q = q;
            if (category.value) params.category = category.value;
            if (from.value) params.date_from = from.value;
            if (to.value) params.date_to = to.value;

            if (!q && !category.value && !from.value && !to.value) {
                document.getElementById('search-results').innerHTML = '';
                document.getElementById('search-count').textContent = '';
                return;
            }

            try {
                const res = await API.search(params);
                const symbol = MB.currencySymbol(state.currency);
                document.getElementById('search-count').textContent = `${res.count} result${res.count !== 1 ? 's' : ''}`;

                const container = document.getElementById('search-results');
                if (!res.data.length) {
                    container.innerHTML = '<p class="text-center py-8 text-gray-400">No matches found</p>';
                    return;
                }

                container.innerHTML = res.data.map(exp => `
                    <div class="card p-4 flex items-center gap-3 cursor-pointer" data-edit="${exp.id}">
                        <span class="text-2xl">${exp.emoji}</span>
                        <div class="flex-1 min-w-0">
                            <p class="font-medium truncate">${exp.category_name}</p>
                            ${MB.entrySubtitle(exp, { showDate: !exp.note })}
                        </div>
                        <p class="font-bold">${MB.formatMoney(exp.amount, symbol)}</p>
                    </div>
                `).join('');

                container.querySelectorAll('[data-edit]').forEach(el => {
                    el.addEventListener('click', () => App.openEditModal(parseInt(el.dataset.edit)));
                });
            } catch (err) {
                Toast.show(err.message, 'error');
            }
        }, 300);

        input.addEventListener('input', doSearch);
        category.addEventListener('change', doSearch);
        from.addEventListener('change', doSearch);
        to.addEventListener('change', doSearch);
    },
};

window.SearchPage = SearchPage;

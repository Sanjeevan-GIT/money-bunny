/**
 * Money Bunny - Canvas charts (no external libraries)
 */

const Charts = {
    /** Distinct colors — one per expense category where possible */
    CATEGORY_COLORS: {
        food: '#f97316',
        transport: '#3b82f6',
        grocery: '#eab308',
        entertainment: '#a855f7',
        bills: '#ef4444',
        shopping: '#ec4899',
        health: '#14b8a6',
        mobile: '#6366f1',
        loan: '#64748b',
        bank_fees: '#78716c',
        family: '#f472b6',
        personal: '#0ea5e9',
        other: '#9ca3af',
        coffee: '#92400e',
    },

    /** Fallback palette when slug is unknown */
    PALETTE: [
        '#f97316', '#3b82f6', '#eab308', '#a855f7', '#ef4444',
        '#ec4899', '#14b8a6', '#6366f1', '#06b6d4', '#84cc16',
        '#64748b', '#78716c',
    ],

    colorForCategory(slug, index = 0) {
        if (slug && this.CATEGORY_COLORS[slug]) {
            return this.CATEGORY_COLORS[slug];
        }
        return this.PALETTE[index % this.PALETTE.length];
    },

    darkenHex(hex, factor = 0.82) {
        const n = parseInt(hex.replace('#', ''), 16);
        if (Number.isNaN(n)) return hex;
        const r = Math.max(0, Math.floor(((n >> 16) & 255) * factor));
        const g = Math.max(0, Math.floor(((n >> 8) & 255) * factor));
        const b = Math.max(0, Math.floor((n & 255) * factor));
        return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    },

    /** Draw pie chart for category breakdown */
    drawPie(canvas, data, options = {}) {
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const size = options.size || 200;
        canvas.width = size * dpr;
        canvas.height = size * dpr;
        canvas.style.width = size + 'px';
        canvas.style.height = size + 'px';
        ctx.scale(dpr, dpr);

        const total = data.reduce((s, d) => s + d.total, 0);
        if (total === 0) {
            ctx.fillStyle = '#e5e7eb';
            ctx.beginPath();
            ctx.arc(size / 2, size / 2, size / 2 - 10, 0, Math.PI * 2);
            ctx.fill();
            return;
        }

        let startAngle = -Math.PI / 2;
        const cx = size / 2;
        const cy = size / 2;
        const radius = size / 2 - 10;

        data.forEach((item, i) => {
            const slice = (item.total / total) * Math.PI * 2;
            ctx.fillStyle = this.colorForCategory(item.category, i);
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, radius, startAngle, startAngle + slice);
            ctx.closePath();
            ctx.fill();
            startAngle += slice;
        });

        // Donut hole
        ctx.fillStyle = document.documentElement.classList.contains('dark') ? '#030712' : '#f0fdf4';
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 0.55, 0, Math.PI * 2);
        ctx.fill();
    },

    /** Draw bar chart for daily spending */
    drawBars(canvas, data, options = {}) {
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const width = options.width || canvas.parentElement?.clientWidth || 320;
        const height = options.height || 160;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.scale(dpr, dpr);

        const isDark = document.documentElement.classList.contains('dark');
        ctx.clearRect(0, 0, width, height);

        if (!data.length) {
            ctx.fillStyle = isDark ? '#6b7280' : '#9ca3af';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('No data yet', width / 2, height / 2);
            return;
        }

        const padding = { top: 10, bottom: 30, left: 10, right: 10 };
        const chartW = width - padding.left - padding.right;
        const chartH = height - padding.top - padding.bottom;
        const maxVal = Math.max(...data.map(d => d.total), 1);
        const barWidth = Math.max(4, chartW / data.length - 4);
        const gap = (chartW - barWidth * data.length) / (data.length + 1);

        data.forEach((item, i) => {
            const barH = (item.total / maxVal) * chartH;
            const x = padding.left + gap + i * (barWidth + gap);
            const y = padding.top + chartH - barH;

            const base = this.PALETTE[i % this.PALETTE.length];
            const gradient = ctx.createLinearGradient(0, y, 0, y + barH);
            gradient.addColorStop(0, base);
            gradient.addColorStop(1, this.darkenHex(base, 0.78));
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.roundRect(x, y, barWidth, barH, [4, 4, 0, 0]);
            ctx.fill();

            if (data.length <= 14 || i % Math.ceil(data.length / 7) === 0) {
                ctx.fillStyle = isDark ? '#9ca3af' : '#6b7280';
                ctx.font = '10px sans-serif';
                ctx.textAlign = 'center';
                const day = new Date(item.date + 'T00:00:00').getDate();
                ctx.fillText(String(day), x + barWidth / 2, height - 8);
            }
        });
    },
};

window.Charts = Charts;

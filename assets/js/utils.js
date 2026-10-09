/**
 * Money Bunny - Utility functions
 */

const MB = window.MB || {};

/** App logo asset path */
MB.LOGO_PATH = '/assets/icons/bill-bunny-logo.png';

MB.logoUrl = function () {
    return (window.MB_BASE || '') + MB.LOGO_PATH;
};

/** HTML img tag for the app logo */
MB.logoImg = function (sizeClass = 'mb-logo-sm', alt = 'Money Bunny') {
    const sizes = {
        'mb-logo-xs': 24,
        'mb-logo-sm': 32,
        'mb-logo-md': 48,
        'mb-logo-lg': 64,
        'mb-logo-xl': 80,
    };
    const px = sizes[sizeClass] || 32;
    const safeAlt = String(alt).replace(/"/g, '&quot;');
    return `<img src="${MB.logoUrl()}" alt="${safeAlt}" class="mb-logo ${sizeClass}" width="${px}" height="${px}" loading="lazy">`;
};

/** Parse fetch response as JSON with clear errors on empty/invalid bodies */
MB.parseJsonResponse = async function (res) {
    const text = await res.text();
    if (!text.trim()) {
        throw new Error('Server returned empty response. Check PHP error logs.');
    }
    try {
        return JSON.parse(text);
    } catch (e) {
        if (text.trim().startsWith('<')) {
            throw new Error('Server error (PHP crash or hosting block). Try again.');
        }
        throw new Error('Server error — invalid response');
    }
};

/** Resolve currency symbol — ignores bad API values like 262145 */
MB.currencySymbol = function (value) {
    if (typeof value === 'string' && value.length > 0 && value.length <= 8 && !/^\d+$/.test(value.trim())) {
        return value.trim();
    }
    return 'Rs.';
};

/** Normalize raw amount string (supports 2000.61 and 2000,61) */
MB.normalizeAmountString = function (value) {
    let s = String(value ?? '').trim().replace(/\s/g, '');
    if (s === '') return '';
    if (s === '.' || s === ',') return '0.';

    if (s.includes(',') && !s.includes('.')) {
        s = s.replace(',', '.').replace(/,/g, '');
    } else {
        s = s.replace(/,/g, '');
    }

    if (s.startsWith('.')) {
        s = '0' + s;
    }

    return s;
};

/** Sanitize amount while typing — digits and one decimal, max 2 places */
MB.sanitizeAmountInput = function (value) {
    let v = MB.normalizeAmountString(value);
    if (v === '') return '';

    v = v.replace(/[^\d.]/g, '');
    const dot = v.indexOf('.');
    if (dot !== -1) {
        v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, '').slice(0, 2);
    }
    return v;
};

/** Parse amount string/number to 2 decimal places */
MB.parseAmount = function (value) {
    const s = MB.normalizeAmountString(value);
    if (s === '') return 0;
    const n = parseFloat(s);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 100) / 100;
};

/** Read amount from an input element (text or number) */
MB.readAmountInput = function (input) {
    if (!input) return 0;
    const raw = input.value ?? '';
    if (String(raw).endsWith('.') || String(raw).endsWith(',')) {
        return NaN;
    }
    return MB.parseAmount(raw);
};

/** Format amount for input fields (always 2 decimal places) */
MB.formatAmountForInput = function (amount) {
    const n = MB.parseAmount(amount);
    if (!Number.isFinite(n) || n <= 0) return '';
    return n.toFixed(2);
};

/** Format number as currency display — always shows cents (e.g. Rs. 2,000.61) */
MB.formatMoney = function (amount, symbol = 'Rs.', options = {}) {
    const num = MB.parseAmount(amount);
    const sym = MB.currencySymbol(symbol);
    const negative = num < 0;
    const abs = Math.abs(num);
    const [intPart, decPart] = abs.toFixed(2).split('.');
    const grouped = Number(intPart).toLocaleString('en-US');
    let formatted = `${sym} ${negative ? '-' : ''}${grouped}.${decPart}`;
    if (options.type === 'income' && num > 0) {
        return '+' + formatted;
    }
    return formatted;
};

/** Format amount for list rows with color class hint */
MB.formatTransactionAmount = function (amount, symbol, type) {
    const isIncome = type === 'income';
    return {
        text: isIncome ? MB.formatMoney(amount, symbol, { type: 'income' }) : MB.formatMoney(amount, symbol),
        className: isIncome ? 'amount-income' : 'amount-expense',
    };
};

/** Format date for display */
MB.formatDateLabel = function (dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const d = new Date(date);
    d.setHours(0, 0, 0, 0);

    if (d.getTime() === today.getTime()) return 'Today';
    if (d.getTime() === yesterday.getTime()) return 'Yesterday';

    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

/** Get local date as YYYY-MM-DD (avoids UTC drift) */
MB.todayLocal = function () {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

/** True if the user prefers reduced motion */
MB.prefersReducedMotion = function () {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
};

/** Trap Tab focus within a container while open. Returns nothing; pair with MB.releaseFocus */
MB.trapFocus = function (container) {
    if (!container) return;
    MB.releaseFocus();

    const selector = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
    const getFocusable = () => Array.from(container.querySelectorAll(selector))
        .filter((el) => el.offsetParent !== null || el === document.activeElement);

    const handler = (e) => {
        if (e.key !== 'Tab') return;
        const focusable = getFocusable();
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    };

    container.addEventListener('keydown', handler);
    MB._focusTrap = { container, handler };

    const focusable = getFocusable();
    if (focusable.length && !container.contains(document.activeElement)) {
        setTimeout(() => focusable[0].focus(), 50);
    }
};

/** Release a previously-installed focus trap */
MB.releaseFocus = function () {
    if (MB._focusTrap) {
        MB._focusTrap.container.removeEventListener('keydown', MB._focusTrap.handler);
        MB._focusTrap = null;
    }
};

/** Promise-based confirm sheet replacing window.confirm (see #confirm-sheet in index.php) */
MB.confirm = function (message, options = {}) {
    return new Promise((resolve) => {
        const sheet = document.getElementById('confirm-sheet');
        const overlay = document.getElementById('confirm-sheet-overlay');
        if (!sheet || !overlay) {
            resolve(window.confirm(message));
            return;
        }

        const titleEl = document.getElementById('confirm-sheet-title');
        const msgEl = document.getElementById('confirm-sheet-message');
        const okBtn = document.getElementById('confirm-sheet-ok');
        const cancelBtn = document.getElementById('confirm-sheet-cancel');

        if (titleEl) titleEl.textContent = options.title || 'Are you sure?';
        if (msgEl) msgEl.textContent = message;
        if (okBtn) okBtn.textContent = options.okText || 'Delete';
        if (cancelBtn) cancelBtn.textContent = options.cancelText || 'Cancel';
        const danger = options.danger !== false;
        okBtn?.classList.toggle('confirm-sheet-btn-danger', danger);
        okBtn?.classList.toggle('confirm-sheet-btn-primary', !danger);

        const cleanup = (result) => {
            sheet.classList.add('translate-y-full');
            overlay.classList.add('opacity-0', 'pointer-events-none');
            overlay.classList.remove('opacity-100');
            MB.releaseFocus();
            okBtn?.removeEventListener('click', onOk);
            cancelBtn?.removeEventListener('click', onCancel);
            overlay.removeEventListener('click', onCancel);
            document.removeEventListener('keydown', onKeydown);
            resolve(result);
        };
        const onOk = () => cleanup(true);
        const onCancel = () => cleanup(false);
        const onKeydown = (e) => {
            if (e.key === 'Escape') onCancel();
        };

        okBtn?.addEventListener('click', onOk);
        cancelBtn?.addEventListener('click', onCancel);
        overlay.addEventListener('click', onCancel);
        document.addEventListener('keydown', onKeydown);

        sheet.classList.remove('translate-y-full');
        overlay.classList.remove('opacity-0', 'pointer-events-none');
        overlay.classList.add('opacity-100');
        MB.trapFocus(sheet);
    });
};

/** Track recently used categories (max 6, most recent first) */
MB.RECENT_CATEGORIES_KEY = 'mb_recent_categories';
MB.RECENT_CATEGORIES_MAX = 6;

MB.getRecentCategories = function () {
    try {
        const raw = localStorage.getItem(MB.RECENT_CATEGORIES_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
    } catch (e) {
        return [];
    }
};

MB.pushRecentCategory = function (slug) {
    if (!slug) return;
    try {
        let list = MB.getRecentCategories().filter((s) => s !== slug);
        list.unshift(slug);
        list = list.slice(0, MB.RECENT_CATEGORIES_MAX);
        localStorage.setItem(MB.RECENT_CATEGORIES_KEY, JSON.stringify(list));
    } catch (e) { /* quota */ }
};

/** Debounce helper */
MB.debounce = function (fn, delay = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
};

/** Haptic feedback if available */
MB.haptic = function () {
    if (navigator.vibrate) navigator.vibrate(10);
};

/** Apply dark mode class */
MB.applyTheme = function (darkMode) {
    document.documentElement.classList.toggle('dark', !!darkMode);
};

/** Subtitle for expense rows (note or date) */
MB.entrySubtitle = function (exp, options = {}) {
    if (exp.note) {
        return `<p class="text-xs text-gray-400 truncate">${MB.escapeHtml(exp.note)}</p>`;
    }
    if (options.showDate && exp.expense_date) {
        return `<p class="text-xs text-gray-400">${exp.expense_date}</p>`;
    }
    return '';
};

MB.escapeHtml = function (str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
};

/** Persist last non-salary entry for quick repeat */
MB.saveLastEntry = function (entry) {
    if (!entry || entry.category === 'inc_salary') return;
    try {
        localStorage.setItem('mb_last_entry', JSON.stringify({
            amount: entry.amount,
            category: entry.category,
            type: entry.type || 'expense',
            note: entry.note || null,
        }));
    } catch (e) { /* quota */ }
};

MB.loadLastEntry = function () {
    try {
        const raw = localStorage.getItem('mb_last_entry');
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
};

/** Get relative day label for grouping */
MB.groupExpensesByDate = function (expenses) {
    const groups = {};
    expenses.forEach(exp => {
        const key = exp.expense_date;
        if (!groups[key]) groups[key] = [];
        groups[key].push(exp);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
};

/** Delete an expense/income entry with optional salary warning */
MB.deleteEntry = async function (id, isSalary, state) {
    const msg = isSalary
        ? 'Delete this salary? Your budget cycle will change.'
        : 'Delete this entry?';
    if (!await MB.confirm(msg, { title: isSalary ? 'Delete salary?' : 'Delete entry?' })) return false;

    try {
        const res = await API.deleteExpense(id);
        if (res.offline) return true;
        if (state) state.dashboard = res.dashboard;
        Toast.show(isSalary ? 'Salary deleted — cycle updated' : 'Deleted');
        await DashboardPage.refresh(state || App.state);
        return true;
    } catch (err) {
        Toast.show(err.message, 'error');
        return false;
    }
};

/** Bind visible delete button on a row element */
MB.bindRowDelete = function (rowEl, state) {
    const btn = rowEl.querySelector('.btn-delete');
    if (!btn) return;
    btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = parseInt(rowEl.dataset.id);
        const isSalary = rowEl.dataset.salary === '1';
        const ok = await MB.deleteEntry(id, isSalary, state);
        if (ok) rowEl.remove();
    });
};
/** Swipe handler for list items */
MB.initSwipeDelete = function (element, onDelete) {
    let startX = 0;
    let currentX = 0;
    let swiping = false;
    const content = element.querySelector('.swipe-content');
    const deleteBtn = element.querySelector('.swipe-delete');

    element.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        swiping = true;
    }, { passive: true });

    element.addEventListener('touchmove', (e) => {
        if (!swiping) return;
        currentX = e.touches[0].clientX - startX;
        if (currentX < 0) {
            content.style.transform = `translateX(${Math.max(currentX, -80)}px)`;
        }
    }, { passive: true });

    element.addEventListener('touchend', () => {
        swiping = false;
        if (currentX < -50) {
            content.style.transform = 'translateX(-80px)';
            deleteBtn.classList.remove('opacity-0');
        } else {
            content.style.transform = '';
            deleteBtn.classList.add('opacity-0');
        }
        currentX = 0;
    });

    deleteBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        element.classList.add('opacity-0', 'scale-95');
        setTimeout(() => onDelete(), 200);
    });
};

/** Derive AES key from passphrase */
MB.deriveBackupKey = async function (passphrase, salt) {
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: 120000, hash: 'SHA-256' },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
};

/** Encrypt backup payload with passphrase (client-side) */
MB.encryptBackup = async function (payload, passphrase) {
    if (!window.crypto?.subtle) throw new Error('Encryption not supported in this browser');
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await MB.deriveBackupKey(passphrase, salt);
    const plain = new TextEncoder().encode(JSON.stringify(payload));
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain);
    const toB64 = (buf) => {
        const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
        let binary = '';
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
            binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
        }
        return btoa(binary);
    };
    return {
        app: 'Money Bunny',
        encrypted: true,
        version: 1,
        salt: toB64(salt),
        iv: toB64(iv),
        data: toB64(cipher),
    };
};

/** Decrypt encrypted backup file */
MB.decryptBackup = async function (envelope, passphrase) {
    if (!envelope?.encrypted) return envelope;
    if (!window.crypto?.subtle) throw new Error('Decryption not supported in this browser');
    const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
    try {
        const salt = fromB64(envelope.salt);
        const iv = fromB64(envelope.iv);
        const data = fromB64(envelope.data);
        const key = await MB.deriveBackupKey(passphrase, salt);
        const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
        return JSON.parse(new TextDecoder().decode(plain));
    } catch (e) {
        throw new Error('Wrong passphrase or corrupted backup');
    }
};

/** Render a simple branded story PNG for sharing */
MB.renderStoryImage = async function (opts = {}) {
    try {
        const canvas = document.createElement('canvas');
        canvas.width = 1080;
        canvas.height = 1350;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        grad.addColorStop(0, '#052e16');
        grad.addColorStop(1, '#030712');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#86efac';
        ctx.font = 'bold 64px Segoe UI, system-ui, sans-serif';
        ctx.fillText('Money Bunny', 80, 160);

        ctx.fillStyle = '#9ca3af';
        ctx.font = '36px Segoe UI, system-ui, sans-serif';
        ctx.fillText('My salary cycle', 80, 230);

        ctx.fillStyle = '#f9fafb';
        ctx.font = 'bold 48px Segoe UI, system-ui, sans-serif';
        ctx.fillText('Spent', 80, 380);
        ctx.fillStyle = '#fb923c';
        ctx.font = 'bold 72px Segoe UI, system-ui, sans-serif';
        ctx.fillText(String(opts.spent || '—'), 80, 470);

        ctx.fillStyle = '#f9fafb';
        ctx.font = 'bold 48px Segoe UI, system-ui, sans-serif';
        ctx.fillText('Saved', 80, 600);
        ctx.fillStyle = '#4ade80';
        ctx.font = 'bold 72px Segoe UI, system-ui, sans-serif';
        ctx.fillText(String(opts.saved || '—'), 80, 690);

        if (opts.utilization != null) {
            ctx.fillStyle = '#d1d5db';
            ctx.font = '40px Segoe UI, system-ui, sans-serif';
            ctx.fillText(`Salary used: ${opts.utilization}%`, 80, 820);
        }
        if (opts.streak >= 2) {
            ctx.fillStyle = '#fdba74';
            ctx.font = 'bold 40px Segoe UI, system-ui, sans-serif';
            ctx.fillText(`🔥 ${opts.streak}-day logging streak`, 80, 900);
        }
        if (opts.story) {
            ctx.fillStyle = '#a3a3a3';
            ctx.font = '32px Segoe UI, system-ui, sans-serif';
            const story = String(opts.story).slice(0, 70);
            ctx.fillText(story, 80, 1000);
        }

        ctx.fillStyle = '#4b5563';
        ctx.font = '28px Segoe UI, system-ui, sans-serif';
        ctx.fillText('moneybunny · fast expense tracking', 80, 1240);

        return await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    } catch (e) {
        return null;
    }
};

window.MB = MB;

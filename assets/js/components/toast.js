/**
 * Money Bunny - Toast notifications
 */

const Toast = {
    container: null,

    init() {
        this.container = document.getElementById('toast-container');
        this.container?.setAttribute('aria-live', 'polite');
    },

    show(message, type = 'success', duration = 2500) {
        if (!this.container) this.init();

        const colors = {
            success: 'bg-bunny-600 text-white',
            error: 'bg-red-500 text-white',
            info: 'bg-gray-800 text-white',
        };

        const toast = document.createElement('div');
        toast.className = `px-4 py-3 rounded-2xl shadow-lg text-sm font-medium animate-scale-in ${colors[type] || colors.info}`;
        toast.setAttribute('role', 'status');
        toast.textContent = message;
        this.container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('opacity-0', 'transition-opacity', 'duration-300');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },
};

window.Toast = Toast;

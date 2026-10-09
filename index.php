<?php
/**
 * Money Bunny - Main entry point (SPA shell)
 */
require_once __DIR__ . '/config.php';

$basePath = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/\\');
if ($basePath === '/' || $basePath === '\\') {
    $basePath = '';
}
$assetVer = APP_VERSION;
?>
<!DOCTYPE html>
<html lang="en" class="h-full dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <meta name="theme-color" content="#166534">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="description" content="Personal expense tracker I built for my own use. Record expenses in 3 seconds.">

    <title>Money Bunny</title>

    <link rel="manifest" href="<?= htmlspecialchars($basePath) ?>/manifest.json">
    <link rel="icon" type="image/png" href="<?= htmlspecialchars($basePath) ?>/assets/icons/bill-bunny-logo.png">
    <link rel="apple-touch-icon" href="<?= htmlspecialchars($basePath) ?>/assets/icons/bill-bunny-logo.png">

    <link rel="stylesheet" href="<?= htmlspecialchars($basePath) ?>/assets/css/tailwind.css?v=<?= $assetVer ?>">
    <link rel="stylesheet" href="<?= htmlspecialchars($basePath) ?>/assets/css/app.css?v=<?= $assetVer ?>">

    <script>
        window.MB_BASE = <?= json_encode($basePath) ?>;
        window.MB_APP = <?= json_encode(['name' => APP_NAME, 'version' => APP_VERSION]) ?>;
    </script>
</head>
<body class="h-full bg-bunny-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100 transition-colors duration-300">

    <!-- App shell -->
    <div id="app" class="flex flex-col h-full max-w-lg mx-auto relative">

        <!-- Header -->
        <header id="app-header" class="sticky top-0 z-30 px-4 pt-safe-top pb-3 bg-bunny-50/90 dark:bg-gray-950/90 backdrop-blur-md border-b border-bunny-200/50 dark:border-gray-800">
            <div class="flex items-center justify-between pt-3">
                <a href="#dashboard" id="btn-home" class="flex items-center gap-2 active:scale-95 transition-transform" aria-label="Go to dashboard">
                    <img src="<?= htmlspecialchars($basePath) ?>/assets/icons/bill-bunny-logo.png" alt="" class="mb-logo mb-logo-sm" width="32" height="32" aria-hidden="true">
                    <h1 id="page-title" class="text-lg font-bold text-bunny-800 dark:text-bunny-300">Dashboard</h1>
                </a>
                <div class="flex items-center gap-2">
                    <button id="btn-search" class="p-2.5 rounded-xl bg-white dark:bg-gray-900 shadow-sm active:scale-95 transition-transform" aria-label="Search">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                    </button>
                    <button id="btn-calendar" class="p-2.5 rounded-xl bg-white dark:bg-gray-900 shadow-sm active:scale-95 transition-transform" aria-label="Calendar">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                    </button>
                </div>
            </div>
            <button type="button" id="cycle-label-btn" class="w-full text-left mt-1 disabled:cursor-default" aria-label="Salary cycle filter">
                <p id="cycle-label-text" class="text-xs text-bunny-600 dark:text-bunny-400"></p>
            </button>
            <div id="offline-badge" class="hidden gap-1.5 mt-2 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-semibold w-fit" role="status">
                <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" aria-hidden="true"></span>
                <span id="offline-badge-text">Offline — 0 pending</span>
            </div>
        </header>

        <!-- Main content area -->
        <main id="main-content" class="flex-1 overflow-y-auto overscroll-contain px-4 pb-28 pt-4">
            <!-- Pages rendered here by JS -->
        </main>

        <!-- Bottom navigation -->
        <nav id="bottom-nav" class="bottom-nav fixed bottom-0 left-0 right-0 z-40 max-w-lg mx-auto w-full" aria-label="Main navigation">
            <div class="bottom-nav__inner">
                <svg class="bottom-nav__bg" viewBox="0 0 375 76" preserveAspectRatio="none" aria-hidden="true">
                    <path d="M0 14 H151 A 36 36 0 0 1 224 14 H375 V76 H0 Z"/>
                </svg>
                <div class="bottom-nav__items pb-safe-bottom">
                    <a href="#dashboard" data-route="dashboard" class="nav-item">
                        <svg class="nav-item__icon" width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
                        <span class="nav-item__label">Home</span>
                    </a>
                    <a href="#history" data-route="history" class="nav-item">
                        <svg class="nav-item__icon" width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                        <span class="nav-item__label">History</span>
                    </a>
                    <span class="bottom-nav__fab-gap" aria-hidden="true"></span>
                    <a href="#statistics" data-route="statistics" class="nav-item">
                        <svg class="nav-item__icon" width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
                        <span class="nav-item__label">Stats</span>
                    </a>
                    <a href="#settings" data-route="settings" class="nav-item">
                        <svg class="nav-item__icon" width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                        <span class="nav-item__label">Settings</span>
                    </a>
                </div>
                <button type="button" id="fab-add" class="bottom-nav__fab" aria-label="Add expense or income">
                    <svg width="26" height="26" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/></svg>
                </button>
            </div>
        </nav>
    </div>

    <!-- Bottom Sheet: Quick Add Expense -->
    <div id="sheet-overlay" class="fixed inset-0 bg-black/40 z-50 opacity-0 pointer-events-none transition-opacity duration-300" aria-hidden="true"></div>
    <div id="add-sheet" class="fixed bottom-0 left-0 right-0 z-50 max-w-lg mx-auto translate-y-full transition-transform duration-300 ease-out" role="dialog" aria-modal="true" aria-label="Add expense">
        <div class="bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl pb-safe-bottom">
            <div class="flex justify-center pt-3 pb-2">
                <div class="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-700"></div>
            </div>
            <div class="px-5 pb-6">
                <h2 id="add-sheet-title" class="text-xl font-bold mb-4 text-center">Quick Add</h2>

                <!-- Expense / Income toggle -->
                <div class="type-segment flex p-1 rounded-2xl bg-gray-100 dark:bg-gray-800 mb-5 relative" role="tablist" aria-label="Transaction type">
                    <div id="type-segment-slider" class="type-segment-slider absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-xl bg-white dark:bg-gray-900 shadow-sm transition-transform duration-300 ease-out"></div>
                    <button type="button" id="toggle-expense" data-type="expense" class="type-segment-btn flex-1 relative z-10 py-2.5 rounded-xl font-semibold text-sm transition-colors type-segment-active" role="tab" aria-selected="true">Expense</button>
                    <button type="button" id="toggle-income" data-type="income" class="type-segment-btn flex-1 relative z-10 py-2.5 rounded-xl font-semibold text-sm transition-colors" role="tab" aria-selected="false">Income</button>
                </div>

                <!-- Amount keypad (no phone keyboard needed) -->
                <div class="flex items-center justify-between mb-3 px-1">
                    <button type="button" id="add-date-toggle" class="text-sm text-bunny-600 dark:text-bunny-400 font-medium underline-offset-2 hover:underline">Change date</button>
                    <button type="button" id="add-note-toggle" class="text-sm text-gray-400 dark:text-gray-500 font-medium underline-offset-2 hover:underline">+ Note</button>
                </div>
                <div id="add-date-wrap" class="hidden mb-3 px-1">
                    <div class="flex items-center justify-between">
                        <label for="add-date" class="text-sm text-gray-500 dark:text-gray-400">Date</label>
                        <input type="date" id="add-date" class="text-sm px-3 py-2 rounded-xl bg-bunny-50 dark:bg-gray-800 border-0">
                    </div>
                </div>
                <div id="add-note-wrap" class="hidden mb-3">
                    <input type="text" id="add-note" maxlength="200" placeholder="Add a quick note (optional)"
                        class="w-full p-3 rounded-2xl bg-bunny-50 dark:bg-gray-800 text-sm" autocomplete="off">
                </div>
                <div class="amount-display-wrap">
                    <p id="add-amount-display" class="amount-display">0.00</p>
                    <input type="hidden" id="add-amount" value="">

                    <div id="add-amount-keypad" role="group" aria-label="Amount keypad">
                        <button type="button" class="amt-key" data-amt-digit="1">1</button>
                        <button type="button" class="amt-key" data-amt-digit="2">2</button>
                        <button type="button" class="amt-key" data-amt-digit="3">3</button>
                        <button type="button" class="amt-key" data-amt-digit="4">4</button>
                        <button type="button" class="amt-key" data-amt-digit="5">5</button>
                        <button type="button" class="amt-key" data-amt-digit="6">6</button>
                        <button type="button" class="amt-key" data-amt-digit="7">7</button>
                        <button type="button" class="amt-key" data-amt-digit="8">8</button>
                        <button type="button" class="amt-key" data-amt-digit="9">9</button>
                        <button type="button" class="amt-key amt-key-dot" data-amt-decimal="1" aria-label="Decimal point">.</button>
                        <button type="button" class="amt-key" data-amt-digit="0">0</button>
                        <button type="button" class="amt-key amt-key-back" data-amt-back="1" aria-label="Delete">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12"/></svg>
                        </button>
                    </div>
                </div>

                <!-- Category grid -->
                <div class="flex gap-2 mb-2">
                    <button type="button" id="add-repeat-last" class="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm font-medium text-gray-600 dark:text-gray-300 disabled:opacity-40" disabled>
                        ↩ Repeat last
                    </button>
                </div>
                <p id="add-sheet-hint" class="text-sm text-gray-500 dark:text-gray-400 mb-2 text-center">Tap category to save instantly</p>
                <div id="category-grid"></div>
            </div>
        </div>
    </div>

    <!-- Edit expense modal -->
    <div id="edit-modal" class="fixed inset-0 z-50 flex items-end justify-center opacity-0 pointer-events-none transition-opacity" aria-hidden="true">
        <div class="absolute inset-0 bg-black/40" id="edit-overlay"></div>
        <div class="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-3xl p-5 pb-safe-bottom animate-slide-up transform translate-y-8 transition-transform" role="dialog" aria-modal="true" aria-labelledby="edit-modal-title">
            <h2 id="edit-modal-title" class="text-lg font-bold mb-4">Edit Entry</h2>
            <input type="hidden" id="edit-id">

            <div class="type-segment flex p-1 rounded-2xl bg-gray-100 dark:bg-gray-800 mb-4 relative" role="tablist">
                <div id="edit-type-slider" class="type-segment-slider absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-xl bg-white dark:bg-gray-900 shadow-sm transition-transform duration-300 ease-out"></div>
                <button type="button" id="edit-toggle-expense" data-type="expense" class="edit-type-btn flex-1 relative z-10 py-2 rounded-xl font-semibold text-sm type-segment-active">Expense</button>
                <button type="button" id="edit-toggle-income" data-type="income" class="edit-type-btn flex-1 relative z-10 py-2 rounded-xl font-semibold text-sm">Income</button>
            </div>

            <label class="block text-sm text-gray-500 mb-1">Amount</label>
            <input type="text" id="edit-amount" lang="en"
                class="amount-input w-full text-2xl font-bold p-3 rounded-2xl bg-bunny-50 dark:bg-gray-800 mb-3"
                inputmode="decimal" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="0.00">
            <label class="block text-sm text-gray-500 mb-1">Category</label>
            <select id="edit-category" class="w-full p-3 rounded-2xl bg-bunny-50 dark:bg-gray-800 mb-3"></select>
            <label class="block text-sm text-gray-500 mb-1">Date</label>
            <input type="date" id="edit-date" class="w-full p-3 rounded-2xl bg-bunny-50 dark:bg-gray-800 mb-3">
            <label class="block text-sm text-gray-500 mb-1">Note <span class="text-gray-400">(optional)</span></label>
            <input type="text" id="edit-note" maxlength="200" placeholder="e.g. lunch with Sam"
                class="w-full p-3 rounded-2xl bg-bunny-50 dark:bg-gray-800 mb-4">
            <div class="flex gap-3">
                <button id="edit-cancel" class="flex-1 py-3 rounded-2xl bg-gray-100 dark:bg-gray-800 font-semibold">Cancel</button>
                <button id="edit-save" class="flex-1 py-3 rounded-2xl bg-bunny-500 text-white font-semibold">Save</button>
            </div>
        </div>
    </div>

    <!-- Toast notifications -->
    <div id="toast-container" class="fixed top-20 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 pointer-events-none" aria-live="polite"></div>

    <!-- Custom confirm sheet (replaces window.confirm) -->
    <div id="confirm-sheet-overlay" class="fixed inset-0 bg-black/40 z-[70] opacity-0 pointer-events-none transition-opacity duration-200" aria-hidden="true"></div>
    <div id="confirm-sheet" class="fixed bottom-0 left-0 right-0 z-[70] max-w-lg mx-auto translate-y-full transition-transform duration-200 ease-out" role="alertdialog" aria-modal="true" aria-labelledby="confirm-sheet-title">
        <div class="bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl pb-safe-bottom">
            <div class="flex justify-center pt-3 pb-2">
                <div class="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-700"></div>
            </div>
            <div class="px-5 pb-6 pt-1 text-center">
                <h2 id="confirm-sheet-title" class="text-lg font-bold mb-1">Are you sure?</h2>
                <p id="confirm-sheet-message" class="text-sm text-gray-500 dark:text-gray-400 mb-5"></p>
                <div class="flex gap-3">
                    <button type="button" id="confirm-sheet-cancel" class="flex-1 py-3 rounded-2xl bg-gray-100 dark:bg-gray-800 font-semibold">Cancel</button>
                    <button type="button" id="confirm-sheet-ok" class="confirm-sheet-btn-danger flex-1 py-3 rounded-2xl font-semibold">Delete</button>
                </div>
            </div>
        </div>
    </div>

    <!-- First-run coach overlay -->
    <div id="coach-overlay" class="hidden fixed bottom-24 left-4 right-4 max-w-lg mx-auto z-40 p-4 rounded-2xl bg-bunny-600 text-white shadow-xl animate-fade-in">
        <p id="coach-message" class="font-semibold mb-3">Add your salary to start 💵</p>
        <div class="flex gap-2">
            <button id="coach-dismiss" class="py-2 px-3 rounded-xl bg-bunny-700 text-sm font-medium">Not now</button>
            <button id="coach-cta" class="flex-1 py-2 rounded-xl bg-white text-bunny-700 text-sm font-semibold">Add salary</button>
        </div>
    </div>

    <!-- PWA install banner -->
    <div id="install-banner" class="hidden fixed bottom-24 left-4 right-4 max-w-lg mx-auto z-40 p-4 rounded-2xl bg-bunny-600 text-white shadow-xl animate-fade-in">
        <div class="flex items-center gap-3 mb-2">
            <img src="<?= htmlspecialchars($basePath) ?>/assets/icons/bill-bunny-logo.png" alt="" class="mb-logo mb-logo-sm rounded-lg bg-white/10" width="32" height="32" aria-hidden="true">
            <p class="font-semibold">Install Money Bunny</p>
        </div>
        <p class="text-sm text-bunny-100 mb-3">Add to home screen for instant access</p>
        <div class="flex gap-2">
            <button id="install-dismiss" class="flex-1 py-2 rounded-xl bg-bunny-700 text-sm font-medium">Later</button>
            <button id="install-accept" class="flex-1 py-2 rounded-xl bg-white text-bunny-700 text-sm font-semibold">Install</button>
        </div>
    </div>

    <!-- Scripts -->
    <script src="<?= htmlspecialchars($basePath) ?>/assets/js/utils.js?v=<?= $assetVer ?>"></script>
    <script src="<?= htmlspecialchars($basePath) ?>/assets/js/auth.js?v=<?= $assetVer ?>"></script>
    <script src="<?= htmlspecialchars($basePath) ?>/assets/js/offline.js?v=<?= $assetVer ?>"></script>
    <script src="<?= htmlspecialchars($basePath) ?>/assets/js/api.js?v=<?= $assetVer ?>"></script>
    <script src="<?= htmlspecialchars($basePath) ?>/assets/js/cycle-filter.js?v=<?= $assetVer ?>"></script>
    <script src="<?= htmlspecialchars($basePath) ?>/assets/js/components/charts.js?v=<?= $assetVer ?>"></script>
    <script src="<?= htmlspecialchars($basePath) ?>/assets/js/components/toast.js?v=<?= $assetVer ?>"></script>
    <script src="<?= htmlspecialchars($basePath) ?>/assets/js/pages/dashboard.js?v=<?= $assetVer ?>"></script>
    <script src="<?= htmlspecialchars($basePath) ?>/assets/js/pages/history.js?v=<?= $assetVer ?>"></script>
    <script src="<?= htmlspecialchars($basePath) ?>/assets/js/pages/statistics.js?v=<?= $assetVer ?>"></script>
    <script src="<?= htmlspecialchars($basePath) ?>/assets/js/pages/settings.js?v=<?= $assetVer ?>"></script>
    <script src="<?= htmlspecialchars($basePath) ?>/assets/js/pages/calendar.js?v=<?= $assetVer ?>"></script>
    <script src="<?= htmlspecialchars($basePath) ?>/assets/js/pages/search.js?v=<?= $assetVer ?>"></script>
    <script src="<?= htmlspecialchars($basePath) ?>/assets/js/app.js?v=<?= $assetVer ?>"></script>

    <script>
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('<?= htmlspecialchars($basePath) ?>/sw.js?v=<?= $assetVer ?>').catch(() => {});
            });
        }
    </script>
</body>
</html>

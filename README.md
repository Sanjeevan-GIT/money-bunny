# Money Bunny 🐰

Personal expense tracker I built for my own use.

A minimal, mobile-first Progressive Web App for recording expenses in under 3 seconds.

**Not accounting.** Just fast expense tracking tied to your salary cycle.

## Features

- **Salary starts a new cycle** — tap + → Income → 💵 Salary (no fixed amount in settings)
- One-tap quick add: amount keypad + emoji category to save, with an optional quick note
- **PIN lock is required** — first launch walks you through a short PIN setup before anything else loads; optional fingerprint unlock (WebAuthn) afterwards
- Salary-day budget cycles (browse past cycles on Dashboard & Statistics)
- Dashboard leads with remaining balance, safe daily spending, a one-line insight story, and your logging streak — secondary stats collapse into a "Details" disclosure
- Statistics lead with insights (salary utilization, weekend vs weekday spend, top drains) plus pie/bar charts
- Favorite & recently-used categories surface first in the add sheet; custom categories can be added/removed in Settings
- Swipe-to-delete expense history, with a custom confirm sheet (no browser `confirm()` popups)
- Calendar view with spending highlights
- Search by amount, category, or date
- Recurring expenses (weekly/monthly), with a toast when one is auto-applied
- Full JSON backup export/import, plus CSV import (in addition to CSV export for current/previous cycles)
- Dark mode (default)
- Optional daily reminder notification
- Installable PWA with offline queue + sync, an offline/pending-sync badge, and "update available" refresh prompts

## Tech Stack

- PHP 8+
- SQLite (default) or MySQL
- Tailwind CSS (pre-built `assets/css/tailwind.css`)
- Vanilla JavaScript
- No frontend framework

## Quick Start (Local)

```bash
cd Money-Bunny-simple
# Force SQLite even if config.local.php points at remote MySQL
MB_DB_DRIVER=sqlite php -S localhost:8080
```

On Windows PowerShell:

```powershell
$env:MB_DB_DRIVER='sqlite'; php -S localhost:8080
```

Open http://localhost:8080 — SQLite database auto-creates in `data/`.

**Smoke test:**

```bash
MB_DB_DRIVER=sqlite php scripts/test-api.php
```

**Note:** A remote MySQL `config.local.php` only works on the host that can reach that database. From your PC an unreachable MySQL server falls back to local SQLite.

## Production / MySQL Setup

1. Copy `config.local.php.example` → `config.local.php` (gitignored)
2. Set MySQL credentials and a strong `AUTH_SECRET`
3. Upload `assets/icons/bill-bunny-logo.png` (PWA + UI logo)
4. Ensure `data/` is writable if using SQLite

Or set environment variables: `MB_DB_DRIVER`, `MB_DB_HOST`, `MB_DB_NAME`, `MB_DB_USER`, `MB_DB_PASS`, `MB_AUTH_SECRET`.

**Database:** the app creates SQLite at `data/moneybunny.db` on first run (that file stays local and is not in git). For a fresh MySQL database, import `database/schema.sql`. For an older MySQL database, run `scripts/fix-existing-db.sql` once in phpMyAdmin.

## Tailwind Rebuild (optional)

If you edit `assets/css/tailwind.input.css` or `tailwind.config.js`:

```bash
npx tailwindcss -i ./assets/css/tailwind.input.css -o ./assets/css/tailwind.css --minify
```

Bump `APP_VERSION` in `config.php` and `CACHE_NAME` in `sw.js` together after deploy.

## Project Structure

```
├── index.php              # SPA shell
├── config.php             # Defaults (secrets via config.local.php or env)
├── config.local.php.example
├── manifest.json          # PWA manifest
├── sw.js                  # Service worker
├── api/                   # JSON API endpoints
│   ├── auth.php
│   ├── bootstrap.php
│   ├── categories.php
│   ├── cycles.php
│   ├── dashboard.php
│   ├── expenses.php
│   ├── settings.php
│   ├── statistics.php
│   ├── calendar.php
│   ├── search.php
│   ├── reports.php
│   ├── recurring.php
│   └── backup.php
├── includes/              # PHP backend (blocked from web)
│   ├── auth.php
│   ├── Database.php
│   └── helpers.php
├── assets/                # CSS, JS, icons
├── scripts/               # Dev tools (blocked from web)
│   ├── test-api.php
│   ├── generate-icons.php
│   ├── fix-existing-db.sql
│   └── fix-charset-optional.sql
├── database/
│   └── schema.sql         # Empty MySQL schema (no personal records)
└── data/                  # SQLite database (auto-created, not committed)
```

## API Endpoints

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `/api/auth.php` | GET, POST, PUT, DELETE | PIN status / login / set-or-change / remove |
| `/api/dashboard.php` | GET | Current cycle metrics + insights |
| `/api/cycles.php` | GET | Salary cycle list |
| `/api/expenses.php` | GET, POST, PUT, DELETE | Expense CRUD |
| `/api/settings.php` | GET, PUT | App settings (incl. favorite categories, onboarding) |
| `/api/categories.php` | GET, POST, PUT, DELETE | Category list + custom category CRUD |
| `/api/statistics.php` | GET | Charts data + insights |
| `/api/calendar.php` | GET | Calendar highlights |
| `/api/search.php` | GET | Search expenses |
| `/api/reports.php` | GET | Cycle reports & CSV export |
| `/api/recurring.php` | GET, POST, PUT, DELETE | Recurring expenses |
| `/api/backup.php` | GET, POST | Full JSON backup export / import / CSV import |

## Default Settings

- Currency is always **Rs.**
- A **PIN is required** — you'll be walked through setup on first launch; every API except `auth.php` requires it
- Add your first **Salary** via + → Income to start a budget cycle
- Change savings goal in **Settings** after first launch

## Version 1.2.0 notes

- Pace alerts, streak achievements, end-cycle wrap card, skeleton loaders
- Category reorder (↑↓), optional passphrase-encrypted backups, shareable story image
- Honest daily-reminder limits copy in Settings

## Version 1.1.0 notes

- PIN setup is now mandatory (previously optional) — existing installs will be prompted to create one on next visit
- Use **Settings → Backup & Restore** to export/import a full JSON backup, or import expenses from a CSV file
- Bump `APP_VERSION` in `config.php` and `CACHE_NAME` in `sw.js` together after deploy (already done for this release)

## PWA Install

On mobile Chrome/Safari, use "Add to Home Screen" or accept the install banner.

## License

MIT — use freely for personal projects.

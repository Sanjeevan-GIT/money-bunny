<?php
/**
 * Money Bunny - Database connection singleton
 * Supports SQLite (default) and MySQL with identical API via PDO.
 */

declare(strict_types=1);

class Database
{
    private static ?PDO $instance = null;
    private static bool $usingSqliteFallback = false;

    /** True when MySQL was configured but local SQLite is in use */
    public static function isSqliteFallback(): bool
    {
        return self::$usingSqliteFallback;
    }

    /** Last connection/schema error (safe for API debug) */
    public static string $lastError = '';

    /** Get shared PDO connection */
    public static function getConnection(): PDO
    {
        if (self::$instance === null) {
            try {
                self::$instance = self::connect();
            } catch (Throwable $e) {
                self::$lastError = 'connect: ' . $e->getMessage();
                throw $e;
            }
            try {
                self::initializeSchema(self::$instance);
            } catch (Throwable $e) {
                self::$lastError = 'schema: ' . $e->getMessage();
                // Keep the connection — schema issues shouldn't wipe the app
                error_log('Money Bunny schema init: ' . $e->getMessage());
            }
        }

        return self::$instance;
    }

    /** Are we running on this machine (CLI or localhost)? */
    private static function isLocalRuntime(): bool
    {
        if (PHP_SAPI === 'cli' || PHP_SAPI === 'cli-server') {
            return true;
        }
        $host = $_SERVER['HTTP_HOST'] ?? $_SERVER['SERVER_NAME'] ?? '';
        $host = strtolower(explode(':', $host)[0]);
        return in_array($host, ['localhost', '127.0.0.1', '::1', ''], true);
    }

    /** Create PDO connection based on config driver */
    private static function connect(): PDO
    {
        if (DB_DRIVER === 'mysql') {
            try {
                return self::connectMysql(DB_MYSQL_HOST);
            } catch (PDOException $e) {
                // Some hosts accept localhost while the public hostname fails (and vice versa)
                $configured = strtolower(DB_MYSQL_HOST);
                if ($configured !== 'localhost' && $configured !== '127.0.0.1') {
                    try {
                        return self::connectMysql('localhost');
                    } catch (PDOException $e2) {
                        // keep original error below
                    }
                }

                // Remote MySQL is often blocked from a PC — local SQLite fallback
                if (self::isLocalRuntime()) {
                    self::$usingSqliteFallback = true;
                    error_log('Money Bunny: MySQL unreachable from this machine — using local SQLite. (' . $e->getMessage() . ')');
                    return self::connectSqlite();
                }
                throw $e;
            }
        }

        return self::connectSqlite();
    }

    private static function connectMysql(string $host): PDO
    {
        $attempts = [
            sprintf('mysql:host=%s;port=%d;dbname=%s;charset=%s', $host, DB_MYSQL_PORT, DB_MYSQL_NAME, DB_MYSQL_CHARSET),
            sprintf('mysql:host=%s;dbname=%s;charset=%s', $host, DB_MYSQL_NAME, DB_MYSQL_CHARSET),
            sprintf('mysql:host=%s;dbname=%s', $host, DB_MYSQL_NAME),
        ];

        $last = null;
        foreach ($attempts as $dsn) {
            try {
                $pdo = new PDO($dsn, DB_MYSQL_USER, DB_MYSQL_PASS, [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false,
                ]);
                try {
                    $pdo->exec("SET NAMES utf8mb4");
                } catch (PDOException $e) {
                    // ignore
                }
                return $pdo;
            } catch (PDOException $e) {
                $last = $e;
            }
        }

        throw $last ?? new PDOException('MySQL connection failed');
    }

    private static function connectSqlite(): PDO
    {
        $dir = dirname(DB_SQLITE_PATH);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
        $pdo = new PDO('sqlite:' . DB_SQLITE_PATH, null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        $pdo->exec('PRAGMA foreign_keys = ON');
        $pdo->exec('PRAGMA journal_mode = WAL');
        return $pdo;
    }

    /** Create tables and seed default data on first run */
    private static function initializeSchema(PDO $pdo): void
    {
        $isSqlite = (DB_DRIVER === 'sqlite') || self::$usingSqliteFallback;

        $autoIncrement = $isSqlite ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'INT AUTO_INCREMENT PRIMARY KEY';
        $tsDefault = $isSqlite ? "(datetime('now'))" : 'CURRENT_TIMESTAMP';
        $settingsId = $isSqlite
            ? 'id INTEGER PRIMARY KEY CHECK (id = 1)'
            : 'id INT PRIMARY KEY';
        $mysqlCharset = $isSqlite ? '' : ' DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';

        $pdo->exec("
            CREATE TABLE IF NOT EXISTS settings (
                {$settingsId},
                monthly_salary REAL NOT NULL DEFAULT 0,
                salary_day INTEGER NOT NULL DEFAULT 1,
                currency_symbol TEXT NOT NULL DEFAULT 'Rs.',
                savings_goal REAL DEFAULT NULL,
                dark_mode INTEGER NOT NULL DEFAULT 1,
                notification_reminder INTEGER NOT NULL DEFAULT 0,
                notification_time TEXT DEFAULT '20:00',
                pin_hash TEXT DEFAULT NULL,
                auth_epoch INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL DEFAULT {$tsDefault}
            ){$mysqlCharset}
        ");

        $pdo->exec("
            CREATE TABLE IF NOT EXISTS categories (
                id {$autoIncrement},
                slug TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                emoji TEXT NOT NULL,
                type TEXT NOT NULL DEFAULT 'expense',
                sort_order INTEGER NOT NULL DEFAULT 0
            ){$mysqlCharset}
        ");

        $pdo->exec("
            CREATE TABLE IF NOT EXISTS expenses (
                id {$autoIncrement},
                amount REAL NOT NULL,
                category TEXT NOT NULL,
                type TEXT NOT NULL DEFAULT 'expense',
                expense_date TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT {$tsDefault}
            ){$mysqlCharset}
        ");

        $pdo->exec("
            CREATE TABLE IF NOT EXISTS recurring_expenses (
                id {$autoIncrement},
                amount REAL NOT NULL,
                category TEXT NOT NULL,
                frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly')),
                day_of_week INTEGER DEFAULT NULL,
                day_of_month INTEGER DEFAULT NULL,
                is_active INTEGER NOT NULL DEFAULT 1,
                last_applied_cycle TEXT DEFAULT NULL,
                created_at TEXT NOT NULL DEFAULT {$tsDefault}
            ){$mysqlCharset}
        ");

        self::createIndexIfMissing($pdo, 'idx_expenses_date', 'expenses', 'expense_date');
        self::createIndexIfMissing($pdo, 'idx_expenses_category', 'expenses', 'category');
        self::createIndexIfMissing($pdo, 'idx_expenses_created', 'expenses', 'created_at');

        self::migrateSchema($pdo);

        self::createIndexIfMissing($pdo, 'idx_expenses_type', 'expenses', 'type');
        self::createIndexIfMissing($pdo, 'idx_expenses_type_date', 'expenses', 'type, expense_date');
        self::createIndexIfMissing($pdo, 'idx_expenses_type_cat_date', 'expenses', 'type, category, expense_date');
        self::ensureMysqlUtf8mb4($pdo);
        self::seedDefaults($pdo);
    }

    /** True when the active connection is SQLite (configured or fallback) */
    private static function isSqliteDriver(): bool
    {
        return DB_DRIVER === 'sqlite' || self::$usingSqliteFallback;
    }

    /** Create index safely (MySQL < 8 lacks IF NOT EXISTS). $column may be comma-separated. */
    private static function createIndexIfMissing(PDO $pdo, string $indexName, string $table, string $column): void
    {
        if (self::isSqliteDriver()) {
            $pdo->exec("CREATE INDEX IF NOT EXISTS {$indexName} ON {$table}({$column})");
            return;
        }

        $stmt = $pdo->prepare('
            SELECT COUNT(*) FROM information_schema.statistics
            WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?
        ');
        $stmt->execute([$table, $indexName]);
        if ((int) $stmt->fetchColumn() === 0) {
            $pdo->exec("CREATE INDEX {$indexName} ON {$table}({$column})");
        }
    }

    /**
     * Do NOT auto-CONVERT tables on every request — that can time out on shared hosting.
     * Charset fixes belong in scripts/fix-charset-optional.sql (run manually, one table at a time).
     */
    private static function ensureMysqlUtf8mb4(PDO $pdo): void
    {
        // intentionally no-op
    }

    /** Add new columns to existing databases */
    private static function migrateSchema(PDO $pdo): void
    {
        self::addColumnIfMissing($pdo, 'expenses', 'type', "TEXT NOT NULL DEFAULT 'expense'");
        self::addColumnIfMissing($pdo, 'categories', 'type', "TEXT NOT NULL DEFAULT 'expense'");
        self::addColumnIfMissing($pdo, 'settings', 'pin_hash', 'TEXT DEFAULT NULL');
        self::addColumnIfMissing($pdo, 'settings', 'auth_epoch', 'INTEGER NOT NULL DEFAULT 0');
        self::addColumnIfMissing($pdo, 'recurring_expenses', 'day_of_week', 'INT DEFAULT NULL');
        self::addColumnIfMissing($pdo, 'recurring_expenses', 'day_of_month', 'INT DEFAULT NULL');
        self::addColumnIfMissing($pdo, 'recurring_expenses', 'is_active', 'INT NOT NULL DEFAULT 1');
        self::addColumnIfMissing($pdo, 'recurring_expenses', 'last_applied_cycle', 'TEXT DEFAULT NULL');
        self::addColumnIfMissing($pdo, 'recurring_expenses', 'created_at', 'TEXT DEFAULT NULL');
        self::addColumnIfMissing($pdo, 'expenses', 'note', 'TEXT DEFAULT NULL');
        self::addColumnIfMissing($pdo, 'settings', 'notification_reminder', 'INTEGER NOT NULL DEFAULT 0');
        self::addColumnIfMissing($pdo, 'settings', 'notification_time', "TEXT DEFAULT '20:00'");
        // TEXT defaults are rejected on MySQL < 8.0.13 — use NULL and treat missing as []
        self::addColumnIfMissing($pdo, 'settings', 'favorite_categories', 'TEXT DEFAULT NULL');
        self::addColumnIfMissing($pdo, 'settings', 'onboarding_done', 'INTEGER NOT NULL DEFAULT 0');
        self::addColumnIfMissing($pdo, 'categories', 'is_custom', 'INTEGER NOT NULL DEFAULT 0');
        self::addColumnIfMissing($pdo, 'categories', 'is_hidden', 'INTEGER NOT NULL DEFAULT 0');
        self::applyDefaultDarkMode($pdo);
        self::migrateAmountPrecision($pdo);
    }

    /** Use DECIMAL(12,2) on MySQL so cents are stored exactly */
    private static function migrateAmountPrecision(PDO $pdo): void
    {
        if (self::isSqliteDriver()) {
            return;
        }

        $changes = [
            'expenses' => 'ALTER TABLE expenses MODIFY amount DECIMAL(12,2) NOT NULL',
            'recurring_expenses' => 'ALTER TABLE recurring_expenses MODIFY amount DECIMAL(12,2) NOT NULL',
            'settings' => 'ALTER TABLE settings MODIFY savings_goal DECIMAL(12,2) DEFAULT NULL',
        ];

        foreach ($changes as $sql) {
            try {
                $pdo->exec($sql);
            } catch (PDOException $e) {
                // Column may already be DECIMAL
            }
        }
    }

    /** One-time: enable dark mode as default for existing installs */
    private static function applyDefaultDarkMode(PDO $pdo): void
    {
        self::addColumnIfMissing($pdo, 'settings', 'dark_default_set', 'INTEGER NOT NULL DEFAULT 0');
        $row = $pdo->query('SELECT dark_default_set FROM settings WHERE id = 1')->fetch();
        if (!$row || (int) $row['dark_default_set'] !== 0) {
            return;
        }
        $pdo->exec('UPDATE settings SET dark_mode = 1, dark_default_set = 1 WHERE id = 1');
    }

    /** Safely add column if it does not exist */
    private static function addColumnIfMissing(PDO $pdo, string $table, string $column, string $definition): void
    {
        if (self::isSqliteDriver()) {
            $cols = $pdo->query("PRAGMA table_info({$table})")->fetchAll();
            foreach ($cols as $col) {
                if ($col['name'] === $column) {
                    return;
                }
            }
            $pdo->exec("ALTER TABLE {$table} ADD COLUMN {$column} {$definition}");
            return;
        }

        try {
            $pdo->exec("ALTER TABLE {$table} ADD COLUMN {$column} {$definition}");
        } catch (PDOException $e) {
            // Column already exists on MySQL
        }
    }

    /** Default expense categories */
    private static function expenseCategoryRows(): array
    {
        return [
            ['food', 'Food', '🍔', 'expense', 1],
            ['transport', 'Transport', '🚕', 'expense', 2],
            ['grocery', 'Grocery', '🛒', 'expense', 3],
            ['entertainment', 'Entertainment', '🎮', 'expense', 4],
            ['bills', 'Bills', '🏠', 'expense', 5],
            ['shopping', 'Shopping', '🛍', 'expense', 6],
            ['health', 'Health', '💊', 'expense', 7],
            ['mobile', 'Mobile', '📱', 'expense', 8],
            ['loan', 'Loan', '🏦', 'expense', 9],
            ['bank_fees', 'Bank Fees', '💳', 'expense', 10],
            ['family', 'Family', '👪', 'expense', 11],
            ['personal', 'Personal', '👤', 'expense', 12],
            ['other', 'Other', '📦', 'expense', 13],
        ];
    }

    /** Default income categories */
    private static function incomeCategoryRows(): array
    {
        return [
            ['inc_salary', 'Salary', '💵', 'income', 101],
            ['inc_freelance', 'Freelance', '💼', 'income', 102],
            ['inc_bonus', 'Bonus', '🎉', 'income', 103],
            ['inc_gift', 'Gift', '🎁', 'income', 104],
            ['inc_refund', 'Refund', '↩️', 'income', 105],
            ['inc_other', 'Other', '📦', 'income', 106],
        ];
    }

    /** @return string[] */
    private static function deprecatedCategorySlugs(): array
    {
        return ['coffee'];
    }

    /** Insert a category row or update emoji if slug exists but emoji was corrupted */
    private static function upsertCategory(PDO $pdo, array $cat): void
    {
        [$slug, $name, $emoji, $type, $sortOrder] = $cat;

        $stmt = $pdo->prepare('SELECT id, emoji FROM categories WHERE slug = ?');
        $stmt->execute([$slug]);
        $existing = $stmt->fetch();

        if ($existing) {
            $upd = $pdo->prepare('UPDATE categories SET emoji = ?, name = ?, type = ?, sort_order = ? WHERE slug = ?');
            $upd->execute([$emoji, $name, $type, $sortOrder, $slug]);
            return;
        }

        $ins = $pdo->prepare('
            INSERT INTO categories (slug, name, emoji, type, sort_order) VALUES (?, ?, ?, ?, ?)
        ');
        $ins->execute([$slug, $name, $emoji, $type, $sortOrder]);
    }

    /** Seed expense categories if any are missing */
    private static function seedExpenseCategories(PDO $pdo): void
    {
        $count = (int) $pdo->query("SELECT COUNT(*) FROM categories WHERE type = 'expense'")->fetchColumn();
        if ($count >= count(self::expenseCategoryRows())) {
            self::repairCategoryEmojis($pdo);
            return;
        }

        foreach (self::expenseCategoryRows() as $cat) {
            self::upsertCategory($pdo, $cat);
        }
    }

    /** Seed income categories if any are missing */
    private static function seedIncomeCategories(PDO $pdo): void
    {
        $count = (int) $pdo->query("SELECT COUNT(*) FROM categories WHERE type = 'income'")->fetchColumn();
        if ($count >= count(self::incomeCategoryRows())) {
            self::repairCategoryEmojis($pdo);
            return;
        }

        foreach (self::incomeCategoryRows() as $cat) {
            self::upsertCategory($pdo, $cat);
        }
    }

    /** Fix emoji characters lost to wrong charset during migration */
    private static function repairCategoryEmojis(PDO $pdo): void
    {
        foreach (array_merge(self::expenseCategoryRows(), self::incomeCategoryRows()) as $cat) {
            self::upsertCategory($pdo, $cat);
        }
    }

    /** Insert default settings and categories */
    private static function seedDefaults(PDO $pdo): void
    {
        $count = (int) $pdo->query('SELECT COUNT(*) FROM settings')->fetchColumn();
        if ($count === 0) {
            $stmt = $pdo->prepare('
                INSERT INTO settings (id, monthly_salary, salary_day, currency_symbol, dark_mode, updated_at)
                VALUES (1, 0, 1, ?, 1, ?)
            ');
            $stmt->execute(['Rs.', date('Y-m-d H:i:s')]);
        }

        self::seedExpenseCategories($pdo);
        self::seedIncomeCategories($pdo);
        self::removeDeprecatedCategories($pdo);
    }

    /** Remove categories no longer in the catalog */
    private static function removeDeprecatedCategories(PDO $pdo): void
    {
        $stmt = $pdo->prepare('DELETE FROM categories WHERE slug = ?');
        foreach (self::deprecatedCategorySlugs() as $slug) {
            $stmt->execute([$slug]);
        }
    }
}

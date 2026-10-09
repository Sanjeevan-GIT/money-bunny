-- Money Bunny — patch an older MySQL database (phpMyAdmin)
-- Run this file only. Do not convert charsets in the same run — that can time out on shared hosting.
--
-- Skip charset if category emojis already display correctly in the app.
-- If emojis show as ?, run scripts/fix-charset-optional.sql one table at a time.
-- Fresh installs can use database/schema.sql instead. The app also migrates on startup.

SET NAMES utf8mb4;

-- 1) Sync category catalog (removes Coffee, adds Loan + Bank Fees)
DELETE FROM categories WHERE slug = 'coffee';

INSERT INTO categories (slug, name, emoji, type, sort_order) VALUES
('food', 'Food', '🍔', 'expense', 1),
('transport', 'Transport', '🚕', 'expense', 2),
('grocery', 'Grocery', '🛒', 'expense', 3),
('entertainment', 'Entertainment', '🎮', 'expense', 4),
('bills', 'Bills', '🏠', 'expense', 5),
('shopping', 'Shopping', '🛍', 'expense', 6),
('health', 'Health', '💊', 'expense', 7),
('mobile', 'Mobile', '📱', 'expense', 8),
('loan', 'Loan', '🏦', 'expense', 9),
('bank_fees', 'Bank Fees', '💳', 'expense', 10),
('family', 'Family', '👪', 'expense', 11),
('personal', 'Personal', '👤', 'expense', 12),
('other', 'Other', '📦', 'expense', 13),
('inc_salary', 'Salary', '💵', 'income', 101),
('inc_freelance', 'Freelance', '💼', 'income', 102),
('inc_bonus', 'Bonus', '🎉', 'income', 103),
('inc_gift', 'Gift', '🎁', 'income', 104),
('inc_refund', 'Refund', '↩️', 'income', 105),
('inc_other', 'Other', '📦', 'income', 106)
ON DUPLICATE KEY UPDATE name = VALUES(name), emoji = VALUES(emoji), type = VALUES(type), sort_order = VALUES(sort_order);

-- 2) Complete recurring_expenses table (only adds missing columns)
SET @db = DATABASE();

SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'recurring_expenses' AND COLUMN_NAME = 'day_of_week') = 0,
    'ALTER TABLE recurring_expenses ADD COLUMN day_of_week INT DEFAULT NULL',
    'SELECT ''skip day_of_week'' AS note'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'recurring_expenses' AND COLUMN_NAME = 'day_of_month') = 0,
    'ALTER TABLE recurring_expenses ADD COLUMN day_of_month INT DEFAULT NULL',
    'SELECT ''skip day_of_month'' AS note'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'recurring_expenses' AND COLUMN_NAME = 'is_active') = 0,
    'ALTER TABLE recurring_expenses ADD COLUMN is_active INT NOT NULL DEFAULT 1',
    'SELECT ''skip is_active'' AS note'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'recurring_expenses' AND COLUMN_NAME = 'last_applied_cycle') = 0,
    'ALTER TABLE recurring_expenses ADD COLUMN last_applied_cycle TEXT DEFAULT NULL',
    'SELECT ''skip last_applied_cycle'' AS note'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'recurring_expenses' AND COLUMN_NAME = 'created_at') = 0,
    'ALTER TABLE recurring_expenses ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP',
    'SELECT ''skip created_at'' AS note'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3) Store cents exactly (app also migrates this on load)
ALTER TABLE expenses MODIFY amount DECIMAL(12,2) NOT NULL;
ALTER TABLE recurring_expenses MODIFY amount DECIMAL(12,2) NOT NULL;
ALTER TABLE settings MODIFY savings_goal DECIMAL(12,2) DEFAULT NULL;

-- 4) Daily reminder settings
SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'settings' AND COLUMN_NAME = 'notification_reminder') = 0,
    'ALTER TABLE settings ADD COLUMN notification_reminder INT NOT NULL DEFAULT 0',
    'SELECT ''skip notification_reminder'' AS note'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'settings' AND COLUMN_NAME = 'notification_time') = 0,
    'ALTER TABLE settings ADD COLUMN notification_time VARCHAR(5) DEFAULT ''20:00''',
    'SELECT ''skip notification_time'' AS note'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 5) Optional notes on entries
SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'expenses' AND COLUMN_NAME = 'note') = 0,
    'ALTER TABLE expenses ADD COLUMN note TEXT DEFAULT NULL',
    'SELECT ''skip note'' AS note'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 6) Favorites, onboarding, custom categories
-- (TEXT columns use NULL default — MySQL < 8.0.13 rejects TEXT DEFAULT '[]')
SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'settings' AND COLUMN_NAME = 'favorite_categories') = 0,
    'ALTER TABLE settings ADD COLUMN favorite_categories TEXT DEFAULT NULL',
    'SELECT ''skip favorite_categories'' AS note'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'settings' AND COLUMN_NAME = 'onboarding_done') = 0,
    'ALTER TABLE settings ADD COLUMN onboarding_done INT NOT NULL DEFAULT 0',
    'SELECT ''skip onboarding_done'' AS note'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'categories' AND COLUMN_NAME = 'is_custom') = 0,
    'ALTER TABLE categories ADD COLUMN is_custom INT NOT NULL DEFAULT 0',
    'SELECT ''skip is_custom'' AS note'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'categories' AND COLUMN_NAME = 'is_hidden') = 0,
    'ALTER TABLE categories ADD COLUMN is_hidden INT NOT NULL DEFAULT 0',
    'SELECT ''skip is_hidden'' AS note'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 7) Verify (should show expense=13, income=6, total=19)
SELECT type, COUNT(*) AS cnt FROM categories GROUP BY type;

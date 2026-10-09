-- OPTIONAL — only if category emojis show as ? in the app
-- Shared hosting can time out on full-table charset converts.
-- Run ONE statement below at a time in phpMyAdmin (not all at once).
-- Skip any table that already shows utf8mb4 in: Structure → Collation.

SET NAMES utf8mb4;

-- Step A — small tables (run separately, click Go after each)
-- ALTER TABLE categories CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- ALTER TABLE settings CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Step B — recurring (usually small)
-- ALTER TABLE recurring_expenses CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Step C — expenses last (largest; may still timeout — app works without this if emojis OK)
-- ALTER TABLE expenses CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Check current collations:
SELECT TABLE_NAME, TABLE_COLLATION
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('categories', 'settings', 'expenses', 'recurring_expenses');

-- Money Bunny — empty MySQL schema
-- The app also creates and migrates these tables on first request.
-- SQLite (default) is created automatically at data/moneybunny.db.
-- This file has no personal records. Do not import a live database dump.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS settings (
    id INT PRIMARY KEY,
    monthly_salary DECIMAL(12,2) NOT NULL DEFAULT 0,
    salary_day INT NOT NULL DEFAULT 1,
    currency_symbol VARCHAR(16) NOT NULL DEFAULT 'Rs.',
    savings_goal DECIMAL(12,2) DEFAULT NULL,
    dark_mode INT NOT NULL DEFAULT 1,
    notification_reminder INT NOT NULL DEFAULT 0,
    notification_time VARCHAR(5) DEFAULT '20:00',
    pin_hash TEXT DEFAULT NULL,
    auth_epoch INT NOT NULL DEFAULT 0,
    favorite_categories TEXT DEFAULT NULL,
    onboarding_done INT NOT NULL DEFAULT 0,
    dark_default_set INT NOT NULL DEFAULT 0,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    slug VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(128) NOT NULL,
    emoji VARCHAR(16) NOT NULL,
    type VARCHAR(16) NOT NULL DEFAULT 'expense',
    sort_order INT NOT NULL DEFAULT 0,
    is_custom INT NOT NULL DEFAULT 0,
    is_hidden INT NOT NULL DEFAULT 0
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS expenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    amount DECIMAL(12,2) NOT NULL,
    category VARCHAR(64) NOT NULL,
    type VARCHAR(16) NOT NULL DEFAULT 'expense',
    expense_date DATE NOT NULL,
    note TEXT DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_expenses_date (expense_date),
    INDEX idx_expenses_category (category),
    INDEX idx_expenses_created (created_at),
    INDEX idx_expenses_type (type),
    INDEX idx_expenses_type_date (type, expense_date),
    INDEX idx_expenses_type_cat_date (type, category, expense_date)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS recurring_expenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    amount DECIMAL(12,2) NOT NULL,
    category VARCHAR(64) NOT NULL,
    frequency VARCHAR(16) NOT NULL,
    day_of_week INT DEFAULT NULL,
    day_of_month INT DEFAULT NULL,
    is_active INT NOT NULL DEFAULT 1,
    last_applied_cycle VARCHAR(64) DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO settings (id, monthly_salary, salary_day, currency_symbol, dark_mode, dark_default_set)
VALUES (1, 0, 1, 'Rs.', 1, 1)
ON DUPLICATE KEY UPDATE id = id;

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

<?php
/**
 * Money Bunny - API bootstrap
 * Include this at the top of every API endpoint.
 */

declare(strict_types=1);

require_once dirname(__DIR__) . '/config.php';
require_once dirname(__DIR__) . '/includes/Database.php';
require_once dirname(__DIR__) . '/includes/helpers.php';
require_once dirname(__DIR__) . '/includes/auth.php';

if (APP_DEBUG) {
    ini_set('display_errors', '1');
    error_reporting(E_ALL);
} else {
    ini_set('display_errors', '0');
    error_reporting(0);
}

applyCorsHeaders();

if (requestMethod() === 'OPTIONS') {
    http_response_code(204);
    exit;
}

try {
    $pdo = Database::getConnection();
} catch (Throwable $e) {
    $detail = Database::$lastError !== '' ? Database::$lastError : $e->getMessage();
    // Always include a short safe hint so production can be diagnosed without APP_DEBUG
    $safe = preg_replace('/password=[^;\s]*/i', 'password=***', $detail) ?? $detail;
    $safe = preg_replace('/\b' . preg_quote(DB_MYSQL_PASS, '/') . '\b/', '***', $safe) ?? $safe;
    jsonError('Database connection failed: ' . $safe, 503);
}

if (!isPublicApiEndpoint()) {
    requireAuth($pdo);
    applyRecurringExpenses($pdo);
}

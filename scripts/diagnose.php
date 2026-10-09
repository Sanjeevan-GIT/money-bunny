<?php
/**
 * Quick crash diagnosis — run: php scripts/diagnose.php
 */
error_reporting(E_ALL);
ini_set('display_errors', '1');

echo "PHP " . PHP_VERSION . "\n";

try {
    require dirname(__DIR__) . '/config.php';
    echo "DRIVER=" . DB_DRIVER . "\n";
    echo "VERSION=" . APP_VERSION . "\n";

    require dirname(__DIR__) . '/includes/Database.php';
    require dirname(__DIR__) . '/includes/helpers.php';
    require dirname(__DIR__) . '/includes/auth.php';

    echo "Connecting...\n";
    $pdo = Database::getConnection();
    echo "DB_OK\n";

    echo "needs_setup=" . (needsPinSetup($pdo) ? '1' : '0') . "\n";
    echo "pin_required=" . (isPinRequired($pdo) ? '1' : '0') . "\n";

    $settings = getSettings($pdo);
    echo "settings_ok favorites=" . json_encode($settings['favorite_categories'] ?? null) . "\n";

    $dash = buildDashboardData($pdo);
    echo "dash_ok has_salary=" . ($dash['has_salary'] ? '1' : '0') . " insights=" . (isset($dash['insights']) ? '1' : '0') . "\n";

    $stats = buildStatisticsData($pdo);
    echo "stats_ok\n";

    $backup = buildBackupPayload($pdo);
    echo "backup_ok expenses=" . count($backup['expenses']) . "\n";

    echo "ALL GOOD\n";
} catch (Throwable $e) {
    echo "ERR: " . $e->getMessage() . "\n";
    echo $e->getFile() . ':' . $e->getLine() . "\n";
    echo $e->getTraceAsString() . "\n";
    exit(1);
}

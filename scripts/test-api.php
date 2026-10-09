<?php
/**
 * Extended local smoke tests — run: MB_DB_DRIVER=sqlite php scripts/test-api.php
 * Tip: temporarily rename config.local.php if it forces unreachable MySQL.
 */
require dirname(__DIR__) . '/config.php';
require dirname(__DIR__) . '/includes/helpers.php';
require dirname(__DIR__) . '/includes/Database.php';
require dirname(__DIR__) . '/includes/auth.php';

$pdo = Database::getConnection();
$failures = 0;

function assert_true(bool $cond, string $label): void
{
    global $failures;
    if ($cond) {
        echo "PASS: {$label}\n";
        return;
    }
    echo "FAIL: {$label}\n";
    $failures++;
}

$catCount = (int) $pdo->query('SELECT COUNT(*) FROM categories')->fetchColumn();
assert_true($catCount >= 19, "categories seeded ({$catCount})");

$dash = buildDashboardData($pdo);
assert_true(is_array($dash['cycle']), 'buildDashboardData returns cycle');
assert_true(isset($dash['is_current_view']), 'dashboard has is_current_view');
assert_true(isset($dash['insights']), 'dashboard has insights');
assert_true(isset($dash['insights']['logging_streak'], $dash['insights']['health_score']), 'insights fields present');

$cycles = getAllSalaryCycles($pdo);
assert_true(is_array($cycles), 'getAllSalaryCycles returns array');
if ($dash['has_salary']) {
    assert_true(count($cycles) >= 1, 'at least one salary cycle listed');
    $first = $cycles[0];
    assert_true(isset($first['spent'], $first['saved'], $first['month_label']), 'cycle summary fields');
}

$stats = buildStatisticsData($pdo);
assert_true(isset($stats['by_category'], $stats['daily_spending']), 'buildStatisticsData structure');
assert_true(isset($stats['insights']), 'statistics has insights');

if ($dash['has_salary'] && !empty($cycles)) {
    $pastStart = $cycles[count($cycles) - 1]['start'] ?? null;
    if ($pastStart) {
        $pastDash = buildDashboardData($pdo, $pastStart);
        assert_true($pastDash['cycle']['start'] === $pastStart, 'dashboard cycle_start filter');
        $pastStats = buildStatisticsData($pdo, $pastStart);
        assert_true($pastStats['cycle']['start'] === $pastStart, 'statistics cycle_start filter');
    }
}

$token = issueAuthToken($pdo);
assert_true(validateAuthToken($pdo, $token), 'auth token validates');

$settings = getSettings($pdo);
assert_true(is_array($settings['favorite_categories']), 'favorite_categories is array');
assert_true(array_key_exists('onboarding_done', $settings), 'onboarding_done present');
assert_true(array_key_exists('allow_pin_removal', $settings), 'allow_pin_removal present');

$backup = buildBackupPayload($pdo);
assert_true(($backup['app'] ?? '') === 'Money Bunny', 'backup payload app name');
assert_true(isset($backup['expenses'], $backup['categories']), 'backup has expenses+categories');

$symbol = appCurrencySymbol();
assert_true($symbol === 'Rs.', 'currency symbol is Rs.');

assert_true(defined('APP_VERSION') && APP_VERSION === '1.1.0', 'APP_VERSION is 1.1.0');
assert_true(function_exists('needsPinSetup'), 'needsPinSetup exists');
assert_true(function_exists('checkAuthRateLimit'), 'checkAuthRateLimit exists');

echo $failures === 0 ? "ALL OK ({$catCount} categories)\n" : "FAILED {$failures} check(s)\n";
exit($failures > 0 ? 1 : 0);

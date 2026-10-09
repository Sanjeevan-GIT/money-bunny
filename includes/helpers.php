<?php
/**
 * Money Bunny - Shared helper functions
 */

declare(strict_types=1);

/** Salary income category slug — logging this starts/resets a budget cycle */
define('SALARY_CATEGORY', 'inc_salary');

/** Send JSON response and exit */
function jsonResponse(array $data, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

/** Send JSON error response */
function jsonError(string $message, int $status = 400): never
{
    jsonResponse(['success' => false, 'error' => $message], $status);
}

/** Parse JSON request body */
function getJsonBody(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

/** Get request method */
function requestMethod(): string
{
    return strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
}

/** Format money with currency symbol (2 decimal places) */
function formatMoney(float $amount, string $symbol): string
{
    return $symbol . ' ' . number_format($amount, 2, '.', ',');
}

/** Normalize user-entered amount to 2 decimal places */
function normalizeAmount(mixed $amount): float
{
    return round(max(0, (float) $amount), 2);
}

/** Validate positive amount within sensible limits */
function isValidAmount(float $amount): bool
{
    return $amount > 0 && $amount <= 999999999.99;
}

/** Safe currency label for JSON (always Rs. if config is corrupt) */
function appCurrencySymbol(): string
{
    $s = defined('CURRENCY_SYMBOL') ? (string) CURRENCY_SYMBOL : 'Rs.';
    if ($s === '' || is_numeric($s)) {
        return 'Rs.';
    }
    return $s;
}

/** Empty cycle structure when no salary has been logged */
function emptySalaryCycle(): array
{
    return [
        'start' => null,
        'end' => null,
        'start_display' => '—',
        'end_display' => '—',
        'salary_amount' => 0,
        'salary_date' => null,
        'has_salary' => false,
        'is_open' => true,
        'days_elapsed' => 0,
    ];
}

/**
 * Get the budget cycle containing a reference date.
 * Cycles are defined by Salary income entries — each salary starts a new cycle.
 */
function getSalaryCycle(PDO $pdo, ?string $referenceDate = null): array
{
    $ref = $referenceDate ?? date('Y-m-d');

    $stmt = $pdo->prepare('
        SELECT id, amount, expense_date, created_at
        FROM expenses
        WHERE type = ? AND category = ? AND expense_date <= ?
        ORDER BY expense_date DESC, created_at DESC
        LIMIT 1
    ');
    $stmt->execute(['income', SALARY_CATEGORY, $ref]);
    $startSalary = $stmt->fetch();

    if (!$startSalary) {
        return emptySalaryCycle();
    }

    $start = $startSalary['expense_date'];

    // Next salary after the one that opened this cycle (ignore future-dated salaries)
    $stmt = $pdo->prepare('
        SELECT expense_date, created_at
        FROM expenses
        WHERE type = ? AND category = ?
          AND expense_date <= ?
          AND (
            expense_date > ?
            OR (expense_date = ? AND created_at > ?)
          )
        ORDER BY expense_date ASC, created_at ASC
        LIMIT 1
    ');
    $stmt->execute(['income', SALARY_CATEGORY, $ref, $start, $start, $startSalary['created_at']]);
    $nextSalary = $stmt->fetch();

    if ($nextSalary) {
        $end = (new DateTime($nextSalary['expense_date']))->modify('-1 day')->format('Y-m-d');
        $isOpen = false;
        $endDisplay = (new DateTime($end))->format('j M');
    } else {
        $end = $ref;
        $isOpen = true;
        $endDisplay = 'Now';
    }

    $startDt = new DateTime($start);
    if (!$isOpen) {
        $endDt = new DateTime($end);
        $daysElapsed = max(1, (int) $startDt->diff($endDt)->days + 1);
    } else {
        $refDt = new DateTime(min($ref, $end));
        $daysElapsed = max(1, (int) $startDt->diff($refDt)->days + 1);
    }

    return [
        'start' => $start,
        'end' => $end,
        'start_display' => $startDt->format('j M'),
        'end_display' => $endDisplay,
        'salary_amount' => (float) $startSalary['amount'],
        'salary_id' => (int) $startSalary['id'],
        'salary_date' => $start,
        'has_salary' => true,
        'is_open' => $isOpen,
        'days_elapsed' => $daysElapsed,
    ];
}

/** Get the cycle before the current one */
function getPreviousSalaryCycle(PDO $pdo, ?string $referenceDate = null): array
{
    $current = getSalaryCycle($pdo, $referenceDate);
    if (!$current['has_salary']) {
        return emptySalaryCycle();
    }

    $before = (new DateTime($current['start']))->modify('-1 day')->format('Y-m-d');
    $prev = getSalaryCycle($pdo, $before);

    // Avoid returning the same cycle when only one salary exists
    if ($prev['has_salary'] && $prev['start'] === $current['start']) {
        return emptySalaryCycle();
    }

    return $prev;
}

/** Backward-compatible alias used across API files */
function getSalaryCycleDates(PDO $pdo, ?string $referenceDate = null): array
{
    return getSalaryCycle($pdo, $referenceDate);
}

/** Estimated days left using ~30-day cycle from salary date (open cycles only) */
function getEstimatedDaysLeft(array $cycle): int
{
    if (!$cycle['has_salary']) {
        return 0;
    }
    if (!$cycle['is_open']) {
        $end = new DateTime($cycle['end']);
        $today = new DateTime('today');
        if ($today > $end) {
            return 0;
        }
        return (int) $today->diff($end)->days + 1;
    }

    return max(1, 30 - (int) $cycle['days_elapsed']);
}

/** Load settings row */
function getSettings(PDO $pdo): array
{
    $stmt = $pdo->query('SELECT * FROM settings WHERE id = 1');
    $settings = $stmt->fetch();
    if (!$settings) {
        return [
            'savings_goal' => null,
            'dark_mode' => 1,
            'notification_reminder' => 0,
            'notification_time' => '20:00',
            'favorite_categories' => [],
            'onboarding_done' => 0,
            'allow_pin_removal' => defined('ALLOW_PIN_REMOVAL') && ALLOW_PIN_REMOVAL,
        ];
    }
    $settings['savings_goal'] = $settings['savings_goal'] !== null ? (float) $settings['savings_goal'] : null;
    $settings['dark_mode'] = (int) ($settings['dark_mode'] ?? 1);
    $settings['notification_reminder'] = (int) ($settings['notification_reminder'] ?? 0);
    $settings['notification_time'] = $settings['notification_time'] ?? '20:00';
    $settings['onboarding_done'] = (int) ($settings['onboarding_done'] ?? 0);
    $fav = $settings['favorite_categories'] ?? '[]';
    if (is_string($fav)) {
        $decoded = json_decode($fav, true);
        $settings['favorite_categories'] = is_array($decoded) ? array_values(array_filter($decoded, 'is_string')) : [];
    } elseif (!is_array($fav)) {
        $settings['favorite_categories'] = [];
    }
    $settings['allow_pin_removal'] = defined('ALLOW_PIN_REMOVAL') && ALLOW_PIN_REMOVAL;
    unset($settings['monthly_salary'], $settings['salary_day'], $settings['pin_hash'], $settings['auth_epoch'], $settings['dark_default_set']);
    return $settings;
}

/** Stable key for recurring-expense deduplication (open cycles don't change daily) */
function getCycleKey(array $cycle): string
{
    if (!$cycle['has_salary'] || empty($cycle['start'])) {
        return '';
    }
    if (!empty($cycle['is_open'])) {
        return $cycle['start'] . '_open';
    }
    return $cycle['start'] . '_' . $cycle['end'];
}

/** Validate YYYY-MM-DD date string */
function validateExpenseDate(string $date): bool
{
    $dt = DateTime::createFromFormat('Y-m-d', $date);
    return $dt && $dt->format('Y-m-d') === $date;
}

/** Portable datetime string for bound parameters */
function dbNow(): string
{
    return date('Y-m-d H:i:s');
}

/** Sum amounts between dates for a transaction type */
function sumAmountBetween(PDO $pdo, string $start, string $end, string $type = 'expense'): float
{
    if ($start === null || $end === null) {
        return 0.0;
    }

    $stmt = $pdo->prepare('
        SELECT COALESCE(SUM(amount), 0) AS total
        FROM expenses
        WHERE expense_date >= ? AND expense_date <= ? AND type = ?
    ');
    $stmt->execute([$start, $end, $type]);
    return (float) $stmt->fetchColumn();
}

/** Sum expenses between dates inclusive (expense type only) */
function sumExpensesBetween(PDO $pdo, string $start, string $end): float
{
    return sumAmountBetween($pdo, $start, $end, 'expense');
}

/** Sum non-cycle-opening income in date range (excludes all salary entries) */
function sumExtraIncomeBetween(PDO $pdo, string $start, string $end, ?int $excludeSalaryId = null): float
{
    if ($start === null || $end === null) {
        return 0.0;
    }

    $stmt = $pdo->prepare('
        SELECT COALESCE(SUM(amount), 0) AS total
        FROM expenses
        WHERE expense_date >= ? AND expense_date <= ?
          AND type = ?
          AND category != ?
    ');
    $stmt->execute([$start, $end, 'income', SALARY_CATEGORY]);

    return (float) $stmt->fetchColumn();
}

/** Sum income between dates inclusive (all income types) */
function sumIncomeBetween(PDO $pdo, string $start, string $end): float
{
    return sumAmountBetween($pdo, $start, $end, 'income');
}

/** Validate transaction type */
function normalizeTransactionType(string $type): string
{
    return in_array($type, ['expense', 'income'], true) ? $type : 'expense';
}

/** Check if entry is a salary that starts/resets a cycle */
function isSalaryEntry(string $category, string $type): bool
{
    return $type === 'income' && $category === SALARY_CATEGORY;
}

/** Get category map slug => [name, emoji, type] */
function getCategoryMap(PDO $pdo, ?string $type = null): array
{
    if ($type) {
        $stmt = $pdo->prepare('SELECT slug, name, emoji, type FROM categories WHERE type = ? AND COALESCE(is_hidden, 0) = 0 ORDER BY sort_order');
        $stmt->execute([$type]);
        $rows = $stmt->fetchAll();
    } else {
        $rows = $pdo->query('SELECT slug, name, emoji, type FROM categories WHERE COALESCE(is_hidden, 0) = 0 ORDER BY sort_order')->fetchAll();
    }

    $map = [];
    foreach ($rows as $row) {
        $map[$row['slug']] = [
            'name' => $row['name'],
            'emoji' => $row['emoji'],
            'type' => $row['type'] ?? 'expense',
        ];
    }
    return $map;
}

/** Track recurring expenses applied during this request (for UI feedback) */
function getRecurringAppliedThisRequest(): array
{
    return $GLOBALS['mb_recurring_applied'] ?? [];
}

function noteRecurringApplied(array $item, string $expenseDate): void
{
    if (!isset($GLOBALS['mb_recurring_applied'])) {
        $GLOBALS['mb_recurring_applied'] = [];
    }
    $GLOBALS['mb_recurring_applied'][] = [
        'id' => (int) $item['id'],
        'amount' => round((float) $item['amount'], 2),
        'category' => $item['category'],
        'expense_date' => $expenseDate,
        'frequency' => $item['frequency'],
    ];
}

/** Apply recurring expenses for current cycle if not yet applied (safe on refresh / parallel API calls) */
function applyRecurringExpenses(PDO $pdo): void
{
    static $ranThisRequest = false;
    if ($ranThisRequest) {
        return;
    }
    $ranThisRequest = true;
    $GLOBALS['mb_recurring_applied'] = [];

    try {
        $cycle = getSalaryCycle($pdo);
        if (!$cycle['has_salary']) {
            return;
        }

        $cycleKey = getCycleKey($cycle);

        $stmt = $pdo->query('SELECT * FROM recurring_expenses WHERE is_active = 1');
        $recurring = $stmt->fetchAll();
        $expenseCategories = getCategoryMap($pdo, 'expense');

        $insert = $pdo->prepare('
            INSERT INTO expenses (amount, category, type, expense_date, note, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ');
        $claim = $pdo->prepare('
            UPDATE recurring_expenses
            SET last_applied_cycle = ?
            WHERE id = ? AND COALESCE(last_applied_cycle, \'\') != ?
        ');

        foreach ($recurring as $item) {
            if (($item['last_applied_cycle'] ?? '') === $cycleKey) {
                continue;
            }
            if (!isset($expenseCategories[$item['category']])) {
                continue;
            }

            $expenseDate = $cycle['start'];
            if ($item['frequency'] === 'weekly') {
                $targetDow = (int) ($item['day_of_week'] ?? (int) date('w'));
                $todayDow = (int) date('w');
                if ($targetDow !== $todayDow) {
                    continue;
                }
                $expenseDate = date('Y-m-d');
            } elseif ($item['frequency'] === 'monthly') {
                $targetDom = (int) ($item['day_of_month'] ?? (int) date('j'));
                $todayDom = (int) date('j');
                if ($targetDom !== $todayDom) {
                    continue;
                }
                $expenseDate = date('Y-m-d');
            }

            $pdo->beginTransaction();
            try {
                $claim->execute([$cycleKey, (int) $item['id'], $cycleKey]);
                if ($claim->rowCount() === 0) {
                    $pdo->rollBack();
                    continue;
                }

                $insert->execute([
                    normalizeAmount($item['amount']),
                    $item['category'],
                    'expense',
                    $expenseDate,
                    'Recurring',
                    dbNow(),
                ]);
                $pdo->commit();
                noteRecurringApplied($item, $expenseDate);
            } catch (Throwable $e) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                throw $e;
            }
        }
    } catch (Throwable $e) {
        if (APP_DEBUG) {
            error_log('applyRecurringExpenses: ' . $e->getMessage());
        }
    }
}

/** Resolve optional cycle_start query param to a salary cycle */
function resolveCycleReference(PDO $pdo, ?string $cycleStart): array
{
    if ($cycleStart === null || $cycleStart === '' || $cycleStart === 'current') {
        return getSalaryCycle($pdo);
    }
    if (!validateExpenseDate($cycleStart)) {
        jsonError('Invalid cycle_start (use YYYY-MM-DD)');
    }

    $cycle = getSalaryCycle($pdo, $cycleStart);
    if (!$cycle['has_salary'] || $cycle['start'] !== $cycleStart) {
        jsonError('Salary cycle not found', 404);
    }

    return $cycle;
}

/** Summary metrics for one salary cycle (spent, saved, remaining, etc.) */
function buildCycleSummaryMetrics(PDO $pdo, array $cycle, array $settings): array
{
    if (!$cycle['has_salary']) {
        return [
            'spent' => 0.0,
            'extra_income' => 0.0,
            'saved' => 0.0,
            'remaining' => 0.0,
            'spent_percent' => 0.0,
            'remaining_percent' => 0.0,
        ];
    }

    $spent = sumExpensesBetween($pdo, $cycle['start'], $cycle['end']);
    $extraIncome = sumExtraIncomeBetween(
        $pdo,
        $cycle['start'],
        $cycle['end'],
        (int) ($cycle['salary_id'] ?? 0)
    );
    $savingsGoal = (float) ($settings['savings_goal'] ?? 0);
    $available = max(0, (float) $cycle['salary_amount'] - $savingsGoal);
    $remaining = $available - $spent + $extraIncome;
    $saved = max(0, $remaining);
    $spentPercent = $available > 0 ? min(100, ($spent / $available) * 100) : ($spent > 0 ? 100 : 0);
    $remainingPercent = $available > 0 ? max(0, 100 - $spentPercent) : 0;

    return [
        'spent' => round($spent, 2),
        'extra_income' => round($extraIncome, 2),
        'saved' => round($saved, 2),
        'remaining' => round($remaining, 2),
        'spent_percent' => round($spentPercent, 1),
        'remaining_percent' => round($remainingPercent, 1),
    ];
}

/** List all salary cycles newest first, with summary metrics for filtering UI */
function getAllSalaryCycles(PDO $pdo): array
{
    $stmt = $pdo->prepare('
        SELECT id, amount, expense_date, created_at
        FROM expenses
        WHERE type = ? AND category = ?
        ORDER BY expense_date DESC, created_at DESC
    ');
    $stmt->execute(['income', SALARY_CATEGORY]);
    $salaries = $stmt->fetchAll();

    if (!$salaries) {
        return [];
    }

    // Deduplicate by start date (keep newest salary per day)
    $unique = [];
    foreach ($salaries as $salary) {
        $start = $salary['expense_date'];
        if (!isset($unique[$start])) {
            $unique[$start] = $salary;
        }
    }
    $ordered = array_values($unique);
    $settings = getSettings($pdo);
    $today = date('Y-m-d');
    $cycles = [];

    // Build cycle windows from consecutive salaries (O(N) instead of N×getSalaryCycle)
    for ($i = 0, $n = count($ordered); $i < $n; $i++) {
        $salary = $ordered[$i];
        $start = $salary['expense_date'];
        $next = $i > 0 ? $ordered[$i - 1] : null; // newer salary closes this cycle

        if ($next) {
            $end = (new DateTime($next['expense_date']))->modify('-1 day')->format('Y-m-d');
            $isOpen = false;
            $endDisplay = (new DateTime($end))->format('j M');
            $startDt = new DateTime($start);
            $endDt = new DateTime($end);
            $daysElapsed = max(1, (int) $startDt->diff($endDt)->days + 1);
        } else {
            $end = $today;
            $isOpen = true;
            $endDisplay = 'Now';
            $startDt = new DateTime($start);
            $refDt = new DateTime($today);
            $daysElapsed = max(1, (int) $startDt->diff($refDt)->days + 1);
        }

        $cycle = [
            'start' => $start,
            'end' => $end,
            'start_display' => (new DateTime($start))->format('j M'),
            'end_display' => $endDisplay,
            'salary_amount' => (float) $salary['amount'],
            'salary_date' => $start,
            'salary_id' => (int) $salary['id'],
            'has_salary' => true,
            'is_open' => $isOpen,
            'days_elapsed' => $daysElapsed,
        ];

        $summary = buildCycleSummaryMetrics($pdo, $cycle, $settings);
        $startDt = new DateTime($start);

        $cycles[] = array_merge($cycle, $summary, [
            'label' => $cycle['start_display'] . ' → ' . $cycle['end_display'],
            'month_label' => $startDt->format('M Y'),
            'year' => (int) $startDt->format('Y'),
            'month' => (int) $startDt->format('n'),
        ]);
    }

    return $cycles;
}

/** Build dashboard metrics from salary cycles and transactions */
function buildDashboardData(PDO $pdo, ?string $cycleStart = null): array
{
    if ($cycleStart === null) {
        applyRecurringExpenses($pdo);
    }

    $settings = getSettings($pdo);
    $currencySymbol = appCurrencySymbol();
    $liveCycle = getSalaryCycle($pdo);
    $cycle = $cycleStart ? resolveCycleReference($pdo, $cycleStart) : $liveCycle;
    $isCurrentView = $cycle['has_salary']
        && $liveCycle['has_salary']
        && $cycle['start'] === $liveCycle['start'];

    if (!$cycle['has_salary']) {
        return [
            'remaining_balance' => 0,
            'cycle_salary' => 0,
            'monthly_salary' => 0,
            'spent' => 0,
            'extra_income' => 0,
            'income' => 0,
            'saved' => 0,
            'days_elapsed' => 0,
            'days_left' => 0,
            'daily_safe_spending' => 0,
            'daily_average_spending' => 0,
            'predicted_remaining' => 0,
            'remaining_percent' => 0,
            'spent_percent' => 0,
            'currency_symbol' => $currencySymbol,
            'cycle' => $cycle,
            'has_salary' => false,
            'savings_goal' => $settings['savings_goal'],
            'is_current_view' => false,
            'cycle_start' => null,
            'insights' => emptyInsights(),
            'recurring_applied' => getRecurringAppliedThisRequest(),
        ];
    }

    $summary = buildCycleSummaryMetrics($pdo, $cycle, $settings);
    $cycleSalary = (float) $cycle['salary_amount'];
    $spent = $summary['spent'];
    $extraIncome = $summary['extra_income'];
    $remaining = $summary['remaining'];
    $saved = $summary['saved'];
    $spentPercent = $summary['spent_percent'];
    $remainingPercent = $summary['remaining_percent'];

    $savingsGoal = (float) ($settings['savings_goal'] ?? 0);
    $available = max(0, $cycleSalary - $savingsGoal);

    if (!$cycle['is_open']) {
        $startDt = new DateTime($cycle['start']);
        $endDt = new DateTime($cycle['end']);
        $daysElapsed = max(1, (int) $startDt->diff($endDt)->days + 1);
        $daysLeft = 0;
    } else {
        $daysElapsed = (int) $cycle['days_elapsed'];
        $daysLeft = getEstimatedDaysLeft($cycle);
    }

    $dailyAverage = $spent / max(1, $daysElapsed);
    $safeDaily = $daysLeft > 0 ? max(0, $remaining / $daysLeft) : 0;
    $predictedRemaining = $remaining - ($dailyAverage * max(0, $daysLeft - 1));

    $insights = buildCycleInsights($pdo, $cycle, $summary, $safeDaily, $dailyAverage, $daysLeft, $isCurrentView);

    return [
        'remaining_balance' => round($remaining, 2),
        'cycle_salary' => round($cycleSalary, 2),
        'monthly_salary' => round($cycleSalary, 2),
        'spent' => round($spent, 2),
        'extra_income' => round($extraIncome, 2),
        'income' => round($extraIncome, 2),
        'saved' => round($saved, 2),
        'days_elapsed' => $daysElapsed,
        'days_left' => $daysLeft,
        'daily_safe_spending' => round($safeDaily, 2),
        'daily_average_spending' => round($dailyAverage, 2),
        'predicted_remaining' => round($predictedRemaining, 2),
        'remaining_percent' => round($remainingPercent, 1),
        'spent_percent' => round($spentPercent, 1),
        'currency_symbol' => $currencySymbol,
        'cycle' => $cycle,
        'has_salary' => true,
        'savings_goal' => $settings['savings_goal'],
        'is_current_view' => $isCurrentView,
        'cycle_start' => $cycle['start'],
        'insights' => $insights,
        'recurring_applied' => getRecurringAppliedThisRequest(),
    ];
}

/** Statistics and charts for a salary cycle */
function buildStatisticsData(PDO $pdo, ?string $cycleStart = null): array
{
    $settings = getSettings($pdo);
    $liveCycle = getSalaryCycle($pdo);
    $cycle = $cycleStart ? resolveCycleReference($pdo, $cycleStart) : $liveCycle;
    $isCurrentView = $cycle['has_salary']
        && $liveCycle['has_salary']
        && $cycle['start'] === $liveCycle['start'];
    $today = date('Y-m-d');

    $todayTotal = 0;
    if ($isCurrentView && $cycle['has_salary'] && $today >= $cycle['start'] && $today <= $cycle['end']) {
        $todayTotal = sumExpensesBetween($pdo, $today, $today);
    }

    $weekStart = (new DateTime('monday this week'))->format('Y-m-d');
    $weekEnd = (new DateTime('sunday this week'))->format('Y-m-d');
    $weekTotal = $isCurrentView ? sumExpensesBetween($pdo, $weekStart, $weekEnd) : 0;
    $weekTopCategory = null;

    $lastWeekStart = (new DateTime('monday last week'))->format('Y-m-d');
    $lastWeekEnd = (new DateTime('sunday last week'))->format('Y-m-d');
    $lastWeekTotal = sumExpensesBetween($pdo, $lastWeekStart, $lastWeekEnd);
    $lastWeekTopCategory = null;

    if ($isCurrentView && $weekTotal > 0) {
        $stmt = $pdo->prepare('
            SELECT category, SUM(amount) AS total
            FROM expenses
            WHERE expense_date >= ? AND expense_date <= ? AND type = ?
            GROUP BY category
            ORDER BY total DESC
            LIMIT 1
        ');
        $stmt->execute([$weekStart, $weekEnd, 'expense']);
        $weekRow = $stmt->fetch();
        if ($weekRow) {
            $slug = $weekRow['category'];
            $info = getCategoryMap($pdo)[$slug] ?? ['name' => ucfirst($slug), 'emoji' => '💰'];
            $weekTopCategory = [
                'category' => $slug,
                'name' => $info['name'],
                'emoji' => $info['emoji'],
                'total' => (float) $weekRow['total'],
            ];
        }
    }

    if ($lastWeekTotal > 0) {
        $stmt = $pdo->prepare('
            SELECT category, SUM(amount) AS total
            FROM expenses
            WHERE expense_date >= ? AND expense_date <= ? AND type = ?
            GROUP BY category
            ORDER BY total DESC
            LIMIT 1
        ');
        $stmt->execute([$lastWeekStart, $lastWeekEnd, 'expense']);
        $lastRow = $stmt->fetch();
        if ($lastRow) {
            $slug = $lastRow['category'];
            $info = getCategoryMap($pdo)[$slug] ?? ['name' => ucfirst($slug), 'emoji' => '💰'];
            $lastWeekTopCategory = [
                'category' => $slug,
                'name' => $info['name'],
                'emoji' => $info['emoji'],
                'total' => (float) $lastRow['total'],
            ];
        }
    }

    $summary = buildCycleSummaryMetrics($pdo, $cycle, $settings);
    $cycleTotal = $cycle['has_salary'] ? $summary['spent'] : 0;
    $cycleExtraIncome = $cycle['has_salary'] ? $summary['extra_income'] : 0;
    $cycleSaved = $cycle['has_salary'] ? $summary['saved'] : 0;

    $byCategory = [];
    $topCategory = null;
    $categoryRows = [];

    if ($cycle['has_salary']) {
        $stmt = $pdo->prepare('
            SELECT category, SUM(amount) AS total, COUNT(*) AS count
            FROM expenses
            WHERE expense_date >= ? AND expense_date <= ? AND type = ?
            GROUP BY category
            ORDER BY total DESC
        ');
        $stmt->execute([$cycle['start'], $cycle['end'], 'expense']);
        $categoryRows = $stmt->fetchAll();
    }

    $categoryMap = getCategoryMap($pdo);
    $maxTotal = 0;

    foreach ($categoryRows as $row) {
        $slug = $row['category'];
        $info = $categoryMap[$slug] ?? ['name' => ucfirst($slug), 'emoji' => '💰'];
        $total = (float) $row['total'];
        $entry = [
            'category' => $slug,
            'name' => $info['name'],
            'emoji' => $info['emoji'],
            'total' => $total,
            'count' => (int) $row['count'],
            'percent' => $cycleTotal > 0 ? round(($total / $cycleTotal) * 100, 1) : 0,
        ];
        $byCategory[] = $entry;
        if ($total > $maxTotal) {
            $maxTotal = $total;
            $topCategory = $entry;
        }
    }

    $dailySpending = [];
    if ($cycle['has_salary']) {
        $stmt = $pdo->prepare('
            SELECT expense_date, SUM(amount) AS total
            FROM expenses
            WHERE expense_date >= ? AND expense_date <= ? AND type = ?
            GROUP BY expense_date
            ORDER BY expense_date ASC
        ');
        $stmt->execute([$cycle['start'], $cycle['end'], 'expense']);
        foreach ($stmt->fetchAll() as $row) {
            $dailySpending[] = [
                'date' => $row['expense_date'],
                'total' => (float) $row['total'],
            ];
        }
    }

    $last7Days = [];
    if ($isCurrentView) {
        $sevenDaysAgo = (new DateTime('-6 days'))->format('Y-m-d');
        $stmt = $pdo->prepare('
            SELECT expense_date, SUM(amount) AS total
            FROM expenses
            WHERE expense_date >= ? AND expense_date <= ? AND type = ?
            GROUP BY expense_date
            ORDER BY expense_date ASC
        ');
        $stmt->execute([$sevenDaysAgo, $today, 'expense']);
        $last7Days = array_map(fn($r) => [
            'date' => $r['expense_date'],
            'total' => (float) $r['total'],
        ], $stmt->fetchAll());
    }

    return [
        'today' => $todayTotal,
        'this_week' => $weekTotal,
        'week_top_category' => $weekTopCategory,
        'last_week' => $lastWeekTotal,
        'last_week_top_category' => $lastWeekTopCategory,
        'current_cycle' => $cycleTotal,
        'cycle_extra_income' => $cycleExtraIncome,
        'cycle_saved' => round($cycleSaved, 2),
        'cycle_salary' => $cycle['has_salary'] ? (float) $cycle['salary_amount'] : 0,
        'top_category' => $topCategory,
        'by_category' => $byCategory,
        'daily_spending' => $dailySpending,
        'last_7_days' => $last7Days,
        'cycle' => $cycle,
        'currency_symbol' => appCurrencySymbol(),
        'is_current_view' => $isCurrentView,
        'cycle_start' => $cycle['has_salary'] ? $cycle['start'] : null,
        'insights' => $cycle['has_salary']
            ? buildCycleInsights(
                $pdo,
                $cycle,
                [
                    'spent' => $cycleTotal,
                    'extra_income' => $cycleExtraIncome,
                    'saved' => $cycleSaved,
                    'remaining' => $summary['remaining'] ?? 0,
                    'spent_percent' => $summary['spent_percent'] ?? 0,
                ],
                0,
                $cycleTotal / max(1, (int) ($cycle['days_elapsed'] ?? 1)),
                0,
                $isCurrentView
            )
            : emptyInsights(),
    ];
}

/** Empty insights payload */
function emptyInsights(): array
{
    return [
        'logging_streak' => 0,
        'salary_utilization' => 0,
        'largest_expense' => null,
        'weekend_spent' => 0,
        'weekday_spent' => 0,
        'pace_status' => 'ok',
        'days_until_broke' => null,
        'health_score' => 50,
        'story' => null,
        'top_drains' => [],
    ];
}

/**
 * Lightweight financial awareness for dashboard / stats (not accounting).
 */
function buildCycleInsights(
    PDO $pdo,
    array $cycle,
    array $summary,
    float $safeDaily,
    float $dailyAverage,
    int $daysLeft,
    bool $isCurrentView
): array {
    $insights = emptyInsights();
    if (!$cycle['has_salary']) {
        return $insights;
    }

    $salary = (float) ($cycle['salary_amount'] ?? 0);
    $spent = (float) ($summary['spent'] ?? 0);
    $insights['salary_utilization'] = $salary > 0 ? round(min(100, ($spent / $salary) * 100), 1) : 0;

    // Logging streak: consecutive days (ending today or yesterday) with ≥1 expense
    $stmt = $pdo->query("
        SELECT DISTINCT expense_date FROM expenses
        WHERE type = 'expense'
        ORDER BY expense_date DESC
        LIMIT 60
    ");
    $dates = array_column($stmt->fetchAll(), 'expense_date');
    $streak = 0;
    $cursor = new DateTime('today');
    if ($dates && $dates[0] < $cursor->format('Y-m-d')) {
        // Allow streak to continue if last log was yesterday
        $yesterday = (clone $cursor)->modify('-1 day')->format('Y-m-d');
        if ($dates[0] === $yesterday) {
            $cursor->modify('-1 day');
        } elseif ($dates[0] !== $cursor->format('Y-m-d')) {
            $cursor = null;
        }
    }
    if ($cursor) {
        $set = array_flip($dates);
        while (isset($set[$cursor->format('Y-m-d')])) {
            $streak++;
            $cursor->modify('-1 day');
        }
    }
    $insights['logging_streak'] = $streak;

    // Largest expense + top drains
    $stmt = $pdo->prepare("
        SELECT amount, category, expense_date, note
        FROM expenses
        WHERE expense_date >= ? AND expense_date <= ? AND type = 'expense'
        ORDER BY amount DESC
        LIMIT 1
    ");
    $stmt->execute([$cycle['start'], $cycle['end']]);
    $largest = $stmt->fetch();
    $map = getCategoryMap($pdo);
    if ($largest) {
        $info = $map[$largest['category']] ?? ['name' => $largest['category'], 'emoji' => '💸'];
        $insights['largest_expense'] = [
            'amount' => round((float) $largest['amount'], 2),
            'category' => $largest['category'],
            'name' => $info['name'],
            'emoji' => $info['emoji'],
            'expense_date' => $largest['expense_date'],
            'note' => $largest['note'] ?? null,
        ];
    }

    $stmt = $pdo->prepare("
        SELECT category, SUM(amount) AS total
        FROM expenses
        WHERE expense_date >= ? AND expense_date <= ? AND type = 'expense'
        GROUP BY category
        ORDER BY total DESC
        LIMIT 3
    ");
    $stmt->execute([$cycle['start'], $cycle['end']]);
    foreach ($stmt->fetchAll() as $row) {
        $info = $map[$row['category']] ?? ['name' => $row['category'], 'emoji' => '💸'];
        $insights['top_drains'][] = [
            'category' => $row['category'],
            'name' => $info['name'],
            'emoji' => $info['emoji'],
            'total' => round((float) $row['total'], 2),
        ];
    }

    // Weekend vs weekday
    $stmt = $pdo->prepare("
        SELECT expense_date, SUM(amount) AS total
        FROM expenses
        WHERE expense_date >= ? AND expense_date <= ? AND type = 'expense'
        GROUP BY expense_date
    ");
    $stmt->execute([$cycle['start'], $cycle['end']]);
    $weekend = 0.0;
    $weekday = 0.0;
    foreach ($stmt->fetchAll() as $row) {
        $dow = (int) (new DateTime($row['expense_date']))->format('w');
        if ($dow === 0 || $dow === 6) {
            $weekend += (float) $row['total'];
        } else {
            $weekday += (float) $row['total'];
        }
    }
    $insights['weekend_spent'] = round($weekend, 2);
    $insights['weekday_spent'] = round($weekday, 2);

    // Pace / days until broke
    $remaining = (float) ($summary['remaining'] ?? 0);
    if ($isCurrentView && $dailyAverage > 0 && $remaining > 0) {
        $insights['days_until_broke'] = (int) floor($remaining / $dailyAverage);
    } elseif ($isCurrentView && $remaining <= 0) {
        $insights['days_until_broke'] = 0;
    }

    if ($isCurrentView && $safeDaily > 0) {
        if ($dailyAverage > $safeDaily * 1.15) {
            $insights['pace_status'] = 'fast';
        } elseif ($dailyAverage < $safeDaily * 0.75) {
            $insights['pace_status'] = 'slow';
        } else {
            $insights['pace_status'] = 'ok';
        }
    } elseif ($remaining <= 0 && $isCurrentView) {
        $insights['pace_status'] = 'over';
    }

    // Health score 0–100: pace + utilization + logging
    $score = 70;
    $util = $insights['salary_utilization'];
    if ($util > 95) {
        $score -= 25;
    } elseif ($util > 80) {
        $score -= 10;
    } elseif ($util < 50 && $spent > 0) {
        $score += 5;
    }
    if ($insights['pace_status'] === 'fast') {
        $score -= 15;
    } elseif ($insights['pace_status'] === 'slow') {
        $score += 10;
    } elseif ($insights['pace_status'] === 'over') {
        $score -= 30;
    }
    $score += min(15, $streak * 2);
    $insights['health_score'] = max(0, min(100, $score));

    // One-line story
    if ($insights['pace_status'] === 'fast' && $insights['days_until_broke'] !== null) {
        $insights['story'] = "At this pace, funds last ~{$insights['days_until_broke']} days.";
    } elseif ($insights['pace_status'] === 'over') {
        $insights['story'] = 'Cycle balance is used up — log carefully until next salary.';
    } elseif ($insights['top_drains']) {
        $top = $insights['top_drains'][0];
        $insights['story'] = "{$top['emoji']} {$top['name']} is your top drain this cycle.";
    } elseif ($streak >= 3) {
        $insights['story'] = "🔥 {$streak}-day logging streak — keep it going!";
    }

    return $insights;
}

/**
 * Export full backup JSON (expenses, categories, recurring, non-secret settings).
 */
function buildBackupPayload(PDO $pdo): array
{
    $settings = getSettings($pdo);
    $expenses = $pdo->query('SELECT amount, category, type, expense_date, note, created_at FROM expenses ORDER BY id')->fetchAll();
    $categories = $pdo->query('SELECT slug, name, emoji, type, sort_order, COALESCE(is_custom, 0) AS is_custom, COALESCE(is_hidden, 0) AS is_hidden FROM categories ORDER BY sort_order')->fetchAll();
    $recurring = $pdo->query('SELECT amount, category, frequency, day_of_week, day_of_month, is_active, last_applied_cycle, created_at FROM recurring_expenses ORDER BY id')->fetchAll();

    return [
        'app' => APP_NAME,
        'version' => APP_VERSION,
        'exported_at' => dbNow(),
        'currency_symbol' => appCurrencySymbol(),
        'settings' => [
            'savings_goal' => $settings['savings_goal'],
            'dark_mode' => $settings['dark_mode'],
            'notification_reminder' => $settings['notification_reminder'],
            'notification_time' => $settings['notification_time'],
            'favorite_categories' => $settings['favorite_categories'],
            'onboarding_done' => $settings['onboarding_done'],
        ],
        'categories' => $categories,
        'expenses' => $expenses,
        'recurring_expenses' => $recurring,
    ];
}

/**
 * Import backup JSON. Replaces expenses/recurring; merges custom categories.
 * Does not touch PIN.
 */
function importBackupPayload(PDO $pdo, array $payload): array
{
    if (($payload['app'] ?? '') !== 'Money Bunny' && empty($payload['expenses']) && empty($payload['settings'])) {
        jsonError('Invalid Money Bunny backup file');
    }

    $expenses = $payload['expenses'] ?? [];
    $recurring = $payload['recurring_expenses'] ?? [];
    $categories = $payload['categories'] ?? [];
    $settingsIn = $payload['settings'] ?? [];

    if (!is_array($expenses) || !is_array($recurring)) {
        jsonError('Backup is missing expenses data');
    }

    $pdo->beginTransaction();
    try {
        foreach ($categories as $cat) {
            if (!is_array($cat) || empty($cat['slug']) || empty($cat['name'])) {
                continue;
            }
            $slug = preg_replace('/[^a-z0-9_]/', '', strtolower((string) $cat['slug']));
            if ($slug === '') {
                continue;
            }
            $emoji = mb_substr((string) ($cat['emoji'] ?? '📦'), 0, 8);
            $type = normalizeTransactionType((string) ($cat['type'] ?? 'expense'));
            $sort = (int) ($cat['sort_order'] ?? 200);
            $isCustom = (int) ($cat['is_custom'] ?? 1);
            $exists = $pdo->prepare('SELECT id FROM categories WHERE slug = ?');
            $exists->execute([$slug]);
            if ($exists->fetch()) {
                continue;
            }
            $ins = $pdo->prepare('INSERT INTO categories (slug, name, emoji, type, sort_order, is_custom) VALUES (?, ?, ?, ?, ?, ?)');
            $ins->execute([$slug, mb_substr((string) $cat['name'], 0, 40), $emoji, $type, $sort, $isCustom]);
        }

        $pdo->exec('DELETE FROM expenses');
        $pdo->exec('DELETE FROM recurring_expenses');

        $insExp = $pdo->prepare('INSERT INTO expenses (amount, category, type, expense_date, note, created_at) VALUES (?, ?, ?, ?, ?, ?)');
        $imported = 0;
        foreach ($expenses as $row) {
            if (!is_array($row)) {
                continue;
            }
            $amount = normalizeAmount($row['amount'] ?? 0);
            $date = (string) ($row['expense_date'] ?? '');
            if (!isValidAmount($amount) || !validateExpenseDate($date)) {
                continue;
            }
            $type = normalizeTransactionType((string) ($row['type'] ?? 'expense'));
            $cat = (string) ($row['category'] ?? 'other');
            $note = isset($row['note']) && $row['note'] !== '' ? mb_substr((string) $row['note'], 0, 200) : null;
            $created = (string) ($row['created_at'] ?? dbNow());
            $insExp->execute([$amount, $cat, $type, $date, $note, $created]);
            $imported++;
        }

        $insRec = $pdo->prepare('
            INSERT INTO recurring_expenses (amount, category, frequency, day_of_week, day_of_month, is_active, last_applied_cycle, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ');
        foreach ($recurring as $row) {
            if (!is_array($row)) {
                continue;
            }
            $amount = normalizeAmount($row['amount'] ?? 0);
            $freq = ($row['frequency'] ?? '') === 'weekly' ? 'weekly' : 'monthly';
            if (!isValidAmount($amount)) {
                continue;
            }
            $insRec->execute([
                $amount,
                (string) ($row['category'] ?? 'other'),
                $freq,
                $row['day_of_week'] ?? null,
                $row['day_of_month'] ?? null,
                (int) ($row['is_active'] ?? 1),
                $row['last_applied_cycle'] ?? null,
                (string) ($row['created_at'] ?? dbNow()),
            ]);
        }

        if (is_array($settingsIn)) {
            $fields = [];
            $params = [];
            if (array_key_exists('savings_goal', $settingsIn)) {
                $fields[] = 'savings_goal = ?';
                $params[] = $settingsIn['savings_goal'] === null || $settingsIn['savings_goal'] === ''
                    ? null
                    : normalizeAmount($settingsIn['savings_goal']);
            }
            if (isset($settingsIn['dark_mode'])) {
                $fields[] = 'dark_mode = ?';
                $params[] = (int) (bool) $settingsIn['dark_mode'];
            }
            if (isset($settingsIn['favorite_categories']) && is_array($settingsIn['favorite_categories'])) {
                $fields[] = 'favorite_categories = ?';
                $params[] = json_encode(array_values(array_slice($settingsIn['favorite_categories'], 0, 8)));
            }
            if (isset($settingsIn['onboarding_done'])) {
                $fields[] = 'onboarding_done = ?';
                $params[] = (int) (bool) $settingsIn['onboarding_done'];
            }
            if ($fields) {
                $fields[] = 'updated_at = ?';
                $params[] = dbNow();
                $pdo->prepare('UPDATE settings SET ' . implode(', ', $fields) . ' WHERE id = 1')->execute($params);
            }
        }

        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        jsonError('Import failed: ' . (APP_DEBUG ? $e->getMessage() : 'could not restore backup'));
    }

    return ['imported_expenses' => $imported ?? 0];
}
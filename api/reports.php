<?php
/**
 * API: Reports - cycle summaries and CSV export
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$method = requestMethod();
$settings = getSettings($pdo);
$categoryMap = getCategoryMap($pdo);

if ($method === 'GET' && isset($_GET['export']) && $_GET['export'] === 'csv') {
    $cycleType = $_GET['cycle'] ?? 'current';
    $cycle = $cycleType === 'previous'
        ? getPreviousSalaryCycle($pdo)
        : getSalaryCycle($pdo);

    if (!$cycle['has_salary']) {
        jsonError('No salary cycle to export', 404);
    }

    $stmt = $pdo->prepare('
        SELECT * FROM expenses
        WHERE expense_date >= ? AND expense_date <= ?
        ORDER BY expense_date ASC, created_at ASC
    ');
    $stmt->execute([$cycle['start'], $cycle['end']]);
    $rows = $stmt->fetchAll();

    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="money-bunny-' . $cycle['start'] . '.csv"');

    $out = fopen('php://output', 'w');
    fputcsv($out, ['Date', 'Type', 'Category', 'Amount', 'Note', 'Created At']);

    foreach ($rows as $row) {
        $info = $categoryMap[$row['category']] ?? ['name' => $row['category']];
        fputcsv($out, [
            $row['expense_date'],
            $row['type'] ?? 'expense',
            $info['name'],
            $row['amount'],
            $row['note'] ?? '',
            $row['created_at'],
        ]);
    }
    fclose($out);
    exit;
}

if ($method !== 'GET') {
    jsonError('Method not allowed', 405);
}

function buildCycleReport(PDO $pdo, array $cycle, array $settings, array $categoryMap): array
{
    if (!$cycle['has_salary']) {
        return [
            'cycle' => $cycle,
            'salary' => 0,
            'spent' => 0,
            'extra_income' => 0,
            'saved' => 0,
            'remaining' => 0,
            'expense_count' => 0,
            'breakdown' => [],
        ];
    }

    $spent = sumExpensesBetween($pdo, $cycle['start'], $cycle['end']);
    $extraIncome = sumExtraIncomeBetween(
        $pdo,
        $cycle['start'],
        $cycle['end'],
        (int) ($cycle['salary_id'] ?? 0)
    );
    $cycleSalary = (float) $cycle['salary_amount'];
    $savingsGoal = (float) ($settings['savings_goal'] ?? 0);
    $available = $cycleSalary - $savingsGoal;
    $remaining = $available - $spent + $extraIncome;

    $stmt = $pdo->prepare('
        SELECT category, SUM(amount) AS total, COUNT(*) AS count
        FROM expenses
        WHERE expense_date >= ? AND expense_date <= ? AND type = ?
        GROUP BY category
        ORDER BY total DESC
    ');
    $stmt->execute([$cycle['start'], $cycle['end'], 'expense']);

    $breakdown = [];
    foreach ($stmt->fetchAll() as $row) {
        $info = $categoryMap[$row['category']] ?? ['name' => $row['category'], 'emoji' => '💰'];
        $breakdown[] = [
            'category' => $row['category'],
            'name' => $info['name'],
            'emoji' => $info['emoji'],
            'total' => (float) $row['total'],
            'count' => (int) $row['count'],
        ];
    }

    $stmt = $pdo->prepare('SELECT COUNT(*) FROM expenses WHERE expense_date >= ? AND expense_date <= ? AND type = ?');
    $stmt->execute([$cycle['start'], $cycle['end'], 'expense']);
    $expenseCount = (int) $stmt->fetchColumn();

    return [
        'cycle' => $cycle,
        'salary' => round($cycleSalary, 2),
        'spent' => round($spent, 2),
        'extra_income' => round($extraIncome, 2),
        'saved' => round(max(0, $remaining), 2),
        'remaining' => round($remaining, 2),
        'expense_count' => $expenseCount,
        'breakdown' => $breakdown,
    ];
}

$current = buildCycleReport($pdo, getSalaryCycle($pdo), $settings, $categoryMap);
$previous = buildCycleReport($pdo, getPreviousSalaryCycle($pdo), $settings, $categoryMap);

jsonResponse([
    'success' => true,
    'data' => [
        'current' => $current,
        'previous' => $previous,
        'currency_symbol' => appCurrencySymbol(),
    ],
]);

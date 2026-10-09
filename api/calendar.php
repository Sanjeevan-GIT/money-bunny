<?php
/**
 * API: Calendar - spending highlights by day
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

if (requestMethod() !== 'GET') {
    jsonError('Method not allowed', 405);
}

$year = (int) ($_GET['year'] ?? date('Y'));
$month = (int) ($_GET['month'] ?? date('n'));
$year = max(2000, min(2100, $year));
$month = max(1, min(12, $month));

$start = sprintf('%04d-%02d-01', $year, $month);
$end = (new DateTime($start))->modify('last day of this month')->format('Y-m-d');

$stmt = $pdo->prepare('
    SELECT expense_date, SUM(amount) AS total, COUNT(*) AS count
    FROM expenses
    WHERE expense_date >= ? AND expense_date <= ? AND type = ?
    GROUP BY expense_date
');
$stmt->execute([$start, $end, 'expense']);
$rows = $stmt->fetchAll();

$days = [];
foreach ($rows as $row) {
    $days[$row['expense_date']] = [
        'total' => round((float) $row['total'], 2),
        'count' => (int) $row['count'],
    ];
}

// Day detail when date param provided
$date = $_GET['date'] ?? null;
$dayExpenses = null;
if ($date) {
    $categoryMap = getCategoryMap($pdo);
    $stmt = $pdo->prepare('
        SELECT * FROM expenses WHERE expense_date = ?
        ORDER BY created_at DESC
    ');
    $stmt->execute([$date]);
    $dayExpenses = array_map(function ($row) use ($categoryMap) {
        $info = $categoryMap[$row['category']] ?? ['name' => ucfirst($row['category']), 'emoji' => '💰'];
        return [
            'id' => (int) $row['id'],
            'amount' => round((float) $row['amount'], 2),
            'type' => normalizeTransactionType($row['type'] ?? 'expense'),
            'category' => $row['category'],
            'category_name' => $info['name'],
            'emoji' => $info['emoji'],
            'expense_date' => $row['expense_date'],
        ];
    }, $stmt->fetchAll());
}

jsonResponse([
    'success' => true,
    'data' => [
        'year' => $year,
        'month' => $month,
        'days' => $days,
        'expenses' => $dayExpenses,
    ],
]);

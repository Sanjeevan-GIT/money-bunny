<?php
/**
 * API: Search expenses by amount, category, or date
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

if (requestMethod() !== 'GET') {
    jsonError('Method not allowed', 405);
}

$query = trim($_GET['q'] ?? '');
$category = trim($_GET['category'] ?? '');
$dateFrom = trim($_GET['date_from'] ?? '');
$dateTo = trim($_GET['date_to'] ?? '');
$amount = isset($_GET['amount']) ? (float) $_GET['amount'] : null;

$categoryMap = getCategoryMap($pdo);
$conditions = [];
$params = [];
$queryMatched = false;

if ($query !== '') {
    if (is_numeric($query)) {
        $conditions[] = 'amount = ?';
        $params[] = (float) $query;
        $queryMatched = true;
    } else {
        $orParts = [];
        $like = '%' . $query . '%';
        $orParts[] = 'note LIKE ?';
        $params[] = $like;

        $matchingSlugs = [];
        foreach ($categoryMap as $slug => $info) {
            if (
                stripos($slug, $query) !== false
                || stripos($info['name'], $query) !== false
            ) {
                $matchingSlugs[] = $slug;
            }
        }
        if (!empty($matchingSlugs)) {
            $placeholders = implode(',', array_fill(0, count($matchingSlugs), '?'));
            $orParts[] = "category IN ($placeholders)";
            $params = array_merge($params, $matchingSlugs);
        }

        $parsed = DateTime::createFromFormat('Y-m-d', $query)
            ?: DateTime::createFromFormat('d/m/Y', $query)
            ?: DateTime::createFromFormat('d-m-Y', $query);
        if ($parsed) {
            $orParts[] = 'expense_date = ?';
            $params[] = $parsed->format('Y-m-d');
        }

        if (empty($orParts)) {
            jsonResponse(['success' => true, 'data' => [], 'count' => 0]);
        }

        $conditions[] = '(' . implode(' OR ', $orParts) . ')';
        $queryMatched = true;
    }

    if (!$queryMatched) {
        jsonResponse(['success' => true, 'data' => [], 'count' => 0]);
    }
}

if ($category !== '' && isset($categoryMap[$category])) {
    $conditions[] = 'category = ?';
    $params[] = $category;
}

if ($dateFrom !== '') {
    if (!validateExpenseDate($dateFrom)) {
        jsonError('Invalid date_from (use YYYY-MM-DD)');
    }
    $conditions[] = 'expense_date >= ?';
    $params[] = $dateFrom;
}

if ($dateTo !== '') {
    if (!validateExpenseDate($dateTo)) {
        jsonError('Invalid date_to (use YYYY-MM-DD)');
    }
    $conditions[] = 'expense_date <= ?';
    $params[] = $dateTo;
}

if ($amount !== null && $amount > 0) {
    $conditions[] = 'amount = ?';
    $params[] = $amount;
}

$sql = 'SELECT * FROM expenses';
if (!empty($conditions)) {
    $sql .= ' WHERE ' . implode(' AND ', $conditions);
}
$sql .= ' ORDER BY expense_date DESC, created_at DESC LIMIT 100';

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$rows = $stmt->fetchAll();

$data = array_map(function ($row) use ($categoryMap) {
    $slug = $row['category'];
    $info = $categoryMap[$slug] ?? ['name' => ucfirst($slug), 'emoji' => '💰'];
    return [
        'id' => (int) $row['id'],
        'amount' => round((float) $row['amount'], 2),
        'type' => normalizeTransactionType($row['type'] ?? 'expense'),
        'category' => $slug,
        'category_name' => $info['name'],
        'emoji' => $info['emoji'],
        'expense_date' => $row['expense_date'],
        'note' => isset($row['note']) && $row['note'] !== '' ? (string) $row['note'] : null,
        'created_at' => $row['created_at'],
    ];
}, $rows);

jsonResponse(['success' => true, 'data' => $data, 'count' => count($data)]);

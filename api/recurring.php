<?php
/**
 * API: Recurring expenses
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$method = requestMethod();
$categoryMap = getCategoryMap($pdo);

function enrichRecurring(array $row, array $categoryMap): array
{
    $slug = $row['category'];
    $info = $categoryMap[$slug] ?? ['name' => ucfirst($slug), 'emoji' => '💰'];
    return [
        'id' => (int) $row['id'],
        'amount' => round((float) $row['amount'], 2),
        'category' => $slug,
        'category_name' => $info['name'],
        'emoji' => $info['emoji'],
        'frequency' => $row['frequency'],
        'day_of_week' => $row['day_of_week'] !== null ? (int) $row['day_of_week'] : null,
        'day_of_month' => $row['day_of_month'] !== null ? (int) $row['day_of_month'] : null,
        'is_active' => (int) $row['is_active'],
    ];
}

switch ($method) {
    case 'GET':
        $rows = $pdo->query('SELECT * FROM recurring_expenses ORDER BY created_at DESC')->fetchAll();
        $data = array_map(fn($r) => enrichRecurring($r, $categoryMap), $rows);
        jsonResponse(['success' => true, 'data' => $data]);
        break;

    case 'POST':
        $body = getJsonBody();
        $amount = normalizeAmount($body['amount'] ?? 0);
        $category = trim($body['category'] ?? '');
        $frequency = $body['frequency'] ?? 'monthly';

        if (!isValidAmount($amount)) {
            jsonError('Amount must be greater than zero');
        }
        if (!isset($categoryMap[$category]) || ($categoryMap[$category]['type'] ?? 'expense') !== 'expense') {
            jsonError('Invalid expense category');
        }
        if (!in_array($frequency, ['weekly', 'monthly'], true)) {
            jsonError('Frequency must be weekly or monthly');
        }

        $dayOfWeek = $frequency === 'weekly' ? (int) ($body['day_of_week'] ?? (int) date('w')) : null;
        $dayOfMonth = $frequency === 'monthly' ? (int) ($body['day_of_month'] ?? (int) date('j')) : null;

        $stmt = $pdo->prepare('
            INSERT INTO recurring_expenses (amount, category, frequency, day_of_week, day_of_month, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, 1, ?)
        ');
        $stmt->execute([$amount, $category, $frequency, $dayOfWeek, $dayOfMonth, dbNow()]);

        $id = (int) $pdo->lastInsertId();
        $stmt = $pdo->prepare('SELECT * FROM recurring_expenses WHERE id = ?');
        $stmt->execute([$id]);
        jsonResponse(['success' => true, 'data' => enrichRecurring($stmt->fetch(), $categoryMap)], 201);
        break;

    case 'PUT':
        $body = getJsonBody();
        $id = (int) ($body['id'] ?? 0);
        if ($id <= 0) {
            jsonError('Invalid ID');
        }

        $updates = [];
        $params = [];

        if (isset($body['amount'])) {
            $amountVal = normalizeAmount($body['amount']);
            if (!isValidAmount($amountVal)) {
                jsonError('Amount must be greater than zero');
            }
            $updates[] = 'amount = ?';
            $params[] = $amountVal;
        }
        if (isset($body['category'])) {
            if (!isset($categoryMap[$body['category']]) || ($categoryMap[$body['category']]['type'] ?? '') !== 'expense') {
                jsonError('Invalid expense category');
            }
            $updates[] = 'category = ?';
            $params[] = $body['category'];
        }
        if (isset($body['frequency']) && in_array($body['frequency'], ['weekly', 'monthly'], true)) {
            $updates[] = 'frequency = ?';
            $params[] = $body['frequency'];
        }
        if (isset($body['is_active'])) {
            $updates[] = 'is_active = ?';
            $params[] = (int) (bool) $body['is_active'];
        }

        if (empty($updates)) {
            jsonError('Nothing to update');
        }

        $params[] = $id;
        $stmt = $pdo->prepare('UPDATE recurring_expenses SET ' . implode(', ', $updates) . ' WHERE id = ?');
        $stmt->execute($params);

        $stmt = $pdo->prepare('SELECT * FROM recurring_expenses WHERE id = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) {
            jsonError('Not found', 404);
        }
        jsonResponse(['success' => true, 'data' => enrichRecurring($row, $categoryMap)]);
        break;

    case 'DELETE':
        $id = (int) ($_GET['id'] ?? getJsonBody()['id'] ?? 0);
        if ($id <= 0) {
            jsonError('Invalid ID');
        }
        $stmt = $pdo->prepare('DELETE FROM recurring_expenses WHERE id = ?');
        $stmt->execute([$id]);
        if ($stmt->rowCount() === 0) {
            jsonError('Not found', 404);
        }
        jsonResponse(['success' => true]);
        break;

    default:
        jsonError('Method not allowed', 405);
}

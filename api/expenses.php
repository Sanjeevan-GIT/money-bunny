<?php
/**
 * API: Expenses CRUD
 * GET    - list (grouped or filtered)
 * POST   - create
 * PUT    - update
 * DELETE - remove
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$method = requestMethod();
$categoryMap = getCategoryMap($pdo);

/** Enrich expense row with category display info */
function enrichExpense(array $row, array $categoryMap): array
{
    $slug = $row['category'];
    $info = $categoryMap[$slug] ?? ['name' => ucfirst($slug), 'emoji' => '💰', 'type' => 'expense'];
    $type = normalizeTransactionType($row['type'] ?? $info['type'] ?? 'expense');
    return [
        'id' => (int) $row['id'],
        'amount' => round((float) $row['amount'], 2),
        'type' => $type,
        'category' => $slug,
        'category_name' => $info['name'],
        'emoji' => $info['emoji'],
        'expense_date' => $row['expense_date'],
        'note' => isset($row['note']) && $row['note'] !== '' ? (string) $row['note'] : null,
        'created_at' => $row['created_at'],
    ];
}

switch ($method) {
    case 'GET':
        $id = isset($_GET['id']) ? (int) $_GET['id'] : 0;
        $date = $_GET['date'] ?? null;
        $cycle = isset($_GET['cycle']) && $_GET['cycle'] === 'current';
        $cycleStart = $_GET['cycle_start'] ?? null;
        $limit = min(500, max(1, (int) ($_GET['limit'] ?? 100)));
        $offset = max(0, (int) ($_GET['offset'] ?? 0));
        $grouped = isset($_GET['grouped']) && $_GET['grouped'] === '1';

        if ($cycleStart) {
            $cycleDates = resolveCycleReference($pdo, $cycleStart);
        } else {
            $cycleDates = getSalaryCycle($pdo);
        }

        if ($id > 0) {
            $stmt = $pdo->prepare('SELECT * FROM expenses WHERE id = ?');
            $stmt->execute([$id]);
            $row = $stmt->fetch();
            if (!$row) {
                jsonError('Expense not found', 404);
            }
            jsonResponse(['success' => true, 'data' => enrichExpense($row, $categoryMap)]);
        }

        if ($date) {
            $stmt = $pdo->prepare('
                SELECT * FROM expenses WHERE expense_date = ?
                ORDER BY created_at DESC
            ');
            $stmt->execute([$date]);
        } elseif ($cycle || $cycleStart) {
            if (!$cycleDates['has_salary']) {
                jsonResponse(['success' => true, 'data' => [], 'cycle' => $cycleDates]);
            }
            $stmt = $pdo->prepare('
                SELECT * FROM expenses
                WHERE expense_date >= ? AND expense_date <= ?
                ORDER BY expense_date DESC, created_at DESC
                LIMIT ' . (int) $limit . ' OFFSET ' . (int) $offset . '
            ');
            $stmt->execute([$cycleDates['start'], $cycleDates['end']]);
        } else {
            $stmt = $pdo->prepare('
                SELECT * FROM expenses
                ORDER BY expense_date DESC, created_at DESC
                LIMIT ' . (int) $limit . ' OFFSET ' . (int) $offset . '
            ');
            $stmt->execute([]);
        }

        $rows = $stmt->fetchAll();
        $expenses = array_map(fn($r) => enrichExpense($r, $categoryMap), $rows);

        if ($grouped) {
            $groupedData = [];
            foreach ($expenses as $exp) {
                $groupedData[$exp['expense_date']][] = $exp;
            }
            jsonResponse(['success' => true, 'data' => $groupedData, 'cycle' => $cycleDates]);
        }

        jsonResponse(['success' => true, 'data' => $expenses, 'cycle' => $cycleDates]);
        break;

    case 'POST':
        $body = getJsonBody();
        $amount = normalizeAmount($body['amount'] ?? 0);
        $category = trim($body['category'] ?? '');
        $type = normalizeTransactionType($body['type'] ?? 'expense');
        $expenseDate = $body['expense_date'] ?? date('Y-m-d');
        $note = isset($body['note']) ? trim((string) $body['note']) : null;
        if ($note === '') {
            $note = null;
        }
        if ($note !== null && mb_strlen($note) > 200) {
            jsonError('Note must be 200 characters or less');
        }

        if (!validateExpenseDate($expenseDate)) {
            jsonError('Invalid date format (use YYYY-MM-DD)');
        }

        if (!isValidAmount($amount)) {
            jsonError('Amount must be greater than zero');
        }
        if ($category === '') {
            jsonError('Category is required');
        }
        if (!isset($categoryMap[$category])) {
            jsonError('Invalid category');
        }
        if (($categoryMap[$category]['type'] ?? 'expense') !== $type) {
            jsonError('Category does not match transaction type');
        }

        $cycleReset = isSalaryEntry($category, $type);
        $salaryReplaced = false;

        if ($cycleReset) {
            $stmt = $pdo->prepare('
                SELECT COUNT(*) FROM expenses
                WHERE type = ? AND category = ? AND expense_date = ?
            ');
            $stmt->execute(['income', SALARY_CATEGORY, $expenseDate]);
            $salaryReplaced = (int) $stmt->fetchColumn() > 0;
        }

        $stmt = $pdo->prepare('
            INSERT INTO expenses (amount, category, type, expense_date, note, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ');
        $stmt->execute([$amount, $category, $type, $expenseDate, $note, dbNow()]);
        $id = (int) $pdo->lastInsertId();

        $stmt = $pdo->prepare('SELECT * FROM expenses WHERE id = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch();

        jsonResponse([
            'success' => true,
            'data' => enrichExpense($row, $categoryMap),
            'dashboard' => buildDashboardData($pdo),
            'cycle_reset' => $cycleReset,
            'salary_replaced' => $salaryReplaced,
            'cycle' => getSalaryCycle($pdo),
        ], 201);
        break;

    case 'PUT':
        $body = getJsonBody();
        $id = (int) ($body['id'] ?? 0);
        $amount = normalizeAmount($body['amount'] ?? 0);
        $category = trim($body['category'] ?? '');
        $type = isset($body['type']) ? normalizeTransactionType($body['type']) : null;
        $expenseDate = $body['expense_date'] ?? null;

        if ($id <= 0) {
            jsonError('Invalid expense ID');
        }
        if (!isValidAmount($amount)) {
            jsonError('Amount must be greater than zero');
        }
        if ($category !== '' && !isset($categoryMap[$category])) {
            jsonError('Invalid category');
        }

        $stmt = $pdo->prepare('SELECT * FROM expenses WHERE id = ?');
        $stmt->execute([$id]);
        $existing = $stmt->fetch();
        if (!$existing) {
            jsonError('Expense not found', 404);
        }

        $newCategory = $category !== '' ? $category : $existing['category'];
        $newDate = $expenseDate ?? $existing['expense_date'];
        $newType = $type ?? normalizeTransactionType($existing['type'] ?? 'expense');
        $newNote = array_key_exists('note', $body)
            ? (trim((string) ($body['note'] ?? '')) ?: null)
            : ($existing['note'] ?? null);
        if ($newNote !== null && mb_strlen($newNote) > 200) {
            jsonError('Note must be 200 characters or less');
        }

        if (!validateExpenseDate($newDate)) {
            jsonError('Invalid date format (use YYYY-MM-DD)');
        }

        $wasSalary = isSalaryEntry($existing['category'], $existing['type'] ?? 'expense');
        if ($wasSalary && !isSalaryEntry($newCategory, $newType)) {
            jsonError('Cannot change a salary entry to another type. Delete it instead.');
        }
        if ($wasSalary && $newDate !== $existing['expense_date']) {
            jsonError('Cannot change the date on a salary entry. Delete and re-add instead.');
        }

        if ($category !== '' && ($categoryMap[$newCategory]['type'] ?? 'expense') !== $newType) {
            jsonError('Category does not match transaction type');
        }

        $stmt = $pdo->prepare('
            UPDATE expenses SET amount = ?, category = ?, type = ?, expense_date = ?, note = ?
            WHERE id = ?
        ');
        $stmt->execute([$amount, $newCategory, $newType, $newDate, $newNote, $id]);

        $stmt = $pdo->prepare('SELECT * FROM expenses WHERE id = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        $cycleReset = isSalaryEntry($newCategory, $newType);

        jsonResponse([
            'success' => true,
            'data' => enrichExpense($row, $categoryMap),
            'dashboard' => buildDashboardData($pdo),
            'cycle_reset' => $cycleReset,
            'was_salary' => $wasSalary,
        ]);
        break;

    case 'DELETE':
        $id = (int) ($_GET['id'] ?? getJsonBody()['id'] ?? 0);
        if ($id <= 0) {
            jsonError('Invalid expense ID');
        }

        $stmt = $pdo->prepare('SELECT * FROM expenses WHERE id = ?');
        $stmt->execute([$id]);
        $existing = $stmt->fetch();
        if (!$existing) {
            jsonError('Expense not found', 404);
        }

        $wasSalary = isSalaryEntry($existing['category'], $existing['type'] ?? 'expense');

        $stmt = $pdo->prepare('DELETE FROM expenses WHERE id = ?');
        $stmt->execute([$id]);

        jsonResponse([
            'success' => true,
            'dashboard' => buildDashboardData($pdo),
            'was_salary' => $wasSalary,
            'cycle' => getSalaryCycle($pdo),
        ]);
        break;

    default:
        jsonError('Method not allowed', 405);
}

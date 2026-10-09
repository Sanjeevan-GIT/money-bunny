<?php
/**
 * API: Backup export / import + CSV import
 * GET  ?action=export — JSON backup download
 * POST action=import — restore JSON backup
 * POST action=import_csv — append expenses from CSV text
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$method = requestMethod();

if ($method === 'GET') {
    $action = $_GET['action'] ?? 'export';
    if ($action !== 'export') {
        jsonError('Unknown action');
    }

    $payload = buildBackupPayload($pdo);
    header('Content-Type: application/json; charset=utf-8');
    header('Content-Disposition: attachment; filename="money-bunny-backup-' . date('Y-m-d') . '.json"');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

if ($method === 'POST') {
    $body = getJsonBody();
    $action = $body['action'] ?? 'import';

    if ($action === 'import') {
        $payload = $body['backup'] ?? $body;
        if (isset($payload['backup']) && is_array($payload['backup'])) {
            $payload = $payload['backup'];
        }
        $result = importBackupPayload($pdo, $payload);
        jsonResponse([
            'success' => true,
            'data' => $result,
            'dashboard' => buildDashboardData($pdo),
        ]);
    }

    if ($action === 'import_csv') {
        $csv = (string) ($body['csv'] ?? '');
        if (trim($csv) === '') {
            jsonError('CSV content is empty');
        }

        $lines = preg_split('/\r\n|\r|\n/', $csv) ?: [];
        $header = null;
        $imported = 0;
        $map = getCategoryMap($pdo);
        $ins = $pdo->prepare('
            INSERT INTO expenses (amount, category, type, expense_date, note, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ');

        foreach ($lines as $i => $line) {
            if (trim($line) === '') {
                continue;
            }
            $cols = str_getcsv($line);
            if ($header === null) {
                $header = array_map(static fn($h) => strtolower(trim((string) $h)), $cols);
                continue;
            }
            $row = [];
            foreach ($header as $idx => $key) {
                $row[$key] = $cols[$idx] ?? '';
            }

            $date = trim((string) ($row['date'] ?? $row['expense_date'] ?? ''));
            $type = normalizeTransactionType(strtolower(trim((string) ($row['type'] ?? 'expense'))));
            $amount = normalizeAmount($row['amount'] ?? 0);
            $catRaw = trim((string) ($row['category'] ?? 'other'));
            $note = trim((string) ($row['note'] ?? ''));

            // Resolve category by slug or name
            $slug = $catRaw;
            if (!isset($map[$slug])) {
                $found = null;
                foreach ($map as $s => $info) {
                    if (strcasecmp($info['name'], $catRaw) === 0 && ($info['type'] ?? 'expense') === $type) {
                        $found = $s;
                        break;
                    }
                }
                $slug = $found ?? ($type === 'income' ? 'inc_other' : 'other');
            }

            if (!validateExpenseDate($date) || !isValidAmount($amount)) {
                continue;
            }

            $ins->execute([
                $amount,
                $slug,
                $type,
                $date,
                $note !== '' ? mb_substr($note, 0, 200) : null,
                dbNow(),
            ]);
            $imported++;
        }

        jsonResponse([
            'success' => true,
            'data' => ['imported' => $imported],
            'dashboard' => buildDashboardData($pdo),
        ]);
    }

    jsonError('Unknown action');
}

jsonError('Method not allowed', 405);

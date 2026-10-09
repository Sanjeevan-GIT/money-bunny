<?php
/**
 * API: Dashboard metrics for current salary cycle
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

if (requestMethod() !== 'GET') {
    jsonError('Method not allowed', 405);
}

$data = buildDashboardData($pdo, $_GET['cycle_start'] ?? null);
jsonResponse(['success' => true, 'data' => $data]);

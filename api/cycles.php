<?php
/**
 * API: List salary cycles with summary metrics for filtering
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

if (requestMethod() !== 'GET') {
    jsonError('Method not allowed', 405);
}

$cycles = getAllSalaryCycles($pdo);
$liveCycle = getSalaryCycle($pdo);

jsonResponse([
    'success' => true,
    'data' => $cycles,
    'current_start' => $liveCycle['has_salary'] ? $liveCycle['start'] : null,
]);

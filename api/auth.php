<?php
/**
 * API: PIN authentication
 * GET  - auth status
 * POST - login with PIN, returns token
 * PUT  - set/change PIN (first setup allowed without token)
 * DELETE - remove PIN (requires current PIN) — disabled when REQUIRE_PIN is on
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$method = requestMethod();
$token = $_SERVER['HTTP_X_MB_TOKEN'] ?? '';

switch ($method) {
    case 'GET':
        jsonResponse([
            'success' => true,
            'data' => [
                'pin_required' => isPinRequired($pdo),
                'needs_setup' => needsPinSetup($pdo),
                'authenticated' => isPinRequired($pdo) && validateAuthToken($pdo, $token),
                'token_ttl_days' => (int) (authTokenTtl() / 86400),
            ],
        ]);
        break;

    case 'POST':
        $lockSeconds = checkAuthRateLimit();
        if ($lockSeconds > 0) {
            $mins = (int) ceil($lockSeconds / 60);
            jsonError("Too many attempts — try again in {$mins} min", 429);
        }

        if (needsPinSetup($pdo)) {
            jsonError('Set up a PIN first', 403);
        }

        $body = getJsonBody();
        $pin = trim($body['pin'] ?? '');

        if ($pin === '') {
            jsonError('PIN is required');
        }

        if (!verifyPin($pdo, $pin)) {
            recordAuthFailure();
            jsonError('Incorrect PIN', 403);
        }

        clearAuthFailures();

        jsonResponse([
            'success' => true,
            'data' => [
                'token' => issueAuthToken($pdo),
                'pin_required' => true,
            ],
        ]);
        break;

    case 'PUT':
        $lockSeconds = checkAuthRateLimit();
        if ($lockSeconds > 0) {
            $mins = (int) ceil($lockSeconds / 60);
            jsonError("Too many attempts — try again in {$mins} min", 429);
        }

        $body = getJsonBody();
        $newPin = trim($body['pin'] ?? '');
        $oldPin = trim($body['old_pin'] ?? '');
        $confirm = trim($body['confirm'] ?? $body['pin_confirm'] ?? $newPin);

        if ($newPin === '' || $newPin !== $confirm) {
            jsonError('PIN confirmation does not match');
        }

        if (isPinRequired($pdo)) {
            if (!validateAuthToken($pdo, $token)) {
                jsonError('Authentication required', 401);
            }
            if ($oldPin === '' || !verifyPin($pdo, $oldPin)) {
                recordAuthFailure();
                jsonError('Current PIN is incorrect', 403);
            }
        }

        setPin($pdo, $newPin);
        clearAuthFailures();

        jsonResponse([
            'success' => true,
            'data' => [
                'token' => issueAuthToken($pdo),
                'pin_required' => true,
            ],
        ]);
        break;

    case 'DELETE':
        if (defined('ALLOW_PIN_REMOVAL') && !ALLOW_PIN_REMOVAL) {
            jsonError('PIN cannot be removed on this install', 403);
        }
        if (!isPinRequired($pdo)) {
            jsonError('No PIN is set');
        }
        if (!validateAuthToken($pdo, $token)) {
            jsonError('Authentication required', 401);
        }
        $body = getJsonBody();
        $pin = trim($body['pin'] ?? '');
        if (!verifyPin($pdo, $pin)) {
            recordAuthFailure();
            jsonError('Incorrect PIN', 403);
        }
        clearPin($pdo);
        jsonResponse(['success' => true]);
        break;

    default:
        jsonError('Method not allowed', 405);
}

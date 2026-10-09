<?php
/**
 * Money Bunny - PIN authentication helpers
 */

declare(strict_types=1);

/** Check if PIN is configured */
function isPinRequired(PDO $pdo): bool
{
    $stmt = $pdo->query('SELECT pin_hash FROM settings WHERE id = 1');
    $row = $stmt->fetch();
    return !empty($row['pin_hash']);
}

/** True until the owner completes first-time PIN setup */
function needsPinSetup(PDO $pdo): bool
{
    return !isPinRequired($pdo);
}

/** Current auth epoch — bumped when PIN changes to invalidate old tokens */
function getAuthEpoch(PDO $pdo): int
{
    $stmt = $pdo->query('SELECT auth_epoch FROM settings WHERE id = 1');
    $row = $stmt->fetch();
    return (int) ($row['auth_epoch'] ?? 0);
}

/** Bump auth epoch after PIN change */
function bumpAuthEpoch(PDO $pdo): void
{
    $stmt = $pdo->prepare('UPDATE settings SET auth_epoch = COALESCE(auth_epoch, 0) + 1, updated_at = ? WHERE id = 1');
    $stmt->execute([dbNow()]);
}

/** Auth attempt rate-limit file (per IP) */
function authRateLimitPath(): string
{
    $dir = dirname(__DIR__) . '/data';
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
    return $dir . '/auth_rate_limit.json';
}

/** Load rate-limit state */
function loadAuthRateLimit(): array
{
    $path = authRateLimitPath();
    if (!is_file($path)) {
        return [];
    }
    $raw = @file_get_contents($path);
    $data = json_decode((string) $raw, true);
    return is_array($data) ? $data : [];
}

/** Persist rate-limit state */
function saveAuthRateLimit(array $data): void
{
    $path = authRateLimitPath();
    @file_put_contents($path, json_encode($data), LOCK_EX);
}

/** Client IP for rate limiting */
function clientIpAddress(): string
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    return preg_replace('/[^0-9a-fA-F:.]/', '', $ip) ?: '0.0.0.0';
}

/**
 * Enforce PIN attempt limits (5 fails / 15 min per IP).
 * Returns remaining lockout seconds, or 0 if allowed.
 */
function checkAuthRateLimit(): int
{
    $ip = clientIpAddress();
    $now = time();
    $window = 900;
    $maxFails = 5;
    $data = loadAuthRateLimit();
    $entry = $data[$ip] ?? ['fails' => [], 'locked_until' => 0];

    if (($entry['locked_until'] ?? 0) > $now) {
        return (int) ($entry['locked_until'] - $now);
    }

    $entry['fails'] = array_values(array_filter(
        $entry['fails'] ?? [],
        static fn($t) => is_int($t) && $t > ($now - $window)
    ));
    $data[$ip] = $entry;
    saveAuthRateLimit($data);
    return 0;
}

/** Record a failed PIN attempt; may lock the IP */
function recordAuthFailure(): void
{
    $ip = clientIpAddress();
    $now = time();
    $window = 900;
    $maxFails = 5;
    $data = loadAuthRateLimit();
    $entry = $data[$ip] ?? ['fails' => [], 'locked_until' => 0];
    $entry['fails'] = array_values(array_filter(
        $entry['fails'] ?? [],
        static fn($t) => is_int($t) && $t > ($now - $window)
    ));
    $entry['fails'][] = $now;
    if (count($entry['fails']) >= $maxFails) {
        $entry['locked_until'] = $now + $window;
        $entry['fails'] = [];
    }
    $data[$ip] = $entry;
    saveAuthRateLimit($data);
}

/** Clear failures after successful login */
function clearAuthFailures(): void
{
    $ip = clientIpAddress();
    $data = loadAuthRateLimit();
    unset($data[$ip]);
    saveAuthRateLimit($data);
}

/** Verify PIN against stored hash */
function verifyPin(PDO $pdo, string $pin): bool
{
    $stmt = $pdo->query('SELECT pin_hash FROM settings WHERE id = 1');
    $row = $stmt->fetch();
    if (empty($row['pin_hash'])) {
        return false;
    }
    return password_verify($pin, $row['pin_hash']);
}

/** Set or change PIN (4–6 digits) */
function setPin(PDO $pdo, string $pin): void
{
    if (!preg_match('/^\d{4,6}$/', $pin)) {
        jsonError('PIN must be 4–6 digits');
    }
    $hash = password_hash($pin, PASSWORD_DEFAULT);
    $stmt = $pdo->prepare('UPDATE settings SET pin_hash = ?, updated_at = ? WHERE id = 1');
    $stmt->execute([$hash, dbNow()]);
    bumpAuthEpoch($pdo);
}

/** Remove PIN protection */
function clearPin(PDO $pdo): void
{
    $stmt = $pdo->prepare('UPDATE settings SET pin_hash = NULL, updated_at = ? WHERE id = 1');
    $stmt->execute([dbNow()]);
    bumpAuthEpoch($pdo);
}

/** Token lifetime in seconds (7 days) */
function authTokenTtl(): int
{
    return defined('AUTH_TOKEN_TTL') ? (int) AUTH_TOKEN_TTL : 86400 * 7;
}

/** Issue signed auth token */
function issueAuthToken(PDO $pdo): string
{
    $payload = base64_encode(json_encode([
        'exp' => time() + authTokenTtl(),
        'uid' => 1,
        'epoch' => getAuthEpoch($pdo),
    ]));
    $sig = hash_hmac('sha256', $payload, AUTH_SECRET);
    return $payload . '.' . $sig;
}

/** Validate auth token from request header */
function validateAuthToken(PDO $pdo, string $token): bool
{
    if ($token === '' || !str_contains($token, '.')) {
        return false;
    }
    [$payload, $sig] = explode('.', $token, 2);
    if (!hash_equals(hash_hmac('sha256', $payload, AUTH_SECRET), $sig)) {
        return false;
    }
    $data = json_decode(base64_decode($payload), true);
    if (!is_array($data) || ($data['exp'] ?? 0) <= time()) {
        return false;
    }
    return (int) ($data['epoch'] ?? -1) === getAuthEpoch($pdo);
}

/**
 * Require valid auth for all data APIs.
 * Until a PIN is set, only auth.php may be called (setup flow).
 */
function requireAuth(PDO $pdo): void
{
    if (needsPinSetup($pdo)) {
        jsonError('PIN setup required', 401);
    }

    $token = $_SERVER['HTTP_X_MB_TOKEN'] ?? '';
    if (validateAuthToken($pdo, $token)) {
        return;
    }

    jsonError('Authentication required', 401);
}

/** Endpoints that skip auth check */
function isPublicApiEndpoint(): bool
{
    $script = basename($_SERVER['SCRIPT_NAME'] ?? '');
    return in_array($script, ['auth.php'], true);
}

/** Same-origin CORS origin for this request, or empty */
function requestOrigin(): string
{
    return trim($_SERVER['HTTP_ORIGIN'] ?? '');
}

/** Apply CORS headers (same-origin preferred) */
function applyCorsHeaders(): void
{
    $origin = requestOrigin();
    $host = $_SERVER['HTTP_HOST'] ?? '';
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $self = $scheme . '://' . $host;

    if ($origin !== '' && (
        $origin === $self
        || str_starts_with($origin, 'http://localhost')
        || str_starts_with($origin, 'http://127.0.0.1')
    )) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
    } elseif ($origin === '') {
        // Same-origin browser requests often omit Origin
        header('Access-Control-Allow-Origin: ' . $self);
    }
    // Cross-origin strangers get no ACAO — browser blocks credentialed calls
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, X-MB-Token');
}

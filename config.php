<?php
/**
 * Money Bunny - Application Configuration
 *
 * Default: SQLite (local). For MySQL, copy config.local.php.example
 * to config.local.php or set MB_* environment variables.
 *
 * Remote MySQL is often reachable only from the web server, not from your PC.
 * Locally, unreachable MySQL auto-falls back to SQLite (see Database.php).
 */

declare(strict_types=1);

$cfg = [
    'DB_DRIVER' => getenv('MB_DB_DRIVER') ?: 'sqlite',
    'DB_SQLITE_PATH' => __DIR__ . '/data/moneybunny.db',
    'DB_MYSQL_HOST' => getenv('MB_DB_HOST') ?: 'localhost',
    'DB_MYSQL_PORT' => (int) (getenv('MB_DB_PORT') ?: 3306),
    'DB_MYSQL_NAME' => getenv('MB_DB_NAME') ?: '',
    'DB_MYSQL_USER' => getenv('MB_DB_USER') ?: '',
    'DB_MYSQL_PASS' => getenv('MB_DB_PASS') ?: '',
    'DB_MYSQL_CHARSET' => 'utf8mb4',
    'APP_NAME' => 'Money Bunny',
    'APP_VERSION' => '1.2.0',
    'CURRENCY_SYMBOL' => 'Rs.',
    'AUTH_SECRET' => getenv('MB_AUTH_SECRET') ?: '',
    'AUTH_TOKEN_TTL' => (int) (getenv('MB_AUTH_TOKEN_TTL') ?: 604800),
    'ALLOW_PIN_REMOVAL' => getenv('MB_ALLOW_PIN_REMOVAL') === '1',
    'TIMEZONE' => 'Asia/Colombo',
    'APP_DEBUG' => getenv('MB_DEBUG') === '1',
];

$localConfig = __DIR__ . '/config.local.php';
if (is_file($localConfig)) {
    $local = require $localConfig;
    if (is_array($local)) {
        // Accept alternate key names (db_host / db_name / etc.)
        $aliases = [
            'db_host' => 'DB_MYSQL_HOST',
            'db_port' => 'DB_MYSQL_PORT',
            'db_name' => 'DB_MYSQL_NAME',
            'db_user' => 'DB_MYSQL_USER',
            'db_pass' => 'DB_MYSQL_PASS',
            'mysql' => 'DB_DRIVER',
        ];
        foreach ($aliases as $from => $to) {
            if (array_key_exists($from, $local) && !array_key_exists($to, $local)) {
                $local[$to] = $local[$from];
            }
        }
        if (isset($local['DB_DRIVER']) && $local['DB_DRIVER'] === true) {
            $local['DB_DRIVER'] = 'mysql';
        }
        // If mysql credentials are present without an explicit driver, use mysql
        if (!isset($local['DB_DRIVER']) && (
            !empty($local['DB_MYSQL_HOST']) || !empty($local['db_host'])
        )) {
            $local['DB_DRIVER'] = 'mysql';
        }
        $cfg = array_merge($cfg, $local);
    }
}

// Env vars win over config.local.php so local SQLite works without renaming the file:
//   MB_DB_DRIVER=sqlite php -S localhost:8080
$envOverrides = [
    'MB_DB_DRIVER' => 'DB_DRIVER',
    'MB_DB_HOST' => 'DB_MYSQL_HOST',
    'MB_DB_PORT' => 'DB_MYSQL_PORT',
    'MB_DB_NAME' => 'DB_MYSQL_NAME',
    'MB_DB_USER' => 'DB_MYSQL_USER',
    'MB_DB_PASS' => 'DB_MYSQL_PASS',
    'MB_AUTH_SECRET' => 'AUTH_SECRET',
];
foreach ($envOverrides as $envKey => $cfgKey) {
    $val = getenv($envKey);
    if ($val !== false && $val !== '') {
        $cfg[$cfgKey] = $cfgKey === 'DB_MYSQL_PORT' ? (int) $val : $val;
    }
}
if (getenv('MB_DEBUG') === '1') {
    $cfg['APP_DEBUG'] = true;
}
if (getenv('MB_ALLOW_PIN_REMOVAL') === '1') {
    $cfg['ALLOW_PIN_REMOVAL'] = true;
}

if ($cfg['AUTH_SECRET'] === '') {
    $cfg['AUTH_SECRET'] = 'dev-only-change-me-' . $cfg['APP_VERSION'];
}

define('DB_DRIVER', $cfg['DB_DRIVER']);
define('DB_SQLITE_PATH', $cfg['DB_SQLITE_PATH']);
define('DB_MYSQL_HOST', $cfg['DB_MYSQL_HOST']);
define('DB_MYSQL_PORT', (int) ($cfg['DB_MYSQL_PORT'] ?? 3306));
define('DB_MYSQL_NAME', $cfg['DB_MYSQL_NAME']);
define('DB_MYSQL_USER', $cfg['DB_MYSQL_USER']);
define('DB_MYSQL_PASS', $cfg['DB_MYSQL_PASS']);
define('DB_MYSQL_CHARSET', $cfg['DB_MYSQL_CHARSET']);
define('APP_NAME', $cfg['APP_NAME']);
define('APP_VERSION', $cfg['APP_VERSION']);
define('CURRENCY_SYMBOL', $cfg['CURRENCY_SYMBOL']);
define('AUTH_SECRET', $cfg['AUTH_SECRET']);
define('AUTH_TOKEN_TTL', (int) ($cfg['AUTH_TOKEN_TTL'] ?? 604800));
define('ALLOW_PIN_REMOVAL', !empty($cfg['ALLOW_PIN_REMOVAL']));
define('TIMEZONE', $cfg['TIMEZONE']);
define('APP_DEBUG', $cfg['APP_DEBUG']);

date_default_timezone_set(TIMEZONE);

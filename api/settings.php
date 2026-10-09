<?php
/**
 * API: Application settings
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$method = requestMethod();

switch ($method) {
    case 'GET':
        $settings = getSettings($pdo);
        $cycle = getSalaryCycle($pdo);
        jsonResponse([
            'success' => true,
            'data' => $settings,
            'cycle' => $cycle,
        ]);
        break;

    case 'PUT':
    case 'POST':
        $body = getJsonBody();

        $fields = [];
        $params = [];

        if (array_key_exists('savings_goal', $body)) {
            $fields[] = 'savings_goal = ?';
            $params[] = $body['savings_goal'] === null || $body['savings_goal'] === ''
                ? null
                : normalizeAmount($body['savings_goal']);
        }
        if (isset($body['dark_mode'])) {
            $fields[] = 'dark_mode = ?';
            $params[] = (int) (bool) $body['dark_mode'];
        }
        if (isset($body['notification_reminder'])) {
            $fields[] = 'notification_reminder = ?';
            $params[] = (int) (bool) $body['notification_reminder'];
        }
        if (isset($body['notification_time'])) {
            $fields[] = 'notification_time = ?';
            $params[] = preg_match('/^\d{2}:\d{2}$/', $body['notification_time'])
                ? $body['notification_time']
                : '20:00';
        }
        if (isset($body['favorite_categories']) && is_array($body['favorite_categories'])) {
            $favs = [];
            foreach ($body['favorite_categories'] as $slug) {
                if (is_string($slug) && preg_match('/^[a-z0-9_]{1,40}$/', $slug)) {
                    $favs[] = $slug;
                }
            }
            $fields[] = 'favorite_categories = ?';
            $params[] = json_encode(array_values(array_unique(array_slice($favs, 0, 8))));
        }
        if (isset($body['onboarding_done'])) {
            $fields[] = 'onboarding_done = ?';
            $params[] = (int) (bool) $body['onboarding_done'];
        }

        if (empty($fields)) {
            jsonError('No valid fields to update');
        }

        $fields[] = 'updated_at = ?';
        $params[] = dbNow();
        $sql = 'UPDATE settings SET ' . implode(', ', $fields) . ' WHERE id = 1';
        try {
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
        } catch (PDOException $e) {
            jsonError('Could not save settings — try refreshing the page or run the DB update script.');
        }

        $settings = getSettings($pdo);
        jsonResponse([
            'success' => true,
            'data' => $settings,
            'cycle' => getSalaryCycle($pdo),
        ]);
        break;

    default:
        jsonError('Method not allowed', 405);
}

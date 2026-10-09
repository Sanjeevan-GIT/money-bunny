<?php
/**
 * API: Categories list + custom category CRUD
 * GET    - list
 * POST   - create custom category
 * PUT    - rename / reorder / hide
 * DELETE - remove custom category (or hide built-in)
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$method = requestMethod();

switch ($method) {
    case 'GET':
        $type = null;
        if (isset($_GET['type'])) {
            $typeParam = trim($_GET['type']);
            if (!in_array($typeParam, ['expense', 'income'], true)) {
                jsonError('Invalid type (use expense or income)');
            }
            $type = $typeParam;
        }

        $includeHidden = isset($_GET['all']) && $_GET['all'] === '1';

        if ($type) {
            $sql = 'SELECT id, slug, name, emoji, type, sort_order, COALESCE(is_custom, 0) AS is_custom, COALESCE(is_hidden, 0) AS is_hidden
                    FROM categories WHERE type = ?';
            if (!$includeHidden) {
                $sql .= ' AND COALESCE(is_hidden, 0) = 0';
            }
            $sql .= ' ORDER BY sort_order';
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$type]);
            $rows = $stmt->fetchAll();
        } else {
            $sql = 'SELECT id, slug, name, emoji, type, sort_order, COALESCE(is_custom, 0) AS is_custom, COALESCE(is_hidden, 0) AS is_hidden
                    FROM categories';
            if (!$includeHidden) {
                $sql .= ' WHERE COALESCE(is_hidden, 0) = 0';
            }
            $sql .= ' ORDER BY sort_order';
            $rows = $pdo->query($sql)->fetchAll();
        }

        $data = array_map(static function ($row) {
            return [
                'id' => (int) $row['id'],
                'slug' => $row['slug'],
                'name' => $row['name'],
                'emoji' => $row['emoji'],
                'type' => $row['type'] ?? 'expense',
                'sort_order' => (int) $row['sort_order'],
                'is_custom' => (int) $row['is_custom'] === 1,
                'is_hidden' => (int) $row['is_hidden'] === 1,
            ];
        }, $rows);

        jsonResponse(['success' => true, 'data' => $data]);
        break;

    case 'POST':
        $body = getJsonBody();
        $name = trim((string) ($body['name'] ?? ''));
        $emoji = trim((string) ($body['emoji'] ?? '📦'));
        $type = normalizeTransactionType((string) ($body['type'] ?? 'expense'));

        if ($name === '' || mb_strlen($name) > 40) {
            jsonError('Category name required (max 40 chars)');
        }
        $emoji = mb_substr($emoji !== '' ? $emoji : '📦', 0, 8);

        $base = preg_replace('/[^a-z0-9]+/', '_', strtolower($name));
        $base = trim((string) $base, '_') ?: 'custom';
        if ($type === 'income' && !str_starts_with($base, 'inc_')) {
            $base = 'inc_' . $base;
        }
        $slug = $base;
        $n = 1;
        while (true) {
            $check = $pdo->prepare('SELECT id FROM categories WHERE slug = ?');
            $check->execute([$slug]);
            if (!$check->fetch()) {
                break;
            }
            $slug = $base . '_' . $n;
            $n++;
            if ($n > 50) {
                jsonError('Could not create unique category slug');
            }
        }

        $maxSort = (int) $pdo->query("SELECT COALESCE(MAX(sort_order), 0) FROM categories WHERE type = " . $pdo->quote($type))->fetchColumn();
        $ins = $pdo->prepare('
            INSERT INTO categories (slug, name, emoji, type, sort_order, is_custom, is_hidden)
            VALUES (?, ?, ?, ?, ?, 1, 0)
        ');
        $ins->execute([$slug, $name, $emoji, $type, $maxSort + 1]);

        jsonResponse([
            'success' => true,
            'data' => [
                'id' => (int) $pdo->lastInsertId(),
                'slug' => $slug,
                'name' => $name,
                'emoji' => $emoji,
                'type' => $type,
                'sort_order' => $maxSort + 1,
                'is_custom' => true,
                'is_hidden' => false,
            ],
        ], 201);
        break;

    case 'PUT':
        $body = getJsonBody();
        $slug = trim((string) ($body['slug'] ?? ''));
        if ($slug === '') {
            jsonError('slug is required');
        }

        $stmt = $pdo->prepare('SELECT * FROM categories WHERE slug = ?');
        $stmt->execute([$slug]);
        $row = $stmt->fetch();
        if (!$row) {
            jsonError('Category not found', 404);
        }

        $fields = [];
        $params = [];
        if (isset($body['name'])) {
            $name = trim((string) $body['name']);
            if ($name === '' || mb_strlen($name) > 40) {
                jsonError('Invalid name');
            }
            $fields[] = 'name = ?';
            $params[] = $name;
        }
        if (isset($body['emoji'])) {
            $fields[] = 'emoji = ?';
            $params[] = mb_substr(trim((string) $body['emoji']) ?: '📦', 0, 8);
        }
        if (isset($body['sort_order'])) {
            $fields[] = 'sort_order = ?';
            $params[] = (int) $body['sort_order'];
        }
        if (isset($body['is_hidden'])) {
            $fields[] = 'is_hidden = ?';
            $params[] = (int) (bool) $body['is_hidden'];
        }

        if (!$fields) {
            jsonError('No valid fields to update');
        }

        $params[] = $slug;
        $pdo->prepare('UPDATE categories SET ' . implode(', ', $fields) . ' WHERE slug = ?')->execute($params);

        $stmt->execute([$slug]);
        $updated = $stmt->fetch();
        jsonResponse([
            'success' => true,
            'data' => [
                'slug' => $updated['slug'],
                'name' => $updated['name'],
                'emoji' => $updated['emoji'],
                'type' => $updated['type'],
                'sort_order' => (int) $updated['sort_order'],
                'is_custom' => (int) ($updated['is_custom'] ?? 0) === 1,
                'is_hidden' => (int) ($updated['is_hidden'] ?? 0) === 1,
            ],
        ]);
        break;

    case 'DELETE':
        $slug = trim((string) ($_GET['slug'] ?? getJsonBody()['slug'] ?? ''));
        if ($slug === '' || $slug === SALARY_CATEGORY) {
            jsonError('Cannot delete this category');
        }

        $stmt = $pdo->prepare('SELECT * FROM categories WHERE slug = ?');
        $stmt->execute([$slug]);
        $row = $stmt->fetch();
        if (!$row) {
            jsonError('Category not found', 404);
        }

        if ((int) ($row['is_custom'] ?? 0) === 1) {
            // Remap expenses to other/inc_other then delete
            $fallback = ($row['type'] ?? 'expense') === 'income' ? 'inc_other' : 'other';
            $pdo->prepare('UPDATE expenses SET category = ? WHERE category = ?')->execute([$fallback, $slug]);
            $pdo->prepare('UPDATE recurring_expenses SET category = ? WHERE category = ?')->execute([$fallback, $slug]);
            $pdo->prepare('DELETE FROM categories WHERE slug = ?')->execute([$slug]);
        } else {
            $pdo->prepare('UPDATE categories SET is_hidden = 1 WHERE slug = ?')->execute([$slug]);
        }

        jsonResponse(['success' => true]);
        break;

    default:
        jsonError('Method not allowed', 405);
}

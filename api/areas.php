<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/areas.php';
require_once __DIR__ . '/../includes/audit.php';

header('Content-Type: application/json; charset=utf-8');

function respond(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function fail(string $message, int $status = 400): void
{
    respond(['ok' => false, 'error' => $message], $status);
}

function user_id(): int
{
    $user = current_user();

    return (int) ($user['id'] ?? 0);
}

if (!is_logged_in()) {
    fail('Tu sesión expiró. Vuelve a iniciar sesión.', 401);
}

if (!refresh_session_user()) {
    logout_user();
    fail('Tu cuenta fue desactivada o ya no existe. Vuelve a iniciar sesión.', 401);
}
if (must_change_password()) {
    fail('Debes cambiar tu contraseña antes de continuar.', 403);
}

$method = $_SERVER['REQUEST_METHOD'];
$contentType = $_SERVER['CONTENT_TYPE'] ?? '';

$rawBody = [];
if (str_contains($contentType, 'application/json')) {
    $decoded = json_decode((string) file_get_contents('php://input'), true);
    $rawBody = is_array($decoded) ? $decoded : [];
} else {
    $rawBody = $_POST;
}

$action = (string) ($_GET['action'] ?? $rawBody['action'] ?? '');
$admin = is_admin();

try {
    $pdo = db();

    if ($action === 'list') {
        if ($method !== 'GET') {
            fail('Método no permitido.', 405);
        }
        respond(['ok' => true, 'areas' => fetch_areas($pdo, !$admin)]);
    }

    if (!in_array($action, ['create', 'update', 'toggle', 'delete'], true)) {
        fail('Acción no reconocida.', 400);
    }

    if ($method !== 'POST') {
        fail('Método no permitido.', 405);
    }
    if (!$admin) {
        fail('Solo el administrador puede administrar las áreas.', 403);
    }
    if (!csrf_valid($rawBody['csrf_token'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? null))) {
        fail('La sesión expiró. Recarga la página e inténtalo de nuevo.', 419);
    }

    switch ($action) {
        case 'create':
            [$data, $errors] = validate_area_input($rawBody, $pdo);
            if ($errors) {
                fail(implode(' ', $errors), 422);
            }

            $statement = $pdo->prepare('INSERT INTO areas (name, status) VALUES (:name, :status)');
            $statement->execute([
                ':name'   => $data['name'],
                ':status' => $data['status'],
            ]);

            $id = (int) $pdo->lastInsertId();
            audit_log('area_create', 'area', $id, ['name' => $data['name'], 'status' => $data['status']], user_id());

            respond(['ok' => true, 'area' => get_area($pdo, $id)]);
            break;

        case 'update':
            $id = (int) ($rawBody['id'] ?? 0);
            if ($id <= 0) {
                fail('No se indicó el área a editar.', 422);
            }

            $current = get_area($pdo, $id);
            if (!$current) {
                fail('El área ya no existe.', 404);
            }

            [$data, $errors] = validate_area_input($rawBody, $pdo, $id);
            if ($errors) {
                fail(implode(' ', $errors), 422);
            }

            $pdo->beginTransaction();
            try {
                $statement = $pdo->prepare('UPDATE areas SET name = :name, status = :status WHERE id = :id');
                $statement->execute([
                    ':name'   => $data['name'],
                    ':status' => $data['status'],
                    ':id'     => $id,
                ]);

                if ($current['name'] !== $data['name']) {
                    $sync = $pdo->prepare('UPDATE assets SET location = :name WHERE area_id = :id');
                    $sync->execute([':name' => $data['name'], ':id' => $id]);
                }

                $pdo->commit();
            } catch (Throwable $e) {
                $pdo->rollBack();
                throw $e;
            }

            audit_log('area_update', 'area', $id, [
                'from' => ['name' => $current['name'], 'status' => $current['status']],
                'to'   => ['name' => $data['name'], 'status' => $data['status']],
            ], user_id());

            respond(['ok' => true, 'area' => get_area($pdo, $id)]);
            break;

        case 'toggle':
            $id = (int) ($rawBody['id'] ?? 0);
            if ($id <= 0) {
                fail('No se indicó el área a cambiar.', 422);
            }

            $current = get_area($pdo, $id);
            if (!$current) {
                fail('El área ya no existe.', 404);
            }

            $status = $current['status'] === 'activo' ? 'inactivo' : 'activo';
            $statement = $pdo->prepare('UPDATE areas SET status = :status WHERE id = :id');
            $statement->execute([':status' => $status, ':id' => $id]);

            audit_log('area_status', 'area', $id, [
                'name'   => $current['name'],
                'status' => $status,
            ], user_id());

            respond(['ok' => true, 'area' => get_area($pdo, $id)]);
            break;

        case 'delete':
            $id = (int) ($rawBody['id'] ?? 0);
            if ($id <= 0) {
                fail('No se indicó el área a eliminar.', 422);
            }

            $current = get_area($pdo, $id);
            if (!$current) {
                fail('El área ya no existe.', 404);
            }

            $count = $pdo->prepare('SELECT COUNT(*) FROM assets WHERE area_id = :id');
            $count->execute([':id' => $id]);
            if ((int) $count->fetchColumn() > 0) {
                fail('El área tiene bienes asignados. Desactívala en lugar de eliminarla.', 409);
            }

            $statement = $pdo->prepare('DELETE FROM areas WHERE id = :id');
            $statement->execute([':id' => $id]);

            audit_log('area_delete', 'area', $id, ['name' => $current['name']], user_id());

            respond(['ok' => true, 'deleted' => $statement->rowCount() > 0]);
            break;
    }
} catch (Throwable $e) {
    fail('Error del servidor: ' . $e->getMessage(), 500);
}

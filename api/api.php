<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/assets.php';
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

    switch ($action) {
        case 'list':
            respond(['ok' => true, 'assets' => fetch_assets($pdo)]);
            break;

        case 'movements':
            if ($method !== 'GET') {
                fail('Método no permitido.', 405);
            }
            $id = (int) ($_GET['asset_id'] ?? 0);
            if ($id <= 0) {
                fail('Bien inválido.', 422);
            }
            respond(['ok' => true, 'movements' => fetch_asset_movements($pdo, $id)]);
            break;

        case 'create':
        case 'update':
        case 'delete':
        case 'transfer':
            if ($method !== 'POST') {
                fail('Método no permitido.', 405);
            }
            if (!csrf_valid($rawBody['csrf_token'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? null))) {
                fail('La sesión expiró. Recarga la página e inténtalo de nuevo.', 419);
            }
            break;
    }

    switch ($action) {
        case 'create':
            [$data, $errors] = validate_asset_input($rawBody);
            if ($errors) {
                fail(implode(' ', $errors), 422);
            }

            $data['asset_code'] = next_asset_code($pdo);
            $uid = user_id();

            $statement = $pdo->prepare(
                'INSERT INTO assets (asset_code, barcode, name, category, quantity, location, custodian, `condition`, acquired_on, notes, created_by, updated_by)
                 VALUES (:asset_code, :barcode, :name, :category, :quantity, :location, :custodian, :condition, :acquired_on, :notes, :created_by, :updated_by)'
            );

            try {
                $statement->execute([
                    ':asset_code'  => $data['asset_code'],
                    ':barcode'     => $data['barcode'],
                    ':name'        => $data['name'],
                    ':category'    => $data['category'],
                    ':quantity'    => $data['quantity'],
                    ':location'    => $data['location'],
                    ':custodian'   => $data['custodian'],
                    ':condition'   => $data['condition'],
                    ':acquired_on' => $data['acquired_on'],
                    ':notes'       => $data['notes'],
                    ':created_by'  => $uid,
                    ':updated_by'  => $uid,
                ]);
            } catch (PDOException $e) {
                if ((int) $e->errorInfo[1] === 1062) {
                    fail('Ese código de barras ya está registrado.', 409);
                }
                throw $e;
            }

            $id = (int) $pdo->lastInsertId();
            audit_log('asset_create', 'asset', $id, ['asset_code' => $data['asset_code'], 'name' => $data['name'], 'location' => $data['location']], $uid);

            $created = get_asset($pdo, $id);
            unset($created['raw']);
            respond(['ok' => true, 'asset' => $created]);
            break;

        case 'update':
            if (!$admin) {
                fail('Solo el administrador puede editar bienes.', 403);
            }

            $id = (int) ($rawBody['id'] ?? 0);
            if ($id <= 0) {
                fail('No se indicó el bien a editar.', 422);
            }

            $current = get_asset($pdo, $id);
            if (!$current) {
                fail('El bien ya no existe.', 404);
            }

            [$data, $errors] = validate_asset_input($rawBody);
            if ($errors) {
                fail(implode(' ', $errors), 422);
            }

            $statement = $pdo->prepare(
                'UPDATE assets
                 SET barcode = :barcode, name = :name, category = :category, quantity = :quantity, location = :location,
                     custodian = :custodian, `condition` = :condition, acquired_on = :acquired_on, notes = :notes,
                     updated_by = :updated_by
                 WHERE id = :id'
            );

            try {
                $statement->execute([
                    ':barcode'     => $data['barcode'],
                    ':name'        => $data['name'],
                    ':category'    => $data['category'],
                    ':quantity'    => $data['quantity'],
                    ':location'    => $data['location'],
                    ':custodian'   => $data['custodian'],
                    ':condition'   => $data['condition'],
                    ':acquired_on' => $data['acquired_on'],
                    ':notes'       => $data['notes'],
                    ':updated_by'  => user_id(),
                    ':id'          => $id,
                ]);
            } catch (PDOException $e) {
                if ((int) $e->errorInfo[1] === 1062) {
                    fail('Ese código de barras ya está registrado.', 409);
                }
                throw $e;
            }

            if (mb_strtolower(trim($current['location'])) !== mb_strtolower(trim($data['location']))) {
                $move = $pdo->prepare(
                    'INSERT INTO asset_movements (asset_id, from_location, to_location, reason, moved_by)
                     VALUES (:asset_id, :from_location, :to_location, :reason, :moved_by)'
                );
                $move->execute([
                    ':asset_id'      => $id,
                    ':from_location' => $current['location'],
                    ':to_location'   => $data['location'],
                    ':reason'        => 'Cambio registrado al editar el bien',
                    ':moved_by'      => user_id(),
                ]);
            }

            audit_log('asset_update', 'asset', $id, [
                'asset_code' => $current['asset_code'],
                'name'       => $current['name'],
                'from'       => ['location' => $current['location'], 'custodian' => $current['custodian']],
                'to'         => ['location' => $data['location'], 'custodian' => $data['custodian']],
            ], user_id());

            $created = get_asset($pdo, $id);
            unset($created['raw']);
            respond(['ok' => true, 'asset' => $created]);
            break;

        case 'transfer':
            if (!$admin) {
                fail('Solo el administrador puede trasladar bienes.', 403);
            }

            $id = (int) ($rawBody['id'] ?? 0);
            $toLocation = trim((string) ($rawBody['to_location'] ?? ''));
            $reason = trim((string) ($rawBody['reason'] ?? ''));

            if ($id <= 0) {
                fail('No se indicó el bien a trasladar.', 422);
            }
            if ($toLocation === '' || mb_strlen($toLocation) > 70) {
                fail('El ambiente/área destino es obligatorio (máximo 70 caracteres).', 422);
            }
            if (mb_strlen($reason) > 200) {
                fail('El motivo no debe superar 200 caracteres.', 422);
            }

            $current = get_asset($pdo, $id);
            if (!$current) {
                fail('El bien ya no existe.', 404);
            }
            if (mb_strtolower(trim($current['location'])) === mb_strtolower($toLocation)) {
                fail('El ambiente destino debe ser diferente al actual.', 422);
            }

            $pdo->beginTransaction();
            try {
                $update = $pdo->prepare('UPDATE assets SET location = :location, updated_by = :updated_by WHERE id = :id');
                $update->execute([
                    ':location'   => $toLocation,
                    ':updated_by' => user_id(),
                    ':id'         => $id,
                ]);

                $move = $pdo->prepare(
                    'INSERT INTO asset_movements (asset_id, from_location, to_location, reason, moved_by)
                     VALUES (:asset_id, :from_location, :to_location, :reason, :moved_by)'
                );
                $move->execute([
                    ':asset_id'      => $id,
                    ':from_location' => $current['location'],
                    ':to_location'   => $toLocation,
                    ':reason'        => $reason,
                    ':moved_by'      => user_id(),
                ]);

                $pdo->commit();
            } catch (Throwable $e) {
                $pdo->rollBack();
                throw $e;
            }

            audit_log('asset_transfer', 'asset', $id, [
                'asset_code'    => $current['asset_code'],
                'name'          => $current['name'],
                'from_location' => $current['location'],
                'to_location'   => $toLocation,
                'reason'        => $reason,
            ], user_id());

            $created = get_asset($pdo, $id);
            unset($created['raw']);
            respond(['ok' => true, 'asset' => $created]);
            break;

        case 'delete':
            if (!$admin) {
                fail('Solo un administrador puede eliminar bienes.', 403);
            }

            $id = (int) ($rawBody['id'] ?? 0);
            if ($id <= 0) {
                fail('No se indicó el bien a eliminar.', 422);
            }

            $current = get_asset($pdo, $id);
            $statement = $pdo->prepare('DELETE FROM assets WHERE id = :id');
            $statement->execute([':id' => $id]);

            if ($statement->rowCount() > 0 && $current) {
                audit_log('asset_delete', 'asset', $id, [
                    'asset_code' => $current['asset_code'],
                    'name'       => $current['name'],
                    'location'   => $current['location'],
                ], user_id());
            }

            respond(['ok' => true, 'deleted' => $statement->rowCount() > 0]);
            break;

        default:
            fail('Acción no reconocida.', 400);
    }
} catch (Throwable $e) {
    fail('Error del servidor: ' . $e->getMessage(), 500);
}


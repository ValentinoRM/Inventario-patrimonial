<?php
declare(strict_types=1);

require_once __DIR__ . '/../src/auth.php';
require_once __DIR__ . '/../src/assets.php';

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

if (!is_logged_in()) {
    fail('Tu sesión expiró. Vuelve a iniciar sesión.', 401);
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

try {
    $pdo = db();

    switch ($action) {
        case 'list':
            respond(['ok' => true, 'assets' => fetch_assets($pdo)]);
            break;

        case 'create':
        case 'update':
        case 'delete':
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
            $userId = (int) current_user()['id'];

            $statement = $pdo->prepare(
                'INSERT INTO assets (asset_code, barcode, name, category, quantity, location, custodian, `condition`, acquired_on, value, notes, created_by, updated_by)
                 VALUES (:asset_code, :barcode, :name, :category, :quantity, :location, :custodian, :condition, :acquired_on, :value, :notes, :created_by, :updated_by)'
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
                    ':value'       => $data['value'],
                    ':notes'       => $data['notes'],
                    ':created_by'  => $userId,
                    ':updated_by'  => $userId,
                ]);
            } catch (PDOException $e) {
                if ((int) $e->errorInfo[1] === 1062) {
                    fail('Ese código de barras ya está registrado.', 409);
                }
                throw $e;
            }

            $id = (int) $pdo->lastInsertId();
            respond(['ok' => true, 'asset' => map_asset(
                $pdo->query("SELECT * FROM assets WHERE id = $id")->fetch()
            )]);
            break;

        case 'update':
            $id = (int) ($rawBody['id'] ?? 0);
            if ($id <= 0) {
                fail('No se indicó el bien a editar.', 422);
            }

            $exists = $pdo->prepare('SELECT id FROM assets WHERE id = :id');
            $exists->execute([':id' => $id]);
            if (!$exists->fetchColumn()) {
                fail('El bien ya no existe.', 404);
            }

            [$data, $errors] = validate_asset_input($rawBody);
            if ($errors) {
                fail(implode(' ', $errors), 422);
            }

            $statement = $pdo->prepare(
                'UPDATE assets
                 SET barcode = :barcode, name = :name, category = :category, quantity = :quantity, location = :location,
                     custodian = :custodian, `condition` = :condition, acquired_on = :acquired_on, value = :value, notes = :notes,
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
                    ':value'       => $data['value'],
                    ':notes'       => $data['notes'],
                    ':updated_by'  => (int) current_user()['id'],
                    ':id'          => $id,
                ]);
            } catch (PDOException $e) {
                if ((int) $e->errorInfo[1] === 1062) {
                    fail('Ese código de barras ya está registrado.', 409);
                }
                throw $e;
            }

            respond(['ok' => true, 'asset' => map_asset(
                $pdo->query("SELECT * FROM assets WHERE id = $id")->fetch()
            )]);
            break;

        case 'delete':
            if (!is_admin()) {
                fail('Solo un administrador puede eliminar bienes.', 403);
            }

            $id = (int) ($rawBody['id'] ?? 0);
            if ($id <= 0) {
                fail('No se indicó el bien a eliminar.', 422);
            }

            $statement = $pdo->prepare('DELETE FROM assets WHERE id = :id');
            $statement->execute([':id' => $id]);

            respond(['ok' => true, 'deleted' => $statement->rowCount() > 0]);
            break;

        default:
            fail('Acción no reconocida.', 400);
    }
} catch (Throwable $e) {
    fail('Error del servidor: ' . $e->getMessage(), 500);
}

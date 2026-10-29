<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';
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

if (must_change_password() && $action !== 'change_password') {
    fail('Debes cambiar tu contraseña antes de continuar.', 403);
}

if (!is_admin() && $action !== 'change_password') {
    fail('Solo el administrador puede gestionar usuarios.', 403);
}

$me = current_user();
$meId = (int) $me['id'];

try {
    $pdo = db();

    switch ($action) {
        case 'list':
            $rows = $pdo->query(
                "SELECT id, email, name, role, status, last_login_at, last_login_ip, created_at, updated_at
                 FROM users
                 ORDER BY role = 'admin' DESC, name ASC, email ASC"
            )->fetchAll();
            respond(['ok' => true, 'users' => $rows]);
            break;

        case 'create':
        case 'update':
        case 'toggle':
        case 'reset_password':
        case 'change_password':
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
            $name = trim((string) ($rawBody['name'] ?? ''));
            $email = trim((string) ($rawBody['email'] ?? ''));
            $password = (string) ($rawBody['password'] ?? '');
            $role = (string) ($rawBody['role'] ?? 'user');

            if ($name === '') {
                fail('El nombre es obligatorio.', 422);
            }
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                fail('Correo electrónico inválido.', 422);
            }
            if (strlen($password) < 8) {
                fail('La contraseña debe tener al menos 8 caracteres.', 422);
            }
            if (!in_array($role, ['admin', 'user'], true)) {
                fail('Rol inválido.', 422);
            }

            $exists = $pdo->prepare('SELECT id FROM users WHERE email = :email');
            $exists->execute([':email' => $email]);
            if ($exists->fetchColumn()) {
                fail('Ya existe una cuenta con ese correo.', 409);
            }

            $statement = $pdo->prepare(
                "INSERT INTO users (email, password_hash, name, role, status, must_change_password) VALUES (:email, :hash, :name, :role, 'activo', 1)"
            );
            $statement->execute([
                ':email' => $email,
                ':hash'  => password_hash($password, PASSWORD_DEFAULT),
                ':name'  => $name,
                ':role'  => $role,
            ]);

            $id = (int) $pdo->lastInsertId();
            audit_log('user_create', 'user', $id, ['email' => $email, 'role' => $role], $meId);

            $row = $pdo->prepare('SELECT id, email, name, role, status, last_login_at, last_login_ip, created_at, updated_at FROM users WHERE id = :id');
            $row->execute([':id' => $id]);
            respond(['ok' => true, 'user' => $row->fetch()]);
            break;

        case 'update':
            $id = (int) ($rawBody['id'] ?? 0);
            if ($id <= 0) {
                fail('ID de usuario inválido.', 422);
            }
            if ($id === $meId) {
                fail('No puedes editar tu propia cuenta desde este panel.', 422);
            }

            $existsUser = $pdo->prepare('SELECT id FROM users WHERE id = :id');
            $existsUser->execute([':id' => $id]);
            if (!$existsUser->fetchColumn()) {
                fail('Usuario no encontrado.', 404);
            }

            $name = trim((string) ($rawBody['name'] ?? ''));
            $email = trim((string) ($rawBody['email'] ?? ''));
            $role = (string) ($rawBody['role'] ?? 'user');

            if ($name === '') {
                fail('El nombre es obligatorio.', 422);
            }
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                fail('Correo electrónico inválido.', 422);
            }
            if (!in_array($role, ['admin', 'user'], true)) {
                fail('Rol inválido.', 422);
            }

            $exists = $pdo->prepare('SELECT id FROM users WHERE email = :email AND id != :id');
            $exists->execute([':email' => $email, ':id' => $id]);
            if ($exists->fetchColumn()) {
                fail('Ya existe otra cuenta con ese correo.', 409);
            }

            $statement = $pdo->prepare('UPDATE users SET name = :name, email = :email, role = :role WHERE id = :id');
            $statement->execute([
                ':name'  => $name,
                ':email' => $email,
                ':role'  => $role,
                ':id'    => $id,
            ]);

            audit_log('user_update', 'user', $id, ['email' => $email, 'role' => $role], $meId);

            $row = $pdo->prepare('SELECT id, email, name, role, status, last_login_at, last_login_ip, created_at, updated_at FROM users WHERE id = :id');
            $row->execute([':id' => $id]);
            respond(['ok' => true, 'user' => $row->fetch()]);
            break;

        case 'toggle':
            $id = (int) ($rawBody['id'] ?? 0);
            if ($id <= 0) {
                fail('ID de usuario inválido.', 422);
            }
            if ($id === $meId) {
                fail('No puedes desactivar tu propia cuenta.', 422);
            }

            $current = $pdo->prepare('SELECT role, status FROM users WHERE id = :id');
            $current->execute([':id' => $id]);
            $target = $current->fetch();
            if (!$target) {
                fail('Usuario no encontrado.', 404);
            }
            if (($target['role'] ?? '') === 'admin') {
                $countAdmins = (int) $pdo->query("SELECT COUNT(*) FROM users WHERE role = 'admin' AND status = 'activo'")->fetchColumn();
                $activating = ($target['status'] ?? '') === 'inactivo';
                if ($activating && $countAdmins === 0) {
                    // will become first active admin - ok
                }
                if (!$activating && $countAdmins <= 1) {
                    fail('No puedes desactivar el único administrador activo.', 422);
                }
            }

            $newStatus = (($target['status'] ?? '') === 'activo') ? 'inactivo' : 'activo';
            $statement = $pdo->prepare('UPDATE users SET status = :status WHERE id = :id');
            $statement->execute([':status' => $newStatus, ':id' => $id]);

            audit_log('user_status', 'user', $id, ['status' => $newStatus], $meId);
            respond(['ok' => true, 'status' => $newStatus]);
            break;

        case 'reset_password':
            $id = (int) ($rawBody['id'] ?? 0);
            $password = (string) ($rawBody['password'] ?? '');
            if ($id <= 0) {
                fail('ID de usuario inválido.', 422);
            }
            if (strlen($password) < 8) {
                fail('La contraseña debe tener al menos 8 caracteres.', 422);
            }

            $existsUser = $pdo->prepare('SELECT id FROM users WHERE id = :id');
            $existsUser->execute([':id' => $id]);
            if (!$existsUser->fetchColumn()) {
                fail('Usuario no encontrado.', 404);
            }

            $statement = $pdo->prepare('UPDATE users SET password_hash = :hash, must_change_password = 1 WHERE id = :id');
            $statement->execute([
                ':hash' => password_hash($password, PASSWORD_DEFAULT),
                ':id'   => $id,
            ]);

            audit_log('user_password', 'user', $id, [], $meId);
            respond(['ok' => true]);
            break;

        case 'change_password':
            $currentPass = (string) ($rawBody['current_password'] ?? '');
            $newPass = (string) ($rawBody['new_password'] ?? '');
            if (strlen($currentPass) < 1) {
                fail('Ingresa tu contraseña actual.', 422);
            }
            if (strlen($newPass) < 8) {
                fail('La nueva contraseña debe tener al menos 8 caracteres.', 422);
            }

            $statement = $pdo->prepare('SELECT password_hash FROM users WHERE id = :id');
            $statement->execute([':id' => $meId]);
            $hash = $statement->fetchColumn();

            if (!$hash || !password_verify($currentPass, (string) $hash)) {
                fail('La contraseña actual no es correcta.', 422);
            }
            if (password_verify($newPass, (string) $hash)) {
                fail('La nueva contraseña debe ser diferente a la actual.', 422);
            }

            $update = $pdo->prepare('UPDATE users SET password_hash = :hash, must_change_password = 0 WHERE id = :id');
            $update->execute([
                ':hash' => password_hash($newPass, PASSWORD_DEFAULT),
                ':id'   => $meId,
            ]);
            $_SESSION['must_change_password'] = false;

            audit_log('password_change', 'user', $meId, [], $meId);
            respond(['ok' => true]);
            break;

        default:
            fail('Acción no reconocida.', 400);
    }
} catch (Throwable $e) {
    fail('Error del servidor: ' . $e->getMessage(), 500);
}

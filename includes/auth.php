<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

if (session_status() === PHP_SESSION_NONE) {
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
    session_set_cookie_params([
        'httponly' => true,
        'samesite' => 'Lax',
        'secure'   => $secure,
    ]);
    session_start();
}

function current_user(): ?array
{
    if (empty($_SESSION['user_id'])) {
        return null;
    }

    return [
        'id'    => (int) $_SESSION['user_id'],
        'email' => (string) ($_SESSION['email'] ?? ''),
        'name'  => (string) ($_SESSION['name'] ?? ''),
        'role'  => (string) ($_SESSION['role'] ?? 'user'),
    ];
}

function is_logged_in(): bool
{
    return current_user() !== null;
}

function is_admin(): bool
{
    $user = current_user();

    return ($user['role'] ?? '') === 'admin';
}

/**
 * Refresca rol, nombre y estado desde la base de datos.
 * Devuelve false si la cuenta ya no existe o fue desactivada.
 */
function refresh_session_user(): bool
{
    if (empty($_SESSION['user_id'])) {
        return false;
    }

    $statement = db()->prepare('SELECT id, email, name, role, status, must_change_password FROM users WHERE id = :id LIMIT 1');
    $statement->execute([':id' => (int) $_SESSION['user_id']]);
    $row = $statement->fetch();

    if (!$row || ($row['status'] ?? 'activo') !== 'activo') {
        return false;
    }

    $_SESSION['email'] = (string) $row['email'];
    $_SESSION['name']  = (string) $row['name'];
    $_SESSION['role']  = (string) $row['role'];
    $_SESSION['must_change_password'] = (bool) $row['must_change_password'];

    return true;
}

function require_login(): void
{
    if (!is_logged_in()) {
        header('Location: login.php');
        exit;
    }

    if (!refresh_session_user()) {
        logout_user();
        header('Location: login.php?inactive=1');
        exit;
    }

    if (must_change_password()) {
        $path = parse_url((string) ($_SERVER['REQUEST_URI'] ?? ''), PHP_URL_PATH);
        if (basename(is_string($path) ? $path : '') !== 'cambiar-clave.php') {
            header('Location: cambiar-clave.php');
            exit;
        }
    }
}

function login_user(array $user): void
{
    session_regenerate_id(true);
    $_SESSION['user_id'] = (int) $user['id'];
    $_SESSION['email']   = (string) $user['email'];
    $_SESSION['name']    = (string) $user['name'];
    $_SESSION['role']    = (string) $user['role'];
    $_SESSION['must_change_password'] = (bool) ($user['must_change_password'] ?? false);
}

function must_change_password(): bool
{
    return !empty($_SESSION['must_change_password']);
}

function logout_user(): void
{
    $_SESSION = [];

    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], (bool) $params['secure'], (bool) $params['httponly']);
    }

    session_destroy();
}

function csrf_token(): string
{
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }

    return $_SESSION['csrf_token'];
}

function csrf_valid(?string $token): bool
{
    return is_string($token)
        && $token !== ''
        && !empty($_SESSION['csrf_token'])
        && hash_equals($_SESSION['csrf_token'], $token);
}

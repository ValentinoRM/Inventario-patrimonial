<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';

function require_admin(): void
{
    require_login();

    if (!is_admin()) {
        http_response_code(403);
        include __DIR__ . '/../views/403.php';
        exit;
    }
}

function require_permission(string $permission): void
{
    require_login();

    if ($permission === 'admin' && !is_admin()) {
        http_response_code(403);
        include __DIR__ . '/../views/403.php';
        exit;
    }
}

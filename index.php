<?php
declare(strict_types=1);

require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/helpers.php';

require_login();

$user       = current_user();
$isAdmin    = is_admin();
$userName   = $user['name'] !== '' ? $user['name'] : $user['email'];
$roleLabel  = role_label($user['role'] ?? 'user');

require __DIR__ . '/views/inventario.php';


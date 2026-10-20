<?php
declare(strict_types=1);

require_once __DIR__ . '/includes/auth.php';

require_login();

$user       = current_user();
$isAdmin    = is_admin();
$userName   = $user['name'] !== '' ? $user['name'] : $user['email'];
$roleLabel  = $isAdmin ? 'Administrador' : 'Usuario';

require __DIR__ . '/views/inventario.php';

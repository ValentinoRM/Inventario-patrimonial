<?php
declare(strict_types=1);

require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/permissions.php';

require_admin();
header('Location: usuarios.php');
exit;

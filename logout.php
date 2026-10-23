<?php
declare(strict_types=1);

require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/audit.php';

if (is_logged_in()) {
    $user = current_user();
    audit_log('logout', 'user', $user['id'] ?? null, [], $user['id'] ?? null);
}

logout_user();

header('Location: login.php');
exit;


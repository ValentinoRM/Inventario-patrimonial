<?php
declare(strict_types=1);

require_once __DIR__ . '/../../includes/helpers.php';

$barUser = current_user();
$barAdmin = is_admin();
$barName = ($barUser['name'] ?? '') !== '' ? $barUser['name'] : ($barUser['email'] ?? '');
$barRole = role_label($barUser['role'] ?? 'user');
$crumb = $crumb ?? 'Inventario';
$activeNav = $activeNav ?? '';
$initials = mb_strtoupper(mb_substr($barName, 0, 2, 'UTF-8'), 'UTF-8');
?>
    <main class="main">
      <div class="topbar">
        <div class="crumb">Patrimonio <span aria-hidden="true">/</span> <strong><?= e($crumb) ?></strong></div>
        <div class="user-chip">
          <div class="user-avatar" aria-hidden="true"><?= e($initials) ?></div>
          <div class="user-text"><strong><?= e($barName) ?></strong><span>Sesión municipal</span></div>
          <span class="role-badge <?= e(role_class($barUser['role'] ?? 'user')) ?>"><?= e($barRole) ?></span>
          <a class="button button-light logout-link" href="logout.php">Cerrar sesión</a>
          <details class="mobile-nav">
            <summary class="button button-light">Menú</summary>
            <div class="mobile-nav-panel">
              <a href="index.php" class="<?= $activeNav === 'inventario' ? 'active' : '' ?>">Inventario</a>
              <?php if ($barAdmin): ?>
              <a href="usuarios.php" class="<?= $activeNav === 'usuarios' ? 'active' : '' ?>">Usuarios</a>
              <a href="reportes.php" class="<?= $activeNav === 'reportes' ? 'active' : '' ?>">Reportes</a>
              <a href="auditoria.php" class="<?= $activeNav === 'auditoria' ? 'active' : '' ?>">Auditoría</a>
              <?php endif; ?>
              <a href="logout.php">Cerrar sesión</a>
            </div>
          </details>
        </div>
      </div>

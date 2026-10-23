<?php
declare(strict_types=1);

$navUser = current_user();
$navAdmin = is_admin();
$activeNav = $activeNav ?? '';
?>
    <aside class="sidebar" aria-label="Navegación principal">
      <div class="brand">
        <div class="brand-mark" aria-hidden="true"><img src="./assets/img/icono.jpg" alt=""></div>
        <div class="brand-copy"><strong>Municipalidad Distrital</strong><span>Huamancaca Chico · Junín</span></div>
      </div>
      <div class="nav-label">Gestión municipal</div>
      <ul class="nav-list">
        <li><a class="nav-link <?= $activeNav === 'inventario' ? 'active' : '' ?>" href="index.php"<?= $activeNav === 'inventario' ? ' aria-current="page"' : '' ?>><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 8h8M8 12h8M8 16h4"/></svg> Inventario patrimonial</a></li>
        <?php if ($navAdmin): ?>
        <li><a class="nav-link <?= $activeNav === 'usuarios' ? 'active' : '' ?>" href="usuarios.php"<?= $activeNav === 'usuarios' ? ' aria-current="page"' : '' ?>><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="8" r="3.5"/><path d="M4 20c1.8-3 5-4.5 8-4.5s6.2 1.5 8 4.5"/></svg> Usuarios</a></li>
        <li><a class="nav-link <?= $activeNav === 'reportes' ? 'active' : '' ?>" href="reportes.php"<?= $activeNav === 'reportes' ? ' aria-current="page"' : '' ?>><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 19V5m0 14h16M8 15V9m4 6V7m4 8v-4"/></svg> Reportes</a></li>
        <li><a class="nav-link <?= $activeNav === 'auditoria' ? 'active' : '' ?>" href="auditoria.php"<?= $activeNav === 'auditoria' ? ' aria-current="page"' : '' ?>><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 6v6l4 2"/><circle cx="12" cy="12" r="9"/></svg> Auditoría</a></li>
        <?php endif; ?>

      </ul>
      <div class="side-spacer"></div>
      <div class="side-note"><strong>Control de bienes</strong>Registro interno para organizar y consultar los bienes municipales.</div>
    </aside>

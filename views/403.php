<?php
declare(strict_types=1);

$pageTitle = 'Acceso denegado';
$activeNav = '';
$crumb = 'Acceso denegado';

require __DIR__ . '/partials/head.php';
require __DIR__ . '/partials/sidebar.php';
require __DIR__ . '/partials/topbar.php';
?>
      <section class="empty-state" style="margin-top: 60px;">
        <strong style="font-size: 18px;">Acceso denegado</strong>
        No tienes permisos para ingresar a esta sección. Si necesitas acceso, comunícate con el administrador del sistema.
        <div style="margin-top: 16px;"><a class="button button-primary" href="index.php">Volver al inventario</a></div>
      </section>
<?php require __DIR__ . '/partials/foot.php'; ?>
</body>
</html>

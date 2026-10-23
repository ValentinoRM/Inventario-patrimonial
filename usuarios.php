<?php
declare(strict_types=1);

require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/helpers.php';
require_once __DIR__ . '/includes/permissions.php';

require_admin();

$user = current_user();
$pageTitle = 'Usuarios';
$activeNav = 'usuarios';
$crumb = 'Usuarios';

require __DIR__ . '/views/partials/head.php';
require __DIR__ . '/views/partials/sidebar.php';
require __DIR__ . '/views/partials/topbar.php';
?>
      <header class="page-head">
        <div><div class="eyebrow">Administración</div><h1>Gestión de usuarios</h1><p>Crea cuentas, cambia roles y controla el acceso al sistema.</p></div>
        <div class="head-actions">
          <button class="button button-primary" id="newUserBtn" type="button"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg> Nuevo usuario</button>
        </div>
      </header>

      <section class="table-panel">
        <div class="toolbar">
          <label class="searchbox"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10.8" cy="10.8" r="6.3"/><path d="m16 16 4 4"/></svg><input id="userSearch" type="search" placeholder="Buscar por nombre o correo..." aria-label="Buscar usuarios"></label>
          <span class="table-hint" id="userCount">0 cuentas</span>
        </div>
        <div class="table-scroll">
          <table>
            <thead><tr><th>Usuario</th><th>Rol</th><th>Estado</th><th>Último acceso</th><th>Creado</th><th aria-label="Acciones"></th></tr></thead>
            <tbody id="userRows"></tbody>
          </table>
          <div class="empty-state" id="usersEmpty" hidden><strong>No hay usuarios para mostrar</strong>Prueba otra búsqueda o crea una nueva cuenta.</div>
        </div>
        <div class="table-foot"><span id="usersFootCount">0 cuentas</span><span>Control de acceso municipal</span></div>
      </section>
<?php require __DIR__ . '/views/partials/foot.php'; ?>

  <div class="modal-backdrop" id="userBackdrop" role="presentation">
    <section class="modal" role="dialog" aria-modal="true" aria-labelledby="userModalTitle">
      <div class="modal-head"><div><h2 id="userModalTitle">Nuevo usuario</h2><p id="userModalSubtitle">Crea una cuenta de acceso.</p></div><button class="modal-close" id="closeUserModal" type="button" aria-label="Cerrar">&times;</button></div>
      <form id="userForm">
        <input type="hidden" id="userId" name="id">
        <div class="form-grid">
          <div class="field"><label for="userName">Nombre completo *</label><input id="userName" name="name" maxlength="120" required placeholder="Nombre y apellidos"></div>
          <div class="field"><label for="userEmail">Correo electrónico *</label><input id="userEmail" name="email" type="email" maxlength="190" required placeholder="correo@municipalidad.gob.pe"></div>
          <div class="field"><label for="userRole">Rol *</label><select id="userRole" name="role" required><option value="user">Usuario</option><option value="admin">Administrador</option></select></div>
          <div class="field" id="passwordField"><label for="userPassword">Contraseña inicial *</label><input id="userPassword" name="password" type="password" minlength="8" autocomplete="new-password" placeholder="Mínimo 8 caracteres"></div>
        </div>
        <div class="modal-actions"><button class="button button-light" id="cancelUserModal" type="button">Cancelar</button><button class="button button-primary" type="submit" id="saveUserBtn">Crear usuario</button></div>
      </form>
    </section>
  </div>

  <div class="modal-backdrop" id="passwordBackdrop" role="presentation">
    <section class="modal" role="dialog" aria-modal="true" aria-labelledby="passwordModalTitle">
      <div class="modal-head"><div><h2 id="passwordModalTitle">Restablecer contraseña</h2><p id="passwordModalSubtitle">Asigna una nueva contraseña temporal.</p></div><button class="modal-close" id="closePasswordModal" type="button" aria-label="Cerrar">&times;</button></div>
      <form id="passwordResetForm">
        <input type="hidden" id="passwordUserId" name="id">
        <div class="form-grid">
          <div class="field full"><label for="resetPassword">Nueva contraseña *</label><input id="resetPassword" name="password" type="password" minlength="8" required autocomplete="new-password" placeholder="Mínimo 8 caracteres"></div>
        </div>
        <div class="modal-actions"><button class="button button-light" id="cancelPasswordModal" type="button">Cancelar</button><button class="button button-primary" type="submit">Restablecer</button></div>
      </form>
    </section>
  </div>

  <div class="toast" id="toast" role="status" aria-live="polite"></div>

  <script>
    window.USERS_CONFIG = {
      csrfToken: <?= json_encode(csrf_token(), JSON_UNESCAPED_UNICODE) ?>,
      currentUserId: <?= (int) $user['id'] ?>
    };
  </script>
  <script src="./assets/js/usuarios.js"></script>
</body>
</html>

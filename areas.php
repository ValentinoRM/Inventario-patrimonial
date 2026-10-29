<?php
declare(strict_types=1);

require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/helpers.php';
require_once __DIR__ . '/includes/permissions.php';

require_admin();

$pageTitle = 'Áreas';
$activeNav = 'areas';
$crumb = 'Áreas';

require __DIR__ . '/views/partials/head.php';
require __DIR__ . '/views/partials/sidebar.php';
require __DIR__ . '/views/partials/topbar.php';
?>
      <header class="page-head">
        <div><div class="eyebrow">Administración</div><h1>Gestión de áreas</h1><p>Organiza las áreas donde se ubican los bienes patrimoniales.</p></div>
        <div class="head-actions">
          <button class="button button-primary" id="newAreaBtn" type="button"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg> Nueva área</button>
        </div>
      </header>

      <section class="table-panel">
        <div class="toolbar">
          <label class="searchbox"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10.8" cy="10.8" r="6.3"/><path d="m16 16 4 4"/></svg><input id="areaSearch" type="search" placeholder="Buscar área..." aria-label="Buscar áreas"></label>
          <span class="table-hint" id="areaCount">0 áreas</span>
        </div>
        <div class="table-scroll">
          <table>
            <thead><tr><th>Área</th><th>Bienes registrados</th><th>Unidades</th><th>Estado</th><th aria-label="Acciones"></th></tr></thead>
            <tbody id="areaRows"></tbody>
          </table>
          <div class="empty-state" id="areasEmpty" hidden><strong>No hay áreas para mostrar</strong>Crea una nueva área para asignar los bienes.</div>
        </div>
        <div class="table-foot"><span id="areasFootCount">0 áreas</span><span>Catálogo compartido municipal</span></div>
      </section>
<?php require __DIR__ . '/views/partials/foot.php'; ?>

  <div class="modal-backdrop" id="areaBackdrop" role="presentation">
    <section class="modal" role="dialog" aria-modal="true" aria-labelledby="areaModalTitle">
      <div class="modal-head"><div><h2 id="areaModalTitle">Nueva área</h2><p id="areaModalSubtitle">Registra un área para ubicar los bienes.</p></div><button class="modal-close" id="closeAreaModal" type="button" aria-label="Cerrar">&times;</button></div>
      <form id="areaForm">
        <input type="hidden" id="areaId" name="id">
        <div class="form-grid">
          <div class="field full"><label for="areaName">Nombre del área *</label><input id="areaName" name="name" maxlength="70" required placeholder="Ej. Secretaría general"></div>
          <div class="field full"><label for="areaStatus">Estado *</label><select id="areaStatus" name="status" required><option value="activo">Activa</option><option value="inactivo">Inactiva</option></select></div>
        </div>
        <div class="modal-actions"><button class="button button-light" id="cancelAreaModal" type="button">Cancelar</button><button class="button button-primary" type="submit" id="saveAreaBtn">Crear área</button></div>
      </form>
    </section>
  </div>

  <div class="toast" id="toast" role="status" aria-live="polite"></div>

  <script>
    window.AREAS_CONFIG = {
      csrfToken: <?= json_encode(csrf_token(), JSON_UNESCAPED_UNICODE) ?>
    };
  </script>
  <script src="./assets/js/areas.js"></script>
</body>
</html>

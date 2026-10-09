<?php
declare(strict_types=1);

require_once __DIR__ . '/../src/auth.php';

require_login();

$user       = current_user();
$isAdmin    = is_admin();
$userName   = $user['name'] !== '' ? $user['name'] : $user['email'];
$roleLabel  = $isAdmin ? 'Administrador' : 'Usuario';
?>
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#762b32">
  <title>Inventario patrimonial | Municipalidad Distrital de Huamancaca Chico</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="./assets/css/styles.css">
</head>
<body>
  <div class="app">
    <aside class="sidebar" aria-label="Navegación principal">
      <div class="brand">
        <div class="brand-mark" aria-hidden="true">HC</div>
        <div class="brand-copy"><strong>Municipalidad Distrital</strong><span>Huamancaca Chico · Junín</span></div>
      </div>
      <div class="nav-label">Gestión municipal</div>
      <ul class="nav-list">
        <li><a class="nav-link active" href="#inventario" aria-current="page"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 8h8M8 12h8M8 16h4"/></svg> Inventario patrimonial</a></li>
      </ul>
      <div class="side-spacer"></div>
      <div class="side-note"><strong>Control de bienes</strong>Registro interno para organizar y consultar los bienes municipales.</div>
    </aside>

    <main class="main" id="inventario">
      <div class="topbar">
        <div class="crumb">Patrimonio <span aria-hidden="true">/</span> <strong>Inventario</strong></div>
        <div class="user-chip">
          <div class="user-avatar" aria-hidden="true">HC</div>
          <div class="user-text"><strong id="activeUser"><?= htmlspecialchars($userName, ENT_QUOTES, 'UTF-8') ?></strong><span id="connectionLabel">Sesión municipal · <?= htmlspecialchars($roleLabel, ENT_QUOTES, 'UTF-8') ?></span></div>
          <a class="button button-light" id="signOutBtn" href="logout.php">Cerrar sesión</a>
        </div>
      </div>

      <header class="page-head">
        <div><div class="eyebrow">Gestión patrimonial</div><h1>Inventario de bienes</h1><p>Organiza, consulta y mantén actualizado el patrimonio municipal.</p></div>
        <div class="head-actions">
          <button class="button button-light" id="scanLookupBtn" type="button"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 7V4h3m10 0h3v3M4 17v3h3m10 0h3v-3M5 12h14M8 9v6m3-6v6m3-6v6m3-6v6"/></svg> Escanear</button>
          <button class="button button-light" id="exportBtn" type="button"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v12m-5-5 5 5 5-5M5 17v3h14v-3"/></svg> Exportar Excel</button>
          <button class="button button-primary" id="addBtn" type="button"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg> Registrar bien</button>
        </div>
      </header>

      <section class="metrics" aria-label="Resumen del inventario">
        <article class="metric"><div class="metric-top"><span>Bienes registrados</span><span class="metric-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 8h8M8 12h8M8 16h4"/></svg></span></div><div class="metric-value" id="metricItems">0</div><div class="metric-detail">Unidades en inventario</div></article>
        <article class="metric"><div class="metric-top"><span>En buen estado</span><span class="metric-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m5 12 4 4L19 6"/></svg></span></div><div class="metric-value" id="metricGood">0</div><div class="metric-detail">Bienes operativos</div></article>
        <article class="metric"><div class="metric-top"><span>Requieren atención</span><span class="metric-icon amber"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3 2.8 20h18.4L12 3Z"/><path d="M12 9v5m0 3h.01"/></svg></span></div><div class="metric-value" id="metricAttention">0</div><div class="metric-detail">Regulares o en mal estado</div></article>
        <article class="metric"><div class="metric-top"><span>Ambientes ocupados</span><span class="metric-icon red"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 21V8l9-5 9 5v13M8 21v-7h8v7M7 9h.01M12 9h.01M17 9h.01"/></svg></span></div><div class="metric-value" id="metricLocations">0</div><div class="metric-detail">Ubicaciones registradas</div></article>
      </section>

      <section class="photo-strip" aria-label="Identificación del inventario municipal">
        <div class="photo-copy"><span>Municipalidad Distrital de Huamancaca Chico</span><strong>Patrimonio bajo control, gestión transparente.</strong></div>
        <div class="photo-stamp">INVENTARIO MUNICIPAL</div>
      </section>

      <section aria-labelledby="tableTitle">
        <div class="section-head"><h2 id="tableTitle">Registro de bienes</h2><span id="resultCount">0 registros</span></div>
        <div class="table-panel">
          <div class="toolbar">
            <label class="searchbox"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10.8" cy="10.8" r="6.3"/><path d="m16 16 4 4"/></svg><input id="searchInput" type="search" placeholder="Buscar por nombre, código o ambiente..." aria-label="Buscar bienes"></label>
            <div class="filters">
              <select id="categoryFilter" aria-label="Filtrar por categoría"><option value="">Todas las categorías</option></select>
              <select id="conditionFilter" aria-label="Filtrar por estado"><option value="">Todos los estados</option><option>Bueno</option><option>Regular</option><option>Malo</option></select>
            </div>
          </div>
          <div class="table-scroll">
            <table>
              <thead><tr><th>Bien / Código</th><th>Barcode</th><th>Categoría</th><th>Cantidad</th><th>Ambiente</th><th>Responsable</th><th>Estado</th><th aria-label="Acciones"></th></tr></thead>
              <tbody id="assetRows"></tbody>
            </table>
            <div class="empty-state" id="emptyState" hidden><strong>No hay bienes para mostrar</strong>Prueba otra búsqueda o registra un nuevo bien.</div>
          </div>
          <div class="table-foot"><span id="tableFootCount">0 bienes</span><span id="databaseStatus">Base compartida municipal</span></div>
        </div>
      </section>
    </main>
  </div>

  <div class="modal-backdrop" id="modalBackdrop" role="presentation">
    <section class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
      <div class="modal-head"><div><h2 id="modalTitle">Registrar bien</h2><p>Completa la información del bien patrimonial.</p></div><button class="modal-close" id="closeModal" type="button" aria-label="Cerrar">&times;</button></div>
      <form id="assetForm">
        <div class="form-grid">
          <div class="field"><label for="name">Nombre del bien *</label><input id="name" name="name" required maxlength="90" placeholder="Ej. Escritorio de madera"></div>
          <div class="field"><label for="category">Categoría *</label><select id="category" name="category" required><option value="">Seleccionar categoría</option><option>Muebles</option><option>Equipos informáticos</option><option>Electrodomésticos</option><option>Vehículos</option><option>Herramientas</option><option>Otros</option></select></div>
          <div class="field full"><label for="barcode">Código de barras</label><div class="scan-field"><input id="barcode" name="barcode" maxlength="120" placeholder="Escanea o escribe el código del bien"><button class="button button-light" id="scanFormBtn" type="button" aria-label="Escanear código de barras"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 7V4h3m10 0h3v3M4 17v3h3m10 0h3v-3M5 12h14M8 9v6m3-6v6m3-6v6m3-6v6"/></svg> Escanear</button></div></div>
          <div class="field"><label for="quantity">Cantidad *</label><input id="quantity" name="quantity" type="number" min="1" max="99999" value="1" required></div>
          <div class="field"><label for="condition">Estado de conservación *</label><select id="condition" name="condition" required><option>Bueno</option><option>Regular</option><option>Malo</option></select></div>
          <div class="field"><label for="location">Ambiente / ubicación *</label><input id="location" name="location" required maxlength="70" placeholder="Ej. Secretaría general"></div>
          <div class="field"><label for="custodian">Responsable</label><input id="custodian" name="custodian" maxlength="70" placeholder="Nombre del responsable"></div>
          <div class="field"><label for="acquired">Fecha de adquisición</label><input id="acquired" name="acquired" type="date"></div>
          <div class="field"><label for="value">Valor referencial (S/)</label><input id="value" name="value" type="number" min="0" step="0.01" placeholder="0.00"></div>
          <div class="field full"><label for="notes">Observaciones</label><textarea id="notes" name="notes" maxlength="300" placeholder="Detalles adicionales del bien"></textarea></div>
        </div>
        <div class="modal-actions"><button class="button button-light" id="cancelModal" type="button">Cancelar</button><button class="button button-primary" type="submit" id="saveBtn">Guardar bien</button></div>
      </form>
    </section>
  </div>
  <div class="scanner-backdrop" id="scannerBackdrop" role="presentation">
    <section class="scanner-panel" role="dialog" aria-modal="true" aria-labelledby="scannerTitle">
      <div class="scanner-head"><strong id="scannerTitle">Escanear código de barras</strong><button class="modal-close" id="closeScanner" type="button" aria-label="Cerrar escáner">&times;</button></div>
      <div id="barcodeReader"></div>
      <p class="scanner-hint" id="scannerHint">Centra el código de barras frente a la cámara. Si el navegador lo solicita, permite el acceso a la cámara.</p>
    </section>
  </div>
  <div class="toast" id="toast" role="status" aria-live="polite"></div>

  <script>
    window.APP_CONFIG = {
      csrfToken: <?= json_encode(csrf_token(), JSON_UNESCAPED_UNICODE) ?>,
      canDelete: <?= $isAdmin ? 'true' : 'false' ?>,
      isAdmin: <?= $isAdmin ? 'true' : 'false' ?>
    };
  </script>
  <script src="https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js"></script>
  <script src="./assets/js/app.js"></script>
</body>
</html>

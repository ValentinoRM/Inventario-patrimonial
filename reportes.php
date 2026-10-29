<?php
declare(strict_types=1);

require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/helpers.php';
require_once __DIR__ . '/includes/assets.php';
require_once __DIR__ . '/includes/permissions.php';

require_admin();

$pdo = db();
$summary = fetch_inventory_summary($pdo);
$byCategory = fetch_inventory_breakdown($pdo, 'category');
$byLocation = fetch_inventory_breakdown($pdo, 'location');
$byCondition = fetch_inventory_breakdown($pdo, 'condition');
$movements = fetch_recent_movements($pdo, 25);

$pageTitle = 'Reportes';
$activeNav = 'reportes';
$crumb = 'Reportes';

require __DIR__ . '/views/partials/head.php';
require __DIR__ . '/views/partials/sidebar.php';
require __DIR__ . '/views/partials/topbar.php';
?>
      <header class="page-head">
        <div><div class="eyebrow">Administración</div><h1>Reportes del inventario</h1><p>Resumen por categoría, área, estado y cambios de área recientes.</p></div>
        <div class="head-actions">
          <button class="button button-light" id="printBtn" type="button"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M7 9V4h10v5M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><rect x="7" y="14" width="10" height="6"/></svg> Imprimir</button>
          <button class="button button-light" id="exportBtn" type="button"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v12m-5-5 5 5 5-5M5 17v3h14v-3"/></svg> Exportar Excel</button>
        </div>
      </header>

      <section class="metrics" aria-label="Resumen general">
        <article class="metric"><div class="metric-top"><span>Registros</span><span class="metric-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 8h8M8 12h8M8 16h4"/></svg></span></div><div class="metric-value"><?= number_format($summary['records'], 0, '.', ',') ?></div><div class="metric-detail">Bienes en el sistema</div></article>
        <article class="metric"><div class="metric-top"><span>Unidades</span><span class="metric-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 7h16v12H4zM8 7V4h8v3"/></svg></span></div><div class="metric-value"><?= number_format($summary['units'], 0, '.', ',') ?></div><div class="metric-detail">Total de existencias</div></article>
        <article class="metric"><div class="metric-top"><span>Áreas</span><span class="metric-icon red"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 21V8l9-5 9 5v13M8 21v-7h8v7M7 9h.01M12 9h.01M17 9h.01"/></svg></span></div><div class="metric-value"><?= number_format($summary['locations'], 0, '.', ',') ?></div><div class="metric-detail">Áreas con bienes</div></article>
      </section>

      <div class="report-grid">
        <section class="table-panel">
          <div class="section-head" style="padding: 15px 16px 0;"><h2>Por categoría</h2><span><?= count($byCategory) ?> categorías</span></div>
          <div class="table-scroll">
            <table>
              <thead><tr><th>Categoría</th><th>Registros</th><th>Unidades</th></tr></thead>
              <tbody>
                <?php foreach ($byCategory as $row): ?>
                <tr><td><?= e($row['label']) ?></td><td><?= number_format((int) $row['records'], 0, '.', ',') ?></td><td><?= number_format((int) $row['units'], 0, '.', ',') ?></td></tr>
                <?php endforeach; ?>
                <?php if ($byCategory === []): ?><tr><td colspan="3">Sin datos.</td></tr><?php endif; ?>
              </tbody>
            </table>
          </div>
        </section>

        <section class="table-panel">
          <div class="section-head" style="padding: 15px 16px 0;"><h2>Por estado de conservación</h2><span><?= count($byCondition) ?> estados</span></div>
          <div class="table-scroll">
            <table>
              <thead><tr><th>Estado</th><th>Registros</th><th>Unidades</th></tr></thead>
              <tbody>
                <?php foreach ($byCondition as $row): ?>
                <tr><td><span class="status-pill status-<?= e(mb_strtolower((string) $row['label'], 'UTF-8')) ?>"><?= e($row['label']) ?></span></td><td><?= number_format((int) $row['records'], 0, '.', ',') ?></td><td><?= number_format((int) $row['units'], 0, '.', ',') ?></td></tr>
                <?php endforeach; ?>
                <?php if ($byCondition === []): ?><tr><td colspan="3">Sin datos.</td></tr><?php endif; ?>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section class="table-panel" style="margin-top: 16px;">
        <div class="section-head" style="padding: 15px 16px 0;"><h2>Por área</h2><span><?= count($byLocation) ?> áreas</span></div>
        <div class="table-scroll">
          <table>
            <thead><tr><th>Área</th><th>Registros</th><th>Unidades</th></tr></thead>
            <tbody>
              <?php foreach ($byLocation as $row): ?>
              <tr><td><?= e($row['label']) ?></td><td><?= number_format((int) $row['records'], 0, '.', ',') ?></td><td><?= number_format((int) $row['units'], 0, '.', ',') ?></td></tr>
              <?php endforeach; ?>
              <?php if ($byLocation === []): ?><tr><td colspan="3">Sin datos.</td></tr><?php endif; ?>
            </tbody>
          </table>
        </div>
      </section>

      <section class="table-panel" style="margin-top: 16px;" id="movimientos">
        <div class="section-head" style="padding: 15px 16px 0;"><h2>Últimos cambios de área</h2><span><?= count($movements) ?> cambios</span></div>
        <div class="table-scroll">
          <table>
            <thead><tr><th>Fecha</th><th>Bien</th><th>Desde</th><th>Hacia</th><th>Motivo</th><th>Responsable</th></tr></thead>
            <tbody>
              <?php foreach ($movements as $move): ?>
              <tr>
                <td><?= e(format_datetime($move['created_at'])) ?></td>
                <td><div class="asset-name"><?= e($move['asset_name']) ?></div><div class="asset-code"><?= e($move['asset_code']) ?></div></td>
                <td><?= e($move['from_location']) ?></td>
                <td><?= e($move['to_location']) ?></td>
                <td><?= e($move['reason'] !== '' ? $move['reason'] : '—') ?></td>
                <td><?= e($move['moved_by_name'] ?: ($move['moved_by_email'] ?: '—')) ?></td>
              </tr>
              <?php endforeach; ?>
              <?php if ($movements === []): ?><tr><td colspan="6">Todavía no se registraron cambios de área.</td></tr><?php endif; ?>
            </tbody>
          </table>
        </div>
      </section>
<?php require __DIR__ . '/views/partials/foot.php'; ?>

  <?php require __DIR__ . '/views/partials/export-modal.php'; ?>
  <div class="toast" id="toast" role="status" aria-live="polite"></div>

  <script>
    window.REPORT_EXPORT_CONFIG = {
      csrfToken: <?= json_encode(csrf_token(), JSON_UNESCAPED_UNICODE) ?>
    };
  </script>
  <script src="./assets/js/export-preview.js"></script>
  <script>
    let reportAssets = null;
    let reportToastTimer;

    function showReportToast(message) {
      const toast = document.getElementById("toast");
      toast.textContent = message;
      toast.classList.add("show");
      clearTimeout(reportToastTimer);
      reportToastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
    }

    async function loadReportAssets() {
      if (reportAssets !== null) return reportAssets;
      const response = await fetch("api/api.php?action=list", { headers: { "Accept": "application/json" } });
      const data = await response.json();
      if (!response.ok || data.ok === false) {
        throw new Error(data.error || "No se pudo cargar el inventario.");
      }
      reportAssets = data.assets ?? [];
      return reportAssets;
    }

    window.ExportPreview.init({
      csrfToken: window.REPORT_EXPORT_CONFIG.csrfToken,
      getAll: () => reportAssets ?? [],
      notify: showReportToast
    });

    document.getElementById("printBtn").addEventListener("click", () => window.print());
    document.getElementById("exportBtn").addEventListener("click", async () => {
      try {
        const items = await loadReportAssets();
        if (!items.length) {
          showReportToast("No hay bienes para exportar.");
          return;
        }
        window.ExportPreview.open();
      } catch (error) {
        showReportToast(error.message);
      }
    });
  </script>
</body>
</html>

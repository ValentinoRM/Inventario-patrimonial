<?php
declare(strict_types=1);

require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/helpers.php';
require_once __DIR__ . '/includes/permissions.php';

require_admin();

$pdo = db();

$q = trim((string) ($_GET['q'] ?? ''));
$actionFilter = trim((string) ($_GET['action'] ?? ''));
$page = max(1, (int) ($_GET['page'] ?? 1));
$perPage = 50;

$where = [];
$params = [];

if ($q !== '') {
    $where[] = '(u.name LIKE :q OR u.email LIKE :q OR l.details LIKE :q)';
    $params[':q'] = '%' . $q . '%';
}

if ($actionFilter !== '') {
    $where[] = 'l.action = :action';
    $params[':action'] = $actionFilter;
}

$whereSql = $where === [] ? '' : ' WHERE ' . implode(' AND ', $where);

$countStmt = $pdo->prepare('SELECT COUNT(*) FROM audit_log l LEFT JOIN users u ON u.id = l.user_id' . $whereSql);
$countStmt->execute($params);
$total = (int) $countStmt->fetchColumn();
$pages = max(1, (int) ceil($total / $perPage));
$page = min($page, $pages);
$offset = ($page - 1) * $perPage;

$stmt = $pdo->prepare(
    'SELECT l.id, l.action, l.entity, l.entity_id, l.details, l.ip_address, l.user_agent, l.created_at,
            u.name AS user_name, u.email AS user_email
     FROM audit_log l
     LEFT JOIN users u ON u.id = l.user_id' . $whereSql . '
     ORDER BY l.created_at DESC, l.id DESC
     LIMIT ' . $perPage . ' OFFSET ' . $offset
);
$stmt->execute($params);
$logs = $stmt->fetchAll();

$actions = $pdo->query('SELECT DISTINCT action FROM audit_log ORDER BY action ASC')->fetchAll(PDO::FETCH_COLUMN);

function audit_details_summary(?string $json): string
{
    if ($json === null || $json === '') {
        return '';
    }

    $details = json_decode($json, true);
    if (!is_array($details)) {
        return $json;
    }

    $parts = [];
    if (isset($details['asset_code'])) {
        $parts[] = (string) $details['asset_code'];
    }
    if (isset($details['name']) && $details['name'] !== '') {
        $parts[] = (string) $details['name'];
    }
    if (isset($details['email'])) {
        $parts[] = (string) $details['email'];
    }
    if (isset($details['area'])) {
        $parts[] = 'Área: ' . (string) $details['area'];
    }
    if (isset($details['from_location'], $details['to_location'])) {
        $parts[] = $details['from_location'] . ' → ' . $details['to_location'];
    }
    if (isset($details['from']['area'], $details['to']['area'])) {
        $parts[] = $details['from']['area'] . ' → ' . $details['to']['area'];
    }
    if (isset($details['from']['name'], $details['to']['name'])) {
        $parts[] = $details['from']['name'] . ' → ' . $details['to']['name'];
    }
    if (isset($details['role'])) {
        $parts[] = 'Rol: ' . role_label((string) $details['role']);
    }
    if (isset($details['status'])) {
        $parts[] = 'Estado: ' . status_label((string) $details['status']);
    }
    if (isset($details['reason']) && $details['reason'] !== '') {
        $parts[] = (string) $details['reason'];
    }

    return implode(' · ', $parts);
}

$pageTitle = 'Auditoría';
$activeNav = 'auditoria';
$crumb = 'Auditoría';

require __DIR__ . '/views/partials/head.php';
require __DIR__ . '/views/partials/sidebar.php';
require __DIR__ . '/views/partials/topbar.php';
?>
      <header class="page-head">
        <div><div class="eyebrow">Administración</div><h1>Bitácora de auditoría</h1><p>Seguimiento de accesos, altas, ediciones, cambios de área y cambios de usuarios.</p></div>
      </header>

      <section class="table-panel">
        <form class="toolbar" method="get" action="auditoria.php">
          <label class="searchbox"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10.8" cy="10.8" r="6.3"/><path d="m16 16 4 4"/></svg><input id="auditSearch" name="q" type="search" value="<?= e($q) ?>" placeholder="Buscar por usuario, correo o detalle..." aria-label="Buscar en auditoría"></label>
          <div class="filters">
            <select name="action" aria-label="Filtrar por acción">
              <option value="">Todas las acciones</option>
              <?php foreach ($actions as $action): ?>
              <option value="<?= e($action) ?>"<?= $actionFilter === $action ? ' selected' : '' ?>><?= e(audit_action_label((string) $action)) ?></option>
              <?php endforeach; ?>
            </select>
            <button class="button button-light" type="submit">Filtrar</button>
            <?php if ($q !== '' || $actionFilter !== ''): ?><a class="button button-light" href="auditoria.php">Limpiar</a><?php endif; ?>
          </div>
        </form>
        <div class="table-scroll">
          <table>
            <thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Entidad</th><th>Detalle</th><th>IP</th></tr></thead>
            <tbody>
              <?php foreach ($logs as $log): ?>
              <tr>
                <td><?= e(format_datetime($log['created_at'])) ?></td>
                <td><?= e($log['user_name'] ?: ($log['user_email'] ?: 'Sistema / no identificado')) ?></td>
                <td><span class="log-action"><?= e(audit_action_label((string) $log['action'])) ?></span></td>
                <td><?= e($log['entity']) ?><?= $log['entity_id'] !== null ? ' #' . (int) $log['entity_id'] : '' ?></td>
                <td class="log-detail"><?= e(audit_details_summary($log['details'] !== null ? (string) $log['details'] : null)) ?></td>
                <td><?= e($log['ip_address'] ?: '—') ?></td>
              </tr>
              <?php endforeach; ?>
              <?php if ($logs === []): ?><tr><td colspan="6">No hay registros para los filtros seleccionados.</td></tr><?php endif; ?>
            </tbody>
          </table>
        </div>
        <div class="table-foot">
          <span><?= number_format($total, 0, '.', ',') ?> registros · página <?= $page ?> de <?= $pages ?></span>
          <span class="pagination">
            <?php if ($page > 1): ?>
            <a class="button button-light" href="auditoria.php?<?= e(http_build_query(['q' => $q, 'action' => $actionFilter, 'page' => $page - 1])) ?>">Anterior</a>
            <?php endif; ?>
            <?php if ($page < $pages): ?>
            <a class="button button-light" href="auditoria.php?<?= e(http_build_query(['q' => $q, 'action' => $actionFilter, 'page' => $page + 1])) ?>">Siguiente</a>
            <?php endif; ?>
          </span>
        </div>
      </section>
<?php require __DIR__ . '/views/partials/foot.php'; ?>
</body>
</html>

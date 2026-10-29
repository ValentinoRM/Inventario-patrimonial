<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';

const CONDITION_OPTIONS = ['Bueno', 'Regular', 'Malo'];

/**
 * Devuelve todos los bienes ordenados por creación descendente.
 */
function fetch_assets(?PDO $pdo = null): array
{
    $pdo = $pdo ?? db();
    $rows = $pdo->query(
        'SELECT a.id, a.asset_code, a.barcode, a.name, a.category, a.quantity, a.location, a.area_id, a.custodian, a.`condition`, a.acquired_on, a.notes, a.created_at, a.updated_at, a.created_by, a.updated_by,
                ar.name AS area_name,
                creator.name AS created_by_name, creator.email AS created_by_email,
                updater.name AS updated_by_name, updater.email AS updated_by_email
         FROM assets a
         LEFT JOIN areas ar ON ar.id = a.area_id
         LEFT JOIN users creator ON creator.id = a.created_by
         LEFT JOIN users updater ON updater.id = a.updated_by
         ORDER BY a.created_at DESC, a.id DESC'
    )->fetchAll();

    return array_map('map_asset', $rows);
}

/**
 * Obtiene un bien por su ID.
 */
function get_asset(PDO $pdo, int $id): ?array
{
    $statement = $pdo->prepare(
        'SELECT a.id, a.asset_code, a.barcode, a.name, a.category, a.quantity, a.location, a.area_id, a.custodian, a.`condition`, a.acquired_on, a.notes, a.created_at, a.updated_at, a.created_by, a.updated_by,
                ar.name AS area_name,
                creator.name AS created_by_name, creator.email AS created_by_email,
                updater.name AS updated_by_name, updater.email AS updated_by_email
         FROM assets a
         LEFT JOIN areas ar ON ar.id = a.area_id
         LEFT JOIN users creator ON creator.id = a.created_by
         LEFT JOIN users updater ON updater.id = a.updated_by
         WHERE a.id = :id'
    );
    $statement->execute([':id' => $id]);
    $row = $statement->fetch();

    if (!$row) {
        return null;
    }

    return array_merge(map_asset($row), [
        'created_by' => $row['created_by'] !== null ? (int) $row['created_by'] : null,
        'updated_by' => $row['updated_by'] !== null ? (int) $row['updated_by'] : null,
        'raw'        => $row,
    ]);
}

/**
 * Historial de cambios de área de un bien.
 */
function fetch_asset_movements(PDO $pdo, int $assetId): array
{
    $statement = $pdo->prepare(
        'SELECT m.id, m.asset_id, m.from_location, m.to_location, m.reason, m.created_at, u.name AS moved_by_name, u.email AS moved_by_email
         FROM asset_movements m
         LEFT JOIN users u ON u.id = m.moved_by
         WHERE m.asset_id = :asset_id
         ORDER BY m.created_at DESC, m.id DESC'
    );
    $statement->execute([':asset_id' => $assetId]);

    return $statement->fetchAll();
}

/**
 * Normaliza una fila de la base de datos al formato que usa la interfaz.
 */
function map_asset(array $row): array
{
    return [
        'id'         => (int) $row['id'],
        'asset_code' => (string) $row['asset_code'],
        'barcode'    => (string) ($row['barcode'] ?? ''),
        'name'       => (string) $row['name'],
        'category'   => (string) $row['category'],
        'quantity'   => (int) $row['quantity'],
        'area_id'    => isset($row['area_id']) && $row['area_id'] !== null ? (int) $row['area_id'] : null,
        'location'   => (string) (($row['area_name'] ?? '') !== '' ? $row['area_name'] : ($row['location'] ?? '')),
        'custodian'  => (string) ($row['custodian'] ?? ''),
        'condition'  => (string) $row['condition'],
        'acquired'   => (string) ($row['acquired_on'] ?? ''),
        'notes'      => (string) ($row['notes'] ?? ''),
        'created_by'      => isset($row['created_by']) ? (int) $row['created_by'] : null,
        'created_by_name' => (string) ($row['created_by_name'] ?? ''),
        'updated_by_name' => (string) ($row['updated_by_name'] ?? ''),
    ];
}

/**
 * Resumen general del inventario para reportes.
 */
function fetch_inventory_summary(PDO $pdo): array
{
    $row = $pdo->query(
        'SELECT COUNT(*) AS records, COALESCE(SUM(quantity), 0) AS units,
                COUNT(DISTINCT area_id) AS locations
         FROM assets'
    )->fetch();

    return [
        'records'   => (int) ($row['records'] ?? 0),
        'units'     => (int) ($row['units'] ?? 0),
        'locations' => (int) ($row['locations'] ?? 0),
    ];
}

/**
 * Agrupaciones para reportes.
 */
function fetch_inventory_breakdown(PDO $pdo, string $column): array
{
    $allowed = ['category', 'location', 'condition'];
    if (!in_array($column, $allowed, true)) {
        throw new InvalidArgumentException('Agrupación no permitida.');
    }

    if ($column === 'location') {
        return $pdo->query(
            "SELECT COALESCE(ar.name, a.location) AS label, COUNT(*) AS records, COALESCE(SUM(a.quantity), 0) AS units
             FROM assets a
             LEFT JOIN areas ar ON ar.id = a.area_id
             GROUP BY label
             ORDER BY units DESC, label ASC"
        )->fetchAll();
    }

    return $pdo->query(
        "SELECT `$column` AS label, COUNT(*) AS records, COALESCE(SUM(quantity), 0) AS units
         FROM assets
         GROUP BY `$column`
         ORDER BY units DESC, label ASC"
    )->fetchAll();
}

/**
 * Últimos cambios de área registrados en el sistema.
 */
function fetch_recent_movements(PDO $pdo, int $limit = 20): array
{
    $limit = max(1, min($limit, 200));
    $rows = $pdo->query(
        "SELECT m.id, m.asset_id, m.from_location, m.to_location, m.reason, m.created_at,
                a.asset_code, a.name AS asset_name,
                u.name AS moved_by_name, u.email AS moved_by_email
         FROM asset_movements m
         INNER JOIN assets a ON a.id = m.asset_id
         LEFT JOIN users u ON u.id = m.moved_by
         ORDER BY m.created_at DESC, m.id DESC
         LIMIT $limit"
    )->fetchAll();

    return $rows;
}

/**
 * Genera el siguiente código patrimonial (HC-0001, HC-0002, ...) de forma segura.
 */
function next_asset_code(PDO $pdo): string
{
    $pdo->beginTransaction();

    try {
        $pdo->exec('UPDATE asset_sequence SET last_number = last_number + 1 WHERE id = 1');
        $number = (int) $pdo->query('SELECT last_number FROM asset_sequence WHERE id = 1')->fetchColumn();
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }

    return 'HC-' . str_pad((string) $number, 4, '0', STR_PAD_LEFT);
}

/**
 * Valida y normaliza la entrada del formulario. Devuelve [$data, $errors].
 */
function validate_asset_input(array $input): array
{
    $errors = [];

    $name = trim((string) ($input['name'] ?? ''));
    if ($name === '' || mb_strlen($name) > 90) {
        $errors[] = 'El nombre es obligatorio (máximo 90 caracteres).';
    }

    $category = trim((string) ($input['category'] ?? ''));
    if ($category === '' || mb_strlen($category) > 60) {
        $errors[] = 'La categoría es obligatoria.';
    }

    $quantity = filter_var($input['quantity'] ?? null, FILTER_VALIDATE_INT, [
        'options' => ['min_range' => 1, 'max_range' => 99999],
    ]);
    if ($quantity === false) {
        $errors[] = 'La cantidad debe ser un número entre 1 y 99999.';
    }

    $areaId = filter_var($input['area_id'] ?? null, FILTER_VALIDATE_INT, [
        'options' => ['min_range' => 1],
    ]);
    if ($areaId === false) {
        $errors[] = 'El área es obligatoria.';
    }

    $custodian = trim((string) ($input['custodian'] ?? ''));
    if (mb_strlen($custodian) > 70) {
        $errors[] = 'El responsable no debe superar 70 caracteres.';
    }

    $condition = (string) ($input['condition'] ?? '');
    if (!in_array($condition, CONDITION_OPTIONS, true)) {
        $errors[] = 'El estado de conservación no es válido.';
    }

    $barcode = trim((string) ($input['barcode'] ?? ''));
    if (mb_strlen($barcode) > 120) {
        $errors[] = 'El código de barras no debe superar 120 caracteres.';
    }

    $acquired = trim((string) ($input['acquired'] ?? ''));
    if ($acquired !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $acquired)) {
        $errors[] = 'La fecha de adquisición no es válida.';
    }

    $notes = trim((string) ($input['notes'] ?? ''));
    if (mb_strlen($notes) > 300) {
        $errors[] = 'Las observaciones no deben superar 300 caracteres.';
    }

    return [[
        'name'        => $name,
        'category'    => $category,
        'quantity'    => $quantity === false ? 0 : (int) $quantity,
        'area_id'     => $areaId === false ? 0 : (int) $areaId,
        'custodian'   => $custodian,
        'condition'   => $condition,
        'barcode'     => $barcode !== '' ? $barcode : null,
        'acquired_on' => $acquired !== '' ? $acquired : null,
        'notes'       => $notes,
    ], $errors];
}

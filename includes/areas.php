<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';

const AREA_STATUS_OPTIONS = ['activo', 'inactivo'];

/**
 * Devuelve las áreas con la cantidad de bienes y unidades asignadas.
 */
function fetch_areas(?PDO $pdo = null, bool $onlyActive = false): array
{
    $pdo = $pdo ?? db();
    $where = $onlyActive ? " WHERE ar.status = 'activo'" : '';

    $rows = $pdo->query(
        "SELECT ar.id, ar.name, ar.status, ar.created_at, ar.updated_at,
                COUNT(a.id) AS asset_count, COALESCE(SUM(a.quantity), 0) AS units
         FROM areas ar
         LEFT JOIN assets a ON a.area_id = ar.id
         {$where}
         GROUP BY ar.id, ar.name, ar.status, ar.created_at, ar.updated_at
         ORDER BY ar.name ASC"
    )->fetchAll();

    return array_map(static function (array $row): array {
        return [
            'id'          => (int) $row['id'],
            'name'        => (string) $row['name'],
            'status'      => (string) $row['status'],
            'asset_count' => (int) $row['asset_count'],
            'units'       => (int) $row['units'],
            'created_at'  => (string) ($row['created_at'] ?? ''),
            'updated_at'  => (string) ($row['updated_at'] ?? ''),
        ];
    }, $rows);
}

/**
 * Obtiene un área por su ID.
 */
function get_area(PDO $pdo, int $id): ?array
{
    $statement = $pdo->prepare('SELECT id, name, status, created_at, updated_at FROM areas WHERE id = :id LIMIT 1');
    $statement->execute([':id' => $id]);
    $row = $statement->fetch();

    if (!$row) {
        return null;
    }

    return [
        'id'         => (int) $row['id'],
        'name'       => (string) $row['name'],
        'status'     => (string) $row['status'],
        'created_at' => (string) ($row['created_at'] ?? ''),
        'updated_at' => (string) ($row['updated_at'] ?? ''),
    ];
}

/**
 * Busca un área por nombre sin distinguir mayúsculas ni espacios externos.
 */
function find_area_by_name(PDO $pdo, string $name, ?int $excludeId = null): ?array
{
    $sql = 'SELECT id, name, status FROM areas WHERE LOWER(name) = LOWER(:name)';
    $params = [':name' => trim($name)];

    if ($excludeId !== null) {
        $sql .= ' AND id <> :id';
        $params[':id'] = $excludeId;
    }

    $statement = $pdo->prepare($sql . ' LIMIT 1');
    $statement->execute($params);
    $row = $statement->fetch();

    return $row ?: null;
}

/**
 * Valida y normaliza la entrada de un área. Devuelve [$data, $errors].
 */
function validate_area_input(array $input, ?PDO $pdo = null, ?int $excludeId = null): array
{
    $errors = [];

    $name = trim((string) ($input['name'] ?? ''));
    if ($name === '' || mb_strlen($name) > 70) {
        $errors[] = 'El nombre del área es obligatorio (máximo 70 caracteres).';
    }

    $status = (string) ($input['status'] ?? 'activo');
    if (!in_array($status, AREA_STATUS_OPTIONS, true)) {
        $errors[] = 'El estado del área no es válido.';
    }

    if ($name !== '' && $pdo !== null && find_area_by_name($pdo, $name, $excludeId) !== null) {
        $errors[] = 'Ya existe un área con ese nombre.';
    }

    return [[
        'name'   => $name,
        'status' => $status,
    ], $errors];
}

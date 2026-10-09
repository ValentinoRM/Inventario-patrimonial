<?php
declare(strict_types=1);

require_once __DIR__ . '/config/database.php';

const CONDITION_OPTIONS = ['Bueno', 'Regular', 'Malo'];

/**
 * Devuelve todos los bienes ordenados por creación descendente.
 */
function fetch_assets(?PDO $pdo = null): array
{
    $pdo = $pdo ?? db();
    $rows = $pdo->query(
        'SELECT id, asset_code, barcode, name, category, quantity, location, custodian, `condition`, acquired_on, value, notes, created_at, updated_at
         FROM assets
         ORDER BY created_at DESC, id DESC'
    )->fetchAll();

    return array_map('map_asset', $rows);
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
        'location'   => (string) $row['location'],
        'custodian'  => (string) ($row['custodian'] ?? ''),
        'condition'  => (string) $row['condition'],
        'acquired'   => (string) ($row['acquired_on'] ?? ''),
        'value'      => (float) $row['value'],
        'notes'      => (string) ($row['notes'] ?? ''),
    ];
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

    $location = trim((string) ($input['location'] ?? ''));
    if ($location === '' || mb_strlen($location) > 70) {
        $errors[] = 'El ambiente es obligatorio (máximo 70 caracteres).';
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

    $value = $input['value'] ?? 0;
    if ($value === '' || $value === null) {
        $value = 0;
    }
    if (!is_numeric($value) || (float) $value < 0) {
        $errors[] = 'El valor referencial no es válido.';
    }

    $notes = trim((string) ($input['notes'] ?? ''));
    if (mb_strlen($notes) > 300) {
        $errors[] = 'Las observaciones no deben superar 300 caracteres.';
    }

    return [[
        'name'        => $name,
        'category'    => $category,
        'quantity'    => $quantity === false ? 0 : (int) $quantity,
        'location'    => $location,
        'custodian'   => $custodian,
        'condition'   => $condition,
        'barcode'     => $barcode !== '' ? $barcode : null,
        'acquired_on' => $acquired !== '' ? $acquired : null,
        'value'       => round((float) $value, 2),
        'notes'       => $notes,
    ], $errors];
}

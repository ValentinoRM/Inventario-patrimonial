<?php
declare(strict_types=1);

/**
 * Prueba de humo: validación de datos y carga de credenciales (.env).
 * Ejecutar: php tests/prueba.php
 */

require_once __DIR__ . '/../includes/assets.php';

$fallas = 0;

function verificar(string $nombre, bool $condicion): void
{
    global $fallas;
    if ($condicion) {
        echo "  OK   $nombre\n";
    } else {
        echo "  FALLO $nombre\n";
        $fallas++;
    }
}

// .env cargado
verificar('Credenciales .env cargadas (DB_NAME)', DB_NAME === 'inventario_patrimonial');
verificar('DB_USER definido desde .env', DB_USER !== '');

// Entrada válida
[$datos, $errores] = validate_asset_input([
    'name'      => 'Escritorio de madera',
    'category'  => 'Muebles',
    'quantity'  => 2,
    'location'  => 'Secretaría general',
    'custodian' => 'Juan Pérez',
    'condition' => 'Bueno',
    'acquired'  => '2026-01-15',
    'notes'     => 'Prueba',
    'barcode'   => '',
]);
verificar('Entrada válida sin errores', $errores === []);
verificar('Barcode vacío se vuelve null', $datos['barcode'] === null);

// Entradas inválidas
[, $errores] = validate_asset_input([]);
verificar('Sin nombre hay error', $errores !== []);
verificar('Cantidad 0 es inválida', in_array('La cantidad debe ser un número entre 1 y 99999.', $errores, true));

[, $errores] = validate_asset_input([
    'name'      => 'X',
    'category'  => 'Muebles',
    'quantity'  => 1,
    'location'  => 'Aula',
    'condition' => 'Excelente',
]);
verificar('Estado fuera de opciones genera error', $errores !== []);

[, $errores] = validate_asset_input([
    'name'      => 'X',
    'category'  => 'Muebles',
    'quantity'  => 1,
    'location'  => 'Aula',
    'condition' => 'Bueno',
    'acquired'  => '15/01/2026',
]);
verificar('Fecha mal formateada genera error', $errores !== []);

echo $fallas === 0 ? "\nTodas las pruebas pasaron.\n" : "\n$fallas prueba(s) fallaron.\n";
exit($fallas === 0 ? 0 : 1);

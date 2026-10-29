<?php
declare(strict_types=1);

require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/assets.php';

require_login();

if (!is_admin()) {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Solo un administrador puede exportar el inventario.';
    exit;
}

$assets = fetch_assets();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!csrf_valid($_POST['csrf_token'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? null))) {
        http_response_code(419);
        header('Content-Type: text/plain; charset=utf-8');
        echo 'La sesión expiró. Recarga la página e inténtalo de nuevo.';
        exit;
    }

    $idsRaw = trim((string) ($_POST['ids'] ?? ''));
    if ($idsRaw !== '') {
        $ids = array_values(array_unique(array_filter(
            array_map(static fn (string $value): int => (int) trim($value), explode(',', $idsRaw)),
            static fn (int $id): bool => $id > 0
        )));

        if ($ids === []) {
            http_response_code(422);
            header('Content-Type: text/plain; charset=utf-8');
            echo 'No se recibieron bienes válidos para exportar.';
            exit;
        }

        $byId = [];
        foreach ($assets as $asset) {
            $byId[(int) $asset['id']] = $asset;
        }

        $selected = [];
        foreach ($ids as $id) {
            if (isset($byId[$id])) {
                $selected[] = $byId[$id];
            }
        }

        if ($selected === []) {
            http_response_code(422);
            header('Content-Type: text/plain; charset=utf-8');
            echo 'Los bienes seleccionados ya no existen.';
            exit;
        }

        $assets = $selected;
    }
}

$columns = ['Código patrimonial', 'Código de barras', 'Nombre', 'Categoría', 'Cantidad', 'Área', 'Responsable', 'Estado', 'Fecha de adquisición', 'Observaciones'];
$keys    = ['asset_code', 'barcode', 'name', 'category', 'quantity', 'location', 'custodian', 'condition', 'acquired', 'notes'];
$filename = 'inventario-patrimonial-huamancaca-chico';

$autoload = __DIR__ . '/vendor/autoload.php';

if (is_file($autoload)) {
    require_once $autoload;

    $spreadsheet = new \PhpOffice\PhpSpreadsheet\Spreadsheet();
    $sheet = $spreadsheet->getActiveSheet();
    $sheet->setTitle('Inventario');

    $sheet->fromArray($columns, null, 'A1');
    $sheet->getStyle('A1:J1')->getFont()->setBold(true);

    $rowIndex = 2;
    foreach ($assets as $asset) {
        $row = [];
        foreach ($keys as $key) {
            $row[] = $asset[$key] ?? '';
        }
        $sheet->fromArray($row, null, 'A' . $rowIndex);
        $rowIndex++;
    }

    foreach (['A' => 20, 'B' => 18, 'C' => 30, 'D' => 24, 'E' => 12, 'F' => 24, 'G' => 28, 'H' => 14, 'I' => 20, 'J' => 40] as $column => $width) {
        $sheet->getColumnDimension($column)->setWidth($width);
    }

    header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    header('Content-Disposition: attachment; filename="' . $filename . '.xlsx"');
    header('Cache-Control: max-age=0');

    $writer = new \PhpOffice\PhpSpreadsheet\Writer\Xlsx($spreadsheet);
    $writer->save('php://output');
    exit;
}

// Respaldo sin Composer: archivo CSV compatible con Excel.
header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename="' . $filename . '.csv"');

$output = fopen('php://output', 'w');
fwrite($output, "\xEF\xBB\xBF");
fputcsv($output, $columns);

foreach ($assets as $asset) {
    $row = [];
    foreach ($keys as $key) {
        $row[] = $asset[$key] ?? '';
    }
    fputcsv($output, $row);
}

fclose($output);
exit;

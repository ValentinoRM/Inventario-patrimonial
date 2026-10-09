<?php
declare(strict_types=1);

require_once __DIR__ . '/../src/auth.php';
require_once __DIR__ . '/../src/assets.php';

require_login();

$assets = fetch_assets();

$columns = ['Código patrimonial', 'Código de barras', 'Nombre', 'Categoría', 'Cantidad', 'Ambiente', 'Responsable', 'Estado', 'Fecha de adquisición', 'Valor referencial (S/)', 'Observaciones'];
$keys    = ['asset_code', 'barcode', 'name', 'category', 'quantity', 'location', 'custodian', 'condition', 'acquired', 'value', 'notes'];
$filename = 'inventario-patrimonial-huamancaca-chico';

$autoload = __DIR__ . '/../vendor/autoload.php';

if (is_file($autoload)) {
    require_once $autoload;

    $spreadsheet = new \PhpOffice\PhpSpreadsheet\Spreadsheet();
    $sheet = $spreadsheet->getActiveSheet();
    $sheet->setTitle('Inventario');

    $sheet->fromArray($columns, null, 'A1');
    $sheet->getStyle('A1:K1')->getFont()->setBold(true);

    $rowIndex = 2;
    foreach ($assets as $asset) {
        $row = [];
        foreach ($keys as $key) {
            $row[] = $asset[$key] ?? '';
        }
        $sheet->fromArray($row, null, 'A' . $rowIndex);
        $rowIndex++;
    }

    foreach (['A' => 20, 'B' => 18, 'C' => 30, 'D' => 24, 'E' => 12, 'F' => 24, 'G' => 28, 'H' => 14, 'I' => 20, 'J' => 22, 'K' => 40] as $column => $width) {
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

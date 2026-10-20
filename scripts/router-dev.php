<?php
declare(strict_types=1);

/**
 * Router para el servidor de desarrollo de PHP (php -S).
 * Bloquea las mismas carpetas internas que protege el .htaccess de Apache.
 */

$uri = urldecode((string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH));

$bloqueadas = ['config', 'includes', 'database', 'scripts', 'docs', 'tests', 'vendor'];

foreach ($bloqueadas as $carpeta) {
    if ($uri === '/' . $carpeta || str_starts_with($uri, '/' . $carpeta . '/')) {
        http_response_code(403);
        header('Content-Type: text/plain; charset=utf-8');
        echo 'Prohibido';
        return true;
    }
}

if (preg_match('#^/\.env#', $uri) || preg_match('#^/composer\.(json|lock)$#', $uri)) {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Prohibido';
    return true;
}

if ($uri === '/' || $uri === '') {
    require __DIR__ . '/../index.php';
    return true;
}

$file = realpath(__DIR__ . '/..' . $uri);
$raiz = realpath(__DIR__ . '/..');

if ($file !== false && str_starts_with($file, $raiz) && is_file($file)) {
    return false; // El servidor de PHP sirve el archivo (CSS, JS, PHP de páginas y api/).
}

http_response_code(404);
header('Content-Type: text/plain; charset=utf-8');
echo 'No encontrado';
return true;

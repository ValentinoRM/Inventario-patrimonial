<?php
declare(strict_types=1);

/*
 * Conexión a la base de datos MySQL/MariaDB local.
 * FORZA conexión por socket UNIX para evitar problemas de autenticación TCP.
 * Copia .env.example a .env y coloca ahí tus credenciales.
 */
require_once __DIR__ . '/env.php';

/* FORZAR conexión por socket UNIX */
define('DB_HOST', 'localhost');  // 'localhost' activará modo socket
define('DB_PORT', '3306');
define('DB_NAME', 'inventario_patrimonial');
define('DB_USER', 'root');  // usuario root
define('DB_PASS', '');      // sin contraseña
const DB_CHARSET = 'utf8mb4';

function db(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    // Modo socket UNIX cuando DB_HOST es 'localhost'
    $dsn = sprintf(
        'mysql:unix_socket=/opt/lampp/var/mysql/mysql.sock;port=%s;dbname=%s;charset=%s',
        DB_PORT,
        DB_NAME,
        DB_CHARSET
    );

    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);

    return $pdo;
}

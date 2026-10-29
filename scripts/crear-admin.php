<?php
declare(strict_types=1);

/**
 * Crea cuentas de acceso desde la terminal.
 *
 * Uso:
 *   php scripts/crear-admin.php                       (interactivo)
 *   php scripts/crear-admin.php admin@mun.gob.pe "Clave1234" "Nombre" admin
 *   php scripts/crear-admin.php user@mun.gob.pe  "Clave1234" "Nombre" user
 */

require_once __DIR__ . '/../config/database.php';

function pedir(string $etiqueta, bool $oculto = false): string
{
    if ($oculto && function_exists('shell_exec')) {
        echo $etiqueta;
        $stty = shell_exec('stty -echo 2>/dev/null');
        $valor = trim((string) fgets(STDIN));
        if ($stty !== null) {
            shell_exec('stty echo 2>/dev/null');
            echo PHP_EOL;
        }
        return $valor;
    }

    echo $etiqueta;
    return trim((string) fgets(STDIN));
}

$argumentos = $argv;
array_shift($argumentos);

$email    = $argumentos[0] ?? pedir('Correo electrónico: ');
$clave    = $argumentos[1] ?? pedir('Contraseña (mín. 8 caracteres): ', true);
$nombre   = $argumentos[2] ?? pedir('Nombre completo: ');
$rol      = $argumentos[3] ?? pedir('Rol (admin/user): ');
$rol      = strtolower(trim($rol));

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    fwrite(STDERR, "Correo no válido.\n");
    exit(1);
}
if (strlen($clave) < 8) {
    fwrite(STDERR, "La contraseña debe tener al menos 8 caracteres.\n");
    exit(1);
}
if (!in_array($rol, ['admin', 'user'], true)) {
    fwrite(STDERR, "El rol debe ser admin o user.\n");
    exit(1);
}

try {
    $pdo = db();

    $existe = $pdo->prepare('SELECT id FROM users WHERE email = :email');
    $existe->execute([':email' => $email]);
    if ($existe->fetchColumn()) {
        fwrite(STDERR, "Ya existe una cuenta con ese correo: $email\n");
        exit(1);
    }

    $statement = $pdo->prepare(
        'INSERT INTO users (email, password_hash, name, role, must_change_password) VALUES (:email, :hash, :name, :role, 1)'
    );
    $statement->execute([
        ':email' => $email,
        ':hash'  => password_hash($clave, PASSWORD_DEFAULT),
        ':name'  => $nombre !== '' ? $nombre : 'Usuario municipal',
        ':role'  => $rol,
    ]);

    echo "Cuenta creada correctamente.\n";
    echo "  Correo : $email\n";
    echo "  Clave  : $clave\n";
    echo "  Rol    : $rol\n";
} catch (PDOException $e) {
    fwrite(STDERR, 'Error al crear la cuenta: ' . $e->getMessage() . "\n");
    exit(1);
}

<?php
declare(strict_types=1);

/**
 * Restablece la contraseña de una cuenta existente.
 *
 * Uso:
 *   php scripts/reset-clave.php                        (interactivo)
 *   php scripts/reset-clave.php admin@huamancaca.gob.pe "NuevaClave123"
 */

require_once __DIR__ . '/../config/database.php';

function pedir(string $etiqueta, bool $oculto = false): string
{
    if ($oculto && function_exists('shell_exec')) {
        echo $etiqueta;
        shell_exec('stty -echo 2>/dev/null');
        $valor = trim((string) fgets(STDIN));
        shell_exec('stty echo 2>/dev/null');
        echo PHP_EOL;
        return $valor;
    }

    echo $etiqueta;
    return trim((string) fgets(STDIN));
}

$argumentos = $argv;
array_shift($argumentos);

$email = $argumentos[0] ?? pedir('Correo de la cuenta: ');
$clave = $argumentos[1] ?? pedir('Nueva contraseña (mín. 8 caracteres): ', true);

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    fwrite(STDERR, "Correo no válido.\n");
    exit(1);
}
if (strlen($clave) < 8) {
    fwrite(STDERR, "La contraseña debe tener al menos 8 caracteres.\n");
    exit(1);
}

try {
    $pdo = db();

    $statement = $pdo->prepare('UPDATE users SET password_hash = :hash, must_change_password = 1 WHERE email = :email');
    $statement->execute([
        ':hash'  => password_hash($clave, PASSWORD_DEFAULT),
        ':email' => $email,
    ]);

    if ($statement->rowCount() === 0) {
        fwrite(STDERR, "No existe ninguna cuenta con el correo: $email\n");
        exit(1);
    }

    echo "Contraseña actualizada.\n";
    echo "  Correo : $email\n";
    echo "  Clave  : $clave\n";
} catch (PDOException $e) {
    fwrite(STDERR, 'Error al actualizar la contraseña: ' . $e->getMessage() . "\n");
    exit(1);
}

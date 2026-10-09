<?php
declare(strict_types=1);

require_once __DIR__ . '/../src/auth.php';

$error = '';
$alreadyInstalled = false;

try {
    $alreadyInstalled = (int) db()->query('SELECT COUNT(*) FROM users')->fetchColumn() > 0;
} catch (Throwable $e) {
    $error = 'No se pudo conectar con la base de datos. Revisa config/database.php y ejecuta database/schema.sql.';
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && !$alreadyInstalled && $error === '') {
    $name     = trim((string) ($_POST['name'] ?? ''));
    $email    = trim((string) ($_POST['email'] ?? ''));
    $password = (string) ($_POST['password'] ?? '');

    if (!csrf_valid($_POST['csrf_token'] ?? null)) {
        $error = 'La sesión expiró. Vuelve a intentarlo.';
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $error = 'Ingresa un correo electrónico válido.';
    } elseif (strlen($password) < 8) {
        $error = 'La contraseña debe tener al menos 8 caracteres.';
    } else {
        try {
            $statement = db()->prepare(
                "INSERT INTO users (email, password_hash, name, role) VALUES (:email, :hash, :name, 'admin')"
            );
            $statement->execute([
                ':email' => $email,
                ':hash'  => password_hash($password, PASSWORD_DEFAULT),
                ':name'  => $name !== '' ? $name : 'Administrador',
            ]);
            $alreadyInstalled = true;
        } catch (Throwable $e) {
            $error = 'No se pudo crear la cuenta. Quizá el correo ya existe.';
        }
    }
}
?>
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Instalación | Inventario patrimonial</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="./assets/css/styles.css">
</head>
<body>
  <section class="auth-screen">
    <form class="auth-card" method="post" action="instalar.php">
      <div class="auth-brand"><div class="brand-mark" aria-hidden="true">HC</div> Inventario patrimonial municipal</div>
      <div class="eyebrow">Configuración inicial</div>
      <h1>Crear administrador</h1>

      <?php if ($alreadyInstalled): ?>
        <p>El sistema ya tiene usuarios registrados. Puedes iniciar sesión con tu cuenta municipal.</p>
        <a class="button button-primary" href="login.php">Ir a iniciar sesión</a>
      <?php else: ?>
        <p>Crea la primera cuenta de administrador. Solo los administradores pueden eliminar bienes.</p>
        <div class="field"><label for="name">Nombre</label><input id="name" name="name" maxlength="120" placeholder="Nombre del responsable" required></div>
        <div class="field" style="margin-top:13px"><label for="email">Correo electrónico</label><input id="email" name="email" type="email" maxlength="190" required></div>
        <div class="field" style="margin-top:13px"><label for="password">Contraseña (mínimo 8 caracteres)</label><input id="password" name="password" type="password" minlength="8" required></div>
        <input type="hidden" name="csrf_token" value="<?= htmlspecialchars(csrf_token(), ENT_QUOTES, 'UTF-8') ?>">
        <button class="button button-primary" type="submit">Crear administrador</button>
      <?php endif; ?>

      <?php if ($error !== ''): ?>
        <div class="auth-error" role="alert"><?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?></div>
      <?php endif; ?>
    </form>
  </section>
</body>
</html>

<?php
declare(strict_types=1);

require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/audit.php';

if (is_logged_in()) {
    header('Location: index.php');
    exit;
}

$error = isset($_GET['inactive']) ? 'Tu cuenta fue desactivada o ya no tiene acceso. Contacta al administrador.' : '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email    = trim((string) ($_POST['email'] ?? ''));
    $password = (string) ($_POST['password'] ?? '');

    if (!csrf_valid($_POST['csrf_token'] ?? null)) {
        $error = 'La sesión expiró. Vuelve a intentarlo.';
    } else {
        try {
            $statement = db()->prepare('SELECT id, email, password_hash, name, role, status FROM users WHERE email = :email LIMIT 1');
            $statement->execute([':email' => $email]);
            $user = $statement->fetch();

            if ($user && password_verify($password, $user['password_hash'])) {
                if (($user['status'] ?? 'activo') !== 'activo') {
                    audit_log('login_failed', 'user', (int) $user['id'], ['email' => $email, 'reason' => 'inactive']);
                    $error = 'Tu cuenta se encuentra inactiva. Contacta al administrador.';
                } else {
                    login_user($user);

                    try {
                        $update = db()->prepare('UPDATE users SET last_login_at = NOW(), last_login_ip = :ip WHERE id = :id');
                        $update->execute([
                            ':ip' => substr((string) ($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45),
                            ':id' => (int) $user['id'],
                        ]);
                    } catch (Throwable $ignore) {
                    }

                    audit_log('login', 'user', (int) $user['id'], ['email' => $email], (int) $user['id']);
                    header('Location: index.php');
                    exit;
                }
            } else {
                try {
                    audit_log('login_failed', 'user', null, ['email' => $email]);
                } catch (Throwable $ignore) {
                }
                $error = 'Correo o contraseña incorrectos.';
            }
        } catch (Throwable $e) {
            $error = 'No se pudo conectar con la base de datos. Revisa config/database.php.';
        }
    }
}
?>
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#1f6f58">
  <link rel="icon" type="image/jpeg" href="./assets/img/icono.jpg">
  <title>Iniciar sesión | Inventario patrimonial</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="./assets/css/styles.css">
</head>
<body>
  <section class="auth-screen">
    <form class="auth-card" method="post" action="login.php">
      <div class="auth-brand"><div class="brand-mark" aria-hidden="true"><img src="./assets/img/icono.jpg" alt=""></div> Inventario patrimonial municipal</div>
      <div class="eyebrow">Acceso al sistema</div>
      <h1>Iniciar sesión</h1>
      <p>Ingresa con la cuenta municipal que te asignó la persona administradora.</p>
      <div class="field"><label for="loginEmail">Correo electrónico</label><input id="loginEmail" name="email" type="email" autocomplete="username" required></div>
      <div class="field" style="margin-top:13px"><label for="loginPassword">Contraseña</label><input id="loginPassword" name="password" type="password" autocomplete="current-password" required></div>
      <input type="hidden" name="csrf_token" value="<?= htmlspecialchars(csrf_token(), ENT_QUOTES, 'UTF-8') ?>">
      <button class="button button-primary" type="submit">Ingresar</button>
      <?php if ($error !== ''): ?>
        <div class="auth-error" role="alert"><?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?></div>
      <?php endif; ?>
    </form>
  </section>
</body>
</html>

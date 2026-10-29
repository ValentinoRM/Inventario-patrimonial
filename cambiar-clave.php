<?php
declare(strict_types=1);

require_once __DIR__ . '/includes/auth.php';

require_login();

$forced = must_change_password();
?>
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#1f6f58">
  <link rel="icon" type="image/jpeg" href="./assets/img/icono.jpg">
  <title>Cambiar contraseña | Inventario patrimonial</title>
  <link rel="stylesheet" href="./assets/css/styles.css">
</head>
<body>
  <section class="auth-screen">
    <form class="auth-card" id="changePasswordForm">
      <div class="auth-brand"><div class="brand-mark" aria-hidden="true"><img src="./assets/img/icono.jpg" alt=""></div> Inventario patrimonial municipal</div>
      <div class="eyebrow"><?= $forced ? 'Cambio requerido' : 'Seguridad de la cuenta' ?></div>
      <h1>Cambiar contraseña</h1>
      <p><?= $forced ? 'Por seguridad, cambia la contraseña que te asignaron para continuar.' : 'Actualiza la contraseña de tu cuenta.' ?></p>
      <div class="field"><label for="currentPassword">Contraseña actual</label><input id="currentPassword" name="current_password" type="password" autocomplete="current-password" required></div>
      <div class="field" style="margin-top:13px"><label for="newPassword">Nueva contraseña</label><input id="newPassword" name="new_password" type="password" minlength="8" autocomplete="new-password" required></div>
      <div class="field" style="margin-top:13px"><label for="confirmPassword">Confirmar nueva contraseña</label><input id="confirmPassword" name="confirm_password" type="password" minlength="8" autocomplete="new-password" required></div>
      <button class="button button-primary" type="submit">Guardar contraseña</button>
      <div class="auth-error" id="passwordError" role="alert" hidden></div>
      <p><a href="logout.php">Cerrar sesión</a></p>
    </form>
  </section>
  <script>
    const form = document.getElementById("changePasswordForm");
    const errorBox = document.getElementById("passwordError");
    form.addEventListener("submit", async event => {
      event.preventDefault();
      errorBox.hidden = true;
      const values = Object.fromEntries(new FormData(form).entries());
      if (values.new_password !== values.confirm_password) {
        errorBox.textContent = "Las contraseñas nuevas no coinciden.";
        errorBox.hidden = false;
        return;
      }

      const button = form.querySelector("button[type=submit]");
      button.disabled = true;
      try {
        const response = await fetch("api/users.php?action=change_password", {
          method: "POST",
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "X-CSRF-Token": <?= json_encode(csrf_token(), JSON_UNESCAPED_UNICODE) ?>
          },
          body: JSON.stringify({
            action: "change_password",
            current_password: values.current_password,
            new_password: values.new_password,
            csrf_token: <?= json_encode(csrf_token(), JSON_UNESCAPED_UNICODE) ?>
          })
        });
        const data = await response.json();
        if (!response.ok || data.ok === false) {
          throw new Error(data.error || "No se pudo cambiar la contraseña.");
        }
        window.location.href = "index.php";
      } catch (error) {
        errorBox.textContent = error.message || "No se pudo cambiar la contraseña.";
        errorBox.hidden = false;
      } finally {
        button.disabled = false;
      }
    });
  </script>
</body>
</html>

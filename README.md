# Inventario patrimonial municipal

Aplicación web en **PHP + MySQL** para la Municipalidad Distrital de Huamancaca Chico. Permite registrar, consultar, editar y eliminar los bienes patrimoniales municipales, con inicio de sesión y roles de acceso.

## Requisitos

- PHP 8.1 o superior con las extensiones `pdo_mysql`, `session` y `mbstring`.
- MySQL o MariaDB (XAMPP, WAMP, Laragon o LAMP).
- Composer (opcional, solo para exportar en formato `.xlsx`).

## Estructura del proyecto

```
inventario-patrimonial/
├── public/                 # Único directorio expuesto a la web
│   ├── index.php           # Inventario (requiere sesión)
│   ├── login.php           # Inicio de sesión
│   ├── logout.php          # Cierre de sesión
│   ├── instalar.php        # Creación del primer administrador
│   ├── api.php             # Endpoints JSON (listar, crear, editar, eliminar)
│   ├── export.php          # Exportación a Excel/CSV
│   └── assets/
│       ├── css/styles.css
│       └── js/app.js
├── src/                    # Código interno (no accesible desde la web)
│   ├── config/database.php # Conexión PDO a MySQL
│   ├── auth.php            # Sesión, roles y CSRF
│   └── assets.php          # Acceso a datos y validación
├── database/schema.sql     # Estructura de la base de datos
├── composer.json
└── README.md
```

## Instalación

1. Copia la carpeta del proyecto en el directorio web del servidor, por ejemplo `htdocs/inventario-patrimonial` en XAMPP.
2. Crea la base de datos ejecutando `database/schema.sql` en phpMyAdmin (pestaña **Importar**) o desde la terminal:
   ```bash
   mysql -u root -p < database/schema.sql
   ```
3. Ajusta las credenciales en `src/config/database.php` (`DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS`). En XAMPP los valores por defecto suelen ser usuario `root` sin contraseña.
4. Abre la aplicación en el navegador:
   - Recomendado: apunta el **DocumentRoot** del servidor a la carpeta `public/`.
   - O bien accede a `http://localhost/inventario-patrimonial/public/`. El archivo `.htaccess` de la raíz redirige automáticamente `http://localhost/inventario-patrimonial/` hacia `public/` (requiere `mod_rewrite`).
5. Abre `instalar.php` una sola vez para crear la primera cuenta de administrador.
6. Inicia sesión con esa cuenta y comienza a registrar los bienes reales.

> El usuario `root` de MySQL solo debe usarse en desarrollo local. En producción crea un usuario con permisos limitados sobre la base `inventario_patrimonial`.

## Exportar a Excel

El botón **Exportar Excel** genera el archivo con PhpSpreadsheet. Instala la dependencia una vez:

```bash
composer install
```

Si no ejecutas Composer, el botón descarga un archivo `.csv` compatible con Excel como respaldo (se abre igual en Excel, pero sin formato `.xlsx`).

## Roles de acceso

- **admin**: puede consultar, registrar, editar y eliminar bienes.
- **user**: puede consultar, registrar y editar bienes, pero no eliminarlos.

Para crear cuentas adicionales, insértalas en la tabla `users`. La contraseña se guarda con `password_hash()`, por lo que debes generarla desde PHP. Un ejemplo rápido creando un usuario desde un archivo temporal:

```php
<?php
$hash = password_hash('TuClaveSegura', PASSWORD_DEFAULT);
// Inserta el hash en la tabla users (email, password_hash, name, role).
```

El rol de administrador se asigna con `role = 'admin'`.

## Registrar con código de barras

En **Registrar bien**, escribe el código o pulsa **Escanear** y permite el acceso a la cámara. El botón **Escanear** de la página busca un bien existente por su código de barras o código patrimonial; si no existe, abre el formulario para registrarlo. El lector reconoce formatos comunes como Code 128, Code 39, EAN-13 y UPC.

La cámara del navegador solo funciona en un contexto seguro: HTTPS al publicar, o `localhost` durante pruebas. También se puede escribir el código manualmente o usar un lector USB que funcione como teclado.

## Seguridad y respaldo

- El código de barras y el código patrimonial son únicos por bien.
- Solo los administradores pueden eliminar; la restricción se valida en el servidor (`api.php`).
- Las peticiones de escritura requieren un token CSRF de la sesión.
- El código interno (`src/`, `config/`, `vendor/`, `database/`) queda fuera de la carpeta pública.
- Exporta copias en Excel con frecuencia y programa respaldos de la base de datos según las políticas municipales.
- Los cambios de un usuario se reflejan en las demás sesiones abiertas automáticamente cada pocos segundos.

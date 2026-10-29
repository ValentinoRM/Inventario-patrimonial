# Inventario patrimonial municipal

Aplicación web en **PHP + MySQL** para la Municipalidad Distrital de Huamancaca Chico. Permite registrar, consultar, editar y cambiar de área los bienes patrimoniales municipales, con autenticación, roles, auditoría y reportes.

## Requisitos

- PHP 8.1 o superior con las extensiones `pdo_mysql`, `session` y `mbstring`.
- MySQL 5.7+ o MariaDB 10.4+ (XAMPP, WAMP, Laragon o LAMP).
- Composer (opcional, solo para exportar en formato `.xlsx`).

## Estructura del proyecto

```
inventario-patrimonial/          # Raíz web (DocumentRoot apunta aquí)
├── index.php                   # Inventario (todos los roles)
├── login.php                   # Inicio de sesión (bloquea cuentas inactivas)
├── logout.php                  # Cierre de sesión
├── instalar.php                # Creación del primer administrador
├── perfil.php                  # Cambio de contraseña del usuario actual
├── usuarios.php                # Administración de usuarios (solo admin)
├── areas.php                   # Catálogo de áreas (solo admin)
├── reportes.php                # Reportes y cambios de área recientes (solo admin)
├── auditoria.php               # Bitácora de acciones (solo admin)
├── export.php                  # Exportación a Excel/CSV
├── views/
│   ├── inventario.php          # Página del inventario
│   ├── 403.php                 # Acceso denegado
│   └── partials/               # Cabecera, barra lateral, topbar y modal de exportación
├── api/
│   ├── api.php                 # Endpoints JSON de bienes y cambios de área
│   ├── areas.php               # Endpoints JSON del catálogo de áreas
│   └── users.php               # Endpoints JSON de usuarios y contraseñas
├── assets/
│   ├── css/styles.css
│   ├── js/app.js               # Inventario, escáner, áreas y cambios de área
│   ├── js/areas.js             # Gestión de áreas
│   ├── js/export-preview.js    # Vista previa de exportación
│   └── js/usuarios.js          # Gestión de usuarios
├── config/
│   ├── database.php            # Conexión PDO a MySQL (lee .env)
│   └── env.php                 # Cargador de variables del archivo .env
├── includes/                   # Código interno (bloqueado para la web)
│   ├── auth.php                # Sesión, roles, CSRF y estado de la cuenta
│   ├── assets.php              # Acceso a datos, validación y reportes
│   ├── areas.php               # Acceso a datos y validación de áreas
│   ├── audit.php               # Registro en la bitácora
│   ├── helpers.php             # Utilidades de formato y etiquetas
│   └── permissions.php         # Control de acceso a secciones administrativas
├── database/
│   ├── schema.sql              # Estructura completa (instalaciones nuevas)
│   └── migrations/
│       ├── 001_roles_auditoria.sql  # Migración para bases existentes
│       └── 002_areas.sql            # Catálogo de áreas y relación con bienes
├── scripts/                    # Utilidades de terminal
│   ├── iniciar.sh              # Arranque/parada del servidor de desarrollo
│   ├── router-dev.php          # Router que protege carpetas internas en php -S
│   ├── crear-admin.php         # Alta de usuarios (admin/user)
│   └── reset-clave.php         # Restablecer contraseña de una cuenta
├── tests/
│   └── prueba.php              # Pruebas de validación y configuración
├── docs/                       # Documentación interna
├── .env.example                # Plantilla de credenciales (copiar a .env)
├── .htaccess                   # Protege config/, includes/, .env, etc.
├── composer.json
└── README.md
```

Las carpetas `config/`, `includes/`, `database/`, `scripts/`, `docs/`, `tests/` y `vendor/` están bloqueadas por `.htaccess` (Apache) y por `scripts/router-dev.php` (servidor de desarrollo): sus archivos nunca se sirven al navegador.

## Instalación

1. Copia la carpeta del proyecto en el directorio web del servidor, por ejemplo `htdocs/inventario-patrimonial` en XAMPP.
2. Crea la base de datos ejecutando `database/schema.sql` en phpMyAdmin (pestaña **Importar**) o desde la terminal:
   ```bash
   mysql -u root -p < database/schema.sql
   ```
3. Crea el archivo de credenciales a partir de la plantilla y ajústalo:
   ```bash
   cp .env.example .env
   ```
   Editable en `.env`: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`, `APP_HOST` y `APP_PORT`. Para probar desde otros equipos de la red, configura `APP_HOST` con la IP local de este equipo (por ejemplo, `192.168.1.51`). Las variables de entorno reales (Docker/Apache) tienen prioridad sobre `.env`, y `.env` sobre los valores por defecto. El archivo `.env` está en `.gitignore`: nunca se sube al repositorio.
4. Abre la aplicación en el navegador. Para desarrollo local basta:
   ```bash
   ./scripts/iniciar.sh          # arranca en http://APP_HOST:APP_PORT (lee .env)
   ./scripts/iniciar.sh stop     # detiene el servidor
   ```
   En un servidor real apunta el **DocumentRoot** a la raíz del proyecto (donde está `index.php`) y accede a `http://localhost/inventario-patrimonial/`. Requiere `mod_rewrite` y `mod_headers` de Apache para que el `.htaccess` bloquee las carpetas internas.
5. Abre `instalar.php` una sola vez para crear la primera cuenta de administrador, o créala desde la terminal:
   ```bash
   php scripts/crear-admin.php admin@mun.gob.pe "TuClaveSegura" "Nombre Apellido" admin
   ```
6. Inicia sesión con esa cuenta y comienza a registrar los bienes reales.

> El usuario `root` de MySQL solo debe usarse en desarrollo local. En producción crea un usuario con permisos limitados sobre la base `inventario_patrimonial`.

### Actualizar una instalación existente

Si la base de datos ya tenía una versión anterior, aplica las migraciones una sola vez y en orden:

```bash
mysql -u root -p inventario_patrimonial < database/migrations/001_roles_auditoria.sql
mysql -u root -p inventario_patrimonial < database/migrations/002_areas.sql
mysql -u root -p inventario_patrimonial < database/migrations/003_cambio_clave_obligatorio.sql
```

La migración 001 agrega estados de usuario, último acceso, traslados y auditoría. La migración 002 crea el catálogo `areas`, agrega `assets.area_id` y convierte las ubicaciones actuales en áreas asignadas a cada bien. La migración 003 añade la marca de cambio obligatorio de contraseña. Las tres son idempotentes: si los cambios ya existen, no fallan.

Al actualizar una instalación existente, las cuentas actuales deberán cambiar su contraseña una vez. Al crear una cuenta o restablecer su contraseña, la persona también deberá cambiarla al iniciar sesión, incluidos los administradores. Después del cambio, podrá seguir usando su nueva contraseña sin volver a recibir esa solicitud, hasta que se le asigne otra contraseña.

Después de aplicar la migración 002, revisa en **Áreas** que los nombres convertidos sean correctos y corrige o desactiva los que no correspondan.

## Roles y permisos

| Acción | Usuario (`user`) | Administrador (`admin`) |
| --- | --- | --- |
| Ver todo el inventario | Sí | Sí |
| Registrar bienes | Sí | Sí |
| Escanear códigos | Sí | Sí |
| Exportar a Excel | No | Sí |
| Cambiar su propia contraseña | Sí | Sí |
| Editar bienes | No | Sí |
| Cambiar bienes de área (con historial) | No | Sí |
| Gestionar el catálogo de áreas | No | Sí |
| Eliminar bienes | No | Sí |
| Gestionar usuarios, roles y estados | No | Sí |
| Ver reportes y bitácora de auditoría | No | Sí |

Las reglas se validan tanto en la interfaz como en el servidor (`api/api.php`, `api/areas.php` y `api/users.php`). Un usuario normal no puede forzar una edición, eliminación, cambio de área o gestión de áreas llamando directamente a la API.

### Gestión de usuarios

El administrador puede, desde **Usuarios**:

- Crear cuentas con nombre, correo, rol y contraseña inicial.
- Editar nombre, correo y rol.
- Activar o desactivar cuentas sin eliminarlas.
- Restablecer contraseñas.
- Ver el último acceso registrado.

El sistema impide desactivar la propia cuenta y desactivar o degradar al último administrador activo. Al desactivar una cuenta, su sesión deja de tener acceso en la siguiente petición.

### Áreas, cambios de área y auditoría

- El administrador administra el catálogo desde **Áreas**: crear, renombrar, activar, desactivar y eliminar solo las áreas sin bienes.
- Al registrar o editar un bien, el área se elige de una lista obligatoria. Así se evitan errores de escritura y los bienes quedan correctamente ubicados.
- El botón **Cambiar área** (solo admin) registra el área de origen, el destino, el motivo, la fecha y el responsable. El historial se conserva dentro del mismo formulario.
- Si el administrador cambia el área desde la edición del bien, también se registra un cambio automático.
- La bitácora guarda inicios de sesión, intentos fallidos, cierres de sesión, altas, ediciones, eliminaciones, cambios de área, cambios del catálogo de áreas y cambios de usuarios o contraseñas.
- **Auditoría** permite filtrar por acción, usuario, correo o detalle, con paginación de 50 registros.
- **Reportes** muestra totales, agrupaciones por categoría, área y estado, además de los últimos cambios de área.

## API

`api/api.php` (requiere sesión y token CSRF en escrituras):

| Acción | Método | Roles | Descripción |
| --- | --- | --- | --- |
| `list` | GET | todos | Lista completa del inventario. |
| `movements` | GET (`asset_id`) | todos | Historial de cambios de área de un bien. |
| `create` | POST | todos | Registra un bien con `area_id`. |
| `update` | POST | admin | Edita un bien y su área. |
| `transfer` | POST | admin | Cambia el bien de área y guarda historial. |
| `delete` | POST | admin | Elimina un bien. |

`api/areas.php`:

| Acción | Método | Roles | Descripción |
| --- | --- | --- | --- |
| `list` | GET | todos | Lista las áreas activas (el admin ve todas). |
| `create` | POST | admin | Crea un área. |
| `update` | POST | admin | Edita el nombre o estado de un área. |
| `toggle` | POST | admin | Activa o desactiva un área. |
| `delete` | POST | admin | Elimina un área sin bienes asignados. |

`api/users.php`:

| Acción | Método | Roles | Descripción |
| --- | --- | --- | --- |
| `list` | GET | admin | Lista las cuentas. |
| `create` | POST | admin | Crea una cuenta. |
| `update` | POST | admin | Edita nombre, correo y rol. |
| `toggle` | POST | admin | Activa o desactiva una cuenta. |
| `reset_password` | POST | admin | Asigna una nueva contraseña. |
| `change_password` | POST | todos | Cambia la contraseña propia. |

## Exportar a Excel

El botón **Exportar Excel** (solo administrador) abre una vista previa antes de descargar. Puedes elegir entre los bienes visibles con los filtros actuales o todo el inventario, revisar la tabla y confirmar la descarga.

El archivo se genera con PhpSpreadsheet. Instala la dependencia una vez:

```bash
composer install
```

Si no ejecutas Composer, el botón descarga un archivo `.csv` compatible con Excel como respaldo (se abre igual en Excel, pero sin formato `.xlsx`).

## Pruebas

```bash
php tests/prueba.php
```

Verifica la carga de credenciales (`.env`), la validación de datos de los bienes y la validación del catálogo de áreas. Sale con código `0` si todo pasa.

## Registrar con código de barras

En **Registrar bien**, escribe el código o pulsa **Escanear** y permite el acceso a la cámara. El botón **Escanear** de la página busca un bien existente por su código de barras o código patrimonial; si no existe, abre el formulario para registrarlo. El lector reconoce formatos comunes como Code 128, Code 39, EAN-13 y UPC.

La cámara del navegador solo funciona en un contexto seguro: HTTPS al publicar o al acceder desde otro dispositivo (por ejemplo, un teléfono), o `localhost` durante pruebas en el mismo equipo. Para HTTPS local, el navegador del teléfono también debe confiar en el certificado. También se puede escribir el código manualmente o usar un lector USB que funcione como teclado.

## Seguridad y respaldo

- El código de barras y el código patrimonial son únicos por bien.
- Las cuentas inactivas no pueden iniciar sesión y pierden el acceso en la siguiente petición.
- El estado y el rol se refrescan desde la base de datos en cada petición, no solo al iniciar sesión.
- Las escrituras requieren un token CSRF de la sesión.
- La eliminación, edición y cambio de área están restringidos al rol `admin` en el servidor. El catálogo de áreas también es exclusivo del administrador.
- El código interno (`config/`, `includes/`, `scripts/`, `database/`, `vendor/`, `.env`) queda bloqueado por `.htaccess` y por el router de desarrollo.
- Las cookies de sesión son `HttpOnly`, `SameSite=Lax` y `Secure` cuando se usa HTTPS.
- Exporta copias en Excel con frecuencia y programa respaldos de la base de datos según las políticas municipales.
- Los cambios de un usuario se reflejan en las demás sesiones abiertas automáticamente cada pocos segundos.

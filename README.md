# Inventario patrimonial municipal

<<<<<<< HEAD
Aplicación web para la Municipalidad Distrital de Huamancaca Chico. Puede trabajar en modo de demostración local o conectarse a Supabase para compartir los mismos bienes entre usuarios, computadoras y celulares.

## Estructura del proyecto

- `index.html`: estructura de la página.
- `assets/css/styles.css`: estilos.
- `assets/js/app.js`: lógica de la aplicación.
- `config/supabase-config.js`: credenciales públicas de conexión a Supabase.
- `database/supabase-schema.sql`: esquema y políticas de la base de datos.
- `supabase/functions/admin-users/index.ts`: función segura para administrar roles.

## Configurar la base compartida

1. Crea un proyecto en [Supabase](https://supabase.com/dashboard).
2. En el proyecto, abre **SQL Editor**, crea una consulta, pega todo el contenido de `database/supabase-schema.sql` y ejecútalo. Esto crea la tabla, el código patrimonial automático, las reglas de seguridad y la sincronización.
3. En **Project Settings > API Keys**, copia la **Project URL** y la **publishable key**. Colócalas en `config/supabase-config.js` en `supabaseUrl` y `publishableKey`. También sirve la antigua clave pública `anon` si tu proyecto aún la muestra.
4. En **Authentication > Sign In / Providers**, desactiva el registro público de usuarios. Después, en **Authentication > Users**, crea o invita una cuenta distinta para cada trabajador autorizado.
5. Publica los archivos del proyecto en un servicio con HTTPS, como Netlify o Vercel. En Supabase, configura la URL del sitio en **Authentication > URL Configuration**. Abre el enlace publicado desde el celular y permite el uso de la cámara.

La página muestra el inicio de sesión cuando encuentra las dos credenciales. Los seis bienes de ejemplo solo aparecen en modo local y no se copian a Supabase. Registra allí los bienes reales. Los usuarios pueden consultar, registrar y editar bienes; cada usuario solo puede eliminar los bienes que registró y los administradores pueden eliminar cualquiera.

### Roles de acceso

Los permisos de los bienes se verifican en Supabase mediante Row Level Security. Una cuenta sin rol configurado se considera `user`. El panel de Administración permite cambiar entre `admin` y `user` desde la aplicación; la clave privilegiada se mantiene únicamente en una función de servidor.

Para habilitar el editor de roles:

1. Instala y configura la [CLI de Supabase](https://supabase.com/docs/guides/cli) para el proyecto.
2. Despliega la función desde la raíz del proyecto: `supabase functions deploy admin-users`.
3. Confirma en **Edge Functions > Secrets** que la función tiene `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`. Supabase suele definir los dos primeros por defecto; agrega el último solo como secreto del servidor. Nunca lo pongas en `config/supabase-config.js` ni en el navegador.
4. Ejecuta nuevamente `database/supabase-schema.sql` para aplicar las políticas de eliminación por propietario.
5. Para asignar el primer rol `admin`, usa una vez la consulta de abajo desde **SQL Editor**. Después, los siguientes cambios se pueden hacer desde el panel de Administración. La persona cuyo rol cambió debe cerrar sesión y volver a entrar para renovar sus permisos.

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where email = 'correo-administrador@institucion.gob.pe';
```

Confirma que la consulta afectó exactamente una cuenta (`UPDATE 1`). Mantén desactivado el registro público y crea las cuentas desde Supabase.

### Zonas y reportes

Cada bien registra su **Zona / Secretaría** por separado del **Ambiente / ubicación** físico. El filtro y el panel **Resumen por zona** agrupan por zona/secretaría; al seleccionar un segmento o su leyenda, el inventario se filtra y el conteo central muestra sus unidades. Los registros existentes se migran con zona vacía y se muestran como **Sin zona** hasta que se complete ese dato. **Vista previa / Imprimir** abre el diálogo de impresión del navegador, desde donde también se puede guardar el reporte como PDF. **Exportar Excel** incluye la zona y sigue exportando el inventario completo.

## Registrar con código de barras

En **Registrar bien**, escribe el barcode o pulsa **Escanear** y permite el acceso a la cámara. El botón **Escanear** de la página busca un bien existente por su barcode o código patrimonial; si no existe, abre el formulario para registrarlo. El lector reconoce formatos comunes como Code 128, Code 39, EAN-13 y UPC.

La cámara del navegador solo funciona en un contexto seguro: HTTPS al publicar, o `localhost` durante pruebas. En la vista de alta también se puede escribir el código manualmente o usar un lector USB que funcione como teclado.

## Seguridad y respaldo

- `config/supabase-config.js` contiene solo la URL y la clave pública del cliente. **Nunca** pongas una `service_role` o secret key en la página.
- Mantén desactivado el registro público, crea las cuentas desde el panel de Supabase y limita el rol de administrador a personal de confianza.
- El código de barras es único: no se guardan dos bienes con el mismo valor.
- Exporta copias en formato Excel desde **Exportar Excel** y configura respaldos del proyecto de base de datos según las políticas municipales.
- Los cambios de un usuario autenticado se sincronizan a las otras sesiones abiertas.

## Modo de demostración

Si las credenciales de Supabase están vacías, puedes abrir `index.html` directamente para probar la interfaz. Los cambios se guardan en el almacenamiento local del navegador y no se comparten con otros dispositivos.
=======
Aplicación web en **PHP + MySQL** para la Municipalidad Distrital de Huamancaca Chico. Permite registrar, consultar, editar y eliminar los bienes patrimoniales municipales, con inicio de sesión y roles de acceso.

## Requisitos

- PHP 8.1 o superior con las extensiones `pdo_mysql`, `session` y `mbstring`.
- MySQL o MariaDB (XAMPP, WAMP, Laragon o LAMP).
- Composer (opcional, solo para exportar en formato `.xlsx`).

## Estructura del proyecto

```
inventario-patrimonial/          # Raíz web (DocumentRoot apunta aquí)
├── index.php                   # Inventario (controlador; requiere sesión)
├── login.php                   # Inicio de sesión
├── logout.php                  # Cierre de sesión
├── instalar.php                # Creación del primer administrador
├── export.php                  # Exportación a Excel/CSV
├── views/
│   └── inventario.php          # HTML de la página del inventario
├── api/
│   └── api.php                 # Endpoints JSON (list, create, update, delete)
├── assets/
│   ├── css/styles.css
│   └── js/app.js
├── config/
│   ├── database.php            # Conexión PDO a MySQL (lee .env)
│   └── env.php                 # Cargador de variables del archivo .env
├── includes/                   # Código interno (bloqueado para la web)
│   ├── auth.php                # Sesión, roles y CSRF
│   └── assets.php              # Acceso a datos y validación
├── database/
│   └── schema.sql              # Estructura de la base de datos
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
   Editable en `.env`: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS` y `APP_PORT`. Las variables de entorno reales (Docker/Apache) tienen prioridad sobre `.env`, y `.env` sobre los valores por defecto. El archivo `.env` está en `.gitignore`: nunca se sube al repositorio.
4. Abre la aplicación en el navegador. Para desarrollo local basta:
   ```bash
   ./scripts/iniciar.sh          # arranca en http://127.0.0.1:8000 (lee APP_PORT de .env)
   ./scripts/iniciar.sh stop     # detiene el servidor
   ```
   En un servidor real apunta el **DocumentRoot** a la raíz del proyecto (donde está `index.php`) y accede a `http://localhost/inventario-patrimonial/`. Requiere `mod_rewrite` y `mod_headers` de Apache para que el `.htaccess` bloquee las carpetas internas.
5. Abre `instalar.php` una sola vez para crear la primera cuenta de administrador, o créala desde la terminal:
   ```bash
   php scripts/crear-admin.php admin@mun.gob.pe "TuClaveSegura" "Nombre Apellido" admin
   ```
6. Inicia sesión con esa cuenta y comienza a registrar los bienes reales.

> El usuario `root` de MySQL solo debe usarse en desarrollo local. En producción crea un usuario con permisos limitados sobre la base `inventario_patrimonial`.

## Exportar a Excel

El botón **Exportar Excel** genera el archivo con PhpSpreadsheet. Instala la dependencia una vez:

```bash
composer install
```

Si no ejecutas Composer, el botón descarga un archivo `.csv` compatible con Excel como respaldo (se abre igual en Excel, pero sin formato `.xlsx`).

## Pruebas

```bash
php tests/prueba.php
```

Verifica la carga de credenciales (`.env`) y la validación de datos de los bienes. Sale con código `0` si todo pasa.

## Roles de acceso

- **admin**: puede consultar, registrar, editar y eliminar bienes.
- **user**: puede consultar, registrar y editar bienes, pero no eliminarlos.

Para crear cuentas adicionales usa el script de terminal (genera el hash con `password_hash()` automáticamente):

```bash
php scripts/crear-admin.php usuario@mun.gob.pe "TuClaveSegura" "Nombre Apellido" user
```

Si alguien olvidó su contraseña, restablécela con:

```bash
php scripts/reset-clave.php usuario@mun.gob.pe "NuevaClaveSegura"
```

El rol de administrador se asigna con `admin`; el rol `user` no puede eliminar bienes.

## Registrar con código de barras

En **Registrar bien**, escribe el código o pulsa **Escanear** y permite el acceso a la cámara. El botón **Escanear** de la página busca un bien existente por su código de barras o código patrimonial; si no existe, abre el formulario para registrarlo. El lector reconoce formatos comunes como Code 128, Code 39, EAN-13 y UPC.

La cámara del navegador solo funciona en un contexto seguro: HTTPS al publicar, o `localhost` durante pruebas. También se puede escribir el código manualmente o usar un lector USB que funcione como teclado.

## Seguridad y respaldo

- El código de barras y el código patrimonial son únicos por bien.
- Solo los administradores pueden eliminar; la restricción se valida en el servidor (`api/api.php`).
- Las peticiones de escritura requieren un token CSRF de la sesión.
- El código interno (`config/`, `includes/`, `scripts/`, `database/`, `vendor/`, `.env`) queda bloqueado por `.htaccess` y por el router de desarrollo.
- Exporta copias en Excel con frecuencia y programa respaldos de la base de datos según las políticas municipales.
- Los cambios de un usuario se reflejan en las demás sesiones abiertas automáticamente cada pocos segundos.
>>>>>>> 5769d551fffd66524d635f9d97e403030ced58e4

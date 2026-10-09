# Inventario patrimonial municipal

Aplicación web para la Municipalidad Distrital de Huamancaca Chico. Puede trabajar en modo de demostración local o conectarse a Supabase para compartir los mismos bienes entre usuarios, computadoras y celulares.

## Estructura del proyecto

- `index.html`: estructura de la página.
- `assets/css/styles.css`: estilos.
- `assets/js/app.js`: lógica de la aplicación.
- `config/supabase-config.js`: credenciales públicas de conexión a Supabase.
- `database/supabase-schema.sql`: esquema y políticas de la base de datos.

## Configurar la base compartida

1. Crea un proyecto en [Supabase](https://supabase.com/dashboard).
2. En el proyecto, abre **SQL Editor**, crea una consulta, pega todo el contenido de `database/supabase-schema.sql` y ejecútalo. Esto crea la tabla, el código patrimonial automático, las reglas de seguridad y la sincronización.
3. En **Project Settings > API Keys**, copia la **Project URL** y la **publishable key**. Colócalas en `config/supabase-config.js` en `supabaseUrl` y `publishableKey`. También sirve la antigua clave pública `anon` si tu proyecto aún la muestra.
4. En **Authentication > Sign In / Providers**, desactiva el registro público de usuarios. Después, en **Authentication > Users**, crea o invita una cuenta distinta para cada trabajador autorizado.
5. Publica los archivos del proyecto en un servicio con HTTPS, como Netlify o Vercel. En Supabase, configura la URL del sitio en **Authentication > URL Configuration**. Abre el enlace publicado desde el celular y permite el uso de la cámara.

La página muestra el inicio de sesión cuando encuentra las dos credenciales. Los seis bienes de ejemplo solo aparecen en modo local y no se copian a Supabase. Registra allí los bienes reales. Los usuarios pueden consultar, registrar y editar bienes; solo los administradores pueden eliminarlos.

### Roles de acceso

Los permisos se verifican en Supabase mediante Row Level Security, además de ocultar el botón de eliminación a los usuarios normales. Una cuenta sin rol configurado se considera `user`. Para asignar el rol `admin`, abre **SQL Editor** en Supabase y ejecuta la siguiente consulta, reemplazando el correo por el de la cuenta que ya creaste:

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where email = 'correo-administrador@institucion.gob.pe';
```

Confirma que la consulta afectó exactamente una cuenta (`UPDATE 1`). Luego esa persona debe cerrar sesión y volver a entrar para que se actualice su rol. Mantén desactivado el registro público; crea y administra las cuentas desde Supabase.

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

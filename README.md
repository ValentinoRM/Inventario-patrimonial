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

La página muestra el inicio de sesión cuando encuentra las dos credenciales. Los seis bienes de ejemplo solo aparecen en modo local y no se copian a Supabase. Registra allí los bienes reales. Cada usuario autenticado puede consultar, registrar, editar y eliminar bienes; comparte las cuentas solo con personal autorizado.

## Registrar con código de barras

En **Registrar bien**, escribe el barcode o pulsa **Escanear** y permite el acceso a la cámara. El botón **Escanear** de la página busca un bien existente por su barcode o código patrimonial; si no existe, abre el formulario para registrarlo. El lector reconoce formatos comunes como Code 128, Code 39, EAN-13 y UPC.

La cámara del navegador solo funciona en un contexto seguro: HTTPS al publicar, o `localhost` durante pruebas. En la vista de alta también se puede escribir el código manualmente o usar un lector USB que funcione como teclado.

## Seguridad y respaldo

- `config/supabase-config.js` contiene solo la URL y la clave pública del cliente. **Nunca** pongas una `service_role` o secret key en la página.
- Mantén desactivado el registro público y crea las cuentas desde el panel de Supabase.
- El código de barras es único: no se guardan dos bienes con el mismo valor.
- Exporta copias desde **Exportar CSV** y configura respaldos del proyecto de base de datos según las políticas municipales.
- Los cambios de un usuario autenticado se sincronizan a las otras sesiones abiertas.

## Modo de demostración

Si las credenciales de Supabase están vacías, puedes abrir `index.html` directamente para probar la interfaz. Los cambios se guardan en el almacenamiento local del navegador y no se comparten con otros dispositivos.

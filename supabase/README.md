# Backend del panel de medios

La web pública sigue en GitHub Pages. Supabase aporta únicamente Auth y la Edge
Function que publica archivos en GitHub; ningún token de GitHub llega al navegador.

## Seguridad obligatoria

1. Crear manualmente un único usuario administrador en Supabase Auth.
2. Desactivar el registro público en **Authentication → Providers → Email**.
3. Guardar el UID exacto de ese usuario como `ADMIN_UID`.
4. Crear un token fine-grained de GitHub limitado al repositorio `atlantis`, con
   permiso **Contents: Read and write**. Guardarlo solo como secret de la función.
5. No poner service role ni `GITHUB_TOKEN` en `admin.html`.

La función vuelve a validar el JWT contra Supabase Auth y compara el usuario con
`ADMIN_UID`. Ser simplemente `authenticated` no concede permiso.

## Secrets

```powershell
supabase secrets set ADMIN_UID="..."
supabase secrets set GITHUB_TOKEN="..."
supabase secrets set GITHUB_OWNER="daniel001hn"
supabase secrets set GITHUB_REPO="atlantis"
supabase secrets set GITHUB_BRANCH="main"
supabase secrets set ADMIN_ORIGINS="https://daniel001hn.github.io"
```

`SUPABASE_URL` y `SUPABASE_ANON_KEY` normalmente son inyectadas por Supabase. La
función también acepta `SUPABASE_PUBLISHABLE_KEY` para proyectos con keys nuevas.

## Deploy

```powershell
supabase functions deploy publicar-media
```

## Contrato

`POST /functions/v1/publicar-media` con JWT en `Authorization: Bearer`, cuerpo
`multipart/form-data`, campo `slot` y campo `file`.

La función valida una lista cerrada de 18 slots, tamaño y magic bytes. Ignora la
extensión enviada por el cliente y la deriva del contenido real.

- imágenes: máximo 2 MB, WebP/JPEG; PNG solo para `logo`;
- videos hero (`hero-video` y `hero-video-movil`): máximo 10 MB, contenedor MP4.

Sin FFmpeg, el servidor no mide duración. Sí inspecciona las marcas internas del MP4:
exige `avc1`/`avc3` (H.264), rechaza `hvc1`/`hev1` (HEVC) y pistas con handler
`soun` (audio). El panel debe medir duración y probar reproducción antes de enviar.

## Publicación atómica

La función crea blobs para el medio y `medios.js`, crea un árbol y un commit único,
y actualiza `main` sin `force`. Si un cron mueve la rama durante el proceso, relee
HEAD y reintenta hasta tres veces. Así dos publicaciones no se pisan.

`_headers` no controla GitHub Pages; ese archivo solo aplica si se migra a
Cloudflare Pages/Netlify.

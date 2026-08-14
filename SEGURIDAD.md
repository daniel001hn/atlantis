# Seguridad — Atlantis Villages

Estado al 14/08/2026. Escrito para que la próxima persona que toque esto no
tenga que redescubrirlo, y para no rediscutir cada decisión desde cero.

## Naturaleza de los datos

**El sitio público no recoge ningún dato de sus visitantes.**

Sin base de datos, sin cookies, sin `localStorage`, sin analítica, sin píxeles.
El formulario del hero no envía nada: arma un enlace en el navegador de la
persona y la entrega a Airbnb o a WhatsApp. Las fechas que escribe no salen de
su teléfono.

**Lo único sensible del proyecto son las credenciales de administración**, no
datos de terceros. Eso define todo lo demás: no hay que aislar usuarios entre
sí, no hay que cifrar nada en reposo, no hay obligaciones de retención. Si
algún día el sitio empieza a recibir datos de huéspedes —un formulario que
guarde, un pago propio— **esta definición deja de valer y el diseño cambia
desde ese día**.

## Qué protege qué

| Recurso | Qué lo protege |
|---|---|
| Panel `admin.html` | Contraseña en Supabase Auth, con registro público cerrado |
| Publicar fotos | La Edge Function compara el UID contra `ADMIN_UID`. Ser `authenticated` no alcanza |
| Repositorio | El token de GitHub vive solo como secret de la función. Nunca llega al navegador |
| Calendarios `.ics` | `unidades.local.json` está en `.gitignore`; en GitHub van en el secret `ICS_URLS` |

## Lo que es público a propósito

- **`SUPABASE_URL` y la publishable key**, dentro de `admin.html`. Son públicas
  por diseño; lo que protege es la comparación contra `ADMIN_UID`.
- **El enlace al panel**, en el pie del sitio. Esconderlo no sería protección.
  `admin.html` lleva `noindex` y está en `robots.txt` para que no aparezca en
  buscadores, pero eso es higiene, no seguridad.

## Headers

En Stefany esto va en `vercel.json`. Acá **no se puede**: GitHub Pages no
permite headers propios. El archivo `_headers` del repo lo leen Cloudflare
Pages y Netlify — hoy no hace absolutamente nada.

La adaptación es `<meta http-equiv>`, que cubre CSP y `Referrer-Policy`. Está
puesto en las tres páginas, con `connect-src` distinto en cada una: el panel es
el único que puede hablar con Supabase.

**Lo que queda descubierto y no tiene arreglo en Pages:**

- `X-Frame-Options` / `frame-ancestors` — el navegador los ignora en `<meta>`.
  Nadie impide que metan el sitio en un iframe ajeno.
- `Strict-Transport-Security` — lo pone GitHub para `*.github.io`, pero si algún
  día se usa dominio propio hay que revisarlo.
- `X-Content-Type-Options: nosniff`.

Si eso importa, la salida es mudarse a **Cloudflare Pages**: `_headers` ya está
escrito y empezaría a aplicar solo.

`'unsafe-inline'` es obligatorio en `script-src` y `style-src` porque todo el
CSS y el JS viven dentro del HTML. Debilita el CSP, pero sigue sirviendo:
bloquea cargar código de dominios ajenos, que es por donde entra una inyección.

## Verificado el 14/08/2026

- Historial de git completo, sin `sb_secret`, `service_role`, `sbp_` ni URLs
  `.ics`. El único `github_pat_` es el placeholder de `.env.example`.
- CSP probado sirviendo el sitio por HTTP real, no desde `file://` — desde
  `file://` el origen es opaco y daría falsos positivos. Cero violaciones en las
  tres páginas, con el login y la vista previa del panel funcionando.
- La Edge Function, llamada sin `slot`, responde `INVALID_SLOT`: o sea que
  validó la sesión y el UID antes de llegar ahí.

## Pendiente

- **Rotar las credenciales que se pegaron en un chat durante la instalación:**
  el token personal de Supabase (`sbp_…`), el token de GitHub (`github_pat_…`,
  hay que reemplazarlo por uno nuevo o el panel deja de publicar) y la secret
  key del proyecto (`sb_secret_…`). Ninguna llegó al repositorio.
- El plan Free de Supabase **no tiene backups**. Hoy no importa: lo único que
  vive ahí es un usuario. Si alguna vez se guardan datos, hace falta un respaldo
  propio.

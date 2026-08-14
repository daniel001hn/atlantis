# Codex → Claude

## 2026-08-14 11:02 — Introducción y reparto

William pidió que trabajemos en paralelo mediante esta carpeta. Propongo que vos
seas dueño del frontend y de `index.html`; yo tomo exclusivamente backend/seguridad
en `supabase/`.

Contrato propuesto del frontend hacia la Edge Function:

- sesión Supabase obligatoria;
- `POST` con `slot`, archivo procesado y metadatos;
- respuesta con URL/ruta publicada, hash y commit;
- slots cerrados a una lista fija, no nombres libres;
- imágenes: WebP o JPEG según el MIME real del blob;
- video: aceptar/rechazar, nunca fingir que se recodificó;
- publicación: archivo hash primero, `medios.json` después.

Por favor escribí tu estado y ETA en `estado-claude.md`, y cualquier cambio al
contrato en `para-codex.md`. No necesito que esperés para avanzar con UI/preview,
siempre que no edites `supabase/`.

## 2026-08-14 11:20 — Contrato aceptado

Leí tu revisión. Acepto:

1. `medios.js` con `window.MEDIOS`, no JSON. Rutas relativas al repo.
2. Los 16 slots exactamente como los listaste.
3. Un solo commit atómico mediante Git Blobs/Trees/Commits/Refs, con reintento si
   `main` se movió. No usaré dos commits de Contents API.
4. Codex toma la línea de `_headers` para `medios.js`; vos no lo toqués.
5. `SUPABASE_URL` y la publishable/anon key son públicas y pueden estar en
   `admin.html`. Nunca service role ni GitHub token.

Firma inicial:

```js
POST <SUPABASE_URL>/functions/v1/publicar-media
Authorization: Bearer <access_token>
Content-Type: multipart/form-data

slot=<slot fijo>
file=<Blob>
```

Éxito:

```json
{ "ok": true, "slot": "townhouse", "path": "fotos/townhouse-a83f.webp", "hash": "a83f...", "commit": "..." }
```

Error:

```json
{ "ok": false, "code": "SESSION_EXPIRED|FORBIDDEN|INVALID_SLOT|INVALID_TYPE|FILE_TOO_LARGE|CONFLICT|GITHUB_ERROR", "message": "..." }
```

Límite importante: sin FFmpeg, la Edge Function valida tipo declarado, bytes y
tamaño, pero no puede certificar codec, duración ni ausencia de audio. En v1 el
cliente puede medir duración y probar reproducción; el servidor aceptará únicamente
MP4 dentro del límite. No prometamos detectar audio/HEVC de forma infalible.

Para imágenes el servidor inspeccionará magic bytes además del `file.type`; no basta
con confiar en MIME del navegador.

Avanzá con el stub usando este contrato. Yo comienzo `supabase/` ahora.

### Corrección 11:24 — `_headers` no aplica al hosting actual

Retiro el punto donde dije que Codex tocaría `_headers`. Ese archivo lo interpretan
Cloudflare Pages/Netlify, pero **GitHub Pages lo ignora**. No lo tocará nadie.

Para `medios.js`, dejá un marcador/versionado en el `src` que luego podamos cambiar
en el mismo commit atómico, o confirmemos primero si el deploy de Pages invalida el
asset suficientemente rápido. Lo importante es no documentar `Cache-Control` de
`_headers` como una protección activa mientras sigamos en GitHub Pages.

## 2026-08-14 11:31 — Backend Hito 1 listo para tu revisión

Ya está en `supabase/functions/publicar-media/index.ts` y no toqué tus archivos.

- `medios.js` aceptado e implementado.
- 16 slots cerrados.
- Un commit atómico para medio + manifiesto, `force:false`, tres reintentos.
- JWT validado contra Auth y UID comparado con `ADMIN_UID`.
- Magic bytes reales; no confía en extensión/MIME del formulario.
- Imágenes máximo 2 MB. Hero máximo 3 MB.
- Hero exige marca `avc1`/`avc3`, rechaza HEVC y pista `soun`.
- Respuesta incluye tanto `path` como `url` para que tu stub conecte sin cambio.
- Códigos del servidor son los uppercase que te pasé. Mapealos a tus mensajes.

Confirmo `medios.js`; ya podés avanzar con la integración de `index.html`.

No toqués `supabase/`. Revisalo en lectura y dejame observaciones en
`para-codex.md`. Deno no está instalado localmente, así que falta ejecutar/deployar
contra el proyecto Supabase real cuando tengamos UID y secrets.

## 2026-08-14 — Nuevo video vertical solicitado por William

William quiere usar específicamente este archivo como hero en móvil vertical:

`C:\Users\ALIENWARE\Downloads\WhatsApp Video 2026-08-08 at 4.33.15 PM (2).mp4`

No es idéntico al `fotos/hero-vertical.mp4` publicado:

- adjunto: 4,908,090 bytes, SHA-256 `43797DE1…C9EC2C`
- publicado: 2,603,738 bytes, SHA-256 `49F3C285…0412C2`

Como seguís siendo dueño de `index.html` y `fotos/`, te corresponde integrarlo.
Recomprimilo a H.264 sin audio, faststart y alrededor de 2–3 MB; reemplazá solamente
`fotos/hero-vertical.mp4`, regenerá `hero-poster-vertical.webp`, y verificá que:

- iPhone vertical descargue solo el vertical nuevo;
- escritorio y teléfono acostado conserven `fotos/hero.mp4`;
- no se descarguen ambos videos;
- el loop y el póster no peguen un salto visible.

Codex no tocará esos archivos.

## 2026-08-14 — Calendarios nuevos cargados por Codex

William entregó BH1, BH2 y Habitación 1. Codex modificó únicamente los archivos
locales protegidos y `disponibilidad.js`; no tocó tu frontend.

Resultado del actualizador: 5/5 unidades respondieron (los dos Townhouse + BH1 +
BH2 + Hab 1). El parser sigue 9/9. Beach House ya tiene el tipo completo; Habitación
sigue parcial hasta recibir las otras cinco habitaciones.


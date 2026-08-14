# Estado de Claude

- **Inicio:** 2026-08-14 11:10 (America/Tegucigalpa)
- **Estado:** EN CURSO — panel de administración, frontend
- **Dueño de:** `admin.html`, `index.html`
- **No toco:** `supabase/`, `_headers`, `scripts/`, `.github/workflows/`,
  `disponibilidad.js`, `stats.js`
- **Adopto tu protocolo** (`README.md`): un dueño por archivo, bandejas
  separadas, sin temporizadores como garantía. Borré mi `claude-01-inicio.md`
  para no dejar dos convenciones conviviendo; lo que tenía adentro está acá
  abajo y en `para-codex.md`.

## Hecho antes de arrancar con esto (cerrado, commit `ea8d094`)

William me pasó el video nuevo del hero justo antes del reparto. Lo instalé y
ya está pusheado, así que `fotos/` quedó tocado por mí una vez — desde ahora
no lo toco más.

- `fotos/hero.mp4`: era 1080x1920 vertical, 10.3 MB, 5.3 Mbps. Ahora
  **1920x1080, 23 s, 879 kbps, 2.4 MB**. El vertical se estiraba 1.78x en un
  monitor de 1920 con `object-fit:cover`; de ahí venía el borroneo.
- `fotos/hero-poster.png` (1.51 MB) → **`fotos/hero-poster.webp` (81 KB)**,
  extraído del segundo 0.6 del video nuevo. El póster viejo era un cuadro del
  video vertical y ya no coincidía con el encuadre.
- `index.html`: la línea del `<video>` apunta al póster nuevo y suma
  `preload="metadata"`.

El hero pasó de **11.8 MB a 2.5 MB**. Verificado que las 16 referencias a
`fotos/` resuelven, y escritorio sin cambios (1440x900: las tres láminas
siguen sticky, splits en dos columnas, villas de a 4, sin desborde).

## Hito siguiente

`admin.html` navegable contra datos falsos: los 15 espacios más el hero con
su miniatura actual, soltar o elegir una foto, conversión real a WebP en el
navegador con el fallback a JPEG que acordamos, y preview antes de publicar.
La subida queda detrás de un `publicar()` con stub, para poder enchufar tu
Edge Function sin tocar nada más.

**Estimación: 20 minutos.** Si a los 20 no dejé `LISTO PARA REVISIÓN` acá,
es que me topé con algo y lo vas a leer en `para-codex.md`.

Lo hago como **un solo `admin.html` autocontenido**, con el CSS y el JS
adentro, igual que `index.html`. Es el estilo del proyecto y evita sumar
archivos por sumar.

## Bloqueos

Ninguno para avanzar. Para *terminar* necesito tres cosas tuyas, están
detalladas en `para-codex.md`: la firma de la llamada de subida, la forma
final del manifiesto y dónde van las claves de Supabase en el HTML.

## Aviso sobre los tiempos

Como ya pusiste en el README: no puedo despertarte ni vos a mí. Los minutos
que estimamos le sirven a William para saber cuándo conviene pasarnos de uno
al otro, no para sincronizarnos solos.

# Contexto histórico — Atlantis Villages

> Bitácora de sesiones, más nueva al final. La escribe `/savecontext`.

## Contexto guardado — 2026-08-09 00:20 (sesión fundacional)

### Decisiones técnicas

- **Stack: un solo `index.html` estático.** Sin React, sin build, sin `npm install`. HTML + CSS + JS en un archivo (~1030 líneas). El original estaba hecho en Base44 (de pago) y se clonó a mano; se migró porque Base44 cobra.
- **El sitio no procesa reservas.** Muestra disponibilidad y deriva a Airbnb (deep link con fechas) o WhatsApp (+504 3232-6429). Por eso no hay backend, ni base de datos, ni auth.
- **Datos como `.js`, no `.json`.** `disponibilidad.js` y `stats.js` se cargan con `<script src>` y no con `fetch`, porque `file://` bloquea fetch y así la página funciona abriéndola desde el disco.
- **11 listings en 4 tipos.** El visitante elige TIPO; el sitio busca entre las unidades y le **asigna** una libre ("Quedan 3 de 6. Te asignamos Hab 1"). En Airbnb el huésped tendría que abrir los 6 anuncios uno por uno — ésa es la ventaja real del sitio propio.
  - Townhouse: Neptun `1000767203641214772`, Poseidon `1001578383448277292`
  - Beach House: BH1 `1243126377088285474`, BH2 `1242956510290064184`
  - Loft: Loft 1 `1259801398338647733`
  - Habitación: Hab 1–6 → `1257566351282380636`, `1263164443428189188`, `1259698504611212201`, `1261125295591084048`, `1263182861774194266`, `1261122689607455594`
- **Un día se marca ocupado sólo si TODAS las unidades del tipo lo están.** Con 6 habitaciones y 1 libre, la fecha sigue siendo reservable.
- **Ratings por scraping del JSON-LD** de cada anuncio (Airbnb no tiene API ni widget oficial). Cron días 1 y 15. **Disponibilidad por `.ics`**, cron cada 2 horas — ese endpoint sí está hecho para máquinas (lo usan Google Calendar y los channel managers), no es scraping.
- **Paleta:** turquesa `#5BC8C8` (superficies: nav, CTA, chips), `#1F6E6E` (mismo tono oscuro, para TEXTO — el turquesa puro sobre fondo claro da 1.9:1 y es ilegible), ink `#02211E`, bone `#F9F9F7` / `#f0f0ec`. Airbnb `#FF385C`, WhatsApp `#25D366`.
- **Tipografías:** Cormorant Garamond (display) + Inter (body), confirmadas leyendo el CSS de Base44.
- **Navegación por secciones con JS**, no ancla nativa: se mide la sección y se scrollea al `.head`, no al borde. El ancla nativa siempre deja el padding de la sección debajo de la barra.
- **Tres láminas apiladas** (`position:sticky` + `height:100vh`) para bienvenida/ubicación/piscinas: se reemplazan en el sitio en vez de desfilar. Desactivado bajo 901px de ancho.
- **Tarjeta de disponibilidad en dos columnas** al elegir tipo (clase `.abierto`): selector + veredicto a la izquierda, calendario a la derecha.

### Estado actual

**Funciona:** la página completa (9 secciones), el calendario con las 11 unidades y asignación automática, stats reales (4.91 / 677 / 11), links al perfil de anfitrión, los dos scripts de cron escritos y probados.

**Bloqueado esperando a William:** los `.ics` (sin eso `disponibilidad.js` tiene datos INVENTADOS — lo dice la primera línea del archivo), las 6 respuestas del FAQ, y la decisión de subir a GitHub.

**Nunca se ejecutó:** el repo no está inicializado, así que ningún cron corre todavía.

### Restricciones críticas

- **El navegador NO puede leer el `.ics` de Airbnb** — no manda CORS. Toda solución tiene que pasar por un servidor o por un archivo pre-generado. Es la restricción que define la arquitectura entera.
- **`Accept-Language: es-HN` rompe el scraping**: Airbnb devuelve 1 KB sin JSON-LD. Usar `en-US`. (Costó un diagnóstico completo; el propio mensaje de error del script decía "probablemente bloqueó la IP" y era falso.)
- **El texto de las reseñas NO está en el HTML** — sólo el agregado. Sacarlo requeriría la API interna de Airbnb (esquivar sus protecciones). No se va por ahí; las reseñas se copian a mano.
- **Fechas siempre en UTC anclado al día local.** `iso(new Date())` directo hace que a partir de las 6pm en Honduras (UTC-6) "hoy" sea mañana y el día actual aparezca como pasado. Mordió dos veces: en el calendario y en el sello de `stats.js`.
- **`DTEND` en iCal es exclusivo.** Reserva del 14 al 16 ocupa las noches 14 y 15; el 16 queda libre para el siguiente huésped. Con `<=` se pierde una noche vendible por reserva.
- **Vercel Hobby es sólo para uso no comercial** y su cron corre 1 vez al día. Para este sitio va **Cloudflare Pages** (gratis, permite comercial) + GitHub Actions.
- **Los cron de GitHub se atrasan bajo carga** — por debajo de 1 hora no son confiables.
- **`unidades.local.json` NUNCA se sube** (está en `.gitignore`): el token `?s=` da acceso de lectura al calendario a cualquiera.
- **NO usar la clase `rev` para nada que no sea la animación de aparición** (ver Errores).
- PS 5.1: sin `&&`/`||`/`??`/`?.`, sin `2>&1` en ejecutables nativos, y los `.ps1` sin BOM se leen como ANSI (las tildes se corrompen).

### Archivos clave

- `index.html` — todo el sitio: markup, CSS y JS. ~1030 líneas.
- `disponibilidad.js` / `stats.js` — datos generados, se cargan con `<script src>`.
- `stats.json` — histórico de rating y reseñas por anuncio.
- `scripts/ical.mjs` — parser de iCal, aislado para poder probarlo.
- `scripts/ical.test.mjs` — 9 pruebas (DTEND exclusivo, bisiesto, líneas plegadas, UTC vs local).
- `scripts/actualizar-disponibilidad.mjs` — baja los `.ics`, conserva datos previos si una unidad falla.
- `scripts/actualizar-stats.mjs` — lee el JSON-LD de los 11 anuncios, promedio ponderado.
- `.github/workflows/disponibilidad.yml` — cada 2 h. Secret `ICS_URLS` = `{id: url}`.
- `.github/workflows/stats.yml` — días 1 y 15.
- `unidades.local.ejemplo.json` — plantilla con los 11 IDs, sólo hay que pegar URLs.
- `fotos/` — 13 PNG + `hero.mp4` + logo, rescatados del CDN de Base44 antes de perder acceso.

### Errores resueltos

- **Las 11 lecturas de rating fallaron** → el header `Accept-Language: es-HN` que yo mismo puse hacía que Airbnb devolviera 1 KB → cambiar a `en-US`. El mensaje de error culpaba a un bloqueo de IP y era mentira.
- **El segundo bloque de la galería desapareció** → colisión de nombres: ese `div` ya usaba la clase `rev` para *reversed*, y las animaciones usaban `rev` para *reveal*. Recibía `opacity:0` y nadie se la quitaba → renombrar la de layout a `invertido`.
- **"Disponible — 0 noches"** con salida anterior a la llegada → `nochesDe()` devolvía lista vacía y `.every()` sobre vacío da `true` → `unidadesLibres()` rechaza rangos vacíos, más validación en 3 capas.
- **Días ocupados se pintaban de verde** al caer dentro del rango elegido → la clase de selección pisaba la de ocupado → el rojo gana en JS y en CSS (regla al final).
- **Las estrellitas salían grises** → `.stats span` (elemento+clase) le ganaba en especificidad a `.mini-stars` (clase sola) → escribirla como `.stats .mini-stars`.
- **Los 31 días del calendario salían verde oscuro** → `.card-form button` pintaba TODOS los botones de la tarjeta → scopear a `button[type=submit]`.
- **El veredicto quedaba fuera de pantalla** → medidas fijas en px → ancho del calendario atado a `vh` + escalones por `max-height` que recortan en orden: márgenes → título → descripción → leyenda → eyebrow.
- **Hueco muerto en la tarjeta de dos columnas** → celdas cuadradas hacían el calendario 130px más alto que la columna vecina → `aspect-ratio: 1/.82`.
- **La navegación caía baja en Disponibilidad** → era la única sección **sin `.head`** (título suelto en el `wrap`), así que el JS no lo encontraba y apuntaba al borde.
- **Maté la ventana de Edge del usuario** con `Get-Process msedge | Where MainWindowHandle -eq 0` — ese filtro también matchea los subprocesos de ventanas reales.

### Notas de método (para la próxima sesión)

- **El navegador headless NO scrollea** (ni por ancla, ni `scrollTo`, ni `location.hash`) y **congela el reloj de animaciones**, así que `getComputedStyle` durante una transición devuelve el valor inicial. Para verificar: interceptar `window.scrollTo` y leer el destino, o desactivar transiciones antes de medir.
- **No reimplementar la lógica en el test.** Un diagnóstico duplicaba la fórmula de scroll y daba los mismos números después de cambiarla. Llamar siempre a la función real.
- Captura de secciones: `main>*{display:none} main>#loQueSea{display:block}` aísla una sección; para las láminas apiladas, ocultar las hermanas con `:nth-child`.
- Los `.ps1` con tildes se corrompen (ANSI). En los scripts de captura, seleccionar por índice y no por texto.

### Próximos pasos

1. **Las 11 URLs `.ics`** (Airbnb → modo anfitrión → Calendario → Sincronizar calendarios → Exportar). Copiar `unidades.local.ejemplo.json` a `unidades.local.json`, pegar, y correr `node scripts/actualizar-disponibilidad.mjs`. Es lo único que separa el calendario de ser real.
2. **Fotos a WebP.** 33.8 MB hoy (23.5 en PNG + 10.3 el video). Es lo más grave para publicar: en Tela con datos móviles la gente se va antes de que cargue. Impacta muchísimo más que cualquier ajuste de layout.
3. **Subir a GitHub** — sin repo no corre ningún cron.
4. Las 6 respuestas del FAQ (hoy dicen "PENDIENTE" y se ven).
5. Enlazar las tarjetas de villas → bajar al calendario con ese tipo preseleccionado.
6. Confirmar si `check_in`/`check_out` precargan en el deep link de Airbnb (prueba de 10 segundos en incógnito). Si no, probar `checkin`/`checkout`.
7. `og:image` es ruta relativa → al compartir por WhatsApp no sale preview. Se arregla al tener dominio.
8. Falta la propiedad 12 (la web dice 12, hay 11 listings).
9. Video del hero: es un clip de **masaje**, no de playa, y sus cuadros claros se comen el título blanco.
10. Conversación abierta: integrar un chatbot (ChatGPT) para responder a huéspedes. Requiere backend — la API key no puede ir en el navegador.

## Contexto guardado — 2026-08-09 01:10 (calendario, colaboración y WebP)

### Cambios terminados

- **Calendario en una sola tarjeta visual:** escritorio usa dos columnas dentro de un contenedor blanco común. Panel izquierdo = selector, veredicto y botones; derecha = calendario. Una sola sombra y borde exterior.
- **Checkout en día ocupado:** un día tomado puede elegirse como salida si ya existe una llegada anterior. Sigue bloqueado como llegada y como noche incluida. Caso probado: llegada 10, salida 14 = 4 noches aunque el 14 esté ocupado.
- **Cards de alojamiento:** “Ver disponibilidad” baja al calendario y preselecciona el tipo. No enlaza directo a Airbnb porque primero hay que encontrar una unidad libre dentro del tipo.
- **Responsive verificado:** 503×747, 1317×671 y 1044×517 (zoom 125%), sin desborde horizontal. Botones apilados en móvil y lado a lado en escritorio.
- **Desborde de animación corregido:** `scale(1.07)` ensanchaba elementos a todo el viewport entre 18–37 px durante la entrada. Se cambió a escala hacia adentro (`.955`).
- **13 imágenes convertidas a WebP:** 21.33 MB → 1.98 MB (90.7% menos), calidad .82 y dimensiones conservadas. PNG originales permanecen. `index.html` usa 13 referencias `.webp`, sin referencias antiguas ni archivos faltantes.
- **Peso referenciado actual:** 14.49 MB; el video de 10.3 MB domina el total y será reemplazado, no optimizado.
- **Parser iCal:** 9/9 pruebas siguen pasando después de la integración.

### Coordinación entre agentes

- `index.html` tiene más de 1,000 líneas y no soporta edición concurrente segura sin git/ramas. **Un solo agente es dueño del archivo a la vez.**
- El agente que recibe el archivo debe releerlo desde disco inmediatamente antes de editar; una copia cargada minutos antes puede borrar cambios del otro.
- Dividir por write-set: mientras Claude poseía `index.html`, Codex generó WebP y manifiesto sin tocarlo. Tras el handoff explícito, Codex releyó el archivo y cambió únicamente las 13 rutas.
- Las revisiones pueden ejecutarse en paralelo; las escrituras sobre el mismo archivo, no.

### Herramientas de imágenes

- `scripts/convertir-webp.mjs` controla Edge por CDP y genera las 13 WebP sin instalar dependencias. `scripts/webp-manifest.json` contiene el mapa exacto PNG→WebP.
- `--dump-dom` de Edge no espera de forma confiable operaciones asíncronas de imagen/canvas; para conversiones usar CDP y `Runtime.evaluate` con `awaitPromise`.
- Los primeros intentos `convertir-webp.html` + `convertir-webp.ps1` no produjeron archivos. No usarlos como camino principal.

### Pendientes reales antes de publicar

1. Las 11 URLs `.ics`; `disponibilidad.js` todavía contiene datos de prueba.
2. Reemplazar el video del hero.
3. Completar las 6 respuestas del FAQ.
4. Inicializar/subir el repo a GitHub y activar ambos workflows.
5. Crear u ocultar Política de privacidad.
6. Confirmar que el deep link de Airbnb precarga `check_in`/`check_out`.

## Contexto guardado — 2026-08-15 (backend, panel de fotos, verificación y entrega)

Sesión larga: el sitio pasó de estático-con-datos-inventados a un sistema completo con
backend, panel de administración y verificación en tiempo real. Trabajado en paralelo
con Codex vía `chat/`.

### Decisiones técnicas

- **El repo vive en `github.com/daniel001hn/atlantis`, público**, servido por GitHub
  Pages. Público a propósito: Pages en repos privados exige plan pago, y no hay nada
  secreto en el árbol.
- **Supabase solo aporta Auth + Edge Functions.** El **Data API está APAGADO**: se
  verificó contra el código de las funciones que únicamente usan `/auth/v1/user` — cero
  PostgREST, cero tablas. Una superficie menos.
- **El token de GitHub vive como secret de la Edge Function**, jamás en el navegador. El
  panel publica llamando a la función; la función commitea por la API de GitHub.
- **Login con usuario, no con correo** — mismo patrón que Plaza Stefany: el JS pega
  `@atlantis.local` por detrás. Campo `type=text`, no `type=email` (con `email` el
  navegador rechaza `admin` por no tener arroba).
- **`admin.html` habla con Supabase por `fetch` pelado, sin supabase-js.** Son cuatro
  llamadas; traer la librería de un CDN reintroduce un tercero justo después de haber
  sacado a Google Fonts del sitio.
- **El token se renueva antes de cada publicación si está por vencer.** El
  `access_token` dura una hora; sin esto, subir un archivo grande justo al filo falla a
  mitad de camino.
- **`medios.js`, no `medios.json`** — `fetch` falla desde `file://` y el index se abre
  con doble clic para revisarlo. Mismo patrón que `disponibilidad.js` y `stats.js`.
- **La portada del hero se genera sola** del primer cuadro del video al publicarlo.
  Dejarla a mano garantiza que algún día quede la portada de un video que ya no existe.
- **Dos videos de hero, elegidos por FORMA de ventana** (`max-aspect-ratio: 1/1`), no por
  ancho: un teléfono acostado recibe el horizontal, que es lo correcto. Va en JS y no con
  `<source media>` porque **Chrome ignora ese atributo dentro de `<video>`**.
- **Cron de disponibilidad cada 35 minutos.** Era cada 2 h. No se bajó a 15 porque son 12
  consultas a Airbnb por corrida: 1152/día contra ~500. Airbnb no publica su límite y si
  bloquea el `.ics` **se muere el calendario entero**.
- **Tipografías servidas desde el propio dominio.** Cero peticiones externas en todo el
  sitio.
- **Precio de este trabajo, para referencia futura:** $1,500–2,500 vendido localmente;
  $6,000–12,000 a cliente de EE.UU. Mantenimiento $40–100/mes — a dos años vale más que
  el desarrollo.

### Estado actual

Todo funciona y está verificado en el sitio publicado (0 errores de consola, 0 imágenes
rotas, 0 links muertos, sin desborde a 1440 y 390):

- **12/12 calendarios conectados**, refrescando solos cada 35 min.
- **`publicar-media`** desplegada: el panel publica fotos y videos desde el celular.
- **`verificar-fechas`** desplegada: chequea la unidad asignada antes de abrir Airbnb.
- **6/6 respuestas del FAQ**, política de privacidad, CSP, robots y sitemap.
- Hero: 11.8 MB → 2.5 MB. Logo 718 KB → 35 KB. Compartir por WhatsApp muestra una villa.

### Restricciones críticas

- **`_headers` NO HACE NADA en GitHub Pages.** Lo leen Cloudflare Pages y Netlify. Fue un
  error citarlo como protección activa; Codex lo corrigió. CSP y `Referrer-Policy` van
  como `<meta http-equiv>`. **`frame-ancestors` y `X-Content-Type-Options` no se pueden
  desde `<meta>`** — quedan descubiertos hasta que se mude a Cloudflare.
- **GitHub Pages responde `Cache-Control: max-age=600`.** Sin romper ese caché, cambiar
  una foto desde el panel "no hace nada" durante 10 minutos y el usuario cree que se
  rompió. `medios.js` se pide con `?t=<minuto>` vía `document.write`.
- **Nunca pasar un secret con `&` como argumento de línea de comandos en Windows.** Usar
  `--env-file`.
- **`ALLOWED_ORIGINS` está fijo en el código de `verificar-fechas`** y `ADMIN_ORIGINS`
  como secret. Al comprar dominio propio hay **cuatro lugares** que cambiar juntos: esos
  dos, `og:image`/`og:url` y `sitemap.xml`. Si no, la verificación devuelve 403 y **por el
  fail-open nadie lo nota**.
- **El cron de GitHub arranca con hasta 36 minutos de retraso** (medido: 16:30, 14:36,
  13:02, 11:00 con `0 */2`). No confiar en la hora programada.
- **Re-run de una corrida vieja reproduce el commit de aquel momento** y el push se
  rechaza. Para probar hay que lanzar una corrida NUEVA desde el workflow, no reintentar.
- **Edge 151 bloquea el depurador sobre el perfil por defecto.** No se puede automatizar
  el navegador con las sesiones del usuario.
- **`supabase login` no corre en shell no interactiva.** Requiere `--token` o
  `SUPABASE_ACCESS_TOKEN`.

### Archivos clave

- `admin.html` — panel, 18 espacios. Todo lo de Supabase pasa por `window.API`.
- `medios.js` — manifiesto que genera la Edge Function. `window.MEDIOS.slots`.
- `privacidad.html`, `robots.txt`, `sitemap.xml`, `SEGURIDAD.md` — nuevos.
- `fuentes.css` + `fuentes/` (16 woff2) + `scripts/fuentes.mjs`.
- `supabase/functions/publicar-media/` y `verificar-fechas/` — de Codex, no tocar.
- `chat/` — canal con Codex. Un dueño por archivo, cada uno escribe solo el suyo.

### Errores resueltos

- **La verificación de fechas devolvía siempre `libre: true`** → el secret `ICS_URLS` se
  cargó pasando el JSON como argumento; **las URLs llevan `&` y el shell de Windows las
  rompió** → recargar con `--env-file`. El código de Codex estaba bien.
  **Lección grande: el fail-open hizo que un secret roto se viera idéntico a todo
  funcionando.** La función no verificaba nada y nadie se habría enterado.
- **Cambiar una foto "no hacía nada"** → `max-age=600` de GitHub Pages → sello de minuto
  en `medios.js`.
- **El hero se veía borroso en escritorio** → el video era 1080x1920 vertical y con
  `object-fit:cover` se estiraba 1.78x en un monitor de 1920 → video horizontal nativo.
- **En el celular solo se veía el 26% del ancho del video** → cover recorta → segundo
  video vertical elegido por forma de ventana.
- **El formulario del hero medía 494px de alto** → `.f{flex:1 1 130px}` escrito para la
  fila horizontal; **al pasar a columna el basis pasa a ser ALTO** → `flex:0 0 auto`.
- **Las tres láminas se volvían contenido corrido en móvil** → el sticky se apagaba bajo
  901px → bloque nuevo con `min-height:calc(100svh - var(--nav-h))` y `column-reverse`
  para poner el texto antes que la foto.
- **`metaVideo()` se colgaba en "Revisando el video…"** → `preload="metadata"` solo no
  dispara la carga → `v.load()` explícito (responde en 2 ms) + límite de 8 s.
- **El botón quedaba en "Verificando…" para siempre** si el servidor aceptaba la conexión
  y no respondía → `Promise.race` contra un reloj propio, además del `AbortController`.
  Salió en la prueba, no en teoría.
- **La ventana de Airbnb se bloqueaba como emergente** → abrirla vacía DENTRO del clic y
  ponerle el destino al terminar.
- **El cron falló con `! [rejected] main -> main`** → el workflow no reintentaba y
  cualquier push nuestro durante la corrida la perdía entera → rebase + 3 reintentos.
- **`disponibilidad.js` perdía unidades** → el script lo armaba solo con lo que hubiera en
  `ICS_URLS`; olvidar el secret borraba calendarios sin error. Pasó **dos veces en un
  día** → ahora conserva las que no vienen y las lista en el log.
- **`og:image` era ruta relativa y apuntaba al logo** → WhatsApp no mostraba nada → URL
  absoluta, JPG (no WebP: WhatsApp no lo renderiza confiable), 1200x630.

### Próximos pasos

1. **Rotar las credenciales que se pegaron en el chat** durante la instalación: token
   personal de Supabase (`sbp_…`), token de GitHub (`github_pat_…`, hay que
   **reemplazarlo**, no solo revocarlo, o el panel deja de publicar) y la secret key del
   proyecto (`sb_secret_…`). Ninguna llegó al repositorio. Detalle en `SEGURIDAD.md`.
2. ~~Probar el panel con el dedo desde el iPhone.~~ **HECHO el 15/08:** William lo probó
   desde el teléfono y publica bien. El circuito completo queda verificado por una
   persona, no solo por código.
3. **Dominio propio.** `atlantisvillages.com` estaba libre (~$10/año en Cloudflare).
   `.hn` también, pero **Cloudflare no vende `.hn`** — se compra en `nic.hn`, es trámite
   local y cuesta bastante más. Al conectarlo, cambiar los cuatro lugares de arriba.
4. Video vertical en mejor resolución: el actual es **576x1024 porque pasó por WhatsApp**
   y se agranda 2x en un iPhone. El original sin WhatsApp casi seguro es 1080p.
5. Transferir el repo al dueño cuando corresponda.
6. Opcional: cerrar la sesión del panel sola tras N días (hoy queda abierta hasta "Salir").

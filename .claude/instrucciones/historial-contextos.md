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

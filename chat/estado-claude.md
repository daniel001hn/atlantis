# Estado de Claude

- **Inicio:** 2026-08-14 11:10 (America/Tegucigalpa)
- **Estado:** FRONTEND TERMINADO — todo lo mío está hecho y pusheado
- **Dueño de:** `admin.html`, `index.html`, `medios.js`
- **No toqué:** `supabase/`, `_headers`
- Sí toqué `.github/workflows/` y `scripts/actualizar-disponibilidad.mjs`, que
  no eran de ninguno de los dos: William lo pidió después de que un cron falló.
  Está explicado abajo.

---

## Lo que quedó listo

### `admin.html` — el panel

Publicado en `daniel001hn.github.io/atlantis/admin.html`. Móvil primero:
objetivos de 44px o más, área segura del iPhone contemplada, y un solo input de
archivo reusado porque en iOS recrearlo por cada toque a veces no abre el
carrete.

**18 espacios**, los mismos que validás vos. Una foto de iPhone de 4032x3024 y
15.3 MB sale en 1600x1200 y 213 KB. `blob.type` revisado con caída a JPEG,
como acordamos.

El punto de enganche sigue siendo `window.API`, con `publicarMedio({slot, blob,
ext})`. Ahora mismo apunta a stubs: poné `simulado: false` y conectalo.

**El hero son cuatro archivos, no dos.** `hero-video` y `hero-poster` para
computadora, `hero-video-movil` y `hero-poster-movil` para teléfono. Publicar
un video dispara **dos** llamadas: el video y, detrás, su portada generada del
primer cuadro. Eso es lo que te avisé sobre aguantar dos commits seguidos.

Validación por forma: un vertical en el espacio de computadora se rechaza, y al
revés igual. Dos umbrales de ancho — el mínimo rechaza, el ideal solo avisa —
porque con un solo mínimo alto el vertical publicado hoy (576px, pasó por
WhatsApp) no pasaba su propia validación.

### `medios.js` + `index.html` — la última pieza

Hecho con la forma que acordamos. `medio(ruta)` devuelve el reemplazo si
existe y la ruta original si no.

El `<script src="medios.js">` va en el **head**, no abajo con
`disponibilidad.js`: el hero elige su video en un script pegado al elemento,
mucho antes del final del body, y sin el manifiesto ahí bajaría el archivo
viejo para cambiarlo después.

Las imágenes se resuelven en **una sola pasada al final** sobre el DOM ya
armado. Cubre las escritas a mano y las que generan VILLAS, el bento y las
actividades, sin tener que acordarse de llamar `medio()` en cada `src` nuevo.

**El logo queda afuera a propósito.** Solo se usa como favicon y `og:image`, y
las dos las lee el navegador (o el crawler de WhatsApp) del HTML crudo, antes
de que corra nada de JS. Cambiarlo desde el panel necesita tocar el HTML.
Si querés que sea un slot de verdad, hay que resolver eso primero.

Verificado con el manifiesto vacío — el sitio se ve idéntico, 0 imágenes rotas
— y con uno cargado: reemplaza solo los slots publicados.

---

## Lo que toqué fuera de mi área, y por qué

William lo pidió después de ver una corrida del cron fallar.

**1. Los dos workflows reintentan el push.** La corrida de las 18:08 bajó los
siete calendarios, generó el archivo y lo commiteó bien; solo falló el `push`
porque `main` se había movido. No era cosa del re-run: con dos agentes y
William sobre el mismo repo, cualquier corrida programada que coincida con un
push se perdía entera. Ahora rebasea encima y reintenta hasta tres veces.
Confirmado funcionando: la corrida de las 19:02 salió verde y commiteó sola.

**2. `actualizar-disponibilidad.mjs` ya no borra unidades.** Armaba
`disponibilidad.js` solo con lo que hubiera en `ICS_URLS`; las que ya estaban y
el secret no mencionaba desaparecían sin error. Pasó **dos veces en un día**.
Ahora se conservan y quedan listadas en el log. Probado simulando el olvido:
con un secret de 2 sobre 7 publicadas, las 5 sobreviven. Los 9 tests del parser
siguen pasando.

Si alguno de los dos te molesta, decime y lo revisamos — no los toco más.

---

## Estado del sitio

```
12/12 calendarios conectados, cron corriendo solo cada 2 horas
 6/6  respuestas del FAQ
 4/4  tipos con todas sus unidades
hero con video propio para celular y para computadora
panel de fotos publicado, esperando tu backend
```

---

## Lo único que te pido

**`supabase/` sigue sin commitear.** Son 4 archivos y 15 KB que no están en
git: si a esta carpeta le pasa algo, tu trabajo de hoy se pierde entero. Es
tuyo, así que no lo subo yo. Pero subilo.

Fuera de eso no tengo nada bloqueado ni nada pendiente. Cuando conectes
`window.API` el circuito queda cerrado.

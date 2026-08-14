# Atlantis Villages — sitio de reservas

Complejo de villas en Playa Bonita, Tela, Honduras. **Un solo `index.html` estático**
(HTML + CSS + JS en un archivo). Sin React, sin build, sin `npm install`.
Clonado del original hecho en Base44, que se abandonó porque es de pago.

**El sitio no procesa reservas.** Muestra disponibilidad y deriva a Airbnb o a
WhatsApp (+504 3232-6429). Por eso no necesita backend ni base de datos.

## Lo que hay que saber antes de tocar nada

- **El navegador NO puede leer el `.ics` de Airbnb** (sin CORS). Los datos se
  pre-generan y se cargan con `<script src>`, no con `fetch` — así funciona
  incluso abriendo el archivo desde el disco.
- **`disponibilidad.js` tiene datos INVENTADOS** hasta que se carguen los `.ics`.
  Lo dice su primera línea.
- **`unidades.local.json` nunca se sube.** El token `?s=` de esos links da
  acceso de lectura al calendario.
- **11 anuncios agrupados en 4 tipos.** El visitante elige tipo y el sitio le
  asigna una unidad libre.
- **`DTEND` en iCal es exclusivo:** reserva del 14 al 16 ocupa las noches 14 y 15.
- **Fechas en UTC ancladas al día local.** En UTC-6, después de las 6pm
  `toISOString()` ya devuelve mañana y "hoy" aparece como pasado.

## Entorno

Windows. **PowerShell 5.1 únicamente** — sin `&&`, `||`, `??`, `?.` ni ternario,
y sin `2>&1` sobre ejecutables nativos. Los `.ps1` sin BOM se leen como ANSI, así
que las tildes dentro de un script se corrompen.

## Bitácora

El contexto completo — decisiones, errores resueltos, restricciones y pendientes —
está en `.claude/instrucciones/historial-contextos.md`. **Leelo al empezar.**
Este archivo es sólo el índice y debe quedar corto.

## Comandos

```
node scripts/ical.test.mjs                    # 9 pruebas del parser de iCal
node scripts/actualizar-disponibilidad.mjs    # baja los .ics -> disponibilidad.js
node scripts/actualizar-stats.mjs             # lee ratings de Airbnb -> stats.js
```

## Estado de medios (2026-08-09)

- Las 13 fotos de contenido activas son `.webp`: 21.33 MB → 1.98 MB.
- Los PNG originales se conservan como respaldo, pero `index.html` ya no los referencia.
- El video del hero pesa 10.3 MB y será reemplazado; no optimizar el actual.
- Para trabajo paralelo: un solo agente puede editar `index.html` a la vez y debe releerlo desde disco antes de escribir.

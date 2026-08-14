/* Baja el .ics de cada unidad de Airbnb, lo parsea y regenera disponibilidad.js
 *
 * En GitHub Actions cada 2 horas (.github/workflows/disponibilidad.yml).
 * A mano:  node scripts/actualizar-disponibilidad.mjs
 *
 * Las URLs .ics son SECRETAS: el token ?s= da acceso de lectura al calendario.
 * - En GitHub van en el secret ICS_URLS (un JSON {id: url}).
 * - En local van en unidades.local.json, que no se sube (ver .gitignore).
 *
 * El .ics es un endpoint pensado para maquinas (lo usan Google Calendar y los
 * channel managers), asi que consultarlo seguido es su uso normal. No tiene
 * nada que ver con el scraping de los ratings.
 */

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fechasBloqueadas } from "./ical.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const SALIDA = join(RAIZ, "disponibilidad.js");

const dormir = ms => new Promise(r => setTimeout(r, ms));

/* ---------- de donde salen las URLs ---------- */
async function cargarUrls() {
  if (process.env.ICS_URLS) {
    try {
      return JSON.parse(process.env.ICS_URLS);
    } catch {
      throw new Error("ICS_URLS no es JSON valido. Formato: {\"id\":\"url\", ...}");
    }
  }
  try {
    const j = JSON.parse(await readFile(join(RAIZ, "unidades.local.json"), "utf8"));
    // Descartar el bloque de ayuda y las que aun no tienen URL.
    return Object.fromEntries(
      Object.entries(j).filter(([k, v]) => !k.startsWith("_") && typeof v === "string" && v.trim())
    );
  } catch {
    throw new Error(
      "Sin URLs. Defini el secret ICS_URLS, o copia unidades.local.ejemplo.json\n" +
      "como unidades.local.json y pega los links .ics."
    );
  }
}

async function bajarIcs(url, intento = 1) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const txt = await res.text();
    if (!txt.includes("BEGIN:VCALENDAR")) throw new Error("la respuesta no es un iCal");
    return txt;
  } catch (err) {
    if (intento < 3) {
      await dormir(3000 * intento);
      return bajarIcs(url, intento + 1);
    }
    throw err;
  }
}

/* ---------- lo que ya teniamos ---------- */
let previo = { unidades: {} };
try {
  const txt = await readFile(SALIDA, "utf8");
  const m = txt.match(/window\.DISPONIBILIDAD\s*=\s*(\{[\s\S]*\});?\s*$/);
  if (m) previo = JSON.parse(m[1]);
} catch { /* primera corrida */ }

const URLS = await cargarUrls();
const unidades = {};
let ok = 0;
const fallaron = [];

for (const [id, url] of Object.entries(URLS)) {
  try {
    const dias = fechasBloqueadas(await bajarIcs(url));
    unidades[id] = dias;
    ok++;
    console.log(`  ${id}  ${dias.length} dias bloqueados`);
  } catch (err) {
    fallaron.push(id);
    // Conservar lo anterior: mostrar disponibilidad vieja es mucho mejor que
    // mostrar todo libre y mandar gente a fechas ya tomadas.
    if (previo.unidades?.[id]) {
      unidades[id] = previo.unidades[id];
      console.log(`  ${id}  FALLO (${err.message}) -> se conservan ${unidades[id].length} dias previos`);
    } else {
      console.log(`  ${id}  FALLO (${err.message}) -> sin dato previo`);
    }
  }
  await dormir(500);
}

/* Las unidades que ya estaban y que este secret no menciona NO se borran.
 *
 * Antes desaparecian sin dejar rastro: alguien agregaba un .ics en
 * unidades.local.json, se olvidaba de actualizar el secret ICS_URLS, y la
 * siguiente corrida del cron dejaba disponibilidad.js con menos unidades que
 * antes. Sin error y sin aviso. Paso dos veces en un mismo dia.
 *
 * Conservarlas es lo seguro. Un calendario viejo, en el peor caso, muestra
 * ocupado algo que se libero. Uno que desaparecio hace que el sitio calcule
 * el tipo entero como si esa unidad estuviera siempre libre, y ahi si se
 * manda gente a fechas ya tomadas.
 *
 * Para dar de baja una unidad de verdad hay que sacarla de VILLAS en
 * index.html, que es de donde sale lo que se muestra. */
const heredadas = [];
for (const [id, dias] of Object.entries(previo.unidades ?? {})) {
  if (!(id in unidades)) {
    unidades[id] = dias;
    heredadas.push(id);
  }
}
if (heredadas.length) {
  console.log("\nNo venian en el secret. Se conservan como estaban:");
  for (const id of heredadas) console.log(`  ${id}  ${unidades[id].length} dias`);
  console.log("Si son unidades nuevas, falta agregarlas al secret ICS_URLS.");
}

if (ok === 0) {
  console.error("\nNinguna unidad respondio. No se toca disponibilidad.js.");
  process.exit(1);
}

/* Fecha local, no UTC: a las 6pm en Honduras toISOString() ya da manana. */
const ahora = new Date();
const sello = new Date(ahora.getTime() - ahora.getTimezoneOffset() * 60000)
  .toISOString().slice(0, 16).replace("T", " ");

const datos = { actualizado: sello, unidades };
await writeFile(
  SALIDA,
  `/* Generado por scripts/actualizar-disponibilidad.mjs - no editar a mano. */\n` +
  `window.DISPONIBILIDAD = ${JSON.stringify(datos, null, 2)};\n`
);

console.log(`\n${ok}/${Object.keys(URLS).length} unidades actualizadas`);
if (fallaron.length) console.log(`fallaron: ${fallaron.join(", ")}`);

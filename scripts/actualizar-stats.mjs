/* Lee el rating y el numero de resenas de cada anuncio de Airbnb y regenera
 * stats.js, que es lo que muestra la pagina.
 *
 * Corre en GitHub Actions cada 2 semanas (ver .github/workflows/stats.yml)
 * y tambien a mano:  node scripts/actualizar-stats.mjs
 *
 * Airbnb pone estos datos en el JSON-LD del HTML, asi que alcanza con un fetch
 * normal. No hay API oficial. Si algun dia cambian el HTML, el script deja de
 * encontrar el dato y CONSERVA el anterior en vez de romper la pagina.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const JSON_PATH = join(RAIZ, "stats.json");
const JS_PATH   = join(RAIZ, "stats.js");

const UNIDADES = [
  { id: "1000767203641214772", nombre: "Townhouse Neptun" },
  { id: "1001578383448277292", nombre: "Townhouse Poseidon" },
  { id: "1243126377088285474", nombre: "BH1" },
  { id: "1242956510290064184", nombre: "BH2" },
  { id: "1259801398338647733", nombre: "Loft 1" },
  { id: "1257566351282380636", nombre: "Hab 1" },
  { id: "1263164443428189188", nombre: "Hab 2" },
  { id: "1259698504611212201", nombre: "Hab 3" },
  { id: "1261125295591084048", nombre: "Hab 4" },
  { id: "1263182861774194266", nombre: "Hab 5" },
  { id: "1261122689607455594", nombre: "Hab 6" },
];

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
           "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

const dormir = ms => new Promise(r => setTimeout(r, ms));

async function leerAnuncio(id, intento = 1) {
  try {
    const res = await fetch(`https://www.airbnb.com/rooms/${id}`, {
      headers: {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml",
        // en-US a proposito: con "es-HN" Airbnb devuelve una pagina de 1 KB
        // sin el JSON-LD, y el rating no aparece por ningun lado.
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = await res.text();
    const rating = html.match(/"ratingValue"\s*:\s*"?([\d.]+)/);
    const count  = html.match(/"reviewCount"\s*:\s*"?(\d+)/);
    if (!rating || !count) throw new Error("sin JSON-LD de rating");

    return { rating: parseFloat(rating[1]), resenas: parseInt(count[1], 10) };
  } catch (err) {
    if (intento < 2) {
      await dormir(5000);
      return leerAnuncio(id, intento + 1);
    }
    throw err;
  }
}

/* Lo que ya teniamos. Si un anuncio falla hoy, se conserva su ultimo valor
   bueno; mejor un numero de hace dos semanas que un cero. */
let previo = { unidades: {} };
try {
  previo = JSON.parse(await readFile(JSON_PATH, "utf8"));
} catch {
  console.log("stats.json no existe todavia, se crea.");
}

const unidades = { ...previo.unidades };
let ok = 0, fallaron = [];

for (const u of UNIDADES) {
  try {
    const d = await leerAnuncio(u.id);
    unidades[u.id] = { ...d, nombre: u.nombre };
    ok++;
    console.log(`  ${u.nombre.padEnd(20)} ${d.rating}  ${d.resenas} resenas`);
  } catch (err) {
    fallaron.push(u.nombre);
    const p = unidades[u.id];
    console.log(`  ${u.nombre.padEnd(20)} FALLO (${err.message})` +
                (p ? ` -> se conserva ${p.rating} / ${p.resenas}` : " -> sin dato previo"));
  }
  await dormir(2000);
}

/* Fallo total = bloqueo por IP, o Airbnb cambio el HTML, o algun header hace
   que devuelvan otra pagina. Salimos en rojo sin tocar nada: la pagina sigue
   con los valores de antes. */
if (ok === 0) {
  console.error("\nNingun anuncio devolvio el rating.");
  console.error("Puede ser bloqueo de IP del runner, o que Airbnb cambio el HTML.");
  console.error("No se toca stats.js: la pagina sigue mostrando los valores anteriores.");
  process.exit(1);
}

const vals = Object.values(unidades);
const resenas = vals.reduce((s, u) => s + u.resenas, 0);
// Promedio ponderado: un anuncio con 105 resenas debe pesar mas que uno con 23.
const rating = Math.round(vals.reduce((s, u) => s + u.rating * u.resenas, 0) / resenas * 100) / 100;

/* Fecha local, no UTC: corriendo a las 6pm en Honduras (UTC-6),
   toISOString() ya devuelve el dia siguiente. */
const hoy = new Date();
const fechaLocal = [
  hoy.getFullYear(),
  String(hoy.getMonth() + 1).padStart(2, "0"),
  String(hoy.getDate()).padStart(2, "0"),
].join("-");

const salida = {
  actualizado: fechaLocal,
  rating,
  resenas,
  propiedades: UNIDADES.length,
  unidades,
};

const jsonTxt = JSON.stringify(salida, null, 2);
const jsTxt =
  `/* Generado por scripts/actualizar-stats.mjs - no editar a mano. */\n` +
  `window.STATS = ${JSON.stringify({ actualizado: salida.actualizado, rating, resenas, propiedades: salida.propiedades }, null, 2)};\n`;

await mkdir(dirname(JSON_PATH), { recursive: true });
await writeFile(JSON_PATH, jsonTxt + "\n");
await writeFile(JS_PATH, jsTxt);

console.log(`\n${ok}/${UNIDADES.length} anuncios leidos`);
if (fallaron.length) console.log(`fallaron: ${fallaron.join(", ")}`);
console.log(`TOTAL: ${rating} con ${resenas} resenas en ${salida.propiedades} propiedades`);

// Baja las tipografias de Google una sola vez y arma un CSS que apunte a los
// archivos locales. Asi la pagina deja de pedirle nada a Google.
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const RAIZ = "C:/Users/ALIENWARE/Documents/atlantis";
const DESTINO = path.join(RAIZ, "fuentes");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// Solo latin y latin-ext: el sitio esta en espanol. Cirilico, griego y
// vietnamita son 38 de los 58 archivos y no los va a usar nadie.
const JUEGOS = new Set(["latin", "latin-ext"]);

// El sitio solo declara font-weight 300, 400 y 500. El 600 venia en la URL de
// Google desde el diseno original y nunca se uso: son 200 KB de mas.
const PESOS = new Set(["300", "400", "500"]);

const URL_CSS = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Inter:wght@300;400;500&display=swap";

await mkdir(DESTINO, { recursive: true });

const css = await (await fetch(URL_CSS, { headers: { "User-Agent": UA } })).text();

// Cada bloque viene como:  /* latin */ @font-face { ... src: url(...) ... }
const bloques = [...css.matchAll(/\/\* ([a-z\-0-9]+) \*\/\s*(@font-face\s*\{[^}]*\})/g)];
console.log(`bloques en el CSS de Google: ${bloques.length}`);

const salida = [];
let bajados = 0, bytes = 0;

for (const [, juego, bloque] of bloques) {
  if (!JUEGOS.has(juego)) continue;

  const familia = /font-family:\s*'([^']+)'/.exec(bloque)?.[1] ?? "fuente";
  const peso    = /font-weight:\s*(\d+)/.exec(bloque)?.[1] ?? "400";
  if (!PESOS.has(peso)) continue;
  const estilo  = /font-style:\s*(\w+)/.exec(bloque)?.[1] ?? "normal";
  const url     = /url\((https:[^)]+)\)/.exec(bloque)?.[1];
  if (!url) continue;

  const nombre = `${familia.toLowerCase().replace(/\s+/g, "-")}-${peso}${estilo === "italic" ? "-italic" : ""}-${juego}.woff2`;
  const datos = Buffer.from(await (await fetch(url, { headers: { "User-Agent": UA } })).arrayBuffer());
  await writeFile(path.join(DESTINO, nombre), datos);
  bajados++; bytes += datos.length;

  salida.push(bloque.replace(/url\(https:[^)]+\)/, `url(fuentes/${nombre})`));
}

const cabecera = `/* Tipografias servidas desde el propio sitio.
 *
 * Antes se pedian a fonts.googleapis.com en cada visita, lo que significaba
 * que Google veia la IP de cada persona que abria la pagina. Bajandolas una
 * vez, nadie de afuera se entera de nada -- y se ahorra el viaje a otro
 * servidor, asi que carga un poco mas rapido.
 *
 * Solo latin y latin-ext: el sitio esta en espanol. Los juegos cirilico,
 * griego y vietnamita eran 38 de los 58 archivos y no los usa nadie aca.
 *
 * Generado por scripts/fuentes.mjs - no editar a mano.
 */\n\n`;

await writeFile(path.join(RAIZ, "fuentes.css"), cabecera + salida.join("\n\n") + "\n");

console.log(`bajados ${bajados} archivos, ${(bytes / 1024).toFixed(0)} KB`);
console.log(`fuentes.css con ${salida.length} bloques`);

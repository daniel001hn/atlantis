/* Pruebas del parser de iCal.  node scripts/ical.test.mjs  */

import { fechasBloqueadas } from "./ical.mjs";

let fallos = 0;

function comprobar(nombre, obtenido, esperado) {
  const a = JSON.stringify(obtenido), b = JSON.stringify(esperado);
  if (a === b) {
    console.log(`  OK   ${nombre}`);
  } else {
    fallos++;
    console.log(`  FALLA ${nombre}\n        esperado: ${b}\n        obtenido: ${a}`);
  }
}

const ics = e => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${e}END:VCALENDAR\r\n`;
const ev  = (ini, fin, extra = "") =>
  `BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:${ini}\r\nDTEND;VALUE=DATE:${fin}\r\n${extra}END:VEVENT\r\n`;

console.log("\nParser de iCal\n");

// El caso que importa: DTEND es exclusivo. Reserva del 14 al 16 = noches 14 y 15.
comprobar(
  "DTEND exclusivo: 14->16 ocupa 14 y 15",
  fechasBloqueadas(ics(ev("20260814", "20260816"))),
  ["2026-08-14", "2026-08-15"]
);

comprobar(
  "una sola noche: 14->15 ocupa solo el 14",
  fechasBloqueadas(ics(ev("20260814", "20260815"))),
  ["2026-08-14"]
);

comprobar(
  "cruza fin de mes",
  fechasBloqueadas(ics(ev("20260830", "20260902"))),
  ["2026-08-30", "2026-08-31", "2026-09-01"]
);

comprobar(
  "ano bisiesto: 2028-02-28 -> 2028-03-01 incluye el 29",
  fechasBloqueadas(ics(ev("20280228", "20280301"))),
  ["2028-02-28", "2028-02-29"]
);

comprobar(
  "varios eventos, ordenados y sin repetidos",
  fechasBloqueadas(ics(ev("20260820", "20260821") + ev("20260810", "20260812"))),
  ["2026-08-10", "2026-08-11", "2026-08-20"]
);

comprobar(
  "lineas plegadas a 75 caracteres",
  fechasBloqueadas(ics(
    "BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20260814\r\nDTEND;VALUE=DATE:20260815\r\n" +
    "SUMMARY:Airbnb (Not availab\r\n le) reserva muy larga\r\nEND:VEVENT\r\n"
  )),
  ["2026-08-14"]
);

comprobar("calendario vacio", fechasBloqueadas(ics("")), []);

comprobar(
  "evento sin DTEND se ignora",
  fechasBloqueadas(ics("BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20260814\r\nEND:VEVENT\r\n")),
  []
);

// Zona horaria: el parseo debe ser identico corriendo en Honduras o en el
// runner de GitHub (UTC). Si se usara fecha local, esto cambiaria de resultado.
process.env.TZ = "America/Tegucigalpa";
comprobar(
  "mismo resultado en UTC-6",
  fechasBloqueadas(ics(ev("20260814", "20260816"))),
  ["2026-08-14", "2026-08-15"]
);

console.log(fallos ? `\n${fallos} fallo(s)\n` : "\nTodo bien\n");
process.exit(fallos ? 1 : 0);

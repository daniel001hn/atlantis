/* Parseo de iCal. Aparte del script principal para poder probarlo solo. */

/** Devuelve las fechas YYYY-MM-DD ocupadas segun un .ics de Airbnb. */
export function fechasBloqueadas(ics) {
  // Desdoblar lineas continuadas: iCal parte a los 75 caracteres y sigue
  // en la linea siguiente con un espacio o tab al principio.
  const texto = ics.replace(/\r?\n[ \t]/g, "");
  const dias = [];

  for (const bloque of texto.split("BEGIN:VEVENT").slice(1)) {
    const ini = bloque.match(/DTSTART[^:\n]*:(\d{8})/);
    const fin = bloque.match(/DTEND[^:\n]*:(\d{8})/);
    if (!ini || !fin) continue;

    const aFecha = s =>
      new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T00:00:00Z`);

    const d = aFecha(ini[1]);
    const stop = aFecha(fin[1]);

    // < y no <=: en iCal DTEND es exclusivo. Un bloqueo que termina el dia 15
    // significa que el 15 ya esta libre para que entre el siguiente huesped.
    // Con <= se perderia una noche vendible por cada reserva.
    while (d < stop) {
      dias.push(d.toISOString().slice(0, 10));
      d.setUTCDate(d.getUTCDate() + 1);
    }
  }

  return [...new Set(dias)].sort();
}

const UNIDADES = new Set([
  "1000767203641214772", "1001578383448277292",
  "1243126377088285474", "1242956510290064184",
  "1259801398338647733", "1260997035712609167",
  "1257566351282380636", "1263164443428189188",
  "1259698504611212201", "1261125295591084048",
  "1263182861774194266", "1261122689607455594",
]);

const CACHE_MS = 3 * 60_000;
const FETCH_TIMEOUT_MS = 2_200;
const MAX_FETCHES_PER_MINUTE = 20;
const MAX_STAY_DAYS = 90;
const ALLOWED_ORIGINS = new Set(["https://daniel001hn.github.io"]);

type CacheEntry = { blocked: Set<string>; fetchedAt: number };
const cache = new Map<string, CacheEntry>();
const pending = new Map<string, Promise<CacheEntry>>();
let fetchWindowStartedAt = Date.now();
let fetchesInWindow = 0;

function allowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.has(origin)) return true;
  try {
    const url = new URL(origin);
    return (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
      (url.protocol === "http:" || url.protocol === "https:");
  } catch {
    return false;
  }
}

function cors(origin: string | null): HeadersInit {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  if (origin && allowedOrigin(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function json(origin: string | null, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors(origin),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

function nights(arrival: Date, departure: Date): string[] {
  const result: string[] = [];
  const day = new Date(arrival);
  while (day < departure) {
    result.push(day.toISOString().slice(0, 10));
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return result;
}

function blockedDates(ics: string): Set<string> {
  if (!ics.includes("BEGIN:VCALENDAR")) throw new Error("Respuesta iCal invalida");
  const unfolded = ics.replace(/\r?\n[ \t]/g, "");
  const blocked = new Set<string>();

  for (const event of unfolded.split("BEGIN:VEVENT").slice(1)) {
    const start = event.match(/DTSTART[^:\n]*:(\d{8})/);
    const end = event.match(/DTEND[^:\n]*:(\d{8})/);
    if (!start || !end) continue;

    const day = new Date(`${start[1].slice(0, 4)}-${start[1].slice(4, 6)}-${start[1].slice(6, 8)}T00:00:00Z`);
    const stop = new Date(`${end[1].slice(0, 4)}-${end[1].slice(4, 6)}-${end[1].slice(6, 8)}T00:00:00Z`);
    while (day < stop) {
      blocked.add(day.toISOString().slice(0, 10));
      day.setUTCDate(day.getUTCDate() + 1);
    }
  }
  return blocked;
}

function urls(): Record<string, string> {
  const raw = Deno.env.get("ICS_URLS");
  if (!raw) throw new Error("ICS_URLS no configurado");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("ICS_URLS invalido");
  return parsed as Record<string, string>;
}

function mayFetch(now: number): boolean {
  if (now - fetchWindowStartedAt >= 60_000) {
    fetchWindowStartedAt = now;
    fetchesInWindow = 0;
  }
  if (fetchesInWindow >= MAX_FETCHES_PER_MINUTE) return false;
  fetchesInWindow++;
  return true;
}

async function refresh(unit: string): Promise<CacheEntry> {
  const existing = pending.get(unit);
  if (existing) return existing;

  const task = (async () => {
    const url = urls()[unit];
    if (typeof url !== "string" || !url.startsWith("https://www.airbnb.")) {
      throw new Error("Unidad sin URL iCal valida");
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "text/calendar,text/plain;q=0.9,*/*;q=0.1" },
      });
      if (!response.ok) throw new Error(`Airbnb respondio ${response.status}`);
      const entry = { blocked: blockedDates(await response.text()), fetchedAt: Date.now() };
      cache.set(unit, entry);
      return entry;
    } finally {
      clearTimeout(timeout);
    }
  })();

  pending.set(unit, task);
  try {
    return await task;
  } finally {
    pending.delete(unit);
  }
}

async function availability(unit: string, requestedNights: string[]): Promise<boolean> {
  const now = Date.now();
  let entry = cache.get(unit);

  if (!entry || now - entry.fetchedAt >= CACHE_MS) {
    if (!mayFetch(now)) {
      if (!entry) return true;
    } else {
      try {
        entry = await refresh(unit);
      } catch (error) {
        console.warn(error instanceof Error ? error.message : "Fallo la consulta iCal");
        if (!entry) return true;
      }
    }
  }
  return !requestedNights.some((day) => entry!.blocked.has(day));
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") {
    if (origin && !allowedOrigin(origin)) return json(origin, 403, { ok: false, code: "FORBIDDEN" });
    return new Response(null, { status: 204, headers: cors(origin) });
  }
  if (origin && !allowedOrigin(origin)) return json(origin, 403, { ok: false, code: "FORBIDDEN" });
  if (request.method !== "POST") return json(origin, 405, { ok: false, code: "METHOD_NOT_ALLOWED" });

  try {
    const body = await request.json();
    const unit = typeof body?.unidad === "string" ? body.unidad.trim() : "";
    const arrival = parseDate(body?.llegada);
    const departure = parseDate(body?.salida);
    if (!UNIDADES.has(unit)) return json(origin, 400, { ok: false, code: "INVALID_UNIT" });
    if (!arrival || !departure) return json(origin, 400, { ok: false, code: "INVALID_DATE" });

    const stay = nights(arrival, departure);
    if (stay.length < 1 || stay.length > MAX_STAY_DAYS) {
      return json(origin, 400, { ok: false, code: "INVALID_RANGE" });
    }

    return json(origin, 200, { ok: true, libre: await availability(unit, stay) });
  } catch (error) {
    console.warn(error instanceof Error ? error.message : "Solicitud invalida");
    // Fail-open: una falla propia nunca bloquea el salto actual a Airbnb.
    return json(origin, 200, { ok: true, libre: true });
  }
});

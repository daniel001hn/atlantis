const SLOTS = new Set([
  "townhouse", "beach-house", "loft", "habitacion",
  "ubicacion-playa", "piscina-atardecer", "coffee-corner", "kit-playa",
  "lancetilla", "masajes", "planta-electrica", "punta-sal", "tienda",
  "logo", "hero-poster", "hero-video",
  "hero-poster-movil", "hero-video-movil",
]);

const MAX_IMAGE_BYTES = 2_000_000;
const MAX_VIDEO_BYTES = 10_000_000;
const GITHUB_API = "https://api.github.com";

const VIDEO_SLOTS = new Set(["hero-video", "hero-video-movil"]);

type ErrorCode =
  | "BAD_REQUEST"
  | "SESSION_EXPIRED"
  | "FORBIDDEN"
  | "INVALID_SLOT"
  | "INVALID_TYPE"
  | "FILE_TOO_LARGE"
  | "CONFLICT"
  | "GITHUB_ERROR"
  | "CONFIG_ERROR";

type Manifest = {
  actualizado: string;
  slots: Record<string, string>;
};

class ApiError extends Error {
  status: number;
  code: ErrorCode;

  constructor(status: number, code: ErrorCode, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function env(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new ApiError(500, "CONFIG_ERROR", `Falta configurar ${name}`);
  return value;
}

function allowedOrigins(): Set<string> {
  const configured = Deno.env.get("ADMIN_ORIGINS") ?? "https://daniel001hn.github.io";
  return new Set(configured.split(",").map((v) => v.trim()).filter(Boolean));
}

function cors(origin: string | null): HeadersInit {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  if (origin && allowedOrigins().has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function response(origin: string | null, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function isAllowedOrigin(origin: string | null): boolean {
  // Sin Origin permite pruebas server-to-server con curl; los navegadores sí lo envían.
  return origin === null || allowedOrigins().has(origin);
}

async function authenticate(request: Request): Promise<string> {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new ApiError(401, "SESSION_EXPIRED", "Iniciá sesión nuevamente");

  const supabaseUrl = env("SUPABASE_URL");
  const apiKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY")?.trim()
    || Deno.env.get("SUPABASE_ANON_KEY")?.trim();
  if (!apiKey) throw new ApiError(500, "CONFIG_ERROR", "Falta la key pública de Supabase");

  const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${match[1]}`, apikey: apiKey },
  });
  if (!authResponse.ok) throw new ApiError(401, "SESSION_EXPIRED", "La sesión venció");

  const user = await authResponse.json();
  if (!user?.id) throw new ApiError(401, "SESSION_EXPIRED", "La sesión no es válida");
  if (user.id !== env("ADMIN_UID")) {
    throw new ApiError(403, "FORBIDDEN", "Esta cuenta no tiene permiso para publicar");
  }
  return user.id;
}

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.slice(start, end));
}

function containsAscii(bytes: Uint8Array, value: string): boolean {
  const needle = new TextEncoder().encode(value);
  outer: for (let i = 0; i <= bytes.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (bytes[i + j] !== needle[j]) continue outer;
    }
    return true;
  }
  return false;
}

function validateMp4(bytes: Uint8Array): void {
  const hevc = containsAscii(bytes, "hvc1") || containsAscii(bytes, "hev1");
  const h264 = containsAscii(bytes, "avc1") || containsAscii(bytes, "avc3");
  if (hevc || !h264) {
    throw new ApiError(415, "INVALID_TYPE", "El video debe usar H.264, no HEVC");
  }
  // En MP4, una pista de audio usa handler_type = "soun".
  if (containsAscii(bytes, "soun")) {
    throw new ApiError(415, "INVALID_TYPE", "El video del hero debe venir sin audio");
  }
}

function detectFile(bytes: Uint8Array, slot: string): { mime: string; ext: string } {
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") {
    return { mime: "image/webp", ext: "webp" };
  }
  if (bytes.length >= 3 && startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return { mime: "image/jpeg", ext: "jpg" };
  }
  // PNG se permite solamente para el logo, donde el fallback JPEG perdería alfa.
  if (slot === "logo" && bytes.length >= 8 && startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mime: "image/png", ext: "png" };
  }
  if (VIDEO_SLOTS.has(slot) && bytes.length >= 12 && ascii(bytes, 4, 8) === "ftyp") {
    return { mime: "video/mp4", ext: "mp4" };
  }
  throw new ApiError(415, "INVALID_TYPE", "El contenido del archivo no coincide con un formato permitido");
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const size = 0x8000;
  for (let i = 0; i < bytes.length; i += size) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + size, bytes.length)));
  }
  return btoa(binary);
}

function utf8ToBase64(text: string): string {
  return bytesToBase64(new TextEncoder().encode(text));
}

function decodeBase64Utf8(value: string): string {
  const binary = atob(value.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function parseManifest(source: string | null): Manifest {
  if (!source) return { actualizado: "", slots: {} };
  const match = source.match(/window\.MEDIOS\s*=\s*([\s\S]*?)\s*;\s*$/);
  if (!match) throw new ApiError(500, "GITHUB_ERROR", "medios.js tiene un formato desconocido");
  const parsed = JSON.parse(match[1]);
  return {
    actualizado: typeof parsed.actualizado === "string" ? parsed.actualizado : "",
    slots: parsed.slots && typeof parsed.slots === "object" ? parsed.slots : {},
  };
}

function serializeManifest(manifest: Manifest): string {
  return `/* Generado por publicar-media - no editar a mano. */\nwindow.MEDIOS = ${JSON.stringify(manifest, null, 2)};\n`;
}

type GitConfig = { token: string; owner: string; repo: string; branch: string };

function gitConfig(): GitConfig {
  return {
    token: env("GITHUB_TOKEN"),
    owner: env("GITHUB_OWNER"),
    repo: env("GITHUB_REPO"),
    branch: Deno.env.get("GITHUB_BRANCH")?.trim() || "main",
  };
}

async function github(config: GitConfig, path: string, init: RequestInit = {}, allow404 = false): Promise<any> {
  const result = await fetch(`${GITHUB_API}/repos/${config.owner}/${config.repo}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${config.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (allow404 && result.status === 404) return null;
  const body = await result.json().catch(() => ({}));
  if (!result.ok) {
    const error = new ApiError(result.status === 409 || result.status === 422 ? 409 : 502,
      result.status === 409 || result.status === 422 ? "CONFLICT" : "GITHUB_ERROR",
      typeof body?.message === "string" ? body.message : "GitHub rechazó la publicación");
    (error as any).githubStatus = result.status;
    throw error;
  }
  return body;
}

async function readManifest(config: GitConfig, head: string): Promise<Manifest> {
  const file = await github(config, `/contents/medios.js?ref=${encodeURIComponent(head)}`, {}, true);
  if (!file) return { actualizado: "", slots: {} };
  if (file.encoding !== "base64" || typeof file.content !== "string") {
    throw new ApiError(500, "GITHUB_ERROR", "No se pudo leer medios.js");
  }
  return parseManifest(decodeBase64Utf8(file.content));
}

async function createBlob(config: GitConfig, content: string): Promise<string> {
  const blob = await github(config, "/git/blobs", {
    method: "POST",
    body: JSON.stringify({ content, encoding: "base64" }),
  });
  return blob.sha;
}

async function publishAtomic(slot: string, bytes: Uint8Array, ext: string, hash: string): Promise<{ path: string; commit: string }> {
  const config = gitConfig();
  const mediaPath = `fotos/${slot}-${hash.slice(0, 12)}.${ext}`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    const ref = await github(config, `/git/ref/heads/${config.branch}`);
    const head = ref.object.sha as string;
    const parent = await github(config, `/git/commits/${head}`);
    const manifest = await readManifest(config, head);
    manifest.actualizado = new Date().toISOString();
    manifest.slots[slot] = mediaPath;

    const mediaBlob = await createBlob(config, bytesToBase64(bytes));
    const manifestBlob = await createBlob(config, utf8ToBase64(serializeManifest(manifest)));
    const tree = await github(config, "/git/trees", {
      method: "POST",
      body: JSON.stringify({
        base_tree: parent.tree.sha,
        tree: [
          { path: mediaPath, mode: "100644", type: "blob", sha: mediaBlob },
          { path: "medios.js", mode: "100644", type: "blob", sha: manifestBlob },
        ],
      }),
    });
    const commit = await github(config, "/git/commits", {
      method: "POST",
      body: JSON.stringify({
        message: `Actualizar ${slot} desde panel admin`,
        tree: tree.sha,
        parents: [head],
      }),
    });

    try {
      await github(config, `/git/refs/heads/${config.branch}`, {
        method: "PATCH",
        body: JSON.stringify({ sha: commit.sha, force: false }),
      });
      return { path: mediaPath, commit: commit.sha };
    } catch (error) {
      if (error instanceof ApiError && error.code === "CONFLICT" && attempt < 3) continue;
      throw error;
    }
  }
  throw new ApiError(409, "CONFLICT", "La rama cambió varias veces; volvé a intentar");
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") {
    if (!isAllowedOrigin(origin)) return response(origin, 403, { ok: false, code: "FORBIDDEN", message: "Origen no permitido" });
    return new Response(null, { status: 204, headers: cors(origin) });
  }
  if (!isAllowedOrigin(origin)) return response(origin, 403, { ok: false, code: "FORBIDDEN", message: "Origen no permitido" });
  if (request.method !== "POST") return response(origin, 405, { ok: false, code: "BAD_REQUEST", message: "Usá POST" });

  try {
    await authenticate(request);
    const form = await request.formData().catch(() => null);
    if (!form) throw new ApiError(400, "BAD_REQUEST", "Solicitud multipart inválida");

    const slot = String(form.get("slot") ?? "").trim();
    const file = form.get("file");
    if (!SLOTS.has(slot)) throw new ApiError(400, "INVALID_SLOT", "Ese espacio no existe");
    if (!(file instanceof File) || file.size === 0) throw new ApiError(400, "BAD_REQUEST", "Falta el archivo");

    const isVideo = VIDEO_SLOTS.has(slot);
    const limit = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (file.size > limit) {
      throw new ApiError(413, "FILE_TOO_LARGE", `El máximo es ${Math.round(limit / 1_000_000)} MB`);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const detected = detectFile(bytes, slot);
    if (isVideo && detected.mime !== "video/mp4") {
      throw new ApiError(415, "INVALID_TYPE", "El hero debe ser MP4");
    }
    if (isVideo) validateMp4(bytes);
    if (!isVideo && !detected.mime.startsWith("image/")) {
      throw new ApiError(415, "INVALID_TYPE", "Este espacio requiere una imagen");
    }

    const hash = await sha256(bytes);
    const published = await publishAtomic(slot, bytes, detected.ext, hash);
    return response(origin, 200, {
      ok: true,
      slot,
      path: published.path,
      url: published.path,
      hash,
      commit: published.commit,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return response(origin, error.status, { ok: false, code: error.code, message: error.message });
    }
    console.error(error instanceof Error ? error.message : "Error desconocido");
    return response(origin, 500, { ok: false, code: "GITHUB_ERROR", message: "No se pudo publicar" });
  }
});

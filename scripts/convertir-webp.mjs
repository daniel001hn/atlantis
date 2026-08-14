import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";

const RAIZ = path.resolve(import.meta.dirname, "..");
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PUERTO = 9333;
const FOTOS = [
  "beach-house", "coffee-corner", "habitacion", "kit-playa", "lancetilla",
  "loft", "masajes", "piscina-atardecer", "planta-electrica", "punta-sal",
  "tienda", "townhouse", "ubicacion-playa"
];

const pausa = ms => new Promise(resolve => setTimeout(resolve, ms));

async function esperarEdge() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PUERTO}/json/version`);
      if (res.ok) return;
    } catch {}
    await pausa(100);
  }
  throw new Error("Edge no abrio el puerto de control");
}

function conectar(url) {
  const ws = new WebSocket(url);
  let secuencia = 0;
  const pendientes = new Map();
  ws.onmessage = ({ data }) => {
    const msg = JSON.parse(data);
    if (!msg.id || !pendientes.has(msg.id)) return;
    const { resolve, reject } = pendientes.get(msg.id);
    pendientes.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
  };
  const listo = new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  return {
    listo,
    enviar(method, params = {}) {
      const id = ++secuencia;
      ws.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => pendientes.set(id, { resolve, reject }));
    },
    cerrar: () => ws.close()
  };
}

const perfil = path.join(process.env.TEMP, `atlantis-edge-webp-${Date.now()}`);
const edge = spawn(EDGE, [
  "--headless=new", "--disable-gpu", "--no-first-run",
  "--allow-file-access-from-files", `--remote-debugging-port=${PUERTO}`,
  `--user-data-dir=${perfil}`, "about:blank"
], { stdio: "ignore", windowsHide: true });

try {
  await esperarEdge();
  for (const nombre of FOTOS) {
    const pagina = await fetch(`http://127.0.0.1:${PUERTO}/json/new?about:blank`, { method: "PUT" }).then(r => r.json());
    const cdp = conectar(pagina.webSocketDebuggerUrl);
    await cdp.listo;
    const paginaLocal = `file:///${path.join(RAIZ, "scripts", "convertir-webp.html").replaceAll("\\", "/")}`;
    await cdp.enviar("Page.navigate", { url: paginaLocal });
    await pausa(300);
    const archivo = `file:///${path.join(RAIZ, "fotos", `${nombre}.png`).replaceAll("\\", "/")}`;
    const expresion = `(async () => {
      const img = new Image();
      img.src = ${JSON.stringify(archivo)};
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);
      return canvas.toDataURL('image/webp', .82);
    })()`;
    const resultado = await cdp.enviar("Runtime.evaluate", {
      expression: expresion, awaitPromise: true, returnByValue: true
    });
    if (resultado.exceptionDetails) {
      throw new Error(`No se pudo convertir ${nombre}: ${resultado.exceptionDetails.text}`);
    }
    const dataUrl = resultado.result.value;
    const bytes = Buffer.from(dataUrl.split(",")[1], "base64");
    await writeFile(path.join(RAIZ, "fotos", `${nombre}.webp`), bytes);
    console.log(`  ${nombre}.webp  ${(bytes.length / 1024).toFixed(0)} KB`);
    cdp.cerrar();
  }
} finally {
  edge.kill();
}

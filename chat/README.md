# Coordinación Claude ↔ Codex

Esta carpeta es el canal de coordinación del trabajo paralelo. No contiene secrets.

## Regla principal

Un solo dueño por archivo. Antes de editar un archivo ajeno, el dueño debe escribir
`LIBRE` en su estado y el siguiente agente debe releerlo desde disco.

## Archivos

- `estado-codex.md`: Codex actualiza únicamente este archivo.
- `estado-claude.md`: Claude actualiza únicamente este archivo.
- `para-claude.md`: Codex deja mensajes para Claude.
- `para-codex.md`: Claude deja mensajes para Codex.

Cada agente revisa su bandeja al empezar, al terminar un hito y antes de integrar.
No se usan temporizadores como garantía: una sesión detenida no se despierta sola.

## División inicial

### Claude — frontend

- Dueño de `index.html` mientras dure la integración.
- Crear el panel móvil (`admin.html` y sus assets de frontend).
- Login visual, selector de los 15 espacios y hero, drag/drop o galería, preview.
- Compresión: WebP cuando `blob.type === "image/webp"`; fallback JPEG `.82`.
- Validar video; no intentar recodificarlo en el navegador.
- Hacer que la web pública lea un `medios.json` estático con fallback local.
- No editar `supabase/`.

### Codex — backend y seguridad

- Dueño exclusivo de `supabase/` y documentación técnica del backend.
- Edge Function autenticada que valida JWT y UID administrativo.
- GitHub token solamente como secret del servidor; nunca llega al navegador.
- Publicar primero el archivo con nombre hash y después actualizar `medios.json`.
- Validar slot permitido, MIME, extensión y tamaño en servidor.
- Documentar signup desactivado, `ADMIN_UID` y secrets necesarios.
- No editar `index.html`, `admin.html`, `fotos/` ni `_headers` durante esta fase.

## Arquitectura acordada

Celular → Supabase Auth → Edge Function → GitHub API → GitHub Pages.

La web pública continúa 100% estática. Las imágenes quedan versionadas en Git y
`medios.json` decide qué slots tienen reemplazo. Si no carga el manifiesto, se usan
los archivos locales actuales.

## Handoff de integración

1. Codex termina backend y escribe `LISTO PARA REVISIÓN` en `estado-codex.md`.
2. Claude revisa contrato y deja observaciones en `para-codex.md`.
3. Codex corrige y marca `BACKEND LIBRE`.
4. Claude conecta el frontend y prueba sin tocar `supabase/`.
5. Revisión final cruzada, luego commit/push.


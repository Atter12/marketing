/**
 * POST /api/videos-pro/process
 *
 * A) multipart/form-data: campo "file" (ideal ≤ ~4 MB — límite de body en Vercel)
 * B) application/json: { "blobUrl", "originalFilename"?, "brief"? } — archivo ya subido a Vercel Blob (hasta 1 GB en token; solo se descargan ≤25 MB para Whisper)
 *
 * Whisper (OpenAI) acepta como máximo ~25 MB por archivo. Si el blob pesa más, devolvemos error claro.
 *
 * Env: OPENAI_API_KEY, ANTHROPIC_API_KEY (opcional), BLOB_READ_WRITE_TOKEN (opcional, para borrar blob tras procesar)
 */

import formidable from "formidable";
import { readFile, unlink } from "node:fs/promises";
import { basename } from "node:path";
import { del, head } from "@vercel/blob";

const LOG = "[videos-pro/process]";
const DIRECT_UPLOAD_MAX = 4 * 1024 * 1024; // body seguro bajo límite típico de Vercel (~4.5 MB)
const BLOB_DOWNLOAD_MAX = 1024 * 1024 * 1024; // lo que autoriza el supervisor en almacenamiento
const WHISPER_MAX_BYTES = 25 * 1024 * 1024; // límite API OpenAI Whisper

const OPENAI_TRANSCRIBE = "https://api.openai.com/v1/audio/transcriptions";
const OPENAI_CHAT = "https://api.openai.com/v1/chat/completions";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const WHISPER_MODEL = "whisper-1";
const OPENAI_SCRIPT_MODEL = "gpt-4o-mini";
const DEFAULT_CLAUDE_MODEL = "claude-haiku-4-5";

const WHISPER_FILENAME_EXT = new Set([
  "flac",
  "mp3",
  "mp4",
  "mpeg",
  "mpga",
  "m4a",
  "ogg",
  "wav",
  "webm",
]);

function stripJsonFence(s) {
  let t = String(s || "").trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/m, "");
  }
  return t.trim();
}

function extFromName(name) {
  const base = basename(String(name || ""));
  const i = base.lastIndexOf(".");
  if (i === -1) return "";
  return base.slice(i + 1).toLowerCase();
}

function isAllowedBlobUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    if (u.protocol !== "https:") return false;
    const h = u.hostname.toLowerCase();
    return h.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  return JSON.parse(raw);
}

async function fetchBlobBuffer(blobUrl, maxBytes) {
  const r = await fetch(blobUrl, { redirect: "follow" });
  if (!r.ok) {
    throw new Error(`No se pudo descargar el archivo desde Blob (${r.status}).`);
  }
  const len = r.headers.get("content-length");
  if (len && Number(len) > maxBytes) {
    throw new Error(
      `El archivo pesa más de ${Math.round(maxBytes / (1024 * 1024))} MB. Para transcripción con Whisper hay que quedar bajo 25 MB (exportá solo audio comprimido o acortá el clip).`,
    );
  }
  if (len && Number(len) <= maxBytes) {
    return Buffer.from(await r.arrayBuffer());
  }
  const reader = r.body?.getReader();
  if (!reader) {
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > maxBytes) {
      throw new Error(
        "El archivo supera 25 MB (límite de Whisper por petición). Comprimí el audio o acortá el clip.",
      );
    }
    return buf;
  }
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      try {
        await reader.cancel();
      } catch {
        /* ignore */
      }
      throw new Error(
        "El archivo supera 25 MB (límite de Whisper por petición). Comprimí el audio o acortá el clip.",
      );
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

function buildVariationPrompt(transcript, brief) {
  const extra = String(brief || "").trim();
  return `Actuás como director creativo de performance y UGC para ecommerce en español (Latam / Perú cuando aplique).

TRANSCRIPCIÓN del video (voz a texto con Whisper; puede tener errores menores de puntuación):
"""
${transcript}
"""
${extra ? `\nContexto o brief del equipo (úsalo si aporta; no inventes datos):\n${extra}\n` : ""}

TAREA:
1) Entendé la idea central del guion (gancho, problema, beneficio, prueba social, CTA).
2) Generá EXACTAMENTE 3 VARIACIONES del guion principal. Cada variación debe ser un guion hablado completo, listo para grabar, en español.
3) Las tres deben mantener la MISMA intención comercial pero cambiar estructura, ganchos, orden de argumentos o estilo (ej. más directo, más historia, más comparativo) sin contradecir hechos que aparecen en la transcripción.

Respondé ÚNICAMENTE con un JSON válido (sin markdown, sin texto antes ni después) con esta forma exacta:
{"variations":[{"title":"Título corto de la variación 1","script":"texto completo del guion 1"},{"title":"...","script":"..."},{"title":"...","script":"..."}]}`;
}

async function transcribeWhisper(buffer, originalFilename, mimeType, openaiKey) {
  const ext = extFromName(originalFilename) || "mp4";
  const safeName = WHISPER_FILENAME_EXT.has(ext) ? `upload.${ext}` : "upload.mp4";

  const fd = new FormData();
  fd.append("file", new Blob([buffer], { type: mimeType || "application/octet-stream" }), safeName);
  fd.append("model", WHISPER_MODEL);
  fd.append("language", "es");

  const r = await fetch(OPENAI_TRANSCRIBE, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiKey}`,
    },
    body: fd,
  });

  const raw = await r.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    data = {};
  }

  if (!r.ok) {
    const msg = data.error?.message || raw.slice(0, 400) || r.statusText;
    throw new Error(msg || "Error en Whisper");
  }

  const text = String(data.text || "").trim();
  if (!text) {
    throw new Error("Whisper no devolvió texto. Probá otro archivo o revisá que tenga audio.");
  }
  return text;
}

async function variationsWithClaude(prompt, anthropicKey, model) {
  const response = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      system:
        "Respondés solo con JSON válido según el formato pedido. Sin markdown. Los guiones en español natural para voz en off o UGC.",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const raw = await response.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    data = {};
  }

  if (!response.ok) {
    const msg = data.error?.message || raw.slice(0, 300) || response.statusText;
    throw new Error(msg || "Error al llamar a Claude");
  }

  const text = data.content?.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("Respuesta vacía de Claude.");
  return stripJsonFence(text);
}

async function variationsWithOpenAI(prompt, openaiKey) {
  const response = await fetch(OPENAI_CHAT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_SCRIPT_MODEL,
      messages: [
        {
          role: "system",
          content:
            "Respondés solo con JSON válido según el formato pedido. Sin markdown. Guiones en español para voz en off o UGC.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 8192,
      temperature: 0.85,
    }),
  });

  const raw = await response.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    data = {};
  }

  if (!response.ok) {
    const msg = data.error?.message || raw.slice(0, 300) || response.statusText;
    throw new Error(msg || "Error al generar guiones con OpenAI");
  }

  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Respuesta vacía de OpenAI.");
  return stripJsonFence(text);
}

function parseVariationsJson(jsonStr) {
  const parsed = JSON.parse(jsonStr);
  const vars = parsed.variations;
  if (!Array.isArray(vars)) {
    throw new Error('La IA no devolvió "variations" como lista.');
  }
  const cleaned = vars
    .slice(0, 5)
    .map((v, i) => ({
      title: String(v.title || `Variación ${i + 1}`).trim(),
      script: String(v.script || "").trim(),
    }))
    .filter((v) => v.script.length > 0);

  if (cleaned.length < 3) {
    throw new Error("Se esperaban 3 guiones completos; la respuesta vino incompleta.");
  }
  return cleaned.slice(0, 3);
}

async function runPipeline(buffer, originalFilename, mimeType, brief, openaiKey) {
  const transcript = await transcribeWhisper(buffer, originalFilename, mimeType, openaiKey);
  const prompt = buildVariationPrompt(transcript, brief);

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const claudeModel = (process.env.ANTHROPIC_MODEL || DEFAULT_CLAUDE_MODEL).trim();
  let jsonRaw;
  if (anthropicKey) {
    console.log(LOG, "variations: Claude", claudeModel);
    jsonRaw = await variationsWithClaude(prompt, anthropicKey, claudeModel);
  } else {
    console.log(LOG, "variations: OpenAI fallback (sin ANTHROPIC_API_KEY)");
    jsonRaw = await variationsWithOpenAI(prompt, openaiKey);
  }

  let variations;
  try {
    variations = parseVariationsJson(jsonRaw);
  } catch (parseErr) {
    console.error(LOG, "JSON guiones", parseErr?.message, jsonRaw?.slice?.(0, 500));
    const err = new Error(
      parseErr?.message || "No se pudo interpretar la respuesta de la IA. Probá de nuevo.",
    );
    err.transcript = transcript;
    throw err;
  }

  return { transcript, variations };
}

export default async function handler(req, res) {
  res.setHeader("x-videos-pro-endpoint", "process");

  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      message:
        "POST multipart (file ≤ ~4 MB) o POST JSON { blobUrl } tras subir a Vercel Blob (hasta 1 GB en almacenamiento; Whisper usa hasta 25 MB por petición).",
      directUploadMaxBytes: DIRECT_UPLOAD_MAX,
      whisperMaxBytes: WHISPER_MAX_BYTES,
      blobMaxBytes: BLOB_DOWNLOAD_MAX,
      openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
      anthropicConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
      blobTokenConfigured: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Método no permitido" });
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return res.status(503).json({
      success: false,
      error: "OPENAI_API_KEY no configurada (necesaria para Whisper).",
    });
  }

  const ct = String(req.headers["content-type"] || "").toLowerCase();
  let buffer;
  let originalFilename = "video.mp4";
  let mimeType = "";
  let brief = "";
  let blobUrlToDelete = null;

  try {
    if (ct.includes("application/json")) {
      const body = await readJsonBody(req);
      const blobUrl = String(body.blobUrl || "").trim();
      brief = String(body.brief || "").trim();
      originalFilename = String(body.originalFilename || "video.mp4").trim() || "video.mp4";

      if (!blobUrl) {
        return res.status(400).json({ success: false, error: 'Falta "blobUrl" en el JSON.' });
      }
      if (!isAllowedBlobUrl(blobUrl)) {
        return res.status(400).json({
          success: false,
          error: "URL de Blob no permitida (solo almacenamiento Vercel Blob público).",
        });
      }

      const rw = process.env.BLOB_READ_WRITE_TOKEN;
      if (rw) {
        try {
          const meta = await head(blobUrl, { token: rw });
          if (meta.size > BLOB_DOWNLOAD_MAX) {
            return res.status(413).json({
              success: false,
              error: `El archivo supera 1 GB (${meta.size} bytes). Pedile al equipo que lo comprima.`,
            });
          }
          if (meta.size > WHISPER_MAX_BYTES) {
            return res.status(413).json({
              success: false,
              error:
                "Este archivo pesa más de 25 MB. La API de Whisper solo acepta hasta 25 MB por transcripción. Exportá solo el audio (mp3 más liviano) o un clip más corto y volvé a subir.",
            });
          }
        } catch (hErr) {
          console.warn(LOG, "head blob", hErr?.message || hErr);
        }
      }

      buffer = await fetchBlobBuffer(blobUrl, WHISPER_MAX_BYTES);
      blobUrlToDelete = blobUrl;
      mimeType = "";
    } else if (ct.includes("multipart/form-data")) {
      const form = formidable({
        maxFileSize: DIRECT_UPLOAD_MAX,
        maxFiles: 1,
        allowEmptyFiles: false,
      });

      let fields;
      let files;
      try {
        [fields, files] = await form.parse(req);
      } catch (e) {
        const msg = e?.message || String(e);
        const code = e?.httpCode || e?.statusCode;
        console.error(LOG, "formidable", msg);
        if (code === 413 || /maxFileSize|max.*size/i.test(msg)) {
          return res.status(413).json({
            success: false,
            error:
              "Archivo mayor al límite de subida directa (~4 MB). Volvé a intentar: el navegador debería subirlo por Vercel Blob automáticamente. Si sigue fallando, falta BLOB_READ_WRITE_TOKEN en Vercel.",
            hint: "large_file_use_blob",
          });
        }
        return res.status(400).json({ success: false, error: msg || "No se pudo leer el formulario." });
      }

      const fileList = files.file;
      const uploaded = Array.isArray(fileList) ? fileList[0] : fileList;
      if (!uploaded?.filepath) {
        return res.status(400).json({
          success: false,
          error: 'Falta el archivo en el campo "file".',
        });
      }

      try {
        buffer = await readFile(uploaded.filepath);
      } finally {
        try {
          await unlink(uploaded.filepath);
        } catch {
          /* ignore */
        }
      }

      originalFilename = uploaded.originalFilename || "video.mp4";
      mimeType = uploaded.mimetype || "";

      const briefRaw = fields.brief;
      brief = String(Array.isArray(briefRaw) ? briefRaw[0] : briefRaw || "").trim();
    } else {
      return res.status(415).json({
        success: false,
        error: "Usá multipart/form-data (archivo chico) o application/json con blobUrl (archivo grande).",
      });
    }

    console.log(LOG, "process", {
      mode: blobUrlToDelete ? "blob" : "multipart",
      name: originalFilename,
      bytes: buffer.length,
    });

    let result;
    try {
      result = await runPipeline(buffer, originalFilename, mimeType, brief, openaiKey);
    } catch (pipeErr) {
      if (pipeErr.transcript) {
        const rwDel = process.env.BLOB_READ_WRITE_TOKEN;
        if (blobUrlToDelete && rwDel) {
          try {
            await del(blobUrlToDelete, { token: rwDel });
          } catch {
            /* ignore */
          }
        }
        return res.status(502).json({
          success: false,
          error: pipeErr.message,
          transcript: pipeErr.transcript,
        });
      }
      throw pipeErr;
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const claudeModel = (process.env.ANTHROPIC_MODEL || DEFAULT_CLAUDE_MODEL).trim();

    const json = {
      success: true,
      transcript: result.transcript,
      variations: result.variations,
      models: {
        whisper: WHISPER_MODEL,
        scripts: anthropicKey ? `anthropic:${claudeModel}` : `openai:${OPENAI_SCRIPT_MODEL}`,
      },
    };

    if (blobUrlToDelete && process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        await del(blobUrlToDelete, { token: process.env.BLOB_READ_WRITE_TOKEN });
        console.log(LOG, "blob deleted");
      } catch (delErr) {
        console.warn(LOG, "no se pudo borrar blob", delErr?.message || delErr);
      }
    }

    return res.status(200).json(json);
  } catch (err) {
    console.error(LOG, err);
    const rw = process.env.BLOB_READ_WRITE_TOKEN;
    if (blobUrlToDelete && rw) {
      try {
        await del(blobUrlToDelete, { token: rw });
        console.log(LOG, "blob borrado tras error");
      } catch (delErr) {
        console.warn(LOG, "del tras error", delErr?.message || delErr);
      }
    }
    return res.status(500).json({
      success: false,
      error: err?.message || "Error al procesar el archivo",
    });
  }
}

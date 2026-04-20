/**
 * POST /api/videos-pro/process
 * multipart/form-data: campo "file" (audio o video, máx. ~4 MB por límite de Vercel)
 * opcional: campo "brief" (texto con marca, tono, producto)
 *
 * Usa OpenAI Whisper (transcripción) + Anthropic Claude (3 variaciones de guion).
 * Si no hay ANTHROPIC_API_KEY, las variaciones usan GPT-4o-mini.
 *
 * Env: OPENAI_API_KEY, ANTHROPIC_API_KEY (opcional si solo fallback OpenAI para guiones)
 */

import formidable from "formidable";
import { readFile, unlink } from "node:fs/promises";
import { basename } from "node:path";

const LOG = "[videos-pro/process]";
const MAX_BYTES = 4 * 1024 * 1024; // margen bajo el límite típico de body en Vercel (~4.5 MB)

const OPENAI_TRANSCRIBE = "https://api.openai.com/v1/audio/transcriptions";
const OPENAI_CHAT = "https://api.openai.com/v1/chat/completions";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const WHISPER_MODEL = "whisper-1";
const OPENAI_SCRIPT_MODEL = "gpt-4o-mini";
const DEFAULT_CLAUDE_MODEL = "claude-haiku-4-5";

/** Extensiones con las que OpenAI acepta el nombre de archivo en transcriptions */
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

export default async function handler(req, res) {
  res.setHeader("x-videos-pro-endpoint", "process");

  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      message:
        "POST multipart: campo file (audio/video ≤ 4 MB). Whisper (OpenAI) + 3 guiones (Claude o GPT fallback).",
      openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
      anthropicConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
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

  const form = formidable({
    maxFileSize: MAX_BYTES,
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
          "Archivo demasiado grande. Máximo ~4 MB en este servidor (límite de Vercel). Exportá solo el audio en mp3 más liviano o un clip más corto.",
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

  let buffer;
  try {
    buffer = await readFile(uploaded.filepath);
  } finally {
    try {
      await unlink(uploaded.filepath);
    } catch {
      /* ignore */
    }
  }

  const originalFilename = uploaded.originalFilename || "video.mp4";
  const mimeType = uploaded.mimetype || "";

  const briefRaw = fields.brief;
  const brief = Array.isArray(briefRaw) ? briefRaw[0] : briefRaw;

  console.log(LOG, "upload", {
    name: originalFilename,
    bytes: buffer.length,
    mime: mimeType,
  });

  try {
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
      return res.status(502).json({
        success: false,
        error:
          parseErr?.message ||
          "No se pudo interpretar la respuesta de la IA. Probá de nuevo.",
        transcript,
      });
    }

    return res.status(200).json({
      success: true,
      transcript,
      variations,
      models: {
        whisper: WHISPER_MODEL,
        scripts: anthropicKey ? `anthropic:${claudeModel}` : `openai:${OPENAI_SCRIPT_MODEL}`,
      },
    });
  } catch (err) {
    console.error(LOG, err);
    return res.status(500).json({
      success: false,
      error: err?.message || "Error al procesar el archivo",
    });
  }
}

/**
 * POST /api/videos-pro/blob-upload
 * Handshake para client uploads de @vercel/blob (archivos > ~4.5 MB del body de Vercel).
 *
 * Env: BLOB_READ_WRITE_TOKEN (Vercel Blob → Read/Write token en el proyecto)
 */

import { handleUpload } from "@vercel/blob/client";

const LOG = "[videos-pro/blob-upload]";
const ONE_GB = 1024 * 1024 * 1024;

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

export default async function handler(req, res) {
  res.setHeader("x-videos-pro-endpoint", "blob-upload");

  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      message: "POST JSON (eventos internos de @vercel/blob). Requiere BLOB_READ_WRITE_TOKEN.",
      blobConfigured: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return res.status(503).json({
      error:
        "Falta BLOB_READ_WRITE_TOKEN en Vercel (Storage → Blob → conectar al proyecto). Necesario para subir archivos mayores a ~4 MB.",
    });
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (e) {
    console.error(LOG, "JSON inválido", e);
    return res.status(400).json({ error: "Cuerpo JSON inválido" });
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      token,
      onBeforeGenerateToken: async (pathname, _clientPayload, multipart) => {
        console.log(LOG, "token", { pathname, multipart });
        return {
          allowedContentTypes: [
            "video/mp4",
            "video/webm",
            "video/quicktime",
            "audio/mpeg",
            "audio/mp3",
            "audio/mp4",
            "audio/wav",
            "audio/webm",
            "audio/x-m4a",
            "audio/x-wav",
            "application/octet-stream",
          ],
          maximumSizeInBytes: ONE_GB,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async ({ blob }) => {
        console.log(LOG, "upload ok", blob?.url);
      },
    });

    return res.status(200).json(jsonResponse);
  } catch (e) {
    console.error(LOG, e);
    return res.status(400).json({ error: e?.message || "Error en handleUpload" });
  }
}

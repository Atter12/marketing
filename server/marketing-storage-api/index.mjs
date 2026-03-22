/**
 * Almacén de archivos en disco (Creativos / Tareas / avatares gerente).
 *
 * Variables de entorno:
 *   PORT                    (default 3847)
 *   STORAGE_ROOT            ej. /root/marketing-storage
 *   SUPABASE_URL
 *   SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY   solo para validar JWT (getUser)
 *   SIGNING_SECRET          secreto largo para URLs firmadas de lectura
 *   CORS_ORIGINS            opcional, separado por coma; vacío = permite cualquier origin
 */
import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT || 3847);
const STORAGE_ROOT = path.resolve(process.env.STORAGE_ROOT || path.join(os.homedir(), 'marketing-storage'));
const SIGNING_SECRET = process.env.SIGNING_SECRET || '';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const ALLOWED_BUCKETS = new Set(['creativos_entregables', 'tareas_adjuntos', 'avatars']);
const PRIVATE_BUCKETS = new Set(['creativos_entregables', 'tareas_adjuntos']);

const TMP_UPLOAD = path.join(os.tmpdir(), 'marketing-storage-api-upload');
fs.mkdirSync(TMP_UPLOAD, { recursive: true });

function corsOrigin() {
  const raw = (process.env.CORS_ORIGINS || '').trim();
  if (!raw) return true;
  const set = new Set(raw.split(',').map((s) => s.trim()).filter(Boolean));
  return (origin, cb) => {
    if (!origin) return cb(null, true);
    if (set.has(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  };
}

function extractBearer(req) {
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : null;
}

function resolveSafePath(bucket, relPath) {
  if (!ALLOWED_BUCKETS.has(bucket)) return null;
  const norm = path.normalize(String(relPath || '')).replace(/^(\.\.(\/|\\|$))+/, '');
  if (!norm || norm.includes('..') || norm.startsWith(path.sep)) return null;
  const root = path.resolve(STORAGE_ROOT, bucket);
  const full = path.resolve(root, norm);
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (full !== root && !full.startsWith(rootWithSep)) return null;
  return full;
}

function signRead(bucket, relPath, expSec) {
  const msg = `${bucket}\n${relPath}\n${expSec}`;
  return crypto.createHmac('sha256', SIGNING_SECRET).update(msg).digest('base64url');
}

function verifyRead(bucket, relPath, expSec, sig) {
  if (!SIGNING_SECRET || !sig || !expSec) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Number(expSec) < now) return false;
  const expected = signRead(bucket, relPath, expSec);
  try {
    const a = Buffer.from(String(sig), 'base64url');
    const b = Buffer.from(expected, 'base64url');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

async function assertGerente(req, res) {
  const jwt = extractBearer(req);
  if (!jwt) {
    res.status(401).json({ error: 'missing_authorization' });
    return null;
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    res.status(500).json({ error: 'server_misconfigured_supabase' });
    return null;
  }
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: userData, error: e1 } = await admin.auth.getUser(jwt);
  if (e1 || !userData?.user) {
    res.status(401).json({ error: 'invalid_token' });
    return null;
  }
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: isG, error: e2 } = await userClient.rpc('is_gerente');
  if (e2 || !isG) {
    res.status(403).json({ error: 'not_gerente' });
    return null;
  }
  return userData.user;
}

const upload = multer({
  dest: TMP_UPLOAD,
  limits: { fileSize: 600 * 1024 * 1024 },
});

const app = express();
app.set('trust proxy', 1);
app.use(cors({ origin: corsOrigin(), allowedHeaders: ['Authorization', 'Content-Type'] }));
app.use('/v1/public/avatars', express.static(path.join(STORAGE_ROOT, 'avatars')));

app.post('/v1/upload', upload.single('file'), async (req, res) => {
  const cleanupTmp = () => {
    if (req.file?.path) fs.unlink(req.file.path, () => {});
  };
  try {
    const user = await assertGerente(req, res);
    if (!user) {
      cleanupTmp();
      return;
    }
    const bucket = String(req.body.bucket || '');
    const relPath = String(req.body.path || '');
    if (!ALLOWED_BUCKETS.has(bucket) || !relPath) {
      cleanupTmp();
      return res.status(400).json({ error: 'invalid_bucket_or_path' });
    }
    const dest = resolveSafePath(bucket, relPath);
    if (!dest || !req.file) {
      cleanupTmp();
      return res.status(400).json({ error: 'invalid_path' });
    }
    await fs.promises.mkdir(path.dirname(dest), { recursive: true });
    await fs.promises.rename(req.file.path, dest);
    res.json({ ok: true });
  } catch (e) {
    console.error('[upload]', e);
    cleanupTmp();
    res.status(500).json({ error: 'upload_failed' });
  }
});

app.post('/v1/delete-objects', express.json({ limit: '2mb' }), async (req, res) => {
  const user = await assertGerente(req, res);
  if (!user) return;
  const bucket = String(req.body.bucket || '');
  const paths = req.body.paths;
  if (!ALLOWED_BUCKETS.has(bucket) || !Array.isArray(paths)) {
    return res.status(400).json({ error: 'invalid_body' });
  }
  for (const p of paths) {
    const full = resolveSafePath(bucket, p);
    if (!full) continue;
    try {
      await fs.promises.unlink(full);
    } catch {}
  }
  res.json({ ok: true });
});

app.post('/v1/sign-read', express.json({ limit: '64kb' }), async (req, res) => {
  const user = await assertGerente(req, res);
  if (!user) return;
  if (!SIGNING_SECRET) {
    return res.status(500).json({ error: 'missing_SIGNING_SECRET' });
  }
  const bucket = String(req.body.bucket || '');
  const relPath = String(req.body.path || '');
  const ttl = Math.min(Math.max(Number(req.body.ttlSeconds) || 3600, 60), 86400);
  if (!PRIVATE_BUCKETS.has(bucket) || !relPath) {
    return res.status(400).json({ error: 'invalid_bucket_or_path' });
  }
  const full = resolveSafePath(bucket, relPath);
  if (!full) {
    return res.status(400).json({ error: 'invalid_path' });
  }
  try {
    await fs.promises.access(full, fs.constants.R_OK);
  } catch {
    return res.status(404).json({ error: 'not_found' });
  }
  const exp = Math.floor(Date.now() / 1000) + ttl;
  const sig = signRead(bucket, relPath, exp);
  const base = `${req.protocol}://${req.get('host')}`;
  const q = new URLSearchParams({
    bucket,
    path: relPath,
    exp: String(exp),
    sig,
  });
  res.json({ url: `${base}/v1/raw?${q.toString()}` });
});

app.get('/v1/raw', async (req, res) => {
  const bucket = String(req.query.bucket || '');
  const relPath = String(req.query.path || '');
  const exp = String(req.query.exp || '');
  const sig = String(req.query.sig || '');
  if (!PRIVATE_BUCKETS.has(bucket) || !relPath || !verifyRead(bucket, relPath, exp, sig)) {
    return res.status(403).end();
  }
  const full = resolveSafePath(bucket, relPath);
  if (!full) return res.status(400).end();
  try {
    const st = await fs.promises.stat(full);
    if (!st.isFile()) return res.status(404).end();
  } catch {
    return res.status(404).end();
  }
  res.sendFile(full);
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, storageRoot: STORAGE_ROOT });
});

app.use((err, _req, res, next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'file_too_large' });
  }
  next(err);
});

if (!SIGNING_SECRET || SIGNING_SECRET.length < 16) {
  console.warn('[marketing-storage-api] SIGNING_SECRET ausente o corto: /v1/sign-read y /v1/raw no funcionarán bien.');
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[marketing-storage-api] listening :${PORT} root=${STORAGE_ROOT}`);
});

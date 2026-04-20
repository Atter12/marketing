/**
 * Videos Pro — transcripción (Whisper) + 3 guiones (Claude o GPT).
 */

const API = "/api/videos-pro/process";
const BLOB_HANDSHAKE = "/api/videos-pro/blob-upload";
/** Subida directa al serverless: ~4 MB (límite Vercel). Más grande → Vercel Blob. */
const DIRECT_UPLOAD_MAX = 4 * 1024 * 1024;
/** Token de subida en Blob (supervisor). */
const BLOB_UPLOAD_MAX = 1024 * 1024 * 1024;
/** OpenAI Whisper por petición. */
const WHISPER_MAX = 25 * 1024 * 1024;
const BLOB_CLIENT_ESM = "https://esm.sh/@vercel/blob@0.27.3/client";

const PHASES = ["upload", "whisper", "scripts"];
const PHASE_LABEL = {
  upload: "Subiendo archivo…",
  whisper: "Transcribiendo con <strong>Whisper</strong>…",
  scripts: "Generando <strong>3 variaciones</strong> del guion…",
};

let lastResult = null;
let selectedFile = null;

function $(sel, root = document) {
  return root.querySelector(sel);
}
function $all(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function slugify(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
}

function renderError(msg) {
  const el = $("#err");
  $("#err-text").textContent = msg;
  el.classList.remove("hidden");
}

function clearError() {
  const el = $("#err");
  $("#err-text").textContent = "";
  el.classList.add("hidden");
}

function setBusy(busy, phase) {
  const btn = $("#btn-run");
  const status = $("#status");
  const prog = $("#progress");

  btn.disabled = busy;
  if (busy) {
    btn.innerHTML = '<span class="spinner"></span> Procesando…';
  } else {
    btn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i> Transcribir y generar 3 guiones';
  }

  if (!busy) {
    status.classList.add("hidden");
    prog.classList.add("hidden");
    $all(".pstep", prog).forEach((el) => el.classList.remove("active", "done"));
    return;
  }

  status.classList.remove("hidden");
  status.innerHTML = `<span class="spinner"></span> <span>${PHASE_LABEL[phase] || "Procesando…"}</span>`;

  prog.classList.remove("hidden");
  const idx = PHASES.indexOf(phase);
  $all(".pstep", prog).forEach((el, i) => {
    el.classList.remove("active", "done");
    if (i < idx) el.classList.add("done");
    if (i === idx) el.classList.add("active");
  });
}

function completeProgress() {
  const prog = $("#progress");
  $all(".pstep", prog).forEach((el) => {
    el.classList.remove("active");
    el.classList.add("done");
  });
  setTimeout(() => {
    prog.classList.add("hidden");
    $("#status").classList.add("hidden");
    $all(".pstep", prog).forEach((el) => el.classList.remove("done"));
  }, 1200);
}

function renderResults(data) {
  lastResult = data;
  $("#results-empty").classList.add("hidden");
  $("#out-wrap").classList.remove("hidden");

  $("#transcript").textContent = data.transcript || "";

  const grid = $("#var-grid");
  grid.innerHTML = "";
  (data.variations || []).forEach((v, i) => {
    const card = document.createElement("article");
    card.className = "var-card";
    card.innerHTML = `
      <div class="vhead">
        <span class="vtag"><span class="vn">${i + 1}</span> Variación ${i + 1}</span>
        <span style="font-size:11px;color:var(--text-light)">${v.script.length.toLocaleString("es")} caracteres</span>
      </div>
      <h4>${escapeHtml(v.title || `Variación ${i + 1}`)}</h4>
      <pre>${escapeHtml(v.script)}</pre>
      <div class="mini-actions">
        <button type="button" class="btn btn-ghost btn-sm btn-copy-var" data-i="${i}">
          <i class="far fa-copy"></i> Copiar
        </button>
        <button type="button" class="btn btn-outline btn-sm btn-dl-var" data-i="${i}">
          <i class="fas fa-download"></i> .txt
        </button>
      </div>
    `;
    grid.appendChild(card);
  });

  grid.querySelectorAll(".btn-copy-var").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const i = Number(btn.getAttribute("data-i"));
      const script = data.variations[i]?.script || "";
      try {
        await navigator.clipboard.writeText(script);
        const prev = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i> Copiado';
        setTimeout(() => {
          btn.innerHTML = prev;
        }, 1600);
      } catch {
        renderError("No se pudo copiar al portapapeles.");
      }
    });
  });

  grid.querySelectorAll(".btn-dl-var").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = Number(btn.getAttribute("data-i"));
      const v = data.variations[i];
      const slug = slugify(v?.title || "").slice(0, 40) || `variacion-${i + 1}`;
      downloadText(`guion-${i + 1}-${slug}.txt`, v?.script || "");
    });
  });

  const meta = $("#meta");
  if (data.models) {
    meta.textContent = `Modelos usados · ${data.models.whisper} + ${data.models.scripts}`;
    meta.classList.remove("hidden");
  } else {
    meta.classList.add("hidden");
  }

  $("#results-card").scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetResults() {
  lastResult = null;
  $("#out-wrap").classList.add("hidden");
  $("#results-empty").classList.remove("hidden");
  $("#meta").classList.add("hidden");
  $("#var-grid").innerHTML = "";
  $("#transcript").textContent = "";
}

function setFile(f) {
  const input = $("#file");
  const drop = $("#drop");
  const picked = $("#picked");

  if (!f) {
    selectedFile = null;
    drop.classList.remove("has-file");
    picked.classList.add("hidden");
    picked.innerHTML = "";
    return;
  }

  if (f.size > BLOB_UPLOAD_MAX) {
    renderError(`El archivo pesa ${formatBytes(f.size)}. Máximo 1 GB en esta herramienta.`);
    input.value = "";
    return;
  }

  clearError();
  selectedFile = f;
  drop.classList.add("has-file");
  picked.classList.remove("hidden");
  picked.className = "file-chip";
  picked.innerHTML = `
    <i class="fas fa-circle-check"></i>
    <span class="fname" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span>
    <span class="fsize">· ${formatBytes(f.size)}</span>
  `;
}

async function blobTokenConfigured() {
  try {
    const r = await fetch(BLOB_HANDSHAKE, { method: "GET" });
    const j = await r.json().catch(() => ({}));
    return Boolean(j.blobConfigured);
  } catch {
    return false;
  }
}

async function uploadToBlob(file) {
  const { upload } = await import(/* webpackIgnore: true */ BLOB_CLIENT_ESM);
  const safe = String(file.name || "video.mp4")
    .replace(/[^\w.-]+/g, "_")
    .slice(0, 120);
  const pathname = `videos-pro/${Date.now()}-${safe}`;
  return upload(pathname, file, {
    access: "public",
    handleUploadUrl: `${window.location.origin}${BLOB_HANDSHAKE}`,
    multipart: file.size > 8 * 1024 * 1024,
  });
}

function init() {
  const input = $("#file");
  const drop = $("#drop");

  drop.addEventListener("click", (e) => {
    if (e.target.closest("#picked")) return;
    input.click();
  });
  drop.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      input.click();
    }
  });
  input.addEventListener("change", () => {
    const f = input.files?.[0];
    if (f) setFile(f);
  });

  ["dragenter", "dragover"].forEach((ev) => {
    drop.addEventListener(ev, (e) => {
      e.preventDefault();
      e.stopPropagation();
      drop.classList.add("drag");
    });
  });
  ["dragleave", "drop"].forEach((ev) => {
    drop.addEventListener(ev, (e) => {
      e.preventDefault();
      e.stopPropagation();
      drop.classList.remove("drag");
    });
  });
  drop.addEventListener("drop", (e) => {
    const f = e.dataTransfer?.files?.[0];
    if (f) {
      input.value = "";
      setFile(f);
    }
  });

  $("#btn-run").addEventListener("click", async () => {
    clearError();
    if (!selectedFile) {
      renderError("Elegí un archivo de audio o video primero.");
      return;
    }

    if (selectedFile.size > WHISPER_MAX) {
      renderError(
        `Este archivo pesa ${formatBytes(selectedFile.size)}. La API de Whisper solo transcribe hasta ${formatBytes(WHISPER_MAX)} por petición. Exportá solo el audio (mp3 más liviano) o un clip más corto.`,
      );
      return;
    }

    const brief = $("#brief").value.trim();
    resetResults();
    setBusy(true, "upload");

    try {
      let res;
      if (selectedFile.size <= DIRECT_UPLOAD_MAX) {
        const fd = new FormData();
        fd.append("file", selectedFile, selectedFile.name);
        if (brief) fd.append("brief", brief);
        setTimeout(() => setBusy(true, "whisper"), 300);
        res = await fetch(API, { method: "POST", body: fd });
      } else {
        const hasBlob = await blobTokenConfigured();
        if (!hasBlob) {
          renderError(
            "Para archivos mayores a ~4 MB falta configurar Vercel Blob: en el proyecto de Vercel → Storage → Blob → crear almacén y pegar BLOB_READ_WRITE_TOKEN en Environment Variables (Production). Después redeploy.",
          );
          setBusy(false);
          return;
        }
        $("#status").innerHTML =
          '<span class="spinner"></span> <span>Subiendo a <strong>almacenamiento</strong> (puede tardar en archivos grandes)…</span>';
        const putResult = await uploadToBlob(selectedFile);
        setBusy(true, "whisper");
        res = await fetch(API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            blobUrl: putResult.url,
            originalFilename: selectedFile.name,
            brief: brief || undefined,
          }),
        });
      }

      setBusy(true, "scripts");

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.success) {
        const msg = json.error || res.statusText || "Error desconocido";
        renderError(msg);
        setBusy(false);
        return;
      }

      completeProgress();
      setTimeout(() => setBusy(false), 800);
      renderResults(json);
    } catch (e) {
      console.error(e);
      renderError(
        e?.message ||
          "Error de red o de subida. Si usás archivo grande, verificá BLOB_READ_WRITE_TOKEN y el almacén de Blob en Vercel.",
      );
      setBusy(false);
    }
  });

  $("#btn-dl-all").addEventListener("click", () => {
    if (!lastResult) return;
    let text = "=== TRANSCRIPCIÓN (Whisper) ===\n\n";
    text += lastResult.transcript + "\n\n";
    text += "=== TRES VARIACIONES DEL GUION ===\n\n";
    (lastResult.variations || []).forEach((v, i) => {
      text += `--- Variación ${i + 1}: ${v.title || ""} ---\n\n`;
      text += (v.script || "") + "\n\n";
    });
    if (lastResult.models) {
      text += `Modelos: ${lastResult.models.whisper} + ${lastResult.models.scripts}\n`;
    }
    downloadText("videos-pro-guiones.txt", text.trim());
  });

  $("#btn-copy-transcript").addEventListener("click", async () => {
    if (!lastResult?.transcript) return;
    try {
      await navigator.clipboard.writeText(lastResult.transcript);
      const btn = $("#btn-copy-transcript");
      const prev = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-check"></i> Copiado';
      setTimeout(() => {
        btn.innerHTML = prev;
      }, 1600);
    } catch {
      renderError("No se pudo copiar la transcripción.");
    }
  });

  $("#btn-reset").addEventListener("click", () => {
    resetResults();
    setFile(null);
    $("#file").value = "";
    $("#brief").value = "";
    clearError();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

init();

(function () {
  const b = document.querySelector(".top-banner");
  if (!b) return;
  const th = 40;
  let tick = false;
  function up() {
    const s = window.scrollY || document.documentElement.scrollTop;
    b.classList.toggle("is-scrolled", s > th);
    tick = false;
  }
  window.addEventListener(
    "scroll",
    () => {
      if (!tick) {
        requestAnimationFrame(up);
        tick = true;
      }
    },
    { passive: true },
  );
  up();
})();

/**
 * Videos Pro — transcripción Whisper + 3 guiones (Claude o GPT).
 */

const API = "/api/videos-pro/process";
const MAX_BYTES = 4 * 1024 * 1024;

function $(sel, root = document) {
  return root.querySelector(sel);
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

function renderError(msg) {
  const el = $("#err");
  el.textContent = msg;
  el.classList.remove("hidden");
}

function clearError() {
  const el = $("#err");
  el.textContent = "";
  el.classList.add("hidden");
}

function setBusy(busy, phase) {
  $("#btn-run").disabled = busy;
  const st = $("#status");
  if (!busy) {
    st.innerHTML = "";
    return;
  }
  const lines = {
    upload: "Subiendo archivo…",
    wait: "Procesando en el servidor…",
    whisper: "Transcribiendo audio con <strong>Whisper</strong> (OpenAI)…",
    scripts: "Generando <strong>3 variaciones</strong> del guion (Claude o GPT)…",
  };
  st.innerHTML = lines[phase] || lines.wait;
}

function renderResults(data) {
  $("#out-wrap").classList.remove("hidden");
  $("#transcript").textContent = data.transcript || "";

  const grid = $("#var-grid");
  grid.innerHTML = "";
  (data.variations || []).forEach((v, i) => {
    const card = document.createElement("article");
    card.className = "var-card";
    card.innerHTML = `
      <h4>${escapeHtml(v.title || `Variación ${i + 1}`)}</h4>
      <pre>${escapeHtml(v.script)}</pre>
      <div class="mini-actions">
        <button type="button" class="btn btn-sec btn-sm btn-copy-var" data-i="${i}">Copiar</button>
        <button type="button" class="btn btn-pri btn-sm btn-dl-var" data-i="${i}">Descargar .txt</button>
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
        btn.textContent = "Copiado";
        setTimeout(() => {
          btn.textContent = "Copiar";
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
      const title = (v?.title || `variacion-${i + 1}`).replace(/[^\wáéíóúüñÁÉÍÓÚÜÑ\s-]/gi, "").trim().slice(0, 40) || `variacion-${i + 1}`;
      downloadText(`guion-${title.replace(/\s+/g, "-").toLowerCase()}.txt`, v?.script || "");
    });
  });

  $("#btn-dl-all").onclick = () => {
    let text = "=== TRANSCRIPCIÓN (Whisper) ===\n\n";
    text += data.transcript + "\n\n";
    text += "=== TRES VARIACIONES ===\n\n";
    (data.variations || []).forEach((v, i) => {
      text += `--- ${v.title || `Variación ${i + 1}`} ---\n\n`;
      text += (v.script || "") + "\n\n";
    });
    downloadText("videos-pro-guiones.txt", text.trim());
  };

  const meta = $("#meta");
  if (data.models) {
    meta.textContent = `Modelos: ${data.models.whisper} · ${data.models.scripts}`;
    meta.classList.remove("hidden");
  } else {
    meta.classList.add("hidden");
  }
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function init() {
  const input = $("#file");
  const drop = $("#drop");
  const picked = $("#picked");

  let file = null;

  const setFile = (f) => {
    if (!f) {
      file = null;
      picked.textContent = "";
      return;
    }
    if (f.size > MAX_BYTES) {
      renderError(
        `El archivo pesa ${formatBytes(f.size)}. Máximo ~4 MB en este servidor. Comprimí el audio (mp3 más bajo) o usá un video más corto.`,
      );
      input.value = "";
      return;
    }
    clearError();
    file = f;
    picked.textContent = `${f.name} · ${formatBytes(f.size)}`;
  };

  drop.addEventListener("click", () => input.click());
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
    if (!file) {
      renderError("Elegí un archivo de audio o video primero.");
      return;
    }

    const fd = new FormData();
    fd.append("file", file, file.name);
    const brief = $("#brief").value.trim();
    if (brief) fd.append("brief", brief);

    $("#out-wrap").classList.add("hidden");
    setBusy(true, "upload");

    try {
      setBusy(true, "wait");
      const res = await fetch(API, {
        method: "POST",
        body: fd,
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.success) {
        const msg = json.error || res.statusText || "Error desconocido";
        renderError(msg);
        return;
      }

      renderResults(json);
    } catch (e) {
      console.error(e);
      renderError(e?.message || "Error de red. Probá de nuevo.");
    } finally {
      setBusy(false);
    }
  });
}

init();

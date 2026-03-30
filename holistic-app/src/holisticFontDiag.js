/**
 * Diagnóstico de tipografía en consola (Crédito / holistic-app).
 * Nota: hasta que termina auth/carga, no hay `.hm-app` — por eso no hay paso "mount+0".
 */
export function logHolisticFontDiagnostics(phase = "") {
  if (typeof document === "undefined") return;

  const q = (sel) => document.querySelector(sel);

  const samples = [
    ["body", document.body],
    ["#root", document.getElementById("root")],
    [".hm-app", q(".hm-app")],
    [".hm-app h2 (1º)", q(".hm-app h2")],
    [".hm-app h3 (1º)", q(".hm-app h3")],
    [".stat-card (1º)", q(".hm-app .stat-card")],
    ["table th (1º)", q(".hm-app table th")],
    ["table td (1º)", q(".hm-app table tbody td")],
    [".recharts-wrapper text (1º)", q(".recharts-wrapper text")],
    ["input text (1º)", q(".hm-app input[type='text']")],
  ];

  const label = `%c[Holistic] Tipografía${phase ? ` · ${phase}` : ""}`;
  console.groupCollapsed(label, "color:#ea580c;font-weight:bold;font-size:12px");

  const logLine = (name, el) => {
    if (!el) {
      console.log(
        `%c  — ${name}: no hay nodo (otra pantalla o ese bloque no se renderiza aquí)`,
        "color:#64748b"
      );
      return;
    }
    const s = getComputedStyle(el);
    const line = `font="${s.fontFamily}" | ${s.fontSize} | w${s.fontWeight} | num:${s.fontVariantNumeric}`;
    console.log(`  ✓ ${name}: ${line}`);
  };

  samples.forEach(([name, el]) => logLine(name, el));

  try {
    const check16 = document.fonts?.check?.("16px Inter");
    const check32 = document.fonts?.check?.("700 32px Inter");
    console.log(
      `  Inter cargada: 16px=${check16} | 700+32px=${check32} (false suele ser normal si el peso/tamaño no coincide exacto)`
    );
  } catch (e) {
    console.log("  document.fonts.check: no disponible", e?.message);
  }

  document.fonts?.ready?.then(() => {
    const list = [];
    try {
      document.fonts.forEach((f) => {
        if (String(f.family).toLowerCase().includes("inter")) {
          list.push(`${f.family} w${f.weight} ${f.status}`);
        }
      });
    } catch (_) {}
    console.log(
      "  Registro Inter:",
      list.length ? list.slice(0, 12).join(" · ") + (list.length > 12 ? ` …(+${list.length - 12})` : "") : "(ninguna)"
    );
  });

  const link = document.querySelector('link[href*="fonts.googleapis.com"][href*="Inter"]');
  console.log("  Link:", link ? link.href : "NO ENCONTRADO");

  console.groupEnd();
}

if (typeof window !== "undefined") {
  window.__HM_LOG_FONTS__ = () => logHolisticFontDiagnostics("manual");
}

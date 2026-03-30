/**
 * Diagnóstico de tipografía en consola (Crédito / holistic-app).
 * Busca elementos típicos y muestra getComputedStyle; útil si sigue viéndose “Times” o monospace raro.
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
    [".recharts-wrapper svg text (1º)", q(".recharts-wrapper text")],
    ["input (1º)", q(".hm-app input[type='text']")],
  ];

  const label = `%c[Holistic] Tipografía${phase ? ` · ${phase}` : ""}`;
  console.groupCollapsed(label, "color:#ea580c;font-weight:bold;font-size:12px");

  samples.forEach(([name, el]) => {
    if (!el) {
      console.warn(`  ${name}: (no hay nodo — normal si esa vista aún no pintó)`);
      return;
    }
    const s = getComputedStyle(el);
    console.log(`  ${name}`, {
      fontFamily: s.fontFamily,
      fontSize: s.fontSize,
      fontWeight: s.fontWeight,
      fontVariantNumeric: s.fontVariantNumeric,
    });
  });

  try {
    const check16 = document.fonts?.check?.("16px Inter");
    const check32 = document.fonts?.check?.("700 32px Inter");
    console.log("  document.fonts.check Inter:", { "16px": check16, "700 32px": check32 });
  } catch (e) {
    console.log("  document.fonts.check: no disponible", e?.message);
  }

  document.fonts?.ready?.then(() => {
    const list = [];
    try {
      document.fonts.forEach((f) => {
        if (String(f.family).toLowerCase().includes("inter")) {
          list.push(`${f.family} weight=${f.weight} status=${f.status}`);
        }
      });
    } catch (_) {}
    console.log("  Fuentes Inter en document.fonts:", list.length ? list : "(ninguna — revisá bloqueo de Google Fonts o red)");
  });

  const link = document.querySelector('link[href*="fonts.googleapis.com"][href*="Inter"]');
  console.log("  Link Inter en <head>:", link ? link.href : "NO ENCONTRADO");

  console.groupEnd();
}

if (typeof window !== "undefined") {
  window.__HM_LOG_FONTS__ = () => logHolisticFontDiagnostics("manual");
}

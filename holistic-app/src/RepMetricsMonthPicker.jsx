import { useState, useRef, useEffect, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function padYm(y, m) {
  return `${y}-${String(m).padStart(2, "0")}`;
}

function parseYm(ym) {
  if (!ym || typeof ym !== "string" || ym.length < 7) return null;
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) return null;
  return { y, m };
}

/**
 * Selector de mes (popover) para Métricas / Resumen — sustituye al input nativo type="month".
 */
export default function RepMetricsMonthPicker({
  valueYm,
  displayLabel,
  active,
  variant = "dashboard",
  onSelectYm,
  onThisMonthShortcut,
}) {
  const [open, setOpen] = useState(false);
  const [draftYear, setDraftYear] = useState(() => new Date().getFullYear());
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  const isMetricas = variant === "metricas";
  const accent = isMetricas
    ? { primary: "#c2410c", primarySoft: "#fff7ed", ring: "#ea580c", hover: "#ffedd5" }
    : { primary: "var(--color-primary)", primarySoft: "var(--sidebar-active)", ring: "var(--color-primary)", hover: "var(--sidebar-hover)" };

  const syncDraftYear = useCallback(() => {
    const parsed = parseYm(valueYm);
    if (parsed) setDraftYear(parsed.y);
    else setDraftYear(new Date().getFullYear());
  }, [valueYm]);

  useEffect(() => {
    if (open) syncDraftYear();
  }, [open, syncDraftYear]);

  const reposition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const panelW = 300;
    const left = Math.max(12, Math.min(r.left, window.innerWidth - panelW - 12));
    setPopoverPos({ top: r.bottom + 8, left });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e) => {
      if (triggerRef.current?.contains(e.target) || panelRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onMove = () => reposition();
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open, reposition]);

  const now = new Date();
  const thisY = now.getFullYear();
  const thisM = now.getMonth() + 1;

  const pickMonth = (month1to12) => {
    onSelectYm(padYm(draftYear, month1to12));
    setOpen(false);
  };

  const goThisMonthPreset = () => {
    onThisMonthShortcut();
    setOpen(false);
  };

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          requestAnimationFrame(() => reposition());
        }}
        aria-expanded={open}
        aria-haspopup="dialog"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px 8px 10px",
          borderRadius: 10,
          border: active ? `1.5px solid ${accent.ring}` : "1px solid var(--sidebar-border)",
          background: active ? accent.primarySoft : "var(--color-bg)",
          color: "var(--sidebar-text-active)",
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: 12.5,
          fontWeight: active ? 700 : 600,
          cursor: "pointer",
          boxShadow: open ? "0 4px 20px rgba(15,23,42,.08)" : "0 1px 2px rgba(15,23,42,.04)",
          transition: "border-color .15s, box-shadow .15s, background .15s",
          minWidth: 0,
          maxWidth: "100%",
        }}
      >
        <Calendar size={15} strokeWidth={2.2} style={{ color: active ? accent.primary : "var(--sidebar-text-muted)", flexShrink: 0 }} />
        <span style={{ textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{displayLabel}</span>
        <ChevronDown size={14} style={{ opacity: 0.65, flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform .2s ease" }} />
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Elegir mes"
            style={{
              position: "fixed",
              left: popoverPos.left,
              top: popoverPos.top,
              zIndex: 10050,
              width: 300,
              maxWidth: "min(300px, calc(100vw - 24px))",
              borderRadius: 16,
              border: "1px solid var(--sidebar-border)",
              background: "var(--color-surface-2)",
              boxShadow: "0 22px 55px rgba(15,23,42,.16), 0 0 0 1px rgba(15,23,42,.04)",
              overflow: "hidden",
              animation: "hmMonthPop .2s cubic-bezier(0.22,1,0.36,1)",
            }}
          >
            <style>{`@keyframes hmMonthPop{from{opacity:0;transform:translateY(-8px) scale(0.98)}to{opacity:1;transform:translateY(0) scale(1)}}`}</style>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 14px",
              borderBottom: "1px solid var(--sidebar-border)",
              background: "linear-gradient(180deg, var(--color-bg) 0%, var(--color-surface-2) 100%)",
            }}
          >
            <button
              type="button"
              onClick={() => setDraftYear((y) => y - 1)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                border: "1px solid var(--sidebar-border)",
                background: "var(--color-bg)",
                color: "var(--sidebar-text-active)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title="Año anterior"
            >
              <ChevronLeft size={18} />
            </button>
            <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--sidebar-text-active)", fontVariantNumeric: "tabular-nums" }}>{draftYear}</span>
            <button
              type="button"
              onClick={() => setDraftYear((y) => y + 1)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                border: "1px solid var(--sidebar-border)",
                background: "var(--color-bg)",
                color: "var(--sidebar-text-active)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title="Año siguiente"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div style={{ padding: "12px 14px 14px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {MONTHS.map((label, i) => {
              const m = i + 1;
              const ym = padYm(draftYear, m);
              const isSelected = valueYm === ym;
              const isTodayMonth = draftYear === thisY && m === thisM;
              return (
                <button
                  key={ym}
                  type="button"
                  onClick={() => pickMonth(m)}
                  style={{
                    padding: "10px 6px",
                    borderRadius: 10,
                    border: isSelected ? `2px solid ${accent.ring}` : isTodayMonth ? "1px dashed var(--sidebar-border)" : "1px solid transparent",
                    background: isSelected ? accent.primarySoft : "var(--color-bg)",
                    color: isSelected ? accent.primary : "var(--sidebar-text-active)",
                    fontSize: 12,
                    fontWeight: isSelected ? 700 : 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    transition: "background .12s, border-color .12s, transform .12s",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = accent.hover;
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = "var(--color-bg)";
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              padding: "10px 14px 12px",
              borderTop: "1px solid var(--sidebar-border)",
              background: "var(--color-bg)",
            }}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                padding: "6px 10px",
                border: "none",
                background: "transparent",
                color: "var(--sidebar-text-muted)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={goThisMonthPreset}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: `1px solid ${accent.ring}`,
                background: accent.primarySoft,
                color: accent.primary,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Ir a este mes
            </button>
          </div>
        </div>,
          document.body,
        )}
    </div>
  );
}

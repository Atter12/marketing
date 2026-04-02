import { useCallback, useEffect, useRef } from "react";

/** Flechas ← → en inputs/textarea: el navegador mueve el cursor; no robamos el evento. */
function shouldDeferHorizontalArrowsToBrowser(active) {
  if (!active || !(active instanceof HTMLElement)) return false;
  if (active.isContentEditable) return true;
  const tag = active.tagName;
  if (tag === "TEXTAREA") return true;
  if (tag === "SELECT") return true;
  if (tag !== "INPUT") return false;
  const type = (active.type || "").toLowerCase();
  if (type === "radio") return true;
  if (["text", "search", "url", "tel", "password", "email", "number", ""].includes(type)) return true;
  if (["date", "time", "month", "datetime-local", "week"].includes(type)) return true;
  return false;
}

/**
 * Contenedor con scroll horizontal enfocable con Tab;
 * flechas ← → desplazan (paso ~mitad del ancho visible); Shift + rueda también.
 * Las flechas siguen funcionando con foco en checkboxes, botones o celdas: listener en captura + clic en celdas vacías enfoca el contenedor.
 *
 * autoFocusScroll: al entrar a la sección (o pestaña) el contenedor recibe foco para usar ← → sin clic previo en la tabla.
 */
export default function TableScrollWrap({ className = "", style, children, autoFocusScroll = false, ...rest }) {
  const ref = useRef(null);
  const { onKeyDown: onKeyDownProp, onMouseDown: onMouseDownProp, ...restProps } = rest;

  const scrollStep = useCallback(() => {
    const el = ref.current;
    if (!el) return 280;
    const w = el.clientWidth;
    return Math.min(560, Math.max(200, Math.round(w * 0.5)));
  }, []);

  const applyArrowScroll = useCallback(
    (e) => {
      const el = ref.current;
      if (!el || el.scrollWidth <= el.clientWidth + 1) return false;
      const active = document.activeElement;
      if (!active || !el.contains(active)) return false;
      if (shouldDeferHorizontalArrowsToBrowser(active)) return false;
      const base = scrollStep();
      const step = e.repeat ? Math.min(Math.round(base * 1.35), el.scrollWidth) : base;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        el.scrollLeft -= step;
        return true;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        el.scrollLeft += step;
        return true;
      }
      return false;
    },
    [scrollStep]
  );

  const handleKeyDown = (e) => {
    onKeyDownProp?.(e);
  };

  useEffect(() => {
    const onDocKeyDown = (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const el = ref.current;
      if (!el) return;
      applyArrowScroll(e);
    };
    document.addEventListener("keydown", onDocKeyDown, true);
    return () => document.removeEventListener("keydown", onDocKeyDown, true);
  }, [applyArrowScroll]);

  useEffect(() => {
    if (!autoFocusScroll) return;
    let cancelled = false;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      if (cancelled) return;
      raf2 = requestAnimationFrame(() => {
        if (!cancelled) ref.current?.focus({ preventScroll: true });
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [autoFocusScroll]);

  const handleMouseDown = (e) => {
    onMouseDownProp?.(e);
    const root = ref.current;
    if (!root || e.button !== 0 || e.defaultPrevented) return;
    const t = e.target;
    if (!(t instanceof Node) || !root.contains(t)) return;
    const interactive = t instanceof Element ? t.closest("input, textarea, select, button, a[href], [contenteditable=true], [role=button]") : null;
    if (interactive) return;
    root.focus({ preventScroll: true });
  };

  const handleWheel = (e) => {
    const el = ref.current;
    if (!el || el.scrollWidth <= el.clientWidth + 1) return;
    if (!e.shiftKey) return;
    e.preventDefault();
    el.scrollLeft += e.deltaY;
  };

  return (
    <div
      ref={ref}
      className={className}
      style={{ outline: "none", ...style }}
      tabIndex={0}
      role="region"
      aria-label="Tabla con scroll horizontal. Tab para enfocar; flechas o Shift + rueda para mover."
      onKeyDown={handleKeyDown}
      onMouseDown={handleMouseDown}
      onWheel={handleWheel}
      {...restProps}
    >
      {children}
    </div>
  );
}

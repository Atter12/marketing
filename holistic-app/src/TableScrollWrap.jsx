import { useCallback, useRef } from "react";

/**
 * Contenedor con scroll horizontal enfocable con Tab;
 * flechas ← → desplazan (paso ~mitad del ancho visible); Shift + rueda también.
 */
export default function TableScrollWrap({ className = "", style, children, ...rest }) {
  const ref = useRef(null);

  const scrollStep = useCallback(() => {
    const el = ref.current;
    if (!el) return 280;
    const w = el.clientWidth;
    return Math.min(560, Math.max(200, Math.round(w * 0.5)));
  }, []);

  const handleKeyDown = (e) => {
    const el = ref.current;
    if (!el) return;
    if (el.scrollWidth <= el.clientWidth + 1) return;
    const base = scrollStep();
    const step = e.repeat ? Math.min(Math.round(base * 1.35), el.scrollWidth) : base;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      el.scrollLeft -= step;
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      el.scrollLeft += step;
    }
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
      onWheel={handleWheel}
      {...rest}
    >
      {children}
    </div>
  );
}

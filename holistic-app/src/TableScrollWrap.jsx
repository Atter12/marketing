import { useRef } from "react";

/**
 * Contenedor con scroll horizontal enfocable con Tab;
 * flechas ← → desplazan sin clic en la barra.
 */
export default function TableScrollWrap({ className = "", style, children, ...rest }) {
  const ref = useRef(null);
  const handleKeyDown = (e) => {
    const el = ref.current;
    if (!el) return;
    if (el.scrollWidth <= el.clientWidth + 1) return;
    const step = 220;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      el.scrollBy({ left: -step, behavior: "auto" });
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      el.scrollBy({ left: step, behavior: "auto" });
    }
  };
  return (
    <div
      ref={ref}
      className={className}
      style={{ outline: "none", ...style }}
      tabIndex={0}
      role="region"
      aria-label="Tabla con scroll horizontal. Tab para enfocar; flechas para mover."
      onKeyDown={handleKeyDown}
      {...rest}
    >
      {children}
    </div>
  );
}

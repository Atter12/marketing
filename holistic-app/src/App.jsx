import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Shield, DollarSign, Users, CreditCard, Plus, ChevronLeft, ChevronRight, Trash2, Edit3, Search, TrendingUp, BarChart3, Eye, X, Check, AlertCircle, FileText, Home, ArrowUpRight, ArrowDownRight, Calendar, Hash, Percent, Menu, LogOut, HardDrive, ExternalLink, Camera, KeyRound, Download, Paperclip, Mail, Activity } from "lucide-react";
import ClientDetailView from "./ClientDetailView";
import { buildClientLedgerRows } from "./clientDetailLedger";
import CobranzaView from "./CobranzaView";
import { logHolisticFontDiagnostics } from "./holisticFontDiag.js";
import TableScrollWrap from "./TableScrollWrap";
import { useSupabaseData } from "./useSupabaseData";
import { exportToExcel } from "./exportExcel";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { supabase, uploadAvatar, uploadGerenteAvatar, getGerenteProfile, updateGerenteAvatar, darAccesoCliente, uploadComprobanteCobro, uploadComprobanteGarantia, getComprobanteSignedUrl, isLikelyBlockedAvatarHotlinkUrl } from "./supabase";

// Logo: imagen en public/logo/logoh.png (holistic + marketing con gradiente naranja)
const LOGO_URL = import.meta.env.DEV ? "/logo/logoh.png" : (import.meta.env.BASE_URL || "/") + "logo/logoh.png";

/* ═══════ STORAGE ═══════ */
const S = {
  g: (k) => { try { return JSON.parse(localStorage.getItem("hm_" + k)) || []; } catch { return []; } },
  s: (k, v) => localStorage.setItem("hm_" + k, JSON.stringify(v)),
};
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
// Formato fiel a los dígitos en BD: hasta 2 decimales, sin rellenar ceros (11.7 → "11.7", 64.52 → "64.52")
const fmt = (n) => {
  const v = parseFloat(n);
  if (Number.isNaN(v)) return "0";
  return v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};
/** Número para Excel: sin coma de miles (8331.27 en vez de 8,331.27) */
const fmtExcel = (n) => {
  const v = parseFloat(n);
  if (Number.isNaN(v)) return "—";
  return v.toFixed(2);
};
const fmtK = (n) => { const v = parseFloat(n || 0); if (v >= 1e6) return "$" + (v / 1e6).toFixed(2) + "M"; if (v >= 1e3) return "$" + (v / 1e3).toFixed(1) + "K"; return "$" + fmt(v); };
const td = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const tm = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); };
const firstDayOfMonth = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-01"; };
const lastDayOfMonth = (ym) => { const [y, m] = (ym || "").split("-").map(Number); if (!y || !m) return td(); const day = new Date(y, m, 0).getDate(); return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`; };
const fmtM = (m) => { if (!m) return "—"; const d = new Date(m + "-15T12:00:00"); return d.toLocaleDateString("es-PE", { month: "short", year: "numeric" }); };
const fmtD = (d) => { if (!d) return "—"; return new Date(d + "T12:00:00").toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" }); };
const normalizePeriod = (p) => { if (!p || typeof p !== "string") return ""; const t = String(p).trim(); const i = t.indexOf("-"); if (i === -1) return t; const y = t.slice(0, i), m = t.slice(i + 1); const mon = parseInt(m, 10); if (mon >= 1 && mon <= 12) return `${y}-${String(mon).padStart(2, "0")}`; return t; };
const mesCobro = (c, gastosList) => { if (c.periodoResumen && String(c.periodoResumen).trim()) return normalizePeriod(String(c.periodoResumen).trim()); if (c.gastoId && gastosList && gastosList.length) { const g = gastosList.find((x) => x.id === c.gastoId); if (g && g.mes) return normalizePeriod(g.mes); } return normalizePeriod((c.fecha || "").slice(0, 7)); };
/** Mes en que la garantía cuenta en el resumen (período explícito, gasto, fecha colocación o alta). */
const mesGarantiaResumen = (g, gastosList) => {
  const pr = g.periodoResumen && String(g.periodoResumen).trim();
  if (pr) return normalizePeriod(pr);
  if (g.gastoId && gastosList?.length) { const gg = gastosList.find((x) => x.id === g.gastoId); if (gg?.mes) return normalizePeriod(gg.mes); }
  const fc = (g.fechaColocacion || "").slice(0, 7);
  if (fc) return normalizePeriod(fc);
  if (g.created_at) return normalizePeriod(String(g.created_at).slice(0, 7));
  return "";
};
/** Pendiente neto de un cliente en un mes (YYYY-MM): mismas reglas que el desglose del Resumen (fecha de movimiento, cobros por período contable, garantías con mes en resumen). */
function netPendingClienteEnPeriodo(cid, periodoMes, sGastos, cobros, gastosList, garantias) {
  const mesIni = normalizePeriod(periodoMes);
  if (!mesIni) return 0;
  const repPerInicio = mesIni + "-01";
  const repPerFin = lastDayOfMonth(mesIni);
  const fOp = (g) => (g.fechaMovimiento || "").slice(0, 10);
  let gs = sGastos.filter((g) => String(g.clientId) === String(cid));
  gs = gs.filter((g) => {
    const d = fOp(g);
    if (!d) return false;
    return d >= repPerInicio && d <= repPerFin;
  });
  const garantiasParaReporte = garantias.filter((g) => {
    if (g.estado !== "Vigente" || String(g.clientId) !== String(cid)) return false;
    const mesG = mesGarantiaResumen(g, gastosList);
    if (!mesG) return false;
    return mesG >= mesIni && mesG <= mesIni;
  });
  const bc = {};
  gs.forEach((g) => {
    if (!bc[g.clientId]) bc[g.clientId] = { ads: 0, fee: 0, total: 0, paid: 0 };
    bc[g.clientId].ads += parseFloat(g.gasto || 0);
    bc[g.clientId].fee += g._f;
    bc[g.clientId].total += g._t;
  });
  cobros.forEach((c) => {
    const cidc = c.gastoId ? (gastosList.find((x) => x.id === c.gastoId)?.clientId) : (c.clientId || null);
    if (!cidc || String(cidc) !== String(cid)) return;
    const mes = normalizePeriod(mesCobro(c, gastosList));
    if (!mes || mes < mesIni || mes > mesIni) return;
    if (!bc[cidc]) bc[cidc] = { ads: 0, fee: 0, total: 0, paid: 0 };
    bc[cidc].paid += parseFloat(c.monto || 0);
  });
  garantiasParaReporte.forEach((g) => {
    if (!bc[g.clientId]) bc[g.clientId] = { ads: 0, fee: 0, total: 0, paid: 0 };
  });
  const d = bc[cid];
  if (!d) return 0;
  const gar = garantiasParaReporte.reduce((a, g) => a + parseFloat(g.valor || 0), 0);
  const pend = Math.max(0, d.total - d.paid);
  return Math.max(0, pend - gar);
}
const addOneMonthYm = (ym) => { if (!ym || typeof ym !== "string") return tm(); const [y, m] = ym.split("-").map(Number); if (!y || !m) return tm(); const d = new Date(y, m, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const fmtDD = (d) => { if (!d) return "—"; const x = new Date(d + "T12:00:00"); const dd = String(x.getDate()).padStart(2, "0"); const mm = String(x.getMonth() + 1).padStart(2, "0"); return dd + "/" + mm + "/" + x.getFullYear(); };
const fmtT = (t) => { if (!t) return "—"; const s = String(t).slice(0, 5); return s.length >= 5 ? s : t; };
const fmtDt = (iso) => { if (!iso) return "—"; const d = new Date(iso); return d.toLocaleString("es-PE", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); };
const COLORS = ["#635bff", "#0d9f6e", "#d97706", "#dc2626", "#7c3aed", "#e1306c", "#0891b2", "#c2410c"];
const PC = { "Mercury Bank": "#5542f6", BCP: "#ff6200", Interbank: "#00a651", Binance: "#f0b90b", Efectivo: "#94a3b8", Stripe: "#635bff", Yape: "#6c2cb2", Plin: "#00d4aa" };
const PI = { "Mercury Bank": "🏦", BCP: "🟠", Interbank: "🟢", Binance: "💛", Efectivo: "💵", Stripe: "💳", Yape: "💜", Plin: "💚" };
const PM = ["Mercury Bank", "BCP", "Interbank", "Binance", "Efectivo", "Stripe", "Yape", "Plin"];
const OTRO_METODO_VALUE = "__OTRO__";
const GT = ["Cuenta TikTok", "Business Center", "Dispositivo", "Documento ID", "Contrato Firmado", "Depósito", "Otro"];
const PER_PAGE = 20;
const clr = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h); return COLORS[Math.abs(h) % COLORS.length]; };
const ini = (n) => n.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
const gTotal = (g) => parseFloat(g.gasto || 0) * (1 + parseFloat(g.fee || 0) / 100);
const gFee = (g) => parseFloat(g.gasto || 0) * (parseFloat(g.fee || 0) / 100);

function getMonths(n = 6) {
  const r = [], now = new Date();
  for (let i = n - 1; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); r.push({ key: d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"), label: d.toLocaleDateString("es-PE", { month: "short", year: "2-digit" }) }); }
  return r;
}
/** Parsea "01/2025", "2025-01", "1/25", "012025" → "2025-01" o null */
function parsePeriodoInput(s) {
  if (!s || typeof s !== "string") return null;
  const t = s.trim().replace(/\s/g, "");
  const m1 = t.match(/^(\d{1,2})[\/\-](\d{2,4})$/); // 01/2025 o 01-25
  if (m1) {
    let month = parseInt(m1[1], 10);
    let year = parseInt(m1[2], 10);
    if (year < 100) year += 2000;
    if (month >= 1 && month <= 12) return `${year}-${String(month).padStart(2, "0")}`;
  }
  const m2 = t.match(/^(\d{4})[\/\-](\d{1,2})$/); // 2025-01
  if (m2) {
    const year = parseInt(m2[1], 10);
    const month = parseInt(m2[2], 10);
    if (month >= 1 && month <= 12) return `${year}-${String(month).padStart(2, "0")}`;
  }
  const m3 = t.match(/^(\d{2})(\d{4})$/); // 012025
  if (m3) {
    const month = parseInt(m3[1], 10);
    const year = parseInt(m3[2], 10);
    if (month >= 1 && month <= 12) return `${year}-${String(month).padStart(2, "0")}`;
  }
  const m4 = t.match(/^(\d{2})(\d{2})$/); // 0125 = MMYY (ene. 2025)
  if (m4) {
    const month = parseInt(m4[1], 10);
    let year = parseInt(m4[2], 10);
    if (year < 100) year += 2000;
    if (month >= 1 && month <= 12) return `${year}-${String(month).padStart(2, "0")}`;
  }
  return null;
}

/* ═══════ UI COMPONENTS ═══════ */
const AVATAR_SIZE_SCALE = 1.35; // fotos de clientes 35% más grandes
const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL || "";
function resolveAvatarSrc(avatarUrl) {
  const raw = avatarUrl == null ? "" : String(avatarUrl).replace(/&amp;/gi, "&").trim();
  if (!raw) return "";
  if (isLikelyBlockedAvatarHotlinkUrl(raw)) return "";

  // data: URLs (no se tocan)
  if (/^data:/i.test(raw)) return raw;
  // URL completa (como la de Renzo)
  if (/^https?:\/\//i.test(raw)) return raw;

  // Si ya es una ruta completa del bucket pero sin dominio
  if (raw.startsWith("/storage/")) {
    return SUPABASE_URL ? SUPABASE_URL + raw : raw;
  }
  if (raw.startsWith("storage/")) {
    return SUPABASE_URL ? SUPABASE_URL + "/" + raw : raw;
  }

  // Si guardaron "avatars/<clientId>/avatar.ext"
  if (raw.toLowerCase().startsWith("avatars/")) {
    const cleaned = raw.replace(/^avatars\//i, "").replace(/^\/+/, "");
    return SUPABASE_URL ? `${SUPABASE_URL}/storage/v1/object/public/${"avatars"}/${cleaned}` : raw;
  }

  // Si guardaron solo "<clientId>/avatar.ext" (sin el prefijo avatars/)
  if (SUPABASE_URL) {
    const cleaned = raw.replace(/^\/+/, "");
    return `${SUPABASE_URL}/storage/v1/object/public/avatars/${cleaned}`;
  }

  // Último recurso: usar lo que venga (probablemente fallará y caerá a iniciales)
  return raw;
}
function Av({ name, size = 34, avatarUrl }) {
  const [imgError, setImgError] = useState(false);
  const c = clr(name);
  const s = Math.round(size * AVATAR_SIZE_SCALE);
  const style = { width: s, height: s, borderRadius: s > 40 ? 16 : 10, flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: c + "12", color: c, fontWeight: 700, fontSize: s * 0.34, letterSpacing: -0.3 };
  const resolvedSrc = avatarUrl && avatarUrl.trim() ? resolveAvatarSrc(avatarUrl) : "";
  const showImg = !!resolvedSrc && !imgError;
  const isOurSupabaseAvatar = !!(SUPABASE_URL && resolvedSrc && resolvedSrc.startsWith(SUPABASE_URL));
  useEffect(() => { setImgError(false); }, [avatarUrl]);
  if (showImg) return <div style={style}><img src={resolvedSrc} alt="" loading="lazy" decoding="async" referrerPolicy={isOurSupabaseAvatar ? undefined : "no-referrer"} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={() => { setImgError(true); }} /></div>;
  return <div style={style}>{ini(name)}</div>;
}

const Bdg = ({ type = "n", children, style: customStyle }) => {
  const m = { ok: ["#ecfdf5", "#059669", "#d1fae5"], err: ["#fef2f2", "#dc2626", "#fecaca"], warn: ["#fffbeb", "#d97706", "#fde68a"], acc: ["#eff6ff", "#2563eb", "#bfdbfe"], n: ["var(--color-bg)", "var(--sidebar-text)", "var(--sidebar-border)"], gar: ["#f5f3ff", "#7c3aed", "#ddd6fe"] };
  const [bg, fg, ring] = m[type] || m.n;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 13px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: bg, color: fg, whiteSpace: "nowrap", letterSpacing: -0.1, border: `1px solid ${ring}`, ...customStyle }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: fg, flexShrink: 0 }} />{children}</span>;
};

const PayB = ({ method }) => <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: (PC[method] || "#94a3b8") + "14", color: PC[method] || "#64748b", letterSpacing: -0.1 }}>{PI[method] || "💰"} {method}</span>;

const Stat = ({ icon, value, label, color, sub }) => (
  <div className="stat-card" style={{ fontFamily: "var(--font-body)", background: "var(--color-surface)", border: "1px solid var(--color-divider)", borderRadius: "var(--radius-xl)", padding: "var(--sp-5)", position: "relative", overflow: "hidden" }}>
    <div style={{ position: "absolute", top: -30, right: -30, width: 100, height: 100, borderRadius: "50%", background: color + "08", pointerEvents: "none" }} />
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
      <div style={{ width: 46, height: 46, borderRadius: "var(--radius-lg)", background: `linear-gradient(135deg, ${color}18, ${color}08)`, color, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${color}20` }}>{icon}</div>
    </div>
    <div style={{ fontFamily: "var(--font-body)", fontVariantNumeric: "tabular-nums", fontSize: 32, fontWeight: 700, letterSpacing: -1.2, color: "var(--sidebar-text-active)", marginBottom: 6, lineHeight: 1 }}>{value}</div>
    <div style={{ fontSize: 11.5, color: "var(--color-text-muted)", fontWeight: 500, letterSpacing: 0.2, textTransform: "uppercase" }}>{label}</div>
    {sub && <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 8, padding: "4px 0", borderTop: "1px solid var(--color-divider)" }}>{sub}</div>}
  </div>
);

const Mdl = ({ open, onClose, title, children, footer }) => {
  if (!open) return null;
  return (
    <div className="hm-modal-outer" onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(28,25,23,0.6)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 48, overflowY: "auto", animation: "fadeSlideIn .2s ease-out" }}>
      <div className="hm-modal-box" onClick={(e) => e.stopPropagation()} style={{ background: "var(--color-surface)", borderRadius: "var(--radius-xl)", width: "94%", maxWidth: 640, boxShadow: "var(--shadow-xl)", border: "1px solid var(--color-divider)", marginBottom: 40, overflow: "hidden", boxSizing: "border-box", minWidth: 0, animation: "fadeSlideIn .25s ease-out" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "var(--sp-5) var(--sp-6)", background: "var(--color-surface)", borderBottom: "1px solid var(--color-divider)", borderRadius: "var(--radius-xl) var(--radius-xl) 0 0", minWidth: 0 }}>
          <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--sidebar-text-active)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: -0.4, fontFamily: "var(--font-display)" }}>{title}</h3>
          <button onClick={onClose} style={{ width: 36, height: 36, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--color-divider)", background: "var(--color-surface-2)", color: "var(--color-text-muted)", borderRadius: "var(--radius-md)", cursor: "pointer", fontSize: 16, transition: "var(--tr)" }} aria-label="Cerrar">✕</button>
        </div>
        <div style={{ padding: "24px 28px", overflowX: "hidden", minWidth: 0, boxSizing: "border-box" }}>{children}</div>
        {footer && <div className="hm-modal-footer" style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "18px 28px 22px", background: "var(--color-surface-offset)", borderTop: "1px solid var(--color-divider)", borderRadius: "0 0 var(--radius-xl) var(--radius-xl)" }}>{footer}</div>}
      </div>
    </div>
  );
};

const Inp = ({ label, hint, ...p }) => (
  <div style={{ marginBottom: 16, minWidth: 0 }}>
    {label && <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--color-text)", marginBottom: 7, letterSpacing: -0.1 }}>{label}</label>}
    {p.type === "textarea" ? <textarea {...p} style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box", padding: "12px 15px", background: "var(--color-bg)", border: "1.5px solid var(--sidebar-border)", borderRadius: 11, color: "var(--sidebar-text-active)", fontFamily: "'Inter',sans-serif", fontSize: 14, outline: "none", resize: "vertical", minHeight: 72, transition: "all .2s", ...(p.style || {}) }} /> : p.type === "select" ? <select {...p} style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box", padding: "12px 15px", background: "var(--color-bg)", border: "1.5px solid var(--sidebar-border)", borderRadius: 11, color: "var(--sidebar-text-active)", fontFamily: "'Inter',sans-serif", fontSize: 14, outline: "none", cursor: "pointer", WebkitAppearance: "none", paddingRight: 36, transition: "all .2s", ...(p.style || {}) }}>{p.children}</select> : <input {...p} style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box", padding: "12px 15px", background: "var(--color-bg)", border: "1.5px solid var(--sidebar-border)", borderRadius: 11, color: "var(--sidebar-text-active)", fontFamily: "'Inter',sans-serif", fontSize: 14, outline: "none", transition: "all .2s", ...(p.style || {}) }} />}
    {hint && <div style={{ fontSize: 12, color: "var(--sidebar-text-muted)", marginTop: 5, lineHeight: 1.4 }}>{hint}</div>}
  </div>
);

/** Buscador por nombre: input + lista filtrada. options = [{ value, label }], value = id seleccionado, onChange(id). compact = sin margen inferior (para filtros en header). Auto-selecciona cuando hay una sola coincidencia (sin necesidad de clic o Enter). */
function SearchSelect({ label, options, value, onChange, placeholder = "Buscar por nombre...", emptyMessage = "Sin resultados", compact }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(() => {
    if (!query.trim()) return options.slice(0, 50);
    const q = query.trim().toLowerCase();
    return options.filter((o) => (o.label || "").toLowerCase().includes(q)).slice(0, 50);
  }, [options, query]);
  const displayText = open ? query : (selected ? selected.label : "");
  const applySingleMatch = useCallback(() => {
    if (query.trim() && filtered.length === 1) {
      onChange(filtered[0].value);
      setQuery("");
      setOpen(false);
    }
  }, [query, filtered, onChange]);
  useEffect(() => {
    if (query.trim().length >= 2 && filtered.length === 1) {
      onChange(filtered[0].value);
      setQuery("");
      setOpen(false);
    }
  }, [query, filtered, onChange]);
  return (
    <div style={{ marginBottom: compact ? 0 : 14, minWidth: 0, position: "relative" }}>
      {label && <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--color-text)", marginBottom: 5 }}>{label}</label>}
      <input
        type="text"
        value={displayText}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => { applySingleMatch(); setOpen(false); }, 180)}
        placeholder={placeholder}
        style={{ width: "100%", boxSizing: "border-box", padding: "9px 13px", paddingRight: 36, background: "var(--color-surface-2)", border: "1px solid var(--sidebar-border)", borderRadius: 8, color: "var(--sidebar-text-active)", fontFamily: "'Inter',sans-serif", fontSize: 13.5, outline: "none" }}
      />
      {open && filtered.length > 0 && (
        <ul style={{ position: "absolute", left: 0, right: 0, top: "100%", marginTop: 2, margin: 0, padding: 4, listStyle: "none", background: "var(--color-surface-2)", border: "1px solid var(--sidebar-border)", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,.1)", zIndex: 100, maxHeight: 220, overflowY: "auto" }}>
          {filtered.map((o) => (
            <li key={o.value} onMouseDown={() => { onChange(o.value); setQuery(""); setOpen(false); }} style={{ padding: "8px 12px", cursor: "pointer", borderRadius: 6, fontSize: 13.5, color: o.value === value ? "var(--color-blue)" : "var(--color-text)", fontWeight: o.value === value ? 600 : 400, background: o.value === value ? "var(--color-info-soft)" : "transparent" }}>{o.label}</li>
          ))}
        </ul>
      )}
      {open && query.trim() && filtered.length === 0 && <div style={{ position: "absolute", left: 0, right: 0, top: "100%", marginTop: 2, padding: "12px 13px", background: "var(--color-surface-2)", border: "1px solid var(--sidebar-border)", borderRadius: 8, fontSize: 12.5, color: "var(--sidebar-text-muted)", zIndex: 100 }}>{emptyMessage}</div>}
    </div>
  );
}

const Btn = ({ variant = "primary", size, children, ...p }) => {
  const vs = {
    primary: { bg: "linear-gradient(135deg, #0f172a, #1e293b)", color: "var(--color-text-inverse)", border: "none", shadow: "0 2px 8px rgba(15,23,42,.2)" },
    accent: { bg: "linear-gradient(135deg, #2563eb, #1d4ed8)", color: "var(--color-text-inverse)", border: "none", shadow: "0 2px 8px rgba(37,99,235,.25)" },
    outline: { bg: "var(--color-surface-2)", color: "var(--sidebar-text-active)", border: "1.5px solid var(--sidebar-border)", shadow: "none" },
    ghost: { bg: "transparent", color: "var(--sidebar-text-muted)", border: "none", shadow: "none" },
    danger: { bg: "var(--color-error-soft)", color: "var(--red)", border: "1px solid var(--red-bg)", shadow: "none" }
  };
  const s = vs[variant] || vs.primary;
  return <button {...p} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: size === "sm" ? "8px 14px" : "10px 22px", borderRadius: 11, fontFamily: "'Inter',sans-serif", fontSize: size === "sm" ? 13 : 14, fontWeight: 600, border: s.border, background: s.bg, color: s.color, cursor: "pointer", whiteSpace: "nowrap", transition: "all .2s cubic-bezier(.4,0,.2,1)", letterSpacing: -0.2, boxShadow: s.shadow, ...(p.style || {}) }}>{children}</button>;
};

const PREFIXES = [{ c: "+51", l: "PE" }, { c: "+1", l: "US/CA" }, { c: "+52", l: "MX" }, { c: "+57", l: "CO" }, { c: "+34", l: "ES" }, { c: "+54", l: "AR" }, { c: "+55", l: "BR" }, { c: "+56", l: "CL" }, { c: "+58", l: "VE" }, { c: "+593", l: "EC" }, { c: "+598", l: "UY" }, { c: "+595", l: "PY" }, { c: "+591", l: "BO" }, { c: "+507", l: "PA" }, { c: "+506", l: "CR" }, { c: "+502", l: "GT" }, { c: "+503", l: "SV" }, { c: "+504", l: "HN" }, { c: "+505", l: "NI" }];
const parsePhone = (s) => { if (!s || !s.trim()) return { prefix: "+51", num: "" }; const m = s.trim().match(/^(\+\d{1,3})\s*(.*)$/); if (m) return { prefix: m[1], num: m[2].trim() }; return { prefix: "+51", num: s.trim() }; };
const Multi = ({ values, onChange, placeholder, type = "text" }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    {values.map((v, i) => (
      <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input type={type} value={v} onChange={(e) => { const n = [...values]; n[i] = e.target.value; onChange(n); }} placeholder={placeholder} style={{ flex: 1, minWidth: 0, padding: "9px 13px", background: "var(--color-surface-2)", border: "1px solid var(--sidebar-border)", borderRadius: 8, fontSize: 13.5, fontFamily: "'Inter',sans-serif", outline: "none", boxSizing: "border-box" }} />
        <button onClick={() => values.length > 1 ? onChange(values.filter((_, j) => j !== i)) : onChange([""])} style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", border: "none", background: "var(--color-error-soft)", color: "var(--red)", borderRadius: 6, cursor: "pointer", fontSize: 16, flexShrink: 0 }}>×</button>
      </div>
    ))}
    <button onClick={() => onChange([...values, ""])} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "var(--color-blue)", cursor: "pointer", padding: "4px 0", border: "none", background: "none", fontFamily: "'Inter',sans-serif" }}>+ Agregar</button>
  </div>
);
const MultiPhone = ({ values, onChange }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    {values.map((v, i) => {
      const { prefix, num } = parsePhone(v);
      return (
        <div key={i} style={{ display: "flex", gap: 6, alignItems: "center", minWidth: 0 }}>
          <select value={prefix} onChange={(e) => { const n = [...values]; n[i] = (e.target.value + " " + num).trim(); onChange(n); }} style={{ width: 88, flexShrink: 0, padding: "9px 8px", background: "var(--color-surface-2)", border: "1px solid var(--sidebar-border)", borderRadius: 8, fontSize: 13, fontFamily: "'Inter',sans-serif", outline: "none", cursor: "pointer" }}>
            {PREFIXES.map((p) => <option key={p.c} value={p.c}>{p.c} {p.l}</option>)}
          </select>
          <input type="tel" value={num} onChange={(e) => { const n = [...values]; n[i] = (prefix + " " + e.target.value).trim(); onChange(n); }} placeholder="999 999 999" style={{ flex: 1, minWidth: 0, padding: "9px 13px", background: "var(--color-surface-2)", border: "1px solid var(--sidebar-border)", borderRadius: 8, fontSize: 13.5, fontFamily: "'Inter',sans-serif", outline: "none", boxSizing: "border-box" }} />
          <button onClick={() => values.length > 1 ? onChange(values.filter((_, j) => j !== i)) : onChange([""])} style={{ width: 30, height: 30, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", border: "none", background: "var(--color-error-soft)", color: "var(--red)", borderRadius: 6, cursor: "pointer", fontSize: 16 }}>×</button>
        </div>
      );
    })}
    <button onClick={() => onChange([...values, ""])} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "var(--color-blue)", cursor: "pointer", padding: "4px 0", border: "none", background: "none", fontFamily: "'Inter',sans-serif" }}>+ Agregar</button>
  </div>
);

const IBtn = ({ onClick, icon, danger, title: btnTitle, style: s, ...p }) => <button onClick={onClick} title={btnTitle} {...p} style={{ width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--sidebar-border)", background: danger ? "var(--color-error-soft)" : "var(--color-bg)", borderRadius: 10, cursor: "pointer", color: danger ? "var(--red)" : "var(--sidebar-text)", transition: "all .2s cubic-bezier(.4,0,.2,1)", ...s }}>{icon}</button>;

const Empty = ({ cols, msg }) => { const displayMsg = typeof msg === "string" && !msg.includes("🎉") && !msg.includes("📋") ? "📋 " + msg : msg; return <tr><td colSpan={cols} style={{ textAlign: "center", padding: "56px 20px", color: "var(--sidebar-text-muted)", fontSize: 14, background: "linear-gradient(180deg, var(--color-surface-2), var(--color-bg))" }}><div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}><div style={{ width: 48, height: 48, borderRadius: 14, background: "var(--sidebar-hover)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 4 }}><FileText size={22} style={{ color: "var(--color-text-faint)" }} /></div><span>{displayMsg}</span></div></td></tr>; };

/* ═══════ TABLE STYLES ═══════ */
/* Cabeceras / celdas alineadas a tablas Pendientes (clients-thead / filas) */
const TH = { textAlign: "left", padding: "12px 18px", fontSize: 10.5, fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: 0.8, background: "var(--color-surface-2)", borderBottom: "1px solid var(--color-divider)", fontFamily: "var(--font-body)" };

/** Recharts en Resumen pro: leen variables de `.hm-resumen-pro` (claro / oscuro) */
const REP_CHART_GRID = "var(--hm-pro-chart-grid, #eef2f7)";
const REP_CHART_GRID_SOFT = "var(--hm-pro-chart-grid-soft, #f1f5f9)";
const REP_CHART_TICK = { fontSize: 10, fill: "var(--hm-pro-chart-tick, #64748b)" };
const REP_CHART_TICK_AXIS = { fontSize: 10.5, fill: "var(--hm-pro-chart-tick-strong, #475569)", fontWeight: 500 };
const REP_CHART_TOOLTIP = {
  borderRadius: 14,
  fontSize: 12,
  border: "1px solid var(--hm-pro-tooltip-border, #e2e8f0)",
  boxShadow: "var(--hm-pro-tooltip-shadow, 0 12px 40px rgba(15,23,42,.12))",
  padding: "8px 12px",
  background: "var(--hm-pro-tooltip-bg, #ffffff)",
  color: "var(--color-text, #0f172a)",
};
const REP_CHART_LEGEND = { fontSize: 11, color: "var(--color-text-muted, #64748b)" };
const REP_CHART_DOT_RING = "var(--hm-pro-chart-dot-ring, #ffffff)";
const TD = { padding: "12px 18px", fontSize: 14, borderBottom: "1px solid var(--color-divider)", verticalAlign: "middle", fontFamily: "var(--font-body)" };
/* Mismos números que Pendientes: Inter + tabular-nums (no monospace en tablas) */
const MN = { fontFamily: "var(--font-body)", fontVariantNumeric: "tabular-nums", fontSize: 12.5, fontWeight: 600, letterSpacing: -0.2 };

/* ═══════ MAIN APP ═══════ */
export default function App({ role = "gerente", clientId = null, userEmail = null }) {
  const sb = useSupabaseData(role, clientId);
  const { clients, gastos, cobros, garantias, manual, loading: dataLoading, error: dataError, refetch: refetchData, mutations, uid: uidGen } = sb;
  const isCliente = role === "cliente";
  const [gerenteNombre, setGerenteNombre] = useState(() => { try { if (typeof window === "undefined") return ""; const v = localStorage.getItem("hm_gerente_nombre"); if (v == null) return ""; const p = JSON.parse(v); return typeof p === "string" ? p : ""; } catch { return ""; } });
  const [gerenteAvatarUrl, setGerenteAvatarUrl] = useState("");
  const [localGerenteAvatarUrl, setLocalGerenteAvatarUrl] = useState(() => { try { if (typeof window === "undefined") return ""; return localStorage.getItem("hm_gerente_avatar_url") || ""; } catch { return ""; } });
  const [uploadingGerenteAvatar, setUploadingGerenteAvatar] = useState(false);
  const avatarInputRef = useRef(null);
  const [savingAcceso, setSavingAcceso] = useState(false);
  const [accesoResultado, setAccesoResultado] = useState(null);
  const displayName = isCliente ? (clients[0]?.name || userEmail || "Cliente") : (gerenteNombre.trim() || (userEmail ? (userEmail.split("@")[0] || userEmail) : "") || "Gerente");
  const subLabel = isCliente ? (userEmail || null) : "Gerente";

  useEffect(() => {
    if (role !== "gerente" || !userEmail) return;
    let cancelled = false;
    getGerenteProfile(userEmail).then((p) => { if (!cancelled) setGerenteAvatarUrl(p.avatar_url || ""); });
    return () => { cancelled = true; };
  }, [role, userEmail]);

  /** Consola: diagnóstico tipografía (también `window.__HM_LOG_FONTS__()`). Sin “mount+0”: aún no existe `.hm-app` (loader/auth). */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const t1 = setTimeout(() => logHolisticFontDiagnostics("t+1.5s"), 1500);
    const t2 = setTimeout(() => logHolisticFontDiagnostics("t+4s"), 4000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const handleGerenteAvatarUpload = async (file) => {
    if (!userEmail || !file) return;
    try {
      setUploadingGerenteAvatar(true);
      const url = await uploadGerenteAvatar(userEmail, file);
      await updateGerenteAvatar(userEmail, url);
      setGerenteAvatarUrl(url);
    } catch (err) {
      alert(err?.message || "Error al subir la foto.");
    } finally {
      setUploadingGerenteAvatar(false);
    }
  };

  const handleEditarNombreGerente = () => {
    const actual = gerenteNombre.trim() || (userEmail ? userEmail.split("@")[0] : "") || "";
    const n = prompt("Nombre para mostrar en el panel:", actual);
    if (n != null) { const v = String(n).trim(); setGerenteNombre(v); S.s("gerente_nombre", v); }
  };

  const validPages = ["dashboard", "clientes", "gastos", "metricas", "cobros", "cobranza", "reportes", "garantias", "client-detail"];
  const getInitialPage = () => {
    if (typeof window === "undefined") return { page: "dashboard", curCl: null };
    const hash = window.location.hash.slice(1);
    const parts = hash.split("-");
    if (parts[0] === "client" && parts[1] === "detail" && parts[2]) return { page: "client-detail", curCl: parts.slice(2).join("-") };
    if (validPages.includes(hash)) return { page: hash, curCl: null };
    return { page: "dashboard", curCl: null };
  };
  const ini = getInitialPage();
  const [page, setPage] = useState(ini.page);
  const [curCl, setCurCl] = useState(ini.curCl || (role === "cliente" && clientId ? clientId : null));
  const [modal, setModal] = useState(null);
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState("");
  const [detailTab, setDetailTab] = useState("gastos");
  const [repCl, setRepCl] = useState(role === "cliente" && clientId ? clientId : "all");
  const [repPer, setRepPer] = useState(tm());
  const [repPerInput, setRepPerInput] = useState("");
  const [repPeriodoMes, setRepPeriodoMes] = useState(tm());
  const repPerInicio = repPeriodoMes ? repPeriodoMes + "-01" : "2020-01-01";
  const repPerFin = repPeriodoMes ? lastDayOfMonth(repPeriodoMes) : td();
  const [expRango, setExpRango] = useState({ gastos: { ini: "", fin: "" }, cobros: { ini: "", fin: "" }, garantias: { ini: "", fin: "" } });
  const [clientDetailPeriodo, setClientDetailPeriodo] = useState("");
  const [dashboardPeriodo, setDashboardPeriodo] = useState("");
  const [filterCliente, setFilterCliente] = useState({ gastos: "", cobros: "", garantias: "" });
  const [gastosSearch, setGastosSearch] = useState("");
  const [filterPeriodoGarantias, setFilterPeriodoGarantias] = useState("");
  const [gafFilterPeriodo, setGafFilterPeriodo] = useState("");
  const [gastosPeriodoReportes, setGastosPeriodoReportes] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  /** UUID reservado al abrir «Nuevo cliente»: permite subir avatar al bucket antes del INSERT. */
  const [newClientDraftId, setNewClientDraftId] = useState(null);
  const [selectedIds, setSelectedIds] = useState({ clientes: [], gastos: [], cobros: [], garantias: [] });
  const [pageNum, setPageNum] = useState({ clientes: 1, gastos: 1, cobros: 1, garantias: 1 });
  const [sortClientesBy, setSortClientesBy] = useState("nombre");
  /** Orden del Desglose por Usuario (Reportes), mismo criterio que Clientes */
  const [sortReportDesgloseBy, setSortReportDesgloseBy] = useState("nombre");

  const emptyCf = { codigo: "", name: "", ig: "", phones: [""], emails: [""], biz: "", notes: "", avatar_url: "" };
  const emptyGf = { clientId: clientId || "", fechaMovimiento: td(), mes: tm(), camp: "", gasto: "", fee: "10", notas: "", prepago: false };
  const emptyCof = { gastoIds: [], clientId: "", monto: "", fecha: td(), periodoResumen: "", hora: "", metodo: "", metodoManual: "", notas: "", distribucion: "orden", sinAsignarGasto: false };
  const emptyGaf = { clientId: clientId || "", gastoId: "", tipo: "Cuenta TikTok", desc: "", valor: "", estado: "Vigente", fechaColocacion: "", periodoResumen: "" };
  const emptyMf = { fecha: td(), conc: "", monto: "", tipo: "Gasto", nota: "" };

  const [cf, setCf] = useState(emptyCf);
  const [gf, setGf] = useState(emptyGf);
  const [cof, setCof] = useState(emptyCof);
  const [gaf, setGaf] = useState(emptyGaf);
  const [cobroComprobanteFiles, setCobroComprobanteFiles] = useState([]);
  const [cobroEditComprobantePaths, setCobroEditComprobantePaths] = useState([]);
  const [cobroEditSignedUrls, setCobroEditSignedUrls] = useState({});
  const [cobroPreviewViewer, setCobroPreviewViewer] = useState(null);
  const [cobroNewFileUrls, setCobroNewFileUrls] = useState([]);
  const cobroNewFileUrlsRef = useRef([]);
  const [cofGastosQuery, setCofGastosQuery] = useState("");
  const [cofFilterCliente, setCofFilterCliente] = useState("");
  const [cofFilterPeriodo, setCofFilterPeriodo] = useState("");
  const [garantiaImagenNewFiles, setGarantiaImagenNewFiles] = useState([]);
  const [garantiaEditComprobantePaths, setGarantiaEditComprobantePaths] = useState([]);
  const [garantiaEditSignedUrls, setGarantiaEditSignedUrls] = useState({});
  const [garantiaNewFileUrls, setGarantiaNewFileUrls] = useState([]);
  const garantiaNewFileUrlsRef = useRef([]);
  const [uploadingComprobantes, setUploadingComprobantes] = useState(false);
  const [comprobanteViewer, setComprobanteViewer] = useState(null);
  const [viewerSignedUrls, setViewerSignedUrls] = useState([]);
  const [mf, setMf] = useState(emptyMf);
  const [gfClientNameInput, setGfClientNameInput] = useState("");
  const [bulkFee, setBulkFee] = useState("");
  const [bulkFeeScope, setBulkFeeScope] = useState("selected"); // "selected" | "filtered"

  /* Synced gastos with computed fields — hooks must run before any early return */
  const sGastos = useMemo(() => gastos.map((g) => {
    const t = gTotal(g), f = gFee(g), p = cobros.filter((c) => c.gastoId === g.id).reduce((a, c) => a + parseFloat(c.monto || 0), 0);
    return { ...g, _t: t, _f: f, _p: p, _pend: Math.max(0, t - p), _st: p >= t ? "Pagado" : p > 0 ? "Parcial" : "Pendiente" };
  }), [gastos, cobros]);

  /* Client aggregate data (incluye cobros sin asignar gasto: sin gastoId y con clientId = cid) */
  const cData = useCallback((cid) => {
    const gs = sGastos.filter((g) => g.clientId === cid);
    const tG = gs.reduce((a, g) => a + parseFloat(g.gasto || 0), 0);
    const tF = gs.reduce((a, g) => a + g._f, 0);
    const cobradoEnGastos = gs.reduce((a, g) => a + g._p, 0);
    const cobradoSinAsignar = cobros
      .filter((c) => !c.gastoId && c.clientId && String(c.clientId) === String(cid))
      .reduce((a, c) => a + parseFloat(c.monto || 0), 0);
    const tP = cobradoEnGastos + cobradoSinAsignar;
    const tGar = garantias.filter((g) => g.clientId === cid && g.estado === "Vigente").reduce((a, g) => a + parseFloat(g.valor || 0), 0);
    const gross = tG + tF - tP;
    return { tG, tF, tP, tGar, gross, net: Math.max(0, gross - tGar) };
  }, [sGastos, garantias, cobros]);

  /* Totals */
  const tots = useMemo(() => {
    const tG = sGastos.reduce((a, g) => a + parseFloat(g.gasto || 0), 0);
    const tF = sGastos.reduce((a, g) => a + g._f, 0);
    const tP = cobros.reduce((a, c) => a + parseFloat(c.monto || 0), 0);
    const tGar = garantias.filter((g) => g.estado === "Vigente").reduce((a, g) => a + parseFloat(g.valor || 0), 0);
    return { tG, tF, tP, tGar, net: Math.max(0, tG + tF - tP - tGar) };
  }, [sGastos, cobros, garantias]);

  const pendN = sGastos.filter((g) => g._st !== "Pagado").length;
  const months = getMonths(6);

  /* Months available */
  const allMonths = useMemo(() => {
    const s = new Set(gastos.map((g) => g.mes).filter(Boolean));
    const now = new Date(); for (let i = 0; i < 12; i++) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); s.add(d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0")); }
    return [...s].sort().reverse();
  }, [gastos]);

  /* ═══ REPORT DATA (por rango de fechas: desde–hasta; garantías deducted per client) ═══ */
  const repData = useMemo(() => {
    let gs = sGastos;
    if (repPerInicio && repPerFin) {
      const fOp = (g) => (g.fechaMovimiento || "").slice(0, 10);
      gs = gs.filter((g) => {
        const d = fOp(g);
        if (!d) return false;
        if (repPerInicio && d < repPerInicio) return false;
        if (repPerFin && d > repPerFin) return false;
        return true;
      });
    }
    if (repCl !== "all") gs = gs.filter((g) => g.clientId === repCl);

    const garantiasParaReporte = garantias.filter((g) => {
      if (g.estado !== "Vigente") return false;
      if (repPerInicio && repPerFin) {
        const mesG = mesGarantiaResumen(g, gastos);
        const mesIni = (repPerInicio || "").slice(0, 7);
        const mesFin = (repPerFin || "").slice(0, 7);
        if (!mesG) return false;
        return mesG >= mesIni && mesG <= mesFin;
      }
      return true;
    });

    const mesIni = (repPerInicio || "").slice(0, 7);
    const mesFin = (repPerFin || "").slice(0, 7);
    const bc = {};
    gs.forEach((g) => {
      if (!bc[g.clientId]) bc[g.clientId] = { ads: 0, fee: 0, total: 0, paid: 0 };
      bc[g.clientId].ads += parseFloat(g.gasto || 0);
      bc[g.clientId].fee += g._f;
      bc[g.clientId].total += g._t;
    });
    /* Cobrado (PAGADO) por período del cobro: mesCobro(c) debe caer en el rango del reporte (igual que en resumen de cliente) */
    cobros.forEach((c) => {
      const cid = c.gastoId ? (gastos.find((x) => x.id === c.gastoId)?.clientId) : (c.clientId || null);
      if (!cid) return;
      if (repCl !== "all" && cid !== repCl) return;
      const mes = mesCobro(c, gastos);
      if (repPerInicio && repPerFin && mesIni && mesFin && (mes < mesIni || mes > mesFin)) return;
      if (!bc[cid]) bc[cid] = { ads: 0, fee: 0, total: 0, paid: 0 };
      bc[cid].paid += parseFloat(c.monto || 0);
    });
    /* Clientes con garantía en el período pero sin gasto (fecha) ni cobro en ese mes: igual aparecen en el desglose */
    garantiasParaReporte.forEach((g) => {
      const cid = g.clientId;
      if (!cid) return;
      if (repCl !== "all" && String(cid) !== String(repCl)) return;
      if (!bc[cid]) bc[cid] = { ads: 0, fee: 0, total: 0, paid: 0 };
    });

    const rows = Object.entries(bc).map(([cid, d]) => {
      const gar = garantiasParaReporte.filter((g) => g.clientId === cid).reduce((a, g) => a + parseFloat(g.valor || 0), 0);
      const pend = Math.max(0, d.total - d.paid);
      const netPend = Math.max(0, pend - gar);
      return { cid, name: clients.find((c) => c.id === cid)?.name || "—", ...d, gar, pending: pend, netPending: netPend };
    });
    const t = rows.reduce((a, r) => ({ ads: a.ads + r.ads, fee: a.fee + r.fee, total: a.total + r.total, paid: a.paid + r.paid, gar: a.gar + r.gar, pending: a.pending + r.pending, netPending: a.netPending + r.netPending }), { ads: 0, fee: 0, total: 0, paid: 0, gar: 0, pending: 0, netPending: 0 });

    const pie = (t.ads + t.fee) > 0
      ? [{ name: "ADS", value: t.ads, color: "#059669" }, { name: "FEE", value: t.fee, color: "var(--sidebar-text-active)" }].filter((d) => d.value > 0)
      : t.gar > 0
        ? [{ name: "Garantías (período)", value: t.gar, color: "#7c3aed" }]
        : [];

    return { rows, t, pie };
  }, [sGastos, repCl, repPerInicio, repPerFin, clients, garantias, gastos, cobros]);

  /* Filas del desglose ordenadas (mismo criterio que lista Clientes) */
  const repDataRowsSorted = useMemo(() => {
    const rows = [...repData.rows];
    if (!rows.length) return rows;
    switch (sortReportDesgloseBy) {
      case "nombre":
        return rows.sort((a, b) => (a.name || "").localeCompare(b.name || "", "es"));
      case "deuda":
        return rows.sort((a, b) => (b.netPending || 0) - (a.netPending || 0));
      case "deuda_menos":
        return rows.sort((a, b) => (a.netPending || 0) - (b.netPending || 0));
      case "total":
        return rows.sort((a, b) => (b.total || 0) - (a.total || 0));
      case "pagado":
        return rows.sort((a, b) => (b.paid || 0) - (a.paid || 0));
      case "ads":
        return rows.sort((a, b) => (b.ads || 0) - (a.ads || 0));
      case "garantia":
        return rows.sort((a, b) => (b.gar || 0) - (a.gar || 0));
      default:
        return rows;
    }
  }, [repData.rows, sortReportDesgloseBy]);

  /** % cobrado sobre total (Ads+Fee) para tarjetas KPI de la página Resumen (tabla) — mismo criterio que Crédito / detalle cliente. */
  const metricasKpiPct = useMemo(() => {
    const inv = parseFloat(repData.t.total) || 0;
    if (inv <= 0) return 0;
    return Math.min(100, ((parseFloat(repData.t.paid) || 0) / inv) * 100);
  }, [repData.t.total, repData.t.paid]);

  /* Reportes: meses en el rango desde–hasta para gráficas */
  const reportMonths = useMemo(() => {
    if (repPerInicio && repPerFin) {
      const r = [];
      let [y, m] = repPerInicio.split("-").map(Number);
      const [y2, m2] = repPerFin.split("-").map(Number);
      const endMonth = y2 * 12 + m2;
      for (let now = y * 12 + m; now <= endMonth; now++) {
        const yy = Math.floor(now / 12), mm = now % 12 || 12;
        const key = `${yy}-${String(mm).padStart(2, "0")}`;
        r.push({ key, label: fmtM(key) });
      }
      return r;
    }
    return months;
  }, [repPerInicio, repPerFin, months]);

  /* Reportes: datos para gráficas por mes en el rango desde–hasta */
  const repCharts = useMemo(() => {
    let gs = sGastos;
    if (repPerInicio && repPerFin) {
      const fOp = (g) => (g.fechaMovimiento || "").slice(0, 10);
      gs = gs.filter((g) => {
        const d = fOp(g);
        if (!d) return false;
        return d >= repPerInicio && d <= repPerFin;
      });
    }
    if (repCl !== "all") gs = gs.filter((g) => g.clientId === repCl);

    const cobrosEnPeriodo = cobros.filter((c) => {
      const f = (c.fecha || "").slice(0, 10);
      if (!f) return false;
      if (repPerInicio && repPerFin && (f < repPerInicio || f > repPerFin)) return false;
      if (repCl !== "all") {
        if (c.gastoId) { const g = gastos.find((x) => x.id === c.gastoId); if (!g || g.clientId !== repCl) return false; }
        else if (c.clientId !== repCl) return false;
      }
      return true;
    });

    const monthly = reportMonths.map((m) => {
      const gsM = sGastos.filter((g) => {
        if (g.mes !== m.key) return false;
        if (repCl !== "all" && g.clientId !== repCl) return false;
        if (repPerInicio && repPerFin) {
          const d = (g.fechaMovimiento || "").slice(0, 10);
          return d && d >= repPerInicio && d <= repPerFin;
        }
        return true;
      });
      const csM = cobros.filter((c) => {
        if (mesCobro(c, gastos) !== m.key) return false;
        if (repCl === "all") return true;
        const g = gastos.find((x) => x.id === c.gastoId);
        return (g && g.clientId === repCl) || c.clientId === repCl;
      });
      return {
        name: m.label,
        gasto: gsM.reduce((a, g) => a + parseFloat(g.gasto || 0), 0),
        fee: gsM.reduce((a, g) => a + g._f, 0),
        cobrado: csM.reduce((a, c) => a + parseFloat(c.monto || 0), 0),
      };
    });
    const methods = (() => {
      const m = {};
      cobrosEnPeriodo.forEach((c) => { m[c.metodo] = (m[c.metodo] || 0) + parseFloat(c.monto || 0); });
      return Object.entries(m).map(([n, v]) => ({ name: n, value: v, color: PC[n] || "#94a3b8" }));
    })();
    const debt = repData.rows.map((r) => ({ name: r.name, debt: r.netPending })).filter((d) => d.debt > 0).sort((a, b) => b.debt - a.debt).slice(0, 10);
    return { monthly, methods, debt };
  }, [sGastos, cobros, gastos, repCl, repPerInicio, repPerFin, reportMonths, repData.rows]);

  /* Resumen / reportes: semanas del mes (1–7, 8–14, …) — ads+fee por fecha de movimiento; cobrado por fecha de pago y período contable del cobro en el mes */
  const repWeeklySeries = useMemo(() => {
    if (!repPeriodoMes || !repPerInicio || !repPerFin) return [];
    const ym = normalizePeriod(repPeriodoMes);
    if (!ym) return [];
    const [y, mo] = ym.split("-").map(Number);
    if (!y || !mo) return [];
    const lastD = new Date(y, mo, 0).getDate();
    const mesIni = (repPerInicio || "").slice(0, 7);
    const mesFin = (repPerFin || "").slice(0, 7);
    const pad = (day) => `${y}-${String(mo).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const weeks = [];
    for (let start = 1; start <= lastD; start += 7) {
      const end = Math.min(start + 6, lastD);
      weeks.push({ ini: pad(start), fin: pad(end), label: `${start}–${end}` });
    }
    return weeks.map((w) => {
      let ads = 0;
      let fee = 0;
      let cobrado = 0;
      sGastos.forEach((g) => {
        if (repCl !== "all" && g.clientId !== repCl) return;
        const d = (g.fechaMovimiento || "").slice(0, 10);
        if (!d || d < w.ini || d > w.fin) return;
        ads += parseFloat(g.gasto || 0);
        fee += g._f;
      });
      cobros.forEach((c) => {
        const cid = c.gastoId ? gastos.find((x) => x.id === c.gastoId)?.clientId : c.clientId;
        if (!cid) return;
        if (repCl !== "all" && String(cid) !== String(repCl)) return;
        const mesC = mesCobro(c, gastos);
        if (!mesC || mesC < mesIni || mesC > mesFin) return;
        const f = (c.fecha || "").slice(0, 10);
        if (!f || f < w.ini || f > w.fin) return;
        cobrado += parseFloat(c.monto || 0);
      });
      return {
        name: w.label,
        rangeLabel: `${fmtD(w.ini)} – ${fmtD(w.fin)}`,
        ads,
        fee,
        cobrado,
      };
    });
  }, [repPeriodoMes, repPerInicio, repPerFin, repCl, sGastos, cobros, gastos]);

  const repWeeklySummary = useMemo(() => {
    if (!repWeeklySeries.length) {
      return { invTotal: 0, cobTotal: 0, weeksWithInv: 0, weeksWithCob: 0, maxInvWeek: 0, maxCobWeek: 0 };
    }
    const reduced = repWeeklySeries.reduce(
      (acc, w) => {
        const inv = (w.ads || 0) + (w.fee || 0);
        const cob = w.cobrado || 0;
        return {
          invTotal: acc.invTotal + inv,
          cobTotal: acc.cobTotal + cob,
          weeksWithInv: acc.weeksWithInv + (inv > 0 ? 1 : 0),
          weeksWithCob: acc.weeksWithCob + (cob > 0 ? 1 : 0),
        };
      },
      { invTotal: 0, cobTotal: 0, weeksWithInv: 0, weeksWithCob: 0 },
    );
    const maxInvWeek = Math.max(0, ...repWeeklySeries.map((w) => (w.ads || 0) + (w.fee || 0)));
    const maxCobWeek = Math.max(0, ...repWeeklySeries.map((w) => w.cobrado || 0));
    return { ...reduced, maxInvWeek, maxCobWeek };
  }, [repWeeklySeries]);

  const resumenHeroDateLabel = useMemo(
    () =>
      new Date().toLocaleDateString("es-PE", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    [],
  );

  /* Dashboard charts */
  const dCharts = useMemo(() => ({
    monthly: months.map((m) => {
      const gs = sGastos.filter((g) => g.mes === m.key);
      const cs = cobros.filter((c) => mesCobro(c, gastos) === m.key);
      return { name: m.label, gasto: gs.reduce((a, g) => a + parseFloat(g.gasto || 0), 0), fee: gs.reduce((a, g) => a + g._f, 0), cobrado: cs.reduce((a, c) => a + parseFloat(c.monto || 0), 0) };
    }),
    methods: (() => { const m = {}; cobros.forEach((c) => { m[c.metodo] = (m[c.metodo] || 0) + parseFloat(c.monto || 0); }); return Object.entries(m).map(([n, v]) => ({ name: n, value: v, color: PC[n] || "#94a3b8" })); })(),
    debt: clients.map((c) => ({ name: c.name, debt: cData(c.id).net })).filter((c) => c.debt > 0).sort((a, b) => b.debt - a.debt).slice(0, 6),
  }), [sGastos, cobros, clients, months, cData]);

  /* Dashboard (resumen general) filtrado por período cuando el usuario elige un mes */
  const dashboardTots = useMemo(() => {
    if (!dashboardPeriodo) return tots;
    const gs = sGastos.filter((g) => g.mes === dashboardPeriodo);
    const cs = cobros.filter((c) => mesCobro(c, gastos) === normalizePeriod(dashboardPeriodo));
    const tG = gs.reduce((a, g) => a + parseFloat(g.gasto || 0), 0);
    const tF = gs.reduce((a, g) => a + g._f, 0);
    const tP = cs.reduce((a, c) => a + parseFloat(c.monto || 0), 0);
    const per = normalizePeriod(dashboardPeriodo);
    const tGar = garantias.filter((g) => g.estado === "Vigente" && mesGarantiaResumen(g, gastos) === per).reduce((a, g) => a + parseFloat(g.valor || 0), 0);
    return { tG, tF, tP, tGar, net: Math.max(0, tG + tF - tP - tGar) };
  }, [dashboardPeriodo, tots, sGastos, cobros, gastos, garantias]);

  const dashboardCharts = useMemo(() => {
    if (!dashboardPeriodo) return dCharts;
    const gs = sGastos.filter((g) => g.mes === dashboardPeriodo);
    const cs = cobros.filter((c) => mesCobro(c, gastos) === normalizePeriod(dashboardPeriodo));
    const one = {
      name: fmtM(dashboardPeriodo),
      gasto: gs.reduce((a, g) => a + parseFloat(g.gasto || 0), 0),
      fee: gs.reduce((a, g) => a + g._f, 0),
      cobrado: cs.reduce((a, c) => a + parseFloat(c.monto || 0), 0),
    };
    const m = {};
    cs.forEach((c) => { m[c.metodo] = (m[c.metodo] || 0) + parseFloat(c.monto || 0); });
    return {
      monthly: [one],
      methods: Object.entries(m).map(([n, v]) => ({ name: n, value: v, color: PC[n] || "#94a3b8" })),
      debt: dCharts.debt,
    };
  }, [dashboardPeriodo, dCharts, sGastos, cobros, gastos]);

  const dashboardPendientes = useMemo(() => {
    let list = sGastos.filter((g) => g._st !== "Pagado");
    if (dashboardPeriodo) list = list.filter((g) => g.mes === dashboardPeriodo);
    return list.sort((a, b) => (b.mes || "").localeCompare(a.mes || "z")).slice(0, 10);
  }, [sGastos, dashboardPeriodo]);

  /* Client charts */
  const cCharts = useMemo(() => {
    if (!curCl) return { m: [], co: [] };
    const gids = gastos.filter((g) => g.clientId === curCl).map((g) => g.id);
    return {
      m: months.map((m) => { const gs = sGastos.filter((g) => g.clientId === curCl && g.mes === m.key); return { name: m.label, gasto: gs.reduce((a, g) => a + parseFloat(g.gasto || 0), 0), fee: gs.reduce((a, g) => a + g._f, 0) }; }),
      co: months.map((m) => ({ name: m.label, cobrado: cobros.filter((c) => gids.includes(c.gastoId) && mesCobro(c, gastos) === m.key).reduce((a, c) => a + parseFloat(c.monto || 0), 0) })),
    };
  }, [curCl, sGastos, cobros, gastos, months]);

  /* Gastos filtrados por fecha de operación y por cliente (para tabla y export); orden: mayor a menor por total (gasto + fee) */
  const gastosFiltrados = useMemo(() => {
    let list = [...sGastos];
    if (filterCliente.gastos) list = list.filter((g) => g.clientId === filterCliente.gastos);
    const fOp = (g) => (g.fechaMovimiento || "").slice(0, 10);
    if (expRango.gastos.ini) list = list.filter((g) => fOp(g) >= expRango.gastos.ini);
    if (expRango.gastos.fin) list = list.filter((g) => fOp(g) <= expRango.gastos.fin);
    if (gastosSearch && gastosSearch.trim()) {
      const q = gastosSearch.trim().toLowerCase();
      list = list.filter((g) => {
        const c = clients.find((x) => x.id === g.clientId);
        const text = `${c?.name || ""} ${fmtM(g.mes)} ${g.codigo || ""} ${g.camp || ""}`.toLowerCase();
        return text.includes(q);
      });
    }
    return list.sort((a, b) => (parseFloat(b._t) || 0) - (parseFloat(a._t) || 0));
  }, [sGastos, filterCliente.gastos, expRango.gastos.ini, expRango.gastos.fin, gastosSearch, clients]);

  /* Cobros filtrados por cliente y por rango de fechas (para tabla y Excel) */
  const cobrosFiltrados = useMemo(() => {
    let list = cobros;
    if (filterCliente.cobros) {
      list = list.filter((co) => {
        const g = gastos.find((x) => x.id === co.gastoId);
        return (g && g.clientId === filterCliente.cobros) || co.clientId === filterCliente.cobros;
      });
    }
    const ini = expRango.cobros.ini;
    const fin = expRango.cobros.fin;
    if (ini) list = list.filter((c) => (c.fecha || "").slice(0, 10) >= ini);
    if (fin) list = list.filter((c) => (c.fecha || "").slice(0, 10) <= fin);
    return list;
  }, [cobros, gastos, filterCliente.cobros, expRango.cobros.ini, expRango.cobros.fin]);

  /* Garantías filtradas por cliente y período (para tabla) */
  const garantiasFiltradas = useMemo(() => {
    let list = garantias;
    if (filterCliente.garantias) list = list.filter((g) => g.clientId === filterCliente.garantias);
    if (filterPeriodoGarantias) list = list.filter((g) => mesGarantiaResumen(g, gastos) === normalizePeriod(filterPeriodoGarantias));
    return list;
  }, [garantias, filterCliente.garantias, filterPeriodoGarantias, gastos]);

  /* Resumen de aplicación del cobro: cómo se reparte el monto entre los gastos (voucher exacto) */
  const resumenCobro = useMemo(() => {
    const ids = Array.isArray(cof.gastoIds) ? cof.gastoIds.filter(Boolean) : [];
    const montoTotal = parseFloat(cof.monto) || 0;
    if (!ids.length || montoTotal <= 0) return { lineas: [], excedente: 0, totalAplicado: 0 };
    const gastosSel = ids.map((gid) => sGastos.find((g) => g.id === gid)).filter(Boolean);
    const totalPend = gastosSel.reduce((a, g) => a + g._pend, 0);
    const esOrden = cof.distribucion === "orden";
    if (esOrden) {
      const ordenados = [...gastosSel].sort((a, b) => (a.mes || "").localeCompare(b.mes || "") || (a.fechaMovimiento || "").localeCompare(b.fechaMovimiento || ""));
      let rest = montoTotal;
      const lineas = [];
      for (const g of ordenados) {
        const aplicado = Math.min(rest, Math.max(0, g._pend));
        if (aplicado > 0) lineas.push({ gastoId: g.id, g, camp: g.camp || "—", mes: g.mes, codigo: g.codigo || "—", pendienteAntes: g._pend, montoAplicado: aplicado, pendienteDespues: g._pend - aplicado });
        rest -= aplicado;
        if (rest <= 0) break;
      }
      const totalAplicado = lineas.reduce((a, l) => a + l.montoAplicado, 0);
      const excedente = Math.max(0, montoTotal - totalAplicado);
      return { lineas, excedente, totalAplicado };
    }
    const montoARepartir = Math.min(montoTotal, totalPend);
    const totalCents = Math.round(montoARepartir * 100);
    const partCents = ids.map((gid) => { const g = sGastos.find((x) => x.id === gid); const prop = g && totalPend > 0 ? g._pend / totalPend : 0; return Math.round(prop * totalCents); });
    let diff = totalCents - partCents.reduce((a, b) => a + b, 0);
    if (partCents.length) partCents[0] += diff;
    const montos = partCents.map((c) => c / 100);
    const lineas = gastosSel.map((g, i) => ({ gastoId: g.id, g, camp: g.camp || "—", mes: g.mes, codigo: g.codigo || "—", pendienteAntes: g._pend, montoAplicado: montos[i] ?? 0, pendienteDespues: g._pend - (montos[i] ?? 0) }));
    const totalAplicado = lineas.reduce((a, l) => a + l.montoAplicado, 0);
    const excedente = Math.max(0, montoTotal - totalAplicado);
    return { lineas, excedente, totalAplicado };
  }, [cof.gastoIds, cof.monto, cof.distribucion, sGastos]);

  /* ═══ MODALS ═══ */
  const openMdl = (type, eid = null) => {
    setEditId(eid);
    setModal(type);
    if (type === "client") {
      if (eid) setNewClientDraftId(null);
      else {
        setNewClientDraftId(
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
                const r = (Math.random() * 16) | 0;
                const v = c === "x" ? r : (r & 0x3) | 0x8;
                return v.toString(16);
              })
        );
      }
    }
    if (type === "cobro" && !eid) { setCof(emptyCof); setCofFilterCliente(""); setCofFilterPeriodo(""); setCobroEditComprobantePaths([]); }
    if (type === "garantia" && !eid) { setGarantiaEditComprobantePaths([]); setGarantiaImagenNewFiles([]); }
  };
  const closeMdl = () => {
    setModal(null);
    setEditId(null);
    setCf(emptyCf);
    setGf({ ...emptyGf, clientId: curCl || "" });
    setCof(emptyCof);
    setGaf({ ...emptyGaf, clientId: curCl || "" });
    setAccesoResultado(null);
    setCobroComprobanteFiles([]);
    setCobroEditComprobantePaths([]);
    setCobroEditSignedUrls({});
    setCobroPreviewViewer(null);
    setCofGastosQuery("");
    setCofFilterCliente("");
    setCofFilterPeriodo("");
    setGarantiaImagenNewFiles([]);
    setGarantiaEditComprobantePaths([]);
    setGarantiaEditSignedUrls({});
    setGafFilterPeriodo("");
    setGfClientNameInput("");
    setBulkFee("");
    setBulkFeeScope("selected");
    setNewClientDraftId(null);
  };
  const openGarantiaForClientId = (cid) => { setGaf({ ...emptyGaf, clientId: cid || "" }); setModal("garantia"); setEditId(null); };
  const openCobroForGastoId = (gid) => { const g = sGastos.find((x) => x.id === gid); if (g) setCof({ ...emptyCof, gastoIds: [g.id], monto: g._pend.toFixed(2), fecha: td() }); setEditId(null); setModal("cobro"); };

  useEffect(() => {
    if (!modal) return;
    if (modal === "client" && editId) { const c = clients.find((x) => x.id === editId); if (c) setCf({ codigo: c.codigo || "", name: c.name, ig: c.ig || "", phones: c.phones?.length ? c.phones : [""], emails: c.emails?.length ? c.emails : [""], biz: c.biz || "", notes: c.notes || "", avatar_url: c.avatar_url || "" }); }
    if (modal === "dar-acceso") setAccesoResultado(null);
    if (modal === "gasto" && editId) { const g = gastos.find((x) => x.id === editId); if (g) { setGf({ clientId: g.clientId, fechaMovimiento: g.fechaMovimiento || (g.mes ? g.mes + "-15" : td()), mes: g.mes || tm(), camp: g.camp || "", gasto: String(g.gasto), fee: String(g.fee), notas: g.notas || "", prepago: !!g.prepago }); setGfClientNameInput(clients.find((c) => c.id === g.clientId)?.name || ""); } }
    if (modal === "gasto" && !editId && curCl) { setGf((p) => ({ ...p, clientId: curCl })); setGfClientNameInput(clients.find((c) => c.id === curCl)?.name || ""); }
    if (modal === "gasto" && !editId && !curCl) setGfClientNameInput("");
    if (modal === "garantia" && editId) { const gar = garantias.find((x) => x.id === editId); if (gar) { const pr = (gar.periodoResumen && String(gar.periodoResumen).trim()) ? normalizePeriod(gar.periodoResumen) : (mesGarantiaResumen(gar, gastos) || tm()); setGaf({ clientId: gar.clientId, gastoId: gar.gastoId || "", tipo: gar.tipo || "Cuenta TikTok", desc: gar.desc || "", valor: gar.valor || "", estado: gar.estado || "Vigente", fechaColocacion: gar.fechaColocacion || "", periodoResumen: pr }); setGafFilterPeriodo(pr); const urls = gar.imagen_urls; setGarantiaEditComprobantePaths(Array.isArray(urls) ? [...urls] : urls ? [urls] : []); } }
    else if (modal === "garantia") { const pr0 = (clientDetailPeriodo && normalizePeriod(clientDetailPeriodo)) || tm(); setGaf((p) => ({ ...emptyGaf, clientId: curCl || p.clientId, periodoResumen: pr0 })); setGafFilterPeriodo(pr0); setGarantiaEditComprobantePaths([]); }
    if (modal === "cobro" && editId) {
      const co = cobros.find((x) => x.id === editId);
      if (co) {
        const coMetodo = String(co.metodo || "").trim();
        const isPredefinedMetodo = PM.includes(coMetodo);
        setCof({
          gastoIds: co.gastoId ? [co.gastoId] : [],
          sinAsignarGasto: !co.gastoId,
          clientId: co.clientId || "",
          monto: String(co.monto),
          fecha: (co.fecha || "").slice(0, 10) || td(),
          periodoResumen: co.periodoResumen || (co.fecha || "").slice(0, 7) || "",
          hora: co.hora || "",
          metodo: isPredefinedMetodo ? coMetodo : OTRO_METODO_VALUE,
          metodoManual: isPredefinedMetodo ? "" : coMetodo,
          notas: co.notas || "",
        });
        const urls = co.comprobante_urls;
        setCobroEditComprobantePaths(Array.isArray(urls) ? [...urls] : urls ? [urls] : []);
      }
    }
  }, [modal, editId, clients, garantias, cobros, gastos, clientDetailPeriodo]);

  useEffect(() => { if (isCliente && page === "cobros") setPage("dashboard"); }, [isCliente, page]);
  useEffect(() => { if (!isCliente && page === "reportes") setPage("dashboard"); }, [isCliente, page]);
  /** Página Resumen (tabla): al entrar, todos los clientes + período = mes calendario anterior al actual. */
  useEffect(() => {
    if (page !== "metricas" || isCliente) return;
    setRepCl("all");
    const base = tm();
    const [y, m] = base.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    setRepPeriodoMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    setSortReportDesgloseBy("nombre");
  }, [page, isCliente]);

  useEffect(() => {
    if (!comprobanteViewer?.paths?.length) { setViewerSignedUrls([]); return; }
    setViewerSignedUrls(comprobanteViewer.paths.map(() => null));
    Promise.all(comprobanteViewer.paths.map((p) => getComprobanteSignedUrl(p))).then((urls) => setViewerSignedUrls(urls));
  }, [comprobanteViewer]);

  useEffect(() => {
    if (modal === "cobro" && editId && cobroEditComprobantePaths.length > 0) {
      const pathList = cobroEditComprobantePaths;
      Promise.all(pathList.map((p) => getComprobanteSignedUrl(p))).then((urls) => {
        const next = {};
        pathList.forEach((p, i) => { next[p] = urls?.[i] ?? null; });
        setCobroEditSignedUrls((prev) => ({ ...prev, ...next }));
      });
    } else {
      setCobroEditSignedUrls({});
    }
  }, [modal, editId, cobroEditComprobantePaths]);

  useEffect(() => {
    cobroNewFileUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    const urls = cobroComprobanteFiles.map((f) => URL.createObjectURL(f));
    cobroNewFileUrlsRef.current = urls;
    setCobroNewFileUrls(urls);
  }, [cobroComprobanteFiles]);

  useEffect(() => {
    if (modal === "garantia" && editId && garantiaEditComprobantePaths.length > 0) {
      const pathList = garantiaEditComprobantePaths;
      Promise.all(pathList.map((p) => getComprobanteSignedUrl(p))).then((urls) => {
        const next = {};
        pathList.forEach((p, i) => { next[p] = urls?.[i] ?? null; });
        setGarantiaEditSignedUrls((prev) => ({ ...prev, ...next }));
      });
    } else {
      setGarantiaEditSignedUrls({});
    }
  }, [modal, editId, garantiaEditComprobantePaths]);

  useEffect(() => {
    garantiaNewFileUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    const urls = garantiaImagenNewFiles.map((f) => URL.createObjectURL(f));
    garantiaNewFileUrlsRef.current = urls;
    setGarantiaNewFileUrls(urls);
  }, [garantiaImagenNewFiles]);

  const clientsSorted = useMemo(() => [...clients].sort((a, b) => (a.name || "").localeCompare((b.name || ""), "es")), [clients]);
  const clientsFiltered = useMemo(() => clientsSorted.filter((c) => !search || (c.name || "").toLowerCase().includes(search.toLowerCase())), [clientsSorted, search]);
  const clientsFilteredAndSorted = useMemo(() => {
    const list = [...clientsFiltered];
    if (sortClientesBy === "nombre") return list.sort((a, b) => (a.name || "").localeCompare((b.name || ""), "es"));
    return list.sort((a, b) => {
      const dA = cData(a.id), dB = cData(b.id);
      switch (sortClientesBy) {
        case "deuda": return dB.net - dA.net;
        case "gasto": return dB.tG - dA.tG;
        case "cobrado": return dB.tP - dA.tP;
        default: return (a.name || "").localeCompare((b.name || ""), "es");
      }
    });
  }, [clientsFiltered, sortClientesBy, cData]);
  const clientFilterOptions = useMemo(() => [{ value: "", label: "Todos los clientes" }, ...clientsSorted.map((c) => ({ value: c.id, label: c.name }))], [clientsSorted]);

  /* ═══ CURRENT CLIENT DATA (hooks: deben ejecutarse antes del early return) ═══ */
  const curC = curCl ? clients.find((x) => x.id === curCl) : null;
  const curD = curCl ? cData(curCl) : null;
  const curGastos = curCl ? sGastos.filter((g) => g.clientId === curCl).sort((a, b) => (parseFloat(b._t) || 0) - (parseFloat(a._t) || 0)) : [];
  const curGids = curCl ? gastos.filter((g) => g.clientId === curCl).map((g) => g.id) : [];
  const curCobros = curCl ? cobros.filter((c) => curGids.includes(c.gastoId) || c.clientId === curCl).sort((a, b) => (b.created_at || b.fecha || "").localeCompare(a.created_at || a.fecha || "")) : [];
  const curGars = curCl ? garantias.filter((g) => g.clientId === curCl) : [];
  const curMan = curCl ? manual.filter((m) => m.clientId === curCl).sort((a, b) => (b.fecha || "").localeCompare(a.fecha || "")) : [];
  const curGastosDisplay = curCl && clientDetailPeriodo ? curGastos.filter((g) => g.mes === clientDetailPeriodo) : curGastos;
  const curCobrosDisplay = curCl && clientDetailPeriodo ? curCobros.filter((c) => mesCobro(c, gastos) === normalizePeriod(clientDetailPeriodo)) : curCobros;
  const curManDisplay = curCl && clientDetailPeriodo ? curMan.filter((m) => (m.fecha || "").slice(0, 7) === clientDetailPeriodo) : curMan;
  const curGarsDisplay = curCl && clientDetailPeriodo ? curGars.filter((g) => mesGarantiaResumen(g, gastos) === normalizePeriod(clientDetailPeriodo)) : curGars;
  const curDDisplay = useMemo(() => {
    if (!curCl) return null;
    if (!clientDetailPeriodo) return curD;
    const tG = curGastosDisplay.reduce((a, g) => a + parseFloat(g.gasto || 0), 0);
    const tF = curGastosDisplay.reduce((a, g) => a + g._f, 0);
    const tP = curCobrosDisplay.reduce((a, c) => a + parseFloat(c.monto || 0), 0);
    const tGar = curGarsDisplay.filter((g) => g.estado === "Vigente").reduce((a, g) => a + parseFloat(g.valor || 0), 0);
    const gross = tG + tF - tP;
    return { tG, tF, tP, tGar, gross, net: Math.max(0, gross - tGar) };
  }, [curCl, clientDetailPeriodo, curD, curGastosDisplay, curCobrosDisplay, curGarsDisplay]);

  /* Early returns only after all hooks have run */
  if (dataLoading) return (<div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-bg)", fontFamily: "'Inter',sans-serif" }}><div style={{ color: "var(--sidebar-text)", fontSize: 15 }}>Cargando datos…</div></div>);
  if (dataError) return (<div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-bg)", fontFamily: "'Inter',sans-serif", padding: 20 }}><div style={{ textAlign: "center", maxWidth: 400 }}><p style={{ color: "var(--red)", fontSize: 15, marginBottom: 20 }}>Error al cargar los datos: {dataError}</p><button type="button" onClick={() => refetchData()} style={{ padding: "12px 24px", border: "none", borderRadius: 10, background: "var(--sidebar-text-active)", color: "var(--color-text-inverse)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Reintentar</button></div></div>);

  /* ═══ CRUD (Supabase mutations) ═══ */
  const validateEmail = (e) => typeof e === "string" && e.trim().includes("@") && e.trim().length >= 5;
  const saveClient = async () => {
    const name = cf.name.trim();
    const phones = cf.phones.filter(Boolean);
    const emails = cf.emails.filter(Boolean);
    const validEmails = emails.filter(validateEmail);
    if (!name) return alert("Nombre obligatorio. Completá el nombre del cliente.");
    if (!validEmails.length) return alert("Correo obligatorio (es el dato más importante). Agregá al menos un correo válido que contenga @ y esté completo.");
    if (!phones.length) return alert("Teléfono obligatorio. Agregá al menos un número de teléfono o WhatsApp.");
    const codigo = (cf.codigo || "").trim();
    if (editId && !codigo) return alert("Código de cliente obligatorio. Completá el código.");
    if (!(cf.ig || "").trim()) return alert("Completá Instagram (ej. @usuario o — si no aplica).");
    if (!(cf.biz || "").trim()) return alert("Completá el negocio o actividad (o — si no aplica).");
    if (!(cf.notes || "").trim()) return alert("Completá las notas (o — si no aplica).");
    const av = (cf.avatar_url || "").trim().replace(/&amp;/gi, "&");
    if (av && isLikelyBlockedAvatarHotlinkUrl(av)) {
      if (!confirm("Las URLs de WhatsApp / Meta / Instagram suelen dar error 403 en Crédito (el servidor no deja mostrar la imagen aquí). Lo estable es usar «Subir foto» para guardarla en Supabase.\n\n¿Guardar esta URL igualmente?")) return;
    }
    const c = {
      id: editId || undefined,
      newClientId: !editId && newClientDraftId ? newClientDraftId : undefined,
      codigo: codigo || "",
      name,
      ig: (cf.ig || "").trim(),
      phones,
      emails,
      biz: (cf.biz || "").trim(),
      notes: (cf.notes || "").trim(),
      avatar_url: av || "",
    };
    await mutations.saveClient(c);
    closeMdl();
  };
  const delClient = async (id) => { if (!confirm("¿Eliminar cliente y todos sus datos?")) return; await mutations.delClient(id); closeMdl(); };
  const submitDarAcceso = async (regenerate = false) => { if (!editId) return; const client = clients.find((c) => c.id === editId); const firstEmail = (client?.emails || []).filter(Boolean)[0]; if (!firstEmail || !String(firstEmail).includes("@")) { alert("Este cliente no tiene correo. Agrega al menos uno en Editar cliente."); return; } try { setSavingAcceso(true); setAccesoResultado(null); const redirectTo = typeof window !== "undefined" ? (window.location.origin + "/credito") : ""; const res = await darAccesoCliente(editId, { regenerate, redirect_to: redirectTo }); setAccesoResultado(res); } catch (err) { alert(err?.message || "Error al dar acceso"); } finally { setSavingAcceso(false); } };

  const saveGasto = async () => { if (!gf.clientId || !parseFloat(gf.gasto)) return alert("Completa cliente y gasto"); const periodo = gf.mes || (gf.fechaMovimiento ? gf.fechaMovimiento.slice(0, 7) : tm()); const g = { id: editId || undefined, clientId: gf.clientId, fechaMovimiento: gf.fechaMovimiento || periodo + "-15", mes: periodo, camp: gf.camp || "", gasto: gf.gasto, fee: gf.fee || "10", notas: gf.notas || "", prepago: !!gf.prepago }; await mutations.saveGasto(g); closeMdl(); };
  const delGasto = async (id) => { if (!confirm("¿Eliminar gasto?")) return; await mutations.delGasto(id); };

  const saveCobro = async () => {
    const ids = Array.isArray(cof.gastoIds) ? cof.gastoIds.filter(Boolean) : (cof.gastoId ? [cof.gastoId] : []);
    const sinAsignar = !!cof.sinAsignarGasto;
    const metodoFinal = cof.metodo === OTRO_METODO_VALUE ? String(cof.metodoManual || "").trim() : String(cof.metodo || "").trim();
    if (!ids.length && !sinAsignar) return alert("Seleccioná al menos un gasto a los que aplicar el pago, o marcá «Ninguna» para registrar un cobro sin asignar.");
    if (sinAsignar && !cof.clientId) return alert("Para un cobro sin asignar a gasto, elegí el cliente.");
    if (!parseFloat(cof.monto) || !metodoFinal) return alert("Completá monto y método de pago.");
    const totalMonto = parseFloat(cof.monto) || 0;
    if (totalMonto <= 0) return alert("El monto debe ser mayor a 0");
    try {
      setUploadingComprobantes(true);
      if (editId && modal === "cobro") {
        await mutations.updateCobro(editId, { gastoId: ids.length ? ids[0] : null, clientId: ids.length ? null : (cof.clientId || null), monto: totalMonto, fecha: cof.fecha, periodoResumen: cof.sinAsignarGasto ? (cof.periodoResumen || null) : null, hora: cof.hora || null, metodo: metodoFinal, notas: cof.notas });
        const newPaths = [];
        for (const f of cobroComprobanteFiles) newPaths.push(await uploadComprobanteCobro(editId, f));
        const finalPaths = [...cobroEditComprobantePaths, ...newPaths];
        await mutations.setCobroComprobantes(editId, finalPaths);
        closeMdl();
        return;
      }
      if (sinAsignar || ids.length === 0) {
        const id = await mutations.saveCobro({ gastoId: null, clientId: cof.clientId || null, monto: totalMonto, fecha: cof.fecha, periodoResumen: cof.periodoResumen || null, hora: cof.hora || null, metodo: metodoFinal, notas: cof.notas });
        if (id && cobroComprobanteFiles.length > 0) {
          const paths = [];
          for (const f of cobroComprobanteFiles) paths.push(await uploadComprobanteCobro(id, f));
          await mutations.setCobroComprobantes(id, paths);
        }
        closeMdl();
        return;
      }
      const { lineas, excedente } = resumenCobro;
      const lineasConMonto = lineas.filter((l) => l.montoAplicado > 0);
      if (!lineasConMonto.length) return alert("El monto no alcanza a cubrir ningún gasto. Revisá la selección o el monto.");
      const createdIds = [];
      for (const l of lineasConMonto) {
        const id = await mutations.saveCobro({ gastoId: l.gastoId, monto: l.montoAplicado, fecha: cof.fecha, hora: cof.hora || null, metodo: metodoFinal, notas: cof.notas });
        if (id) createdIds.push(id);
      }
      if (excedente > 0 && lineasConMonto[0]?.g?.clientId) {
        const mesesAplicados = lineasConMonto.map((l) => l.g?.mes).filter(Boolean).sort();
        const ultimoMesGasto = mesesAplicados[mesesAplicados.length - 1] || tm();
        const periodoExcedente = addOneMonthYm(normalizePeriod(ultimoMesGasto));
        await mutations.saveGarantia({ clientId: lineasConMonto[0].g.clientId, gastoId: null, tipo: "Depósito", desc: "Excedente de cobro " + (cof.fecha || td()) + " — para mes siguiente", valor: String(excedente), estado: "Vigente", fechaColocacion: cof.fecha || "", periodoResumen: periodoExcedente });
      }
      if (cobroComprobanteFiles.length > 0 && createdIds.length > 0) {
        const paths = [];
        for (const f of cobroComprobanteFiles) paths.push(await uploadComprobanteCobro(createdIds[0], f));
        await mutations.setCobroComprobantes(createdIds[0], paths);
        for (let j = 1; j < createdIds.length; j++) {
          const pathsCopy = [];
          for (const f of cobroComprobanteFiles) pathsCopy.push(await uploadComprobanteCobro(createdIds[j], f));
          await mutations.setCobroComprobantes(createdIds[j], pathsCopy);
        }
      }
      closeMdl();
    } catch (err) {
      alert(err?.message || "Error al registrar el cobro");
    } finally {
      setUploadingComprobantes(false);
    }
  };
  const delCobro = async (id) => { if (!confirm("¿Eliminar?")) return; await mutations.delCobro(id); };

  const saveGar = async () => {
    if (!gaf.clientId) return alert("Selecciona cliente");
    try {
      setUploadingComprobantes(true);
      let prG = (gaf.periodoResumen && String(gaf.periodoResumen).trim()) ? normalizePeriod(gaf.periodoResumen) : "";
      if (!prG && gaf.gastoId) { const gg = gastos.find((x) => x.id === gaf.gastoId); if (gg?.mes) prG = normalizePeriod(gg.mes); }
      if (!prG && gaf.fechaColocacion) prG = normalizePeriod(String(gaf.fechaColocacion).slice(0, 7));
      if (!prG && gafFilterPeriodo) prG = normalizePeriod(gafFilterPeriodo);
      if (!prG) prG = tm();
      const id = await mutations.saveGarantia({ id: editId && modal === "garantia" ? editId : undefined, clientId: gaf.clientId, gastoId: (gaf.gastoId && String(gaf.gastoId).trim()) ? gaf.gastoId : null, tipo: gaf.tipo, desc: gaf.desc, valor: gaf.valor, estado: gaf.estado, fechaColocacion: gaf.fechaColocacion || "", periodoResumen: prG });
      const basePaths = editId ? garantiaEditComprobantePaths : [];
      const newPaths = [];
      for (const f of garantiaImagenNewFiles) {
        newPaths.push(await uploadComprobanteGarantia(id, f));
      }
      const allPaths = [...basePaths, ...newPaths];
      if (allPaths.length > 0) await mutations.setGarantiaImagenes(id, allPaths);
      closeMdl();
      const mesGar = prG;
      setRepCl(gaf.clientId);
      setRepPer(mesGar);
      setRepPerInput(mesGar);
      setRepPeriodoMes(mesGar);
      setPage("reportes");
    } catch (err) {
      alert(err?.message || "Error al guardar la garantía");
    } finally {
      setUploadingComprobantes(false);
    }
  };
  const delGar = async (id) => { if (!confirm("¿Eliminar?")) return; await mutations.delGarantia(id); };

  /* Selección y eliminación en lote */
  const toggleSelect = (listKey, id) => {
    setSelectedIds((p) => {
      const arr = p[listKey].includes(id) ? p[listKey].filter((x) => x !== id) : [...p[listKey], id];
      return { ...p, [listKey]: arr };
    });
  };
  const selectAllOnPage = (listKey, idsOnPage) => {
    setSelectedIds((p) => {
      const current = p[listKey];
      const allSelected = idsOnPage.every((id) => current.includes(id));
      const next = allSelected ? current.filter((id) => !idsOnPage.includes(id)) : [...new Set([...current, ...idsOnPage])];
      return { ...p, [listKey]: next };
    });
  };
  const clearSelection = (listKey) => setSelectedIds((p) => ({ ...p, [listKey]: [] }));

  const delClientesBulk = async () => {
    const ids = selectedIds.clientes;
    if (!ids.length || !confirm(`¿Eliminar ${ids.length} cliente(s) y todos sus datos?`)) return;
    for (const id of ids) await mutations.delClient(id);
    clearSelection("clientes");
  };
  const delGastosBulk = async () => {
    const ids = selectedIds.gastos;
    if (!ids.length || !confirm(`¿Eliminar ${ids.length} gasto(s)?`)) return;
    for (const id of ids) await mutations.delGasto(id);
    clearSelection("gastos");
  };
  const delCobrosBulk = async () => {
    const ids = selectedIds.cobros;
    if (!ids.length || !confirm(`¿Eliminar ${ids.length} cobro(s)?`)) return;
    for (const id of ids) await mutations.delCobro(id);
    clearSelection("cobros");
  };
  const delGarantiasBulk = async () => {
    const ids = selectedIds.garantias;
    if (!ids.length || !confirm(`¿Eliminar ${ids.length} garantía(s)?`)) return;
    for (const id of ids) await mutations.delGarantia(id);
    clearSelection("garantias");
  };

  const openBulkFeeModal = (scope = "selected") => {
    setBulkFeeScope(scope);
    setBulkFee("");
    setEditId(null);
    setModal("gasto-fee-bulk");
  };

  const applyBulkFee = async () => {
    if (isCliente) return;
    const feeNum = parseFloat(bulkFee);
    if (!Number.isFinite(feeNum)) {
      alert("Ingresá un Fee válido.");
      return;
    }
    let targetList = [];
    if (bulkFeeScope === "selected") {
      const idsSet = new Set(selectedIds.gastos);
      targetList = gastosFiltrados.filter((g) => idsSet.has(g.id));
    } else {
      targetList = gastosFiltrados;
    }
    if (!targetList.length) {
      alert("No hay gastos para actualizar con el criterio elegido.");
      return;
    }
    if (!confirm(`¿Actualizar el Fee a ${feeNum}% para ${targetList.length} gasto(s)?`)) return;
    try {
      await mutations.setGastosFeeBulk(targetList.map((g) => g.id), feeNum);
      clearSelection("gastos");
      closeMdl();
    } catch (err) {
      alert(err?.message || "Error al actualizar los Fee en lote.");
    }
  };

  const saveMan = async () => { if (!mf.conc.trim()) return alert("Concepto obligatorio"); await mutations.saveManual({ clientId: curCl, fecha: mf.fecha, conc: mf.conc, monto: mf.monto, tipo: mf.tipo, nota: mf.nota }); setMf(emptyMf); };

  /* ═══ EXPORT EXCEL ═══ */
  const expGastos = () => {
    const list = [...gastosFiltrados];
    const headers = ["Cliente", "Fecha (dd/mm/aaaa)", "Período (mm/aaaa)", "Campaña", "Código", "Gasto", "Fee %", "Fee $", "Total", "Pagado", "Garantía", "Pendiente", "A cobrar", "Estado", "Prepago"];
    const rows = list.map((g) => { const c = clients.find((x) => x.id === g.clientId); const garVal = garantias.filter((gr) => gr.clientId === g.clientId && gr.estado === "Vigente").reduce((a, gr) => a + parseFloat(gr.valor || 0), 0); const netCobrar = cData(g.clientId).net; return [c?.name || "—", fmtDD(g.fechaMovimiento), fmtM(g.mes), g.camp || "—", g.codigo || "—", fmtExcel(g.gasto), g.fee + "%", fmtExcel(g._f), fmtExcel(g._t), fmtExcel(g._p), garVal > 0 ? fmtExcel(garVal) : "—", fmtExcel(g._pend), fmtExcel(netCobrar), g._st, g.prepago ? "S" : "N"]; });
    exportToExcel("gastos_" + td(), "Gastos", headers, rows);
  };
  const expCobros = () => {
    const list = cobrosFiltrados;
    const headers = ["Cliente", "Cód. cobro", "Cód. gasto", "Fecha", "Hora", "Ref.", "Monto", "Método", "Registrado por", "Notas"];
    const rows = list.map((co) => { const g = gastos.find((x) => x.id === co.gastoId); const c = co.clientId ? clients.find((x) => x.id === co.clientId) : (g ? clients.find((x) => x.id === g.clientId) : null); return [c?.name || "—", co.codigo || "—", g?.codigo || "—", fmtD(co.fecha), fmtT(co.hora) || "—", g ? fmtM(g.mes) + " " + (g.camp || "") : "—", fmtExcel(co.monto), co.metodo || "—", co.created_by || "—", co.notas || "—"]; });
    exportToExcel("cobros_" + td(), "Cobros", headers, rows);
  };
  const expGarantias = () => {
    let list = [...garantias];
    const headers = ["Cliente", "Cód. verificación", "Cód. gasto", "Gasto ($)", "Tipo", "Descripción", "Valor", "Estado", "Fecha colocación", "Registrado por", "Registrado"];
    const rows = list.map((g) => { const c = clients.find((x) => x.id === g.clientId); const gastoAsoc = g.gastoId ? gastos.find((x) => x.id === g.gastoId) : null; return [c?.name || "—", g.codigoVerificacion || "—", gastoAsoc?.codigo || "—", gastoAsoc != null ? fmtExcel(gastoAsoc.gasto) : "—", g.tipo || "—", g.desc || "—", fmtExcel(g.valor), g.estado || "—", g.fechaColocacion ? fmtDD(g.fechaColocacion) : "—", g.created_by || "—", g.created_at ? fmtDt(g.created_at) : "—"]; });
    exportToExcel("garantias_" + td(), "Garantías", headers, rows);
  };
  const expClientes = () => {
    const headers = ["Código", "Nombre", "Instagram", "Teléfonos", "Emails", "Negocio", "Notas"];
    const rows = clientsSorted.map((c) => [
      c.codigo || "—",
      c.name || "—",
      c.ig || "—",
      (c.phones || []).filter(Boolean).join("; ") || "—",
      (c.emails || []).filter(Boolean).join("; ") || "—",
      c.biz || "—",
      (c.notes || "").slice(0, 200) || "—"
    ]);
    exportToExcel("clientes_" + td(), "Clientes", headers, rows);
  };

  const expClientData = (fechaIni, fechaFin) => {
    let gs = [...curGastos], cos = [...curCobros];
    const mesIni = fechaIni ? fechaIni.slice(0, 7) : null;
    const mesFin = fechaFin ? fechaFin.slice(0, 7) : null;
    if (mesIni) { gs = gs.filter((g) => (g.mes || g.fechaMovimiento?.slice(0, 7) || "") >= mesIni); cos = cos.filter((c) => (mesCobro(c, gastos) || "") >= mesIni); }
    if (mesFin) { gs = gs.filter((g) => (g.mes || g.fechaMovimiento?.slice(0, 7) || "") <= mesFin); cos = cos.filter((c) => (mesCobro(c, gastos) || "") <= mesFin); }
    const wb = XLSX.utils.book_new();
    const curDExp = curCl ? cData(curCl) : { tGar: 0, net: 0 };
    const hG = ["Fecha", "Período", "Campaña", "Gasto", "Fee %", "Fee $", "Total", "Pagado", "Garantía", "Pendiente", "A cobrar", "Estado", "Prepago", "Código"];
    const rG = gs.map((g) => [fmtDD(g.fechaMovimiento), fmtM(g.mes), g.camp || "—", fmtExcel(g.gasto), g.fee + "%", fmtExcel(g._f), fmtExcel(g._t), fmtExcel(g._p), curDExp.tGar > 0 ? fmtExcel(curDExp.tGar) : "—", fmtExcel(g._pend), fmtExcel(curDExp.net), g._st, g.prepago ? "S" : "N", g.codigo || "—"]);
    const wsG = XLSX.utils.aoa_to_sheet([hG, ...rG]); XLSX.utils.book_append_sheet(wb, wsG, "Gastos");
    const hC = ["Fecha", "Hora", "Cód. cobro", "Cód. gasto", "Monto", "Método", "Notas"];
    const rC = cos.map((co) => { const g = gastos.find((x) => x.id === co.gastoId); return [fmtD(co.fecha), fmtT(co.hora) || "—", co.codigo || "—", g?.codigo || "—", fmtExcel(co.monto), co.metodo || "—", co.notas || "—"]; });
    const wsC = XLSX.utils.aoa_to_sheet([hC, ...rC]); XLSX.utils.book_append_sheet(wb, wsC, "Cobros");
    const hGar = ["Cód. verificación", "Cód. gasto", "Tipo", "Descripción", "Valor", "Estado"];
    const rGar = curGars.map((g) => { const gastoAsoc = g.gastoId ? gastos.find((x) => x.id === g.gastoId) : null; return [g.codigoVerificacion || "—", gastoAsoc?.codigo || "—", g.tipo || "—", g.desc || "—", fmtExcel(g.valor), g.estado || "—"]; });
    const wsGar = XLSX.utils.aoa_to_sheet([hGar, ...rGar]); XLSX.utils.book_append_sheet(wb, wsGar, "Garantías");
    XLSX.writeFile(wb, `cliente_${(curC?.name || "cliente").replace(/[^a-zA-Z0-9]/g, "_")}_${td()}.xlsx`);
  };

  /* Exportar según el período mostrado en vista cliente (Gastos, Cobros, Garantías, Datos manuales) */
  const expClientDataPorPeriodo = (exportExcel = true, openPdfWindow = false) => {
    if (!curC) return;
    const periodoLabel = clientDetailPeriodo ? fmtM(clientDetailPeriodo) : "Todos";
    const safeName = (curC.name || "cliente").replace(/[^a-zA-Z0-9]/g, "_");
    const fileSuffix = clientDetailPeriodo ? clientDetailPeriodo.replace(/-/g, "") : "todos";

    if (exportExcel) {
      const wb = XLSX.utils.book_new();
      const curDExp = curDDisplay || { tGar: 0, net: 0 };
      const hG = ["Fecha", "Período", "Campaña", "Gasto", "Fee %", "Fee $", "Total", "Pagado", "Garantía", "Pendiente", "A cobrar", "Estado", "Prepago", "Código"];
      const rG = curGastosDisplay.map((g) => [fmtDD(g.fechaMovimiento), fmtM(g.mes), g.camp || "—", fmtExcel(g.gasto), g.fee + "%", fmtExcel(g._f), fmtExcel(g._t), fmtExcel(g._p), curDExp.tGar > 0 ? fmtExcel(curDExp.tGar) : "—", fmtExcel(g._pend), fmtExcel(curDExp.net), g._st, g.prepago ? "S" : "N", g.codigo || "—"]);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([hG, ...rG]), "Gastos");
      const hC = ["Fecha", "Hora", "Cód. cobro", "Cód. gasto", "Monto", "Método", "Notas"];
      const rC = curCobrosDisplay.map((co) => { const g = gastos.find((x) => x.id === co.gastoId); return [fmtD(co.fecha), fmtT(co.hora) || "—", co.codigo || "—", g?.codigo || "—", fmtExcel(co.monto), co.metodo || "—", co.notas || "—"]; });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([hC, ...rC]), "Cobros");
      const hGar = ["Cód. verificación", "Cód. gasto", "Tipo", "Descripción", "Valor", "Estado", "Fecha colocación"];
      const rGar = curGarsDisplay.map((g) => { const gastoAsoc = g.gastoId ? gastos.find((x) => x.id === g.gastoId) : null; return [g.codigoVerificacion || "—", gastoAsoc?.codigo || "—", g.tipo || "—", g.desc || "—", fmtExcel(g.valor), g.estado || "—", g.fechaColocacion ? fmtDD(g.fechaColocacion) : "—"]; });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([hGar, ...rGar]), "Garantías");
      const hM = ["Fecha", "Concepto", "Monto", "Tipo", "Nota"];
      const rM = curManDisplay.map((m) => [fmtDD(m.fecha), m.conc || "—", fmtExcel(m.monto), m.tipo || "—", m.nota || "—"]);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([hM, ...rM]), "Datos manuales");
      const hMov = ["N°", "Fecha", "Descripción", "Obs.", "Moneda", "Importe", "Fee", "Total", "Saldo"];
      const ledgerRowsX = buildClientLedgerRows({ curGastos: curGastosDisplay, curCobros: curCobrosDisplay, curGars: curGarsDisplay, gastos, mesCobro, fmtM });
      const rMov = ledgerRowsX.map((r) => {
        let imp; let fee; let tot;
        if (r.adsBreakdown) {
          imp = r.adsBreakdown.gasto ? fmtExcel(r.adsBreakdown.gasto) : "—";
          fee = r.adsBreakdown.fee ? fmtExcel(r.adsBreakdown.fee) : "—";
          tot = fmtExcel(r.adsBreakdown.total);
        } else if (r.garantiaSinEfecto) {
          imp = fmtExcel(r.garantiaValorRef);
          fee = "—";
          tot = "—";
        } else {
          imp = fmtExcel(r.delta);
          fee = "—";
          tot = "—";
        }
        return [r.n, fmtDD(r.fechaYmd), r.desc, r.obs, r.moneda, imp, fee, tot, fmtExcel(r.saldo)];
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([hMov, ...rMov]), "Movimientos");
      XLSX.writeFile(wb, `cliente_${safeName}_periodo_${fileSuffix}_${td()}.xlsx`);
    }

    if (openPdfWindow) {
      const curDExp = curDDisplay || { tG: 0, tF: 0, tP: 0, tGar: 0, net: 0 };
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      let y = 14;
      doc.setFontSize(16);
      doc.setTextColor(26, 29, 38);
      doc.text(curC.name || "Cliente", 14, y); y += 6;
      doc.setFontSize(9);
      doc.setTextColor(95, 101, 119);
      if (curC.codigo) { doc.text("Código: " + curC.codigo, 14, y); y += 5; }
      const phonesStr = (curC.phones || []).filter(Boolean).join(" · ");
      if (phonesStr) { doc.text("Tel: " + phonesStr, 14, y); y += 5; }
      const emailsStr = (curC.emails || []).filter(Boolean).join(" · ");
      if (emailsStr) { doc.text("Correo: " + emailsStr, 14, y); y += 5; }
      if (curC.ig) { doc.text("Instagram: " + curC.ig, 14, y); y += 5; }
      if (curC.biz) { doc.text("Negocio: " + curC.biz, 14, y); y += 5; }
      if (curC.notes) { doc.text("Notas: " + (curC.notes.length > 80 ? curC.notes.slice(0, 77) + "…" : curC.notes), 14, y); y += 5; }
      y += 2;
      doc.text(`Período: ${periodoLabel} · Generado ${fmtD(td())}`, 14, y); y += 8;
      doc.autoTable({
        startY: y,
        head: [["Concepto", "Monto"]],
        body: [
          ["Gasto Ads", "$" + fmt(curDExp.tG || 0)],
          ["Fees", "$" + fmt(curDExp.tF || 0)],
          ["Total", "$" + fmt((curDExp.tG || 0) + (curDExp.tF || 0))],
          ["Cobrado", "$" + fmt(curDExp.tP || 0)],
          ["Garantías", curDExp.tGar > 0 ? "-$" + fmt(curDExp.tGar) : "$0"],
          ["Deuda Neta", "$" + fmt(curDExp.net || 0)],
        ],
        theme: "grid",
        headStyles: { fillColor: [248, 249, 251], textColor: [95, 101, 119], fontStyle: "bold", fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        margin: { left: 14 },
        tableWidth: 60,
      });
      y = doc.lastAutoTable.finalY + 12;

      const addTable = (title, headers, rows) => {
        if (y > 250) { doc.addPage(); y = 14; }
        doc.setFontSize(11);
        doc.setTextColor(27, 37, 89);
        doc.text(title, 14, y); y += 7;
        doc.autoTable({
          startY: y,
          head: [headers],
          body: rows,
          theme: "grid",
          headStyles: { fillColor: [248, 249, 251], textColor: [95, 101, 119], fontStyle: "bold", fontSize: 8 },
          bodyStyles: { fontSize: 7 },
          margin: { left: 14 },
          tableWidth: "auto",
        });
        y = doc.lastAutoTable.finalY + 10;
      };
      const toStr = (x) => (x != null && x !== undefined ? String(x) : "—");
      const ledgerRowsPdf = buildClientLedgerRows({ curGastos: curGastosDisplay, curCobros: curCobrosDisplay, curGars: curGarsDisplay, gastos, mesCobro, fmtM });
      const rMovPdf = ledgerRowsPdf.map((r) => {
        let imp; let fee; let tot;
        if (r.adsBreakdown) {
          imp = r.adsBreakdown.gasto ? fmt(r.adsBreakdown.gasto) : "—";
          fee = r.adsBreakdown.fee ? fmt(r.adsBreakdown.fee) : "—";
          tot = fmt(r.adsBreakdown.total);
        } else if (r.garantiaSinEfecto) {
          imp = fmt(r.garantiaValorRef);
          fee = "—";
          tot = "—";
        } else {
          imp = r.delta === 0 ? "0" : fmt(r.delta);
          fee = "—";
          tot = "—";
        }
        return [toStr(r.n), toStr(fmtDD(r.fechaYmd)), toStr(r.desc), toStr(r.obs), toStr(r.moneda), toStr(imp), toStr(fee), toStr(tot), toStr(fmt(r.saldo))];
      });
      addTable("Movimientos (cronológico)", ["N°", "Fecha", "Descripción", "Obs.", "Moneda", "Importe", "Fee", "Total", "Saldo"], rMovPdf);
      const rG = curGastosDisplay.map((g) => [toStr(fmtDD(g.fechaMovimiento)), toStr(fmtM(g.mes)), toStr(g.camp), toStr(fmt(g.gasto)), g.fee + "%", toStr(fmt(g._f)), toStr(fmt(g._t)), toStr(fmt(g._p)), curDExp.tGar > 0 ? fmt(curDExp.tGar) : "—", toStr(fmt(g._pend)), g._st, g.prepago ? "S" : "N"]);
      addTable("Gastos Ads", ["Fecha", "Período", "Campaña", "Gasto", "Fee %", "Fee $", "Total", "Pagado", "Garantía", "Pendiente", "Estado", "Prepago"], rG);
      const rC = curCobrosDisplay.map((co) => { const g = gastos.find((x) => x.id === co.gastoId); return [toStr(fmtD(co.fecha)), toStr(fmtT(co.hora)), toStr(co.codigo), toStr(g?.codigo), toStr(fmt(co.monto)), toStr(co.metodo), toStr(co.notas)]; });
      addTable("Cobros", ["Fecha", "Hora", "Cód. cobro", "Cód. gasto", "Monto", "Método", "Notas"], rC);
      const rGar = curGarsDisplay.map((gr) => { const gastoAsoc = gr.gastoId ? gastos.find((x) => x.id === gr.gastoId) : null; return [toStr(gr.codigoVerificacion), toStr(gastoAsoc?.codigo), toStr(gr.tipo), toStr(gr.desc), toStr(fmt(gr.valor)), toStr(gr.estado), gr.fechaColocacion ? fmtDD(gr.fechaColocacion) : "—"]; });
      addTable("Garantías", ["Cód. verificación", "Cód. gasto", "Tipo", "Descripción", "Valor", "Estado", "Fecha colocación"], rGar);
      const rM = curManDisplay.map((m) => [toStr(fmtDD(m.fecha)), toStr(m.conc), toStr(fmt(m.monto)), toStr(m.tipo), toStr(m.nota)]);
      addTable("Datos manuales", ["Fecha", "Concepto", "Monto", "Tipo", "Nota"], rM);
      doc.save(`cliente_${safeName}_periodo_${fileSuffix}_${td()}.pdf`);
    }
  };

  const goTo = (p, cid = null) => {
    if (p === "client-detail" && repPeriodoMes && ((!isCliente && (page === "dashboard" || page === "metricas")) || (page === "reportes" && isCliente))) setClientDetailPeriodo(repPeriodoMes);
    setPage(p);
    if (cid != null) setCurCl(cid);
    if (p === "client-detail" && isCliente && clientId) setCurCl(clientId);
    if (p !== "client-detail") setClientDetailPeriodo("");
    setSearch("");
    if (p === "client-detail") setDetailTab("gastos");
    setMenuOpen(false);
    if (typeof window !== "undefined") {
      const id = p === "client-detail" ? (cid != null ? cid : curCl) : null;
      window.location.hash = id ? `client-detail-${id}` : p;
    }
  };

  const cLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    if (percent < 0.03) return null;
    const R = Math.PI / 180, r = innerRadius + (outerRadius - innerRadius) * 1.5;
    return <text x={cx + r * Math.cos(-midAngle * R)} y={cy + r * Math.sin(-midAngle * R)} fill="var(--color-text-muted)" textAnchor={cx + r * Math.cos(-midAngle * R) > cx ? "start" : "end"} dominantBaseline="central" style={{ fontSize: 12, fontWeight: 600, fontFamily: "var(--font-body)" }}>{(percent * 100).toFixed(1)}%</text>;
  };

  /* NAV: gerente = Métricas (gráficos/KPIs) + Resumen (tabla desglose); cliente = Mi cuenta, Resumen, … */
  const nav = isCliente
    ? [
        { id: "client-detail", icon: <Users size={18} />, label: "Mi cuenta", accent: "#0891b2" },
        { id: "dashboard", icon: <BarChart3 size={18} />, label: "Resumen", accent: "#2563eb" },
        { id: "gastos", icon: <DollarSign size={18} />, label: "Gastos Ads", badge: pendN, accent: "#d97706" },
        { id: "reportes", icon: <FileText size={18} />, label: "Reportes", accent: "#059669" },
        { id: "garantias", icon: <Shield size={18} />, label: "Garantías", accent: "#7c3aed" },
      ]
    : [
        { id: "dashboard", icon: <BarChart3 size={18} />, label: "Métricas", accent: "#2563eb" },
        { id: "metricas", icon: <Activity size={18} />, label: "Resumen", accent: "#6366f1" },
        { id: "clientes", icon: <Users size={18} />, label: "Clientes", accent: "#0891b2" },
        { id: "gastos", icon: <DollarSign size={18} />, label: "Gastos Ads", badge: pendN, accent: "#d97706" },
        { id: "cobros", icon: <CreditCard size={18} />, label: "Cobros", accent: "#059669" },
        { id: "cobranza", icon: <Mail size={18} />, label: "Cobranza", accent: "#e11d48" },
        { id: "garantias", icon: <Shield size={18} />, label: "Garantías", accent: "#7c3aed" },
        { id: "backup", icon: <HardDrive size={18} />, label: "Copia de seguridad", external: "https://www.marketingconholistic.com/backup-dashboard", section: "Sistema", accent: "#64748b" },
      ];

  const pct = curDDisplay && (curDDisplay.tG + curDDisplay.tF) > 0 ? (curDDisplay.tP / (curDDisplay.tG + curDDisplay.tF)) * 100 : 0;

  const pageTitles = { dashboard: isCliente ? "Resumen" : "Métricas", clientes: "Clientes", gastos: "Gastos Ads", metricas: "Resumen", cobros: "Cobros", cobranza: "Cobranza", reportes: "Reportes", garantias: "Garantías", "client-detail": curC?.name || "Cliente" };

  const manualTabContent = detailTab === "manual" ? (
    <div style={{ background: "var(--color-surface-2)", border: "1px solid var(--sidebar-border)", borderRadius: 18, overflow: "hidden", boxShadow: "0 1px 4px rgba(15,23,42,.04)" }}>
      <TableScrollWrap className="hm-table-wrap hm-table-sticky-actions hm-table-manual" autoFocusScroll><table><thead><tr>{["Fecha", "Concepto", "Monto", "Tipo", "Nota", ...(isCliente ? [] : [""])].map((h) => <th key={h || "actions"} style={TH} className={h === "" ? "hm-col-actions" : undefined}>{h}</th>)}</tr></thead><tbody>{curManDisplay.map((m) => <tr key={m.id}><td style={TD}>{fmtD(m.fecha)}</td><td style={{ ...TD, fontWeight: 600 }}>{m.conc}</td><td style={{ ...TD, ...MN, color: m.tipo === "Gasto" ? "#dc2640" : m.tipo === "Ingreso" ? "#0d9f6e" : "#1a1d26" }}>{m.tipo === "Nota" ? "—" : (m.tipo === "Gasto" ? "-$" : "+$") + fmt(m.monto)}</td><td style={TD}><Bdg type={m.tipo === "Gasto" ? "err" : m.tipo === "Ingreso" ? "ok" : "n"}>{m.tipo}</Bdg></td><td style={{ ...TD, fontSize: 12.5, color: "var(--sidebar-text-muted)" }}>{m.nota || "—"}</td>{!isCliente && <td className="hm-col-actions" style={TD}><IBtn onClick={() => mutations.delManual(m.id)} icon={<Trash2 size={13} />} danger /></td>}</tr>)}{!curManDisplay.length && <Empty cols={isCliente ? 5 : 6} msg="Sin registros" />}</tbody></table></TableScrollWrap>
      {!isCliente && <div style={{ display: "flex", gap: 10, alignItems: "flex-end", padding: "14px 18px", background: "var(--color-bg)", borderTop: "1px solid var(--sidebar-hover)", flexWrap: "wrap" }}>
        <div style={{ flex: .7 }}><label style={{ display: "block", fontSize: 10.5, fontWeight: 600, color: "var(--sidebar-text-muted)", marginBottom: 4 }}>Fecha</label><input type="date" value={mf.fecha} onChange={(e) => setMf({ ...mf, fecha: e.target.value })} style={{ padding: "7px 10px", fontSize: 12, border: "1px solid var(--sidebar-border)", borderRadius: 7, fontFamily: "'Inter'", outline: "none", width: "100%" }} /></div>
        <div style={{ flex: 1.2 }}><label style={{ display: "block", fontSize: 10.5, fontWeight: 600, color: "var(--sidebar-text-muted)", marginBottom: 4 }}>Concepto</label><input value={mf.conc} onChange={(e) => setMf({ ...mf, conc: e.target.value })} placeholder="Concepto" style={{ padding: "7px 10px", fontSize: 12, border: "1px solid var(--sidebar-border)", borderRadius: 7, fontFamily: "'Inter'", outline: "none", width: "100%" }} /></div>
        <div style={{ flex: .6 }}><label style={{ display: "block", fontSize: 10.5, fontWeight: 600, color: "var(--sidebar-text-muted)", marginBottom: 4 }}>Monto</label><input type="number" value={mf.monto} onChange={(e) => setMf({ ...mf, monto: e.target.value })} placeholder="0.00" step="0.01" style={{ padding: "7px 10px", fontSize: 12, border: "1px solid var(--sidebar-border)", borderRadius: 7, fontFamily: "'Inter'", outline: "none", width: "100%" }} /></div>
        <div style={{ flex: .6 }}><label style={{ display: "block", fontSize: 10.5, fontWeight: 600, color: "var(--sidebar-text-muted)", marginBottom: 4 }}>Tipo</label><select value={mf.tipo} onChange={(e) => setMf({ ...mf, tipo: e.target.value })} style={{ padding: "7px 10px", fontSize: 12, border: "1px solid var(--sidebar-border)", borderRadius: 7, fontFamily: "'Inter'", outline: "none", width: "100%" }}><option>Gasto</option><option>Ingreso</option><option>Nota</option></select></div>
        <Btn size="sm" onClick={saveMan} style={{ height: 34, marginBottom: 1 }}>+ Agregar</Btn>
      </div>}
    </div>
  ) : null;

  const emptyCobrosMsg = !cobros.length ? "Sin cobros" : (expRango.cobros.ini || expRango.cobros.fin) && !cobrosFiltrados.length ? "Sin cobros en el rango de fechas" : filterCliente.cobros ? "Sin cobros para este cliente" : "Sin cobros";
  const emptyGarantiasMsg = !garantias.length ? "Sin garantías" : (filterCliente.garantias ? "Sin garantías para este cliente" : "Sin garantías");

  /** Tabla «Desglose por usuario» (por cliente); se muestra en la página Resumen (ruta metricas). */
  const desglosePorUsuarioTablaEl = (
    <div className="hm-resumen-pro-table-card">
      <div className="hm-resumen-pro-table-head">
        <h3><span className="hm-dot" aria-hidden />Desglose por usuario</h3>
        {repData.rows.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--sidebar-text)", whiteSpace: "nowrap" }}>Ordenar:</label>
            <select value={sortReportDesgloseBy} onChange={(e) => setSortReportDesgloseBy(e.target.value)} style={{ padding: "8px 12px", border: "1px solid var(--sidebar-border)", borderRadius: 10, fontSize: 13, fontFamily: "'Inter'", background: "var(--color-surface-2)", color: "var(--sidebar-text-active)", outline: "none", cursor: "pointer", minWidth: 200 }}>
              <option value="nombre">Nombre (A-Z)</option>
              <option value="deuda">Quien más debe (Pend. neto ↓)</option>
              <option value="deuda_menos">Quien menos debe (Pend. neto ↑)</option>
              <option value="total">Mayor total (Ads+Fee)</option>
              <option value="pagado">Más cobrado</option>
              <option value="ads">Mayor gasto Ads</option>
              <option value="garantia">Mayor garantía</option>
            </select>
          </div>
        )}
      </div>
      <TableScrollWrap className="hm-table-wrap hm-table-reportes" style={{ margin: 0, padding: "0 12px 16px", overflowX: "auto" }} autoFocusScroll><table style={{ width: "100%" }}><thead><tr>{["Usuario", "ADS", "FEE", "FEE %", "TOTAL", "PAGADO", "GARANTÍA", "PEND. NETO"].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead>
        <tbody>
          {repDataRowsSorted.map((r) => { const feePct = r.ads > 0 ? (r.fee / r.ads * 100).toFixed(1) + "%" : "—"; return <tr key={r.cid} onClick={() => goTo("client-detail", r.cid)} style={{ cursor: "pointer" }}><td style={{ ...TD, fontWeight: 600 }}>{r.name}</td><td style={{ ...TD, ...MN }}>{fmt(r.ads)}</td><td style={{ ...TD, ...MN, color: "var(--color-blue)" }}>{fmt(r.fee)}</td><td style={{ ...TD, fontSize: 12.5, color: "var(--color-blue)" }}>{feePct}</td><td style={{ ...TD, ...MN, color: "#d97706", fontWeight: 700 }}>{fmt(r.total)}</td><td style={{ ...TD, ...MN, color: "#059669" }}>{fmt(r.paid)}</td><td style={{ ...TD, ...MN, color: "#7c3aed" }}>{r.gar > 0 ? "-" + fmt(r.gar) : "—"}</td><td style={{ ...TD, ...MN, color: "#e11d48", fontWeight: 700 }}>{fmt(r.netPending)}</td></tr>; })}
          <tr className="hm-resumen-pro-table-total-row"><td style={{ ...TD, fontWeight: 800 }}>TOTAL</td><td style={{ ...TD, ...MN, fontWeight: 700 }}>{fmt(repData.t.ads)}</td><td style={{ ...TD, ...MN, color: "var(--color-blue)", fontWeight: 700 }}>{fmt(repData.t.fee)}</td><td style={{ ...TD, fontSize: 12.5, color: "var(--color-blue)", fontWeight: 700 }}>{repData.t.ads > 0 ? (repData.t.fee / repData.t.ads * 100).toFixed(1) + "%" : "—"}</td><td style={{ ...TD, ...MN, color: "#d97706", fontWeight: 700 }}>{fmt(repData.t.total)}</td><td style={{ ...TD, ...MN, color: "#059669", fontWeight: 700 }}>{fmt(repData.t.paid)}</td><td style={{ ...TD, ...MN, color: "#7c3aed", fontWeight: 700 }}>{repData.t.gar > 0 ? "-" + fmt(repData.t.gar) : "—"}</td><td style={{ ...TD, ...MN, color: "#e11d48", fontWeight: 700 }}>{fmt(repData.t.netPending)}</td></tr>
          {!repData.rows.length && <Empty cols={8} msg="Sin gastos, cobros ni garantías con mes en resumen en este período" />}
        </tbody></table></TableScrollWrap>
    </div>
  );

  return (
    <div className={"hm-app" + (menuOpen ? " menu-open" : "")} style={{ display: "flex", minHeight: "100vh", fontFamily: "var(--font-body)", background: "var(--color-bg)", color: "var(--color-text)", lineHeight: 1.55, WebkitFontSmoothing: "antialiased" }}>
      <style>{`*{box-sizing:border-box}
::selection{background:var(--color-primary-highlight);color:var(--color-text)}

/* === STAT CARDS (mismo hover que pendientes/tarea.html .stat-card) === */
.stat-card{transition:box-shadow var(--tr),border-color var(--tr),transform var(--tr)}
.stat-card:hover{box-shadow:var(--shadow-md);transform:translateY(-1px);border-color:var(--color-primary)!important}

/* === TABLES === */
table{width:100%;border-collapse:collapse;min-width:600px}
tbody tr{transition:all .15s ease}
tbody tr:hover{background:var(--color-primary-highlight)!important}
.hm-table-wrap.hm-table-clientes tbody tr:hover{background:var(--color-primary-highlight)!important}
tbody tr:last-child td{border-bottom:none}
thead th{position:relative}

/* === MODALS === */
.hm-modal-box,.hm-modal-box input,.hm-modal-box select,.hm-modal-box textarea{box-sizing:border-box}
.hm-modal-box .hm-form-grid>div{min-width:0}

/* === FOCUS STATES (misma marca que Pendientes) === */
input:focus,select:focus,textarea:focus{border-color:var(--color-primary)!important;box-shadow:0 0 0 3px var(--color-primary-soft)!important;outline:none!important}

/* === SIDEBAR NAV === */
.hm-nav-item{transition:all .2s cubic-bezier(.4,0,.2,1);border-radius:12px;position:relative}
.hm-nav-item:hover{background:var(--sidebar-hover)!important;transform:translateX(2px)}
.hm-nav-item:active{transform:translateX(0) scale(.98)}

/* === BUTTONS === */
button{transition:all .15s ease}
.stat-card button,.hm-table-wrap button,.hm-modal-box button{transition:all .15s ease}

/* === PAGE TRANSITIONS === */
@keyframes fadeSlideIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.hm-page-content{animation:fadeSlideIn .3s ease-out;min-width:0;max-width:100%;box-sizing:border-box}
.hm-page-content > div{min-width:0;max-width:100%;box-sizing:border-box}

/* Main: evita que el flex empuje scroll horizontal a toda la ventana (tablas anchas quedan en su wrap) */
.hm-main{min-width:0;max-width:100%}
.hm-app{min-width:0}

/* Padding lateral responsive por debajo del escritorio ancho (inline 48px queda ancho en 100% zoom) */
@media (max-width:1280px){
  .hm-page-header{padding-left:clamp(14px,2.8vw,36px)!important;padding-right:clamp(14px,2.8vw,36px)!important}
  .hm-page-content{padding-top:clamp(18px,2.4vw,32px)!important;padding-bottom:clamp(22px,2.8vw,40px)!important;padding-left:clamp(14px,2.8vw,36px)!important;padding-right:clamp(14px,2.8vw,36px)!important}
}
@media (max-width:1024px){
  .hm-page-header{padding-left:clamp(12px,2.2vw,28px)!important;padding-right:clamp(12px,2.2vw,28px)!important}
  .hm-page-content{padding-top:clamp(16px,2vw,28px)!important;padding-bottom:clamp(20px,2.4vw,36px)!important;padding-left:clamp(12px,2.2vw,28px)!important;padding-right:clamp(12px,2.2vw,28px)!important}
}

/* === CHART CONTAINERS (superficie / radio como .card en Pendientes) === */
.hm-chart-card{background:var(--color-surface);border:1px solid var(--color-divider);border-radius:var(--radius-xl);padding:26px 28px;transition:box-shadow var(--tr),border-color var(--tr),transform var(--tr)}
.hm-chart-card:hover{box-shadow:var(--shadow-md);border-color:var(--color-primary);transform:translateY(-1px)}
@keyframes debtCardEnter{from{opacity:0;transform:translateY(10px) scale(0.98)}to{opacity:1;transform:translateY(0) scale(1)}}
.hm-debt-chart-card{animation:debtCardEnter .5s cubic-bezier(0.34,1.56,0.64,1) both}
.hm-debt-chart-card:hover{transform:translateY(-2px);box-shadow:0 10px 32px rgba(220,38,38,.1)!important;border-color:var(--red)!important}

/* Página Resumen (tabla): tarjetas arriba + tabla acotada centrada */
.hm-metricas-page{max-width:1180px;margin-left:auto;margin-right:auto}
.hm-metricas-kpi-row{display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin-bottom:22px}
@media (max-width:1100px){
  .hm-metricas-kpi-row{grid-template-columns:repeat(3,1fr)!important}
}
@media (max-width:520px){
  .hm-metricas-kpi-row{grid-template-columns:repeat(2,1fr)!important}
}
.hm-metricas-table-wrap{width:100%;max-width:100%;min-width:0;margin-left:auto;margin-right:auto}
.hm-metricas-table-wrap .hm-table-wrap table{min-width:0;width:100%}
.hm-metricas-table-wrap .hm-table-reportes th,.hm-metricas-table-wrap .hm-table-reportes td{padding:9px 10px!important;font-size:12.5px!important}
.hm-metricas-table-wrap .hm-resumen-pro-table-head h3{font-size:15px}
@media (min-width:1024px){
  .hm-metricas-table-wrap{max-width:min(720px,100%)}
}

/* === RESPONSIVE === */
@media (max-width:768px){
  .hm-sidebar{transform:translateX(-100%);transition:transform .3s cubic-bezier(.4,0,.2,1);z-index:200;box-shadow:8px 0 30px rgba(0,0,0,.15)}
  .hm-app.menu-open .hm-sidebar{transform:translateX(0)}
  .hm-sidebar-overlay{display:block}
  .hm-app.menu-open .hm-sidebar-overlay{opacity:1;pointer-events:auto}
  .hm-main{margin-left:0!important;padding-top:60px!important}
  .hm-mobile-header{display:flex!important}
  .hm-page-header{top:60px!important;padding:0 20px!important;flex-wrap:wrap;gap:10px!important;min-height:auto!important;height:auto!important;padding:14px 20px!important}
  .hm-page-content{padding:20px 16px!important}
  .hm-metricas-table-wrap{max-width:100%!important}
  .hm-stats-grid{grid-template-columns:repeat(2,1fr)!important;gap:14px!important}
  .hm-charts-grid-2{grid-template-columns:1fr!important}
  .hm-charts-grid-2-1{grid-template-columns:1fr!important}
  .hm-report-grid{grid-template-columns:1fr!important}
  .hm-credito-hero{padding:36px 20px 44px!important}
  .hm-credito-content{padding:28px 20px!important}
  .hm-detail-stats{grid-template-columns:repeat(2,1fr)!important}
  .hm-detail-charts{grid-template-columns:1fr!important}
  .hm-detail-tabs{flex-wrap:wrap;width:100%!important}
  .hm-detail-tabs button{padding:8px 14px;font-size:12.5px}
  .hm-modal-outer{padding:12px 12px 24px!important;align-items:flex-start!important}
  .hm-modal-box{width:100%!important;max-width:100%!important;margin-bottom:20px!important;overflow:hidden!important;box-sizing:border-box!important}
  .hm-modal-box *{box-sizing:border-box!important}
  .hm-modal-box .hm-form-grid>div,.hm-modal-box [style*="flex:"]{min-width:0!important}
  .hm-form-grid{grid-template-columns:1fr!important;gap:14px!important}
  .hm-modal-box input,.hm-modal-box select,.hm-modal-box textarea{min-height:48px!important;padding:14px 16px!important;font-size:16px!important;max-width:100%!important}
  .hm-modal-box textarea{min-height:88px!important}
  .hm-modal-box label{font-size:14px!important}
  .hm-modal-box .hm-modal-footer{flex-wrap:wrap;gap:10px!important}
}
@media (max-width:480px){
  .hm-modal-box input,.hm-modal-box select,.hm-modal-box textarea{min-height:48px!important}
  .hm-stats-grid{grid-template-columns:1fr!important}
  .hm-detail-stats{grid-template-columns:1fr!important}
}

/* === OVERLAY === */
.hm-sidebar-overlay{display:none;position:fixed;inset:0;background:rgba(15,23,42,.6);backdrop-filter:blur(4px);z-index:150;opacity:0;pointer-events:none;transition:opacity .3s}

/* === MOBILE HEADER === */
.hm-mobile-header{display:none;position:fixed;top:0;left:0;right:0;height:60px;background:color-mix(in srgb,var(--color-surface-2) 92%,transparent);backdrop-filter:blur(12px);border-bottom:1px solid var(--color-divider);align-items:center;padding:0 20px;z-index:101;gap:14px}

/* === TABLE WRAPS === Mismo criterio que COBROS (se ve bien): card overflow hidden + wrap overflow-x auto + tabla con min-width para que quepan todas las columnas === */
.hm-table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:0 -12px;padding:0 12px;position:relative;scrollbar-color:var(--color-surface-dynamic) transparent;scrollbar-width:thin}
.hm-table-wrap:focus{outline:none}
.hm-table-wrap:focus-visible{box-shadow:inset 0 0 0 2px var(--color-primary);border-radius:12px}
.hm-table-wrap table{border-collapse:collapse;table-layout:auto}
/* Listados anchos: ancho según contenido + mínimo; scroll solo dentro del wrap (sin aplastar texto) */
.hm-table-wrap.hm-table-clientes table,
.hm-table-wrap.hm-table-gastos table,
.hm-table-wrap.hm-table-cobros table,
.hm-table-wrap.hm-table-garantias table{width:max-content;max-width:none}
.hm-table-wrap.hm-table-clientes table{min-width:760px}
.hm-table-wrap.hm-table-gastos table{min-width:1180px}
.hm-table-wrap.hm-table-garantias table{min-width:1020px}
.hm-table-wrap.hm-table-cobros table{min-width:1040px}
/* Reportes / dashboard / manual: tabla fluida al contenedor */
.hm-table-wrap.hm-table-reportes table,.hm-table-wrap.hm-table-dashboard table,.hm-table-wrap.hm-table-manual table{width:100%;min-width:0}
/* Listados compactos: más columnas visibles sin perder legibilidad */
.hm-table-wrap.hm-table-clientes table th,.hm-table-wrap.hm-table-gastos table th,.hm-table-wrap.hm-table-garantias table th,.hm-table-wrap.hm-table-cobros table th{padding:6px 7px!important;font-size:9.5px!important;font-weight:700!important;letter-spacing:.07em!important;line-height:1.2!important;vertical-align:middle;word-break:normal;overflow-wrap:normal}
.hm-table-wrap.hm-table-clientes table td,.hm-table-wrap.hm-table-gastos table td,.hm-table-wrap.hm-table-garantias table td,.hm-table-wrap.hm-table-cobros table td{padding:7px 8px!important;font-size:11.5px!important;vertical-align:middle;word-break:normal;overflow-wrap:normal}
.hm-table-wrap.hm-table-sticky-actions th.hm-col-actions,.hm-table-wrap.hm-table-sticky-actions td.hm-col-actions,
.hm-table-wrap.hm-table-clientes th.hm-col-actions,.hm-table-wrap.hm-table-clientes td.hm-col-actions{position:sticky;right:0;background:var(--color-surface-2);min-width:112px;box-shadow:-8px 0 14px rgba(0,0,0,.05);z-index:1;white-space:nowrap}
.hm-table-wrap.hm-table-sticky-actions thead th.hm-col-actions,.hm-table-wrap.hm-table-clientes thead th.hm-col-actions{background:var(--color-bg)}
.hm-table-wrap.hm-table-sticky-actions tr:hover td.hm-col-actions,.hm-table-wrap.hm-table-clientes tr:hover td.hm-col-actions{background:var(--sidebar-hover)}
/* Estado: badge en una línea (clientes = penúltima col.; gastos según vista) — 10 cols sin Instagram */
.hm-table-wrap.hm-table-clientes th:nth-last-child(2),.hm-table-wrap.hm-table-clientes td:nth-last-child(2){white-space:nowrap}
.hm-table-wrap.hm-table-gastos:not(.hm-table-gastos--solo-cliente) th:nth-child(15),.hm-table-wrap.hm-table-gastos:not(.hm-table-gastos--solo-cliente) td:nth-child(15){white-space:nowrap}
.hm-table-wrap.hm-table-gastos.hm-table-gastos--solo-cliente th:nth-child(14),.hm-table-wrap.hm-table-gastos.hm-table-gastos--solo-cliente td:nth-child(14){white-space:nowrap}
/* Cliente + fechas legibles */
.hm-table-wrap.hm-table-clientes th:first-child,.hm-table-wrap.hm-table-clientes td:first-child{min-width:150px;max-width:240px;word-break:normal}
.hm-table-wrap.hm-table-clientes th:nth-child(2),.hm-table-wrap.hm-table-clientes td:nth-child(2){min-width:72px;max-width:100px}
.hm-table-wrap.hm-table-clientes th:nth-child(3),.hm-table-wrap.hm-table-clientes td:nth-child(3){min-width:120px;max-width:200px}
.hm-table-wrap.hm-table-gastos:not(.hm-table-gastos--solo-cliente) th:nth-child(2),.hm-table-wrap.hm-table-gastos:not(.hm-table-gastos--solo-cliente) td:nth-child(2){min-width:150px;max-width:210px}
.hm-table-wrap.hm-table-gastos:not(.hm-table-gastos--solo-cliente) th:nth-child(3),.hm-table-wrap.hm-table-gastos:not(.hm-table-gastos--solo-cliente) td:nth-child(3){min-width:92px;white-space:nowrap}
.hm-table-wrap.hm-table-gastos.hm-table-gastos--solo-cliente th:nth-child(1),.hm-table-wrap.hm-table-gastos.hm-table-gastos--solo-cliente td:nth-child(1){min-width:150px;max-width:220px}
.hm-table-wrap.hm-table-gastos.hm-table-gastos--solo-cliente th:nth-child(2),.hm-table-wrap.hm-table-gastos.hm-table-gastos--solo-cliente td:nth-child(2){min-width:92px;white-space:nowrap}
.hm-table-wrap.hm-table-cobros th:nth-child(2),.hm-table-wrap.hm-table-cobros td:nth-child(2){min-width:130px;max-width:190px}
.hm-table-wrap.hm-table-garantias:not(.hm-table-garantias--solo-cliente) th:nth-child(2),.hm-table-wrap.hm-table-garantias:not(.hm-table-garantias--solo-cliente) td:nth-child(2){min-width:130px;max-width:190px}
.hm-table-wrap.hm-table-garantias:not(.hm-table-garantias--solo-cliente) th:nth-child(3),.hm-table-wrap.hm-table-garantias:not(.hm-table-garantias--solo-cliente) td:nth-child(3){min-width:68px;white-space:nowrap}
.hm-table-wrap.hm-table-garantias.hm-table-garantias--solo-cliente th:nth-child(1),.hm-table-wrap.hm-table-garantias.hm-table-garantias--solo-cliente td:nth-child(1){min-width:130px;max-width:190px}
.hm-table-wrap.hm-table-garantias.hm-table-garantias--solo-cliente th:nth-child(2),.hm-table-wrap.hm-table-garantias.hm-table-garantias--solo-cliente td:nth-child(2){min-width:68px;white-space:nowrap}
/* Cabeceras de listados: que envuelvan y no fuercen ancho de página */
.hm-page-header--listing{flex-wrap:wrap!important;row-gap:10px!important;column-gap:12px!important;align-items:center!important}
.hm-page-header--listing > .hm-page-header-title{min-width:0;flex:0 1 auto}
.hm-page-header--listing > .hm-page-header-tools{min-width:0;flex:1 1 280px;display:flex;flex-wrap:wrap;align-items:center;gap:10px;justify-content:flex-end}
.hm-table-wrap::-webkit-scrollbar{height:10px}
/* Flechitas de scroll horizontal quitadas: supervisores prefieren ver todo con zoom/scroll nativo */
@media (max-width:768px){.hm-table-wrap{margin:0 -12px}}

/* === SCROLLBARS === */
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--color-surface-dynamic);border-radius:var(--radius-full)}
::-webkit-scrollbar-thumb:hover{background:var(--color-text-faint)}

/* === SELECTION COLOR === */
::selection{background:var(--color-primary-highlight);color:var(--color-text)}

/* === PAGINATION HOVER === */
.hm-page-content button:hover{opacity:.85}

/* === SIDEBAR LOGOUT HOVER === */
.hm-sidebar>div:last-child>button:hover{background:var(--color-error-soft)!important;color:var(--red)!important;border-color:var(--red-bg)!important}

/* === Hover effect para action buttons === */
.hm-table-wrap button:hover{transform:scale(1.03)}
.hm-table-wrap button:active{transform:scale(.98)}

/* === Smooth checkbox === */
input[type="checkbox"]{accent-color:var(--color-primary);transition:all .15s}

/* === Badge pulse for pending count in sidebar === */
@keyframes subtlePulse{0%,100%{opacity:1}50%{opacity:.7}}
.hm-nav-item span[style*="background: linear-gradient"]{animation:subtlePulse 2s ease-in-out infinite}

/* === Row click feedback === */
tbody tr:active{transform:scale(.997);transition:transform .1s}

/* === Stat card shine on hover === */
.stat-card::after{content:'';position:absolute;top:0;left:-100%;width:60%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.3),transparent);transition:left .5s ease;pointer-events:none}
.stat-card:hover::after{left:120%}
`}</style>

      {/* Overlay móvil al abrir menú */}
      <div className="hm-sidebar-overlay" onClick={() => setMenuOpen(false)} aria-hidden="true" />

      {/* Cabecera móvil */}
      <header className="hm-mobile-header">
        <button onClick={() => setMenuOpen(true)} style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--sidebar-border)", background: "var(--color-surface-2)", borderRadius: 12, color: "var(--sidebar-text-active)", cursor: "pointer" }} aria-label="Abrir menú"><Menu size={22} /></button>
        <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.3, color: "var(--sidebar-text-active)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pageTitles[page] || "Holistic"}</span>
        {!isCliente && (
          <div style={{ flexShrink: 0 }}>
            <Av name={displayName} size={36} avatarUrl={localGerenteAvatarUrl || gerenteAvatarUrl} />
          </div>
        )}
        {isCliente && clients[0] && (
          <div style={{ flexShrink: 0 }}>
            <Av name={clients[0].name} size={36} avatarUrl={clients[0].avatar_url} />
          </div>
        )}
      </header>

      {/* ═══ SIDEBAR ═══ */}
      <aside className="hm-sidebar" style={{ width: 260, background: "linear-gradient(180deg, var(--sidebar-bg) 0%, #f8fafc 100%)", borderRight: "1px solid var(--sidebar-border)", position: "fixed", top: 0, left: 0, bottom: 0, display: "flex", flexDirection: "column", zIndex: 100 }}>
        <div style={{ padding: "24px 22px 20px", borderBottom: "1px solid var(--sidebar-hover)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src={LOGO_URL} alt="Holistic Marketing" style={{ height: 48, width: 200, maxWidth: "100%", objectFit: "contain", display: "block" }} />
          </div>
          <div
            role={!isCliente ? "button" : undefined}
            tabIndex={!isCliente ? 0 : undefined}
            onClick={!isCliente ? () => avatarInputRef.current?.click() : undefined}
            onKeyDown={!isCliente ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); avatarInputRef.current?.click(); } } : undefined}
            style={{ display: "flex", alignItems: "flex-start", gap: 14, marginTop: 18, paddingTop: 18, borderTop: "1px solid var(--sidebar-hover)", background: "linear-gradient(135deg, #f5f3ee 0%, #eff6ff 50%, #f5f3ff 100%)", margin: "18px -22px 0", padding: "18px 20px", borderRadius: 14, boxShadow: "0 2px 12px rgba(15,23,42,.06), inset 0 1px 0 rgba(255,255,255,.8)", cursor: !isCliente ? "pointer" : undefined }}
            title={!isCliente ? "Clic para cambiar foto" : undefined}
          >
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f || isCliente) return;
                const r = new FileReader();
                r.onload = () => {
                  const dataUrl = r.result;
                  try { localStorage.setItem("hm_gerente_avatar_url", dataUrl); } catch (_) {}
                  setLocalGerenteAvatarUrl(dataUrl);
                };
                r.readAsDataURL(f);
                e.target.value = "";
              }}
            />
            <div style={{ position: "relative", flexShrink: 0 }}>
              {isCliente ? (
                <Av name={displayName} size={44} avatarUrl={clients[0]?.avatar_url} />
              ) : (
                <Av name={displayName} size={48} avatarUrl={localGerenteAvatarUrl || gerenteAvatarUrl} />
              )}
              <div style={{ position: "absolute", bottom: 0, right: 0, width: 14, height: 14, borderRadius: "50%", background: "linear-gradient(135deg, #22c55e, #10b981)", border: "2.5px solid var(--color-surface-2)", boxShadow: "0 1px 4px rgba(0,0,0,.12)" }} />
              {!isCliente && (
                <div style={{ position: "absolute", right: -2, bottom: -2, width: 20, height: 20, borderRadius: "50%", background: "var(--color-primary)", color: "var(--color-text-inverse)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 6px var(--color-primary-glow)", pointerEvents: "none" }} title="Clic para poner tu foto">
                  <Camera size={11} strokeWidth={2.2} />
                </div>
              )}
            </div>
            <div style={{ minWidth: 0, flex: 1, paddingTop: 2 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--sidebar-text)", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 4 }}>Bienvenido</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--sidebar-text-active)", lineHeight: 1.35, wordBreak: "break-word", overflowWrap: "break-word" }}>{displayName}</div>
              {!isCliente && <div style={{ fontSize: 10.5, color: "var(--sidebar-text-muted)", marginTop: 4 }}>Clic para poner tu foto</div>}
              {subLabel && <div style={{ marginTop: 8 }}><span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: "#059669", background: "rgba(16,185,129,.12)", padding: "4px 10px", borderRadius: 8, letterSpacing: 0.3 }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: "#10b981" }} /> {subLabel}</span></div>}
            </div>
          </div>
        </div>
        <nav style={{ flex: 1, padding: "18px 14px", overflowY: "auto" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--sidebar-text-muted)", textTransform: "uppercase", letterSpacing: 1.6, padding: "8px 14px 8px" }}>General</div>
          {nav.map((it) => (
            <div key={it.id}>
              {it.section && <div style={{ fontSize: 11, fontWeight: 700, color: "var(--sidebar-text-muted)", textTransform: "uppercase", letterSpacing: 1.6, padding: "8px 14px 8px", marginTop: 16 }}>{it.section}</div>}
              {it.external ? (
                <a href={it.external} target="_blank" rel="noopener noreferrer" className="hm-nav-item" style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: 12, fontSize: 14, fontWeight: 500, color: "var(--sidebar-text)", background: "transparent", cursor: "pointer", margin: "2px 0", textDecoration: "none", borderLeft: "3px solid transparent" }}>
                  <span style={{ color: "var(--sidebar-text-muted)" }}>{it.icon}</span><span>{it.label}</span><ExternalLink size={13} style={{ marginLeft: "auto", opacity: 0.5 }} />
                </a>
              ) : (
                <div onClick={() => goTo(it.id)} className="hm-nav-item" style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: 12, fontSize: 14, fontWeight: page === it.id ? 600 : 500, color: page === it.id ? "var(--color-primary)" : "var(--sidebar-text)", background: page === it.id ? "var(--sidebar-active)" : "transparent", cursor: "pointer", margin: "2px 0", borderLeft: page === it.id ? "3px solid var(--color-primary)" : "3px solid transparent" }}>
                  <span style={{ color: page === it.id ? "var(--color-primary)" : "var(--sidebar-text-muted)", transition: "color .15s" }}>{it.icon}</span><span>{it.label}</span>
                  {it.badge > 0 && <span style={{ marginLeft: "auto", background: `linear-gradient(135deg, ${it.accent || "#dc2626"}, ${it.accent || "#dc2626"}cc)`, color: "var(--color-text-inverse)", fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 12, minWidth: 20, textAlign: "center", boxShadow: `0 2px 6px ${it.accent || "#dc2626"}40` }}>{it.badge}</span>}
                </div>
              )}
            </div>
          ))}
        </nav>
        <div style={{ height: 1, background: "linear-gradient(90deg, transparent, var(--sidebar-border), transparent)", margin: "16px 14px 8px" }} />
        <div style={{ padding: "16px 22px", borderTop: "1px solid var(--sidebar-hover)" }}>
          <button onClick={async () => { await supabase?.auth?.signOut?.(); }} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "10px 14px", border: "1.5px solid var(--sidebar-border)", borderRadius: 10, background: "var(--color-surface-2)", color: "var(--sidebar-text)", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", transition: "all .15s" }}><LogOut size={15} /> Cerrar sesión</button>
        </div>
      </aside>

      {/* ═══ MAIN ═══ */}
      <main className="hm-main" style={{ flex: 1, marginLeft: 260, minHeight: "100vh", minWidth: 0, maxWidth: "100%" }}>

        {/* ══ CRÉDITO ══ */}
        {page === "credito" && (
          <div>
            <div className="hm-credito-hero" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)", color: "var(--color-text-inverse)", padding: "64px 48px 72px", textAlign: "center", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(37,99,235,.08) 0%, transparent 70%)", pointerEvents: "none" }} />
              <div style={{ maxWidth: 680, margin: "0 auto", position: "relative" }}>
                <h1 style={{ fontSize: "clamp(30px, 4vw, 42px)", fontWeight: 800, letterSpacing: -0.8, marginBottom: 14, lineHeight: 1.1, fontFamily: "var(--font-display)" }}>Crédito</h1>
                <p style={{ fontSize: 17, opacity: 0.85, lineHeight: 1.7 }}>Soluciones de crédito para impulsar tu negocio con Holistic Marketing.</p>
                <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 10, marginTop: 28, padding: "14px 28px", background: "var(--color-surface-2)", color: "var(--sidebar-text-active)", borderRadius: 12, fontWeight: 700, fontSize: 15, textDecoration: "none", transition: "transform .2s" }}>Volver al inicio</a>
              </div>
            </div>
            <div className="hm-credito-content" style={{ maxWidth: 800, margin: "0 auto", padding: "40px 36px" }}>
              <div style={{ background: "var(--color-surface-2)", border: "1px solid var(--sidebar-border)", borderRadius: 22, padding: "48px 40px", textAlign: "center", color: "var(--sidebar-text)", lineHeight: 1.7, fontSize: 16, boxShadow: "0 4px 20px rgba(15,23,42,.06)", position: "relative", overflow: "hidden" }}>
                <div style={{ width: 56, height: 56, margin: "0 auto 20px", borderRadius: 16, background: "linear-gradient(135deg, #2563eb15, #7c3aed10)", display: "flex", alignItems: "center", justifyContent: "center" }}><CreditCard size={28} style={{ color: "var(--color-blue)" }} /></div>
                Próximamente más información sobre opciones de crédito.
              </div>
            </div>
          </div>
        )}

        {/* ══ DASHBOARD: cliente = Resumen actual; gerente = vista Reportes (Relación de Cuentas) ══ */}
        {page === "dashboard" && isCliente && (<div>
          <div className="hm-page-header" style={{ background: "var(--color-surface)", borderBottom: "1px solid var(--color-divider)", padding: "0 48px", minHeight: 72, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14, position: "sticky", top: 0, zIndex: 50, boxShadow: "var(--shadow-sm)" }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: -0.3, display: "flex", alignItems: "center", gap: 10, fontFamily: "var(--font-display)" }}><span style={{ display: "inline-flex", width: 10, height: 10, borderRadius: "50%", background: "linear-gradient(135deg, #2563eb, #7c3aed)" }} />Resumen general</h2>
              <p style={{ fontSize: 13, color: "var(--sidebar-text-muted)", margin: "4px 0 0", maxWidth: 480 }}>{dashboardPeriodo ? <>Período: <strong style={{ color: "var(--sidebar-text-active)" }}>{fmtM(dashboardPeriodo)}</strong></> : <>Últimos 6 meses: {months[0]?.label} — {months[months.length - 1]?.label}</>}. Para análisis detallado usa <button type="button" onClick={() => goTo("reportes")} style={{ background: "none", border: "none", color: "var(--color-blue)", fontWeight: 600, cursor: "pointer", padding: 0, fontFamily: "inherit", fontSize: "inherit", textDecoration: "underline" }}>Reportes</button>.</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <div className="hm-dashboard-periodo-tablita" style={{ display: "inline-flex", background: "var(--color-surface-2)", border: "1px solid var(--sidebar-border)", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 3px rgba(15,23,42,.04)" }}>
                <div style={{ display: "flex", alignItems: "center", borderRight: "1px solid var(--sidebar-border)", padding: "8px 14px", background: "var(--color-bg)", fontSize: 11, fontWeight: 700, color: "var(--sidebar-text)", textTransform: "uppercase", letterSpacing: 0.6 }}>Período (mes)</div>
                <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
                  <button type="button" onClick={() => { const base = dashboardPeriodo || tm(); const [y, m] = base.split("-").map(Number); const d = new Date(y, m - 2, 1); setDashboardPeriodo(d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0")); }} style={{ width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", border: "none", borderRight: "1px solid var(--sidebar-border)", background: "var(--color-surface-2)", color: "var(--sidebar-text-active)", cursor: "pointer", flexShrink: 0 }} title="Mes anterior"><ChevronLeft size={15} /></button>
                <div style={{ minWidth: 88, textAlign: "center", padding: "6px 12px", fontSize: 12.5, fontWeight: 600, color: dashboardPeriodo ? "var(--sidebar-text-active)" : "var(--sidebar-text-muted)", fontFamily: "'Inter',sans-serif" }}>{dashboardPeriodo ? fmtM(dashboardPeriodo) : "Todos"}</div>
                  <button type="button" onClick={() => { const base = dashboardPeriodo || tm(); const [y, m] = base.split("-").map(Number); const d = new Date(y, m, 1); setDashboardPeriodo(d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0")); }} style={{ width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", border: "none", borderRight: "1px solid var(--sidebar-border)", background: "var(--color-surface-2)", color: "var(--sidebar-text-active)", cursor: "pointer", flexShrink: 0 }} title="Mes siguiente"><ChevronRight size={15} /></button>
                  <input type="month" value={dashboardPeriodo || tm()} onChange={(e) => { const v = e.target.value; if (v) setDashboardPeriodo(v); }} style={{ width: 118, boxSizing: "border-box", padding: "6px 10px", border: "none", borderRight: "1px solid var(--sidebar-border)", fontFamily: "'Inter',sans-serif", fontSize: 12, outline: "none", background: "var(--color-surface-2)" }} title="Elegir mes" />
                {dashboardPeriodo ? <button type="button" onClick={() => setDashboardPeriodo("")} style={{ padding: "6px 12px", border: "none", background: "var(--sidebar-hover)", color: "var(--sidebar-text)", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter'" }}>Todos</button> : null}
                </div>
              </div>
              <Btn variant="outline" size="sm" onClick={() => goTo("reportes")}><FileText size={14} /> Reportes</Btn>
            </div>
          </div>
          <div className="hm-page-content" style={{ padding: "32px 48px 48px", maxWidth: "none", margin: "0 auto" }}>
            <div className="hm-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 20, marginBottom: 32 }}>
              <Stat icon={<DollarSign size={22} />} value={`$${fmt(dashboardTots.tG)}`} label="Gasto Total Ads" color="#6366f1" />
              <Stat icon={<TrendingUp size={22} />} value={`$${fmt(dashboardTots.tF)}`} label="Fees Generados" color="#2563eb" />
              <Stat icon={<Check size={22} />} value={`$${fmt(dashboardTots.tP)}`} label="Total Cobrado" color="#059669" />
              <Stat icon={<AlertCircle size={22} />} value={`$${fmt(dashboardTots.net)}`} label="Deuda Neta" color="#e11d48" sub={dashboardTots.tGar > 0 ? `Garantías descontadas: -$${fmt(dashboardTots.tGar)}` : ""} />
            </div>
            <div className="hm-charts-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 32 }}>
              <div className="hm-chart-card">
                <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, letterSpacing: -0.2 }}>Gasto Mensual en Ads</h4><p style={{ fontSize: 13, color: "var(--sidebar-text-muted)", marginBottom: 20 }}>Inversión + fees por mes</p>
                <ResponsiveContainer width="100%" height={240}><BarChart data={dashboardCharts.monthly}><CartesianGrid strokeDasharray="4 4" stroke="var(--sidebar-hover)" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 10.5, fill: "var(--sidebar-text-muted)" }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 10.5, fill: "var(--sidebar-text-muted)" }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, border: "none", boxShadow: "0 8px 30px rgba(15,23,42,.12)", padding: "10px 14px" }} /><Legend wrapperStyle={{ fontSize: 11 }} /><Bar dataKey="gasto" name="Gasto Ads" fill="var(--color-blue)" radius={[8, 8, 0, 0]} isAnimationActive={false} /><Bar dataKey="fee" name="Fee" fill="#7c3aed" radius={[8, 8, 0, 0]} isAnimationActive={false} /></BarChart></ResponsiveContainer>
              </div>
              <div className="hm-chart-card">
                <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, letterSpacing: -0.2 }}>Métodos de Cobro</h4><p style={{ fontSize: 13, color: "var(--sidebar-text-muted)", marginBottom: 20 }}>Distribución por medio de pago</p>
                <ResponsiveContainer width="100%" height={240}><PieChart><Pie data={dashboardCharts.methods} cx="50%" cy="50%" innerRadius={58} outerRadius={92} paddingAngle={4} cornerRadius={4} dataKey="value" label={cLabel} isAnimationActive={false}>{dashboardCharts.methods.map((e, i) => <Cell key={i} fill={e.color} />)}</Pie><Legend wrapperStyle={{ fontSize: 11 }} /><Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, border: "none", boxShadow: "0 8px 30px rgba(15,23,42,.12)", padding: "10px 14px" }} formatter={(v) => `$${fmt(v)}`} /></PieChart></ResponsiveContainer>
              </div>
            </div>
            <div className="hm-charts-grid-2-1" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, marginBottom: 32 }}>
              <div className="hm-chart-card">
                <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, letterSpacing: -0.2 }}>Cobrado vs Gasto</h4><p style={{ fontSize: 13, color: "var(--sidebar-text-muted)", marginBottom: 20 }}>Evolución mensual</p>
                <ResponsiveContainer width="100%" height={240}><LineChart data={dashboardCharts.monthly}><CartesianGrid strokeDasharray="4 4" stroke="var(--sidebar-hover)" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 10.5, fill: "var(--sidebar-text-muted)" }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 10.5, fill: "var(--sidebar-text-muted)" }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, border: "none", boxShadow: "0 8px 30px rgba(15,23,42,.12)", padding: "10px 14px" }} /><Legend wrapperStyle={{ fontSize: 11 }} /><Line type="monotone" dataKey="cobrado" name="Cobrado" stroke="#10b981" strokeWidth={3} dot={{ r: 5, fill: "#10b981", stroke: "var(--color-surface-2)", strokeWidth: 2.5 }} activeDot={{ r: 7, fill: "#10b981", stroke: "var(--color-surface-2)", strokeWidth: 3 }} isAnimationActive={false} /><Line type="monotone" dataKey="gasto" name="Gasto" stroke="var(--color-blue)" strokeWidth={3} dot={{ r: 5, fill: "var(--color-blue)", stroke: "var(--color-surface-2)", strokeWidth: 2.5 }} activeDot={{ r: 7, fill: "var(--color-blue)", stroke: "var(--color-surface-2)", strokeWidth: 3 }} isAnimationActive={false} /></LineChart></ResponsiveContainer>
              </div>
              <div className="hm-chart-card hm-debt-chart-card" style={{ background: "linear-gradient(180deg, var(--color-surface-2) 0%, var(--color-error-soft) 100%)", border: "1px solid var(--red-bg)", borderRadius: "var(--radius-xl)", padding: "28px 24px 32px", transition: "transform .25s cubic-bezier(0.34,1.56,0.64,1), box-shadow .25s ease", boxShadow: "var(--shadow-md)", marginBottom: 8 }}>
                <h4 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, letterSpacing: -0.2, color: "var(--sidebar-text-active)" }}>Deuda Neta por Cliente</h4>
                <p style={{ fontSize: 12.5, color: "var(--sidebar-text)", marginBottom: 24, lineHeight: 1.4 }}>Incluye descuento de garantías. Clientes con saldo pendiente.</p>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={dashboardCharts.debt} layout="vertical" margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                    <defs><linearGradient id="debtGradient" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#fca5a5" /><stop offset="100%" stopColor="#f87171" /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="4 4" stroke="#fecaca" vertical={false} />
                    <XAxis type="number" tick={{ fontSize: 12, fill: "#64748b", fontWeight: 500 }} axisLine={false} tickLine={false} tickFormatter={(v) => "$" + fmt(v)} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 12.5, fill: "var(--sidebar-text-active)", fontWeight: 500 }} axisLine={false} tickLine={false} width={100} />
                    <Tooltip contentStyle={{ borderRadius: 12, fontSize: 13, border: "1px solid #fecaca", boxShadow: "0 8px 30px rgba(15,23,42,.12)", padding: "12px 16px" }} formatter={(v) => [`$${fmt(v)}`, "Deuda neta"]} />
                    <Bar dataKey="debt" fill="url(#debtGradient)" radius={[0, 10, 10, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div style={{ background: "var(--color-surface-2)", border: "1px solid var(--sidebar-border)", borderRadius: 18, overflow: "hidden", boxShadow: "0 1px 4px rgba(15,23,42,.04)" }}>
              <div style={{ padding: "20px 26px", borderBottom: "1px solid var(--sidebar-hover)", display: "flex", alignItems: "center", gap: 12 }}><div style={{ width: 8, height: 8, borderRadius: "50%", background: "linear-gradient(135deg, #dc2626, #f97316)", flexShrink: 0 }} /><h3 style={{ fontSize: 16, fontWeight: 700, letterSpacing: -0.2 }}>Pendientes de Cobro</h3></div>
              <TableScrollWrap className="hm-table-wrap hm-table-dashboard" autoFocusScroll><table><thead><tr>{["Cliente", "Fecha de movimiento", "Gasto", "Fee", "Total", "Pagado", "Pendiente", "Estado"].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead>
                <tbody>{dashboardPendientes.map((g) => { const c = clients.find((x) => x.id === g.clientId); return <tr key={g.id} onClick={() => goTo("client-detail", g.clientId)} style={{ cursor: "pointer" }}><td style={TD}><div style={{ display: "flex", alignItems: "center", gap: 10 }}>{c && <Av name={c.name} avatarUrl={c.avatar_url} />}<span style={{ fontWeight: 600 }}>{c?.name || "—"}</span></div></td><td style={{ ...TD, fontWeight: 600 }}>{fmtM(g.mes)}</td><td style={{ ...TD, ...MN }}>${fmt(g.gasto)}</td><td style={{ ...TD, ...MN, color: "var(--color-blue)" }}>{g.fee}%</td><td style={{ ...TD, ...MN, fontWeight: 700 }}>${fmt(g._t)}</td><td style={{ ...TD, ...MN, color: "#059669" }}>${fmt(g._p)}</td><td style={{ ...TD, ...MN, color: "#dc2626" }}>${fmt(g._pend)}</td><td style={TD}><Bdg type={g._st === "Parcial" ? "warn" : "acc"}>{g._st}</Bdg></td></tr>; })}
                {dashboardPendientes.length === 0 && <Empty cols={8} msg={dashboardPeriodo ? "Sin pendientes en este período" : "🎉 Todo cobrado — sin pendientes"} />}</tbody></table></TableScrollWrap>
            </div>
          </div>
        </div>)}

        {/* ══ REPORTES: gerente en Métricas (dashboard); cliente en página Reportes ══ */}
        {((page === "dashboard" && !isCliente) || (page === "reportes" && isCliente)) && (
        <div className="hm-resumen-pro">
          <section className="hm-resumen-pro-hero" aria-label={page === "dashboard" && !isCliente ? "Métricas" : "Resumen"}>
            <div className="hm-resumen-pro-hero-pattern" />
            <div className="hm-resumen-pro-hero-inner">
              <div className="hm-resumen-pro-greet">
                <span className="hm-resumen-pro-eyebrow">Holistic · Relación de cuentas</span>
                <h1 className="hm-resumen-pro-h1">
                  Hola, {(displayName || "").trim().split(/\s+/).filter(Boolean)[0] || displayName}{" "}
                  <span className="hm-resumen-pro-wave" aria-hidden>👋</span>
                </h1>
                <p className="hm-resumen-pro-date">{resumenHeroDateLabel}</p>
                <p className="hm-resumen-pro-tagline">Panel financiero del período: inversión, cobros y saldo neto. Ajustá usuario y mes abajo.</p>
              </div>
              <div className="hm-resumen-pro-hero-kpis">
                <div className="hm-resumen-pro-hero-kpi">
                  <div className="hm-resumen-pro-hero-kpi-icon hm-resumen-pro-hero-kpi-icon--blue"><DollarSign size={20} strokeWidth={2.2} /></div>
                  <div className="hm-resumen-pro-hero-kpi-meta">
                    <span className="hm-resumen-pro-hero-kpi-label">Inversión (Ads + Fee)</span>
                    <span className="hm-resumen-pro-hero-kpi-val">${fmt(repData.t.ads + repData.t.fee)}</span>
                  </div>
                </div>
                <div className="hm-resumen-pro-hero-kpi">
                  <div className="hm-resumen-pro-hero-kpi-icon hm-resumen-pro-hero-kpi-icon--coral"><TrendingUp size={20} strokeWidth={2.2} /></div>
                  <div className="hm-resumen-pro-hero-kpi-meta">
                    <span className="hm-resumen-pro-hero-kpi-label">Cobrado</span>
                    <span className="hm-resumen-pro-hero-kpi-val">${fmt(repData.t.paid)}</span>
                  </div>
                </div>
                <div className="hm-resumen-pro-hero-kpi">
                  <div className="hm-resumen-pro-hero-kpi-icon hm-resumen-pro-hero-kpi-icon--green"><AlertCircle size={20} strokeWidth={2.2} /></div>
                  <div className="hm-resumen-pro-hero-kpi-meta">
                    <span className="hm-resumen-pro-hero-kpi-label">Pendiente neto</span>
                    <span className="hm-resumen-pro-hero-kpi-val">${fmt(repData.t.netPending)}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
          <div className="hm-resumen-pro-toolbar">
            <div className="hm-resumen-pro-toolbar-row">
              {!isCliente && (
                <div className="hm-resumen-pro-ss">
                  <SearchSelect compact label="Usuario" options={[{ value: "all", label: "Todos" }, ...clientsSorted.map((c) => ({ value: c.id, label: c.name }))]} value={repCl} onChange={(id) => setRepCl(id || "all")} placeholder="Buscar cliente..." emptyMessage="Ningún cliente coincide" />
                </div>
              )}
              <div className="hm-report-calendar-wrap" style={{ background: "var(--color-surface-2)", border: "1.5px solid var(--sidebar-border)", borderRadius: 14, padding: "12px 18px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <div style={{ width: 40, height: 40, borderRadius: 11, background: "linear-gradient(135deg, #0f172a 0%, #334155 100%)", color: "var(--color-text-inverse)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Calendar size={18} strokeWidth={2.2} /></div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.02em", color: "var(--sidebar-text)" }}>Período:</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button type="button" onClick={() => { const base = repPeriodoMes || tm(); const [y, m] = base.split("-").map(Number); const d = new Date(y, m - 2, 1); setRepPeriodoMes(d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0")); }} style={{ width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--sidebar-border)", borderRadius: 8, background: "var(--color-surface-2)", color: "var(--sidebar-text-active)", cursor: "pointer", flexShrink: 0 }} title="Mes anterior"><ChevronLeft size={16} /></button>
                    <div style={{ minWidth: 90, textAlign: "center", padding: "6px 12px", background: "var(--color-bg)", border: "1px solid var(--sidebar-border)", borderRadius: 8, fontSize: 12.5, fontWeight: 600, color: repPeriodoMes ? "var(--sidebar-text-active)" : "var(--sidebar-text-muted)" }}>{repPeriodoMes ? fmtM(repPeriodoMes) : "Todos"}</div>
                    <button type="button" onClick={() => { const base = repPeriodoMes || tm(); const [y, m] = base.split("-").map(Number); const d = new Date(y, m, 1); setRepPeriodoMes(d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0")); }} style={{ width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--sidebar-border)", borderRadius: 8, background: "var(--color-surface-2)", color: "var(--sidebar-text-active)", cursor: "pointer", flexShrink: 0 }} title="Mes siguiente"><ChevronRight size={16} /></button>
                    <input type="text" placeholder="0125, 02/25, MM/AAAA" value={repPeriodoMes} onChange={(e) => setRepPeriodoMes(e.target.value)} onBlur={(e) => { const p = parsePeriodoInput(e.target.value); if (p) setRepPeriodoMes(p); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const p = parsePeriodoInput(e.currentTarget.value); if (p) setRepPeriodoMes(p); e.currentTarget.blur(); } }} style={{ width: 95, boxSizing: "border-box", padding: "6px 10px", border: "1px solid var(--sidebar-border)", borderRadius: 8, fontFamily: "'Inter',sans-serif", fontSize: 12, outline: "none" }} title="Escribí 0125, 02/25 o MM/AAAA" />
                    {repPeriodoMes && <button type="button" onClick={() => setRepPeriodoMes("")} style={{ padding: "5px 10px", border: "1px solid var(--sidebar-border)", borderRadius: 8, background: "var(--color-surface-2)", color: "var(--sidebar-text-muted)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Todos</button>}
                  </div>
                  {repPeriodoMes && <span style={{ fontSize: 12, color: "var(--sidebar-text)", fontWeight: 600 }}>{fmtD(repPerInicio)} – {fmtD(repPerFin)}</span>}
                </div>
              </div>
            </div>
          </div>
          <div className="hm-resumen-pro-body hm-page-content">
            <div className="hm-resumen-pro-layout">
              <main className="hm-resumen-pro-main">
            <div className="hm-resumen-pro-alert">
              <Shield size={22} style={{ color: "#7c3aed", flexShrink: 0, marginTop: 2 }} />
              <div>
                <div className="hm-resumen-pro-alert-title">¿Dónde se ven las garantías?</div>
                <p className="hm-resumen-pro-alert-p">Las garantías vigentes con <strong>mes en resumen</strong> = este período aparecen en la tabla aunque no haya gastos con fecha en el mes ni cobros contabilizados aquí. Se descuentan en <strong>GARANTÍA</strong> y en <strong>PEND. NETO</strong>. Los gastos del reporte siguen siendo por <strong>fecha de movimiento</strong> en el rango.</p>
              </div>
            </div>
            <div className="hm-resumen-pro-substats">
              <span className="hm-resumen-pro-chipstat"><Percent size={16} /> Ads USD <strong>${fmt(repData.t.ads)}</strong></span>
              <span className="hm-resumen-pro-chipstat"><Percent size={16} /> Fee <strong>${fmt(repData.t.fee)}</strong></span>
              <span className="hm-resumen-pro-chipstat"><Shield size={16} style={{ color: "#7c3aed" }} /> Garantías <strong>{repData.t.gar > 0 ? `$${fmt(repData.t.gar)}` : "$0"}</strong></span>
            </div>
            <div className="hm-pro-card">
              <div className="hm-pro-card-head">
                <div>
                  <h4 className="hm-pro-card-title">Tendencia del período</h4>
                  <p className="hm-pro-card-sub">Cobrado (área coral) e inversión en Ads por mes en el rango seleccionado</p>
                </div>
                <span className="hm-pro-card-pill">Evolución</span>
              </div>
              <ResponsiveContainer width="100%" height={248}>
                <ComposedChart data={repCharts.monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="hmResumenTrendCobArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ff5c39" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#ff5c39" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="6 6" stroke={REP_CHART_GRID} vertical={false} />
                  <XAxis dataKey="name" tick={REP_CHART_TICK} axisLine={false} tickLine={false} />
                  <YAxis tick={REP_CHART_TICK} axisLine={false} tickLine={false} tickFormatter={(v) => "$" + fmt(v)} />
                  <Tooltip contentStyle={REP_CHART_TOOLTIP} />
                  <Legend wrapperStyle={REP_CHART_LEGEND} />
                  <Area type="monotone" dataKey="cobrado" stroke="none" fill="url(#hmResumenTrendCobArea)" isAnimationActive={false} dot={false} />
                  <Line type="monotone" dataKey="cobrado" name="Cobrado" stroke="#ff5c39" strokeWidth={3} dot={{ r: 4, fill: "#ff5c39", stroke: REP_CHART_DOT_RING, strokeWidth: 2 }} activeDot={{ r: 6 }} isAnimationActive={false} />
                  <Line type="monotone" dataKey="gasto" name="Gasto Ads" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 4, fill: "#2563eb", stroke: REP_CHART_DOT_RING, strokeWidth: 2 }} activeDot={{ r: 6 }} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            {repPeriodoMes ? (
              <div className="hm-weekly-dash-wrap">
                <div className="hm-weekly-dash-card">
                  <header className="hm-weekly-dash-header">
                    <div className="hm-weekly-dash-header-text">
                      <h3 className="hm-weekly-dash-title">Actividad por semana</h3>
                      <p className="hm-weekly-dash-desc">
                        Bloques de 7 días del mes. <strong>Barras</strong> (eje izq.): Ads + Fee por fecha de movimiento.
                        <strong> Línea y área</strong> (eje der.): cobros por fecha de pago en el mes contable.
                      </p>
                    </div>
                    <div className="hm-weekly-dash-toolbar">
                      <span className="hm-weekly-dash-chip hm-weekly-dash-chip--primary">{fmtM(repPeriodoMes)}</span>
                      <span className="hm-weekly-dash-chip">Vista semanal</span>
                    </div>
                  </header>
                  {repWeeklySeries.some((w) => (w.ads || 0) + (w.fee || 0) + (w.cobrado || 0) > 0) && (
                    <div className="hm-weekly-dash-kpis">
                      <div className="hm-weekly-dash-kpi">
                        <div className="hm-weekly-dash-kpi-top">
                          <span className="hm-weekly-dash-kpi-label">Inversión en gráfico</span>
                          <span className="hm-weekly-dash-kpi-icon hm-weekly-dash-kpi-icon--blue"><BarChart3 size={16} strokeWidth={2.2} /></span>
                        </div>
                        <div className="hm-weekly-dash-kpi-value">${fmt(repWeeklySummary.invTotal)}</div>
                        <div className="hm-weekly-dash-kpi-hint">Ads + Fee · suma semanas</div>
                      </div>
                      <div className="hm-weekly-dash-kpi">
                        <div className="hm-weekly-dash-kpi-top">
                          <span className="hm-weekly-dash-kpi-label">Cobrado en gráfico</span>
                          <span className="hm-weekly-dash-kpi-icon hm-weekly-dash-kpi-icon--green"><TrendingUp size={16} strokeWidth={2.2} /></span>
                        </div>
                        <div className="hm-weekly-dash-kpi-value hm-weekly-dash-kpi-value--green">${fmt(repWeeklySummary.cobTotal)}</div>
                        <div className="hm-weekly-dash-kpi-hint">Por fecha de pago</div>
                      </div>
                      <div className="hm-weekly-dash-kpi">
                        <div className="hm-weekly-dash-kpi-top">
                          <span className="hm-weekly-dash-kpi-label">Pico inversión</span>
                          <span className="hm-weekly-dash-kpi-icon hm-weekly-dash-kpi-icon--amber"><ArrowUpRight size={16} strokeWidth={2.2} /></span>
                        </div>
                        <div className="hm-weekly-dash-kpi-value">${fmt(repWeeklySummary.maxInvWeek)}</div>
                        <div className="hm-weekly-dash-kpi-hint">Mejor semana (Ads+Fee)</div>
                      </div>
                      <div className="hm-weekly-dash-kpi">
                        <div className="hm-weekly-dash-kpi-top">
                          <span className="hm-weekly-dash-kpi-label">Pico cobros</span>
                          <span className="hm-weekly-dash-kpi-icon hm-weekly-dash-kpi-icon--teal"><ArrowUpRight size={16} strokeWidth={2.2} /></span>
                        </div>
                        <div className="hm-weekly-dash-kpi-value hm-weekly-dash-kpi-value--green">${fmt(repWeeklySummary.maxCobWeek)}</div>
                        <div className="hm-weekly-dash-kpi-hint">Mejor semana</div>
                      </div>
                    </div>
                  )}
                  {repWeeklySeries.some((w) => (w.ads || 0) + (w.fee || 0) + (w.cobrado || 0) > 0) ? (
                    <>
                      <div className="hm-weekly-dash-legend">
                        <span className="hm-weekly-dash-legend-item"><i className="hm-weekly-dash-dot hm-weekly-dash-dot--ads" /> Ads</span>
                        <span className="hm-weekly-dash-legend-item"><i className="hm-weekly-dash-dot hm-weekly-dash-dot--fee" /> Fee</span>
                        <span className="hm-weekly-dash-legend-item"><i className="hm-weekly-dash-dot hm-weekly-dash-dot--cob" /> Cobrado</span>
                        <span className="hm-weekly-dash-legend-note">Dos escalas · barras vs. línea</span>
                      </div>
                      <div className="hm-weekly-dash-chart">
                        <ResponsiveContainer width="100%" height={292}>
                          <ComposedChart data={repWeeklySeries} margin={{ top: 16, right: 20, left: 4, bottom: 12 }} barCategoryGap="22%">
                            <defs>
                              <linearGradient id="hmWeeklyAdsGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#2563eb" stopOpacity={1} />
                                <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.92} />
                              </linearGradient>
                              <linearGradient id="hmWeeklyFeeGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#f59e0b" stopOpacity={1} />
                                <stop offset="100%" stopColor="#fbbf24" stopOpacity={0.95} />
                              </linearGradient>
                              <linearGradient id="hmWeeklyCobArea" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#059669" stopOpacity={0.28} />
                                <stop offset="100%" stopColor="#059669" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="6 6" stroke={REP_CHART_GRID} vertical={false} />
                            <XAxis dataKey="name" tick={{ fontSize: 10.5, fill: "var(--hm-pro-chart-tick, #64748b)", fontWeight: 600 }} tickMargin={10} axisLine={false} tickLine={false} />
                            <YAxis
                              yAxisId="inv"
                              orientation="left"
                              tick={{ fontSize: 10, fill: "#3b82f6", fontWeight: 500 }}
                              axisLine={false}
                              tickLine={false}
                              tickFormatter={(v) => "$" + fmt(v)}
                              width={52}
                            />
                            <YAxis
                              yAxisId="cob"
                              orientation="right"
                              tick={{ fontSize: 10, fill: "#059669", fontWeight: 500 }}
                              axisLine={false}
                              tickLine={false}
                              tickFormatter={(v) => "$" + fmt(v)}
                              width={52}
                            />
                            <Tooltip
                              content={({ active, payload }) => {
                                if (!active || !payload?.length) return null;
                                const row = payload[0]?.payload;
                                const inv = (row?.ads || 0) + (row?.fee || 0);
                                return (
                                  <div className="hm-weekly-dash-tooltip">
                                    <div className="hm-weekly-dash-tooltip-title">Semana {row?.name}</div>
                                    <div className="hm-weekly-dash-tooltip-sub">{row?.rangeLabel}</div>
                                    <div className="hm-weekly-dash-tooltip-section">
                                      <div className="hm-weekly-dash-tooltip-h">Inversión</div>
                                      <div className="hm-weekly-dash-tooltip-row"><span>Ads</span><strong>${fmt(row?.ads || 0)}</strong></div>
                                      <div className="hm-weekly-dash-tooltip-row"><span>Fee</span><strong>${fmt(row?.fee || 0)}</strong></div>
                                      <div className="hm-weekly-dash-tooltip-row hm-weekly-dash-tooltip-row--total"><span>Subtotal</span><strong>${fmt(inv)}</strong></div>
                                    </div>
                                    <div className="hm-weekly-dash-tooltip-section hm-weekly-dash-tooltip-section--last">
                                      <div className="hm-weekly-dash-tooltip-h hm-weekly-dash-tooltip-h--green">Cobrado</div>
                                      <div className="hm-weekly-dash-tooltip-row"><span>En la semana</span><strong>${fmt(row?.cobrado || 0)}</strong></div>
                                    </div>
                                  </div>
                                );
                              }}
                            />
                            <Area yAxisId="cob" type="monotone" dataKey="cobrado" stroke="none" fill="url(#hmWeeklyCobArea)" isAnimationActive={false} dot={false} />
                            <Bar yAxisId="inv" dataKey="ads" name="Ads" stackId="inv" fill="url(#hmWeeklyAdsGrad)" maxBarSize={56} radius={[0, 0, 0, 0]} isAnimationActive={false} />
                            <Bar yAxisId="inv" dataKey="fee" name="Fee" stackId="inv" fill="url(#hmWeeklyFeeGrad)" maxBarSize={56} radius={[12, 12, 0, 0]} isAnimationActive={false} />
                            <Line yAxisId="cob" type="monotone" dataKey="cobrado" name="Cobrado" stroke="#059669" strokeWidth={3} dot={{ r: 5, fill: "#059669", stroke: REP_CHART_DOT_RING, strokeWidth: 2.5 }} activeDot={{ r: 7, fill: "#047857", stroke: REP_CHART_DOT_RING, strokeWidth: 2 }} isAnimationActive={false} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </>
                  ) : (
                    <div className="hm-weekly-dash-empty">
                      Sin movimientos con fechas dentro de las semanas de este mes.
                    </div>
                  )}
                  {repWeeklySeries.some((w) => (w.ads || 0) + (w.fee || 0) + (w.cobrado || 0) > 0) && (repWeeklySummary.weeksWithInv < repWeeklySeries.length || repWeeklySummary.weeksWithCob < repWeeklySeries.length) && (
                    <footer className="hm-weekly-dash-foot">
                      Semanas en $0 son normales si no hubo movimientos con fecha en ese rango.
                    </footer>
                  )}
                </div>
              </div>
            ) : null}
            <div className="hm-resumen-pro-split">
              <div className="hm-pro-card" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div className="hm-pro-card-head" style={{ alignSelf: "stretch", width: "100%" }}>
                  <div>
                    <h4 className="hm-pro-card-title">Composición de cuentas</h4>
                    <p className="hm-pro-card-sub">ADS vs Fee (o garantías del mes)</p>
                  </div>
                  <span className="hm-pro-card-pill">Distribución</span>
                </div>
                <div style={{ width: "100%", maxWidth: 400, margin: "0 auto" }}>
                  {repData.pie.length > 0 ? (
                    <ResponsiveContainer width="100%" height={268}><PieChart><Pie data={repData.pie} cx="50%" cy="50%" innerRadius={64} outerRadius={100} paddingAngle={5} cornerRadius={6} dataKey="value" label={cLabel} isAnimationActive={false}>{repData.pie.map((e, i) => <Cell key={i} fill={e.color} />)}</Pie><Tooltip contentStyle={REP_CHART_TOOLTIP} formatter={(v) => `$${fmt(v)}`} /><Legend wrapperStyle={REP_CHART_LEGEND} formatter={(v, e) => `${v}: $${fmt(e.payload.value)}`} /></PieChart></ResponsiveContainer>
                  ) : (
                    <div style={{ minHeight: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--sidebar-text-muted)", fontSize: 14, textAlign: "center", padding: 24 }}>Sin movimiento en este período.<br /><span style={{ fontSize: 12.5, marginTop: 8, display: "block" }}>Si cargaste garantías para este mes, revisá en Garantías que <strong>Período en resumen</strong> sea exactamente este mes.</span></div>
                  )}
                </div>
                <div style={{ fontFamily: "var(--font-body)", fontVariantNumeric: "tabular-nums", fontSize: 29, fontWeight: 700, marginTop: 8, letterSpacing: -0.04, background: repData.t.total > 0 ? "linear-gradient(135deg, #ff5c39, #f97316)" : repData.t.gar > 0 ? "linear-gradient(135deg, #5b21b6, #7c3aed)" : "linear-gradient(135deg, #ff5c39, #ea580c)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{fmtK(repData.t.total > 0 ? repData.t.total : repData.t.gar > 0 ? repData.t.gar : 0)}</div>
                <div style={{ fontSize: 12, color: "var(--sidebar-text-muted)", fontWeight: 600, letterSpacing: 0.06, textTransform: "uppercase" }}>{repData.t.total > 0 ? "Total general (Ads+Fee)" : repData.t.gar > 0 ? "Solo garantías este mes" : "Total general"}</div>
              </div>
              <div className="hm-pro-card">
                <div className="hm-pro-card-head">
                  <div>
                    <h4 className="hm-pro-card-title">Deuda neta por cliente</h4>
                    <p className="hm-pro-card-sub">Top con saldo; garantías descontadas</p>
                  </div>
                  <span className="hm-pro-card-pill">Riesgo</span>
                </div>
                <ResponsiveContainer width="100%" height={300}>{repCharts.debt.length > 0 ? <BarChart data={repCharts.debt} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 4 }}><defs><linearGradient id="debtGradientRep" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#fecaca" /><stop offset="100%" stopColor="#ff5c39" /></linearGradient></defs><CartesianGrid strokeDasharray="6 6" stroke={REP_CHART_GRID_SOFT} vertical={false} /><XAxis type="number" tick={REP_CHART_TICK} axisLine={false} tickLine={false} tickFormatter={(v) => "$" + fmt(v)} /><YAxis dataKey="name" type="category" tick={REP_CHART_TICK_AXIS} axisLine={false} tickLine={false} width={88} /><Tooltip contentStyle={REP_CHART_TOOLTIP} formatter={(v) => `$${fmt(v)}`} /><Bar dataKey="debt" fill="url(#debtGradientRep)" radius={[0, 10, 10, 0]} maxBarSize={22} isAnimationActive={false} /></BarChart> : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--sidebar-text-muted)", fontSize: 13 }}>Sin deuda en el período</div>}</ResponsiveContainer>
              </div>
            </div>
            <div className="hm-resumen-pro-grid2">
              <div className="hm-pro-card">
                <div className="hm-pro-card-head">
                  <div>
                    <h4 className="hm-pro-card-title">Inversión por mes</h4>
                    <p className="hm-pro-card-sub">Gasto Ads y fees apilados</p>
                  </div>
                  <span className="hm-pro-card-pill">Barras</span>
                </div>
                <ResponsiveContainer width="100%" height={252}><BarChart data={repCharts.monthly} barCategoryGap="16%"><CartesianGrid strokeDasharray="6 6" stroke={REP_CHART_GRID_SOFT} vertical={false} /><XAxis dataKey="name" tick={REP_CHART_TICK} axisLine={false} tickLine={false} /><YAxis tick={REP_CHART_TICK} axisLine={false} tickLine={false} tickFormatter={(v) => "$" + fmt(v)} /><Tooltip contentStyle={REP_CHART_TOOLTIP} /><Legend wrapperStyle={REP_CHART_LEGEND} /><Bar dataKey="gasto" name="Gasto Ads" stackId="a" fill="#93c5fd" radius={[0, 0, 0, 0]} isAnimationActive={false} /><Bar dataKey="fee" name="Fee" stackId="a" fill="#ff5c39" radius={[10, 10, 0, 0]} isAnimationActive={false} /></BarChart></ResponsiveContainer>
              </div>
              <div className="hm-pro-card">
                <div className="hm-pro-card-head">
                  <div>
                    <h4 className="hm-pro-card-title">Métodos de cobro</h4>
                    <p className="hm-pro-card-sub">Por medio de pago en el período</p>
                  </div>
                  <span className="hm-pro-card-pill">Donut</span>
                </div>
                <ResponsiveContainer width="100%" height={252}>{repCharts.methods.length > 0 ? <PieChart><Pie data={repCharts.methods} cx="50%" cy="50%" innerRadius={56} outerRadius={88} paddingAngle={4} cornerRadius={6} dataKey="value" label={cLabel} isAnimationActive={false}>{repCharts.methods.map((e, i) => <Cell key={i} fill={e.color} />)}</Pie><Legend wrapperStyle={REP_CHART_LEGEND} /><Tooltip contentStyle={REP_CHART_TOOLTIP} formatter={(v) => `$${fmt(v)}`} /></PieChart> : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--sidebar-text-muted)", fontSize: 13 }}>Sin cobros en el período</div>}</ResponsiveContainer>
              </div>
            </div>
              </main>
              <aside className="hm-resumen-pro-aside">
                <div className="hm-resumen-pro-aside-card hm-resumen-pro-aside-card--accent">
                  <strong>Gestioná cuentas</strong>
                  <p>Revisá clientes, gastos y cobros desde un solo lugar.</p>
                  {!isCliente && (
                    <button type="button" className="hm-resumen-pro-aside-btn" onClick={() => goTo("clientes")}>Ir a Clientes</button>
                  )}
                </div>
                <div className="hm-resumen-pro-aside-card">
                  <div className="hm-resumen-pro-aside-h">Período seleccionado</div>
                  <div className="hm-resumen-pro-aside-big">{repPeriodoMes ? fmtM(repPeriodoMes) : "Todos"}</div>
                  {repPeriodoMes ? <div className="hm-resumen-pro-aside-range">{fmtD(repPerInicio)} — {fmtD(repPerFin)}</div> : <div className="hm-resumen-pro-aside-range">Histórico completo en KPIs</div>}
                </div>
                {!isCliente && repCl !== "all" && (
                  <div className="hm-resumen-pro-aside-card">
                    <div className="hm-resumen-pro-aside-h">Vista filtrada</div>
                    <div className="hm-resumen-pro-aside-big" style={{ fontSize: "1.05rem" }}>{clientsSorted.find((c) => c.id === repCl)?.name || "Cliente"}</div>
                    <div className="hm-resumen-pro-aside-range">Solo datos de este usuario</div>
                  </div>
                )}
                <div className="hm-resumen-pro-aside-card">
                  <div className="hm-resumen-pro-aside-h">Resumen rápido</div>
                  <div className="hm-resumen-pro-aside-stats">
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span>Clientes en tabla</span><strong>{repData.rows.length}</strong></div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span>Cobrado (contable)</span><strong style={{ color: "#059669" }}>${fmt(repData.t.paid)}</strong></div>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
        )}

        {/* ══ CLIENTES (solo gerente) ══ */}
        {page === "clientes" && !isCliente && (<div>
          <div className="hm-page-header hm-page-header--listing" style={{ background: "linear-gradient(90deg, #fff 0%, #ecfeff 100%)", borderBottom: "1px solid #e5e7eb", padding: "0 48px", minHeight: 72, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50, boxShadow: "0 1px 3px rgba(15,23,42,.04)" }}>
            <div className="hm-page-header-title">
              <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.3, margin: 0, display: "flex", alignItems: "center", gap: 10 }}><span style={{ display: "inline-flex", width: 10, height: 10, borderRadius: "50%", background: "linear-gradient(135deg, #0891b2, #06b6d4)" }} />Clientes</h2>
            </div>
            <div className="hm-page-header-tools">
              <div style={{ background: "linear-gradient(135deg, #eff6ff, #f5f3ff)", color: "#1d4ed8", padding: "7px 16px", borderRadius: 20, fontSize: 13, fontWeight: 700, fontFamily: "'Inter'", border: "1px solid #bfdbfe" }} title="Total de clientes">
                {search.trim() ? `${clientsFilteredAndSorted.length} de ${clientsSorted.length} clientes` : `${clientsSorted.length} clientes en total`}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--sidebar-text)", whiteSpace: "nowrap" }}>Ordenar:</label>
                <select value={sortClientesBy} onChange={(e) => { setSortClientesBy(e.target.value); setPageNum((p) => ({ ...p, clientes: 1 })); }} style={{ padding: "8px 12px", border: "1px solid var(--sidebar-border)", borderRadius: 8, fontSize: 13, fontFamily: "'Inter'", background: "var(--color-surface-2)", color: "var(--sidebar-text-active)", outline: "none", cursor: "pointer", minWidth: 160 }}>
                  <option value="nombre">Nombre (A-Z)</option>
                  <option value="deuda">Quien más debe</option>
                  <option value="gasto">Mayor gasto</option>
                  <option value="cobrado">Más cobrado</option>
                </select>
              </div>
              <div style={{ position: "relative", minWidth: 0, flex: "1 1 200px", maxWidth: "100%" }}><Search size={15} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--sidebar-text-muted)" }} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre..." style={{ padding: "8px 12px 8px 34px", width: "100%", maxWidth: 280, minWidth: 0, boxSizing: "border-box", background: "var(--color-bg)", border: "1px solid var(--sidebar-border)", borderRadius: 12, fontSize: 14, fontFamily: "'Inter'", outline: "none" }} /></div>
              <Btn variant="outline" size="sm" onClick={expClientes}><Download size={14} /> Descargar Excel</Btn>
              <Btn onClick={() => openMdl("client")}><Plus size={16} /> Nuevo</Btn>
            </div>
          </div>
          <div className="hm-page-content" style={{ padding: "32px 48px", maxWidth: "none", margin: "0 auto" }}>
            {(() => {
              const sinCorreoValido = clients.filter((c) => !(c.emails || []).some((e) => typeof e === "string" && e.trim().includes("@") && e.trim().length >= 5));
              const sinTelefono = clients.filter((c) => !(c.phones || []).filter(Boolean).length);
              const sinDatos = clients.filter((c) => !(c.name || "").trim() || !(c.codigo || "").trim() || !(c.ig || "").trim() || !(c.biz || "").trim() || !(c.notes || "").trim());
              const hayAviso = sinCorreoValido.length > 0 || sinTelefono.length > 0 || sinDatos.length > 0;
              return hayAviso ? (
                <div style={{ marginBottom: 20, padding: "14px 20px", background: "linear-gradient(135deg, #fef2f2 0%, #fff7ed 100%)", border: "1px solid #fecaca", borderRadius: 12, display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <AlertCircle size={22} style={{ color: "#dc2626", flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#991b1b", marginBottom: 6 }}>Datos incompletos en algunos clientes</div>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "#b91c1c", lineHeight: 1.6 }}>
                      {sinCorreoValido.length > 0 && <li><strong>{sinCorreoValido.length}</strong> sin correo válido (agregá al menos uno con @)</li>}
                      {sinTelefono.length > 0 && <li><strong>{sinTelefono.length}</strong> sin teléfono</li>}
                      {sinDatos.length > 0 && <li><strong>{sinDatos.length}</strong> con nombre, código, Instagram, negocio o notas faltantes</li>}
                    </ul>
                    <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--sidebar-text)" }}>Entrá a cada cliente y usá <strong>Editar</strong> para completar los datos. El correo es el más importante.</p>
                  </div>
                </div>
              ) : null;
            })()}
            <div style={{ background: "var(--color-surface-2)", border: "1px solid var(--sidebar-border)", borderRadius: 18, overflow: "hidden", boxShadow: "0 1px 4px rgba(15,23,42,.04)" }}>
            {(() => {
              const totalPages = Math.ceil(clientsFilteredAndSorted.length / PER_PAGE) || 1;
              const currentPage = Math.min(pageNum.clientes, totalPages);
              const clientsPaginated = clientsFilteredAndSorted.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);
              return (
                <>
                  <TableScrollWrap className="hm-table-wrap hm-table-sticky-actions hm-table-clientes" autoFocusScroll><table><thead><tr>{["Cliente", "Código", "Contacto", "Gasto", "Fees", "Cobrado", "Garantías", "Deuda Neta", "Estado", ""].map((h, i) => <th key={h || "actions"} style={TH} className={i === 9 ? "hm-col-actions" : undefined}>{h}</th>)}</tr></thead>
                    <tbody>{clientsPaginated.map((c) => { const d = cData(c.id); const st = d.gross <= 0 ? "ok" : d.net > 0 ? "err" : "warn"; const stT = d.gross <= 0 ? "Al día" : d.net > 0 ? "Con deuda" : "Cubierto"; const TDC = { ...TD }; const btnSize = { width: 28, height: 28 }; return <tr key={c.id} onClick={() => goTo("client-detail", c.id)} style={{ cursor: "pointer" }}><td style={TDC}><div style={{ display: "flex", alignItems: "center", gap: 7 }}><Av name={c.name} size={28} avatarUrl={c.avatar_url} /><div style={{ minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: 12.5, lineHeight: 1.25 }}>{c.name}</div>{c.biz && <div style={{ fontSize: 10.5, color: "var(--sidebar-text-muted)", lineHeight: 1.2 }}>{c.biz}</div>}</div></div></td><td style={{ ...TDC, fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--sidebar-text-active)" }}>{c.codigo || "—"}</td><td style={TDC}><div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>{(c.phones || []).filter(Boolean).map((p, i) => <span key={"p" + i} style={{ padding: "2px 5px", background: "var(--color-bg)", borderRadius: 4, fontSize: 10.5 }}>📱 {p}</span>)}{(c.emails || []).filter(Boolean).map((e, i) => <span key={"e" + i} style={{ padding: "2px 5px", background: "var(--color-bg)", borderRadius: 4, fontSize: 10.5 }}>✉ {e}</span>)}</div></td><td style={{ ...TDC, ...MN, color: "var(--sidebar-text-active)" }}>${fmt(d.tG)}</td><td style={{ ...TDC, ...MN, color: "var(--color-blue)" }}>${fmt(d.tF)}</td><td style={{ ...TDC, ...MN, color: "#059669" }}>${fmt(d.tP)}</td><td style={{ ...TDC, ...MN, color: "#7c3aed" }}>{d.tGar > 0 ? "$" + fmt(d.tGar) : "—"}</td><td style={TDC}>{d.net > 0 ? <span style={{ background: "#fef2f2", padding: "3px 7px", borderRadius: 6, color: "#e11d48", fontWeight: 600, fontSize: 11 }}>${fmt(d.net)}</span> : <span style={{ ...MN, color: "#059669" }}>${fmt(d.net)}</span>}</td><td style={TDC}><Bdg type={st}>{stT === "Al día" ? "✅ " + stT : stT === "Con deuda" ? "🔴 " + stT : stT}</Bdg></td><td className="hm-col-actions" style={TDC} onClick={(e) => e.stopPropagation()}><div style={{ display: "flex", gap: 3 }}><IBtn onClick={() => openMdl("dar-acceso", c.id)} icon={<KeyRound size={13} />} title="Dar acceso" style={{ ...btnSize, color: "#059669" }} /><IBtn onClick={() => openMdl("client", c.id)} icon={<Edit3 size={13} />} title="Editar" style={btnSize} /><IBtn onClick={() => delClient(c.id)} icon={<Trash2 size={13} />} danger title="Eliminar" style={btnSize} /></div></td></tr>; })}{!clientsPaginated.length && <Empty cols={10} msg={clients.length ? "Ningún cliente coincide con la búsqueda" : "No hay clientes registrados"} />}</tbody></table></TableScrollWrap>
                  {totalPages > 1 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "12px 16px", borderTop: "1px solid #e5e7eb", flexWrap: "wrap" }}>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                        <button key={n} type="button" onClick={() => setPageNum((p) => ({ ...p, clientes: n }))} style={{ minWidth: 36, height: 36, padding: "0 10px", border: n === currentPage ? "none" : "1.5px solid var(--sidebar-border)", borderRadius: 10, background: n === currentPage ? "linear-gradient(135deg, var(--color-primary-hover), var(--color-primary))" : "var(--color-surface-2)", color: n === currentPage ? "var(--color-text-inverse)" : "var(--sidebar-text-active)", fontWeight: n === currentPage ? 700 : 500, fontSize: 13.5, cursor: "pointer", fontFamily: "'Inter'", transition: "all .2s cubic-bezier(.4,0,.2,1)", boxShadow: n === currentPage ? "0 2px 8px rgba(249,115,22,.28)" : "none" }}>{n}</button>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </div></div>
        </div>)}

        {/* ══ CLIENT DETAIL ══ */}
        {page === "client-detail" && curC && (
          <ClientDetailView
            curC={curC}
            curD={curDDisplay}
            pct={pct}
            detailTab={detailTab}
            setDetailTab={setDetailTab}
            curGastos={curGastosDisplay}
            curCobros={curCobrosDisplay}
            curGars={curGarsDisplay}
            mesCobro={mesCobro}
            manualTabContent={manualTabContent}
            clientDetailPeriodo={clientDetailPeriodo}
            setClientDetailPeriodo={setClientDetailPeriodo}
            parsePeriodoInput={parsePeriodoInput}
            tm={tm}
            cCharts={cCharts}
            goTo={goTo}
            openMdl={openMdl}
            curCl={curCl}
            gastos={gastos}
            Av={Av}
            Bdg={Bdg}
            Btn={Btn}
            PayB={PayB}
            IBtn={IBtn}
            Empty={Empty}
            TH={TH}
            TD={TD}
            MN={MN}
            fmt={fmt}
            fmtD={fmtD}
            fmtDD={fmtDD}
            fmtM={fmtM}
            fmtT={fmtT}
            fmtDt={fmtDt}
            isCliente={isCliente}
            updateClientAvatar={(url) => mutations.updateClientAvatar(url, curCl)}
            uploadAvatarFile={curCl ? (file) => uploadAvatar(curCl, file) : null}
            onExportClientPorPeriodo={expClientDataPorPeriodo}
            setComprobanteViewer={setComprobanteViewer}
          />
        )}

        {/* ══ GASTOS ══ */}
        {page === "gastos" && (<div>
          <div className="hm-page-header" style={{ background: "linear-gradient(90deg, #fff 0%, #fffbeb 100%)", borderBottom: "1px solid #e5e7eb", padding: "0 48px", minHeight: 72, minWidth: 0, width: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 12, position: "sticky", top: 0, zIndex: 50, boxShadow: "0 1px 3px rgba(15,23,42,.04)" }}>
            {/* Fila 1: título + acciones principales (siempre visibles, no tapan la tabla) */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, paddingTop: 14, paddingBottom: 2, width: "100%", minWidth: 0, boxSizing: "border-box" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", minWidth: 0, flex: "1 1 200px" }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.3, margin: 0, display: "flex", alignItems: "center", gap: 10 }}><span style={{ display: "inline-flex", width: 10, height: 10, borderRadius: "50%", background: "linear-gradient(135deg, #d97706, #f59e0b)" }} />Gastos Ads · Mensuales</h2>
                {!isCliente && (
                  <>
                    <Btn variant="outline" size="sm" onClick={() => openBulkFeeModal("filtered")}><Percent size={14} /> Fee masivo</Btn>
                    <Btn onClick={() => openMdl("gasto")}><Plus size={16} /> Nuevo Gasto</Btn>
                  </>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", minWidth: 0, flex: "1 1 220px", justifyContent: "flex-end" }}>
                <div style={{ background: "linear-gradient(135deg, #eff6ff, #f5f3ff)", color: "#1d4ed8", padding: "7px 16px", borderRadius: 20, fontSize: 13, fontWeight: 700, fontFamily: "'Inter'", border: "1px solid #bfdbfe" }} title="Total de filas">
                  {filterCliente.gastos ? `${gastosFiltrados.length} de ${sGastos.length} gastos` : `${sGastos.length} gastos en total`}
                </div>
                <Btn variant="outline" size="sm" onClick={expGastos}><Download size={14} /> Descargar Excel</Btn>
              </div>
            </div>
            {/* Fila 2: filtros (buscar cliente, búsqueda, fechas, reportes) */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", paddingBottom: 14, width: "100%", minWidth: 0, boxSizing: "border-box" }}>
              {!isCliente && <div style={{ minWidth: 0, flex: "1 1 220px", maxWidth: "100%" }}><SearchSelect compact options={clientFilterOptions} value={filterCliente.gastos} onChange={(id) => setFilterCliente((p) => ({ ...p, gastos: id || "" }))} placeholder="Buscar cliente..." emptyMessage="Ningún cliente coincide" /></div>}
              <div style={{ position: "relative", minWidth: 0, flex: "1 1 240px", maxWidth: "100%" }}>
                <Search size={15} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--sidebar-text-muted)" }} />
                <input
                  value={gastosSearch}
                  onChange={(e) => setGastosSearch(e.target.value)}
                  placeholder="Buscar por cliente, campaña o código..."
                  style={{ padding: "8px 12px 8px 34px", width: "100%", maxWidth: 320, minWidth: 0, boxSizing: "border-box", background: "var(--color-bg)", border: "1.5px solid var(--sidebar-border)", borderRadius: 12, fontSize: 14, fontFamily: "'Inter'", outline: "none" }}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}><input type="date" value={expRango.gastos.ini} onChange={(e) => setExpRango((p) => ({ ...p, gastos: { ...p.gastos, ini: e.target.value } }))} style={{ padding: "6px 10px", border: "1px solid var(--sidebar-border)", borderRadius: 8, fontSize: 12, fontFamily: "'Inter'", outline: "none" }} title="Fecha desde" /><span style={{ color: "var(--sidebar-text-muted)", fontSize: 11 }}>a</span><input type="date" value={expRango.gastos.fin} onChange={(e) => setExpRango((p) => ({ ...p, gastos: { ...p.gastos, fin: e.target.value } }))} style={{ padding: "6px 10px", border: "1px solid var(--sidebar-border)", borderRadius: 8, fontSize: 12, fontFamily: "'Inter'", outline: "none" }} title="Fecha hasta" /></div>
              {!isCliente && <div style={{ display: "flex", alignItems: "center", gap: 6 }}><input type="text" placeholder="Período MM/AAAA" value={gastosPeriodoReportes} onChange={(e) => setGastosPeriodoReportes(e.target.value)} onBlur={(e) => { const p = parsePeriodoInput(e.target.value); if (p) setGastosPeriodoReportes(p); }} style={{ width: 110, padding: "6px 10px", border: "1px solid var(--sidebar-border)", borderRadius: 8, fontSize: 12, fontFamily: "'Inter'", outline: "none", boxSizing: "border-box" }} title="Período para llevar a reportes" /><Btn variant="outline" size="sm" onClick={() => { const p = gastosPeriodoReportes ? parsePeriodoInput(gastosPeriodoReportes) || gastosPeriodoReportes : tm(); setRepCl(filterCliente.gastos || "all"); setRepPer(p || tm()); setRepPerInput(p || tm()); setRepPeriodoMes(p || tm()); goTo("reportes"); }}><FileText size={14} /> Ver en reportes</Btn></div>}
            </div>
          </div>
          <div className="hm-page-content" style={{ padding: "32px 48px", maxWidth: "none", margin: "0 auto" }}>
            <div style={{ background: "var(--color-surface-2)", border: "1px solid var(--sidebar-border)", borderRadius: 18, overflow: "hidden", boxShadow: "0 1px 4px rgba(15,23,42,.04)" }}>
            {(() => {
              const totalPages = Math.ceil(gastosFiltrados.length / PER_PAGE) || 1;
              const currentPage = Math.min(pageNum.gastos, totalPages);
              const gastosPaginated = gastosFiltrados.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);
              const idsOnPage = gastosPaginated.map((g) => g.id);
              const sel = selectedIds.gastos;
              const allOnPageSelected = idsOnPage.length > 0 && idsOnPage.every((id) => sel.includes(id));
              const colsCount = (isCliente ? 16 : 17) + (!isCliente ? 1 : 0);
              return (
                <>
                  {!isCliente && (selectedIds.gastos.length > 0) && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: "1px solid #e5e7eb" }}>
                      <Btn variant="outline" size="sm" onClick={delGastosBulk} style={{ color: "#dc2626", borderColor: "#dc2640" }}><Trash2 size={14} /> Eliminar seleccionados ({selectedIds.gastos.length})</Btn>
                      <Btn variant="outline" size="sm" onClick={() => openBulkFeeModal("selected")}><Percent size={14} /> Editar Fee ({selectedIds.gastos.length})</Btn>
                    </div>
                  )}
                  <TableScrollWrap className={"hm-table-wrap hm-table-sticky-actions hm-table-gastos" + (isCliente ? " hm-table-gastos--solo-cliente" : "")} autoFocusScroll><table><thead><tr>{!isCliente && <th style={{ ...TH, width: 32 }}><input type="checkbox" checked={allOnPageSelected} onChange={() => selectAllOnPage("gastos", idsOnPage)} title="Seleccionar página" style={{ cursor: "pointer", width: 16, height: 16 }} /></th>}{["Cliente", "Fecha", "Período", "Campaña", "Código", "Gasto", "Fee %", "Fee $", "Total", "Pagado", "Garantía", "Pendiente", "A cobrar", "Estado", "Prepago", ...(isCliente ? [] : ["Usuario"]), ""].map((h) => <th key={h || "actions"} style={TH} className={h === "" ? "hm-col-actions" : undefined} title={h === "A cobrar" ? "Deuda neta del cliente: total pendiente menos garantías vigentes. Es el mismo monto en todas las filas de ese cliente (lo que falta cobrarle)." : h === "Fecha" ? "Fecha de movimiento (dd/mm/aaaa)" : h === "Período" ? "Período contable (mm/aaaa)" : h === "Usuario" ? "Registrado por" : undefined}>{h}</th>)}</tr></thead>
                    <tbody>{gastosPaginated.map((g) => { const c = clients.find((x) => x.id === g.clientId); const garVal = garantias.filter((gr) => gr.clientId === g.clientId && gr.estado === "Vigente").reduce((a, gr) => a + parseFloat(gr.valor || 0), 0); const netCobrar = cData(g.clientId).net; return <tr key={g.id}>{!isCliente && <td style={TD}><input type="checkbox" checked={sel.includes(g.id)} onChange={() => toggleSelect("gastos", g.id)} style={{ cursor: "pointer", width: 16, height: 16 }} /></td>}<td style={TD}><div style={{ display: "flex", alignItems: "center", gap: 7 }}>{c && <Av name={c.name} size={26} avatarUrl={c.avatar_url} />}<span style={{ fontWeight: 600, fontSize: 11.5 }}>{c?.name || "—"}</span></div></td><td style={{ ...TD, fontWeight: 600 }}>{fmtDD(g.fechaMovimiento)}</td><td style={TD}>{fmtM(g.mes)}</td><td style={TD}>{g.camp || "—"}</td><td style={{ ...TD, fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, color: "var(--sidebar-text-active)" }}>{g.codigo || "—"}</td><td style={{ ...TD, ...MN, color: "var(--sidebar-text-active)" }}>${fmt(g.gasto)}</td><td style={{ ...TD, ...MN, color: "var(--color-blue)" }}>{g.fee}%</td><td style={{ ...TD, ...MN, color: "var(--color-blue)" }}>${fmt(g._f)}</td><td style={TD}><span style={{ background: "var(--color-bg)", padding: "3px 7px", borderRadius: 6, border: "1px solid var(--sidebar-border)", fontWeight: 700, fontSize: 11, color: "var(--sidebar-text-active)" }}>${fmt(g._t)}</span></td><td style={{ ...TD, ...MN, color: "#059669" }}>${fmt(g._p)}</td><td style={{ ...TD, ...MN, color: "#7c3aed" }}>{garVal > 0 ? "$" + fmt(garVal) : "—"}</td><td style={{ ...TD, ...MN, color: "#e11d48" }}>${fmt(g._pend)}</td><td style={TD}><span style={{ fontWeight: 700, color: netCobrar > 0 ? "#e11d48" : "#059669" }} title={garVal > 0 ? "Pendiente menos garantía del cliente" : "Igual al pendiente (sin garantía)"}>${fmt(netCobrar)}</span></td><td style={TD}><Bdg type={g._st === "Pagado" ? "ok" : g._st === "Parcial" ? "warn" : "acc"}>{g._st}</Bdg></td><td style={TD}>{g.prepago ? <Bdg type="ok">Prepago</Bdg> : "—"}</td>{!isCliente && <td style={{ ...TD, fontSize: 12, color: "var(--sidebar-text)" }} title={g.created_by || ""}>{g.created_by ? (g.created_by.length > 20 ? g.created_by.slice(0, 18) + "…" : g.created_by) : "—"}</td>}<td className="hm-col-actions" style={TD}>{!isCliente && <div style={{ display: "flex", gap: 4 }}><IBtn onClick={() => openMdl("gasto", g.id)} icon={<Edit3 size={13} />} title="Editar" />{g._st !== "Pagado" && <IBtn onClick={() => openCobroForGastoId(g.id)} icon={<CreditCard size={13} />} title="Añadir cobro" style={{ color: "#059669" }} />}<IBtn onClick={() => openGarantiaForClientId(g.clientId)} icon={<Shield size={13} />} title="Añadir garantía" style={{ color: "#7c3aed" }} /><IBtn onClick={() => delGasto(g.id)} icon={<Trash2 size={13} />} danger title="Eliminar" /></div>}</td></tr>; })}{!gastosPaginated.length && <Empty cols={colsCount} msg={filterCliente.gastos ? "Sin gastos para este cliente" : expRango.gastos.ini || expRango.gastos.fin ? "Sin gastos en el rango de fechas" : "Sin gastos registrados"} />}</tbody></table></TableScrollWrap>
                  {totalPages > 1 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "12px 16px", borderTop: "1px solid #e5e7eb", flexWrap: "wrap" }}>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                        <button key={n} type="button" onClick={() => setPageNum((p) => ({ ...p, gastos: n }))} style={{ minWidth: 36, height: 36, padding: "0 10px", border: n === currentPage ? "none" : "1.5px solid var(--sidebar-border)", borderRadius: 10, background: n === currentPage ? "linear-gradient(135deg, var(--color-primary-hover), var(--color-primary))" : "var(--color-surface-2)", color: n === currentPage ? "var(--color-text-inverse)" : "var(--sidebar-text-active)", fontWeight: n === currentPage ? 700 : 500, fontSize: 13.5, cursor: "pointer", fontFamily: "'Inter'", transition: "all .2s cubic-bezier(.4,0,.2,1)", boxShadow: n === currentPage ? "0 2px 8px rgba(249,115,22,.28)" : "none" }}>{n}</button>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
          </div>
        </div>)}

        {/* ══ RESUMEN (tabla desglose): gerente — KPIs + «Desglose por usuario» (mismas reglas que Métricas / reporte) ══ */}
        {page === "metricas" && !isCliente && (
          <div>
            <div className="hm-page-header hm-page-header--listing" style={{ background: "linear-gradient(90deg, #fff 0%, #eef2ff 100%)", borderBottom: "1px solid #e5e7eb", padding: "0 48px", minHeight: 72, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, position: "sticky", top: 0, zIndex: 50, boxShadow: "0 1px 3px rgba(15,23,42,.04)" }}>
              <div className="hm-page-header-title">
                <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.3, margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ display: "inline-flex", width: 10, height: 10, borderRadius: "50%", background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }} />
                  Resumen
                </h2>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--sidebar-text-muted)", maxWidth: 640 }}>Tabla por cliente y totales del período (mismas reglas que en <strong>Métricas</strong>). Filtrá usuario y mes abajo.</p>
              </div>
            </div>
            <div className="hm-page-content hm-metricas-page" style={{ padding: "32px 48px", margin: "0 auto" }}>
              <div className="hm-resumen-pro-toolbar" style={{ marginBottom: 18 }}>
                <div className="hm-resumen-pro-toolbar-row">
                  <div className="hm-resumen-pro-ss">
                    <SearchSelect compact label="Usuario" options={[{ value: "all", label: "Todos" }, ...clientsSorted.map((c) => ({ value: c.id, label: c.name }))]} value={repCl} onChange={(id) => setRepCl(id || "all")} placeholder="Buscar cliente..." emptyMessage="Ningún cliente coincide" />
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "#5f6577" }}>Filtrar por período (mes):</span>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <button type="button" onClick={() => { const base = repPeriodoMes || tm(); const [y, m] = base.split("-").map(Number); const d = new Date(y, m - 2, 1); setRepPeriodoMes(d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0")); }} style={{ width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #e2e4e9", borderRadius: 8, background: "#fff", color: "#c2410c", cursor: "pointer", flexShrink: 0 }} title="Mes anterior"><ChevronLeft size={16} /></button>
                  <div style={{ minWidth: 90, textAlign: "center", padding: "6px 12px", background: "#f8f9fb", border: "1px solid #e2e4e9", borderRadius: 8, fontSize: 12.5, fontWeight: 600, color: repPeriodoMes ? "#c2410c" : "#9498a8" }}>{repPeriodoMes ? fmtM(repPeriodoMes) : "Todos"}</div>
                  <button type="button" onClick={() => { const base = repPeriodoMes || tm(); const [y, m] = base.split("-").map(Number); const d = new Date(y, m, 1); setRepPeriodoMes(d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0")); }} style={{ width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #e2e4e9", borderRadius: 8, background: "#fff", color: "#c2410c", cursor: "pointer", flexShrink: 0 }} title="Mes siguiente"><ChevronRight size={16} /></button>
                  <input type="text" placeholder="0125, 02/25, MM/AAAA" value={repPeriodoMes} onChange={(e) => setRepPeriodoMes(e.target.value)} onBlur={(e) => { const p = parsePeriodoInput(e.target.value); if (p) setRepPeriodoMes(p); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const p = parsePeriodoInput(e.currentTarget.value); if (p) setRepPeriodoMes(p); e.currentTarget.blur(); } }} style={{ width: 95, boxSizing: "border-box", padding: "6px 10px", border: "1px solid #e2e4e9", borderRadius: 8, fontFamily: "'Inter',sans-serif", fontSize: 12, outline: "none" }} title="Escribí 0125, 02/25 o MM/AAAA" />
                  {repPeriodoMes ? <button type="button" onClick={() => setRepPeriodoMes("")} style={{ padding: "5px 10px", border: "1px solid #e2e4e9", borderRadius: 8, background: "#fff", color: "#9498a8", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Todos</button> : null}
                </div>
                <span style={{ fontSize: 11, color: "#9498a8", maxWidth: 520, lineHeight: 1.45 }}>Todo el resumen (tarjetas y tabla) se filtra por período (mes), no por fecha de pago. Cobros: se usa el mes en que cuenta cada pago.{repPeriodoMes ? <> · <span style={{ fontWeight: 600, color: "#5f6577" }}>{fmtD(repPerInicio)} – {fmtD(repPerFin)}</span></> : null}</span>
              </div>
              <div className="hm-detail-stats hm-metricas-kpi-row" style={{ display: "grid" }}>
                <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 10, padding: "14px 16px", minWidth: 0 }}><div style={{ fontSize: 10, fontWeight: 600, color: "#9498a8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Gasto Ads</div><div style={{ fontFamily: "'Inter', system-ui, sans-serif", fontVariantNumeric: "tabular-nums", fontSize: 19, fontWeight: 700, letterSpacing: "-0.02em" }}>${fmt(repData.t.ads)}</div></div>
                <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 10, padding: "14px 16px", minWidth: 0 }}><div style={{ fontSize: 10, fontWeight: 600, color: "#9498a8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Fees</div><div style={{ fontFamily: "'Inter', system-ui, sans-serif", fontVariantNumeric: "tabular-nums", fontSize: 19, fontWeight: 700, color: "#2563eb", letterSpacing: "-0.02em" }}>${fmt(repData.t.fee)}</div></div>
                <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 10, padding: "14px 16px", minWidth: 0 }}><div style={{ fontSize: 10, fontWeight: 600, color: "#9498a8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Total</div><div style={{ fontFamily: "'Inter', system-ui, sans-serif", fontVariantNumeric: "tabular-nums", fontSize: 19, fontWeight: 700, color: "#d97706", letterSpacing: "-0.02em" }}>${fmt(repData.t.total)}</div></div>
                <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 10, padding: "14px 16px", minWidth: 0 }}><div style={{ fontSize: 10, fontWeight: 600, color: "#9498a8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Cobrado</div><div style={{ fontFamily: "'Inter', system-ui, sans-serif", fontVariantNumeric: "tabular-nums", fontSize: 19, fontWeight: 700, color: "#0d9f6e", letterSpacing: "-0.02em" }}>${fmt(repData.t.paid)}</div><div style={{ height: 5, background: "#eff0f3", borderRadius: 3, marginTop: 10, overflow: "hidden" }}><div style={{ height: "100%", borderRadius: 3, background: "#0d9f6e", width: metricasKpiPct + "%", transition: "width 0.15s ease-out" }} /></div></div>
                <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 10, padding: "14px 16px", minWidth: 0 }}><div style={{ fontSize: 10, fontWeight: 600, color: "#9498a8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Garantías</div><div style={{ fontFamily: "'Inter', system-ui, sans-serif", fontVariantNumeric: "tabular-nums", fontSize: 19, fontWeight: 700, color: "#7c3aed", letterSpacing: "-0.02em" }}>{repData.t.gar > 0 ? "-$" + fmt(repData.t.gar) : "$0"}</div></div>
                <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 10, padding: "14px 16px", minWidth: 0 }}><div style={{ fontSize: 10, fontWeight: 600, color: "#9498a8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Deuda Neta</div><div style={{ fontFamily: "'Inter', system-ui, sans-serif", fontVariantNumeric: "tabular-nums", fontSize: 19, fontWeight: 700, color: repData.t.netPending > 0 ? "#dc2640" : "#0d9f6e", letterSpacing: "-0.02em" }}>${fmt(repData.t.netPending)}</div></div>
              </div>
              <div className="hm-metricas-table-wrap">
                <div className="hm-resumen-pro-alert" style={{ marginBottom: 16 }}>
                  <Shield size={22} style={{ color: "#7c3aed", flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div className="hm-resumen-pro-alert-title">¿Dónde se ven las garantías?</div>
                    <p className="hm-resumen-pro-alert-p" style={{ fontSize: 12.5 }}>Las garantías vigentes con <strong>mes en resumen</strong> = este período aparecen en la tabla aunque no haya gastos con fecha en el mes ni cobros contabilizados aquí. Se descuentan en <strong>GARANTÍA</strong> y en <strong>PEND. NETO</strong>. Los gastos del reporte siguen siendo por <strong>fecha de movimiento</strong> en el rango.</p>
                  </div>
                </div>
                {desglosePorUsuarioTablaEl}
              </div>
            </div>
          </div>
        )}

        {/* ══ COBROS (solo gerente; cliente no ve ni registra cobros) ══ */}
        {page === "cobros" && !isCliente && (<div>
          <div className="hm-page-header hm-page-header--listing" style={{ background: "linear-gradient(90deg, #fff 0%, #ecfdf5 100%)", borderBottom: "1px solid #e5e7eb", padding: "0 48px", minHeight: 72, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, position: "sticky", top: 0, zIndex: 50, boxShadow: "0 1px 3px rgba(15,23,42,.04)" }}>
            <div className="hm-page-header-title">
              <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.3, margin: 0, display: "flex", alignItems: "center", gap: 10 }}><span style={{ display: "inline-flex", width: 10, height: 10, borderRadius: "50%", background: "linear-gradient(135deg, #059669, #10b981)" }} />Cobros</h2>
            </div>
            <div className="hm-page-header-tools">
              <div style={{ background: "linear-gradient(135deg, #eff6ff, #f5f3ff)", color: "#1d4ed8", padding: "7px 16px", borderRadius: 20, fontSize: 13, fontWeight: 700, fontFamily: "'Inter'", border: "1px solid #bfdbfe" }} title="Filtrado por cliente y/o rango de fechas">
                {(filterCliente.cobros || expRango.cobros.ini || expRango.cobros.fin) ? `${cobrosFiltrados.length} de ${cobros.length} cobros` : `${cobros.length} cobros en total`}
              </div>
              <div style={{ minWidth: 0, flex: "1 1 220px", maxWidth: "100%" }}><SearchSelect compact options={clientFilterOptions} value={filterCliente.cobros} onChange={(id) => setFilterCliente((p) => ({ ...p, cobros: id || "" }))} placeholder="Buscar cliente..." emptyMessage="Ningún cliente coincide" /></div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }} title="Filtrar por fecha de pago (también filtra la tabla)">
                <input type="date" value={expRango.cobros.ini} onChange={(e) => setExpRango((p) => ({ ...p, cobros: { ...p.cobros, ini: e.target.value } }))} style={{ padding: "6px 10px", border: "1px solid var(--sidebar-border)", borderRadius: 8, fontSize: 12, fontFamily: "'Inter'", outline: "none" }} />
                <span style={{ color: "var(--sidebar-text-muted)", fontSize: 11 }}>a</span>
                <input type="date" value={expRango.cobros.fin} onChange={(e) => setExpRango((p) => ({ ...p, cobros: { ...p.cobros, fin: e.target.value } }))} style={{ padding: "6px 10px", border: "1px solid var(--sidebar-border)", borderRadius: 8, fontSize: 12, fontFamily: "'Inter'", outline: "none" }} />
              </div>
              <Btn variant="outline" size="sm" onClick={expCobros}><Download size={14} /> Descargar Excel</Btn>
              <Btn onClick={() => openMdl("cobro")}><Plus size={16} /> Registrar Cobro</Btn>
            </div>
          </div>
          <div className="hm-page-content" style={{ padding: "32px 48px", maxWidth: "none", margin: "0 auto" }}><div style={{ background: "var(--color-surface-2)", border: "1px solid var(--sidebar-border)", borderRadius: 18, overflow: "hidden", boxShadow: "0 1px 4px rgba(15,23,42,.04)" }}>
            {(() => {
              const totalPages = Math.ceil(cobrosFiltrados.length / PER_PAGE) || 1;
              const currentPage = Math.min(pageNum.cobros, totalPages);
              const cobrosPaginated = cobrosFiltrados.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);
              const idsOnPage = cobrosPaginated.map((co) => co.id);
              const sel = selectedIds.cobros;
              const allOnPageSelected = idsOnPage.length > 0 && idsOnPage.every((id) => sel.includes(id));
              return (
                <>
                  {selectedIds.cobros.length > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: "1px solid #e5e7eb" }}>
                      <Btn variant="outline" size="sm" onClick={delCobrosBulk} style={{ color: "#dc2626", borderColor: "#dc2640" }}><Trash2 size={14} /> Eliminar seleccionados ({selectedIds.cobros.length})</Btn>
                    </div>
                  )}
                  <TableScrollWrap className="hm-table-wrap hm-table-sticky-actions hm-table-cobros" autoFocusScroll><table><thead><tr><th style={{ ...TH, width: 32 }}><input type="checkbox" checked={allOnPageSelected} onChange={() => selectAllOnPage("cobros", idsOnPage)} title="Seleccionar página" style={{ cursor: "pointer", width: 16, height: 16 }} /></th>{["Cliente", "Cód. cobro", "Cód. gasto", "Fecha", "Hora", "Ref.", "Monto", "Método", "Usuario", "Registrado", "Notas", "Comprob.", ""].map((h) => <th key={h || "actions"} style={TH} className={h === "" ? "hm-col-actions" : undefined} title={h === "Usuario" ? "Registrado por" : undefined}>{h}</th>)}</tr></thead>
                    <tbody>{cobrosPaginated.map((co) => {
                      const g = gastos.find((x) => x.id === co.gastoId);
                      const c = co.clientId ? clients.find((x) => x.id === co.clientId) : (g ? clients.find((x) => x.id === g.clientId) : null);
                      const createdByStr = co.created_by ? (co.created_by.length > 20 ? co.created_by.slice(0, 18) + "…" : co.created_by) : "—";
                      const paths = co.comprobante_urls || [];
                      return (
                        <tr key={co.id}>
                          <td style={TD}><input type="checkbox" checked={sel.includes(co.id)} onChange={() => toggleSelect("cobros", co.id)} style={{ cursor: "pointer", width: 16, height: 16 }} /></td>
                          <td style={TD}>{c ? <div style={{ display: "flex", alignItems: "center", gap: 7 }}><Av name={c.name} size={26} avatarUrl={c.avatar_url} /><span style={{ fontWeight: 600, fontSize: 11.5 }}>{c.name}</span></div> : "—"}</td>
                          <td style={{ ...TD, fontFamily: "var(--font-mono)", fontSize: 10.5, fontWeight: 600, color: "var(--sidebar-text-active)" }}>{co.codigo || "—"}</td>
                          <td style={{ ...TD, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--sidebar-text)" }}>{g?.codigo || "—"}</td>
                          <td style={TD}>{fmtD(co.fecha)}</td>
                          <td style={TD}>{fmtT(co.hora)}</td>
                          <td style={TD}>{g ? fmtM(g.mes) + " " + (g.camp || "") : "—"}</td>
                          <td style={TD}><span style={{ background: "#ecfdf5", padding: "4px 10px", borderRadius: 8, border: "1px solid #d1fae5", color: "#059669", fontWeight: 700 }}>+${fmt(co.monto)}</span></td>
                          <td style={TD}><PayB method={co.metodo} /></td>
                          <td style={{ ...TD, fontSize: 12, color: "var(--sidebar-text)" }} title={co.created_by || ""}>{createdByStr}</td>
                          <td style={{ ...TD, fontSize: 11.5, color: "var(--sidebar-text-muted)" }} title={co.created_at ? fmtDt(co.created_at) : ""}>{co.created_at ? fmtDt(co.created_at) : "—"}</td>
                          <td style={{ ...TD, fontSize: 12.5, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }}>{co.notas ? co.notas : <span style={{ color: "#cbd5e1" }}>Sin notas</span>}</td>
                          <td style={TD}>{paths.length > 0 ? <button type="button" onClick={() => setComprobanteViewer({ type: "cobro", id: co.id, paths })} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 12px", border: "none", borderRadius: 8, background: "linear-gradient(135deg, #eff6ff, #dbeafe)", color: "#1d4ed8", fontSize: 12.5, fontWeight: 600, cursor: "pointer", boxShadow: "0 1px 4px rgba(37,99,235,.1)", transition: "all .15s" }}><Paperclip size={12} /> {paths.length}</button> : "—"}</td>
                          <td className="hm-col-actions" style={TD}><div style={{ display: "flex", gap: 4 }}><IBtn onClick={() => openMdl("cobro", co.id)} icon={<Edit3 size={13} />} title="Editar" /><IBtn onClick={() => delCobro(co.id)} icon={<Trash2 size={13} />} danger /></div></td>
                        </tr>
                      );
                    })}{!cobrosPaginated.length && <Empty cols={14} msg={emptyCobrosMsg} />}</tbody></table></TableScrollWrap>
                  {totalPages > 1 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "12px 16px", borderTop: "1px solid #e5e7eb", flexWrap: "wrap" }}>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                        <button key={n} type="button" onClick={() => setPageNum((p) => ({ ...p, cobros: n }))} style={{ minWidth: 36, height: 36, padding: "0 10px", border: n === currentPage ? "none" : "1.5px solid var(--sidebar-border)", borderRadius: 10, background: n === currentPage ? "linear-gradient(135deg, var(--color-primary-hover), var(--color-primary))" : "var(--color-surface-2)", color: n === currentPage ? "var(--color-text-inverse)" : "var(--sidebar-text-active)", fontWeight: n === currentPage ? 700 : 500, fontSize: 13.5, cursor: "pointer", fontFamily: "'Inter'", transition: "all .2s cubic-bezier(.4,0,.2,1)", boxShadow: n === currentPage ? "0 2px 8px rgba(249,115,22,.28)" : "none" }}>{n}</button>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </div></div>
        </div>)}

        {/* ══ COBRANZA (solo gerente) ══ */}
        {page === "cobranza" && !isCliente && (
          <CobranzaView
            supabase={supabase}
            clients={clients}
            getClienteDeudaNeta={(id, periodoYM) => {
              const p = periodoYM && String(periodoYM).trim() ? normalizePeriod(periodoYM) : "";
              if (!p) return cData(id).net;
              return netPendingClienteEnPeriodo(id, p, sGastos, cobros, gastos, garantias);
            }}
            fmtM={fmtM}
            parsePeriodoInput={parsePeriodoInput}
            userEmail={userEmail}
            onRefetchClients={refetchData}
          />
        )}

        {/* ══ GARANTÍAS ══ */}
        {page === "garantias" && (<div>
          <div className="hm-page-header hm-page-header--listing" style={{ background: "linear-gradient(90deg, #fff 0%, #f5f3ff 100%)", borderBottom: "1px solid #e5e7eb", padding: "0 48px", minHeight: 72, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, position: "sticky", top: 0, zIndex: 50, boxShadow: "0 1px 3px rgba(15,23,42,.04)" }}>
            <div className="hm-page-header-title">
              <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.3, margin: 0, display: "flex", alignItems: "center", gap: 10 }}><span style={{ display: "inline-flex", width: 10, height: 10, borderRadius: "50%", background: "linear-gradient(135deg, #6d28d9, #7c3aed)" }} />Garantías</h2>
            </div>
            <div className="hm-page-header-tools">
              <div style={{ background: "linear-gradient(135deg, #eff6ff, #f5f3ff)", color: "#1d4ed8", padding: "7px 16px", borderRadius: 20, fontSize: 13, fontWeight: 700, fontFamily: "'Inter'", border: "1px solid #bfdbfe" }} title="Total de filas">
                {filterCliente.garantias || filterPeriodoGarantias ? `${garantiasFiltradas.length} de ${garantias.length} garantías` : `${garantias.length} garantías en total`}
              </div>
              {!isCliente && <div style={{ minWidth: 0, flex: "1 1 220px", maxWidth: "100%" }}><SearchSelect compact options={clientFilterOptions} value={filterCliente.garantias} onChange={(id) => setFilterCliente((p) => ({ ...p, garantias: id || "" }))} placeholder="Buscar cliente..." emptyMessage="Ningún cliente coincide" /></div>}
              {!isCliente && <input type="text" placeholder="Período MM/AAAA" value={filterPeriodoGarantias} onChange={(e) => setFilterPeriodoGarantias(e.target.value)} onBlur={(e) => { const p = parsePeriodoInput(e.target.value); if (p) setFilterPeriodoGarantias(p); }} style={{ width: 120, padding: "6px 10px", border: "1px solid var(--sidebar-border)", borderRadius: 8, fontSize: 12, fontFamily: "'Inter'", outline: "none", boxSizing: "border-box" }} title="Filtrar por período (fecha colocación o gasto asociado)" />}
              <Btn variant="outline" size="sm" onClick={expGarantias}><Download size={14} /> Descargar Excel</Btn>
              {!isCliente && <Btn onClick={() => openMdl("garantia")}><Plus size={16} /> Nueva Garantía</Btn>}
            </div>
          </div>
          <div className="hm-page-content" style={{ padding: "32px 48px", maxWidth: "none", margin: "0 auto" }}><div style={{ background: "var(--color-surface-2)", border: "1px solid var(--sidebar-border)", borderRadius: 18, overflow: "hidden", boxShadow: "0 1px 4px rgba(15,23,42,.04)" }}>
            {(() => {
              const totalPages = Math.ceil(garantiasFiltradas.length / PER_PAGE) || 1;
              const currentPage = Math.min(pageNum.garantias, totalPages);
              const garantiasPaginated = garantiasFiltradas.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);
              const idsOnPage = garantiasPaginated.map((g) => g.id);
              const sel = selectedIds.garantias;
              const allOnPageSelected = idsOnPage.length > 0 && idsOnPage.every((id) => sel.includes(id));
              const colsCount = 12 + (!isCliente ? 1 : 0);
              return (
                <>
                  {!isCliente && selectedIds.garantias.length > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: "1px solid #e5e7eb" }}>
                      <Btn variant="outline" size="sm" onClick={delGarantiasBulk} style={{ color: "#dc2626", borderColor: "#dc2640" }}><Trash2 size={14} /> Eliminar seleccionados ({selectedIds.garantias.length})</Btn>
                    </div>
                  )}
                  <TableScrollWrap className={"hm-table-wrap hm-table-sticky-actions hm-table-garantias" + (isCliente ? " hm-table-garantias--solo-cliente" : "")} autoFocusScroll><table><thead><tr>{!isCliente && <th style={{ ...TH, width: 32 }}><input type="checkbox" checked={allOnPageSelected} onChange={() => selectAllOnPage("garantias", idsOnPage)} title="Seleccionar página" style={{ cursor: "pointer", width: 16, height: 16 }} /></th>}{["Cliente", "Cód. verif.", "Cód. gasto", "Gasto ($)", "Tipo", "Descripción", "Valor", "Estado", "Colocación", "Usuario", "Registrado", "Imágenes", ""].map((h) => <th key={h || "actions"} style={TH} className={h === "" ? "hm-col-actions" : undefined}>{h}</th>)}</tr></thead>
                    <tbody>{garantiasPaginated.map((g) => {
                      const c = clients.find((x) => x.id === g.clientId);
                      const gastoAsoc = g.gastoId ? gastos.find((x) => x.id === g.gastoId) : null;
                      const estadoBdg = g.estado === "Vigente" ? "ok" : g.estado === "Ejecutada" ? "err" : "n";
                      const paths = g.imagen_urls || [];
                      const createdByStr = g.created_by ? (g.created_by.length > 20 ? g.created_by.slice(0, 18) + "…" : g.created_by) : "—";
                      return (
                        <tr key={g.id}>
                          {!isCliente && <td style={TD}><input type="checkbox" checked={sel.includes(g.id)} onChange={() => toggleSelect("garantias", g.id)} style={{ cursor: "pointer", width: 16, height: 16 }} /></td>}
                          <td style={TD}>{c ? <div style={{ display: "flex", alignItems: "center", gap: 7 }}><Av name={c.name} size={26} avatarUrl={c.avatar_url} /><span style={{ fontWeight: 600, fontSize: 11.5 }}>{c.name}</span></div> : "—"}</td>
                          <td style={{ ...TD, fontFamily: "var(--font-mono)", fontSize: 10.5, fontWeight: 600, color: "var(--sidebar-text-active)" }}>{g.codigoVerificacion || "—"}</td>
                          <td style={{ ...TD, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--sidebar-text)" }}>{gastoAsoc?.codigo || "—"}</td>
                          <td style={{ ...TD, ...MN }}>{gastoAsoc != null ? "$" + fmt(gastoAsoc.gasto) : "—"}</td>
                          <td style={TD}><Bdg type="gar">{g.tipo}</Bdg></td>
                          <td style={{ ...TD, color: "var(--sidebar-text)", maxWidth: 200 }}>{g.desc || "—"}</td>
                          <td style={TD}><span style={{ background: "#f5f3ff", padding: "4px 10px", borderRadius: 8, border: "1px solid #ddd6fe", color: "#7c3aed", fontWeight: 600 }}>${fmt(g.valor)}</span></td>
                          <td style={TD}><Bdg type={estadoBdg}>{g.estado === "Vigente" ? "🛡️ " + g.estado : g.estado === "Ejecutada" ? "⚡ " + g.estado : g.estado === "Devuelta" ? "↩️ " + g.estado : g.estado}</Bdg></td>
                          <td style={TD}>{g.fechaColocacion ? fmtDD(g.fechaColocacion) : "—"}</td>
                          <td style={{ ...TD, fontSize: 12, color: "var(--sidebar-text)" }} title={g.created_by || ""}>{createdByStr}</td>
                          <td style={{ ...TD, fontSize: 11.5, color: "var(--sidebar-text-muted)" }} title={g.created_at ? fmtDt(g.created_at) : ""}>{g.created_at ? fmtDt(g.created_at) : "—"}</td>
                          <td style={TD}>{paths.length > 0 ? <button type="button" onClick={() => setComprobanteViewer({ type: "garantia", id: g.id, paths })} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 12px", border: "none", borderRadius: 8, background: "linear-gradient(135deg, #f5f3ff, #ede9fe)", color: "#6d28d9", fontSize: 12.5, fontWeight: 600, cursor: "pointer", boxShadow: "0 1px 4px rgba(124,58,237,.1)", transition: "all .15s" }}><Paperclip size={12} /> {paths.length}</button> : "—"}</td>
                          <td className="hm-col-actions" style={TD}>{!isCliente && <div style={{ display: "flex", gap: 4 }}><IBtn onClick={() => openMdl("garantia", g.id)} icon={<Edit3 size={13} />} title="Editar" /><IBtn onClick={() => delGar(g.id)} icon={<Trash2 size={13} />} danger /></div>}</td>
                        </tr>
                      );
                    })}{!garantiasPaginated.length && <Empty cols={colsCount + 1} msg={emptyGarantiasMsg} />}</tbody></table></TableScrollWrap>
                  {totalPages > 1 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "12px 16px", borderTop: "1px solid #e5e7eb", flexWrap: "wrap" }}>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                        <button key={n} type="button" onClick={() => setPageNum((p) => ({ ...p, garantias: n }))} style={{ minWidth: 36, height: 36, padding: "0 10px", border: n === currentPage ? "none" : "1.5px solid var(--sidebar-border)", borderRadius: 10, background: n === currentPage ? "linear-gradient(135deg, var(--color-primary-hover), var(--color-primary))" : "var(--color-surface-2)", color: n === currentPage ? "var(--color-text-inverse)" : "var(--sidebar-text-active)", fontWeight: n === currentPage ? 700 : 500, fontSize: 13.5, cursor: "pointer", fontFamily: "'Inter'", transition: "all .2s cubic-bezier(.4,0,.2,1)", boxShadow: n === currentPage ? "0 2px 8px rgba(249,115,22,.28)" : "none" }}>{n}</button>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </div></div>
        </div>)}
      </main>

      {/* ═══ MODALS ═══ */}
      <Mdl open={modal === "client"} onClose={closeMdl} title={editId ? "Editar Cliente" : "Nuevo Cliente"} footer={<><Btn variant="outline" onClick={closeMdl}>Cancelar</Btn><Btn onClick={saveClient}>Guardar</Btn></>}>
        {isLikelyBlockedAvatarHotlinkUrl(String(cf.avatar_url || "").replace(/&amp;/gi, "&")) && (
          <div role="alert" style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 12, border: "1px solid #fbbf24", background: "linear-gradient(135deg, #fffbeb, #fef3c7)", color: "#92400e", fontSize: 12.5, lineHeight: 1.5 }}>
            <strong style={{ display: "block", marginBottom: 4 }}>Foto que no se verá en Crédito ni en Pendientes</strong>
            Los enlaces de WhatsApp / Meta suelen dar <strong>403</strong> al mostrarse aquí. En Crédito la foto del cliente es la que se sincroniza con el resto del sistema: <strong>subí un archivo</strong> con «{editId ? "Cambiar foto" : "Subir foto"}» (se guarda en Supabase).
          </div>
        )}
        <Inp label={editId ? "Código de cliente *" : "Código de cliente"} value={cf.codigo} onChange={(e) => setCf({ ...cf, codigo: e.target.value })} placeholder={editId ? "Ej. CL-ABC12" : "Se genera al guardar si está vacío"} hint={!editId ? "Opcional: si lo dejás vacío se asigna uno automático." : "Obligatorio al editar."} />
        <div className="hm-form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}><Inp label="Nombre *" value={cf.name} onChange={(e) => setCf({ ...cf, name: e.target.value })} placeholder="Juan Pérez" /><Inp label="Instagram *" value={cf.ig} onChange={(e) => setCf({ ...cf, ig: e.target.value })} placeholder="@usuario o —" /></div>
        <div style={{ marginBottom: 14 }}><label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--color-text)", marginBottom: 5 }}>Teléfonos / WhatsApp *</label><MultiPhone values={cf.phones} onChange={(v) => setCf({ ...cf, phones: v })} /><p style={{ fontSize: 11, color: "var(--sidebar-text-muted)", marginTop: 4 }}>Al menos un número.</p></div>
        <div style={{ marginBottom: 14 }}><label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--color-text)", marginBottom: 5 }}>Correos * <span style={{ fontWeight: 500, color: "#dc2626" }}>(más importante)</span></label><Multi values={cf.emails} onChange={(v) => setCf({ ...cf, emails: v })} placeholder="email@ejemplo.com" type="email" /><p style={{ fontSize: 11, color: "var(--sidebar-text-muted)", marginTop: 4 }}>Al menos un correo válido (con @).</p></div>
        <Inp label="Negocio *" value={cf.biz} onChange={(e) => setCf({ ...cf, biz: e.target.value })} placeholder="E-commerce... o —" />
        <Inp label="Notas *" type="textarea" value={cf.notes} onChange={(e) => setCf({ ...cf, notes: e.target.value })} placeholder="Info adicional... o —" />
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--color-text)", marginBottom: 5 }}>Foto de perfil</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(editId || newClientDraftId) && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "#0f172a", border: "1px solid #0f172a", borderRadius: 8, fontSize: 12.5, fontWeight: 600, color: "var(--color-text-inverse)", cursor: "pointer", whiteSpace: "nowrap" }}>
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: "none" }} onChange={async (e) => {
                    const f = e.target.files?.[0];
                    const cid = editId || newClientDraftId;
                    if (!f || !cid) return;
                    try {
                      setUploadingAvatar(true);
                      const url = await uploadAvatar(cid, f);
                      setCf((p) => ({ ...p, avatar_url: url }));
                    } catch (err) {
                      alert(err?.message || "Error al subir");
                    } finally {
                      setUploadingAvatar(false);
                      e.target.value = "";
                    }
                  }} />
                  <Camera size={15} />
                  {uploadingAvatar ? "Subiendo…" : editId ? "Cambiar foto" : "Subir foto"}
                </label>
                {cf.avatar_url && (
                  <button type="button" onClick={() => setCf((p) => ({ ...p, avatar_url: "" }))} style={{ padding: "8px 14px", border: "1px solid var(--sidebar-border)", borderRadius: 8, fontSize: 12.5, fontWeight: 600, color: "#dc2626", background: "var(--color-surface-2)", cursor: "pointer", whiteSpace: "nowrap" }}>
                    Eliminar foto
                  </button>
                )}
              </div>
            )}
            <div style={{ flex: "1 1 200px", minWidth: 0 }}>
              <Inp label="O pegar URL (opcional)" value={cf.avatar_url} onChange={(e) => setCf({ ...cf, avatar_url: e.target.value })} placeholder="https://…" hint="Opcional si ya subiste archivo. Evitá enlaces de WhatsApp (403)." />
            </div>
          </div>
        </div>
        </Mdl>

      <Mdl open={modal === "gasto"} onClose={closeMdl} title={editId ? "Editar Gasto" : "Nuevo Gasto Mensual"} footer={<><Btn variant="outline" onClick={closeMdl}>Cancelar</Btn><Btn onClick={saveGasto}>Guardar</Btn></>}>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--color-text)", marginBottom: 5 }}>Cliente *</label>
          {(() => {
            const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
            const resolveClient = (txt) => { if (!txt.trim()) return null; const exact = clients.find((x) => norm((x.name || "").trim()) === norm(txt)); if (exact) return exact; const list = clients.filter((c) => norm(c.name || "").includes(norm(txt))); return list.length === 1 ? list[0] : null; };
            const q = gfClientNameInput.trim();
            const sug = q.length > 0 ? clients.filter((c) => norm(c.name || "").includes(norm(q))).slice(0, 10) : [];
            const exactMatch = q.length > 0 && clients.some((c) => norm((c.name || "").trim()) === norm(q));
            const showSuggestions = sug.length > 0 && !exactMatch;
            return (
            <>
          <div style={{ position: "relative" }}>
            <input type="text" value={gfClientNameInput} onChange={(e) => setGfClientNameInput(e.target.value)} placeholder="Escribí el nombre o elegí una sugerencia..." style={{ width: "100%", boxSizing: "border-box", padding: "10px 13px", background: "var(--color-surface-2)", border: "1px solid var(--sidebar-border)", borderRadius: 8, fontFamily: "'Inter',sans-serif", fontSize: 13.5, outline: "none" }} onBlur={() => { const txt = gfClientNameInput.trim(); if (!txt) { setGf({ ...gf, clientId: "" }); return; } const c = clients.find((x) => norm((x.name || "").trim()) === norm(txt)); if (c) { setGf({ ...gf, clientId: c.id }); setGfClientNameInput(c.name); } else setGf({ ...gf, clientId: "" }); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const c = resolveClient(gfClientNameInput); if (c) { setGf({ ...gf, clientId: c.id }); setGfClientNameInput(c.name); } else if (q) setGf({ ...gf, clientId: "" }); e.currentTarget.blur(); } }} />
            {showSuggestions && (
            <div style={{ position: "absolute", left: 0, right: 0, top: "100%", marginTop: 4, background: "var(--color-surface-2)", border: "1px solid var(--sidebar-border)", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,.08)", maxHeight: 220, overflowY: "auto", zIndex: 20 }}>
              <div style={{ padding: "6px 10px", fontSize: 11, fontWeight: 600, color: "var(--sidebar-text-muted)", borderBottom: "1px solid #eee" }}>Solo nombres que coinciden — elegí uno o seguí escribiendo</div>
              {sug.map((c) => (
                <button key={c.id} type="button" onMouseDown={(ev) => { ev.preventDefault(); setGf({ ...gf, clientId: c.id }); setGfClientNameInput(c.name); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 13px", border: "none", background: "none", fontFamily: "'Inter',sans-serif", fontSize: 13, color: "var(--sidebar-text-active)", cursor: "pointer" }} onMouseEnter={(e) => { e.currentTarget.style.background = "#eff6ff"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}>{c.name}</button>
              ))}
            </div>
            )}
          </div>
          <p style={{ fontSize: 11, color: "var(--sidebar-text-muted)", marginTop: 4 }}>Escribí el nombre (aparecen solo los que coinciden). Enter o clic afuera fija el cliente.</p>
            </>
            );
          })()}
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--color-text)", marginBottom: 5 }}>Período * (solo mes y año)</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input type="month" value={gf.mes || tm()} onChange={(e) => { const v = e.target.value; if (v) setGf((p) => ({ ...p, mes: v, fechaMovimiento: v + "-15", periodoInput: v })); }} style={{ width: 160, boxSizing: "border-box", padding: "9px 13px", background: "var(--color-surface-2)", border: "1px solid var(--sidebar-border)", borderRadius: 8, fontFamily: "'Inter',sans-serif", fontSize: 13.5, outline: "none" }} title="Mes y año" />
            <button type="button" onClick={() => { const y = new Date().getFullYear(), m = String(new Date().getMonth() + 1).padStart(2, "0"); const key = `${y}-${m}`; setGf((p) => ({ ...p, mes: key, fechaMovimiento: key + "-15", periodoInput: key })); }} style={{ padding: "8px 12px", border: "1px solid var(--sidebar-border)", borderRadius: 8, background: "#eff6ff", color: "var(--color-blue)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter'" }}>Este mes</button>
            <button type="button" onClick={() => { const d = new Date(); d.setMonth(d.getMonth() - 1); const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"); const key = `${y}-${m}`; setGf((p) => ({ ...p, mes: key, fechaMovimiento: key + "-15", periodoInput: key })); }} style={{ padding: "8px 12px", border: "1px solid var(--sidebar-border)", borderRadius: 8, background: "var(--color-bg)", color: "var(--sidebar-text)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter'" }}>Mes pasado</button>
            <span style={{ fontSize: 12, color: "var(--sidebar-text-muted)" }}>o</span>
            <input type="text" placeholder="MM/AAAA o 2025-01" value={gf.periodoInput ?? gf.mes ?? ""} onChange={(e) => setGf({ ...gf, periodoInput: e.target.value })} onBlur={(e) => { const parsed = parsePeriodoInput(e.target.value); if (parsed) setGf((p) => ({ ...p, mes: parsed, fechaMovimiento: parsed + "-15", periodoInput: parsed })); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const parsed = parsePeriodoInput(e.currentTarget.value); if (parsed) setGf((p) => ({ ...p, mes: parsed, fechaMovimiento: parsed + "-15", periodoInput: parsed })); e.currentTarget.blur(); } }} style={{ width: 120, boxSizing: "border-box", padding: "9px 13px", background: "var(--color-surface-2)", border: "1px solid var(--sidebar-border)", borderRadius: 8, fontFamily: "'Inter',sans-serif", fontSize: 13.5, outline: "none" }} />
          </div>
          <div style={{ fontSize: 11, color: "var(--sidebar-text-muted)", marginTop: 4 }}>Solo mes y año. La fecha de movimiento se guarda como día 15 del mes.</div>
        </div>
        <Inp label="Campaña / referencia" value={gf.camp} onChange={(e) => setGf({ ...gf, camp: e.target.value })} placeholder="Ej. Campaña Feb 2025" />
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}><input type="checkbox" id="gf-prepago" checked={!!gf.prepago} onChange={(e) => setGf({ ...gf, prepago: e.target.checked })} style={{ width: 18, height: 18, accentColor: "#0f172a" }} /><label htmlFor="gf-prepago" style={{ fontSize: 13, fontWeight: 600, color: "var(--sidebar-text)", cursor: "pointer" }}>Prepago (recarga) — marca este gasto como prepago (S/N en la tabla)</label></div>
        <Inp label="Gasto en Ads ($) *" type="number" step="0.01" min="0" value={gf.gasto} onChange={(e) => setGf({ ...gf, gasto: e.target.value })} placeholder="0.00" hint="Inversión en TikTok Ads (u otra red)" />
        <Inp label="Fee / Comisión (%)" type="number" step="0.1" min="0" max="100" value={gf.fee} onChange={(e) => setGf({ ...gf, fee: e.target.value })} hint="Porcentaje sobre el gasto" />
        <div style={{ background: "linear-gradient(135deg, #eff6ff, #f5f3ff)", padding: "16px 18px", borderRadius: 14, fontFamily: "'Inter', system-ui, sans-serif", fontVariantNumeric: "tabular-nums", fontSize: 15, fontWeight: 600, textAlign: "center", marginBottom: 18, color: "var(--sidebar-text-active)", border: "1px solid #bfdbfe", display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}><span style={{ color: "var(--color-blue)" }}>Fee: ${fmt(parseFloat(gf.gasto || 0) * (parseFloat(gf.fee || 0) / 100))}</span><span style={{ color: "var(--sidebar-text-muted)" }}>→</span><span style={{ fontSize: 17, color: "#059669", fontWeight: 700 }}>Total: ${fmt(parseFloat(gf.gasto || 0) * (1 + parseFloat(gf.fee || 0) / 100))}</span></div>
        <Inp label="Notas" type="textarea" value={gf.notas} onChange={(e) => setGf({ ...gf, notas: e.target.value })} placeholder="Detalles del gasto o campaña..." />
        {editId && gf.prepago && !isCliente && (() => {
          const g = sGastos.find((x) => x.id === editId);
          if (!g || g._st === "Pagado") return null;
          const clienteNombre = clients.find((c) => c.id === g.clientId)?.name || "este gasto";
          return (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--sidebar-hover)" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--sidebar-text)", marginBottom: 8 }}>Cobro para este gasto (prepago)</div>
              <button type="button" onClick={() => openCobroForGastoId(editId)} style={{ display: "inline-flex", alignItems: "center", gap: 12, padding: "14px 20px", border: "2px dashed #10b981", borderRadius: 14, background: "linear-gradient(135deg, #ecfdf5, #d1fae5)", color: "#047857", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", width: "100%", justifyContent: "center", transition: "all .2s", boxShadow: "0 2px 8px rgba(5,150,105,.08)" }}>
                <CreditCard size={20} /> Añadir cobro — {clienteNombre} · {g.codigo || fmtM(g.mes)} (pendiente ${fmt(g._pend)})
              </button>
              <div style={{ fontSize: 11, color: "var(--sidebar-text-muted)", marginTop: 6 }}>Se abre el formulario de cobro con este gasto y el monto pendiente ya cargados.</div>
            </div>
          );
        })()}
        {gf.clientId && !isCliente && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--sidebar-hover)" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--sidebar-text)", marginBottom: 8 }}>Garantía para este cliente</div>
            <button type="button" onClick={() => openGarantiaForClientId(gf.clientId)} style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "14px 20px", border: "2px dashed #8b5cf6", borderRadius: 14, background: "linear-gradient(135deg, #f5f3ff, #ede9fe)", color: "#6d28d9", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", width: "100%", justifyContent: "center", transition: "all .2s" }}>
              <Shield size={18} /> Añadir garantía para {clients.find((c) => c.id === gf.clientId)?.name || "este cliente"}
            </button>
            <div style={{ fontSize: 11, color: "var(--sidebar-text-muted)", marginTop: 6 }}>Las garantías se descuentan de la deuda al calcular el pendiente neto.</div>
          </div>
        )}
      </Mdl>

      <Mdl
        open={modal === "gasto-fee-bulk"}
        onClose={closeMdl}
        title="Edición masiva de Fee"
        footer={<><Btn variant="outline" onClick={closeMdl}>Cancelar</Btn><Btn onClick={applyBulkFee} disabled={!bulkFee.trim()}>Aplicar</Btn></>}
      >
        <div style={{ marginBottom: 12, fontSize: 12.5, color: "var(--sidebar-text)" }}>
          Elegí si querés actualizar solo los gastos seleccionados o todos los que están filtrados en la tabla, y luego defini el nuevo porcentaje de Fee.
        </div>
        <div style={{ marginBottom: 14, display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
            <input
              type="radio"
              name="bulk-fee-scope"
              checked={bulkFeeScope === "selected"}
              onChange={() => setBulkFeeScope("selected")}
              disabled={selectedIds.gastos.length === 0}
              style={{ width: 16, height: 16, cursor: selectedIds.gastos.length === 0 ? "not-allowed" : "pointer" }}
            />
            <span>
              Solo gastos seleccionados
              {" "}
              <span style={{ color: "var(--sidebar-text-muted)" }}>({selectedIds.gastos.length} seleccionado(s))</span>
            </span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
            <input
              type="radio"
              name="bulk-fee-scope"
              checked={bulkFeeScope === "filtered"}
              onChange={() => setBulkFeeScope("filtered")}
              style={{ width: 16, height: 16, cursor: "pointer" }}
            />
            <span>
              Todos los gastos filtrados en la tabla
              {" "}
              <span style={{ color: "var(--sidebar-text-muted)" }}>({gastosFiltrados.length} gasto(s))</span>
            </span>
          </label>
        </div>
        <Inp
          label="Nuevo Fee (%)"
          type="number"
          step="0.1"
          min="0"
          value={bulkFee}
          onChange={(e) => setBulkFee(e.target.value)}
          hint="Se aplicará este porcentaje al gasto de cada fila incluida en el alcance elegido."
        />
        <div style={{ fontSize: 11, color: "var(--sidebar-text-muted)", marginTop: 4 }}>
          El total a cobrar de cada gasto se recalculará automáticamente según el nuevo Fee.
        </div>
      </Mdl>

      <Mdl open={modal === "cobro"} onClose={closeMdl} title={editId ? "Editar Cobro" : "Registrar Cobro"} footer={<><Btn variant="outline" onClick={closeMdl} disabled={uploadingComprobantes}>Cancelar</Btn><Btn variant="accent" onClick={saveCobro} disabled={uploadingComprobantes}>{uploadingComprobantes ? "Subiendo…" : editId ? "Guardar" : "Registrar"}</Btn></>}>
        {!editId && (
        <>
        <div style={{ marginBottom: 16, padding: "18px 20px", background: "linear-gradient(135deg, #ecfdf5, #f0fdf4)", border: "1.5px solid #86efac", borderRadius: 16, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: -15, right: -15, width: 60, height: 60, borderRadius: "50%", background: "rgba(16,185,129,.08)", pointerEvents: "none" }} />
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 700, color: "#166534", marginBottom: 10 }}><div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} />¿Cuánto pagó el cliente? ($) *</label>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <input type="number" step="0.01" min="0" value={cof.monto} onChange={(e) => setCof({ ...cof, monto: e.target.value })} placeholder="Ej. 1500" style={{ width: "100%", maxWidth: 260, padding: "16px 18px", fontSize: 24, fontWeight: 700, border: "2px solid #22c55e", borderRadius: 14, fontFamily: "var(--font-mono)", outline: "none", boxSizing: "border-box", background: "#f0fdf4", letterSpacing: -0.5 }} />
            <button type="button" onClick={() => { const m = parseFloat(cof.monto) || 0; if (m <= 0) return; let pendientes = sGastos.filter((g) => g._st !== "Pagado"); if (cofFilterCliente) pendientes = pendientes.filter((g) => g.clientId === cofFilterCliente); if (cofFilterPeriodo) pendientes = pendientes.filter((g) => (g.mes || "") === cofFilterPeriodo); const ordenados = [...pendientes].sort((a, b) => (a.mes || "").localeCompare(b.mes || "") || (a.fechaMovimiento || "").localeCompare(b.fechaMovimiento || "")); let sum = 0; const ids = []; for (const g of ordenados) { ids.push(g.id); sum += g._pend; if (sum >= m) break; } setCof({ ...cof, gastoIds: ids }); }} style={{ padding: "10px 18px", fontSize: 13, fontWeight: 600, border: "none", borderRadius: 10, background: "linear-gradient(135deg, #22c55e, #10b981)", color: "var(--color-text-inverse)", cursor: "pointer", boxShadow: "0 2px 8px rgba(16,185,129,.3)" }}>✨ Sugerir gastos</button>
          </div>
          <p style={{ fontSize: 11, color: "#166534", marginTop: 8, marginBottom: 0 }}>Con este monto el sistema te mostrará qué gastos se cubren (total o parcial) y el resumen exacto del voucher.</p>
        </div>
        <div style={{ marginBottom: 14 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--sidebar-text)", display: "block", marginBottom: 6 }}>Aplicar monto</span>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}><input type="radio" name="cof-distribucion" checked={cof.distribucion === "orden"} onChange={() => setCof({ ...cof, distribucion: "orden" })} />En orden (primero el más antiguo)</label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}><input type="radio" name="cof-distribucion" checked={cof.distribucion === "proporcional"} onChange={() => setCof({ ...cof, distribucion: "proporcional" })} />Proporcional al pendiente</label>
          </div>
          <p style={{ fontSize: 11, color: "var(--sidebar-text-muted)", marginTop: 4 }}>En orden: se cubre primero el gasto más antiguo; si sobra, el siguiente. Pago parcial en un gasto (ej. $200 de $300) deja el resto pendiente.</p>
        </div>
        <div className="hm-form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 14 }}>
          <div><label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--color-text)", marginBottom: 5 }}>{cof.sinAsignarGasto ? "Cliente del cobro *" : "Cliente (filtrar)"}</label><SearchSelect compact options={[{ value: "", label: cof.sinAsignarGasto ? "Elegir cliente..." : "Todos los clientes" }, ...clientsSorted.map((c) => ({ value: c.id, label: c.name }))]} value={cof.sinAsignarGasto ? cof.clientId : cofFilterCliente} onChange={(id) => { const v = id || ""; if (cof.sinAsignarGasto) setCof({ ...cof, clientId: v }); setCofFilterCliente(v); }} placeholder={cof.sinAsignarGasto ? "Buscar cliente..." : "Todos..."} emptyMessage="Ningún cliente" /></div>
          <div style={{ opacity: cof.sinAsignarGasto ? 0.5 : 1, pointerEvents: cof.sinAsignarGasto ? "none" : "auto" }}>
            <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--color-text)", marginBottom: 5 }}>Período (filtrar)</label>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <button type="button" disabled={cof.sinAsignarGasto} onClick={() => { const base = cofFilterPeriodo || tm(); const [y, m] = base.split("-").map(Number); const d = new Date(y, m - 2, 1); setCofFilterPeriodo(d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0")); }} style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--sidebar-border)", borderRadius: 8, background: "var(--color-surface-2)", color: "var(--sidebar-text-active)", cursor: cof.sinAsignarGasto ? "not-allowed" : "pointer", flexShrink: 0 }} title="Mes anterior"><ChevronLeft size={18} /></button>
              <div style={{ flex: 1, minWidth: 100, textAlign: "center", padding: "8px 10px", background: "var(--color-bg)", border: "1px solid var(--sidebar-border)", borderRadius: 8, fontSize: 13, fontWeight: 600, color: cofFilterPeriodo ? "var(--sidebar-text-active)" : "var(--sidebar-text-muted)" }}>{cofFilterPeriodo ? fmtM(cofFilterPeriodo) : "Todos"}</div>
              <button type="button" disabled={cof.sinAsignarGasto} onClick={() => { const base = cofFilterPeriodo || tm(); const [y, m] = base.split("-").map(Number); const d = new Date(y, m, 1); setCofFilterPeriodo(d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0")); }} style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--sidebar-border)", borderRadius: 8, background: "var(--color-surface-2)", color: "var(--sidebar-text-active)", cursor: cof.sinAsignarGasto ? "not-allowed" : "pointer", flexShrink: 0 }} title="Mes siguiente"><ChevronRight size={18} /></button>
              <input type="text" placeholder="0125, 01/25, MM/AAAA" value={cofFilterPeriodo} onChange={(e) => setCofFilterPeriodo(e.target.value)} onBlur={(e) => { const p = parsePeriodoInput(e.target.value); if (p) setCofFilterPeriodo(p); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const p = parsePeriodoInput(e.currentTarget.value); if (p) setCofFilterPeriodo(p); e.currentTarget.blur(); } }} disabled={cof.sinAsignarGasto} style={{ width: 100, boxSizing: "border-box", padding: "8px 10px", border: "1px solid var(--sidebar-border)", borderRadius: 8, fontFamily: "'Inter',sans-serif", fontSize: 12, outline: "none", background: cof.sinAsignarGasto ? "var(--color-bg)" : "var(--color-surface-2)" }} title="Escribí 0125, 01/25 o MM/AAAA" />
              {cofFilterPeriodo && <button type="button" disabled={cof.sinAsignarGasto} onClick={() => setCofFilterPeriodo("")} style={{ padding: "6px 10px", border: "1px solid var(--sidebar-border)", borderRadius: 8, background: "var(--color-surface-2)", color: "var(--sidebar-text-muted)", fontSize: 11, fontWeight: 600, cursor: cof.sinAsignarGasto ? "not-allowed" : "pointer" }}>Limpiar</button>}
            </div>
            {cof.sinAsignarGasto && <div style={{ fontSize: 11, color: "var(--sidebar-text-muted)", marginTop: 3 }}>Deshabilitado cuando el cobro es sin asignar. Usá «Período (mes/año)» más abajo.</div>}
          </div>
        </div>
        </>
        )}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--color-text)", marginBottom: 5 }}>Gastos</label>
          <p style={{ fontSize: 11, color: "var(--sidebar-text-muted)", marginBottom: 6 }}>Elegí uno o varios gastos a los que se aplicará el pago, o <strong>Ninguna</strong> para registrar un cobro sin asignar a ningún gasto (ej. depósito general).</p>
          <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", marginBottom: 8, borderRadius: 8, cursor: "pointer", background: cof.sinAsignarGasto ? "#fef3c7" : "transparent", border: cof.sinAsignarGasto ? "1px solid #f59e0b" : "1px solid #e5e7eb" }}>
            <input type="radio" name="cof-gasto-mode" checked={cof.sinAsignarGasto} onChange={() => setCof({ ...cof, sinAsignarGasto: true, gastoIds: [], clientId: cofFilterCliente || cof.clientId || "" })} style={{ width: 18, height: 18, cursor: "pointer", accentColor: "#d97706" }} />
            <span style={{ fontSize: 13, fontWeight: cof.sinAsignarGasto ? 600 : 500, color: cof.sinAsignarGasto ? "#92400e" : "#1a1d26" }}>Ninguna — cobro sin asignar a ningún gasto</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", marginBottom: 8, borderRadius: 8, cursor: "pointer", background: !cof.sinAsignarGasto && (cof.gastoIds || []).length > 0 ? "#e6f7f0" : "transparent", border: !cof.sinAsignarGasto ? "1px solid #e5e7eb" : "1px solid #e5e7eb" }}>
            <input type="radio" name="cof-gasto-mode" checked={!cof.sinAsignarGasto} onChange={() => setCof({ ...cof, sinAsignarGasto: false })} style={{ width: 18, height: 18, cursor: "pointer", accentColor: "#0d9f6e" }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--sidebar-text-active)" }}>Asignar a uno o más gastos (elegir abajo)</span>
          </label>
          {editId && cof.sinAsignarGasto && (
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--color-text)", marginBottom: 5 }}>Cliente del cobro *</label>
              <SearchSelect options={[{ value: "", label: "Elegir cliente..." }, ...clientsSorted.map((c) => ({ value: c.id, label: c.name }))]} value={cof.clientId} onChange={(id) => setCof({ ...cof, clientId: id || "" })} placeholder="Buscar por nombre..." emptyMessage="Ningún cliente coincide" />
            </div>
          )}
          <input type="text" value={cofGastosQuery} onChange={(e) => setCofGastosQuery(e.target.value)} placeholder="Buscar por nombre o código..." disabled={!!cof.sinAsignarGasto} style={{ width: "100%", boxSizing: "border-box", padding: "9px 13px", marginBottom: 8, background: cof.sinAsignarGasto ? "var(--color-bg)" : "var(--color-surface-2)", border: "1px solid var(--sidebar-border)", borderRadius: 8, fontFamily: "'Inter',sans-serif", fontSize: 13, outline: "none" }} />
          <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid var(--sidebar-border)", borderRadius: 8, padding: 4, opacity: cof.sinAsignarGasto ? 0.6 : 1, pointerEvents: cof.sinAsignarGasto ? "none" : "auto" }}>
            {(() => { let pendientes = sGastos.filter((g) => g._st !== "Pagado"); if (cofFilterCliente) pendientes = pendientes.filter((g) => g.clientId === cofFilterCliente); if (cofFilterPeriodo) pendientes = pendientes.filter((g) => (g.mes || "") === cofFilterPeriodo); const filtrados = pendientes.filter((g) => { if (!cofGastosQuery.trim()) return true; const c = clients.find((x) => x.id === g.clientId); const text = `${c?.name || ""} ${fmtM(g.mes)} ${g.codigo || ""} ${g.camp || ""}`.toLowerCase(); return text.includes(cofGastosQuery.trim().toLowerCase()); }); if (sGastos.filter((g) => g._st !== "Pagado").length === 0) return <div style={{ padding: 12, fontSize: 12.5, color: "var(--sidebar-text-muted)" }}>No hay gastos pendientes</div>; if (pendientes.length === 0) return <div style={{ padding: 12, fontSize: 12.5, color: "var(--sidebar-text-muted)" }}>No hay gastos pendientes para este cliente/período. Probá otros filtros.</div>; if (filtrados.length === 0) return <div style={{ padding: 12, fontSize: 12.5, color: "var(--sidebar-text-muted)" }}>Ningún gasto coincide con la búsqueda</div>; return filtrados.map((g) => { const c = clients.find((x) => x.id === g.clientId); const checked = (cof.gastoIds || []).includes(g.id); return (
              <label key={g.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, cursor: "pointer", background: checked ? "linear-gradient(135deg, #ecfdf5, #d1fae5)" : "transparent", border: checked ? "1px solid #86efac" : "1px solid transparent", transition: "all .15s", marginBottom: 2 }}>
                <input type="checkbox" checked={checked} onChange={() => { const list = checked ? (cof.gastoIds || []).filter((id) => id !== g.id) : [...(cof.gastoIds || []), g.id]; setCof({ ...cof, sinAsignarGasto: false, gastoIds: list }); }} style={{ width: 18, height: 18, cursor: "pointer", accentColor: "#0d9f6e" }} />
                <span style={{ fontSize: 13, fontWeight: checked ? 600 : 500, color: checked ? "#0d9f6e" : "#1a1d26" }}>{c?.name || "?"} — {fmtM(g.mes)} · {g.camp || "—"} (${fmt(g._pend)}){g.prepago ? " · Prepago" : ""}</span>
              </label>
            ); }); })()}
          </div>
          {(cof.gastoIds || []).length > 0 && (
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#059669", padding: "4px 10px", background: "#ecfdf5", borderRadius: 8 }}>Seleccionados: {(cof.gastoIds || []).length} — Pendiente sumado: ${fmt((cof.gastoIds || []).reduce((a, gid) => { const g = sGastos.find((x) => x.id === gid); return a + (g ? g._pend : 0); }, 0))}</span>
            {!editId && <button type="button" onClick={() => { const sum = (cof.gastoIds || []).reduce((a, gid) => { const g = sGastos.find((x) => x.id === gid); return a + (g ? g._pend : 0); }, 0); setCof({ ...cof, monto: sum > 0 ? sum.toFixed(2) : cof.monto }); }} style={{ padding: "6px 14px", fontSize: 12, fontWeight: 600, border: "none", borderRadius: 8, background: "linear-gradient(135deg, #059669, #10b981)", color: "var(--color-text-inverse)", cursor: "pointer", boxShadow: "0 2px 6px rgba(5,150,105,.2)" }}>Rellenar monto</button>}
          </div>
          )}
        </div>
        {!editId && (cof.gastoIds || []).length > 0 && parseFloat(cof.monto) > 0 && (
        <div style={{ marginBottom: 16, padding: "18px 20px", background: "linear-gradient(135deg, #f5f3ee, #eff6ff)", border: "1.5px solid #bfdbfe", borderRadius: 16, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: "rgba(37,99,235,.06)", pointerEvents: "none" }} />
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--sidebar-text-active)", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 8, height: 8, borderRadius: "50%", background: "linear-gradient(135deg, #2563eb, #059669)" }} />Resumen de aplicación</div>
          <div style={{ fontSize: 13, color: "var(--color-text)", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>Total pagado: <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "#059669", fontSize: 16, padding: "2px 8px", background: "#ecfdf5", borderRadius: 6 }}>${fmt(parseFloat(cof.monto) || 0)}</span></div>
          <div style={{ overflowX: "auto", maxHeight: 220, overflowY: "auto", borderRadius: 10, border: "1px solid var(--sidebar-border)", background: "var(--color-surface-2)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead><tr style={{ background: "var(--color-bg)" }}><th style={{ textAlign: "left", padding: "10px 12px", color: "var(--sidebar-text)", fontWeight: 600, borderBottom: "1px solid #e5e7eb", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>Campaña</th><th style={{ textAlign: "left", padding: "10px 12px", color: "var(--sidebar-text)", fontWeight: 600, borderBottom: "1px solid #e5e7eb", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>Período</th><th style={{ textAlign: "left", padding: "10px 12px", color: "var(--sidebar-text)", fontWeight: 600, borderBottom: "1px solid #e5e7eb", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>Código</th><th style={{ textAlign: "right", padding: "10px 12px", color: "var(--sidebar-text)", fontWeight: 600, borderBottom: "1px solid #e5e7eb", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>Antes</th><th style={{ textAlign: "right", padding: "10px 12px", color: "#059669", fontWeight: 600, borderBottom: "1px solid #e5e7eb", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>Aplicado</th><th style={{ textAlign: "right", padding: "10px 12px", color: "var(--sidebar-text)", fontWeight: 600, borderBottom: "1px solid #e5e7eb", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>Después</th></tr></thead>
              <tbody>{resumenCobro.lineas.filter((l) => l.montoAplicado > 0).map((l, idx) => <tr key={l.gastoId} style={{ borderBottom: "1px solid var(--sidebar-hover)", background: idx % 2 === 0 ? "var(--color-surface-2)" : "var(--color-surface)" }}><td style={{ padding: "10px 12px", fontWeight: 500 }}>{l.camp}</td><td style={{ padding: "10px 12px" }}>{fmtM(l.mes)}</td><td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--sidebar-text-active)" }}>{l.codigo}</td><td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "var(--font-mono)" }}>${fmt(l.pendienteAntes)}</td><td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: "#059669", fontFamily: "var(--font-mono)" }}>+${fmt(l.montoAplicado)}</td><td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "var(--font-mono)", color: l.pendienteDespues > 0 ? "#e11d48" : "#059669", fontWeight: 600 }}>${fmt(l.pendienteDespues)}</td></tr>)}</tbody>
            </table>
          </div>
          {resumenCobro.excedente > 0 && <div style={{ marginTop: 12, padding: "12px 14px", background: "linear-gradient(135deg, #fffbeb, #fef3c7)", border: "1.5px solid #fbbf24", borderRadius: 10, fontSize: 13, color: "#92400e", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 18 }}>⚡</span> Excedente ${fmt(resumenCobro.excedente)} → se registra como garantía para el siguiente mes</div>}
        </div>
        )}
        <div className="hm-form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          {editId && <div><Inp label="Monto total ($) *" type="number" step="0.01" min="0" value={cof.monto} onChange={(e) => setCof({ ...cof, monto: e.target.value })} placeholder="0.00" /></div>}
          <Inp label={cof.sinAsignarGasto ? "Fecha de pago" : "Fecha"} type="date" value={cof.fecha} onChange={(e) => setCof({ ...cof, fecha: e.target.value })} />
          <div style={{ marginBottom: 14, minWidth: 0, opacity: !cof.sinAsignarGasto ? 0.5 : 1, pointerEvents: !cof.sinAsignarGasto ? "none" : "auto" }}>
            <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--color-text)", marginBottom: 5 }}>Período (mes/año) para el resumen</label>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <button type="button" disabled={!cof.sinAsignarGasto} onClick={() => { const base = (cof.periodoResumen && String(cof.periodoResumen).trim()) || tm(); const [y, m] = base.split("-").map(Number); const d = new Date(y, m - 2, 1); setCof({ ...cof, periodoResumen: d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") }); }} style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--sidebar-border)", borderRadius: 8, background: "var(--color-surface-2)", color: "var(--sidebar-text-active)", cursor: !cof.sinAsignarGasto ? "not-allowed" : "pointer", flexShrink: 0 }} title="Mes anterior"><ChevronLeft size={18} /></button>
              <div style={{ flex: 1, minWidth: 100, textAlign: "center", padding: "8px 10px", background: "var(--color-bg)", border: "1px solid var(--sidebar-border)", borderRadius: 8, fontSize: 13, fontWeight: 600, color: (cof.periodoResumen && String(cof.periodoResumen).trim()) ? "#0f172a" : "#94a3b8" }}>{(cof.periodoResumen && String(cof.periodoResumen).trim()) ? fmtM(normalizePeriod(String(cof.periodoResumen).trim())) : "Elegir mes"}</div>
              <button type="button" disabled={!cof.sinAsignarGasto} onClick={() => { const base = (cof.periodoResumen && String(cof.periodoResumen).trim()) || tm(); const [y, m] = base.split("-").map(Number); const d = new Date(y, m, 1); setCof({ ...cof, periodoResumen: d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") }); }} style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--sidebar-border)", borderRadius: 8, background: "var(--color-surface-2)", color: "var(--sidebar-text-active)", cursor: !cof.sinAsignarGasto ? "not-allowed" : "pointer", flexShrink: 0 }} title="Mes siguiente"><ChevronRight size={18} /></button>
              <input type="text" placeholder="0125, 01/25, MM/AAAA" value={cof.periodoResumen ?? ""} onChange={(e) => setCof({ ...cof, periodoResumen: e.target.value })} onBlur={(e) => { const p = parsePeriodoInput(e.target.value); if (p) setCof({ ...cof, periodoResumen: p }); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const p = parsePeriodoInput(e.currentTarget.value); if (p) { setCof({ ...cof, periodoResumen: p }); e.currentTarget.blur(); } } }} disabled={!cof.sinAsignarGasto} style={{ width: 100, boxSizing: "border-box", padding: "8px 10px", border: "1px solid var(--sidebar-border)", borderRadius: 8, fontFamily: "'Inter',sans-serif", fontSize: 12, outline: "none", background: !cof.sinAsignarGasto ? "var(--color-bg)" : "var(--color-surface-2)" }} title="Escribí 0125, 01/25 o MM/AAAA. Mes en que cuenta este cobro en el resumen; la fecha de pago no se modifica." />
              {(cof.periodoResumen && String(cof.periodoResumen).trim()) ? <button type="button" disabled={!cof.sinAsignarGasto} onClick={() => setCof({ ...cof, periodoResumen: "" })} style={{ padding: "6px 10px", border: "1px solid var(--sidebar-border)", borderRadius: 8, background: "var(--color-surface-2)", color: "var(--sidebar-text-muted)", fontSize: 11, fontWeight: 600, cursor: !cof.sinAsignarGasto ? "not-allowed" : "pointer" }}>Limpiar</button> : null}
            </div>
            <div style={{ fontSize: 11, color: "var(--sidebar-text-muted)", marginTop: 3 }}>{cof.sinAsignarGasto ? "En qué mes debe aparecer en el resumen (ej. marzo). La <strong>Fecha</strong> de pago es independiente: podés pagar en febrero y que cuente para marzo." : "Solo para cobros sin asignar. Si asignás a gastos, usá «Período (filtrar)» arriba."}</div>
          </div>
          {editId && <span />}
        </div>
        <Inp label="Hora (opcional)" type="time" value={cof.hora} onChange={(e) => setCof({ ...cof, hora: e.target.value })} />
        <Inp
          label="Método de Pago *"
          type="select"
          value={cof.metodo}
          onChange={(e) => {
            const v = e.target.value;
            if (v === OTRO_METODO_VALUE) setCof({ ...cof, metodo: v });
            else setCof({ ...cof, metodo: v, metodoManual: "" });
          }}
        >
          <option value="">Seleccionar...</option>
          {PM.map((m) => <option key={m} value={m}>{PI[m]} {m}</option>)}
          <option value={OTRO_METODO_VALUE}>Otro</option>
        </Inp>
        {cof.metodo === OTRO_METODO_VALUE && (
          <Inp
            label="Método de pago (manual) *"
            type="text"
            value={cof.metodoManual}
            onChange={(e) => setCof({ ...cof, metodoManual: e.target.value })}
            placeholder="Ej. Transferencia bancaria / Efectivo en ventanilla"
            hint="Se guardará tal cual en el cobro."
          />
        )}
        <Inp label="Notas" type="textarea" value={cof.notas} onChange={(e) => setCof({ ...cof, notas: e.target.value })} placeholder="Nro. operación..." />
        <div style={{ marginTop: 8 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--sidebar-text-active)", marginBottom: 6 }}>Comprobantes de pago (opcional)</label>
          <p style={{ fontSize: 12, color: "var(--sidebar-text)", marginBottom: 8 }}>Podés subir fotos de comprobantes de pago (imagen o PDF, máx. 10 MB cada uno).</p>
          {editId && cobroEditComprobantePaths.length > 0 && (
            <ul style={{ marginBottom: 10, paddingLeft: 0, listStyle: "none", display: "flex", flexWrap: "wrap", gap: 12 }}>
              {cobroEditComprobantePaths.map((path, i) => {
                const url = cobroEditSignedUrls[path];
                const name = path.split("/").pop() || `Archivo ${i + 1}`;
                const isImage = /\.(jpe?g|png|gif|webp)$/i.test(name);
                const canPreview = !!url;
                return (
                  <li key={path} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--color-bg)", border: "1px solid var(--sidebar-border)", borderRadius: 10, minWidth: 0 }}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => canPreview && setCobroPreviewViewer({ url, isPdf: !isImage, name })}
                      onKeyDown={(e) => canPreview && (e.key === "Enter" || e.key === " ") && e.preventDefault() && setCobroPreviewViewer({ url, isPdf: !isImage, name })}
                      style={{ width: 56, height: 56, borderRadius: 8, overflow: "hidden", background: "var(--sidebar-border)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: canPreview ? "pointer" : "default", border: canPreview ? "2px solid var(--color-blue)" : "none" }}
                      title={canPreview ? "Clic para ver en grande" : ""}
                    >
                      {url && isImage ? (
                        <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }} referrerPolicy="no-referrer" />
                      ) : url && !isImage ? (
                        <FileText size={28} style={{ color: "var(--sidebar-text)" }} />
                      ) : (
                        <span style={{ fontSize: 10, color: "var(--sidebar-text-muted)" }}>Cargando…</span>
                      )}
                    </div>
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", fontSize: 12, color: "var(--sidebar-text-active)", minWidth: 0 }} title={name}>{name}</span>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setCobroEditComprobantePaths((p) => p.filter((_, j) => j !== i)); }} style={{ padding: "6px 10px", border: "none", background: "#fee2e2", color: "#dc2626", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>Quitar</button>
                  </li>
                );
              })}
            </ul>
          )}
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 18px", border: "2px dashed #2563eb", borderRadius: 12, background: "linear-gradient(135deg, #eff6ff, #dbeafe)", color: "#1d4ed8", fontSize: 13, fontWeight: 600, cursor: uploadingComprobantes ? "wait" : "pointer", transition: "all .2s" }}>
            <Paperclip size={16} />
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" multiple style={{ display: "none" }} onChange={(e) => { const files = Array.from(e.target.files || []); setCobroComprobanteFiles((p) => [...p, ...files]); e.target.value = ""; }} disabled={uploadingComprobantes} />
            Añadir archivos
          </label>
          {cobroComprobanteFiles.length > 0 && (
            <ul style={{ marginTop: 10, paddingLeft: 0, listStyle: "none", display: "flex", flexWrap: "wrap", gap: 12 }}>
              {cobroComprobanteFiles.map((f, i) => {
                const url = cobroNewFileUrls[i];
                const isImage = f.type && f.type.startsWith("image/");
                const isPdf = f.type === "application/pdf";
                const canPreview = !!url;
                return (
                  <li key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--color-bg)", border: "1px solid var(--sidebar-border)", borderRadius: 10, minWidth: 0 }}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => canPreview && setCobroPreviewViewer({ url, isPdf, name: f.name })}
                      onKeyDown={(e) => canPreview && (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setCobroPreviewViewer({ url, isPdf, name: f.name }))}
                      style={{ width: 56, height: 56, borderRadius: 8, overflow: "hidden", background: "var(--sidebar-border)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: canPreview ? "pointer" : "default", border: canPreview ? "2px solid var(--color-blue)" : "none" }}
                      title={canPreview ? "Clic para ver en grande" : ""}
                    >
                      {url && isImage ? (
                        <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }} />
                      ) : url && isPdf ? (
                        <FileText size={28} style={{ color: "var(--sidebar-text)" }} />
                      ) : (
                        <span style={{ fontSize: 10, color: "var(--sidebar-text-muted)" }}>…</span>
                      )}
                    </div>
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", fontSize: 12, color: "var(--sidebar-text-active)", minWidth: 0 }} title={f.name}>{f.name}</span>
                    <button type="button" onClick={() => setCobroComprobanteFiles((p) => p.filter((_, j) => j !== i))} style={{ padding: "6px 10px", border: "none", background: "#fee2e2", color: "#dc2626", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>Quitar</button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Mdl>

      {cobroPreviewViewer && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Vista previa del comprobante"
          onClick={() => setCobroPreviewViewer(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.85)", backdropFilter: "blur(16px)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, boxSizing: "border-box" }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ position: "relative", maxWidth: "95vw", maxHeight: "95vh", display: "flex", flexDirection: "column", alignItems: "center", background: "var(--color-surface-2)", borderRadius: 20, overflow: "hidden", boxShadow: "0 32px 100px rgba(0,0,0,.35)", border: "1px solid rgba(255,255,255,.1)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid #e5e7eb", width: "100%", background: "var(--color-bg)" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--sidebar-text-active)", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "calc(95vw - 100px)" }}>{cobroPreviewViewer.name}</span>
              <button type="button" onClick={() => setCobroPreviewViewer(null)} style={{ width: 36, height: 36, border: "none", background: "var(--sidebar-border)", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} aria-label="Cerrar"><X size={18} style={{ color: "var(--sidebar-text)" }} /></button>
            </div>
            <div style={{ padding: 16, maxHeight: "85vh", overflow: "auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {cobroPreviewViewer.isPdf ? (
                <div style={{ textAlign: "center", padding: "24px 32px" }}>
                  <FileText size={48} style={{ color: "var(--sidebar-text)", marginBottom: 12 }} />
                  <p style={{ fontSize: 14, color: "var(--sidebar-text)", marginBottom: 16 }}>PDF — abrirlo para ver el contenido</p>
                  <a href={cobroPreviewViewer.url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", background: "var(--color-blue)", color: "var(--color-text-inverse)", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none" }}><ExternalLink size={16} /> Abrir en nueva pestaña</a>
                </div>
              ) : (
                <img src={cobroPreviewViewer.url} alt="" style={{ maxWidth: "85vw", maxHeight: "80vh", width: "auto", height: "auto", objectFit: "contain", display: "block" }} referrerPolicy="no-referrer" />
              )}
            </div>
          </div>
        </div>
      )}

      <Mdl open={modal === "dar-acceso"} onClose={closeMdl} title="Dar acceso al panel" footer={!accesoResultado ? <><Btn variant="outline" onClick={closeMdl}>Cancelar</Btn><Btn onClick={() => submitDarAcceso(false)} disabled={savingAcceso}>{savingAcceso ? "Enviando…" : "Enviar link por email"}</Btn></> : <><Btn variant="outline" onClick={() => { setAccesoResultado(null); }} style={{ display: accesoResultado?.link ? "inline-flex" : "none" }}>Enviar otro</Btn><Btn onClick={closeMdl}>Cerrar</Btn></>}>
        {editId && (() => {
          const ac = clients.find((c) => c.id === editId);
          const firstEmail = (ac?.emails || []).filter(Boolean)[0];
          if (!ac) return null;
          if (accesoResultado) {
            return (
              <div style={{ padding: "16px 0" }}>
                <p style={{ fontSize: 13, color: "#059669", fontWeight: 600, marginBottom: 12 }}>{accesoResultado.message}</p>
                <div style={{ background: "linear-gradient(135deg, #f5f3ee, #ecfdf5)", borderRadius: 14, padding: 20, fontSize: 14, border: "1px solid #d1fae5" }}>
                  <div style={{ marginBottom: 8 }}><span style={{ color: "var(--sidebar-text)", fontSize: 12 }}>Correo:</span> <strong style={{ color: "var(--sidebar-text-active)" }}>{accesoResultado.email}</strong></div>
                  {accesoResultado.link && (
                    <div style={{ marginTop: 12 }}>
                      <span style={{ fontSize: 12, color: "var(--sidebar-text)", display: "block", marginBottom: 6 }}>Si no llegó el email, copia este link y compártelo con el cliente:</span>
                      <input type="text" readOnly value={accesoResultado.link} onClick={(e) => e.target.select()} style={{ width: "100%", padding: "8px 10px", fontSize: 12, border: "1px solid var(--sidebar-border)", borderRadius: 8, fontFamily: "monospace", background: "var(--color-surface-2)" }} />
                    </div>
                  )}
                </div>
                {accesoResultado.alreadyHadAccess && !accesoResultado.link && (
                  <p style={{ fontSize: 11, color: "var(--sidebar-text-muted)", marginTop: 10 }}>Para reenviar el correo con un nuevo link: <button type="button" onClick={() => submitDarAcceso(true)} disabled={savingAcceso} style={{ background: "none", border: "none", color: "var(--color-blue)", fontWeight: 600, cursor: "pointer", padding: 0, fontFamily: "inherit", fontSize: "inherit", textDecoration: "underline" }}>Reenviar link</button></p>
                )}
              </div>
            );
          }
          return (
            <>
              <p style={{ marginBottom: 14, fontSize: 13, color: "var(--sidebar-text)" }}>Se enviará un <strong>correo</strong> al cliente con un link. Al abrirlo entrará directo al panel (sin contraseña).</p>
              <div style={{ background: "linear-gradient(135deg, #f5f3ee, #ecfdf5)", borderRadius: 14, padding: 20, fontSize: 14, border: "1px solid #d1fae5" }}>
                <span style={{ fontSize: 12, color: "var(--sidebar-text)" }}>Correo al que se enviará: </span>
                <strong style={{ color: "var(--sidebar-text-active)" }}>{firstEmail || "—"}</strong>
              </div>
              {(!firstEmail || !String(firstEmail).includes("@")) && <p style={{ fontSize: 12, color: "#dc2626", marginBottom: 8 }}>Este cliente no tiene correo. Agrega uno en Editar cliente.</p>}
            </>
          );
        })()}
      </Mdl>

      <Mdl open={modal === "garantia"} onClose={closeMdl} title={editId ? "Editar Garantía" : "Nueva Garantía"} footer={<><Btn variant="outline" onClick={closeMdl} disabled={uploadingComprobantes}>Cancelar</Btn><Btn onClick={saveGar} disabled={uploadingComprobantes}>{uploadingComprobantes ? "Subiendo…" : "Guardar"}</Btn></>}>
        <SearchSelect label="Cliente *" options={clientsSorted.map((c) => ({ value: c.id, label: c.name }))} value={gaf.clientId} onChange={(id) => setGaf({ ...gaf, clientId: id, gastoId: "" })} placeholder="Escribí el nombre del cliente..." emptyMessage="Ningún cliente coincide" />
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--color-text)", marginBottom: 5 }}>Período en resumen (mes) *</label>
          <input type="month" value={(gaf.periodoResumen && String(gaf.periodoResumen).length >= 7) ? String(gaf.periodoResumen).slice(0, 7) : tm()} onChange={(e) => { const v = e.target.value || tm(); setGaf({ ...gaf, periodoResumen: v }); setGafFilterPeriodo(normalizePeriod(v)); }} style={{ width: "100%", maxWidth: 200, boxSizing: "border-box", padding: "9px 13px", background: "var(--color-surface-2)", border: "1px solid var(--sidebar-border)", borderRadius: 8, fontFamily: "'Inter',sans-serif", fontSize: 13, outline: "none" }} title="Mes en que esta garantía cuenta en el resumen (Crédito / Mi cuenta)" />
          <div style={{ fontSize: 11, color: "var(--sidebar-text)", marginTop: 4 }}>Debe coincidir con el mes que ves en el resumen (ej. marzo). No es lo mismo que la fecha del depósito.</div>
        </div>
        {gaf.clientId && (
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--color-text)", marginBottom: 5 }}>Período (filtrar gasto asociado)</label>
          <input type="text" placeholder="MM/AAAA — opcional" value={gafFilterPeriodo} onChange={(e) => setGafFilterPeriodo(e.target.value)} onBlur={(e) => { const p = parsePeriodoInput(e.target.value); if (p) setGafFilterPeriodo(p); }} style={{ width: "100%", boxSizing: "border-box", padding: "9px 13px", background: "var(--color-surface-2)", border: "1px solid var(--sidebar-border)", borderRadius: 8, fontFamily: "'Inter',sans-serif", fontSize: 13, outline: "none" }} />
          <div style={{ fontSize: 11, color: "var(--sidebar-text)", marginTop: 4 }}>Se rellena solo con el mes del resumen (arriba). Borrá el campo si querés ver gastos de todos los meses.</div>
        </div>
        )}
        <Inp label="Gasto asociado (opcional)" type="select" value={gaf.gastoId || ""} onChange={(e) => setGaf({ ...gaf, gastoId: e.target.value === "" ? "" : e.target.value })}><option value="">Ninguno</option>{gaf.clientId && sGastos.filter((g) => g.clientId === gaf.clientId).filter((g) => !gafFilterPeriodo || g.mes === gafFilterPeriodo).map((g) => <option key={g.id} value={g.id}>{g.codigo || "—"} — {fmtM(g.mes)} {g.camp ? "· " + g.camp + " " : ""}· ${fmt(g.gasto)}</option>)}</Inp>
        <div className="hm-form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          <Inp label="Tipo" type="select" value={gaf.tipo} onChange={(e) => setGaf({ ...gaf, tipo: e.target.value })}>{GT.map((t) => <option key={t}>{t}</option>)}</Inp>
          <Inp label="Valor ($)" type="number" step="0.01" min="0" value={gaf.valor} onChange={(e) => setGaf({ ...gaf, valor: e.target.value })} placeholder="0.00" />
        </div>
        <Inp label="Descripción" type="textarea" value={gaf.desc} onChange={(e) => setGaf({ ...gaf, desc: e.target.value })} placeholder="Detalle..." />
        <Inp label="Fecha de colocación (opcional)" type="date" value={gaf.fechaColocacion || ""} onChange={(e) => setGaf({ ...gaf, fechaColocacion: e.target.value })} hint="Cuándo el cliente te depositó la garantía" />
        <Inp label="Estado" type="select" value={gaf.estado} onChange={(e) => setGaf({ ...gaf, estado: e.target.value })}><option>Vigente</option><option>Devuelta</option><option>Ejecutada</option></Inp>
        <div style={{ background: "linear-gradient(135deg, #eff6ff, #f5f3ff)", borderRadius: 14, padding: "14px 16px", marginBottom: 16, fontSize: 13, color: "var(--sidebar-text-active)", border: "1px solid #bfdbfe", boxShadow: "0 1px 4px rgba(37,99,235,.06)" }}>
          <strong>Se verá reflejada en:</strong> Reportes (columna Garantía y Pend. neto) y en Gastos (columna A cobrar). Al guardar, te llevamos a Reportes para que lo veas al instante.
        </div>
        <div style={{ marginTop: 8 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--sidebar-text-active)", marginBottom: 6 }}>Imágenes correspondientes (opcional)</label>
          <p style={{ fontSize: 12, color: "var(--sidebar-text)", marginBottom: 8 }}>Podés subir las imágenes o comprobantes asociados a la garantía (imagen o PDF, máx. 10 MB cada uno).</p>
          {editId && garantiaEditComprobantePaths.length > 0 && (
            <ul style={{ marginBottom: 10, paddingLeft: 0, listStyle: "none", display: "flex", flexWrap: "wrap", gap: 12 }}>
              {garantiaEditComprobantePaths.map((path, i) => {
                const url = garantiaEditSignedUrls[path];
                const name = path.split("/").pop() || `Archivo ${i + 1}`;
                const isImage = /\.(jpe?g|png|gif|webp)$/i.test(name);
                const canPreview = !!url;
                return (
                  <li key={path} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--color-bg)", border: "1px solid var(--sidebar-border)", borderRadius: 10, minWidth: 0 }}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => canPreview && setCobroPreviewViewer({ url, isPdf: !isImage, name })}
                      onKeyDown={(e) => canPreview && (e.key === "Enter" || e.key === " ") && e.preventDefault() && setCobroPreviewViewer({ url, isPdf: !isImage, name })}
                      style={{ width: 56, height: 56, borderRadius: 8, overflow: "hidden", background: "var(--sidebar-border)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: canPreview ? "pointer" : "default", border: canPreview ? "2px solid #8b5cf6" : "none" }}
                      title={canPreview ? "Clic para ver en grande" : ""}
                    >
                      {url && isImage ? (
                        <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }} referrerPolicy="no-referrer" />
                      ) : url && !isImage ? (
                        <FileText size={28} style={{ color: "var(--sidebar-text)" }} />
                      ) : (
                        <span style={{ fontSize: 10, color: "var(--sidebar-text-muted)" }}>Cargando…</span>
                      )}
                    </div>
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", fontSize: 12, color: "var(--sidebar-text-active)", minWidth: 0 }} title={name}>{name}</span>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setGarantiaEditComprobantePaths((p) => p.filter((_, j) => j !== i)); }} style={{ padding: "6px 10px", border: "none", background: "#fee2e2", color: "#dc2626", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>Quitar</button>
                  </li>
                );
              })}
            </ul>
          )}
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 18px", border: "2px dashed #8b5cf6", borderRadius: 12, background: "linear-gradient(135deg, #f5f3ff, #ede9fe)", color: "#6d28d9", fontSize: 13, fontWeight: 600, cursor: uploadingComprobantes ? "wait" : "pointer", transition: "all .2s" }}>
            <Paperclip size={16} />
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" multiple style={{ display: "none" }} onChange={(e) => { const files = Array.from(e.target.files || []); setGarantiaImagenNewFiles((p) => [...p, ...files]); e.target.value = ""; }} disabled={uploadingComprobantes} />
            Añadir archivos
          </label>
          {garantiaImagenNewFiles.length > 0 && (
            <ul style={{ marginTop: 10, paddingLeft: 0, listStyle: "none", display: "flex", flexWrap: "wrap", gap: 12 }}>
              {garantiaImagenNewFiles.map((f, i) => {
                const url = garantiaNewFileUrls[i];
                const isImage = f.type && f.type.startsWith("image/");
                const isPdf = f.type === "application/pdf";
                const canPreview = !!url;
                return (
                  <li key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--color-bg)", border: "1px solid var(--sidebar-border)", borderRadius: 10, minWidth: 0 }}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => canPreview && setCobroPreviewViewer({ url, isPdf, name: f.name })}
                      onKeyDown={(e) => canPreview && (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setCobroPreviewViewer({ url, isPdf, name: f.name }))}
                      style={{ width: 56, height: 56, borderRadius: 8, overflow: "hidden", background: "var(--sidebar-border)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: canPreview ? "pointer" : "default", border: canPreview ? "2px solid #8b5cf6" : "none" }}
                      title={canPreview ? "Clic para ver en grande" : ""}
                    >
                      {url && isImage ? (
                        <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }} />
                      ) : url && isPdf ? (
                        <FileText size={28} style={{ color: "var(--sidebar-text)" }} />
                      ) : (
                        <span style={{ fontSize: 10, color: "var(--sidebar-text-muted)" }}>…</span>
                      )}
                    </div>
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", fontSize: 12, color: "var(--sidebar-text-active)", minWidth: 0 }} title={f.name}>{f.name}</span>
                    <button type="button" onClick={() => setGarantiaImagenNewFiles((p) => p.filter((_, j) => j !== i))} style={{ padding: "6px 10px", border: "none", background: "#fee2e2", color: "#dc2626", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>Quitar</button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Mdl>

      <Mdl open={!!comprobanteViewer} onClose={() => setComprobanteViewer(null)} title={comprobanteViewer?.type === "garantia" ? "Imágenes de la garantía" : "Comprobantes de pago"}>
        <div style={{ padding: "8px 0" }}>
          {comprobanteViewer?.paths?.length ? (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexWrap: "wrap", gap: 12 }}>
              {comprobanteViewer.paths.map((path, i) => {
                const url = viewerSignedUrls[i];
                const name = path.split("/").pop() || `Archivo ${i + 1}`;
                const isImage = /\.(jpe?g|png|gif|webp)$/i.test(name);
                const canPreview = !!url;
                return (
                  <li key={path} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--color-bg)", border: "1px solid var(--sidebar-border)", borderRadius: 10, minWidth: 0 }}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => canPreview && setCobroPreviewViewer({ url, isPdf: !isImage, name })}
                      onKeyDown={(e) => canPreview && (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setCobroPreviewViewer({ url, isPdf: !isImage, name }))}
                      style={{ width: 56, height: 56, borderRadius: 8, overflow: "hidden", background: "var(--sidebar-border)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: canPreview ? "pointer" : "default", border: canPreview ? "2px solid var(--color-blue)" : "none" }}
                      title={canPreview ? "Clic para ver en grande" : ""}
                    >
                      {url && isImage ? (
                        <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }} referrerPolicy="no-referrer" />
                      ) : url && !isImage ? (
                        <FileText size={28} style={{ color: "var(--sidebar-text)" }} />
                      ) : (
                        <span style={{ fontSize: 10, color: "var(--sidebar-text-muted)" }}>Cargando…</span>
                      )}
                    </div>
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", fontSize: 12, color: "var(--sidebar-text-active)", minWidth: 0 }} title={name}>{name}</span>
                    {url && !isImage && (
                      <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "6px 10px", background: "var(--color-blue)", color: "var(--color-text-inverse)", borderRadius: 6, fontSize: 11, fontWeight: 600, textDecoration: "none" }}><ExternalLink size={12} /> Abrir</a>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      </Mdl>
    </div>
  );
}

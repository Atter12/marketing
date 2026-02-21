import { useState, useEffect, useMemo, useCallback } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Shield, DollarSign, Users, CreditCard, Plus, ChevronLeft, Trash2, Edit3, Search, TrendingUp, BarChart3, Eye, X, Check, AlertCircle, FileText, Home, ArrowUpRight, ArrowDownRight, Calendar, Hash, Percent, Menu, LogOut, HardDrive, ExternalLink, Camera, KeyRound, Download, Paperclip } from "lucide-react";
import ClientDetailView from "./ClientDetailView";
import { useSupabaseData } from "./useSupabaseData";
import { exportToExcel } from "./exportExcel";
import * as XLSX from "xlsx";
import { supabase, uploadAvatar, uploadGerenteAvatar, getGerenteProfile, updateGerenteAvatar, darAccesoCliente, uploadComprobanteCobro, uploadComprobanteGarantia, getComprobanteSignedUrl } from "./supabase";

// Logo: imagen en public/logo/logoh.png (holistic + marketing con gradiente naranja)
const LOGO_URL = import.meta.env.DEV ? "/logo/logoh.png" : (import.meta.env.BASE_URL || "/") + "logo/logoh.png";

/* ═══════ STORAGE ═══════ */
const S = {
  g: (k) => { try { return JSON.parse(localStorage.getItem("hm_" + k)) || []; } catch { return []; } },
  s: (k, v) => localStorage.setItem("hm_" + k, JSON.stringify(v)),
};
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const fmt = (n) => parseFloat(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtK = (n) => { const v = parseFloat(n || 0); if (v >= 1e6) return "$" + (v / 1e6).toFixed(2) + "M"; if (v >= 1e3) return "$" + (v / 1e3).toFixed(1) + "K"; return "$" + fmt(v); };
const td = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const tm = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); };
const fmtM = (m) => { if (!m) return "—"; const d = new Date(m + "-15T12:00:00"); return d.toLocaleDateString("es-PE", { month: "short", year: "numeric" }); };
const fmtD = (d) => { if (!d) return "—"; return new Date(d + "T12:00:00").toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" }); };
const fmtDD = (d) => { if (!d) return "—"; const x = new Date(d + "T12:00:00"); const dd = String(x.getDate()).padStart(2, "0"); const mm = String(x.getMonth() + 1).padStart(2, "0"); return dd + "/" + mm + "/" + x.getFullYear(); };
const fmtT = (t) => { if (!t) return "—"; const s = String(t).slice(0, 5); return s.length >= 5 ? s : t; };
const fmtDt = (iso) => { if (!iso) return "—"; const d = new Date(iso); return d.toLocaleString("es-PE", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); };
const COLORS = ["#0055ff", "#0d9f6e", "#d97706", "#dc2640", "#7c3aed", "#e1306c", "#0891b2", "#c2410c"];
const PC = { "Mercury Bank": "#5542f6", BCP: "#ff6200", Interbank: "#00a651", Binance: "#f0b90b", Efectivo: "#94a3b8", Stripe: "#635bff", Yape: "#6c2cb2", Plin: "#00d4aa" };
const PI = { "Mercury Bank": "🏦", BCP: "🟠", Interbank: "🟢", Binance: "💛", Efectivo: "💵", Stripe: "💳", Yape: "💜", Plin: "💚" };
const PM = ["Mercury Bank", "BCP", "Interbank", "Binance", "Efectivo", "Stripe", "Yape", "Plin"];
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
  return null;
}

/* ═══════ UI COMPONENTS ═══════ */
const AVATAR_SIZE_SCALE = 1.35; // fotos de clientes 35% más grandes
const Av = ({ name, size = 34, avatarUrl }) => {
  const c = clr(name);
  const s = Math.round(size * AVATAR_SIZE_SCALE);
  const style = { width: s, height: s, borderRadius: s > 40 ? 14 : 8, flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: c + "14", color: c, fontWeight: 700, fontSize: s * 0.36, letterSpacing: -0.3 };
  if (avatarUrl && avatarUrl.trim()) return <div style={style}><img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>;
  return <div style={style}>{ini(name)}</div>;
};

const Bdg = ({ type = "n", children, style: customStyle }) => {
  const m = { ok: ["#eafaf4", "#0d9f6e"], err: ["#fdf0f2", "#dc2640"], warn: ["#fef9ec", "#d97706"], acc: ["#edf2ff", "#0055ff"], n: ["#f4f5f7", "#5f6577"], gar: ["#f0eefe", "#7c3aed"] };
  const [bg, fg] = m[type] || m.n;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 11px", borderRadius: 6, fontSize: 12.5, fontWeight: 600, background: bg, color: fg, whiteSpace: "nowrap", ...customStyle }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: fg, flexShrink: 0 }} />{children}</span>;
};

const PayB = ({ method }) => <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 6, fontSize: 11.5, fontWeight: 600, background: (PC[method] || "#94a3b8") + "18", color: PC[method] || "#64748b" }}>{PI[method] || "💰"} {method}</span>;

const Stat = ({ icon, value, label, color, sub }) => (
  <div className="stat-card" style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 14, padding: "20px 22px" }}>
    <div style={{ width: 38, height: 38, borderRadius: 10, background: color + "14", color, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>{icon}</div>
    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 26, fontWeight: 700, letterSpacing: -0.5, color: color || "#1a1d26", marginBottom: 4 }}>{value}</div>
    <div style={{ fontSize: 12.5, color: "#9498a8", fontWeight: 500 }}>{label}</div>
    {sub && <div style={{ fontSize: 11, color: "#9498a8", marginTop: 4 }}>{sub}</div>}
  </div>
);

const Mdl = ({ open, onClose, title, children, footer }) => {
  if (!open) return null;
  return (
    <div className="hm-modal-outer" onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,17,26,.5)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 50, overflowY: "auto" }}>
      <div className="hm-modal-box" onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, width: "92%", maxWidth: 560, boxShadow: "0 20px 60px rgba(0,0,0,.12)", border: "1px solid #e2e4e9", marginBottom: 40, overflow: "hidden", boxSizing: "border-box", minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 24px", background: "#f8f9fb", borderBottom: "1px solid #e2e4e9", borderRadius: "16px 16px 0 0", minWidth: 0 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: "#1b2559", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</h3>
          <button onClick={onClose} style={{ width: 32, height: 32, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", border: "none", background: "#fff", color: "#5f6577", borderRadius: 8, cursor: "pointer", fontSize: 18, boxShadow: "0 1px 3px rgba(0,0,0,.08)" }} aria-label="Cerrar">✕</button>
        </div>
        <div style={{ padding: "20px 24px", overflowX: "hidden", minWidth: 0, boxSizing: "border-box" }}>{children}</div>
        {footer && <div className="hm-modal-footer" style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "16px 24px 20px", background: "#f8f9fb", borderTop: "1px solid #e2e4e9", borderRadius: "0 0 16px 16px" }}>{footer}</div>}
      </div>
    </div>
  );
};

const Inp = ({ label, hint, ...p }) => (
  <div style={{ marginBottom: 14, minWidth: 0 }}>
    {label && <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#5f6577", marginBottom: 5 }}>{label}</label>}
    {p.type === "textarea" ? <textarea {...p} style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box", padding: "9px 13px", background: "#fff", border: "1px solid #e2e4e9", borderRadius: 8, color: "#1a1d26", fontFamily: "'DM Sans',sans-serif", fontSize: 13.5, outline: "none", resize: "vertical", minHeight: 60, ...(p.style || {}) }} /> : p.type === "select" ? <select {...p} style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box", padding: "9px 13px", background: "#fff", border: "1px solid #e2e4e9", borderRadius: 8, color: "#1a1d26", fontFamily: "'DM Sans',sans-serif", fontSize: 13.5, outline: "none", cursor: "pointer", WebkitAppearance: "none", paddingRight: 32, ...(p.style || {}) }}>{p.children}</select> : <input {...p} style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box", padding: "9px 13px", background: "#fff", border: "1px solid #e2e4e9", borderRadius: 8, color: "#1a1d26", fontFamily: "'DM Sans',sans-serif", fontSize: 13.5, outline: "none", ...(p.style || {}) }} />}
    {hint && <div style={{ fontSize: 11, color: "#9498a8", marginTop: 3 }}>{hint}</div>}
  </div>
);

/** Buscador por nombre: input + lista filtrada. options = [{ value, label }], value = id seleccionado, onChange(id). compact = sin margen inferior (para filtros en header). */
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
  return (
    <div style={{ marginBottom: compact ? 0 : 14, minWidth: 0, position: "relative" }}>
      {label && <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#5f6577", marginBottom: 5 }}>{label}</label>}
      <input
        type="text"
        value={displayText}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
        placeholder={placeholder}
        style={{ width: "100%", boxSizing: "border-box", padding: "9px 13px", paddingRight: 36, background: "#fff", border: "1px solid #e2e4e9", borderRadius: 8, color: "#1a1d26", fontFamily: "'DM Sans',sans-serif", fontSize: 13.5, outline: "none" }}
      />
      {open && filtered.length > 0 && (
        <ul style={{ position: "absolute", left: 0, right: 0, top: "100%", marginTop: 2, margin: 0, padding: 4, listStyle: "none", background: "#fff", border: "1px solid #e2e4e9", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,.1)", zIndex: 100, maxHeight: 220, overflowY: "auto" }}>
          {filtered.map((o) => (
            <li key={o.value} onMouseDown={() => { onChange(o.value); setQuery(""); setOpen(false); }} style={{ padding: "8px 12px", cursor: "pointer", borderRadius: 6, fontSize: 13.5, color: o.value === value ? "#0055ff" : "#1a1d26", fontWeight: o.value === value ? 600 : 400, background: o.value === value ? "#f0f4ff" : "transparent" }}>{o.label}</li>
          ))}
        </ul>
      )}
      {open && query.trim() && filtered.length === 0 && <div style={{ position: "absolute", left: 0, right: 0, top: "100%", marginTop: 2, padding: "12px 13px", background: "#fff", border: "1px solid #e2e4e9", borderRadius: 8, fontSize: 12.5, color: "#9498a8", zIndex: 100 }}>{emptyMessage}</div>}
    </div>
  );
}

const Btn = ({ variant = "primary", size, children, ...p }) => {
  const vs = { primary: { bg: "#1b2559", color: "#fff", border: "none" }, accent: { bg: "#0055ff", color: "#fff", border: "none" }, outline: { bg: "#fff", color: "#1a1d26", border: "1px solid #e2e4e9" }, ghost: { bg: "transparent", color: "#9498a8", border: "none" }, danger: { bg: "#fdf0f2", color: "#dc2640", border: "none" } };
  const s = vs[variant] || vs.primary;
  return <button {...p} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: size === "sm" ? "6px 12px" : "8px 18px", borderRadius: 8, fontFamily: "'DM Sans',sans-serif", fontSize: size === "sm" ? 12 : 13, fontWeight: 600, border: s.border, background: s.bg, color: s.color, cursor: "pointer", whiteSpace: "nowrap", transition: "all .15s", ...(p.style || {}) }}>{children}</button>;
};

const PREFIXES = [{ c: "+51", l: "PE" }, { c: "+1", l: "US/CA" }, { c: "+52", l: "MX" }, { c: "+57", l: "CO" }, { c: "+34", l: "ES" }, { c: "+54", l: "AR" }, { c: "+55", l: "BR" }, { c: "+56", l: "CL" }, { c: "+58", l: "VE" }, { c: "+593", l: "EC" }, { c: "+598", l: "UY" }, { c: "+595", l: "PY" }, { c: "+591", l: "BO" }, { c: "+507", l: "PA" }, { c: "+506", l: "CR" }, { c: "+502", l: "GT" }, { c: "+503", l: "SV" }, { c: "+504", l: "HN" }, { c: "+505", l: "NI" }];
const parsePhone = (s) => { if (!s || !s.trim()) return { prefix: "+51", num: "" }; const m = s.trim().match(/^(\+\d{1,3})\s*(.*)$/); if (m) return { prefix: m[1], num: m[2].trim() }; return { prefix: "+51", num: s.trim() }; };
const Multi = ({ values, onChange, placeholder, type = "text" }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    {values.map((v, i) => (
      <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input type={type} value={v} onChange={(e) => { const n = [...values]; n[i] = e.target.value; onChange(n); }} placeholder={placeholder} style={{ flex: 1, minWidth: 0, padding: "9px 13px", background: "#fff", border: "1px solid #e2e4e9", borderRadius: 8, fontSize: 13.5, fontFamily: "'DM Sans',sans-serif", outline: "none", boxSizing: "border-box" }} />
        <button onClick={() => values.length > 1 ? onChange(values.filter((_, j) => j !== i)) : onChange([""])} style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", border: "none", background: "#fdf0f2", color: "#dc2640", borderRadius: 6, cursor: "pointer", fontSize: 16, flexShrink: 0 }}>×</button>
      </div>
    ))}
    <button onClick={() => onChange([...values, ""])} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "#0055ff", cursor: "pointer", padding: "4px 0", border: "none", background: "none", fontFamily: "'DM Sans',sans-serif" }}>+ Agregar</button>
  </div>
);
const MultiPhone = ({ values, onChange }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    {values.map((v, i) => {
      const { prefix, num } = parsePhone(v);
      return (
        <div key={i} style={{ display: "flex", gap: 6, alignItems: "center", minWidth: 0 }}>
          <select value={prefix} onChange={(e) => { const n = [...values]; n[i] = (e.target.value + " " + num).trim(); onChange(n); }} style={{ width: 88, flexShrink: 0, padding: "9px 8px", background: "#fff", border: "1px solid #e2e4e9", borderRadius: 8, fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none", cursor: "pointer" }}>
            {PREFIXES.map((p) => <option key={p.c} value={p.c}>{p.c} {p.l}</option>)}
          </select>
          <input type="tel" value={num} onChange={(e) => { const n = [...values]; n[i] = (prefix + " " + e.target.value).trim(); onChange(n); }} placeholder="999 999 999" style={{ flex: 1, minWidth: 0, padding: "9px 13px", background: "#fff", border: "1px solid #e2e4e9", borderRadius: 8, fontSize: 13.5, fontFamily: "'DM Sans',sans-serif", outline: "none", boxSizing: "border-box" }} />
          <button onClick={() => values.length > 1 ? onChange(values.filter((_, j) => j !== i)) : onChange([""])} style={{ width: 30, height: 30, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", border: "none", background: "#fdf0f2", color: "#dc2640", borderRadius: 6, cursor: "pointer", fontSize: 16 }}>×</button>
        </div>
      );
    })}
    <button onClick={() => onChange([...values, ""])} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "#0055ff", cursor: "pointer", padding: "4px 0", border: "none", background: "none", fontFamily: "'DM Sans',sans-serif" }}>+ Agregar</button>
  </div>
);

const IBtn = ({ onClick, icon, danger, title: btnTitle, style: s, ...p }) => <button onClick={onClick} title={btnTitle} {...p} style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #e2e4e9", background: "#fff", borderRadius: 6, cursor: "pointer", color: danger ? "#dc2640" : "#9498a8", transition: "all .15s", ...s }}>{icon}</button>;

const Empty = ({ cols, msg }) => <tr><td colSpan={cols} style={{ textAlign: "center", padding: 48, color: "#9498a8", fontSize: 13.5 }}>{msg}</td></tr>;

/* ═══════ TABLE STYLES ═══════ */
const TH = { textAlign: "left", padding: "10px 18px", fontSize: 10.5, fontWeight: 700, color: "#9498a8", textTransform: "uppercase", letterSpacing: 0.8, background: "#f8f9fb", borderBottom: "1px solid #e2e4e9" };
const TD = { padding: "12px 18px", fontSize: 13.5, borderBottom: "1px solid #eff0f3", verticalAlign: "middle" };
const MN = { fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, fontWeight: 600 };

/* ═══════ MAIN APP ═══════ */
export default function App({ role = "gerente", clientId = null, userEmail = null }) {
  const sb = useSupabaseData(role, clientId);
  const { clients, gastos, cobros, garantias, manual, loading: dataLoading, error: dataError, refetch: refetchData, mutations, uid: uidGen } = sb;
  const isCliente = role === "cliente";
  const [gerenteNombre, setGerenteNombre] = useState(() => { try { if (typeof window === "undefined") return ""; const v = localStorage.getItem("hm_gerente_nombre"); if (v == null) return ""; const p = JSON.parse(v); return typeof p === "string" ? p : ""; } catch { return ""; } });
  const [gerenteAvatarUrl, setGerenteAvatarUrl] = useState("");
  const [uploadingGerenteAvatar, setUploadingGerenteAvatar] = useState(false);
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

  const validPages = ["dashboard", "clientes", "gastos", "cobros", "reportes", "garantias", "client-detail"];
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
  const [repPerInicio, setRepPerInicio] = useState("");
  const [repPerFin, setRepPerFin] = useState("");
  const [expRango, setExpRango] = useState({ gastos: { ini: "", fin: "" }, cobros: { ini: "", fin: "" }, garantias: { ini: "", fin: "" } });
  const [expClientRango, setExpClientRango] = useState({ ini: "", fin: "" });
  const [filterCliente, setFilterCliente] = useState({ gastos: "", cobros: "", garantias: "" });
  const [menuOpen, setMenuOpen] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [selectedIds, setSelectedIds] = useState({ clientes: [], gastos: [], cobros: [], garantias: [] });
  const [pageNum, setPageNum] = useState({ clientes: 1, gastos: 1, cobros: 1, garantias: 1 });

  const emptyCf = { name: "", ig: "", phones: [""], emails: [""], biz: "", notes: "", avatar_url: "" };
  const emptyGf = { clientId: clientId || "", fechaMovimiento: td(), mes: tm(), camp: "", gasto: "", fee: "10", notas: "", prepago: false };
  const emptyCof = { gastoIds: [], monto: "", fecha: td(), hora: "", metodo: "", notas: "" };
  const emptyGaf = { clientId: clientId || "", gastoId: "", tipo: "Cuenta TikTok", desc: "", valor: "", estado: "Vigente" };
  const emptyMf = { fecha: td(), conc: "", monto: "", tipo: "Gasto", nota: "" };

  const [cf, setCf] = useState(emptyCf);
  const [gf, setGf] = useState(emptyGf);
  const [cof, setCof] = useState(emptyCof);
  const [gaf, setGaf] = useState(emptyGaf);
  const [cobroComprobanteFiles, setCobroComprobanteFiles] = useState([]);
  const [garantiaImagenNewFiles, setGarantiaImagenNewFiles] = useState([]);
  const [uploadingComprobantes, setUploadingComprobantes] = useState(false);
  const [comprobanteViewer, setComprobanteViewer] = useState(null);
  const [viewerSignedUrls, setViewerSignedUrls] = useState([]);
  const [mf, setMf] = useState(emptyMf);

  /* Synced gastos with computed fields — hooks must run before any early return */
  const sGastos = useMemo(() => gastos.map((g) => {
    const t = gTotal(g), f = gFee(g), p = cobros.filter((c) => c.gastoId === g.id).reduce((a, c) => a + parseFloat(c.monto || 0), 0);
    return { ...g, _t: t, _f: f, _p: p, _pend: Math.max(0, t - p), _st: p >= t ? "Pagado" : p > 0 ? "Parcial" : "Pendiente" };
  }), [gastos, cobros]);

  /* Client aggregate data */
  const cData = useCallback((cid) => {
    const gs = sGastos.filter((g) => g.clientId === cid);
    const tG = gs.reduce((a, g) => a + parseFloat(g.gasto || 0), 0);
    const tF = gs.reduce((a, g) => a + g._f, 0);
    const tP = gs.reduce((a, g) => a + g._p, 0);
    const tGar = garantias.filter((g) => g.clientId === cid && g.estado === "Vigente").reduce((a, g) => a + parseFloat(g.valor || 0), 0);
    const gross = tG + tF - tP;
    return { tG, tF, tP, tGar, gross, net: Math.max(0, gross - tGar) };
  }, [sGastos, garantias]);

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

  /* ═══ REPORT DATA (garantías deducted per client) ═══ */
  const repData = useMemo(() => {
    let gs = sGastos;
    if (repPerInicio || repPerFin) {
      const fOp = (g) => (g.fechaMovimiento || "").slice(0, 10);
      gs = gs.filter((g) => {
        const d = fOp(g);
        if (!d) return false;
        if (repPerInicio && d < repPerInicio) return false;
        if (repPerFin && d > repPerFin) return false;
        return true;
      });
    } else if (repPer) gs = gs.filter((g) => g.mes === repPer);
    if (repCl !== "all") gs = gs.filter((g) => g.clientId === repCl);

    const bc = {};
    gs.forEach((g) => {
      if (!bc[g.clientId]) bc[g.clientId] = { ads: 0, fee: 0, total: 0, paid: 0 };
      bc[g.clientId].ads += parseFloat(g.gasto || 0);
      bc[g.clientId].fee += g._f;
      bc[g.clientId].total += g._t;
      bc[g.clientId].paid += g._p;
    });

    const rows = Object.entries(bc).map(([cid, d]) => {
      const gar = garantias.filter((g) => g.clientId === cid && g.estado === "Vigente").reduce((a, g) => a + parseFloat(g.valor || 0), 0);
      const pend = Math.max(0, d.total - d.paid);
      const netPend = Math.max(0, pend - gar);
      return { cid, name: clients.find((c) => c.id === cid)?.name || "—", ...d, gar, pending: pend, netPending: netPend };
    });
    const t = rows.reduce((a, r) => ({ ads: a.ads + r.ads, fee: a.fee + r.fee, total: a.total + r.total, paid: a.paid + r.paid, gar: a.gar + r.gar, pending: a.pending + r.pending, netPending: a.netPending + r.netPending }), { ads: 0, fee: 0, total: 0, paid: 0, gar: 0, pending: 0, netPending: 0 });

    return { rows, t, pie: [{ name: "ADS", value: t.ads, color: "#0d9f6e" }, { name: "FEE", value: t.fee, color: "#1b2559" }].filter((d) => d.value > 0) };
  }, [sGastos, repCl, repPer, repPerInicio, repPerFin, clients, garantias]);

  /* Reportes: meses del período seleccionado para gráficos */
  const reportMonths = useMemo(() => {
    if (repPerInicio && repPerFin) {
      const r = [];
      let [y, m] = repPerInicio.split("-").map(Number);
      const [y2, m2] = repPerFin.split("-").map(Number);
      while (y < y2 || (y === y2 && m <= m2)) {
        const key = `${y}-${String(m).padStart(2, "0")}`;
        r.push({ key, label: fmtM(key) });
        m++; if (m > 12) { m = 1; y++; }
      }
      return r;
    }
    if (repPer) return [{ key: repPer, label: fmtM(repPer) }];
    return months;
  }, [repPer, repPerInicio, repPerFin, months]);

  /* Reportes: datos para los 4 bloques de gráficos (mismo criterio de filtro que repData) */
  const repCharts = useMemo(() => {
    let gs = sGastos;
    if (repPerInicio || repPerFin) {
      const fOp = (g) => (g.fechaMovimiento || "").slice(0, 10);
      gs = gs.filter((g) => {
        const d = fOp(g);
        if (!d) return false;
        if (repPerInicio && d < repPerInicio) return false;
        if (repPerFin && d > repPerFin) return false;
        return true;
      });
    } else if (repPer) gs = gs.filter((g) => g.mes === repPer);
    if (repCl !== "all") gs = gs.filter((g) => g.clientId === repCl);

    const cobrosEnPeriodo = cobros.filter((c) => {
      const f = (c.fecha || "").slice(0, 10);
      if (!f) return false;
      if (repPerInicio && f < repPerInicio) return false;
      if (repPerFin && f > repPerFin) return false;
      if (repPer && !repPerInicio && !repPerFin && f.slice(0, 7) !== repPer) return false;
      if (repCl !== "all") {
        const g = gastos.find((x) => x.id === c.gastoId);
        if (!g || g.clientId !== repCl) return false;
      }
      return true;
    });

    const monthly = reportMonths.map((m) => {
      const gsM = gs.filter((g) => g.mes === m.key);
      const csM = cobrosEnPeriodo.filter((c) => (c.fecha || "").slice(0, 7) === m.key);
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
  }, [sGastos, cobros, gastos, repCl, repPer, repPerInicio, repPerFin, reportMonths, repData.rows]);

  /* Dashboard charts */
  const dCharts = useMemo(() => ({
    monthly: months.map((m) => {
      const gs = sGastos.filter((g) => g.mes === m.key);
      const cs = cobros.filter((c) => c.fecha?.slice(0, 7) === m.key);
      return { name: m.label, gasto: gs.reduce((a, g) => a + parseFloat(g.gasto || 0), 0), fee: gs.reduce((a, g) => a + g._f, 0), cobrado: cs.reduce((a, c) => a + parseFloat(c.monto || 0), 0) };
    }),
    methods: (() => { const m = {}; cobros.forEach((c) => { m[c.metodo] = (m[c.metodo] || 0) + parseFloat(c.monto || 0); }); return Object.entries(m).map(([n, v]) => ({ name: n, value: v, color: PC[n] || "#94a3b8" })); })(),
    debt: clients.map((c) => ({ name: c.name, debt: cData(c.id).net })).filter((c) => c.debt > 0).sort((a, b) => b.debt - a.debt).slice(0, 6),
  }), [sGastos, cobros, clients, months, cData]);

  /* Client charts */
  const cCharts = useMemo(() => {
    if (!curCl) return { m: [], co: [] };
    const gids = gastos.filter((g) => g.clientId === curCl).map((g) => g.id);
    return {
      m: months.map((m) => { const gs = sGastos.filter((g) => g.clientId === curCl && g.mes === m.key); return { name: m.label, gasto: gs.reduce((a, g) => a + parseFloat(g.gasto || 0), 0), fee: gs.reduce((a, g) => a + g._f, 0) }; }),
      co: months.map((m) => ({ name: m.label, cobrado: cobros.filter((c) => gids.includes(c.gastoId) && c.fecha?.slice(0, 7) === m.key).reduce((a, c) => a + parseFloat(c.monto || 0), 0) })),
    };
  }, [curCl, sGastos, cobros, gastos, months]);

  /* Gastos filtrados por fecha de operación y por cliente (para tabla y export) */
  const gastosFiltrados = useMemo(() => {
    let list = [...sGastos];
    if (filterCliente.gastos) list = list.filter((g) => g.clientId === filterCliente.gastos);
    const fOp = (g) => (g.fechaMovimiento || "").slice(0, 10);
    if (expRango.gastos.ini) list = list.filter((g) => fOp(g) >= expRango.gastos.ini);
    if (expRango.gastos.fin) list = list.filter((g) => fOp(g) <= expRango.gastos.fin);
    return list.sort((a, b) => (b.fechaMovimiento || b.mes || "").localeCompare(a.fechaMovimiento || a.mes || ""));
  }, [sGastos, filterCliente.gastos, expRango.gastos.ini, expRango.gastos.fin]);

  /* Cobros filtrados por cliente (para tabla) */
  const cobrosFiltrados = useMemo(() => {
    if (!filterCliente.cobros) return cobros;
    return cobros.filter((co) => {
      const g = gastos.find((x) => x.id === co.gastoId);
      return g && g.clientId === filterCliente.cobros;
    });
  }, [cobros, gastos, filterCliente.cobros]);

  /* Garantías filtradas por cliente (para tabla) */
  const garantiasFiltradas = useMemo(() => {
    if (!filterCliente.garantias) return garantias;
    return garantias.filter((g) => g.clientId === filterCliente.garantias);
  }, [garantias, filterCliente.garantias]);

  /* ═══ MODALS ═══ */
  const openMdl = (type, eid = null) => { setEditId(eid); setModal(type); };
  const closeMdl = () => { setModal(null); setEditId(null); setCf(emptyCf); setGf({ ...emptyGf, clientId: curCl || "" }); setCof(emptyCof); setGaf({ ...emptyGaf, clientId: curCl || "" }); setAccesoResultado(null); setCobroComprobanteFiles([]); setGarantiaImagenNewFiles([]); };
  const openGarantiaForClientId = (cid) => { setGaf({ ...emptyGaf, clientId: cid || "" }); setModal("garantia"); setEditId(null); };
  const openCobroForGastoId = (gid) => { const g = sGastos.find((x) => x.id === gid); if (g) setCof({ ...emptyCof, gastoIds: [g.id], monto: g._pend.toFixed(2), fecha: td() }); setEditId(null); setModal("cobro"); };

  useEffect(() => {
    if (!modal) return;
    if (modal === "client" && editId) { const c = clients.find((x) => x.id === editId); if (c) setCf({ name: c.name, ig: c.ig || "", phones: c.phones?.length ? c.phones : [""], emails: c.emails?.length ? c.emails : [""], biz: c.biz || "", notes: c.notes || "", avatar_url: c.avatar_url || "" }); }
    if (modal === "dar-acceso") setAccesoResultado(null);
    if (modal === "gasto" && editId) { const g = gastos.find((x) => x.id === editId); if (g) setGf({ clientId: g.clientId, fechaMovimiento: g.fechaMovimiento || (g.mes ? g.mes + "-15" : td()), mes: g.mes || tm(), camp: g.camp || "", gasto: String(g.gasto), fee: String(g.fee), notas: g.notas || "", prepago: !!g.prepago }); }
    if (modal === "gasto" && !editId && curCl) setGf((p) => ({ ...p, clientId: curCl }));
    if (modal === "garantia" && editId) { const gar = garantias.find((x) => x.id === editId); if (gar) setGaf({ clientId: gar.clientId, gastoId: gar.gastoId || "", tipo: gar.tipo || "Cuenta TikTok", desc: gar.desc || "", valor: gar.valor || "", estado: gar.estado || "Vigente" }); }
    else if (modal === "garantia") setGaf((p) => ({ ...emptyGaf, clientId: curCl || p.clientId }));
  }, [modal, editId, clients, garantias]);

  useEffect(() => { if (isCliente && page === "cobros") setPage("dashboard"); }, [isCliente, page]);

  useEffect(() => {
    if (!comprobanteViewer?.paths?.length) { setViewerSignedUrls([]); return; }
    setViewerSignedUrls(comprobanteViewer.paths.map(() => null));
    Promise.all(comprobanteViewer.paths.map((p) => getComprobanteSignedUrl(p))).then((urls) => setViewerSignedUrls(urls));
  }, [comprobanteViewer]);

  const clientsSorted = useMemo(() => [...clients].sort((a, b) => (a.name || "").localeCompare((b.name || ""), "es")), [clients]);
  const clientsFiltered = useMemo(() => clientsSorted.filter((c) => !search || (c.name || "").toLowerCase().includes(search.toLowerCase())), [clientsSorted, search]);
  const clientFilterOptions = useMemo(() => [{ value: "", label: "Todos los clientes" }, ...clientsSorted.map((c) => ({ value: c.id, label: c.name }))], [clientsSorted]);

  /* Early returns only after all hooks have run */
  if (dataLoading) return (<div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f4f5f7", fontFamily: "'DM Sans',sans-serif" }}><div style={{ color: "#5f6577", fontSize: 14 }}>Cargando datos…</div></div>);
  if (dataError) return (<div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f4f5f7", fontFamily: "'DM Sans',sans-serif", padding: 20 }}><div style={{ textAlign: "center", maxWidth: 360 }}><p style={{ color: "#dc2640", fontSize: 14, marginBottom: 16 }}>Error al cargar los datos: {dataError}</p><button type="button" onClick={() => refetchData()} style={{ padding: "10px 20px", border: "none", borderRadius: 8, background: "#1b2559", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Reintentar</button></div></div>);

  /* ═══ CRUD (Supabase mutations) ═══ */
  const saveClient = async () => { if (!cf.name.trim()) return alert("Nombre obligatorio"); const c = { id: editId || undefined, name: cf.name.trim(), ig: cf.ig || "", phones: cf.phones.filter(Boolean), emails: cf.emails.filter(Boolean), biz: cf.biz || "", notes: cf.notes || "", avatar_url: cf.avatar_url || "" }; await mutations.saveClient(c); closeMdl(); };
  const delClient = async (id) => { if (!confirm("¿Eliminar cliente y todos sus datos?")) return; await mutations.delClient(id); closeMdl(); };
  const submitDarAcceso = async (regenerate = false) => { if (!editId) return; const client = clients.find((c) => c.id === editId); const firstEmail = (client?.emails || []).filter(Boolean)[0]; if (!firstEmail || !String(firstEmail).includes("@")) { alert("Este cliente no tiene correo. Agrega al menos uno en Editar cliente."); return; } try { setSavingAcceso(true); setAccesoResultado(null); const redirectTo = typeof window !== "undefined" ? (window.location.origin + "/credito") : ""; const res = await darAccesoCliente(editId, { regenerate, redirect_to: redirectTo }); setAccesoResultado(res); } catch (err) { alert(err?.message || "Error al dar acceso"); } finally { setSavingAcceso(false); } };

  const saveGasto = async () => { if (!gf.clientId || !parseFloat(gf.gasto)) return alert("Completa cliente y gasto"); const periodo = gf.mes || (gf.fechaMovimiento ? gf.fechaMovimiento.slice(0, 7) : tm()); const g = { id: editId || undefined, clientId: gf.clientId, fechaMovimiento: gf.fechaMovimiento || periodo + "-15", mes: periodo, camp: gf.camp || "", gasto: gf.gasto, fee: gf.fee || "10", notas: gf.notas || "", prepago: !!gf.prepago }; await mutations.saveGasto(g); closeMdl(); };
  const delGasto = async (id) => { if (!confirm("¿Eliminar gasto?")) return; await mutations.delGasto(id); };

  const saveCobro = async () => {
    const ids = Array.isArray(cof.gastoIds) ? cof.gastoIds.filter(Boolean) : (cof.gastoId ? [cof.gastoId] : []);
    if (!ids.length || !parseFloat(cof.monto) || !cof.metodo) return alert("Seleccioná al menos un gasto, monto y método de pago");
    const totalMonto = parseFloat(cof.monto) || 0;
    if (totalMonto <= 0) return alert("El monto debe ser mayor a 0");
    try {
      setUploadingComprobantes(true);
      const gastosSel = ids.map((gid) => sGastos.find((g) => g.id === gid)).filter(Boolean);
      const totalPend = gastosSel.reduce((a, g) => a + g._pend, 0);
      const montos = totalPend > 0 && ids.length > 0
        ? (() => { const parts = ids.map((gid) => { const g = sGastos.find((x) => x.id === gid); return g ? (g._pend / totalPend) * totalMonto : 0; }); const sum = parts.reduce((a, b) => a + b, 0); const diff = totalMonto - sum; if (diff !== 0 && parts.length) parts[0] += diff; return parts.map((p) => Math.round(p * 100) / 100); })()
        : [totalMonto];
      const createdIds = [];
      for (let i = 0; i < ids.length; i++) {
        const id = await mutations.saveCobro({ gastoId: ids[i], monto: montos[i] ?? totalMonto, fecha: cof.fecha, hora: cof.hora || null, metodo: cof.metodo, notas: cof.notas });
        if (id) createdIds.push(id);
      }
      if (cobroComprobanteFiles.length > 0 && createdIds.length > 0) {
        const paths = [];
        for (const f of cobroComprobanteFiles) {
          paths.push(await uploadComprobanteCobro(createdIds[0], f));
        }
        await mutations.setCobroComprobantes(createdIds[0], paths);
        for (let j = 1; j < createdIds.length; j++) {
          const pathsCopy = [];
          for (const f of cobroComprobanteFiles) {
            pathsCopy.push(await uploadComprobanteCobro(createdIds[j], f));
          }
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
      const id = await mutations.saveGarantia({ id: editId && modal === "garantia" ? editId : undefined, clientId: gaf.clientId, gastoId: (gaf.gastoId && String(gaf.gastoId).trim()) ? gaf.gastoId : null, tipo: gaf.tipo, desc: gaf.desc, valor: gaf.valor, estado: gaf.estado });
      const existingPaths = (editId && garantias.find((g) => g.id === editId)?.imagen_urls) || [];
      if (garantiaImagenNewFiles.length > 0) {
        const newPaths = [];
        for (const f of garantiaImagenNewFiles) {
          newPaths.push(await uploadComprobanteGarantia(id, f));
        }
        await mutations.setGarantiaImagenes(id, [...existingPaths, ...newPaths]);
      } else if (editId && existingPaths.length > 0) {
        await mutations.setGarantiaImagenes(id, existingPaths);
      }
      closeMdl();
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

  const saveMan = async () => { if (!mf.conc.trim()) return alert("Concepto obligatorio"); await mutations.saveManual({ clientId: curCl, fecha: mf.fecha, conc: mf.conc, monto: mf.monto, tipo: mf.tipo, nota: mf.nota }); setMf(emptyMf); };

  /* ═══ EXPORT EXCEL ═══ */
  const expGastos = () => {
    const list = [...gastosFiltrados];
    const headers = ["Cliente", "Código", "Fecha (dd/mm/aaaa)", "Período (mm/aaaa)", "Campaña", "Gasto", "Fee %", "Fee $", "Total", "Pagado", "Garantía", "Pendiente", "A cobrar", "Estado", "Prepago"];
    const rows = list.map((g) => { const c = clients.find((x) => x.id === g.clientId); const garVal = garantias.filter((gr) => gr.clientId === g.clientId && gr.estado === "Vigente").reduce((a, gr) => a + parseFloat(gr.valor || 0), 0); const netCobrar = cData(g.clientId).net; return [c?.name || "—", g.codigo || "—", fmtDD(g.fechaMovimiento), fmtM(g.mes), g.camp || "—", fmt(g.gasto), g.fee + "%", fmt(g._f), fmt(g._t), fmt(g._p), garVal > 0 ? fmt(garVal) : "—", fmt(g._pend), fmt(netCobrar), g._st, g.prepago ? "S" : "N"]; });
    exportToExcel("gastos_" + td(), "Gastos", headers, rows);
  };
  const expCobros = () => {
    let list = [...cobros];
    if (expRango.cobros.ini) list = list.filter((c) => (c.fecha || "").slice(0, 10) >= expRango.cobros.ini);
    if (expRango.cobros.fin) list = list.filter((c) => (c.fecha || "").slice(0, 10) <= expRango.cobros.fin);
    const headers = ["Cliente", "Cód. cobro", "Cód. gasto", "Fecha", "Hora", "Ref.", "Monto", "Método", "Registrado por", "Notas"];
    const rows = list.map((co) => { const g = gastos.find((x) => x.id === co.gastoId); const c = g ? clients.find((x) => x.id === g.clientId) : null; return [c?.name || "—", co.codigo || "—", g?.codigo || "—", fmtD(co.fecha), fmtT(co.hora) || "—", g ? fmtM(g.mes) + " " + (g.camp || "") : "—", fmt(co.monto), co.metodo || "—", co.created_by || "—", co.notas || "—"]; });
    exportToExcel("cobros_" + td(), "Cobros", headers, rows);
  };
  const expGarantias = () => {
    let list = [...garantias];
    const headers = ["Cliente", "Cód. verificación", "Cód. gasto", "Tipo", "Descripción", "Valor", "Estado"];
    const rows = list.map((g) => { const c = clients.find((x) => x.id === g.clientId); const gastoAsoc = g.gastoId ? gastos.find((x) => x.id === g.gastoId) : null; return [c?.name || "—", g.codigoVerificacion || "—", gastoAsoc?.codigo || "—", g.tipo || "—", g.desc || "—", fmt(g.valor), g.estado || "—"]; });
    exportToExcel("garantias_" + td(), "Garantías", headers, rows);
  };
  const expClientes = () => {
    const headers = ["Nombre", "Instagram", "Teléfonos", "Emails", "Negocio", "Notas"];
    const rows = clientsSorted.map((c) => [
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
    if (fechaIni) { gs = gs.filter((g) => (g.mes || g.fechaMovimiento?.slice(0, 7) || "") >= fechaIni.slice(0, 7)); cos = cos.filter((c) => (c.fecha || "").slice(0, 10) >= fechaIni); }
    if (fechaFin) { gs = gs.filter((g) => (g.mes || g.fechaMovimiento?.slice(0, 7) || "") <= fechaFin.slice(0, 7)); cos = cos.filter((c) => (c.fecha || "").slice(0, 10) <= fechaFin); }
    const wb = XLSX.utils.book_new();
    const curDExp = curCl ? cData(curCl) : { tGar: 0, net: 0 };
    const hG = ["Fecha", "Período", "Campaña", "Gasto", "Fee %", "Fee $", "Total", "Pagado", "Garantía", "Pendiente", "A cobrar", "Estado", "Prepago", "Código"];
    const rG = gs.map((g) => [fmtDD(g.fechaMovimiento), fmtM(g.mes), g.camp || "—", fmt(g.gasto), g.fee + "%", fmt(g._f), fmt(g._t), fmt(g._p), curDExp.tGar > 0 ? fmt(curDExp.tGar) : "—", fmt(g._pend), fmt(curDExp.net), g._st, g.prepago ? "S" : "N", g.codigo || "—"]);
    const wsG = XLSX.utils.aoa_to_sheet([hG, ...rG]); XLSX.utils.book_append_sheet(wb, wsG, "Gastos");
    const hC = ["Fecha", "Hora", "Cód. cobro", "Cód. gasto", "Monto", "Método", "Notas"];
    const rC = cos.map((co) => { const g = gastos.find((x) => x.id === co.gastoId); return [fmtD(co.fecha), fmtT(co.hora) || "—", co.codigo || "—", g?.codigo || "—", fmt(co.monto), co.metodo || "—", co.notas || "—"]; });
    const wsC = XLSX.utils.aoa_to_sheet([hC, ...rC]); XLSX.utils.book_append_sheet(wb, wsC, "Cobros");
    const hGar = ["Cód. verificación", "Cód. gasto", "Tipo", "Descripción", "Valor", "Estado"];
    const rGar = curGars.map((g) => { const gastoAsoc = g.gastoId ? gastos.find((x) => x.id === g.gastoId) : null; return [g.codigoVerificacion || "—", gastoAsoc?.codigo || "—", g.tipo || "—", g.desc || "—", fmt(g.valor), g.estado || "—"]; });
    const wsGar = XLSX.utils.aoa_to_sheet([hGar, ...rGar]); XLSX.utils.book_append_sheet(wb, wsGar, "Garantías");
    XLSX.writeFile(wb, `cliente_${(curC?.name || "cliente").replace(/[^a-zA-Z0-9]/g, "_")}_${td()}.xlsx`);
  };

  const goTo = (p, cid = null) => {
    setPage(p);
    if (cid != null) setCurCl(cid);
    if (p === "client-detail" && isCliente && clientId) setCurCl(clientId);
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
    return <text x={cx + r * Math.cos(-midAngle * R)} y={cy + r * Math.sin(-midAngle * R)} fill="#5f6577" textAnchor={cx + r * Math.cos(-midAngle * R) > cx ? "start" : "end"} dominantBaseline="central" style={{ fontSize: 12, fontWeight: 600 }}>{(percent * 100).toFixed(1)}%</text>;
  };

  /* ═══ CURRENT CLIENT DATA ═══ */
  const curC = curCl ? clients.find((x) => x.id === curCl) : null;
  const curD = curCl ? cData(curCl) : null;
  const curGastos = curCl ? sGastos.filter((g) => g.clientId === curCl).sort((a, b) => (b.mes || "").localeCompare(a.mes || "")) : [];
  const curGids = curCl ? gastos.filter((g) => g.clientId === curCl).map((g) => g.id) : [];
  const curCobros = curCl ? cobros.filter((c) => curGids.includes(c.gastoId)).sort((a, b) => (b.created_at || b.fecha || "").localeCompare(a.created_at || a.fecha || "")) : [];
  const curGars = curCl ? garantias.filter((g) => g.clientId === curCl) : [];
  const curMan = curCl ? manual.filter((m) => m.clientId === curCl).sort((a, b) => (b.fecha || "").localeCompare(a.fecha || "")) : [];

  /* NAV: gerente = todo (sin Crédito); cliente = Mi cuenta, Resumen, Gastos, Reportes, Garantías */
  const nav = isCliente
    ? [
        { id: "client-detail", icon: <Users size={18} />, label: "Mi cuenta" },
        { id: "dashboard", icon: <BarChart3 size={18} />, label: "Resumen" },
        { id: "gastos", icon: <DollarSign size={18} />, label: "Gastos Ads", badge: pendN },
        { id: "reportes", icon: <FileText size={18} />, label: "Reportes" },
        { id: "garantias", icon: <Shield size={18} />, label: "Garantías" },
      ]
    : [
        { id: "dashboard", icon: <BarChart3 size={18} />, label: "Resumen" },
        { id: "clientes", icon: <Users size={18} />, label: "Clientes" },
        { id: "gastos", icon: <DollarSign size={18} />, label: "Gastos Ads", badge: pendN },
        { id: "cobros", icon: <CreditCard size={18} />, label: "Cobros" },
        { id: "reportes", icon: <FileText size={18} />, label: "Reportes", section: "Finanzas" },
        { id: "garantias", icon: <Shield size={18} />, label: "Garantías" },
        { id: "backup", icon: <HardDrive size={18} />, label: "Copia de seguridad", external: "https://www.marketingconholistic.com/backup-dashboard", section: "Sistema" },
      ];

  const pct = curD && (curD.tG + curD.tF) > 0 ? (curD.tP / (curD.tG + curD.tF)) * 100 : 0;

  const pageTitles = { dashboard: "Resumen", clientes: "Clientes", gastos: "Gastos Ads", cobros: "Cobros", reportes: "Reportes", garantias: "Garantías", "client-detail": curC?.name || "Cliente" };

  const manualTabContent = detailTab === "manual" ? (
    <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 14, overflow: "hidden" }}>
      <div className="hm-table-wrap"><table><thead><tr>{["Fecha", "Concepto", "Monto", "Tipo", "Nota", ...(isCliente ? [] : [""])].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead><tbody>{curMan.map((m) => <tr key={m.id}><td style={TD}>{fmtD(m.fecha)}</td><td style={{ ...TD, fontWeight: 600 }}>{m.conc}</td><td style={{ ...TD, ...MN, color: m.tipo === "Gasto" ? "#dc2640" : m.tipo === "Ingreso" ? "#0d9f6e" : "#1a1d26" }}>{m.tipo === "Nota" ? "—" : (m.tipo === "Gasto" ? "-$" : "+$") + fmt(m.monto)}</td><td style={TD}><Bdg type={m.tipo === "Gasto" ? "err" : m.tipo === "Ingreso" ? "ok" : "n"}>{m.tipo}</Bdg></td><td style={{ ...TD, fontSize: 12.5, color: "#9498a8" }}>{m.nota || "—"}</td>{!isCliente && <td style={TD}><IBtn onClick={() => mutations.delManual(m.id)} icon={<Trash2 size={13} />} danger /></td>}</tr>)}{!curMan.length && <Empty cols={isCliente ? 5 : 6} msg="Sin registros" />}</tbody></table></div>
      {!isCliente && <div style={{ display: "flex", gap: 10, alignItems: "flex-end", padding: "14px 18px", background: "#f8f9fb", borderTop: "1px solid #eff0f3", flexWrap: "wrap" }}>
        <div style={{ flex: .7 }}><label style={{ display: "block", fontSize: 10.5, fontWeight: 600, color: "#9498a8", marginBottom: 4 }}>Fecha</label><input type="date" value={mf.fecha} onChange={(e) => setMf({ ...mf, fecha: e.target.value })} style={{ padding: "7px 10px", fontSize: 12, border: "1px solid #e2e4e9", borderRadius: 7, fontFamily: "'DM Sans'", outline: "none", width: "100%" }} /></div>
        <div style={{ flex: 1.2 }}><label style={{ display: "block", fontSize: 10.5, fontWeight: 600, color: "#9498a8", marginBottom: 4 }}>Concepto</label><input value={mf.conc} onChange={(e) => setMf({ ...mf, conc: e.target.value })} placeholder="Concepto" style={{ padding: "7px 10px", fontSize: 12, border: "1px solid #e2e4e9", borderRadius: 7, fontFamily: "'DM Sans'", outline: "none", width: "100%" }} /></div>
        <div style={{ flex: .6 }}><label style={{ display: "block", fontSize: 10.5, fontWeight: 600, color: "#9498a8", marginBottom: 4 }}>Monto</label><input type="number" value={mf.monto} onChange={(e) => setMf({ ...mf, monto: e.target.value })} placeholder="0.00" step="0.01" style={{ padding: "7px 10px", fontSize: 12, border: "1px solid #e2e4e9", borderRadius: 7, fontFamily: "'DM Sans'", outline: "none", width: "100%" }} /></div>
        <div style={{ flex: .6 }}><label style={{ display: "block", fontSize: 10.5, fontWeight: 600, color: "#9498a8", marginBottom: 4 }}>Tipo</label><select value={mf.tipo} onChange={(e) => setMf({ ...mf, tipo: e.target.value })} style={{ padding: "7px 10px", fontSize: 12, border: "1px solid #e2e4e9", borderRadius: 7, fontFamily: "'DM Sans'", outline: "none", width: "100%" }}><option>Gasto</option><option>Ingreso</option><option>Nota</option></select></div>
        <Btn size="sm" onClick={saveMan} style={{ height: 34, marginBottom: 1 }}>+ Agregar</Btn>
      </div>}
    </div>
  ) : null;

  const emptyCobrosMsg = !cobros.length ? "Sin cobros" : (filterCliente.cobros ? "Sin cobros para este cliente" : "Sin cobros");
  const emptyGarantiasMsg = !garantias.length ? "Sin garantías" : (filterCliente.garantias ? "Sin garantías para este cliente" : "Sin garantías");

  return (
    <div className={"hm-app" + (menuOpen ? " menu-open" : "")} style={{ display: "flex", minHeight: "100vh", fontFamily: "'DM Sans',-apple-system,sans-serif", background: "#f4f5f7", color: "#1a1d26", WebkitFontSmoothing: "antialiased" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
.stat-card:hover{box-shadow:0 4px 12px rgba(0,0,0,.07);transform:translateY(-1px)} table{width:100%;border-collapse:collapse;min-width:600px} tbody tr:hover{background:#fafbfc} tbody tr:last-child td{border-bottom:none}
.hm-modal-box,.hm-modal-box input,.hm-modal-box select,.hm-modal-box textarea{box-sizing:border-box}
.hm-modal-box .hm-form-grid>div{min-width:0}
@media (max-width:768px){
  .hm-sidebar{transform:translateX(-100%);transition:transform .2s ease;z-index:200;box-shadow:4px 0 20px rgba(0,0,0,.08)}
  .hm-app.menu-open .hm-sidebar{transform:translateX(0)}
  .hm-sidebar-overlay{display:block}
  .hm-app.menu-open .hm-sidebar-overlay{opacity:1;pointer-events:auto}
  .hm-main{margin-left:0!important;padding-top:56px!important}
  .hm-mobile-header{display:flex!important}
  .hm-page-header{top:56px!important;padding:0 16px!important;flex-wrap:wrap;gap:8px!important;min-height:auto!important;height:auto!important;padding:12px 16px!important}
  .hm-page-content{padding:16px 12px!important}
  .hm-stats-grid{grid-template-columns:repeat(2,1fr)!important;gap:10px!important}
  .hm-charts-grid-2{grid-template-columns:1fr!important}
  .hm-charts-grid-2-1{grid-template-columns:1fr!important}
  .hm-report-grid{grid-template-columns:1fr!important}
  .hm-credito-hero{padding:32px 20px 40px!important}
  .hm-credito-content{padding:24px 16px!important}
  .hm-detail-stats{grid-template-columns:repeat(2,1fr)!important}
  .hm-detail-charts{grid-template-columns:1fr!important}
  .hm-detail-tabs{flex-wrap:wrap;width:100%!important}
  .hm-detail-tabs button{padding:6px 12px;font-size:11.5px}
  .hm-modal-outer{padding:12px 12px 24px!important;align-items:flex-start!important}
  .hm-modal-box{width:100%!important;max-width:100%!important;margin-bottom:20px!important;overflow:hidden!important;box-sizing:border-box!important}
  .hm-modal-box *{box-sizing:border-box!important}
  .hm-modal-box .hm-form-grid>div,.hm-modal-box [style*="flex:"]{min-width:0!important}
  .hm-form-grid{grid-template-columns:1fr!important;gap:12px!important}
  .hm-modal-box input,.hm-modal-box select,.hm-modal-box textarea{min-height:44px!important;padding:12px 14px!important;font-size:16px!important;max-width:100%!important}
  .hm-modal-box textarea{min-height:80px!important}
  .hm-modal-box label{font-size:13px!important}
  .hm-modal-box .hm-modal-footer{flex-wrap:wrap;gap:8px!important}
}
@media (max-width:480px){
  .hm-modal-box input,.hm-modal-box select,.hm-modal-box textarea{min-height:48px!important}
}
@media (max-width:480px){
  .hm-stats-grid{grid-template-columns:1fr!important}
  .hm-detail-stats{grid-template-columns:1fr!important}
}
.hm-sidebar-overlay{display:none;position:fixed;inset:0;background:rgba(15,17,26,.4);z-index:150;opacity:0;pointer-events:none;transition:opacity .2s}
.hm-mobile-header{display:none;position:fixed;top:0;left:0;right:0;height:56px;background:#fff;border-bottom:1px solid #e2e4e9;align-items:center;padding:0 16px;z-index:101;gap:12px}
.hm-table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:0 -12px;padding:0 12px}
.hm-table-wrap table{min-width:0}
.hm-table-wrap.hm-table-clientes table{min-width:1100px}
.hm-table-wrap.hm-table-clientes th.hm-col-actions,.hm-table-wrap.hm-table-clientes td.hm-col-actions{position:sticky;right:0;background:#fff;min-width:118px;box-shadow:-6px 0 12px rgba(0,0,0,.06);z-index:1}
.hm-table-wrap.hm-table-clientes thead th.hm-col-actions{background:#f8f9fb}
.hm-table-wrap.hm-table-clientes tr:hover td.hm-col-actions{background:#fafbfc}
.hm-table-wrap.hm-table-clientes th{font-size:11.5px}
@media (max-width:768px){.hm-table-wrap{margin:0 -12px}}
`}</style>

      {/* Overlay móvil al abrir menú */}
      <div className="hm-sidebar-overlay" onClick={() => setMenuOpen(false)} aria-hidden="true" />

      {/* Cabecera móvil */}
      <header className="hm-mobile-header">
        <button onClick={() => setMenuOpen(true)} style={{ width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", border: "none", background: "#f4f5f7", borderRadius: 10, color: "#1b2559", cursor: "pointer" }} aria-label="Abrir menú"><Menu size={22} /></button>
        <span style={{ fontSize: 16, fontWeight: 700, color: "#1a1d26", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pageTitles[page] || "Holistic"}</span>
        {!isCliente && (
          <div style={{ flexShrink: 0 }}>
            <Av name={displayName} size={36} avatarUrl={gerenteAvatarUrl} />
          </div>
        )}
        {isCliente && clients[0] && (
          <div style={{ flexShrink: 0 }}>
            <Av name={clients[0].name} size={36} avatarUrl={clients[0].avatar_url} />
          </div>
        )}
      </header>

      {/* ═══ SIDEBAR ═══ */}
      <aside className="hm-sidebar" style={{ width: 260, background: "#fff", borderRight: "1px solid #e2e4e9", position: "fixed", top: 0, left: 0, bottom: 0, display: "flex", flexDirection: "column", zIndex: 100 }}>
        <div style={{ padding: "22px 20px 18px", borderBottom: "1px solid #eff0f3" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src={LOGO_URL} alt="Holistic Marketing" style={{ height: 51, width: 200, maxWidth: "100%", objectFit: "contain", display: "block" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, paddingTop: 14, borderTop: "1px solid #eff0f3" }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              {isCliente ? (
                <Av name={displayName} size={44} avatarUrl={clients[0]?.avatar_url} />
              ) : (
                <>
                  <Av name={displayName} size={48} avatarUrl={gerenteAvatarUrl} />
                  <label style={{ position: "absolute", right: -4, bottom: -4, width: 28, height: 28, borderRadius: 8, background: "#1b2559", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: uploadingGerenteAvatar ? "wait" : "pointer", boxShadow: "0 2px 8px rgba(27,37,89,.3)", border: "2px solid #fff" }} title="Cambiar foto">
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: "none" }} onChange={async (e) => { const f = e.target.files?.[0]; if (f) await handleGerenteAvatarUpload(f); e.target.value = ""; }} disabled={uploadingGerenteAvatar} />
                    <Camera size={14} />
                  </label>
                </>
              )}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1d26", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Bienvenido, {displayName}</div>
              {subLabel && <div style={{ fontSize: 11, color: "#9498a8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subLabel}</div>}
              {!isCliente && (
                <button type="button" onClick={handleEditarNombreGerente} style={{ marginTop: 4, padding: 0, border: "none", background: "none", color: "#0055ff", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>Cambiar nombre</button>
              )}
            </div>
          </div>
        </div>
        <nav style={{ flex: 1, padding: "16px 12px", overflowY: "auto" }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: "#9498a8", textTransform: "uppercase", letterSpacing: 1.4, padding: "8px 12px 6px" }}>General</div>
          {nav.map((it) => (
            <div key={it.id}>
              {it.section && <div style={{ fontSize: 10.5, fontWeight: 700, color: "#9498a8", textTransform: "uppercase", letterSpacing: 1.4, padding: "8px 12px 6px", marginTop: 12 }}>{it.section}</div>}
              {it.external ? (
                <a href={it.external} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, fontSize: 13.5, fontWeight: 500, color: "#5f6577", background: "transparent", cursor: "pointer", margin: "1px 0", textDecoration: "none" }}>
                  {it.icon}<span>{it.label}</span><ExternalLink size={12} style={{ marginLeft: "auto", opacity: 0.6 }} />
                </a>
              ) : (
                <div onClick={() => goTo(it.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, fontSize: 13.5, fontWeight: page === it.id ? 600 : 500, color: page === it.id ? "#1b2559" : "#5f6577", background: page === it.id ? "#eef0f8" : "transparent", cursor: "pointer", margin: "1px 0" }}>
                  {it.icon}<span>{it.label}</span>
                  {it.badge > 0 && <span style={{ marginLeft: "auto", background: "#dc2640", color: "#fff", fontSize: 10.5, fontWeight: 700, padding: "1px 7px", borderRadius: 10 }}>{it.badge}</span>}
                </div>
              )}
            </div>
          ))}
        </nav>
        <div style={{ padding: "14px 20px", borderTop: "1px solid #eff0f3" }}>
          <button onClick={async () => { await supabase?.auth?.signOut?.(); }} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", padding: "8px 12px", border: "1px solid #e2e4e9", borderRadius: 8, background: "#fff", color: "#5f6577", fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}><LogOut size={14} /> Cerrar sesión</button>
        </div>
      </aside>

      {/* ═══ MAIN ═══ */}
      <main className="hm-main" style={{ flex: 1, marginLeft: 260, minHeight: "100vh" }}>

        {/* ══ CRÉDITO ══ */}
        {page === "credito" && (
          <div>
            <div className="hm-credito-hero" style={{ background: "linear-gradient(135deg, #1b2559 0%, #0d1842 100%)", color: "#fff", padding: "48px 36px 56px", textAlign: "center" }}>
              <div style={{ maxWidth: 640, margin: "0 auto" }}>
                <h1 style={{ fontSize: "clamp(28px, 4vw, 38px)", fontWeight: 800, letterSpacing: -0.5, marginBottom: 12 }}>Crédito</h1>
                <p style={{ fontSize: 16, opacity: 0.9, lineHeight: 1.6 }}>Soluciones de crédito para impulsar tu negocio con Holistic Marketing.</p>
                <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 24, padding: "12px 24px", background: "#fff", color: "#1b2559", borderRadius: 10, fontWeight: 700, fontSize: 14, textDecoration: "none", transition: "transform .2s" }}>Volver al inicio</a>
              </div>
            </div>
            <div className="hm-credito-content" style={{ maxWidth: 800, margin: "0 auto", padding: "40px 36px" }}>
              <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 16, padding: 32, textAlign: "center", color: "#5f6577", lineHeight: 1.7 }}>Próximamente más información sobre opciones de crédito.</div>
            </div>
          </div>
        )}

        {/* ══ DASHBOARD ══ */}
        {page === "dashboard" && (<div>
          <div className="hm-page-header" style={{ background: "#fff", borderBottom: "1px solid #e2e4e9", padding: "0 36px", minHeight: 60, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, position: "sticky", top: 0, zIndex: 50 }}>
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Resumen general</h2>
              <p style={{ fontSize: 12, color: "#9498a8", margin: "4px 0 0", maxWidth: 420 }}>Totales, tendencias y pendientes de cobro. Datos: {months[0]?.label} a {months[months.length - 1]?.label} (últimos 6 meses). Para análisis por período o por cliente, usa <button type="button" onClick={() => goTo("reportes")} style={{ background: "none", border: "none", color: "#0055ff", fontWeight: 600, cursor: "pointer", padding: 0, fontFamily: "inherit", fontSize: "inherit", textDecoration: "underline" }}>Reportes</button>.</p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><Btn variant="outline" size="sm" onClick={() => goTo("reportes")}><FileText size={14} /> Reportes</Btn>{!isCliente && <Btn onClick={() => openMdl("gasto")}><Plus size={16} /> Nuevo Gasto</Btn>}</div>
          </div>
          <div className="hm-page-content" style={{ padding: "28px 36px 40px" }}>
            <div className="hm-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 28 }}>
              <Stat icon={<DollarSign size={20} />} value={`$${fmt(tots.tG)}`} label="Gasto Total Ads" color="#1b2559" />
              <Stat icon={<TrendingUp size={20} />} value={`$${fmt(tots.tF)}`} label="Fees Generados" color="#0055ff" />
              <Stat icon={<Check size={20} />} value={`$${fmt(tots.tP)}`} label="Total Cobrado" color="#0d9f6e" />
              <Stat icon={<AlertCircle size={20} />} value={`$${fmt(tots.net)}`} label="Deuda Neta" color="#dc2640" sub={tots.tGar > 0 ? `Garantías descontadas: -$${fmt(tots.tGar)}` : ""} />
            </div>
            <div className="hm-charts-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 28 }}>
              <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 14, padding: "20px 22px" }}>
                <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Gasto Mensual en Ads</h4><p style={{ fontSize: 12, color: "#9498a8", marginBottom: 16 }}>Inversión + fees por mes</p>
                <ResponsiveContainer width="100%" height={220}><BarChart data={dCharts.monthly}><CartesianGrid strokeDasharray="3 3" stroke="#eff0f3" /><XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9498a8" }} /><YAxis tick={{ fontSize: 11, fill: "#9498a8" }} /><Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} /><Legend wrapperStyle={{ fontSize: 11.5 }} /><Bar dataKey="gasto" name="Gasto Ads" fill="#0055ff" radius={[6, 6, 0, 0]} /><Bar dataKey="fee" name="Fee" fill="#7c3aed" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer>
              </div>
              <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 14, padding: "20px 22px" }}>
                <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Métodos de Cobro</h4><p style={{ fontSize: 12, color: "#9498a8", marginBottom: 16 }}>Distribución por medio de pago</p>
                <ResponsiveContainer width="100%" height={220}><PieChart><Pie data={dCharts.methods} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value" label={cLabel}>{dCharts.methods.map((e, i) => <Cell key={i} fill={e.color} />)}</Pie><Legend wrapperStyle={{ fontSize: 11 }} /><Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v) => `$${fmt(v)}`} /></PieChart></ResponsiveContainer>
              </div>
            </div>
            <div className="hm-charts-grid-2-1" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 28 }}>
              <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 14, padding: "20px 22px" }}>
                <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Cobrado vs Gasto</h4><p style={{ fontSize: 12, color: "#9498a8", marginBottom: 16 }}>Evolución mensual</p>
                <ResponsiveContainer width="100%" height={220}><LineChart data={dCharts.monthly}><CartesianGrid strokeDasharray="3 3" stroke="#eff0f3" /><XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9498a8" }} /><YAxis tick={{ fontSize: 11, fill: "#9498a8" }} /><Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} /><Legend wrapperStyle={{ fontSize: 11.5 }} /><Line type="monotone" dataKey="cobrado" name="Cobrado" stroke="#0d9f6e" strokeWidth={2} dot={{ r: 4 }} /><Line type="monotone" dataKey="gasto" name="Gasto" stroke="#0055ff" strokeWidth={2} dot={{ r: 4 }} /></LineChart></ResponsiveContainer>
              </div>
              <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 14, padding: "20px 22px" }}>
                <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Deuda Neta por Cliente</h4><p style={{ fontSize: 12, color: "#9498a8", marginBottom: 16 }}>Incluye descuento de garantías</p>
                <ResponsiveContainer width="100%" height={220}><BarChart data={dCharts.debt} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke="#eff0f3" /><XAxis type="number" tick={{ fontSize: 11, fill: "#9498a8" }} /><YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "#9498a8" }} width={80} /><Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v) => `$${fmt(v)}`} /><Bar dataKey="debt" fill="#dc264088" radius={[0, 6, 6, 0]} /></BarChart></ResponsiveContainer>
              </div>
            </div>
            <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 14, overflow: "hidden" }}>
              <div style={{ padding: "18px 22px", borderBottom: "1px solid #eff0f3" }}><h3 style={{ fontSize: 15, fontWeight: 700 }}>Pendientes de Cobro</h3></div>
              <div className="hm-table-wrap"><table><thead><tr>{["Cliente", "Fecha de movimiento", "Gasto", "Fee", "Total", "Pagado", "Pendiente", "Estado"].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead>
                <tbody>{sGastos.filter((g) => g._st !== "Pagado").sort((a, b) => (b.mes || "").localeCompare(a.mes || "z")).slice(0, 10).map((g) => { const c = clients.find((x) => x.id === g.clientId); return <tr key={g.id} onClick={() => goTo("client-detail", g.clientId)} style={{ cursor: "pointer" }}><td style={TD}><div style={{ display: "flex", alignItems: "center", gap: 10 }}>{c && <Av name={c.name} avatarUrl={c.avatar_url} />}<span style={{ fontWeight: 600 }}>{c?.name || "—"}</span></div></td><td style={{ ...TD, fontWeight: 600 }}>{fmtM(g.mes)}</td><td style={{ ...TD, ...MN }}>${fmt(g.gasto)}</td><td style={{ ...TD, ...MN, color: "#0055ff" }}>{g.fee}%</td><td style={{ ...TD, ...MN, fontWeight: 700 }}>${fmt(g._t)}</td><td style={{ ...TD, ...MN, color: "#0d9f6e" }}>${fmt(g._p)}</td><td style={{ ...TD, ...MN, color: "#dc2640" }}>${fmt(g._pend)}</td><td style={TD}><Bdg type={g._st === "Parcial" ? "warn" : "acc"}>{g._st}</Bdg></td></tr>; })}
                {!sGastos.some((g) => g._st !== "Pagado") && <Empty cols={8} msg="🎉 Todo cobrado — sin pendientes" />}</tbody></table></div>
            </div>
          </div>
        </div>)}

        {/* ══ REPORTES ══ */}
        {page === "reportes" && (<div>
          <div style={{ background: "linear-gradient(135deg, #1b2559, #0d1842)", padding: "28px 36px 24px", color: "#fff" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <div style={{ width: 44, height: 44, background: "rgba(255,255,255,.12)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800 }}>H</div>
              <div><h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.3 }}>Relación de Cuentas</h2><p style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>Análisis por período y por cliente. Filtra arriba y revisa el desglose; los totales corresponden al rango seleccionado.</p></div>
            </div>
          </div>
          <div className="hm-page-header" style={{ background: "#fff", borderBottom: "1px solid #e2e4e9", padding: "16px 36px", display: "flex", gap: 24, alignItems: "flex-end", flexWrap: "wrap" }}>
            {!isCliente && <div style={{ minWidth: 200 }}><SearchSelect compact label="Usuario" options={[{ value: "all", label: "Todos" }, ...clientsSorted.map((c) => ({ value: c.id, label: c.name }))]} value={repCl} onChange={(id) => setRepCl(id || "all")} placeholder="Buscar cliente..." emptyMessage="Ningún cliente coincide" /></div>}
            <div><label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#9498a8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>Período (mes)</label><div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><input type="text" placeholder="MM/AAAA" value={repPerInput !== undefined ? repPerInput : (repPer || "")} onChange={(e) => setRepPerInput(e.target.value)} onBlur={(e) => { const p = parsePeriodoInput(e.target.value); if (p) { setRepPer(p); setRepPerInput(p); } else setRepPerInput(undefined); }} style={{ width: 100, padding: "8px 12px", border: "1px solid #e2e4e9", borderRadius: 8, fontSize: 13, fontFamily: "'DM Sans'", outline: "none", boxSizing: "border-box" }} /><button type="button" onClick={() => { const d = new Date(); const key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); setRepPer(key); setRepPerInput(key); }} style={{ padding: "8px 12px", border: "1px solid #e2e4e9", borderRadius: 8, background: "#f0f4ff", color: "#0055ff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans'" }}>Este mes</button><button type="button" onClick={() => { const d = new Date(); d.setMonth(d.getMonth() - 1); const key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); setRepPer(key); setRepPerInput(key); }} style={{ padding: "8px 12px", border: "1px solid #e2e4e9", borderRadius: 8, background: "#f4f5f7", color: "#5f6577", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans'" }}>Mes pasado</button><select value={repPer} onChange={(e) => { setRepPer(e.target.value); setRepPerInput(e.target.value || undefined); }} style={{ padding: "8px 14px", border: "1px solid #e2e4e9", borderRadius: 8, fontSize: 13.5, fontFamily: "'DM Sans'", minWidth: 140, outline: "none", cursor: "pointer" }}><option value="">Todos</option>{allMonths.map((m) => <option key={m} value={m}>{fmtM(m)}</option>)}</select></div></div>
            <div><label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#9498a8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>Rango por fecha de operación</label><div style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="date" value={repPerInicio} onChange={(e) => setRepPerInicio(e.target.value)} style={{ padding: "8px 12px", border: "1px solid #e2e4e9", borderRadius: 8, fontSize: 13, fontFamily: "'DM Sans'", outline: "none" }} /><span style={{ color: "#9498a8", fontSize: 12 }}>a</span><input type="date" value={repPerFin} onChange={(e) => setRepPerFin(e.target.value)} style={{ padding: "8px 12px", border: "1px solid #e2e4e9", borderRadius: 8, fontSize: 13, fontFamily: "'DM Sans'", outline: "none" }} /></div></div>
          </div>
          <div className="hm-page-content" style={{ padding: "28px 36px 40px" }}>
            <div style={{ background: "linear-gradient(135deg, #f0eefe 0%, #eef0f8 100%)", border: "1px solid #c4b5fd", borderRadius: 12, padding: "14px 20px", marginBottom: 24, display: "flex", alignItems: "flex-start", gap: 12 }}>
              <Shield size={22} style={{ color: "#7c3aed", flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#5b21b6", marginBottom: 4 }}>¿Dónde se ven las garantías?</div>
                <p style={{ margin: 0, fontSize: 12.5, color: "#6b21a8", lineHeight: 1.5 }}>Las garantías vigentes que agregás en <strong>Garantías</strong> se descuentan aquí: en la columna <strong>GARANTÍA</strong> (con signo negativo) y reducen el <strong>PEND. NETO</strong> de cada cliente. También bajan la columna <strong>A cobrar</strong> en Gastos. Si acabas de guardar una garantía, ya está reflejada.</p>
              </div>
            </div>
            <div className="hm-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 28 }}>
              <Stat icon={<DollarSign size={20} />} value={`$${fmt(repData.t.ads)}`} label="Total Ads USD" color="#1b2559" />
              <Stat icon={<Percent size={20} />} value={`$${fmt(repData.t.fee)}`} label="Total Fee" color="#0055ff" />
              <Stat icon={<Check size={20} />} value={`$${fmt(repData.t.paid)}`} label="Cobrado" color="#0d9f6e" />
              <Stat icon={<AlertCircle size={20} />} value={`$${fmt(repData.t.netPending)}`} label="Pendiente Neto" color="#dc2640" sub={repData.t.gar > 0 ? `Garantías: -$${fmt(repData.t.gar)}` : ""} />
            </div>
            <div className="hm-report-grid" style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 16 }}>
              <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 14, overflow: "hidden" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid #eff0f3" }}><h3 style={{ fontSize: 15, fontWeight: 700 }}>Desglose por Usuario</h3></div>
                <div className="hm-table-wrap"><table><thead><tr>{["Usuario", "ADS", "FEE", "FEE %", "TOTAL", "PAGADO", "GARANTÍA", "PEND. NETO"].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead>
                  <tbody>
                    {repData.rows.map((r) => { const feePct = r.ads > 0 ? (r.fee / r.ads * 100).toFixed(1) + "%" : "—"; return <tr key={r.cid} onClick={() => goTo("client-detail", r.cid)} style={{ cursor: "pointer" }}><td style={{ ...TD, fontWeight: 600 }}>{r.name}</td><td style={{ ...TD, ...MN }}>{fmt(r.ads)}</td><td style={{ ...TD, ...MN, color: "#0055ff" }}>{fmt(r.fee)}</td><td style={{ ...TD, fontSize: 12.5, color: "#0055ff" }}>{feePct}</td><td style={{ ...TD, ...MN, color: "#d97706", fontWeight: 700 }}>{fmt(r.total)}</td><td style={{ ...TD, ...MN, color: "#0d9f6e" }}>{fmt(r.paid)}</td><td style={{ ...TD, ...MN, color: "#7c3aed" }}>{r.gar > 0 ? "-" + fmt(r.gar) : "—"}</td><td style={{ ...TD, ...MN, color: "#dc2640", fontWeight: 700 }}>{fmt(r.netPending)}</td></tr>; })}
                    <tr style={{ background: "#f8f9fb" }}><td style={{ ...TD, fontWeight: 800 }}>TOTAL</td><td style={{ ...TD, ...MN, fontWeight: 700 }}>{fmt(repData.t.ads)}</td><td style={{ ...TD, ...MN, color: "#0055ff", fontWeight: 700 }}>{fmt(repData.t.fee)}</td><td style={{ ...TD, fontSize: 12.5, color: "#0055ff", fontWeight: 700 }}>{repData.t.ads > 0 ? (repData.t.fee / repData.t.ads * 100).toFixed(1) + "%" : "—"}</td><td style={{ ...TD, ...MN, color: "#d97706", fontWeight: 700 }}>{fmt(repData.t.total)}</td><td style={{ ...TD, ...MN, color: "#0d9f6e", fontWeight: 700 }}>{fmt(repData.t.paid)}</td><td style={{ ...TD, ...MN, color: "#7c3aed", fontWeight: 700 }}>{repData.t.gar > 0 ? "-" + fmt(repData.t.gar) : "—"}</td><td style={{ ...TD, ...MN, color: "#dc2640", fontWeight: 700 }}>{fmt(repData.t.netPending)}</td></tr>
                    {!repData.rows.length && <Empty cols={8} msg="Sin datos para este período" />}
                  </tbody></table></div>
              </div>
              <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 14, padding: "20px 22px", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, alignSelf: "flex-start" }}>Composición de Cuentas</h4>
                <ResponsiveContainer width="100%" height={240}><PieChart><Pie data={repData.pie} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="value" label={cLabel}>{repData.pie.map((e, i) => <Cell key={i} fill={e.color} />)}</Pie><Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v) => `$${fmt(v)}`} /><Legend wrapperStyle={{ fontSize: 11.5 }} formatter={(v, e) => `${v}: $${fmt(e.payload.value)}`} /></PieChart></ResponsiveContainer>
                <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 30, fontWeight: 700, marginTop: 4 }}>{fmtK(repData.t.total)}</div>
                <div style={{ fontSize: 12, color: "#9498a8" }}>Total General</div>
              </div>
            </div>
            <div className="hm-charts-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 28, marginBottom: 28 }}>
              <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 14, padding: "20px 22px" }}>
                <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Gasto Mensual en Ads</h4><p style={{ fontSize: 12, color: "#9498a8", marginBottom: 16 }}>Inversión + fees por mes</p>
                <ResponsiveContainer width="100%" height={220}><BarChart data={repCharts.monthly}><CartesianGrid strokeDasharray="3 3" stroke="#eff0f3" /><XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9498a8" }} /><YAxis tick={{ fontSize: 11, fill: "#9498a8" }} /><Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} /><Legend wrapperStyle={{ fontSize: 11.5 }} /><Bar dataKey="gasto" name="Gasto Ads" fill="#0055ff" radius={[6, 6, 0, 0]} /><Bar dataKey="fee" name="Fee" fill="#7c3aed" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer>
              </div>
              <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 14, padding: "20px 22px" }}>
                <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Métodos de Cobro</h4><p style={{ fontSize: 12, color: "#9498a8", marginBottom: 16 }}>Distribución por medio de pago</p>
                <ResponsiveContainer width="100%" height={220}>{repCharts.methods.length > 0 ? <PieChart><Pie data={repCharts.methods} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value" label={cLabel}>{repCharts.methods.map((e, i) => <Cell key={i} fill={e.color} />)}</Pie><Legend wrapperStyle={{ fontSize: 11 }} /><Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v) => `$${fmt(v)}`} /></PieChart> : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#9498a8", fontSize: 13 }}>Sin cobros en el período</div>}</ResponsiveContainer>
              </div>
            </div>
            <div className="hm-charts-grid-2-1" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 28 }}>
              <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 14, padding: "20px 22px" }}>
                <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Cobrado vs Gasto</h4><p style={{ fontSize: 12, color: "#9498a8", marginBottom: 16 }}>Evolución mensual</p>
                <ResponsiveContainer width="100%" height={220}><LineChart data={repCharts.monthly}><CartesianGrid strokeDasharray="3 3" stroke="#eff0f3" /><XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9498a8" }} /><YAxis tick={{ fontSize: 11, fill: "#9498a8" }} /><Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} /><Legend wrapperStyle={{ fontSize: 11.5 }} /><Line type="monotone" dataKey="cobrado" name="Cobrado" stroke="#0d9f6e" strokeWidth={2} dot={{ r: 4 }} /><Line type="monotone" dataKey="gasto" name="Gasto" stroke="#0055ff" strokeWidth={2} dot={{ r: 4 }} /></LineChart></ResponsiveContainer>
              </div>
              <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 14, padding: "20px 22px" }}>
                <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Deuda Neta por Cliente</h4><p style={{ fontSize: 12, color: "#9498a8", marginBottom: 16 }}>Incluye descuento de garantías</p>
                <ResponsiveContainer width="100%" height={220}>{repCharts.debt.length > 0 ? <BarChart data={repCharts.debt} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke="#eff0f3" /><XAxis type="number" tick={{ fontSize: 11, fill: "#9498a8" }} /><YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "#9498a8" }} width={80} /><Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v) => `$${fmt(v)}`} /><Bar dataKey="debt" fill="#dc264088" radius={[0, 6, 6, 0]} /></BarChart> : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#9498a8", fontSize: 13 }}>Sin deuda en el período</div>}</ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>)}

        {/* ══ CLIENTES (solo gerente) ══ */}
        {page === "clientes" && !isCliente && (<div>
          <div className="hm-page-header" style={{ background: "#fff", borderBottom: "1px solid #e2e4e9", padding: "0 36px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700 }}>Clientes</h2>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ background: "#f0f4ff", color: "#1b2559", padding: "6px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: "'DM Sans'" }} title="Total de clientes">
                {search.trim() ? `${clientsFiltered.length} de ${clientsSorted.length} clientes` : `${clientsSorted.length} clientes en total`}
              </div>
              <div style={{ position: "relative" }}><Search size={15} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#9498a8" }} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre..." style={{ padding: "8px 12px 8px 34px", width: 220, background: "#f4f5f7", border: "1px solid transparent", borderRadius: 8, fontSize: 13, fontFamily: "'DM Sans'", outline: "none" }} /></div>
              <Btn variant="outline" size="sm" onClick={expClientes}><Download size={14} /> Descargar Excel</Btn>
              <Btn onClick={() => openMdl("client")}><Plus size={16} /> Nuevo</Btn>
            </div>
          </div>
          <div className="hm-page-content" style={{ padding: "28px 36px" }}><div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 14, overflow: "hidden" }}>
            {(() => {
              const totalPages = Math.ceil(clientsFiltered.length / PER_PAGE) || 1;
              const currentPage = Math.min(pageNum.clientes, totalPages);
              const clientsPaginated = clientsFiltered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);
              return (
                <>
                  <div className="hm-table-wrap hm-table-clientes"><table><thead><tr>{["Cliente", "Instagram", "Contacto", "Gasto", "Fees", "Cobrado", "Garantías", "Deuda Neta", "Estado", ""].map((h, i) => <th key={h} style={TH} className={i === 9 ? "hm-col-actions" : undefined}>{h}</th>)}</tr></thead>
                    <tbody>{clientsPaginated.map((c) => { const d = cData(c.id); const st = d.gross <= 0 ? "ok" : d.net > 0 ? "err" : "warn"; const stT = d.gross <= 0 ? "Al día" : d.net > 0 ? "Con deuda" : "Cubierto"; const TDC = { ...TD, fontSize: 14 }; const btnSize = { width: 34, height: 34 }; return <tr key={c.id} onClick={() => goTo("client-detail", c.id)} style={{ cursor: "pointer" }}><td style={TDC}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><Av name={c.name} avatarUrl={c.avatar_url} /><div><div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div>{c.biz && <div style={{ fontSize: 12, color: "#9498a8" }}>{c.biz}</div>}</div></div></td><td style={{ ...TDC, color: "#e1306c", fontWeight: 600 }}>{c.ig ? "📷 " + c.ig : "—"}</td><td style={TDC}><div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>{(c.phones || []).filter(Boolean).map((p, i) => <span key={"p" + i} style={{ padding: "3px 8px", background: "#f4f5f7", borderRadius: 4, fontSize: 12 }}>📱 {p}</span>)}{(c.emails || []).filter(Boolean).map((e, i) => <span key={"e" + i} style={{ padding: "3px 8px", background: "#f4f5f7", borderRadius: 4, fontSize: 12 }}>✉ {e}</span>)}</div></td><td style={{ ...TDC, ...MN }}>${fmt(d.tG)}</td><td style={{ ...TDC, ...MN, color: "#0055ff" }}>${fmt(d.tF)}</td><td style={{ ...TDC, ...MN, color: "#0d9f6e" }}>${fmt(d.tP)}</td><td style={{ ...TDC, ...MN, color: "#7c3aed" }}>{d.tGar > 0 ? "$" + fmt(d.tGar) : "—"}</td><td style={{ ...TDC, ...MN, color: "#dc2640" }}>${fmt(d.net)}</td><td style={TDC}><Bdg type={st}>{stT}</Bdg></td><td className="hm-col-actions" style={TDC} onClick={(e) => e.stopPropagation()}><div style={{ display: "flex", gap: 5 }}><IBtn onClick={() => openMdl("dar-acceso", c.id)} icon={<KeyRound size={15} />} title="Dar acceso" style={{ ...btnSize, color: "#0d9f6e" }} /><IBtn onClick={() => openMdl("client", c.id)} icon={<Edit3 size={15} />} title="Editar" style={btnSize} /><IBtn onClick={() => delClient(c.id)} icon={<Trash2 size={15} />} danger title="Eliminar" style={btnSize} /></div></td></tr>; })}{!clientsPaginated.length && <Empty cols={10} msg={clients.length ? "Ningún cliente coincide con la búsqueda" : "No hay clientes registrados"} />}</tbody></table></div>
                  {totalPages > 1 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "12px 16px", borderTop: "1px solid #e2e4e9", flexWrap: "wrap" }}>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                        <button key={n} type="button" onClick={() => setPageNum((p) => ({ ...p, clientes: n }))} style={{ minWidth: 32, height: 32, padding: "0 8px", border: "1px solid #e2e4e9", borderRadius: 8, background: n === currentPage ? "#1b2559" : "#fff", color: n === currentPage ? "#fff" : "#1b2559", fontWeight: n === currentPage ? 700 : 500, fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans'" }}>{n}</button>
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
            curD={curD}
            pct={pct}
            detailTab={detailTab}
            setDetailTab={setDetailTab}
            curGastos={curGastos}
            curCobros={curCobros}
            curGars={curGars}
            manualTabContent={manualTabContent}
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
            updateClientAvatar={mutations.updateClientAvatar}
            uploadAvatarFile={curCl ? (file) => uploadAvatar(curCl, file) : null}
            onExportClient={expClientData}
            expClientRango={expClientRango}
            setExpClientRango={setExpClientRango}
          />
        )}

        {/* ══ GASTOS ══ */}
        {page === "gastos" && (<div>
          <div className="hm-page-header" style={{ background: "#fff", borderBottom: "1px solid #e2e4e9", padding: "0 36px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, position: "sticky", top: 0, zIndex: 50 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700 }}>Gastos Ads · Mensuales</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ background: "#f0f4ff", color: "#1b2559", padding: "6px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: "'DM Sans'" }} title="Total de filas">
                {filterCliente.gastos ? `${gastosFiltrados.length} de ${sGastos.length} gastos` : `${sGastos.length} gastos en total`}
              </div>
              {!isCliente && <div style={{ minWidth: 200, display: "inline-block" }}><SearchSelect compact options={clientFilterOptions} value={filterCliente.gastos} onChange={(id) => setFilterCliente((p) => ({ ...p, gastos: id || "" }))} placeholder="Buscar cliente..." emptyMessage="Ningún cliente coincide" /></div>}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}><input type="date" value={expRango.gastos.ini} onChange={(e) => setExpRango((p) => ({ ...p, gastos: { ...p.gastos, ini: e.target.value } }))} style={{ padding: "6px 10px", border: "1px solid #e2e4e9", borderRadius: 8, fontSize: 12, fontFamily: "'DM Sans'", outline: "none" }} title="Fecha desde" /><span style={{ color: "#9498a8", fontSize: 11 }}>a</span><input type="date" value={expRango.gastos.fin} onChange={(e) => setExpRango((p) => ({ ...p, gastos: { ...p.gastos, fin: e.target.value } }))} style={{ padding: "6px 10px", border: "1px solid #e2e4e9", borderRadius: 8, fontSize: 12, fontFamily: "'DM Sans'", outline: "none" }} title="Fecha hasta" /></div>
              <Btn variant="outline" size="sm" onClick={expGastos}><Download size={14} /> Descargar Excel</Btn>
              {!isCliente && <Btn onClick={() => openMdl("gasto")}><Plus size={16} /> Nuevo Gasto</Btn>}
            </div>
          </div>
          <div className="hm-page-content" style={{ padding: "28px 36px" }}><div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 14, overflow: "hidden" }}>
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
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: "1px solid #e2e4e9" }}>
                      <Btn variant="outline" size="sm" onClick={delGastosBulk} style={{ color: "#dc2640", borderColor: "#dc2640" }}><Trash2 size={14} /> Eliminar seleccionados ({selectedIds.gastos.length})</Btn>
                    </div>
                  )}
                  <div className="hm-table-wrap"><table><thead><tr>{!isCliente && <th style={{ ...TH, width: 42 }}><input type="checkbox" checked={allOnPageSelected} onChange={() => selectAllOnPage("gastos", idsOnPage)} title="Seleccionar página" style={{ cursor: "pointer", width: 16, height: 16 }} /></th>}{["Cliente", "Código", "Fecha (dd/mm/aaaa)", "Período (mm/aaaa)", "Campaña", "Gasto", "Fee %", "Fee $", "Total", "Pagado", "Garantía", "Pendiente", "A cobrar", "Estado", "Prepago", ...(isCliente ? [] : ["Registrado por"]), ""].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead>
                    <tbody>{gastosPaginated.map((g) => { const c = clients.find((x) => x.id === g.clientId); const garVal = garantias.filter((gr) => gr.clientId === g.clientId && gr.estado === "Vigente").reduce((a, gr) => a + parseFloat(gr.valor || 0), 0); const netCobrar = cData(g.clientId).net; return <tr key={g.id}>{!isCliente && <td style={TD}><input type="checkbox" checked={sel.includes(g.id)} onChange={() => toggleSelect("gastos", g.id)} style={{ cursor: "pointer", width: 16, height: 16 }} /></td>}<td style={TD}><div style={{ display: "flex", alignItems: "center", gap: 10 }}>{c && <Av name={c.name} size={30} avatarUrl={c.avatar_url} />}<span style={{ fontWeight: 600, fontSize: 13 }}>{c?.name || "—"}</span></div></td><td style={{ ...TD, fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, fontWeight: 600, color: "#1b2559" }}>{g.codigo || "—"}</td><td style={{ ...TD, fontWeight: 600 }}>{fmtDD(g.fechaMovimiento)}</td><td style={TD}>{fmtM(g.mes)}</td><td style={TD}>{g.camp || "—"}</td><td style={{ ...TD, ...MN }}>${fmt(g.gasto)}</td><td style={{ ...TD, ...MN, color: "#0055ff" }}>{g.fee}%</td><td style={{ ...TD, ...MN, color: "#0055ff" }}>${fmt(g._f)}</td><td style={{ ...TD, ...MN, fontWeight: 700 }}>${fmt(g._t)}</td><td style={{ ...TD, ...MN, color: "#0d9f6e" }}>${fmt(g._p)}</td><td style={{ ...TD, ...MN, color: "#7c3aed" }}>{garVal > 0 ? "$" + fmt(garVal) : "—"}</td><td style={{ ...TD, ...MN, color: "#dc2640" }}>${fmt(g._pend)}</td><td style={{ ...TD, ...MN, fontWeight: 700, color: netCobrar > 0 ? "#dc2640" : "#0d9f6e" }} title={garVal > 0 ? "Pendiente menos garantía del cliente" : "Igual al pendiente (sin garantía)"}>${fmt(netCobrar)}</td><td style={TD}><Bdg type={g._st === "Pagado" ? "ok" : g._st === "Parcial" ? "warn" : "acc"}>{g._st}</Bdg></td><td style={TD}>{g.prepago ? "S" : "N"}</td>{!isCliente && <td style={{ ...TD, fontSize: 12, color: "#5f6577" }} title={g.created_by || ""}>{g.created_by ? (g.created_by.length > 20 ? g.created_by.slice(0, 18) + "…" : g.created_by) : "—"}</td>}<td style={TD}>{!isCliente && <div style={{ display: "flex", gap: 4 }}><IBtn onClick={() => openMdl("gasto", g.id)} icon={<Edit3 size={13} />} title="Editar" />{g._st !== "Pagado" && <IBtn onClick={() => openCobroForGastoId(g.id)} icon={<CreditCard size={13} />} title="Añadir cobro" style={{ color: "#0d9f6e" }} />}<IBtn onClick={() => openGarantiaForClientId(g.clientId)} icon={<Shield size={13} />} title="Añadir garantía" style={{ color: "#7c3aed" }} /><IBtn onClick={() => delGasto(g.id)} icon={<Trash2 size={13} />} danger title="Eliminar" /></div>}</td></tr>; })}{!gastosPaginated.length && <Empty cols={colsCount} msg={filterCliente.gastos ? "Sin gastos para este cliente" : expRango.gastos.ini || expRango.gastos.fin ? "Sin gastos en el rango de fechas" : "Sin gastos registrados"} />}</tbody></table></div>
                  {totalPages > 1 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "12px 16px", borderTop: "1px solid #e2e4e9", flexWrap: "wrap" }}>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                        <button key={n} type="button" onClick={() => setPageNum((p) => ({ ...p, gastos: n }))} style={{ minWidth: 32, height: 32, padding: "0 8px", border: "1px solid #e2e4e9", borderRadius: 8, background: n === currentPage ? "#1b2559" : "#fff", color: n === currentPage ? "#fff" : "#1b2559", fontWeight: n === currentPage ? 700 : 500, fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans'" }}>{n}</button>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </div></div>
        </div>)}

        {/* ══ COBROS (solo gerente; cliente no ve ni registra cobros) ══ */}
        {page === "cobros" && !isCliente && (<div>
          <div className="hm-page-header" style={{ background: "#fff", borderBottom: "1px solid #e2e4e9", padding: "0 36px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, position: "sticky", top: 0, zIndex: 50 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700 }}>Cobros</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ background: "#f0f4ff", color: "#1b2559", padding: "6px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: "'DM Sans'" }} title="Total de filas">
                {filterCliente.cobros ? `${cobrosFiltrados.length} de ${cobros.length} cobros` : `${cobros.length} cobros en total`}
              </div>
              <div style={{ minWidth: 200, display: "inline-block" }}><SearchSelect compact options={clientFilterOptions} value={filterCliente.cobros} onChange={(id) => setFilterCliente((p) => ({ ...p, cobros: id || "" }))} placeholder="Buscar cliente..." emptyMessage="Ningún cliente coincide" /></div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}><input type="date" value={expRango.cobros.ini} onChange={(e) => setExpRango((p) => ({ ...p, cobros: { ...p.cobros, ini: e.target.value } }))} style={{ padding: "6px 10px", border: "1px solid #e2e4e9", borderRadius: 8, fontSize: 12, fontFamily: "'DM Sans'", outline: "none" }} /><span style={{ color: "#9498a8", fontSize: 11 }}>a</span><input type="date" value={expRango.cobros.fin} onChange={(e) => setExpRango((p) => ({ ...p, cobros: { ...p.cobros, fin: e.target.value } }))} style={{ padding: "6px 10px", border: "1px solid #e2e4e9", borderRadius: 8, fontSize: 12, fontFamily: "'DM Sans'", outline: "none" }} /></div>
              <Btn variant="outline" size="sm" onClick={expCobros}><Download size={14} /> Descargar Excel</Btn>
              <Btn onClick={() => openMdl("cobro")}><Plus size={16} /> Registrar Cobro</Btn>
            </div>
          </div>
          <div className="hm-page-content" style={{ padding: "28px 36px" }}><div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 14, overflow: "hidden" }}>
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
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: "1px solid #e2e4e9" }}>
                      <Btn variant="outline" size="sm" onClick={delCobrosBulk} style={{ color: "#dc2640", borderColor: "#dc2640" }}><Trash2 size={14} /> Eliminar seleccionados ({selectedIds.cobros.length})</Btn>
                    </div>
                  )}
                  <div className="hm-table-wrap"><table><thead><tr><th style={{ ...TH, width: 42 }}><input type="checkbox" checked={allOnPageSelected} onChange={() => selectAllOnPage("cobros", idsOnPage)} title="Seleccionar página" style={{ cursor: "pointer", width: 16, height: 16 }} /></th>{["Cliente", "Cód. cobro", "Cód. gasto", "Fecha", "Hora", "Ref.", "Monto", "Método", "Registrado por", "Registrado", "Notas", "Comprob.", ""].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead>
                    <tbody>{cobrosPaginated.map((co) => {
                      const g = gastos.find((x) => x.id === co.gastoId);
                      const c = g ? clients.find((x) => x.id === g.clientId) : null;
                      const createdByStr = co.created_by ? (co.created_by.length > 20 ? co.created_by.slice(0, 18) + "…" : co.created_by) : "—";
                      const paths = co.comprobante_urls || [];
                      return (
                        <tr key={co.id}>
                          <td style={TD}><input type="checkbox" checked={sel.includes(co.id)} onChange={() => toggleSelect("cobros", co.id)} style={{ cursor: "pointer", width: 16, height: 16 }} /></td>
                          <td style={TD}>{c ? <div style={{ display: "flex", alignItems: "center", gap: 10 }}><Av name={c.name} size={30} avatarUrl={c.avatar_url} /><span style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</span></div> : "—"}</td>
                          <td style={{ ...TD, fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, fontWeight: 600, color: "#1b2559" }}>{co.codigo || "—"}</td>
                          <td style={{ ...TD, fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "#5f6577" }}>{g?.codigo || "—"}</td>
                          <td style={TD}>{fmtD(co.fecha)}</td>
                          <td style={TD}>{fmtT(co.hora)}</td>
                          <td style={TD}>{g ? fmtM(g.mes) + " " + (g.camp || "") : "—"}</td>
                          <td style={{ ...TD, ...MN, color: "#0d9f6e", fontWeight: 700 }}>+${fmt(co.monto)}</td>
                          <td style={TD}><PayB method={co.metodo} /></td>
                          <td style={{ ...TD, fontSize: 12, color: "#5f6577" }} title={co.created_by || ""}>{createdByStr}</td>
                          <td style={{ ...TD, fontSize: 11.5, color: "#9498a8" }} title={co.created_at ? fmtDt(co.created_at) : ""}>{co.created_at ? fmtDt(co.created_at) : "—"}</td>
                          <td style={{ ...TD, fontSize: 12.5, color: "#9498a8", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }}>{co.notas || "—"}</td>
                          <td style={TD}>{paths.length > 0 ? <button type="button" onClick={() => setComprobanteViewer({ type: "cobro", id: co.id, paths })} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px", border: "1px solid #e2e4e9", borderRadius: 6, background: "#f0f4ff", color: "#0055ff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}><Paperclip size={12} /> {paths.length}</button> : "—"}</td>
                          <td style={TD}><IBtn onClick={() => delCobro(co.id)} icon={<Trash2 size={13} />} danger /></td>
                        </tr>
                      );
                    })}{!cobrosPaginated.length && <Empty cols={14} msg={emptyCobrosMsg} />}</tbody></table></div>
                  {totalPages > 1 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "12px 16px", borderTop: "1px solid #e2e4e9", flexWrap: "wrap" }}>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                        <button key={n} type="button" onClick={() => setPageNum((p) => ({ ...p, cobros: n }))} style={{ minWidth: 32, height: 32, padding: "0 8px", border: "1px solid #e2e4e9", borderRadius: 8, background: n === currentPage ? "#1b2559" : "#fff", color: n === currentPage ? "#fff" : "#1b2559", fontWeight: n === currentPage ? 700 : 500, fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans'" }}>{n}</button>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </div></div>
        </div>)}

        {/* ══ GARANTÍAS ══ */}
        {page === "garantias" && (<div>
          <div className="hm-page-header" style={{ background: "#fff", borderBottom: "1px solid #e2e4e9", padding: "0 36px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, position: "sticky", top: 0, zIndex: 50 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700 }}>Garantías</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ background: "#f0f4ff", color: "#1b2559", padding: "6px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: "'DM Sans'" }} title="Total de filas">
                {filterCliente.garantias ? `${garantiasFiltradas.length} de ${garantias.length} garantías` : `${garantias.length} garantías en total`}
              </div>
              {!isCliente && <div style={{ minWidth: 200, display: "inline-block" }}><SearchSelect compact options={clientFilterOptions} value={filterCliente.garantias} onChange={(id) => setFilterCliente((p) => ({ ...p, garantias: id || "" }))} placeholder="Buscar cliente..." emptyMessage="Ningún cliente coincide" /></div>}
              <Btn variant="outline" size="sm" onClick={expGarantias}><Download size={14} /> Descargar Excel</Btn>
              {!isCliente && <Btn onClick={() => openMdl("garantia")}><Plus size={16} /> Nueva Garantía</Btn>}
            </div>
          </div>
          <div className="hm-page-content" style={{ padding: "28px 36px" }}><div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 14, overflow: "hidden" }}>
            {(() => {
              const totalPages = Math.ceil(garantiasFiltradas.length / PER_PAGE) || 1;
              const currentPage = Math.min(pageNum.garantias, totalPages);
              const garantiasPaginated = garantiasFiltradas.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);
              const idsOnPage = garantiasPaginated.map((g) => g.id);
              const sel = selectedIds.garantias;
              const allOnPageSelected = idsOnPage.length > 0 && idsOnPage.every((id) => sel.includes(id));
              const colsCount = 8 + (!isCliente ? 1 : 0);
              return (
                <>
                  {!isCliente && selectedIds.garantias.length > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: "1px solid #e2e4e9" }}>
                      <Btn variant="outline" size="sm" onClick={delGarantiasBulk} style={{ color: "#dc2640", borderColor: "#dc2640" }}><Trash2 size={14} /> Eliminar seleccionados ({selectedIds.garantias.length})</Btn>
                    </div>
                  )}
                  <div className="hm-table-wrap"><table><thead><tr>{!isCliente && <th style={{ ...TH, width: 42 }}><input type="checkbox" checked={allOnPageSelected} onChange={() => selectAllOnPage("garantias", idsOnPage)} title="Seleccionar página" style={{ cursor: "pointer", width: 16, height: 16 }} /></th>}{["Cliente", "Cód. verificación", "Cód. gasto", "Tipo", "Descripción", "Valor", "Estado", "Imágenes", ""].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead>
                    <tbody>{garantiasPaginated.map((g) => {
                      const c = clients.find((x) => x.id === g.clientId);
                      const gastoAsoc = g.gastoId ? gastos.find((x) => x.id === g.gastoId) : null;
                      const estadoBdg = g.estado === "Vigente" ? "ok" : g.estado === "Ejecutada" ? "err" : "n";
                      const paths = g.imagen_urls || [];
                      return (
                        <tr key={g.id}>
                          {!isCliente && <td style={TD}><input type="checkbox" checked={sel.includes(g.id)} onChange={() => toggleSelect("garantias", g.id)} style={{ cursor: "pointer", width: 16, height: 16 }} /></td>}
                          <td style={TD}>{c ? <div style={{ display: "flex", alignItems: "center", gap: 10 }}><Av name={c.name} size={30} avatarUrl={c.avatar_url} /><span style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</span></div> : "—"}</td>
                          <td style={{ ...TD, fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, fontWeight: 600, color: "#1b2559" }}>{g.codigoVerificacion || "—"}</td>
                          <td style={{ ...TD, fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "#5f6577" }}>{gastoAsoc?.codigo || "—"}</td>
                          <td style={TD}><Bdg type="gar">{g.tipo}</Bdg></td>
                          <td style={{ ...TD, color: "#5f6577", maxWidth: 200 }}>{g.desc || "—"}</td>
                          <td style={{ ...TD, ...MN }}>${fmt(g.valor)}</td>
                          <td style={TD}><Bdg type={estadoBdg}>{g.estado}</Bdg></td>
                          <td style={TD}>{paths.length > 0 ? <button type="button" onClick={() => setComprobanteViewer({ type: "garantia", id: g.id, paths })} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px", border: "1px solid #e2e4e9", borderRadius: 6, background: "#f0eefe", color: "#7c3aed", fontSize: 12, fontWeight: 600, cursor: "pointer" }}><Paperclip size={12} /> {paths.length}</button> : "—"}</td>
                          <td style={TD}>{!isCliente && <div style={{ display: "flex", gap: 4 }}><IBtn onClick={() => openMdl("garantia", g.id)} icon={<Edit3 size={13} />} title="Editar" /><IBtn onClick={() => delGar(g.id)} icon={<Trash2 size={13} />} danger /></div>}</td>
                        </tr>
                      );
                    })}{!garantiasPaginated.length && <Empty cols={colsCount + 1} msg={emptyGarantiasMsg} />}</tbody></table></div>
                  {totalPages > 1 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "12px 16px", borderTop: "1px solid #e2e4e9", flexWrap: "wrap" }}>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                        <button key={n} type="button" onClick={() => setPageNum((p) => ({ ...p, garantias: n }))} style={{ minWidth: 32, height: 32, padding: "0 8px", border: "1px solid #e2e4e9", borderRadius: 8, background: n === currentPage ? "#1b2559" : "#fff", color: n === currentPage ? "#fff" : "#1b2559", fontWeight: n === currentPage ? 700 : 500, fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans'" }}>{n}</button>
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
        <div className="hm-form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}><Inp label="Nombre *" value={cf.name} onChange={(e) => setCf({ ...cf, name: e.target.value })} placeholder="Juan Pérez" /><Inp label="Instagram" value={cf.ig} onChange={(e) => setCf({ ...cf, ig: e.target.value })} placeholder="@usuario" /></div>
        <div style={{ marginBottom: 14 }}><label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#5f6577", marginBottom: 5 }}>Teléfonos / WhatsApp</label><MultiPhone values={cf.phones} onChange={(v) => setCf({ ...cf, phones: v })} /></div>
        <div style={{ marginBottom: 14 }}><label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#5f6577", marginBottom: 5 }}>Emails</label><Multi values={cf.emails} onChange={(v) => setCf({ ...cf, emails: v })} placeholder="email@ejemplo.com" type="email" /></div>
        <Inp label="Negocio" value={cf.biz} onChange={(e) => setCf({ ...cf, biz: e.target.value })} placeholder="E-commerce..." />
        <Inp label="Notas" type="textarea" value={cf.notes} onChange={(e) => setCf({ ...cf, notes: e.target.value })} placeholder="Info adicional..." />
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#5f6577", marginBottom: 5 }}>Foto de perfil</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <div style={{ flex: "1 1 200px", minWidth: 0 }}><Inp value={cf.avatar_url} onChange={(e) => setCf({ ...cf, avatar_url: e.target.value })} placeholder="URL (opcional)" /></div>
            {editId && (
              <>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "#f4f5f7", border: "1px solid #e2e4e9", borderRadius: 8, fontSize: 12.5, fontWeight: 600, color: "#1b2559", cursor: "pointer", whiteSpace: "nowrap" }}>
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: "none" }} onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { setUploadingAvatar(true); const url = await uploadAvatar(editId, f); setCf((p) => ({ ...p, avatar_url: url })); } catch (err) { alert(err?.message || "Error al subir"); } finally { setUploadingAvatar(false); e.target.value = ""; }} } />
                  {uploadingAvatar ? "Subiendo…" : "Cambiar foto"}
                </label>
                {cf.avatar_url && <button type="button" onClick={() => setCf((p) => ({ ...p, avatar_url: "" }))} style={{ padding: "8px 14px", border: "1px solid #e2e4e9", borderRadius: 8, fontSize: 12.5, fontWeight: 600, color: "#dc2640", background: "#fff", cursor: "pointer", whiteSpace: "nowrap" }}>Eliminar foto</button>}
              </>
            )}
          </div>
        </div>
        </Mdl>

      <Mdl open={modal === "gasto"} onClose={closeMdl} title={editId ? "Editar Gasto" : "Nuevo Gasto Mensual"} footer={<><Btn variant="outline" onClick={closeMdl}>Cancelar</Btn><Btn onClick={saveGasto}>Guardar</Btn></>}>
        <SearchSelect label="Cliente *" options={clientsSorted.map((c) => ({ value: c.id, label: c.name }))} value={gf.clientId} onChange={(id) => setGf({ ...gf, clientId: id })} placeholder="Escribí el nombre del cliente..." emptyMessage="Ningún cliente coincide" />
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#5f6577", marginBottom: 5 }}>Período *</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input type="text" placeholder="MM/AAAA o 2025-01" value={gf.periodoInput ?? gf.mes ?? ""} onChange={(e) => setGf({ ...gf, periodoInput: e.target.value })} onBlur={(e) => { const parsed = parsePeriodoInput(e.target.value); if (parsed) setGf((p) => ({ ...p, mes: parsed, fechaMovimiento: parsed + "-15", periodoInput: parsed })); }} style={{ width: 140, boxSizing: "border-box", padding: "9px 13px", background: "#fff", border: "1px solid #e2e4e9", borderRadius: 8, fontFamily: "'DM Sans',sans-serif", fontSize: 13.5, outline: "none" }} />
            <button type="button" onClick={() => { const y = new Date().getFullYear(), m = String(new Date().getMonth() + 1).padStart(2, "0"); const key = `${y}-${m}`; setGf((p) => ({ ...p, mes: key, fechaMovimiento: key + "-15", periodoInput: key })); }} style={{ padding: "8px 12px", border: "1px solid #e2e4e9", borderRadius: 8, background: "#f0f4ff", color: "#0055ff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans'" }}>Este mes</button>
            <button type="button" onClick={() => { const d = new Date(); d.setMonth(d.getMonth() - 1); const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"); const key = `${y}-${m}`; setGf((p) => ({ ...p, mes: key, fechaMovimiento: key + "-15", periodoInput: key })); }} style={{ padding: "8px 12px", border: "1px solid #e2e4e9", borderRadius: 8, background: "#f4f5f7", color: "#5f6577", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans'" }}>Mes pasado</button>
            <span style={{ fontSize: 12, color: "#9498a8" }}>o</span>
            <input id="gf-periodo-date" type="date" value={gf.fechaMovimiento || (gf.mes ? gf.mes + "-15" : td())} onChange={(e) => { const v = e.target.value; if (v) setGf({ ...gf, fechaMovimiento: v, mes: v.slice(0, 7), periodoInput: v.slice(0, 7) }); }} style={{ width: 150, boxSizing: "border-box", padding: "9px 13px", background: "#fff", border: "1px solid #e2e4e9", borderRadius: 8, fontFamily: "'DM Sans',sans-serif", fontSize: 13.5, outline: "none" }} title="Calendario" />
          </div>
          <div style={{ fontSize: 11, color: "#9498a8", marginTop: 4 }}>Escribí mes/año (ej. 01/2025) o usá los botones / calendario</div>
        </div>
        <Inp label="Campaña / referencia" value={gf.camp} onChange={(e) => setGf({ ...gf, camp: e.target.value })} placeholder="Ej. Campaña Feb 2025" />
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}><input type="checkbox" id="gf-prepago" checked={!!gf.prepago} onChange={(e) => setGf({ ...gf, prepago: e.target.checked })} style={{ width: 18, height: 18, accentColor: "#1b2559" }} /><label htmlFor="gf-prepago" style={{ fontSize: 13, fontWeight: 600, color: "#5f6577", cursor: "pointer" }}>Prepago (recarga) — marca este gasto como prepago (S/N en la tabla)</label></div>
        <Inp label="Gasto en Ads ($) *" type="number" step="0.01" min="0" value={gf.gasto} onChange={(e) => setGf({ ...gf, gasto: e.target.value })} placeholder="0.00" hint="Inversión en TikTok Ads (u otra red)" />
        <Inp label="Fee / Comisión (%)" type="number" step="0.1" min="0" max="100" value={gf.fee} onChange={(e) => setGf({ ...gf, fee: e.target.value })} hint="Porcentaje sobre el gasto" />
        <div style={{ background: "#eef0f8", padding: "12px 14px", borderRadius: 10, fontFamily: "'IBM Plex Mono'", fontSize: 13, fontWeight: 600, textAlign: "center", marginBottom: 16, color: "#1b2559" }}>Fee: ${fmt(parseFloat(gf.gasto || 0) * (parseFloat(gf.fee || 0) / 100))} → Total a cobrar: ${fmt(parseFloat(gf.gasto || 0) * (1 + parseFloat(gf.fee || 0) / 100))}</div>
        <Inp label="Notas" type="textarea" value={gf.notas} onChange={(e) => setGf({ ...gf, notas: e.target.value })} placeholder="Detalles del gasto o campaña..." />
        {editId && gf.prepago && !isCliente && (() => {
          const g = sGastos.find((x) => x.id === editId);
          if (!g || g._st === "Pagado") return null;
          const clienteNombre = clients.find((c) => c.id === g.clientId)?.name || "este gasto";
          return (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #eff0f3" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#5f6577", marginBottom: 8 }}>Cobro para este gasto (prepago)</div>
              <button type="button" onClick={() => openCobroForGastoId(editId)} style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "12px 18px", border: "1px dashed #0d9f6e", borderRadius: 10, background: "#e6f7f0", color: "#0d9f6e", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", width: "100%", justifyContent: "center", transition: "background .15s, color .15s" }} onMouseOver={(e) => { e.currentTarget.style.background = "#cceee2"; e.currentTarget.style.color = "#0a7d5a"; }} onMouseOut={(e) => { e.currentTarget.style.background = "#e6f7f0"; e.currentTarget.style.color = "#0d9f6e"; }}>
                <CreditCard size={20} /> Añadir cobro — {clienteNombre} · {g.codigo || fmtM(g.mes)} (pendiente ${fmt(g._pend)})
              </button>
              <div style={{ fontSize: 11, color: "#9498a8", marginTop: 6 }}>Se abre el formulario de cobro con este gasto y el monto pendiente ya cargados.</div>
            </div>
          );
        })()}
        {gf.clientId && !isCliente && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #eff0f3" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#5f6577", marginBottom: 8 }}>Garantía para este cliente</div>
            <button type="button" onClick={() => openGarantiaForClientId(gf.clientId)} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", border: "1px dashed #7c3aed", borderRadius: 10, background: "#f0eefe", color: "#7c3aed", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", width: "100%", justifyContent: "center" }}>
              <Shield size={18} /> Añadir garantía para {clients.find((c) => c.id === gf.clientId)?.name || "este cliente"}
            </button>
            <div style={{ fontSize: 11, color: "#9498a8", marginTop: 6 }}>Las garantías se descuentan de la deuda al calcular el pendiente neto.</div>
          </div>
        )}
      </Mdl>

      <Mdl open={modal === "cobro"} onClose={closeMdl} title="Registrar Cobro" footer={<><Btn variant="outline" onClick={closeMdl} disabled={uploadingComprobantes}>Cancelar</Btn><Btn variant="accent" onClick={saveCobro} disabled={uploadingComprobantes}>{uploadingComprobantes ? "Subiendo…" : "Registrar"}</Btn></>}>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#5f6577", marginBottom: 5 }}>Gastos *</label>
          <p style={{ fontSize: 11, color: "#9498a8", marginBottom: 6 }}>Elegí uno o varios gastos; el monto total se reparte según el pendiente de cada uno.</p>
          <SearchSelect options={sGastos.filter((g) => g._st !== "Pagado" && !(cof.gastoIds || []).includes(g.id)).map((g) => { const c = clients.find((x) => x.id === g.clientId); return { value: g.id, label: `${c?.name || "?"} — ${fmtM(g.mes)} ($${fmt(g._pend)}) ${g.prepago ? "· Prepago" : ""}` }; })} value="" onChange={(id) => { if (id && !(cof.gastoIds || []).includes(id)) { const list = [...(cof.gastoIds || []), id]; const sum = list.reduce((a, gid) => { const g = sGastos.find((x) => x.id === gid); return a + (g ? g._pend : 0); }, 0); setCof({ ...cof, gastoIds: list, monto: cof.monto || sum.toFixed(2) }); } }} placeholder="Buscar y agregar gasto..." emptyMessage="No hay más gastos pendientes o ya están agregados" />
          {(cof.gastoIds || []).length > 0 && (
            <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
              {(cof.gastoIds || []).map((gid) => { const g = sGastos.find((x) => x.id === gid); const c = g ? clients.find((x) => x.id === g.clientId) : null; return g ? <span key={gid} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", background: "#e6f7f0", color: "#0d9f6e", borderRadius: 8, fontSize: 12, fontWeight: 600 }}>{c?.name || "?"} — {fmtM(g.mes)} (${fmt(g._pend)})<button type="button" onClick={() => { const list = (cof.gastoIds || []).filter((id) => id !== gid); const sum = list.reduce((a, id) => { const x = sGastos.find((g) => g.id === id); return a + (x ? x._pend : 0); }, 0); setCof({ ...cof, gastoIds: list, monto: list.length === 1 ? (sGastos.find((x) => x.id === list[0])?._pend.toFixed(2) ?? "") : (list.length ? sum.toFixed(2) : cof.monto) }); }} style={{ padding: "0 4px", border: "none", background: "transparent", color: "#0d9f6e", cursor: "pointer", fontSize: 14, lineHeight: 1 }} aria-label="Quitar">×</button></span> : null; })}
            </div>
          )}
        </div>
        <div className="hm-form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}><div><Inp label="Monto total ($) *" type="number" step="0.01" min="0" value={cof.monto} onChange={(e) => setCof({ ...cof, monto: e.target.value })} placeholder="0.00" />{(cof.gastoIds || []).length > 1 && <div style={{ fontSize: 11, color: "#9498a8", marginTop: -6, marginBottom: 6 }}>Pendiente sumado: ${fmt((cof.gastoIds || []).reduce((a, gid) => { const g = sGastos.find((x) => x.id === gid); return a + (g ? g._pend : 0); }, 0))}</div>}</div><Inp label="Fecha" type="date" value={cof.fecha} onChange={(e) => setCof({ ...cof, fecha: e.target.value })} /></div>
        <Inp label="Hora (opcional)" type="time" value={cof.hora} onChange={(e) => setCof({ ...cof, hora: e.target.value })} />
        <Inp label="Método de Pago *" type="select" value={cof.metodo} onChange={(e) => setCof({ ...cof, metodo: e.target.value })}><option value="">Seleccionar...</option>{PM.map((m) => <option key={m} value={m}>{PI[m]} {m}</option>)}</Inp>
        <Inp label="Notas" type="textarea" value={cof.notas} onChange={(e) => setCof({ ...cof, notas: e.target.value })} placeholder="Nro. operación..." />
        <div style={{ marginTop: 8 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#1b2559", marginBottom: 6 }}>Comprobantes de pago (opcional)</label>
          <p style={{ fontSize: 12, color: "#5f6577", marginBottom: 8 }}>Podés subir fotos de comprobantes de pago (imagen o PDF, máx. 10 MB cada uno).</p>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", border: "1px dashed #0055ff", borderRadius: 10, background: "#f0f4ff", color: "#0055ff", fontSize: 13, fontWeight: 600, cursor: uploadingComprobantes ? "wait" : "pointer" }}>
            <Paperclip size={16} />
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" multiple style={{ display: "none" }} onChange={(e) => { const files = Array.from(e.target.files || []); setCobroComprobanteFiles((p) => [...p, ...files]); e.target.value = ""; }} disabled={uploadingComprobantes} />
            Añadir archivos
          </label>
          {cobroComprobanteFiles.length > 0 && (
            <ul style={{ marginTop: 10, paddingLeft: 18, fontSize: 12, color: "#1b2559" }}>
              {cobroComprobanteFiles.map((f, i) => (
                <li key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  {f.name} ({(f.size / 1024).toFixed(1)} KB)
                  <button type="button" onClick={() => setCobroComprobanteFiles((p) => p.filter((_, j) => j !== i))} style={{ padding: "2px 6px", border: "none", background: "#fee2e2", color: "#dc2640", borderRadius: 4, fontSize: 11, cursor: "pointer" }}>Quitar</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Mdl>

      <Mdl open={modal === "dar-acceso"} onClose={closeMdl} title="Dar acceso al panel" footer={!accesoResultado ? <><Btn variant="outline" onClick={closeMdl}>Cancelar</Btn><Btn onClick={() => submitDarAcceso(false)} disabled={savingAcceso}>{savingAcceso ? "Enviando…" : "Enviar link por email"}</Btn></> : <><Btn variant="outline" onClick={() => { setAccesoResultado(null); }} style={{ display: accesoResultado?.link ? "inline-flex" : "none" }}>Enviar otro</Btn><Btn onClick={closeMdl}>Cerrar</Btn></>}>
        {editId && (() => {
          const ac = clients.find((c) => c.id === editId);
          const firstEmail = (ac?.emails || []).filter(Boolean)[0];
          if (!ac) return null;
          if (accesoResultado) {
            return (
              <div style={{ padding: "16px 0" }}>
                <p style={{ fontSize: 13, color: "#0d9f6e", fontWeight: 600, marginBottom: 12 }}>{accesoResultado.message}</p>
                <div style={{ background: "#f4f5f7", borderRadius: 10, padding: 16, fontSize: 14 }}>
                  <div style={{ marginBottom: 8 }}><span style={{ color: "#5f6577", fontSize: 12 }}>Correo:</span> <strong style={{ color: "#1a1d26" }}>{accesoResultado.email}</strong></div>
                  {accesoResultado.link && (
                    <div style={{ marginTop: 12 }}>
                      <span style={{ fontSize: 12, color: "#5f6577", display: "block", marginBottom: 6 }}>Si no llegó el email, copia este link y compártelo con el cliente:</span>
                      <input type="text" readOnly value={accesoResultado.link} onClick={(e) => e.target.select()} style={{ width: "100%", padding: "8px 10px", fontSize: 12, border: "1px solid #e2e4e9", borderRadius: 8, fontFamily: "monospace", background: "#fff" }} />
                    </div>
                  )}
                </div>
                {accesoResultado.alreadyHadAccess && !accesoResultado.link && (
                  <p style={{ fontSize: 11, color: "#9498a8", marginTop: 10 }}>Para reenviar el correo con un nuevo link: <button type="button" onClick={() => submitDarAcceso(true)} disabled={savingAcceso} style={{ background: "none", border: "none", color: "#0055ff", fontWeight: 600, cursor: "pointer", padding: 0, fontFamily: "inherit", fontSize: "inherit", textDecoration: "underline" }}>Reenviar link</button></p>
                )}
              </div>
            );
          }
          return (
            <>
              <p style={{ marginBottom: 14, fontSize: 13, color: "#5f6577" }}>Se enviará un <strong>correo</strong> al cliente con un link. Al abrirlo entrará directo al panel (sin contraseña).</p>
              <div style={{ background: "#eef0f8", borderRadius: 10, padding: 12, marginBottom: 14 }}>
                <span style={{ fontSize: 12, color: "#5f6577" }}>Correo al que se enviará: </span>
                <strong style={{ color: "#1b2559" }}>{firstEmail || "—"}</strong>
              </div>
              {(!firstEmail || !String(firstEmail).includes("@")) && <p style={{ fontSize: 12, color: "#dc2640", marginBottom: 8 }}>Este cliente no tiene correo. Agrega uno en Editar cliente.</p>}
            </>
          );
        })()}
      </Mdl>

      <Mdl open={modal === "garantia"} onClose={closeMdl} title={editId ? "Editar Garantía" : "Nueva Garantía"} footer={<><Btn variant="outline" onClick={closeMdl} disabled={uploadingComprobantes}>Cancelar</Btn><Btn onClick={saveGar} disabled={uploadingComprobantes}>{uploadingComprobantes ? "Subiendo…" : "Guardar"}</Btn></>}>
        <SearchSelect label="Cliente *" options={clientsSorted.map((c) => ({ value: c.id, label: c.name }))} value={gaf.clientId} onChange={(id) => setGaf({ ...gaf, clientId: id, gastoId: "" })} placeholder="Escribí el nombre del cliente..." emptyMessage="Ningún cliente coincide" />
        <Inp label="Gasto asociado (opcional)" type="select" value={gaf.gastoId || ""} onChange={(e) => setGaf({ ...gaf, gastoId: e.target.value === "" ? "" : e.target.value })}><option value="">Ninguno</option>{gaf.clientId && sGastos.filter((g) => g.clientId === gaf.clientId).map((g) => <option key={g.id} value={g.id}>{g.codigo || "—"} — {fmtM(g.mes)} {g.camp ? "· " + g.camp : ""}</option>)}</Inp>
        <div className="hm-form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Inp label="Tipo" type="select" value={gaf.tipo} onChange={(e) => setGaf({ ...gaf, tipo: e.target.value })}>{GT.map((t) => <option key={t}>{t}</option>)}</Inp>
          <Inp label="Valor ($)" type="number" step="0.01" min="0" value={gaf.valor} onChange={(e) => setGaf({ ...gaf, valor: e.target.value })} placeholder="0.00" />
        </div>
        <Inp label="Descripción" type="textarea" value={gaf.desc} onChange={(e) => setGaf({ ...gaf, desc: e.target.value })} placeholder="Detalle..." />
        <Inp label="Estado" type="select" value={gaf.estado} onChange={(e) => setGaf({ ...gaf, estado: e.target.value })}><option>Vigente</option><option>Devuelta</option><option>Ejecutada</option></Inp>
        <div style={{ background: "#eef0f8", borderRadius: 10, padding: "12px 14px", marginBottom: 14, fontSize: 12, color: "#1b2559", border: "1px solid #c7d2fe" }}>
          <strong>Se verá reflejada en:</strong> Reportes (columna Garantía y Pend. neto) y en Gastos (columna A cobrar). Al guardar, te llevamos a Reportes para que lo veas al instante.
        </div>
        <div style={{ marginTop: 8 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#1b2559", marginBottom: 6 }}>Imágenes correspondientes (opcional)</label>
          <p style={{ fontSize: 12, color: "#5f6577", marginBottom: 8 }}>Podés subir las imágenes o comprobantes asociados a la garantía (imagen o PDF, máx. 10 MB cada uno).</p>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", border: "1px dashed #7c3aed", borderRadius: 10, background: "#f0eefe", color: "#7c3aed", fontSize: 13, fontWeight: 600, cursor: uploadingComprobantes ? "wait" : "pointer" }}>
            <Paperclip size={16} />
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" multiple style={{ display: "none" }} onChange={(e) => { const files = Array.from(e.target.files || []); setGarantiaImagenNewFiles((p) => [...p, ...files]); e.target.value = ""; }} disabled={uploadingComprobantes} />
            Añadir archivos
          </label>
          {garantiaImagenNewFiles.length > 0 && (
            <ul style={{ marginTop: 10, paddingLeft: 18, fontSize: 12, color: "#1b2559" }}>
              {garantiaImagenNewFiles.map((f, i) => (
                <li key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  {f.name} ({(f.size / 1024).toFixed(1)} KB)
                  <button type="button" onClick={() => setGarantiaImagenNewFiles((p) => p.filter((_, j) => j !== i))} style={{ padding: "2px 6px", border: "none", background: "#fee2e2", color: "#dc2640", borderRadius: 4, fontSize: 11, cursor: "pointer" }}>Quitar</button>
                </li>
              ))}
            </ul>
          )}
          {editId && (() => { const gar = garantias.find((g) => g.id === editId); const paths = gar?.imagen_urls || []; return paths.length > 0 ? <p style={{ marginTop: 8, fontSize: 12, color: "#5f6577" }}>Ya hay {paths.length} archivo(s) subidos para esta garantía. Los nuevos se añadirán.</p> : null; })()}
        </div>
      </Mdl>

      <Mdl open={!!comprobanteViewer} onClose={() => setComprobanteViewer(null)} title={comprobanteViewer?.type === "garantia" ? "Imágenes de la garantía" : "Comprobantes de pago"}>
        <div style={{ padding: "8px 0" }}>
          {comprobanteViewer?.paths?.length ? (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {comprobanteViewer.paths.map((path, i) => {
                const url = viewerSignedUrls[i];
                const name = path.split("/").pop() || `Archivo ${i + 1}`;
                return (
                  <li key={path} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < comprobanteViewer.paths.length - 1 ? "1px solid #e2e4e9" : "none" }}>
                    <Paperclip size={16} style={{ color: "#5f6577", flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: "#1b2559", flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
                    {url ? <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "6px 12px", background: "#0055ff", color: "#fff", borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: "none" }}><Eye size={12} /> Ver</a> : <span style={{ fontSize: 12, color: "#9498a8" }}>Cargando…</span>}
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

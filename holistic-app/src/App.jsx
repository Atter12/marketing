import { useState, useEffect, useMemo, useCallback } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Shield, DollarSign, Users, CreditCard, Plus, ChevronLeft, Trash2, Edit3, Search, TrendingUp, BarChart3, Eye, X, Check, AlertCircle, FileText, Home, ArrowUpRight, ArrowDownRight, Calendar, Hash, Percent, Menu, LogOut, HardDrive, ExternalLink, Camera } from "lucide-react";
import ClientDetailView from "./ClientDetailView";
import { useSupabaseData } from "./useSupabaseData";
import { supabase, uploadAvatar, uploadGerenteAvatar, getGerenteProfile, updateGerenteAvatar } from "./supabase";

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
const fmtT = (t) => { if (!t) return "—"; const s = String(t).slice(0, 5); return s.length >= 5 ? s : t; };
const fmtDt = (iso) => { if (!iso) return "—"; const d = new Date(iso); return d.toLocaleString("es-PE", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); };
const COLORS = ["#0055ff", "#0d9f6e", "#d97706", "#dc2640", "#7c3aed", "#e1306c", "#0891b2", "#c2410c"];
const PC = { "Mercury Bank": "#5542f6", BCP: "#ff6200", Interbank: "#00a651", Binance: "#f0b90b", Efectivo: "#94a3b8", Stripe: "#635bff", Yape: "#6c2cb2", Plin: "#00d4aa" };
const PI = { "Mercury Bank": "🏦", BCP: "🟠", Interbank: "🟢", Binance: "💛", Efectivo: "💵", Stripe: "💳", Yape: "💜", Plin: "💚" };
const PM = ["Mercury Bank", "BCP", "Interbank", "Binance", "Efectivo", "Stripe", "Yape", "Plin"];
const GT = ["Cuenta TikTok", "Business Center", "Dispositivo", "Documento ID", "Contrato Firmado", "Depósito", "Otro"];
const clr = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h); return COLORS[Math.abs(h) % COLORS.length]; };
const ini = (n) => n.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
const gTotal = (g) => parseFloat(g.gasto || 0) * (1 + parseFloat(g.fee || 0) / 100);
const gFee = (g) => parseFloat(g.gasto || 0) * (parseFloat(g.fee || 0) / 100);

function getMonths(n = 6) {
  const r = [], now = new Date();
  for (let i = n - 1; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); r.push({ key: d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"), label: d.toLocaleDateString("es-PE", { month: "short", year: "2-digit" }) }); }
  return r;
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

const Bdg = ({ type = "n", children }) => {
  const m = { ok: ["#eafaf4", "#0d9f6e"], err: ["#fdf0f2", "#dc2640"], warn: ["#fef9ec", "#d97706"], acc: ["#edf2ff", "#0055ff"], n: ["#f4f5f7", "#5f6577"], gar: ["#f0eefe", "#7c3aed"] };
  const [bg, fg] = m[type] || m.n;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 6, fontSize: 11.5, fontWeight: 600, background: bg, color: fg, whiteSpace: "nowrap" }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: fg, flexShrink: 0 }} />{children}</span>;
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
  const { clients, gastos, cobros, garantias, manual, loading: dataLoading, error: dataError, mutations, uid: uidGen } = sb;
  const isCliente = role === "cliente";
  const [gerenteNombre, setGerenteNombre] = useState(() => { try { if (typeof window === "undefined") return ""; const v = localStorage.getItem("hm_gerente_nombre"); if (v == null) return ""; const p = JSON.parse(v); return typeof p === "string" ? p : ""; } catch { return ""; } });
  const [gerenteAvatarUrl, setGerenteAvatarUrl] = useState("");
  const [uploadingGerenteAvatar, setUploadingGerenteAvatar] = useState(false);
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const emptyCf = { name: "", ig: "", phones: [""], emails: [""], biz: "", notes: "", avatar_url: "" };
  const emptyGf = { codigo: "", clientId: clientId || "", mes: tm(), camp: "", gasto: "", fee: "10", notas: "", prepago: false };
  const emptyCof = { gastoId: "", monto: "", fecha: td(), hora: "", metodo: "", notas: "" };
  const emptyGaf = { clientId: clientId || "", tipo: "Cuenta TikTok", desc: "", valor: "", estado: "Vigente", codigoVerificacion: "" };
  const emptyMf = { fecha: td(), conc: "", monto: "", tipo: "Gasto", nota: "" };

  const [cf, setCf] = useState(emptyCf);
  const [gf, setGf] = useState(emptyGf);
  const [cof, setCof] = useState(emptyCof);
  const [gaf, setGaf] = useState(emptyGaf);
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
    if (repPer) gs = gs.filter((g) => g.mes === repPer);
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
  }, [sGastos, repCl, repPer, clients, garantias]);

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

  /* ═══ MODALS ═══ */
  const openMdl = (type, eid = null) => { setEditId(eid); setModal(type); };
  const closeMdl = () => { setModal(null); setEditId(null); setCf(emptyCf); setGf({ ...emptyGf, clientId: curCl || "" }); setCof(emptyCof); setGaf({ ...emptyGaf, clientId: curCl || "" }); };
  const openGarantiaForClientId = (cid) => { setGaf({ ...emptyGaf, clientId: cid || "" }); setModal("garantia"); setEditId(null); };

  useEffect(() => {
    if (!modal) return;
    if (modal === "client" && editId) { const c = clients.find((x) => x.id === editId); if (c) setCf({ name: c.name, ig: c.ig || "", phones: c.phones?.length ? c.phones : [""], emails: c.emails?.length ? c.emails : [""], biz: c.biz || "", notes: c.notes || "", avatar_url: c.avatar_url || "" }); }
    if (modal === "gasto" && editId) { const g = gastos.find((x) => x.id === editId); if (g) setGf({ codigo: g.codigo || "", clientId: g.clientId, mes: g.mes, camp: g.camp || "", gasto: String(g.gasto), fee: String(g.fee), notas: g.notas || "", prepago: !!g.prepago }); }
    if (modal === "gasto" && !editId && curCl) setGf((p) => ({ ...p, clientId: curCl }));
    if (modal === "garantia") setGaf((p) => ({ ...p, clientId: curCl || p.clientId }));
  }, [modal, editId]);

  useEffect(() => { if (isCliente && page === "cobros") setPage("dashboard"); }, [isCliente, page]);

  /* Early returns only after all hooks have run */
  if (dataLoading) return (<div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f4f5f7", fontFamily: "'DM Sans',sans-serif" }}><div style={{ color: "#5f6577", fontSize: 14 }}>Cargando datos…</div></div>);
  if (dataError) return (<div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f4f5f7", fontFamily: "'DM Sans',sans-serif", padding: 20 }}><div style={{ color: "#dc2640", fontSize: 14 }}>Error: {dataError}</div></div>);

  /* ═══ CRUD (Supabase mutations) ═══ */
  const saveClient = async () => { if (!cf.name.trim()) return alert("Nombre obligatorio"); const c = { id: editId || undefined, name: cf.name.trim(), ig: cf.ig || "", phones: cf.phones.filter(Boolean), emails: cf.emails.filter(Boolean), biz: cf.biz || "", notes: cf.notes || "", avatar_url: cf.avatar_url || "" }; await mutations.saveClient(c); closeMdl(); };
  const delClient = async (id) => { if (!confirm("¿Eliminar cliente y todos sus datos?")) return; await mutations.delClient(id); closeMdl(); };

  const saveGasto = async () => { if (!gf.clientId || !gf.mes || !parseFloat(gf.gasto)) return alert("Completa cliente, fecha de movimiento y gasto"); const g = { id: editId || undefined, codigo: gf.codigo || "", clientId: gf.clientId, mes: gf.mes, camp: gf.camp || "", gasto: gf.gasto, fee: gf.fee || "10", notas: gf.notas || "", prepago: !!gf.prepago }; await mutations.saveGasto(g); closeMdl(); };
  const delGasto = async (id) => { if (!confirm("¿Eliminar gasto?")) return; await mutations.delGasto(id); };

  const saveCobro = async () => { if (!cof.gastoId || !parseFloat(cof.monto) || !cof.metodo) return alert("Completa todos los campos"); await mutations.saveCobro({ ...cof, hora: cof.hora || null }); closeMdl(); };
  const delCobro = async (id) => { if (!confirm("¿Eliminar?")) return; await mutations.delCobro(id); };

  const saveGar = async () => { if (!gaf.clientId) return alert("Selecciona cliente"); await mutations.saveGarantia({ id: undefined, clientId: gaf.clientId, tipo: gaf.tipo, desc: gaf.desc, valor: gaf.valor, estado: gaf.estado, codigoVerificacion: gaf.codigoVerificacion || "" }); closeMdl(); };
  const delGar = async (id) => { if (!confirm("¿Eliminar?")) return; await mutations.delGarantia(id); };

  const saveMan = async () => { if (!mf.conc.trim()) return alert("Concepto obligatorio"); await mutations.saveManual({ clientId: curCl, fecha: mf.fecha, conc: mf.conc, monto: mf.monto, tipo: mf.tipo, nota: mf.nota }); setMf(emptyMf); };

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
        { id: "dashboard", icon: <BarChart3 size={18} />, label: "Dashboard" },
        { id: "clientes", icon: <Users size={18} />, label: "Clientes" },
        { id: "gastos", icon: <DollarSign size={18} />, label: "Gastos Ads", badge: pendN },
        { id: "cobros", icon: <CreditCard size={18} />, label: "Cobros" },
        { id: "reportes", icon: <FileText size={18} />, label: "Reportes", section: "Finanzas" },
        { id: "garantias", icon: <Shield size={18} />, label: "Garantías" },
        { id: "backup", icon: <HardDrive size={18} />, label: "Copia de seguridad", external: "https://www.marketingconholistic.com/backup-dashboard", section: "Sistema" },
      ];

  const pct = curD && (curD.tG + curD.tF) > 0 ? (curD.tP / (curD.tG + curD.tF)) * 100 : 0;

  const pageTitles = { dashboard: isCliente ? "Resumen" : "Dashboard", clientes: "Clientes", gastos: "Gastos Ads", cobros: "Cobros", reportes: "Reportes", garantias: "Garantías", "client-detail": curC?.name || "Cliente" };

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
          <div className="hm-page-header" style={{ background: "#fff", borderBottom: "1px solid #e2e4e9", padding: "0 36px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700 }}>Dashboard</h2>
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
              <div><h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.3 }}>Relación de Cuentas</h2><p style={{ fontSize: 13, opacity: 0.6, marginTop: 2 }}>Dashboard Financiero — Holistic Marketing</p></div>
            </div>
          </div>
          <div className="hm-page-header" style={{ background: "#fff", borderBottom: "1px solid #e2e4e9", padding: "16px 36px", display: "flex", gap: 24, alignItems: "flex-end", flexWrap: "wrap" }}>
            {!isCliente && <div><label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#9498a8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>Usuario</label><select value={repCl} onChange={(e) => setRepCl(e.target.value)} style={{ padding: "8px 14px", border: "1px solid #e2e4e9", borderRadius: 8, fontSize: 13.5, fontFamily: "'DM Sans'", minWidth: 180, outline: "none", cursor: "pointer" }}><option value="all">Todos</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>}
            <div><label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#9498a8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>Período</label><select value={repPer} onChange={(e) => setRepPer(e.target.value)} style={{ padding: "8px 14px", border: "1px solid #e2e4e9", borderRadius: 8, fontSize: 13.5, fontFamily: "'DM Sans'", minWidth: 160, outline: "none", cursor: "pointer" }}><option value="">Todos</option>{allMonths.map((m) => <option key={m} value={m}>{fmtM(m)}</option>)}</select></div>
          </div>
          <div className="hm-page-content" style={{ padding: "28px 36px 40px" }}>
            <div className="hm-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 28 }}>
              <Stat icon={<DollarSign size={20} />} value={`$${fmt(repData.t.ads)}`} label="Total Ads USD" color="#1b2559" />
              <Stat icon={<Percent size={20} />} value={`$${fmt(repData.t.fee)}`} label="Total Fee" color="#0055ff" />
              <Stat icon={<Check size={20} />} value={`$${fmt(repData.t.paid)}`} label="Cobrado" color="#0d9f6e" />
              <Stat icon={<AlertCircle size={20} />} value={`$${fmt(repData.t.netPending)}`} label="Pendiente Neto" color="#dc2640" sub={repData.t.gar > 0 ? `Garantías: -$${fmt(repData.t.gar)}` : ""} />
            </div>
            <div className="hm-report-grid" style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 16 }}>
              <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 14, overflow: "hidden" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid #eff0f3" }}><h3 style={{ fontSize: 15, fontWeight: 700 }}>Desglose por Usuario</h3></div>
                <div className="hm-table-wrap"><table><thead><tr>{["Usuario", "ADS", "FEE", "TOTAL", "PAGADO", "GARANTÍA", "PEND. NETO"].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead>
                  <tbody>
                    {repData.rows.map((r) => <tr key={r.cid} onClick={() => goTo("client-detail", r.cid)} style={{ cursor: "pointer" }}><td style={{ ...TD, fontWeight: 600 }}>{r.name}</td><td style={{ ...TD, ...MN }}>{fmt(r.ads)}</td><td style={{ ...TD, ...MN, color: "#0055ff" }}>{fmt(r.fee)}</td><td style={{ ...TD, ...MN, color: "#d97706", fontWeight: 700 }}>{fmt(r.total)}</td><td style={{ ...TD, ...MN, color: "#0d9f6e" }}>{fmt(r.paid)}</td><td style={{ ...TD, ...MN, color: "#7c3aed" }}>{r.gar > 0 ? "-" + fmt(r.gar) : "—"}</td><td style={{ ...TD, ...MN, color: "#dc2640", fontWeight: 700 }}>{fmt(r.netPending)}</td></tr>)}
                    <tr style={{ background: "#f8f9fb" }}><td style={{ ...TD, fontWeight: 800 }}>TOTAL</td><td style={{ ...TD, ...MN, fontWeight: 700 }}>{fmt(repData.t.ads)}</td><td style={{ ...TD, ...MN, color: "#0055ff", fontWeight: 700 }}>{fmt(repData.t.fee)}</td><td style={{ ...TD, ...MN, color: "#d97706", fontWeight: 700 }}>{fmt(repData.t.total)}</td><td style={{ ...TD, ...MN, color: "#0d9f6e", fontWeight: 700 }}>{fmt(repData.t.paid)}</td><td style={{ ...TD, ...MN, color: "#7c3aed", fontWeight: 700 }}>{repData.t.gar > 0 ? "-" + fmt(repData.t.gar) : "—"}</td><td style={{ ...TD, ...MN, color: "#dc2640", fontWeight: 700 }}>{fmt(repData.t.netPending)}</td></tr>
                    {!repData.rows.length && <Empty cols={7} msg="Sin datos para este período" />}
                  </tbody></table></div>
              </div>
              <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 14, padding: "20px 22px", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, alignSelf: "flex-start" }}>Composición de Cuentas</h4>
                <ResponsiveContainer width="100%" height={240}><PieChart><Pie data={repData.pie} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="value" label={cLabel}>{repData.pie.map((e, i) => <Cell key={i} fill={e.color} />)}</Pie><Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v) => `$${fmt(v)}`} /><Legend wrapperStyle={{ fontSize: 11.5 }} formatter={(v, e) => `${v}: $${fmt(e.payload.value)}`} /></PieChart></ResponsiveContainer>
                <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 30, fontWeight: 700, marginTop: 4 }}>{fmtK(repData.t.total)}</div>
                <div style={{ fontSize: 12, color: "#9498a8" }}>Total General</div>
              </div>
            </div>
          </div>
        </div>)}

        {/* ══ CLIENTES (solo gerente) ══ */}
        {page === "clientes" && !isCliente && (<div>
          <div className="hm-page-header" style={{ background: "#fff", borderBottom: "1px solid #e2e4e9", padding: "0 36px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700 }}>Clientes</h2>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}><div style={{ position: "relative" }}><Search size={15} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#9498a8" }} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." style={{ padding: "8px 12px 8px 34px", width: 200, background: "#f4f5f7", border: "1px solid transparent", borderRadius: 8, fontSize: 13, fontFamily: "'DM Sans'", outline: "none" }} /></div><Btn onClick={() => openMdl("client")}><Plus size={16} /> Nuevo</Btn></div>
          </div>
          <div className="hm-page-content" style={{ padding: "28px 36px" }}><div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 14, overflow: "hidden" }}>
            <div className="hm-table-wrap"><table><thead><tr>{["Cliente", "Instagram", "Contacto", "Gasto", "Fees", "Cobrado", "Garantías", "Deuda Neta", "Estado", ""].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead>
              <tbody>{clients.filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase())).map((c) => { const d = cData(c.id); const st = d.gross <= 0 ? "ok" : d.net > 0 ? "err" : "warn"; const stT = d.gross <= 0 ? "Al día" : d.net > 0 ? "Con deuda" : "Cubierto"; return <tr key={c.id} onClick={() => goTo("client-detail", c.id)} style={{ cursor: "pointer" }}><td style={TD}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><Av name={c.name} avatarUrl={c.avatar_url} /><div><div style={{ fontWeight: 600, fontSize: 13.5 }}>{c.name}</div>{c.biz && <div style={{ fontSize: 11, color: "#9498a8" }}>{c.biz}</div>}</div></div></td><td style={{ ...TD, color: "#e1306c", fontWeight: 600, fontSize: 13 }}>{c.ig ? "📷 " + c.ig : "—"}</td><td style={TD}><div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>{(c.phones || []).filter(Boolean).map((p, i) => <span key={"p" + i} style={{ padding: "2px 7px", background: "#f4f5f7", borderRadius: 4, fontSize: 11 }}>📱 {p}</span>)}{(c.emails || []).filter(Boolean).map((e, i) => <span key={"e" + i} style={{ padding: "2px 7px", background: "#f4f5f7", borderRadius: 4, fontSize: 11 }}>✉ {e}</span>)}</div></td><td style={{ ...TD, ...MN }}>${fmt(d.tG)}</td><td style={{ ...TD, ...MN, color: "#0055ff" }}>${fmt(d.tF)}</td><td style={{ ...TD, ...MN, color: "#0d9f6e" }}>${fmt(d.tP)}</td><td style={{ ...TD, ...MN, color: "#7c3aed" }}>{d.tGar > 0 ? "$" + fmt(d.tGar) : "—"}</td><td style={{ ...TD, ...MN, color: "#dc2640" }}>${fmt(d.net)}</td><td style={TD}><Bdg type={st}>{stT}</Bdg></td><td style={TD} onClick={(e) => e.stopPropagation()}><div style={{ display: "flex", gap: 4 }}><IBtn onClick={() => openMdl("client", c.id)} icon={<Edit3 size={13} />} /><IBtn onClick={() => delClient(c.id)} icon={<Trash2 size={13} />} danger /></div></td></tr>; })}{!clients.length && <Empty cols={10} msg="No hay clientes registrados" />}</tbody></table></div>
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
            fmtM={fmtM}
            fmtT={fmtT}
            fmtDt={fmtDt}
            isCliente={isCliente}
            updateClientAvatar={mutations.updateClientAvatar}
            uploadAvatarFile={curCl ? (file) => uploadAvatar(curCl, file) : null}
          />
        )}

        {/* ══ GASTOS ══ */}
        {page === "gastos" && (<div>
          <div className="hm-page-header" style={{ background: "#fff", borderBottom: "1px solid #e2e4e9", padding: "0 36px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}><h2 style={{ fontSize: 17, fontWeight: 700 }}>Gastos Ads · Mensuales</h2>{!isCliente && <Btn onClick={() => openMdl("gasto")}><Plus size={16} /> Nuevo Gasto</Btn>}</div>
          <div className="hm-page-content" style={{ padding: "28px 36px" }}><div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 14, overflow: "hidden" }}>
            <div className="hm-table-wrap"><table><thead><tr>{["Cliente", "Código", "Fecha de movimiento", "Período (mes y año)", "Gasto", "Fee %", "Fee $", "Total", "Pagado", "Garantía", "Pendiente", "Estado", "Prepago", ...(isCliente ? [] : ["Registrado por"]), ""].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead>
              <tbody>{sGastos.sort((a, b) => (b.mes || "").localeCompare(a.mes || "")).map((g) => { const c = clients.find((x) => x.id === g.clientId); const garVal = garantias.filter((gr) => gr.clientId === g.clientId && gr.estado === "Vigente").reduce((a, gr) => a + parseFloat(gr.valor || 0), 0); return <tr key={g.id}><td style={TD}><div style={{ display: "flex", alignItems: "center", gap: 10 }}>{c && <Av name={c.name} size={30} avatarUrl={c.avatar_url} />}<span style={{ fontWeight: 600, fontSize: 13 }}>{c?.name || "—"}</span></div></td><td style={{ ...TD, fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, fontWeight: 600, color: "#1b2559" }}>{g.codigo || "—"}</td><td style={{ ...TD, fontWeight: 600 }}>{fmtM(g.mes)}</td><td style={TD}>{g.camp || "—"}</td><td style={{ ...TD, ...MN }}>${fmt(g.gasto)}</td><td style={{ ...TD, ...MN, color: "#0055ff" }}>{g.fee}%</td><td style={{ ...TD, ...MN, color: "#0055ff" }}>${fmt(g._f)}</td><td style={{ ...TD, ...MN, fontWeight: 700 }}>${fmt(g._t)}</td><td style={{ ...TD, ...MN, color: "#0d9f6e" }}>${fmt(g._p)}</td><td style={{ ...TD, ...MN, color: "#7c3aed" }}>{garVal > 0 ? "$" + fmt(garVal) : "—"}</td><td style={{ ...TD, ...MN, color: "#dc2640" }}>${fmt(g._pend)}</td><td style={TD}><Bdg type={g._st === "Pagado" ? "ok" : g._st === "Parcial" ? "warn" : "acc"}>{g._st}</Bdg></td><td style={TD}>{g.prepago ? "✓" : "—"}</td>{!isCliente && <td style={{ ...TD, fontSize: 12, color: "#5f6577" }} title={g.created_by || ""}>{g.created_by ? (g.created_by.length > 20 ? g.created_by.slice(0, 18) + "…" : g.created_by) : "—"}</td>}<td style={TD}>{!isCliente && <div style={{ display: "flex", gap: 4 }}><IBtn onClick={() => openMdl("gasto", g.id)} icon={<Edit3 size={13} />} title="Editar" /><IBtn onClick={() => openGarantiaForClientId(g.clientId)} icon={<Shield size={13} />} title="Añadir garantía" style={{ color: "#7c3aed" }} /><IBtn onClick={() => delGasto(g.id)} icon={<Trash2 size={13} />} danger title="Eliminar" /></div>}</td></tr>; })}{!gastos.length && <Empty cols={isCliente ? 14 : 15} msg="Sin gastos registrados" />}</tbody></table></div>
          </div></div>
        </div>)}

        {/* ══ COBROS (solo gerente; cliente no ve ni registra cobros) ══ */}
        {page === "cobros" && !isCliente && (<div>
          <div className="hm-page-header" style={{ background: "#fff", borderBottom: "1px solid #e2e4e9", padding: "0 36px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}><h2 style={{ fontSize: 17, fontWeight: 700 }}>Cobros</h2><Btn onClick={() => openMdl("cobro")}><Plus size={16} /> Registrar Cobro</Btn></div>
          <div className="hm-page-content" style={{ padding: "28px 36px" }}><div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 14, overflow: "hidden" }}>
            <div className="hm-table-wrap"><table><thead><tr>{["Fecha", "Hora", "Cliente", "Cód. gasto", "Ref.", "Monto", "Método", ...(isCliente ? [] : ["Registrado por", "Registrado"]), "Notas", ""].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead>
              <tbody>{cobros.map((co) => { const g = gastos.find((x) => x.id === co.gastoId); const c = g ? clients.find((x) => x.id === g.clientId) : null; return <tr key={co.id}><td style={TD}>{fmtD(co.fecha)}</td><td style={TD}>{fmtT(co.hora)}</td><td style={TD}>{c ? <div style={{ display: "flex", alignItems: "center", gap: 10 }}><Av name={c.name} size={30} avatarUrl={c.avatar_url} /><span style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</span></div> : "—"}</td><td style={{ ...TD, fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, fontWeight: 600, color: "#1b2559" }}>{g?.codigo || "—"}</td><td style={TD}>{g ? fmtM(g.mes) + " " + (g.camp || "") : "—"}</td><td style={{ ...TD, ...MN, color: "#0d9f6e", fontWeight: 700 }}>+${fmt(co.monto)}</td><td style={TD}><PayB method={co.metodo} /></td>{!isCliente && <td style={{ ...TD, fontSize: 12, color: "#5f6577" }} title={co.created_by || ""}>{co.created_by ? (co.created_by.length > 20 ? co.created_by.slice(0, 18) + "…" : co.created_by) : "—"}</td>}{!isCliente && <td style={{ ...TD, fontSize: 11.5, color: "#9498a8" }} title={co.created_at ? fmtDt(co.created_at) : ""}>{co.created_at ? fmtDt(co.created_at) : "—"}</td>}<td style={{ ...TD, fontSize: 12.5, color: "#9498a8", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }}>{co.notas || "—"}</td><td style={TD}>{!isCliente && <IBtn onClick={() => delCobro(co.id)} icon={<Trash2 size={13} />} danger />}</td></tr>; })}{!cobros.length && <Empty cols={isCliente ? 9 : 11} msg="Sin cobros" />}</tbody></table></div>
          </div></div>
        </div>)}

        {/* ══ GARANTÍAS ══ */}
        {page === "garantias" && (<div>
          <div className="hm-page-header" style={{ background: "#fff", borderBottom: "1px solid #e2e4e9", padding: "0 36px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}><h2 style={{ fontSize: 17, fontWeight: 700 }}>Garantías</h2>{!isCliente && <Btn onClick={() => openMdl("garantia")}><Plus size={16} /> Nueva Garantía</Btn>}</div>
          <div className="hm-page-content" style={{ padding: "28px 36px" }}><div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 14, overflow: "hidden" }}>
            <div className="hm-table-wrap"><table><thead><tr>{["Cliente", "Tipo", "Descripción", "Valor", "Estado", "Cód. verificación", ""].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead>
              <tbody>{garantias.map((g) => { const c = clients.find((x) => x.id === g.clientId); return <tr key={g.id}><td style={TD}>{c ? <div style={{ display: "flex", alignItems: "center", gap: 10 }}><Av name={c.name} size={30} avatarUrl={c.avatar_url} /><span style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</span></div> : "—"}</td><td style={TD}><Bdg type="gar">{g.tipo}</Bdg></td><td style={{ ...TD, color: "#5f6577", maxWidth: 200 }}>{g.desc || "—"}</td><td style={{ ...TD, ...MN }}>${fmt(g.valor)}</td><td style={TD}><Bdg type={g.estado === "Vigente" ? "ok" : g.estado === "Ejecutada" ? "err" : "n"}>{g.estado}</Bdg></td><td style={{ ...TD, fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "#1b2559" }}>{g.codigoVerificacion || "—"}</td><td style={TD}>{!isCliente && <IBtn onClick={() => delGar(g.id)} icon={<Trash2 size={13} />} danger />}</td></tr>; })}{!garantias.length && <Empty cols={7} msg="Sin garantías" />}</tbody></table></div>
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
        <Inp label="Cliente *" type="select" value={gf.clientId} onChange={(e) => setGf({ ...gf, clientId: e.target.value })}><option value="">Seleccionar...</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Inp>
        <Inp label="Código (opcional)" value={gf.codigo} onChange={(e) => setGf({ ...gf, codigo: e.target.value })} placeholder="Ej. G-202502-001 (se genera solo si se deja vacío)" />
        <div className="hm-form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}><Inp label="Fecha de movimiento *" type="month" value={gf.mes} onChange={(e) => setGf({ ...gf, mes: e.target.value })} /><Inp label="Período (mes y año)" value={gf.camp} onChange={(e) => setGf({ ...gf, camp: e.target.value })} placeholder="Ej. Feb 2025" /></div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}><input type="checkbox" id="gf-prepago" checked={!!gf.prepago} onChange={(e) => setGf({ ...gf, prepago: e.target.checked })} style={{ width: 18, height: 18, accentColor: "#1b2559" }} /><label htmlFor="gf-prepago" style={{ fontSize: 13, fontWeight: 600, color: "#5f6577", cursor: "pointer" }}>Prepago (recarga) — permite registrar cobro para este gasto</label></div>
        <Inp label="Gasto en Ads ($) *" type="number" step="0.01" min="0" value={gf.gasto} onChange={(e) => setGf({ ...gf, gasto: e.target.value })} placeholder="0.00" hint="Inversión en TikTok Ads (u otra red)" />
        <Inp label="Fee / Comisión (%)" type="number" step="0.1" min="0" max="100" value={gf.fee} onChange={(e) => setGf({ ...gf, fee: e.target.value })} hint="Porcentaje sobre el gasto" />
        <div style={{ background: "#eef0f8", padding: "12px 14px", borderRadius: 10, fontFamily: "'IBM Plex Mono'", fontSize: 13, fontWeight: 600, textAlign: "center", marginBottom: 16, color: "#1b2559" }}>Fee: ${fmt(parseFloat(gf.gasto || 0) * (parseFloat(gf.fee || 0) / 100))} → Total a cobrar: ${fmt(parseFloat(gf.gasto || 0) * (1 + parseFloat(gf.fee || 0) / 100))}</div>
        <Inp label="Notas" type="textarea" value={gf.notas} onChange={(e) => setGf({ ...gf, notas: e.target.value })} placeholder="Detalles del gasto o campaña..." />
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

      <Mdl open={modal === "cobro"} onClose={closeMdl} title="Registrar Cobro" footer={<><Btn variant="outline" onClick={closeMdl}>Cancelar</Btn><Btn variant="accent" onClick={saveCobro}>Registrar</Btn></>}>
        <Inp label="Gasto * (solo prepago)" type="select" value={cof.gastoId} onChange={(e) => { const g = sGastos.find((x) => x.id === e.target.value); setCof({ ...cof, gastoId: e.target.value, monto: g ? g._pend.toFixed(2) : "" }); }}><option value="">Seleccionar...</option>{sGastos.filter((g) => g._st !== "Pagado" && g.prepago).map((g) => { const c = clients.find((x) => x.id === g.clientId); return <option key={g.id} value={g.id}>{c?.name || "?"} — {fmtM(g.mes)} (${fmt(g._pend)})</option>; })}</Inp>
        <div className="hm-form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}><Inp label="Monto ($) *" type="number" step="0.01" min="0" value={cof.monto} onChange={(e) => setCof({ ...cof, monto: e.target.value })} placeholder="0.00" /><Inp label="Fecha" type="date" value={cof.fecha} onChange={(e) => setCof({ ...cof, fecha: e.target.value })} /></div>
        <Inp label="Hora (opcional)" type="time" value={cof.hora} onChange={(e) => setCof({ ...cof, hora: e.target.value })} />
        <Inp label="Método de Pago *" type="select" value={cof.metodo} onChange={(e) => setCof({ ...cof, metodo: e.target.value })}><option value="">Seleccionar...</option>{PM.map((m) => <option key={m} value={m}>{PI[m]} {m}</option>)}</Inp>
        <Inp label="Notas" type="textarea" value={cof.notas} onChange={(e) => setCof({ ...cof, notas: e.target.value })} placeholder="Nro. operación..." />
      </Mdl>

      <Mdl open={modal === "garantia"} onClose={closeMdl} title="Nueva Garantía" footer={<><Btn variant="outline" onClick={closeMdl}>Cancelar</Btn><Btn onClick={saveGar}>Guardar</Btn></>}>
        <Inp label="Cliente *" type="select" value={gaf.clientId} onChange={(e) => setGaf({ ...gaf, clientId: e.target.value })}><option value="">Seleccionar...</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Inp>
        <Inp label="Código de verificación" value={gaf.codigoVerificacion} onChange={(e) => setGaf({ ...gaf, codigoVerificacion: e.target.value })} placeholder="Ej. ABC123 o n.º de operación" />
        <div className="hm-form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Inp label="Tipo" type="select" value={gaf.tipo} onChange={(e) => setGaf({ ...gaf, tipo: e.target.value })}>{GT.map((t) => <option key={t}>{t}</option>)}</Inp>
          <Inp label="Valor ($)" type="number" step="0.01" min="0" value={gaf.valor} onChange={(e) => setGaf({ ...gaf, valor: e.target.value })} placeholder="0.00" />
        </div>
        <Inp label="Descripción" type="textarea" value={gaf.desc} onChange={(e) => setGaf({ ...gaf, desc: e.target.value })} placeholder="Detalle..." />
        <Inp label="Estado" type="select" value={gaf.estado} onChange={(e) => setGaf({ ...gaf, estado: e.target.value })}><option>Vigente</option><option>Devuelta</option><option>Ejecutada</option></Inp>
      </Mdl>
    </div>
  );
}

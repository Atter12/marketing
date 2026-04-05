import { useState, useEffect, useMemo, useCallback } from "react";
import {
  RefreshCw,
  Check,
  X,
  Eye,
  Send,
  PlusCircle,
  History,
  CheckSquare,
  Square,
  Heart,
  ListChecks,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import TableScrollWrap from "./TableScrollWrap";
import {
  buildCobranzaWrappedPreviewHtml,
  cobranzaBrandNameForPreview,
  cobranzaTaglineForPreview,
  defaultCobranzaLogoUrlForPreview,
  defaultCobranzaPanelUrlForPreview,
} from "./cobranzaEmailLayout.js";

const TH = {
  textAlign: "left",
  padding: "14px 18px",
  fontSize: 11.5,
  fontWeight: 700,
  color: "#94a3b8",
  textTransform: "uppercase",
  letterSpacing: 1,
  background: "#f5f3ee",
  borderBottom: "1px solid #e5e7eb",
};
const TD = {
  padding: "14px 18px",
  fontSize: 13.5,
  borderBottom: "1px solid #f1f5f9",
  verticalAlign: "middle",
};

/** Tablas en móvil: tarjetas apiladas; en desktop: scroll horizontal con min-width. */
const COBRANZA_RESPONSIVE_CSS = `
@media (max-width: 900px) {
  .hm-cobranza-flow { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
}
@media (max-width: 520px) {
  .hm-cobranza-flow { grid-template-columns: 1fr !important; }
}
@media (max-width: 640px) {
  .hm-cobranza-root .hm-page-header { padding-left: 16px !important; padding-right: 16px !important; }
}
.hm-cobranza-stack table { min-width: 1020px; width: 100%; border-collapse: collapse; }
@media (max-width: 720px) {
  .hm-cobranza-stack { -webkit-overflow-scrolling: touch; }
  .hm-cobranza-stack table { min-width: 0 !important; }
  .hm-cobranza-stack thead {
    position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
    overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
  }
  .hm-cobranza-stack tbody tr {
    display: block;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    margin-bottom: 12px;
    padding: 4px 0 8px;
    background: #fff;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
  }
  .hm-cobranza-stack tbody td {
    display: grid !important;
    grid-template-columns: minmax(88px, 32%) 1fr;
    gap: 4px 10px;
    align-items: start;
    padding: 10px 12px !important;
    border-bottom: 1px solid #f1f5f9 !important;
    font-size: 13px !important;
    vertical-align: top !important;
  }
  .hm-cobranza-stack tbody tr td:last-child { border-bottom: none !important; }
  .hm-cobranza-stack tbody td::before {
    content: attr(data-label);
    font-weight: 700;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #94a3b8;
    line-height: 1.4;
  }
}
`;

const fmtMoney = (n) => {
  const v = parseFloat(n);
  if (Number.isNaN(v)) return "0";
  return v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

const fmtDt = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("es", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const ESTADO_LABEL = {
  draft: "Borrador",
  pending_approval: "Pendiente revisión",
  approved: "Aprobado",
  rejected: "Rechazado",
  sending: "Enviando",
  sent: "Enviado",
  failed: "Error envío",
};

const EVENTO_LABEL = {
  creado: "Borrador creado",
  editado: "Texto actualizado",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
  enviado_manual: "Marcado enviado (manual)",
  enviado_resend: "Enviado (Resend)",
  error_envio: "Error al enviar",
};

const SUBJECT_TMPL = "Recordatorio de saldo — {{cliente_nombre}}";

const BODY_HTML_TMPL = `<p>Hola <strong>{{cliente_nombre}}</strong>,</p>
<p>Te escribimos desde <strong>Holistic Marketing</strong> para recordarte un saldo pendiente de <strong>{{moneda}} {{monto_pendiente}}</strong>.</p>
<p style="color:#475569;font-size:14px;line-height:1.55">{{periodo_etiqueta}}</p>
<p>Si ya realizaste el pago, por favor ignora este mensaje o responde con el comprobante para actualizar nuestros registros.</p>
<p>Gracias por tu confianza.</p>
<p style="color:#64748b;font-size:13px">— Equipo Holistic</p>`;

const THANKS_SUBJECT_TMPL = "Gracias por estar al día — {{cliente_nombre}}";

const THANKS_BODY_HTML_TMPL = `<p>Hola <strong>{{cliente_nombre}}</strong>,</p>
<p>Te escribimos desde <strong>Holistic Marketing</strong> para agradecerte: según nuestros registros <strong>no tenés saldo pendiente</strong> {{periodo_etiqueta}}</p>
<p>Valoramos mucho la confianza y el cumplimiento. Cualquier consulta, estamos a disposición.</p>
<p style="color:#64748b;font-size:13px">— Equipo Holistic</p>`;

function applyTemplate(tpl, vars) {
  if (!tpl) return "";
  return String(tpl).replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) =>
    vars[k] != null && vars[k] !== "" ? String(vars[k]) : "",
  );
}

function firstClientEmail(c) {
  const arr = Array.isArray(c?.emails) ? c.emails : [];
  const hit = arr.find((e) => typeof e === "string" && e.trim().includes("@"));
  return hit ? hit.trim().toLowerCase() : "";
}

function stripHtmlPreview(html, max = 140) {
  if (!html) return "—";
  try {
    const d = document.createElement("div");
    d.innerHTML = html;
    const t = (d.textContent || "").replace(/\s+/g, " ").trim();
    if (t.length <= max) return t || "—";
    return t.slice(0, max) + "…";
  } catch {
    return "—";
  }
}

function correoTipo(r) {
  return r?.variables?.tipo_correo === "agradecimiento" ? "agradecimiento" : "cobro";
}

function htmlToPlainText(html) {
  if (!html) return "";
  try {
    const withBreaks = String(html)
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<p[^>]*>/gi, "");
    const d = document.createElement("div");
    d.innerHTML = withBreaks;
    return (d.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
  } catch {
    return "";
  }
}

function plainTextToHtml(text) {
  const t = String(text || "").trim();
  if (!t) return "";
  const esc = t
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return esc
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

const Btn = ({ variant = "primary", size, children, ...p }) => {
  const vs = {
    primary: {
      bg: "linear-gradient(135deg, #0f172a, #1e293b)",
      color: "#fff",
      border: "none",
      shadow: "0 2px 8px rgba(15,23,42,.2)",
    },
    outline: { bg: "#fff", color: "#0f172a", border: "1.5px solid #e2e8f0", shadow: "none" },
    danger: { bg: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", shadow: "none" },
    ghost: { bg: "transparent", color: "#64748b", border: "1px solid #e5e7eb", shadow: "none" },
  };
  const s = vs[variant] || vs.primary;
  return (
    <button
      {...p}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: size === "sm" ? "6px 12px" : "9px 16px",
        borderRadius: 10,
        fontFamily: "'Inter',sans-serif",
        fontSize: size === "sm" ? 12.5 : 13.5,
        fontWeight: 600,
        border: s.border,
        background: s.bg,
        color: s.color,
        cursor: p.disabled ? "not-allowed" : "pointer",
        opacity: p.disabled ? 0.55 : 1,
        whiteSpace: "nowrap",
        transition: "all .2s",
        boxShadow: s.shadow,
        ...(p.style || {}),
      }}
    >
      {children}
    </button>
  );
};

function FlowSteps() {
  const steps = [
    { n: 1, t: "Generar borradores", d: "Según el período de referencia (o cuenta completa)" },
    { n: 2, t: "Revisar y editar", d: "Asunto y cuerpo antes de aprobar" },
    { n: 3, t: "Aprobar o rechazar", d: "Control humano obligatorio" },
    { n: 4, t: "Enviar", d: "Resend o marcar enviado manual" },
  ];
  return (
    <div
      className="hm-cobranza-flow"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 12,
        marginBottom: 20,
        padding: "16px 18px",
        background: "linear-gradient(135deg, #f8fafc 0%, #fff 100%)",
        border: "1px solid #e2e8f0",
        borderRadius: 14,
      }}
    >
      {steps.map((s) => (
        <div key={s.n} style={{ minWidth: 0 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #e11d48, #f97316)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 8,
            }}
          >
            {s.n}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>{s.t}</div>
          <div style={{ fontSize: 11.5, color: "#64748b", lineHeight: 1.45 }}>{s.d}</div>
        </div>
      ))}
    </div>
  );
}

function defaultFmtM(m) {
  if (!m) return "—";
  const d = new Date(m + "-15T12:00:00");
  return d.toLocaleDateString("es-PE", { month: "short", year: "numeric" });
}

export default function CobranzaView({
  supabase,
  clients = [],
  getClienteDeudaNeta,
  fmtM = defaultFmtM,
  parsePeriodoInput = null,
  userEmail = "",
  onRefetchClients,
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [filterEstado, setFilterEstado] = useState("activos");
  const [filterTipo, setFilterTipo] = useState("all");
  const [sortBy, setSortBy] = useState("nuevos");
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState(null);
  const [editAsunto, setEditAsunto] = useState("");
  const [editCuerpo, setEditCuerpo] = useState("");
  const [editTexto, setEditTexto] = useState("");
  const [editorMode, setEditorMode] = useState("texto");
  const [detailEvents, setDetailEvents] = useState([]);
  const [modalTab, setModalTab] = useState("editar");
  const [saveHint, setSaveHint] = useState("");
  const [rejectMotivo, setRejectMotivo] = useState("");

  const [mainTab, setMainTab] = useState("bandeja");
  const [histRows, setHistRows] = useState([]);
  const [histLoading, setHistLoading] = useState(false);
  const [histQ, setHistQ] = useState("");

  const [selected, setSelected] = useState(() => new Set());
  const [sendProgress, setSendProgress] = useState(null);

  /** Mes de referencia para montos al generar borradores (vacío = deuda neta total actual, igual que «A cobrar» en Gastos). */
  const [periodoCobranza, setPeriodoCobranza] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const deudaReferencia = useCallback(
    (clientId) => {
      if (typeof getClienteDeudaNeta !== "function") return 0;
      return getClienteDeudaNeta(clientId, periodoCobranza || "");
    },
    [getClienteDeudaNeta, periodoCobranza],
  );

  const etiquetaPeriodoCorreo = useMemo(() => {
    if (periodoCobranza && String(periodoCobranza).trim()) {
      return `Este monto corresponde al mes ${fmtM(periodoCobranza)} (gastos con fecha de movimiento en ese mes, cobros contabilizados en ese período y garantías vigentes con mes en resumen en ese mes — igual que el Resumen).`;
    }
    return "Este monto es la deuda neta actual total del cliente en el panel (todos los períodos), igual que la columna «A cobrar» en Gastos Ads.";
  }, [periodoCobranza, fmtM]);

  const etiquetaPeriodoThanks = useMemo(() => {
    if (periodoCobranza && String(periodoCobranza).trim()) {
      return `respecto al mes ${fmtM(periodoCobranza)} (mismo criterio que el Resumen: fecha de movimiento, cobros de ese período, garantías con mes en resumen).`;
    }
    return "en el conjunto de tu cuenta (deuda neta actual total en el panel, como «A cobrar» en Gastos).";
  }, [periodoCobranza, fmtM]);

  /** Misma plantilla que envuelve Resend en cobranza-enviar (cuerpo = borrador editable). */
  const cobranzaEmailPreviewDoc = useMemo(
    () =>
      buildCobranzaWrappedPreviewHtml({
        innerHtml: editCuerpo && String(editCuerpo).trim() ? editCuerpo : "<p>(vacío)</p>",
        brandName: cobranzaBrandNameForPreview(),
        panelUrl: defaultCobranzaPanelUrlForPreview(),
        logoUrl: defaultCobranzaLogoUrlForPreview(),
        tagline: cobranzaTaglineForPreview(),
      }),
    [editCuerpo],
  );

  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || "";
  const supabaseAnon = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || "";

  const loadRows = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("cobranza_bandeja")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(400);
    if (error) {
      console.error("[Cobranza]", error);
      alert(error.message || "No se pudo cargar la bandeja. ¿Aplicaste la migración 039?");
      setRows([]);
    } else {
      setRows(data || []);
    }
    setLoading(false);
  }, [supabase]);

  const loadHistorial = useCallback(async () => {
    if (!supabase) return;
    setHistLoading(true);
    const { data, error } = await supabase
      .from("cobranza_eventos")
      .select(
        "id, evento, detalle, actor_email, created_at, correo_id, cobranza_bandeja ( cliente_nombre, email_destino, asunto, estado, ultimo_error )",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      console.error("[Cobranza historial]", error);
      setHistRows([]);
    } else {
      setHistRows(data || []);
    }
    setHistLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  useEffect(() => {
    if (mainTab === "historial") loadHistorial();
  }, [mainTab, loadHistorial]);

  const insertEvent = async (correoId, evento, detalle = {}) => {
    if (!supabase || !correoId) return;
    await supabase.from("cobranza_eventos").insert({
      correo_id: correoId,
      evento,
      detalle,
      actor_email: userEmail || null,
    });
  };

  const loadEventsForCorreo = async (correoId) => {
    if (!supabase || !correoId) {
      setDetailEvents([]);
      return;
    }
    const { data } = await supabase
      .from("cobranza_eventos")
      .select("id, evento, detalle, actor_email, created_at")
      .eq("correo_id", correoId)
      .order("created_at", { ascending: true });
    setDetailEvents(data || []);
  };

  const filtered = useMemo(() => {
    let list = rows.slice();
    if (filterEstado === "activos") {
      list = list.filter((r) =>
        ["pending_approval", "approved", "failed", "sending"].includes(r.estado),
      );
    } else if (filterEstado !== "all") {
      list = list.filter((r) => r.estado === filterEstado);
    }
    if (filterTipo !== "all") {
      list = list.filter((r) => correoTipo(r) === filterTipo);
    }
    const qq = q.trim().toLowerCase();
    if (qq) {
      list = list.filter((r) => {
        const blob = [r.cliente_nombre, r.email_destino, r.asunto, r.estado]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return blob.includes(qq);
      });
    }
    if (sortBy === "viejos") {
      list = list.slice().sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
    } else if (sortBy === "cobro_primero") {
      list = list.slice().sort((a, b) => {
        const at = correoTipo(a) === "cobro" ? 0 : 1;
        const bt = correoTipo(b) === "cobro" ? 0 : 1;
        if (at !== bt) return at - bt;
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      });
    } else if (sortBy === "agradecimiento_primero") {
      list = list.slice().sort((a, b) => {
        const at = correoTipo(a) === "agradecimiento" ? 0 : 1;
        const bt = correoTipo(b) === "agradecimiento" ? 0 : 1;
        if (at !== bt) return at - bt;
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      });
    } else {
      list = list.slice().sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    }
    return list;
  }, [rows, filterEstado, filterTipo, q, sortBy]);

  const pendingFiltered = useMemo(
    () => filtered.filter((r) => r.estado === "pending_approval"),
    [filtered],
  );

  const histFiltered = useMemo(() => {
    const qq = histQ.trim().toLowerCase();
    if (!qq) return histRows;
    return histRows.filter((ev) => {
      const b = ev.cobranza_bandeja;
      const blob = [
        ev.evento,
        ev.actor_email,
        b?.cliente_nombre,
        b?.email_destino,
        b?.asunto,
        JSON.stringify(ev.detalle || {}),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(qq);
    });
  }, [histRows, histQ]);

  const openDetail = (r) => {
    setDetail(r);
    setEditAsunto(r.asunto || "");
    setEditCuerpo(r.cuerpo_html || "");
    setEditTexto((r.cuerpo_texto && String(r.cuerpo_texto).trim()) || htmlToPlainText(r.cuerpo_html || ""));
    setEditorMode("texto");
    setModalTab("editar");
    setSaveHint("");
    setRejectMotivo("");
    loadEventsForCorreo(r.id);
  };

  const saveEdits = async (closeAfter) => {
    if (!supabase || !detail) return;
    setBusy(true);
    const { error } = await supabase
      .from("cobranza_bandeja")
      .update({
        asunto: editAsunto,
        cuerpo_html: editCuerpo,
        cuerpo_texto: (editTexto && String(editTexto).trim()) || htmlToPlainText(editCuerpo),
        updated_at: new Date().toISOString(),
      })
      .eq("id", detail.id);
    setBusy(false);
    if (error) {
      alert(error.message);
      return;
    }
    await insertEvent(detail.id, "editado", { asunto: editAsunto });
    setSaveHint("Cambios guardados.");
    setTimeout(() => setSaveHint(""), 2500);
    setDetail((d) => (d ? { ...d, asunto: editAsunto, cuerpo_html: editCuerpo } : d));
    loadEventsForCorreo(detail.id);
    loadRows();
    if (closeAfter) setDetail(null);
  };

  const approve = async (r) => {
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase
      .from("cobranza_bandeja")
      .update({
        estado: "approved",
        aprobado_por: userEmail || null,
        aprobado_at: new Date().toISOString(),
      })
      .eq("id", r.id);
    setBusy(false);
    if (error) {
      alert(error.message);
      return;
    }
    await insertEvent(r.id, "aprobado", {});
    setSelected((prev) => {
      const n = new Set(prev);
      n.delete(r.id);
      return n;
    });
    if (detail?.id === r.id) setDetail((d) => (d ? { ...d, estado: "approved" } : d));
    loadEventsForCorreo(r.id);
    loadRows();
  };

  const reject = async (r, motivoOpt) => {
    const motivo =
      motivoOpt !== undefined ? motivoOpt : window.prompt("Motivo del rechazo (opcional):") ?? "";
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase
      .from("cobranza_bandeja")
      .update({
        estado: "rejected",
        motivo_rechazo: motivo || null,
        rechazado_por: userEmail || null,
        rechazado_at: new Date().toISOString(),
      })
      .eq("id", r.id);
    setBusy(false);
    if (error) {
      alert(error.message);
      return;
    }
    await insertEvent(r.id, "rechazado", { motivo });
    setSelected((prev) => {
      const n = new Set(prev);
      n.delete(r.id);
      return n;
    });
    if (detail?.id === r.id) setDetail(null);
    loadRows();
  };

  const rejectFromModal = () => {
    if (!detail) return;
    reject(detail, rejectMotivo);
  };

  const markSentManual = async (r) => {
    if (!supabase) return;
    if (!window.confirm(`¿Marcar como enviado el correo a ${r.email_destino}? (Usalo si ya lo enviaste por fuera.)`))
      return;
    setBusy(true);
    const { error } = await supabase
      .from("cobranza_bandeja")
      .update({
        estado: "sent",
        enviado_at: new Date().toISOString(),
        ultimo_error: null,
      })
      .eq("id", r.id);
    setBusy(false);
    if (error) {
      alert(error.message);
      return;
    }
    await insertEvent(r.id, "enviado_manual", {});
    if (detail?.id === r.id) setDetail(null);
    loadRows();
  };

  const invokeCobranzaEnviar = async (r) => {
    if (!supabase || !supabaseUrl || !supabaseAnon) {
      return { ok: false, error: "Supabase no configurado." };
    }
    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token;
    if (!token) {
      return { ok: false, error: "Iniciá sesión de nuevo." };
    }
    const res = await fetch(`${supabaseUrl}/functions/v1/cobranza-enviar`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: supabaseAnon,
      },
      body: JSON.stringify({ id: r.id }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: body?.error || body?.message || `Error ${res.status}` };
    }
    return { ok: true };
  };

  const sendViaResend = async (r) => {
    setBusy(true);
    try {
      const out = await invokeCobranzaEnviar(r);
      if (!out.ok) {
        alert(out.error || "Error");
        return;
      }
      if (detail?.id === r.id) setDetail(null);
      await loadRows();
    } catch (e) {
      alert(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const sendAllApproved = async () => {
    const list = rows.filter((r) => r.estado === "approved");
    if (!list.length) {
      alert("No hay correos aprobados.");
      return;
    }
    if (
      !window.confirm(
        `Enviar ${list.length} correo(s) aprobado(s) por Resend (requiere función desplegada y RESEND_API_KEY). ¿Continuar?`,
      )
    )
      return;
    setBusy(true);
    let ok = 0;
    const errs = [];
    try {
      for (let i = 0; i < list.length; i++) {
        setSendProgress({ cur: i + 1, total: list.length });
        const r = list[i];
        const out = await invokeCobranzaEnviar(r);
        if (out.ok) ok += 1;
        else errs.push(`${r.email_destino}: ${out.error}`);
      }
      alert(
        `Listo: ${ok} enviado(s).${errs.length ? `\nFallidos:\n${errs.slice(0, 5).join("\n")}${errs.length > 5 ? "\n…" : ""}` : ""}`,
      );
      if (detail && list.some((x) => x.id === detail.id)) setDetail(null);
      await loadRows();
      await loadHistorial();
    } finally {
      setSendProgress(null);
      setBusy(false);
    }
  };

  const activeClientIds = useMemo(() => {
    return new Set(
      rows
        .filter((r) => r.client_id && ["pending_approval", "approved", "sending"].includes(r.estado))
        .map((r) => r.client_id),
    );
  }, [rows]);

  const insertBorrador = async (c, vars, asunto, cuerpo_html, monto, tipo) => {
    const email = firstClientEmail(c);
    if (!email) return false;
    const { data: ins, error } = await supabase
      .from("cobranza_bandeja")
      .insert({
        client_id: c.id,
        cliente_nombre: c.name || null,
        email_destino: email,
        monto_pendiente: monto,
        moneda: "USD",
        dias_atraso: 0,
        asunto,
        cuerpo_html,
        cuerpo_texto: stripHtmlPreview(cuerpo_html, 4000),
        variables: { ...vars, tipo_correo: tipo },
        estado: "pending_approval",
        created_by: userEmail || null,
      })
      .select("id")
      .maybeSingle();
    if (error) {
      console.warn("[Cobranza] insert", error);
      return false;
    }
    if (ins?.id) await insertEvent(ins.id, "creado", { origen: tipo === "agradecimiento" ? "generar_agradecimientos" : "generar_borradores" });
    return true;
  };

  const generateDrafts = async () => {
    if (!supabase || typeof getClienteDeudaNeta !== "function") return;
    setBusy(true);
    let n = 0;
    try {
      for (const c of clients) {
        const net = deudaReferencia(c.id);
        if (net <= 0) continue;
        if (activeClientIds.has(c.id)) continue;
        const email = firstClientEmail(c);
        if (!email) continue;
        const vars = {
          cliente_nombre: c.name || "Cliente",
          empresa: c.biz || "",
          monto_pendiente: fmtMoney(net),
          moneda: "USD",
          fecha_limite: "",
          dias_atraso: "0",
          ultimo_pago_fecha: "",
          link_pago: "",
          resumen_servicios: "",
          periodo_etiqueta: etiquetaPeriodoCorreo,
          periodo_ym: periodoCobranza.trim() || null,
        };
        const ok = await insertBorrador(
          c,
          vars,
          applyTemplate(SUBJECT_TMPL, vars),
          applyTemplate(BODY_HTML_TMPL, vars),
          net,
          "cobro",
        );
        if (ok) n += 1;
      }
      if (n === 0) {
        alert(
          "No hay borradores nuevos de cobro (sin deuda según el período elegido, sin email, o ya hay pendiente/aprobado para ese cliente).",
        );
      } else {
        alert(`Listo: ${n} borrador(es) de cobro para revisar.`);
      }
      await loadRows();
      onRefetchClients?.();
    } finally {
      setBusy(false);
    }
  };

  const generateThanks = async () => {
    if (!supabase || typeof getClienteDeudaNeta !== "function") return;
    setBusy(true);
    let n = 0;
    try {
      for (const c of clients) {
        const net = deudaReferencia(c.id);
        if (net > 0) continue;
        if (activeClientIds.has(c.id)) continue;
        const email = firstClientEmail(c);
        if (!email) continue;
        const vars = {
          cliente_nombre: c.name || "Cliente",
          empresa: c.biz || "",
          monto_pendiente: fmtMoney(0),
          moneda: "USD",
          fecha_limite: "",
          dias_atraso: "0",
          ultimo_pago_fecha: "",
          link_pago: "",
          resumen_servicios: "",
          periodo_etiqueta: etiquetaPeriodoThanks,
          periodo_ym: periodoCobranza.trim() || null,
        };
        const ok = await insertBorrador(
          c,
          vars,
          applyTemplate(THANKS_SUBJECT_TMPL, vars),
          applyTemplate(THANKS_BODY_HTML_TMPL, vars),
          0,
          "agradecimiento",
        );
        if (ok) n += 1;
      }
      if (n === 0) {
        alert(
          "No hay agradecimientos nuevos (al día según el período elegido, con email y sin borrador activo ya creado).",
        );
      } else {
        alert(`Listo: ${n} borrador(es) de agradecimiento para revisar.`);
      }
      await loadRows();
    } finally {
      setBusy(false);
    }
  };

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const selectAllPending = () => {
    const ids = pendingFiltered.map((r) => r.id);
    setSelected(new Set(ids));
  };

  const clearSelection = () => setSelected(new Set());

  const bulkApprove = async () => {
    const ids = [...selected].filter((id) => {
      const r = rows.find((x) => x.id === id);
      return r && r.estado === "pending_approval";
    });
    if (!ids.length) {
      alert("Seleccioná filas en «Pendiente revisión».");
      return;
    }
    if (!window.confirm(`¿Aprobar ${ids.length} correo(s) seleccionado(s)?`)) return;
    if (!supabase) return;
    setBusy(true);
    const now = new Date().toISOString();
    try {
      const { error } = await supabase
        .from("cobranza_bandeja")
        .update({
          estado: "approved",
          aprobado_por: userEmail || null,
          aprobado_at: now,
        })
        .in("id", ids);
      if (error) throw error;
      for (const id of ids) await insertEvent(id, "aprobado", { lote: true });
      clearSelection();
      if (detail && ids.includes(detail.id)) setDetail((d) => (d ? { ...d, estado: "approved" } : d));
      await loadRows();
    } catch (e) {
      alert(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const bulkReject = async () => {
    const ids = [...selected].filter((id) => {
      const r = rows.find((x) => x.id === id);
      return r && r.estado === "pending_approval";
    });
    if (!ids.length) {
      alert("Seleccioná filas en «Pendiente revisión».");
      return;
    }
    const motivo = window.prompt(`Motivo del rechazo para ${ids.length} correo(s) (opcional):`) ?? "";
    if (!supabase) return;
    setBusy(true);
    const now = new Date().toISOString();
    try {
      const { error } = await supabase
        .from("cobranza_bandeja")
        .update({
          estado: "rejected",
          motivo_rechazo: motivo || null,
          rechazado_por: userEmail || null,
          rechazado_at: now,
        })
        .in("id", ids);
      if (error) throw error;
      for (const id of ids) await insertEvent(id, "rechazado", { motivo, lote: true });
      clearSelection();
      if (detail && ids.includes(detail.id)) setDetail(null);
      await loadRows();
    } catch (e) {
      alert(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const variablesObj = detail?.variables && typeof detail.variables === "object" ? detail.variables : {};

  if (!supabase) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "#94a3b8" }}>
        Conectá Supabase para usar Cobranza.
      </div>
    );
  }

  return (
    <div className="hm-cobranza-root">
      <style>{COBRANZA_RESPONSIVE_CSS}</style>
      <div
        className="hm-page-header"
        style={{
          background: "linear-gradient(90deg, #fff 0%, #fef2f2 100%)",
          borderBottom: "1px solid #e5e7eb",
          padding: "0 48px",
          minHeight: 72,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 14,
          position: "sticky",
          top: 0,
          zIndex: 50,
          boxShadow: "0 1px 3px rgba(15,23,42,.04)",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h2
            style={{
              fontSize: 20,
              fontWeight: 700,
              margin: 0,
              letterSpacing: -0.3,
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontFamily: "var(--font-display)",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #e11d48, #f97316)",
              }}
            />
            Cobranza
          </h2>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#64748b", maxWidth: 640, lineHeight: 1.45 }}>
            El monto de los <strong>correos nuevos</strong> depende del <strong>período de referencia</strong> (abajo). Las filas ya guardadas conservan el monto del momento en que se generaron.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "inline-flex", background: "#f1f5f9", borderRadius: 10, padding: 4, gap: 4 }}>
            <button
              type="button"
              onClick={() => setMainTab("bandeja")}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 13,
                fontFamily: "inherit",
                background: mainTab === "bandeja" ? "#fff" : "transparent",
                color: mainTab === "bandeja" ? "#e11d48" : "#64748b",
                boxShadow: mainTab === "bandeja" ? "0 1px 4px rgba(0,0,0,.06)" : "none",
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <ListChecks size={15} /> Bandeja
              </span>
            </button>
            <button
              type="button"
              onClick={() => setMainTab("historial")}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 13,
                fontFamily: "inherit",
                background: mainTab === "historial" ? "#fff" : "transparent",
                color: mainTab === "historial" ? "#e11d48" : "#64748b",
                boxShadow: mainTab === "historial" ? "0 1px 4px rgba(0,0,0,.06)" : "none",
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <History size={15} /> Historial
              </span>
            </button>
          </div>
          {mainTab === "bandeja" && (
            <>
              <select
                value={filterEstado}
                onChange={(e) => setFilterEstado(e.target.value)}
                style={{
                  padding: "8px 12px",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  fontSize: 13,
                  background: "#fff",
                }}
              >
                <option value="activos">Activos (revisión / aprobados / error)</option>
                <option value="all">Todos los estados</option>
                <option value="pending_approval">Pendiente revisión</option>
                <option value="approved">Aprobados</option>
                <option value="sent">Enviados</option>
                <option value="rejected">Rechazados</option>
                <option value="failed">Fallidos</option>
              </select>
              <select
                value={filterTipo}
                onChange={(e) => setFilterTipo(e.target.value)}
                style={{
                  padding: "8px 12px",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  fontSize: 13,
                  background: "#fff",
                }}
                title="Filtrar por tipo de correo"
              >
                <option value="all">Tipo: Todos</option>
                <option value="cobro">Tipo: Cobro</option>
                <option value="agradecimiento">Tipo: Agradecimiento</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  padding: "8px 12px",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  fontSize: 13,
                  background: "#fff",
                }}
                title="Orden de la bandeja"
              >
                <option value="nuevos">Orden: Más nuevos</option>
                <option value="viejos">Orden: Más viejos</option>
                <option value="cobro_primero">Orden: Cobro primero</option>
                <option value="agradecimiento_primero">Orden: Agradecimiento primero</option>
              </select>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar cliente, email, asunto…"
                style={{
                  padding: "8px 12px",
                  width: 200,
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  fontSize: 13,
                }}
              />
              <Btn variant="outline" size="sm" onClick={loadRows} disabled={loading || busy}>
                <RefreshCw size={14} /> Actualizar
              </Btn>
              <Btn size="sm" onClick={generateDrafts} disabled={busy}>
                <PlusCircle size={14} /> Borradores cobro
              </Btn>
              <Btn variant="outline" size="sm" onClick={generateThanks} disabled={busy}>
                <Heart size={14} /> Agradecimiento (al día)
              </Btn>
              <Btn variant="ghost" size="sm" onClick={sendAllApproved} disabled={busy}>
                <Send size={14} /> Enviar aprobados
              </Btn>
            </>
          )}
          {mainTab === "historial" && (
            <>
              <input
                value={histQ}
                onChange={(e) => setHistQ(e.target.value)}
                placeholder="Buscar en historial…"
                style={{
                  padding: "8px 12px",
                  width: 220,
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  fontSize: 13,
                }}
              />
              <Btn variant="outline" size="sm" onClick={loadHistorial} disabled={histLoading}>
                <RefreshCw size={14} /> Actualizar historial
              </Btn>
            </>
          )}
        </div>
      </div>

      <div className="hm-page-content" style={{ padding: "32px 48px", maxWidth: "none" }}>
        {mainTab === "bandeja" && (
          <>
            <div
              style={{
                marginBottom: 18,
                padding: "16px 18px",
                background: "linear-gradient(135deg, #fff1f2 0%, #fff 100%)",
                border: "1px solid #fecdd3",
                borderRadius: 14,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                <Calendar size={20} style={{ color: "#e11d48", flexShrink: 0 }} />
                <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Período de referencia para la deuda</div>
              </div>
              <p style={{ margin: "0 0 14px", fontSize: 13, color: "#57534e", lineHeight: 1.55, maxWidth: 900 }}>
                {periodoCobranza.trim() ? (
                  <>
                    Con <strong>un mes</strong>, el monto al pulsar «Borradores cobro» / «Agradecimiento» es el <strong>pendiente neto de ese mes</strong>, igual que en <strong>Resumen</strong>: gastos con <strong>fecha de movimiento</strong> en el mes, cobros cuyo <strong>período contable</strong> cae en ese mes y <strong>garantías vigentes</strong> con <strong>mes en resumen</strong> en ese mes.
                  </>
                ) : (
                  <>
                    Con <strong>Cuenta completa</strong>, el monto es la <strong>deuda neta actual total</strong> del cliente (todos los períodos), igual que la columna <strong>«A cobrar»</strong> en Gastos Ads.
                  </>
                )}
              </p>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                }}
              >
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "#334155" }}>Período:</span>
                <button
                  type="button"
                  title="Mes anterior"
                  onClick={() => {
                    const base = periodoCobranza.trim() || (() => {
                      const d = new Date();
                      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                    })();
                    const [y, m] = base.split("-").map(Number);
                    const d = new Date(y, m - 2, 1);
                    setPeriodoCobranza(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
                  }}
                  style={{
                    width: 34,
                    height: 34,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    background: "#f8fafc",
                    cursor: "pointer",
                  }}
                >
                  <ChevronLeft size={16} />
                </button>
                <div
                  style={{
                    minWidth: 100,
                    textAlign: "center",
                    padding: "6px 12px",
                    background: "#f1f5f9",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    color: periodoCobranza.trim() ? "#0f172a" : "#64748b",
                  }}
                >
                  {periodoCobranza.trim() ? fmtM(periodoCobranza) : "Cuenta completa"}
                </div>
                <button
                  type="button"
                  title="Mes siguiente"
                  onClick={() => {
                    const base = periodoCobranza.trim() || (() => {
                      const d = new Date();
                      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                    })();
                    const [y, m] = base.split("-").map(Number);
                    const d = new Date(y, m, 1);
                    setPeriodoCobranza(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
                  }}
                  style={{
                    width: 34,
                    height: 34,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    background: "#f8fafc",
                    cursor: "pointer",
                  }}
                >
                  <ChevronRight size={16} />
                </button>
                <input
                  type="month"
                  value={periodoCobranza.trim()}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v) setPeriodoCobranza(v);
                  }}
                  style={{
                    padding: "6px 10px",
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    fontSize: 13,
                    fontFamily: "inherit",
                  }}
                  title="Elegir mes"
                />
                <input
                  type="text"
                  placeholder="MM/AAAA"
                  value={periodoCobranza}
                  onChange={(e) => setPeriodoCobranza(e.target.value)}
                  onBlur={(e) => {
                    if (typeof parsePeriodoInput === "function") {
                      const p = parsePeriodoInput(e.target.value);
                      if (p) setPeriodoCobranza(p);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && typeof parsePeriodoInput === "function") {
                      e.preventDefault();
                      const p = parsePeriodoInput(e.currentTarget.value);
                      if (p) setPeriodoCobranza(p);
                      e.currentTarget.blur();
                    }
                  }}
                  style={{
                    width: 96,
                    padding: "6px 10px",
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    fontSize: 13,
                  }}
                />
                <button
                  type="button"
                  onClick={() => setPeriodoCobranza("")}
                  style={{
                    padding: "7px 12px",
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    background: "#fff",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#64748b",
                    cursor: "pointer",
                  }}
                >
                  Cuenta completa
                </button>
              </div>
            </div>
            <FlowSteps />
            <div
              style={{
                marginBottom: 18,
                padding: "12px 16px",
                background: "#ecfdf5",
                border: "1px solid #a7f3d0",
                borderRadius: 12,
                fontSize: 13,
                color: "#065f46",
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
              }}
            >
              <CheckSquare size={18} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong>Sí: está pensado para revisión humana.</strong> Podés <strong>editar</strong> asunto y cuerpo,
                luego <strong>aprobar</strong> o <strong>rechazar</strong> (en fila, en lote o desde el panel). Solo los
                aprobados deberían enviarse (Resend o «Marcar enviado» si lo mandaste vos).
              </div>
            </div>

            {sendProgress && (
              <div
                style={{
                  marginBottom: 12,
                  padding: "10px 14px",
                  background: "#eff6ff",
                  borderRadius: 10,
                  fontSize: 13,
                  color: "#1e40af",
                  fontWeight: 600,
                }}
              >
                Enviando… {sendProgress.cur} / {sendProgress.total}
              </div>
            )}

            {selected.size > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                  marginBottom: 14,
                  padding: "12px 16px",
                  background: "#fff7ed",
                  border: "1px solid #fed7aa",
                  borderRadius: 12,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: "#9a3412" }}>{selected.size} seleccionado(s)</span>
                <Btn size="sm" onClick={bulkApprove} disabled={busy}>
                  <Check size={13} /> Aprobar seleccionados
                </Btn>
                <Btn variant="danger" size="sm" onClick={bulkReject} disabled={busy}>
                  <X size={13} /> Rechazar seleccionados
                </Btn>
                <Btn variant="ghost" size="sm" onClick={selectAllPending} disabled={busy}>
                  Seleccionar todos (pendientes en vista)
                </Btn>
                <Btn variant="outline" size="sm" onClick={clearSelection}>
                  Limpiar
                </Btn>
              </div>
            )}

            <div
              style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 18,
                overflow: "hidden",
                boxShadow: "0 1px 4px rgba(15,23,42,.04)",
              }}
            >
              <TableScrollWrap className="hm-table-wrap hm-cobranza-stack" autoFocusScroll={mainTab === "bandeja"}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ ...TH, width: 44 }}>
                        <button
                          type="button"
                          title="Seleccionar pendientes visibles"
                          onClick={selectAllPending}
                          style={{
                            border: "none",
                            background: "none",
                            cursor: "pointer",
                            padding: 4,
                            color: "#64748b",
                            display: "flex",
                          }}
                        >
                          <CheckSquare size={18} />
                        </button>
                      </th>
                      {[
                        "Cliente",
                        "Email",
                        <span key="per" title="Mes usado al generar el borrador (Total cuenta = deuda acumulada; — sin dato en borradores viejos)">
                          Período ref.
                        </span>,
                        "Deuda (USD)",
                        "Tipo",
                        "Asunto",
                        "Vista previa",
                        "Estado",
                        "Acciones",
                      ].map((h, i) => (
                        <th key={typeof h === "string" ? h : `h-${i}`} style={TH}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (
                      <tr>
                        <td colSpan={10} style={{ ...TD, textAlign: "center", color: "#94a3b8" }}>
                          Cargando…
                        </td>
                      </tr>
                    )}
                    {!loading &&
                      filtered.map((r) => {
                        const tipo = correoTipo(r) === "agradecimiento" ? "Agradecimiento" : "Cobro";
                        const canSel = r.estado === "pending_approval";
                        const v = r.variables && typeof r.variables === "object" ? r.variables : {};
                        const refPer = v.periodo_ym ? fmtM(v.periodo_ym) : "Total cuenta";
                        const refTitle = v.periodo_etiqueta ? String(v.periodo_etiqueta) : v.periodo_ym ? fmtM(v.periodo_ym) : "Deuda acumulada total al generar (borradores anteriores a período explícito)";
                        return (
                          <tr key={r.id}>
                            <td style={TD} data-label="Incluir">
                              {canSel ? (
                                <button
                                  type="button"
                                  onClick={() => toggleSelect(r.id)}
                                  style={{
                                    border: "none",
                                    background: "none",
                                    cursor: "pointer",
                                    padding: 4,
                                    color: selected.has(r.id) ? "#e11d48" : "#cbd5e1",
                                  }}
                                  aria-label={selected.has(r.id) ? "Quitar selección" : "Seleccionar"}
                                >
                                  {selected.has(r.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                                </button>
                              ) : (
                                <span style={{ display: "inline-block", width: 26 }} />
                              )}
                            </td>
                            <td style={{ ...TD, fontWeight: 600 }} data-label="Cliente">
                              {r.cliente_nombre || "—"}
                            </td>
                            <td style={{ ...TD, fontSize: 12.5, color: "#64748b" }} data-label="Email">
                              {r.email_destino}
                            </td>
                            <td style={{ ...TD, fontSize: 12.5, color: "#475569", maxWidth: 120 }} title={refTitle} data-label="Período ref.">
                              {refPer}
                            </td>
                            <td style={{ ...TD, fontVariantNumeric: "tabular-nums" }} data-label="Deuda (USD)">
                              {r.moneda || "USD"} {fmtMoney(r.monto_pendiente)}
                            </td>
                            <td style={{ ...TD, fontSize: 12 }} data-label="Tipo">
                              {tipo}
                            </td>
                            <td style={{ ...TD, maxWidth: 180 }} data-label="Asunto">
                              {r.asunto}
                            </td>
                            <td style={{ ...TD, color: "#64748b", fontSize: 12.5, maxWidth: 220 }} data-label="Vista previa">
                              {stripHtmlPreview(r.cuerpo_html)}
                            </td>
                            <td style={TD} data-label="Estado">
                              <span
                                style={{
                                  display: "inline-flex",
                                  padding: "4px 10px",
                                  borderRadius: 8,
                                  fontSize: 12,
                                  fontWeight: 600,
                                  background:
                                    r.estado === "sent"
                                      ? "#ecfdf5"
                                      : r.estado === "rejected"
                                        ? "#fef2f2"
                                        : r.estado === "approved"
                                          ? "#eff6ff"
                                          : "#f5f3ee",
                                  color:
                                    r.estado === "sent"
                                      ? "#059669"
                                      : r.estado === "rejected"
                                        ? "#dc2626"
                                        : r.estado === "approved"
                                          ? "#2563eb"
                                          : "#64748b",
                                }}
                              >
                                {ESTADO_LABEL[r.estado] || r.estado}
                              </span>
                            </td>
                            <td style={TD} data-label="Acciones">
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                <Btn variant="outline" size="sm" onClick={() => openDetail(r)}>
                                  <Eye size={13} /> Revisar
                                </Btn>
                                {r.estado === "pending_approval" && (
                                  <>
                                    <Btn size="sm" onClick={() => approve(r)} disabled={busy}>
                                      <Check size={13} /> Aprobar
                                    </Btn>
                                    <Btn variant="danger" size="sm" onClick={() => reject(r)} disabled={busy}>
                                      <X size={13} /> Rechazar
                                    </Btn>
                                  </>
                                )}
                                {r.estado === "approved" && (
                                  <>
                                    <Btn size="sm" onClick={() => sendViaResend(r)} disabled={busy}>
                                      <Send size={13} /> Resend
                                    </Btn>
                                    <Btn variant="ghost" size="sm" onClick={() => markSentManual(r)} disabled={busy}>
                                      Marcar enviado
                                    </Btn>
                                  </>
                                )}
                                {r.estado === "failed" && (
                                  <Btn size="sm" onClick={() => sendViaResend(r)} disabled={busy}>
                                    Reintentar
                                  </Btn>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    {!loading && !filtered.length && (
                      <tr>
                        <td colSpan={10} style={{ ...TD, textAlign: "center", color: "#94a3b8", padding: 40 }}>
                          No hay registros. Usá «Borradores cobro» o «Agradecimiento» o revisá el filtro.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </TableScrollWrap>
            </div>
          </>
        )}

        {mainTab === "historial" && (
          <div
            style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 18,
              overflow: "hidden",
              boxShadow: "0 1px 4px rgba(15,23,42,.04)",
            }}
          >
            <TableScrollWrap className="hm-table-wrap hm-cobranza-stack" autoFocusScroll={mainTab === "historial"}>
              <table>
                <thead>
                  <tr>
                    {["Fecha", "Evento", "Quién", "Cliente", "Email", "Asunto (actual)", "Detalle"].map((h) => (
                      <th key={h} style={TH}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {histLoading && (
                    <tr>
                      <td colSpan={7} style={{ ...TD, textAlign: "center", color: "#94a3b8" }}>
                        Cargando historial…
                      </td>
                    </tr>
                  )}
                  {!histLoading &&
                    histFiltered.map((ev) => {
                      const b = ev.cobranza_bandeja;
                      const det = ev.detalle && typeof ev.detalle === "object" ? ev.detalle : {};
                      const detStr =
                        det.motivo != null
                          ? String(det.motivo)
                          : det.message != null
                            ? String(det.message)
                            : Object.keys(det).length
                              ? JSON.stringify(det).slice(0, 120) + (JSON.stringify(det).length > 120 ? "…" : "")
                              : "—";
                      return (
                        <tr key={ev.id}>
                          <td style={{ ...TD, fontSize: 12.5, color: "#64748b", whiteSpace: "nowrap" }} data-label="Fecha">
                            {fmtDt(ev.created_at)}
                          </td>
                          <td style={TD} data-label="Evento">
                            {EVENTO_LABEL[ev.evento] || ev.evento}
                          </td>
                          <td style={{ ...TD, fontSize: 12.5 }} data-label="Quién">
                            {ev.actor_email || "—"}
                          </td>
                          <td style={TD} data-label="Cliente">
                            {b?.cliente_nombre || "—"}
                          </td>
                          <td style={{ ...TD, fontSize: 12.5 }} data-label="Email">
                            {b?.email_destino || "—"}
                          </td>
                          <td style={{ ...TD, maxWidth: 200, fontSize: 12.5 }} data-label="Asunto">
                            {b?.asunto || "—"}
                          </td>
                          <td style={{ ...TD, fontSize: 12, color: "#64748b", maxWidth: 240 }} title={detStr} data-label="Detalle">
                            {detStr}
                          </td>
                        </tr>
                      );
                    })}
                  {!histLoading && !histFiltered.length && (
                    <tr>
                      <td colSpan={7} style={{ ...TD, textAlign: "center", color: "#94a3b8", padding: 40 }}>
                        Sin eventos aún. Aprobá, rechazá o enviá correos para ver el historial.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </TableScrollWrap>
          </div>
        )}
      </div>

      {detail && (
        <div
          onClick={() => setDetail(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,.65)",
            zIndex: 1000,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            paddingTop: 36,
            overflowY: "auto",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 22,
              width: "96%",
              maxWidth: 960,
              marginBottom: 40,
              boxShadow: "0 32px 100px rgba(0,0,0,.2)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "18px 22px",
                borderBottom: "1px solid #e5e7eb",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontFamily: "var(--font-display)" }}>Revisar correo</h3>
                <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "#64748b" }}>
                  Estado: <strong>{ESTADO_LABEL[detail.estado] || detail.estado}</strong>
                  {detail.aprobado_por ? ` · Aprobado por ${detail.aprobado_por}` : ""}
                  {detail.rechazado_por ? ` · Rechazado por ${detail.rechazado_por}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetail(null)}
                style={{
                  width: 36,
                  height: 36,
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: "0 22px 12px", display: "flex", gap: 8, borderBottom: "1px solid #f1f5f9" }}>
              {["editar", "prevista", "variables", "timeline"].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setModalTab(t)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: 12.5,
                    fontFamily: "inherit",
                    background: modalTab === t ? "#fef2f2" : "transparent",
                    color: modalTab === t ? "#e11d48" : "#64748b",
                  }}
                >
                  {t === "editar" ? "Editar texto" : t === "prevista" ? "Vista previa" : t === "variables" ? "Variables" : "Historial del correo"}
                </button>
              ))}
            </div>

            <div style={{ padding: "18px 22px" }}>
              <p style={{ fontSize: 13, color: "#334155", marginBottom: 14 }}>
                <strong>{detail.cliente_nombre}</strong> · {detail.email_destino} · Monto en registro:{" "}
                {detail.moneda} {fmtMoney(detail.monto_pendiente)}
                {variablesObj.periodo_ym ? (
                  <span style={{ display: "block", marginTop: 6, fontSize: 12.5, color: "#64748b" }}>
                    Período de referencia al generar: <strong>{fmtM(variablesObj.periodo_ym)}</strong>
                  </span>
                ) : (
                  <span style={{ display: "block", marginTop: 6, fontSize: 12.5, color: "#64748b" }}>
                    Criterio al generar: <strong>Total cuenta</strong> (deuda acumulada) o borrador sin período guardado.
                  </span>
                )}
                {detail.ultimo_error ? (
                  <span style={{ display: "block", marginTop: 8, color: "#dc2626", fontSize: 12.5 }}>
                    Último error: {detail.ultimo_error}
                  </span>
                ) : null}
              </p>

              {modalTab === "editar" && (
                <>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Asunto</label>
                  <input
                    value={editAsunto}
                    onChange={(e) => setEditAsunto(e.target.value)}
                    style={{
                      width: "100%",
                      marginBottom: 14,
                      marginTop: 6,
                      padding: "10px 12px",
                      border: "1px solid #e5e7eb",
                      borderRadius: 10,
                      fontSize: 14,
                    }}
                  />
                  <div style={{ display: "flex", gap: 8, marginBottom: 8, marginTop: 2 }}>
                    <button
                      type="button"
                      onClick={() => setEditorMode("texto")}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 8,
                        padding: "6px 10px",
                        fontSize: 12,
                        fontWeight: 600,
                        background: editorMode === "texto" ? "#ecfeff" : "#fff",
                        color: editorMode === "texto" ? "#0e7490" : "#64748b",
                        cursor: "pointer",
                      }}
                    >
                      Editor simple (recomendado)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditorMode("html")}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 8,
                        padding: "6px 10px",
                        fontSize: 12,
                        fontWeight: 600,
                        background: editorMode === "html" ? "#fef2f2" : "#fff",
                        color: editorMode === "html" ? "#b91c1c" : "#64748b",
                        cursor: "pointer",
                      }}
                    >
                      Avanzado (HTML)
                    </button>
                  </div>
                  {editorMode === "texto" ? (
                    <>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>
                        Mensaje (texto normal)
                      </label>
                      <textarea
                        value={editTexto}
                        onChange={(e) => {
                          const v = e.target.value;
                          setEditTexto(v);
                          setEditCuerpo(plainTextToHtml(v));
                        }}
                        rows={14}
                        placeholder="Escribí acá como WhatsApp o email normal. Se formatea solo al enviar."
                        style={{
                          width: "100%",
                          marginTop: 6,
                          padding: "10px 12px",
                          border: "1px solid #e5e7eb",
                          borderRadius: 10,
                          fontSize: 13.5,
                          lineHeight: 1.5,
                        }}
                      />
                      <p style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>
                        Vista real del correo en la pestaña <strong>Vista previa</strong>.
                      </p>
                    </>
                  ) : (
                    <>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Cuerpo (HTML)</label>
                      <textarea
                        value={editCuerpo}
                        onChange={(e) => {
                          const v = e.target.value;
                          setEditCuerpo(v);
                          setEditTexto(htmlToPlainText(v));
                        }}
                        rows={14}
                        style={{
                          width: "100%",
                          marginTop: 6,
                          padding: "10px 12px",
                          border: "1px solid #e5e7eb",
                          borderRadius: 10,
                          fontSize: 13,
                          fontFamily: "ui-monospace, monospace",
                        }}
                      />
                    </>
                  )}
                </>
              )}

              {modalTab === "prevista" && (
                <div>
                  <div
                    style={{
                      marginBottom: 12,
                      padding: "14px 16px",
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: 12,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "#94a3b8",
                        marginBottom: 6,
                      }}
                    >
                      Asunto del correo (va en la bandeja del cliente, no dentro del cuerpo HTML)
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", lineHeight: 1.35 }}>
                      {editAsunto?.trim() ? editAsunto : <span style={{ color: "#94a3b8", fontWeight: 600 }}>(sin asunto)</span>}
                    </div>
                  </div>
                  <div
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      background: "#e2e8f0",
                      overflow: "hidden",
                      boxShadow: "inset 0 1px 2px rgba(15,23,42,.06)",
                    }}
                  >
                    <div
                      style={{
                        padding: "8px 12px",
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: "#64748b",
                        background: "#f1f5f9",
                        borderBottom: "1px solid #e2e8f0",
                      }}
                    >
                      Vista previa del cuerpo del correo (como lo envía Resend)
                    </div>
                    <iframe
                      title="Vista previa del correo de cobranza"
                      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                      srcDoc={cobranzaEmailPreviewDoc}
                      style={{ width: "100%", height: 560, border: "none", display: "block", background: "#f1f5f9" }}
                    />
                  </div>
                  <p style={{ margin: "12px 0 0", fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
                    Esto coincide con la plantilla de la función <code style={{ fontSize: 11 }}>cobranza-enviar</code> (cabecera con logo, tu texto, firma, botón
                    al panel y pie). En producción el logo puede venir de <code style={{ fontSize: 11 }}>COBRANZA_LOGO_URL</code>; acá se usa el logo de esta
                    web (<code style={{ fontSize: 11 }}>…/logo/logoh.png</code>) o <code style={{ fontSize: 11 }}>VITE_COBRANZA_LOGO_URL</code> si lo definís en{" "}
                    <code style={{ fontSize: 11 }}>.env</code>.
                  </p>
                </div>
              )}

              {modalTab === "variables" && (
                <div
                  style={{
                    background: "#f8fafc",
                    borderRadius: 12,
                    padding: 14,
                    fontSize: 13,
                    fontFamily: "ui-monospace, monospace",
                    maxHeight: 360,
                    overflow: "auto",
                  }}
                >
                  {Object.keys(variablesObj).length === 0 ? (
                    <span style={{ color: "#94a3b8" }}>Sin variables guardadas en este borrador.</span>
                  ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <tbody>
                        {Object.entries(variablesObj).map(([k, v]) => (
                          <tr key={k}>
                            <td style={{ padding: "6px 8px", color: "#64748b", verticalAlign: "top", width: "38%" }}>
                              {`{{${k}}}`}
                            </td>
                            <td style={{ padding: "6px 8px", fontWeight: 600 }}>{String(v)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {modalTab === "timeline" && (
                <ul style={{ margin: 0, padding: 0, listStyle: "none", maxHeight: 360, overflowY: "auto" }}>
                  {!detailEvents.length && (
                    <li style={{ color: "#94a3b8", fontSize: 13 }}>Sin eventos registrados.</li>
                  )}
                  {detailEvents.map((ev) => (
                    <li
                      key={ev.id}
                      style={{
                        padding: "10px 0",
                        borderBottom: "1px solid #f1f5f9",
                        fontSize: 13,
                      }}
                    >
                      <div style={{ fontWeight: 600, color: "#0f172a" }}>{EVENTO_LABEL[ev.evento] || ev.evento}</div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                        {fmtDt(ev.created_at)}
                        {ev.actor_email ? ` · ${ev.actor_email}` : ""}
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {detail.estado === "pending_approval" && (
                <div style={{ marginTop: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Motivo si rechazás (opcional)</label>
                  <input
                    value={rejectMotivo}
                    onChange={(e) => setRejectMotivo(e.target.value)}
                    placeholder="Ej. Monto desactualizado, ya pagó, tono incorrecto…"
                    style={{
                      width: "100%",
                      marginTop: 6,
                      padding: "10px 12px",
                      border: "1px solid #e5e7eb",
                      borderRadius: 10,
                      fontSize: 13,
                    }}
                  />
                </div>
              )}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 10,
                padding: "14px 22px 20px",
                borderTop: "1px solid #e5e7eb",
              }}
            >
              <div style={{ fontSize: 13, color: "#059669", fontWeight: 600, minHeight: 20 }}>{saveHint}</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <Btn variant="outline" onClick={() => setDetail(null)}>
                  Cerrar
                </Btn>
                <Btn variant="outline" onClick={() => saveEdits(false)} disabled={busy}>
                  Guardar cambios
                </Btn>
                <Btn variant="ghost" onClick={() => saveEdits(true)} disabled={busy}>
                  Guardar y cerrar
                </Btn>
                {detail.estado === "pending_approval" && (
                  <>
                    <Btn variant="danger" onClick={rejectFromModal} disabled={busy}>
                      Rechazar
                    </Btn>
                    <Btn onClick={() => approve(detail)} disabled={busy}>
                      Aprobar
                    </Btn>
                  </>
                )}
                {detail.estado === "approved" && (
                  <>
                    <Btn variant="ghost" onClick={() => markSentManual(detail)} disabled={busy}>
                      Marcar enviado
                    </Btn>
                    <Btn onClick={() => sendViaResend(detail)} disabled={busy}>
                      Enviar (Resend)
                    </Btn>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

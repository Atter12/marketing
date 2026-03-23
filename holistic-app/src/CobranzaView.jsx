import { useState, useEffect, useMemo, useCallback } from "react";
import { Mail, RefreshCw, Check, X, Eye, Send, AlertCircle, PlusCircle } from "lucide-react";
import TableScrollWrap from "./TableScrollWrap";

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

const fmtMoney = (n) => {
  const v = parseFloat(n);
  if (Number.isNaN(v)) return "0";
  return v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

const ESTADO_LABEL = {
  draft: "Borrador",
  pending_approval: "Pendiente",
  approved: "Aprobado",
  rejected: "Rechazado",
  sending: "Enviando",
  sent: "Enviado",
  failed: "Error",
};

const SUBJECT_TMPL = "Recordatorio de saldo — {{cliente_nombre}}";

const BODY_HTML_TMPL = `<p>Hola <strong>{{cliente_nombre}}</strong>,</p>
<p>Te escribimos desde <strong>Holistic Marketing</strong> para recordarte un saldo pendiente de <strong>{{moneda}} {{monto_pendiente}}</strong> a la fecha.</p>
<p>Si ya realizaste el pago, por favor ignora este mensaje o responde con el comprobante para actualizar nuestros registros.</p>
<p>Gracias por tu confianza.</p>
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

export default function CobranzaView({
  supabase,
  clients = [],
  getClienteDeudaNeta,
  userEmail = "",
  onRefetchClients,
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [filterEstado, setFilterEstado] = useState("activos");
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState(null);
  const [editAsunto, setEditAsunto] = useState("");
  const [editCuerpo, setEditCuerpo] = useState("");

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

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const insertEvent = async (correoId, evento, detalle = {}) => {
    if (!supabase || !correoId) return;
    await supabase.from("cobranza_eventos").insert({
      correo_id: correoId,
      evento,
      detalle,
      actor_email: userEmail || null,
    });
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
    const qq = q.trim().toLowerCase();
    if (qq) {
      list = list.filter((r) => {
        const blob = [
          r.cliente_nombre,
          r.email_destino,
          r.asunto,
          r.estado,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return blob.includes(qq);
      });
    }
    return list;
  }, [rows, filterEstado, q]);

  const openDetail = (r) => {
    setDetail(r);
    setEditAsunto(r.asunto || "");
    setEditCuerpo(r.cuerpo_html || "");
  };

  const saveEdits = async () => {
    if (!supabase || !detail) return;
    setBusy(true);
    const { error } = await supabase
      .from("cobranza_bandeja")
      .update({ asunto: editAsunto, cuerpo_html: editCuerpo, updated_at: new Date().toISOString() })
      .eq("id", detail.id);
    setBusy(false);
    if (error) {
      alert(error.message);
      return;
    }
    await insertEvent(detail.id, "editado", { asunto: editAsunto });
    setDetail(null);
    loadRows();
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
    loadRows();
  };

  const reject = async (r) => {
    const motivo = window.prompt("Motivo del rechazo (opcional):") ?? "";
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
    if (detail?.id === r.id) setDetail(null);
    loadRows();
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
      for (const r of list) {
        const out = await invokeCobranzaEnviar(r);
        if (out.ok) ok += 1;
        else errs.push(`${r.email_destino}: ${out.error}`);
      }
      alert(
        `Listo: ${ok} enviado(s).${errs.length ? `\nFallidos:\n${errs.slice(0, 5).join("\n")}${errs.length > 5 ? "\n…" : ""}` : ""}`,
      );
      if (detail && list.some((x) => x.id === detail.id)) setDetail(null);
      await loadRows();
    } finally {
      setBusy(false);
    }
  };

  const generateDrafts = async () => {
    if (!supabase || typeof getClienteDeudaNeta !== "function") return;
    const active = new Set(
      rows
        .filter((r) =>
          r.client_id && ["pending_approval", "approved", "sending"].includes(r.estado),
        )
        .map((r) => r.client_id),
    );
    let n = 0;
    setBusy(true);
    try {
      for (const c of clients) {
        const net = getClienteDeudaNeta(c.id);
        if (net <= 0) continue;
        const email = firstClientEmail(c);
        if (!email) continue;
        if (active.has(c.id)) continue;
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
        };
        const asunto = applyTemplate(SUBJECT_TMPL, vars);
        const cuerpo_html = applyTemplate(BODY_HTML_TMPL, vars);
        const { data: ins, error } = await supabase
          .from("cobranza_bandeja")
          .insert({
            client_id: c.id,
            cliente_nombre: c.name || null,
            email_destino: email,
            monto_pendiente: net,
            moneda: "USD",
            dias_atraso: 0,
            asunto,
            cuerpo_html,
            cuerpo_texto: stripHtmlPreview(cuerpo_html, 2000),
            variables: vars,
            estado: "pending_approval",
            created_by: userEmail || null,
          })
          .select("id")
          .maybeSingle();
        if (error) {
          console.warn("[Cobranza] insert", error);
          continue;
        }
        if (ins?.id) await insertEvent(ins.id, "creado", { origen: "generar_borradores" });
        active.add(c.id);
        n += 1;
      }
      if (n === 0) {
        alert(
          "No se generaron borradores nuevos (sin deuda, sin email, o ya hay pendiente/aprobado para ese cliente).",
        );
      } else {
        alert(`Se generaron ${n} borrador(es) en revisión.`);
      }
      await loadRows();
      onRefetchClients?.();
    } finally {
      setBusy(false);
    }
  };

  if (!supabase) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "#94a3b8" }}>
        Conectá Supabase para usar Cobranza.
      </div>
    );
  }

  return (
    <div>
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
        <h2
          style={{
            fontSize: 20,
            fontWeight: 700,
            margin: 0,
            letterSpacing: -0.3,
            display: "flex",
            alignItems: "center",
            gap: 10,
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
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
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
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar cliente, email, asunto…"
            style={{
              padding: "8px 12px",
              width: 220,
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              fontSize: 13,
            }}
          />
          <Btn variant="outline" size="sm" onClick={loadRows} disabled={loading || busy}>
            <RefreshCw size={14} /> Actualizar
          </Btn>
          <Btn size="sm" onClick={generateDrafts} disabled={busy}>
            <PlusCircle size={14} /> Generar borradores (con deuda)
          </Btn>
          <Btn variant="ghost" size="sm" onClick={sendAllApproved} disabled={busy}>
            <Send size={14} /> Enviar aprobados (Resend)
          </Btn>
        </div>
      </div>

      <div className="hm-page-content" style={{ padding: "32px 48px", maxWidth: "none" }}>
        <div
          style={{
            marginBottom: 18,
            padding: "12px 16px",
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: 12,
            fontSize: 13,
            color: "#92400e",
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
          }}
        >
          <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong>MVP:</strong> generá borradores desde clientes con deuda neta &gt; 0 y correo válido.
            Aprobá cada uno y enviá con Resend (función <code>cobranza-enviar</code>) o marcá como enviado si lo mandaste
            vos. La migración SQL debe estar aplicada en Supabase.
          </div>
        </div>

        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 18,
            overflow: "hidden",
            boxShadow: "0 1px 4px rgba(15,23,42,.04)",
          }}
        >
          <TableScrollWrap className="hm-table-wrap">
            <table>
              <thead>
                <tr>
                  {["Cliente", "Email", "Deuda", "Asunto", "Vista previa", "Estado", "Acciones"].map((h) => (
                    <th key={h} style={TH}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={7} style={{ ...TD, textAlign: "center", color: "#94a3b8" }}>
                      Cargando…
                    </td>
                  </tr>
                )}
                {!loading &&
                  filtered.map((r) => (
                    <tr key={r.id}>
                      <td style={{ ...TD, fontWeight: 600 }}>{r.cliente_nombre || "—"}</td>
                      <td style={{ ...TD, fontSize: 12.5, color: "#64748b" }}>{r.email_destino}</td>
                      <td style={{ ...TD, fontVariantNumeric: "tabular-nums" }}>
                        {r.moneda || "USD"} {fmtMoney(r.monto_pendiente)}
                      </td>
                      <td style={{ ...TD, maxWidth: 200 }}>{r.asunto}</td>
                      <td style={{ ...TD, color: "#64748b", fontSize: 12.5, maxWidth: 260 }}>
                        {stripHtmlPreview(r.cuerpo_html)}
                      </td>
                      <td style={TD}>
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
                      <td style={TD}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          <Btn variant="outline" size="sm" onClick={() => openDetail(r)}>
                            <Eye size={13} /> Ver
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
                  ))}
                {!loading && !filtered.length && (
                  <tr>
                    <td colSpan={7} style={{ ...TD, textAlign: "center", color: "#94a3b8", padding: 40 }}>
                      No hay registros. Usá «Generar borradores» o revisá el filtro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </TableScrollWrap>
        </div>
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
            paddingTop: 48,
            overflowY: "auto",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 22,
              width: "94%",
              maxWidth: 720,
              marginBottom: 40,
              boxShadow: "0 32px 100px rgba(0,0,0,.2)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "20px 24px",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <h3 style={{ margin: 0, fontSize: 17 }}>Revisar correo</h3>
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
            <div style={{ padding: "20px 24px" }}>
              <p style={{ fontSize: 13, color: "#64748b", marginBottom: 12 }}>
                <strong>{detail.cliente_nombre}</strong> · {detail.email_destino} · Deuda:{" "}
                {detail.moneda} {fmtMoney(detail.monto_pendiente)}
              </p>
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
              <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Cuerpo (HTML)</label>
              <textarea
                value={editCuerpo}
                onChange={(e) => setEditCuerpo(e.target.value)}
                rows={12}
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
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                flexWrap: "wrap",
                padding: "16px 24px 22px",
                borderTop: "1px solid #e5e7eb",
              }}
            >
              <Btn variant="outline" onClick={() => setDetail(null)}>
                Cerrar
              </Btn>
              <Btn variant="outline" onClick={saveEdits} disabled={busy}>
                Guardar cambios
              </Btn>
              {detail.estado === "pending_approval" && (
                <>
                  <Btn variant="danger" onClick={() => reject(detail)} disabled={busy}>
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
      )}
    </div>
  );
}

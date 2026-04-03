import React, { useState, useEffect } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { CreditCard, Plus, ChevronLeft, ChevronRight, Edit3, Camera, Trash2, KeyRound, Download, Paperclip } from "lucide-react";
import TableScrollWrap from "./TableScrollWrap";
import { isLikelyBlockedAvatarHotlinkUrl } from "./supabase";

const Slot = ({ content }) => content;

export default function ClientDetailView(props) {
  const {
    curC,
    curD,
    pct,
    detailTab,
    setDetailTab,
    curGastos,
    curCobros,
    curGars,
    mesCobro,
    manualTabContent,
    cCharts,
    goTo,
    openMdl,
    curCl,
    gastos,
    Av,
    Bdg,
    Btn,
    PayB,
    IBtn,
    Empty,
    TH,
    TD,
    MN,
    fmt,
    fmtD,
    fmtDD,
    fmtM,
    fmtT,
    fmtDt,
    isCliente,
    updateClientAvatar,
    uploadAvatarFile,
    onExportClientPorPeriodo,
    clientDetailPeriodo = "",
    setClientDetailPeriodo,
    parsePeriodoInput,
    tm,
    setComprobanteViewer,
  } = props;

  const [photoUrl, setPhotoUrl] = useState(curC.avatar_url || "");
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  useEffect(() => { setPhotoUrl(curC.avatar_url || ""); }, [curC.avatar_url]);

  const effectiveTab = isCliente && detailTab === "cobros" ? "gastos" : detailTab;

  /** Clave para ordenar movimientos del libro (cronológico ascendente). */
  const ledgerSortKey = (dateYmd, timeHms, seq, id) => {
    const d = (dateYmd || "1970-01-01").slice(0, 10);
    const t = (timeHms || "00:00:00").toString().slice(0, 8);
    return `${d}T${t}#${String(seq).padStart(2, "0")}#${id || ""}`;
  };

  const handleSavePhoto = async () => {
    if (!updateClientAvatar) return;
    const t = (photoUrl || "").trim().replace(/&amp;/gi, "&");
    if (t && isLikelyBlockedAvatarHotlinkUrl(t)) {
      if (!confirm("Esa URL suele dar error 403 (WhatsApp/Meta no deja mostrarla aquí). Usá «Cambiar foto» para subirla a Crédito.\n\n¿Guardar esta URL igualmente?")) return;
    }
    setSavingPhoto(true);
    try {
      await updateClientAvatar(t || null);
    } catch (e) {
      alert(e?.message || "No se pudo actualizar la foto.");
    } finally {
      setSavingPhoto(false);
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !uploadAvatarFile || !updateClientAvatar) return;
    setUploadingFile(true);
    try {
      const url = await uploadAvatarFile(file);
      await updateClientAvatar(url);
      setPhotoUrl(url);
    } catch (err) {
      alert(err?.message || "Error al subir la imagen.");
    } finally {
      setUploadingFile(false);
      e.target.value = "";
    }
  };

  const handleRemovePhoto = async () => {
    if (!updateClientAvatar || !confirm("¿Quitar la foto de perfil?")) return;
    setSavingPhoto(true);
    try {
      await updateClientAvatar(null);
      setPhotoUrl("");
    } catch (e) {
      alert(e?.message || "No se pudo quitar la foto.");
    } finally {
      setSavingPhoto(false);
    }
  };

  return React.createElement("section", null,
    <div className="hm-page-header" style={{ background: "#fff", borderBottom: "1px solid #e2e4e9", padding: "0 36px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ fontSize: 13, color: "#9498a8", minWidth: 0 }}>{!isCliente && <><span onClick={() => goTo("clientes")} style={{ cursor: "pointer" }}>Clientes</span> › </>}<span style={{ color: "#1a1d26", fontWeight: 600 }}>{curC.name}</span>{curC.codigo && <span style={{ marginLeft: 8, fontSize: 12, color: "#5f6577", fontFamily: "var(--font-mono)" }}>{curC.codigo}</span>}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {!isCliente && <Btn variant="outline" size="sm" onClick={() => openMdl("client", curCl)}><Edit3 size={14} /> Editar</Btn>}{!isCliente && <Btn variant="outline" size="sm" onClick={() => openMdl("dar-acceso", curCl)} style={{ borderColor: "#0d9f6e", color: "#0d9f6e" }}><KeyRound size={14} /> Dar acceso</Btn>}{!isCliente && <Btn size="sm" onClick={() => openMdl("gasto")}><Plus size={14} /> Gasto</Btn>}{!isCliente && <Btn variant="accent" size="sm" onClick={() => openMdl("cobro")}><CreditCard size={14} /> Cobro</Btn>}
        </div>
      </div>,
    React.createElement("div", { className: "hm-page-content", style: { padding: "28px 36px 40px" } },
      React.createElement(React.Fragment, null,
        <div onClick={() => goTo(isCliente ? "dashboard" : "clientes")} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#9498a8", cursor: "pointer", marginBottom: 18 }}><ChevronLeft size={16} /> Volver</div>,
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 28, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10 }}>
            <Av name={curC.name} size={56} avatarUrl={curC.avatar_url} />
            {isCliente && (updateClientAvatar || uploadAvatarFile) && (
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, maxWidth: "100%" }}>
                {uploadAvatarFile && (
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", background: "#c2410c", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: uploadingFile ? "wait" : "pointer" }}>
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: "none" }} onChange={handleFileSelect} disabled={uploadingFile} />
                    <Camera size={12} /> {uploadingFile ? "Subiendo…" : "Cambiar foto"}
                  </label>
                )}
                {updateClientAvatar && curC.avatar_url && (
                  <button type="button" onClick={handleRemovePhoto} disabled={savingPhoto} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", border: "1px solid #e2e4e9", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "#dc2640", background: "#fff", cursor: savingPhoto ? "wait" : "pointer" }}><Trash2 size={12} /> Eliminar foto</button>
                )}
                <input type="url" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="O pega una URL" style={{ padding: "6px 10px", border: "1px solid #e2e4e9", borderRadius: 8, fontSize: 12, minWidth: 140, maxWidth: 220 }} />
                {updateClientAvatar && <button type="button" onClick={handleSavePhoto} disabled={savingPhoto} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", background: "#5f6577", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: savingPhoto ? "wait" : "pointer" }}>{savingPhoto ? "Guardando…" : "Guardar URL"}</button>}
              </div>
            )}
          </div>
          <div style={{ minWidth: 0 }}><h2 style={{ fontSize: 19, fontWeight: 700, fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}>{curC.name}</h2>{curC.codigo && <div style={{ fontSize: 11.5, color: "#5f6577", fontFamily: "var(--font-mono)", marginTop: 2, fontWeight: 600, letterSpacing: "0.02em" }}>Código: {curC.codigo}</div>}<div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 12.5, letterSpacing: "0.01em", color: "#9498a8", marginTop: 2 }}>{curC.ig && <span style={{ color: "#e1306c" }}>📷 {curC.ig}</span>}{(curC.phones || []).filter(Boolean).map((p, i) => <span key={i}>📱 {p}</span>)}{(curC.emails || []).filter(Boolean).map((e, i) => <span key={i}>✉ {e}</span>)}{curC.biz && <span>🏢 {curC.biz}</span>}</div></div>
        </div>,
        isLikelyBlockedAvatarHotlinkUrl(String(curC.avatar_url || "").replace(/&amp;/gi, "&")) && (
          <div role="alert" style={{ marginBottom: 22, padding: "14px 16px", borderRadius: 12, border: "1px solid #fbbf24", background: "linear-gradient(135deg, #fffbeb, #fef3c7)", color: "#92400e", fontSize: 13, lineHeight: 1.5, maxWidth: 720 }}>
            <strong style={{ display: "block", marginBottom: 6 }}>Foto del cliente inestable (WhatsApp / Meta)</strong>
            Esta URL no se puede mostrar bien en Crédito ni en Pendientes (error 403). <strong>En Crédito es donde se define la foto que sincroniza el resto:</strong> subí la imagen como archivo para guardarla en Supabase.
            {!isCliente && (
              <span style={{ display: "block", marginTop: 10 }}>
                <button type="button" onClick={() => openMdl("client", curCl)} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#c2410c", color: "#fff", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Abrir Editar cliente → Subir foto</button>
              </span>
            )}
            {isCliente && <span style={{ display: "block", marginTop: 8 }}>Usá el botón <strong>Cambiar foto</strong> arriba (subir archivo), no un enlace pegado.</span>}
          </div>
        ),
        setClientDetailPeriodo && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "#5f6577" }}>Filtrar por período (mes):</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <button type="button" onClick={() => { const base = clientDetailPeriodo || tm(); const [y, m] = base.split("-").map(Number); const d = new Date(y, m - 2, 1); setClientDetailPeriodo(d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0")); }} style={{ width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #e2e4e9", borderRadius: 8, background: "#fff", color: "#c2410c", cursor: "pointer", flexShrink: 0 }} title="Mes anterior"><ChevronLeft size={16} /></button>
            <div style={{ minWidth: 90, textAlign: "center", padding: "6px 12px", background: "#f8f9fb", border: "1px solid #e2e4e9", borderRadius: 8, fontSize: 12.5, fontWeight: 600, color: clientDetailPeriodo ? "#c2410c" : "#9498a8" }}>{clientDetailPeriodo ? (fmtM ? fmtM(clientDetailPeriodo) : clientDetailPeriodo) : "Todos"}</div>
            <button type="button" onClick={() => { const base = clientDetailPeriodo || tm(); const [y, m] = base.split("-").map(Number); const d = new Date(y, m, 1); setClientDetailPeriodo(d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0")); }} style={{ width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #e2e4e9", borderRadius: 8, background: "#fff", color: "#c2410c", cursor: "pointer", flexShrink: 0 }} title="Mes siguiente"><ChevronRight size={16} /></button>
            <input type="text" placeholder="0125, 02/25, MM/AAAA" value={clientDetailPeriodo} onChange={(e) => setClientDetailPeriodo(e.target.value)} onBlur={(e) => { const p = parsePeriodoInput && parsePeriodoInput(e.target.value); if (p) setClientDetailPeriodo(p); }} onKeyDown={(e) => { if (e.key === "Enter" && parsePeriodoInput) { e.preventDefault(); const p = parsePeriodoInput(e.currentTarget.value); if (p) setClientDetailPeriodo(p); e.currentTarget.blur(); } }} style={{ width: 95, boxSizing: "border-box", padding: "6px 10px", border: "1px solid #e2e4e9", borderRadius: 8, fontFamily: "'Inter',sans-serif", fontSize: 12, outline: "none" }} title="Escribí 0125, 02/25 o MM/AAAA" />
            {clientDetailPeriodo && <button type="button" onClick={() => setClientDetailPeriodo("")} style={{ padding: "5px 10px", border: "1px solid #e2e4e9", borderRadius: 8, background: "#fff", color: "#9498a8", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Todos</button>}
          </div>
          <span style={{ fontSize: 11, color: "#9498a8" }}>Todo el resumen (tarjetas y tablas) se filtra por período (mes), no por fecha de pago. Cobros: se usa el mes en que cuenta cada pago.</span>
        </div>
        ),
        <div className="hm-detail-stats" style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 12, marginBottom: 22 }}>
          <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 10, padding: "14px 16px" }}><div style={{ fontSize: 10, fontWeight: 600, color: "#9498a8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Gasto Ads</div><div style={{ fontFamily: "'Inter', system-ui, sans-serif", fontVariantNumeric: "tabular-nums", fontSize: 19, fontWeight: 700, letterSpacing: "-0.02em" }}>${fmt(curD.tG)}</div></div>
          <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 10, padding: "14px 16px" }}><div style={{ fontSize: 10, fontWeight: 600, color: "#9498a8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Fees</div><div style={{ fontFamily: "'Inter', system-ui, sans-serif", fontVariantNumeric: "tabular-nums", fontSize: 19, fontWeight: 700, color: "#2563eb", letterSpacing: "-0.02em" }}>${fmt(curD.tF)}</div></div>
          <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 10, padding: "14px 16px" }}><div style={{ fontSize: 10, fontWeight: 600, color: "#9498a8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Total</div><div style={{ fontFamily: "'Inter', system-ui, sans-serif", fontVariantNumeric: "tabular-nums", fontSize: 19, fontWeight: 700, color: "#d97706", letterSpacing: "-0.02em" }}>${fmt((curD.tG || 0) + (curD.tF || 0))}</div></div>
          <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 10, padding: "14px 16px" }}><div style={{ fontSize: 10, fontWeight: 600, color: "#9498a8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Cobrado</div><div style={{ fontFamily: "'Inter', system-ui, sans-serif", fontVariantNumeric: "tabular-nums", fontSize: 19, fontWeight: 700, color: "#0d9f6e", letterSpacing: "-0.02em" }}>${fmt(curD.tP)}</div><div style={{ height: 5, background: "#eff0f3", borderRadius: 3, marginTop: 10, overflow: "hidden" }}><div style={{ height: "100%", borderRadius: 3, background: "#0d9f6e", width: Math.min(100, pct) + "%", transition: "width 0.15s ease-out" }} /></div></div>
          <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 10, padding: "14px 16px" }}><div style={{ fontSize: 10, fontWeight: 600, color: "#9498a8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Garantías</div><div style={{ fontFamily: "'Inter', system-ui, sans-serif", fontVariantNumeric: "tabular-nums", fontSize: 19, fontWeight: 700, color: "#7c3aed", letterSpacing: "-0.02em" }}>{curD.tGar > 0 ? "-$" + fmt(curD.tGar) : "$0"}</div></div>
          <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 10, padding: "14px 16px" }}><div style={{ fontSize: 10, fontWeight: 600, color: "#9498a8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Deuda Neta</div><div style={{ fontFamily: "'Inter', system-ui, sans-serif", fontVariantNumeric: "tabular-nums", fontSize: 19, fontWeight: 700, color: curD.net > 0 ? "#dc2640" : "#0d9f6e", letterSpacing: "-0.02em" }}>${fmt(curD.net)}</div></div>
        </div>,
        <div className="hm-detail-tabs" style={{ display: "flex", gap: 2, background: "#f4f5f7", borderRadius: 9, padding: 3, width: "fit-content", marginBottom: 8 }}>
          {([["todos", "Todos"], ["gastos", "Gastos Ads"], ["cobros", "Cobros"], ["garantias", "Garantías"]].filter(([k]) => isCliente ? k !== "cobros" : true)).map(([k, l]) => <button key={k} onClick={() => setDetailTab(k)} style={{ padding: "7px 18px", border: "none", background: effectiveTab === k ? "#fff" : "transparent", color: effectiveTab === k ? "#1a1d26" : "#9498a8", fontFamily: "'Inter'", fontSize: 12.5, fontWeight: 600, borderRadius: 7, cursor: "pointer", boxShadow: effectiveTab === k ? "0 1px 2px rgba(0,0,0,.04)" : "none" }}>{l}</button>)}
        </div>,
        onExportClientPorPeriodo && (
        <div style={{ marginBottom: 20, padding: "14px 18px", background: "linear-gradient(135deg, #f8f9fb 0%, #fef2f2 100%)", border: "1px solid #fecaca", borderRadius: 12 }}>
          <p style={{ fontSize: 12.5, fontWeight: 600, color: "#5f6577", margin: "0 0 10px" }}>Descargar PDF según el período mostrado arriba</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" onClick={() => onExportClientPorPeriodo(false, true)} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", border: "1px solid #dc2626", borderRadius: 8, background: "#fff", color: "#dc2626", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter',sans-serif", boxShadow: "0 1px 3px rgba(220,38,38,.1)" }}><Download size={16} /> Descargar PDF</button>
          </div>
        </div>
        ),
        effectiveTab === "todos" && (() => {
          const cellAds = { background: "#fce7f3" };
          const cellFee = { background: "#e0f2fe" };
          const cellGar = { background: "#dcfce7" };
          const cellCobro = { background: "#f8fafc" };
          const raw = [];
          (curGastos || []).forEach((g) => {
            const ymd = (g.fechaMovimiento && String(g.fechaMovimiento).slice(0, 10)) || (g.mes ? `${g.mes}-15` : "1970-01-01");
            const gastoNum = parseFloat(g.gasto || 0);
            const feeNum = g._f || 0;
            const camp = (g.camp || "").trim();
            const obsAds = [camp, gastoNum ? `${fmt(gastoNum)} USD` : "", g.codigo ? `Gasto ${g.codigo}` : ""].filter(Boolean).join(" · ") || "General";
            if (gastoNum !== 0) {
              raw.push({
                sortKey: ledgerSortKey(ymd, "00:00:00", 0, `${g.id}-ads`),
                fechaYmd: ymd,
                desc: "ADS",
                descStyle: cellAds,
                obs: obsAds,
                moneda: "USD",
                delta: gastoNum,
              });
            }
            if (feeNum !== 0) {
              raw.push({
                sortKey: ledgerSortKey(ymd, "00:00:01", 1, `${g.id}-fee`),
                fechaYmd: ymd,
                desc: "FEE",
                descStyle: cellFee,
                obs: [camp, `${fmt(feeNum)} USD`, g.codigo ? `Gasto ${g.codigo}` : ""].filter(Boolean).join(" · ") || "General",
                moneda: "USD",
                delta: feeNum,
              });
            }
          });
          (curCobros || []).forEach((co) => {
            const ymd = (co.fecha && String(co.fecha).slice(0, 10)) || "1970-01-01";
            const monto = parseFloat(co.monto || 0);
            const gAsoc = gastos.find((x) => x.id === co.gastoId);
            const periodoStr = mesCobro && fmtM && gastos ? fmtM(mesCobro(co, gastos)) : (gAsoc ? fmtM(gAsoc.mes) : "—");
            raw.push({
              sortKey: ledgerSortKey(ymd, co.hora || "12:00:00", 2, co.id),
              fechaYmd: ymd,
              desc: "COBRO",
              descStyle: cellCobro,
              obs: ["Pago", periodoStr !== "—" ? `Período ${periodoStr}` : "", co.metodo || "", co.codigo ? `Cód. ${co.codigo}` : ""].filter(Boolean).join(" · ") || "General",
              moneda: "USD",
              delta: -monto,
            });
          });
          (curGars || []).forEach((gr) => {
            const gastoAsoc = gr.gastoId ? gastos.find((x) => x.id === gr.gastoId) : null;
            const ymd = (gr.fechaColocacion && String(gr.fechaColocacion).slice(0, 10))
              || (gr.created_at && String(gr.created_at).slice(0, 10))
              || "1970-01-01";
            const valor = parseFloat(gr.valor || 0);
            const vigente = gr.estado === "Vigente";
            const mesRes = (gr.periodoResumen && String(gr.periodoResumen).trim())
              ? String(gr.periodoResumen).slice(0, 7)
              : (gastoAsoc?.mes || "");
            const mesStr = mesRes && fmtM ? fmtM(mesRes) : "—";
            raw.push({
              sortKey: ledgerSortKey(ymd, "00:00:02", 3, gr.id),
              fechaYmd: ymd,
              desc: "GARANTÍA",
              descStyle: cellGar,
              obs: [gr.tipo || "", gr.desc || "", mesStr !== "—" ? `Mes resumen ${mesStr}` : "", gr.estado || ""].filter(Boolean).join(" · ") || "General",
              moneda: "USD",
              delta: vigente ? -valor : 0,
              garantiaSinEfecto: !vigente && valor > 0,
              garantiaValorRef: valor,
            });
          });
          raw.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
          let run = 0;
          const rows = raw.map((r, i) => {
            run += r.delta;
            return { ...r, n: i + 1, saldo: run };
          });
          return (
            <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 14, overflow: "hidden" }}>
              <p style={{ margin: "0 0 12px", padding: "0 4px", fontSize: 11.5, color: "#5f6577" }}>
                Movimientos del período seleccionado (o todos), en orden cronológico. <strong>Importe</strong>: gastos y fee suman al saldo; <strong>cobros</strong> y <strong>garantías vigentes</strong> restan. La columna <strong>Saldo</strong> es el acumulado fila a fila.
              </p>
              <TableScrollWrap className="hm-table-wrap hm-table-detail" autoFocusScroll={effectiveTab === "todos"}>
                <table>
                  <thead>
                    <tr>
                      {["N°", "Fecha", "Descripción", "Obs.", "Moneda", "Importe", "Saldo"].map((h) => (
                        <th key={h} style={TH}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {!rows.length && <Empty cols={7} msg="Sin movimientos en este período" />}
                    {rows.map((r) => (
                      <tr key={r.sortKey}>
                        <td style={{ ...TD, ...MN }}>{r.n}</td>
                        <td style={{ ...TD, fontWeight: 600 }}>{fmtDD ? fmtDD(r.fechaYmd) : r.fechaYmd}</td>
                        <td style={{ ...TD, fontWeight: 700, ...r.descStyle }}>{r.desc}</td>
                        <td style={{ ...TD, fontSize: 12.5, color: "#5f6577", maxWidth: 280 }}>{r.obs}</td>
                        <td style={{ ...TD, ...MN }}>{r.moneda}</td>
                        <td style={{ ...TD, ...MN, fontWeight: 700, verticalAlign: "top" }}>
                          {r.garantiaSinEfecto ? (
                            <>
                              <span style={{ color: "#5f6577" }}>${fmt(r.garantiaValorRef)}</span>
                              <span style={{ fontSize: 10, fontWeight: 600, color: "#9498a8", display: "block", marginTop: 2 }}>Sin efecto en saldo (no vigente)</span>
                            </>
                          ) : (
                            <span style={{ color: r.delta > 0 ? "#1a1d26" : r.delta < 0 ? "#059669" : "#9498a8" }}>
                              {r.delta === 0 ? "$0" : r.delta < 0 ? `-$${fmt(Math.abs(r.delta))}` : `$${fmt(r.delta)}`}
                            </span>
                          )}
                        </td>
                        <td style={{ ...TD, ...MN, fontWeight: 700, color: r.saldo > 0 ? "#c2410c" : r.saldo < 0 ? "#059669" : "#1a1d26" }}>${fmt(r.saldo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScrollWrap>
            </div>
          );
        })(),
        effectiveTab === "gastos" && (() => {
          const headers = ["Fecha (dd/mm/aaaa)", "Período (mm/aaaa)", "Campaña", "Gasto", "Fee %", "Fee $", "Total", "Vouchers"];
          const voucherPathsForGasto = (gastoId) => {
            const paths = [];
            let cobroId = null;
            (curCobros || []).forEach((co) => {
              if (co.gastoId !== gastoId) return;
              const ps = co.comprobante_urls || [];
              if (ps.length && cobroId == null) cobroId = co.id;
              ps.forEach((p) => paths.push(p));
            });
            return { paths, cobroId };
          };
          const byMes = {};
          (curGastos || []).forEach((g) => {
            const m = g.mes || "";
            if (!byMes[m]) byMes[m] = [];
            byMes[m].push(g);
          });
          const periods = Object.keys(byMes).filter(Boolean).sort().reverse();
          const totalAll = { gasto: 0, fee: 0, total: 0 };
          const rowTotal = (list) => {
            const t = { gasto: 0, fee: 0, total: 0 };
            list.forEach((g) => {
              t.gasto += parseFloat(g.gasto || 0);
              t.fee += g._f || 0;
              t.total += g._t || 0;
            });
            return t;
          };
          const subRowStyle = { ...TD, background: "#f8f9fb", fontWeight: 700, borderTop: "2px solid #e2e4e9" };
          const totalRowStyle = { ...TD, background: "linear-gradient(135deg, #ea580c, #c2410c)", color: "#fff", fontWeight: 700, borderTop: "2px solid #9a3412", padding: "12px 18px" };
          return (
            <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 14, overflow: "hidden" }}>
              <p style={{ margin: "0 0 12px", padding: "0 4px", fontSize: 11.5, color: "#5f6577" }}>
                Los <strong>vouchers</strong> son los comprobantes subidos en los <strong>cobros</strong> asociados a cada gasto (misma fila / mismo código de gasto).
              </p>
              <TableScrollWrap className="hm-table-wrap hm-table-detail" autoFocusScroll={effectiveTab === "gastos"}>
                <table>
                  <thead><tr>{headers.map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead>
                  <tbody>
                    {!curGastos.length && <Empty cols={8} msg="Sin gastos" />}
                    {curGastos.length > 0 && periods.map((mes) => {
                      const list = byMes[mes];
                      const t = rowTotal(list);
                      totalAll.gasto += t.gasto;
                      totalAll.fee += t.fee;
                      totalAll.total += t.total;
                      return (
                        <React.Fragment key={mes}>
                          {list.map((g) => {
                            const { paths, cobroId } = voucherPathsForGasto(g.id);
                            const nPaths = paths.length;
                            return (
                              <tr key={g.id}>
                                <td style={{ ...TD, fontWeight: 600 }}>{fmtDD ? fmtDD(g.fechaMovimiento) : (g.fechaMovimiento || "—")}</td>
                                <td style={TD}>{fmtM(g.mes)}</td>
                                <td style={TD}>{g.camp || "—"}</td>
                                <td style={{ ...TD, ...MN }}>${fmt(g.gasto)}</td>
                                <td style={{ ...TD, ...MN, color: "#2563eb" }}>{g.fee}%</td>
                                <td style={{ ...TD, ...MN, color: "#2563eb" }}>${fmt(g._f)}</td>
                                <td style={{ ...TD, ...MN, fontWeight: 700 }}>${fmt(g._t)}</td>
                                <td style={TD}>
                                  {nPaths > 0 && setComprobanteViewer && cobroId ? (
                                    <button
                                      type="button"
                                      onClick={() => setComprobanteViewer({ type: "cobro", id: cobroId, paths })}
                                      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", border: "1px solid #e2e4e9", borderRadius: 8, background: "#eff6ff", color: "#2563eb", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                                      title={`Ver ${nPaths} voucher(s) de cobros de este gasto`}
                                    >
                                      <Paperclip size={14} />
                                      Ver {nPaths}
                                    </button>
                                  ) : (
                                    <span style={{ fontSize: 11.5, color: "#9498a8" }}>—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                          <tr>
                            <td style={{ ...subRowStyle, color: "#5f6577", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }} colSpan={2}>Total {fmtM(mes)}</td>
                            <td style={subRowStyle}>—</td>
                            <td style={{ ...subRowStyle, ...MN }}>${fmt(t.gasto)}</td>
                            <td style={subRowStyle}>—</td>
                            <td style={{ ...subRowStyle, ...MN, color: "#2563eb" }}>${fmt(t.fee)}</td>
                            <td style={{ ...subRowStyle, ...MN }}>${fmt(t.total)}</td>
                            <td style={subRowStyle}>—</td>
                          </tr>
                        </React.Fragment>
                      );
                    })}
                    {curGastos.length > 0 && periods.length > 0 && (
                      <tr>
                        <td style={{ ...totalRowStyle, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8 }} colSpan={2}>Total general</td>
                        <td style={totalRowStyle}>—</td>
                        <td style={totalRowStyle}>${fmt(totalAll.gasto)}</td>
                        <td style={totalRowStyle}>—</td>
                        <td style={{ ...totalRowStyle, opacity: 0.95 }}>${fmt(totalAll.fee)}</td>
                        <td style={totalRowStyle}>${fmt(totalAll.total)}</td>
                        <td style={totalRowStyle}>—</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </TableScrollWrap>
            </div>
          );
        })(),
        effectiveTab === "cobros" && (
          <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 14, overflow: "hidden" }}>
            <p style={{ margin: "0 0 12px", padding: "0 4px", fontSize: 11.5, color: "#5f6577" }}>
              Cada fila es un pago: <strong>Fecha de pago</strong> (día en que se realizó), <strong>Período que cubre</strong> (mes al que se aplica) y <strong>Comprobantes</strong> (vouchers o capturas subidos). Podés abrir los archivos desde el botón en la columna Comprobantes.
            </p>
            <TableScrollWrap className="hm-table-wrap hm-table-detail" autoFocusScroll={effectiveTab === "cobros"}>
              <table>
                <thead>
                  <tr>
                    {["Fecha de pago", "Hora", "Cód. cobro", "Cód. gasto", "Período que cubre", "Monto", "Método", "Comprobantes", ...(!isCliente ? ["Registrado por", "Registrado"] : []), "Notas"].map((h) => <th key={h} style={TH}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {curCobros.map((co) => {
                    const g = gastos.find((x) => x.id === co.gastoId);
                    const periodoStr = mesCobro && fmtM && gastos ? fmtM(mesCobro(co, gastos)) : (g ? fmtM(g.mes) : "—");
                    const paths = co.comprobante_urls || [];
                    const nPaths = paths.length;
                    return (
                      <tr key={co.id}>
                        <td style={{ ...TD, fontWeight: 600 }} title="Día en que se realizó el pago">{fmtD(co.fecha)}</td>
                        <td style={TD}>{fmtT ? fmtT(co.hora) : (co.hora || "—")}</td>
                        <td style={{ ...TD, fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, color: "#c2410c" }}>{co.codigo || "—"}</td>
                        <td style={{ ...TD, fontFamily: "var(--font-mono)", fontSize: 11, color: "#5f6577" }}>{g?.codigo || "—"}</td>
                        <td style={{ ...TD, color: "#c2410c", fontWeight: 600 }} title="Mes al que se aplica este pago">{periodoStr}</td>
                        <td style={{ ...TD, ...MN, color: "#0d9f6e", fontWeight: 700 }}>+${fmt(co.monto)}</td>
                        <td style={TD}><PayB method={co.metodo} /></td>
                        <td style={TD}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
                            <div style={{ fontSize: 11, color: "#5f6577", lineHeight: 1.3 }}>
                              <span style={{ fontWeight: 600, color: "#1a1d26" }}>Pago:</span> {fmtD(co.fecha)}
                              {periodoStr && periodoStr !== "—" && <><span style={{ margin: "0 4px" }}>·</span><span style={{ fontWeight: 600, color: "#1a1d26" }}>Período:</span> {periodoStr}</>}
                            </div>
                            {nPaths > 0 && setComprobanteViewer ? (
                              <button
                                type="button"
                                onClick={() => setComprobanteViewer({ type: "cobro", id: co.id, paths })}
                                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", border: "1px solid #e2e4e9", borderRadius: 8, background: "#eff6ff", color: "#2563eb", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                                title={`Ver ${nPaths} comprobante(s) de pago · ${fmtD(co.fecha)} · Período ${periodoStr} · $${fmt(co.monto)}`}
                              >
                                <Paperclip size={14} />
                                Ver {nPaths} comprobante{nPaths !== 1 ? "s" : ""}
                              </button>
                            ) : (
                              <span style={{ fontSize: 11.5, color: "#9498a8" }}>— Sin voucher</span>
                            )}
                          </div>
                        </td>
                        {!isCliente && <td style={{ ...TD, fontSize: 12, color: "#5f6577" }} title={co.created_by || ""}>{co.created_by ? (co.created_by.length > 18 ? co.created_by.slice(0, 16) + "…" : co.created_by) : "—"}</td>}
                        {!isCliente && <td style={{ ...TD, fontSize: 11.5, color: "#9498a8" }}>{co.created_at && fmtDt ? fmtDt(co.created_at) : "—"}</td>}
                        <td style={{ ...TD, fontSize: 12.5, color: "#9498a8" }}>{co.notas || "—"}</td>
                      </tr>
                    );
                  })}
                  {!curCobros.length && <Empty cols={isCliente ? 9 : 11} msg="Sin cobros" />}
                </tbody>
              </table>
            </TableScrollWrap>
          </div>
        ),
        effectiveTab === "garantias" && (
          <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 14, overflow: "hidden" }}>
            <p style={{ margin: "0 0 12px", padding: "0 4px", fontSize: 11.5, color: "#5f6577" }}>
              Mismo período que Cobros y Gastos (filtro de arriba). La columna <strong>Mes en resumen</strong> es el mes que usa el sistema para el resumen. En <strong>Vouchers</strong> podés abrir las imágenes o PDFs subidos.
            </p>
            <TableScrollWrap className="hm-table-wrap hm-table-detail" autoFocusScroll={effectiveTab === "garantias"}>
              <table>
                <thead>
                  <tr>
                    {["Tipo", "Descripción", "Valor", "Estado", "Mes en resumen", "Vouchers"].map((h) => (
                      <th key={h} style={TH}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {curGars.map((g) => {
                    const gastoAsoc = g.gastoId ? gastos.find((x) => x.id === g.gastoId) : null;
                    const mesRes = (g.periodoResumen && String(g.periodoResumen).trim())
                      ? String(g.periodoResumen).slice(0, 7)
                      : (gastoAsoc?.mes || (g.fechaColocacion ? String(g.fechaColocacion).slice(0, 7) : (g.created_at ? String(g.created_at).slice(0, 7) : "")));
                    const paths = g.imagen_urls || [];
                    const nPaths = paths.length;
                    const mesResStr = mesRes && fmtM ? fmtM(mesRes) : "—";
                    return (
                      <tr key={g.id}>
                        <td style={TD}><Bdg type="gar">{g.tipo}</Bdg></td>
                        <td style={{ ...TD, color: "#5f6577" }}>{g.desc || "—"}</td>
                        <td style={{ ...TD, ...MN }}>${fmt(g.valor)}</td>
                        <td style={TD}><Bdg type={g.estado === "Vigente" ? "ok" : g.estado === "Ejecutada" ? "err" : "n"}>{g.estado}</Bdg></td>
                        <td style={{ ...TD, fontWeight: 600 }}>{mesResStr}</td>
                        <td style={TD}>
                          {nPaths > 0 && setComprobanteViewer ? (
                            <button
                              type="button"
                              onClick={() => setComprobanteViewer({ type: "garantia", id: g.id, paths })}
                              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", border: "1px solid #ddd6fe", borderRadius: 8, background: "linear-gradient(135deg, #f5f3ff, #ede9fe)", color: "#6d28d9", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                              title={`Ver ${nPaths} voucher(s) · ${g.tipo || "Garantía"} · $${fmt(g.valor)}`}
                            >
                              <Paperclip size={14} />
                              Ver {nPaths}
                            </button>
                          ) : (
                            <span style={{ fontSize: 11.5, color: "#9498a8" }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {!curGars.length && <Empty cols={6} msg="Sin garantías" />}
                </tbody>
              </table>
            </TableScrollWrap>
          </div>
        ),
        <Slot content={manualTabContent} />,
        <div style={{ marginTop: 28, marginBottom: 24 }}>
          {cCharts.m?.length > 0 && (
            <p style={{ fontSize: 12, color: "#9498a8", margin: "0 0 8px" }}>
              Período de los gráficos: <strong style={{ color: "#5f6577" }}>{cCharts.m[0]?.name}</strong> a <strong style={{ color: "#5f6577" }}>{cCharts.m[cCharts.m.length - 1]?.name}</strong> (últimos 6 meses)
            </p>
          )}
          <div className="hm-detail-charts" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 14, padding: "20px 22px" }}><h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Gasto Mensual</h4><ResponsiveContainer width="100%" height={200}><BarChart data={cCharts.m}><CartesianGrid strokeDasharray="3 3" stroke="#eff0f3" /><XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9498a8" }} /><YAxis tick={{ fontSize: 11, fill: "#9498a8" }} /><Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} /><Legend wrapperStyle={{ fontSize: 11 }} /><Bar dataKey="gasto" name="Ads" fill="#2563eb" radius={[6, 6, 0, 0]} /><Bar dataKey="fee" name="Fee" fill="#7c3aed" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>
            <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 14, padding: "20px 22px" }}><h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Cobros Recibidos</h4><ResponsiveContainer width="100%" height={200}><LineChart data={cCharts.co}><CartesianGrid strokeDasharray="3 3" stroke="#eff0f3" /><XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9498a8" }} /><YAxis tick={{ fontSize: 11, fill: "#9498a8" }} /><Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} /><Line type="monotone" dataKey="cobrado" name="Cobrado" stroke="#0d9f6e" strokeWidth={2.5} dot={{ r: 5, fill: "#0d9f6e" }} /></LineChart></ResponsiveContainer></div>
          </div>
        </div>,
        <span hidden />
      )
    )
  );
}

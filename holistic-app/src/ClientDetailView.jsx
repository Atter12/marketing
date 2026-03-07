import React, { useState, useEffect } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { CreditCard, Plus, ChevronLeft, ChevronRight, Edit3, Camera, Trash2, KeyRound, Download, Paperclip } from "lucide-react";

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

  const handleSavePhoto = async () => {
    if (!updateClientAvatar) return;
    setSavingPhoto(true);
    try {
      await updateClientAvatar(photoUrl.trim() || null);
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
        <div style={{ fontSize: 13, color: "#9498a8", minWidth: 0 }}>{!isCliente && <><span onClick={() => goTo("clientes")} style={{ cursor: "pointer" }}>Clientes</span> › </>}<span style={{ color: "#1a1d26", fontWeight: 600 }}>{curC.name}</span>{curC.codigo && <span style={{ marginLeft: 8, fontSize: 12, color: "#5f6577", fontFamily: "'IBM Plex Mono',monospace" }}>{curC.codigo}</span>}</div>
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
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", background: "#1b2559", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: uploadingFile ? "wait" : "pointer" }}>
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
          <div style={{ minWidth: 0 }}><h2 style={{ fontSize: 22, fontWeight: 700 }}>{curC.name}</h2>{curC.codigo && <div style={{ fontSize: 12, color: "#5f6577", fontFamily: "'IBM Plex Mono',monospace", marginTop: 2, fontWeight: 600 }}>Código: {curC.codigo}</div>}<div style={{ display: "flex", flexWrap: "wrap", gap: 14, fontSize: 13, color: "#9498a8", marginTop: 2 }}>{curC.ig && <span style={{ color: "#e1306c" }}>📷 {curC.ig}</span>}{(curC.phones || []).filter(Boolean).map((p, i) => <span key={i}>📱 {p}</span>)}{(curC.emails || []).filter(Boolean).map((e, i) => <span key={i}>✉ {e}</span>)}{curC.biz && <span>🏢 {curC.biz}</span>}</div></div>
        </div>,
        setClientDetailPeriodo && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "#5f6577" }}>Filtrar por período (mes):</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <button type="button" onClick={() => { const base = clientDetailPeriodo || tm(); const [y, m] = base.split("-").map(Number); const d = new Date(y, m - 2, 1); setClientDetailPeriodo(d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0")); }} style={{ width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #e2e4e9", borderRadius: 8, background: "#fff", color: "#1b2559", cursor: "pointer", flexShrink: 0 }} title="Mes anterior"><ChevronLeft size={16} /></button>
            <div style={{ minWidth: 90, textAlign: "center", padding: "6px 12px", background: "#f8f9fb", border: "1px solid #e2e4e9", borderRadius: 8, fontSize: 12.5, fontWeight: 600, color: clientDetailPeriodo ? "#1b2559" : "#9498a8" }}>{clientDetailPeriodo ? (fmtM ? fmtM(clientDetailPeriodo) : clientDetailPeriodo) : "Todos"}</div>
            <button type="button" onClick={() => { const base = clientDetailPeriodo || tm(); const [y, m] = base.split("-").map(Number); const d = new Date(y, m, 1); setClientDetailPeriodo(d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0")); }} style={{ width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #e2e4e9", borderRadius: 8, background: "#fff", color: "#1b2559", cursor: "pointer", flexShrink: 0 }} title="Mes siguiente"><ChevronRight size={16} /></button>
            <input type="text" placeholder="0125, 02/25, MM/AAAA" value={clientDetailPeriodo} onChange={(e) => setClientDetailPeriodo(e.target.value)} onBlur={(e) => { const p = parsePeriodoInput && parsePeriodoInput(e.target.value); if (p) setClientDetailPeriodo(p); }} onKeyDown={(e) => { if (e.key === "Enter" && parsePeriodoInput) { e.preventDefault(); const p = parsePeriodoInput(e.currentTarget.value); if (p) setClientDetailPeriodo(p); e.currentTarget.blur(); } }} style={{ width: 95, boxSizing: "border-box", padding: "6px 10px", border: "1px solid #e2e4e9", borderRadius: 8, fontFamily: "'DM Sans',sans-serif", fontSize: 12, outline: "none" }} title="Escribí 0125, 02/25 o MM/AAAA" />
            {clientDetailPeriodo && <button type="button" onClick={() => setClientDetailPeriodo("")} style={{ padding: "5px 10px", border: "1px solid #e2e4e9", borderRadius: 8, background: "#fff", color: "#9498a8", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Todos</button>}
          </div>
          <span style={{ fontSize: 11, color: "#9498a8" }}>Todo el resumen (tarjetas y tablas) se filtra por período (mes), no por fecha de pago. Cobros: se usa el mes en que cuenta cada pago.</span>
        </div>
        ),
        <div className="hm-detail-stats" style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 14, marginBottom: 24 }}>
          <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 10, padding: "18px 20px" }}><div style={{ fontSize: 11, fontWeight: 600, color: "#9498a8", textTransform: "uppercase", letterSpacing: .8, marginBottom: 8 }}>Gasto Ads</div><div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 22, fontWeight: 700 }}>${fmt(curD.tG)}</div></div>
          <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 10, padding: "18px 20px" }}><div style={{ fontSize: 11, fontWeight: 600, color: "#9498a8", textTransform: "uppercase", letterSpacing: .8, marginBottom: 8 }}>Fees</div><div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 22, fontWeight: 700, color: "#0055ff" }}>${fmt(curD.tF)}</div></div>
          <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 10, padding: "18px 20px" }}><div style={{ fontSize: 11, fontWeight: 600, color: "#9498a8", textTransform: "uppercase", letterSpacing: .8, marginBottom: 8 }}>Total</div><div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 22, fontWeight: 700, color: "#d97706" }}>${fmt((curD.tG || 0) + (curD.tF || 0))}</div></div>
          <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 10, padding: "18px 20px" }}><div style={{ fontSize: 11, fontWeight: 600, color: "#9498a8", textTransform: "uppercase", letterSpacing: .8, marginBottom: 8 }}>Cobrado</div><div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 22, fontWeight: 700, color: "#0d9f6e" }}>${fmt(curD.tP)}</div><div style={{ height: 5, background: "#eff0f3", borderRadius: 3, marginTop: 10, overflow: "hidden" }}><div style={{ height: "100%", borderRadius: 3, background: "#0d9f6e", width: Math.min(100, pct) + "%", transition: "width .5s" }} /></div></div>
          <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 10, padding: "18px 20px" }}><div style={{ fontSize: 11, fontWeight: 600, color: "#9498a8", textTransform: "uppercase", letterSpacing: .8, marginBottom: 8 }}>Garantías</div><div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 22, fontWeight: 700, color: "#7c3aed" }}>{curD.tGar > 0 ? "-$" + fmt(curD.tGar) : "$0"}</div></div>
          <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 10, padding: "18px 20px" }}><div style={{ fontSize: 11, fontWeight: 600, color: "#9498a8", textTransform: "uppercase", letterSpacing: .8, marginBottom: 8 }}>Deuda Neta</div><div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 22, fontWeight: 700, color: curD.net > 0 ? "#dc2640" : "#0d9f6e" }}>${fmt(curD.net)}</div></div>
        </div>,
        <div className="hm-detail-tabs" style={{ display: "flex", gap: 2, background: "#f4f5f7", borderRadius: 9, padding: 3, width: "fit-content", marginBottom: 8 }}>
          {([["gastos", "Gastos Ads"], ["cobros", "Cobros"], ["garantias", "Garantías"]].filter(([k]) => isCliente ? k !== "cobros" : true)).map(([k, l]) => <button key={k} onClick={() => setDetailTab(k)} style={{ padding: "7px 18px", border: "none", background: effectiveTab === k ? "#fff" : "transparent", color: effectiveTab === k ? "#1a1d26" : "#9498a8", fontFamily: "'DM Sans'", fontSize: 12.5, fontWeight: 600, borderRadius: 7, cursor: "pointer", boxShadow: effectiveTab === k ? "0 1px 2px rgba(0,0,0,.04)" : "none" }}>{l}</button>)}
        </div>,
        onExportClientPorPeriodo && (
        <div style={{ marginBottom: 20, padding: "14px 18px", background: "#f8f9fb", border: "1px solid #e2e4e9", borderRadius: 12 }}>
          <p style={{ fontSize: 12.5, fontWeight: 600, color: "#5f6577", margin: "0 0 10px" }}>Descargar según el período mostrado arriba</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" onClick={() => onExportClientPorPeriodo(true, false)} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 16px", border: "1px solid #0d9f6e", borderRadius: 8, background: "#eafaf4", color: "#0d9f6e", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}><Download size={16} /> Descargar Excel</button>
            <button type="button" onClick={() => onExportClientPorPeriodo(false, true)} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 16px", border: "1px solid #dc2640", borderRadius: 8, background: "#fdf0f2", color: "#dc2640", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}><Download size={16} /> Descargar PDF</button>
          </div>
        </div>
        ),
        effectiveTab === "gastos" && (() => {
          const headers = ["Fecha (dd/mm/aaaa)", "Período (mm/aaaa)", "Campaña", "Gasto", "Fee %", "Fee $", "Total", "Pagado", "Pendiente", "Estado", "Prepago"];
          const byMes = {};
          (curGastos || []).forEach((g) => {
            const m = g.mes || "";
            if (!byMes[m]) byMes[m] = [];
            byMes[m].push(g);
          });
          const periods = Object.keys(byMes).filter(Boolean).sort().reverse();
          const totalAll = { gasto: 0, fee: 0, total: 0, pagado: 0, pendiente: 0 };
          const rowTotal = (list) => {
            const t = { gasto: 0, fee: 0, total: 0, pagado: 0, pendiente: 0 };
            list.forEach((g) => {
              t.gasto += parseFloat(g.gasto || 0);
              t.fee += g._f || 0;
              t.total += g._t || 0;
              t.pagado += g._p || 0;
              t.pendiente += g._pend || 0;
            });
            return t;
          };
          const subRowStyle = { ...TD, background: "#f8f9fb", fontWeight: 700, borderTop: "2px solid #e2e4e9" };
          const totalRowStyle = { ...TD, background: "#1b2559", color: "#fff", fontWeight: 700, borderTop: "2px solid #0d1117", padding: "12px 18px" };
          return (
            <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 14, overflow: "hidden" }}>
              <div className="hm-table-wrap hm-table-detail">
                <table>
                  <thead><tr>{headers.map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead>
                  <tbody>
                    {!curGastos.length && <Empty cols={11} msg="Sin gastos" />}
                    {curGastos.length > 0 && periods.map((mes) => {
                      const list = byMes[mes];
                      const t = rowTotal(list);
                      totalAll.gasto += t.gasto;
                      totalAll.fee += t.fee;
                      totalAll.total += t.total;
                      totalAll.pagado += t.pagado;
                      totalAll.pendiente += t.pendiente;
                      return (
                        <React.Fragment key={mes}>
                          {list.map((g) => (
                            <tr key={g.id}>
                              <td style={{ ...TD, fontWeight: 600 }}>{fmtDD ? fmtDD(g.fechaMovimiento) : (g.fechaMovimiento || "—")}</td>
                              <td style={TD}>{fmtM(g.mes)}</td>
                              <td style={TD}>{g.camp || "—"}</td>
                              <td style={{ ...TD, ...MN }}>${fmt(g.gasto)}</td>
                              <td style={{ ...TD, ...MN, color: "#0055ff" }}>{g.fee}%</td>
                              <td style={{ ...TD, ...MN, color: "#0055ff" }}>${fmt(g._f)}</td>
                              <td style={{ ...TD, ...MN, fontWeight: 700 }}>${fmt(g._t)}</td>
                              <td style={{ ...TD, ...MN, color: "#0d9f6e" }}>${fmt(g._p)}</td>
                              <td style={{ ...TD, ...MN, color: "#dc2640" }}>${fmt(g._pend)}</td>
                              <td style={TD}><Bdg type={g._st === "Pagado" ? "ok" : g._st === "Parcial" ? "warn" : "acc"}>{g._st}</Bdg></td>
                              <td style={TD}>{g.prepago ? "S" : "N"}</td>
                            </tr>
                          ))}
                          <tr>
                            <td style={{ ...subRowStyle, color: "#5f6577", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }} colSpan={2}>Total {fmtM(mes)}</td>
                            <td style={subRowStyle}>—</td>
                            <td style={{ ...subRowStyle, ...MN }}>${fmt(t.gasto)}</td>
                            <td style={subRowStyle}>—</td>
                            <td style={{ ...subRowStyle, ...MN, color: "#0055ff" }}>${fmt(t.fee)}</td>
                            <td style={{ ...subRowStyle, ...MN }}>${fmt(t.total)}</td>
                            <td style={{ ...subRowStyle, ...MN, color: "#0d9f6e" }}>${fmt(t.pagado)}</td>
                            <td style={{ ...subRowStyle, ...MN, color: "#dc2640" }}>${fmt(t.pendiente)}</td>
                            <td style={subRowStyle} colSpan={2}>—</td>
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
                        <td style={{ ...totalRowStyle, color: "#86efac" }}>${fmt(totalAll.pagado)}</td>
                        <td style={{ ...totalRowStyle, color: "#fca5a5" }} title={curD.tGar > 0 ? `Pendiente bruto: $${fmt(totalAll.pendiente)} − Garantías: $${fmt(curD.tGar)} = Pend. neto` : ""}>${fmt(Math.max(0, totalAll.pendiente - (curD.tGar || 0)))}</td>
                        <td style={totalRowStyle} colSpan={2}>—</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })(),
        effectiveTab === "cobros" && (
          <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 14, overflow: "hidden" }}>
            <p style={{ margin: "0 0 12px", padding: "0 4px", fontSize: 11.5, color: "#5f6577" }}>
              Cada fila es un pago: <strong>Fecha de pago</strong> (día en que se realizó), <strong>Período que cubre</strong> (mes al que se aplica) y <strong>Comprobantes</strong> (vouchers o capturas subidos). Podés abrir los archivos desde el botón en la columna Comprobantes.
            </p>
            <div className="hm-table-wrap hm-table-detail">
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
                        <td style={{ ...TD, fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, fontWeight: 600, color: "#1b2559" }}>{co.codigo || "—"}</td>
                        <td style={{ ...TD, fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "#5f6577" }}>{g?.codigo || "—"}</td>
                        <td style={{ ...TD, color: "#1b2559", fontWeight: 600 }} title="Mes al que se aplica este pago">{periodoStr}</td>
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
                                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", border: "1px solid #e2e4e9", borderRadius: 8, background: "#f0f4ff", color: "#0055ff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
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
            </div>
          </div>
        ),
        effectiveTab === "garantias" && <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 14, overflow: "hidden" }}><p style={{ margin: "0 0 12px", padding: "0 4px", fontSize: 11.5, color: "#5f6577" }}>Mismo período que Cobros y Gastos (filtro de arriba).</p><div className="hm-table-wrap hm-table-detail"><table><thead><tr>{["Tipo", "Descripción", "Valor", "Estado", "Fecha colocación", "Registrado por", "Registrado", "Cód. verificación", "Cód. gasto", "Gasto ($)"].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead><tbody>{curGars.map((g) => { const gastoAsoc = g.gastoId ? gastos.find((x) => x.id === g.gastoId) : null; const createdByStr = g.created_by ? (g.created_by.length > 18 ? g.created_by.slice(0, 16) + "…" : g.created_by) : "—"; return <tr key={g.id}><td style={TD}><Bdg type="gar">{g.tipo}</Bdg></td><td style={{ ...TD, color: "#5f6577" }}>{g.desc || "—"}</td><td style={{ ...TD, ...MN }}>${fmt(g.valor)}</td><td style={TD}><Bdg type={g.estado === "Vigente" ? "ok" : g.estado === "Ejecutada" ? "err" : "n"}>{g.estado}</Bdg></td><td style={TD}>{g.fechaColocacion && fmtD ? fmtD(g.fechaColocacion) : "—"}</td><td style={{ ...TD, fontSize: 12, color: "#5f6577" }} title={g.created_by || ""}>{createdByStr}</td><td style={{ ...TD, fontSize: 11.5, color: "#9498a8" }}>{g.created_at && fmtDt ? fmtDt(g.created_at) : "—"}</td><td style={{ ...TD, fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "#1b2559" }}>{g.codigoVerificacion || "—"}</td><td style={{ ...TD, fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "#5f6577" }}>{gastoAsoc?.codigo || "—"}</td><td style={{ ...TD, ...MN }}>{gastoAsoc != null ? "$" + fmt(gastoAsoc.gasto) : "—"}</td></tr>; })}{!curGars.length && <Empty cols={10} msg="Sin garantías" />}</tbody></table></div></div>,
        <Slot content={manualTabContent} />,
        <div style={{ marginTop: 28, marginBottom: 24 }}>
          {cCharts.m?.length > 0 && (
            <p style={{ fontSize: 12, color: "#9498a8", margin: "0 0 8px" }}>
              Período de los gráficos: <strong style={{ color: "#5f6577" }}>{cCharts.m[0]?.name}</strong> a <strong style={{ color: "#5f6577" }}>{cCharts.m[cCharts.m.length - 1]?.name}</strong> (últimos 6 meses)
            </p>
          )}
          <div className="hm-detail-charts" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 14, padding: "20px 22px" }}><h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Gasto Mensual</h4><ResponsiveContainer width="100%" height={200}><BarChart data={cCharts.m}><CartesianGrid strokeDasharray="3 3" stroke="#eff0f3" /><XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9498a8" }} /><YAxis tick={{ fontSize: 11, fill: "#9498a8" }} /><Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} /><Legend wrapperStyle={{ fontSize: 11 }} /><Bar dataKey="gasto" name="Ads" fill="#0055ff" radius={[6, 6, 0, 0]} /><Bar dataKey="fee" name="Fee" fill="#7c3aed" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>
            <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 14, padding: "20px 22px" }}><h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Cobros Recibidos</h4><ResponsiveContainer width="100%" height={200}><LineChart data={cCharts.co}><CartesianGrid strokeDasharray="3 3" stroke="#eff0f3" /><XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9498a8" }} /><YAxis tick={{ fontSize: 11, fill: "#9498a8" }} /><Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} /><Line type="monotone" dataKey="cobrado" name="Cobrado" stroke="#0d9f6e" strokeWidth={2.5} dot={{ r: 5, fill: "#0d9f6e" }} /></LineChart></ResponsiveContainer></div>
          </div>
        </div>,
        <span hidden />
      )
    )
  );
}

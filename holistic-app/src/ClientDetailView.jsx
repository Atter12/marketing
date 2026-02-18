import React, { useState, useEffect } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { CreditCard, Plus, ChevronLeft, Edit3, Camera, Trash2, KeyRound, Download } from "lucide-react";

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
    onExportClient,
    expClientRango,
    setExpClientRango,
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
        <div style={{ fontSize: 13, color: "#9498a8", minWidth: 0 }}>{!isCliente && <><span onClick={() => goTo("clientes")} style={{ cursor: "pointer" }}>Clientes</span> › </>}<span style={{ color: "#1a1d26", fontWeight: 600 }}>{curC.name}</span></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {onExportClient && <><div style={{ display: "flex", alignItems: "center", gap: 6 }}><input type="date" value={expClientRango?.ini || ""} onChange={(e) => setExpClientRango?.((p) => ({ ...p, ini: e.target.value }))} style={{ padding: "6px 10px", border: "1px solid #e2e4e9", borderRadius: 8, fontSize: 12, fontFamily: "'DM Sans'", outline: "none" }} /><span style={{ color: "#9498a8", fontSize: 11 }}>a</span><input type="date" value={expClientRango?.fin || ""} onChange={(e) => setExpClientRango?.((p) => ({ ...p, fin: e.target.value }))} style={{ padding: "6px 10px", border: "1px solid #e2e4e9", borderRadius: 8, fontSize: 12, fontFamily: "'DM Sans'", outline: "none" }} /></div><Btn variant="outline" size="sm" onClick={() => onExportClient(expClientRango?.ini, expClientRango?.fin)}><Download size={14} /> Descargar Excel</Btn></>}
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
          <div style={{ minWidth: 0 }}><h2 style={{ fontSize: 22, fontWeight: 700 }}>{curC.name}</h2><div style={{ display: "flex", flexWrap: "wrap", gap: 14, fontSize: 13, color: "#9498a8", marginTop: 2 }}>{curC.ig && <span style={{ color: "#e1306c" }}>📷 {curC.ig}</span>}{(curC.phones || []).filter(Boolean).map((p, i) => <span key={i}>📱 {p}</span>)}{(curC.emails || []).filter(Boolean).map((e, i) => <span key={i}>✉ {e}</span>)}{curC.biz && <span>🏢 {curC.biz}</span>}</div></div>
        </div>,
        <div className="hm-detail-stats" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 24 }}>
          <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 10, padding: "18px 20px" }}><div style={{ fontSize: 11, fontWeight: 600, color: "#9498a8", textTransform: "uppercase", letterSpacing: .8, marginBottom: 8 }}>Gasto Ads</div><div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 22, fontWeight: 700 }}>${fmt(curD.tG)}</div></div>
          <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 10, padding: "18px 20px" }}><div style={{ fontSize: 11, fontWeight: 600, color: "#9498a8", textTransform: "uppercase", letterSpacing: .8, marginBottom: 8 }}>Fees</div><div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 22, fontWeight: 700, color: "#0055ff" }}>${fmt(curD.tF)}</div></div>
          <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 10, padding: "18px 20px" }}><div style={{ fontSize: 11, fontWeight: 600, color: "#9498a8", textTransform: "uppercase", letterSpacing: .8, marginBottom: 8 }}>Cobrado</div><div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 22, fontWeight: 700, color: "#0d9f6e" }}>${fmt(curD.tP)}</div><div style={{ height: 5, background: "#eff0f3", borderRadius: 3, marginTop: 10, overflow: "hidden" }}><div style={{ height: "100%", borderRadius: 3, background: "#0d9f6e", width: Math.min(100, pct) + "%", transition: "width .5s" }} /></div></div>
          <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 10, padding: "18px 20px" }}><div style={{ fontSize: 11, fontWeight: 600, color: "#9498a8", textTransform: "uppercase", letterSpacing: .8, marginBottom: 8 }}>Deuda Neta</div><div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 22, fontWeight: 700, color: curD.net > 0 ? "#dc2640" : "#0d9f6e" }}>${fmt(curD.net)}</div>{curD.tGar > 0 && <div style={{ fontSize: 11, color: "#7c3aed", marginTop: 6 }}>🛡️ Garantías: -${fmt(curD.tGar)}</div>}</div>
        </div>,
        <div style={{ marginBottom: 8 }}>
          {cCharts.m?.length > 0 && (
            <p style={{ fontSize: 12, color: "#9498a8", margin: 0 }}>
              Período de los gráficos: <strong style={{ color: "#5f6577" }}>{cCharts.m[0]?.name}</strong> a <strong style={{ color: "#5f6577" }}>{cCharts.m[cCharts.m.length - 1]?.name}</strong> (últimos 6 meses)
            </p>
          )}
        </div>,
        <div className="hm-detail-charts" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
          <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 14, padding: "20px 22px" }}><h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Gasto Mensual</h4><ResponsiveContainer width="100%" height={200}><BarChart data={cCharts.m}><CartesianGrid strokeDasharray="3 3" stroke="#eff0f3" /><XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9498a8" }} /><YAxis tick={{ fontSize: 11, fill: "#9498a8" }} /><Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} /><Legend wrapperStyle={{ fontSize: 11 }} /><Bar dataKey="gasto" name="Ads" fill="#0055ff" radius={[6, 6, 0, 0]} /><Bar dataKey="fee" name="Fee" fill="#7c3aed" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>
          <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 14, padding: "20px 22px" }}><h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Cobros Recibidos</h4><ResponsiveContainer width="100%" height={200}><LineChart data={cCharts.co}><CartesianGrid strokeDasharray="3 3" stroke="#eff0f3" /><XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9498a8" }} /><YAxis tick={{ fontSize: 11, fill: "#9498a8" }} /><Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} /><Line type="monotone" dataKey="cobrado" name="Cobrado" stroke="#0d9f6e" strokeWidth={2.5} dot={{ r: 5, fill: "#0d9f6e" }} /></LineChart></ResponsiveContainer></div>
        </div>,
        <div className="hm-detail-tabs" style={{ display: "flex", gap: 2, background: "#f4f5f7", borderRadius: 9, padding: 3, width: "fit-content", marginBottom: 22 }}>
          {([["gastos", "Gastos Ads"], ["cobros", "Cobros"], ["garantias", "Garantías"], ["manual", "Datos Manuales"]].filter(([k]) => isCliente ? k !== "cobros" : true)).map(([k, l]) => <button key={k} onClick={() => setDetailTab(k)} style={{ padding: "7px 18px", border: "none", background: effectiveTab === k ? "#fff" : "transparent", color: effectiveTab === k ? "#1a1d26" : "#9498a8", fontFamily: "'DM Sans'", fontSize: 12.5, fontWeight: 600, borderRadius: 7, cursor: "pointer", boxShadow: effectiveTab === k ? "0 1px 2px rgba(0,0,0,.04)" : "none" }}>{l}</button>)}
        </div>,
        effectiveTab === "gastos" && <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 14, overflow: "hidden" }}><div className="hm-table-wrap"><table><thead><tr>{["Fecha (dd/mm/aaaa)", "Período (mm/aaaa)", "Campaña", "Gasto", "Fee %", "Fee $", "Total", "Pagado", "Pendiente", "Estado", "Prepago"].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead><tbody>{curGastos.map((g) => <tr key={g.id}><td style={{ ...TD, fontWeight: 600 }}>{fmtDD ? fmtDD(g.fechaMovimiento) : (g.fechaMovimiento || "—")}</td><td style={TD}>{fmtM(g.mes)}</td><td style={TD}>{g.camp || "—"}</td><td style={{ ...TD, ...MN }}>${fmt(g.gasto)}</td><td style={{ ...TD, ...MN, color: "#0055ff" }}>{g.fee}%</td><td style={{ ...TD, ...MN, color: "#0055ff" }}>${fmt(g._f)}</td><td style={{ ...TD, ...MN, fontWeight: 700 }}>${fmt(g._t)}</td><td style={{ ...TD, ...MN, color: "#0d9f6e" }}>${fmt(g._p)}</td><td style={{ ...TD, ...MN, color: "#dc2640" }}>${fmt(g._pend)}</td><td style={TD}><Bdg type={g._st === "Pagado" ? "ok" : g._st === "Parcial" ? "warn" : "acc"}>{g._st}</Bdg></td><td style={TD}>{g.prepago ? "S" : "N"}</td></tr>)}{!curGastos.length && <Empty cols={11} msg="Sin gastos" />}</tbody></table></div></div>,
        effectiveTab === "cobros" && <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 14, overflow: "hidden" }}><div className="hm-table-wrap"><table><thead><tr>{["Fecha", "Hora", "Cód. cobro", "Cód. gasto", "Ref.", "Monto", "Método", ...(!isCliente ? ["Registrado por", "Registrado"] : []), "Notas"].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead><tbody>{curCobros.map((co) => { const g = gastos.find((x) => x.id === co.gastoId); return <tr key={co.id}><td style={TD}>{fmtD(co.fecha)}</td><td style={TD}>{fmtT ? fmtT(co.hora) : (co.hora || "—")}</td><td style={{ ...TD, fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, fontWeight: 600, color: "#1b2559" }}>{co.codigo || "—"}</td><td style={{ ...TD, fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "#5f6577" }}>{g?.codigo || "—"}</td><td style={TD}>{g ? fmtM(g.mes) : "—"}</td><td style={{ ...TD, ...MN, color: "#0d9f6e", fontWeight: 700 }}>+${fmt(co.monto)}</td><td style={TD}><PayB method={co.metodo} /></td>{!isCliente && <td style={{ ...TD, fontSize: 12, color: "#5f6577" }} title={co.created_by || ""}>{co.created_by ? (co.created_by.length > 18 ? co.created_by.slice(0, 16) + "…" : co.created_by) : "—"}</td>}{!isCliente && <td style={{ ...TD, fontSize: 11.5, color: "#9498a8" }}>{co.created_at && fmtDt ? fmtDt(co.created_at) : "—"}</td>}<td style={{ ...TD, fontSize: 12.5, color: "#9498a8" }}>{co.notas || "—"}</td></tr>; })}{!curCobros.length && <Empty cols={isCliente ? 8 : 10} msg="Sin cobros" />}</tbody></table></div></div>,
        effectiveTab === "garantias" && <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 14, overflow: "hidden" }}><div className="hm-table-wrap"><table><thead><tr>{["Tipo", "Descripción", "Valor", "Estado", "Cód. verificación", "Cód. gasto"].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead><tbody>{curGars.map((g) => { const gastoAsoc = g.gastoId ? gastos.find((x) => x.id === g.gastoId) : null; return <tr key={g.id}><td style={TD}><Bdg type="gar">{g.tipo}</Bdg></td><td style={{ ...TD, color: "#5f6577" }}>{g.desc || "—"}</td><td style={{ ...TD, ...MN }}>${fmt(g.valor)}</td><td style={TD}><Bdg type={g.estado === "Vigente" ? "ok" : g.estado === "Ejecutada" ? "err" : "n"}>{g.estado}</Bdg></td><td style={{ ...TD, fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "#1b2559" }}>{g.codigoVerificacion || "—"}</td><td style={{ ...TD, fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "#5f6577" }}>{gastoAsoc?.codigo || "—"}</td></tr>; })}{!curGars.length && <Empty cols={6} msg="Sin garantías" />}</tbody></table></div></div>,
        <Slot content={manualTabContent} />,
        <span hidden />
      )
    )
  );
}

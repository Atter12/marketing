import React from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { CreditCard, Plus, ChevronLeft, Edit3 } from "lucide-react";

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
    fmtM,
  } = props;

  return React.createElement("section", null,
    <div className="hm-page-header" style={{ background: "#fff", borderBottom: "1px solid #e2e4e9", padding: "0 36px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ fontSize: 13, color: "#9498a8", minWidth: 0 }}><span onClick={() => goTo("clientes")} style={{ cursor: "pointer" }}>Clientes</span> › <span style={{ color: "#1a1d26", fontWeight: 600 }}>{curC.name}</span></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><Btn variant="outline" size="sm" onClick={() => openMdl("client", curCl)}><Edit3 size={14} /> Editar</Btn><Btn size="sm" onClick={() => openMdl("gasto")}><Plus size={14} /> Gasto</Btn><Btn variant="accent" size="sm" onClick={() => openMdl("cobro")}><CreditCard size={14} /> Cobro</Btn></div>
      </div>,
    React.createElement("div", { className: "hm-page-content", style: { padding: "28px 36px 40px" } },
      React.createElement(React.Fragment, null,
        <div onClick={() => goTo("clientes")} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#9498a8", cursor: "pointer", marginBottom: 18 }}><ChevronLeft size={16} /> Volver</div>,
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 28, flexWrap: "wrap" }}><Av name={curC.name} size={56} /><div style={{ minWidth: 0 }}><h2 style={{ fontSize: 22, fontWeight: 700 }}>{curC.name}</h2><div style={{ display: "flex", flexWrap: "wrap", gap: 14, fontSize: 13, color: "#9498a8", marginTop: 2 }}>{curC.ig && <span style={{ color: "#e1306c" }}>📷 {curC.ig}</span>}{(curC.phones || []).filter(Boolean).map((p, i) => <span key={i}>📱 {p}</span>)}{(curC.emails || []).filter(Boolean).map((e, i) => <span key={i}>✉ {e}</span>)}{curC.biz && <span>🏢 {curC.biz}</span>}</div></div></div>,
        <div className="hm-detail-stats" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 24 }}>
          <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 10, padding: "18px 20px" }}><div style={{ fontSize: 11, fontWeight: 600, color: "#9498a8", textTransform: "uppercase", letterSpacing: .8, marginBottom: 8 }}>Gasto Ads</div><div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 22, fontWeight: 700 }}>${fmt(curD.tG)}</div></div>
          <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 10, padding: "18px 20px" }}><div style={{ fontSize: 11, fontWeight: 600, color: "#9498a8", textTransform: "uppercase", letterSpacing: .8, marginBottom: 8 }}>Fees</div><div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 22, fontWeight: 700, color: "#0055ff" }}>${fmt(curD.tF)}</div></div>
          <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 10, padding: "18px 20px" }}><div style={{ fontSize: 11, fontWeight: 600, color: "#9498a8", textTransform: "uppercase", letterSpacing: .8, marginBottom: 8 }}>Cobrado</div><div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 22, fontWeight: 700, color: "#0d9f6e" }}>${fmt(curD.tP)}</div><div style={{ height: 5, background: "#eff0f3", borderRadius: 3, marginTop: 10, overflow: "hidden" }}><div style={{ height: "100%", borderRadius: 3, background: "#0d9f6e", width: Math.min(100, pct) + "%", transition: "width .5s" }} /></div></div>
          <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 10, padding: "18px 20px" }}><div style={{ fontSize: 11, fontWeight: 600, color: "#9498a8", textTransform: "uppercase", letterSpacing: .8, marginBottom: 8 }}>Deuda Neta</div><div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 22, fontWeight: 700, color: curD.net > 0 ? "#dc2640" : "#0d9f6e" }}>${fmt(curD.net)}</div>{curD.tGar > 0 && <div style={{ fontSize: 11, color: "#7c3aed", marginTop: 6 }}>🛡️ Garantías: -${fmt(curD.tGar)}</div>}</div>
        </div>,
        <div className="hm-detail-charts" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
          <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 14, padding: "20px 22px" }}><h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Gasto Mensual</h4><ResponsiveContainer width="100%" height={200}><BarChart data={cCharts.m}><CartesianGrid strokeDasharray="3 3" stroke="#eff0f3" /><XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9498a8" }} /><YAxis tick={{ fontSize: 11, fill: "#9498a8" }} /><Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} /><Legend wrapperStyle={{ fontSize: 11 }} /><Bar dataKey="gasto" name="Ads" fill="#0055ff" radius={[6, 6, 0, 0]} /><Bar dataKey="fee" name="Fee" fill="#7c3aed" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>
          <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 14, padding: "20px 22px" }}><h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Cobros Recibidos</h4><ResponsiveContainer width="100%" height={200}><LineChart data={cCharts.co}><CartesianGrid strokeDasharray="3 3" stroke="#eff0f3" /><XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9498a8" }} /><YAxis tick={{ fontSize: 11, fill: "#9498a8" }} /><Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} /><Line type="monotone" dataKey="cobrado" name="Cobrado" stroke="#0d9f6e" strokeWidth={2.5} dot={{ r: 5, fill: "#0d9f6e" }} /></LineChart></ResponsiveContainer></div>
        </div>,
        <div className="hm-detail-tabs" style={{ display: "flex", gap: 2, background: "#f4f5f7", borderRadius: 9, padding: 3, width: "fit-content", marginBottom: 22 }}>
          {[["gastos", "Gastos Ads"], ["cobros", "Cobros"], ["garantias", "Garantías"], ["manual", "Datos Manuales"]].map(([k, l]) => <button key={k} onClick={() => setDetailTab(k)} style={{ padding: "7px 18px", border: "none", background: detailTab === k ? "#fff" : "transparent", color: detailTab === k ? "#1a1d26" : "#9498a8", fontFamily: "'DM Sans'", fontSize: 12.5, fontWeight: 600, borderRadius: 7, cursor: "pointer", boxShadow: detailTab === k ? "0 1px 2px rgba(0,0,0,.04)" : "none" }}>{l}</button>)}
        </div>,
        detailTab === "gastos" && <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 14, overflow: "hidden" }}><div className="hm-table-wrap"><table><thead><tr>{["Mes", "Campaña", "Gasto", "Fee %", "Fee $", "Total", "Pagado", "Pendiente", "Estado"].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead><tbody>{curGastos.map((g) => <tr key={g.id}><td style={{ ...TD, fontWeight: 600 }}>{fmtM(g.mes)}</td><td style={TD}>{g.camp || "—"}</td><td style={{ ...TD, ...MN }}>${fmt(g.gasto)}</td><td style={{ ...TD, ...MN, color: "#0055ff" }}>{g.fee}%</td><td style={{ ...TD, ...MN, color: "#0055ff" }}>${fmt(g._f)}</td><td style={{ ...TD, ...MN, fontWeight: 700 }}>${fmt(g._t)}</td><td style={{ ...TD, ...MN, color: "#0d9f6e" }}>${fmt(g._p)}</td><td style={{ ...TD, ...MN, color: "#dc2640" }}>${fmt(g._pend)}</td><td style={TD}><Bdg type={g._st === "Pagado" ? "ok" : g._st === "Parcial" ? "warn" : "acc"}>{g._st}</Bdg></td></tr>)}{!curGastos.length && <Empty cols={9} msg="Sin gastos" />}</tbody></table></div></div>,
        detailTab === "cobros" && <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 14, overflow: "hidden" }}><div className="hm-table-wrap"><table><thead><tr>{["Fecha", "Ref.", "Monto", "Método", "Notas"].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead><tbody>{curCobros.map((co) => { const g = gastos.find((x) => x.id === co.gastoId); return <tr key={co.id}><td style={TD}>{fmtD(co.fecha)}</td><td style={TD}>{g ? fmtM(g.mes) : "—"}</td><td style={{ ...TD, ...MN, color: "#0d9f6e", fontWeight: 700 }}>+${fmt(co.monto)}</td><td style={TD}><PayB method={co.metodo} /></td><td style={{ ...TD, fontSize: 12.5, color: "#9498a8" }}>{co.notas || "—"}</td></tr>; })}{!curCobros.length && <Empty cols={5} msg="Sin cobros" />}</tbody></table></div></div>,
        detailTab === "garantias" && <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 14, overflow: "hidden" }}><div className="hm-table-wrap"><table><thead><tr>{["Tipo", "Descripción", "Valor", "Estado"].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead><tbody>{curGars.map((g) => <tr key={g.id}><td style={TD}><Bdg type="gar">{g.tipo}</Bdg></td><td style={{ ...TD, color: "#5f6577" }}>{g.desc || "—"}</td><td style={{ ...TD, ...MN }}>${fmt(g.valor)}</td><td style={TD}><Bdg type={g.estado === "Vigente" ? "ok" : g.estado === "Ejecutada" ? "err" : "n"}>{g.estado}</Bdg></td></tr>)}{!curGars.length && <Empty cols={4} msg="Sin garantías" />}</tbody></table></div></div>,
        <Slot content={manualTabContent} />,
        <span hidden />
      )
    )
  );
}

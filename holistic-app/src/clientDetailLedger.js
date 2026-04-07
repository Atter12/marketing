/** Libro de movimientos del detalle de cliente (pestaña «Todos»): una fila ADS por gasto (importe + fee + total, un solo salto en el saldo). */

export function ledgerSortKey(dateYmd, timeHms, seq, id) {
  const d = (dateYmd || "1970-01-01").slice(0, 10);
  const t = (timeHms || "00:00:00").toString().slice(0, 8);
  return `${d}T${t}#${String(seq).padStart(2, "0")}#${id || ""}`;
}

/**
 * @param {object} p
 * @param {Array} [p.curGastos]
 * @param {Array} [p.curCobros]
 * @param {Array} [p.curGars]
 * @param {Array} [p.gastos]
 * @param {function} p.mesCobro
 * @param {function} p.fmtM
 */
export function buildClientLedgerRows({ curGastos, curCobros, curGars, gastos, mesCobro, fmtM }) {
  const gList = gastos || [];
  const raw = [];
  (curGastos || []).forEach((g) => {
    const ymd = (g.fechaMovimiento && String(g.fechaMovimiento).slice(0, 10)) || (g.mes ? `${g.mes}-15` : "1970-01-01");
    const gastoNum = parseFloat(g.gasto || 0);
    const feeNum = g._f || 0;
    const camp = (g.camp || "").trim();
    if (gastoNum !== 0 || feeNum !== 0) {
      const obsAds = [camp, g.codigo ? `Gasto ${g.codigo}` : ""].filter(Boolean).join(" · ") || "General";
      raw.push({
        sortKey: ledgerSortKey(ymd, "00:00:00", 0, `${g.id}-ads`),
        fechaYmd: ymd,
        desc: "ADS",
        obs: obsAds,
        moneda: "USD",
        delta: gastoNum + feeNum,
        adsBreakdown: { gasto: gastoNum, fee: feeNum, total: gastoNum + feeNum },
      });
    }
  });
  (curCobros || []).forEach((co) => {
    const ymd = (co.fecha && String(co.fecha).slice(0, 10)) || "1970-01-01";
    const monto = parseFloat(co.monto || 0);
    const gAsoc = gList.find((x) => x.id === co.gastoId);
    const periodoStr = mesCobro && fmtM ? fmtM(mesCobro(co, gList)) : (gAsoc ? fmtM(gAsoc.mes) : "—");
    raw.push({
      sortKey: ledgerSortKey(ymd, co.hora || "12:00:00", 2, co.id),
      fechaYmd: ymd,
      desc: "COBRO",
      obs: ["Pago", periodoStr !== "—" ? `Período ${periodoStr}` : "", co.metodo || "", co.codigo ? `Cód. ${co.codigo}` : ""].filter(Boolean).join(" · ") || "General",
      moneda: "USD",
      delta: -monto,
    });
  });
  (curGars || []).forEach((gr) => {
    const gastoAsoc = gr.gastoId ? gList.find((x) => x.id === gr.gastoId) : null;
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
      obs: [gr.tipo || "", gr.desc || "", mesStr !== "—" ? `Mes resumen ${mesStr}` : "", gr.estado || ""].filter(Boolean).join(" · ") || "General",
      moneda: "USD",
      delta: vigente ? -valor : 0,
      garantiaSinEfecto: !vigente && valor > 0,
      garantiaValorRef: valor,
    });
  });
  raw.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  let run = 0;
  return raw.map((r, i) => {
    run += r.delta;
    return { ...r, n: i + 1, saldo: run };
  });
}

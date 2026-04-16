import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";

function mapGaranteContacto(x) {
  if (!x || typeof x !== "object") return { nombre: "", telefono: "", email: "" };
  return {
    nombre: String(x.nombre ?? x.name ?? "").trim(),
    telefono: String(x.telefono ?? x.phone ?? "").trim(),
    email: String(x.email ?? "").trim(),
  };
}

function mapGarantesContactos(raw) {
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : [];
  return arr.map(mapGaranteContacto);
}

function mapCliente(r) {
  if (!r) return r;
  return {
    id: r.id,
    codigo: r.codigo ?? "",
    name: r.name,
    ig: r.ig ?? "",
    phones: Array.isArray(r.phones) ? r.phones : (r.phones ? [r.phones] : [""]),
    emails: Array.isArray(r.emails) ? r.emails : (r.emails ? [r.emails] : [""]),
    biz: r.biz ?? "",
    notes: r.notes ?? "",
    avatar_url: r.avatar_url ?? "",
    garantesContactos: mapGarantesContactos(r.garantes_contactos),
    created: r.created_at?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
  };
}

function mapGasto(r) {
  if (!r) return r;
  const mes = r.mes ?? (r.fecha_movimiento ? r.fecha_movimiento.slice(0, 7) : null);
  const fechaMov = r.fecha_movimiento ?? (mes ? mes + "-15" : null);
  return { id: r.id, codigo: r.codigo ?? "", clientId: r.client_id, mes, fechaMovimiento: fechaMov, camp: r.camp ?? "", gasto: Number(r.gasto), fee: String(r.fee ?? 10), notas: r.notas ?? "", created_by: r.created_by ?? null, prepago: !!r.prepago };
}

function mapCobro(r) {
  if (!r) return r;
  const urls = r.comprobante_urls;
  return { id: r.id, codigo: r.codigo ?? "", gastoId: r.gasto_id, clientId: r.client_id ?? null, monto: String(r.monto), fecha: r.fecha, periodoResumen: r.periodo_resumen ?? null, hora: r.hora ?? null, metodo: r.metodo ?? "", notas: r.notas ?? "", created_at: r.created_at ?? null, created_by: r.created_by ?? null, comprobante_urls: Array.isArray(urls) ? urls : (urls ? [urls] : []) };
}

function mapGarantia(r) {
  if (!r) return r;
  const urls = r.imagen_urls;
  return { id: r.id, clientId: r.client_id, gastoId: r.gasto_id ?? null, tipo: r.tipo ?? "Cuenta TikTok", desc: r.descripcion ?? "", valor: String(r.valor), estado: r.estado ?? "Vigente", codigoVerificacion: r.codigo_verificacion ?? "", fechaColocacion: r.fecha_colocacion ?? "", periodoResumen: r.periodo_resumen ?? "", created_at: r.created_at ?? null, created_by: r.created_by ?? null, imagen_urls: Array.isArray(urls) ? urls : (urls ? [urls] : []) };
}

function mapManual(r) {
  if (!r) return r;
  return { id: r.id, clientId: r.client_id, fecha: r.fecha, conc: r.conc ?? "", monto: String(r.monto), tipo: r.tipo ?? "Gasto", nota: r.nota ?? "" };
}

export function useSupabaseData(role, clientId) {
  const [clients, setClients] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [cobros, setCobros] = useState([]);
  const [garantias, setGarantias] = useState([]);
  const [manual, setManual] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    try {
      if (role === "gerente") {
        const [cRes, gRes, coRes, garRes, mRes] = await Promise.all([
          supabase.from("clientes").select("*").order("created_at", { ascending: false }),
          supabase.from("gastos").select("*").order("mes", { ascending: false }),
          supabase.from("cobros").select("*").order("created_at", { ascending: false }),
          supabase.from("garantias").select("*"),
          supabase.from("manual").select("*").order("fecha", { ascending: false }),
        ]);
        if (cRes.error) throw cRes.error;
        if (gRes.error) throw gRes.error;
        if (coRes.error) throw coRes.error;
        if (garRes.error) throw garRes.error;
        if (mRes.error) throw mRes.error;
        setClients((cRes.data || []).map(mapCliente));
        setGastos((gRes.data || []).map(mapGasto));
        setCobros((coRes.data || []).map(mapCobro));
        setGarantias((garRes.data || []).map(mapGarantia));
        setManual((mRes.data || []).map(mapManual));
      } else if (role === "cliente" && clientId) {
        const [cRes, gRes, garRes, mRes] = await Promise.all([
          supabase
            .from("clientes")
            .select("id,name,ig,phones,emails,biz,notes,avatar_url,codigo,created_at")
            .eq("id", clientId)
            .maybeSingle(),
          supabase.from("gastos").select("id").eq("client_id", clientId),
          supabase.from("garantias").select("*").eq("client_id", clientId),
          supabase.from("manual").select("*").eq("client_id", clientId).order("fecha", { ascending: false }),
        ]);
        if (cRes.error) throw cRes.error;
        if (gRes.error) throw gRes.error;
        if (garRes.error) throw garRes.error;
        if (mRes.error) throw mRes.error;
        const gIds = (gRes.data || []).map((x) => x.id);
        const [coByGastoRes, coByClientRes] = await Promise.all([
          gIds.length > 0 ? supabase.from("cobros").select("*").in("gasto_id", gIds).order("created_at", { ascending: false }) : { data: [] },
          supabase.from("cobros").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
        ]);
        if (coByGastoRes.error) throw coByGastoRes.error;
        if (coByClientRes.error) throw coByClientRes.error;
        const seen = new Set();
        const cobrosMerged = [...(coByGastoRes.data || []), ...(coByClientRes.data || [])]
          .filter((r) => { if (seen.has(r.id)) return false; seen.add(r.id); return true; })
          .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
        const gFullRes = await supabase.from("gastos").select("*").eq("client_id", clientId).order("mes", { ascending: false });
        if (gFullRes.error) throw gFullRes.error;
        const one = cRes.data ? [mapCliente({ ...cRes.data, garantes_contactos: [] })] : [];
        setClients(one);
        setGastos((gFullRes.data || []).map(mapGasto));
        setCobros(cobrosMerged.map(mapCobro));
        setGarantias((garRes.data || []).map(mapGarantia));
        setManual((mRes.data || []).map(mapManual));
      } else {
        setClients([]);
        setGastos([]);
        setCobros([]);
        setGarantias([]);
        setManual([]);
      }
    } catch (e) {
      setError(e?.message || "Error al cargar datos");
      console.error("[useSupabaseData]", e);
    } finally {
      setLoading(false);
    }
  }, [role, clientId]);

  /** Solo gastos + cobros, sin tocar `loading` global (para Cobranza u otras vistas en vivo). */
  const refetchGastosCobros = useCallback(async () => {
    if (!supabase || role !== "gerente") return;
    const [gRes, coRes] = await Promise.all([
      supabase.from("gastos").select("*").order("mes", { ascending: false }),
      supabase.from("cobros").select("*").order("created_at", { ascending: false }),
    ]);
    if (gRes.error) throw gRes.error;
    if (coRes.error) throw coRes.error;
    setGastos((gRes.data || []).map(mapGasto));
    setCobros((coRes.data || []).map(mapCobro));
  }, [role, supabase]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const uid = () => crypto.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  const mutations = {
    saveClient: async (payload) => {
      if (role !== "gerente") return;
      const { id, newClientId, name, codigo, ig, phones, emails, biz, notes, avatar_url, garantes_contactos } = payload;
      const genCodigo = () => "CL-" + Date.now().toString(36).toUpperCase().slice(-5) + Math.random().toString(36).slice(2, 5).toUpperCase();
      const garDb = Array.isArray(garantes_contactos) ? garantes_contactos : [];
      const row = {
        name: name?.trim(),
        ig: ig || null,
        phones: Array.isArray(phones) ? phones.filter(Boolean) : [],
        emails: Array.isArray(emails) ? emails.filter(Boolean) : [],
        biz: biz || null,
        notes: notes || null,
        avatar_url: avatar_url || null,
        codigo: (codigo && String(codigo).trim()) ? String(codigo).trim() : null,
        garantes_contactos: garDb,
      };
      const uuidOk = (s) => typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim());
      if (id) {
        if (row.codigo === null) delete row.codigo;
        const { error: e } = await supabase.from("clientes").update(row).eq("id", id);
        if (e) throw e;
        await fetchAll();
        return id;
      } else {
        if (!row.codigo) row.codigo = genCodigo();
        const insertRow = { ...row };
        if (uuidOk(newClientId)) insertRow.id = String(newClientId).trim();
        const { data, error: e } = await supabase.from("clientes").insert(insertRow).select("id").single();
        if (e) throw e;
        await fetchAll();
        return data?.id ?? null;
      }
    },
    /** targetClientId: obligatorio si el rol es gerente (el hook no tiene clientId); en rol cliente puede omitirse. */
    updateClientAvatar: async (avatarUrl, targetClientId) => {
      const cid = targetClientId != null && String(targetClientId) !== "" ? targetClientId : clientId;
      if (!cid) {
        console.warn("[updateClientAvatar] Sin client_id: pasa el id del cliente como segundo argumento cuando eres gerente.");
        return;
      }
      const { error: e } = await supabase.from("clientes").update({ avatar_url: avatarUrl || null }).eq("id", cid);
      if (e) throw e;
      await fetchAll();
    },
    delClient: async (id) => {
      if (role !== "gerente") return;
      // Eliminar en cascada: cobros de sus gastos → gastos → garantías → manual → cliente
      const { data: gastosDelCliente } = await supabase.from("gastos").select("id").eq("client_id", id);
      const gastoIds = (gastosDelCliente || []).map((g) => g.id);
      if (gastoIds.length > 0) {
        const { error: eCo } = await supabase.from("cobros").delete().in("gasto_id", gastoIds);
        if (eCo) throw eCo;
      }
      const { error: eG } = await supabase.from("gastos").delete().eq("client_id", id);
      if (eG) throw eG;
      const { error: eGar } = await supabase.from("garantias").delete().eq("client_id", id);
      if (eGar) throw eGar;
      const { error: eM } = await supabase.from("manual").delete().eq("client_id", id);
      if (eM) throw eM;
      const { error: e } = await supabase.from("clientes").delete().eq("id", id);
      if (e) throw e;
      await fetchAll();
    },
    saveGasto: async (payload) => {
      if (role !== "gerente") return;
      const { id, clientId, mes, fechaMovimiento, camp, gasto, fee, notas, prepago } = payload;
      let created_by = null;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) created_by = user.email;
      } catch (_) {}
      const genCodigo = () => "G-" + Date.now().toString(36).toUpperCase().slice(-7) + Math.random().toString(36).slice(2, 5).toUpperCase();
      const periodo = mes || (fechaMovimiento ? fechaMovimiento.slice(0, 7) : null);
      const row = { client_id: clientId, mes: periodo, fecha_movimiento: fechaMovimiento || (periodo ? periodo + "-15" : null), camp: camp || null, gasto: parseFloat(gasto) || 0, fee: parseFloat(fee) || 10, notas: notas || null, created_by: created_by || null, prepago: !!prepago };
      if (id) {
        const { error: e } = await supabase.from("gastos").update(row).eq("id", id);
        if (e) throw e;
      } else {
        row.codigo = genCodigo();
        const { data, error: e } = await supabase.from("gastos").insert(row).select("id").single();
        if (e) throw e;
        if (data) row.id = data.id;
      }
      await fetchAll();
    },
    delGasto: async (id) => {
      if (role !== "gerente") return;
      // Primero eliminar cobros de este gasto para no dejar huérfanos
      const { error: eCo } = await supabase.from("cobros").delete().eq("gasto_id", id);
      if (eCo) throw eCo;
      const { error: e } = await supabase.from("gastos").delete().eq("id", id);
      if (e) throw e;
      await fetchAll();
    },
    setGastosFeeBulk: async (ids, feeValue) => {
      if (role !== "gerente") return;
      const idsArr = Array.isArray(ids) ? ids.filter(Boolean) : [];
      if (!idsArr.length) return;
      const feeNum = parseFloat(feeValue);
      if (!Number.isFinite(feeNum)) throw new Error("Fee inválido");
      const { error: e } = await supabase.from("gastos").update({ fee: feeNum }).in("id", idsArr);
      if (e) throw e;
      await fetchAll();
    },
    saveCobro: async (payload) => {
      if (role !== "gerente") return;
      const { gastoId, clientId, monto, fecha, hora, metodo, notas } = payload;
      let created_by = null;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) created_by = user.email;
      } catch (_) {}
      const genCodigo = () => "C-" + Date.now().toString(36).toUpperCase().slice(-7) + Math.random().toString(36).slice(2, 5).toUpperCase();
      const row = { gasto_id: gastoId || null, client_id: !gastoId && clientId ? clientId : null, codigo: genCodigo(), monto: parseFloat(monto) || 0, fecha: fecha || new Date().toISOString().slice(0, 10), periodo_resumen: payload.periodoResumen || null, metodo: metodo || "Efectivo", notas: notas || null, created_by: created_by || null, hora: hora || null };
      const { data: inserted, error: e } = await supabase.from("cobros").insert(row).select("id").single();
      if (e) throw e;
      await fetchAll();
      return inserted?.id ?? null;
    },
    updateCobro: async (id, payload) => {
      if (role !== "gerente") return;
const { gastoId, clientId, monto, fecha, periodoResumen, hora, metodo, notas } = payload;
  const row = { gasto_id: gastoId || null, client_id: !gastoId && clientId ? clientId : null, monto: parseFloat(monto) || 0, fecha: fecha || new Date().toISOString().slice(0, 10), periodo_resumen: periodoResumen !== undefined ? periodoResumen : undefined, hora: hora || null, metodo: metodo || "Efectivo", notas: notas || null };
  const clean = Object.fromEntries(Object.entries(row).filter(([, v]) => v !== undefined));
  const { error: e } = await supabase.from("cobros").update(clean).eq("id", id);
      if (e) throw e;
      await fetchAll();
    },
    setCobroComprobantes: async (cobroId, paths) => {
      if (role !== "gerente") return;
      const { error: e } = await supabase.from("cobros").update({ comprobante_urls: paths }).eq("id", cobroId);
      if (e) throw e;
      await fetchAll();
    },
    delCobro: async (id) => {
      if (role === "gerente") {
        const { error: e } = await supabase.from("cobros").delete().eq("id", id);
        if (e) throw e;
        await fetchAll();
      }
    },
    saveGarantia: async (payload) => {
      if (role !== "gerente") return;
      const { id, clientId, gastoId, tipo, desc, valor, estado, fechaColocacion, periodoResumen } = payload;
      let created_by = null;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) created_by = user.email;
      } catch (_) {}
      const genCodigoVerif = () => "GV-" + Date.now().toString(36).toUpperCase().slice(-7) + Math.random().toString(36).slice(2, 5).toUpperCase();
      const gid = (gastoId && String(gastoId).trim()) ? gastoId : null;
      const pr = periodoResumen && String(periodoResumen).trim() ? String(periodoResumen).trim().slice(0, 7) : null;
      const row = { client_id: clientId, gasto_id: gid, tipo: tipo || "Cuenta TikTok", descripcion: desc || null, valor: parseFloat(valor) || 0, estado: estado || "Vigente", fecha_colocacion: (fechaColocacion && String(fechaColocacion).trim()) ? fechaColocacion : null, periodo_resumen: pr };
      if (id) {
        const { error: e } = await supabase.from("garantias").update(row).eq("id", id);
        if (e) throw e;
        await fetchAll();
        return id;
      } else {
        row.codigo_verificacion = genCodigoVerif();
        row.created_by = created_by || null;
        const { data: inserted, error: e } = await supabase.from("garantias").insert(row).select("id").single();
        if (e) throw e;
        await fetchAll();
        return inserted?.id ?? null;
      }
    },
    setGarantiaImagenes: async (garantiaId, paths) => {
      if (role !== "gerente") return;
      const { error: e } = await supabase.from("garantias").update({ imagen_urls: paths }).eq("id", garantiaId);
      if (e) throw e;
      await fetchAll();
    },
    delGarantia: async (id) => {
      if (role !== "gerente") return;
      const { error: e } = await supabase.from("garantias").delete().eq("id", id);
      if (e) throw e;
      await fetchAll();
    },
    saveManual: async (payload) => {
      if (role !== "gerente") return;
      const { clientId, fecha, conc, monto, tipo, nota } = payload;
      const row = { client_id: clientId || null, fecha: fecha || new Date().toISOString().slice(0, 10), conc: conc?.trim() || "", monto: parseFloat(monto) || 0, tipo: tipo || "Gasto", nota: nota || null };
      const { error: e } = await supabase.from("manual").insert(row);
      if (e) throw e;
      await fetchAll();
    },
    delManual: async (id) => {
      if (role !== "gerente") return;
      const { error: e } = await supabase.from("manual").delete().eq("id", id);
      if (e) throw e;
      await fetchAll();
    },
  };

  return { clients, gastos, cobros, garantias, manual, setClients: role === "gerente" ? setClients : () => {}, setGastos: role === "gerente" ? setGastos : () => {}, setCobros: setCobros, setGarantias: role === "gerente" ? setGarantias : () => {}, setManual: role === "gerente" ? setManual : () => {}, loading, error, refetch: fetchAll, refetchGastosCobros, mutations, uid };
}

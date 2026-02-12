import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";

function mapCliente(r) {
  if (!r) return r;
  return {
    id: r.id,
    name: r.name,
    ig: r.ig ?? "",
    phones: Array.isArray(r.phones) ? r.phones : (r.phones ? [r.phones] : [""]),
    emails: Array.isArray(r.emails) ? r.emails : (r.emails ? [r.emails] : [""]),
    biz: r.biz ?? "",
    notes: r.notes ?? "",
    created: r.created_at?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
  };
}

function mapGasto(r) {
  if (!r) return r;
  return { id: r.id, clientId: r.client_id, mes: r.mes, camp: r.camp ?? "", gasto: Number(r.gasto), fee: String(r.fee ?? 10), notas: r.notas ?? "" };
}

function mapCobro(r) {
  if (!r) return r;
  return { id: r.id, gastoId: r.gasto_id, monto: String(r.monto), fecha: r.fecha, hora: r.hora ?? null, metodo: r.metodo ?? "", notas: r.notas ?? "", created_at: r.created_at ?? null, created_by: r.created_by ?? null };
}

function mapGarantia(r) {
  if (!r) return r;
  return { id: r.id, clientId: r.client_id, tipo: r.tipo ?? "Cuenta TikTok", desc: r.descripcion ?? "", valor: String(r.valor), estado: r.estado ?? "Vigente" };
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
          supabase.from("clientes").select("*").eq("id", clientId).maybeSingle(),
          supabase.from("gastos").select("id").eq("client_id", clientId),
          supabase.from("garantias").select("*").eq("client_id", clientId),
          supabase.from("manual").select("*").eq("client_id", clientId).order("fecha", { ascending: false }),
        ]);
        if (cRes.error) throw cRes.error;
        if (gRes.error) throw gRes.error;
        if (garRes.error) throw garRes.error;
        if (mRes.error) throw mRes.error;
        const gIds = (gRes.data || []).map((x) => x.id);
        let coRes = { data: [] };
        if (gIds.length > 0) {
          coRes = await supabase.from("cobros").select("*").in("gasto_id", gIds).order("created_at", { ascending: false });
          if (coRes.error) throw coRes.error;
        }
        const gFullRes = await supabase.from("gastos").select("*").eq("client_id", clientId).order("mes", { ascending: false });
        if (gFullRes.error) throw gFullRes.error;
        const one = cRes.data ? [mapCliente(cRes.data)] : [];
        setClients(one);
        setGastos((gFullRes.data || []).map(mapGasto));
        setCobros((coRes.data || []).map(mapCobro));
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

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const uid = () => crypto.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  const mutations = {
    saveClient: async (payload) => {
      if (role !== "gerente") return;
      const { id, name, ig, phones, emails, biz, notes, created } = payload;
      const row = { name: name?.trim(), ig: ig || null, phones: Array.isArray(phones) ? phones.filter(Boolean) : [], emails: Array.isArray(emails) ? emails.filter(Boolean) : [], biz: biz || null, notes: notes || null };
      if (id) {
        const { error: e } = await supabase.from("clientes").update(row).eq("id", id);
        if (e) throw e;
      } else {
        const { data, error: e } = await supabase.from("clientes").insert(row).select("id").single();
        if (e) throw e;
        if (data) row.id = data.id;
      }
      await fetchAll();
    },
    delClient: async (id) => {
      if (role !== "gerente") return;
      const { error: e } = await supabase.from("clientes").delete().eq("id", id);
      if (e) throw e;
      await fetchAll();
    },
    saveGasto: async (payload) => {
      if (role !== "gerente") return;
      const { id, clientId, mes, camp, gasto, fee, notas } = payload;
      const row = { client_id: clientId, mes, camp: camp || null, gasto: parseFloat(gasto) || 0, fee: parseFloat(fee) || 10, notas: notas || null };
      if (id) {
        const { error: e } = await supabase.from("gastos").update(row).eq("id", id);
        if (e) throw e;
      } else {
        const { data, error: e } = await supabase.from("gastos").insert(row).select("id").single();
        if (e) throw e;
        if (data) row.id = data.id;
      }
      await fetchAll();
    },
    delGasto: async (id) => {
      if (role !== "gerente") return;
      const { error: e } = await supabase.from("gastos").delete().eq("id", id);
      if (e) throw e;
      await fetchAll();
    },
    saveCobro: async (payload) => {
      if (role !== "gerente") return;
      const { gastoId, monto, fecha, hora, metodo, notas } = payload;
      let created_by = null;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) created_by = user.email;
      } catch (_) {}
      const row = { gasto_id: gastoId, monto: parseFloat(monto) || 0, fecha: fecha || new Date().toISOString().slice(0, 10), metodo: metodo || "Efectivo", notas: notas || null, created_by: created_by || null, hora: hora || null };
      const { error: e } = await supabase.from("cobros").insert(row);
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
      const { id, clientId, tipo, desc, valor, estado } = payload;
      const row = { client_id: clientId, tipo: tipo || "Cuenta TikTok", descripcion: desc || null, valor: parseFloat(valor) || 0, estado: estado || "Vigente" };
      if (id) {
        const { error: e } = await supabase.from("garantias").update(row).eq("id", id);
        if (e) throw e;
      } else {
        const { error: e } = await supabase.from("garantias").insert(row);
        if (e) throw e;
      }
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

  return { clients, gastos, cobros, garantias, manual, setClients: role === "gerente" ? setClients : () => {}, setGastos: role === "gerente" ? setGastos : () => {}, setCobros: setCobros, setGarantias: role === "gerente" ? setGarantias : () => {}, setManual: role === "gerente" ? setManual : () => {}, loading, error, refetch: fetchAll, mutations, uid };
}

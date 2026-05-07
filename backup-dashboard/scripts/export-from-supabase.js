/**
 * Exporta la base Holistic (Supabase) a backup.json: Crédito, Cobranza, Pendientes,
 * Creativos, Finanzas (app) y tablas core compartidas.
 *
 * Requiere: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (o PUBLIC_SUPABASE_URL + ANON con acceso).
 * Uso: node scripts/export-from-supabase.js
 * Salida: ../data/backup.json
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = (m[2].trim() || '').replace(/^["']|["']$/g, '');
  });
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Falta SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (o PUBLIC_SUPABASE_URL y SUPABASE_ANON_KEY)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const PAGE = 1000;

/**
 * Reconstruye la consulta en cada página (range no debe encadenarse sobre el mismo builder).
 * @param {() => import('@supabase/supabase-js').PostgrestFilterBuilder} makeQuery
 */
async function fetchAllPages(makeQuery) {
  const all = [];
  let from = 0;
  while (true) {
    const { data, error } = await makeQuery().range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function loadTable(name, buildQuery) {
  try {
    return await fetchAllPages(() => buildQuery(supabase.from(name).select('*')));
  } catch (err) {
    console.warn(`[backup] Tabla "${name}" omitida:`, err.message || err);
    return [];
  }
}

async function run() {
  const outPath = path.join(__dirname, '..', 'data', 'backup.json');
  const exportedAt = new Date().toISOString();

  const [
    gerentes,
    clientes,
    clientes_acceso,
    gastos,
    cobros,
    garantias,
    manual,
    cobranza_bandeja,
    cobranza_eventos,
    tareas_equipo,
    tareas_clientes,
    tareas_kanban,
    tareas_tickets,
    tareas_workload,
    tareas_calendario,
    tareas_ticket_comentarios,
    creativos_clientes,
    creativos_productos,
    creativos_editores,
    creativos_proyectos,
    finanzas_app_ingresos,
    finanzas_app_gastos,
    finanzas_app_cuentas_cobrar,
    finanzas_app_deudas,
    finanzas_app_sueldos,
    finanzas_app_impuestos,
  ] = await Promise.all([
    loadTable('gerentes', (q) => q.order('created_at', { ascending: false })),
    loadTable('clientes', (q) => q.order('name', { ascending: true })),
    loadTable('clientes_acceso', (q) => q.order('id', { ascending: true })),
    loadTable('gastos', (q) => q.order('mes', { ascending: false })),
    loadTable('cobros', (q) => q.order('created_at', { ascending: false })),
    loadTable('garantias', (q) => q.order('created_at', { ascending: false })),
    loadTable('manual', (q) => q.order('fecha', { ascending: false })),
    loadTable('cobranza_bandeja', (q) => q.order('created_at', { ascending: false })),
    loadTable('cobranza_eventos', (q) => q.order('created_at', { ascending: false })),
    loadTable('tareas_equipo', (q) => q.order('id', { ascending: true })),
    loadTable('tareas_clientes', (q) => q.order('nombre', { ascending: true })),
    loadTable('tareas_kanban', (q) => q.order('columna', { ascending: true }).order('orden', { ascending: true })),
    loadTable('tareas_tickets', (q) => q.order('created_at', { ascending: false })),
    loadTable('tareas_workload', (q) => q.order('id', { ascending: true })),
    loadTable('tareas_calendario', (q) => q.order('anio', { ascending: false }).order('mes', { ascending: false }).order('dia', { ascending: true })),
    loadTable('tareas_ticket_comentarios', (q) => q.order('created_at', { ascending: true })),
    loadTable('creativos_clientes', (q) => q.order('name', { ascending: true })),
    loadTable('creativos_productos', (q) => q.order('name', { ascending: true })),
    loadTable('creativos_editores', (q) => q.order('name', { ascending: true })),
    loadTable('creativos_proyectos', (q) => q.order('created_at', { ascending: false })),
    loadTable('finanzas_app_ingresos', (q) => q.order('created_at', { ascending: false })),
    loadTable('finanzas_app_gastos', (q) => q.order('created_at', { ascending: false })),
    loadTable('finanzas_app_cuentas_cobrar', (q) => q.order('created_at', { ascending: false })),
    loadTable('finanzas_app_deudas', (q) => q.order('created_at', { ascending: false })),
    loadTable('finanzas_app_sueldos', (q) => q.order('created_at', { ascending: false })),
    loadTable('finanzas_app_impuestos', (q) => q.order('created_at', { ascending: false })),
  ]);

  const backup = {
    schemaVersion: 2,
    exportedAt,
    gerentes,
    clientes,
    clientes_acceso,
    gastos,
    cobros,
    garantias,
    manual,
    cobranza_bandeja,
    cobranza_eventos,
    tareas_equipo,
    tareas_clientes,
    tareas_kanban,
    tareas_tickets,
    tareas_workload,
    tareas_calendario,
    tareas_ticket_comentarios,
    creativos_clientes,
    creativos_productos,
    creativos_editores,
    creativos_proyectos,
    finanzas_app_ingresos,
    finanzas_app_gastos,
    finanzas_app_cuentas_cobrar,
    finanzas_app_deudas,
    finanzas_app_sueldos,
    finanzas_app_impuestos,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(backup, null, 2), 'utf8');

  console.log('Backup escrito en', outPath);
  console.log('Registros:', {
    gerentes: gerentes.length,
    clientes: clientes.length,
    clientes_acceso: clientes_acceso.length,
    gastos: gastos.length,
    cobros: cobros.length,
    garantias: garantias.length,
    manual: manual.length,
    cobranza_bandeja: cobranza_bandeja.length,
    cobranza_eventos: cobranza_eventos.length,
    tareas_equipo: tareas_equipo.length,
    tareas_clientes: tareas_clientes.length,
    tareas_kanban: tareas_kanban.length,
    tareas_tickets: tareas_tickets.length,
    tareas_workload: tareas_workload.length,
    tareas_calendario: tareas_calendario.length,
    tareas_ticket_comentarios: tareas_ticket_comentarios.length,
    creativos_clientes: creativos_clientes.length,
    creativos_productos: creativos_productos.length,
    creativos_editores: creativos_editores.length,
    creativos_proyectos: creativos_proyectos.length,
    finanzas_app_ingresos: finanzas_app_ingresos.length,
    finanzas_app_gastos: finanzas_app_gastos.length,
    finanzas_app_cuentas_cobrar: finanzas_app_cuentas_cobrar.length,
    finanzas_app_deudas: finanzas_app_deudas.length,
    finanzas_app_sueldos: finanzas_app_sueldos.length,
    finanzas_app_impuestos: finanzas_app_impuestos.length,
  });
}

run().catch((err) => {
  console.error('Error en exportación:', err);
  process.exit(1);
});

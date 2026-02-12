/**
 * Exporta toda la base de datos Holistic (Supabase) a backup.json.
 * Ejecutar diariamente por cron o GitHub Actions.
 * Requiere: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env o entorno.
 *
 * Uso: node export-from-supabase.js
 * Salida: ../data/backup.json
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Falta SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (o PUBLIC_SUPABASE_URL y SUPABASE_ANON_KEY)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const outPath = path.join(__dirname, '..', 'data', 'backup.json');
  const exportedAt = new Date().toISOString();

  try {
    const [gerentes, clientes, gastos, cobros, garantias, manual] = await Promise.all([
      supabase.from('gerentes').select('*').order('created_at', { ascending: false }),
      supabase.from('clientes').select('*').order('created_at', { ascending: false }),
      supabase.from('gastos').select('*').order('created_at', { ascending: false }),
      supabase.from('cobros').select('*').order('created_at', { ascending: false }),
      supabase.from('garantias').select('*').order('created_at', { ascending: false }),
      supabase.from('manual').select('*').order('fecha', { ascending: false }),
    ]);

    if (gerentes.error) throw gerentes.error;
    if (clientes.error) throw clientes.error;
    if (gastos.error) throw gastos.error;
    if (cobros.error) throw cobros.error;
    if (garantias.error) throw garantias.error;
    if (manual.error) throw manual.error;

    const backup = {
      exportedAt,
      gerentes: gerentes.data || [],
      clientes: clientes.data || [],
      gastos: gastos.data || [],
      cobros: cobros.data || [],
      garantias: garantias.data || [],
      manual: manual.data || [],
    };

    fs.writeFileSync(outPath, JSON.stringify(backup, null, 2), 'utf8');
    console.log('Backup escrito en', outPath, '| Registros:', {
      gerentes: backup.gerentes.length,
      clientes: backup.clientes.length,
      gastos: backup.gastos.length,
      cobros: backup.cobros.length,
      garantias: backup.garantias.length,
      manual: backup.manual.length,
    });
  } catch (err) {
    console.error('Error en exportación:', err);
    process.exit(1);
  }
}

run();

/**
 * Escribe app-link/config.js desde variables de entorno (Vercel: PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY).
 * Se ejecuta en el build para que redirect.html y hecom-panel.html tengan Supabase en producción.
 */
const fs = require('fs');
const path = require('path');

const url = process.env.PUBLIC_SUPABASE_URL || '';
const key = process.env.PUBLIC_SUPABASE_ANON_KEY || '';

const out = path.join(__dirname, '..', 'app-link', 'config.js');
const content = `// Generado en build desde env (PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY)
window.SUPABASE_URL = ${JSON.stringify(url)};
window.SUPABASE_ANON_KEY = ${JSON.stringify(key)};
`;

fs.writeFileSync(out, content, 'utf8');
console.log('Written app-link/config.js from env');

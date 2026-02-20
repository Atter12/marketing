/**
 * Inyecta PUBLIC_SUPABASE_URL y PUBLIC_SUPABASE_ANON_KEY en app-link (raíz = repo; carpeta = app-link).
 * - Escribe app-link/config.js
 * - Reemplaza __SUPABASE_URL__ y __SUPABASE_ANON_KEY__ en hecom-panel.html y redirect.html
 * Así funciona en Vercel aunque config.js no se sirva (p.ej. por .gitignore en deploy).
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appLink = path.join(root, 'app-link');

const url = process.env.PUBLIC_SUPABASE_URL || '';
const key = process.env.PUBLIC_SUPABASE_ANON_KEY || '';

// 1) config.js
const configPath = path.join(appLink, 'config.js');
const configContent = `// Generado en build desde env (raíz Vercel)
window.SUPABASE_URL = ${JSON.stringify(url)};
window.SUPABASE_ANON_KEY = ${JSON.stringify(key)};
`;
fs.writeFileSync(configPath, configContent, 'utf8');
console.log('Written app-link/config.js from env');

// 2) Inyectar en HTML para no depender de que config.js se cargue
const urlPlaceholder = '__SUPABASE_URL__';
const keyPlaceholder = '__SUPABASE_ANON_KEY__';
const urlReplacement = JSON.stringify(url);
const keyReplacement = JSON.stringify(key);

function injectInFile(filename) {
  const filePath = path.join(appLink, filename);
  let html = fs.readFileSync(filePath, 'utf8');
  html = html.split(urlPlaceholder).join(urlReplacement).split(keyPlaceholder).join(keyReplacement);
  fs.writeFileSync(filePath, html, 'utf8');
  console.log('Injected Supabase env into app-link/' + filename);
}

injectInFile('hecom-panel.html');
injectInFile('redirect.html');

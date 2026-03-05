/**
 * Build holistic-app and deploy its output to /credito:
 * - credito.html (shell that loads the React app)
 * - credito-app/assets/* (JS/CSS bundles)
 * Run from repo root.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'holistic-app', 'dist');
const outDir = path.join(root, 'credito-app');

console.log('Building holistic-app...');
execSync('npm run build', { cwd: path.join(root, 'holistic-app'), stdio: 'inherit' });

if (!fs.existsSync(dist)) {
  console.error('holistic-app/dist not found after build');
  process.exit(1);
}

// credito-app/ (bundle con nombre fijo: credito-app.js)
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const jsFile = path.join(dist, 'credito-app.js');
if (fs.existsSync(jsFile)) {
  fs.copyFileSync(jsFile, path.join(outDir, 'credito-app.js'));
  console.log('Copied credito-app/credito-app.js');
}
// auth-config.js (para protección de /creativos y /tareas)
const authConfigSrc = path.join(dist, 'credito-app', 'auth-config.js');
if (fs.existsSync(authConfigSrc)) {
  fs.copyFileSync(authConfigSrc, path.join(outDir, 'auth-config.js'));
  console.log('Copied credito-app/auth-config.js');
}
// por si en el futuro hay assets/
const assetsSrc = path.join(dist, 'assets');
const assetsDest = path.join(outDir, 'assets');
if (fs.existsSync(assetsSrc)) {
  if (fs.existsSync(assetsDest)) fs.rmSync(assetsDest, { recursive: true });
  fs.cpSync(assetsSrc, assetsDest, { recursive: true });
  console.log('Copied credito-app/assets');
}

// favicon y logo (postbuild de holistic-app los deja en dist/credito-app/)
['favicon', 'logo'].forEach((dir) => {
  const src = path.join(dist, 'credito-app', dir);
  const dest = path.join(outDir, dir);
  if (fs.existsSync(src)) {
    if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true });
    fs.cpSync(src, dest, { recursive: true });
    console.log('Copied credito-app/' + dir);
  }
});

// credito.html: script fijo /credito-app/credito-app.js para que el deploy siempre lo encuentre
const scriptPath = '/credito-app/credito-app.js';
let html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
html = html.replace(/<script[^>]+src="[^"]+"[^>]*><\/script>/, `<script type="module" crossorigin src="${scriptPath}"></script>`);
html = html.replace(/<title>.*?<\/title>/, '<title>Crédito | Holistic Marketing</title>');
// Favicon: ruta absoluta + ?v= para evitar caché del navegador; dos links por compatibilidad
const faviconUrl = '/credito-app/favicon/favicon.png?v=2';
html = html.replace(/<link[^>]*rel=["\']?(?:shortcut )?icon["\']?[^>]*>/gi, '');
html = html.replace('</head>', `<link rel="icon" type="image/png" href="${faviconUrl}" /><link rel="shortcut icon" type="image/png" href="${faviconUrl}" /></head>`);
fs.writeFileSync(path.join(root, 'credito.html'), html, 'utf8');
console.log('Generated credito.html');

console.log('');
console.log('Done. /credito will load the React app (Crédito view + Dashboard).');
console.log('Build completado. Ya puedes hacer deploy.');

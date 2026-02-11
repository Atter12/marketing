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

// credito-app/assets
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const assetsSrc = path.join(dist, 'assets');
const assetsDest = path.join(outDir, 'assets');
if (fs.existsSync(assetsDest)) fs.rmSync(assetsDest, { recursive: true });
if (fs.existsSync(assetsSrc)) {
  fs.cpSync(assetsSrc, assetsDest, { recursive: true });
  console.log('Copied credito-app/assets');
}

// credito.html from built index (script already points to /credito-app/assets/...)
let html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
html = html.replace(/<title>.*?<\/title>/, '<title>Crédito | Holistic Marketing</title>');
fs.writeFileSync(path.join(root, 'credito.html'), html, 'utf8');
console.log('Generated credito.html');

console.log('Done. /credito will load the React app (Crédito view + Dashboard).');

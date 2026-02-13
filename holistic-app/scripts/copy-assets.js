/**
 * Copia favicon y logo desde la raíz del proyecto (favicon/, logo/)
 * a public/favicon y public/logo para que la app los sirva.
 * Ejecutar: node scripts/copy-assets.js (o npm run copy-assets)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const copies = [
  { src: "favicon/favicon.png", dest: "public/favicon/favicon.png" },
  { src: "logo/logoh.png", dest: "public/logo/logoh.png" },
];

for (const { src, dest } of copies) {
  const srcPath = path.join(root, src);
  const destPath = path.join(root, dest);
  if (fs.existsSync(srcPath)) {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(srcPath, destPath);
    console.log("Copiado:", src, "→", dest);
  } else {
    console.warn("No encontrado (se omite):", srcPath);
  }
}

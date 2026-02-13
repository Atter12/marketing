/**
 * Después de `vite build`, Vite deja public/ en la raíz de dist (dist/favicon, dist/logo)
 * pero la app se sirve bajo base (ej. dist/credito-app/). Copiamos favicon y logo
 * dentro de la carpeta base para que /credito-app/favicon/ y /credito-app/logo/ funcionen.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(__dirname, "..", "dist");
const baseDir = "credito-app"; // debe coincidir con base en vite.config.js

["favicon", "logo"].forEach((dir) => {
  const src = path.join(dist, dir);
  const dest = path.join(dist, baseDir, dir);
  if (fs.existsSync(src)) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.cpSync(src, dest, { recursive: true });
    console.log("[postbuild] Copiado dist/" + dir + " → dist/" + baseDir + "/" + dir);
  }
});

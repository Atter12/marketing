# Copia de seguridad — Dashboard base de datos Holistic

Dashboard separado que muestra una **copia de la base de datos** por fecha. Si la base principal (Supabase) cae o hay un incidente, los datos siguen disponibles aquí a partir de la última exportación diaria.

## Qué hace

- **Exportación diaria**: Un script descarga todo (gerentes, clientes, gastos, cobros, garantías, manual) a un archivo `data/backup.json`.
- **Dashboard**: Página web que lee ese archivo y permite **filtrar por fecha** (ej. 12 de febrero): ver todos los movimientos de ese día (cobros, gastos, altas de clientes, garantías, etc.).

## Acceso

- URL (en producción): `https://www.marketingconholistic.com/backup-dashboard/`
- **Clave por defecto**: `holistic2025` (cámbiala en `index.html`, busca `CLAVE_ESPERADA`).
- También puedes entrar con: `?clave=holistic2025` en la URL.

---

## Pasos pendientes: Contabo (VPS) — copia diaria

El dashboard ya está en producción (Vercel). Falta que **Contabo** ejecute la exportación cada noche y deje el `backup.json` donde el dashboard lo pueda leer (en el repo para que Vercel lo sirva).

### 1. En Contabo: tener el proyecto y las variables

- Clona el repo en el VPS (o sube solo la carpeta `backup-dashboard`).
- Entra a la carpeta:
  ```bash
  cd /ruta/donde/este/marketing/backup-dashboard
  ```
- Crea el archivo `.env` (mismo nivel que `package.json`):
  ```
  SUPABASE_URL=https://tu-proyecto.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
  ```
  La **service_role** la sacas de Supabase → Project Settings → API → `service_role` (secret).

- Instala y prueba una exportación:
  ```bash
  npm install
  npm run export
  ```
  Debe crearse `data/backup.json` sin errores.

### 2. Programar la exportación diaria (cron)

- Abre el crontab:
  ```bash
  crontab -e
  ```
- Añade una línea para que corra todos los días a las 2:00 (ajusta la ruta):
  ```bash
  0 2 * * * cd /ruta/completa/marketing/backup-dashboard && npm run export
  ```
  Eso solo genera `data/backup.json` en Contabo. Falta llevarlo al sitio.

### 3. Subir `backup.json` para que el dashboard lo muestre

El dashboard en **marketingconholistic.com/backup-dashboard** lee `backup-dashboard/data/backup.json` del deploy (Vercel). Tienes dos opciones:

**Opción A — Subir al repo y que Vercel despliegue**

- Después del cron, en Contabo haz commit y push del archivo (necesitas git y acceso al repo):
  ```bash
  cd /ruta/completa/marketing
  git add backup-dashboard/data/backup.json
  git commit -m "backup diario $(date +%Y-%m-%d)"
  git push origin main
  ```
- Puedes meter esto en un script y que el mismo cron lo ejecute después de `npm run export`.

**Opción B — Servir el dashboard desde Contabo**

- En Contabo configuras un servidor web (nginx/apache) que sirva la carpeta `backup-dashboard` (con `index.html` y `data/backup.json`).
- El cron además copia el JSON al sitio tras exportar, por ejemplo:
  ```bash
  0 2 * * * cd /ruta/backup-dashboard && npm run export && cp data/backup.json /var/www/backup-dashboard/data/
  ```
- La URL del dashboard sería entonces la de tu Contabo (ej. `https://tudominio.com/backup-dashboard`), no la de marketingconholistic.com.

### Resumen de pasos en Contabo

| Paso | Qué hacer |
|------|-----------|
| 1 | Clonar/subir `backup-dashboard` en el VPS |
| 2 | Crear `.env` con `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` |
| 3 | `npm install` y `npm run export` (probar que genera `data/backup.json`) |
| 4 | Añadir cron para `npm run export` cada noche (ej. 2:00) |
| 5 | Decidir: Opción A (push `data/backup.json` al repo) u Opción B (servir dashboard en Contabo) y configurarlo |

---

## Exportación diaria (referencia)

1. Variables de entorno (`.env` en `backup-dashboard`):
   - `SUPABASE_URL` = URL del proyecto (o `PUBLIC_SUPABASE_URL`)
   - `SUPABASE_SERVICE_ROLE_KEY` = clave **service_role** de Supabase (Project Settings → API). Con anon no se exporta todo por RLS.

2. Probar:
   ```bash
   cd backup-dashboard
   npm install
   npm run export
   ```
   Se genera `data/backup.json`.

3. Otras opciones (si no usas Contabo):
   - **GitHub Actions**: workflow que cada noche ejecute el script, suba `data/backup.json` al repo y dispare el deploy.
   - **Vercel Cron** (plan Pro): función que exporte y escriba el JSON donde se sirva el dashboard.

Después de cada exportación, el archivo `data/backup.json` tiene que estar donde el dashboard lo carga (mismo repo que despliega Vercel, o carpeta que sirve Contabo).

## Cambiar la clave del dashboard

En `index.html` busca la línea:
```javascript
var CLAVE_ESPERADA = 'holistic2025';
```
Sustituye `holistic2025` por la clave que quieras usar.

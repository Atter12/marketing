# Copia de seguridad — Dashboard base de datos Holistic

Dashboard separado que muestra una **copia de la base de datos** por fecha. Si la base principal (Supabase) cae o hay un incidente, los datos siguen disponibles aquí a partir de la última exportación diaria.

## Qué hace

- **Exportación diaria**: Un script descarga todo (gerentes, clientes, gastos, cobros, garantías, manual) a un archivo `data/backup.json`.
- **Dashboard**: Página web que lee ese archivo y permite **filtrar por fecha** (ej. 12 de febrero): ver todos los movimientos de ese día (cobros, gastos, altas de clientes, garantías, etc.).

## Acceso

- URL (en producción): `https://tudominio.com/backup-dashboard/`
- **Clave por defecto**: `holistic2025` (cámbiala en `index.html`, busca `CLAVE_ESPERADA`).
- También puedes entrar con: `?clave=holistic2025` en la URL.

## Exportación diaria (copia automática)

1. En la carpeta `backup-dashboard`:
   ```bash
   cd backup-dashboard
   npm install
   ```

2. Variables de entorno (crear `.env` o exportar en el sistema):
   - `SUPABASE_URL` = URL del proyecto (o `PUBLIC_SUPABASE_URL`)
   - `SUPABASE_SERVICE_ROLE_KEY` = clave service_role de Supabase (Project Settings → API). Con anon no se exporta todo por RLS.

3. Ejecutar una vez para probar:
   ```bash
   npm run export
   ```
   Se genera `data/backup.json`.

4. **Programar copia diaria** (elegir una opción):
   - **Cron en un servidor/VPS**: `0 2 * * * cd /ruta/backup-dashboard && npm run export && cp data/backup.json /ruta/deploy/backup-dashboard/data/`
   - **GitHub Actions**: workflow que cada noche ejecute el script, suba `data/backup.json` al repo (o a un artefacto) y despliegue.
   - **Vercel Cron** (si usas plan Pro): función que llame a la API de Supabase y escriba el JSON en Storage o en el proyecto.

Después de cada exportación, hay que **volver a desplegar** o **copiar** `data/backup.json` al sitio donde se sirve el dashboard (por ejemplo la misma carpeta en Vercel), para que el dashboard muestre datos al día.

## Cambiar la clave del dashboard

En `index.html` busca la línea:
```javascript
var CLAVE_ESPERADA = 'holistic2025';
```
Sustituye `holistic2025` por la clave que quieras usar.

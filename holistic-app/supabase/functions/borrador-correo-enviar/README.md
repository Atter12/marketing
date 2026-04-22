# borrador-correo-enviar

Envío transaccional por **Resend** desde la página **Borrador correo formal**, con la **misma plantilla** que `cobranza-enviar` y los **mismos secrets en Supabase** (no hace falta duplicar `RESEND_API_KEY` en Vercel).

## Nombre del slug (muy importante)

El nombre de la carpeta y del deploy debe ser exactamente:

`borrador-correo-enviar`

- Es **correo** (una sola r entre “co” y “eo”).
- Si por error desplegás `borrador-corrreo-enviar` (tres r), la URL no existe → **404** y el navegador suele mostrarlo como error **CORS** en el preflight.

## CORS / navegador

La página **Borrador correo formal** no llama a Supabase desde el browser (evita CORS). Usa el proxy en Vercel, ruta plana: **`/api/borrador-correo-proxy`** (archivo `api/borrador-correo-proxy.js`). Reenvía a esta Edge Function. No uses `api/.../carpeta/proxy.js` (en algunos deploys de Vercel eso no existe y responde 404).

En Vercel hace falta `PUBLIC_SUPABASE_URL` y `PUBLIC_SUPABASE_ANON_KEY` (mismo criterio que otras APIs del repo, p. ej. `cobranzaClaudeSuggest`).

La función aún responde bien a `OPTIONS` (CORS) por si alguien la llama directo; el flujo recomendado es vía **proxy**.


## Quién puede llamar

- Usuario con JWT de Supabase Auth **y** fila en `public.gerentes` (misma regla que `cobranza-enviar`).

## Verify JWT en el dashboard (si falla CORS en el navegador)

Si en **Supabase → Edge Functions → borrador-correo-enviar → Settings** está activado **Verify JWT**, el **OPTIONS** (preflight CORS) **no lleva** `Authorization` y el gateway responde error **antes** de tu código → Chrome dice *"blocked by CORS"* o *"preflight doesn't have HTTP ok"*.

**Solución:** desactivá **Verify JWT** (recomendado OFF: el JWT se valida dentro de la función con `getUser` + `gerentes`). Luego probá de nuevo.

O redeploy con la flag (y/o con `supabase/config.toml` en este repo que fija `verify_jwt = false`).

## Deploy

Desde la carpeta donde está vinculado el proyecto (`holistic-app` si usás este repo):

```bash
supabase functions deploy borrador-correo-enviar --no-verify-jwt
```

Comprobar en el dashboard que **Verify JWT** quedó en **OFF** tras el deploy.

Secrets: los mismos que `cobranza-enviar` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, opcional `RESEND_FROM`, `COBRANZA_*` / `EMAIL_*` para marca y logo).

## Mejor entregabilidad (Inbox vs Spam)

Esta función envía en modo **minimalista** (HTML simple + texto plano), porque suele entrar mejor a Inbox que plantillas muy decoradas.

Variables opcionales recomendadas:

- `RESEND_FROM`: remitente con dominio ya verificado (ej. `Holistic Marketing <noreply@marketingconholistic.com>`).
- `RESEND_REPLY_TO`: buzón real para respuestas (ej. `soporte@marketingconholistic.com`).

Checklist fuera de código (clave):

- SPF y DKIM del dominio en estado **valid** dentro de Resend.
- DMARC publicado para el dominio (`p=none` al inicio, luego endurecer).
- Evitar asuntos genéricos repetidos (“Solicitud de contacto” idéntico a todos).
- Mantener cuerpo con contexto real y evitar mensajes ultra cortos ambiguos.

## POST

```json
{ "to": "destino@ejemplo.com", "subject": "Asunto", "body": "Texto plano del mensaje…" }
```

Headers: `Authorization: Bearer <access_token>` y `apikey: <anon>`.

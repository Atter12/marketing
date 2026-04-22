# borrador-correo-enviar

Envío transaccional por **Resend** desde la página **Borrador correo formal**, con la **misma plantilla** que `cobranza-enviar` y los **mismos secrets en Supabase** (no hace falta duplicar `RESEND_API_KEY` en Vercel).

## Quién puede llamar

- Usuario con JWT de Supabase Auth **y** fila en `public.gerentes` (misma regla que `cobranza-enviar`).

## Deploy

```bash
supabase functions deploy borrador-correo-enviar --no-verify-jwt
```

Secrets: los mismos que `cobranza-enviar` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, opcional `RESEND_FROM`, `COBRANZA_*` / `EMAIL_*` para marca y logo).

## POST

```json
{ "to": "destino@ejemplo.com", "subject": "Asunto", "body": "Texto plano del mensaje…" }
```

Headers: `Authorization: Bearer <access_token>` y `apikey: <anon>`.

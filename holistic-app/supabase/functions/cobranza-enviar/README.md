# cobranza-enviar

Envía por **Resend** un registro de `public.cobranza_bandeja` que esté en estado `approved` (o reintenta `failed`).

## Deploy

```bash
supabase functions deploy cobranza-enviar --no-verify-jwt
```

Secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, opcional `RESEND_FROM`.

## POST

```json
{ "id": "uuid-de-cobranza_bandeja", "force": false }
```

Header: `Authorization: Bearer <access_token>` y `apikey: <anon>`.

- Sin `RESEND_API_KEY` devuelve 503 (en la app podés usar «Marcar enviado»).
- Por defecto bloquea duplicados a mismo email/cliente en 24h; `force: true` omite esa comprobación.

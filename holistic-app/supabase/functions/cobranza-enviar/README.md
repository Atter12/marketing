# cobranza-enviar

Envía por **Resend** un registro de `public.cobranza_bandeja` que esté en estado `approved` (o reintenta `failed`).

## Deploy

```bash
supabase functions deploy cobranza-enviar --no-verify-jwt
```

Secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, opcional `RESEND_FROM`.

### Marca y enlace al panel (opcional)

El HTML que guardás en `cuerpo_html` se **envuelve** en una plantilla tipo “correo oficial”: cabecera con logo y marca, tu mensaje, recuadro **Firma** (logo + nombre + tagline) y pie legal. Sin botón al panel: solo el contenido del borrador más la firma.

| Variable | Default | Uso |
|----------|---------|-----|
| `COBRANZA_BRAND_NAME` o `EMAIL_BRAND_NAME` | `Holistic Marketing` | Nombre en cabecera, firma y pie |
| `COBRANZA_LOGO_URL` o `EMAIL_LOGO_URL` | `https://www.marketingconholistic.com/credito-app/logo/logoh.png` | Logo en cabecera y bloque **Firma** (debe ser **https** público; subí `logoh.png` al sitio o usá CDN) |
| `COBRANZA_TAGLINE` o `EMAIL_TAGLINE` | `Marketing digital · Gestión de cuentas` | Subtítulo bajo la marca |
| `COBRANZA_REDIRECT_TO_EMAIL` | _(vacío)_ | **Solo pruebas:** si lo definís (ej. tu Gmail), Resend entrega el correo **ahí** en lugar del `email_destino` del registro. El asunto lleva prefijo `[Prueba · iba a: cliente@…]` y el evento `enviado_resend` guarda `destino_original` y `entregado_en`. **Quitá este secret cuando termines** para que vuelva a enviarse al cliente real. |

También se envía **`text`** (plano) a Resend usando `cuerpo_texto` si existe, para mejor entregabilidad.

## POST

```json
{ "id": "uuid-de-cobranza_bandeja", "force": false }
```

Header: `Authorization: Bearer <access_token>` y `apikey: <anon>`.

- Sin `RESEND_API_KEY` devuelve 503 (en la app podés usar «Marcar enviado»).
- Por defecto bloquea duplicados a mismo email/cliente en 24h; `force: true` omite esa comprobación.

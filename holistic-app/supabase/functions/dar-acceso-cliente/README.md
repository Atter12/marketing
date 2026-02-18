# dar-acceso-cliente

Envía al cliente un **email con link mágico** (magic link). El cliente abre el link y entra directo al panel sin contraseña.

- Usa el **primer correo** del cliente en la ficha (`clientes.emails`).
- Genera el link con `auth.admin.generateLink({ type: 'magiclink', email })`.
- Envía el email con **Resend** (opcional). Si no está configurado Resend, la función devuelve el link para que el gerente lo copie y lo comparta.

## Variables de entorno (Supabase Edge Function)

| Variable | Obligatorio | Descripción |
|----------|-------------|-------------|
| `RESEND_API_KEY` | No* | API key de [Resend](https://resend.com). Sin ella no se envía email y se devuelve el link en la respuesta. |
| `RESEND_FROM` | No | Remitente del email (ej. `Holistic <noreply@tudominio.com>`). Por defecto `onboarding@resend.dev`. |
| `APP_URL` o `PUBLIC_APP_URL` | No | URL de la app para el redirect tras el login (ej. `https://www.marketingconholistic.com`). Si no se define, el frontend puede enviar `redirect_to` en el body. |

En el **Dashboard de Supabase → Authentication → URL Configuration**, asegura que **Redirect URLs** incluya la URL de tu app para que el magic link redirija bien.

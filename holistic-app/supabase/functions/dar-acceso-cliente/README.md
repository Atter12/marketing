# dar-acceso-cliente

Envía al cliente un **email con link** para entrar al panel.

- **Primera vez (usuario nuevo):** Supabase envía el correo con `inviteUserByEmail` (plantilla "Invite"). **No hace falta API key.**
- **Cliente que ya tenía acceso:** se genera un nuevo magic link. Si está configurado **RESEND_API_KEY**, se envía el correo automáticamente; si no, se devuelve el link para que el gerente lo copie y comparta (WhatsApp, etc.).

## Variables de entorno

| Variable | Obligatorio | Descripción |
|----------|-------------|-------------|
| `APP_URL` o `PUBLIC_APP_URL` | No | URL de la app para el redirect (ej. `https://www.marketingconholistic.com/credito`). |
| `RESEND_API_KEY` | No* | Para **reenviar por email** a clientes que ya tenían acceso. Sin ella, el reenvío muestra el link para copiar. [Resend](https://resend.com) — plan gratis ~100 emails/día. |
| `RESEND_FROM` | Recomendado | Remitente. **Importante:** con `onboarding@resend.dev` (por defecto) Resend solo permite enviar al correo de tu cuenta. Para enviar a clientes, verifica un dominio en resend.com y usa ese correo (ej. `Holistic <noreply@marketingconholistic.com>`). |
| `EMAIL_BRAND_NAME` o `COBRANZA_BRAND_NAME` | No | Nombre de empresa en cabecera del correo Resend (default `Holistic Marketing`). Misma línea visual que **cobranza-enviar**. |

En **Authentication → URL Configuration**, la URL de la app debe estar en **Redirect URLs**.  
Plantillas: **Invite** (nuevos) en Supabase; reenvíos (existentes) usan **Resend** con plantilla de marca (cabecera Holistic, botón “Entrar al panel Crédito”, versión HTML + texto plano).

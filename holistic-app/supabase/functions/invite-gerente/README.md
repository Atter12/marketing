# invite-gerente

Invita por correo a un email que ya está en `public.gerentes` (solo admins).

## Dos modos de envío

| Secret | Comportamiento |
|--------|----------------|
| **`RESEND_API_KEY` configurado** | Se usa `generateLink` (invite) y el correo lo envía **Resend** con texto en **español** y branding Holistic (asunto, botón, pie). Si el usuario ya existía en Auth, se envía un **magic link** con el mismo estilo. |
| **Sin Resend** | Se usa `inviteUserByEmail` y el mensaje es el **template por defecto de Supabase** (inglés). Personalizalo en **Authentication → Email → Invite user** o configurá Resend. |

Mismos secretos que otras funciones: `RESEND_FROM` recomendado en producción (dominio verificado en Resend).

## Requisitos

1. Desplegar la función: `supabase functions deploy invite-gerente --no-verify-jwt` (o con JWT verificado si tu proyecto lo exige; el código valida sesión con `getUser`).
2. Secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
3. Opcional: `INVITE_REDIRECT_URL` — URL tras aceptar invitación (p. ej. `https://www.marketingconholistic.com/tareas/tarea.html`). Debe estar en **Authentication → URL Configuration → Redirect URLs** de Supabase.
4. Sin Resend: en **Authentication → Email** habilitá plantillas / SMTP. Revisá también **Site URL** en el dashboard: si sigue apuntando a un dominio viejo (p. ej. Vercel), el texto del mail de Supabase puede mostrar esa URL hasta que la corrijas o uses Resend + `redirect_to` / `INVITE_REDIRECT_URL`.

## Cuerpo POST

```json
{
  "email": "nuevo@ejemplo.com",
  "redirect_to": "https://..."
}
```

Header: `Authorization: Bearer <access_token del admin>` y `apikey: <anon key>`.

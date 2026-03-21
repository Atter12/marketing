# invite-gerente

Envía el correo de **invitación de Supabase Auth** (`inviteUserByEmail`) al email que ya existe en `public.gerentes`.

## Requisitos

1. Desplegar la función: `supabase functions deploy invite-gerente --no-verify-jwt` (o con JWT verificado si tu proyecto lo exige; el código valida sesión con `getUser`).
2. Secrets en el proyecto: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (suelen estar por defecto).
3. Opcional: `INVITE_REDIRECT_URL` — URL tras aceptar invitación (p. ej. `https://tudominio.com/tareas/tarea.html`).
4. En **Supabase Dashboard → Authentication → Email**: plantillas habilitadas y SMTP configurado para que llegue el mail.

## Cuerpo POST

```json
{
  "email": "nuevo@ejemplo.com",
  "redirect_to": "https://..."
}
```

Header: `Authorization: Bearer <access_token del admin>` y `apikey: <anon key>`.

# magic-link-login

Login sin contraseña para gerentes y clientes con acceso (tablas `gerentes` y `clientes_acceso`).

## Métodos

- **`method: "link"`** (por defecto): genera un magic link y lo envía por Resend. El usuario hace clic y entra.
- **`method: "code"`**: solo valida que el correo esté autorizado. El cliente luego llama `signInWithOtp` y el usuario recibe un código de 6 dígitos por correo (enviado por Supabase). Tras ingresar el código, el cliente llama `verifyOtp` y se crea la sesión.

## Plantilla de correo para código (OTP)

Para que la opción **Código de 6 dígitos** funcione, en **Supabase Dashboard → Authentication → Email Templates**, la plantilla que use el flujo de “Magic Link” / OTP debe incluir el token de 6 dígitos, por ejemplo:

```html
<p>Tu código para entrar: <strong>{{ .Token }}</strong></p>
```

Si la plantilla solo tiene el enlace de confirmación, Supabase enviará un link y no un código. Con `{{ .Token }}` se envía el código que el usuario ingresa en la app.

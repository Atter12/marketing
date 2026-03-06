# magic-link-login

Login sin contraseña para gerentes y clientes con acceso (tablas `gerentes` y `clientes_acceso`).

## Métodos

- **`method: "link"`** (por defecto): genera un magic link y lo envía por Resend. El usuario hace clic y entra.
- **`method: "code"`**: solo valida que el correo esté autorizado. El cliente luego llama `signInWithOtp` y el usuario recibe un código de 6 dígitos por correo (enviado por Supabase). Tras ingresar el código, el cliente llama `verifyOtp` y se crea la sesión.

## Plantilla de correo para código (OTP)

Cuando el usuario elige **“Código de 6 dígitos”**, el correo lo envía **Supabase** (no Resend). Por defecto Supabase usa una plantilla con **enlace** (`{{ .ConfirmationURL }}`), por eso a veces sigue llegando un link en vez del código.

### Pasos en Supabase

1. Entrá a **[Supabase Dashboard](https://supabase.com/dashboard)** → tu proyecto.
2. **Authentication** → **Email Templates**.
3. Abrí la plantilla **“Confirm signup”** o **“Magic Link”** (la que use el login por correo).
4. En el **cuerpo del mensaje**, hacé que se vea el **código de 6 dígitos** usando la variable `{{ .Token }}`.

### Ejemplo de plantilla para que llegue el código

Reemplazá el contenido (o al menos la parte del cuerpo) por algo como:

```html
<h2>Tu código para entrar</h2>
<p>Hola,</p>
<p>Usá este código de 6 dígitos para entrar a tu panel (caduca en 1 hora):</p>
<p style="margin: 24px 0; font-size: 24px; letter-spacing: 4px; font-weight: 600;">{{ .Token }}</p>
<p style="color: #666; font-size: 13px;">Si no pediste este código, podés ignorar este correo.</p>
```

- Si en la plantilla usás **`{{ .ConfirmationURL }}`** o un botón con el link → el usuario recibe **enlace** (como ahora).
- Si usás **`{{ .Token }}`** → el usuario recibe el **código** que ingresa en la app.

Guardá la plantilla. La próxima vez que alguien elija “Código de 6 dígitos” y pida el envío, el correo que mande Supabase incluirá el código.

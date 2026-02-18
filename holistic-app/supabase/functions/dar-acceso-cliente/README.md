# dar-acceso-cliente

Envía al cliente un **email con link** para entrar al panel. **No hace falta API key**: Supabase envía el correo con la plantilla "Invite".

- **Primera vez (usuario nuevo):** se usa `inviteUserByEmail` → Supabase envía el email de invitación.
- **Si el cliente ya tenía acceso:** Supabase no reenvía el invite; la función genera un nuevo magic link y lo devuelve para que el gerente lo copie y comparta (p. ej. por WhatsApp).

## Variables de entorno (opcionales)

| Variable | Descripción |
|----------|-------------|
| `APP_URL` o `PUBLIC_APP_URL` | URL de la app para el redirect tras el login (ej. `https://www.marketingconholistic.com/credito`). Si no se define, se usa esa URL por defecto. |

En **Authentication → URL Configuration**, la URL de la app debe estar en **Redirect URLs**.

Puedes personalizar el texto del email en **Authentication → Email Templates → Invite**.

# Login de Creativos y Pendientes

Las rutas **/acceso-creativos** y **/acceso-pendientes** son el login propio de Creativos y Pendientes (mismo diseño que el login de Crédito). El enlace mágico que llega al correo debe abrir directo en Creativos o en Pendientes.

## Configuración en Supabase

1. Entrá a [Supabase Dashboard](https://supabase.com/dashboard) → tu proyecto.
2. **Authentication** → **URL Configuration**.

3. **Site URL:** no debe ser `/acceso-creativos` ni `/acceso-pendientes`. Dejalo en la raíz o en Crédito, por ejemplo:  
   `https://www.marketingconholistic.com` o `https://www.marketingconholistic.com/credito`.

4. En **Redirect URLs** agregá (con tu dominio real):
   - `https://www.marketingconholistic.com/creativos`
   - `https://www.marketingconholistic.com/pendientes`
   - `https://www.marketingconholistic.com/acceso-creativos`
   - `https://www.marketingconholistic.com/acceso-pendientes`
   - Si usás el dominio sin "www": las mismas cuatro con `https://marketingconholistic.com`.

Si el enlace del correo abre en **/acceso-creativos** o **/acceso-pendientes**, esas páginas ahora guardan la sesión y te redirigen a Creativos o Pendientes. Para que el enlace abra directo en **/creativos** o **/pendientes**, asegurate de que **Site URL** no sea la de acceso y que **/creativos** y **/pendientes** estén en Redirect URLs.

## Si al entrar a Pendientes te manda a otro sitio (otro CRM / otro `*.vercel.app`)

Eso pasa cuando **Auth** usa como destino un dominio que no es Holistic:

1. **Site URL** en Supabase debe ser tu web Holistic, por ejemplo `https://www.marketingconholistic.com`. No debe ser otro proyecto (p. ej. un chatbot en Vercel).
2. En **Redirect URLs**, **no** dejes URLs de otros productos en el **mismo** proyecto Supabase si no los usás para Holistic (p. ej. `https://cmr-chatbot-two.vercel.app/**`). Cada URL permitida puede acabar siendo destino del enlace mágico si algo en el servidor cae en un fallback equivocado.
3. Agregá también `https://marketingconholistic.com/pendientes` y `https://marketingconholistic.com/acceso-pendientes` si usás el dominio sin `www` (en la captura faltaba `/pendientes` sin www).
4. En el deploy, `acceso-pendientes` y `pendientes/tarea.html` ya fuerzan el retorno a `https://www.marketingconholistic.com/pendientes` cuando el `#access_token` llega a otro host; y el magic link pide explícitamente esa URL. Volvé a desplegar la función **`magic-link-login`** si tocás el código del servidor.

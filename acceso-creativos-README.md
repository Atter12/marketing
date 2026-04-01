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

# Login de Creativos y Tareas

Las rutas **/acceso-creativos** y **/acceso-tareas** son el login propio de Creativos y Tareas (mismo diseño que el login de Crédito). El enlace mágico que llega al correo debe abrir directo en Creativos o en Tareas.

## Configuración en Supabase

1. Entrá a [Supabase Dashboard](https://supabase.com/dashboard) → tu proyecto.
2. **Authentication** → **URL Configuration**.

3. **Site URL:** no debe ser `/acceso-creativos` ni `/acceso-tareas`. Dejalo en la raíz o en Crédito, por ejemplo:  
   `https://www.marketingconholistic.com` o `https://www.marketingconholistic.com/credito`.

4. En **Redirect URLs** agregá (con tu dominio real):
   - `https://www.marketingconholistic.com/creativos`
   - `https://www.marketingconholistic.com/tareas`
   - `https://www.marketingconholistic.com/acceso-creativos`
   - `https://www.marketingconholistic.com/acceso-tareas`
   - Si usás el dominio sin "www": las mismas cuatro con `https://marketingconholistic.com`.

Si el enlace del correo abre en **/acceso-creativos** o **/acceso-tareas**, esas páginas ahora guardan la sesión y te redirigen a Creativos o Tareas. Para que el enlace abra directo en **/creativos** o **/tareas**, asegurate de que **Site URL** no sea la de acceso y que **/creativos** y **/tareas** estén en Redirect URLs.

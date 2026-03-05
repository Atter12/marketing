# Login de Creativos y Tareas

Las rutas **/acceso-creativos** y **/acceso-tareas** son el login propio de Creativos y Tareas (mismo diseño que el login de Crédito). El enlace mágico que llega al correo debe abrir directo en Creativos o en Tareas.

Para que eso funcione, hay que **agregar las URLs de redirección** en el proyecto de Supabase:

1. Entrá a [Supabase Dashboard](https://supabase.com/dashboard) → tu proyecto.
2. **Authentication** → **URL Configuration**.
3. En **Redirect URLs** agregá (con tu dominio real):
   - `https://www.marketingconholistic.com/creativos`
   - `https://www.marketingconholistic.com/tareas`
   - Si usás también el dominio sin "www": `https://marketingconholistic.com/creativos` y `https://marketingconholistic.com/tareas`.

Sin estos URLs, el enlace del correo puede abrir en la URL por defecto (Crédito) o fallar.

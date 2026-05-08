# Hoja de ruta — VideoFfyfcforge (video-app)

Dashboard interno para registrar videos del equipo, evaluar resultado (CPA), gestionar clientes/productos/editores, ver métricas (win rate) y exponer un portfolio público. Ir marcando con `[ ]` / `[x]` según se implemente.

---

## Visión y alcance (entregables de producto)

**Qué es VideoForge:**

- **Registrar videos** que produce el equipo: nombre, cliente, producto, tipo (UGC, Talking Head, etc.), plataforma (Facebook Ads, TikTok, etc.), editor, formato, duración, URL (ej. Drive), notas.
- **Evaluar resultado (CPA):** por cada video marcar 🏆 Muy bueno, ✅ Bueno, ❌ Malo o pendiente.
- **Gestionar entidades:** clientes, productos, editores (CRUD).
- **Métricas:** total de videos, “Muy buen CPA”, pendientes, win rate global y por editor/plataforma.
- **Portfolio público:** marcar qué videos están “publicados” y una vista pública para mostrar ese trabajo a posibles clientes.

**Estado actual:** Todo en `localStorage` (navegador); sin servidor ni base de datos. El HTML actual es el prototipo funcional de la UX.

---

## Herramientas disponibles

| Herramienta     | Plan   | Uso en VideoForge |
|-----------------|--------|--------------------|
| **Vercel**      | Pro    | Deploy de video-app; rewrites ya en raíz (`/video` → `video-app/video.html`). |
| **Supabase**    | Pro    | Base de datos (videos, clientes, productos, editores); Auth (equipo vs público); opcional Storage para archivos. |
| **Contabo**     | Opcional | Solo si se necesita servidor propio (workers, cron, etc.); no imprescindible para MVP. |

**Recomendaciones adicionales (opcionales):**

- **Resend / SendGrid:** si más adelante se envían emails (invitaciones, notificaciones).
- **Sentry (o similar):** monitoreo de errores en producción.
- **Supabase Edge Functions:** lógica serverless (ej. generar thumbnails, webhooks) sin tocar Contabo.

Para el alcance de esta hoja de ruta, **Vercel Pro + Supabase Pro** son suficientes; Contabo y el resto solo si el equipo los requiere después.

---

## Fase 0 — Consolidar prototipo y definiciones

Objetivo: dejar claro el contrato de datos y la UX antes de tocar backend.

- [ ] **Modelo de datos documentado:** Definir en un doc (o comentario en código) las entidades: `videos`, `clients`, `products`, `editors` con todos los campos que usará Supabase (ids, timestamps, campos actuales del HTML).
- [ ] **Nombres y listas fijas:** Confirmar listas de tipos de video (UGC, Talking Head, etc.), plataformas y formatos; dejarlas como constantes o tabla de referencia para no tener strings sueltos.
- [ ] **Revisión con supervisor:** Validar que la percepción del dashboard (registro, CPA, CRUD, métricas, portfolio) coincide con lo que pide el negocio; ajustar ítems de esta hoja si hace falta.

**Entregable:** Documento (o sección en este MD) con modelo de datos y listas; OK del supervisor sobre alcance.

---

## Fase 1 — Backend y persistencia (Supabase)

Objetivo: que los datos vivan en Supabase y no en `localStorage`.

- [ ] **Proyecto Supabase:** Crear (o reutilizar) proyecto en Supabase Pro para VideoForge.
- [ ] **Tablas:**
  - [ ] `clients` (id, name, company, email, created_at, etc.).
  - [ ] `products` (id, name, category, created_at, etc.).
  - [ ] `editors` (id, name, specialty, created_at, etc.).
  - [ ] `videos` (id, name, client_id, product_id, editor_id, type, platform, duration, format, url, notes, cpa, cpa_note, published, created_at, etc.).
- [ ] **RLS (Row Level Security):** Políticas básicas: solo usuarios autenticados del equipo pueden leer/escribir; tabla pública o vista para portfolio solo lectura si se define después.
- [ ] **API en el front:** Sustituir lectura/escritura a `localStorage` por llamadas a Supabase (REST o cliente JS): cargar y guardar clientes, productos, editores, videos.
- [ ] **Migración inicial (opcional):** Si hay datos de prueba en `localStorage`, script o flujo único para volcar a Supabase una vez; después el app solo usa Supabase.

**Entregable:** App funcional igual que hoy pero con datos persistentes en Supabase; sin auth todavía (o auth muy básico solo para desarrollo).

---

## Fase 2 — Autenticación y permisos

Objetivo: solo el equipo accede al dashboard; el portfolio público sin login.

- [ ] **Supabase Auth:** Login (email + contraseña o magic link) para “admin”/equipo.
- [ ] **Rutas/vistas:**
  - [ ] Si la URL es `/video` (o `/video/`) → exigir login; si no está logueado, redirigir a pantalla de login (o a `/video/login`).
  - [ ] Si la URL es `/video/portfolio` (o la que se defina para público) → no exigir login; mostrar solo videos con `published = true`.
- [ ] **Permisos en Supabase:** Ajustar RLS: tablas de gestión (videos, clients, products, editors) solo para usuarios autenticados; lectura pública solo para lo necesario del portfolio (p. ej. vista o endpoint de solo lectura).
- [ ] **Cerrar sesión:** Botón “Cerrar sesión” que desloguee y vuelva a login o a home.

**Entregable:** Dashboard protegido por login; portfolio público accesible sin login en URL dedicada.

---

## Fase 3 — Almacenamiento de archivos (opcional)

Objetivo: guardar archivos de video (o al menos thumbnail) en la nube y guardar la URL en la BD.

- [ ] **Supabase Storage:** Bucket para VideoForge (p. ej. `videoforge` o `videos`); políticas para que solo el equipo pueda subir/borrar.
- [ ] **Subida desde el formulario:** En “Registrar video”, permitir subir archivo; guardar en Storage y guardar en `videos` la URL pública (o firmada) del archivo.
- [ ] **Thumbnail (opcional):** Si se quiere thumbnail automático, considerar Edge Function o proceso posterior; si no, permitir subir una imagen como thumbnail y guardar su URL en `videos`.
- [ ] **Límites y formato:** Documentar tamaños máximos y formatos aceptados (MP4, MOV, etc.) y mostrarlos en la UI.

**Entregable:** Opción de subir video (y opcional thumbnail) a Supabase Storage; URL guardada en BD y mostrada/listada en el dashboard.

---

## Fase 4 — Portfolio público (URL limpia y SEO)

Objetivo: portfolio accesible por URL amigable y bien indexable/compartible.

- [ ] **URL limpia:** Definir ruta única para público, p. ej. `https://www.marketingconholistic.com/video/portfolio` (o `/video#portfolio` si se mantiene SPA). Si es SPA, configurar rewrite en Vercel para que `/video/portfolio` sirva el mismo HTML y la app muestre la vista pública.
- [ ] **Solo contenido publicado:** En esa vista, listar solo videos con `published = true`; mismos datos que hoy muestra la vista “Portfolio público” pero servida en esa URL.
- [ ] **Meta y Open Graph:** Título, descripción y OG tags específicos para la página de portfolio (para compartir en redes).
- [ ] **Enlaces en el dashboard:** Botón “Ver portfolio público” que abra esa URL en nueva pestaña.

**Entregable:** Portfolio público en URL fija, con meta/OG y enlace desde el panel.

---

## Fase 5 — UX, responsive y consistencia

Objetivo: que el dashboard sea usable en móvil y tablet y que la experiencia sea coherente.

- [ ] **Breakpoints:** Definir al menos 3: escritorio (ej. ≥1024px), tablet (768–1023px), móvil (&lt;768px). Revisar sidebar, tablas y grids con estos breakpoints.
- [ ] **Sidebar en móvil:** En pantallas pequeñas, sidebar colapsable (hamburguesa o similar) o convertido en drawer; no ocupar ancho fijo que oculte el contenido.
- [ ] **Tablas:** En móvil, convertir tablas en tarjetas apiladas o listas legibles (evitar scroll horizontal bruto); o mantener tabla con scroll horizontal suave y mensaje tipo “Desliza para ver más”.
- [ ] **Formularios:** Campos en una columna en móvil; botones de ancho completo o bien visibles; inputs táctiles con tamaño mínimo ~44px donde aplique.
- [ ] **Vista portfolio público:** Grid de videos responsive (columnas según ancho); botones y enlaces fáciles de tocar.
- [ ] **Toasts y mensajes:** Que los avisos (éxito/error) se vean bien en móvil y no tapen contenido crítico.
- [ ] **Accesibilidad básica:** Contraste suficiente; labels en inputs; focus visible en teclado.

**Entregable:** Dashboard y portfolio usables en escritorio, tablet y móvil; comportamiento y estilo coherentes.

---

## Fase 6 — Reportes, exportación y mejoras

Objetivo: explotar los datos y cerrar gaps de uso diario.

- [ ] **Exportar datos:** Botón “Exportar” (o por sección) que descargue Excel o CSV: videos, clientes, productos, editores (con filtros activos si aplica). Puede ser generación en front con librería (ej. SheetJS) o Edge Function que genere el archivo.
- [ ] **Filtros por fecha:** En listados de videos (y si aplica entregas), poder filtrar por rango de fechas (created_at o campo “fecha de entrega” si se añade).
- [ ] **Reportes/analytics en el dashboard:** Los bloques actuales (win rate global, por editor, por plataforma) ya están en el HTML; asegurar que al conectar Supabase sigan calculándose bien y que los filtros de fecha (si se añaden) los afecten donde tenga sentido.
- [ ] **Orden y búsqueda:** En listas largas (videos, clientes), orden configurable (fecha, nombre) y buscador por nombre (o por cliente en la lista de videos).
- [ ] **Códigos o IDs amigables (opcional):** Si el negocio pide “código de video” o “código de cliente” para comunicarse con el equipo, añadir campo y mostrarlo en listados y detalle.

**Entregable:** Exportación útil, filtros por fecha, orden/búsqueda donde aplique, y reportes coherentes con los datos en Supabase.

---

## Resumen por prioridad y entregables globales

| Prioridad | Fase   | Entregable principal |
|----------|--------|------------------------|
| Alta     | 0      | Modelo de datos y alcance validado con supervisor. |
| Alta     | 1      | Datos en Supabase; app usa BD en lugar de localStorage. |
| Alta     | 2      | Login para equipo; portfolio sin login en URL dedicada. |
| Media    | 4      | URL limpia y meta/OG para portfolio público. |
| Media    | 5      | Dashboard y portfolio responsive y UX coherente. |
| Media    | 6      | Exportación, filtros por fecha, orden/búsqueda. |
| Baja     | 3      | Subida de archivos a Storage (opcional). |

**Entregables globales del proyecto:**

1. **Dashboard interno** en `/video`: registro de videos, evaluación CPA, CRUD clientes/productos/editores, métricas y win rate.
2. **Portfolio público** en URL definida: solo videos publicados, sin login, con meta/OG.
3. **Persistencia** en Supabase (y opcionalmente archivos en Storage).
4. **Acceso** controlado por autenticación (equipo vs público).
5. **Responsive** y UX ordenada (sidebar, tablas, formularios, toasts).
6. **Exportación** y filtros/orden/búsqueda para uso diario.

---

*Documento vivo: ir actualizando con `[x]` al completar cada ítem. Si el supervisor pide cambios de alcance, adaptar esta hoja y las fases en consecuencia.*

# Hoja de ruta — Creativos (VideoForge) — Hacerlo realidad

Objetivo: pasar de **datos simulados en memoria** a **datos reales en Supabase**, manteniendo el mismo diseño y flujo de la app. La base de datos y el auth ya existen (mismo proyecto Supabase que Crédito).

---

## Estado actual (simulado)

- **Una sola página:** `creativo.html` con todo el HTML/CSS/JS.
- **Datos en memoria:** Objeto global `D = { projects, clients, editors, products }` y `activityLog`.
- **Seed:** `seedData()` genera clientes, productos, editores y proyectos de ejemplo al cargar; **no hay persistencia**.
- **Auth:** Solo se exige login (redirect a `/login`) para entrar; no se asocian datos al usuario.

Entidades actuales:

| Entidad   | Campos principales |
|-----------|---------------------|
| Clientes  | id, name, company, email, createdAt |
| Productos | id, name, category, createdAt |
| Editores  | id, name, specialty, createdAt |
| Proyectos | id, name, clientId, productId, editorId, type, platform, format, brief, stages (inspiración → guión → producción → revisión → entrega), cpa, published, createdAt |

Cada **etapa** del proyecto tiene: `status`, `files`, `note`, `reviewer`, `reviewNote`, `reviewedAt`.

---

## Fases para hacerlo realidad

### Fase 1 — Base de datos (Supabase)

Crear tablas en el mismo proyecto Supabase. Opción: prefijo `creativos_` para no mezclar con Crédito.

- [x] **1.1** Tabla `creativos_clientes`  
  - `id` (uuid, PK), `name`, `company`, `email`, `created_at`, `created_by` (opcional: email del gerente que lo creó).

- [x] **1.2** Tabla `creativos_productos`  
  - `id` (uuid, PK), `name`, `category`, `created_at`, `created_by` (opcional).

- [x] **1.3** Tabla `creativos_editores`  
  - `id` (uuid, PK), `name`, `specialty`, `created_at`, `created_by` (opcional).

- [x] **1.4** Tabla `creativos_proyectos`  
  - `id` (uuid, PK), `name`, `client_id` (FK), `product_id` (FK), `editor_id` (FK), `type`, `platform`, `format`, `brief` (text), `cpa`, `published` (boolean), `created_at`, `created_by` (opcional).

- [x] **1.5** Tabla `creativos_etapas` (o JSONB dentro de proyecto)  
  - Opción B implementada: columna `stages` (JSONB) en `creativos_proyectos` con estructura por etapa (inspiracion, guion, produccion, revision, entrega): `status`, `files`, `note`, `reviewer`, `reviewNote`, `reviewedAt`.

- [x] **1.6** RLS (Row Level Security): solo gerentes pueden leer/escribir. Usa `public.is_gerente()` (tabla `gerentes`).

- [ ] **1.7** (Opcional) Archivos por etapa: bucket Supabase Storage `creativos-files` con políticas por `project_id` y etapa.

---

### Fase 2 — Auth e identidad

- [ ] **2.1** Tras el login actual, obtener el usuario (igual que en Crédito: `supabase.auth.getUser()`). Solo gerentes pueden usar Creativos por ahora (mismo criterio que Crédito).

- [ ] **2.2** En cada mutación (crear/editar cliente, producto, editor, proyecto), guardar `created_by` / `updated_by` con el email del gerente (opcional pero útil para auditoría).

- [ ] **2.3** (Opcional) Si más adelante un “cliente” (acceso desde `clientes_acceso`) puede ver solo sus proyectos, filtrar por `client_id` vinculado al cliente de Crédito.

---

### Fase 3 — Cargar y guardar desde Supabase

Sustituir el uso de `D` y `activityLog` por llamadas a Supabase.

- [x] **3.1** Al cargar la página (tras comprobar sesión), hacer `select` de clientes, productos, editores, proyectos (con `stages` en JSONB).

- [x] **3.2** Si hay Supabase se carga desde la API; si no, se ejecuta seedData(). Eliminar o desactivar `seedData()` en producción; opcional: mantener un “seed” solo en desarrollo o con un flag.

- [x] **3.3** Crear/editar cliente: insert o update en `creativos_clientes`, luego reload.

- [x] **3.4** Crear/editar producto: insert o update en `creativos_productos`, luego reload.

- [x] **3.5** Crear/editar editor: insert o update en `creativos_editores`, luego reload.

- [x] **3.6** Crear proyecto: insert en `creativos_proyectos` (con stages), luego reload.

- [x] **3.7** Actualizar etapa: update del proyecto con `stages` (startStage, sendToReview, approveStage, etc.). setCPA y togglePublish también persisten.

- [ ] **3.8** Activity log: puede derivarse de `created_at` / `updated_at` de proyectos y etapas, o añadir una tabla `creativos_activity_log` si se quiere historial explícito.

---

### Fase 4 — Integración con Crédito (opcional)

- [ ] **4.1** Si se desea reutilizar los **clientes de Crédito** como “clientes” en Creativos:  
  - Leer desde la tabla `clientes` (o la que use Crédito) en lugar de (o además de) `creativos_clientes`.  
  - Mantener una vista o tabla de “cliente de creativos” que referencie `client_id` de Crédito para no duplicar datos.

- [ ] **4.2** En el formulario “Cliente” al crear proyecto, un selector que cargue clientes de Crédito o de `creativos_clientes` según se defina.

---

### Fase 5 — Archivos y UX

- [ ] **5.1** Subida de archivos por etapa: usar Supabase Storage (bucket `creativos-files`), guardar rutas en `stages[stageKey].files` del proyecto.

- [ ] **5.2** Manejo de errores: mensajes claros si falla el `insert`/`update` (por ejemplo “No se pudo guardar; intentá de nuevo”) y reintento.

- [ ] **5.3** Loading: mostrar skeleton o spinner mientras cargan clientes, productos, editores y proyectos al inicio.

---

## Orden sugerido de implementación

1. Fase 1 (migraciones SQL y RLS).  
2. Fase 2 (auth ya está; solo asegurar que el usuario sea gerente si aplica).  
3. Fase 3.1–3.2 (carga inicial y quitar seed en prod).  
4. Fase 3.3–3.7 (CRUD completo).  
5. Fase 5.2–5.3 (errores y loading).  
6. Fase 4 y 5.1 según prioridad.

---

## Estimación de dificultad

| Fase   | Dificultad | Notas |
|--------|------------|--------|
| 1      | Media      | SQL estándar; RLS similar a Crédito. |
| 2      | Baja       | Reusar auth existente. |
| 3      | Media-Alta | Refactorizar JS actual para async/await y sustituir `D` por datos de Supabase. |
| 4      | Media      | Solo si se quiere unificar con clientes de Crédito. |
| 5      | Media      | Storage y UX incremental. |

**Resumen:** Es viable hacerlo realidad con el mismo stack (Supabase + auth actual). La parte más trabajosa es el refactor del JS para cargar/guardar todo desde la API y dejar de depender de `seedData()`.

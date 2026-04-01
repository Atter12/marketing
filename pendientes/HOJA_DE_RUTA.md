# Hoja de ruta — Pendientes (AgencyFlow) — Hacerlo realidad

Objetivo: pasar de **datos hardcodeados en JS** a **datos reales en Supabase**, manteniendo el mismo diseño y flujo. Misma base de datos y auth que Crédito y Creativos.

---

## Estado del proyecto

**Implementación core terminada (listo para revisión).**

- **Fase 1** — Hecha: tablas `tareas_*` en Supabase + RLS gerentes.
- **Fase 3** — Hecha: carga inicial desde Supabase, datos vacíos por defecto (sin simulados). CRUD completo: clientes (crear, editar, eliminar), equipo (crear miembro), kanban (crear entregable, mover columna), tickets (crear, resolver, comentarios), calendario (crear evento).
- **Pendiente opcional:** Fase 2 (traza created_by), 3.8 (workflows instancias), Fase 4 (integración Crédito), Fase 5 (loading/errores, tiempo real, SLA).

---

## Estado actual (simulado) — ya no aplica; datos desde Supabase

- **Una sola página:** `tarea.html` con todo el HTML/CSS/JS.
- **Datos en constantes:** `TEAM`, `MT`, `clients`, `KT` (kanban), `tickets`, `workflows`, `calI` (calendario). **Nada se persiste**.
- **Auth:** Solo se exige login para entrar; no se asocian datos al usuario.

Entidades actuales (resumido):

| Variable   | Uso |
|------------|-----|
| TEAM       | Equipo: id, nombre, rol, color, presencia, asistencia, servicio, etc. |
| MT         | Pendientes por miembro (workload): mapa id_miembro → lista de ítems con título y días. |
| clients    | Clientes: nombre, tipo, fases, equipo asignado, entregables, tickets, reuniones, satisfacción, presupuesto, contacto, health, status, etc. |
| KT         | Kanban: columnas todo / progress / review / done; cada tarjeta: título, descripción, servicio, prioridad, fecha, progreso, equipo, cliente, subtareas. |
| tickets    | Mesa de ayuda: id, título, cliente, estado, prioridad, SLA, asignado, timeline de comentarios. |
| workflows  | Definiciones de flujos (ideación, bocetaje, aprobación, etc.) con pasos y badges. |
| calI       | Eventos de calendario: día del mes, título, clase CSS. |

---

## Fases para hacerlo realidad

### Fase 1 — Base de datos (Supabase)

Prefijo sugerido: `tareas_` para no mezclar con Crédito/Creativos.

- [x] **1.1** Tabla `tareas_equipo`  
  - `id` (text/varchar PK, ej. 'DG'), `nombre`, `rol`, `color`, `servicio`, `activo` (boolean), `created_at`, `updated_at`.  
  - Opcional: campos de asistencia (`asistencia`, `checkin_at`, etc.) si se quiere registrar presencia.

- [x] **1.2** Tabla `tareas_clientes`  
  - `id` (uuid PK), `nombre`, `tipo` (SaaS, Cosmética, etc.), `color`, `fases` (JSONB array), `fase_actual` (int), `servicios` (JSONB array de tags), `equipo_ids` (JSONB array), `entregables`, `entregables_hechos`, `tickets_count`, `meetings_count`, `satisfaccion`, `presupuesto`, `gastado`, `contacto_nombre`, `email`, `telefono`, `proxima_accion`, `contrato_inicio`, `contrato_fin`, `fee_mensual`, `health`, `health_txt`, `notes`, `status` (activo, onboarding, etc.), `created_at`, `updated_at`.

- [x] **1.3** Tabla `tareas_kanban`  
  - `id` (uuid PK), `columna` (todo, progress, review, done), `titulo`, `descripcion`, `servicio` (tag), `prioridad` (hi, md, lo), `fecha_entrega`, `estado_fecha` (lt, sn, dn), `progreso` (0–100), `equipo_ids` (JSONB), `cliente_nombre` o `cliente_id` (FK opcional), `subtareas` (text ej. '2/5'), `orden` (int para ordenar en columna), `created_at`, `updated_at`.

- [x] **1.4** Tabla `tareas_tickets`  
  - `id` (uuid PK), `codigo` (TK-001), `titulo`, `subtitulo`, `cliente_nombre`, `cliente_color`, `status` (open, progress, closed), `prioridad`, `categoria`, `canal`, `asignado_id` (FK a tareas_equipo), `sla_horas`, `sla_vencimiento`, `sla_status`, `entregable_vinculado`, `created_at`, `updated_at`.  
  - Tabla `tareas_ticket_comentarios`: `id`, `ticket_id`, `quien`, `que`, `cuando`, `tipo` (system, comment).

- [x] **1.5** Tabla `tareas_workload` (tareas por miembro)  
  - `id` (uuid PK), `equipo_id` (FK), `titulo`, `dias` (número), `created_at`.  
  - O bien un JSONB en `tareas_equipo` con la lista de tareas de carga (más simple al inicio).

- [x] **1.6** Tabla `tareas_calendario`  
  - `id` (uuid PK), `dia` (int 1–31), `mes` (int), `anio` (int), `titulo`, `clase_css` (pill-green, etc.), `cliente_id` o referencia opcional, `created_at`.

- [x] **1.7** Tabla `tareas_workflows` (definiciones)  
  - `id` (uuid PK), `icono`, `titulo`, `descripcion`, `pasos` (JSONB array), `activo` (int), `badges` (JSONB array), `orden`.  
  - Puede quedar como datos de configuración (pocos cambios) y cargarse desde JSON o una tabla.

- [x] **1.8** RLS: solo gerentes pueden leer/escribir (mismo criterio que Crédito: `auth.jwt() ->> 'email'` y tabla `gerentes`).

---

### Fase 2 — Auth e identidad

- [ ] **2.1** Usar el mismo login que ya redirige a /pendientes; al cargar la app, verificar sesión (ya está con el script actual) y opcionalmente que el usuario sea gerente.

- [ ] **2.2** En mutaciones, guardar `created_by` / `updated_by` (email del gerente) si se quiere trazabilidad.

---

### Fase 3 — Cargar y guardar desde Supabase

Sustituir las constantes por datos cargados desde la API.

- [x] **3.1** Al cargar la página:
  - `select` de `tareas_equipo` → rellenar TEAM.
  - `select` de `tareas_clientes` → rellenar clients.
  - `select` de `tareas_kanban` ordenado por columna y orden → rellenar KT.
  - `select` de `tareas_tickets` (+ comentarios si está en otra tabla) → rellenar tickets.
  - `select` de `tareas_workload` o lectura de JSONB en equipo → rellenar MT.
  - `select` de `tareas_calendario` para el mes actual → rellenar calI.
  - `select` de `tareas_workflows` (o cargar JSON estático) → workflows.

- [x] **3.2** Eliminar o no ejecutar los arrays hardcodeados actuales cuando existan datos en Supabase; opcional: seed inicial vía migración o script para desarrollo.

- [x] **3.3** CRUD clientes: insert/update/delete en `tareas_clientes`.

- [x] **3.4** CRUD equipo: insert/update en `tareas_equipo`; workload como JSONB o tabla aparte.

- [x] **3.5** Kanban: al mover una tarjeta, `update` de `tareas_kanban` (cambiar `columna` y `orden`). Crear/editar tarjeta: insert/update.

- [x] **3.6** Tickets: insert/update en `tareas_tickets`; agregar comentarios en `tareas_ticket_comentarios`.

- [x] **3.7** Calendario: insert/update/delete en `tareas_calendario`.

- [ ] **3.8** Workflows: si son solo definiciones, puede bastar con cargar desde tabla o JSON; si se guardan “instancias” de flujo por proyecto, añadir tabla y lógica después.

---

### Fase 4 — Integración con Crédito (opcional)

- [ ] **4.1** Si los “clientes” de Pendientes deben ser los mismos que en Crédito: usar tabla `clientes` (Crédito) y tal vez una vista o tabla intermedia que una con entregables/tickets. O mantener `tareas_clientes` con un `credito_client_id` (FK) opcional para sincronizar nombre y contacto.

- [ ] **4.2** Selector de cliente al crear entregable o ticket: opción de elegir cliente de Crédito o de Pendientes según el modelo que se adopte.

---

### Fase 5 — UX y mejoras

- [ ] **5.1** Loading: skeletons o spinners mientras cargan equipo, clientes, kanban, tickets, calendario.

- [ ] **5.2** Manejo de errores: mensajes claros en insert/update y opción de reintentar.

- [ ] **5.3** (Opcional) Tiempo real: suscripción con `supabase.channel()` a cambios en `tareas_kanban` y `tareas_tickets` para que varios gerentes vean cambios al instante.

- [ ] **5.4** (Opcional) SLA real: calcular `sla_vencimiento` y `sla_status` en backend o con Edge Function cuando se crea un ticket según prioridad.

---

## Orden sugerido de implementación

1. Fase 1 (migraciones: equipo, clientes, kanban, tickets; después workload, calendario, workflows).  
2. Fase 2 (auth ya está; solo asegurar gerente).  
3. Fase 3.1–3.2 (carga inicial; dejar de usar constantes como fuente de verdad).  
4. Fase 3.3–3.7 (CRUD por sección: clientes, equipo, kanban, tickets, calendario).  
5. Fase 5.1–5.2 (loading y errores).  
6. Fase 4 y 5.3–5.4 según prioridad.

---

## Estimación de dificultad

| Fase   | Dificultad | Notas |
|--------|------------|--------|
| 1      | Alta       | Muchas tablas y campos; JSONB ayuda para fases, servicios, equipo_ids, etc. |
| 2      | Baja       | Reusar auth existente. |
| 3      | Alta       | Refactor grande: toda la lógica que hoy lee TEAM, clients, KT, tickets, etc. debe pasar a async y a Supabase. |
| 4      | Media      | Solo si se unifica con clientes de Crédito. |
| 5      | Media      | UX y opcionales (tiempo real, SLA). |

**Resumen:** Es viable con el mismo stack (Supabase + auth actual). La complejidad es mayor que en Creativos porque hay más entidades (equipo, clientes, kanban, tickets, calendario, workflows). Conviene hacer por bloques: primero equipo y clientes, luego kanban, luego tickets, luego calendario y workload.

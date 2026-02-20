# Hoja de ruta — Holistic Marketing (panel gerente/cliente)

Lista ordenada de mejoras y tareas, unificada a partir de requerimientos del equipo y supervisión. Ir marcando con `[ ]` / `[x]` según se implemente.

---

## 1. Perfil y foto del gerente

- [x] **Foto del gerente:** El gerente debe poder subir su foto de perfil (igual que los clientes).
- [x] Mostrarla en la web: responsive, algo más grande, visible y con buen estilo (sidebar/header).

---

## 2. Dar acceso al cliente (email + link mágico)

    **Flujo actual – Email con link (magic link):**

    - [x] En la **ficha del cliente**, el gerente tiene un botón/acción **"Dar acceso"**.
    - [x] Al hacerlo, el sistema usa el **correo del cliente** (el primero de la ficha). Si no tiene correo, se pide agregarlo en Editar cliente.
    - [x] Por detrás: se genera un **link mágico** (Supabase Auth) y se **envía por email** al cliente (vía Resend u otro proveedor).
    - [x] El cliente **abre el link desde su correo** y entra directo al panel (dashboard), sin escribir contraseña.
    - [x] **Ventaja:** se sigue usando el login normal (correo + contraseña) y Supabase Auth; experiencia simple (un clic desde el email); el gerente no comparte PIN ni contraseña.

    *(Implementado: Edge Function `dar-acceso-cliente` con magic link + envío de email; botón en ficha y en lista; cliente debe tener al menos un email en la ficha. Opción "Reenviar link" si ya tenía acceso.)*

---

## 3. Fechas y períodos (unificado)

- [x] **Fecha de movimiento:** Debe ser **fecha completa (día + mes + año)**, mostrada como **dd/mm/aaaa**.
- [x] **Período:** Debe ser **solo mes y año (mm/aaaa)**. Lo que hoy se llama "fecha de movimiento" en algunos contextos pasa a ser "período" donde corresponda.
- [x] **Calendario/datepicker:** Todas las fechas y períodos deben elegirse con calendario o selectores limitados para evitar errores de tipeo.
- [x] **Gastos Ads:** Incluir el **día** en la fecha de movimiento (es decir, fecha completa dd/mm/aaaa); el período (mm/aaaa) como campo aparte.
- [x] **Botón "Período":** Incluir selector con **fecha inicio** y **fecha fin** (rango) donde aplique (filtros, reportes, descargas).

---

## 4. Códigos (automáticos y visibles)

- [x] **Código de gasto:** Siempre automático; **quitar** el input para que nadie lo edite. Generado solo por el sistema.
- [x] **Código de cobro:** Agregar y mostrar **columna "Código de cobro"** en la tabla de cobros (código único por cobro).
- [x] **Código de verificación (garantías):** Que sea automático en todo y que **sí se muestre** en garantías (ahora no sale).
- [x] En listados/exportaciones: incluir **código del gasto al que hace referencia** cada cobro y **código de la garantía** cuando aplique.

---

## 5. Prepago y cobros

- [x] **Cobro no solo para prepago:** El registro de cobro debe estar disponible **para todos los gastos**, no solo para los marcados como prepago. Ajustar textos y lógica.
- [x] **Etiqueta en el modal:** Revisar el texto "Gasto * (solo prepago)" en "Registrar cobro": o bien se permite para todo y se cambia el texto, o se explica claramente en el dashboard qué hace ese paso.
- [x] **Si el gasto es prepago:** Mostrar claramente la opción **"Añadir cobro"** (o similar) y mejorar el flujo para que sea obvio.
- [x] **Columna Prepago en gastos:** Mostrar **S** si es prepago y **N** si no (en lugar de solo checkbox o valor poco claro).

---

## 6. Descargas (Excel y por rango)

- [x] **Botón descargar en formato Excel** para:
  - [x] Cobros (con rango de fechas si aplica)
  - [x] Gastos (con rango de fechas si aplica)
  - [x] Garantías (y demás listados que apliquen)
- [x] **Por cliente:** Poder descargar los datos **de un cliente en específico** (sus gastos, cobros, garantías) con opción de rango de fechas.
- [x] **Selector de fechas + descargar:** En cada sección (cobros, gastos, garantías, etc.), un espacio para elegir **fechas (inicio/fin)** y un **botón "Descargar Excel"** que exporte solo las filas de ese rango (y filtros activos).

---

## 7. Garantías

- [x] Mostrar **código de verificación** en garantías (columna visible y en export).
- [x] Incluir **código de gasto** asociado cuando exista (columna o referencia en detalle/export).

---

## 8. Otros / notas

- [ ] **holistic2025:** Anotado como referencia (ej. contraseña dashboard backup); no es tarea de desarrollo, solo recordatorio.
- [ ] Revisar mensajes y tooltips del dashboard para que quede claro: qué es prepago, qué es "registrar cobro", qué es período vs fecha de movimiento.

---

## 9. UX y consistencia: buscadores, contadores, descargas y reportes

Objetivo: mismo patrón en Gastos, Cobros y Garantías (como en Clientes), contadores de filas, descarga en Clientes, y reportes enriquecidos.

### 9.1 Buscador / filtro por cliente

- [x] **Gastos Ads:** Añadir combobox o buscador para filtrar por cliente (igual que el buscador por nombre en Clientes). Mostrar solo gastos del cliente seleccionado o todos si no hay filtro.
- [x] **Cobros:** Mismo patrón: combobox o buscador para filtrar por cliente.
- [x] **Garantías:** Mismo patrón: combobox o buscador para filtrar por cliente.

### 9.2 Contador de filas

- [x] **Gastos:** Contador visible en el header (ej. "X gastos en total" o "Y de X gastos" si hay filtro), en un lugar claro y cómodo (como en Clientes).
- [x] **Cobros:** Contador de filas en el header (total y, si aplica, "Y de X" con filtro).
- [x] **Garantías:** Contador de filas en el header.

### 9.3 Estructura de página unificada

- [x] **Cobros y Garantías:** Seguir la misma estructura de **Gastos Ads** (header con título, filtros/contador a un lado, botones; contenido ordenado). Evitar layouts distintos que confundan entre secciones.

### 9.4 Descarga en Clientes

- [x] **Clientes:** Añadir botón **Descargar Excel** (o similar) para exportar el listado de clientes (como ya existe en Gastos, Cobros y Garantías).

### 9.5 Reportes: FEE y bloques del Resumen

- [x] **FEE en reportes:** Incluir **FEE** (y **% FEE** donde corresponda) en la vista de reportes / relación de cuentas (que ya muestra ADS, TOTAL, PAGADO, etc.).
- [x] **Cuatro bloques del Resumen en Reportes:** Replicar en la sección Reportes los mismos 4 bloques que tiene el Resumen (Dashboard):
  1. **Gasto Mensual en Ads** — "Inversión + fees por mes" (gráfico de barras: Gasto Ads + Fee por mes).
  2. **Métodos de Cobro** — "Distribución por medio de pago" (gráfico por método de pago).
  3. **Cobrado vs Gasto** — "Evolución mensual" (gráfico: Cobrado vs Gasto por mes).
  4. **Deuda Neta por Cliente** — "Incluye descuento de garantías" (gráfico o tabla por cliente).
- [x] Asegurar que el **% FEE** aparezca también en "el otro reporte" (vista relación de cuentas o la vista alternativa de reportes).

---

## Resumen por prioridad sugerida

| Prioridad | Tema                    | Tareas clave |
|----------|-------------------------|--------------|
| Alta     | Dar acceso (email + link) | Botón "Dar acceso"; envío de email con link mágico al correo del cliente; vincular en clientes_acceso |
| Alta     | Fechas y períodos       | dd/mm/aaaa, mm/aaaa, calendarios, día en gastos |
| Alta     | Códigos                 | Gastos y verificación automáticos; columna código cobro; mostrar códigos en garantías |
| Alta     | Cobros / prepago        | Cobro para todos; S/N prepago; "Añadir cobro" cuando prepago; texto claro en UI |
| Media    | Descargas Excel         | Botones por sección + rango de fechas + por cliente |
| Media    | Foto gerente            | Subir foto y mostrarla responsive y visible |
| Media    | **§9 UX y consistencia** | Buscador/filtro por cliente en Gastos, Cobros, Garantías; contador de filas en las tres; misma estructura que Gastos Ads; descarga en Clientes; Reportes con FEE/% FEE y los 4 bloques del Resumen |

---

*Documento vivo: ir actualizando con `[x]` al completar cada ítem.*

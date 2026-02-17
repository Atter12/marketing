# Hoja de ruta — Holistic Marketing (panel gerente/cliente)

Lista ordenada de mejoras y tareas, unificada a partir de requerimientos del equipo y supervisión. Ir marcando con `[ ]` / `[x]` según se implemente.

---

## 1. Perfil y foto del gerente

- [x] **Foto del gerente:** El gerente debe poder subir su foto de perfil (igual que los clientes).
- [x] Mostrarla en la web: responsive, algo más grande, visible y con buen estilo (sidebar/header).

---

## 2. Dar acceso al cliente (Correo + PIN) — recomendado

**Opción 1 – Correo + PIN (recomendada y más segura):**

- [x] En la **ficha del cliente**, el gerente tiene un botón/acción **"Dar acceso"**.
- [x] Al hacerlo, el gerente ingresa **correo del cliente** y un **PIN** (ej. 4–12 caracteres).
- [x] Por detrás: se crea la cuenta (correo + PIN como contraseña) y se vincula ese correo al cliente en `clientes_acceso`.
- [x] El cliente entra a la web con **ese correo + PIN** (el PIN es la contraseña) y ve solo sus reportes.
- [x] **Ventaja:** se sigue usando el login normal (correo + contraseña) y Supabase Auth; el “PIN” es solo la contraseña que el gerente les da.

*(Implementado: Edge Function `dar-acceso-cliente`; botón en ficha y en lista de clientes; opción “Dar acceso” al crear nuevo cliente.)*

---

## 3. Fechas y períodos (unificado)

- [ ] **Fecha de movimiento:** Debe ser **fecha completa (día + mes + año)**, mostrada como **dd/mm/aaaa**.
- [ ] **Período:** Debe ser **solo mes y año (mm/aaaa)**. Lo que hoy se llama "fecha de movimiento" en algunos contextos pasa a ser "período" donde corresponda.
- [ ] **Calendario/datepicker:** Todas las fechas y períodos deben elegirse con calendario o selectores limitados para evitar errores de tipeo.
- [ ] **Gastos Ads:** Incluir el **día** en la fecha de movimiento (es decir, fecha completa dd/mm/aaaa); el período (mm/aaaa) como campo aparte.
- [ ] **Botón "Período":** Incluir selector con **fecha inicio** y **fecha fin** (rango) donde aplique (filtros, reportes, descargas).

---

## 4. Códigos (automáticos y visibles)

- [ ] **Código de gasto:** Siempre automático; **quitar** el input para que nadie lo edite. Generado solo por el sistema.
- [ ] **Código de cobro:** Agregar y mostrar **columna "Código de cobro"** en la tabla de cobros (código único por cobro).
- [ ] **Código de verificación (garantías):** Que sea automático en todo y que **sí se muestre** en garantías (ahora no sale).
- [ ] En listados/exportaciones: incluir **código del gasto al que hace referencia** cada cobro y **código de la garantía** cuando aplique.

---

## 5. Prepago y cobros

- [ ] **Cobro no solo para prepago:** El registro de cobro debe estar disponible **para todos los gastos**, no solo para los marcados como prepago. Ajustar textos y lógica.
- [ ] **Etiqueta en el modal:** Revisar el texto "Gasto * (solo prepago)" en "Registrar cobro": o bien se permite para todo y se cambia el texto, o se explica claramente en el dashboard qué hace ese paso.
- [ ] **Si el gasto es prepago:** Mostrar claramente la opción **"Añadir cobro"** (o similar) y mejorar el flujo para que sea obvio.
- [ ] **Columna Prepago en gastos:** Mostrar **S** si es prepago y **N** si no (en lugar de solo checkbox o valor poco claro).

---

## 6. Descargas (Excel y por rango)

- [ ] **Botón descargar en formato Excel** para:
  - [ ] Cobros (con rango de fechas si aplica)
  - [ ] Gastos (con rango de fechas si aplica)
  - [ ] Garantías (y demás listados que apliquen)
- [ ] **Por cliente:** Poder descargar los datos **de un cliente en específico** (sus gastos, cobros, garantías) con opción de rango de fechas.
- [ ] **Selector de fechas + descargar:** En cada sección (cobros, gastos, garantías, etc.), un espacio para elegir **fechas (inicio/fin)** y un **botón "Descargar Excel"** que exporte solo las filas de ese rango (y filtros activos).

---

## 7. Garantías

- [ ] Mostrar **código de verificación** en garantías (columna visible y en export).
- [ ] Incluir **código de gasto** asociado cuando exista (columna o referencia en detalle/export).

---

## 8. Otros / notas

- [ ] **holistic2025:** Anotado como referencia (ej. contraseña dashboard backup); no es tarea de desarrollo, solo recordatorio.
- [ ] Revisar mensajes y tooltips del dashboard para que quede claro: qué es prepago, qué es "registrar cobro", qué es período vs fecha de movimiento.

---

## Resumen por prioridad sugerida

| Prioridad | Tema                    | Tareas clave |
|----------|-------------------------|--------------|
| Alta     | Dar acceso (Correo+PIN) | Botón "Dar acceso" en ficha cliente; correo + PIN; crear cuenta y vincular en clientes_acceso |
| Alta     | Fechas y períodos       | dd/mm/aaaa, mm/aaaa, calendarios, día en gastos |
| Alta     | Códigos                 | Gastos y verificación automáticos; columna código cobro; mostrar códigos en garantías |
| Alta     | Cobros / prepago        | Cobro para todos; S/N prepago; "Añadir cobro" cuando prepago; texto claro en UI |
| Media    | Descargas Excel         | Botones por sección + rango de fechas + por cliente |
| Media    | Foto gerente            | Subir foto y mostrarla responsive y visible |

---

*Documento vivo: ir actualizando con `[x]` al completar cada ítem.*

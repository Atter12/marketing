# Cobranza en Credito - Implementacion en curso

## Estado actual (23-03-2026)
- [x] Base SQL creada para MVP (bandeja, historial, estados, helper anti-duplicado)
- [x] UI `Cobranza` en Crédito (`holistic-app/src/CobranzaView.jsx` + menú en `App.jsx`)
- [x] Generador de borradores (clientes con deuda neta > 0 y email)
- [x] Aprobar / Rechazar / editar asunto y cuerpo
- [x] Envío vía Edge Function `cobranza-enviar` + Resend (o «Marcar enviado» manual)
- [x] Eventos en `cobranza_eventos` (trazabilidad básica)
- [x] Pestaña **Historial** (eventos con cliente/asunto)
- [x] Flujo visual en 4 pasos + texto «revisión humana»
- [x] Selección múltiple: aprobar / rechazar en lote
- [x] Modal: pestañas Editar / Vista previa / Variables / Historial del correo
- [x] **Guardar** sin cerrar o **Guardar y cerrar**; motivo de rechazo en el modal
- [x] Borradores **Agradecimiento** para clientes al día (sin deuda)

## Roadmap — redacción con IA (Opus / Claude) **(pendiente, no implementado)**

Objetivo: que un modelo genere **asunto + cuerpo** más natural y distinto por caso; el borrador **sigue** pasando por revisión y aprobación humana antes de Resend.

| Paso | Estado | Notas |
|------|--------|--------|
| 1. Cuenta y API **Anthropic** (Claude Opus u otro modelo Claude) | Pendiente | Opus es un modelo de **Anthropic**, no un producto aparte: necesitás **API key** en [console.anthropic.com](https://console.anthropic.com) y plan/billing según uso. |
| 2. Secret en Supabase `ANTHROPIC_API_KEY` (solo servidor) | Pendiente | Nunca en el frontend. |
| 3. Edge Function ej. `cobranza-generar-ia` | Pendiente | Recibe contexto CRM + tono; devuelve JSON `{ asunto, cuerpo_texto }`; opcional log en `cobranza_eventos`. |
| 4. Botón en `CobranzaView` “Generar con IA” / lote | Pendiente | Inserta o actualiza fila en `cobranza_bandeja` en `pending_approval`. |
| 5. Límites y costos | Pendiente | Tope diario, modelo más barato para pruebas (ej. Sonnet), etc. |

**Qué necesitás sí o sí para Opus:** la **API de Anthropic** (`ANTHROPIC_API_KEY`). Sin eso no hay llamada al modelo desde el backend.

*(Alternativa: OpenAI u otro proveedor; el roadmap es el mismo, cambia el nombre del secret y el endpoint.)*

## Migrations agregadas
- `supabase/migrations/039_cobranza_bandeja_historial.sql`
- `holistic-app/supabase/migrations/20260323000000_cobranza_bandeja_historial.sql`

## Objetivo
Crear una nueva seccion en Credito llamada `Cobranza` para preparar correos de cobro personalizados y enviarlos de forma masiva, con control humano antes del envio.

## Flujo propuesto (resumen)
1. Generar borradores de correo por cliente (con variables y contexto CRM).
2. Mostrar esos borradores en una bandeja de revision.
3. Permitir `Aprobar` o `Rechazar` cada correo (o por lote).
4. Enviar solo los aprobados.
5. Guardar historial completo de envios y estados.

## Seccion nueva: Cobranza

### 1) Bandeja "Listos para enviar"
- Lista de correos generados para cada cliente.
- Columnas sugeridas:
  - Cliente
  - Email destino
  - Monto pendiente
  - Fecha limite / estado de deuda
  - Asunto sugerido
  - Vista previa del cuerpo
  - Estado (`pendiente_revision`, `aprobado`, `rechazado`, `enviado`, `error`)
  - Acciones (`Ver`, `Aprobar`, `Rechazar`, `Editar`)

### 2) Modal/Panel de revision (por correo)
- Mostrar:
  - Datos del cliente
  - Variables reemplazadas
  - Cuerpo final del correo
  - Motivacion sugerida por IA (opcional)
- Acciones:
  - Aprobar
  - Rechazar (con motivo)
  - Editar manualmente asunto/cuerpo

### 3) Envio masivo con control
- Boton: `Enviar aprobados`.
- Confirmacion previa con conteo.
- Cola de envio con progreso (`x/y`).
- Reintentos para fallidos.

## Reglas de negocio clave
- Si cliente **no debe nada**: enviar correo de agradecimiento (no cobro).
- Si cliente tiene deuda: enviar plantilla de cobranza con tono segun antiguedad.
- No enviar duplicado en ventana corta (ej. 24h), salvo forzado.
- Soporte para pagos parciales y clientes que pagan tarde.

## Variables de plantilla sugeridas
- `{{cliente_nombre}}`
- `{{empresa}}`
- `{{monto_pendiente}}`
- `{{fecha_limite}}`
- `{{dias_atraso}}`
- `{{ultimo_pago_fecha}}`
- `{{moneda}}`
- `{{link_pago}}` (si aplica)
- `{{resumen_servicios}}`

## IA (detalle; ver Roadmap arriba)
- **Preferencia equipo:** Claude **Opus** vía **Anthropic API** (`ANTHROPIC_API_KEY`).
- Alternativa: `OPENAI_API_KEY` u otro proveedor (misma idea: solo Edge Function).
- Funciones: tono (amable, firme, recuperación), contexto CRM, opcional A/B.
- Reglas: nunca API key en frontend; logs para auditoría y control de costos.

## Envio de correo "como la empresa"
- Usar proveedor transaccional (Resend/SMTP/SendGrid) con dominio propio.
- Configurar SPF/DKIM/DMARC para entregabilidad.
- Remitente ejemplo: `cobranzas@tu-dominio.com`.

## Historial y trazabilidad
- Vista de historial:
  - fecha/hora envio
  - cliente/email
  - asunto
  - estado final
  - error (si hubo)
  - usuario que aprobo/rechazo
- Filtros por estado, fecha y cliente.

## Estados sugeridos del correo
- `draft`
- `pending_approval`
- `approved`
- `rejected`
- `sending`
- `sent`
- `failed`

## MVP recomendado
1. Seccion `Cobranza` visible en Credito.
2. Generar borradores con plantilla + variables.
3. Bandeja de revision con Aprobar/Rechazar.
4. Envio de aprobados.
5. Historial basico.

## Pendientes futuros
- **Redacción IA (Opus)** — ver sección **Roadmap** (API Anthropic + función + UI).
- Regla automatica por riesgo de cliente.
- Segmentacion por comportamiento de pago.
- Programacion de envios (fecha/hora).
- Follow-up automatico para no respondidos.


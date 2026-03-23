# Cobranza en Credito - Idea guardada

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

## IA (fase siguiente)
- Usar `OPENAI_API_KEY` (en backend/servidor) para:
  - Ajustar tono (amable, firme, recuperacion).
  - Personalizar mensaje con contexto CRM.
  - Generar versiones A/B.
- Importante:
  - Nunca exponer API key en frontend.
  - Log de prompts/respuestas para auditoria.

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
- Regla automatica por riesgo de cliente.
- Segmentacion por comportamiento de pago.
- Programacion de envios (fecha/hora).
- Follow-up automatico para no respondidos.


# Resumen del panel Holistic — qué es cada cosa y cómo funciona

## Lado gerente

### Dashboard
- **Qué es:** Pantalla principal con números globales y pendientes.
- **Para qué sirve:** Ver de un vistazo cuánto se ha gastado en ads, cuánto en fees, cuánto se ha cobrado y cuánto queda por cobrar (deuda neta, descontando garantías).
- **Qué se hace:** Se ven gráficos (gasto mensual, métodos de pago, cobrado vs gasto, deuda por cliente) y la tabla de **Pendientes de cobro** (los 10 más recientes). Desde ahí se puede ir a Reportes o abrir un gasto.

### Clientes
- **Qué es:** Listado de todos los clientes.
- **Para qué sirve:** Gestionar datos de cada cliente (nombre, Instagram, teléfonos, emails, negocio, notas).
- **Qué se hace:** Buscar, crear cliente (Nuevo), editar o eliminar. Al hacer clic en una fila se abre la ficha del cliente (gastos, cobros, garantías, manual).

### Gastos Ads
- **Qué es:** Tabla de todos los gastos mensuales en ads (inversión + fee por cliente y período).
- **Para qué sirve:** Registrar cuánto gastó cada cliente en ads cada mes, el % de fee y ver qué está pagado o pendiente.
- **Qué se hace:** Crear gasto (cliente, fecha de movimiento, período mes/año, monto, fee %, marcar **Prepago** si es recarga y se va a registrar cobro). Editar o eliminar. Ver código de gasto, garantía del cliente, estado (Pendiente/Parcial/Pagado), quién lo registró.

### Cobros
- **Qué es:** Registro de los pagos que los clientes han hecho.
- **Para qué sirve:** Llevar qué se ha cobrado, de qué gasto, fecha, hora, método y quién registró el cobro.
- **Qué se hace:** Solo se puede registrar cobro para gastos marcados como **Prepago**. Se elige el gasto (aparecen solo prepago pendientes), monto, fecha, hora, método de pago y notas. Cada cobro queda ligado a un **código de gasto**.

### Reportes
- **Qué es:** Relación de cuentas por período y por cliente.
- **Para qué sirve:** Ver totales de ads, fee, cobrado, garantías y pendiente neto por cliente y en total.
- **Qué se hace:** Filtrar por usuario (cliente) y por período (mes). Se ve la tabla desglosada y un resumen de composición (ADS vs FEE).

### Garantías
- **Qué es:** Respaldo (depósito, equipo, etc.) que el cliente deja mientras tiene deuda.
- **Para qué sirve:** Saber qué garantías hay, su valor y estado; el sistema descuenta las vigentes de la deuda (pendiente neto).
- **Qué se hace:** Crear garantía (cliente, tipo, valor, descripción, estado, **código de verificación**). Ver y eliminar. No se vinculan a un gasto concreto.

### Crédito
- **Qué es:** Sección informativa de crédito (contenido “próximamente”).

### Copia de seguridad
- **Qué es:** Enlace externo al dashboard de backup (exportación de la base a JSON).
- **Para qué sirve:** Consultar copia de los datos en otro servidor (acceso con clave).

---

## Lado cliente

### Mi cuenta
- **Qué es:** Ficha del propio cliente (sus datos y sus movimientos).
- **Para qué sirve:** Ver y editar su información y todo lo que le afecta (gastos, cobros, garantías, manual).
- **Qué se hace:** Ver datos personales y, en pestañas, sus gastos ads, cobros, garantías y movimientos manuales. No ve “Registrado por” ni puede registrar cobros.

### Dashboard
- **Qué es:** Sus números globales (sus gastos, fees, lo cobrado y su deuda neta).
- **Para qué sirve:** Ver su situación con la empresa (cuánto debe, cuánto está cubierto por garantías).
- **Qué se hace:** Ver gráficos y pendientes solo de su cuenta.

### Gastos Ads
- **Qué es:** Listado de sus gastos en ads (por fecha de movimiento y período).
- **Para qué sirve:** Ver qué gastos tiene, total, pagado y pendiente.
- **Qué se hace:** Solo consulta. No crea ni edita gastos. No ve columna “Registrado por” ni “Prepago”.

### Reportes
- **Qué es:** Sus números por período (sus ads, fee, cobrado, garantía, pendiente neto).
- **Para qué sirve:** Revisar su relación de cuentas en el tiempo.
- **Qué se hace:** Filtrar por período y ver solo sus totales.

### Garantías
- **Qué es:** Sus garantías (tipo, valor, estado, código de verificación).
- **Para qué sirve:** Ver qué respaldos tiene registrados y si están vigentes.
- **Qué se hace:** Solo consulta. No crea ni elimina garantías.

---

## Términos y relaciones

### Estados de un gasto (respecto al cobro)
- **Pendiente:** Aún no se ha cobrado nada de ese gasto.
- **Parcial:** Se ha cobrado algo pero menos del total (queda saldo).
- **Pagado:** Se ha cobrado todo el total de ese gasto.

*Se calcula con: Total (gasto + fee) y lo ya cobrado en cobros ligados a ese gasto.*

### Estados de una garantía
- **Vigente:** Está activa; su valor se descuenta de la deuda del cliente (reduce el “pendiente neto”).
- **Devuelta:** Se devolvió al cliente; ya no descuenta de la deuda.
- **Ejecutada:** Se usó para cobro (por impago o acuerdo); ya no está disponible.

### Prepago
- **Qué es:** Marca en un gasto que es “recarga/prepago”.
- **Para qué sirve:** Solo los gastos marcados como Prepago aparecen al **Registrar cobro**. Así se controla qué gastos pueden tener cobros asociados.

### Código de gasto
- **Qué es:** Identificador único de cada gasto (ej. G-ABC123).
- **Dónde se ve:** En Gastos Ads (columna Código) y en Cobros (columna “Cód. gasto”): cada cobro muestra a qué gasto (y por tanto a qué código) corresponde.

### Código de verificación (garantía)
- **Qué es:** Código o referencia que se guarda con la garantía (ej. número de operación o identificador).
- **Dónde se ve:** En el formulario de nueva garantía y en la tabla de Garantías (columna “Cód. verificación”).

### Cómo se relacionan las cosas
- **Cliente** → tiene muchos **Gastos Ads** (cada uno con fecha de movimiento, período, monto, fee, opción Prepago).
- **Cada Gasto** puede tener varios **Cobros** (pagos); el estado del gasto sale de si lo cobrado llega o no al total.
- **Cliente** → tiene **Garantías** (valor que se descuenta de su deuda si están Vigentes).
- **Deuda bruta** = suma de totales de gastos − suma de cobros.
- **Pendiente neto** = deuda bruta − valor de garantías vigentes (no negativo).
- **Reportes** usan gastos, cobros y garantías por cliente y período para mostrar totales y pendiente neto.

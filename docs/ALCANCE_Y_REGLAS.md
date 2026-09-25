# ALCANCE Y REGLAS DE NEGOCIO - CAJA CHICA MULTIUNIDAD
## CAJA PETROLERA DE SALUD (CPS)

El presente documento formaliza los requisitos, reglas de negocio y alcance del Sistema de Caja Chica Multiunidad desarrollado para la **Caja Petrolera de Salud**, tomando como base el **Reglamento Institucional versión 002/2013** y los acuerdos de diseño de la Fase 1.

---

### 1. CONTEXTO OPERATIVO Y ACTORES

1. **Operador Centralizado (Encargado de Caja Chica):**
   - El Encargado de cada unidad institucional realiza todas las operaciones dentro del sistema.
   - Cuenta con usuario institucional y asignación estricta a una o varias unidades autorizadas.
2. **Autorizadores y Solicitantes Externos:**
   - El solicitante del gasto y las autoridades institucionales autorizan y firman fuera del sistema (documentos físicos de respaldo).
   - No requieren cuentas de acceso ni contraseñas en el sistema; figuran como personas de referencia e identificación documental.
3. **Aislamiento Multiunidad:**
   - La aplicación opera como plataforma multiunidad compartida.
   - Cada encargado está restringido exclusivamente a las unidades asignadas. El backend valida la autorización en cada endpoint y nunca confía ciegamente en parámetros enviados por el navegador.

---

### 2. REGLAS NORMATIVAS CONFIRMADAS (REGLAMENTO 002/2013)

- **Límite Ordinario por Comprobante (10 %):**
  - Ningún comprobante individual puede superar el **10 % del fondo total autorizado** fijado en la resolución de apertura (no del saldo remanente circunstancial).
  - Cálculo exacto en base a aritmética decimal (`NUMERIC(14,2)` y `Decimal.js`).
- **Separación de Fondos y Presupuesto:**
  - El fondo de efectivo recibido y el presupuesto asignado por partidas son dimensiones separadas y complementarias.
  - Se debe verificar disponibilidad de efectivo y disponibilidad presupuestaria por partida para cualquier afectación.
- **Inmutabilidad y Entrada Única de Apertura:**
  - La confirmación de apertura se ejecuta bajo transacción atómica y control de concurrencia.
  - Genera una sola entrada de efectivo inicial.
  - No se permiten modificaciones directas a fondos confirmados mediante actualizaciones arbitrarias de saldo. Cualquier ajuste futuro requerirá operaciones específicas (ampliaciones, reposiciones o descargos).
- **Prohibición de Fraccionamiento:**
  - Queda prohibido fraccionar adquisiciones para eludir el límite del 10 % del fondo autorizado.
- **Prohibición de Fondos Particulares:**
  - No se permite cubrir erogaciones institucionales con dinero particular ni mezclar fondos personales con el fondo de caja chica.
- **Trazabilidad y Conservación Documental (10 Años):**
  - Los catálogos y asignaciones presupuestarias nunca se eliminan físicamente (soft-delete mediante estado inactivo).
  - Las modificaciones presupuestarias exigen justificación y registran automáticamente su historial (monto anterior, nuevo, motivo, actor, fecha/hora).
  - Registro de auditoría cronológico inmutable (excluyendo datos sensibles como contraseñas o tokens).

---

### 3. PENDIENTES DE CONFIRMACIÓN Y DEFINICIÓN NORMATIVA

1. **Cómputo del Plazo de Rendición (48 horas):**
   - El reglamento establece un plazo máximo de 48 horas para rendición del anticipo.
   - *Pendiente de confirmación con Auditoría Interna CPS:* Si el cómputo de 48 horas debe calcularse en días y horas hábiles administrativas o en plazo corrido calendario.
2. **Umbral de Reposición (70 %):**
   - El trámite de reposición de fondo se activa al alcanzar el 70 % de ejecución del fondo. La lógica de alerta y bloqueo de nuevas solicitudes cuando no se haya iniciado la reposición será implementada en la fase de gastos.
3. **Formatos Oficiales de Impresión Form. 5308 (Reemplazo Form. 005):**
   - Se proveerá en fases posteriores mediante Puppeteer en tamaño carta, con dos modalidades:
     - Formato digital completo (encabezados, grillas y datos).
     - Solo datos alineados para papel membretado/preimpreso institucional con calibración de márgenes.

---

### 4. DELIMITACIÓN DE ALCANCE: FASE 1 (IMPLEMENTADO)

#### LO QUE ESTÁ INCLUIDO Y VERIFICADO:
- Arquitectura monolito modular (backend NestJS + frontend Vite React + base de datos PostgreSQL con Prisma).
- Autenticación segura mediante cookies HttpOnly, prevención de ataques de fuerza bruta (Throttler y bloqueo temporal) y protección CSRF.
- Control de acceso por roles (`ADMINISTRADOR`, `ENCARGADO`) y guardián de aislamiento multiunidad (`UnitAccessGuard`).
- Catálogos funcionales:
  - Unidades institucionales con código único, nombre, dependencia y soft-delete.
  - Usuarios institucionales y asignación relacional a una o varias unidades.
  - Responsables de caja con CI, cargo, memorando de designación y vigencia.
  - Clasificador de partidas presupuestarias (códigos en formato texto).
  - Asignaciones presupuestarias por gestión y unidad, con trazabilidad obligatoria de motivo e historial de ajustes.
- Módulo de Apertura de Fondo:
  - Registro de borrador (monto autorizado, efectivo recibido, responsable, resolución y comprobante).
  - Transacción atómica de confirmación con entrada única de efectivo y protección de concurrencia.
  - Bloqueo de reconfirmaciones e inmutabilidad de importes confirmados.
- Panel de Inicio (Dashboard):
  - Visualización en tiempo real de datos reales de la unidad y gestión seleccionadas.
  - Fondo autorizado, efectivo disponible, límite del 10% y total presupuestado en partidas.
  - Alertas de estado y ausencia de datos simulados o inventados.

#### LO QUE NO CORRESPONDE A ESTA FASE (FUTURO):
- No se implementan solicitudes de compra ni formularios de anticipo 001/REP-MAT.
- No se implementa recepción de facturas, retenciones ni formulario 002.
- No se implementa devolución de sobrantes ni circuito de descargos.
- No se generan PDFs ni reportes Puppeteer.
- No se implementan arqueos de caja periódicos ni módulos de sanciones.

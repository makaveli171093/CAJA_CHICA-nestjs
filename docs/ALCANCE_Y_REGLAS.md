# ALCANCE Y REGLAS DE NEGOCIO - CAJA CHICA MULTIUNIDAD
## CAJA PETROLERA DE SALUD (CPS)

El presente documento formaliza los requisitos, reglas de negocio y alcance del Sistema de Caja Chica Multiunidad desarrollado para la **Caja Petrolera de Salud**, tomando como base el **Reglamento Institucional versión 002/2013** y los acuerdos de diseño de la Fase 1 con sus precisiones de alcance.

---

### 1. CONTEXTO OPERATIVO Y ACTORES

1. **Operador Centralizado (Encargado de Caja Chica):**
   - El Encargado de cada unidad institucional realiza todas las operaciones dentro del sistema.
   - Cuenta con usuario institucional y asignación estricta a una o varias unidades autorizadas.
2. **Autorizadores y Solicitantes Externos:**
   - El solicitante del gasto y las autoridades institucionales autorizan y firman fuera del sistema (documentos físicos de respaldo).
   - No requieren cuentas de acceso ni contraseñas en el sistema; figuran como personas de referencia e identificación documental.
3. **Aislamiento Multiunidad Estricto:**
   - La aplicación opera como plataforma multiunidad compartida.
   - Cada encargado está restringido exclusivamente a las unidades asignadas. El backend valida la autorización en cada endpoint, resolviendo los IDs de recursos a su unidad real en base de datos, y nunca confía ciegamente en parámetros enviados por el navegador.

---

### 2. REGLAS NORMATIVAS Y PRECISIONES DE ALCANCE (REGLAMENTO 002/2013)

- **Referencia Externa de REP-MAT:**
  - El formulario **REP-MAT** (Reposición de Materiales) **se genera y autoriza físicamente en otro sistema/circuito institucional externo**.
  - En este sistema únicamente se registra su **código y referencia documental de respaldo**, no se genera ni administra el flujo previo de REP-MAT.
- **Formulario 001 (Vale Provisional):**
  - El **Formulario 001** corresponde al **vale provisional de entrega de dinero** generado formalmente por esta aplicación al momento de confirmar el anticipo al solicitante.
- **Sin Módulo de Retenciones:**
  - Se precisa y ratifica que **no se ha solicitado un módulo de retenciones impositivas**. Los descargos se registrarán con el valor de la factura o documento de descargo directo.
- **Modelo de Rendición Form. 5308 (Reemplazo del Form. 005):**
  - La rendición de cuentas utilizará exclusivamente el **Form. 5308**, el cual contará en fases posteriores con dos modalidades de salida:
    a) **Impresión completa:** incluye encabezados, líneas, tablas y datos para hoja blanca.
    b) **Solo datos:** calibración de coordenadas para impresión sobre papel membretado o preimpreso institucional.
- **Cómputo del Plazo de Rendición de 48 Horas:**
  - **Continúa pendiente de definición y confirmación formal con Auditoría Interna / Dirección Administrativa Financiera de la CPS:** si el plazo máximo de 48 horas para rendir el anticipo se computará en **días y horas hábiles administrativas** o en **días corridos calendario**.
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
- **Prohibición de Fraccionamiento y Fondos Particulares:**
  - Queda prohibido fraccionar adquisiciones para eludir el límite del 10 % del fondo autorizado.
  - No se permite cubrir erogaciones institucionales con dinero particular ni mezclar fondos personales con el fondo de caja chica.
- **Trazabilidad y Conservación Documental (10 Años):**
  - Los catálogos y asignaciones presupuestarias nunca se eliminan físicamente (soft-delete mediante estado inactivo).
  - Las modificaciones presupuestarias exigen justificación y registran automáticamente su historial (monto anterior, nuevo, motivo, actor, fecha/hora).
  - Registro de auditoría cronológico inmutable (excluyendo datos sensibles como contraseñas o tokens).
- **Habilitación Manual de Partidas por Unidad o Centro:**
  - El catálogo de partidas presupuestarias es institucional y general. Cada centro que administra su propia caja chica se representa mediante la entidad `Unidad`.
  - Las partidas **no están habilitadas por defecto** para ninguna unidad institucional.
  - **Solo el Administrador** puede habilitar o inhabilitar qué partidas están autorizadas para cada unidad.
  - **Relación Unidad-Partida:** Gestionada mediante `unidad_partidas`, con clave única por par `(unidadId, partidaId)` y estado activo/inactivo.
  - **Separación de Habilitación y Presupuesto por Gestión:** La habilitación es institucional e intemporal; la asignación de fondos (`PresupuestoPartida`) es específica por gestión fiscal y exige como requisito indispensable que la partida esté previamente habilitada.
  - **Validación en Backend y Frontend:** Se rechazan intentos de asignar presupuestos sobre partidas no habilitadas, incluso si se envía su identificador directamente a la API (`400 Bad Request`).
  - **Restricción para Encargados:** Los encargados solo pueden consultar y seleccionar las partidas habilitadas de sus unidades autorizadas.
  - **Conservación Histórica:** La desactivación de una partida habilitada conserva íntegros los presupuestos, movimientos e históricos registrados anteriormente.
  - **Regularización Explícita de Presupuestos Previos:** Si existen presupuestos previos no habilitados, se presentan como pendientes para su habilitación explícita por el Administrador, sin realizar modificaciones ni habilitaciones silenciosas automáticas.
  - **Registro en Auditoría:** Cada cambio de estado de habilitación se registra en la bitácora de auditoría institucional.

---

### 3. DELIMITACIÓN DE ALCANCE: FASE 1 (IMPLEMENTADO)

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
- No se implementan solicitudes de compra ni vales provisionales Formulario 001.
- No se implementa recepción de facturas ni formulario 002.
- No se implementa devolución de sobrantes ni circuito de descargos.
- No se generan PDFs ni reportes Puppeteer.
- No se implementan arqueos de caja periódicos ni módulos de sanciones.

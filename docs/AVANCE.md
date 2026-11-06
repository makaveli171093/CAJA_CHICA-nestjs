# REPORTE DE AVANCE - FASE 1
## SISTEMA INSTITUCIONAL DE CAJA CHICA MULTIUNIDAD — CAJA PETROLERA DE SALUD (CPS)

**Directorio de Trabajo:** `G:\DESARROLLO CPS\CAJA_CHICA-nestjs`  
**Base de Datos Operativa:** `caja_chica_cps` (PostgreSQL 18 en `localhost:5432`)  
**Base de Datos de Pruebas:** `caja_chica_cps_test` (Aislada e independiente)  
**Fecha de Actualización:** 26 de septiembre de 2026  

---

### 1. ESTADO DE IMPLEMENTACIÓN Y VERIFICACIÓN

#### A. IMPLEMENTADO
- **Monolito Modular Completo:**
  - `backend/`: NestJS 10.4.x, TypeScript, adaptador Express, Prisma ORM 5.22.x, Swagger/OpenAPI, Throttler rate limiting, ValidationPipe estricto.
  - `frontend/`: React 18, Vite 8.x, TypeScript, Mantine UI 7, paleta institucional CPS `#007B6D`, tipografía Inter.
  - `docs/`: [`ALCANCE_Y_REGLAS.md`](./ALCANCE_Y_REGLAS.md) con reglas normativas institucionales.
- **Seguridad y Control de Sesión:**
  - Contraseñas con hash seguro `bcrypt` (10 salt rounds).
  - Emisión de cookies `HttpOnly` (`caja_session`) con `SameSite=Lax` y validación de cabecera `X-Requested-With` para mitigación CSRF.
  - **Cero almacenamiento en `localStorage` o `sessionStorage`** de credenciales ni tokens.
  - Generación automática de `JWT_SECRET` criptográfico aleatorio en `backend/.env` (archivo excluido formalmente en `.gitignore`).
  - Bloqueo temporal automático de cuentas tras 5 intentos fallidos consecutivos de login.
  - Guardián `UnitAccessGuard` mejorado con resolución en base de datos de `:id` de recursos directos (`unidades`, `responsables`, `presupuestos`, `apertura`).
- **Corrección de Creación de Administrador Inicial (`backend/src/scripts/create-admin.ts`):**
  - Resuelto fallo por desajuste de argumentos en la biblioteca `prompts`.
  - Flujo interactivo seguro de captura y confirmación de contraseña enmascarada sin recorte ni alteración de caracteres.
  - Comparación explícita tras capturar ambas respuestas y repetición en bucle ante discrepancias sin pérdida de datos.
- **Registro Unificado de Encargado y Responsable de Caja Chica:**
  - Identidad personal única por funcionario (`nombres`, `apellidos`, `carnetIdentidad`, `cargo`, `email`) vinculada a su cuenta de acceso institucional (`userId` en `responsables`).
  - Designaciones formales individualizadas por cada unidad asignada (`documentoDesignacion`, `fechaDesignacion`), soportando múltiples unidades por encargado sin duplicidad de perfiles.
  - Sincronización transaccional atómica (`$transaction`): cuenta de usuario, perfil personal, permisos operativos (`usuario_unidades`) y designaciones (`responsables`).
  - Conservación estricta de historial: la reasignación de unidades o desactivación de un encargado preserva sus designaciones previas y referencias a aperturas y movimientos pasados (desactivación lógica `activo = false`).
  - Formulario unificado integral en `/usuarios` para crear y editar, permitiendo completar perfiles de usuarios preexistentes.
  - Pantalla de consulta `/responsables` sincronizada con enlace al flujo unificado.
- **Configuración Unificada de Partidas y Presupuestos por Unidad:**
  - Componente modal reutilizable `PartidasPresupuestosModal` en `frontend/src/components/Presupuestos/`.
  - Acción *"Partidas y presupuestos"* en la tabla de Unidades Institucionales y acceso directo desde Presupuesto por Partida.
  - Habilitación de partidas del catálogo y asignación o ajuste presupuestario por gestión fiscal en una sola transacción atómica (`$transaction`), con registro de historial y auditoría.
  - Diferenciación visual clara entre "Sin presupuesto asignado" (`null`) y monto `0.00`.
  - Actualización reactiva del contexto `AuthContext` con `reloadUnits(preferUnitId)` al registrar unidades nuevas, seleccionándolas automáticamente sin requerir cerrar sesión.
  - Eliminación de redirecciones forzadas e indiscriminadas hacia `/unidades`: selectores de unidad interactivos directamente en *Apertura de Caja* y *Presupuesto por Partida*.
- **Reglas de Partidas Deshabilitadas y Preservación Histórica:**
  - Deshabilitación reactiva del campo de monto en frontend mientras la partida no esté habilitada para esa unidad.
  - Descarte automático de cambios pendientes si el usuario desmarca la habilitación antes de guardar, excluyéndolos del total en edición.
  - Validación del estado final en backend (`UnitsService.savePartidasPresupuestos`, `PresupuestosService.create`, `PresupuestosService.update`), rechazando con `BadRequestException (400)` cualquier nueva asignación o modificación de monto sobre partidas que queden o estén deshabilitadas.
  - Preservación histórica: deshabilitar una partida con presupuesto existente no borra ni pone en cero su registro en `PresupuestoPartida`, su ejecución ni su `PresupuestoHistorial`.
  - Totales diferenciados y transparentes: cómputo y exposición separada de `totalPresupuestoHabilitado` (activo) y `totalPresupuestoDeshabilitado` (histórico conservado) en backend y frontend.
- **Restricciones de Interfaz y Backend para Rol ENCARGADO:**
  - Ocultación en barra de navegación de *"Responsables de Caja"* y *"Unidades Institucionales"* (`adminOnly: true`).
  - Protección de rutas contra acceso directo por URL mediante `<AdminRoute>`.
  - Módulo de *Presupuesto por Partida* en modo de solo consulta para encargados (ocultación de botones de asignación rápida, ajuste y modal de configuración; conservación de acceso a historial).
  - Eliminación de botones y enlaces hacia pantallas administrativas en alertas, orientando a solicitar la configuración al Administrador.
  - Permisos estrictos en backend: `ResponsablesController` y `ResponsablesService` protegidos con `@Roles(RolUsuario.ADMINISTRADOR)`. Rechazo con 403 Forbidden a mutaciones no autorizadas.

---

#### B. VERIFICADO CON BASE DE DATOS REAL (PostgreSQL 18)
- **Migraciones Incrementales Aplicadas Exitosamente:**
  - `0_init`: Estructura inicial del sistema.
  - `1_unidad_partidas`: Tabla `unidad_partidas`, índice único y claves foráneas en cascada.
  - `2_usuario_responsable_unificado`: Columnas de identidad en `usuarios` y clave foránea `userId` en `responsables`.
  - Aplicadas en la base operativa `caja_chica_cps` y en la base de pruebas `caja_chica_cps_test` mediante `prisma migrate deploy`, sin resets ni pérdida de datos.
- **Pruebas de Integración con PostgreSQL (`backend/src/test/postgres-integration.spec.ts`):**
  - Ejecutadas en la base de pruebas `caja_chica_cps_test`.
  - **Aislamiento Multiunidad:** Encargado asignado a Unidad A no puede consultar ni operar sobre recursos de Unidad B (403 Forbidden).
  - **Aislamiento de Partidas Habilitadas:** Partida no habilitada no puede recibir presupuesto (400 Bad Request) ni es visible para encargados de otras unidades.
  - **Rechazo de DTO inválidos:** Class-validator rechaza importes con más de 2 decimales, montos negativos, textos no numéricos y fechas mal formadas.
  - **Concurrencia Real de Confirmación:** Confirmación concurrente con entrada única de efectivo y 409 ConflictException para la paralela.
  - **Rollback y Atomicidad Transaccional:** Ante fallo forzado, reversión total sin movimientos huérfanos.
  - **Precisión Decimal y Tipos SQL:** Comprobación de que `NUMERIC(14,2)` conserva montos exactos y el 10 % del fondo no pierde precisión.
  - **Independencia Presupuestaria Multiunidad:** Misma partida admite montos distintos por unidad y gestión sin movimientos de efectivo.
  - **Registro Unificado de Encargado y Responsable:** Creación atómica de usuario con designación por unidad, completado sin duplicidad y conservación histórica.
  - **Configuración Integral de Partidas y Presupuestos (Prueba 9):** Habilitación y asignación desde unidades, aislamiento estricto de gestiones (2025 vs 2026), 0 movimientos de efectivo y conservación histórica tras deshabilitar.
  - **Reglas de Partidas Deshabilitadas y Restricciones ENCARGADO vs ADMINISTRADOR (Prueba 10):** Rechazo de asignación/modificación en partida deshabilitada (400 Bad Request), guardado conjunto habilitar + asignar permitido, consulta permitida para encargado en unidades propias y rechazo 403 Forbidden ante cualquier mutación o acceso a unidades ajenas.
  - **Total de pruebas Jest automatizadas:** **29 pruebas pasadas, 6 suites completadas, 0 fallos**.
- **Compilaciones de Producción:**
  - Backend: `npm run build` (`nest build`) ejecutado con 0 errores.
  - Frontend: `npm run build` (`tsc -b && vite build`) ejecutado con 0 errores.

---

#### C. ESTADO DE VERIFICACIÓN EN NAVEGADOR Y REVISIÓN VISUAL
- **Servicios Activos:**
  - Servidor Backend NestJS: Operativo en `http://localhost:3000/api` (Swagger en `/api/docs`).
  - Servidor Frontend Vite: Operativo en `http://localhost:5173`.
- **Distinción entre Pruebas Automatizadas y Revisión Visual:**
  - **Pruebas automatizadas (unitarias y de integración con PostgreSQL real):** 100% ejecutadas y aprobadas (29 pruebas en 6 suites).
  - **Revisión visual de interfaz:** Pendiente de revisión personal por parte del usuario directamente en su navegador local (`http://localhost:5173`) para validar ergonomía y flujos visuales.

---

#### D. IMPLEMENTADO Y COMPROBADO EN FASE 2A: PEDIDOS, ANTICIPOS Y FORMULARIO 001
- **Modelos y Persistencia en Base de Datos:**
  - Enums `EstadoPedido` (`BORRADOR`, `ENTREGADO`, `CANCELADO`), `EstadoAnticipo` (`PENDIENTE`, `RENDIDO`) y adición de `ENTREGA_ANTICIPO` a `TipoMovimientoEfectivo`.
  - Entidad `Pedido`: solicitante (nombres, apellidos, carnet, área), receptor del anticipo (nombres, apellidos, carnet), partida, monto, justificación/destino, descripción, referencia del pedido autorizado físico, referencia REP-MAT opcional, estado y auditoría.
  - Entidad `Anticipo`: vinculación estricta con apertura de caja, custodio que entrega, número de vale de control, correlativo secuencial, instantánea inmutable en JSON (`datosValeJson`) para garantizar reimpresiones fieles en el tiempo sin depender de mutaciones en catálogos o personas.
  - Migración incremental aplicada: `20260928120000_3_pedidos_anticipos_vale001` desplegada sin reinicio de base de datos en `caja_chica_cps` y `caja_chica_cps_test`.
- **Regla Centralizada de Disponibilidad Presupuestaria:**
  - Función centralizada [`calcularDisponibilidadPresupuesto`](file:///D:/DESARROLLO/PRODUCCION%20JARED/CAJA%20CHICA/backend/src/common/utils/presupuesto-calculo.ts):
    $$\text{Disponible} = \text{Asignado} - \text{Comprometido Pendiente} - \text{Ejecutado}$$
  - Reutilizada de forma homogénea en entrega de fondos (`PedidosService.entregar`), consultas (`PresupuestosService.findByUnidadGestion`), panel institucional (`DashboardService.getDashboardData`) y ajustes presupuestarios (`PresupuestosService.update`, `UnitsService.savePartidasPresupuestos`).
  - **Límite de Reducción Administrativa:** Los ajustes de presupuesto respetan rigurosamente $\text{Comprometido Pendiente} + \text{Ejecutado}$. Si una reducción pretende fijar un monto inferior, es rechazada de inmediato.
- **Validaciones Rigurosas de Fechas y Concurrencia:**
  - **Coherencia Temporal:** Validación de que la fecha de solicitud del pedido pertenezca a la gestión fiscal activa y no sea anterior a la fecha formal de apertura de la caja chica (tanto al crear como al editar borradores). En la entrega, se valida que la fecha real no sea anterior a la apertura ni a la solicitud del pedido.
  - **Concurrencia entre Dos Pedidos Diferentes:** Demostrado con pruebas automatizadas que dos pedidos distintos compitiendo por un saldo residual no pueden sobregirar efectivo ni presupuesto; se procesa exactamente el primero y el segundo es rechazado sin dejar saldos negativos.
  - **Entrega Concurrente con Reducción de Presupuesto:** Transacciones serializadas con bloqueo `FOR UPDATE` que garantizan que el presupuesto nunca quede por debajo de los compromisos adquiridos.
  - **Recuperación ante Reintentos (409 Conflict):** La interfaz de usuario detecta respuestas 409 y consulta automáticamente el estado del pedido; si la entrega ya fue registrada, recupera el vale emitido y abre la ventana de impresión/descarga sin presentar la operación como fallida.
  - **Rollback Atómico:** Ante cualquier fallo en validaciones o ejecución transaccional, la operación se revierte en su totalidad sin egresos de efectivo, compromisos ni anticipos huérfanos.
- **Formulario 001 — Emisión Provisional:**
  - Implementación con Puppeteer en hoja tamaño carta estándar (215.9 × 279.4 mm).
  - Encabezados institucionales CPS, número correlativo de control (`VALE-001-{CODIGO}-{GESTION}-{CORRELATIVO:04d}`), lugar y fecha.
  - Monto en cifras y conversión rigurosa a texto literal en bolivianos (`numero-a-letras.ts`).
  - Datos del solicitante, receptor del anticipo y custodio de caja chica conservados en la sección de identificación del vale.
  - **Cuatro recuadros de firmas con sus rótulos institucionales exactos:**
    1. *Solicitante (Firma y sello)*
    2. *VoBo Jefe Inmediato Superior (Firma y sello)*
    3. *Vo Bo: Jefe Depto. Nacional Administrativo Financiero DNAF (Firma y sello)*
    4. *Vo Bo: Director Nal. Administrativo Financiero DAF (Firma y sello)*
  - Espacios limpios para firmas y sellos manuales (sin firmas digitales ficticias).
  - Muestra generada en `docs/muestras/formulario-001-muestra.pdf`.
- **Pruebas Automatizadas en Base de Pruebas Aislada:**
  - Suite de integración [`fase2a-pedidos-anticipos.spec.ts`](file:///D:/DESARROLLO/PRODUCCION%20JARED/CAJA%20CHICA/backend/src/test/fase2a-pedidos-anticipos.spec.ts) con 12 escenarios rigurosos evaluados en `caja_chica_cps_test`.
  - **Total de pruebas en Jest:** **42 pruebas superadas con éxito en 8 suites (0 fallos).**
  - **Compilaciones de producción:** Backend (`npm run build`) y Frontend (`npm run build`) en 0 errores.

---

#### E. IMPLEMENTADO Y COMPROBADO EN FASE 2B: RENDICIONES, NUEVOS ROLES, 48H HÁBILES Y TAILWIND V4
- **Arquitectura Frontend con Tailwind CSS v4:**
  - Migración exitosa al motor oficial `@tailwindcss/vite` y `tailwindcss` v4 sin necesidad de archivos legacy de configuración.
  - Paleta institucional CPS integrada (`--color-cps-teal: #007B6D`, `--color-cps-teal-dark: #005d52`, etc.) y tipografía Inter.
  - Compilación de producción en 2.6 segundos con 0 errores.
- **Nuevos Roles Institucionales (RBAC):**
  - `FINANCIERO`: Facultad exclusiva para la aprobación de presupuestos por partida y aprobación/rechazo de rendiciones de cuentas con facturas.
  - `GERENCIA`: Acceso institucional global en estricto modo de **solo lectura** para paneles, reportes y métricas consolidadas (bloqueo automático de mutaciones en `UnitAccessGuard`).
  - `ADMINISTRADOR`: Control total operativo y de configuración.
  - `ENCARGADO`: Operador asignado a sus unidades institucionales autorizadas.
- **Regla Normativa de 48 Horas Hábiles Administrativas:**
  - Cómputo matemático formal de 48 horas en días hábiles (lunes a viernes), excluyendo íntegramente fines de semana (sábados y domingos).
  - Indicador visual tipo semáforo en frontend con horas hábiles restantes y estado de vencimiento.
- **Módulo Completo de Rendiciones de Cuentas (Fase 2B):**
  - Entidad `Rendicion` y `DocumentoDescargo` con migración incremental versionada desplegada en PostgreSQL 18.
  - Flujo de estados: `BORRADOR` &rarr; `ENVIADA` &rarr; `APROBADA` / `RECHAZADA`.
  - Aprobación transaccional por el rol `FINANCIERO`:
    - Transición del `Anticipo` a `RENDIDO`.
    - Ingreso automático de efectivo por sobrante devuelto a caja chica (`DEVOLUCION_SOBRANTE`).
    - Consolidación del gasto ejecutado real y captura de snapshot JSON inmutable.
  - Rechazo fundado con registro obligatorio de motivo para subsanación del encargado.
- **Motor de Impresión Dual (Formulario 002 / Form. 5308):**
  - **Modo 1: Sobre Papel Preimpreso (Solo Datos):** Proyección milimétrica en coordenadas absolutas (mm) sin líneas ni encabezados, con controles interactivos de calibración de arrastre de impresora ($X$ e $Y$) persistentes en `localStorage`.
  - **Modo 2: Hoja en Blanco Completa:** Formulario íntegro con encabezados oficiales CPS, tabla de facturas, liquidación de anticipo y 3 casillas de firmas reglamentarias (*Solicitante*, *Custodio*, *VoBo DAF*).
- **Pruebas Automatizadas y Calidad:**
  - **58 pruebas automatizadas superadas con éxito en 10 suites (0 fallos).**
  - Compilación de Backend (`nest build`): 0 errores.
  - Compilación de Frontend (`tsc -b && vite build`): 0 errores.


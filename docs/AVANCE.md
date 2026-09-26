# REPORTE DE AVANCE - FASE 1
## SISTEMA INSTITUCIONAL DE CAJA CHICA MULTIUNIDAD — CAJA PETROLERA DE SALUD (CPS)

**Directorio de Trabajo:** `D:\DESARROLLO\PRODUCCION JARED\CAJA CHICA`  
**Base de Datos Operativa:** `caja_chica_cps` (PostgreSQL 18 en `localhost:5432`)  
**Base de Datos de Pruebas:** `caja_chica_cps_test` (Aislada e independiente)  
**Fecha de Actualización:** 25 de septiembre de 2026  

---

### 1. ESTADO DE IMPLEMENTACIÓN Y VERIFICACIÓN

#### A. IMPLEMENTADO
- **Monolito Modular Completo:**
  - `backend/`: NestJS 10.4.x, TypeScript, adaptador Express, Prisma ORM 5.22.x, Swagger/OpenAPI, Throttler rate limiting, ValidationPipe estricto.
  - `frontend/`: React 18, Vite 8.x, TypeScript, Mantine UI 7, paleta institucional CPS `#007B6D`, tipografía Inter.
  - `docs/`: [`ALCANCE_Y_REGLAS.md`](./ALCANCE_Y_REGLAS.md) con correcciones normativas formales (REP-MAT externo, Formulario 001 como vale provisional, sin retenciones, rendición Form. 5308 y cómputo de 48 horas pendiente).
- **Seguridad y Control de Sesión:**
  - Contraseñas con hash seguro `bcrypt` (10 salt rounds).
  - Emisión de cookies `HttpOnly` (`caja_session`) con `SameSite=Lax` y validación de cabecera `X-Requested-With` para mitigación CSRF.
  - **Cero almacenamiento en `localStorage` o `sessionStorage`** de credenciales ni tokens.
  - Generación automática de `JWT_SECRET` criptográfico aleatorio en `backend/.env` (archivo excluido formalmente en `.gitignore`).
  - Bloqueo temporal automático de cuentas tras 5 intentos fallidos consecutivos de login.
  - Guardián `UnitAccessGuard` mejorado con resolución en base de datos de `:id` de recursos directos (`unidades`, `responsables`, `presupuestos`, `apertura`).
- **Catálogos y Apertura:**
  - Unidades con código único y desactivación lógica (*soft-delete*).
  - **Registro Unificado de Encargado y Responsable de Caja Chica:**
    - Identidad personal única por funcionario (`nombres`, `apellidos`, `carnetIdentidad`, `cargo`, `email`) vinculada a su cuenta de acceso institucional (`userId` en `responsables`).
    - Designaciones formales individualizadas por cada unidad asignada (`documentoDesignacion`, `fechaDesignacion`), soportando múltiples unidades por encargado sin duplicidad de perfiles.
    - Sincronización transaccional atómica (`$transaction`): cuenta de usuario, perfil personal, permisos operativos (`usuario_unidades`) y designaciones (`responsables`).
    - Conservación estricta de historial: la reasignación de unidades o desactivación de un encargado preserva sus designaciones previas y referencias a aperturas y movimientos pasados (desactivación lógica `activo = false`).
    - Formulario unificado integral en `/usuarios` para crear y editar, permitiendo completar perfiles de usuarios preexistentes (caso `alinares`).
    - Pantalla de consulta `/responsables` sincronizada con enlace al flujo unificado.
  - Clasificador de partidas presupuestarias con código como texto (`String`, ej. `"31110"`).
  - **Habilitación de Partidas por Unidad (`unidad_partidas`):**
    - Relación `UnidadPartida` con unicidad del par `(unidadId, partidaId)` y estado `activo`.
    - No habilitación por defecto: cada centro o unidad institucional cuenta exclusivamente con las partidas autorizadas por el Administrador.
    - Exclusividad de gestión para rol `ADMINISTRADOR`, con trazabilidad en bitácora de auditoría.
    - Separación estricta entre habilitación institucional y asignación presupuestaria por gestión fiscal.
    - Restricción para encargados: consulta y selección limitadas a las partidas habilitadas de sus unidades autorizadas.
    - Interfaz en administración de Unidades: modal "Partidas Habilitadas" con switches de activación y detección de presupuestos previos pendientes de regularización.
  - Presupuestos por partida con historial obligatorio de motivo (`presupuestos_historial`) y validación previa de habilitación.
  - Apertura con confirmación atómica en `$transaction`, control de concurrencia y generación de **una sola entrada de efectivo**.

---

#### B. VERIFICADO CON BASE DE DATOS REAL (PostgreSQL 18)
- **Migraciones Incrementales Aplicadas Exitosamente:**
  - `0_init`: Estructura inicial del sistema.
  - `1_unidad_partidas`: Tabla `unidad_partidas`, índice único y claves foráneas en cascada.
  - `2_usuario_responsable_unificado`: Columnas `nombres`, `apellidos`, `carnetIdentidad`, `cargo` en `usuarios`, y columna `userId` con clave foránea `ON DELETE SET NULL` en `responsables`.
  - Todas las migraciones aplicadas en la base operativa `caja_chica_cps` y en la base de pruebas `caja_chica_cps_test` mediante `prisma migrate deploy`, sin resets ni pérdida de historial.
- **Pruebas de Integración con PostgreSQL (`backend/src/test/postgres-integration.spec.ts`):**
  - Ejecutadas en la base de pruebas `caja_chica_cps_test`.
  - **Aislamiento Multiunidad:** Encargado asignado a Unidad A no puede consultar ni operar sobre recursos de Unidad B (resolución real por ID rechazada con 403 Forbidden).
  - **Aislamiento y Restricción de Partidas Habilitadas:**
    - Verificación con dos unidades (Unidad A y Unidad B) y una partida habilitada únicamente en A.
    - Intento de asignar presupuesto a la partida en Unidad B (incluso enviando su ID directamente a la API): **Rechazado con 400 Bad Request**.
    - Base de datos comprobada: 0 registros de presupuesto creados en Unidad B.
    - Asignación de presupuesto en Unidad A: **Completada exitosamente (201 Created)**.
    - Desactivación de habilitación en Unidad A: **Presupuesto e historial conservados íntegramente**.
    - Consulta de encargado de Unidad B: **Partida no habilitada excluida de los resultados**.
    - Intento de encargado de B de consultar partidas de Unidad A: **Rechazado con 403 Forbidden**.
  - **Rechazo de DTO inválidos:** Class-validator rechaza importes con más de 2 decimales, montos negativos, textos no numéricos y fechas mal formadas.
  - **Concurrencia Real de Confirmación:** Ejecución simultánea de dos confirmaciones paralelas con `Promise.allSettled` sobre PostgreSQL: exactamente **una confirmación tuvo éxito**, la concurrente fue **rechazada con 409 ConflictException**, y se verificó en base de datos la existencia de **exactamente un movimiento de efectivo** y estado final `ABIERTA`.
  - **Rollback y Atomicidad Transaccional:** Ante un error forzado a mitad de transacción, PostgreSQL revierte todo cambio: el estado permanece en `BORRADOR` y la tabla `movimientos_efectivo` queda con 0 registros huérfanos.
  - **Precisión Decimal y Tipos SQL:** Comprobación de que `NUMERIC(14,2)` conserva montos exactos y que el 10 % del fondo autorizado no pierde precisión de coma flotante.
  - **Independencia Presupuestaria Multiunidad:** Verificación de que una misma partida admite montos presupuestarios distintos en dos unidades distintas para la misma gestión (`unidadId + partidaId + gestion`), que modificar el monto en una unidad no altera la otra, y que la asignación presupuestaria no genera movimientos de efectivo de caja.
  - **Registro Unificado de Encargado y Responsable:** Creación atómica de usuario con designación por unidad, completado de usuario existente sin duplicidad, protección de acceso a unidades no asignadas, visibilidad en apertura de caja chica, reversión total ante error y conservación histórica de designaciones previas.
  - Total de pruebas Jest automatizadas: **27 pruebas pasadas, 6 suites completadas, 0 fallos**.

- **Cuentas de Verificación en Base Operativa (`caja_chica_cps`):**
  - Durante las verificaciones iniciales de acceso y ciclo de sesión, se crearon en la base operativa dos cuentas: `admin_verif` (ADMINISTRADOR) y `test_desactivado` (ENCARGADO).
  - **Estado actual comprobado:** Ambas cuentas han sido **desactivadas** (`activo: false`), conservando íntegros sus registros de auditoría y fechas. Ninguna cuenta de prueba permanece activa en la base operativa.
- **Flujo de Acceso HTTP E2E y Corrección de Selección de Unidad:**
  - Login exitoso devolviendo cookie `HttpOnly` y `SameSite=Lax`.
  - Carga institucional para rol `ADMINISTRADOR`: entrega todas las unidades institucionales activas (rol global); para `ENCARGADO`: entrega sus unidades autorizadas activas.
  - Selector de unidad visible y reactivo en el header, con auto-selección si existe una sola unidad disponible y limpieza inmediata de estados anteriores al cambiar.
  - Persistencia de sesión al recargar mediante rehidratación `/api/auth/me`.
  - Revocación inmediata en tiempo real de sesión para usuario desactivado (401 Unauthorized automático en el siguiente request con la misma sesión).
  - Cierre de sesión eliminando la cookie de sesión del navegador.
  - CORS configurado y verificado permitiendo `http://localhost:5173` con credenciales.
  - Frontend compilado limpiamente con `tsc -b && vite build` (0 errores).

---

#### C. ESTADO DE VERIFICACIÓN EN NAVEGADOR Y REVISIÓN VISUAL
- **Verificación de Protocolo HTTP / Servicios Activos:**
  - Servidor Backend NestJS: Operativo y respondiendo HTTP 200 en `http://localhost:3000/api` (puerto 3000).
  - Documentación Swagger OpenAPI: Operativa y respondiendo HTTP 200 en `http://localhost:3000/api/docs`.
  - Servidor Frontend Vite: Operativo y respondiendo HTTP 200 en `http://localhost:5173` (puerto 5173).
- **Distinción entre Pruebas HTTP y Revisión Visual:**
  - **Pruebas HTTP automatizadas:** Completadas (comportamiento de API, cookies HttpOnly, CORS y cabeceras CSRF validados).
  - **Revisión visual de interfaz:** Pendiente de revisión personal por parte del usuario directamente en su navegador local (`http://localhost:5173`). No se utilizó emulación headless automatizada (Playwright descartado por limitación externa de descarga de binarios).

---

#### D. PENDIENTE (FASE 2)
- Formulario 001 (vale provisional de entrega de dinero) tras entrega física autorizada.
- Circuito de anticipos y registro de comprobantes con referencia al formulario REP-MAT externo.
- Registro de facturas y formulario de descargo 002 (sin módulo de retenciones, según precisión confirmada).
- Devolución de sobrantes y liquidación de anticipos.
- Definición de Auditoría Interna / DAF CPS sobre el cómputo de las 48 horas de plazo de rendición (días hábiles vs. calendario corrido).
- Generación de reportes PDF con Puppeteer y Formulario 5308 (modalidad completa y solo datos sobre papel preimpreso).

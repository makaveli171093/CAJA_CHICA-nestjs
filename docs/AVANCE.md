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

#### D. PENDIENTE (FASE 2)
- Módulo de **Pedidos de Caja Chica** (solicitudes de compra de bienes/servicios menores).
- Circuito de **Anticipos** y registro de comprobantes con referencia al formulario REP-MAT externo.
- **Formularios normativos:**
  - Formulario 001 (vale provisional de entrega de dinero).
  - Formulario 002 (rendición y descargo de gastos con comprobantes/facturas).
  - Formulario 5308 (rendición formal de cuentas institucionales DAF).
- Liquidación de anticipos y devolución física de sobrantes.
- Definición de Auditoría Interna / DAF CPS sobre el cómputo de las 48 horas de plazo de rendición (días hábiles vs. calendario corrido).

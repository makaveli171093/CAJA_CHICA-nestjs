# SISTEMA DE CAJA CHICA MULTIUNIDAD - CAJA PETROLERA DE SALUD
## FASE 1: ARQUITECTURA BASE, SEGURIDAD, CATÁLOGOS Y APERTURA

Aplicación web institucional desarrollada para la administración centralizada y multiunidad de fondos de Caja Chica de la **Caja Petrolera de Salud (CPS)**, conforme a los lineamientos del **Reglamento Institucional versión 002/2013**.

---

### ESTRUCTURA DEL PROYECTO

```text
CAJA CHICA/
├── backend/               # API REST con NestJS + Prisma ORM + PostgreSQL
│   ├── prisma/            # Esquema de base de datos y migraciones versionadas
│   ├── src/               # Módulos: auth, units, users, responsables, partidas, presupuestos, apertura, dashboard, audit
│   ├── test/              # Pruebas automatizadas Jest
│   └── package.json
├── frontend/              # Aplicación SPA con React + TypeScript + Vite + Mantine UI
│   ├── src/               # Componentes, layouts, páginas institucionales, contexto de autenticación
│   └── package.json
├── docs/                  # Documentación institucional y técnica
│   ├── ALCANCE_Y_REGLAS.md # Reglas de negocio confirmadas y asuntos pendientes
│   ├── AVANCE.md          # Reporte de avance y verificaciones de la Fase 1
│   └── TRABAJO_ENTRE_MAQUINAS.md # Guía para sincronizar y trabajar entre dos equipos
├── .gitignore             # Protección de credenciales, logs, builds y dependencias
├── .env.example           # Plantilla de variables de entorno general
└── README.md              # Guía de instalación, configuración y ejecución en Windows
```

> [!TIP]
> **¿Trabajando entre dos computadoras distintas?**
> Consulte la guía detallada paso a paso en [docs/TRABAJO_ENTRE_MAQUINAS.md](./docs/TRABAJO_ENTRE_MAQUINAS.md) para sincronización con Git, resolución de ramas y configuración sin pérdida de datos.


---

### REQUISITOS DEL SISTEMA

- **Sistema Operativo:** Windows 10 / 11 o Windows Server.
- **Node.js:** Versión 20.x o 24.x LTS (verificado sobre Node v24.19.0 y npm 11.17.0).
- **PostgreSQL:** Versión 15 a 18 (el servicio `postgresql-x64-18` está activo en el puerto 5432).

---

### GUÍA DE INSTALACIÓN Y ARRANQUE EN WINDOWS

#### 1. Configuración de Variables de Entorno del Backend

En la carpeta `backend`, copie el archivo de ejemplo para crear su archivo `.env` local:

```powershell
cd "d:\DESARROLLO\PRODUCCION JARED\CAJA CHICA\backend"
copy .env.example .env
```

Abra el archivo `backend/.env` y ajuste su contraseña local de PostgreSQL en la variable `DATABASE_URL`:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL="postgresql://postgres:SU_CONTRASENA_AQUI@localhost:5432/caja_chica_cps?schema=public"
JWT_SECRET="CAMBIAR_POR_CLAVE_CRIPTOGRAFICA_SEGURA_CPS_2026"
JWT_EXPIRES_IN="8h"
FRONTEND_URL="http://localhost:5173"
THROTTLE_TTL=60
THROTTLE_LIMIT=30
SWAGGER_ENABLED=true
TIMEZONE="America/La_Paz"
```

> **Nota de Seguridad:** La base de datos `caja_chica_cps` debe ser de uso exclusivo para este proyecto.

---

#### 2. Ejecutar las Migraciones de Base de Datos

Una vez configuradas las credenciales en `backend/.env`, aplique la migración versionada en PostgreSQL:

```powershell
cd "d:\DESARROLLO\PRODUCCION JARED\CAJA CHICA\backend"
npx prisma migrate dev --name init
```

*(Si la base de datos `caja_chica_cps` no existe aún, Prisma preguntará si desea crearla automáticamente; responda `y`).*

---

#### 3. Crear el Usuario Administrador Inicial

Por directiva de seguridad, no se crean administradores con contraseñas fijas o públicas en el código. Ejecute el comando interactivo para crear su cuenta de administrador:

```powershell
cd "d:\DESARROLLO\PRODUCCION JARED\CAJA CHICA\backend"
npm run admin:create
```

El script le solicitará de forma interactiva:
- Nombre de usuario (ej. `admin`)
- Nombre completo del funcionario
- Correo electrónico institucional
- Contraseña segura (oculta en consola)

---

#### 4. (Opcional) Cargar Datos Ficticios de Prueba

Para inicializar unidades, partidas y un responsable ficticio claramente identificado para demostración:

```powershell
cd "d:\DESARROLLO\PRODUCCION JARED\CAJA CHICA\backend"
npx ts-node -r tsconfig-paths/register src/scripts/seed-demo.ts
```

---

#### 5. Ejecutar Pruebas Automatizadas

Para validar las reglas de negocio, aislamiento multiunidad, cálculos decimales exactos y concurrencia:

```powershell
cd "d:\DESARROLLO\PRODUCCION JARED\CAJA CHICA\backend"
npm test
```

---

#### 6. Iniciar el Servidor Backend

En una ventana de PowerShell:

```powershell
cd "d:\DESARROLLO\PRODUCCION JARED\CAJA CHICA\backend"
npm run start:dev
```

- **API REST disponible en:** `http://localhost:3000/api`
- **Documentación Swagger OpenAPI:** `http://localhost:3000/api/docs`

---

#### 7. Iniciar la Interfaz Web (Frontend)

En otra ventana de PowerShell:

```powershell
cd "d:\DESARROLLO\PRODUCCION JARED\CAJA CHICA\frontend"
npm run dev
```

- **Aplicación Web accesible en:** `http://localhost:5173`

---

### CARACTERÍSTICAS PRINCIPALES DE LA FASE 1

1. **Aislamiento Multiunidad:** El personal encargado solo accede y opera en las unidades expresamente asignadas. Las consultas por ID directo son validadas en el backend contra los permisos del usuario autenticado.
2. **Cálculo Exacto Decimal:** Todos los importes monetarios y límites (10 % del fondo autorizado) se procesan con `NUMERIC(14,2)` y `Decimal.js`, evitando errores de coma flotante de JavaScript.
3. **Confirmación Inmutable de Apertura:** La confirmación de apertura se realiza en una transacción atómica con control de concurrencia que emite una sola entrada de efectivo y bloquea modificaciones directas al importe.
4. **Trazabilidad Presupuestaria:** Las modificaciones de presupuesto por partida exigen un motivo formal y se registran en una bitácora histórica.
5. **Auditoría Sanitizada:** Bitácora inmutable que almacena fecha, usuario, acción, entidad y cambios, protegiendo credenciales y tokens contra filtraciones.

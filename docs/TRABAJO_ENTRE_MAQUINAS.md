# GUÍA DE TRABAJO COLABORATIVO ENTRE DOS MÁQUINAS
## SISTEMA DE CAJA CHICA MULTIUNIDAD — CAJA PETROLERA DE SALUD (CPS)

Este documento describe el protocolo operativo estándar para clonar, configurar, sincronizar y trabajar en el proyecto entre dos computadoras distintas (ej. máquina de desarrollo y máquina de producción/oficina), manteniendo la integridad del código, el control de migraciones y la seguridad de los datos.

---

### 1. REGLA FUNDAMENTAL DE SINCRONIZACIÓN

> [!IMPORTANT]
> **Lo que Git sincroniza:**
> - Código fuente del backend y frontend.
> - Archivos de migración DDL versionados de Prisma (`backend/prisma/migrations/`).
> - Esquema de base de datos (`backend/prisma/schema.prisma`).
> - Archivos de bloqueo de dependencias (`package-lock.json`).
> - Documentación técnica y plantillas (`.env.example`).
>
> **Lo que Git NO sincroniza (responsabilidad de cada máquina):**
> - **Archivos `.env`:** Cada equipo debe tener su propio `backend/.env` con sus contraseñas locales y secretos. Nunca se suben a Git.
> - **Registros de PostgreSQL:** Las filas, datos de prueba, usuarios reales y movimientos de dinero residen en el servidor PostgreSQL local de cada máquina. Git sincroniza la estructura (migraciones), no los datos.

---

### 2. PRIMERA INSTALACIÓN EN LA SEGUNDA MÁQUINA

Realice estos pasos una sola vez al preparar el entorno en el nuevo equipo.

#### Paso 1: Clonar el repositorio
Abra PowerShell o su terminal preferida:

```powershell
git clone https://github.com/makaveli171093/CAJA_CHICA-nestjs.git "D:\DESARROLLO\PRODUCCION JARED\CAJA CHICA"
cd "D:\DESARROLLO\PRODUCCION JARED\CAJA CHICA"
```

#### Paso 2: Instalar dependencias exactas con `npm ci`
Ejecute `npm ci` (clean install) en ambas carpetas para garantizar versiones idénticas según los `package-lock.json`:

```powershell
# En backend
cd backend
npm ci

# En frontend
cd ..\frontend
npm ci
cd ..
```

#### Paso 3: Configurar variables de entorno locales en el Backend
Copie la plantilla de ejemplo y configure sus credenciales de base de datos:

```powershell
cd backend
copy .env.example .env
```

Abra `backend/.env` con un editor de texto y configure:
- `DATABASE_URL`: Ingrese el usuario y contraseña de su instancia PostgreSQL local, por ejemplo:
  `DATABASE_URL="postgresql://postgres:MI_PASSWORD_LOCAL@localhost:5432/caja_chica_cps?schema=public"`
- `JWT_SECRET`: Genere una cadena aleatoria criptográficamente segura para la firma de tokens en esa máquina.
- Guarde el archivo y compruebe que no esté rastreado por Git (`git status` debe mostrar el directorio limpio).

#### Paso 4: Inicializar base de datos y migraciones
Asegúrese de que el servicio PostgreSQL esté en ejecución en su máquina y aplique las migraciones estructuradas:

```powershell
# Generar el cliente de Prisma Client tipado
npx prisma generate

# Aplicar las migraciones existentes en PostgreSQL (crea caja_chica_cps si no existe)
npx prisma migrate deploy
```

> **Base de Datos de Pruebas:** Para ejecutar pruebas automatizadas (`npm test`), cree en PostgreSQL la base `caja_chica_cps_test` y aplique también las migraciones:
> ```powershell
> npx cross-env DATABASE_URL="postgresql://postgres:MI_PASSWORD_LOCAL@localhost:5432/caja_chica_cps_test?schema=public" npx prisma migrate deploy
> ```

#### Paso 5: Crear el usuario Administrador inicial
Genere su cuenta personal de administrador en su base de datos local:

```powershell
npm run admin:create
```
*(Introduzca de manera interactiva su nombre de usuario, nombre completo, correo institucional y contraseña oculta).*

#### Paso 6: Validar compilaciones y pruebas
Compruebe que el proyecto compila y pasa todas las pruebas en la nueva máquina:

```powershell
# En backend:
npm test
npm run build

# En frontend:
cd ..\frontend
npm run build
```

---

### 3. PROTOCOLO DIARIO: AL EMPEZAR A TRABAJAR

Antes de comenzar a escribir o modificar código en cualquiera de las dos máquinas:

1. **Verificar el estado del espacio de trabajo:**
   ```powershell
   git status
   ```
   Asegúrese de no tener cambios sin guardar o archivos modificados inadvertidamente.

2. **Descargar los últimos cambios remotos:**
   Use siempre `--ff-only` para asegurar que la rama local avance de forma limpia sin crear commits de fusión accidentales:
   ```powershell
   git pull --ff-only origin master
   ```

3. **Verificar si cambiaron dependencias o migraciones:**
   - Si en el `pull` se actualizaron archivos `package-lock.json`, ejecute:
     ```powershell
     # Si cambió backend/package-lock.json:
     cd backend && npm ci && cd ..

     # Si cambió frontend/package-lock.json:
     cd frontend && npm ci && cd ..
     ```
   - Si en el `pull` llegaron nuevas migraciones en `backend/prisma/migrations/`, aplíquelas de inmediato:
     ```powershell
     cd backend
     npx prisma generate
     npx prisma migrate deploy
     cd ..
     ```

---

### 4. PROTOCOLO DIARIO: AL TERMINAR DE TRABAJAR

Cuando haya finalizado una tarea, corrección o funcionalidad:

1. **Ejecutar pruebas y compilaciones locales:**
   Verifique que nada se haya roto antes de publicar:
   ```powershell
   cd backend
   npm test
   npm run build
   cd ..\frontend
   npm run build
   cd ..
   ```

2. **Revisar los cambios realizados:**
   ```powershell
   git status
   git diff
   ```
   Confirme que únicamente se modificaron los archivos previstos y que ningún archivo `.env`, log o archivo temporal esté presente.

3. **Preparar y confirmar los archivos pertinentes:**
   ```powershell
   git add <archivos_modificados>
   git commit -m "tipo(alcance): descripcion clara del cambio"
   ```

4. **Publicar hacia el repositorio remoto:**
   ```powershell
   git push origin master
   ```

---

### 5. RESOLUCIÓN DE CONFLICTOS O RAMAS DIVERGENTES

Si al intentar hacer `git pull --ff-only` o `git push` Git le indica que existen cambios remotos o divergencia:

> [!WARNING]
> **REGLAS DE SEGURIDAD ESTRICTAS:**
> - **NUNCA usar `git reset --hard`:** Borrará de manera irreversible el trabajo que no se haya guardado.
> - **NUNCA usar `git push --force` (o `-f`):** Sobrescribirá y destruirá los commits que su colega o usted enviaron desde la otra máquina.

#### Escenario A: Cambios locales sin commit al hacer pull
Si tiene trabajo pendiente en archivos y necesita descargar cambios remotos:
```powershell
# 1. Guardar temporalmente sus cambios locales en el stash
git stash save "trabajo-en-progreso"

# 2. Descargar los cambios remotos de forma limpia
git pull --ff-only origin master

# 3. Recuperar sus cambios locales sobre la base actualizada
git stash pop
```

#### Escenario B: Ambas máquinas crearon commits locales diferentes (Divergencia)
Si ambas máquinas realizaron commits antes de hacer push:
```powershell
# 1. Traer las referencias remotas sin mezclarlas aún
git fetch origin

# 2. Rebasar sus commits locales encima de los commits remotos descargados
git pull --rebase origin master

# 3. Si hay conflictos en algún archivo, Git indicará qué archivos resolver.
# Edite el archivo, elija la versión correcta, y luego:
git add <archivo_resuelto>
git rebase --continue

# 4. Una vez completado el rebase, publique sus cambios:
git push origin master
```

---

### 6. SCRIPTS OFICIALES DEL PROYECTO (`package.json`)

#### Backend (`D:\DESARROLLO\PRODUCCION JARED\CAJA CHICA\backend`)
| Script | Comando | Propósito |
| :--- | :--- | :--- |
| `npm run start:dev` | `nest start --watch` | Inicia el servidor backend en modo desarrollo con recarga automática (`http://localhost:3000/api`). |
| `npm run build` | `nest build` | Compila el backend TypeScript a JavaScript en la carpeta `dist/`. |
| `npm test` | `jest` | Ejecuta la suite de pruebas automatizadas contra `caja_chica_cps_test`. |
| `npm run admin:create`| `ts-node src/scripts/create-admin.ts` | Crea de forma interactiva y segura la cuenta de administrador inicial. |
| `npx prisma migrate deploy` | `prisma migrate deploy` | Aplica todas las migraciones SQL pendientes en la base configurada en `.env`. |
| `npx prisma generate` | `prisma generate` | Genera los tipos de Prisma Client correspondientes al esquema actual. |

#### Frontend (`D:\DESARROLLO\PRODUCCION JARED\CAJA CHICA\frontend`)
| Script | Comando | Propósito |
| :--- | :--- | :--- |
| `npm run dev` | `vite` | Inicia el servidor de desarrollo Vite con Hot Module Replacement (`http://localhost:5173`). |
| `npm run build` | `tsc -b && vite build` | Valida tipos TypeScript y genera el paquete de producción en `dist/`. |
| `npm run preview` | `vite preview` | Previsualiza localmente el paquete compilado de producción. |

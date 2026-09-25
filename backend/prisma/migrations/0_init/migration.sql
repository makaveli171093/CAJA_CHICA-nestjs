-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('ADMINISTRADOR', 'ENCARGADO');

-- CreateEnum
CREATE TYPE "EstadoCajaApertura" AS ENUM ('BORRADOR', 'ABIERTA', 'CERRADA');

-- CreateEnum
CREATE TYPE "TipoMovimientoEfectivo" AS ENUM ('APERTURA', 'DESCARGO', 'REPOSICION', 'DEVOLUCION_SOBRANTE', 'AJUSTE');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "nombreCompleto" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" "RolUsuario" NOT NULL DEFAULT 'ENCARGADO',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unidades" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "dependencia" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "unidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario_unidades" (
    "userId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_unidades_pkey" PRIMARY KEY ("userId","unitId")
);

-- CreateTable
CREATE TABLE "responsables" (
    "id" TEXT NOT NULL,
    "unidadId" TEXT NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "carnetIdentidad" TEXT NOT NULL,
    "cargo" TEXT NOT NULL,
    "documentoDesignacion" TEXT NOT NULL,
    "fechaDesignacion" DATE NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "responsables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partidas" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "partidas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presupuestos_partidas" (
    "id" TEXT NOT NULL,
    "unidadId" TEXT NOT NULL,
    "gestion" INTEGER NOT NULL,
    "partidaId" TEXT NOT NULL,
    "montoAsignado" DECIMAL(14,2) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "presupuestos_partidas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presupuestos_historial" (
    "id" TEXT NOT NULL,
    "presupuestoPartidaId" TEXT NOT NULL,
    "montoAnterior" DECIMAL(14,2) NOT NULL,
    "montoNuevo" DECIMAL(14,2) NOT NULL,
    "motivo" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorUsername" TEXT,
    "fecha" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "presupuestos_historial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cajas_apertura" (
    "id" TEXT NOT NULL,
    "unidadId" TEXT NOT NULL,
    "gestion" INTEGER NOT NULL,
    "responsableId" TEXT NOT NULL,
    "montoAutorizado" DECIMAL(14,2) NOT NULL,
    "importeRecibido" DECIMAL(14,2) NOT NULL,
    "fechaApertura" DATE NOT NULL,
    "docAutorizacion" TEXT NOT NULL,
    "compIngreso" TEXT NOT NULL,
    "estado" "EstadoCajaApertura" NOT NULL DEFAULT 'BORRADOR',
    "fechaConfirmacion" TIMESTAMPTZ,
    "confirmadoPorId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cajas_apertura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_efectivo" (
    "id" TEXT NOT NULL,
    "cajaAperturaId" TEXT NOT NULL,
    "tipo" "TipoMovimientoEfectivo" NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "fecha" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "descripcion" TEXT NOT NULL,
    "comprobanteReferencia" TEXT,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_efectivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditorias" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorUsername" TEXT,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT,
    "detalleJson" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "fecha" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditorias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_username_key" ON "usuarios"("username");

-- CreateIndex
CREATE UNIQUE INDEX "unidades_codigo_key" ON "unidades"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "partidas_codigo_key" ON "partidas"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "presupuestos_partidas_unidadId_gestion_partidaId_key" ON "presupuestos_partidas"("unidadId", "gestion", "partidaId");

-- CreateIndex
CREATE UNIQUE INDEX "cajas_apertura_unidadId_gestion_key" ON "cajas_apertura"("unidadId", "gestion");

-- AddForeignKey
ALTER TABLE "usuario_unidades" ADD CONSTRAINT "usuario_unidades_userId_fkey" FOREIGN KEY ("userId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_unidades" ADD CONSTRAINT "usuario_unidades_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "unidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "responsables" ADD CONSTRAINT "responsables_unidadId_fkey" FOREIGN KEY ("unidadId") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presupuestos_partidas" ADD CONSTRAINT "presupuestos_partidas_unidadId_fkey" FOREIGN KEY ("unidadId") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presupuestos_partidas" ADD CONSTRAINT "presupuestos_partidas_partidaId_fkey" FOREIGN KEY ("partidaId") REFERENCES "partidas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presupuestos_historial" ADD CONSTRAINT "presupuestos_historial_presupuestoPartidaId_fkey" FOREIGN KEY ("presupuestoPartidaId") REFERENCES "presupuestos_partidas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cajas_apertura" ADD CONSTRAINT "cajas_apertura_unidadId_fkey" FOREIGN KEY ("unidadId") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cajas_apertura" ADD CONSTRAINT "cajas_apertura_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "responsables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_efectivo" ADD CONSTRAINT "movimientos_efectivo_cajaAperturaId_fkey" FOREIGN KEY ("cajaAperturaId") REFERENCES "cajas_apertura"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditorias" ADD CONSTRAINT "auditorias_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;


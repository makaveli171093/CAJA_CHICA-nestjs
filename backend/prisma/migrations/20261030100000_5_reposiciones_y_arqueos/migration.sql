-- CreateEnum
CREATE TYPE "EstadoReposicion" AS ENUM ('BORRADOR', 'SOLICITADA', 'APROBADA', 'RECHAZADA', 'EFECTUADA');

-- CreateEnum
CREATE TYPE "TipoArqueo" AS ENUM ('PERIODICO', 'SORPRESIVO', 'CIERRE_GESTION');

-- CreateEnum
CREATE TYPE "EstadoArqueo" AS ENUM ('CONFORME', 'FALTANTE', 'SOBRANTE');

-- AlterTable
ALTER TABLE "movimientos_efectivo" ADD COLUMN     "reposicionId" TEXT;

-- AlterTable
ALTER TABLE "rendiciones" ADD COLUMN     "reposicionId" TEXT;

-- CreateTable
CREATE TABLE "reposiciones" (
    "id" TEXT NOT NULL,
    "numeroReposicion" TEXT NOT NULL,
    "correlativo" INTEGER NOT NULL,
    "unidadId" TEXT NOT NULL,
    "gestion" INTEGER NOT NULL,
    "cajaAperturaId" TEXT NOT NULL,
    "montoTotal" DECIMAL(14,2) NOT NULL,
    "estado" "EstadoReposicion" NOT NULL DEFAULT 'BORRADOR',
    "fechaSolicitud" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaAprobacion" TIMESTAMPTZ,
    "fechaEfectuada" TIMESTAMPTZ,
    "comprobantePago" TEXT,
    "bancoOrigen" TEXT,
    "observaciones" TEXT,
    "motivoRechazo" TEXT,
    "solicitadoPorId" TEXT NOT NULL,
    "aprobadoPorId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "reposiciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arqueos_caja" (
    "id" TEXT NOT NULL,
    "numeroActa" TEXT NOT NULL,
    "correlativo" INTEGER NOT NULL,
    "unidadId" TEXT NOT NULL,
    "gestion" INTEGER NOT NULL,
    "cajaAperturaId" TEXT NOT NULL,
    "tipoArqueo" "TipoArqueo" NOT NULL DEFAULT 'PERIODICO',
    "fechaArqueo" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "horaArqueo" TEXT,
    "billeteoJson" TEXT NOT NULL,
    "totalBilletes" DECIMAL(14,2) NOT NULL,
    "totalMonedas" DECIMAL(14,2) NOT NULL,
    "totalEfectivo" DECIMAL(14,2) NOT NULL,
    "totalValesPendientes" DECIMAL(14,2) NOT NULL,
    "totalRendiciones" DECIMAL(14,2) NOT NULL,
    "totalGeneral" DECIMAL(14,2) NOT NULL,
    "fondoAutorizado" DECIMAL(14,2) NOT NULL,
    "diferencia" DECIMAL(14,2) NOT NULL,
    "resultado" "EstadoArqueo" NOT NULL DEFAULT 'CONFORME',
    "custodioNombre" TEXT NOT NULL,
    "auditorNombre" TEXT NOT NULL,
    "testigoNombre" TEXT,
    "observaciones" TEXT,
    "realizadoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "arqueos_caja_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reposiciones_numeroReposicion_key" ON "reposiciones"("numeroReposicion");

-- CreateIndex
CREATE INDEX "reposiciones_unidadId_gestion_idx" ON "reposiciones"("unidadId", "gestion");

-- CreateIndex
CREATE INDEX "reposiciones_cajaAperturaId_estado_idx" ON "reposiciones"("cajaAperturaId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "reposiciones_cajaAperturaId_correlativo_key" ON "reposiciones"("cajaAperturaId", "correlativo");

-- CreateIndex
CREATE UNIQUE INDEX "arqueos_caja_numeroActa_key" ON "arqueos_caja"("numeroActa");

-- CreateIndex
CREATE INDEX "arqueos_caja_unidadId_gestion_idx" ON "arqueos_caja"("unidadId", "gestion");

-- CreateIndex
CREATE UNIQUE INDEX "arqueos_caja_cajaAperturaId_correlativo_key" ON "arqueos_caja"("cajaAperturaId", "correlativo");

-- CreateIndex
CREATE UNIQUE INDEX "movimientos_efectivo_reposicionId_key" ON "movimientos_efectivo"("reposicionId");

-- CreateIndex
CREATE INDEX "rendiciones_reposicionId_idx" ON "rendiciones"("reposicionId");

-- AddForeignKey
ALTER TABLE "movimientos_efectivo" ADD CONSTRAINT "movimientos_efectivo_reposicionId_fkey" FOREIGN KEY ("reposicionId") REFERENCES "reposiciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rendiciones" ADD CONSTRAINT "rendiciones_reposicionId_fkey" FOREIGN KEY ("reposicionId") REFERENCES "reposiciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reposiciones" ADD CONSTRAINT "reposiciones_unidadId_fkey" FOREIGN KEY ("unidadId") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reposiciones" ADD CONSTRAINT "reposiciones_cajaAperturaId_fkey" FOREIGN KEY ("cajaAperturaId") REFERENCES "cajas_apertura"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reposiciones" ADD CONSTRAINT "reposiciones_solicitadoPorId_fkey" FOREIGN KEY ("solicitadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reposiciones" ADD CONSTRAINT "reposiciones_aprobadoPorId_fkey" FOREIGN KEY ("aprobadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arqueos_caja" ADD CONSTRAINT "arqueos_caja_unidadId_fkey" FOREIGN KEY ("unidadId") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arqueos_caja" ADD CONSTRAINT "arqueos_caja_cajaAperturaId_fkey" FOREIGN KEY ("cajaAperturaId") REFERENCES "cajas_apertura"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arqueos_caja" ADD CONSTRAINT "arqueos_caja_realizadoPorId_fkey" FOREIGN KEY ("realizadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

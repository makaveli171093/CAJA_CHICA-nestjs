-- CreateEnum
CREATE TYPE "EstadoRendicion" AS ENUM ('BORRADOR', 'ENVIADA', 'APROBADA', 'RECHAZADA');

-- CreateEnum
CREATE TYPE "TipoDocumentoDescargo" AS ENUM ('FACTURA_COMPRA', 'RECIBO_OFICIAL', 'OTRO_AUTORIZADO');

-- AlterEnum
ALTER TYPE "RolUsuario" ADD VALUE 'FINANCIERO';
ALTER TYPE "RolUsuario" ADD VALUE 'GERENCIA';

-- AlterTable
ALTER TABLE "movimientos_efectivo" ADD COLUMN     "rendicionId" TEXT;

-- CreateTable
CREATE TABLE "rendiciones" (
    "id" TEXT NOT NULL,
    "numeroRendicion" TEXT NOT NULL,
    "correlativoRendicion" INTEGER NOT NULL,
    "anticipoId" TEXT NOT NULL,
    "cajaAperturaId" TEXT NOT NULL,
    "unidadId" TEXT NOT NULL,
    "gestion" INTEGER NOT NULL,
    "fechaRendicion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "montoAnticipo" DECIMAL(14,2) NOT NULL,
    "totalDescargado" DECIMAL(14,2) NOT NULL,
    "montoSobrante" DECIMAL(14,2) NOT NULL,
    "montoDevuelto" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "estado" "EstadoRendicion" NOT NULL DEFAULT 'BORRADOR',
    "observaciones" TEXT,
    "motivoRechazo" TEXT,
    "datosRendicionJson" TEXT,
    "creadoPorUserId" TEXT NOT NULL,
    "aprobadoPorUserId" TEXT,
    "fechaAprobacion" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "rendiciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentos_descargo" (
    "id" TEXT NOT NULL,
    "rendicionId" TEXT NOT NULL,
    "tipoDocumento" "TipoDocumentoDescargo" NOT NULL DEFAULT 'FACTURA_COMPRA',
    "numeroDocumento" TEXT NOT NULL,
    "nitCiEmisor" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "fechaEmision" DATE NOT NULL,
    "codigoAutorizacion" TEXT,
    "codigoControl" TEXT,
    "partidaId" TEXT NOT NULL,
    "importe" DECIMAL(14,2) NOT NULL,
    "concepto" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "documentos_descargo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rendiciones_numeroRendicion_key" ON "rendiciones"("numeroRendicion");

-- CreateIndex
CREATE UNIQUE INDEX "rendiciones_anticipoId_key" ON "rendiciones"("anticipoId");

-- CreateIndex
CREATE INDEX "rendiciones_unidadId_gestion_idx" ON "rendiciones"("unidadId", "gestion");

-- CreateIndex
CREATE INDEX "rendiciones_cajaAperturaId_estado_idx" ON "rendiciones"("cajaAperturaId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "rendiciones_cajaAperturaId_correlativoRendicion_key" ON "rendiciones"("cajaAperturaId", "correlativoRendicion");

-- CreateIndex
CREATE INDEX "documentos_descargo_rendicionId_idx" ON "documentos_descargo"("rendicionId");

-- CreateIndex
CREATE INDEX "documentos_descargo_partidaId_idx" ON "documentos_descargo"("partidaId");

-- CreateIndex
CREATE UNIQUE INDEX "movimientos_efectivo_rendicionId_key" ON "movimientos_efectivo"("rendicionId");

-- AddForeignKey
ALTER TABLE "movimientos_efectivo" ADD CONSTRAINT "movimientos_efectivo_rendicionId_fkey" FOREIGN KEY ("rendicionId") REFERENCES "rendiciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rendiciones" ADD CONSTRAINT "rendiciones_anticipoId_fkey" FOREIGN KEY ("anticipoId") REFERENCES "anticipos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rendiciones" ADD CONSTRAINT "rendiciones_cajaAperturaId_fkey" FOREIGN KEY ("cajaAperturaId") REFERENCES "cajas_apertura"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rendiciones" ADD CONSTRAINT "rendiciones_unidadId_fkey" FOREIGN KEY ("unidadId") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rendiciones" ADD CONSTRAINT "rendiciones_creadoPorUserId_fkey" FOREIGN KEY ("creadoPorUserId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rendiciones" ADD CONSTRAINT "rendiciones_aprobadoPorUserId_fkey" FOREIGN KEY ("aprobadoPorUserId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_descargo" ADD CONSTRAINT "documentos_descargo_rendicionId_fkey" FOREIGN KEY ("rendicionId") REFERENCES "rendiciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_descargo" ADD CONSTRAINT "documentos_descargo_partidaId_fkey" FOREIGN KEY ("partidaId") REFERENCES "partidas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

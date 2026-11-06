-- AlterEnum
ALTER TYPE "TipoMovimientoEfectivo" ADD VALUE 'ENTREGA_ANTICIPO';

-- CreateEnum
CREATE TYPE "EstadoPedido" AS ENUM ('BORRADOR', 'ENTREGADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "EstadoAnticipo" AS ENUM ('PENDIENTE', 'RENDIDO');

-- AlterTable
ALTER TABLE "movimientos_efectivo" ADD COLUMN "anticipoId" TEXT;

-- CreateTable
CREATE TABLE "pedidos" (
    "id" TEXT NOT NULL,
    "unidadId" TEXT NOT NULL,
    "gestion" INTEGER NOT NULL,
    "cajaAperturaId" TEXT NOT NULL,
    "partidaId" TEXT NOT NULL,
    "numeroPedido" TEXT NOT NULL,
    "fechaSolicitud" DATE NOT NULL,
    "lugar" TEXT NOT NULL DEFAULT 'La Paz',
    "solicitanteNombres" TEXT NOT NULL,
    "solicitanteApellidos" TEXT NOT NULL,
    "solicitanteCi" TEXT NOT NULL,
    "solicitanteArea" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "receptorNombres" TEXT NOT NULL,
    "receptorApellidos" TEXT NOT NULL,
    "receptorCi" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "referenciaRepMat" TEXT,
    "observaciones" TEXT,
    "estado" "EstadoPedido" NOT NULL DEFAULT 'BORRADOR',
    "motivoCancelacion" TEXT,
    "registradoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "pedidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anticipos" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "cajaAperturaId" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "fechaEntrega" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entregadoPorId" TEXT NOT NULL,
    "estado" "EstadoAnticipo" NOT NULL DEFAULT 'PENDIENTE',
    "numeroVale" TEXT NOT NULL,
    "correlativoVale" INTEGER NOT NULL,
    "datosValeJson" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "anticipos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "movimientos_efectivo_anticipoId_key" ON "movimientos_efectivo"("anticipoId");

-- CreateIndex
CREATE INDEX "pedidos_unidadId_gestion_idx" ON "pedidos"("unidadId", "gestion");

-- CreateIndex
CREATE INDEX "pedidos_cajaAperturaId_idx" ON "pedidos"("cajaAperturaId");

-- CreateIndex
CREATE INDEX "pedidos_partidaId_idx" ON "pedidos"("partidaId");

-- CreateIndex
CREATE UNIQUE INDEX "anticipos_pedidoId_key" ON "anticipos"("pedidoId");

-- CreateIndex
CREATE UNIQUE INDEX "anticipos_numeroVale_key" ON "anticipos"("numeroVale");

-- CreateIndex
CREATE INDEX "anticipos_cajaAperturaId_estado_idx" ON "anticipos"("cajaAperturaId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "anticipos_cajaAperturaId_correlativoVale_key" ON "anticipos"("cajaAperturaId", "correlativoVale");

-- AddForeignKey
ALTER TABLE "movimientos_efectivo" ADD CONSTRAINT "movimientos_efectivo_anticipoId_fkey" FOREIGN KEY ("anticipoId") REFERENCES "anticipos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_unidadId_fkey" FOREIGN KEY ("unidadId") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_cajaAperturaId_fkey" FOREIGN KEY ("cajaAperturaId") REFERENCES "cajas_apertura"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_partidaId_fkey" FOREIGN KEY ("partidaId") REFERENCES "partidas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anticipos" ADD CONSTRAINT "anticipos_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedidos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anticipos" ADD CONSTRAINT "anticipos_cajaAperturaId_fkey" FOREIGN KEY ("cajaAperturaId") REFERENCES "cajas_apertura"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anticipos" ADD CONSTRAINT "anticipos_entregadoPorId_fkey" FOREIGN KEY ("entregadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

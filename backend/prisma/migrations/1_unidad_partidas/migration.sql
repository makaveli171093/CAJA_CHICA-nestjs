-- CreateTable
CREATE TABLE "unidad_partidas" (
    "id" TEXT NOT NULL,
    "unidadId" TEXT NOT NULL,
    "partidaId" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "unidad_partidas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "unidad_partidas_unidadId_partidaId_key" ON "unidad_partidas"("unidadId", "partidaId");

-- AddForeignKey
ALTER TABLE "unidad_partidas" ADD CONSTRAINT "unidad_partidas_unidadId_fkey" FOREIGN KEY ("unidadId") REFERENCES "unidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unidad_partidas" ADD CONSTRAINT "unidad_partidas_partidaId_fkey" FOREIGN KEY ("partidaId") REFERENCES "partidas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

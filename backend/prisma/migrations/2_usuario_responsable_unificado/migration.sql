-- AlterTable usuarios
ALTER TABLE "usuarios" ADD COLUMN "nombres" TEXT,
ADD COLUMN "apellidos" TEXT,
ADD COLUMN "carnetIdentidad" TEXT,
ADD COLUMN "cargo" TEXT;

-- AlterTable responsables
ALTER TABLE "responsables" ADD COLUMN "userId" TEXT;

-- AddForeignKey
ALTER TABLE "responsables" ADD CONSTRAINT "responsables_userId_fkey" FOREIGN KEY ("userId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

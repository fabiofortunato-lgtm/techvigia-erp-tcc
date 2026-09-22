-- DropForeignKey
ALTER TABLE "manutencoes" DROP CONSTRAINT "manutencoes_tecnicoId_fkey";

-- AddForeignKey
ALTER TABLE "manutencoes" ADD CONSTRAINT "manutencoes_tecnicoId_fkey" FOREIGN KEY ("tecnicoId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

/*
  Warnings:

  - A unique constraint covering the columns `[resetSenhaToken]` on the table `usuarios` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "resetSenhaExpiraEm" TIMESTAMP(3),
ADD COLUMN     "resetSenhaToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_resetSenhaToken_key" ON "usuarios"("resetSenhaToken");

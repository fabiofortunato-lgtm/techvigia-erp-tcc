-- CreateEnum
CREATE TYPE "TipoManutencao" AS ENUM ('PREVENTIVA', 'CORRETIVA');

-- CreateEnum
CREATE TYPE "PrioridadeManutencao" AS ENUM ('BAIXA', 'MEDIA', 'ALTA');

-- CreateEnum
CREATE TYPE "StatusEquipamento" AS ENUM ('OK', 'DEFEITO');

-- AlterTable
ALTER TABLE "equipamentos" ADD COLUMN     "local" TEXT,
ADD COLUMN     "status" "StatusEquipamento" NOT NULL DEFAULT 'OK';

-- AlterTable
ALTER TABLE "manutencoes" ADD COLUMN     "prioridade" "PrioridadeManutencao" NOT NULL DEFAULT 'MEDIA',
ADD COLUMN     "tipo" "TipoManutencao" NOT NULL DEFAULT 'PREVENTIVA';

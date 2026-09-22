-- Modelo reutilizável de checklist, um por Tipo de manutenção (Preventiva
-- ou Corretiva). Ao criar uma OS, o checklist é copiado automaticamente
-- daqui - editar o modelo depois não altera OS já criadas.
CREATE TABLE "checklist_modelos" (
    "id" TEXT NOT NULL,
    "tipo" "TipoManutencao" NOT NULL,
    "nome" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "checklist_modelos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "checklist_modelos_tipo_key" ON "checklist_modelos"("tipo");

CREATE TABLE "checklist_modelo_itens" (
    "id" TEXT NOT NULL,
    "checklistModeloId" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checklist_modelo_itens_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "checklist_modelo_itens_checklistModeloId_idx" ON "checklist_modelo_itens"("checklistModeloId");

ALTER TABLE "checklist_modelo_itens" ADD CONSTRAINT "checklist_modelo_itens_checklistModeloId_fkey"
  FOREIGN KEY ("checklistModeloId") REFERENCES "checklist_modelos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

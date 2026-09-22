-- Qual equipamento a OS trata primariamente (ex: "veio pra consertar essa
-- câmera específica") - opcional, diferente de Peca.equipamentoId (que
-- rastreia em qual equipamento cada peça trocada foi instalada).
ALTER TABLE "manutencoes" ADD COLUMN "equipamentoId" TEXT;

ALTER TABLE "manutencoes" ADD CONSTRAINT "manutencoes_equipamentoId_fkey"
  FOREIGN KEY ("equipamentoId") REFERENCES "equipamentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "manutencoes_equipamentoId_idx" ON "manutencoes"("equipamentoId");

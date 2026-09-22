-- AlterTable: momento exato da coleta da assinatura - a partir daqui a OS
-- fica travada para edição (checklist, fotos, peças, observação, e uma
-- nova assinatura por cima da existente).
ALTER TABLE "manutencoes" ADD COLUMN "assinadoEm" TIMESTAMP(3);

-- CreateTable: trilha de auditoria - quem fez o quê e quando, em ações
-- sensíveis do sistema. Não existia nenhuma tabela de log antes disso.
CREATE TABLE "logs_auditoria" (
    "id" TEXT NOT NULL,
    "manutencaoId" TEXT,
    "usuarioId" TEXT,
    "acao" TEXT NOT NULL,
    "detalhes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logs_auditoria_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "logs_auditoria_manutencaoId_idx" ON "logs_auditoria"("manutencaoId");

ALTER TABLE "logs_auditoria" ADD CONSTRAINT "logs_auditoria_manutencaoId_fkey"
    FOREIGN KEY ("manutencaoId") REFERENCES "manutencoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "logs_auditoria" ADD CONSTRAINT "logs_auditoria_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Corrige movimentacoes_estoque.usuarioId, que até agora era um texto
-- solto sem nenhuma validação contra a tabela de usuários - um ledger
-- financeiro/estoque cuja autoria não tem integridade referencial não é
-- auditável de verdade, mesmo com o comentário no schema dizendo que é.
--
-- Antes de adicionar a chave estrangeira: limpa qualquer usuarioId órfão
-- (que não corresponde a nenhum usuário existente) - sem isso, a migration
-- falharia caso exista algum dado antigo inconsistente, já que esse campo
-- nunca foi validado contra a tabela real até agora.
UPDATE "movimentacoes_estoque" me
SET "usuarioId" = NULL
WHERE me."usuarioId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "usuarios" u WHERE u.id = me."usuarioId");

ALTER TABLE "movimentacoes_estoque" ADD CONSTRAINT "movimentacoes_estoque_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Índices em chaves estrangeiras - Postgres, ao contrário do MySQL, NÃO
-- cria índice automaticamente para colunas de FK. Sem isso, cada consulta
-- que filtra por essas colunas (a maioria das telas do sistema) faz uma
-- varredura completa da tabela em vez de uma busca indexada - o impacto
-- cresce conforme o volume de dado aumenta.

CREATE INDEX "tecnico_condominio_condominioId_idx" ON "tecnico_condominio"("condominioId");

CREATE INDEX "equipamentos_condominioId_idx" ON "equipamentos"("condominioId");

CREATE INDEX "manutencoes_condominioId_idx" ON "manutencoes"("condominioId");
CREATE INDEX "manutencoes_tecnicoId_idx" ON "manutencoes"("tecnicoId");
CREATE INDEX "manutencoes_status_idx" ON "manutencoes"("status");

CREATE INDEX "fotos_manutencaoId_idx" ON "fotos"("manutencaoId");

CREATE INDEX "checklist_itens_manutencaoId_idx" ON "checklist_itens"("manutencaoId");

CREATE INDEX "pecas_manutencaoId_idx" ON "pecas"("manutencaoId");
CREATE INDEX "pecas_equipamentoId_idx" ON "pecas"("equipamentoId");
CREATE INDEX "pecas_itemEstoqueId_idx" ON "pecas"("itemEstoqueId");

CREATE INDEX "movimentacoes_estoque_itemEstoqueId_idx" ON "movimentacoes_estoque"("itemEstoqueId");
CREATE INDEX "movimentacoes_estoque_usuarioId_idx" ON "movimentacoes_estoque"("usuarioId");

CREATE INDEX "logs_auditoria_usuarioId_idx" ON "logs_auditoria"("usuarioId");

-- Unicidade em numeroSerie/patrimonio - a mesma câmera cadastrada duas
-- vezes por engano hoje parte o histórico de trocas entre dois IDs
-- diferentes, o que estraga justamente o dado que a manutenção preditiva
-- futura vai depender. Campos continuam opcionais (NULL) - o Postgres
-- permite múltiplos NULL num índice único, só valores repetidos de verdade
-- são bloqueados.
--
-- Se esse comando falhar aqui, é sinal de que já existem dois equipamentos
-- com o mesmo numeroSerie ou patrimonio cadastrados por engano - será
-- preciso revisar manualmente esses registros (Prisma Studio) antes de
-- rodar a migration de novo. Não é seguro corrigir isso automaticamente,
-- já que apagar ou modificar um dos dois poderia jogar fora um histórico
-- de manutenção real.
ALTER TABLE "equipamentos" ADD CONSTRAINT "equipamentos_numeroSerie_key" UNIQUE ("numeroSerie");
ALTER TABLE "equipamentos" ADD CONSTRAINT "equipamentos_patrimonio_key" UNIQUE ("patrimonio");

-- Contador atômico de numeração de OS - substitui o antigo count()+1
-- (corrida real: dois agendamentos simultâneos podiam gerar o mesmo
-- numeroOS). Um registro por ano, incrementado via INSERT...ON CONFLICT
-- DO UPDATE (atômico no Postgres).
CREATE TABLE "contador_os" (
    "ano" INTEGER NOT NULL,
    "ultimo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "contador_os_pkey" PRIMARY KEY ("ano")
);

-- Semeia o contador a partir do maior número já usado em cada ano, lendo
-- o próprio numeroOS existente (formato OS-AAAANNNNNN) - essencial para
-- continuar a numeração exatamente de onde as OS já cadastradas pararam,
-- em vez de reiniciar do zero e colidir com o dado real já existente.
INSERT INTO "contador_os" ("ano", "ultimo")
SELECT
  CAST(SUBSTRING("numeroOS" FROM 4 FOR 4) AS INTEGER) AS ano,
  MAX(CAST(SUBSTRING("numeroOS" FROM 8) AS INTEGER)) AS ultimo
FROM "manutencoes"
WHERE "numeroOS" ~ '^OS-[0-9]{4}[0-9]{6}$'
GROUP BY CAST(SUBSTRING("numeroOS" FROM 4 FOR 4) AS INTEGER)
ON CONFLICT ("ano") DO UPDATE SET "ultimo" = GREATEST("contador_os"."ultimo", EXCLUDED."ultimo");

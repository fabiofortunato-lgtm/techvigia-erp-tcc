-- Técnico passa a ser opcional na OS - necessário para as manutenções
-- geradas automaticamente pelo job de recorrência (a cada N dias, por
-- condomínio), que nascem sem técnico até alguém atribuir manualmente no
-- painel. A validação do CreateManutencaoDto continua exigindo técnico
-- para toda OS criada pelo app/painel - essa mudança de schema serve só
-- o caminho automático.
ALTER TABLE "manutencoes" ALTER COLUMN "tecnicoId" DROP NOT NULL;

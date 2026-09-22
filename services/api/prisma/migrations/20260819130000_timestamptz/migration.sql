-- Fuso horário: TIMESTAMP -> TIMESTAMPTZ
--
-- Todas as colunas de data/hora eram "timestamp without time zone", ou seja,
-- o banco guardava um número de relógio sem dizer de que relógio se trata.
-- Funciona enquanto tudo roda com o mesmo fuso; quebra silenciosamente
-- quando não roda - um servidor em UTC e um relatório lido no Brasil
-- divergem em 3 horas, e o horário de uma OS assinada às 23h vira o dia
-- seguinte. Não dá erro em lugar nenhum: só fica errado.
--
-- O Prisma sempre gravou esses valores em UTC, então a conversão declara
-- exatamente isso ("AT TIME ZONE 'UTC'"): o valor que está lá é UTC.
-- Converter sem esse USING deixaria o Postgres adotar o fuso da sessão que
-- roda a migração, e o dado existente sairia deslocado.
--
-- Migração de dados: reescreve as colunas das tabelas abaixo. Rodar em
-- janela de manutenção se a base já estiver grande.


-- checklist_itens
ALTER TABLE "checklist_itens" ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';
ALTER TABLE "checklist_itens" ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

-- condominios
ALTER TABLE "condominios" ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';
ALTER TABLE "condominios" ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';
ALTER TABLE "condominios" ALTER COLUMN "deletedAt" TYPE TIMESTAMPTZ(3) USING "deletedAt" AT TIME ZONE 'UTC';

-- equipamentos
ALTER TABLE "equipamentos" ALTER COLUMN "garantiaAte" TYPE TIMESTAMPTZ(3) USING "garantiaAte" AT TIME ZONE 'UTC';
ALTER TABLE "equipamentos" ALTER COLUMN "dataInstalacao" TYPE TIMESTAMPTZ(3) USING "dataInstalacao" AT TIME ZONE 'UTC';
ALTER TABLE "equipamentos" ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';
ALTER TABLE "equipamentos" ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';
ALTER TABLE "equipamentos" ALTER COLUMN "deletedAt" TYPE TIMESTAMPTZ(3) USING "deletedAt" AT TIME ZONE 'UTC';

-- fotos
ALTER TABLE "fotos" ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';

-- itens_estoque
ALTER TABLE "itens_estoque" ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';
ALTER TABLE "itens_estoque" ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';
ALTER TABLE "itens_estoque" ALTER COLUMN "deletedAt" TYPE TIMESTAMPTZ(3) USING "deletedAt" AT TIME ZONE 'UTC';

-- logs_auditoria
ALTER TABLE "logs_auditoria" ALTER COLUMN "criadoEm" TYPE TIMESTAMPTZ(3) USING "criadoEm" AT TIME ZONE 'UTC';

-- manutencoes
ALTER TABLE "manutencoes" ALTER COLUMN "inicio" TYPE TIMESTAMPTZ(3) USING "inicio" AT TIME ZONE 'UTC';
ALTER TABLE "manutencoes" ALTER COLUMN "fim" TYPE TIMESTAMPTZ(3) USING "fim" AT TIME ZONE 'UTC';
ALTER TABLE "manutencoes" ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';
ALTER TABLE "manutencoes" ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';
ALTER TABLE "manutencoes" ALTER COLUMN "deletedAt" TYPE TIMESTAMPTZ(3) USING "deletedAt" AT TIME ZONE 'UTC';
ALTER TABLE "manutencoes" ALTER COLUMN "assinadoEm" TYPE TIMESTAMPTZ(3) USING "assinadoEm" AT TIME ZONE 'UTC';

-- movimentacoes_estoque
ALTER TABLE "movimentacoes_estoque" ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';

-- pecas
ALTER TABLE "pecas" ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';
ALTER TABLE "pecas" ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

-- tecnico_condominio
ALTER TABLE "tecnico_condominio" ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';
ALTER TABLE "tecnico_condominio" ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

-- usuarios
ALTER TABLE "usuarios" ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';
ALTER TABLE "usuarios" ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';
ALTER TABLE "usuarios" ALTER COLUMN "deletedAt" TYPE TIMESTAMPTZ(3) USING "deletedAt" AT TIME ZONE 'UTC';
ALTER TABLE "usuarios" ALTER COLUMN "resetSenhaExpiraEm" TYPE TIMESTAMPTZ(3) USING "resetSenhaExpiraEm" AT TIME ZONE 'UTC';

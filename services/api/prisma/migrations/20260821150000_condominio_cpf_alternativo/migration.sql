-- Nem todo cliente cadastrado é uma empresa/condomínio com CNPJ - alguns
-- são pessoa física (CPF). Relaxa a obrigatoriedade do CNPJ e adiciona o
-- CPF como alternativa. A regra "exatamente um dos dois é obrigatório" é
-- validada na aplicação (Prisma não expressa essa regra no schema).
ALTER TABLE "condominios" ALTER COLUMN "cnpj" DROP NOT NULL;

ALTER TABLE "condominios" ADD COLUMN "cpf" TEXT;

CREATE UNIQUE INDEX "condominios_cpf_key" ON "condominios"("cpf");

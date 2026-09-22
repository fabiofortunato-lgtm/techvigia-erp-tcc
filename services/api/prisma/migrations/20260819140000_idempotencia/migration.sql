-- Idempotência das ações reenviadas pela fila offline do app.
--
-- Sem isso, uma resposta perdida no caminho (o servidor grava, o celular
-- não recebe o "ok" e reenvia quando a conexão volta) registrava a peça
-- duas vezes e dava baixa dobrada no estoque.
CREATE TABLE "requisicoes_idempotentes" (
    "chave" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "metodo" TEXT NOT NULL,
    "rota" TEXT NOT NULL,
    "statusHttp" INTEGER,
    "resposta" JSONB,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "requisicoes_idempotentes_pkey" PRIMARY KEY ("usuarioId", "chave")
);

-- Usado pela limpeza periódica das chaves antigas.
CREATE INDEX "requisicoes_idempotentes_criadoEm_idx" ON "requisicoes_idempotentes"("criadoEm");

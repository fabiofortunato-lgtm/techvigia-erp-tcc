-- Rede de segurança no próprio banco: mesmo que algum código futuro
-- esqueça de usar o caminho atômico certo (movimentar/movimentarTx em
-- estoque.service.ts) e tente gravar um saldo negativo por engano, o
-- Postgres recusa a escrita. Isso não substitui a correção da aplicação
-- (o decremento atômico já resolve a corrida entre dois técnicos dando
-- baixa ao mesmo tempo) - é uma segunda camada de proteção, barata agora,
-- que a auditoria pré-produção recomendou como item de baixo custo.
ALTER TABLE "itens_estoque"
  ADD CONSTRAINT "itens_estoque_quantidade_nao_negativa" CHECK ("quantidade" >= 0);

-- Foto do equipamento no cadastro, e os dois campos que sustentam o
-- controle de troca periódica (ex: bateria de nobreak trocada a cada 12
-- meses) - "próxima troca" é calculada na aplicação, não guardada aqui.
ALTER TABLE "equipamentos" ADD COLUMN "fotoUrl" TEXT;
ALTER TABLE "equipamentos" ADD COLUMN "intervaloTrocaMeses" INTEGER;
ALTER TABLE "equipamentos" ADD COLUMN "dataUltimaTroca" TIMESTAMPTZ(3);

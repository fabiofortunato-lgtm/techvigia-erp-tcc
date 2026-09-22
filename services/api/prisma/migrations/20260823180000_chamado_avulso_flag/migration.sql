-- Diferencia chamado avulso (criado pelo app mobile com inicio = "agora")
-- de visita agendada de verdade (painel web, com data escolhida). Sem
-- essa distinção, um chamado avulso virava "atrasado" segundos depois de
-- criado, já que "agora" sempre já é passado no instante seguinte.
-- Default false preserva o comportamento atual pra toda OS já cadastrada.
ALTER TABLE "manutencoes" ADD COLUMN "chamadoAvulso" BOOLEAN NOT NULL DEFAULT false;

import {
  IsString,
  IsOptional,
  IsUUID,
  IsDateString,
  IsEnum,
  IsNumber,
  IsBoolean,
} from 'class-validator';
import { StatusManutencao, TipoManutencao, PrioridadeManutencao } from '@prisma/client';

export class CreateManutencaoDto {
  @IsUUID()
  condominioId: string;

  // Opcional na API de propósito - as telas de cadastro manual (painel e
  // app) continuam exigindo técnico antes de enviar o formulário, mas a
  // OS gerada automaticamente pelo job de recorrência (a cada N dias, por
  // condomínio) nasce sem técnico, até alguém atribuir manualmente depois
  // via PUT /manutencoes/:id.
  @IsOptional()
  @IsUUID()
  tecnicoId?: string;

  @IsDateString()
  inicio: string; // data/hora agendada da visita

  // Qual equipamento a OS trata primariamente - opcional, útil
  // principalmente em chamados corretivos ("veio pra essa câmera
  // específica"). Diferente do vínculo de Peca.equipamentoId.
  @IsOptional()
  @IsUUID()
  equipamentoId?: string;

  @IsOptional()
  @IsEnum(TipoManutencao)
  tipo?: TipoManutencao; // padrão: PREVENTIVA (definido no schema)

  @IsOptional()
  @IsEnum(PrioridadeManutencao)
  prioridade?: PrioridadeManutencao; // padrão: MEDIA (definido no schema)

  @IsOptional()
  @IsString()
  observacao?: string;

  // true quando criado como chamado avulso (app mobile, inicio = "agora") -
  // muda a tolerância antes de virar "atrasada" (ver dashboard.service.ts
  // e as telas de listagem). Default false (visita agendada de verdade).
  @IsOptional()
  @IsBoolean()
  chamadoAvulso?: boolean;
}

export class UpdateManutencaoDto {
  @IsOptional()
  @IsUUID()
  tecnicoId?: string;

  @IsOptional()
  @IsUUID()
  equipamentoId?: string;

  @IsOptional()
  @IsDateString()
  inicio?: string;

  @IsOptional()
  @IsDateString()
  fim?: string;

  @IsOptional()
  @IsEnum(StatusManutencao)
  status?: StatusManutencao;

  @IsOptional()
  @IsEnum(TipoManutencao)
  tipo?: TipoManutencao;

  @IsOptional()
  @IsEnum(PrioridadeManutencao)
  prioridade?: PrioridadeManutencao;

  @IsOptional()
  @IsString()
  observacao?: string;
}

// Usado pelo técnico ao chegar no local (check-in via GPS do app mobile)
export class CheckinManutencaoDto {
  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;
}

// Assinatura capturada em tela (base64) - o app mobile converte o
// desenho do síndico/zelador em uma imagem PNG em base64 antes de enviar.
export class AssinaturaDto {
  @IsString()
  imagemBase64: string; // pode vir com ou sem o prefixo "data:image/png;base64,"

  @IsOptional()
  @IsString()
  nomeAssinante?: string;
}

// Usado pela rota de observação, aberta a qualquer usuário autenticado
// (diferente do PUT completo, restrito a ADMIN/GESTOR)
export class ObservacaoDto {
  @IsString()
  observacao: string;
}

export class FiltroAgendaDto {
  @IsOptional()
  @IsDateString()
  dataInicio?: string;

  @IsOptional()
  @IsDateString()
  dataFim?: string;

  @IsOptional()
  @IsUUID()
  tecnicoId?: string;

  @IsOptional()
  @IsUUID()
  condominioId?: string;

  // Busca parcial pelo nome do cliente, sem diferenciar maiúsculas/minúsculas
  // - diferente de condominioId (exato, usado pela tela do próprio
  // condomínio), esse aqui serve o filtro de "digite o início do nome" da
  // tela de Ordens de Serviço.
  @IsOptional()
  @IsString()
  condominioNome?: string;

  // Vem de query string, por isso string em vez de boolean - comparado
  // como === 'true' no service. Filtra OS sem nenhum técnico atribuído
  // (as geradas automaticamente pelo job de recorrência, antes de alguém
  // atribuir manualmente).
  @IsOptional()
  @IsString()
  semTecnico?: string;

  @IsOptional()
  @IsUUID()
  equipamentoId?: string;

  @IsOptional()
  @IsString()
  numeroOS?: string; // busca parcial, sem diferenciar maiúsculas/minúsculas

  @IsOptional()
  @IsEnum(StatusManutencao)
  status?: StatusManutencao;

  @IsOptional()
  @IsEnum(TipoManutencao)
  tipo?: TipoManutencao;

  @IsOptional()
  @IsEnum(PrioridadeManutencao)
  prioridade?: PrioridadeManutencao;
}

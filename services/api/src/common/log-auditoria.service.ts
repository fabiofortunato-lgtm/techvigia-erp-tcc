import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface DadosLog {
  manutencaoId?: string;
  usuarioId?: string;
  acao: string;
  detalhes?: string;
}

/**
 * Trilha de auditoria - registra quem fez o quê e quando, em ações
 * sensíveis do sistema (assinatura coletada, OS concluída, tentativa de
 * edição bloqueada). Não existia nenhum registro assim antes - o único
 * "log" disponível era o `updatedAt`, que qualquer alteração posterior
 * sobrescreve, então não dava pra reconstruir nada depois do fato.
 *
 * Registrar auditoria nunca pode ser mais crítico que a própria ação sendo
 * registrada - por isso o erro é só logado no console, nunca propagado
 * (uma falha ao gravar o log não pode derrubar o check-in/assinatura/etc.
 * que estava acontecendo).
 */
@Injectable()
export class LogAuditoriaService {
  private readonly logger = new Logger(LogAuditoriaService.name);

  constructor(private prisma: PrismaService) {}

  async registrar(dados: DadosLog): Promise<void> {
    try {
      await this.prisma.logAuditoria.create({ data: dados });
    } catch (erro) {
      this.logger.error(`Falha ao registrar log de auditoria (ação: ${dados.acao})`, erro);
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ManutencoesService } from '../manutencoes/manutencoes.service';
import { TipoManutencao, StatusManutencao } from '@prisma/client';

/**
 * Gera manutenções preventivas automaticamente, por condomínio, quando o
 * intervalo cadastrado (Condominio.periodicidade, em dias) já passou desde
 * a última preventiva. A OS nasce sem técnico - alguém no painel
 * (ADMIN/GESTOR) atribui manualmente depois via PUT /manutencoes/:id.
 *
 * Reaproveita ManutencoesService.create() (não recria a lógica de gerar
 * numeroOS nem de preencher o checklist a partir do modelo cadastrado) -
 * a única diferença é que aqui tecnicoId nunca é informado.
 */
@Injectable()
export class ManutencaoRecorrenteService {
  private readonly logger = new Logger(ManutencaoRecorrenteService.name);

  constructor(
    private prisma: PrismaService,
    private manutencoesService: ManutencoesService,
  ) {}

  // Todo dia às 6h da manhã. Rodar diariamente (em vez de, por exemplo,
  // calcular a data exata e agendar pra aquele dia específico) é mais
  // resiliente: se o servidor ficar fora do ar num dia, no dia seguinte o
  // cálculo de "dias desde a última" ainda pega o atraso corretamente,
  // sem precisar de nenhuma lógica extra de recuperação.
  @Cron('0 6 * * *')
  async gerarTodas() {
    const condominios = await this.prisma.condominio.findMany({
      where: { deletedAt: null },
      select: { id: true },
    });

    let geradas = 0;
    for (const condominio of condominios) {
      const criada = await this.processarCondominio(condominio.id);
      if (criada) geradas++;
    }

    this.logger.log(
      `Geração de manutenções recorrentes: ${geradas} OS criadas, de ${condominios.length} condomínios verificados.`,
    );

    return { verificados: condominios.length, geradas };
  }

  /**
   * Avalia um condomínio específico e cria a OS se estiver na hora.
   * Devolve a OS criada, ou null se não era o momento (ou já existe uma
   * preventiva em aberto esperando ser resolvida).
   */
  async processarCondominio(condominioId: string) {
    const condominio = await this.prisma.condominio.findFirst({
      where: { id: condominioId, deletedAt: null },
    });
    if (!condominio) {
      return null;
    }

    // Já existe uma preventiva aberta (agendada ou em andamento) pra esse
    // condomínio? Não gera outra em cima - a existente precisa ser
    // resolvida primeiro, senão a lista de OS pendentes só cresceria sem
    // limite pra condomínios sem técnico atribuído.
    const emAberto = await this.prisma.manutencao.findFirst({
      where: {
        condominioId,
        tipo: TipoManutencao.PREVENTIVA,
        status: { in: [StatusManutencao.AGENDADA, StatusManutencao.EM_ANDAMENTO] },
        deletedAt: null,
      },
    });
    if (emAberto) {
      return null;
    }

    const ultima = await this.prisma.manutencao.findFirst({
      where: { condominioId, tipo: TipoManutencao.PREVENTIVA, deletedAt: null },
      orderBy: { inicio: 'desc' },
    });

    if (ultima?.inicio) {
      const diasDesde = Math.floor(
        (Date.now() - ultima.inicio.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (diasDesde < condominio.periodicidade) {
        return null; // ainda não venceu
      }
    }
    // Se `ultima` for null (esse condomínio nunca teve uma preventiva),
    // gera a primeira agora - não faz sentido esperar a periodicidade
    // completa antes da toda primeira visita.

    return this.manutencoesService.create({
      condominioId,
      inicio: new Date().toISOString(),
      tipo: TipoManutencao.PREVENTIVA,
      observacao:
        'Gerada automaticamente pelo sistema, com base na periodicidade cadastrada do condomínio.',
    });
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StatusManutencao, PerfilUsuario } from '@prisma/client';

export type StatusCondominio = 'CONCLUIDO' | 'PENDENTE' | 'ATRASADO';

const DIAS_RECENTE_PARA_CONCLUIDO = 30;

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async obterResumo(condominioId?: string) {
    const agora = new Date();
    // Filtro opcional por condomínio - usado pela tela de Relatórios do
    // app mobile ("filtrar por local de atendimento"). Quando ausente,
    // o comportamento é idêntico ao de antes (visão de todos os
    // condomínios) - compatível com quem já usa esse endpoint sem esse
    // parâmetro (painel web).
    const filtroCondominio = condominioId ? { condominioId } : {};

    const [condominios, ultimasManutencoesPorCondominio, tecnicos, osPorStatusBruto] =
      await Promise.all([
        this.prisma.condominio.findMany({
          where: { deletedAt: null },
          select: {
            id: true,
            nome: true,
            bairro: true,
            periodicidade: true,
            _count: { select: { equipamentos: { where: { deletedAt: null } } } },
          },
          orderBy: { nome: 'asc' },
        }),

        // Data da manutenção CONCLUIDA mais recente, por condomínio - usado
        // para calcular o status (concluído/pendente/atrasado) sem precisar
        // gravar isso como campo no banco.
        this.prisma.manutencao.groupBy({
          by: ['condominioId'],
          where: { status: StatusManutencao.CONCLUIDA, deletedAt: null },
          _max: { fim: true },
        }),

        this.prisma.usuario.findMany({
          where: { perfil: PerfilUsuario.TECNICO, ativo: true, deletedAt: null },
          select: { id: true, nome: true },
          orderBy: { nome: 'asc' },
        }),

        this.prisma.manutencao.groupBy({
          by: ['status'],
          where: { deletedAt: null, ...filtroCondominio },
          _count: true,
        }),
      ]);

    const ultimaManutencaoPorCondominio = new Map(
      ultimasManutencoesPorCondominio.map((registro) => [
        registro.condominioId,
        registro._max.fim,
      ]),
    );

    const condominiosComStatus = condominios.map((condominio) => {
      const ultimaManutencao = ultimaManutencaoPorCondominio.get(condominio.id) ?? null;
      const status = this.calcularStatusCondominio(
        ultimaManutencao,
        condominio.periodicidade,
        agora,
      );
      return {
        id: condominio.id,
        nome: condominio.nome,
        bairro: condominio.bairro,
        status,
        ultimaManutencao,
        numeroCameras: condominio._count.equipamentos,
      };
    });

    const condominiosPorStatus = {
      concluidos: condominiosComStatus.filter((c) => c.status === 'CONCLUIDO').length,
      pendentes: condominiosComStatus.filter((c) => c.status === 'PENDENTE').length,
      atrasados: condominiosComStatus.filter((c) => c.status === 'ATRASADO').length,
    };

    // Reorganiza a contagem bruta por status (do enum StatusManutencao) na
    // taxonomia do dashboard: "abertas" é AGENDADA que ainda não venceu,
    // "atrasadas" é AGENDADA que já passou da data - mesmo enum, leitura
    // diferente dependendo da data. Chamado avulso (app mobile, inicio =
    // "agora" no momento da criação) ganha 48h de tolerância antes de
    // virar atrasado - sem isso, viraria atrasado segundos depois de
    // criado, já que "agora" sempre já é passado no instante seguinte.
    const limiteAvulso = new Date(agora.getTime() - 48 * 60 * 60 * 1000);

    const [abertas, atrasadas] = await Promise.all([
      this.prisma.manutencao.count({
        where: {
          deletedAt: null,
          status: StatusManutencao.AGENDADA,
          ...filtroCondominio,
          OR: [
            { chamadoAvulso: false, inicio: { gte: agora } },
            { chamadoAvulso: true, inicio: { gte: limiteAvulso } },
          ],
        },
      }),
      this.prisma.manutencao.count({
        where: {
          deletedAt: null,
          status: StatusManutencao.AGENDADA,
          ...filtroCondominio,
          OR: [
            { chamadoAvulso: false, inicio: { lt: agora } },
            { chamadoAvulso: true, inicio: { lt: limiteAvulso } },
          ],
        },
      }),
    ]);

    const emAndamento =
      osPorStatusBruto.find((r) => r.status === StatusManutencao.EM_ANDAMENTO)?._count ?? 0;
    const concluidas =
      osPorStatusBruto.find((r) => r.status === StatusManutencao.CONCLUIDA)?._count ?? 0;

    const ordensServico = {
      abertas,
      emAndamento,
      atrasadas,
      concluidas,
      total: abertas + emAndamento + atrasadas + concluidas,
    };

    // Antes, isso fazia 2 consultas POR técnico (um findFirst + um count) -
    // com N técnicos, N+1 consultas a cada carregamento do dashboard. Agora
    // são só 2 consultas no total, buscando tudo de uma vez e agrupando em
    // memória por tecnicoId.
    const idsTecnicos = tecnicos.map((t) => t.id);

    const [manutencoesEmAndamento, osAbertasPorTecnico] = await Promise.all([
      this.prisma.manutencao.findMany({
        where: {
          tecnicoId: { in: idsTecnicos },
          status: StatusManutencao.EM_ANDAMENTO,
          deletedAt: null,
        },
        include: { condominio: { select: { nome: true } } },
      }),
      this.prisma.manutencao.groupBy({
        by: ['tecnicoId'],
        where: {
          tecnicoId: { in: idsTecnicos },
          status: { in: [StatusManutencao.AGENDADA, StatusManutencao.EM_ANDAMENTO] },
          deletedAt: null,
        },
        _count: true,
      }),
    ]);

    const emAndamentoPorTecnico = new Map(
      manutencoesEmAndamento.map((m) => [m.tecnicoId, m]),
    );
    const osAbertasMap = new Map(osAbertasPorTecnico.map((r) => [r.tecnicoId, r._count]));

    // Para cada técnico: está "em campo" se tiver uma manutenção
    // EM_ANDAMENTO no momento; e quantas OS em aberto (agendada ou em
    // andamento) estão sob responsabilidade dele.
    const tecnicosComStatus = tecnicos.map((tecnico) => {
      const manutencaoEmAndamento = emAndamentoPorTecnico.get(tecnico.id) ?? null;
      return {
        id: tecnico.id,
        nome: tecnico.nome,
        status: manutencaoEmAndamento ? ('EM_CAMPO' as const) : ('DISPONIVEL' as const),
        condominioAtual: manutencaoEmAndamento?.condominio.nome ?? null,
        osAbertas: osAbertasMap.get(tecnico.id) ?? 0,
      };
    });

    return {
      condominios: {
        total: condominios.length,
        ...condominiosPorStatus,
        lista: condominiosComStatus,
      },
      ordensServico,
      tecnicos: {
        emCampo: tecnicosComStatus.filter((t) => t.status === 'EM_CAMPO').length,
        disponivel: tecnicosComStatus.filter((t) => t.status === 'DISPONIVEL').length,
        lista: tecnicosComStatus,
      },
    };
  }

  private calcularStatusCondominio(
    ultimaManutencao: Date | null,
    periodicidadeDias: number,
    agora: Date,
  ): StatusCondominio {
    if (!ultimaManutencao) {
      // Nunca teve manutenção concluída registrada - tratado como pendente,
      // não atrasado, já que não temos uma data de referência para saber
      // se já "venceu" algum prazo.
      return 'PENDENTE';
    }

    const proximaManutencao = new Date(ultimaManutencao);
    proximaManutencao.setDate(proximaManutencao.getDate() + periodicidadeDias);

    if (proximaManutencao.getTime() < agora.getTime()) {
      return 'ATRASADO';
    }

    const diasDesdeUltima =
      (agora.getTime() - ultimaManutencao.getTime()) / (1000 * 60 * 60 * 24);

    if (diasDesdeUltima <= DIAS_RECENTE_PARA_CONCLUIDO) {
      return 'CONCLUIDO';
    }

    return 'PENDENTE';
  }
}

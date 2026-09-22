import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PerfilUsuario, StatusManutencao } from '@prisma/client';

@Injectable()
export class RelatoriosService {
  constructor(private prisma: PrismaService) {}

  // "OS por técnico" - total de manutenções atribuídas a cada técnico e
  // quantas dessas já foram concluídas. Não existia nenhum endpoint pra
  // isso antes da Fase J - o Dashboard só tinha "OS abertas por técnico"
  // (usado no painel de técnicos), não o histórico completo.
  async osPorTecnico(condominioId?: string) {
    const filtroCondominio = condominioId ? { condominioId } : {};

    const tecnicos = await this.prisma.usuario.findMany({
      where: { perfil: PerfilUsuario.TECNICO, ativo: true, deletedAt: null },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    });

    const resultado = await Promise.all(
      tecnicos.map(async (tecnico) => {
        const [total, concluidas] = await Promise.all([
          this.prisma.manutencao.count({
            where: { tecnicoId: tecnico.id, deletedAt: null, ...filtroCondominio },
          }),
          this.prisma.manutencao.count({
            where: {
              tecnicoId: tecnico.id,
              deletedAt: null,
              status: StatusManutencao.CONCLUIDA,
              ...filtroCondominio,
            },
          }),
        ]);
        return { tecnicoId: tecnico.id, tecnicoNome: tecnico.nome, total, concluidas };
      }),
    );

    // Só entra no gráfico quem já teve pelo menos 1 OS atribuída -
    // técnico recém-cadastrado sem nenhuma OS ainda não polui o relatório.
    return resultado.filter((r) => r.total > 0);
  }
}

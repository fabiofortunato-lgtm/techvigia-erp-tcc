import { Injectable, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PerfilUsuario, StatusManutencao } from '@prisma/client';
import { LogAuditoriaService } from './log-auditoria.service';

export interface UsuarioAutenticado {
  userId: string;
  perfil: string;
}

/**
 * Confere se o usuário autenticado pode operar sobre uma manutenção (OS)
 * específica. ADMIN e GESTOR sempre podem - são quem administra a operação
 * como um todo. TECNICO só pode se for o técnico responsável por essa OS.
 *
 * Usado em todo lugar que recebe um :manutencaoId na rota (o controller de
 * manutenções em si, e os controllers filhos de checklist/fotos/peças) -
 * antes desta correção, nenhum desses pontos verificava de quem era a OS,
 * então qualquer técnico autenticado conseguia ler, editar e fechar OS de
 * qualquer condomínio, não só as suas.
 */
@Injectable()
export class AcessoManutencaoService {
  constructor(
    private prisma: PrismaService,
    private logAuditoria: LogAuditoriaService,
  ) {}

  async verificarAcesso(manutencaoId: string, usuario: UsuarioAutenticado): Promise<void> {
    const manutencao = await this.prisma.manutencao.findFirst({
      where: { id: manutencaoId, deletedAt: null },
      select: { tecnicoId: true },
    });

    if (!manutencao) {
      throw new NotFoundException('Manutenção não encontrada');
    }

    if (usuario.perfil === PerfilUsuario.TECNICO && manutencao.tecnicoId !== usuario.userId) {
      throw new ForbiddenException('Você não tem acesso a esta ordem de serviço');
    }
  }

  // Depois que a assinatura é coletada, a OS fica congelada - nenhuma
  // edição é mais permitida (checklist, fotos, peças, observação, nem uma
  // nova assinatura por cima da existente). Antes desta correção, o
  // documento perdia todo valor probatório: qualquer usuário autenticado
  // conseguia sobrescrever a assinatura de outra pessoa, ou editar a OS
  // depois de o síndico já ter recebido o PDF - fazendo o PDF em mãos dele
  // divergir do banco, sem nenhum jeito de provar qual era o original.
  async verificarNaoTravada(
    manutencaoId: string,
    usuario: UsuarioAutenticado,
    acaoTentada: string,
  ): Promise<void> {
    const manutencao = await this.prisma.manutencao.findFirst({
      where: { id: manutencaoId, deletedAt: null },
      select: { assinadoEm: true, status: true },
    });

    if (!manutencao) {
      throw new NotFoundException('Manutenção não encontrada');
    }

    if (manutencao.assinadoEm || manutencao.status === StatusManutencao.CONCLUIDA) {
      await this.logAuditoria.registrar({
        manutencaoId,
        usuarioId: usuario.userId,
        acao: 'EDICAO_BLOQUEADA_OS_ASSINADA',
        detalhes: `Tentativa de: ${acaoTentada}`,
      });
      throw new ConflictException(
        'Esta OS já foi assinada e está travada para edição. Nenhuma alteração é permitida depois da assinatura coletada.',
      );
    }
  }
}

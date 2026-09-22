import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EstoqueService } from '../estoque/estoque.service';
import { CreatePecaDto } from './dto/peca.dto';
import { TipoMovimentacaoEstoque } from '@prisma/client';

@Injectable()
export class PecasService {
  constructor(
    private prisma: PrismaService,
    private estoqueService: EstoqueService,
  ) {}

  async create(manutencaoId: string, dto: CreatePecaDto, usuarioId?: string) {
    const manutencao = await this.prisma.manutencao.findFirst({
      where: { id: manutencaoId, deletedAt: null },
    });
    if (!manutencao) {
      throw new NotFoundException('Manutenção não encontrada');
    }

    const quantidade = dto.quantidade ?? 1;

    // Baixa de estoque (se houver) e criação do registro de peça acontecem
    // na MESMA transação agora - ou as duas coisas acontecem, ou nenhuma.
    // Antes eram dois commits separados: se a criação da peça falhasse
    // depois da baixa já ter sido feita (ex: equipamentoId de um UUID
    // bem-formado mas inexistente, estourando a foreign key), o estoque
    // ficava debitado sem nenhum registro correspondente em nenhuma OS -
    // perda silenciosa que só aparecia semanas depois, na conferência.
    return this.prisma.$transaction(async (tx) => {
      if (dto.itemEstoqueId) {
        await this.estoqueService.movimentarTx(
          tx,
          dto.itemEstoqueId,
          {
            tipo: TipoMovimentacaoEstoque.SAIDA,
            quantidade,
            motivo: `Uso na OS ${manutencao.numeroOS}`,
          },
          usuarioId,
        );
      }

      const pecaCriada = await tx.peca.create({
        data: {
          manutencaoId,
          equipamentoId: dto.equipamentoId,
          itemEstoqueId: dto.itemEstoqueId,
          nome: dto.nome,
          quantidade,
          motivoTroca: dto.motivoTroca,
          custoUnitario: dto.custoUnitario,
          fornecedor: dto.fornecedor,
        },
      });

      // Peça vinculada a um equipamento, com motivo de troca preenchido -
      // isso é o técnico registrando uma troca de verdade (ex: bateria do
      // nobreak), não uma peça avulsa qualquer. Atualiza a data da última
      // troca do próprio equipamento automaticamente, fechando o ciclo do
      // controle de troca (Equipamentos.intervaloTrocaMeses) sem precisar
      // de ninguém digitando essa data manualmente no painel depois.
      if (dto.equipamentoId && dto.motivoTroca) {
        await tx.equipamento.update({
          where: { id: dto.equipamentoId },
          data: { dataUltimaTroca: new Date() },
        });
      }

      return pecaCriada;
    });
  }

  async findByManutencao(manutencaoId: string) {
    return this.prisma.peca.findMany({
      where: { manutencaoId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Histórico global - usado pela tela de "Peças" do painel web
  async findAll() {
    return this.prisma.peca.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        manutencao: {
          select: {
            numeroOS: true,
            condominio: { select: { id: true, nome: true } },
            tecnico: { select: { nome: true } },
          },
        },
        equipamento: { select: { tipo: true, local: true } },
      },
    });
  }
}

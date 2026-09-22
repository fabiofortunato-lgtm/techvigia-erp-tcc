import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateItemEstoqueDto,
  UpdateItemEstoqueDto,
  MovimentarEstoqueDto,
} from './dto/estoque.dto';
import { TipoMovimentacaoEstoque, Prisma } from '@prisma/client';

@Injectable()
export class EstoqueService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateItemEstoqueDto) {
    return this.prisma.itemEstoque.create({
      data: {
        nome: dto.nome,
        unidade: dto.unidade ?? 'un',
        quantidade: dto.quantidade ?? 0,
        quantidadeMinima: dto.quantidadeMinima ?? 0,
        custoUnitario: dto.custoUnitario,
        fornecedor: dto.fornecedor,
      },
    });
  }

  async findAll() {
    return this.prisma.itemEstoque.findMany({
      where: { deletedAt: null },
      orderBy: { nome: 'asc' },
    });
  }

  // Itens abaixo da quantidade mínima - alerta de reposição
  async findAbaixoDoMinimo() {
    const itens = await this.prisma.itemEstoque.findMany({
      where: { deletedAt: null },
    });
    return itens.filter((item) => item.quantidade <= item.quantidadeMinima);
  }

  async findOne(id: string) {
    const item = await this.prisma.itemEstoque.findFirst({
      where: { id, deletedAt: null },
      include: {
        movimentacoes: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });

    if (!item) {
      throw new NotFoundException('Item de estoque não encontrado');
    }

    return item;
  }

  async update(id: string, dto: UpdateItemEstoqueDto) {
    await this.findOne(id);

    return this.prisma.itemEstoque.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.itemEstoque.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // Toda entrada/saída de estoque passa por aqui - nunca se decrementa
  // a quantidade diretamente, para manter histórico auditável completo.
  async movimentar(id: string, dto: MovimentarEstoqueDto, usuarioId?: string) {
    return this.prisma.$transaction((tx) => this.movimentarTx(tx, id, dto, usuarioId));
  }

  // Mesma lógica de movimentar(), mas recebe um client de transação já
  // aberto por quem chama (ex: PecasService, que precisa garantir que a
  // baixa de estoque e o registro da peça aconteçam atomicamente - ou as
  // duas coisas, ou nenhuma). Fica em método próprio para não duplicar a
  // lógica entre os dois pontos de entrada.
  async movimentarTx(
    tx: Prisma.TransactionClient,
    id: string,
    dto: MovimentarEstoqueDto,
    usuarioId?: string,
  ) {
    const incremento =
      dto.tipo === TipoMovimentacaoEstoque.ENTRADA ? dto.quantidade : -dto.quantidade;

    // Decremento atômico direto no banco (increment/decrement do Prisma
    // vira "quantidade = quantidade - $1" em SQL, não "leia depois escreva
    // um valor absoluto"). A condição quantidade >= X na SAÍDA garante que
    // o próprio Postgres rejeita a operação se não houver saldo - o
    // travamento de linha implícito do UPDATE serializa automaticamente
    // duas atualizações concorrentes na mesma linha, então não existe mais
    // a janela em que dois técnicos leem o mesmo saldo "5" e os dois
    // debitam a partir dele.
    const resultado = await tx.itemEstoque.updateMany({
      where: {
        id,
        deletedAt: null,
        ...(dto.tipo === TipoMovimentacaoEstoque.SAIDA
          ? { quantidade: { gte: dto.quantidade } }
          : {}),
      },
      data: { quantidade: { increment: incremento } },
    });

    if (resultado.count === 0) {
      // updateMany não informa POR QUE não afetou nenhuma linha - pode ser
      // "item não existe" ou "saldo insuficiente". Uma segunda consulta
      // (fora do caminho de sucesso, então não custa performance no caso
      // comum) decide qual mensagem de erro mostrar.
      const item = await tx.itemEstoque.findFirst({ where: { id, deletedAt: null } });
      if (!item) {
        throw new NotFoundException('Item de estoque não encontrado');
      }
      throw new BadRequestException(
        `Estoque insuficiente. Saldo atual: ${item.quantidade}, solicitado: ${dto.quantidade}`,
      );
    }

    return tx.movimentacaoEstoque.create({
      data: {
        itemEstoqueId: id,
        tipo: dto.tipo,
        quantidade: dto.quantidade,
        motivo: dto.motivo,
        usuarioId,
      },
    });
  }
}

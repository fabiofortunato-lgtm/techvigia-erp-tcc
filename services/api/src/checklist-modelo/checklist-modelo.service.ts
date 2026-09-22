import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateChecklistModeloDto,
  UpdateChecklistModeloDto,
  CreateChecklistModeloItemDto,
  UpdateChecklistModeloItemDto,
} from './dto/checklist-modelo.dto';

@Injectable()
export class ChecklistModeloService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.checklistModelo.findMany({
      include: { itens: { orderBy: { ordem: 'asc' } } },
      orderBy: { tipo: 'asc' },
    });
  }

  async findOne(id: string) {
    const modelo = await this.prisma.checklistModelo.findUnique({
      where: { id },
      include: { itens: { orderBy: { ordem: 'asc' } } },
    });
    if (!modelo) {
      throw new NotFoundException('Modelo de checklist não encontrado');
    }
    return modelo;
  }

  async create(dto: CreateChecklistModeloDto) {
    // Um modelo por Tipo - se já existe um pra esse tipo, a intenção
    // provavelmente é editar o existente, não criar um segundo.
    const existente = await this.prisma.checklistModelo.findUnique({
      where: { tipo: dto.tipo },
    });
    if (existente) {
      throw new ConflictException(
        `Já existe um modelo de checklist para o tipo ${dto.tipo} - edite o existente em vez de criar outro.`,
      );
    }

    return this.prisma.checklistModelo.create({
      data: dto,
      include: { itens: true },
    });
  }

  async update(id: string, dto: UpdateChecklistModeloDto) {
    await this.findOne(id);
    return this.prisma.checklistModelo.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    // onDelete: Cascade no schema cuida de apagar os itens junto.
    await this.prisma.checklistModelo.delete({ where: { id } });
    return { removido: true };
  }

  async addItem(checklistModeloId: string, dto: CreateChecklistModeloItemDto) {
    await this.findOne(checklistModeloId);

    let ordem = dto.ordem;
    if (ordem === undefined) {
      // Sem ordem informada, entra no final da lista.
      const ultimo = await this.prisma.checklistModeloItem.findFirst({
        where: { checklistModeloId },
        orderBy: { ordem: 'desc' },
      });
      ordem = (ultimo?.ordem ?? -1) + 1;
    }

    return this.prisma.checklistModeloItem.create({
      data: { checklistModeloId, item: dto.item, ordem },
    });
  }

  async updateItem(itemId: string, dto: UpdateChecklistModeloItemDto) {
    const item = await this.prisma.checklistModeloItem.findUnique({ where: { id: itemId } });
    if (!item) {
      throw new NotFoundException('Item de checklist não encontrado');
    }
    return this.prisma.checklistModeloItem.update({ where: { id: itemId }, data: dto });
  }

  async removeItem(itemId: string) {
    const item = await this.prisma.checklistModeloItem.findUnique({ where: { id: itemId } });
    if (!item) {
      throw new NotFoundException('Item de checklist não encontrado');
    }
    await this.prisma.checklistModeloItem.delete({ where: { id: itemId } });
    return { removido: true };
  }
}

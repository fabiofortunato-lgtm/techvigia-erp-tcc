import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateChecklistItemDto } from './dto/checklist.dto';

@Injectable()
export class ChecklistService {
  constructor(private prisma: PrismaService) {}

  async addItem(manutencaoId: string, dto: CreateChecklistItemDto) {
    const manutencao = await this.prisma.manutencao.findFirst({
      where: { id: manutencaoId, deletedAt: null },
    });
    if (!manutencao) {
      throw new NotFoundException('Manutenção não encontrada');
    }

    return this.prisma.checklistItem.create({
      data: { manutencaoId, ...dto },
    });
  }

  async listarPorManutencao(manutencaoId: string) {
    return this.prisma.checklistItem.findMany({
      where: { manutencaoId },
      orderBy: { createdAt: 'asc' },
    });
  }
}

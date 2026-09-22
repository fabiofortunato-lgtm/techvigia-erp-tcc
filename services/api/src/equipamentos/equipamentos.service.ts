import { Injectable, NotFoundException } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_SERVICE, StorageService } from '../storage/storage.interface';
import {
  CreateEquipamentoDto,
  UpdateEquipamentoDto,
} from './dto/equipamento.dto';

@Injectable()
export class EquipamentosService {
  constructor(
    private prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private storageService: StorageService,
  ) {}

  async create(dto: CreateEquipamentoDto) {
    const condominio = await this.prisma.condominio.findFirst({
      where: { id: dto.condominioId, deletedAt: null },
    });
    if (!condominio) {
      throw new NotFoundException('Condomínio informado não existe');
    }

    return this.prisma.equipamento.create({
      data: {
        ...dto,
        dataInstalacao: new Date(dto.dataInstalacao),
        garantiaAte: dto.garantiaAte ? new Date(dto.garantiaAte) : null,
        dataUltimaTroca: dto.dataUltimaTroca ? new Date(dto.dataUltimaTroca) : null,
      },
    });
  }

  async findAllByCondominio(condominioId: string) {
    return this.prisma.equipamento.findMany({
      where: { condominioId, deletedAt: null },
      orderBy: { tipo: 'asc' },
    });
  }

  // Lista geral, de qualquer condomínio - usado no filtro de Ordens de
  // Serviço por equipamento e na tela dedicada de Equipamentos (que
  // precisa do nome do condomínio e dos campos de controle de troca pra
  // calcular "próxima troca" - diferente de findAllByCondominio, que serve
  // a tela de cadastro, já escopada em um condomínio só, e não precisa
  // repetir o nome do próprio condomínio em cada linha).
  async findAll() {
    return this.prisma.equipamento.findMany({
      where: { deletedAt: null },
      include: { condominio: { select: { id: true, nome: true } } },
      orderBy: { tipo: 'asc' },
    });
  }

  async findOne(id: string) {
    const equipamento = await this.prisma.equipamento.findFirst({
      where: { id, deletedAt: null },
      include: {
        // histórico de peças trocadas neste equipamento -
        // é o dado bruto que futuramente alimenta a IA preditiva
        pecas: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!equipamento) {
      throw new NotFoundException('Equipamento não encontrado');
    }

    return equipamento;
  }

  async update(id: string, dto: UpdateEquipamentoDto) {
    await this.findOne(id);

    return this.prisma.equipamento.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.dataInstalacao && {
          dataInstalacao: new Date(dto.dataInstalacao),
        }),
        ...(dto.garantiaAte && { garantiaAte: new Date(dto.garantiaAte) }),
        ...(dto.dataUltimaTroca && { dataUltimaTroca: new Date(dto.dataUltimaTroca) }),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.equipamento.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async uploadFoto(id: string, arquivo: Express.Multer.File) {
    await this.findOne(id);

    const fotoUrl = await this.storageService.salvar(
      arquivo.buffer,
      arquivo.originalname,
      'equipamentos',
    );

    return this.prisma.equipamento.update({
      where: { id },
      data: { fotoUrl },
    });
  }

  /**
   * Conta quantas vezes um equipamento teve peça trocada.
   * Regra simples hoje; é o gancho para o alerta de "troca recomendada"
   * mencionado no roadmap (ex: DVR com 6+ trocas -> sugerir substituição).
   */
  async contarTrocasPecas(equipamentoId: string) {
    return this.prisma.peca.count({ where: { equipamentoId } });
  }
}

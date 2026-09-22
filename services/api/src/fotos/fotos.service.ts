import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_SERVICE, StorageService } from '../storage/storage.interface';
import { TipoFoto } from '@prisma/client';

@Injectable()
export class FotosService {
  constructor(
    private prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private storageService: StorageService,
  ) {}

  async upload(
    manutencaoId: string,
    tipo: TipoFoto,
    arquivo: Express.Multer.File,
  ) {
    const manutencao = await this.prisma.manutencao.findFirst({
      where: { id: manutencaoId, deletedAt: null },
    });
    if (!manutencao) {
      throw new NotFoundException('Manutenção não encontrada');
    }

    const arquivoUrl = await this.storageService.salvar(
      arquivo.buffer,
      arquivo.originalname,
      'fotos',
    );

    return this.prisma.foto.create({
      data: { manutencaoId, arquivoUrl, tipo },
    });
  }

  async listarPorManutencao(manutencaoId: string) {
    return this.prisma.foto.findMany({
      where: { manutencaoId },
      orderBy: { createdAt: 'asc' },
    });
  }
}

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCondominioDto, UpdateCondominioDto } from './dto/condominio.dto';

@Injectable()
export class CondominiosService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateCondominioDto) {
    // Nem todo cliente é pessoa jurídica - precisa de exatamente um dos
    // dois documentos (nunca os dois, nunca nenhum). Prisma não expressa
    // essa regra no schema (os dois campos são opcionais lá), então a
    // validação fica aqui.
    if (!!dto.cnpj === !!dto.cpf) {
      throw new BadRequestException(
        dto.cnpj || dto.cpf
          ? 'Informe apenas um documento: CNPJ ou CPF, não os dois.'
          : 'Informe o CNPJ (pessoa jurídica) ou o CPF (pessoa física).',
      );
    }

    // A essa altura, a validação acima já garante que exatamente um dos
    // dois está presente - o "!" abaixo é seguro (não é uma suposição,
    // é a consequência direta do throw logo acima).
    const documentoFiltro = dto.cnpj ? { cnpj: dto.cnpj } : { cpf: dto.cpf! };
    const existente = await this.prisma.condominio.findFirst({ where: documentoFiltro });
    if (existente) {
      throw new ConflictException(
        `Já existe um condomínio com esse ${dto.cnpj ? 'CNPJ' : 'CPF'}`,
      );
    }

    return this.prisma.condominio.create({ data: dto });
  }

  async findAll() {
    // Soft delete: nunca retornar registros marcados como deletedAt
    return this.prisma.condominio.findMany({
      where: { deletedAt: null },
      include: {
        _count: { select: { equipamentos: { where: { deletedAt: null } } } },
      },
      orderBy: { nome: 'asc' },
    });
  }

  async findOne(id: string) {
    const condominio = await this.prisma.condominio.findFirst({
      where: { id, deletedAt: null },
      include: {
        equipamentos: { where: { deletedAt: null } },
        tecnicos: { include: { tecnico: { select: { id: true, nome: true, email: true } } } },
      },
    });

    if (!condominio) {
      throw new NotFoundException('Condomínio não encontrado');
    }

    return condominio;
  }

  async update(id: string, dto: UpdateCondominioDto) {
    await this.findOne(id); // garante que existe e não está deletado

    return this.prisma.condominio.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    // Soft delete - nunca apagar fisicamente (histórico de manutenções depende disso)
    return this.prisma.condominio.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async vincularTecnico(condominioId: string, tecnicoId: string, responsavelPrincipal = false) {
    await this.findOne(condominioId);

    return this.prisma.tecnicoCondominio.upsert({
      where: {
        tecnicoId_condominioId: { tecnicoId, condominioId },
      },
      update: { responsavelPrincipal },
      create: { tecnicoId, condominioId, responsavelPrincipal },
    });
  }
}

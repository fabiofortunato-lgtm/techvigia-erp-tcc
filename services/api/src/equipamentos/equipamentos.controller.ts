import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { EquipamentosService } from './equipamentos.service';
import {
  CreateEquipamentoDto,
  UpdateEquipamentoDto,
} from './dto/equipamento.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PerfilUsuario } from '@prisma/client';

const LIMITE_TAMANHO_FOTO = 10 * 1024 * 1024; // 10MB - fotos de celular modernas costumam passar de 5MB

@Controller('equipamentos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EquipamentosController {
  constructor(private equipamentosService: EquipamentosService) {}

  @Post()
  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.GESTOR)
  create(@Body() dto: CreateEquipamentoDto) {
    return this.equipamentosService.create(dto);
  }

  @Get()
  findAll() {
    return this.equipamentosService.findAll();
  }

  @Get('condominio/:condominioId')
  findAllByCondominio(@Param('condominioId') condominioId: string) {
    return this.equipamentosService.findAllByCondominio(condominioId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.equipamentosService.findOne(id);
  }

  @Put(':id')
  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.GESTOR)
  update(@Param('id') id: string, @Body() dto: UpdateEquipamentoDto) {
    return this.equipamentosService.update(id, dto);
  }

  @Post(':id/foto')
  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.GESTOR)
  @UseInterceptors(
    FileInterceptor('arquivo', {
      limits: { fileSize: LIMITE_TAMANHO_FOTO },
      fileFilter: (_req, file, callback) => {
        if (!file.mimetype.startsWith('image/')) {
          callback(new BadRequestException('Apenas arquivos de imagem são aceitos'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  uploadFoto(@Param('id') id: string, @UploadedFile() arquivo: Express.Multer.File) {
    if (!arquivo) {
      throw new BadRequestException('Nenhum arquivo enviado (campo esperado: "arquivo")');
    }
    return this.equipamentosService.uploadFoto(id, arquivo);
  }

  @Delete(':id')
  @Roles(PerfilUsuario.ADMIN)
  remove(@Param('id') id: string) {
    return this.equipamentosService.remove(id);
  }
}

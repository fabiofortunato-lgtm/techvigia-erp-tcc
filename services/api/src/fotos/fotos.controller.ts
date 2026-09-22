import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Req,
  UseGuards,
  UseInterceptors,
  UseFilters,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { FotosService } from './fotos.service';
import { UploadFotoDto } from './dto/foto.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AcessoManutencaoService } from '../common/acesso-manutencao.service';
import { MulterExceptionFilter } from './multer-exception.filter';

interface RequestComUsuario extends Request {
  user?: { userId: string; email: string; perfil: string };
}

const LIMITE_TAMANHO_FOTO = 10 * 1024 * 1024; // 10MB - fotos de celular modernas costumam passar de 5MB

@Controller('manutencoes/:manutencaoId/fotos')
@UseGuards(JwtAuthGuard)
@UseFilters(MulterExceptionFilter)
// Sem RBAC de perfil aqui de propósito: é o técnico em campo quem
// tira e envia as fotos ANTES/DEPOIS pelo app mobile - mas só na OS que é
// dele (ver AcessoManutencaoService).
export class FotosController {
  constructor(
    private fotosService: FotosService,
    private acesso: AcessoManutencaoService,
  ) {}

  @Post()
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
  async upload(
    @Param('manutencaoId') manutencaoId: string,
    @Body() dto: UploadFotoDto,
    @UploadedFile() arquivo: Express.Multer.File,
    @Req() req: RequestComUsuario,
  ) {
    if (!arquivo) {
      throw new BadRequestException('Nenhum arquivo enviado (campo esperado: "arquivo")');
    }

    await this.acesso.verificarAcesso(manutencaoId, req.user!);
    await this.acesso.verificarNaoTravada(manutencaoId, req.user!, 'enviar foto');
    return this.fotosService.upload(manutencaoId, dto.tipo, arquivo);
  }

  @Get()
  async listar(@Param('manutencaoId') manutencaoId: string, @Req() req: RequestComUsuario) {
    await this.acesso.verificarAcesso(manutencaoId, req.user!);
    return this.fotosService.listarPorManutencao(manutencaoId);
  }
}

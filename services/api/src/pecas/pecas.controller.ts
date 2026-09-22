import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { PecasService } from './pecas.service';
import { CreatePecaDto } from './dto/peca.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AcessoManutencaoService } from '../common/acesso-manutencao.service';

interface RequestComUsuario extends Request {
  user?: { userId: string; email: string; perfil: string };
}

@Controller('manutencoes/:manutencaoId/pecas')
@UseGuards(JwtAuthGuard)
// Sem RBAC de perfil aqui de propósito: é o técnico em campo quem
// registra a peça trocada, no mesmo fluxo de fechamento da OS - mas só na
// OS que é dele (ver AcessoManutencaoService).
export class ManutencaoPecasController {
  constructor(
    private pecasService: PecasService,
    private acesso: AcessoManutencaoService,
  ) {}

  @Post()
  async create(
    @Param('manutencaoId') manutencaoId: string,
    @Body() dto: CreatePecaDto,
    @Req() req: RequestComUsuario,
  ) {
    await this.acesso.verificarAcesso(manutencaoId, req.user!);
    await this.acesso.verificarNaoTravada(manutencaoId, req.user!, 'registrar peça');
    return this.pecasService.create(manutencaoId, dto, req.user?.userId);
  }

  @Get()
  async listar(@Param('manutencaoId') manutencaoId: string, @Req() req: RequestComUsuario) {
    await this.acesso.verificarAcesso(manutencaoId, req.user!);
    return this.pecasService.findByManutencao(manutencaoId);
  }
}

@Controller('pecas')
@UseGuards(JwtAuthGuard)
export class PecasController {
  constructor(private pecasService: PecasService) {}

  @Get()
  findAll() {
    return this.pecasService.findAll();
  }
}

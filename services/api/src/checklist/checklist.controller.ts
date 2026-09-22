import { Controller, Get, Post, Body, Param, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ChecklistService } from './checklist.service';
import { CreateChecklistItemDto } from './dto/checklist.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AcessoManutencaoService } from '../common/acesso-manutencao.service';

interface RequestComUsuario extends Request {
  user?: { userId: string; email: string; perfil: string };
}

@Controller('manutencoes/:manutencaoId/checklist')
@UseGuards(JwtAuthGuard)
// Sem RolesGuard/@Roles aqui de propósito: é o técnico em campo quem
// preenche o checklist pelo app mobile, então qualquer perfil autenticado
// pode - mas só na OS que é dele (ver AcessoManutencaoService).
export class ChecklistController {
  constructor(
    private checklistService: ChecklistService,
    private acesso: AcessoManutencaoService,
  ) {}

  @Post()
  async addItem(
    @Param('manutencaoId') manutencaoId: string,
    @Body() dto: CreateChecklistItemDto,
    @Req() req: RequestComUsuario,
  ) {
    await this.acesso.verificarAcesso(manutencaoId, req.user!);
    await this.acesso.verificarNaoTravada(manutencaoId, req.user!, 'adicionar item de checklist');
    return this.checklistService.addItem(manutencaoId, dto);
  }

  @Get()
  async listar(@Param('manutencaoId') manutencaoId: string, @Req() req: RequestComUsuario) {
    await this.acesso.verificarAcesso(manutencaoId, req.user!);
    return this.checklistService.listarPorManutencao(manutencaoId);
  }
}

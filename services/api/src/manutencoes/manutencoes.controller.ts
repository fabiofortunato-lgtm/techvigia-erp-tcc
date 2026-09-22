import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { ManutencoesService } from './manutencoes.service';
import { AcessoManutencaoService } from '../common/acesso-manutencao.service';
import {
  CreateManutencaoDto,
  UpdateManutencaoDto,
  CheckinManutencaoDto,
  FiltroAgendaDto,
  AssinaturaDto,
  ObservacaoDto,
} from './dto/manutencao.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PerfilUsuario } from '@prisma/client';

interface RequestComUsuario extends Request {
  user?: { userId: string; email: string; perfil: string };
}

@Controller('manutencoes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ManutencoesController {
  constructor(
    private manutencoesService: ManutencoesService,
    private acesso: AcessoManutencaoService,
  ) {}

  @Post()
  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.GESTOR)
  create(@Body() dto: CreateManutencaoDto) {
    return this.manutencoesService.create(dto);
  }

  @Get()
  // Agenda/calendário. Um TECNICO só vê as próprias OS, mesmo que tente
  // passar ?tecnicoId= de outra pessoa na query - o filtro da própria
  // identidade sempre prevalece pra esse perfil. ADMIN/GESTOR continuam
  // vendo tudo (ou filtrando por um tecnicoId específico, se quiserem).
  findAll(@Query() filtro: FiltroAgendaDto, @Req() req: RequestComUsuario) {
    const filtroComEscopo: FiltroAgendaDto =
      req.user?.perfil === PerfilUsuario.TECNICO
        ? { ...filtro, tecnicoId: req.user.userId }
        : filtro;
    return this.manutencoesService.findAll(filtroComEscopo);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: RequestComUsuario) {
    await this.acesso.verificarAcesso(id, req.user!);
    return this.manutencoesService.findOne(id);
  }

  @Put(':id')
  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.GESTOR)
  update(@Param('id') id: string, @Body() dto: UpdateManutencaoDto) {
    return this.manutencoesService.update(id, dto);
  }

  @Patch(':id/observacao')
  // Sem @Roles - o técnico preenche a observação ao fechar a OS pelo app.
  // Rota separada do PUT completo (que fica restrito a ADMIN/GESTOR, já
  // que ele permite trocar técnico, status, datas etc.) - mas precisa do
  // mesmo escopo: só o técnico DAQUELA OS (ou ADMIN/GESTOR) pode editar.
  async atualizarObservacao(
    @Param('id') id: string,
    @Body() dto: ObservacaoDto,
    @Req() req: RequestComUsuario,
  ) {
    await this.acesso.verificarAcesso(id, req.user!);
    await this.acesso.verificarNaoTravada(id, req.user!, 'editar observação');
    return this.manutencoesService.atualizarObservacao(id, dto);
  }

  @Post(':id/checkin')
  // Sem @Roles - o próprio técnico faz o check-in pelo app mobile, mas só
  // na própria OS.
  async checkin(
    @Param('id') id: string,
    @Body() dto: CheckinManutencaoDto,
    @Req() req: RequestComUsuario,
  ) {
    await this.acesso.verificarAcesso(id, req.user!);
    return this.manutencoesService.checkin(id, dto);
  }

  @Post(':id/assinatura')
  // Sem @Roles - o técnico coleta a assinatura do síndico/zelador em
  // campo, mas só na própria OS. Uma vez assinada, não pode ser
  // sobrescrita - ver verificarNaoTravada.
  async uploadAssinatura(
    @Param('id') id: string,
    @Body() dto: AssinaturaDto,
    @Req() req: RequestComUsuario,
  ) {
    await this.acesso.verificarAcesso(id, req.user!);
    await this.acesso.verificarNaoTravada(id, req.user!, 'sobrescrever assinatura');
    return this.manutencoesService.uploadAssinatura(id, dto, req.user!.userId);
  }

  @Post(':id/gerar-pdf')
  // Sem @Roles - o técnico fecha a OS pelo app ao final da visita, mas só
  // a própria OS. Não usa verificarNaoTravada (é chamado logo DEPOIS da
  // assinatura, que já travou a OS de propósito) - o próprio service
  // impede gerar o PDF de novo se já foi gerado (idempotência).
  async gerarPdf(@Param('id') id: string, @Req() req: RequestComUsuario) {
    await this.acesso.verificarAcesso(id, req.user!);
    return this.manutencoesService.gerarPdf(id, req.user!.userId);
  }

  @Delete(':id')
  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.GESTOR)
  remove(@Param('id') id: string) {
    return this.manutencoesService.remove(id);
  }
}

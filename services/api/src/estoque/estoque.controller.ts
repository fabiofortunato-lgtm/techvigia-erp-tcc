import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { EstoqueService } from './estoque.service';
import {
  CreateItemEstoqueDto,
  UpdateItemEstoqueDto,
  MovimentarEstoqueDto,
} from './dto/estoque.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PerfilUsuario } from '@prisma/client';

interface RequestComUsuario extends Request {
  user?: { userId: string; email: string; perfil: string };
}

@Controller('estoque')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EstoqueController {
  constructor(private estoqueService: EstoqueService) {}

  @Post()
  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.GESTOR)
  create(@Body() dto: CreateItemEstoqueDto) {
    return this.estoqueService.create(dto);
  }

  @Get()
  findAll() {
    return this.estoqueService.findAll();
  }

  @Get('alertas/abaixo-do-minimo')
  findAbaixoDoMinimo() {
    return this.estoqueService.findAbaixoDoMinimo();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.estoqueService.findOne(id);
  }

  @Put(':id')
  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.GESTOR)
  update(@Param('id') id: string, @Body() dto: UpdateItemEstoqueDto) {
    return this.estoqueService.update(id, dto);
  }

  @Delete(':id')
  @Roles(PerfilUsuario.ADMIN)
  remove(@Param('id') id: string) {
    return this.estoqueService.remove(id);
  }

  @Post(':id/movimentacoes')
  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.GESTOR)
  movimentar(
    @Param('id') id: string,
    @Body() dto: MovimentarEstoqueDto,
    @Req() req: RequestComUsuario,
  ) {
    return this.estoqueService.movimentar(id, dto, req.user?.userId);
  }
}

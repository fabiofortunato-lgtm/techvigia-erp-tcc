import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ChecklistModeloService } from './checklist-modelo.service';
import {
  CreateChecklistModeloDto,
  UpdateChecklistModeloDto,
  CreateChecklistModeloItemDto,
  UpdateChecklistModeloItemDto,
} from './dto/checklist-modelo.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PerfilUsuario } from '@prisma/client';

@Controller('checklist-modelos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ChecklistModeloController {
  constructor(private service: ChecklistModeloService) {}

  // Sem @Roles nas duas rotas de leitura de propósito - o app mobile
  // também pode precisar consultar o modelo (ex: pra mostrar o que é
  // esperado), então qualquer usuário autenticado pode ver.
  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.GESTOR)
  create(@Body() dto: CreateChecklistModeloDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.GESTOR)
  update(@Param('id') id: string, @Body() dto: UpdateChecklistModeloDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles(PerfilUsuario.ADMIN)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post(':id/itens')
  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.GESTOR)
  addItem(@Param('id') id: string, @Body() dto: CreateChecklistModeloItemDto) {
    return this.service.addItem(id, dto);
  }

  @Put('itens/:itemId')
  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.GESTOR)
  updateItem(@Param('itemId') itemId: string, @Body() dto: UpdateChecklistModeloItemDto) {
    return this.service.updateItem(itemId, dto);
  }

  @Delete('itens/:itemId')
  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.GESTOR)
  removeItem(@Param('itemId') itemId: string) {
    return this.service.removeItem(itemId);
  }
}

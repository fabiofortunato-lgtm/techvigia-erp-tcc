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
import { CondominiosService } from './condominios.service';
import { CreateCondominioDto, UpdateCondominioDto } from './dto/condominio.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PerfilUsuario } from '@prisma/client';

@Controller('condominios')
@UseGuards(JwtAuthGuard, RolesGuard) // toda rota do controller exige login
export class CondominiosController {
  constructor(private condominiosService: CondominiosService) {}

  @Post()
  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.GESTOR)
  create(@Body() dto: CreateCondominioDto) {
    return this.condominiosService.create(dto);
  }

  @Get()
  // sem @Roles -> qualquer usuário autenticado pode listar (inclusive técnico em campo)
  findAll() {
    return this.condominiosService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.condominiosService.findOne(id);
  }

  @Put(':id')
  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.GESTOR)
  update(@Param('id') id: string, @Body() dto: UpdateCondominioDto) {
    return this.condominiosService.update(id, dto);
  }

  @Delete(':id')
  @Roles(PerfilUsuario.ADMIN)
  remove(@Param('id') id: string) {
    return this.condominiosService.remove(id);
  }

  @Post(':id/tecnicos/:tecnicoId')
  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.GESTOR)
  vincularTecnico(
    @Param('id') condominioId: string,
    @Param('tecnicoId') tecnicoId: string,
  ) {
    return this.condominiosService.vincularTecnico(condominioId, tecnicoId);
  }
}

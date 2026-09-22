import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import * as argon2 from 'argon2';
import { UsersService } from './users.service';
import { UpdatePerfilDto } from './dto/update-perfil.dto';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PerfilUsuario } from '@prisma/client';

@Controller('usuarios')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  // Qualquer usuário autenticado pode listar - é usado, por exemplo,
  // para escolher o técnico ao agendar uma visita na Agenda.
  findAll() {
    return this.usersService.findAll();
  }

  @Post()
  @Roles(PerfilUsuario.ADMIN)
  // Único jeito de criar usuário depois do bootstrap inicial
  // (POST /auth/register fecha sozinho assim que existe 1 usuário no banco).
  async create(@Body() dto: CreateUsuarioDto) {
    const senhaHash = await argon2.hash(dto.senha);
    return this.usersService.criarPorAdmin({
      nome: dto.nome,
      email: dto.email,
      senhaHash,
      perfil: dto.perfil,
    });
  }

  @Patch(':id')
  @Roles(PerfilUsuario.ADMIN)
  // Edita nome/email/ativo de qualquer usuário - "ativo: false" é como se
  // desliga alguém do sistema sem apagar o histórico de OS já vinculado.
  updateUsuario(@Param('id') id: string, @Body() dto: UpdateUsuarioDto) {
    return this.usersService.atualizarPorAdmin(id, dto);
  }

  @Patch(':id/perfil')
  @Roles(PerfilUsuario.ADMIN)
  // Só ADMIN pode promover/rebaixar perfil de outro usuário.
  // Antes desse endpoint, isso só era possível direto no banco via Prisma Studio.
  updatePerfil(@Param('id') id: string, @Body() dto: UpdatePerfilDto) {
    return this.usersService.updatePerfil(id, dto.perfil);
  }
}

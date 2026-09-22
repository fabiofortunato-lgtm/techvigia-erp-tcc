import { Controller, Post, UseGuards } from '@nestjs/common';
import { ManutencaoRecorrenteService } from './manutencao-recorrente.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PerfilUsuario } from '@prisma/client';

@Controller('manutencoes-recorrentes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ManutencaoRecorrenteController {
  constructor(private service: ManutencaoRecorrenteService) {}

  // Roda a mesma verificação que o job automático (às 6h) faz sozinho -
  // útil pra testar sem esperar o horário, ou pra forçar uma checagem
  // manual fora do ciclo normal.
  @Post('executar')
  @Roles(PerfilUsuario.ADMIN)
  executar() {
    return this.service.gerarTodas();
  }
}

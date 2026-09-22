import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { RelatoriosService } from './relatorios.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('relatorios')
@UseGuards(JwtAuthGuard)
export class RelatoriosController {
  constructor(private relatoriosService: RelatoriosService) {}

  @Get('os-por-tecnico')
  osPorTecnico(@Query('condominioId') condominioId?: string) {
    return this.relatoriosService.osPorTecnico(condominioId);
  }
}

import { Global, Module } from '@nestjs/common';
import { AcessoManutencaoService } from './acesso-manutencao.service';
import { LogAuditoriaService } from './log-auditoria.service';

@Global()
@Module({
  providers: [AcessoManutencaoService, LogAuditoriaService],
  exports: [AcessoManutencaoService, LogAuditoriaService],
})
export class AcessoManutencaoModule {}

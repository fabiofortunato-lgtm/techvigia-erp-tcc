import { Module } from '@nestjs/common';
import { ManutencaoRecorrenteService } from './manutencao-recorrente.service';
import { ManutencaoRecorrenteController } from './manutencao-recorrente.controller';
import { ManutencoesModule } from '../manutencoes/manutencoes.module';

@Module({
  imports: [ManutencoesModule],
  controllers: [ManutencaoRecorrenteController],
  providers: [ManutencaoRecorrenteService],
})
export class ManutencaoRecorrenteModule {}

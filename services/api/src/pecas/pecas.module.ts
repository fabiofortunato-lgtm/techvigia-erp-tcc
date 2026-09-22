import { Module } from '@nestjs/common';
import { PecasService } from './pecas.service';
import { PecasController, ManutencaoPecasController } from './pecas.controller';
import { EstoqueModule } from '../estoque/estoque.module';

@Module({
  imports: [EstoqueModule],
  controllers: [ManutencaoPecasController, PecasController],
  providers: [PecasService],
})
export class PecasModule {}

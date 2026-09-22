import { Module } from '@nestjs/common';
import { CondominiosService } from './condominios.service';
import { CondominiosController } from './condominios.controller';

@Module({
  controllers: [CondominiosController],
  providers: [CondominiosService],
  exports: [CondominiosService],
})
export class CondominiosModule {}

import { Module } from '@nestjs/common';
import { ChecklistModeloService } from './checklist-modelo.service';
import { ChecklistModeloController } from './checklist-modelo.controller';

@Module({
  controllers: [ChecklistModeloController],
  providers: [ChecklistModeloService],
  exports: [ChecklistModeloService],
})
export class ChecklistModeloModule {}

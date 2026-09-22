import { Module } from '@nestjs/common';
import { ManutencoesService } from './manutencoes.service';
import { ManutencoesController } from './manutencoes.controller';
import { PdfPublicoController } from './pdf-publico.controller';
import { StorageModule } from '../storage/storage.module';
import { PdfModule } from '../pdf/pdf.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [StorageModule, PdfModule, WhatsappModule],
  controllers: [ManutencoesController, PdfPublicoController],
  providers: [ManutencoesService],
  exports: [ManutencoesService],
})
export class ManutencoesModule {}

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { WHATSAPP_QUEUE, EnviarPdfWhatsappJob } from './whatsapp.types';

@Processor(WHATSAPP_QUEUE)
export class WhatsappProcessor extends WorkerHost {
  private readonly logger = new Logger(WhatsappProcessor.name);

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<EnviarPdfWhatsappJob>) {
    const token = this.configService.get<string>('WHATSAPP_TOKEN');
    const phoneNumberId = this.configService.get<string>('WHATSAPP_PHONE_NUMBER_ID');

    // A verificação de negócio da Meta ainda está em andamento (decisão
    // registrada no README - adiada para o fim do projeto). Enquanto o
    // token não estiver configurado, o job fica registrado como pendente
    // em vez de falhar - assim que a integração for liberada, essa mesma
    // fila processa todo o backlog acumulado sem precisar reenviar nada
    // manualmente.
    if (!token || !phoneNumberId) {
      this.logger.warn(
        `WhatsApp ainda não configurado (WHATSAPP_TOKEN/WHATSAPP_PHONE_NUMBER_ID ausentes). ` +
          `Job de envio da OS ${job.data.numeroOS} permanece pendente na fila.`,
      );
      // Lança erro controlado para o BullMQ tentar de novo depois (respeitando
      // o backoff configurado), em vez de marcar como sucesso falso.
      throw new Error('WHATSAPP_NAO_CONFIGURADO');
    }

    // TODO: quando a verificação de negócio da Meta for aprovada, implementar
    // a chamada real à Meta WhatsApp Business API aqui, usando `token` e
    // `phoneNumberId` para enviar `job.data.pdfUrl` para `job.data.numeroWhatsappDestino`.
    this.logger.log(
      `[STUB] Enviaria PDF da OS ${job.data.numeroOS} via WhatsApp para ${job.data.numeroWhatsappDestino}`,
    );

    await this.prisma.manutencao.update({
      where: { id: job.data.manutencaoId },
      data: { whatsappEnviado: true },
    });
  }
}

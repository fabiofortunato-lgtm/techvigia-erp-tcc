import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  WHATSAPP_QUEUE,
  ENVIAR_PDF_JOB,
  EnviarPdfWhatsappJob,
} from './whatsapp.types';

@Injectable()
export class WhatsappService {
  constructor(
    @InjectQueue(WHATSAPP_QUEUE) private whatsappQueue: Queue<EnviarPdfWhatsappJob>,
  ) {}

  async enfileirarEnvioPdf(job: EnviarPdfWhatsappJob) {
    // Enfileira e retorna na hora - quem chamou não espera a resposta
    // da Meta. O processor cuida do envio de forma assíncrona, e se
    // a integração ainda não estiver liberada, o job fica registrado
    // como pendente sem quebrar o fluxo da manutenção.
    await this.whatsappQueue.add(ENVIAR_PDF_JOB, job, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });
  }
}

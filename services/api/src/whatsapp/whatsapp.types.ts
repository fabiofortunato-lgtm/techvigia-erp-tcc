export interface EnviarPdfWhatsappJob {
  manutencaoId: string;
  numeroWhatsappDestino: string;
  pdfUrl: string;
  numeroOS: string;
}

export const WHATSAPP_QUEUE = 'whatsapp';
export const ENVIAR_PDF_JOB = 'enviar-pdf-os';

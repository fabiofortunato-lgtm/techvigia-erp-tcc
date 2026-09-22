import { Controller, Get, Param, NotFoundException, Res } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Rota pública (sem autenticação, de propósito) - existe só pra dar um link
 * curto e limpo pro PDF de uma OS, pra compartilhar por WhatsApp com o
 * síndico/zelador (que não tem login no sistema, então não faria sentido
 * exigir token aqui).
 *
 * A URL de armazenamento de verdade
 * (/arquivos/pdfs/{uuid}-os-{numeroOS}.pdf) é longa - o identificador único
 * é necessário para evitar colisão de nomes no disco, mas não precisa
 * aparecer na mensagem que o técnico manda pro síndico. Essa rota só
 * redireciona pra URL real.
 */
@Controller('pdf')
export class PdfPublicoController {
  constructor(private prisma: PrismaService) {}

  @Get(':numeroOS')
  async redirecionar(@Param('numeroOS') numeroOS: string, @Res() res: Response) {
    const manutencao = await this.prisma.manutencao.findUnique({
      where: { numeroOS },
      select: { pdfUrl: true },
    });

    if (!manutencao?.pdfUrl) {
      throw new NotFoundException('PDF não encontrado para esta OS.');
    }

    return res.redirect(manutencao.pdfUrl);
  }
}

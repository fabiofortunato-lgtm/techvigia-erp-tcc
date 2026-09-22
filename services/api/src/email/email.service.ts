import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporterPromise: Promise<nodemailer.Transporter> | null = null;
  private usandoContaTeste = false;

  constructor(private configService: ConfigService) {}

  private async obterTransporter(): Promise<nodemailer.Transporter> {
    if (this.transporterPromise) {
      return this.transporterPromise;
    }

    const host = this.configService.get<string>('SMTP_HOST');

    if (host) {
      this.transporterPromise = Promise.resolve(
        nodemailer.createTransport({
          host,
          port: Number(this.configService.get('SMTP_PORT')) || 587,
          secure: false,
          auth: {
            user: this.configService.get<string>('SMTP_USER'),
            pass: this.configService.get<string>('SMTP_PASS'),
          },
        }),
      );
      return this.transporterPromise;
    }

    // Sem SMTP configurado no .env: cria uma conta de teste descartável
    // (Ethereal) só para desenvolvimento. O e-mail NÃO chega a lugar
    // nenhum de verdade, mas o serviço gera uma URL de preview onde dá
    // para ver exatamente como o e-mail ficaria - útil para testar o
    // fluxo completo sem precisar de credenciais de e-mail reais.
    this.usandoContaTeste = true;
    this.transporterPromise = nodemailer.createTestAccount().then((conta) =>
      nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: { user: conta.user, pass: conta.pass },
      }),
    );
    return this.transporterPromise;
  }

  /**
   * Envia o e-mail de redefinição de senha. Retorna um previewUrl quando
   * está usando a conta de teste (Ethereal) - útil para expor na resposta
   * da API apenas fora de produção, para facilitar o teste manual.
   */
  async enviarEmailResetSenha(
    destinatario: string,
    link: string,
  ): Promise<{ previewUrl?: string }> {
    try {
      const transporter = await this.obterTransporter();
      const from =
        this.configService.get<string>('SMTP_FROM') ||
        'TechVigia <no-reply@techvigia-demo.com>';

      const info = await transporter.sendMail({
        from,
        to: destinatario,
        subject: 'Redefinição de senha - TechVigia',
        html: `
          <p>Você solicitou a redefinição da sua senha no TechVigia ERP.</p>
          <p><a href="${link}">Clique aqui para redefinir sua senha</a></p>
          <p>Este link expira em 1 hora. Se você não solicitou essa redefinição, ignore este e-mail.</p>
        `,
      });

      if (this.usandoContaTeste) {
        const previewUrl = nodemailer.getTestMessageUrl(info);
        this.logger.warn(
          `[DEV] SMTP não configurado - e-mail enviado via conta de teste Ethereal. Preview: ${previewUrl}`,
        );
        return { previewUrl: previewUrl || undefined };
      }

      return {};
    } catch (erro) {
      // Falha no envio de e-mail NUNCA deve quebrar o fluxo de "esqueci senha" -
      // o token já foi salvo no banco, então o usuário ainda consegue completar
      // a redefinição via log do servidor, mesmo que o e-mail não tenha saído.
      this.logger.error(`Falha ao enviar e-mail de redefinição de senha: ${erro}`);
      return {};
    }
  }
}

import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import * as cookieParser from 'cookie-parser';
import * as path from 'path';

/**
 * Configura a aplicação Nest com tudo que main.ts e os testes e2e
 * precisam ter em comum (pipes, CORS, arquivos estáticos).
 *
 * IMPORTANTE: qualquer configuração de app adicionada aqui passa a valer
 * tanto para a API rodando de verdade quanto para os testes e2e - evita
 * o problema de "funciona rodando local, mas o teste não cobre porque
 * o teste monta a aplicação de outro jeito".
 */
export function setupApp(app: INestApplication): INestApplication {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.use(cookieParser());

  // credentials:true é obrigatório para o navegador aceitar enviar/receber
  // cookies httpOnly - e exige uma origem explícita (não dá para usar "*"
  // junto com credentials). O app mobile não é afetado por CORS (é um
  // mecanismo só de navegador), então essa restrição vale só para o painel web.
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  });

  // O nome físico no disco tem um prefixo UUID pra evitar colisão entre
  // arquivos (ex: "a5b16457-...-os-OS-2026000001.pdf") - necessário para o
  // armazenamento, mas incômodo quando alguém compartilha o PDF (o nome
  // feio "vaza" pro WhatsApp/app de compartilhamento do celular). O
  // Content-Disposition abaixo não muda o arquivo em si, só o nome que o
  // navegador/app usa ao exibir, baixar ou compartilhar.
  const REGEX_PREFIXO_UUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i;

  app.use(
    '/arquivos',
    express.static(path.resolve(process.cwd(), 'storage'), {
      setHeaders: (res, filePath) => {
        const nomeArquivo = path.basename(filePath);
        const nomeLimpo = nomeArquivo.replace(REGEX_PREFIXO_UUID, '');
        res.setHeader('Content-Disposition', `inline; filename="${nomeLimpo}"`);
      },
    }),
  );

  return app;
}

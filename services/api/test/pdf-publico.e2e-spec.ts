import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { PerfilUsuario, StatusManutencao } from '@prisma/client';
import { criarUsuarioTeste } from './helpers/criar-usuario';

describe('PDF público - link curto para compartilhar (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const adminEmail = 'admin.pdfpublico.e2e@techvigia-demo.com';
  const senha = 'senha12345';
  const cnpj = '66.666.666/0001-66';
  const numeroOSComPdf = 'OS-TESTE-PDF-PUBLICO-001';
  const numeroOSSemPdf = 'OS-TESTE-PDF-PUBLICO-002';

  let manutencaoComPdfId: string;
  let manutencaoSemPdfId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();

    prisma = app.get(PrismaService);

    await prisma.usuario.deleteMany({ where: { email: adminEmail } });
    await prisma.condominio.deleteMany({ where: { cnpj } });

    const admin = await criarUsuarioTeste(prisma, {
      nome: 'Admin PDF Público Teste',
      email: adminEmail,
      senha,
      perfil: PerfilUsuario.ADMIN,
    });

    const condominio = await prisma.condominio.create({
      data: {
        nome: 'Condomínio PDF Público Teste',
        cnpj,
        endereco: 'Rua do Link Curto, 1',
        bairro: 'Centro',
        cidade: 'Rio de Janeiro',
        cep: '20000-000',
        periodicidade: 30,
      },
    });

    const comPdf = await prisma.manutencao.create({
      data: {
        numeroOS: numeroOSComPdf,
        condominioId: condominio.id,
        tecnicoId: admin.id,
        status: StatusManutencao.CONCLUIDA,
        pdfUrl: '/arquivos/pdfs/00000000-0000-0000-0000-000000000000-os-OS-TESTE-PDF-PUBLICO-001.pdf',
      },
    });
    manutencaoComPdfId = comPdf.id;

    const semPdf = await prisma.manutencao.create({
      data: {
        numeroOS: numeroOSSemPdf,
        condominioId: condominio.id,
        tecnicoId: admin.id,
        status: StatusManutencao.EM_ANDAMENTO,
      },
    });
    manutencaoSemPdfId = semPdf.id;
  });

  afterAll(async () => {
    await prisma.manutencao.deleteMany({
      where: { id: { in: [manutencaoComPdfId, manutencaoSemPdfId] } },
    });
    await prisma.condominio.deleteMany({ where: { cnpj } });
    await prisma.usuario.deleteMany({ where: { email: adminEmail } });
    await app.close();
  });

  it('/pdf/:numeroOS (GET) - redireciona pra URL real do PDF, sem exigir autenticação', async () => {
    const response = await request(app.getHttpServer())
      .get(`/pdf/${numeroOSComPdf}`)
      // Sem Authorization de propósito - é assim que o síndico acessa
      .expect(302);

    expect(response.headers.location).toBe(
      '/arquivos/pdfs/00000000-0000-0000-0000-000000000000-os-OS-TESTE-PDF-PUBLICO-001.pdf',
    );
  });

  it('/pdf/:numeroOS (GET) - devolve 404 quando a OS não tem PDF gerado ainda', async () => {
    await request(app.getHttpServer()).get(`/pdf/${numeroOSSemPdf}`).expect(404);
  });

  it('/pdf/:numeroOS (GET) - devolve 404 quando o numeroOS não existe', async () => {
    await request(app.getHttpServer()).get('/pdf/OS-NAO-EXISTE-9999').expect(404);
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { PerfilUsuario } from '@prisma/client';
import { criarUsuarioTeste } from './helpers/criar-usuario';

// PNG 1x1 transparente - suficiente para testar o fluxo de upload/leitura
// de imagem sem depender de um arquivo real de assinatura.
const PNG_1X1_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

describe('Ordem de Serviço - checklist, assinatura e PDF (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const adminEmail = 'admin.os.e2e@techvigia-demo.com';
  const senha = 'senha12345';

  let adminToken: string;
  let tecnicoId: string;
  let condominioId: string;
  let manutencaoId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();

    prisma = app.get(PrismaService);

    await prisma.usuario.deleteMany({ where: { email: adminEmail } });
    await prisma.condominio.deleteMany({ where: { cnpj: '33.333.333/0001-33' } });

    await criarUsuarioTeste(prisma, {
      nome: 'Admin OS Teste',
      email: adminEmail,
      senha,
      perfil: PerfilUsuario.ADMIN,
    });
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: adminEmail, senha });
    adminToken = login.body.accessToken;

    const admin = await prisma.usuario.findUnique({ where: { email: adminEmail } });
    if (!admin) throw new Error('Falha ao criar usuário admin para o teste');
    tecnicoId = admin.id; // reutiliza o admin também como "técnico" só para o teste

    const condominio = await request(app.getHttpServer())
      .post('/condominios')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        nome: 'Condomínio OS Teste',
        cnpj: '33.333.333/0001-33',
        endereco: 'Rua da OS, 1',
        bairro: 'Centro',
        cidade: 'Rio de Janeiro',
        cep: '20000-000',
        whatsapp: '5521999999999',
        periodicidade: 30,
      });
    condominioId = condominio.body.id;

    const manutencao = await request(app.getHttpServer())
      .post('/manutencoes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        condominioId,
        tecnicoId,
        inicio: new Date().toISOString(),
      });
    manutencaoId = manutencao.body.id;
  });

  afterAll(async () => {
    await prisma.checklistItem.deleteMany({ where: { manutencaoId } });
    await prisma.manutencao.deleteMany({ where: { id: manutencaoId } });
    await prisma.condominio.deleteMany({ where: { id: condominioId } });
    await prisma.usuario.deleteMany({ where: { email: adminEmail } });
    await app.close();
  });

  it('/manutencoes/:id/gerar-pdf (POST) - deve rejeitar geração sem assinatura', async () => {
    await request(app.getHttpServer())
      .post(`/manutencoes/${manutencaoId}/gerar-pdf`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
  });

  it('/manutencoes/:id/checklist (POST) - deve adicionar item ao checklist', async () => {
    const response = await request(app.getHttpServer())
      .post(`/manutencoes/${manutencaoId}/checklist`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ item: 'DVR ligando normalmente', status: 'OK' })
      .expect(201);

    expect(response.body.item).toBe('DVR ligando normalmente');
  });

  it('/manutencoes/:id/checklist (GET) - deve listar o item adicionado', async () => {
    const response = await request(app.getHttpServer())
      .get(`/manutencoes/${manutencaoId}/checklist`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.length).toBeGreaterThanOrEqual(1);
  });

  it('/manutencoes/:id/assinatura (POST) - deve rejeitar base64 inválido', async () => {
    await request(app.getHttpServer())
      .post(`/manutencoes/${manutencaoId}/assinatura`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ imagemBase64: '' })
      .expect(400);
  });

  it('/manutencoes/:id/assinatura (POST) - deve salvar a assinatura, o nome do assinante, e retornar assinaturaUrl', async () => {
    const response = await request(app.getHttpServer())
      .post(`/manutencoes/${manutencaoId}/assinatura`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        imagemBase64: `data:image/png;base64,${PNG_1X1_BASE64}`,
        nomeAssinante: 'Maria Síndica',
      })
      .expect(201);

    expect(response.body.assinaturaUrl).toMatch(/^http/);
    expect(response.body.assinanteNome).toBe('Maria Síndica');

    const manutencao = await request(app.getHttpServer())
      .get(`/manutencoes/${manutencaoId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(manutencao.body.assinanteNome).toBe('Maria Síndica');
  });

  it('/manutencoes/:id/gerar-pdf (POST) - deve gerar o PDF, concluir a OS e retornar pdfUrl', async () => {
    const response = await request(app.getHttpServer())
      .post(`/manutencoes/${manutencaoId}/gerar-pdf`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    expect(response.body.pdfUrl).toMatch(/^http.*\.pdf$/);
    expect(response.body.status).toBe('CONCLUIDA');
  });

  it('o link do PDF gerado deve ser acessível via HTTP (arquivo estático)', async () => {
    const manutencao = await request(app.getHttpServer())
      .get(`/manutencoes/${manutencaoId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const url = new URL(manutencao.body.pdfUrl);

    const respostaArquivo = await request(app.getHttpServer())
      .get(url.pathname)
      .expect(200);

    expect(respostaArquivo.headers['content-type']).toContain('application/pdf');
  });

  describe('OS travada depois de assinada (a essa altura, manutencaoId já está CONCLUIDA)', () => {
    it('POST .../checklist - não deve mais aceitar novo item', async () => {
      await request(app.getHttpServer())
        .post(`/manutencoes/${manutencaoId}/checklist`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ item: 'Tentando adicionar depois de assinada', status: 'OK' })
        .expect(409);
    });

    it('POST .../pecas - não deve mais aceitar novo pedido', async () => {
      await request(app.getHttpServer())
        .post(`/manutencoes/${manutencaoId}/pecas`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nome: 'Peça tentando entrar depois de assinada', quantidade: 1 })
        .expect(409);
    });

    it('PATCH .../observacao - não deve mais aceitar edição', async () => {
      await request(app.getHttpServer())
        .patch(`/manutencoes/${manutencaoId}/observacao`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ observacao: 'Tentando editar depois de assinada' })
        .expect(409);
    });

    it('POST .../assinatura - não deve permitir sobrescrever a assinatura existente', async () => {
      await request(app.getHttpServer())
        .post(`/manutencoes/${manutencaoId}/assinatura`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ imagemBase64: `data:image/png;base64,${PNG_1X1_BASE64}`, nomeAssinante: 'Outra Pessoa' })
        .expect(409);
    });

    it('POST .../gerar-pdf - não deve gerar o PDF de novo (idempotência)', async () => {
      await request(app.getHttpServer())
        .post(`/manutencoes/${manutencaoId}/gerar-pdf`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(409);
    });

    it('a trilha de auditoria registrou a assinatura, a conclusão, e as tentativas bloqueadas', async () => {
      const logs = await prisma.logAuditoria.findMany({ where: { manutencaoId } });
      const acoes = logs.map((l) => l.acao);

      expect(acoes).toContain('ASSINATURA_COLETADA');
      expect(acoes).toContain('OS_CONCLUIDA');
      // 3 tentativas bloqueadas nos testes acima (checklist, pecas, observacao) -
      // a de assinatura e a de gerar-pdf usam suas próprias mensagens/exceções,
      // não passam pelo verificarNaoTravada genérico.
      const bloqueios = logs.filter((l) => l.acao === 'EDICAO_BLOQUEADA_OS_ASSINADA');
      expect(bloqueios.length).toBeGreaterThanOrEqual(3);
    });
  });
});

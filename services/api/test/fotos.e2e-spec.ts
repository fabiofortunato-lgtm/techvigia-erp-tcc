import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { PerfilUsuario } from '@prisma/client';
import { criarUsuarioTeste } from './helpers/criar-usuario';

const PNG_1X1_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

describe('Fotos (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const adminEmail = 'admin.fotos.e2e@techvigia-demo.com';
  const senha = 'senha12345';

  let adminToken: string;
  let manutencaoId: string;
  let condominioId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();

    prisma = app.get(PrismaService);

    await prisma.usuario.deleteMany({ where: { email: adminEmail } });
    await prisma.condominio.deleteMany({ where: { cnpj: '44.444.444/0001-44' } });

    await criarUsuarioTeste(prisma, {
      nome: 'Admin Fotos Teste',
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

    const condominio = await request(app.getHttpServer())
      .post('/condominios')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        nome: 'Condomínio Fotos Teste',
        cnpj: '44.444.444/0001-44',
        endereco: 'Rua das Fotos, 1',
        bairro: 'Centro',
        cidade: 'Rio de Janeiro',
        cep: '20000-000',
        periodicidade: 30,
      });
    condominioId = condominio.body.id;

    const manutencao = await request(app.getHttpServer())
      .post('/manutencoes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ condominioId, tecnicoId: admin.id, inicio: new Date().toISOString() });
    manutencaoId = manutencao.body.id;
  });

  afterAll(async () => {
    await prisma.foto.deleteMany({ where: { manutencaoId } });
    await prisma.manutencao.deleteMany({ where: { id: manutencaoId } });
    await prisma.condominio.deleteMany({ where: { id: condominioId } });
    await prisma.usuario.deleteMany({ where: { email: adminEmail } });
    await app.close();
  });

  it('/manutencoes/:id/fotos (POST) - deve rejeitar upload sem arquivo', async () => {
    await request(app.getHttpServer())
      .post(`/manutencoes/${manutencaoId}/fotos`)
      .set('Authorization', `Bearer ${adminToken}`)
      .field('tipo', 'ANTES')
      .expect(400);
  });

  it('/manutencoes/:id/fotos (POST) - deve rejeitar arquivo que não é imagem', async () => {
    await request(app.getHttpServer())
      .post(`/manutencoes/${manutencaoId}/fotos`)
      .set('Authorization', `Bearer ${adminToken}`)
      .field('tipo', 'ANTES')
      .attach('arquivo', Buffer.from('não sou uma imagem'), {
        filename: 'arquivo.txt',
        contentType: 'text/plain',
      })
      .expect(400);
  });

  it('/manutencoes/:id/fotos (POST) - deve fazer upload de uma foto ANTES', async () => {
    const response = await request(app.getHttpServer())
      .post(`/manutencoes/${manutencaoId}/fotos`)
      .set('Authorization', `Bearer ${adminToken}`)
      .field('tipo', 'ANTES')
      .attach('arquivo', PNG_1X1_BUFFER, {
        filename: 'foto-antes.png',
        contentType: 'image/png',
      })
      .expect(201);

    expect(response.body.tipo).toBe('ANTES');
    expect(response.body.arquivoUrl).toMatch(/^http/);
  });

  it('/manutencoes/:id/fotos (GET) - deve listar as fotos da manutenção', async () => {
    const response = await request(app.getHttpServer())
      .get(`/manutencoes/${manutencaoId}/fotos`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.length).toBeGreaterThanOrEqual(1);
  });
});

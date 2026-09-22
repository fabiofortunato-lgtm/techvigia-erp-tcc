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

describe('Equipamentos (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const adminEmail = 'admin.equipamentos.e2e@techvigia-demo.com';
  const tecnicoEmail = 'tecnico.equipamentos.e2e@techvigia-demo.com';
  const senha = 'senha12345';

  let adminToken: string;
  let tecnicoToken: string;
  let condominioId: string;
  let equipamentoId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();

    prisma = app.get(PrismaService);

    await prisma.usuario.deleteMany({
      where: { email: { in: [adminEmail, tecnicoEmail] } },
    });
    await prisma.condominio.deleteMany({ where: { cnpj: '66.666.666/0001-66' } });

    await criarUsuarioTeste(prisma, {
      nome: 'Admin Equipamentos Teste',
      email: adminEmail,
      senha,
      perfil: PerfilUsuario.ADMIN,
    });
    const loginAdmin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: adminEmail, senha });
    adminToken = loginAdmin.body.accessToken;

    await criarUsuarioTeste(prisma, { nome: 'Tecnico Equipamentos Teste', email: tecnicoEmail, senha });
    const loginTecnico = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: tecnicoEmail, senha });
    tecnicoToken = loginTecnico.body.accessToken;

    const condominio = await request(app.getHttpServer())
      .post('/condominios')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        nome: 'Condomínio Equipamentos Teste',
        cnpj: '66.666.666/0001-66',
        endereco: 'Rua dos Equipamentos, 1',
        bairro: 'Centro',
        cidade: 'Rio de Janeiro',
        cep: '20000-000',
        periodicidade: 30,
      });
    condominioId = condominio.body.id;
  });

  afterAll(async () => {
    await prisma.equipamento.deleteMany({ where: { condominioId } });
    await prisma.condominio.deleteMany({ where: { id: condominioId } });
    await prisma.usuario.deleteMany({
      where: { email: { in: [adminEmail, tecnicoEmail] } },
    });
    await app.close();
  });

  it('/equipamentos (POST) - TECNICO não pode cadastrar equipamento (RBAC)', async () => {
    await request(app.getHttpServer())
      .post('/equipamentos')
      .set('Authorization', `Bearer ${tecnicoToken}`)
      .send({
        condominioId,
        tipo: 'Câmera',
        fabricante: 'Intelbras',
        modelo: 'VHD 3230',
        dataInstalacao: new Date().toISOString(),
      })
      .expect(403);
  });

  it('/equipamentos (POST) - ADMIN cadastra equipamento com local e status', async () => {
    const response = await request(app.getHttpServer())
      .post('/equipamentos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        condominioId,
        tipo: 'Câmera',
        local: 'Portaria principal',
        status: 'OK',
        fabricante: 'Intelbras',
        modelo: 'VHD 3230',
        dataInstalacao: new Date().toISOString(),
      })
      .expect(201);

    expect(response.body.local).toBe('Portaria principal');
    expect(response.body.status).toBe('OK');
    equipamentoId = response.body.id;
  });

  it('/equipamentos (POST) - status é OK por padrão quando não informado', async () => {
    const response = await request(app.getHttpServer())
      .post('/equipamentos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        condominioId,
        tipo: 'DVR',
        fabricante: 'Intelbras',
        modelo: 'MHDX 1116',
        dataInstalacao: new Date().toISOString(),
      })
      .expect(201);

    expect(response.body.status).toBe('OK');
  });

  it('/equipamentos/:id (PUT) - deve atualizar status para DEFEITO', async () => {
    const response = await request(app.getHttpServer())
      .put(`/equipamentos/${equipamentoId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'DEFEITO' })
      .expect(200);

    expect(response.body.status).toBe('DEFEITO');
  });

  it('/equipamentos/condominio/:condominioId (GET) - lista os equipamentos com local e status', async () => {
    const response = await request(app.getHttpServer())
      .get(`/equipamentos/condominio/${condominioId}`)
      .set('Authorization', `Bearer ${tecnicoToken}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThanOrEqual(2);
    expect(response.body.some((e: { status: string }) => e.status === 'DEFEITO')).toBe(true);
  });

  it('/equipamentos/:id (DELETE) - TECNICO não pode remover (RBAC)', async () => {
    await request(app.getHttpServer())
      .delete(`/equipamentos/${equipamentoId}`)
      .set('Authorization', `Bearer ${tecnicoToken}`)
      .expect(403);
  });

  it('/equipamentos (POST) - aceita intervalo de troca e data da última troca', async () => {
    const response = await request(app.getHttpServer())
      .post('/equipamentos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        condominioId,
        tipo: 'Nobreak',
        fabricante: 'SMS',
        modelo: 'Manager III',
        dataInstalacao: new Date('2025-01-01').toISOString(),
        intervaloTrocaMeses: 12,
        dataUltimaTroca: new Date('2026-01-01').toISOString(),
      })
      .expect(201);

    expect(response.body.intervaloTrocaMeses).toBe(12);
    expect(response.body.dataUltimaTroca).toBeTruthy();

    await prisma.equipamento.deleteMany({ where: { id: response.body.id } });
  });

  it('/equipamentos (GET) - listagem geral traz o nome do condomínio junto', async () => {
    const response = await request(app.getHttpServer())
      .get('/equipamentos')
      .set('Authorization', `Bearer ${tecnicoToken}`)
      .expect(200);

    const item = response.body.find((eq: { id: string }) => eq.id === equipamentoId);
    expect(item.condominio).toBeDefined();
    expect(item.condominio.nome).toBe('Condomínio Equipamentos Teste');
  });

  it('/equipamentos/:id/foto (POST) - TECNICO não pode enviar foto (RBAC)', async () => {
    await request(app.getHttpServer())
      .post(`/equipamentos/${equipamentoId}/foto`)
      .set('Authorization', `Bearer ${tecnicoToken}`)
      .attach('arquivo', PNG_1X1_BUFFER, { filename: 'equip.png', contentType: 'image/png' })
      .expect(403);
  });

  it('/equipamentos/:id/foto (POST) - rejeita arquivo que não é imagem', async () => {
    await request(app.getHttpServer())
      .post(`/equipamentos/${equipamentoId}/foto`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('arquivo', Buffer.from('não sou uma imagem'), {
        filename: 'nota.txt',
        contentType: 'text/plain',
      })
      .expect(400);
  });

  it('/equipamentos/:id/foto (POST) - ADMIN envia a foto e o equipamento passa a ter fotoUrl', async () => {
    const response = await request(app.getHttpServer())
      .post(`/equipamentos/${equipamentoId}/foto`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('arquivo', PNG_1X1_BUFFER, { filename: 'equip.png', contentType: 'image/png' })
      .expect(201);

    expect(response.body.fotoUrl).toBeTruthy();
  });
});

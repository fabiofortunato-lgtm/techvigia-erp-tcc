import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { PerfilUsuario } from '@prisma/client';
import { criarUsuarioTeste } from './helpers/criar-usuario';

describe('Estoque (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const adminEmail = 'admin.estoque.e2e@techvigia-demo.com';
  const tecnicoEmail = 'tecnico.estoque.e2e@techvigia-demo.com';
  const senha = 'senha12345';

  let adminToken: string;
  let tecnicoToken: string;
  let itemId: string;

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
    await prisma.itemEstoque.deleteMany({ where: { nome: 'HD 1TB Teste E2E' } });

    await criarUsuarioTeste(prisma, {
      nome: 'Admin Estoque Teste',
      email: adminEmail,
      senha,
      perfil: PerfilUsuario.ADMIN,
    });
    const loginAdmin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: adminEmail, senha });
    adminToken = loginAdmin.body.accessToken;

    await criarUsuarioTeste(prisma, { nome: 'Tecnico Estoque Teste', email: tecnicoEmail, senha });
    const loginTecnico = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: tecnicoEmail, senha });
    tecnicoToken = loginTecnico.body.accessToken;
  });

  afterAll(async () => {
    if (itemId) {
      await prisma.movimentacaoEstoque.deleteMany({ where: { itemEstoqueId: itemId } });
      await prisma.itemEstoque.deleteMany({ where: { id: itemId } });
    }
    await prisma.usuario.deleteMany({
      where: { email: { in: [adminEmail, tecnicoEmail] } },
    });
    await app.close();
  });

  it('/estoque (POST) - TECNICO não pode cadastrar item (RBAC)', async () => {
    await request(app.getHttpServer())
      .post('/estoque')
      .set('Authorization', `Bearer ${tecnicoToken}`)
      .send({ nome: 'HD 1TB Teste E2E', quantidade: 10, quantidadeMinima: 2 })
      .expect(403);
  });

  it('/estoque (POST) - ADMIN cadastra um item com saldo inicial', async () => {
    const response = await request(app.getHttpServer())
      .post('/estoque')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        nome: 'HD 1TB Teste E2E',
        unidade: 'un',
        quantidade: 10,
        quantidadeMinima: 3,
        custoUnitario: 250.5,
        fornecedor: 'Fornecedor Teste',
      })
      .expect(201);

    expect(response.body.quantidade).toBe(10);
    itemId = response.body.id;
  });

  it('/estoque/:id/movimentacoes (POST) - deve registrar uma SAIDA e atualizar o saldo', async () => {
    const response = await request(app.getHttpServer())
      .post(`/estoque/${itemId}/movimentacoes`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ tipo: 'SAIDA', quantidade: 4, motivo: 'Uso em OS de teste' })
      .expect(201);

    expect(response.body.tipo).toBe('SAIDA');

    const item = await request(app.getHttpServer())
      .get(`/estoque/${itemId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(item.body.quantidade).toBe(6); // 10 - 4
  });

  it('/estoque/:id/movimentacoes (POST) - deve rejeitar SAIDA maior que o saldo disponível', async () => {
    await request(app.getHttpServer())
      .post(`/estoque/${itemId}/movimentacoes`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ tipo: 'SAIDA', quantidade: 999, motivo: 'Tentativa inválida' })
      .expect(400);
  });

  it('/estoque/:id/movimentacoes (POST) - deve registrar uma ENTRADA e atualizar o saldo', async () => {
    await request(app.getHttpServer())
      .post(`/estoque/${itemId}/movimentacoes`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ tipo: 'ENTRADA', quantidade: 5, motivo: 'Reposição' })
      .expect(201);

    const item = await request(app.getHttpServer())
      .get(`/estoque/${itemId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(item.body.quantidade).toBe(11); // 6 + 5
  });

  it('/estoque/alertas/abaixo-do-minimo (GET) - lista itens com saldo baixo', async () => {
    // Zera o saldo pra forçar o alerta (10 saídas de 1 até ficar <= mínimo de 3)
    await request(app.getHttpServer())
      .post(`/estoque/${itemId}/movimentacoes`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ tipo: 'SAIDA', quantidade: 9, motivo: 'Forçar alerta no teste' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get('/estoque/alertas/abaixo-do-minimo')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(
      response.body.some((item: { id: string }) => item.id === itemId),
    ).toBe(true);
  });

  it('/estoque (GET) - TECNICO pode consultar o estoque (somente leitura)', async () => {
    await request(app.getHttpServer())
      .get('/estoque')
      .set('Authorization', `Bearer ${tecnicoToken}`)
      .expect(200);
  });
});

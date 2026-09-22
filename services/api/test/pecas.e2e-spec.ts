import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { PerfilUsuario } from '@prisma/client';
import { criarUsuarioTeste } from './helpers/criar-usuario';

describe('Peças (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const adminEmail = 'admin.pecas.e2e@techvigia-demo.com';
  const senha = 'senha12345';

  let token: string;
  let condominioId: string;
  let manutencaoId: string;
  let itemEstoqueId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();

    prisma = app.get(PrismaService);

    await prisma.usuario.deleteMany({ where: { email: adminEmail } });
    await prisma.condominio.deleteMany({ where: { cnpj: '88.888.888/0001-88' } });
    await prisma.itemEstoque.deleteMany({ where: { nome: 'Fonte Teste Peças E2E' } });

    await criarUsuarioTeste(prisma, {
      nome: 'Admin Peças Teste',
      email: adminEmail,
      senha,
      perfil: PerfilUsuario.ADMIN,
    });
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: adminEmail, senha });
    token = login.body.accessToken;

    const admin = await prisma.usuario.findUnique({ where: { email: adminEmail } });
    if (!admin) throw new Error('Falha ao criar usuário admin para o teste');

    const condominio = await request(app.getHttpServer())
      .post('/condominios')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nome: 'Condomínio Peças Teste',
        cnpj: '88.888.888/0001-88',
        endereco: 'Rua das Peças, 1',
        bairro: 'Centro',
        cidade: 'Rio de Janeiro',
        cep: '20000-000',
        periodicidade: 30,
      });
    condominioId = condominio.body.id;

    const manutencao = await request(app.getHttpServer())
      .post('/manutencoes')
      .set('Authorization', `Bearer ${token}`)
      .send({ condominioId, tecnicoId: admin.id, inicio: new Date().toISOString() });
    manutencaoId = manutencao.body.id;

    const item = await request(app.getHttpServer())
      .post('/estoque')
      .set('Authorization', `Bearer ${token}`)
      .send({ nome: 'Fonte Teste Peças E2E', unidade: 'un', quantidade: 5, quantidadeMinima: 1 });
    itemEstoqueId = item.body.id;
  });

  afterAll(async () => {
    await prisma.peca.deleteMany({ where: { manutencaoId } });
    await prisma.movimentacaoEstoque.deleteMany({ where: { itemEstoqueId } });
    await prisma.itemEstoque.deleteMany({ where: { id: itemEstoqueId } });
    await prisma.manutencao.deleteMany({ where: { id: manutencaoId } });
    await prisma.condominio.deleteMany({ where: { id: condominioId } });
    await prisma.usuario.deleteMany({ where: { email: adminEmail } });
    await app.close();
  });

  it('/manutencoes/:id/pecas (POST) - registra peça avulsa (sem vínculo de estoque)', async () => {
    const response = await request(app.getHttpServer())
      .post(`/manutencoes/${manutencaoId}/pecas`)
      .set('Authorization', `Bearer ${token}`)
      .send({ nome: 'Cabo de rede (metro)', quantidade: 3, motivoTroca: 'Rompimento' })
      .expect(201);

    expect(response.body.nome).toBe('Cabo de rede (metro)');
    expect(response.body.quantidade).toBe(3);
  });

  it('/manutencoes/:id/pecas (POST) - vinculada ao estoque dá baixa automática', async () => {
    const response = await request(app.getHttpServer())
      .post(`/manutencoes/${manutencaoId}/pecas`)
      .set('Authorization', `Bearer ${token}`)
      .send({ nome: 'Fonte de alimentação', quantidade: 2, itemEstoqueId })
      .expect(201);

    expect(response.body.itemEstoqueId).toBe(itemEstoqueId);

    const item = await request(app.getHttpServer())
      .get(`/estoque/${itemEstoqueId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(item.body.quantidade).toBe(3); // 5 - 2
  });

  it('/manutencoes/:id/pecas (POST) - rejeita quando o saldo de estoque é insuficiente', async () => {
    await request(app.getHttpServer())
      .post(`/manutencoes/${manutencaoId}/pecas`)
      .set('Authorization', `Bearer ${token}`)
      .send({ nome: 'Fonte de alimentação', quantidade: 999, itemEstoqueId })
      .expect(400);

    // Confirma que a peça NÃO foi registrada, já que o estoque recusou
    const pecas = await request(app.getHttpServer())
      .get(`/manutencoes/${manutencaoId}/pecas`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(
      pecas.body.some((p: { quantidade: number }) => p.quantidade === 999),
    ).toBe(false);
  });

  it('/manutencoes/:id/pecas (GET) - lista as peças da manutenção', async () => {
    const response = await request(app.getHttpServer())
      .get(`/manutencoes/${manutencaoId}/pecas`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.length).toBeGreaterThanOrEqual(2);
  });

  it('/pecas (GET) - histórico global inclui dados do condomínio e técnico', async () => {
    const response = await request(app.getHttpServer())
      .get('/pecas')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const registro = response.body.find(
      (p: { manutencao: { condominio: { id: string } } }) =>
        p.manutencao.condominio.id === condominioId,
    );

    expect(registro).toBeDefined();
    expect(registro.manutencao.numeroOS).toMatch(/^OS-/);
    expect(registro.manutencao.tecnico.nome).toBeDefined();
  });

  it('/manutencoes/:id/pecas (POST) - equipamentoId inexistente não deixa o estoque debitado sem a peça (atomicidade)', async () => {
    const itemAntes = await request(app.getHttpServer())
      .get(`/estoque/${itemEstoqueId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const saldoAntes = itemAntes.body.quantidade;

    // UUID bem-formado, mas de um equipamento que não existe - a foreign
    // key do banco recusa o INSERT da peça. Antes da correção, isso
    // acontecia DEPOIS da baixa de estoque já ter sido efetivada em outro
    // commit - o saldo ficava debitado sem nenhuma peça registrada em
    // lugar nenhum. Agora os dois vivem na mesma transação.
    await request(app.getHttpServer())
      .post(`/manutencoes/${manutencaoId}/pecas`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        nome: 'Peça com equipamento inexistente',
        quantidade: 1,
        itemEstoqueId,
        equipamentoId: '00000000-0000-0000-0000-000000000000',
      })
      .expect(500); // erro de FK do banco - propagado como erro de servidor

    const itemDepois = await request(app.getHttpServer())
      .get(`/estoque/${itemEstoqueId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // O saldo não deve ter mudado - a transação inteira foi desfeita
    expect(itemDepois.body.quantidade).toBe(saldoAntes);
  });

  it('/manutencoes/:id/pecas (POST) - duas baixas concorrentes no mesmo item nunca deixam saldo negativo', async () => {
    // Item começa com saldo 3 nesse ponto do teste (5 inicial - 2 do
    // primeiro teste da suíte). Duas requisições de saída de 2 unidades
    // cada, disparadas ao mesmo tempo: só UMA pode ter sucesso (saldo
    // suficiente pra uma, não pras duas juntas) - a outra deve ser
    // rejeitada com saldo insuficiente, nunca as duas "passando" e
    // deixando o saldo em -1 (o bug de corrida que a auditoria apontou).
    const [respostaA, respostaB] = await Promise.all([
      request(app.getHttpServer())
        .post(`/manutencoes/${manutencaoId}/pecas`)
        .set('Authorization', `Bearer ${token}`)
        .send({ nome: 'Baixa concorrente A', quantidade: 2, itemEstoqueId }),
      request(app.getHttpServer())
        .post(`/manutencoes/${manutencaoId}/pecas`)
        .set('Authorization', `Bearer ${token}`)
        .send({ nome: 'Baixa concorrente B', quantidade: 2, itemEstoqueId }),
    ]);

    const statusCodes = [respostaA.status, respostaB.status].sort();
    expect(statusCodes).toEqual([201, 400]); // uma passa, a outra é rejeitada

    const itemFinal = await request(app.getHttpServer())
      .get(`/estoque/${itemEstoqueId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(itemFinal.body.quantidade).toBeGreaterThanOrEqual(0);
    expect(itemFinal.body.quantidade).toBe(1); // 3 - 2 (só uma baixa efetivada)
  });
});

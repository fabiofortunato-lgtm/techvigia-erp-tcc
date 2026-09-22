import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { PerfilUsuario, TipoManutencao } from '@prisma/client';
import { criarUsuarioTeste } from './helpers/criar-usuario';

describe('Modelo de Checklist (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const adminEmail = 'admin.checklistmodelo.e2e@techvigia-demo.com';
  const tecnicoEmail = 'tecnico.checklistmodelo.e2e@techvigia-demo.com';
  const senha = 'senha12345';
  const cnpj = '77.777.777/0001-88';

  let adminToken: string;
  let tecnicoToken: string;
  let tecnicoId: string;
  let condominioId: string;
  let modeloId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();

    prisma = app.get(PrismaService);

    // Limpeza defensiva - se uma rodada anterior travou no meio (ex: a
    // própria falha que corrigimos aqui, ou qualquer outro motivo), pode
    // ter deixado usuário/condomínio com OS e itens de checklist órfãos
    // pra trás. Apagar direto na ordem errada (usuário antes do que
    // referencia ele) esbarra na mesma chave estrangeira - por isso a
    // ordem aqui vai de dependente para independente.
    const condominioAnterior = await prisma.condominio.findUnique({ where: { cnpj } });
    if (condominioAnterior) {
      const manutencoesOrfas = await prisma.manutencao.findMany({
        where: { condominioId: condominioAnterior.id },
        select: { id: true },
      });
      const idsOrfaos = manutencoesOrfas.map((m) => m.id);
      if (idsOrfaos.length > 0) {
        await prisma.checklistItem.deleteMany({ where: { manutencaoId: { in: idsOrfaos } } });
        await prisma.manutencao.deleteMany({ where: { id: { in: idsOrfaos } } });
      }
    }
    await prisma.usuario.deleteMany({ where: { email: { in: [adminEmail, tecnicoEmail] } } });
    await prisma.condominio.deleteMany({ where: { cnpj } });
    // Limpeza defensiva - se uma rodada anterior deixou modelo de teste
    // pra trás, sem isso o teste de "criar" esbarraria no 409 sem motivo.
    await prisma.checklistModelo.deleteMany({ where: { tipo: TipoManutencao.PREVENTIVA } });

    const admin = await criarUsuarioTeste(prisma, {
      nome: 'Admin Checklist Modelo Teste',
      email: adminEmail,
      senha,
      perfil: PerfilUsuario.ADMIN,
    });
    const loginAdmin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: adminEmail, senha });
    adminToken = loginAdmin.body.accessToken;

    const tecnico = await criarUsuarioTeste(prisma, {
      nome: 'Tecnico Checklist Modelo Teste',
      email: tecnicoEmail,
      senha,
    });
    tecnicoId = tecnico.id;
    const loginTecnico = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: tecnicoEmail, senha });
    tecnicoToken = loginTecnico.body.accessToken;

    const condominio = await prisma.condominio.create({
      data: {
        nome: 'Condomínio Checklist Modelo Teste',
        cnpj,
        endereco: 'Rua do Checklist, 1',
        bairro: 'Centro',
        cidade: 'Rio de Janeiro',
        cep: '20000-000',
        periodicidade: 30,
      },
    });
    condominioId = condominio.id;

    void admin;
  });

  afterAll(async () => {
    await prisma.checklistModelo.deleteMany({ where: { tipo: TipoManutencao.PREVENTIVA } });

    // As OS criadas nos testes ganharam ChecklistItem automaticamente (é
    // literalmente o que este arquivo testa) - precisa apagar esses itens
    // antes de apagar as próprias OS, senão a chave estrangeira bloqueia.
    const manutencoesDoTeste = await prisma.manutencao.findMany({
      where: { condominioId },
      select: { id: true },
    });
    const idsManutencoes = manutencoesDoTeste.map((m) => m.id);
    if (idsManutencoes.length > 0) {
      await prisma.checklistItem.deleteMany({ where: { manutencaoId: { in: idsManutencoes } } });
    }

    await prisma.manutencao.deleteMany({ where: { condominioId } });
    await prisma.condominio.deleteMany({ where: { cnpj } });
    await prisma.usuario.deleteMany({ where: { email: { in: [adminEmail, tecnicoEmail] } } });
    await app.close();
  });

  it('/checklist-modelos (POST) - TECNICO não pode criar modelo (RBAC)', async () => {
    await request(app.getHttpServer())
      .post('/checklist-modelos')
      .set('Authorization', `Bearer ${tecnicoToken}`)
      .send({ tipo: 'PREVENTIVA', nome: 'Checklist Preventiva Teste' })
      .expect(403);
  });

  it('/checklist-modelos (POST) - ADMIN cria o modelo pra um tipo', async () => {
    const response = await request(app.getHttpServer())
      .post('/checklist-modelos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ tipo: 'PREVENTIVA', nome: 'Checklist de CFTV Preventiva' })
      .expect(201);

    expect(response.body.tipo).toBe('PREVENTIVA');
    expect(response.body.nome).toBe('Checklist de CFTV Preventiva');
    modeloId = response.body.id;
  });

  it('/checklist-modelos (POST) - rejeita criar um segundo modelo pro mesmo tipo', async () => {
    await request(app.getHttpServer())
      .post('/checklist-modelos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ tipo: 'PREVENTIVA', nome: 'Outro nome qualquer' })
      .expect(409);
  });

  it('/checklist-modelos/:id (PUT) - renomeia o modelo', async () => {
    const response = await request(app.getHttpServer())
      .put(`/checklist-modelos/${modeloId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nome: 'Checklist de CFTV Preventiva (revisado)' })
      .expect(200);

    expect(response.body.nome).toBe('Checklist de CFTV Preventiva (revisado)');
  });

  it('/checklist-modelos/:id/itens (POST) - TECNICO não pode adicionar item (RBAC)', async () => {
    await request(app.getHttpServer())
      .post(`/checklist-modelos/${modeloId}/itens`)
      .set('Authorization', `Bearer ${tecnicoToken}`)
      .send({ item: 'Verificar foco das câmeras' })
      .expect(403);
  });

  it('/checklist-modelos/:id/itens (POST) - ADMIN adiciona itens, em ordem', async () => {
    const item1 = await request(app.getHttpServer())
      .post(`/checklist-modelos/${modeloId}/itens`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ item: 'Verificar foco das câmeras' })
      .expect(201);
    expect(item1.body.ordem).toBe(0);

    const item2 = await request(app.getHttpServer())
      .post(`/checklist-modelos/${modeloId}/itens`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ item: 'Testar gravação do DVR' })
      .expect(201);
    expect(item2.body.ordem).toBe(1);
  });

  it('/checklist-modelos/:id (GET) - traz os itens em ordem', async () => {
    const response = await request(app.getHttpServer())
      .get(`/checklist-modelos/${modeloId}`)
      .set('Authorization', `Bearer ${tecnicoToken}`)
      .expect(200);

    expect(response.body.itens).toHaveLength(2);
    expect(response.body.itens[0].item).toBe('Verificar foco das câmeras');
    expect(response.body.itens[1].item).toBe('Testar gravação do DVR');
  });

  it('/manutencoes (POST) - criar uma OS Preventiva puxa o checklist do modelo automaticamente', async () => {
    const manutencao = await request(app.getHttpServer())
      .post('/manutencoes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        condominioId,
        tecnicoId,
        tipo: 'PREVENTIVA',
        inicio: new Date().toISOString(),
      })
      .expect(201);

    const checklist = await request(app.getHttpServer())
      .get(`/manutencoes/${manutencao.body.id}/checklist`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(checklist.body).toHaveLength(2);
    const itens = checklist.body.map((c: { item: string }) => c.item);
    expect(itens).toContain('Verificar foco das câmeras');
    expect(itens).toContain('Testar gravação do DVR');
  });

  it('/manutencoes (POST) - OS Corretiva não puxa nada, já que não existe modelo pra esse tipo', async () => {
    const manutencao = await request(app.getHttpServer())
      .post('/manutencoes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        condominioId,
        tecnicoId,
        tipo: 'CORRETIVA',
        inicio: new Date().toISOString(),
      })
      .expect(201);

    const checklist = await request(app.getHttpServer())
      .get(`/manutencoes/${manutencao.body.id}/checklist`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(checklist.body).toHaveLength(0);
  });

  it('/checklist-modelos/itens/:itemId (DELETE) - remove um item do modelo', async () => {
    const modeloAntes = await request(app.getHttpServer())
      .get(`/checklist-modelos/${modeloId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    const itemId = modeloAntes.body.itens[0].id;

    await request(app.getHttpServer())
      .delete(`/checklist-modelos/itens/${itemId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const modeloDepois = await request(app.getHttpServer())
      .get(`/checklist-modelos/${modeloId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(modeloDepois.body.itens).toHaveLength(1);
  });

  it('/checklist-modelos/:id (DELETE) - TECNICO não pode remover o modelo (RBAC)', async () => {
    await request(app.getHttpServer())
      .delete(`/checklist-modelos/${modeloId}`)
      .set('Authorization', `Bearer ${tecnicoToken}`)
      .expect(403);
  });
});

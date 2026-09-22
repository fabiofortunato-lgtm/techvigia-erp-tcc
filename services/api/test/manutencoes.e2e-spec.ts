import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { PerfilUsuario } from '@prisma/client';
import { criarUsuarioTeste } from './helpers/criar-usuario';

describe('Manutencoes / Agenda (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const adminEmail = 'admin.agenda.e2e@techvigia-demo.com';
  const tecnicoEmail = 'tecnico.agenda.e2e@techvigia-demo.com';
  const senha = 'senha12345';

  let adminToken: string;
  let tecnicoToken: string;
  let tecnicoId: string;
  let condominioId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();

    prisma = app.get(PrismaService);

    // Limpeza de execuções anteriores
    await prisma.usuario.deleteMany({
      where: { email: { in: [adminEmail, tecnicoEmail] } },
    });
    await prisma.condominio.deleteMany({ where: { cnpj: '22.222.222/0001-22' } });

    // Cria usuário admin direto via Prisma (POST /auth/register só serve
    // para o bootstrap do primeiro usuário do sistema, ver auth.service.ts)
    await criarUsuarioTeste(prisma, {
      nome: 'Admin Agenda Teste',
      email: adminEmail,
      senha,
      perfil: PerfilUsuario.ADMIN,
    });
    const loginAdmin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: adminEmail, senha });
    adminToken = loginAdmin.body.accessToken;

    // Cria usuário técnico (fica com perfil padrão TECNICO)
    await criarUsuarioTeste(prisma, { nome: 'Tecnico Agenda Teste', email: tecnicoEmail, senha });

    const tecnico = await prisma.usuario.findUnique({
      where: { email: tecnicoEmail },
    });
    if (!tecnico) {
      throw new Error('Falha ao criar usuário técnico para o teste');
    }
    tecnicoId = tecnico.id;

    const loginTecnico = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: tecnicoEmail, senha });
    tecnicoToken = loginTecnico.body.accessToken;

    // Cria um condomínio de apoio para os testes
    const condominio = await request(app.getHttpServer())
      .post('/condominios')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        nome: 'Condomínio Agenda Teste',
        cnpj: '22.222.222/0001-22',
        endereco: 'Rua da Agenda, 1',
        bairro: 'Centro',
        cidade: 'Rio de Janeiro',
        cep: '20000-000',
        periodicidade: 30,
      });
    condominioId = condominio.body.id;
  });

  afterAll(async () => {
    await prisma.manutencao.deleteMany({ where: { condominioId } });
    await prisma.condominio.deleteMany({ where: { id: condominioId } });
    await prisma.usuario.deleteMany({
      where: { email: { in: [adminEmail, tecnicoEmail] } },
    });
    await app.close();
  });

  let manutencaoId: string;

  it('/manutencoes (POST) - TECNICO não pode agendar uma visita (RBAC)', async () => {
    await request(app.getHttpServer())
      .post('/manutencoes')
      .set('Authorization', `Bearer ${tecnicoToken}`)
      .send({
        condominioId,
        tecnicoId,
        inicio: new Date().toISOString(),
      })
      .expect(403);
  });

  it('/manutencoes (POST) - ADMIN consegue agendar uma visita e recebe numeroOS', async () => {
    const response = await request(app.getHttpServer())
      .post('/manutencoes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        condominioId,
        tecnicoId,
        inicio: new Date().toISOString(),
        observacao: 'Manutenção preventiva de teste',
      })
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body.numeroOS).toMatch(/^OS-\d{4}\d{6}$/);
    expect(response.body.status).toBe('AGENDADA');
    // Valores padrão do schema quando tipo/prioridade não são informados
    expect(response.body.tipo).toBe('PREVENTIVA');
    expect(response.body.prioridade).toBe('MEDIA');
    // Visita agendada pelo painel - não é chamado avulso por padrão
    expect(response.body.chamadoAvulso).toBe(false);

    manutencaoId = response.body.id;
  });

  it('/manutencoes (POST) - deve gravar chamadoAvulso quando informado explicitamente', async () => {
    const response = await request(app.getHttpServer())
      .post('/manutencoes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        condominioId,
        tecnicoId,
        inicio: new Date().toISOString(),
        chamadoAvulso: true,
      })
      .expect(201);

    expect(response.body.chamadoAvulso).toBe(true);
  });

  it('/manutencoes (POST) - deve aceitar tipo e prioridade explícitos', async () => {
    const response = await request(app.getHttpServer())
      .post('/manutencoes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        condominioId,
        tecnicoId,
        inicio: new Date().toISOString(),
        tipo: 'CORRETIVA',
        prioridade: 'ALTA',
      })
      .expect(201);

    expect(response.body.tipo).toBe('CORRETIVA');
    expect(response.body.prioridade).toBe('ALTA');
  });

  it('/manutencoes (POST) - criações simultâneas nunca geram o mesmo numeroOS (contador atômico)', async () => {
    // Antes da correção (count()+1), duas requisições concorrentes liam a
    // mesma contagem e podiam gerar o mesmo numeroOS - a segunda estourava
    // erro 500 na constraint de unicidade. Dispara várias criações ao
    // mesmo tempo, de propósito, e confirma que todas saem com número
    // diferente.
    const respostas = await Promise.all(
      Array.from({ length: 5 }).map(() =>
        request(app.getHttpServer())
          .post('/manutencoes')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ condominioId, tecnicoId, inicio: new Date().toISOString() }),
      ),
    );

    respostas.forEach((r) => expect(r.status).toBe(201));

    const numeros = respostas.map((r) => r.body.numeroOS);
    const numerosUnicos = new Set(numeros);
    expect(numerosUnicos.size).toBe(numeros.length);
  });

  it('/manutencoes (POST) - deve rejeitar condomínio inexistente', async () => {
    await request(app.getHttpServer())
      .post('/manutencoes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        condominioId: '00000000-0000-0000-0000-000000000000',
        tecnicoId,
        inicio: new Date().toISOString(),
      })
      .expect(400);
  });

  it('/manutencoes (GET) - deve filtrar a agenda por tecnicoId', async () => {
    const response = await request(app.getHttpServer())
      .get(`/manutencoes?tecnicoId=${tecnicoId}`)
      .set('Authorization', `Bearer ${tecnicoToken}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(
      response.body.some((m: { id: string }) => m.id === manutencaoId),
    ).toBe(true);
  });

  it('/manutencoes (GET) - filtro de "hoje" (dataInicio=dataFim=hoje) deve incluir OS iniciada hoje', async () => {
    // Antes da correção do fuso horário, isso sempre voltava vazio:
    // new Date("2026-08-17") é interpretado como meia-noite UTC, que em
    // horário de Brasília já é 21h do dia ANTERIOR - filtrar "hoje" gerava
    // uma janela de zero segundos, nunca incluindo nenhuma OS agendada
    // pro próprio dia.
    // Calculado com os componentes locais (ano/mês/dia), não com
    // toISOString() - esse sempre devolve a data em UTC, que à noite no
    // fuso de Brasília (UTC-3) já é o dia SEGUINTE. Usar toISOString()
    // aqui reproduziria bem aqui dentro do teste o mesmo bug de fuso
    // horário que a correção comentada acima resolveu no filtro de
    // verdade - o teste ficaria flaky, falhando só depois das 21h.
    const agora = new Date();
    const hoje = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;

    const response = await request(app.getHttpServer())
      .get(`/manutencoes?dataInicio=${hoje}&dataFim=${hoje}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(
      response.body.some((m: { id: string }) => m.id === manutencaoId),
    ).toBe(true);
  });

  it('/manutencoes/:id/checkin (POST) - técnico faz check-in e status vira EM_ANDAMENTO', async () => {
    const response = await request(app.getHttpServer())
      .post(`/manutencoes/${manutencaoId}/checkin`)
      .set('Authorization', `Bearer ${tecnicoToken}`)
      .send({ latitude: -22.9068, longitude: -43.1729 })
      .expect(201);

    expect(response.body.status).toBe('EM_ANDAMENTO');
    expect(response.body.latitudeCheckin).toBeCloseTo(-22.9068);
  });

  it('/manutencoes/:id/checkin (POST) - deve rejeitar check-in duplicado (status já não é AGENDADA)', async () => {
    await request(app.getHttpServer())
      .post(`/manutencoes/${manutencaoId}/checkin`)
      .set('Authorization', `Bearer ${tecnicoToken}`)
      .send({ latitude: -22.9068, longitude: -43.1729 })
      .expect(400);
  });

  it('/manutencoes/:id/observacao (PATCH) - TECNICO consegue salvar observação (sem RBAC de perfil)', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/manutencoes/${manutencaoId}/observacao`)
      .set('Authorization', `Bearer ${tecnicoToken}`)
      .send({ observacao: 'Tudo funcionando normalmente, sem intercorrências.' })
      .expect(200);

    expect(response.body.observacao).toBe('Tudo funcionando normalmente, sem intercorrências.');
  });

  it('/manutencoes/:id/observacao (PATCH) - deve rejeitar corpo sem o campo observacao', async () => {
    await request(app.getHttpServer())
      .patch(`/manutencoes/${manutencaoId}/observacao`)
      .set('Authorization', `Bearer ${tecnicoToken}`)
      .send({})
      .expect(400);
  });

  it('/manutencoes/:id (DELETE) - TECNICO não pode cancelar (RBAC)', async () => {
    await request(app.getHttpServer())
      .delete(`/manutencoes/${manutencaoId}`)
      .set('Authorization', `Bearer ${tecnicoToken}`)
      .expect(403);
  });

  it('/manutencoes/:id (DELETE) - ADMIN cancela a manutenção', async () => {
    const response = await request(app.getHttpServer())
      .delete(`/manutencoes/${manutencaoId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.status).toBe('CANCELADA');
  });

  describe('Escopo de técnico - um técnico não pode mexer na OS de outro', () => {
    const outroTecnicoEmail = 'outro.tecnico.agenda.e2e@techvigia-demo.com';
    let outroTecnicoToken: string;
    let manutencaoDoTecnicoOriginal: string;

    beforeAll(async () => {
      await criarUsuarioTeste(prisma, { nome: 'Outro Técnico', email: outroTecnicoEmail, senha });
      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: outroTecnicoEmail, senha });
      outroTecnicoToken = login.body.accessToken;

      // Nova OS, atribuída ao técnico ORIGINAL (tecnicoId) - não ao "outro técnico"
      const resposta = await request(app.getHttpServer())
        .post('/manutencoes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ condominioId, tecnicoId, inicio: new Date().toISOString() });
      manutencaoDoTecnicoOriginal = resposta.body.id;
    });

    afterAll(async () => {
      await prisma.usuario.deleteMany({ where: { email: outroTecnicoEmail } });
    });

    it('GET /manutencoes/:id - "outro técnico" não pode ler a OS de quem não é ele', async () => {
      await request(app.getHttpServer())
        .get(`/manutencoes/${manutencaoDoTecnicoOriginal}`)
        .set('Authorization', `Bearer ${outroTecnicoToken}`)
        .expect(403);
    });

    it('POST /manutencoes/:id/checkin - "outro técnico" não pode fazer check-in em OS alheia', async () => {
      await request(app.getHttpServer())
        .post(`/manutencoes/${manutencaoDoTecnicoOriginal}/checkin`)
        .set('Authorization', `Bearer ${outroTecnicoToken}`)
        .send({ latitude: -22.9068, longitude: -43.1729 })
        .expect(403);
    });

    it('PATCH /manutencoes/:id/observacao - "outro técnico" não pode editar observação de OS alheia', async () => {
      await request(app.getHttpServer())
        .patch(`/manutencoes/${manutencaoDoTecnicoOriginal}/observacao`)
        .set('Authorization', `Bearer ${outroTecnicoToken}`)
        .send({ observacao: 'Tentando editar OS de outra pessoa' })
        .expect(403);
    });

    it('GET /manutencoes/:id/checklist - "outro técnico" não pode ver o checklist de OS alheia', async () => {
      await request(app.getHttpServer())
        .get(`/manutencoes/${manutencaoDoTecnicoOriginal}/checklist`)
        .set('Authorization', `Bearer ${outroTecnicoToken}`)
        .expect(403);
    });

    it('GET /manutencoes/:id/fotos - "outro técnico" não pode ver as fotos de OS alheia', async () => {
      await request(app.getHttpServer())
        .get(`/manutencoes/${manutencaoDoTecnicoOriginal}/fotos`)
        .set('Authorization', `Bearer ${outroTecnicoToken}`)
        .expect(403);
    });

    it('GET /manutencoes/:id/pecas - "outro técnico" não pode ver as peças de OS alheia', async () => {
      await request(app.getHttpServer())
        .get(`/manutencoes/${manutencaoDoTecnicoOriginal}/pecas`)
        .set('Authorization', `Bearer ${outroTecnicoToken}`)
        .expect(403);
    });

    it('GET /manutencoes (agenda) - "outro técnico" só vê as próprias OS, mesmo pedindo tecnicoId de outra pessoa', async () => {
      const response = await request(app.getHttpServer())
        .get(`/manutencoes?tecnicoId=${tecnicoId}`) // tenta pedir a agenda do OUTRO técnico
        .set('Authorization', `Bearer ${outroTecnicoToken}`)
        .expect(200);

      // O filtro de tecnicoId da query é ignorado pra perfil TECNICO - a
      // API sempre substitui pelo próprio id de quem está logado. Como
      // "outro técnico" não tem nenhuma OS atribuída, a lista vem vazia,
      // e a OS do técnico original não aparece nela.
      expect(
        response.body.some((m: { id: string }) => m.id === manutencaoDoTecnicoOriginal),
      ).toBe(false);
    });

    it('GET /manutencoes/:id - ADMIN continua acessando qualquer OS normalmente', async () => {
      await request(app.getHttpServer())
        .get(`/manutencoes/${manutencaoDoTecnicoOriginal}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('GET /manutencoes/:id - o técnico DONO da OS continua acessando normalmente', async () => {
      await request(app.getHttpServer())
        .get(`/manutencoes/${manutencaoDoTecnicoOriginal}`)
        .set('Authorization', `Bearer ${tecnicoToken}`)
        .expect(200);
    });
  });
});

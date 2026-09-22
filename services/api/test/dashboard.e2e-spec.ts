import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { PerfilUsuario, StatusManutencao } from '@prisma/client';
import { criarUsuarioTeste } from './helpers/criar-usuario';

describe('Dashboard (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const adminEmail = 'admin.dashboard.e2e@techvigia-demo.com';
  const tecnicoEmail = 'tecnico.dashboard.e2e@techvigia-demo.com';
  const senha = 'senha12345';

  let token: string;
  let tecnicoId: string;

  const cnpjs = {
    semManutencao: '77.777.771/0001-77',
    recente: '77.777.772/0001-77',
    atrasado: '77.777.773/0001-77',
  };

  const condominioIds: Record<string, string> = {};

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
    await prisma.condominio.deleteMany({ where: { cnpj: { in: Object.values(cnpjs) } } });

    await criarUsuarioTeste(prisma, {
      nome: 'Admin Dashboard Teste',
      email: adminEmail,
      senha,
      perfil: PerfilUsuario.ADMIN,
    });
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: adminEmail, senha });
    token = login.body.accessToken;

    await criarUsuarioTeste(prisma, { nome: 'Tecnico Dashboard Teste', email: tecnicoEmail, senha });
    const tecnico = await prisma.usuario.findUnique({ where: { email: tecnicoEmail } });
    if (!tecnico) throw new Error('Falha ao criar técnico para o teste');
    tecnicoId = tecnico.id;

    // Condomínio A: nunca teve manutenção concluída -> esperado PENDENTE
    const respA = await request(app.getHttpServer())
      .post('/condominios')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nome: 'Condomínio Dashboard Sem Manutenção',
        cnpj: cnpjs.semManutencao,
        endereco: 'Rua A, 1',
        bairro: 'Centro',
        cidade: 'Rio de Janeiro',
        cep: '20000-000',
        periodicidade: 30,
      });
    condominioIds.semManutencao = respA.body.id;

    // Condomínio B: manutenção concluída há poucos dias -> esperado CONCLUIDO
    const respB = await request(app.getHttpServer())
      .post('/condominios')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nome: 'Condomínio Dashboard Recente',
        cnpj: cnpjs.recente,
        endereco: 'Rua B, 1',
        bairro: 'Centro',
        cidade: 'Rio de Janeiro',
        cep: '20000-000',
        periodicidade: 30,
      });
    condominioIds.recente = respB.body.id;
    await prisma.manutencao.create({
      data: {
        numeroOS: 'OS-DASHTEST-RECENTE',
        condominioId: condominioIds.recente,
        tecnicoId,
        status: StatusManutencao.CONCLUIDA,
        inicio: new Date(),
        fim: new Date(), // concluída agora mesmo
      },
    });

    // Condomínio C: manutenção concluída há muito tempo (periodicidade já
    // vencida) -> esperado ATRASADO
    const respC = await request(app.getHttpServer())
      .post('/condominios')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nome: 'Condomínio Dashboard Atrasado',
        cnpj: cnpjs.atrasado,
        endereco: 'Rua C, 1',
        bairro: 'Centro',
        cidade: 'Rio de Janeiro',
        cep: '20000-000',
        periodicidade: 30,
      });
    condominioIds.atrasado = respC.body.id;
    const seiscentosDiasAtras = new Date(Date.now() - 600 * 24 * 60 * 60 * 1000);
    await prisma.manutencao.create({
      data: {
        numeroOS: 'OS-DASHTEST-ATRASADO',
        condominioId: condominioIds.atrasado,
        tecnicoId,
        status: StatusManutencao.CONCLUIDA,
        inicio: seiscentosDiasAtras,
        fim: seiscentosDiasAtras,
      },
    });

    // Uma OS em andamento para o técnico, para testar "técnico em campo"
    await prisma.manutencao.create({
      data: {
        numeroOS: 'OS-DASHTEST-EMANDAMENTO',
        condominioId: condominioIds.recente,
        tecnicoId,
        status: StatusManutencao.EM_ANDAMENTO,
        inicio: new Date(),
      },
    });
  });

  afterAll(async () => {
    await prisma.manutencao.deleteMany({
      where: { condominioId: { in: Object.values(condominioIds) } },
    });
    await prisma.condominio.deleteMany({ where: { cnpj: { in: Object.values(cnpjs) } } });
    await prisma.usuario.deleteMany({
      where: { email: { in: [adminEmail, tecnicoEmail] } },
    });
    await app.close();
  });

  it('/dashboard (GET) - deve rejeitar acesso sem token', async () => {
    await request(app.getHttpServer()).get('/dashboard').expect(401);
  });

  it('/dashboard (GET) - calcula corretamente o status de cada condomínio', async () => {
    const response = await request(app.getHttpServer())
      .get('/dashboard')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const lista = response.body.condominios.lista as {
      id: string;
      status: string;
      numeroCameras: number;
    }[];

    const semManutencao = lista.find((c) => c.id === condominioIds.semManutencao);
    const recente = lista.find((c) => c.id === condominioIds.recente);
    const atrasado = lista.find((c) => c.id === condominioIds.atrasado);

    expect(semManutencao?.status).toBe('PENDENTE');
    expect(recente?.status).toBe('CONCLUIDO');
    expect(atrasado?.status).toBe('ATRASADO');
    expect(typeof semManutencao?.numeroCameras).toBe('number');

    expect(response.body.condominios.total).toBeGreaterThanOrEqual(3);
    expect(response.body.condominios.concluidos).toBeGreaterThanOrEqual(1);
    expect(response.body.condominios.atrasados).toBeGreaterThanOrEqual(1);
  });

  it('/dashboard (GET) - conta ordens de serviço por status', async () => {
    const response = await request(app.getHttpServer())
      .get('/dashboard')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.ordensServico.emAndamento).toBeGreaterThanOrEqual(1);
    expect(response.body.ordensServico.concluidas).toBeGreaterThanOrEqual(2);
    expect(response.body.ordensServico.total).toBe(
      response.body.ordensServico.abertas +
        response.body.ordensServico.emAndamento +
        response.body.ordensServico.atrasadas +
        response.body.ordensServico.concluidas,
    );
  });

  it('/dashboard (GET) - identifica técnico em campo com o condomínio atual', async () => {
    const response = await request(app.getHttpServer())
      .get('/dashboard')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const tecnico = response.body.tecnicos.lista.find(
      (t: { id: string }) => t.id === tecnicoId,
    );

    expect(tecnico.status).toBe('EM_CAMPO');
    expect(tecnico.condominioAtual).toBe('Condomínio Dashboard Recente');
    expect(response.body.tecnicos.emCampo).toBeGreaterThanOrEqual(1);
  });

  describe('Tolerância de 48h para chamado avulso não contar como atrasado', () => {
    it('chamado avulso com 1h de atraso ainda conta como "abertas", não "atrasadas"', async () => {
      const antes = await request(app.getHttpServer())
        .get('/dashboard')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000);
      await prisma.manutencao.create({
        data: {
          numeroOS: 'OS-DASHTEST-AVULSO-RECENTE',
          condominioId: condominioIds.semManutencao,
          tecnicoId,
          status: StatusManutencao.AGENDADA,
          inicio: umaHoraAtras,
          chamadoAvulso: true,
        },
      });

      const depois = await request(app.getHttpServer())
        .get('/dashboard')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(depois.body.ordensServico.abertas).toBe(antes.body.ordensServico.abertas + 1);
      expect(depois.body.ordensServico.atrasadas).toBe(antes.body.ordensServico.atrasadas);

      await prisma.manutencao.deleteMany({ where: { numeroOS: 'OS-DASHTEST-AVULSO-RECENTE' } });
    });

    it('chamado avulso com mais de 48h de atraso conta como "atrasadas"', async () => {
      const cinquentaHorasAtras = new Date(Date.now() - 50 * 60 * 60 * 1000);
      await prisma.manutencao.create({
        data: {
          numeroOS: 'OS-DASHTEST-AVULSO-ANTIGO',
          condominioId: condominioIds.semManutencao,
          tecnicoId,
          status: StatusManutencao.AGENDADA,
          inicio: cinquentaHorasAtras,
          chamadoAvulso: true,
        },
      });

      const response = await request(app.getHttpServer())
        .get('/dashboard')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.ordensServico.atrasadas).toBeGreaterThanOrEqual(1);

      await prisma.manutencao.deleteMany({ where: { numeroOS: 'OS-DASHTEST-AVULSO-ANTIGO' } });
    });

    it('visita agendada de verdade (não avulsa) com 1h de atraso já conta como "atrasadas"', async () => {
      const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000);
      await prisma.manutencao.create({
        data: {
          numeroOS: 'OS-DASHTEST-AGENDADA-ATRASADA',
          condominioId: condominioIds.semManutencao,
          tecnicoId,
          status: StatusManutencao.AGENDADA,
          inicio: umaHoraAtras,
          chamadoAvulso: false,
        },
      });

      const response = await request(app.getHttpServer())
        .get('/dashboard')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.ordensServico.atrasadas).toBeGreaterThanOrEqual(1);

      await prisma.manutencao.deleteMany({ where: { numeroOS: 'OS-DASHTEST-AGENDADA-ATRASADA' } });
    });
  });
});


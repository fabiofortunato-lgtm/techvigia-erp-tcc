import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { PerfilUsuario, StatusManutencao } from '@prisma/client';
import { criarUsuarioTeste } from './helpers/criar-usuario';

describe('Relatórios (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const adminEmail = 'admin.relatorios.e2e@techvigia-demo.com';
  const tecnicoEmail = 'tecnico.relatorios.e2e@techvigia-demo.com';
  const senha = 'senha12345';

  let token: string;
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

    await prisma.usuario.deleteMany({ where: { email: { in: [adminEmail, tecnicoEmail] } } });
    await prisma.condominio.deleteMany({ where: { cnpj: '99.999.999/0001-99' } });

    await criarUsuarioTeste(prisma, {
      nome: 'Admin Relatórios Teste',
      email: adminEmail,
      senha,
      perfil: PerfilUsuario.ADMIN,
    });
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: adminEmail, senha });
    token = login.body.accessToken;

    await criarUsuarioTeste(prisma, { nome: 'Técnico Relatórios Teste', email: tecnicoEmail, senha });
    const tecnico = await prisma.usuario.findUnique({ where: { email: tecnicoEmail } });
    if (!tecnico) throw new Error('Falha ao criar técnico para o teste');
    tecnicoId = tecnico.id;

    const condominio = await request(app.getHttpServer())
      .post('/condominios')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nome: 'Condomínio Relatórios Teste',
        cnpj: '99.999.999/0001-99',
        endereco: 'Rua dos Relatórios, 1',
        bairro: 'Centro',
        cidade: 'Rio de Janeiro',
        cep: '20000-000',
        periodicidade: 30,
      });
    condominioId = condominio.body.id;

    // 2 manutenções pro técnico: 1 concluída, 1 ainda agendada
    await prisma.manutencao.create({
      data: {
        numeroOS: 'OS-RELTEST-001',
        condominioId,
        tecnicoId,
        status: StatusManutencao.CONCLUIDA,
        inicio: new Date(),
        fim: new Date(),
      },
    });
    await prisma.manutencao.create({
      data: {
        numeroOS: 'OS-RELTEST-002',
        condominioId,
        tecnicoId,
        status: StatusManutencao.AGENDADA,
        inicio: new Date(),
      },
    });
  });

  afterAll(async () => {
    await prisma.manutencao.deleteMany({ where: { condominioId } });
    await prisma.condominio.deleteMany({ where: { id: condominioId } });
    await prisma.usuario.deleteMany({ where: { email: { in: [adminEmail, tecnicoEmail] } } });
    await app.close();
  });

  it('/relatorios/os-por-tecnico (GET) - deve rejeitar acesso sem token', async () => {
    await request(app.getHttpServer()).get('/relatorios/os-por-tecnico').expect(401);
  });

  it('/relatorios/os-por-tecnico (GET) - deve contar total e concluídas corretamente por técnico', async () => {
    const response = await request(app.getHttpServer())
      .get('/relatorios/os-por-tecnico')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const registro = response.body.find(
      (r: { tecnicoId: string }) => r.tecnicoId === tecnicoId,
    );

    expect(registro).toBeDefined();
    expect(registro.total).toBeGreaterThanOrEqual(2);
    expect(registro.concluidas).toBeGreaterThanOrEqual(1);
  });

  it('/relatorios/os-por-tecnico (GET) - não deve incluir técnicos sem nenhuma OS atribuída', async () => {
    const emailSemOs = 'tecnico.sem.os.e2e@techvigia-demo.com';
    await prisma.usuario.deleteMany({ where: { email: emailSemOs } });
    await criarUsuarioTeste(prisma, { nome: 'Técnico Sem OS', email: emailSemOs, senha });
    const tecnicoSemOs = await prisma.usuario.findUnique({ where: { email: emailSemOs } });

    const response = await request(app.getHttpServer())
      .get('/relatorios/os-por-tecnico')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.some((r: { tecnicoId: string }) => r.tecnicoId === tecnicoSemOs!.id)).toBe(
      false,
    );

    await prisma.usuario.deleteMany({ where: { email: emailSemOs } });
  });

  it('/relatorios/os-por-tecnico?condominioId= (GET) - filtra só as OS daquele condomínio', async () => {
    const outroCondominio = await request(app.getHttpServer())
      .post('/condominios')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nome: 'Outro Condomínio Relatórios Teste',
        cnpj: '99.999.999/0001-88',
        endereco: 'Rua dos Relatórios, 2',
        bairro: 'Centro',
        cidade: 'Rio de Janeiro',
        cep: '20000-000',
        periodicidade: 30,
      });
    const outroCondominioId = outroCondominio.body.id;

    const osOutroCondominio = await prisma.manutencao.create({
      data: {
        numeroOS: 'OS-RELTEST-OUTRO-COND',
        condominioId: outroCondominioId,
        tecnicoId,
        status: StatusManutencao.CONCLUIDA,
        inicio: new Date(),
        fim: new Date(),
      },
    });

    try {
      const response = await request(app.getHttpServer())
        .get('/relatorios/os-por-tecnico')
        .query({ condominioId })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const registro = response.body.find(
        (r: { tecnicoId: string }) => r.tecnicoId === tecnicoId,
      );

      // Só as 2 OS do condomínio original entram na contagem - a OS do
      // "outro condomínio" (criada só nesse teste) fica de fora.
      expect(registro.total).toBe(2);
    } finally {
      await prisma.manutencao.deleteMany({ where: { id: osOutroCondominio.id } });
      await prisma.condominio.deleteMany({ where: { id: outroCondominioId } });
    }
  });
});

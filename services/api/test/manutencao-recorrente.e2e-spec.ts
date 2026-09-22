import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { ManutencaoRecorrenteService } from '../src/manutencao-recorrente/manutencao-recorrente.service';
import { PerfilUsuario, TipoManutencao, StatusManutencao } from '@prisma/client';
import { criarUsuarioTeste } from './helpers/criar-usuario';

describe('Manutenção Recorrente (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let servico: ManutencaoRecorrenteService;

  const adminEmail = 'admin.recorrente.e2e@techvigia-demo.com';
  const tecnicoEmail = 'tecnico.recorrente.e2e@techvigia-demo.com';
  const senha = 'senha12345';

  let adminToken: string;
  let tecnicoToken: string;
  let tecnicoId: string;

  // Um condomínio por cenário, pra não misturar estado entre os testes.
  const cnpjSemHistorico = '11.222.333/0001-11';
  const cnpjRecente = '11.222.333/0001-22';
  const cnpjVencido = '11.222.333/0001-33';
  const cnpjJaAberta = '11.222.333/0001-44';

  const condominioIds: string[] = [];
  const manutencaoIdsCriadas: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();

    prisma = app.get(PrismaService);
    servico = app.get(ManutencaoRecorrenteService);

    await prisma.usuario.deleteMany({ where: { email: { in: [adminEmail, tecnicoEmail] } } });
    await prisma.condominio.deleteMany({
      where: { cnpj: { in: [cnpjSemHistorico, cnpjRecente, cnpjVencido, cnpjJaAberta] } },
    });

    const admin = await criarUsuarioTeste(prisma, {
      nome: 'Admin Recorrente Teste',
      email: adminEmail,
      senha,
      perfil: PerfilUsuario.ADMIN,
    });
    const loginAdmin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: adminEmail, senha });
    adminToken = loginAdmin.body.accessToken;

    const tecnico = await criarUsuarioTeste(prisma, {
      nome: 'Tecnico Recorrente Teste',
      email: tecnicoEmail,
      senha,
    });
    tecnicoId = tecnico.id;
    const loginTecnico = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: tecnicoEmail, senha });
    tecnicoToken = loginTecnico.body.accessToken;

    void admin;
  });

  afterAll(async () => {
    if (manutencaoIdsCriadas.length > 0) {
      await prisma.checklistItem.deleteMany({
        where: { manutencaoId: { in: manutencaoIdsCriadas } },
      });
      await prisma.manutencao.deleteMany({ where: { id: { in: manutencaoIdsCriadas } } });
    }
    if (condominioIds.length > 0) {
      await prisma.manutencao.deleteMany({ where: { condominioId: { in: condominioIds } } });
      await prisma.condominio.deleteMany({ where: { id: { in: condominioIds } } });
    }
    await prisma.usuario.deleteMany({ where: { email: { in: [adminEmail, tecnicoEmail] } } });
    await app.close();
  });

  async function criarCondominio(nome: string, cnpj: string, periodicidade: number) {
    const condominio = await prisma.condominio.create({
      data: {
        nome,
        cnpj,
        endereco: 'Rua de Teste, 1',
        bairro: 'Centro',
        cidade: 'Rio de Janeiro',
        cep: '20000-000',
        periodicidade,
      },
    });
    condominioIds.push(condominio.id);
    return condominio;
  }

  it('condomínio sem nenhuma preventiva anterior - gera a primeira, sem técnico', async () => {
    const condominio = await criarCondominio(
      'Condomínio Sem Histórico Teste',
      cnpjSemHistorico,
      30,
    );

    const criada = await servico.processarCondominio(condominio.id);

    expect(criada).not.toBeNull();
    expect(criada!.tecnicoId).toBeNull();
    expect(criada!.tipo).toBe(TipoManutencao.PREVENTIVA);
    expect(criada!.status).toBe(StatusManutencao.AGENDADA);
    manutencaoIdsCriadas.push(criada!.id);
  });

  it('condomínio com preventiva recente (dentro da periodicidade) - não gera nova', async () => {
    const condominio = await criarCondominio('Condomínio Recente Teste', cnpjRecente, 30);

    const anterior = await prisma.manutencao.create({
      data: {
        numeroOS: 'OS-TESTE-RECORRENTE-RECENTE',
        condominioId: condominio.id,
        tipo: TipoManutencao.PREVENTIVA,
        status: StatusManutencao.CONCLUIDA,
        inicio: new Date(), // hoje - bem dentro dos 30 dias de periodicidade
      },
    });
    manutencaoIdsCriadas.push(anterior.id);

    const resultado = await servico.processarCondominio(condominio.id);

    expect(resultado).toBeNull();
  });

  it('condomínio com preventiva vencida (fora da periodicidade) - gera nova', async () => {
    const condominio = await criarCondominio('Condomínio Vencido Teste', cnpjVencido, 30);

    const dataAntiga = new Date();
    dataAntiga.setDate(dataAntiga.getDate() - 45); // 45 dias atrás, periodicidade é 30

    const anterior = await prisma.manutencao.create({
      data: {
        numeroOS: 'OS-TESTE-RECORRENTE-VENCIDA',
        condominioId: condominio.id,
        tipo: TipoManutencao.PREVENTIVA,
        status: StatusManutencao.CONCLUIDA,
        inicio: dataAntiga,
      },
    });
    manutencaoIdsCriadas.push(anterior.id);

    const criada = await servico.processarCondominio(condominio.id);

    expect(criada).not.toBeNull();
    expect(criada!.tecnicoId).toBeNull();
    manutencaoIdsCriadas.push(criada!.id);
  });

  it('condomínio que já tem uma preventiva em aberto - não gera outra, mesmo vencida', async () => {
    const condominio = await criarCondominio('Condomínio Já Aberta Teste', cnpjJaAberta, 30);

    const dataAntiga = new Date();
    dataAntiga.setDate(dataAntiga.getDate() - 45);

    const aberta = await prisma.manutencao.create({
      data: {
        numeroOS: 'OS-TESTE-RECORRENTE-ABERTA',
        condominioId: condominio.id,
        tipo: TipoManutencao.PREVENTIVA,
        status: StatusManutencao.AGENDADA, // continua aberta - ninguém atribuiu técnico ainda
        inicio: dataAntiga,
      },
    });
    manutencaoIdsCriadas.push(aberta.id);

    const resultado = await servico.processarCondominio(condominio.id);

    expect(resultado).toBeNull();
  });

  it('/manutencoes-recorrentes/executar (POST) - TECNICO não pode disparar manualmente (RBAC)', async () => {
    await request(app.getHttpServer())
      .post('/manutencoes-recorrentes/executar')
      .set('Authorization', `Bearer ${tecnicoToken}`)
      .expect(403);
  });

  it('/manutencoes-recorrentes/executar (POST) - ADMIN dispara e recebe um resumo', async () => {
    const response = await request(app.getHttpServer())
      .post('/manutencoes-recorrentes/executar')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    expect(response.body).toHaveProperty('verificados');
    expect(response.body).toHaveProperty('geradas');
    expect(typeof response.body.verificados).toBe('number');
  });

  it('TECNICO não consegue acessar uma OS sem técnico atribuído (RBAC já existente)', async () => {
    const condominio = await criarCondominio(
      'Condomínio Acesso Negado Teste',
      '11.222.333/0001-55',
      30,
    );
    const criada = await servico.processarCondominio(condominio.id);
    expect(criada).not.toBeNull();
    manutencaoIdsCriadas.push(criada!.id);

    await request(app.getHttpServer())
      .get(`/manutencoes/${criada!.id}/checklist`)
      .set('Authorization', `Bearer ${tecnicoToken}`)
      .expect(403);
  });

  it('PUT /manutencoes/:id - ADMIN atribui um técnico numa OS gerada automaticamente', async () => {
    const condominio = await criarCondominio(
      'Condomínio Atribuição Teste',
      '11.222.333/0001-66',
      30,
    );
    const criada = await servico.processarCondominio(condominio.id);
    expect(criada).not.toBeNull();
    manutencaoIdsCriadas.push(criada!.id);

    await request(app.getHttpServer())
      .put(`/manutencoes/${criada!.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ tecnicoId })
      .expect(200);

    const atualizada = await prisma.manutencao.findUnique({ where: { id: criada!.id } });
    expect(atualizada?.tecnicoId).toBe(tecnicoId);

    // Depois de atribuído, o próprio técnico já consegue acessar.
    await request(app.getHttpServer())
      .get(`/manutencoes/${criada!.id}/checklist`)
      .set('Authorization', `Bearer ${tecnicoToken}`)
      .expect(200);
  });
});

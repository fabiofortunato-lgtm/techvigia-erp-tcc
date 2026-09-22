import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup-app';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Testa o único cenário em que POST /auth/register funciona de verdade:
 * quando o banco não tem NENHUM usuário ainda (bootstrap do sistema).
 *
 * Fica num arquivo próprio, separado de auth.e2e-spec.ts, porque esse
 * cenário exige apagar TODOS os usuários do banco de teste antes de rodar -
 * algo que não faria sentido misturar com os outros testes de auth, que já
 * assumem a existência de usuários criados por outras suítes.
 *
 * O jest-e2e roda com maxWorkers:1 (um arquivo de cada vez, em sequência),
 * então o apagão de usuários aqui não interfere com outras suítes - cada
 * uma cria os próprios usuários no beforeAll antes de rodar seus testes.
 *
 * IMPORTANTE - segurança contra dado real: se o banco já tiver alguma
 * manutenção cadastrada (sinal de que é um banco com dado real, não um
 * banco de teste isolado e vazio), o teste de "banco vazio" é pulado em vez
 * de tentar `deleteMany({})` - apagar todos os usuários com manutenções
 * vinculadas violaria a chave estrangeira (ON DELETE RESTRICT, de
 * propósito) e falharia de qualquer forma, mas ainda assim é mais seguro
 * nunca tentar. Esse teste específico só roda de verdade num banco de
 * teste isolado (ex: o `scantech_erp_test` do CI, que sempre começa vazio).
 */
describe('Auth - bootstrap do primeiro usuário (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let seguroTestarBancoVazio = false;

  const emailBootstrap = 'primeiro.admin.bootstrap.e2e@techvigia-demo.com';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();

    prisma = app.get(PrismaService);

    const totalManutencoes = await prisma.manutencao.count();
    seguroTestarBancoVazio = totalManutencoes === 0;
  });

  afterAll(async () => {
    await prisma.usuario.deleteMany({ where: { email: emailBootstrap } });
    await prisma.usuario.deleteMany({
      where: { email: 'apoio.bootstrap.e2e@techvigia-demo.com' },
    });
    await app.close();
  });

  it('/auth/register (POST) - com o banco sem nenhum usuário, cria o primeiro e ele vira ADMIN automaticamente', async () => {
    if (!seguroTestarBancoVazio) {
      console.warn(
        '[bootstrap.e2e-spec] Pulado: o banco já tem manutenções cadastradas (dado real). ' +
          'Esse teste só roda de verdade num banco de teste isolado e vazio.',
      );
      return;
    }

    await prisma.usuario.deleteMany({});

    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ nome: 'Primeiro Admin', email: emailBootstrap, senha: 'senha12345' })
      .expect(201);

    expect(response.body).toHaveProperty('accessToken');
    expect(response.body.usuario.perfil).toBe('ADMIN');

    const usuarioNoBanco = await prisma.usuario.findUnique({ where: { email: emailBootstrap } });
    expect(usuarioNoBanco?.perfil).toBe('ADMIN');
  });

  it('/auth/register (POST) - com pelo menos 1 usuário já existindo, a rota fecha de novo', async () => {
    // Não depende do teste anterior ter rodado (ele é pulado em banco com
    // dado real - ver aviso acima). Garante a pré-condição direto aqui:
    // com qualquer usuário existindo, não importa quem criou, o registro
    // deve estar fechado.
    const totalUsuarios = await prisma.usuario.count();
    if (totalUsuarios === 0) {
      await prisma.usuario.create({
        data: {
          nome: 'Usuário de apoio pro teste de bootstrap',
          email: 'apoio.bootstrap.e2e@techvigia-demo.com',
          senhaHash: 'hash-nao-usado-neste-teste',
        },
      });
    }

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ nome: 'Segunda Pessoa', email: 'segunda.pessoa.bootstrap.e2e@techvigia-demo.com', senha: 'senha12345' })
      .expect(403);
  });
});

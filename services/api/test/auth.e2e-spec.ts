import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { criarUsuarioTeste } from './helpers/criar-usuario';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const usuarioTeste = {
    nome: 'Fabio Teste',
    email: 'fabio.teste.e2e@techvigia-demo.com',
    senha: 'senha12345',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();

    prisma = app.get(PrismaService);

    // Garante que não existe lixo de execuções anteriores com o mesmo e-mail
    await prisma.usuario.deleteMany({ where: { email: usuarioTeste.email } });

    // Cria o usuário de teste direto via Prisma - POST /auth/register não
    // serve mais para isso (ver os testes de bootstrap logo abaixo: a rota
    // só cria o PRIMEIRO usuário do sistema, e a essa altura o banco de
    // teste já tem outros usuários criados por outras suítes e2e).
    await criarUsuarioTeste(prisma, usuarioTeste);
  });

  afterAll(async () => {
    // Limpa o registro criado durante o teste e fecha a conexão
    await prisma.usuario.deleteMany({ where: { email: usuarioTeste.email } });
    await app.close();
  });

  it('/auth/register (POST) - deve rejeitar com 403 quando já existe pelo menos 1 usuário no banco', async () => {
    // O banco de teste, a essa altura, já tem usuário(s) - seja o
    // usuarioTeste criado no beforeAll, seja algum de outra suíte e2e que
    // já rodou antes (todas compartilham o mesmo banco de teste). Isso é
    // exatamente o comportamento que queremos garantir: register só existe
    // para o bootstrap do primeiro usuário, nunca depois disso.
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        nome: 'Alguém Tentando Se Cadastrar',
        email: 'alguem.tentando.se.cadastrar.e2e@techvigia-demo.com',
        senha: 'senha12345',
      })
      .expect(403);
  });

  it('/auth/register (POST) - deve rejeitar payload inválido (senha curta) antes mesmo de checar o bootstrap', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ nome: 'X', email: 'invalido@teste.com', senha: '123' })
      .expect(400);
  });

  it('/auth/login (POST) - deve autenticar com credenciais corretas', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: usuarioTeste.email, senha: usuarioTeste.senha })
      .expect(200);

    expect(response.body).toHaveProperty('accessToken');
    expect(response.body).toHaveProperty('refreshToken');
    expect(response.body.usuario).toMatchObject({
      email: usuarioTeste.email,
      nome: usuarioTeste.nome,
    });
  });

  it('/auth/login (POST) - deve setar accessToken e refreshToken como cookies httpOnly', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: usuarioTeste.email, senha: usuarioTeste.senha })
      .expect(200);

    const cookies = response.headers['set-cookie'] as unknown as string[];
    expect(cookies).toBeDefined();

    const cookieAccess = cookies.find((c) => c.startsWith('accessToken='));
    const cookieRefresh = cookies.find((c) => c.startsWith('refreshToken='));

    expect(cookieAccess).toBeDefined();
    expect(cookieAccess).toMatch(/HttpOnly/i);
    expect(cookieRefresh).toBeDefined();
    expect(cookieRefresh).toMatch(/HttpOnly/i);
  });

  it('/auth/me (GET) - autentica via cookie httpOnly, sem precisar de header Authorization', async () => {
    const agente = request.agent(app.getHttpServer());

    // O agent do supertest guarda os cookies recebidos e reenvia
    // automaticamente nas próximas chamadas - simula o comportamento real
    // de um navegador.
    await agente
      .post('/auth/login')
      .send({ email: usuarioTeste.email, senha: usuarioTeste.senha })
      .expect(200);

    const response = await agente.get('/auth/me').expect(200);

    expect(response.body).toMatchObject({
      email: usuarioTeste.email,
      nome: usuarioTeste.nome,
    });
  });

  it('/auth/me (GET) - deve rejeitar sem cookie nem header de autenticação', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('/auth/logout (POST) - deve limpar os cookies de sessão', async () => {
    const agente = request.agent(app.getHttpServer());

    await agente
      .post('/auth/login')
      .send({ email: usuarioTeste.email, senha: usuarioTeste.senha })
      .expect(200);

    await agente.get('/auth/me').expect(200);

    await agente.post('/auth/logout').expect(200);

    // Após o logout, o mesmo agent (mesmos cookies) não deve mais conseguir
    // acessar rotas protegidas via cookie
    await agente.get('/auth/me').expect(401);
  });

  it('/auth/login (POST) - deve rejeitar senha incorreta', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: usuarioTeste.email, senha: 'senhaErrada123' })
      .expect(401);
  });

  it('/auth/login (POST) - deve rejeitar e-mail inexistente', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'naoexiste@techvigia-demo.com', senha: 'qualquercoisa123' })
      .expect(401);
  });

  it('/auth/refresh (POST) - deve gerar novo par de tokens a partir de um refresh token válido', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: usuarioTeste.email, senha: usuarioTeste.senha })
      .expect(200);

    const { refreshToken } = loginResponse.body;

    const refreshResponse = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(200);

    expect(refreshResponse.body).toHaveProperty('accessToken');
    expect(refreshResponse.body).toHaveProperty('refreshToken');
  });

  it('/auth/refresh (POST) - deve rejeitar refresh token inválido', async () => {
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: 'token-invalido-qualquer' })
      .expect(401);
  });

  it('/condominios (GET) - deve rejeitar acesso sem token', async () => {
    await request(app.getHttpServer()).get('/condominios').expect(401);
  });

  it('/condominios (POST) - deve rejeitar criação por perfil TECNICO (RBAC)', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: usuarioTeste.email, senha: usuarioTeste.senha })
      .expect(200);

    const { accessToken } = loginResponse.body;

    // usuarioTeste é criado com perfil padrão TECNICO (ver helper
    // criarUsuarioTeste), então não deve conseguir criar um condomínio
    await request(app.getHttpServer())
      .post('/condominios')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        nome: 'Condomínio Teste',
        cnpj: '11.111.111/0001-11',
        endereco: 'Rua Teste, 123',
        bairro: 'Centro',
        cidade: 'Rio de Janeiro',
        cep: '20000-000',
        periodicidade: 30,
      })
      .expect(403);
  });
});

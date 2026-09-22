import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { criarUsuarioTeste } from './helpers/criar-usuario';

// Precisa estar definido ANTES do app subir (o ConfigModule lê isso na
// inicialização) - sem isso, tokenDev nunca aparece na resposta e todo
// este arquivo de teste perde a única forma de obter o token sem inbox
// de e-mail real. Ver auth.service.ts: por padrão essa exposição fica
// desligada (correção de segurança - antes vazava por padrão).
process.env.EXPOR_TOKEN_DEBUG = 'true';

describe('Recuperação de senha (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const email = 'reset.senha.e2e@techvigia-demo.com';
  const senhaOriginal = 'senha12345';
  const senhaNova = 'novaSenha999';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();

    prisma = app.get(PrismaService);

    await prisma.usuario.deleteMany({ where: { email } });
    await criarUsuarioTeste(prisma, { nome: 'Reset Senha Teste', email, senha: senhaOriginal });
  });

  afterAll(async () => {
    await prisma.usuario.deleteMany({ where: { email } });
    await app.close();
  });

  it('/auth/esqueci-senha (POST) - retorna mensagem genérica para e-mail inexistente', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/esqueci-senha')
      .send({ email: 'nao.existe.e2e@techvigia-demo.com' })
      .expect(200);

    expect(response.body.mensagem).toMatch(/instruções/i);
    expect(response.body.tokenDev).toBeUndefined();
  });

  it('/auth/esqueci-senha (POST) - gera token para e-mail existente (visível em dev)', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/esqueci-senha')
      .send({ email })
      .expect(200);

    expect(response.body.mensagem).toMatch(/instruções/i);
    expect(response.body.tokenDev).toBeDefined();
  });

  it('/auth/redefinir-senha (POST) - deve rejeitar token inválido', async () => {
    await request(app.getHttpServer())
      .post('/auth/redefinir-senha')
      .send({ token: 'token-que-nao-existe', novaSenha: senhaNova })
      .expect(401);
  });

  it('/auth/redefinir-senha (POST) - deve rejeitar token expirado', async () => {
    const solicitacao = await request(app.getHttpServer())
      .post('/auth/esqueci-senha')
      .send({ email });
    const tokenExpirado = solicitacao.body.tokenDev;

    // Força a expiração direto no banco, simulando o token vencido
    await prisma.usuario.update({
      where: { email },
      data: { resetSenhaExpiraEm: new Date(Date.now() - 1000) },
    });

    await request(app.getHttpServer())
      .post('/auth/redefinir-senha')
      .send({ token: tokenExpirado, novaSenha: senhaNova })
      .expect(401);
  });

  it('/auth/redefinir-senha (POST) - fluxo completo: gera token, redefine e loga com a nova senha', async () => {
    const solicitacao = await request(app.getHttpServer())
      .post('/auth/esqueci-senha')
      .send({ email });
    const token = solicitacao.body.tokenDev;

    await request(app.getHttpServer())
      .post('/auth/redefinir-senha')
      .send({ token, novaSenha: senhaNova })
      .expect(200);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, senha: senhaNova })
      .expect(200);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, senha: senhaOriginal })
      .expect(401);
  });

  it('/auth/redefinir-senha (POST) - o mesmo token não pode ser reutilizado', async () => {
    const solicitacao = await request(app.getHttpServer())
      .post('/auth/esqueci-senha')
      .send({ email });
    const token = solicitacao.body.tokenDev;

    await request(app.getHttpServer())
      .post('/auth/redefinir-senha')
      .send({ token, novaSenha: 'outraSenha111' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/auth/redefinir-senha')
      .send({ token, novaSenha: 'maisUmaSenha222' })
      .expect(401);
  });
});

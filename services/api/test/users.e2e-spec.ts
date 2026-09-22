import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { PerfilUsuario } from '@prisma/client';
import { criarUsuarioTeste } from './helpers/criar-usuario';

describe('Users (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const adminEmail = 'admin.users.e2e@techvigia-demo.com';
  const tecnicoEmail = 'tecnico.users.e2e@techvigia-demo.com';
  const senha = 'senha12345';

  let adminToken: string;
  let tecnicoToken: string;
  let tecnicoId: string;

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

    await criarUsuarioTeste(prisma, {
      nome: 'Admin Users Teste',
      email: adminEmail,
      senha,
      perfil: PerfilUsuario.ADMIN,
    });
    const loginAdmin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: adminEmail, senha });
    adminToken = loginAdmin.body.accessToken;

    await criarUsuarioTeste(prisma, { nome: 'Tecnico Users Teste', email: tecnicoEmail, senha });
    const tecnico = await prisma.usuario.findUnique({ where: { email: tecnicoEmail } });
    if (!tecnico) throw new Error('Falha ao criar usuário técnico para o teste');
    tecnicoId = tecnico.id;

    const loginTecnico = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: tecnicoEmail, senha });
    tecnicoToken = loginTecnico.body.accessToken;
  });

  afterAll(async () => {
    await prisma.usuario.deleteMany({
      where: { email: { in: [adminEmail, tecnicoEmail] } },
    });
    await app.close();
  });

  it('/usuarios (GET) - qualquer usuário autenticado pode listar, e a senha nunca aparece', async () => {
    const response = await request(app.getHttpServer())
      .get('/usuarios')
      .set('Authorization', `Bearer ${tecnicoToken}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    response.body.forEach((usuario: Record<string, unknown>) => {
      expect(usuario).not.toHaveProperty('senhaHash');
    });
  });

  it('/usuarios/:id/perfil (PATCH) - TECNICO não pode promover usuário (RBAC)', async () => {
    await request(app.getHttpServer())
      .patch(`/usuarios/${tecnicoId}/perfil`)
      .set('Authorization', `Bearer ${tecnicoToken}`)
      .send({ perfil: 'ADMIN' })
      .expect(403);
  });

  it('/usuarios/:id/perfil (PATCH) - ADMIN promove um técnico para GESTOR', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/usuarios/${tecnicoId}/perfil`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ perfil: 'GESTOR' })
      .expect(200);

    expect(response.body.perfil).toBe('GESTOR');
  });

  it('/usuarios/:id/perfil (PATCH) - deve rejeitar valor de perfil inválido', async () => {
    await request(app.getHttpServer())
      .patch(`/usuarios/${tecnicoId}/perfil`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ perfil: 'SUPER_ADMIN' })
      .expect(400);
  });

  it('/usuarios (POST) - TECNICO não pode criar usuário (RBAC)', async () => {
    await request(app.getHttpServer())
      .post('/usuarios')
      .set('Authorization', `Bearer ${tecnicoToken}`)
      .send({
        nome: 'Novo Usuário',
        email: 'novo.usuario.criado.por.tecnico.e2e@techvigia-demo.com',
        senha: 'senha12345',
        perfil: 'TECNICO',
      })
      .expect(403);
  });

  it('/usuarios (POST) - ADMIN cria um novo usuário, senhaHash nunca volta na resposta', async () => {
    const emailNovo = 'novo.usuario.criado.por.admin.e2e@techvigia-demo.com';
    await prisma.usuario.deleteMany({ where: { email: emailNovo } });

    const response = await request(app.getHttpServer())
      .post('/usuarios')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nome: 'Novo Usuário', email: emailNovo, senha: 'senha12345', perfil: 'TECNICO' })
      .expect(201);

    expect(response.body).not.toHaveProperty('senhaHash');
    expect(response.body.email).toBe(emailNovo);

    // Confirma que o usuário criado realmente consegue logar
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: emailNovo, senha: 'senha12345' })
      .expect(200);

    await prisma.usuario.deleteMany({ where: { email: emailNovo } });
  });

  it('/usuarios (POST) - deve rejeitar e-mail já cadastrado', async () => {
    await request(app.getHttpServer())
      .post('/usuarios')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nome: 'Duplicado', email: adminEmail, senha: 'senha12345', perfil: 'TECNICO' })
      .expect(409);
  });

  describe('PATCH /usuarios/:id - admin edita outro usuário', () => {
    it('TECNICO não pode editar outro usuário (RBAC)', async () => {
      await request(app.getHttpServer())
        .patch(`/usuarios/${tecnicoId}`)
        .set('Authorization', `Bearer ${tecnicoToken}`)
        .send({ nome: 'Tentando se editar sem ser admin' })
        .expect(403);
    });

    it('ADMIN edita nome de outro usuário', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/usuarios/${tecnicoId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nome: 'Nome Editado Pelo Admin' })
        .expect(200);

      expect(response.body.nome).toBe('Nome Editado Pelo Admin');
    });

    it('ADMIN desativa outro usuário, e o login dele passa a ser recusado', async () => {
      await request(app.getHttpServer())
        .patch(`/usuarios/${tecnicoId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ativo: false })
        .expect(200);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: tecnicoEmail, senha })
        .expect(401);

      // Reativa pra não afetar os testes seguintes desse arquivo
      await request(app.getHttpServer())
        .patch(`/usuarios/${tecnicoId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ativo: true })
        .expect(200);
    });
  });

  describe('PATCH /auth/me - usuário edita o próprio nome/email', () => {
    it('atualiza o próprio nome com sucesso', async () => {
      const loginTecnico = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: tecnicoEmail, senha });
      const tokenAtual = loginTecnico.body.accessToken;

      const response = await request(app.getHttpServer())
        .patch('/auth/me')
        .set('Authorization', `Bearer ${tokenAtual}`)
        .send({ nome: 'Meu Novo Nome' })
        .expect(200);

      expect(response.body.nome).toBe('Meu Novo Nome');
    });

    it('não deixa usar um e-mail que já pertence a outra pessoa', async () => {
      const loginTecnico = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: tecnicoEmail, senha });
      const tokenAtual = loginTecnico.body.accessToken;

      await request(app.getHttpServer())
        .patch('/auth/me')
        .set('Authorization', `Bearer ${tokenAtual}`)
        .send({ email: adminEmail })
        .expect(409);
    });
  });

  describe('POST /auth/trocar-senha - usuário troca a própria senha', () => {
    it('rejeita quando a senha atual informada está errada', async () => {
      const loginTecnico = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: tecnicoEmail, senha });
      const tokenAtual = loginTecnico.body.accessToken;

      await request(app.getHttpServer())
        .post('/auth/trocar-senha')
        .set('Authorization', `Bearer ${tokenAtual}`)
        .send({ senhaAtual: 'senhaErrada999', novaSenha: 'senhaNovaQualquer123' })
        .expect(401);
    });

    it('troca a senha com sucesso, e o login com a senha antiga deixa de funcionar', async () => {
      const loginTecnico = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: tecnicoEmail, senha });
      const tokenAtual = loginTecnico.body.accessToken;

      await request(app.getHttpServer())
        .post('/auth/trocar-senha')
        .set('Authorization', `Bearer ${tokenAtual}`)
        .send({ senhaAtual: senha, novaSenha: 'senhaNovaTrocada123' })
        .expect(200);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: tecnicoEmail, senha })
        .expect(401);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: tecnicoEmail, senha: 'senhaNovaTrocada123' })
        .expect(200);
    });
  });
});

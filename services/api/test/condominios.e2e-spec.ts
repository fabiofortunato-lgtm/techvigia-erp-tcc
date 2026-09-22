import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { PerfilUsuario } from '@prisma/client';
import { criarUsuarioTeste } from './helpers/criar-usuario';

describe('Condominios - CNPJ/CPF (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const adminEmail = 'admin.condominios.e2e@techvigia-demo.com';
  const senha = 'senha12345';
  let adminToken: string;

  const dadosBase = {
    nome: 'Cliente Teste CNPJ-CPF',
    endereco: 'Rua Teste, 1',
    bairro: 'Centro',
    cidade: 'Rio de Janeiro',
    cep: '20000-000',
    periodicidade: 30,
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();

    prisma = app.get(PrismaService);

    await prisma.usuario.deleteMany({ where: { email: adminEmail } });
    await prisma.condominio.deleteMany({
      where: { OR: [{ cnpj: '11.222.333/0001-44' }, { cpf: '123.456.789-00' }] },
    });

    await criarUsuarioTeste(prisma, {
      nome: 'Admin Condominios Teste',
      email: adminEmail,
      senha,
      perfil: PerfilUsuario.ADMIN,
    });
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: adminEmail, senha });
    adminToken = login.body.accessToken;
  });

  afterAll(async () => {
    await prisma.condominio.deleteMany({
      where: { OR: [{ cnpj: '11.222.333/0001-44' }, { cpf: '123.456.789-00' }] },
    });
    await prisma.usuario.deleteMany({ where: { email: adminEmail } });
    await app.close();
  });

  it('POST /condominios - deve rejeitar quando nem CNPJ nem CPF são informados', async () => {
    await request(app.getHttpServer())
      .post('/condominios')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...dadosBase })
      .expect(400);
  });

  it('POST /condominios - deve rejeitar quando CNPJ e CPF são informados juntos', async () => {
    await request(app.getHttpServer())
      .post('/condominios')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...dadosBase, cnpj: '11.222.333/0001-44', cpf: '123.456.789-00' })
      .expect(400);
  });

  it('POST /condominios - deve criar com sucesso usando só CNPJ (pessoa jurídica)', async () => {
    const response = await request(app.getHttpServer())
      .post('/condominios')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...dadosBase, cnpj: '11.222.333/0001-44' })
      .expect(201);

    expect(response.body.cnpj).toBe('11.222.333/0001-44');
    expect(response.body.cpf).toBeNull();

    await prisma.condominio.deleteMany({ where: { cnpj: '11.222.333/0001-44' } });
  });

  it('POST /condominios - deve criar com sucesso usando só CPF (pessoa física)', async () => {
    const response = await request(app.getHttpServer())
      .post('/condominios')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...dadosBase, nome: 'Cliente Pessoa Física', cpf: '123.456.789-00' })
      .expect(201);

    expect(response.body.cpf).toBe('123.456.789-00');
    expect(response.body.cnpj).toBeNull();
  });

  it('POST /condominios - deve rejeitar CPF duplicado', async () => {
    await request(app.getHttpServer())
      .post('/condominios')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...dadosBase, nome: 'Outro Cliente', cpf: '123.456.789-00' })
      .expect(409);
  });
});

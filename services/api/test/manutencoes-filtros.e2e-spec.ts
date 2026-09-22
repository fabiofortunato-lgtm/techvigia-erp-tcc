import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { PerfilUsuario, StatusManutencao } from '@prisma/client';
import { criarUsuarioTeste } from './helpers/criar-usuario';

describe('Filtros novos de Ordens de Serviço (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const adminEmail = 'admin.filtros-os.e2e@techvigia-demo.com';
  const senha = 'senha12345';
  const cnpj = '55.555.555/0001-55';

  let token: string;
  let condominioId: string;
  let equipamentoId: string;
  let manutencaoComEquipamentoId: string;
  let manutencaoSemEquipamentoId: string;
  let numeroOSComEquipamento: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();

    prisma = app.get(PrismaService);

    await prisma.usuario.deleteMany({ where: { email: adminEmail } });
    await prisma.condominio.deleteMany({ where: { cnpj } });

    const admin = await criarUsuarioTeste(prisma, {
      nome: 'Admin Filtros OS Teste',
      email: adminEmail,
      senha,
      perfil: PerfilUsuario.ADMIN,
    });

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: adminEmail, senha });
    token = login.body.accessToken;

    const condominio = await prisma.condominio.create({
      data: {
        nome: 'Condomínio Filtros OS Teste',
        cnpj,
        endereco: 'Rua dos Filtros, 1',
        bairro: 'Centro',
        cidade: 'Rio de Janeiro',
        cep: '20000-000',
        periodicidade: 30,
      },
    });
    condominioId = condominio.id;

    const equipamento = await prisma.equipamento.create({
      data: {
        condominioId,
        tipo: 'Câmera',
        fabricante: 'Intelbras',
        modelo: 'VHD 3230',
        dataInstalacao: new Date(),
      },
    });
    equipamentoId = equipamento.id;

    const comEquipamento = await prisma.manutencao.create({
      data: {
        numeroOS: 'OS-TESTE-FILTRO-COM-EQUIP',
        condominioId,
        tecnicoId: admin.id,
        status: StatusManutencao.CONCLUIDA,
      },
    });
    manutencaoComEquipamentoId = comEquipamento.id;
    numeroOSComEquipamento = comEquipamento.numeroOS;

    await prisma.peca.create({
      data: {
        manutencaoId: manutencaoComEquipamentoId,
        equipamentoId,
        nome: 'Fonte 12V',
        quantidade: 1,
      },
    });

    const semEquipamento = await prisma.manutencao.create({
      data: {
        numeroOS: 'OS-TESTE-FILTRO-SEM-EQUIP',
        condominioId,
        tecnicoId: admin.id,
        status: StatusManutencao.CONCLUIDA,
      },
    });
    manutencaoSemEquipamentoId = semEquipamento.id;
  });

  afterAll(async () => {
    await prisma.peca.deleteMany({ where: { manutencaoId: manutencaoComEquipamentoId } });
    await prisma.manutencao.deleteMany({
      where: { id: { in: [manutencaoComEquipamentoId, manutencaoSemEquipamentoId] } },
    });
    await prisma.equipamento.deleteMany({ where: { id: equipamentoId } });
    await prisma.condominio.deleteMany({ where: { cnpj } });
    await prisma.usuario.deleteMany({ where: { email: adminEmail } });
    await app.close();
  });

  it('/manutencoes?numeroOS= (GET) - busca parcial, sem diferenciar maiúsculas/minúsculas', async () => {
    const response = await request(app.getHttpServer())
      .get('/manutencoes')
      .query({ numeroOS: 'filtro-com-equip' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.some((m: { numeroOS: string }) => m.numeroOS === numeroOSComEquipamento)).toBe(
      true,
    );
    expect(
      response.body.some((m: { numeroOS: string }) => m.numeroOS === 'OS-TESTE-FILTRO-SEM-EQUIP'),
    ).toBe(false);
  });

  it('/manutencoes?equipamentoId= (GET) - só traz OS que tiveram peça registrada nesse equipamento', async () => {
    const response = await request(app.getHttpServer())
      .get('/manutencoes')
      .query({ equipamentoId })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const ids = response.body.map((m: { id: string }) => m.id);
    expect(ids).toContain(manutencaoComEquipamentoId);
    expect(ids).not.toContain(manutencaoSemEquipamentoId);
  });

  it('/equipamentos (GET) - lista geral, de qualquer condomínio', async () => {
    const response = await request(app.getHttpServer())
      .get('/equipamentos')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.some((eq: { id: string }) => eq.id === equipamentoId)).toBe(true);
  });

  it('/manutencoes?condominioNome= (GET) - busca parcial pelo início do nome do cliente, sem diferenciar maiúsculas/minúsculas', async () => {
    const response = await request(app.getHttpServer())
      .get('/manutencoes')
      .query({ condominioNome: 'filtros os' }) // parte do meio, minúsculo de propósito
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const ids = response.body.map((m: { id: string }) => m.id);
    expect(ids).toContain(manutencaoComEquipamentoId);
    expect(ids).toContain(manutencaoSemEquipamentoId);
  });

  it('/manutencoes?condominioNome= (GET) - não traz nada quando o nome não bate com nenhum cliente', async () => {
    const response = await request(app.getHttpServer())
      .get('/manutencoes')
      .query({ condominioNome: 'nome-que-nao-existe-em-lugar-nenhum' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const ids = response.body.map((m: { id: string }) => m.id);
    expect(ids).not.toContain(manutencaoComEquipamentoId);
    expect(ids).not.toContain(manutencaoSemEquipamentoId);
  });

  it('/manutencoes?equipamentoId= (GET) - também encontra pelo vínculo direto (assunto principal da visita), não só via peça', async () => {
    const manutencaoVinculoDirenta = await prisma.manutencao.create({
      data: {
        numeroOS: 'OS-TESTE-FILTRO-VINCULO-DIRETO',
        condominioId,
        equipamentoId,
        status: StatusManutencao.AGENDADA,
      },
    });

    try {
      const response = await request(app.getHttpServer())
        .get('/manutencoes')
        .query({ equipamentoId })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const ids = response.body.map((m: { id: string }) => m.id);
      expect(ids).toContain(manutencaoVinculoDirenta.id);
      expect(ids).toContain(manutencaoComEquipamentoId); // continua achando via peça também
    } finally {
      await prisma.manutencao.deleteMany({ where: { id: manutencaoVinculoDirenta.id } });
    }
  });
});

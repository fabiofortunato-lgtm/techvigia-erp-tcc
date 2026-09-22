import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { PerfilUsuario } from '@prisma/client';
import { criarUsuarioTeste } from './helpers/criar-usuario';

/**
 * O cenário real: o técnico registra uma peça em condomínio sem sinal. A
 * ação vai para a fila do app. Na hora de sincronizar, a requisição chega
 * ao servidor, a peça é gravada e o estoque baixado - mas a resposta se
 * perde no caminho de volta. Para o celular, a ação continua pendente, e
 * ele reenvia.
 *
 * Sem idempotência, isso registra a peça duas vezes e debita o estoque
 * duas vezes, silenciosamente. Os testes abaixo reproduzem exatamente esse
 * reenvio.
 */
describe('Idempotência da fila offline (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const adminEmail = 'admin.idempotencia.e2e@techvigia-demo.com';
  const senha = 'senha12345';
  const cnpj = '77.777.777/0001-77';
  const nomeItem = 'Fonte Teste Idempotência E2E';

  let token: string;
  let manutencaoId: string;
  let itemEstoqueId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();

    prisma = app.get(PrismaService);

    // Limpeza defensiva: se uma rodada anterior deste mesmo teste travou
    // no meio do caminho (ex: erro de schema, queda de conexão), pode ter
    // deixado usuário/condomínio/manutenção órfãos para trás. Apagar o
    // usuário direto, sem antes remover o que referencia ele como
    // tecnicoId, esbarra na chave estrangeira (ON DELETE RESTRICT, de
    // propósito) - por isso a ordem aqui vai de dependente para
    // independente, igual ao afterAll logo abaixo.
    const usuarioAnterior = await prisma.usuario.findUnique({ where: { email: adminEmail } });
    if (usuarioAnterior) {
      const manutencoesOrfas = await prisma.manutencao.findMany({
        where: { tecnicoId: usuarioAnterior.id },
        select: { id: true },
      });
      const idsOrfaos = manutencoesOrfas.map((m) => m.id);
      if (idsOrfaos.length > 0) {
        await prisma.peca.deleteMany({ where: { manutencaoId: { in: idsOrfaos } } });
        await prisma.checklistItem.deleteMany({ where: { manutencaoId: { in: idsOrfaos } } });
        await prisma.foto.deleteMany({ where: { manutencaoId: { in: idsOrfaos } } });
        await prisma.logAuditoria.deleteMany({ where: { manutencaoId: { in: idsOrfaos } } });
        await prisma.manutencao.deleteMany({ where: { id: { in: idsOrfaos } } });
      }
      await prisma.requisicaoIdempotente.deleteMany({ where: { usuarioId: usuarioAnterior.id } });
    }

    await prisma.usuario.deleteMany({ where: { email: adminEmail } });
    await prisma.condominio.deleteMany({ where: { cnpj } });
    await prisma.itemEstoque.deleteMany({ where: { nome: nomeItem } });

    await criarUsuarioTeste(prisma, {
      nome: 'Admin Idempotência Teste',
      email: adminEmail,
      senha,
      perfil: PerfilUsuario.ADMIN,
    });

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: adminEmail, senha });
    token = login.body.accessToken;

    const admin = await prisma.usuario.findUnique({ where: { email: adminEmail } });
    if (!admin) throw new Error('Falha ao criar usuário admin para o teste');

    const condominio = await request(app.getHttpServer())
      .post('/condominios')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nome: 'Condomínio Idempotência Teste',
        cnpj,
        endereco: 'Rua da Fila, 1',
        bairro: 'Centro',
        cidade: 'Rio de Janeiro',
        cep: '20000-000',
        periodicidade: 30,
      });

    const manutencao = await request(app.getHttpServer())
      .post('/manutencoes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        condominioId: condominio.body.id,
        tecnicoId: admin.id,
        inicio: new Date().toISOString(),
      });
    manutencaoId = manutencao.body.id;

    const item = await request(app.getHttpServer())
      .post('/estoque')
      .set('Authorization', `Bearer ${token}`)
      .send({ nome: nomeItem, unidade: 'un', quantidade: 10, quantidadeMinima: 1 });
    itemEstoqueId = item.body.id;
  });

  afterAll(async () => {
    await prisma.peca.deleteMany({ where: { manutencaoId } });
    await prisma.movimentacaoEstoque.deleteMany({ where: { itemEstoqueId } });
    await prisma.requisicaoIdempotente.deleteMany({});
    await prisma.manutencao.deleteMany({ where: { id: manutencaoId } });
    await prisma.itemEstoque.deleteMany({ where: { nome: nomeItem } });
    await prisma.condominio.deleteMany({ where: { cnpj } });
    await prisma.usuario.deleteMany({ where: { email: adminEmail } });
    await app.close();
  });

  it('reenvio com a mesma chave não registra a peça de novo nem baixa o estoque duas vezes', async () => {
    const chave = 'acao-fila-teste-1';
    const corpo = {
      nome: 'Fonte 12V',
      quantidade: 2,
      itemEstoqueId,
      motivoTroca: 'Queimada',
    };

    const primeira = await request(app.getHttpServer())
      .post(`/manutencoes/${manutencaoId}/pecas`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', chave)
      .send(corpo)
      .expect(201);

    // Mesma chave, mesmo corpo: é o reenvio da fila.
    const reenvio = await request(app.getHttpServer())
      .post(`/manutencoes/${manutencaoId}/pecas`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', chave)
      .send(corpo)
      .expect(201);

    // O app precisa receber a mesma resposta da primeira vez, senão ele
    // trata o reenvio como uma ação diferente.
    expect(reenvio.body.id).toBe(primeira.body.id);

    const pecas = await prisma.peca.findMany({ where: { manutencaoId } });
    expect(pecas).toHaveLength(1);

    const item = await prisma.itemEstoque.findUnique({ where: { id: itemEstoqueId } });
    expect(item?.quantidade).toBe(8); // 10 - 2, uma vez só

    const movimentacoes = await prisma.movimentacaoEstoque.findMany({
      where: { itemEstoqueId },
    });
    expect(movimentacoes).toHaveLength(1);
  });

  it('chave diferente registra normalmente - o que não pode é bloquear ação nova', async () => {
    await request(app.getHttpServer())
      .post(`/manutencoes/${manutencaoId}/pecas`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'acao-fila-teste-2')
      .send({ nome: 'Cabo coaxial', quantidade: 1, itemEstoqueId })
      .expect(201);

    const pecas = await prisma.peca.findMany({ where: { manutencaoId } });
    expect(pecas).toHaveLength(2);

    const item = await prisma.itemEstoque.findUnique({ where: { id: itemEstoqueId } });
    expect(item?.quantidade).toBe(7); // 8 - 1
  });

  it('requisição sem o cabeçalho continua funcionando como antes', async () => {
    await request(app.getHttpServer())
      .post(`/manutencoes/${manutencaoId}/pecas`)
      .set('Authorization', `Bearer ${token}`)
      .send({ nome: 'Conector BNC', quantidade: 1, itemEstoqueId })
      .expect(201);

    const pecas = await prisma.peca.findMany({ where: { manutencaoId } });
    expect(pecas).toHaveLength(3);
  });

  it('ação que falha não deixa a chave travada - a nova tentativa executa', async () => {
    const chave = 'acao-fila-teste-erro';

    // Estoque insuficiente: a primeira tentativa falha de propósito.
    await request(app.getHttpServer())
      .post(`/manutencoes/${manutencaoId}/pecas`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', chave)
      .send({ nome: 'Fonte 12V', quantidade: 999, itemEstoqueId })
      .expect(400);

    // Mesma chave, agora com quantidade possível: precisa executar de
    // verdade, e não devolver "já está sendo processada".
    const corrigida = await request(app.getHttpServer())
      .post(`/manutencoes/${manutencaoId}/pecas`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', chave)
      .send({ nome: 'Fonte 12V', quantidade: 1, itemEstoqueId })
      .expect(201);

    expect(corrigida.body.id).toBeDefined();
  });
});

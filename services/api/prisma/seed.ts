/**
 * SEED - Versão Acadêmica (TechVigia ERP)
 *
 * Popula o banco com dados fictícios suficientes para uma apresentação
 * completa do sistema: usuários de cada perfil, condomínios, técnicos,
 * equipamentos, modelos de checklist, e ordens de serviço em diferentes
 * estágios (aberta, agendada, em atendimento, aguardando material,
 * concluída, cancelada).
 *
 * Nenhum dado aqui é real - nomes, empresas, e-mails e números de
 * documento são inventados especificamente para esta demonstração.
 *
 * Rodar com: npx prisma db seed
 * (ou diretamente: npx ts-node prisma/seed.ts)
 */
import { PrismaClient, PerfilUsuario, TipoManutencao, StatusManutencao, PrioridadeManutencao, StatusChecklistItem } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const SENHA_PADRAO = 'Demo@123';

function diasAPartirDeHoje(dias: number): Date {
  const data = new Date();
  data.setDate(data.getDate() + dias);
  return data;
}

async function main() {
  console.log('Iniciando seed da versão acadêmica...\n');

  // ---------------------------------------------------------------
  // USUÁRIOS
  // ---------------------------------------------------------------
  const senhaHash = await argon2.hash(SENHA_PADRAO);

  const admin = await prisma.usuario.upsert({
    where: { email: 'admin@techvigia-demo.com' },
    update: {},
    create: {
      nome: 'Fabiana Costa',
      email: 'admin@techvigia-demo.com',
      senhaHash,
      perfil: PerfilUsuario.ADMIN,
    },
  });

  const gestor = await prisma.usuario.upsert({
    where: { email: 'gestor@techvigia-demo.com' },
    update: {},
    create: {
      nome: 'Patrícia Almeida',
      email: 'gestor@techvigia-demo.com',
      senhaHash,
      perfil: PerfilUsuario.GESTOR,
    },
  });

  const joao = await prisma.usuario.upsert({
    where: { email: 'joao.silva@techvigia-demo.com' },
    update: {},
    create: {
      nome: 'João Silva',
      email: 'joao.silva@techvigia-demo.com',
      senhaHash,
      perfil: PerfilUsuario.TECNICO,
    },
  });

  const carlos = await prisma.usuario.upsert({
    where: { email: 'carlos.souza@techvigia-demo.com' },
    update: {},
    create: {
      nome: 'Carlos Souza',
      email: 'carlos.souza@techvigia-demo.com',
      senhaHash,
      perfil: PerfilUsuario.TECNICO,
    },
  });

  const marcelo = await prisma.usuario.upsert({
    where: { email: 'marcelo.oliveira@techvigia-demo.com' },
    update: {},
    create: {
      nome: 'Marcelo Oliveira',
      email: 'marcelo.oliveira@techvigia-demo.com',
      senhaHash,
      perfil: PerfilUsuario.TECNICO,
    },
  });

  const rafael = await prisma.usuario.upsert({
    where: { email: 'rafael.santos@techvigia-demo.com' },
    update: {},
    create: {
      nome: 'Rafael Santos',
      email: 'rafael.santos@techvigia-demo.com',
      senhaHash,
      perfil: PerfilUsuario.TECNICO,
    },
  });

  console.log('✓ 6 usuários criados (1 admin, 1 gestor, 4 técnicos)');

  // ---------------------------------------------------------------
  // CONDOMÍNIOS / CLIENTES
  // ---------------------------------------------------------------
  const alpha = await prisma.condominio.upsert({
    where: { cnpj: '11.111.111/0001-11' },
    update: {},
    create: {
      nome: 'Condomínio Alpha',
      cnpj: '11.111.111/0001-11',
      endereco: 'Rua das Palmeiras, 450',
      bairro: 'Barra da Tijuca',
      cidade: 'Rio de Janeiro',
      cep: '22775-000',
      telefone: '(21) 3333-1111',
      whatsapp: '(21) 99999-1111',
      email: 'contato@condominioalpha-demo.com',
      sindico: 'Roberto Lima',
      zelador: 'Antônio Ferreira',
      periodicidade: 30,
    },
  });

  const beta = await prisma.condominio.upsert({
    where: { cnpj: '22.222.222/0001-22' },
    update: {},
    create: {
      nome: 'Empresa Beta',
      cnpj: '22.222.222/0001-22',
      endereco: 'Avenida Central, 1200',
      bairro: 'Centro',
      cidade: 'Rio de Janeiro',
      cep: '20040-020',
      telefone: '(21) 3333-2222',
      whatsapp: '(21) 99999-2222',
      email: 'contato@empresabeta-demo.com',
      sindico: null,
      zelador: 'Marcos Vinícius',
      periodicidade: 30,
    },
  });

  const central = await prisma.condominio.upsert({
    where: { cnpj: '33.333.333/0001-33' },
    update: {},
    create: {
      nome: 'Comércio Central',
      cnpj: '33.333.333/0001-33',
      endereco: 'Rua do Comércio, 88',
      bairro: 'Centro',
      cidade: 'Rio de Janeiro',
      cep: '20050-030',
      telefone: '(21) 3333-3333',
      whatsapp: '(21) 99999-3333',
      email: 'contato@comerciocentral-demo.com',
      sindico: null,
      zelador: null,
      periodicidade: 45,
    },
  });

  const jardim = await prisma.condominio.upsert({
    where: { cnpj: '44.444.444/0001-44' },
    update: {},
    create: {
      nome: 'Residencial Jardim',
      cnpj: '44.444.444/0001-44',
      endereco: 'Rua das Acácias, 300',
      bairro: 'Jardim Botânico',
      cidade: 'Rio de Janeiro',
      cep: '22461-000',
      telefone: '(21) 3333-4444',
      whatsapp: '(21) 99999-4444',
      email: 'contato@residencialjardim-demo.com',
      sindico: 'Helena Martins',
      zelador: 'José Carlos',
      periodicidade: 30,
    },
  });

  console.log('✓ 4 condomínios/clientes criados');

  // Vincula cada técnico como responsável principal de um condomínio
  await prisma.tecnicoCondominio.upsert({
    where: { tecnicoId_condominioId: { tecnicoId: joao.id, condominioId: alpha.id } },
    update: {},
    create: { tecnicoId: joao.id, condominioId: alpha.id, responsavelPrincipal: true },
  });
  await prisma.tecnicoCondominio.upsert({
    where: { tecnicoId_condominioId: { tecnicoId: carlos.id, condominioId: beta.id } },
    update: {},
    create: { tecnicoId: carlos.id, condominioId: beta.id, responsavelPrincipal: true },
  });
  await prisma.tecnicoCondominio.upsert({
    where: { tecnicoId_condominioId: { tecnicoId: marcelo.id, condominioId: central.id } },
    update: {},
    create: { tecnicoId: marcelo.id, condominioId: central.id, responsavelPrincipal: true },
  });
  await prisma.tecnicoCondominio.upsert({
    where: { tecnicoId_condominioId: { tecnicoId: rafael.id, condominioId: jardim.id } },
    update: {},
    create: { tecnicoId: rafael.id, condominioId: jardim.id, responsavelPrincipal: true },
  });

  console.log('✓ Técnicos vinculados aos condomínios');

  // ---------------------------------------------------------------
  // EQUIPAMENTOS
  // ---------------------------------------------------------------
  const equipAlphaCam1 = await prisma.equipamento.create({
    data: {
      condominioId: alpha.id,
      tipo: 'Câmera',
      local: 'Portaria principal',
      fabricante: 'Intelbras',
      modelo: 'VHD 3230 B',
      numeroSerie: 'DEMO-ALPHA-CAM-001',
      patrimonio: 'PAT-ALPHA-001',
      dataInstalacao: diasAPartirDeHoje(-400),
    },
  });
  await prisma.equipamento.create({
    data: {
      condominioId: alpha.id,
      tipo: 'DVR',
      local: 'Sala técnica',
      fabricante: 'Intelbras',
      modelo: 'MHDX 1116',
      numeroSerie: 'DEMO-ALPHA-DVR-001',
      patrimonio: 'PAT-ALPHA-002',
      dataInstalacao: diasAPartirDeHoje(-400),
    },
  });
  const equipAlphaNobreak = await prisma.equipamento.create({
    data: {
      condominioId: alpha.id,
      tipo: 'Nobreak',
      local: 'Sala técnica',
      fabricante: 'SMS',
      modelo: 'Manager III 1500VA',
      numeroSerie: 'DEMO-ALPHA-NOB-001',
      patrimonio: 'PAT-ALPHA-003',
      dataInstalacao: diasAPartirDeHoje(-400),
      intervaloTrocaMeses: 12,
      dataUltimaTroca: diasAPartirDeHoje(-370),
    },
  });

  const equipBetaAcesso = await prisma.equipamento.create({
    data: {
      condominioId: beta.id,
      tipo: 'Controle de Acesso',
      local: 'Entrada de funcionários',
      fabricante: 'Control iD',
      modelo: 'iDAccess Nano',
      numeroSerie: 'DEMO-BETA-ACS-001',
      patrimonio: 'PAT-BETA-001',
      dataInstalacao: diasAPartirDeHoje(-200),
    },
  });
  await prisma.equipamento.create({
    data: {
      condominioId: beta.id,
      tipo: 'Câmera',
      local: 'Recepção',
      fabricante: 'Hikvision',
      modelo: 'DS-2CE16D0T',
      numeroSerie: 'DEMO-BETA-CAM-001',
      patrimonio: 'PAT-BETA-002',
      dataInstalacao: diasAPartirDeHoje(-200),
    },
  });

  const equipCentralInterfone = await prisma.equipamento.create({
    data: {
      condominioId: central.id,
      tipo: 'Interfone',
      local: 'Entrada principal',
      fabricante: 'HDL',
      modelo: 'F8S',
      numeroSerie: 'DEMO-CENTRAL-INT-001',
      patrimonio: 'PAT-CENTRAL-001',
      dataInstalacao: diasAPartirDeHoje(-150),
    },
  });
  await prisma.equipamento.create({
    data: {
      condominioId: central.id,
      tipo: 'Câmera',
      local: 'Estacionamento',
      fabricante: 'Intelbras',
      modelo: 'VHD 3130 B',
      numeroSerie: 'DEMO-CENTRAL-CAM-001',
      patrimonio: 'PAT-CENTRAL-002',
      dataInstalacao: diasAPartirDeHoje(-150),
    },
  });

  await prisma.equipamento.create({
    data: {
      condominioId: jardim.id,
      tipo: 'Câmera',
      local: 'Portão social',
      fabricante: 'Intelbras',
      modelo: 'VHD 3230 B',
      numeroSerie: 'DEMO-JARDIM-CAM-001',
      patrimonio: 'PAT-JARDIM-001',
      dataInstalacao: diasAPartirDeHoje(-90),
    },
  });
  await prisma.equipamento.create({
    data: {
      condominioId: jardim.id,
      tipo: 'DVR',
      local: 'Guarita',
      fabricante: 'Intelbras',
      modelo: 'MHDX 1108',
      numeroSerie: 'DEMO-JARDIM-DVR-001',
      patrimonio: 'PAT-JARDIM-002',
      dataInstalacao: diasAPartirDeHoje(-90),
    },
  });

  console.log('✓ Equipamentos cadastrados nos 4 condomínios');

  // ---------------------------------------------------------------
  // MODELOS DE CHECKLIST
  // ---------------------------------------------------------------
  const checklistPreventiva = await prisma.checklistModelo.upsert({
    where: { tipo: TipoManutencao.PREVENTIVA },
    update: {},
    create: {
      tipo: TipoManutencao.PREVENTIVA,
      nome: 'Checklist de CFTV Preventiva',
      itens: {
        create: [
          { item: 'Verificar gravação de todas as câmeras', ordem: 1 },
          { item: 'Limpar lentes e proteções', ordem: 2 },
          { item: 'Testar espaço em disco do DVR/NVR', ordem: 3 },
          { item: 'Verificar cabeamento e conectores', ordem: 4 },
          { item: 'Testar autonomia do nobreak', ordem: 5 },
        ],
      },
    },
  });

  const checklistCorretiva = await prisma.checklistModelo.upsert({
    where: { tipo: TipoManutencao.CORRETIVA },
    update: {},
    create: {
      tipo: TipoManutencao.CORRETIVA,
      nome: 'Checklist de CFTV Corretiva',
      itens: {
        create: [
          { item: 'Identificar causa da falha reportada', ordem: 1 },
          { item: 'Testar equipamento após o reparo', ordem: 2 },
          { item: 'Confirmar gravação normalizada', ordem: 3 },
        ],
      },
    },
  });

  console.log('✓ Modelos de checklist criados (Preventiva e Corretiva)');
  void checklistPreventiva;
  void checklistCorretiva;

  // ---------------------------------------------------------------
  // ORDENS DE SERVIÇO - cobrindo os principais estágios
  // ---------------------------------------------------------------

  // 1) ABERTA - agendada pra breve, sem check-in ainda
  await prisma.manutencao.create({
    data: {
      numeroOS: 'OS-2026000001',
      condominioId: alpha.id,
      tecnicoId: joao.id,
      tipo: TipoManutencao.PREVENTIVA,
      status: StatusManutencao.AGENDADA,
      prioridade: PrioridadeManutencao.MEDIA,
      inicio: diasAPartirDeHoje(2),
      observacao: 'Manutenção preventiva mensal - revisão geral do sistema de CFTV.',
    },
  });

  // 2) AGENDADA - mais distante no calendário
  await prisma.manutencao.create({
    data: {
      numeroOS: 'OS-2026000002',
      condominioId: beta.id,
      tecnicoId: carlos.id,
      tipo: TipoManutencao.PREVENTIVA,
      status: StatusManutencao.AGENDADA,
      prioridade: PrioridadeManutencao.BAIXA,
      inicio: diasAPartirDeHoje(10),
      observacao: 'Manutenção preventiva mensal.',
    },
  });

  // 3) EM ATENDIMENTO - já com check-in feito (localização registrada)
  await prisma.manutencao.create({
    data: {
      numeroOS: 'OS-2026000003',
      condominioId: central.id,
      tecnicoId: marcelo.id,
      equipamentoId: equipCentralInterfone.id,
      tipo: TipoManutencao.CORRETIVA,
      status: StatusManutencao.EM_ANDAMENTO,
      prioridade: PrioridadeManutencao.ALTA,
      inicio: diasAPartirDeHoje(0),
      chamadoAvulso: true,
      observacao: 'Interfone da entrada principal sem áudio. Técnico em atendimento no local.',
      latitudeCheckin: -22.9068,
      longitudeCheckin: -43.1729,
    },
  });

  // 4) AGUARDANDO MATERIAL - em andamento, mas travada esperando peça
  //    (o sistema não tem um status formal "aguardando material" - esse
  //    estágio operacional é representado via observação numa OS já em
  //    andamento, que é como a operação real acompanha esse tipo de caso)
  await prisma.manutencao.create({
    data: {
      numeroOS: 'OS-2026000004',
      condominioId: jardim.id,
      tecnicoId: rafael.id,
      tipo: TipoManutencao.CORRETIVA,
      status: StatusManutencao.EM_ANDAMENTO,
      prioridade: PrioridadeManutencao.ALTA,
      inicio: diasAPartirDeHoje(-1),
      observacao:
        'Câmera da guarita com falha na fonte de alimentação. Aguardando chegada de peça de reposição para concluir o reparo.',
    },
  });

  // 5) CONCLUÍDA - fluxo completo (checklist, peça trocada, assinatura, PDF)
  const osConcluida = await prisma.manutencao.create({
    data: {
      numeroOS: 'OS-2026000005',
      condominioId: alpha.id,
      tecnicoId: joao.id,
      equipamentoId: equipAlphaNobreak.id,
      tipo: TipoManutencao.PREVENTIVA,
      status: StatusManutencao.CONCLUIDA,
      prioridade: PrioridadeManutencao.MEDIA,
      inicio: diasAPartirDeHoje(-7),
      fim: diasAPartirDeHoje(-7),
      observacao: 'Manutenção preventiva realizada com troca da bateria do nobreak.',
      assinanteNome: 'Roberto Lima (síndico)',
      assinadoEm: diasAPartirDeHoje(-7),
    },
  });
  await prisma.checklistItem.createMany({
    data: [
      { manutencaoId: osConcluida.id, item: 'Verificar gravação de todas as câmeras', status: StatusChecklistItem.OK },
      { manutencaoId: osConcluida.id, item: 'Limpar lentes e proteções', status: StatusChecklistItem.OK },
      { manutencaoId: osConcluida.id, item: 'Testar espaço em disco do DVR/NVR', status: StatusChecklistItem.OK },
      { manutencaoId: osConcluida.id, item: 'Verificar cabeamento e conectores', status: StatusChecklistItem.OK },
      {
        manutencaoId: osConcluida.id,
        item: 'Testar autonomia do nobreak',
        status: StatusChecklistItem.DEFEITO,
        observacao: 'Bateria não segurava carga - substituída.',
      },
    ],
  });
  await prisma.peca.create({
    data: {
      manutencaoId: osConcluida.id,
      equipamentoId: equipAlphaNobreak.id,
      nome: 'Bateria selada 12V 7Ah',
      quantidade: 1,
      custoUnitario: 89.9,
      fornecedor: 'Distribuidora Elétrica Central',
      motivoTroca: 'Bateria não segurava carga durante o teste de autonomia.',
    },
  });

  // 6) CANCELADA
  await prisma.manutencao.create({
    data: {
      numeroOS: 'OS-2026000006',
      condominioId: beta.id,
      tecnicoId: carlos.id,
      tipo: TipoManutencao.CORRETIVA,
      status: StatusManutencao.CANCELADA,
      prioridade: PrioridadeManutencao.BAIXA,
      inicio: diasAPartirDeHoje(-3),
      observacao: 'Chamado cancelado a pedido do cliente - problema resolvido internamente.',
    },
  });

  // 7-10) Mais OS concluídas espalhadas no tempo, pra dar volume real
  //       ao dashboard e aos relatórios (gráfico por técnico, etc.)
  const maisConcluidas = [
    { numeroOS: 'OS-2026000007', condominioId: central.id, tecnicoId: marcelo.id, dias: -14 },
    { numeroOS: 'OS-2026000008', condominioId: jardim.id, tecnicoId: rafael.id, dias: -20 },
    { numeroOS: 'OS-2026000009', condominioId: alpha.id, tecnicoId: joao.id, dias: -35 },
    { numeroOS: 'OS-2026000010', condominioId: beta.id, tecnicoId: carlos.id, dias: -40 },
  ];
  for (const os of maisConcluidas) {
    await prisma.manutencao.create({
      data: {
        numeroOS: os.numeroOS,
        condominioId: os.condominioId,
        tecnicoId: os.tecnicoId,
        tipo: TipoManutencao.PREVENTIVA,
        status: StatusManutencao.CONCLUIDA,
        prioridade: PrioridadeManutencao.MEDIA,
        inicio: diasAPartirDeHoje(os.dias),
        fim: diasAPartirDeHoje(os.dias),
        observacao: 'Manutenção preventiva mensal realizada sem intercorrências.',
        assinanteNome: 'Responsável pelo local',
        assinadoEm: diasAPartirDeHoje(os.dias),
      },
    });
  }

  // 11) AGENDADA no passado, sem check-in - aparece como "atrasada"
  await prisma.manutencao.create({
    data: {
      numeroOS: 'OS-2026000011',
      condominioId: jardim.id,
      tecnicoId: rafael.id,
      tipo: TipoManutencao.PREVENTIVA,
      status: StatusManutencao.AGENDADA,
      prioridade: PrioridadeManutencao.MEDIA,
      inicio: diasAPartirDeHoje(-2),
      observacao: 'Manutenção preventiva mensal.',
    },
  });

  console.log('✓ 11 ordens de serviço criadas, cobrindo todos os estágios do fluxo');

  console.log('\n--------------------------------------------------');
  console.log('Seed concluído com sucesso.');
  console.log('--------------------------------------------------');
  console.log('Usuários de demonstração (senha para todos: ' + SENHA_PADRAO + '):');
  console.log('  ADMIN   - admin@techvigia-demo.com');
  console.log('  GESTOR  - gestor@techvigia-demo.com');
  console.log('  TÉCNICO - joao.silva@techvigia-demo.com');
  console.log('  TÉCNICO - carlos.souza@techvigia-demo.com');
  console.log('  TÉCNICO - marcelo.oliveira@techvigia-demo.com');
  console.log('  TÉCNICO - rafael.santos@techvigia-demo.com');
  console.log('--------------------------------------------------\n');

  void admin;
  void gestor;
  void equipAlphaCam1;
  void equipBetaAcesso;
}

main()
  .catch((e) => {
    console.error('Erro ao rodar o seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

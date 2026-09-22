/**
 * LIMPEZA COMPLETA DO BANCO DE DADOS
 * ===================================
 * Apaga TODOS os dados operacionais (condomínios, equipamentos, manutenções,
 * fotos, checklist, peças, estoque) e TODOS os usuários, EXCETO o e-mail
 * informado em EMAIL_A_PRESERVAR.
 *
 * Também apaga os arquivos físicos órfãos em storage/fotos, storage/assinaturas
 * e storage/pdfs (mantém as pastas, só esvazia o conteúdo).
 *
 * ISSO É IRREVERSÍVEL. Não existe "desfazer". Faça um backup do banco antes
 * de rodar isso se tiver qualquer dúvida (ver README).
 *
 * COMO RODAR (de dentro de services/api):
 *   npx ts-node scripts/limpar-banco.ts --confirmar
 *
 * O --confirmar é obrigatório - sem ele, o script só mostra o que SERIA
 * apagado (modo "a seco"), sem apagar nada de verdade.
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const EMAIL_A_PRESERVAR = 'fabiofortunato@gmail.com';

const prisma = new PrismaClient();

function perguntar(pergunta: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(pergunta, (resposta) => {
    rl.close();
    resolve(resposta);
  }));
}

function limparPasta(pasta: string) {
  const caminho = path.resolve(process.cwd(), 'storage', pasta);
  if (!fs.existsSync(caminho)) return 0;
  const arquivos = fs.readdirSync(caminho);
  arquivos.forEach((arquivo) => fs.unlinkSync(path.join(caminho, arquivo)));
  return arquivos.length;
}

async function main() {
  const modoAplicar = process.argv.includes('--confirmar');

  const usuarioPreservado = await prisma.usuario.findUnique({
    where: { email: EMAIL_A_PRESERVAR },
  });

  if (!usuarioPreservado) {
    console.error(
      `\nERRO: não encontrei nenhum usuário com o e-mail "${EMAIL_A_PRESERVAR}" no banco.\n` +
        `Cancelando por segurança - se esse não é o e-mail certo, ajuste a constante ` +
        `EMAIL_A_PRESERVAR no topo deste script antes de rodar de novo.\n`,
    );
    process.exit(1);
  }

  const contagens = {
    fotos: await prisma.foto.count(),
    checklist: await prisma.checklistItem.count(),
    pecas: await prisma.peca.count(),
    movimentacoesEstoque: await prisma.movimentacaoEstoque.count(),
    manutencoes: await prisma.manutencao.count(),
    equipamentos: await prisma.equipamento.count(),
    tecnicoCondominio: await prisma.tecnicoCondominio.count(),
    itensEstoque: await prisma.itemEstoque.count(),
    condominios: await prisma.condominio.count(),
    usuarios: await prisma.usuario.count({ where: { email: { not: EMAIL_A_PRESERVAR } } }),
  };

  console.log('\n===== O QUE SERÁ APAGADO =====');
  console.log(`Fotos: ${contagens.fotos}`);
  console.log(`Itens de checklist: ${contagens.checklist}`);
  console.log(`Peças: ${contagens.pecas}`);
  console.log(`Movimentações de estoque: ${contagens.movimentacoesEstoque}`);
  console.log(`Manutenções (OS): ${contagens.manutencoes}`);
  console.log(`Equipamentos: ${contagens.equipamentos}`);
  console.log(`Vínculos técnico-condomínio: ${contagens.tecnicoCondominio}`);
  console.log(`Itens de estoque: ${contagens.itensEstoque}`);
  console.log(`Condomínios: ${contagens.condominios}`);
  console.log(`Usuários (todos, exceto ${EMAIL_A_PRESERVAR}): ${contagens.usuarios}`);
  console.log('\nSERÁ PRESERVADO:');
  console.log(`Usuário: ${usuarioPreservado.nome} <${usuarioPreservado.email}>`);
  console.log('===============================\n');

  if (!modoAplicar) {
    console.log(
      'MODO A SECO (nada foi apagado). Rode de novo com --confirmar para aplicar de verdade:\n' +
        '  npx ts-node scripts/limpar-banco.ts --confirmar\n',
    );
    await prisma.$disconnect();
    return;
  }

  const resposta = await perguntar(
    'Isso é IRREVERSÍVEL. Digite exatamente LIMPAR (maiúsculo) para confirmar: ',
  );

  if (resposta !== 'LIMPAR') {
    console.log('\nCancelado - a resposta não bateu com "LIMPAR". Nada foi apagado.\n');
    await prisma.$disconnect();
    return;
  }

  console.log('\nApagando...\n');

  // Ordem importa: sempre de "filho" pra "pai", respeitando as chaves
  // estrangeiras (sem isso o Postgres recusa a exclusão).
  await prisma.foto.deleteMany({});
  await prisma.checklistItem.deleteMany({});
  await prisma.peca.deleteMany({});
  await prisma.movimentacaoEstoque.deleteMany({});
  await prisma.manutencao.deleteMany({});
  await prisma.equipamento.deleteMany({});
  await prisma.tecnicoCondominio.deleteMany({});
  await prisma.itemEstoque.deleteMany({});
  await prisma.condominio.deleteMany({});
  await prisma.usuario.deleteMany({ where: { email: { not: EMAIL_A_PRESERVAR } } });

  const arquivosApagados =
    limparPasta('fotos') + limparPasta('assinaturas') + limparPasta('pdfs');

  console.log('Banco de dados limpo com sucesso.');
  console.log(`Arquivos físicos removidos (fotos/assinaturas/pdfs): ${arquivosApagados}`);
  console.log(`\nVocê continua logado como: ${usuarioPreservado.email}`);
  console.log('Pode começar os cadastros do zero pelo painel web.\n');

  await prisma.$disconnect();
}

main().catch(async (erro) => {
  console.error('Erro ao limpar o banco:', erro);
  await prisma.$disconnect();
  process.exit(1);
});

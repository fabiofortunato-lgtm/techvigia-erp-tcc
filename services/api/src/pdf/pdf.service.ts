import { Injectable } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import * as path from 'path';

interface FotoComBuffer {
  tipo: string;
  buffer: Buffer;
}

// Tipo mínimo do que o gerador de PDF precisa - evita acoplar
// esse serviço ao tipo exato retornado pelo Prisma.
interface DadosOrdemServico {
  numeroOS: string;
  status: string;
  inicio: Date | null;
  fim: Date | null;
  observacao: string | null;
  condominio: { nome: string; endereco: string; bairro: string; cidade: string };
  tecnico: { nome: string };
  checklist: { item: string; status: string; observacao: string | null }[];
  pecas: { nome: string; quantidade: number; motivoTroca: string | null }[];
  fotos: FotoComBuffer[];
  assinaturaBuffer?: Buffer; // imagem da assinatura, se já foi capturada
  assinanteNome?: string | null;
}

// Mesma paleta usada em todo o resto do sistema (apps/web/src/styles/global.css
// e apps/mobile/src/theme/colors.ts) - repetida aqui porque o PDFKit não lê
// variáveis CSS, cada cor precisa estar em hex direto no código.
const CORES = {
  navy: '#1a2f75',
  teal: '#12a594',
  fundo: '#f6f7f9',
  superficie: '#ffffff',
  borda: '#e3e6ea',
  texto: '#14161a',
  textoMuted: '#626a78',
  info: '#2a4fc4',
  infoBg: '#eaf0ff',
  aviso: '#92400e',
  avisoBg: '#fef3c7',
  sucesso: '#0b6f64',
  sucessoBg: '#e3f8f4',
  perigo: '#b42318',
  perigoBg: '#fee2e2',
  perigoLinhaBg: '#fef8f8',
  cinzaClaro: '#eef0f3',
};

// Mesmos rótulos/cores do StatusBadge do painel web e do OsCard do mobile -
// nunca mostrar o enum cru (AGENDADA etc.) num documento pro cliente final.
const STATUS_INFO: Record<string, { label: string; cor: string; fundo: string }> = {
  AGENDADA: { label: 'Aberta', cor: CORES.info, fundo: CORES.infoBg },
  EM_ANDAMENTO: { label: 'Em andamento', cor: CORES.aviso, fundo: CORES.avisoBg },
  CONCLUIDA: { label: 'Concluída', cor: CORES.sucesso, fundo: CORES.sucessoBg },
  CANCELADA: { label: 'Cancelada', cor: CORES.textoMuted, fundo: CORES.cinzaClaro },
  PENDENTE_SINCRONIZACAO: { label: 'Pendente sincronização', cor: CORES.perigo, fundo: CORES.perigoBg },
};

const STATUS_CHECKLIST_INFO: Record<string, { simbolo: string; cor: string }> = {
  OK: { simbolo: '✓', cor: CORES.sucesso },
  DEFEITO: { simbolo: '✕', cor: CORES.perigo },
  NAO_APLICAVEL: { simbolo: '–', cor: CORES.textoMuted },
};

// Logo com fundo removido (mesmo asset usado no app mobile e na sidebar do
// painel web) - funciona sobre a faixa navy do cabeçalho, mas ficaria
// invisível sobre fundo branco (ver nota no README do handoff de design).
const LOGO_PATH = path.resolve(process.cwd(), 'assets', 'techvigia-logo.png');

const PAGE_W = 595.28; // A4 em pontos
const PAGE_H = 841.89;
const MARGEM = 40;
const CONTEUDO_W = PAGE_W - MARGEM * 2;
const RODAPE_ALTURA = 40;
const LIMITE_Y = PAGE_H - RODAPE_ALTURA - 15; // abaixo disso, quebra de página

function formatarDataHora(data: Date | null): string {
  if (!data) return '-';
  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    // Explícito de propósito - sem isso, o toLocaleString usa o fuso
    // horário do SISTEMA rodando o servidor. Em desenvolvimento (máquina
    // já em horário de Brasília) isso mascarava o problema; um servidor
    // rodando em UTC (comum em containers de produção) imprimiria toda
    // hora do PDF assinado 3 horas adiantada.
    timeZone: 'America/Sao_Paulo',
  });
}

@Injectable()
export class PdfService {
  async gerarOrdemServicoPdf(dados: DadosOrdemServico): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      // bufferPages:true permite voltar em páginas já desenhadas no final,
      // pra escrever "Página X de Y" - o total só é conhecido depois que
      // tudo foi desenhado (o conteúdo pode gerar mais páginas do que as 2
      // "de referência" do design, se o checklist ou as fotos forem longos).
      const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      let y = 0;

      function desenharLogo(x: number, yTopo: number, altura: number) {
        try {
          doc.image(LOGO_PATH, x, yTopo, { height: altura });
        } catch {
          // Se o arquivo do logo não existir por algum motivo, segue sem ele
          // em vez de travar a geração do PDF inteiro.
        }
      }

      // Faixa navy do topo. `principal` = verdadeira na página 1 (mais alta,
      // com data de emissão); nas páginas seguintes é reduzida (só logo + OS).
      function faixaNavy(principal: boolean): number {
        const altura = principal ? 100 : 60;
        doc.rect(0, 0, PAGE_W, altura).fill(CORES.navy);
        desenharLogo(MARGEM, principal ? 30 : 15, principal ? 32 : 28);

        doc
          .font('Helvetica-Bold')
          .fontSize(principal ? 13 : 12)
          .fillColor('#ffffff')
          .text(dados.numeroOS, 0, principal ? 34 : 24, { width: PAGE_W - MARGEM, align: 'right' });

        if (principal) {
          doc
            .font('Helvetica')
            .fontSize(9)
            .fillColor('#ffffff')
            .fillOpacity(0.75)
            .text(`Emitido em ${formatarDataHora(new Date())}`, 0, 54, {
              width: PAGE_W - MARGEM,
              align: 'right',
            })
            .fillOpacity(1);
        }

        return altura + 26;
      }

      function desenharRodape(numeroPagina: number) {
        doc
          .moveTo(MARGEM, PAGE_H - RODAPE_ALTURA)
          .lineTo(PAGE_W - MARGEM, PAGE_H - RODAPE_ALTURA)
          .lineWidth(0.5)
          .strokeColor(CORES.borda)
          .stroke();

        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor(CORES.textoMuted)
          .text(`Gerado automaticamente em ${formatarDataHora(new Date())}`, MARGEM, PAGE_H - RODAPE_ALTURA + 12, {
            width: CONTEUDO_W / 2,
          });

        doc.text(`Página ${numeroPagina}`, MARGEM, PAGE_H - RODAPE_ALTURA + 12, {
          width: CONTEUDO_W,
          align: 'right',
        });
      }

      // Quebra de página "de continuação" (sem faixa alta, sem repetir data
      // de emissão) - usada quando o checklist ou as fotos são longos demais
      // para caber no espaço já ocupado pela faixa principal da página 1.
      function garantirEspaco(alturaNecessaria: number) {
        if (y + alturaNecessaria > LIMITE_Y) {
          doc.addPage();
          y = faixaNavy(false);
        }
      }

      function tituloSecao(texto: string) {
        garantirEspaco(30);
        doc.font('Helvetica-Bold').fontSize(12).fillColor(CORES.texto).text(texto, MARGEM, y);
        y += 22;
      }

      function badgePill(texto: string, cor: string, fundo: string, xDireita: number, yTopo: number) {
        doc.font('Helvetica-Bold').fontSize(9);
        const largura = doc.widthOfString(texto) + 20;
        const x = xDireita - largura;
        doc.roundedRect(x, yTopo, largura, 18, 9).fill(fundo);
        doc.fillColor(cor).text(texto, x, yTopo + 5, { width: largura, align: 'center' });
        return largura;
      }

      // ---------- PÁGINA 1 ----------
      y = faixaNavy(true);
      y += 6;

      // Card do condomínio
      const alturaCardCondominio = 62;
      garantirEspaco(alturaCardCondominio);
      doc.roundedRect(MARGEM, y, CONTEUDO_W, alturaCardCondominio, 10).fillAndStroke(CORES.superficie, CORES.borda);
      doc
        .font('Helvetica-Bold')
        .fontSize(13)
        .fillColor(CORES.texto)
        .text(dados.condominio.nome, MARGEM + 16, y + 14, { width: CONTEUDO_W - 150 });
      doc
        .font('Helvetica')
        .fontSize(9.5)
        .fillColor(CORES.textoMuted)
        .text(
          `${dados.condominio.endereco} - ${dados.condominio.bairro}, ${dados.condominio.cidade}`,
          MARGEM + 16,
          y + 34,
          { width: CONTEUDO_W - 32 },
        );
      const statusInfo = STATUS_INFO[dados.status] ?? STATUS_INFO.AGENDADA;
      badgePill(statusInfo.label, statusInfo.cor, statusInfo.fundo, MARGEM + CONTEUDO_W - 16, y + 14);
      y += alturaCardCondominio + 16;

      // Card de 3 colunas: técnico / início / fim
      const alturaCardVisita = 50;
      garantirEspaco(alturaCardVisita);
      doc.roundedRect(MARGEM, y, CONTEUDO_W, alturaCardVisita, 10).fillAndStroke(CORES.fundo, CORES.borda);
      const colunaW = CONTEUDO_W / 3;
      const colunas: [string, string][] = [
        ['TÉCNICO', dados.tecnico.nome],
        ['INÍCIO', formatarDataHora(dados.inicio)],
        ['FIM', formatarDataHora(dados.fim)],
      ];
      colunas.forEach(([label, valor], i) => {
        const x = MARGEM + 16 + colunaW * i;
        doc
          .font('Helvetica-Bold')
          .fontSize(7.5)
          .fillColor(CORES.textoMuted)
          .text(label, x, y + 12, { width: colunaW - 16, characterSpacing: 0.3 });
        doc
          .font('Courier')
          .fontSize(9.5)
          .fillColor(CORES.texto)
          .text(valor, x, y + 25, { width: colunaW - 20 });
      });
      y += alturaCardVisita + 20;

      // Checklist
      tituloSecao('Checklist');
      if (dados.checklist.length === 0) {
        doc.font('Helvetica').fontSize(9.5).fillColor(CORES.textoMuted).text('Nenhum item registrado.', MARGEM, y);
        y += 18;
      } else {
        dados.checklist.forEach((item) => {
          garantirEspaco(22);
          const info = STATUS_CHECKLIST_INFO[item.status] ?? STATUS_CHECKLIST_INFO.NAO_APLICAVEL;
          const linhaAltura = item.observacao ? 30 : 20;

          if (item.status === 'DEFEITO') {
            doc.rect(MARGEM, y - 2, CONTEUDO_W, linhaAltura).fill(CORES.perigoLinhaBg);
          }

          doc.font('Helvetica-Bold').fontSize(11).fillColor(info.cor).text(info.simbolo, MARGEM + 4, y);
          doc
            .font('Helvetica')
            .fontSize(10)
            .fillColor(CORES.texto)
            .text(item.item, MARGEM + 22, y + 1, { width: CONTEUDO_W - 30 });

          if (item.observacao) {
            doc
              .font('Helvetica')
              .fontSize(8.5)
              .fillColor(CORES.textoMuted)
              .text(item.observacao, MARGEM + 22, y + 14, { width: CONTEUDO_W - 30 });
          }

          y += linhaAltura;
        });
      }
      y += 12;

      // Peças/pedidos trocados
      tituloSecao('Peças trocadas');
      if (dados.pecas.length === 0) {
        doc.font('Helvetica').fontSize(9.5).fillColor(CORES.textoMuted).text('Nenhuma peça trocada.', MARGEM, y);
        y += 18;
      } else {
        dados.pecas.forEach((peca) => {
          garantirEspaco(18);
          const texto = `${peca.quantidade}x ${peca.nome}${peca.motivoTroca ? ' — ' + peca.motivoTroca : ''}`;
          doc.font('Helvetica').fontSize(9.5).fillColor(CORES.texto).text(texto, MARGEM, y, { width: CONTEUDO_W });
          y += 16;
        });
      }

      // ---------- FOTOS, OBSERVAÇÕES E ASSINATURA ----------
      // Continuam na mesma página quando cabe (OS mais simples, sem fotos,
      // ficam num documento de 1 página só); a quebra pra próxima página só
      // acontece quando o conteúdo realmente não couber mais (garantirEspaco).
      y += 12;

      function grupoFotos(titulo: string, tipo: string) {
        const fotos = dados.fotos.filter((f) => f.tipo === tipo);
        tituloSecao(`Fotos - ${titulo} (${fotos.length})`);

        if (fotos.length === 0) {
          doc.font('Helvetica').fontSize(9.5).fillColor(CORES.textoMuted).text('Nenhuma foto anexada.', MARGEM, y);
          y += 18;
          return;
        }

        const colunas2 = 2;
        const gap = 12;
        const larguraFoto = (CONTEUDO_W - gap) / colunas2;
        const alturaFoto = 110;

        for (let i = 0; i < fotos.length; i += colunas2) {
          garantirEspaco(alturaFoto + gap);
          for (let c = 0; c < colunas2; c++) {
            const foto = fotos[i + c];
            if (!foto) continue;
            const x = MARGEM + c * (larguraFoto + gap);
            try {
              doc.image(foto.buffer, x, y, { width: larguraFoto, height: alturaFoto, fit: [larguraFoto, alturaFoto] });
              doc.roundedRect(x, y, larguraFoto, alturaFoto, 4).strokeColor(CORES.borda).lineWidth(0.5).stroke();
            } catch {
              doc.roundedRect(x, y, larguraFoto, alturaFoto, 4).fillAndStroke(CORES.cinzaClaro, CORES.borda);
              doc
                .font('Helvetica')
                .fontSize(8)
                .fillColor(CORES.textoMuted)
                .text('Não foi possível carregar', x + 10, y + alturaFoto / 2 - 4, { width: larguraFoto - 20 });
            }
          }
          y += alturaFoto + gap;
        }
      }

      grupoFotos('Antes', 'ANTES');
      y += 8;
      grupoFotos('Depois', 'DEPOIS');
      y += 12;

      // Observações
      tituloSecao('Observações');
      const textoObs = dados.observacao?.trim() || 'Nenhuma observação registrada.';
      doc.font('Helvetica').fontSize(9.5);
      const alturaTextoObs = doc.heightOfString(textoObs, { width: CONTEUDO_W - 32 });
      const alturaCardObs = alturaTextoObs + 28;
      garantirEspaco(alturaCardObs);
      doc.roundedRect(MARGEM, y, CONTEUDO_W, alturaCardObs, 10).fillAndStroke(CORES.fundo, CORES.borda);
      doc
        .fillColor(dados.observacao?.trim() ? CORES.texto : CORES.textoMuted)
        .text(textoObs, MARGEM + 16, y + 14, { width: CONTEUDO_W - 32 });
      y += alturaCardObs + 20;

      // Assinatura
      tituloSecao('Assinatura');
      garantirEspaco(90);
      if (dados.assinaturaBuffer) {
        try {
          doc.roundedRect(MARGEM, y, 220, 90, 8).fillAndStroke(CORES.superficie, CORES.borda);
          doc.image(dados.assinaturaBuffer, MARGEM + 10, y + 8, { fit: [200, 55] });
          doc
            .moveTo(MARGEM + 10, y + 68)
            .lineTo(MARGEM + 210, y + 68)
            .lineWidth(0.5)
            .strokeColor(CORES.borda)
            .stroke();
          doc
            .font('Helvetica-Bold')
            .fontSize(9.5)
            .fillColor(CORES.texto)
            .text(dados.assinanteNome?.trim() || 'Responsável não identificado', MARGEM + 10, y + 73, {
              width: 200,
            });
          doc
            .font('Courier')
            .fontSize(8)
            .fillColor(CORES.textoMuted)
            .text(formatarDataHora(dados.fim ?? new Date()), MARGEM + 10, y + 85, { width: 200 });
        } catch {
          doc.font('Helvetica').fontSize(9.5).fillColor(CORES.textoMuted).text('(Não foi possível renderizar a assinatura)', MARGEM, y);
        }
      } else {
        doc.font('Helvetica').fontSize(9.5).fillColor(CORES.textoMuted).text('Assinatura não coletada.', MARGEM, y);
      }

      // ---------- Numeração final ("Página X de Y") ----------
      const totalPaginas = doc.bufferedPageRange().count;
      for (let i = 0; i < totalPaginas; i++) {
        doc.switchToPage(i);
        desenharRodape(i + 1);
        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor(CORES.textoMuted)
          .text(`de ${totalPaginas}`, PAGE_W - MARGEM - 20, PAGE_H - RODAPE_ALTURA + 12, {
            width: 20,
          });
      }

      doc.end();
    });
  }
}

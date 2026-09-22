import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateManutencaoDto,
  UpdateManutencaoDto,
  CheckinManutencaoDto,
  FiltroAgendaDto,
  AssinaturaDto,
  ObservacaoDto,
} from './dto/manutencao.dto';
import { StatusManutencao, TipoManutencao } from '@prisma/client';
import { STORAGE_SERVICE, StorageService } from '../storage/storage.interface';
import { PdfService } from '../pdf/pdf.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { LogAuditoriaService } from '../common/log-auditoria.service';

// "2026-08-14" interpretado como meia-noite UTC (comportamento padrão do
// construtor Date com string de data pura) é 21h do dia ANTERIOR em
// horário de Brasília - filtrar "hoje" com isso gerava uma janela de zero
// segundos, e a agenda do dia voltava vazia. Fixando o offset de Brasília
// explicitamente (-03:00, sem horário de verão desde 2019) resolve isso
// sem precisar de nenhuma biblioteca de data nova.
function inicioDoDiaBrasilia(dataISO: string): Date {
  return new Date(`${dataISO}T00:00:00-03:00`);
}

function fimDoDiaBrasilia(dataISO: string): Date {
  return new Date(`${dataISO}T23:59:59.999-03:00`);
}

@Injectable()
export class ManutencoesService {
  constructor(
    private prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private storageService: StorageService,
    private pdfService: PdfService,
    private whatsappService: WhatsappService,
    private logAuditoria: LogAuditoriaService,
  ) {}

  async create(dto: CreateManutencaoDto) {
    const condominio = await this.prisma.condominio.findFirst({
      where: { id: dto.condominioId, deletedAt: null },
    });
    if (!condominio) {
      throw new BadRequestException('Condomínio informado não existe');
    }

    // Só valida se um técnico foi de fato informado - a OS gerada
    // automaticamente pelo job de recorrência nasce sem técnico, de
    // propósito (ver comentário no DTO).
    if (dto.tecnicoId) {
      const tecnico = await this.prisma.usuario.findFirst({
        where: { id: dto.tecnicoId, ativo: true },
      });
      if (!tecnico) {
        throw new BadRequestException('Técnico informado não existe ou está inativo');
      }
    }

    const numeroOS = await this.gerarNumeroOS();
    // dto.tipo pode vir undefined - nesse caso o schema aplica o default
    // (PREVENTIVA) na hora de gravar. Precisamos saber o valor final aqui
    // pra buscar o modelo de checklist certo logo abaixo.
    const tipoFinal = dto.tipo ?? TipoManutencao.PREVENTIVA;

    const manutencao = await this.prisma.manutencao.create({
      data: {
        numeroOS,
        condominioId: dto.condominioId,
        tecnicoId: dto.tecnicoId ?? null,
        equipamentoId: dto.equipamentoId ?? null,
        inicio: new Date(dto.inicio),
        observacao: dto.observacao,
        status: StatusManutencao.AGENDADA,
        chamadoAvulso: dto.chamadoAvulso ?? false,
        tipo: tipoFinal,
        ...(dto.prioridade && { prioridade: dto.prioridade }),
      },
    });

    // Preenche o checklist automaticamente a partir do modelo cadastrado
    // pra esse tipo (Preventiva/Corretiva), se existir um. Editar o modelo
    // depois não afeta OS já criadas - é só uma cópia, não uma referência.
    const modelo = await this.prisma.checklistModelo.findUnique({
      where: { tipo: tipoFinal },
      include: { itens: { orderBy: { ordem: 'asc' } } },
    });
    if (modelo && modelo.itens.length > 0) {
      await this.prisma.checklistItem.createMany({
        data: modelo.itens.map((modeloItem) => ({
          manutencaoId: manutencao.id,
          item: modeloItem.item,
        })),
      });
    }

    return manutencao;
  }

  // Lista a agenda com filtros - é a base do "calendário de visitas" e
  // também da tela de Ordens de Serviço (mesma listagem, filtros diferentes)
  async findAll(filtro: FiltroAgendaDto) {
    return this.prisma.manutencao.findMany({
      where: {
        deletedAt: null,
        ...(filtro.tecnicoId && { tecnicoId: filtro.tecnicoId }),
        ...(filtro.semTecnico === 'true' && { tecnicoId: null }),
        ...(filtro.condominioId && { condominioId: filtro.condominioId }),
        ...(filtro.condominioNome && {
          condominio: { nome: { contains: filtro.condominioNome, mode: 'insensitive' } },
        }),
        ...(filtro.status && { status: filtro.status }),
        ...(filtro.tipo && { tipo: filtro.tipo }),
        ...(filtro.prioridade && { prioridade: filtro.prioridade }),
        // Uma OS pode estar ligada a um equipamento de duas formas: direto
        // (equipamentoId - o assunto principal da visita, ex: "veio pra
        // essa câmera") ou indireto (through pecas - teve alguma peça
        // trocada nesse equipamento). O filtro considera as duas.
        ...(filtro.equipamentoId && {
          OR: [
            { equipamentoId: filtro.equipamentoId },
            { pecas: { some: { equipamentoId: filtro.equipamentoId } } },
          ],
        }),
        ...(filtro.numeroOS && {
          numeroOS: { contains: filtro.numeroOS, mode: 'insensitive' },
        }),
        ...((filtro.dataInicio || filtro.dataFim) && {
          inicio: {
            ...(filtro.dataInicio && { gte: inicioDoDiaBrasilia(filtro.dataInicio) }),
            ...(filtro.dataFim && { lte: fimDoDiaBrasilia(filtro.dataFim) }),
          },
        }),
      },
      include: {
        condominio: { select: { id: true, nome: true, endereco: true, bairro: true } },
        tecnico: { select: { id: true, nome: true } },
      },
      orderBy: { inicio: 'asc' },
    });
  }

  async findOne(id: string) {
    const manutencao = await this.prisma.manutencao.findFirst({
      where: { id, deletedAt: null },
      include: {
        condominio: true,
        tecnico: { select: { id: true, nome: true, email: true } },
        equipamento: { select: { id: true, tipo: true, fabricante: true, modelo: true } },
        checklist: true,
        fotos: true,
        pecas: true,
      },
    });

    if (!manutencao) {
      throw new NotFoundException('Manutenção não encontrada');
    }

    return manutencao;
  }

  async update(id: string, dto: UpdateManutencaoDto) {
    await this.findOne(id);

    return this.prisma.manutencao.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.inicio && { inicio: new Date(dto.inicio) }),
        ...(dto.fim && { fim: new Date(dto.fim) }),
      },
    });
  }

  // Chamado pelo app mobile quando o técnico chega no condomínio
  async checkin(id: string, dto: CheckinManutencaoDto) {
    const manutencao = await this.findOne(id);

    if (manutencao.status !== StatusManutencao.AGENDADA) {
      throw new BadRequestException(
        'Check-in só pode ser feito em manutenções com status AGENDADA',
      );
    }

    await this.prisma.manutencao.update({
      where: { id },
      data: {
        status: StatusManutencao.EM_ANDAMENTO,
        latitudeCheckin: dto.latitude,
        longitudeCheckin: dto.longitude,
      },
    });

    return this.findOne(id);
  }

  // Rota separada do update() completo (restrito a ADMIN/GESTOR) - qualquer
  // usuário autenticado pode salvar a observação, já que é o técnico em
  // campo quem preenche isso ao fechar a OS.
  async atualizarObservacao(id: string, dto: ObservacaoDto) {
    await this.findOne(id);

    await this.prisma.manutencao.update({
      where: { id },
      data: { observacao: dto.observacao },
    });

    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);

    // Cancelamento lógico: mantém o histórico da OS, mas marca como cancelada
    return this.prisma.manutencao.update({
      where: { id },
      data: { status: StatusManutencao.CANCELADA, deletedAt: new Date() },
    });
  }

  // Recebe a assinatura capturada em tela (base64) e salva como arquivo.
  // Não gera o PDF aqui - isso é feito separadamente em gerarPdf(),
  // pra permitir revisar checklist/peças antes de fechar a OS.
  //
  // A partir daqui, a OS trava para edição (ver AcessoManutencaoService.
  // verificarNaoTravada, chamado pelo controller antes deste método -
  // então essa função nunca roda duas vezes pra mesma OS pelo fluxo normal).
  async uploadAssinatura(id: string, dto: AssinaturaDto, usuarioId?: string) {
    await this.findOne(id);

    const base64Limpo = dto.imagemBase64.replace(/^data:image\/\w+;base64,/, '');
    let buffer: Buffer;
    try {
      buffer = Buffer.from(base64Limpo, 'base64');
      if (buffer.length === 0) throw new Error('buffer vazio');
    } catch {
      throw new BadRequestException('imagemBase64 inválida');
    }

    const assinaturaUrl = await this.storageService.salvar(
      buffer,
      `assinatura-${id}.png`,
      'assinaturas',
    );

    const agora = new Date();

    await this.prisma.manutencao.update({
      where: { id },
      data: { assinaturaUrl, assinanteNome: dto.nomeAssinante, assinadoEm: agora },
    });

    await this.logAuditoria.registrar({
      manutencaoId: id,
      usuarioId,
      acao: 'ASSINATURA_COLETADA',
      detalhes: `Assinante: ${dto.nomeAssinante ?? 'não informado'}`,
    });

    // Mesmo motivo do gerarPdf logo abaixo: retorna o objeto completo, não
    // só os campos escalares do update() - evita a mesma classe de bug
    // (estado do app perdendo checklist/fotos/pecas) em qualquer consumidor
    // futuro dessa rota, mesmo que o app mobile hoje só leia campos
    // específicos da resposta.
    return this.findOne(id);
  }

  // Fecha a OS: gera o PDF, marca como CONCLUIDA e enfileira o
  // envio por WhatsApp (que só efetivamente sai quando a integração
  // com a Meta estiver liberada - ver WhatsappProcessor).
  async gerarPdf(id: string, usuarioId?: string) {
    const manutencao = await this.findOne(id);

    // Defensivo - o controle de acesso (AcessoManutencaoService) já impede
    // qualquer técnico de chegar até aqui numa OS sem técnico atribuído
    // (nenhum id bate com tecnicoId: null), então isso não deveria
    // acontecer na prática. Mas preferível um erro claro aqui do que uma
    // exceção confusa lá na hora de montar o PDF.
    if (!manutencao.tecnico) {
      throw new BadRequestException(
        'Esta OS ainda não tem um técnico atribuído - não é possível gerar o PDF.',
      );
    }

    if (!manutencao.assinaturaUrl) {
      throw new BadRequestException(
        'Não é possível gerar o PDF sem a assinatura coletada. Use POST /manutencoes/:id/assinatura primeiro.',
      );
    }

    // Idempotência: se o PDF já foi gerado antes (OS já concluída), recusa
    // gerar de novo - antes disso, um erro de rede logo depois do sucesso
    // (ex: Redis fora do ar na hora de enfileirar o WhatsApp) fazia o
    // técnico tocar de novo, gerando um segundo PDF e um segundo envio da
    // mesma OS por WhatsApp pro síndico.
    if (manutencao.pdfUrl) {
      throw new ConflictException(
        'O PDF desta OS já foi gerado. Esta ação não pode ser repetida (a OS já está concluída).',
      );
    }

    const assinaturaBuffer = await this.storageService.ler(manutencao.assinaturaUrl);

    // Busca o conteúdo binário de cada foto (o storage guarda só a URL no
    // banco - o PDFKit precisa do buffer de verdade pra desenhar a imagem).
    // Se uma foto específica falhar ao ler (ex: arquivo corrompido), ela é
    // simplesmente omitida do PDF em vez de travar a geração inteira.
    const fotosComBuffer = await Promise.all(
      manutencao.fotos.map(async (foto) => {
        try {
          const buffer = await this.storageService.ler(foto.arquivoUrl);
          return { tipo: foto.tipo as string, buffer };
        } catch {
          return null;
        }
      }),
    );

    const pdfBuffer = await this.pdfService.gerarOrdemServicoPdf({
      numeroOS: manutencao.numeroOS,
      status: manutencao.status,
      inicio: manutencao.inicio,
      fim: manutencao.fim,
      observacao: manutencao.observacao,
      condominio: manutencao.condominio,
      tecnico: manutencao.tecnico,
      checklist: manutencao.checklist,
      pecas: manutencao.pecas,
      fotos: fotosComBuffer.filter((f): f is { tipo: string; buffer: Buffer } => f !== null),
      assinaturaBuffer,
      assinanteNome: manutencao.assinanteNome,
    });

    const pdfUrl = await this.storageService.salvar(
      pdfBuffer,
      `os-${manutencao.numeroOS}.pdf`,
      'pdfs',
    );

    await this.prisma.manutencao.update({
      where: { id },
      data: {
        pdfUrl,
        status: StatusManutencao.CONCLUIDA,
        fim: manutencao.fim ?? new Date(),
      },
    });

    if (manutencao.condominio.whatsapp) {
      await this.whatsappService.enfileirarEnvioPdf({
        manutencaoId: id,
        numeroWhatsappDestino: manutencao.condominio.whatsapp,
        pdfUrl,
        numeroOS: manutencao.numeroOS,
      });
    }

    await this.logAuditoria.registrar({
      manutencaoId: id,
      usuarioId,
      acao: 'OS_CONCLUIDA',
      detalhes: `PDF gerado: ${pdfUrl}`,
    });

    // Retorna o objeto completo (com checklist/fotos/pecas/condominio/
    // tecnico), não só os campos escalares que o update() devolve por
    // padrão - o app mobile usa essa resposta pra atualizar a tela sem
    // precisar de uma nova ida ao servidor, e um objeto parcial aqui
    // apagava esses campos do estado (crash ao tentar filtrar undefined).
    return this.findOne(id);
  }

  // Numeração sequencial por ano (ex: OS-2026000001), via contador atômico
  // no banco - substitui o antigo count()+1, que tinha uma corrida real:
  // dois agendamentos simultâneos liam a mesma contagem e podiam gerar o
  // mesmo numeroOS, estourando erro 500 no segundo (violação da unique).
  // upsert com increment vira um INSERT...ON CONFLICT DO UPDATE atômico no
  // Postgres - o próprio banco serializa duas requisições concorrentes.
  private async gerarNumeroOS(): Promise<string> {
    const ano = new Date().getFullYear();

    const contador = await this.prisma.contadorOS.upsert({
      where: { ano },
      create: { ano, ultimo: 1 },
      update: { ultimo: { increment: 1 } },
    });

    const proximoNumero = String(contador.ultimo).padStart(6, '0');
    return `OS-${ano}${proximoNumero}`;
  }
}

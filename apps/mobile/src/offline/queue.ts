import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = 'scantech_fila_offline';

interface AcaoBase {
  id: string;
  path: string;
  criadoEm: string;
  descricao: string; // texto amigável para mostrar na UI, ex: "Checklist: DVR ligando normalmente"
}

// Ação de corpo JSON - a maioria: check-in, checklist, peças, observação,
// e agora também assinatura (o endpoint de assinatura já recebe a imagem
// como base64 dentro de um JSON, não como multipart - por isso cabe aqui).
export interface AcaoJson extends AcaoBase {
  tipo: 'json';
  metodo: 'POST' | 'PATCH' | 'PUT';
  body: unknown;
}

// Ação de upload de arquivo (fotos) - precisa do caminho de um arquivo já
// copiado para uma pasta PERSISTENTE do app (não o cache temporário do
// ImagePicker, que pode ser apagado pelo sistema operacional a qualquer
// momento, inclusive entre uma sessão do app e outra).
export interface AcaoArquivo extends AcaoBase {
  tipo: 'arquivo';
  campos: Record<string, string>; // ex: { tipo: 'ANTES' }
  arquivoUriLocal: string;
  arquivoNome: string;
  arquivoMime: string;
}

export type AcaoPendente = AcaoJson | AcaoArquivo;

async function lerFila(): Promise<AcaoPendente[]> {
  const json = await AsyncStorage.getItem(QUEUE_KEY);
  return json ? JSON.parse(json) : [];
}

async function salvarFila(fila: AcaoPendente[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(fila));
}

function gerarId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function enfileirarJson(
  acao: Omit<AcaoJson, 'id' | 'criadoEm' | 'tipo' | 'metodo'> & { metodo?: AcaoJson['metodo'] },
): Promise<void> {
  const fila = await lerFila();
  fila.push({
    ...acao,
    tipo: 'json',
    metodo: acao.metodo ?? 'POST',
    id: gerarId(),
    criadoEm: new Date().toISOString(),
  });
  await salvarFila(fila);
}

export async function enfileirarArquivo(
  acao: Omit<AcaoArquivo, 'id' | 'criadoEm' | 'tipo'>,
): Promise<void> {
  const fila = await lerFila();
  fila.push({
    ...acao,
    tipo: 'arquivo',
    id: gerarId(),
    criadoEm: new Date().toISOString(),
  });
  await salvarFila(fila);
}

// Mantido por compatibilidade com quem já chamava enfileirar() para ações
// JSON - equivalente a enfileirarJson().
export const enfileirar = enfileirarJson;

export async function listarPendentes(): Promise<AcaoPendente[]> {
  return lerFila();
}

export async function removerDaFila(id: string): Promise<void> {
  const fila = await lerFila();
  await salvarFila(fila.filter((a) => a.id !== id));
}

/**
 * Percorre a fila e tenta reenviar cada ação pendente. `enviarJson` e
 * `enviarArquivo` cobrem os dois formatos possíveis (corpo JSON simples, ou
 * upload multipart de arquivo). O que falhar de novo (ainda sem conexão)
 * continua na fila para a próxima tentativa - nada é perdido.
 */
export async function processarFila(
  enviarJson: (path: string, metodo: AcaoJson['metodo'], body: unknown) => Promise<unknown>,
  enviarArquivo: (
    path: string,
    campos: Record<string, string>,
    arquivo: { uri: string; name: string; type: string },
  ) => Promise<unknown>,
): Promise<{ processadas: number; pendentes: number }> {
  const fila = await lerFila();
  const restantes: AcaoPendente[] = [];

  for (const acao of fila) {
    try {
      if (acao.tipo === 'arquivo') {
        await enviarArquivo(acao.path, acao.campos, {
          uri: acao.arquivoUriLocal,
          name: acao.arquivoNome,
          type: acao.arquivoMime,
        });
      } else {
        await enviarJson(acao.path, acao.metodo, acao.body);
      }
    } catch {
      restantes.push(acao);
    }
  }

  await salvarFila(restantes);
  return { processadas: fila.length - restantes.length, pendentes: restantes.length };
}

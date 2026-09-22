export interface StorageService {
  /**
   * Salva um arquivo e retorna a URL/caminho público para acessá-lo.
   * @param buffer conteúdo binário do arquivo
   * @param nomeArquivo nome sugerido (será prefixado com um id único)
   * @param pasta subpasta lógica (ex: "assinaturas", "pdfs")
   */
  salvar(buffer: Buffer, nomeArquivo: string, pasta: string): Promise<string>;

  /**
   * Lê de volta um arquivo previamente salvo, a partir da URL retornada por salvar().
   * Necessário para casos como embutir a assinatura dentro do PDF gerado depois.
   */
  ler(url: string): Promise<Buffer>;
}

export const STORAGE_SERVICE = Symbol('STORAGE_SERVICE');

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { StorageService } from './storage.interface';

@Injectable()
export class LocalStorageService implements StorageService {
  private readonly baseDir: string;
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    // Pasta física onde os arquivos ficam salvos no servidor
    this.baseDir = path.resolve(process.cwd(), 'storage');

    // URL pública usada para montar o link de download.
    // Em produção isso deve ser o domínio real por trás do Nginx.
    this.baseUrl =
      this.configService.get<string>('PUBLIC_URL') || 'http://localhost:3000';

    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  async salvar(buffer: Buffer, nomeArquivo: string, pasta: string): Promise<string> {
    const pastaCompleta = path.join(this.baseDir, pasta);
    if (!fs.existsSync(pastaCompleta)) {
      fs.mkdirSync(pastaCompleta, { recursive: true });
    }

    const nomeUnico = `${randomUUID()}-${nomeArquivo}`;
    const caminhoCompleto = path.join(pastaCompleta, nomeUnico);

    await fs.promises.writeFile(caminhoCompleto, buffer);

    return `${this.baseUrl}/arquivos/${pasta}/${nomeUnico}`;
  }

  async ler(url: string): Promise<Buffer> {
    // Converte a URL pública (http://.../arquivos/pasta/arquivo) de volta
    // para o caminho físico no disco.
    const marcador = '/arquivos/';
    const indice = url.indexOf(marcador);
    if (indice === -1) {
      throw new Error(`URL de arquivo inválida: ${url}`);
    }

    const caminhoRelativo = url.substring(indice + marcador.length);
    const caminhoCompleto = path.join(this.baseDir, caminhoRelativo);

    return fs.promises.readFile(caminhoCompleto);
  }
}

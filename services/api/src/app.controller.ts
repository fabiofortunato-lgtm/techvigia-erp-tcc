import { Controller, Get, HttpCode, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from './prisma/prisma.service';

/**
 * Health check do orquestrador (Coolify/Docker), não da aplicação em si -
 * por isso fica solto na raiz, fora de qualquer módulo de domínio, e sem
 * nenhum guard de autenticação: quem chama essa rota é infraestrutura, não
 * um usuário logado, e precisa de resposta rápida mesmo com o resto do
 * sistema instável.
 *
 * Criado a pedido do bilhete de trabalho
 * docs/trabalho/2026-08-23-volume-persistente-e-instancia-dupla.md - sem
 * essa rota, a Coolify não tinha como saber quando um container novo
 * estava pronto pra receber tráfego, o que impedia ligar o healthcheck e
 * contribuía para o problema de duas instâncias respondendo ao mesmo
 * tempo (uma travada em "não sei se subiu", nunca substituída de verdade).
 */
@Controller()
export class AppController {
  constructor(private prisma: PrismaService) {}

  @Get('health')
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  async health() {
    // Confirma conectividade real com o banco, não só "o processo Node
    // está de pé" - um container pode estar rodando e ainda assim incapaz
    // de servir qualquer requisição de verdade se o Postgres não estiver
    // acessível (ex: logo na subida, antes da rede interna do Docker
    // terminar de resolver, ou numa falha momentânea de rede).
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException('Banco de dados inacessível');
    }

    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}

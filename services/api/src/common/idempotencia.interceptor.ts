import {
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, from, of, switchMap } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';

const CABECALHO = 'idempotency-key';

interface RequisicaoComUsuario extends Request {
  user?: { userId: string };
}

/**
 * Faz uma requisição de escrita ser segura de repetir.
 *
 * O técnico usa o app em condomínio com sinal ruim: cada ação vai para uma
 * fila local e é reenviada quando a conexão volta. O caso que estraga o
 * estoque é a resposta perdida no caminho de volta - o servidor gravou a
 * peça e deu baixa, o celular não recebeu o "ok" e, na próxima tentativa,
 * manda tudo de novo. O resultado é peça em dobro na OS e saldo debitado
 * duas vezes, sem erro em lugar nenhum.
 *
 * Com o cabeçalho `Idempotency-Key` (o app manda o identificador que ele já
 * gera para cada item da fila), a primeira chamada reserva a chave, executa
 * e guarda a resposta. Qualquer repetição devolve a resposta guardada sem
 * executar nada.
 *
 * Requisições sem o cabeçalho passam direto - o painel web não precisa
 * disso, porque quem clica vê o resultado na hora.
 */
@Injectable()
export class IdempotenciaInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<RequisicaoComUsuario>();
    const chave = req.headers[CABECALHO] as string | undefined;

    if (!chave || req.method === 'GET') {
      return next.handle();
    }

    // Sem usuário autenticado não há como escopar a chave; essas rotas
    // (login, registro) também não vêm da fila offline.
    const usuarioId = req.user?.userId;
    if (!usuarioId) {
      return next.handle();
    }

    const registro = {
      chave,
      usuarioId,
      metodo: req.method,
      rota: req.path,
    };

    return from(this.reservar(registro)).pipe(
      switchMap((jaExistente) => {
        if (jaExistente) {
          if (jaExistente.resposta === null) {
            // Reserva sem resposta: a primeira tentativa ainda está em
            // andamento (ou morreu no meio). Repetir agora executaria em
            // paralelo - exatamente o que este interceptor existe para
            // evitar -, então o app tenta de novo no próximo ciclo da fila.
            throw new ConflictException(
              'Esta mesma ação já está sendo processada. Tente novamente em instantes.',
            );
          }

          const res = context.switchToHttp().getResponse<Response>();
          res.status(jaExistente.statusHttp ?? 200);
          return of(jaExistente.resposta);
        }

        return next.handle().pipe(
          tap((resposta) => {
            const res = context.switchToHttp().getResponse<Response>();
            void this.prisma.requisicaoIdempotente
              .update({
                where: { usuarioId_chave: { usuarioId, chave } },
                data: {
                  statusHttp: res.statusCode,
                  resposta: (resposta ?? {}) as Prisma.InputJsonValue,
                },
              })
              .catch(() => undefined);
          }),
          catchError((erro) => {
            // A ação falhou: a reserva sai da frente para que uma nova
            // tentativa com a mesma chave possa realmente executar. Sem
            // isso, um erro passageiro (banco reiniciando, timeout)
            // deixaria a ação travada em "já está sendo processada" para
            // sempre, e o registro nunca chegaria ao sistema.
            return from(
              this.prisma.requisicaoIdempotente
                .delete({ where: { usuarioId_chave: { usuarioId, chave } } })
                .catch(() => undefined),
            ).pipe(
              switchMap(() => {
                throw erro;
              }),
            );
          }),
        );
      }),
    );
  }

  /**
   * Tenta reservar a chave. Devolve null quando a reserva foi feita agora
   * (pode executar) ou o registro existente quando a chave já era conhecida.
   *
   * A reserva é um INSERT: é o próprio banco, com a chave primária, que
   * decide quem chegou primeiro. Fazer "consulta e depois grava" deixaria
   * uma janela em que dois reenvios simultâneos passariam os dois.
   */
  private async reservar(registro: {
    chave: string;
    usuarioId: string;
    metodo: string;
    rota: string;
  }) {
    try {
      await this.prisma.requisicaoIdempotente.create({ data: registro });
      return null;
    } catch (erro) {
      if (
        erro instanceof Prisma.PrismaClientKnownRequestError &&
        erro.code === 'P2002'
      ) {
        return this.prisma.requisicaoIdempotente.findUnique({
          where: {
            usuarioId_chave: {
              usuarioId: registro.usuarioId,
              chave: registro.chave,
            },
          },
        });
      }
      throw erro;
    }
  }
}

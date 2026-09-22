import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { MulterError } from 'multer';

@Catch(MulterError)
export class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: MulterError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const mensagens: Record<string, string> = {
      LIMIT_FILE_SIZE: 'Arquivo muito grande. O limite é de 10MB por foto.',
      LIMIT_UNEXPECTED_FILE: 'Campo de arquivo inesperado (esperado: "arquivo").',
    };

    response.status(HttpStatus.BAD_REQUEST).json({
      statusCode: HttpStatus.BAD_REQUEST,
      message: mensagens[exception.code] || `Erro no upload: ${exception.message}`,
      error: 'Bad Request',
    });
  }
}

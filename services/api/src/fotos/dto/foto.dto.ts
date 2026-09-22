import { IsEnum } from 'class-validator';
import { TipoFoto } from '@prisma/client';

export class UploadFotoDto {
  @IsEnum(TipoFoto)
  tipo: TipoFoto; // ANTES ou DEPOIS
}

import { IsEnum } from 'class-validator';
import { PerfilUsuario } from '@prisma/client';

export class UpdatePerfilDto {
  @IsEnum(PerfilUsuario)
  perfil: PerfilUsuario;
}

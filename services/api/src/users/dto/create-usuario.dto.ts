import { IsEmail, IsString, IsEnum, MinLength } from 'class-validator';
import { PerfilUsuario } from '@prisma/client';

export class CreateUsuarioDto {
  @IsString()
  @MinLength(2)
  nome: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  senha: string;

  @IsEnum(PerfilUsuario)
  perfil: PerfilUsuario;
}

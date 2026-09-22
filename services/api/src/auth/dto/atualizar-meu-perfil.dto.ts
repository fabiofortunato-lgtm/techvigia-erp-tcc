import { IsEmail, IsString, IsOptional, MinLength } from 'class-validator';

export class AtualizarMeuPerfilDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  nome?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

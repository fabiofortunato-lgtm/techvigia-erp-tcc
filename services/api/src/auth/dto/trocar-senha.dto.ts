import { IsString, MinLength } from 'class-validator';

export class TrocarSenhaDto {
  @IsString()
  senhaAtual: string;

  @IsString()
  @MinLength(8)
  novaSenha: string;
}

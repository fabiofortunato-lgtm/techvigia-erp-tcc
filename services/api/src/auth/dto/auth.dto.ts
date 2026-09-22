import { IsEmail, IsString, IsOptional, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  senha: string;
}

export class RefreshTokenDto {
  @IsOptional()
  @IsString()
  refreshToken?: string; // opcional: o painel web manda o refreshToken via cookie httpOnly,
  // só o app mobile precisa preencher esse campo no corpo da requisição
}

export class RegisterDto {
  @IsString()
  nome: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  senha: string;
}

export class EsqueciSenhaDto {
  @IsEmail()
  email: string;
}

export class RedefinirSenhaDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(8)
  novaSenha: string;
}

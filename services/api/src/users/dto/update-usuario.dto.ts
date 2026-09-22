import { IsEmail, IsString, IsOptional, IsBoolean, MinLength } from 'class-validator';

export class UpdateUsuarioDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  nome?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  // Desativar em vez de excluir de verdade - preserva o histórico de OS
  // já atribuídas a esse usuário (soft delete via ativo:false, não via
  // deletedAt, que teria o mesmo problema de "trava o e-mail pra sempre"
  // já documentado como limitação conhecida no README).
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}

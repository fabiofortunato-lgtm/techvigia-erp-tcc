import {
  IsString,
  IsEmail,
  IsOptional,
  IsInt,
  Min,
  Length,
} from 'class-validator';

export class CreateCondominioDto {
  @IsString()
  @Length(3, 150)
  nome: string;

  @IsOptional()
  @IsString()
  @Length(14, 18) // aceita com ou sem máscara
  cnpj?: string;

  @IsOptional()
  @IsString()
  @Length(11, 14) // aceita com ou sem máscara
  cpf?: string;

  @IsString()
  endereco: string;

  @IsString()
  bairro: string;

  @IsString()
  cidade: string;

  @IsString()
  @Length(8, 9)
  cep: string;

  @IsOptional()
  @IsString()
  telefone?: string;

  @IsOptional()
  @IsString()
  whatsapp?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  sindico?: string;

  @IsOptional()
  @IsString()
  zelador?: string;

  @IsInt()
  @Min(1)
  periodicidade: number; // dias entre manutenções preventivas
}

export class UpdateCondominioDto {
  @IsOptional()
  @IsString()
  @Length(3, 150)
  nome?: string;

  @IsOptional()
  @IsString()
  endereco?: string;

  @IsOptional()
  @IsString()
  bairro?: string;

  @IsOptional()
  @IsString()
  cidade?: string;

  @IsOptional()
  @IsString()
  @Length(8, 9)
  cep?: string;

  @IsOptional()
  @IsString()
  telefone?: string;

  @IsOptional()
  @IsString()
  whatsapp?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  sindico?: string;

  @IsOptional()
  @IsString()
  zelador?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  periodicidade?: number;
}

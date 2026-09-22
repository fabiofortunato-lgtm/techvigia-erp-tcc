import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  IsNumber,
  IsEnum,
  Length,
} from 'class-validator';
import { TipoMovimentacaoEstoque } from '@prisma/client';

export class CreateItemEstoqueDto {
  @IsString()
  @Length(2, 100)
  nome: string;

  @IsOptional()
  @IsString()
  unidade?: string; // un, m, cx...

  @IsOptional()
  @IsInt()
  @Min(0)
  quantidade?: number; // saldo inicial, opcional (default 0)

  @IsOptional()
  @IsInt()
  @Min(0)
  quantidadeMinima?: number;

  @IsOptional()
  @IsNumber()
  custoUnitario?: number;

  @IsOptional()
  @IsString()
  fornecedor?: string;
}

export class UpdateItemEstoqueDto {
  @IsOptional()
  @IsString()
  @Length(2, 100)
  nome?: string;

  @IsOptional()
  @IsString()
  unidade?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  quantidadeMinima?: number;

  @IsOptional()
  @IsNumber()
  custoUnitario?: number;

  @IsOptional()
  @IsString()
  fornecedor?: string;
}

export class MovimentarEstoqueDto {
  @IsEnum(TipoMovimentacaoEstoque)
  tipo: TipoMovimentacaoEstoque;

  @IsInt()
  @Min(1)
  quantidade: number;

  @IsOptional()
  @IsString()
  motivo?: string;
}

import { IsString, IsOptional, IsInt, Min, IsUUID, IsNumber, Length } from 'class-validator';

export class CreatePecaDto {
  @IsString()
  @Length(2, 100)
  nome: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantidade?: number; // padrão: 1 (definido no schema)

  @IsOptional()
  @IsString()
  motivoTroca?: string;

  @IsOptional()
  @IsUUID()
  equipamentoId?: string; // qual câmera/DVR/etc. recebeu a peça

  @IsOptional()
  @IsUUID()
  itemEstoqueId?: string; // se vier do estoque controlado, dá baixa automática

  @IsOptional()
  @IsNumber()
  custoUnitario?: number;

  @IsOptional()
  @IsString()
  fornecedor?: string;
}

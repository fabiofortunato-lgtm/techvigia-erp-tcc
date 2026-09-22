import {
  IsString,
  IsOptional,
  IsDateString,
  IsUUID,
  IsEnum,
  IsInt,
  Length,
  Min,
} from 'class-validator';
import { StatusEquipamento } from '@prisma/client';

export class CreateEquipamentoDto {
  @IsUUID()
  condominioId: string;

  @IsString()
  @Length(2, 60)
  tipo: string; // DVR, Câmera, Nobreak, etc.

  @IsOptional()
  @IsString()
  local?: string; // Ex: "Portaria", "Garagem subsolo 1"

  @IsOptional()
  @IsEnum(StatusEquipamento)
  status?: StatusEquipamento;

  @IsString()
  fabricante: string;

  @IsString()
  modelo: string;

  @IsOptional()
  @IsString()
  numeroSerie?: string;

  @IsOptional()
  @IsString()
  patrimonio?: string;

  @IsOptional()
  @IsDateString()
  garantiaAte?: string;

  @IsDateString()
  dataInstalacao: string;

  // Meses entre uma troca e outra (ex: 12 para bateria trocada anualmente).
  // Ausente = esse equipamento não tem troca periódica prevista.
  @IsOptional()
  @IsInt()
  @Min(1)
  intervaloTrocaMeses?: number;

  @IsOptional()
  @IsDateString()
  dataUltimaTroca?: string;
}

export class UpdateEquipamentoDto {
  @IsOptional()
  @IsString()
  @Length(2, 60)
  tipo?: string;

  @IsOptional()
  @IsString()
  local?: string;

  @IsOptional()
  @IsEnum(StatusEquipamento)
  status?: StatusEquipamento;

  @IsOptional()
  @IsString()
  fabricante?: string;

  @IsOptional()
  @IsString()
  modelo?: string;

  @IsOptional()
  @IsString()
  numeroSerie?: string;

  @IsOptional()
  @IsString()
  patrimonio?: string;

  @IsOptional()
  @IsDateString()
  garantiaAte?: string;

  @IsOptional()
  @IsDateString()
  dataInstalacao?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  intervaloTrocaMeses?: number;

  @IsOptional()
  @IsDateString()
  dataUltimaTroca?: string;
}

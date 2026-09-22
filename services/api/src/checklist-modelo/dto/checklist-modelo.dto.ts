import { IsEnum, IsString, IsOptional, IsInt, Length, Min } from 'class-validator';
import { TipoManutencao } from '@prisma/client';

export class CreateChecklistModeloDto {
  @IsEnum(TipoManutencao)
  tipo: TipoManutencao;

  @IsString()
  @Length(2, 100)
  nome: string;
}

export class UpdateChecklistModeloDto {
  @IsOptional()
  @IsString()
  @Length(2, 100)
  nome?: string;
}

export class CreateChecklistModeloItemDto {
  @IsString()
  @Length(2, 200)
  item: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  ordem?: number;
}

export class UpdateChecklistModeloItemDto {
  @IsOptional()
  @IsString()
  @Length(2, 200)
  item?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  ordem?: number;
}

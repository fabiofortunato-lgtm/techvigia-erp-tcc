import { IsString, IsOptional, IsEnum, Length } from 'class-validator';
import { StatusChecklistItem } from '@prisma/client';

export class CreateChecklistItemDto {
  @IsString()
  @Length(2, 150)
  item: string;

  @IsEnum(StatusChecklistItem)
  status: StatusChecklistItem;

  @IsOptional()
  @IsString()
  observacao?: string;
}

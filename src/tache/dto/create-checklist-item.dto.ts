import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateChecklistItemDto {
  @ApiProperty({ example: 'Rédiger les cas de test' })
  @IsString()
  @MinLength(1, { message: 'Le libellé est requis' })
  label!: string;
}

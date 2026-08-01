import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class StartCallDto {
  @ApiProperty({ description: 'Identifiant de la personne appelée.' })
  @IsString()
  calleeId!: string;

  @ApiPropertyOptional({
    description:
      'Fil direct d’où part l’appel, pour rattacher la trace à la conversation.',
  })
  @IsOptional()
  @IsString()
  conversationId?: string;
}

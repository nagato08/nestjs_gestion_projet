import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateMessageDto {
  @ApiProperty({ example: 'Bonjour, avez-vous des nouvelles sur le projet ?' })
  @IsNotEmpty()
  @IsString()
  content: string;

  @ApiProperty({
    example: ['cuid_user_1', 'cuid_user_2'],
    description: 'Liste des IDs des utilisateurs mentionnés (@username)',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mentions?: string[];
}

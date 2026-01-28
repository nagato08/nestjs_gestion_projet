import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({ example: 'Cette tâche nécessite une révision du design' })
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

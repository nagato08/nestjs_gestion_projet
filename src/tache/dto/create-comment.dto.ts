import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({ example: 'Cette tâche nécessite une révision du design' })
  @IsNotEmpty({ message: 'Le contenu du commentaire est requis' })
  @IsString({ message: 'Le contenu doit être une chaîne de caractères' })
  content: string;

  @ApiProperty({
    example: ['cuid_user_1', 'cuid_user_2'],
    description: 'Liste des IDs des utilisateurs mentionnés (@username)',
    required: false,
  })
  @IsOptional()
  @IsArray({ message: 'Les mentions doivent être un tableau' })
  @IsString({
    each: true,
    message: 'Chaque mention doit être une chaîne de caractères',
  })
  mentions?: string[];
}

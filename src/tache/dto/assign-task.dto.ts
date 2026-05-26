import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsString } from 'class-validator';

export class AssignTaskDto {
  @ApiProperty({
    example: ['cuid_user_1', 'cuid_user_2'],
    description: 'Liste des IDs des utilisateurs à assigner à la tâche',
  })
  @IsNotEmpty({ message: 'La liste des utilisateurs est requise' })
  @IsArray({ message: 'userIds doit être un tableau' })
  @IsString({
    each: true,
    message: 'Chaque identifiant utilisateur doit être une chaîne',
  })
  userIds: string[];
}

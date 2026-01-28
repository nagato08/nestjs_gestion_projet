import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsString } from 'class-validator';

export class AssignTaskDto {
  @ApiProperty({
    example: ['cuid_user_1', 'cuid_user_2'],
    description: 'Liste des IDs des utilisateurs à assigner à la tâche',
  })
  @IsNotEmpty()
  @IsArray()
  @IsString({ each: true })
  userIds: string[];
}

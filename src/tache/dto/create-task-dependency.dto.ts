import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateTaskDependencyDto {
  @ApiProperty({
    example: 'cuid_blocked_task_id',
    description: 'ID de la tâche qui est bloquée (doit attendre)',
  })
  @IsNotEmpty({ message: "L'identifiant de la tâche bloquée est requis" })
  @IsString({ message: "L'identifiant doit être une chaîne de caractères" })
  blockedTaskId: string;
}

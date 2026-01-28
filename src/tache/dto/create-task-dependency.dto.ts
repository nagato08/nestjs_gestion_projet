import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateTaskDependencyDto {
  @ApiProperty({
    example: 'cuid_blocked_task_id',
    description: 'ID de la tâche qui est bloquée (doit attendre)',
  })
  @IsNotEmpty()
  @IsString()
  blockedTaskId: string;
}

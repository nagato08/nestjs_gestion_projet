import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class StartTimerDto {
  @ApiProperty({ example: 'cuid_task_id' })
  @IsNotEmpty({ message: "L'identifiant de la tâche est requis" })
  @IsString({ message: "L'identifiant doit être une chaîne de caractères" })
  taskId: string;
}

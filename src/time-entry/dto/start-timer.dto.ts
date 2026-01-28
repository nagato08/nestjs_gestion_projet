import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class StartTimerDto {
  @ApiProperty({ example: 'cuid_task_id' })
  @IsNotEmpty()
  @IsString()
  taskId: string;
}

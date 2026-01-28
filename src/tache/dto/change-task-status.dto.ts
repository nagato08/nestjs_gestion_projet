import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { TaskStatus } from '@prisma/client';

export class ChangeTaskStatusDto {
  @ApiProperty({ enum: TaskStatus, example: TaskStatus.DOING })
  @IsNotEmpty()
  @IsEnum(TaskStatus)
  status: TaskStatus;
}

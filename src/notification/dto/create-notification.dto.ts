import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateNotificationDto {
  @ApiProperty({
    example: 'TASK_ASSIGNED',
    enum: [
      'TASK_ASSIGNED',
      'TASK_STATUS_CHANGED',
      'TASK_COMMENT',
      'DOCUMENT_UPLOADED',
      'DOCUMENT_COMMENT',
      'PROJECT_MESSAGE',
      'PROJECT_MEMBER_ADDED',
      'DEADLINE_APPROACHING',
      'DEADLINE_PASSED',
    ],
  })
  @IsNotEmpty()
  @IsString()
  type: string;

  @ApiProperty({
    example: 'Vous avez été assigné à la tâche "Implémenter le login"',
  })
  @IsNotEmpty()
  @IsString()
  content: string;

  @ApiProperty({ example: 'cuid_user_id' })
  @IsNotEmpty()
  @IsString()
  userId: string;
}

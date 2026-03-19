import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ActDto {
  @ApiProperty({ example: 'cuid_project_123' })
  @IsNotEmpty()
  @IsString()
  projectId: string;

  @ApiProperty({
    example: 'Crée la tâche "Tests E2E" en priorité haute',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  message: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class InterpretDto {
  @ApiProperty({ example: 'cuid_project_123' })
  @IsNotEmpty()
  @IsString()
  projectId: string;

  @ApiProperty({
    example:
      'Crée une tâche "Revue design" priorité haute et assigne-la à Marie',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  message: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class AssignSprintTasksDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  taskIds!: string[];

  @ApiPropertyOptional({
    description:
      'Sprint cible. Omis ou null : les tâches retournent au backlog.',
  })
  @IsOptional()
  @IsString()
  sprintId?: string | null;
}

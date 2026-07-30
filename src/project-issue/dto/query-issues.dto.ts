import { ApiPropertyOptional } from '@nestjs/swagger';
import { IssueSeverity, IssueStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class QueryIssuesDto {
  @ApiPropertyOptional({
    description: 'Restreindre aux difficultés rattachées à cette tâche',
  })
  @IsOptional()
  @IsString()
  taskId?: string;

  @ApiPropertyOptional({ enum: IssueSeverity })
  @IsOptional()
  @IsEnum(IssueSeverity)
  severity?: IssueSeverity;

  @ApiPropertyOptional({ enum: IssueStatus })
  @IsOptional()
  @IsEnum(IssueStatus)
  status?: IssueStatus;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateDocumentDto {
  @ApiProperty({ example: 'Rapport_Projet_2025.pdf' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 'cuid_project_id' })
  @IsNotEmpty()
  @IsString()
  projectId: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateDocumentDto {
  @ApiProperty({ example: 'Rapport_Projet_2025.pdf' })
  @IsNotEmpty({ message: 'Le nom du document est requis' })
  @IsString({ message: 'Le nom doit être une chaîne de caractères' })
  name: string;

  @ApiProperty({ example: 'cuid_project_id' })
  @IsNotEmpty({ message: "L'identifiant du projet est requis" })
  @IsString({ message: "L'identifiant doit être une chaîne de caractères" })
  projectId: string;
}

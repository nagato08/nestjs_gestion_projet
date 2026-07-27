import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectRole } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AddProjectMemberDto {
  @ApiProperty({ example: 'cuid_user' })
  @IsNotEmpty({ message: "L'identifiant de l'utilisateur est requis" })
  @IsString({
    message: "L'identifiant doit être une chaîne de caractères",
  })
  userId!: string;

  @ApiPropertyOptional({
    enum: ProjectRole,
    default: ProjectRole.MEMBER,
    description:
      'Rôle du membre dans le projet. Par défaut MEMBER. OWNER est refusé ici : utiliser le transfert de propriété.',
  })
  @IsOptional()
  @IsEnum(ProjectRole, { message: 'Rôle projet invalide' })
  role?: ProjectRole;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectRole } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional } from 'class-validator';

export class InviteProjectMemberDto {
  @ApiProperty({ example: 'collegue@exemple.fr' })
  @IsEmail({}, { message: 'Adresse email invalide' })
  email: string;

  @ApiPropertyOptional({
    enum: ProjectRole,
    default: ProjectRole.MEMBER,
    description:
      'Rôle attribué automatiquement à l’acceptation. OWNER est refusé.',
  })
  @IsOptional()
  @IsEnum(ProjectRole, { message: 'Rôle projet invalide' })
  role?: ProjectRole;
}

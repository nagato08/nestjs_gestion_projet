import { ApiProperty } from '@nestjs/swagger';
import { ProjectRole } from '@prisma/client';
import { IsEnum, IsString } from 'class-validator';

export class UpdateMemberRoleDto {
  @ApiProperty({ description: 'Identifiant du membre à modifier' })
  @IsString()
  userId: string;

  @ApiProperty({
    enum: ProjectRole,
    description:
      'Nouveau rôle dans le projet. OWNER est réservé au transfert de propriété.',
  })
  @IsEnum(ProjectRole)
  role: ProjectRole;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class JoinProjectByCodeDto {
  @ApiProperty({ example: 'CODE-XYZ-2025' })
  @IsNotEmpty({ message: 'Le code du projet est requis' })
  @IsString({ message: 'Le code doit être une chaîne de caractères' })
  projectCode!: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class InviteProjectMemberDto {
  @ApiProperty({ example: 'collegue@exemple.fr' })
  @IsEmail({}, { message: 'Adresse email invalide' })
  email: string;
}

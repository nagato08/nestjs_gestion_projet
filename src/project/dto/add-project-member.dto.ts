import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AddProjectMemberDto {
  @ApiProperty({ example: 'cuid_user' })
  @IsNotEmpty({ message: "L'identifiant de l'utilisateur est requis" })
  @IsString({
    message: "L'identifiant doit être une chaîne de caractères",
  })
  userId!: string;
}

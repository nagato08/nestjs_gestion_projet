import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
export class LoginDTO {
  @IsNotEmpty({ message: "L'email est requis" })
  @IsString({ message: "L'email doit être une chaîne de caractères" })
  @IsEmail(
    {
      blacklisted_chars: "!#$%&'*+/=?^_`{|}~ ",
    },
    { message: "Format d'email invalide" },
  )
  @ApiProperty({
    example: 'tadjojeremie@gmail.com',
    description: 'The email of the user',
    type: String,
  })
  email!: string;

  @IsNotEmpty({ message: 'Le mot de passe est requis' })
  @IsString({ message: 'Le mot de passe doit être une chaîne de caractères' })
  @MinLength(8, {
    message: 'Le mot de passe doit contenir au moins 8 caractères',
  })
  @ApiProperty({
    description: 'The password of the user',
    type: String,
  })
  password!: string;
}

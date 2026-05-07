import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
export class LoginDTO {
  @IsNotEmpty()
  @IsString({ message: 'email must be a string' })
  @IsEmail(
    {
      blacklisted_chars: "!#$%&'*+/=?^_`{|}~ ",
    },
    { message: 'email must be a valid email address' },
  )
  @ApiProperty({
    example: 'tadjojeremie@gmail.com',
    description: 'The email of the user',
    type: String,
  })
  email!: string;

  @IsNotEmpty()
  @IsString({ message: 'password must be a string' })
  @MinLength(8, { message: 'password must be at least 8 characters long' })
  @ApiProperty({
    description: 'The password of the user',
    type: String,
  })
  password!: string;
}

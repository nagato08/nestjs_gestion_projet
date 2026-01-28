/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Role, Department } from '@prisma/client';

export class CreateUserDto {
  @IsNotEmpty()
  @IsString({ message: 'firstName must be a string' })
  @ApiProperty({
    example: 'John',
    description: 'The first name of the user',
  })
  firstName: string;

  @IsNotEmpty()
  @IsString({ message: 'lastName must be a string' })
  @ApiProperty({
    example: 'Doe',
    description: 'The last name of the user',
  })
  lastName: string;

  @IsNotEmpty()
  @IsEmail(
    { blacklisted_chars: "!#$%&'*+/=?^_`{|}~ " },
    { message: 'email must be a valid email address' },
  )
  @ApiProperty({
    example: 'tadjojeremie@gmail.com',
    description: 'The email of the user',
  })
  email: string;

  @IsNotEmpty()
  @IsString({ message: 'password must be a string' })
  @MinLength(8, { message: 'password must be at least 8 characters long' })
  @ApiProperty({
    description: 'The password of the user',
    minLength: 8,
  })
  password: string;

  // ---------------------------
  // Rôle & département
  // ---------------------------

  @IsNotEmpty()
  @IsEnum(Role, {
    message: 'role must be either PROJECT_MANAGER or EMPLOYEE',
  })
  @ApiProperty({
    enum: Role,
    example: Role.EMPLOYEE,
    description: 'The role assigned by the admin',
  })
  role: Role;

  @IsNotEmpty()
  @IsEnum(Department, {
    message: 'department must be a valid Department enum value',
  })
  @ApiProperty({
    enum: Department,
    example: Department.IT,
    description: 'The department of the user',
  })
  department: Department;

  // ---------------------------
  // Profil (optionnel)
  // ---------------------------

  @IsOptional()
  @IsString({ message: 'jobTitle must be a string' })
  @ApiProperty({
    example: 'Backend Developer',
    required: false,
  })
  jobTitle?: string;

  @IsOptional()
  @IsString({ message: 'avatar must be a string (URL)' })
  @ApiProperty({
    example: 'https://cdn.app.com/avatars/user.png',
    required: false,
  })
  avatar?: string;
}

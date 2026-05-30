import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { Role, Department } from '@prisma/client';

export class AdminCreateUserDto {
  @IsNotEmpty({ message: 'Le prénom est requis' })
  @IsString({ message: 'Le prénom doit être une chaîne de caractères' })
  @ApiProperty({ example: 'John' })
  firstName!: string;

  @IsNotEmpty({ message: 'Le nom de famille est requis' })
  @IsString({ message: 'Le nom doit être une chaîne de caractères' })
  @ApiProperty({ example: 'Doe' })
  lastName!: string;

  @IsNotEmpty({ message: "L'email est requis" })
  @IsEmail(
    { blacklisted_chars: "!#$%&'*+/=?^_`{|}~ " },
    { message: "Format d'email invalide" },
  )
  @ApiProperty({ example: 'user@example.com' })
  email!: string;

  @IsNotEmpty({ message: 'Le rôle est requis' })
  @IsEnum(Role, {
    message: 'Rôle invalide (ADMIN, PROJECT_MANAGER ou EMPLOYEE)',
  })
  @ApiProperty({ enum: Role, example: Role.EMPLOYEE })
  role!: Role;

  @IsNotEmpty({ message: 'Le département est requis' })
  @IsEnum(Department, { message: 'Département invalide' })
  @ApiProperty({ enum: Department, example: Department.IT })
  department!: Department;

  @IsOptional()
  @IsString({ message: 'Le poste doit être une chaîne de caractères' })
  @ApiProperty({ example: 'Backend Developer', required: false })
  jobTitle?: string;
}

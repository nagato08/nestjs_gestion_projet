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
  @IsNotEmpty({ message: 'Le prénom est requis' })
  @IsString({ message: 'Le prénom doit être une chaîne de caractères' })
  @ApiProperty({
    example: 'John',
    description: 'The first name of the user',
  })
  firstName!: string;

  @IsNotEmpty({ message: 'Le nom de famille est requis' })
  @IsString({ message: 'Le nom doit être une chaîne de caractères' })
  @ApiProperty({
    example: 'Doe',
    description: 'The last name of the user',
  })
  lastName!: string;

  @IsNotEmpty({ message: "L'email est requis" })
  @IsEmail(
    { blacklisted_chars: "!#$%&'*+/=?^_`{|}~ " },
    { message: "Format d'email invalide" },
  )
  @ApiProperty({
    example: 'tadjojeremie@gmail.com',
    description: 'The email of the user',
  })
  email!: string;

  @IsNotEmpty({ message: 'Le mot de passe est requis' })
  @IsString({ message: 'Le mot de passe doit être une chaîne de caractères' })
  @MinLength(8, {
    message: 'Le mot de passe doit contenir au moins 8 caractères',
  })
  @ApiProperty({
    description: 'The password of the user',
    minLength: 8,
  })
  password!: string;

  // ---------------------------
  // Rôle & département
  // ---------------------------

  // Note sécurité : ce champ est ignoré par l'inscription publique (toujours EMPLOYEE).
  // Conservé optionnel pour compatibilité ; la création de comptes privilégiés passe par /auth/users (admin).
  @IsOptional()
  @IsEnum(Role, {
    message: 'Rôle invalide (ADMIN, PROJECT_MANAGER ou EMPLOYEE)',
  })
  @ApiProperty({
    enum: Role,
    required: false,
    description: 'Ignoré à l’inscription publique (toujours EMPLOYEE).',
  })
  role?: Role;

  @IsNotEmpty({ message: 'Le département est requis' })
  @IsEnum(Department, {
    message: 'Département invalide',
  })
  @ApiProperty({
    enum: Department,
    example: Department.IT,
    description: 'The department of the user',
  })
  department!: Department;

  // ---------------------------
  // Profil (optionnel)
  // ---------------------------

  @IsOptional()
  @IsString({ message: 'Le poste doit être une chaîne de caractères' })
  @ApiProperty({
    example: 'Backend Developer',
    required: false,
  })
  jobTitle?: string;

  @IsOptional()
  @IsString({ message: "L'avatar doit être une URL (chaîne de caractères)" })
  @ApiProperty({
    example: 'https://cdn.app.com/avatars/user.png',
    required: false,
  })
  avatar?: string;
}

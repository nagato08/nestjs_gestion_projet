import { IsString, IsOptional, IsEmail } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString({ message: 'Le prénom doit être une chaîne de caractères' })
  firstName?: string;

  @IsOptional()
  @IsString({ message: 'Le nom doit être une chaîne de caractères' })
  lastName?: string;

  @IsOptional()
  @IsEmail({}, { message: "Format d'email invalide" })
  email?: string;

  @IsOptional()
  @IsString({ message: 'Le poste doit être une chaîne de caractères' })
  jobTitle?: string;

  @IsOptional()
  @IsString({ message: "L'avatar doit être une URL (chaîne de caractères)" })
  avatar?: string;
}

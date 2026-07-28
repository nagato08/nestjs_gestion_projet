import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

/** Fichier joint à un message de chat. */
export class ChatAttachmentDto {
  @IsString()
  name!: string;

  @IsUrl({}, { message: 'URL de pièce jointe invalide' })
  url!: string;

  @IsInt()
  @Min(0)
  size!: number;

  @IsString()
  mimeType!: string;
}

export class SendChatDto {
  @IsString({
    message: 'Vous devez fournir un message.',
  })
  @MinLength(1, {
    message: 'Votre message doit contenir au moins un caractère.',
  })
  content!: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Identifiants des utilisateurs mentionnés (@)',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mentions?: string[];

  @ApiPropertyOptional({
    type: [ChatAttachmentDto],
    description:
      'Fichiers joints, déjà téléversés. Remplace l’encodage [attachment:…] dans le contenu.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatAttachmentDto)
  attachments?: ChatAttachmentDto[];
}

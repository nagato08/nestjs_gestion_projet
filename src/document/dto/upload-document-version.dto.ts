import { ApiProperty } from '@nestjs/swagger';

export class UploadDocumentVersionDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Fichier à uploader',
  })
  file: Express.Multer.File;
}

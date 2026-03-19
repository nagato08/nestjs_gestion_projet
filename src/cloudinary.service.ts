/* eslint-disable @typescript-eslint/prefer-promise-reject-errors */
import { Injectable, Logger } from '@nestjs/common';
import { v2 as cloudinary, UploadApiOptions } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor() {
    if (!process.env.CLOUDINARY_URL) {
      this.logger.warn(
        'CLOUDINARY_URL non définie : stockage Cloudinary désactivé.',
      );
      return;
    }

    cloudinary.config({
      secure: true,
    });
  }

  async uploadDocument(
    file: Express.Multer.File,
    options?: UploadApiOptions,
  ): Promise<{ url: string; publicId: string }> {
    if (!process.env.CLOUDINARY_URL) {
      throw new Error(
        'CLOUDINARY_URL non définie. Impossible de téléverser le document.',
      );
    }

    if (!file) {
      throw new Error('Aucun fichier fourni pour upload Cloudinary.');
    }

    const folder =
      options?.folder ??
      process.env.CLOUDINARY_FOLDER ??
      'gestion-projets/documents';

    return await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'auto',
          ...options,
        },
        (error, result) => {
          if (error || !result) {
            this.logger.error('Erreur upload Cloudinary', error as Error);
            reject(error);
            return;
          }
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
          });
        },
      );

      if (file.buffer) {
        uploadStream.end(file.buffer);
      } else {
        reject(
          new Error(
            'Le fichier reçu ne contient pas de buffer. Vérifiez la configuration Multer (memoryStorage).',
          ),
        );
      }
    });
  }
}

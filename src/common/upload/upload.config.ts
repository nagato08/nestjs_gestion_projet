import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { extname } from 'path';

/**
 * Bornes appliquées aux fichiers reçus.
 *
 * Sans limite, n'importe quel compte authentifié peut saturer la mémoire du
 * conteneur et le quota de stockage distant en un seul appel : les fichiers
 * transitent en mémoire avant d'être poussés vers Cloudinary. Ces plafonds
 * sont donc une protection de disponibilité, pas un confort.
 */

/** Avatar : une photo de profil n'a aucune raison d'être lourde. */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

/** Document de projet : assez large pour un rapport illustré, pas plus. */
export const DOCUMENT_MAX_BYTES = 15 * 1024 * 1024;

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

/** Formats bureautiques courants, plus les images et les archives. */
const DOCUMENT_MIME_TYPES = [
  ...IMAGE_MIME_TYPES,
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
];

const DOCUMENT_EXTENSIONS = [
  ...IMAGE_EXTENSIONS,
  '.pdf',
  '.txt',
  '.csv',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.zip',
];

/** Formate une taille en octets pour un message lisible. */
export function formatBytes(bytes: number): string {
  const mo = bytes / (1024 * 1024);
  return `${Number.isInteger(mo) ? mo : mo.toFixed(1)} Mo`;
}

/**
 * Filtre acceptant un fichier seulement si son type déclaré **et** son
 * extension figurent dans la liste blanche.
 *
 * Le type MIME vient du client et se falsifie : exiger aussi une extension
 * cohérente ferme le cas trivial d'un exécutable renommé et annoncé en
 * `image/png`. Ce n'est pas une inspection du contenu, et ça ne prétend pas
 * l'être — le stockage se fait chez Cloudinary, qui ne sert pas ces fichiers
 * comme du code exécutable.
 */
function buildFileFilter(allowedMimes: string[], allowedExtensions: string[]) {
  return (
    _req: unknown,
    file: { mimetype: string; originalname: string },
    callback: (error: Error | null, acceptFile: boolean) => void,
  ): void => {
    const extension = extname(file.originalname).toLowerCase();

    if (!allowedMimes.includes(file.mimetype)) {
      return callback(
        new BadRequestException(
          `Type de fichier non autorisé (${file.mimetype})`,
        ),
        false,
      );
    }

    if (!allowedExtensions.includes(extension)) {
      return callback(
        new BadRequestException(
          `Extension de fichier non autorisée (${extension || 'aucune'})`,
        ),
        false,
      );
    }

    callback(null, true);
  };
}

/** Options d'upload pour les avatars. */
export const AVATAR_UPLOAD: MulterOptions = {
  storage: memoryStorage(),
  limits: { fileSize: AVATAR_MAX_BYTES, files: 1 },
  fileFilter: buildFileFilter(IMAGE_MIME_TYPES, IMAGE_EXTENSIONS),
};

/** Options d'upload pour les documents de projet. */
export const DOCUMENT_UPLOAD: MulterOptions = {
  storage: memoryStorage(),
  limits: { fileSize: DOCUMENT_MAX_BYTES, files: 1 },
  fileFilter: buildFileFilter(DOCUMENT_MIME_TYPES, DOCUMENT_EXTENSIONS),
};

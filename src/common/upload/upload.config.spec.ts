import { BadRequestException } from '@nestjs/common';
import {
  AVATAR_MAX_BYTES,
  AVATAR_UPLOAD,
  DOCUMENT_MAX_BYTES,
  DOCUMENT_UPLOAD,
  formatBytes,
} from './upload.config';

/**
 * Bornes sur les fichiers reçus.
 *
 * Ces limites protègent la disponibilité : les fichiers transitent en mémoire
 * avant d'être poussés vers le stockage distant, un envoi sans plafond suffit
 * donc à saturer le conteneur. Une régression ici ne se verrait pas à l'usage
 * — tout continuerait de fonctionner, jusqu'au premier abus.
 */

type Filter = (
  req: unknown,
  file: { mimetype: string; originalname: string },
  callback: (error: Error | null, accept: boolean) => void,
) => void;

/** Soumet un fichier au filtre et renvoie la décision prise. */
function submit(
  options: typeof AVATAR_UPLOAD,
  mimetype: string,
  originalname: string,
): { accepted: boolean; error: Error | null } {
  let accepted = false;
  let error: Error | null = null;

  (options.fileFilter as unknown as Filter)(
    {},
    { mimetype, originalname },
    (err, accept) => {
      error = err;
      accepted = accept;
    },
  );

  return { accepted, error };
}

describe('Contrôle des fichiers envoyés', () => {
  describe('avatars', () => {
    it('accepte une image aux format et extension cohérents', () => {
      expect(submit(AVATAR_UPLOAD, 'image/png', 'photo.png').accepted).toBe(
        true,
      );
    });

    it('refuse un type non image', () => {
      const { accepted, error } = submit(
        AVATAR_UPLOAD,
        'application/pdf',
        'rapport.pdf',
      );

      expect(accepted).toBe(false);
      expect(error).toBeInstanceOf(BadRequestException);
    });

    it('refuse un exécutable maquillé en image', () => {
      // Le type MIME vient du client et se falsifie : l'extension doit
      // corroborer la déclaration.
      const { accepted } = submit(AVATAR_UPLOAD, 'image/png', 'charge.exe');

      expect(accepted).toBe(false);
    });

    it('refuse un fichier sans extension', () => {
      expect(submit(AVATAR_UPLOAD, 'image/png', 'sansextension').accepted).toBe(
        false,
      );
    });

    it('plafonne la taille à 2 Mo', () => {
      expect(AVATAR_UPLOAD.limits?.fileSize).toBe(AVATAR_MAX_BYTES);
      expect(AVATAR_MAX_BYTES).toBe(2 * 1024 * 1024);
    });

    it('n’accepte qu’un fichier à la fois', () => {
      expect(AVATAR_UPLOAD.limits?.files).toBe(1);
    });
  });

  describe('documents de projet', () => {
    it.each([
      ['application/pdf', 'rapport.pdf'],
      [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'note.docx',
      ],
      ['text/csv', 'donnees.csv'],
      ['image/jpeg', 'plan.jpg'],
    ])('accepte %s', (mimetype, nom) => {
      expect(submit(DOCUMENT_UPLOAD, mimetype, nom).accepted).toBe(true);
    });

    it('refuse un script shell', () => {
      expect(
        submit(DOCUMENT_UPLOAD, 'application/x-sh', 'script.sh').accepted,
      ).toBe(false);
    });

    it('refuse une extension non listée même sous un type autorisé', () => {
      expect(
        submit(DOCUMENT_UPLOAD, 'application/pdf', 'archive.iso').accepted,
      ).toBe(false);
    });

    it('plafonne la taille à 15 Mo', () => {
      expect(DOCUMENT_UPLOAD.limits?.fileSize).toBe(DOCUMENT_MAX_BYTES);
    });
  });

  describe('message de taille', () => {
    it('exprime les tailles en mégaoctets lisibles', () => {
      expect(formatBytes(15 * 1024 * 1024)).toBe('15 Mo');
      expect(formatBytes(2 * 1024 * 1024)).toBe('2 Mo');
      expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5 Mo');
    });
  });
});

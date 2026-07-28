import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { InvitationService } from './invitation.service';

/**
 * Consultation publique d'une invitation.
 *
 * Volontairement hors du `ProjectController`, qui impose `JwtAuthGuard` au
 * niveau de la classe : la page d'atterrissage doit pouvoir annoncer « vous
 * êtes invité au projet X, connectez-vous avec telle adresse » à un visiteur
 * qui n'a pas encore de compte.
 *
 * La réponse ne contient que le nom du projet, l'adresse destinataire et
 * l'état de l'invitation — rien qui expose le contenu du projet. Le token
 * étant un secret de 32 octets, le deviner est hors de portée.
 */
@Controller('invitations')
export class InvitationController {
  constructor(private readonly invitationService: InvitationService) {}

  @Get(':token')
  @ApiOperation({
    summary:
      'Détails publics d’une invitation (nom du projet, destinataire, validité)',
  })
  preview(@Param('token') token: string) {
    return this.invitationService.preview(token);
  }
}

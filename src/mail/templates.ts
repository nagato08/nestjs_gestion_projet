/**
 * Gabarits d'email, centralisés.
 *
 * Chaque template est une fonction pure qui reçoit ses données et renvoie
 * `{ subject, html }` — aucune dépendance à Resend ni au transport. Le
 * `MailerService` se contente d'envoyer ce qu'ils produisent, ce qui permet
 * de relire ou tester un rendu sans toucher à l'expédition.
 *
 * Le HTML commun (en-tête, pied de page, bouton) vit dans `layout` et
 * `button` : modifier la charte se fait ici, une seule fois.
 */

export const APP_NAME = 'Forge';

export interface RenderedEmail {
  subject: string;
  html: string;
}

/** Enveloppe visuelle partagée par tous les emails. */
function layout(title: string, body: string): string {
  return `<!doctype html>
<html><body style="font-family:-apple-system,Segoe UI,sans-serif;background:#f3f4f6;margin:0;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;color:#111827">
    <h1 style="margin:0 0 16px;font-size:20px">${title}</h1>
    ${body}
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
    <p style="color:#9ca3af;font-size:12px;margin:0">${APP_NAME} — gestion de projet</p>
  </div>
</body></html>`;
}

/** Bouton d'action principal, style unique pour tous les emails. */
function button(href: string, label: string): string {
  return `<p><a href="${href}" style="display:inline-block;padding:12px 20px;background:#4f46e5;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">${label}</a></p>`;
}

/** Note secondaire, en gris et petit. */
function note(text: string): string {
  return `<p style="color:#666;font-size:12px">${text}</p>`;
}

export const emailTemplates = {
  welcome({
    firstName,
    loginUrl,
  }: {
    firstName: string;
    loginUrl: string;
  }): RenderedEmail {
    return {
      subject: `Bienvenue sur ${APP_NAME}`,
      html: layout(
        `Bienvenue ${firstName} !`,
        `<p>Votre compte ${APP_NAME} a bien été créé. Vous pouvez vous connecter dès maintenant.</p>
         ${button(loginUrl, 'Se connecter')}`,
      ),
    };
  },

  passwordReset({
    firstName,
    resetUrl,
  }: {
    firstName: string;
    resetUrl: string;
  }): RenderedEmail {
    return {
      subject: 'Réinitialisation de votre mot de passe',
      html: layout(
        `Bonjour ${firstName}`,
        `<p>Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous pour le faire (lien valable 1h) :</p>
         ${button(resetUrl, 'Réinitialiser mon mot de passe')}
         ${note("Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.")}`,
      ),
    };
  },

  accountCreatedByAdmin({
    firstName,
    email,
    password,
    loginUrl,
  }: {
    firstName: string;
    email: string;
    password: string;
    loginUrl: string;
  }): RenderedEmail {
    return {
      subject: `Votre compte ${APP_NAME} a été créé`,
      html: layout(
        `Bienvenue ${firstName}`,
        `<p>Un administrateur vient de créer votre compte ${APP_NAME}. Voici vos identifiants de connexion :</p>
         <table cellpadding="8" style="border-collapse:collapse;background:#f9fafb;border-radius:6px;margin:16px 0">
           <tr><td style="color:#6b7280">Email</td><td style="font-family:monospace"><strong>${email}</strong></td></tr>
           <tr><td style="color:#6b7280">Mot de passe</td><td style="font-family:monospace"><strong>${password}</strong></td></tr>
         </table>
         ${button(loginUrl, 'Se connecter')}
         <p style="color:#b91c1c;font-size:13px"><strong>Important</strong> : pour des raisons de sécurité, modifiez ce mot de passe dès votre première connexion.</p>`,
      ),
    };
  },

  projectInvite({
    projectName,
    inviterName,
    inviteUrl,
    expiresInDays,
  }: {
    projectName: string;
    inviterName: string;
    inviteUrl: string;
    expiresInDays: number;
  }): RenderedEmail {
    return {
      subject: `${inviterName} vous invite à rejoindre "${projectName}"`,
      html: layout(
        'Invitation à un projet',
        `<p><strong>${inviterName}</strong> vous invite à rejoindre le projet <strong>${projectName}</strong> sur ${APP_NAME}.</p>
         ${button(inviteUrl, 'Rejoindre le projet')}
         ${note(`Cette invitation vous est personnellement destinée et expire dans ${expiresInDays} jours. Si vous n'avez pas encore de compte, vous pourrez en créer un depuis ce lien.`)}`,
      ),
    };
  },

  projectMemberAdded({
    firstName,
    projectName,
    projectUrl,
  }: {
    firstName: string;
    projectName: string;
    projectUrl: string;
  }): RenderedEmail {
    return {
      subject: `Vous avez rejoint "${projectName}"`,
      html: layout(
        `Bonjour ${firstName}`,
        `<p>Vous faites maintenant partie du projet <strong>${projectName}</strong> sur ${APP_NAME}.</p>
         ${button(projectUrl, 'Voir le projet')}`,
      ),
    };
  },
};

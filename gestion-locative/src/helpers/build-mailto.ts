export interface MailtoParams {
  to: string;
  subject: string;
  body: string;
  cc?: string;
}

const LIMITE_CORPS = 1900;
const MENTION_TRONQUEE = '[Message tronqué — voir courrier joint si nécessaire]';

/**
 * Construit un URI mailto: conforme RFC 6068.
 * - encodeURIComponent pour subject + body
 * - %0A → %0D%0A (CRLF Windows/Outlook)
 * - Tronque le body encodé à 1900 chars max (T-02-06-04 DoS protection)
 */
export function buildMailto(params: MailtoParams): string {
  const { to, subject, body, cc } = params;

  const subjectEnc = encodeURIComponent(subject);

  // Encoder le body puis normaliser les sauts de ligne
  const bodyEnc = encodeURIComponent(body).replaceAll('%0A', '%0D%0A');

  // Tronquer si nécessaire
  let bodyFinal: string;
  if (bodyEnc.length > LIMITE_CORPS) {
    const mentionEnc = encodeURIComponent(MENTION_TRONQUEE).replaceAll('%0A', '%0D%0A');
    // Tronquer de façon à laisser de la place pour la mention
    const limite = LIMITE_CORPS - mentionEnc.length;
    bodyFinal = bodyEnc.substring(0, limite) + mentionEnc;
  } else {
    bodyFinal = bodyEnc;
  }

  const ccPart = cc ? `&cc=${encodeURIComponent(cc)}` : '';

  return `mailto:${to}?subject=${subjectEnc}${ccPart}&body=${bodyFinal}`;
}

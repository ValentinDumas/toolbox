import { describe, it, expect } from 'vitest';

// Tests RED — buildMailto helper
// NOTE: Ce module n'existe pas encore — tests RED intentionnellement
import { buildMailto } from '../../../src/helpers/build-mailto.js';

describe('buildMailto', () => {
  it('T18 : encode subject et body, remplace %0A par %0D%0A', () => {
    const uri = buildMailto({
      to: 'jean@x.com',
      subject: 'Rappel loyer',
      body: 'Ligne 1\nLigne 2',
    });
    expect(uri).toBe(
      'mailto:jean@x.com?subject=Rappel%20loyer&body=Ligne%201%0D%0ALigne%202',
    );
  });

  it('T19 : accents encodés en UTF-8 percent-encoded', () => {
    const uri = buildMailto({
      to: 'test@example.fr',
      subject: 'Test accents',
      body: 'Bonjour René',
    });
    // "Bonjour René" encodé : "Bonjour%20Ren%C3%A9"
    expect(uri).toContain('Bonjour%20Ren%C3%A9');
  });

  it('T20 : body très long (3000 chars) tronqué à 1900 chars encodés + mention [Message tronqué...]', () => {
    const longBody = 'A'.repeat(3000);
    const uri = buildMailto({
      to: 'test@example.fr',
      subject: 'Test',
      body: longBody,
    });
    // Extraire la partie body de l'URI
    const bodyMatch = uri.match(/&body=(.+)$/);
    expect(bodyMatch).toBeTruthy();
    const bodyEncoded = bodyMatch?.[1] ?? '';
    // Body doit être <= 1900 chars encodés
    expect(bodyEncoded.length).toBeLessThanOrEqual(1900);
    // Doit contenir la mention de troncature (décodée)
    expect(decodeURIComponent(bodyEncoded)).toContain('[Message tronqué');
  });

  it('inclut cc si fourni', () => {
    const uri = buildMailto({
      to: 'to@example.fr',
      subject: 'Test',
      body: 'Corps',
      cc: 'cc@example.fr',
    });
    expect(uri).toContain('cc=cc%40example.fr');
  });

  it("WR-04: troncature recule si elle tomberait au milieu d'une séquence %XX", () => {
    // LIMITE_CORPS = 1900, MENTION_TRONQUEE encoded = 89 chars,
    // donc la position naïve de coupure tombe à 1811.
    // On positionne un "é" (encodé %C3%A9, 6 chars) à partir de l'offset
    // encodé 1809 : positions 1809='%', 1810='C', 1811='3'.
    // Sans protection, substring(0, 1811) laisserait "...%C" — invalide :
    // decodeURIComponent jette "URI malformed". Avec protection (WR-04),
    // limite recule à 1809 et le corps tronqué reste décodable.
    // On a besoin que le corps encodé dépasse LIMITE_CORPS (1900) pour
    // déclencher la troncature : 1809 + 20×6 = 1929 > 1900.
    const padding = 'A'.repeat(1809);
    const uri = buildMailto({
      to: 'test@example.fr',
      subject: 'Test',
      body: padding + 'é'.repeat(20), // chaque "é" = %C3%A9 (6 chars encodés)
    });

    const bodyMatch = uri.match(/&body=(.+)$/);
    expect(bodyMatch).toBeTruthy();
    const bodyEncoded = bodyMatch![1];

    // Le body tronqué doit toujours être décodable sans erreur — c'est la
    // garantie qu'on n'a pas coupé au milieu d'un %XX.
    expect(() => decodeURIComponent(bodyEncoded)).not.toThrow();

    // Et il doit contenir la mention de troncature (le corps a été tronqué).
    expect(decodeURIComponent(bodyEncoded)).toContain('[Message tronqué');
  });
});

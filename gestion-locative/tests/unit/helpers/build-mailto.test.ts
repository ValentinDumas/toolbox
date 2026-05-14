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
});

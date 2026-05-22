import { describe, it, expect, vi } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import type { EcheanceLoyerId, BailId, LocataireId, BailleurId, BienId } from '../../../src/domain/_shared/identifiants.js';
import { EcheanceLoyer } from '../../../src/domain/encaissements/echeance-loyer.js';
import { Money } from '../../../src/domain/_shared/money.js';
import { Bailleur } from '../../../src/domain/identite/bailleur.js';
import { Adresse } from '../../../src/domain/_shared/adresse.js';
import { ClockFixe } from '../../../src/domain/_shared/clock.js';

// Tests RED — enregistrerRelance use case
// NOTE: Ces modules n'existent pas encore — tests RED intentionnellement
import { enregistrerRelance } from '../../../src/application/encaissements/enregistrer-relance.js';
import { RelanceNiveauNonDisponible } from '../../../src/domain/encaissements/erreurs.js';
import type { TemplateRenderer, VariablesRelance } from '../../../src/domain/encaissements/template-renderer.js';

const bailId = crypto.randomUUID() as BailId;
const locataireId = crypto.randomUUID() as LocataireId;
const bienId = crypto.randomUUID() as BienId;
const bailleurId = crypto.randomUUID() as BailleurId;
const echeanceId = crypto.randomUUID() as EcheanceLoyerId;

const loyerHc = Money.fromEuros(700);
const echeance = EcheanceLoyer.creer({
  bailId,
  periodeDebut: Temporal.PlainDate.from('2026-05-01'),
  periodeFin: Temporal.PlainDate.from('2026-05-31'),
  jourEcheanceAttendue: Temporal.PlainDate.from('2026-05-05'),
  loyerHc,
  montantCharges: Money.zero(),
  modeCharges: 'forfait',
  total: loyerHc,
  statut: 'en_attente',
  annuleLe: null,
  id: echeanceId,
});

const bailleur = Bailleur.creer({
  id: bailleurId,
  nomComplet: 'Jean Dupont',
  adresse: Adresse.creer({ rue: '1 rue de la Paix', codePostal: '75001', ville: 'Paris' }),
});

const locataireStub = {
  id: locataireId,
  prenom: 'Marie',
  nom: 'Martin',
  email: 'marie.martin@example.fr',
  adresseActuelle: { rue: '10 rue test', codePostal: '75010', ville: 'Paris' },
};

const bienStub = {
  id: bienId,
  adresse: Adresse.creer({ rue: '10 rue test', codePostal: '75010', ville: 'Paris' }),
};

const bailStub = {
  id: bailId,
  locataireId,
  bienId,
  modeCharges: 'forfait' as const,
  dateDebut: Temporal.PlainDate.from('2026-01-01'),
  dureeMois: 12,
  loyerHc,
};

// Stub TemplateRenderer
class TemplateRendererStub implements TemplateRenderer {
  rendre(_niveau: 1 | 2 | 3, _variables: VariablesRelance): string {
    return 'Objet : Loyer de mai 2026 — Rappel amiable\n\nBonjour Marie,\n\nCordialement,\nJean Dupont';
  }
}

// Stub PdfRenderer
const pdfRendererStub = {
  genererBuffer: vi.fn().mockResolvedValue(Buffer.from('%PDF-1.4 test')),
};

// Stub MiseEnDemeureBuilder
const miseEnDemeureBuilderStub = {
  construire: vi.fn().mockReturnValue({}),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function creerRepos(opts: { relances?: unknown[] } = {}): any {
  const relances = opts.relances ?? [];
  return {
    relanceRepo: {
      enregistrer: vi.fn().mockResolvedValue(undefined),
      listerParEcheance: vi.fn().mockResolvedValue(relances),
      listerToutes: vi.fn().mockResolvedValue([]),
      trouverParId: vi.fn().mockResolvedValue(null),
    },
    echeanceLoyerRepo: {
      trouverParId: vi.fn().mockResolvedValue(echeance),
      listerNonPayees: vi.fn().mockResolvedValue([]),
    },
    encaissementRepo: {
      sommePaieeParEcheance: vi.fn().mockResolvedValue(Money.zero()),
      listerParEcheance: vi.fn().mockResolvedValue([]),
    },
    bailRepo: {
      trouverParId: vi.fn().mockResolvedValue(bailStub),
    },
    locataireRepo: {
      trouverParId: vi.fn().mockResolvedValue(locataireStub),
    },
    bienRepo: {
      trouverParId: vi.fn().mockResolvedValue(bienStub),
    },
    bailleurRepo: {
      trouver: vi.fn().mockResolvedValue(bailleur),
    },
  };
}

// Clock at J+15 (jourEcheanceAttendue = 2026-05-05, +15 = 2026-05-20 >= J+10)
const clockJ15 = ClockFixe.du('2026-05-20');

describe('enregistrerRelance', () => {
  it('T15 : niveau 1, echeance impayée → retourne { relanceId, canal: "email", mailtoUri }', async () => {
    const repos = creerRepos();
    const result = await enregistrerRelance(
      { echeanceId, niveau: 1 },
      repos,
      new TemplateRendererStub(),
      pdfRendererStub,
      miseEnDemeureBuilderStub,
      clockJ15,
    );
    expect(result.relanceId).toBeDefined();
    expect(result.canal).toBe('email');
    expect(result.mailtoUri).toBeDefined();
    expect(result.mailtoUri).toMatch(/^mailto:/);
  });

  it('T16 : tentative niveau 3 sans niveau 2 envoyé → throw RelanceNiveauNonDisponible', async () => {
    const repos = creerRepos(); // aucune relance envoyée
    await expect(
      enregistrerRelance(
        { echeanceId, niveau: 3 },
        repos,
        new TemplateRendererStub(),
        pdfRendererStub,
        miseEnDemeureBuilderStub,
        clockJ15,
      ),
    ).rejects.toThrow(RelanceNiveauNonDisponible);
  });

  it('T17 : niveau 3 (relances 1+2 envoyées) → retourne { canal: "pdf", pdfBuffer }', async () => {
    // Clock at J+65 (2026-05-05 + 65 = 2026-07-09 >= J+60)
    const clockJ65 = ClockFixe.du('2026-07-09');
    const { Relance } = await import('../../../src/domain/encaissements/relance.js');
    const relance1 = Relance.creer({ echeanceId, niveau: 1, canal: 'email', envoyeeLe: Temporal.PlainDate.from('2026-05-15'), contenuSnapshot: '{"version":"v1"}' });
    const relance2 = Relance.creer({ echeanceId, niveau: 2, canal: 'email', envoyeeLe: Temporal.PlainDate.from('2026-06-05'), contenuSnapshot: '{"version":"v1"}' });
    const repos = creerRepos({ relances: [relance1, relance2] });

    const result = await enregistrerRelance(
      { echeanceId, niveau: 3 },
      repos,
      new TemplateRendererStub(),
      pdfRendererStub,
      miseEnDemeureBuilderStub,
      clockJ65,
    );
    expect(result.canal).toBe('pdf');
    expect(result.pdfBuffer).toBeDefined();
    expect(result.pdfBuffer?.toString().startsWith('%PDF')).toBe(true);
  });
});

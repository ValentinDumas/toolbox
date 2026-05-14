import { Temporal } from '@js-temporal/polyfill';

/**
 * Port domaine Clock — abstraction de la date courante.
 * Permet le déterminisme dans les tests BDD (seuils J+10/J+30/J+60 — plans 02-05/02-06).
 */
export interface Clock {
  /** Retourne la date du jour sous forme de Temporal.PlainDate. */
  aujourdhui(): Temporal.PlainDate;
}

/**
 * Implémentation système — utilise Temporal.Now.plainDateISO().
 * Utilisée en production.
 */
export class ClockSysteme implements Clock {
  aujourdhui(): Temporal.PlainDate {
    return Temporal.Now.plainDateISO();
  }
}

/**
 * Implémentation fixe — retourne toujours la même date.
 * Utilisée dans les tests pour le déterminisme.
 */
export class ClockFixe implements Clock {
  private readonly date: Temporal.PlainDate;

  private constructor(date: Temporal.PlainDate) {
    this.date = date;
  }

  /**
   * Factory à partir d'une chaîne ISO (ex : '2026-05-01').
   */
  static du(iso: string): ClockFixe {
    return new ClockFixe(Temporal.PlainDate.from(iso));
  }

  aujourdhui(): Temporal.PlainDate {
    return this.date;
  }
}

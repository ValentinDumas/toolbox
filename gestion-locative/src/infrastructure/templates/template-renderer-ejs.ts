import fs from 'node:fs';
import path from 'node:path';
import ejs from 'ejs';
import type { TemplateRenderer, VariablesRelance } from '../../domain/encaissements/template-renderer.js';
import type { NiveauRelance } from '../../domain/encaissements/relance.js';

/**
 * Adapter EJS — lit les templates depuis le dossier relances et les rend via ejs.render.
 * Implémentation de TemplateRenderer (port domaine).
 *
 * Le domaine (application/) n'importe JAMAIS cet adapter.
 * Le use case reçoit TemplateRenderer injecté via IoC.
 */
export class TemplateRendererEjs implements TemplateRenderer {
  constructor(private readonly templatesDir: string) {}

  rendre(niveau: NiveauRelance, variables: VariablesRelance): string {
    const nomFichier =
      niveau === 1 ? '01-amiable.ejs' : niveau === 2 ? '02-ferme.ejs' : '03-mise-en-demeure.ejs';
    const templatePath = path.join(this.templatesDir, nomFichier);
    const contenuRaw = fs.readFileSync(templatePath, 'utf8');
    return ejs.render(contenuRaw, variables);
  }
}

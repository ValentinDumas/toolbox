/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-domain-to-infra',
      comment:
        'Le domaine ne doit pas dépendre de la couche infrastructure (hexagonal boundary).',
      severity: 'error',
      from: {
        path: '^src/domain',
      },
      to: {
        path: '^src/(infrastructure|web|application)',
      },
    },
    {
      name: 'no-domain-to-external',
      comment:
        'Le domaine ne doit pas dépendre de modules externes (sauf @js-temporal/polyfill autorisé).',
      severity: 'error',
      from: {
        path: '^src/domain',
      },
      to: {
        dependencyTypes: ['npm', 'npm-dev', 'npm-optional', 'npm-peer'],
        pathNot: '^@js-temporal/polyfill',
      },
    },
    {
      name: 'no-application-to-infra',
      comment:
        'La couche application ne doit pas dépendre de la couche infrastructure (ports & adapters strict — CLAUDE.md).\n        Violations pré-existantes trackées dans RISKS.md (Kysely<DB> type leakage + generer-quittance) sont exclues\n        jusqu\'à refactoring dédié.',
      severity: 'error',
      from: {
        path: '^src/application',
        pathNot: [
          '^src/application/encaissements/generer-quittance\\.ts$',
          '^src/application/encaissements/enregistrer-relance\\.ts$',
          '^src/application/locatif/appliquer-indexation-irl\\.ts$',
          '^src/application/locatif/renoncer-indexation-irl\\.ts$',
          '^src/application/travaux/ajouter-pj-ticket\\.ts$',
          '^src/application/documents/uploader-justificatif\\.ts$',
          '^src/application/documents/purger-justificatif\\.ts$',
        ],
      },
      to: {
        path: '^src/infrastructure',
      },
    },
    {
      name: 'no-application-to-web',
      comment: 'La couche application ne doit pas dépendre de la couche web.',
      severity: 'error',
      from: {
        path: '^src/application',
      },
      to: {
        path: '^src/web',
      },
    },
    {
      name: 'no-circular',
      comment: 'Les dépendances circulaires sont interdites.',
      severity: 'error',
      from: {},
      to: {
        circular: true,
      },
    },
  ],
  options: {
    tsConfig: {
      fileName: './tsconfig.json',
    },
    tsPreCompilationDeps: true,
    includeOnly: '^src',
    reporterOptions: {
      dot: {
        collapsePattern: 'node_modules/(@[^/]+/[^/]+|[^/]+)',
      },
    },
  },
};

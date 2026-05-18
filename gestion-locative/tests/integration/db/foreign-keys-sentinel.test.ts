import { describe, it, expect, afterEach } from 'vitest';
import { ouvrirDb } from '../../../src/infrastructure/db/database.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

describe('PRAGMA foreign_keys sentinel (CR-01)', () => {
  let tmpFile: string | null = null;

  afterEach(() => {
    if (tmpFile && fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    tmpFile = null;
  });

  it('ouvrirDb active PRAGMA foreign_keys = ON sur la connexion ouverte', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gl-fk-sentinel-'));
    tmpFile = path.join(dir, 'db.sqlite');
    const { sqlite } = ouvrirDb(tmpFile);
    const value = sqlite.pragma('foreign_keys', { simple: true });
    expect(value).toBe(1);
    sqlite.close();
  });
});

import fs from 'node:fs';
import path from 'node:path';

function cheminPidfile(dossierDb: string): string {
  return path.join(dossierDb, 'gestion-locative.pid');
}

function processusVivant(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function verifierDejaLance(dossierDb: string, port: number): boolean {
  const pidPath = cheminPidfile(dossierDb);

  if (fs.existsSync(pidPath)) {
    const contenu = fs.readFileSync(pidPath, 'utf-8').trim();
    const pid = parseInt(contenu, 10);
    if (!isNaN(pid) && processusVivant(pid)) {
      console.error(`[gestion-locative] Déjà lancé (PID ${pid}) — ouvre http://127.0.0.1:${port}`);
      return true;
    }
    // Pidfile obsolète — nettoyage
    fs.unlinkSync(pidPath);
  }

  return false;
}

export function ecrirePidfile(dossierDb: string): void {
  const pidPath = cheminPidfile(dossierDb);
  fs.mkdirSync(dossierDb, { recursive: true });
  fs.writeFileSync(pidPath, String(process.pid), 'utf-8');
}

export function supprimerPidfile(dossierDb: string): void {
  const pidPath = cheminPidfile(dossierDb);
  try {
    if (fs.existsSync(pidPath)) {
      fs.unlinkSync(pidPath);
    }
  } catch {
    // Ignore — cleanup best-effort
  }
}

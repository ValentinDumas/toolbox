# Global Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shared `config.json` at the `sncf-trip-proofs/` level that lets each script read its `in` and `out` paths without CLI args, while preserving full backward compatibility.

**Architecture:** Each script gains a `load_config(config_path=None)` function that reads `../config.json` relative to the script file. If the config file exists and a path is non-empty, it overrides the hardcoded `INBOX`/`OUTPUT` constants. CLI args always win over config; config wins over hardcoded defaults. `config.json` is gitignored (personal paths).

**Tech Stack:** Python 3.10+, stdlib only (`json`, `pathlib`) — no new dependencies.

---

## File Structure

**Create:**
- `sncf-trip-proofs/config.json` — local config template (gitignored)

**Modify:**
- `.gitignore` — add `sncf-trip-proofs/config.json`
- `sncf-trip-proofs/curate-justificatifs-voyage/curate-justificatifs-voyage.py` — add `import json`, `load_config()`, update `main()`
- `sncf-trip-proofs/curate-justificatifs-voyage/tests/test_curate_justificatifs_voyage.py` — add `TestLoadConfig` class
- `sncf-trip-proofs/curate-justificatifs-achat/curate-justificatifs-achat.py` — same pattern, key `"curate-justificatifs-achat"`
- `sncf-trip-proofs/curate-justificatifs-achat/tests/test_curate_justificatifs_achat.py` — add `TestLoadConfig` class
- `sncf-trip-proofs/draw-bilan-depenses-train/draw-bilan-depenses-train.py` — same pattern, key `"draw-bilan-depenses-train"`, update `main()` case 0
- `sncf-trip-proofs/draw-bilan-depenses-train/tests/test_draw_bilan_depenses_train.py` — add `TestLoadConfig` class
- `sncf-trip-proofs/README.md` — document config file
- `sncf-trip-proofs/curate-justificatifs-voyage/README.md` — document config
- `sncf-trip-proofs/curate-justificatifs-achat/README.md` — document config
- `sncf-trip-proofs/draw-bilan-depenses-train/README.md` — document config

---

## Task 1: Config file + gitignore

**Files:**
- Create: `sncf-trip-proofs/config.json`
- Modify: `.gitignore`

- [ ] **Step 1: Create the config template**

`sncf-trip-proofs/config.json`:
```json
{
  "curate-justificatifs-voyage": {
    "in": "",
    "out": ""
  },
  "curate-justificatifs-achat": {
    "in": "",
    "out": ""
  },
  "draw-bilan-depenses-train": {
    "in": "",
    "out": ""
  }
}
```

Empty string `""` means "use default". Paths can be absolute (`/Users/alice/inbox`) or relative to the working directory (`../inbox`).

- [ ] **Step 2: Gitignore the config**

Add at the end of `.gitignore`:
```
# Local toolbox config (personal paths)
sncf-trip-proofs/config.json
```

- [ ] **Step 3: Commit**

```bash
git add sncf-trip-proofs/config.json .gitignore
git commit -m "feat(config): add config.json template and gitignore it"
```

---

## Task 2: curate-justificatifs-voyage — config loading

**Files:**
- Modify: `sncf-trip-proofs/curate-justificatifs-voyage/curate-justificatifs-voyage.py`
- Test: `sncf-trip-proofs/curate-justificatifs-voyage/tests/test_curate_justificatifs_voyage.py`

- [ ] **Step 1: Write the failing tests**

At the top of `test_curate_justificatifs_voyage.py`, after existing imports and module load, add `load_config = _mod.load_config`. Then add at the end of the file:

```python
class TestLoadConfig:
    def test_missing_config(self, tmp_path):
        in_p, out_p = load_config(tmp_path / "config.json")
        assert in_p is None
        assert out_p is None

    def test_both_paths_configured(self, tmp_path):
        cfg = tmp_path / "config.json"
        cfg.write_text('{"curate-justificatifs-voyage": {"in": "/a/inbox", "out": "/a/output"}}')
        in_p, out_p = load_config(cfg)
        assert in_p == Path("/a/inbox")
        assert out_p == Path("/a/output")

    def test_in_only_configured(self, tmp_path):
        cfg = tmp_path / "config.json"
        cfg.write_text('{"curate-justificatifs-voyage": {"in": "/a/inbox", "out": ""}}')
        in_p, out_p = load_config(cfg)
        assert in_p == Path("/a/inbox")
        assert out_p is None

    def test_out_only_configured(self, tmp_path):
        cfg = tmp_path / "config.json"
        cfg.write_text('{"curate-justificatifs-voyage": {"out": "/a/output"}}')
        in_p, out_p = load_config(cfg)
        assert in_p is None
        assert out_p == Path("/a/output")

    def test_malformed_json(self, tmp_path):
        cfg = tmp_path / "config.json"
        cfg.write_text("not valid json{{{")
        in_p, out_p = load_config(cfg)
        assert in_p is None
        assert out_p is None

    def test_missing_script_section(self, tmp_path):
        cfg = tmp_path / "config.json"
        cfg.write_text('{"other-script": {"in": "/x", "out": "/y"}}')
        in_p, out_p = load_config(cfg)
        assert in_p is None
        assert out_p is None

    def test_empty_paths_treated_as_none(self, tmp_path):
        cfg = tmp_path / "config.json"
        cfg.write_text('{"curate-justificatifs-voyage": {"in": "", "out": ""}}')
        in_p, out_p = load_config(cfg)
        assert in_p is None
        assert out_p is None
```

Also add `from pathlib import Path` at the top of the test file if not already there (it isn't currently — add it after `import pytest`).

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/valentinshodo/Projects/toolbox
.venv/bin/pytest sncf-trip-proofs/curate-justificatifs-voyage/tests/ -v -k TestLoadConfig
```

Expected: `AttributeError: module 'curate_justificatifs_voyage' has no attribute 'load_config'`

- [ ] **Step 3: Add `import json` and `load_config()` to the script**

In `curate-justificatifs-voyage.py`, after line 18 (`from dataclasses import dataclass, field`), add:

```python
import json
```

After line 29 (`OUTPUT = Path("output")`), add:

```python

def load_config(config_path: Path | None = None) -> tuple[Path | None, Path | None]:
    if config_path is None:
        config_path = Path(__file__).parent.parent / "config.json"
    if not config_path.exists():
        return None, None
    try:
        cfg = json.loads(config_path.read_text(encoding="utf-8"))
        section = cfg.get("curate-justificatifs-voyage", {})
        in_path = Path(section["in"]) if section.get("in") else None
        out_path = Path(section["out"]) if section.get("out") else None
        return in_path, out_path
    except (json.JSONDecodeError, KeyError, TypeError):
        return None, None
```

- [ ] **Step 4: Run tests to verify `load_config` tests pass**

```bash
.venv/bin/pytest sncf-trip-proofs/curate-justificatifs-voyage/tests/ -v -k TestLoadConfig
```

Expected: 7 PASSED

- [ ] **Step 5: Update `main()` to use config**

Replace the entire `main()` function (lines 267–325) with:

```python
def main():
    config_in, config_out = load_config()

    parser = argparse.ArgumentParser(description="Organise les justificatifs de voyage PDF")
    parser.add_argument("fichier", nargs="?", help="PDF à traiter (optionnel, sinon inbox/)")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true", default=True,
                      help="Affiche les noms générés sans toucher aux fichiers (défaut)")
    mode.add_argument("--real", action="store_true", default=False,
                      help="Vide output/ puis copie les fichiers organisés")
    args = parser.parse_args()

    dry_run = not args.real

    if args.fichier:
        inbox = Path(args.fichier).parent
        output_dir = inbox
        files = [Path(args.fichier)]
    else:
        inbox = config_in if config_in else INBOX
        output_dir = config_out if config_out else OUTPUT
        if not inbox.exists():
            print(f"Dossier '{inbox}' introuvable. Créez-le et déposez vos PDFs dedans.")
            sys.exit(1)
        files = sorted(inbox.glob("*.pdf"))

    if not files:
        print(f"Aucun fichier PDF trouvé dans '{inbox}'.")
        sys.exit(0)

    if not dry_run and not args.fichier:
        wipe_output(output_dir)

    files = deduplicate_sources(files)

    print(f"Mode    : {'DRY-RUN (simulation)' if dry_run else 'RÉEL (output/ régénéré)'}")
    print(f"Source  : {inbox}")
    print(f"Sortie  : {output_dir}")
    print(f"Fichiers: {len(files)}")

    parsed: list[tuple[Path, Fields | None]] = []
    for path in files:
        try:
            parsed.append((path, parse_fields(extract_text(path))))
        except Exception as e:
            print(f"\n[ERREUR] {path.name} : lecture impossible : {e}")
            parsed.append((path, None))

    parsed = resolve_conflicts(parsed)

    ok = sum(
        process_file(path, f, output_dir, dry_run)
        if f is not None else False
        for path, f in parsed
    )
    print(f"\n{'─'*40}")
    print(f"Résultat : {ok}/{len(files)} fichier(s) traité(s) avec succès")
    if dry_run:
        print("\nPour appliquer, relancez avec --real")


if __name__ == "__main__":
    main()
```

- [ ] **Step 6: Run all voyage tests**

```bash
.venv/bin/pytest sncf-trip-proofs/curate-justificatifs-voyage/tests/ -v
```

Expected: all tests PASSED

- [ ] **Step 7: Smoke-test the script on an empty inbox**

```bash
mkdir -p /tmp/test-voyage-inbox
cd /Users/valentinshodo/Projects/toolbox/sncf-trip-proofs/curate-justificatifs-voyage
.venv/bin/python curate-justificatifs-voyage.py --dry-run
```

Expected output:
```
Aucun fichier PDF trouvé dans 'inbox'.
```

(Script exits cleanly with no crash.)

- [ ] **Step 8: Smoke-test with config paths set**

Edit `sncf-trip-proofs/config.json` temporarily:
```json
{
  "curate-justificatifs-voyage": {
    "in": "/tmp/test-voyage-inbox",
    "out": "/tmp/test-voyage-output"
  },
  ...
}
```

Run:
```bash
cd /Users/valentinshodo/Projects/toolbox/sncf-trip-proofs/curate-justificatifs-voyage
.venv/bin/python curate-justificatifs-voyage.py --dry-run
```

Expected output includes:
```
Source  : /tmp/test-voyage-inbox
Sortie  : /tmp/test-voyage-output
Aucun fichier PDF trouvé dans '/tmp/test-voyage-inbox'.
```

Then reset `config.json` back to empty strings.

- [ ] **Step 9: Commit**

```bash
git add sncf-trip-proofs/curate-justificatifs-voyage/curate-justificatifs-voyage.py \
        sncf-trip-proofs/curate-justificatifs-voyage/tests/test_curate_justificatifs_voyage.py \
        sncf-trip-proofs/config.json
git commit -m "feat(voyage): load in/out paths from config.json if present"
```

---

## Task 3: curate-justificatifs-achat — config loading

**Files:**
- Modify: `sncf-trip-proofs/curate-justificatifs-achat/curate-justificatifs-achat.py`
- Test: `sncf-trip-proofs/curate-justificatifs-achat/tests/test_curate_justificatifs_achat.py`

- [ ] **Step 1: Write the failing tests**

In `test_curate_justificatifs_achat.py`, add `load_config = _mod.load_config` after the existing module-load imports, and `from pathlib import Path` if not present. Add at end of file:

```python
class TestLoadConfig:
    def test_missing_config(self, tmp_path):
        in_p, out_p = load_config(tmp_path / "config.json")
        assert in_p is None
        assert out_p is None

    def test_both_paths_configured(self, tmp_path):
        cfg = tmp_path / "config.json"
        cfg.write_text('{"curate-justificatifs-achat": {"in": "/b/inbox", "out": "/b/output"}}')
        in_p, out_p = load_config(cfg)
        assert in_p == Path("/b/inbox")
        assert out_p == Path("/b/output")

    def test_in_only_configured(self, tmp_path):
        cfg = tmp_path / "config.json"
        cfg.write_text('{"curate-justificatifs-achat": {"in": "/b/inbox", "out": ""}}')
        in_p, out_p = load_config(cfg)
        assert in_p == Path("/b/inbox")
        assert out_p is None

    def test_out_only_configured(self, tmp_path):
        cfg = tmp_path / "config.json"
        cfg.write_text('{"curate-justificatifs-achat": {"out": "/b/output"}}')
        in_p, out_p = load_config(cfg)
        assert in_p is None
        assert out_p == Path("/b/output")

    def test_malformed_json(self, tmp_path):
        cfg = tmp_path / "config.json"
        cfg.write_text("not valid json{{{")
        in_p, out_p = load_config(cfg)
        assert in_p is None
        assert out_p is None

    def test_missing_script_section(self, tmp_path):
        cfg = tmp_path / "config.json"
        cfg.write_text('{"other-script": {"in": "/x", "out": "/y"}}')
        in_p, out_p = load_config(cfg)
        assert in_p is None
        assert out_p is None

    def test_empty_paths_treated_as_none(self, tmp_path):
        cfg = tmp_path / "config.json"
        cfg.write_text('{"curate-justificatifs-achat": {"in": "", "out": ""}}')
        in_p, out_p = load_config(cfg)
        assert in_p is None
        assert out_p is None
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/valentinshodo/Projects/toolbox
.venv/bin/pytest sncf-trip-proofs/curate-justificatifs-achat/tests/ -v -k TestLoadConfig
```

Expected: `AttributeError: module 'curate_justificatifs_achat' has no attribute 'load_config'`

- [ ] **Step 3: Add `import json` and `load_config()` to the script**

In `curate-justificatifs-achat.py`, after line 18 (`from dataclasses import dataclass, field`), add:

```python
import json
```

After line 29 (`OUTPUT = Path("output")`), add:

```python

def load_config(config_path: Path | None = None) -> tuple[Path | None, Path | None]:
    if config_path is None:
        config_path = Path(__file__).parent.parent / "config.json"
    if not config_path.exists():
        return None, None
    try:
        cfg = json.loads(config_path.read_text(encoding="utf-8"))
        section = cfg.get("curate-justificatifs-achat", {})
        in_path = Path(section["in"]) if section.get("in") else None
        out_path = Path(section["out"]) if section.get("out") else None
        return in_path, out_path
    except (json.JSONDecodeError, KeyError, TypeError):
        return None, None
```

- [ ] **Step 4: Run tests to verify `load_config` tests pass**

```bash
.venv/bin/pytest sncf-trip-proofs/curate-justificatifs-achat/tests/ -v -k TestLoadConfig
```

Expected: 7 PASSED

- [ ] **Step 5: Update `main()` to use config**

Replace the entire `main()` function (lines 281–339) with:

```python
def main():
    config_in, config_out = load_config()

    parser = argparse.ArgumentParser(description="Organise les justificatifs d'achat PDF")
    parser.add_argument("fichier", nargs="?", help="PDF à traiter (optionnel, sinon inbox/)")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true", default=True,
                      help="Affiche les noms générés sans toucher aux fichiers (défaut)")
    mode.add_argument("--real", action="store_true", default=False,
                      help="Vide output/ puis copie les fichiers organisés")
    args = parser.parse_args()

    dry_run = not args.real

    if args.fichier:
        inbox = Path(args.fichier).parent
        output_dir = inbox
        files = [Path(args.fichier)]
    else:
        inbox = config_in if config_in else INBOX
        output_dir = config_out if config_out else OUTPUT
        if not inbox.exists():
            print(f"Dossier '{inbox}' introuvable. Créez-le et déposez vos PDFs dedans.")
            sys.exit(1)
        files = sorted(inbox.glob("*.pdf"))

    if not files:
        print(f"Aucun fichier PDF trouvé dans '{inbox}'.")
        sys.exit(0)

    if not dry_run and not args.fichier:
        wipe_output(output_dir)

    files = deduplicate_sources(files)

    print(f"Mode    : {'DRY-RUN (simulation)' if dry_run else 'RÉEL (output/ régénéré)'}")
    print(f"Source  : {inbox}")
    print(f"Sortie  : {output_dir}")
    print(f"Fichiers: {len(files)}")

    parsed: list[tuple[Path, Fields | None]] = []
    for path in files:
        try:
            parsed.append((path, parse_fields(extract_text(path))))
        except Exception as e:
            print(f"\n[ERREUR] {path.name} : lecture impossible : {e}")
            parsed.append((path, None))

    parsed = resolve_conflicts(parsed)

    ok = sum(
        process_file(path, f, output_dir, dry_run)
        if f is not None else False
        for path, f in parsed
    )
    print(f"\n{'─'*40}")
    print(f"Résultat : {ok}/{len(files)} fichier(s) traité(s) avec succès")
    if dry_run:
        print("\nPour appliquer, relancez avec --real")


if __name__ == "__main__":
    main()
```

- [ ] **Step 6: Run all achat tests**

```bash
.venv/bin/pytest sncf-trip-proofs/curate-justificatifs-achat/tests/ -v
```

Expected: all tests PASSED

- [ ] **Step 7: Smoke-test the script on an empty inbox**

```bash
mkdir -p /tmp/test-achat-inbox
cd /Users/valentinshodo/Projects/toolbox/sncf-trip-proofs/curate-justificatifs-achat
.venv/bin/python curate-justificatifs-achat.py --dry-run
```

Expected:
```
Aucun fichier PDF trouvé dans 'inbox'.
```

- [ ] **Step 8: Smoke-test with config paths set**

Edit `sncf-trip-proofs/config.json` temporarily:
```json
{
  "curate-justificatifs-achat": {
    "in": "/tmp/test-achat-inbox",
    "out": "/tmp/test-achat-output"
  },
  ...
}
```

Run:
```bash
cd /Users/valentinshodo/Projects/toolbox/sncf-trip-proofs/curate-justificatifs-achat
.venv/bin/python curate-justificatifs-achat.py --dry-run
```

Expected output includes:
```
Source  : /tmp/test-achat-inbox
Sortie  : /tmp/test-achat-output
Aucun fichier PDF trouvé dans '/tmp/test-achat-inbox'.
```

Then reset `config.json` back to empty strings.

- [ ] **Step 9: Commit**

```bash
git add sncf-trip-proofs/curate-justificatifs-achat/curate-justificatifs-achat.py \
        sncf-trip-proofs/curate-justificatifs-achat/tests/test_curate_justificatifs_achat.py
git commit -m "feat(achat): load in/out paths from config.json if present"
```

---

## Task 4: draw-bilan-depenses-train — config loading

**Files:**
- Modify: `sncf-trip-proofs/draw-bilan-depenses-train/draw-bilan-depenses-train.py`
- Test: `sncf-trip-proofs/draw-bilan-depenses-train/tests/test_draw_bilan_depenses_train.py`

- [ ] **Step 1: Write the failing tests**

In `test_draw_bilan_depenses_train.py`, add `load_config = _mod.load_config` after existing module-load imports, and `from pathlib import Path` if not present. Add at end of file:

```python
class TestLoadConfig:
    def test_missing_config(self, tmp_path):
        in_p, out_p = load_config(tmp_path / "config.json")
        assert in_p is None
        assert out_p is None

    def test_both_paths_configured(self, tmp_path):
        cfg = tmp_path / "config.json"
        cfg.write_text('{"draw-bilan-depenses-train": {"in": "/c/in", "out": "/c/out"}}')
        in_p, out_p = load_config(cfg)
        assert in_p == Path("/c/in")
        assert out_p == Path("/c/out")

    def test_in_only_configured(self, tmp_path):
        cfg = tmp_path / "config.json"
        cfg.write_text('{"draw-bilan-depenses-train": {"in": "/c/in", "out": ""}}')
        in_p, out_p = load_config(cfg)
        assert in_p == Path("/c/in")
        assert out_p is None

    def test_out_only_configured(self, tmp_path):
        cfg = tmp_path / "config.json"
        cfg.write_text('{"draw-bilan-depenses-train": {"out": "/c/out"}}')
        in_p, out_p = load_config(cfg)
        assert in_p is None
        assert out_p == Path("/c/out")

    def test_malformed_json(self, tmp_path):
        cfg = tmp_path / "config.json"
        cfg.write_text("not valid json{{{")
        in_p, out_p = load_config(cfg)
        assert in_p is None
        assert out_p is None

    def test_missing_script_section(self, tmp_path):
        cfg = tmp_path / "config.json"
        cfg.write_text('{"curate-justificatifs-voyage": {"in": "/x", "out": "/y"}}')
        in_p, out_p = load_config(cfg)
        assert in_p is None
        assert out_p is None

    def test_empty_paths_treated_as_none(self, tmp_path):
        cfg = tmp_path / "config.json"
        cfg.write_text('{"draw-bilan-depenses-train": {"in": "", "out": ""}}')
        in_p, out_p = load_config(cfg)
        assert in_p is None
        assert out_p is None
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/valentinshodo/Projects/toolbox
.venv/bin/pytest sncf-trip-proofs/draw-bilan-depenses-train/tests/ -v -k TestLoadConfig
```

Expected: `AttributeError: module 'draw_bilan_depenses_train' has no attribute 'load_config'`

- [ ] **Step 3: Add `import json` and `load_config()` to the script**

In `draw-bilan-depenses-train.py`, after line 21 (`from dataclasses import dataclass, field`), add:

```python
import json
```

After the `MOIS_FR` dict block (around line 27), add:

```python

def load_config(config_path: Path | None = None) -> tuple[Path | None, Path | None]:
    if config_path is None:
        config_path = Path(__file__).parent.parent / "config.json"
    if not config_path.exists():
        return None, None
    try:
        cfg = json.loads(config_path.read_text(encoding="utf-8"))
        section = cfg.get("draw-bilan-depenses-train", {})
        in_path = Path(section["in"]) if section.get("in") else None
        out_path = Path(section["out"]) if section.get("out") else None
        return in_path, out_path
    except (json.JSONDecodeError, KeyError, TypeError):
        return None, None
```

- [ ] **Step 4: Run tests to verify `load_config` tests pass**

```bash
.venv/bin/pytest sncf-trip-proofs/draw-bilan-depenses-train/tests/ -v -k TestLoadConfig
```

Expected: 7 PASSED

- [ ] **Step 5: Update `main()` to use config**

Replace the `match len(args.paths):` block inside `main()` (lines 395–403). The full updated `main()` starting from the `match` statement:

```python
    match len(args.paths):
        case 0:
            config_in, config_out = load_config()
            in_dir = config_in if config_in else Path.cwd()
            out_dir = config_out if config_out else Path.cwd()
        case 1:
            in_dir = out_dir = Path(args.paths[0])
        case 2:
            in_dir, out_dir = Path(args.paths[0]), Path(args.paths[1])
        case _:
            parser.error("Maximum 2 arguments : IN et OUT.")
```

(Only the `case 0:` block changes — the rest of `main()` is untouched.)

- [ ] **Step 6: Run all bilan tests**

```bash
.venv/bin/pytest sncf-trip-proofs/draw-bilan-depenses-train/tests/ -v
```

Expected: all tests PASSED

- [ ] **Step 7: Smoke-test with no args (default behavior unchanged)**

```bash
mkdir -p /tmp/test-bilan-empty
cd /tmp/test-bilan-empty
/Users/valentinshodo/Projects/toolbox/.venv/bin/python \
  /Users/valentinshodo/Projects/toolbox/sncf-trip-proofs/draw-bilan-depenses-train/draw-bilan-depenses-train.py
```

Expected:
```
Lecture de : /private/tmp/test-bilan-empty
0 fichier(s) PDF trouvé(s)

Rien à traiter.
```

- [ ] **Step 8: Smoke-test with config paths set**

Edit `sncf-trip-proofs/config.json` temporarily:
```json
{
  "draw-bilan-depenses-train": {
    "in": "/tmp/test-bilan-empty",
    "out": "/tmp/test-bilan-out"
  },
  ...
}
```

Run from any directory (e.g. `~`):
```bash
cd ~
/Users/valentinshodo/Projects/toolbox/.venv/bin/python \
  /Users/valentinshodo/Projects/toolbox/sncf-trip-proofs/draw-bilan-depenses-train/draw-bilan-depenses-train.py
```

Expected:
```
Lecture de : /private/tmp/test-bilan-empty
0 fichier(s) PDF trouvé(s)

Rien à traiter.
```

(Script used config paths, not cwd.)

Then reset `config.json` back to empty strings.

- [ ] **Step 9: Commit**

```bash
git add sncf-trip-proofs/draw-bilan-depenses-train/draw-bilan-depenses-train.py \
        sncf-trip-proofs/draw-bilan-depenses-train/tests/test_draw_bilan_depenses_train.py
git commit -m "feat(bilan): load in/out paths from config.json if present"
```

---

## Task 5: Full test suite green check

- [ ] **Step 1: Run all three test suites together**

```bash
cd /Users/valentinshodo/Projects/toolbox
.venv/bin/pytest sncf-trip-proofs/curate-justificatifs-voyage/tests/ \
                 sncf-trip-proofs/curate-justificatifs-achat/tests/ \
                 sncf-trip-proofs/draw-bilan-depenses-train/tests/ \
                 -v --tb=short
```

Expected: all tests PASSED, 0 errors.

---

## Task 6: Update READMEs

**Files:**
- Modify: `sncf-trip-proofs/README.md`
- Modify: `sncf-trip-proofs/curate-justificatifs-voyage/README.md`
- Modify: `sncf-trip-proofs/curate-justificatifs-achat/README.md`
- Modify: `sncf-trip-proofs/draw-bilan-depenses-train/README.md`

- [ ] **Step 1: Update `sncf-trip-proofs/README.md`**

After the existing "Installation" section, add a new section:

```markdown
## Configuration globale (optionnelle)

Un fichier `config.json` à la racine de `sncf-trip-proofs/` permet de configurer les chemins d'entrée/sortie pour chaque script, sans passer d'arguments CLI.

```json
{
  "curate-justificatifs-voyage": {
    "in": "/chemin/absolu/vers/inbox",
    "out": "/chemin/absolu/vers/output"
  },
  "curate-justificatifs-achat": {
    "in": "",
    "out": ""
  },
  "draw-bilan-depenses-train": {
    "in": "",
    "out": ""
  }
}
```

- Chemin vide `""` → comportement par défaut du script.
- Les chemins peuvent être absolus ou relatifs au répertoire de travail.
- Ce fichier est gitignore (chemins personnels).
- Les arguments CLI ont toujours la priorité sur la configuration.
```

- [ ] **Step 2: Update `curate-justificatifs-voyage/README.md`**

In the "Usage" section, after the existing command examples, add:

```markdown
### Via config.json (optionnel)

Si `sncf-trip-proofs/config.json` contient un chemin non-vide pour `curate-justificatifs-voyage`, le script l'utilise sans argument :

```json
{
  "curate-justificatifs-voyage": {
    "in": "/Users/alice/Documents/sncf/inbox",
    "out": "/Users/alice/Documents/sncf/output"
  }
}
```

```bash
# Aucun argument requis — les chemins sont lus depuis config.json
python3 curate-justificatifs-voyage.py --dry-run
python3 curate-justificatifs-voyage.py --real
```

Priorité : argument CLI fichier > `config.json` > `inbox/` et `output/` locaux.
```

- [ ] **Step 3: Update `curate-justificatifs-achat/README.md`**

Same section as voyage, using key `curate-justificatifs-achat`:

```markdown
### Via config.json (optionnel)

Si `sncf-trip-proofs/config.json` contient un chemin non-vide pour `curate-justificatifs-achat`, le script l'utilise sans argument :

```json
{
  "curate-justificatifs-achat": {
    "in": "/Users/alice/Documents/sncf/inbox-achat",
    "out": "/Users/alice/Documents/sncf/output-achat"
  }
}
```

```bash
python3 curate-justificatifs-achat.py --dry-run
python3 curate-justificatifs-achat.py --real
```

Priorité : argument CLI fichier > `config.json` > `inbox/` et `output/` locaux.
```

- [ ] **Step 4: Update `draw-bilan-depenses-train/README.md`**

In the "Usage" section, after the existing arguments table, add:

```markdown
### Via config.json (optionnel)

Si `sncf-trip-proofs/config.json` contient des chemins non-vides pour `draw-bilan-depenses-train`, le script les utilise quand aucun argument n'est passé :

```json
{
  "draw-bilan-depenses-train": {
    "in": "/Users/alice/Documents/sncf/output",
    "out": "/Users/alice/Documents/bilans"
  }
}
```

```bash
# Utilise les chemins de config.json
python3 draw-bilan-depenses-train.py
```

Priorité : arguments CLI > `config.json` > répertoire courant.
La configuration n'est appliquée que lorsqu'aucun argument CLI n'est fourni (0 args).
```

- [ ] **Step 5: Commit**

```bash
git add sncf-trip-proofs/README.md \
        sncf-trip-proofs/curate-justificatifs-voyage/README.md \
        sncf-trip-proofs/curate-justificatifs-achat/README.md \
        sncf-trip-proofs/draw-bilan-depenses-train/README.md
git commit -m "docs: document config.json in all READMEs"
```

---

## Self-Review

**Spec coverage:**
- ✅ Config file shared across 3 scripts — Task 1
- ✅ Per-script JSON structure with `in`/`out` keys — Task 1
- ✅ curate-voyage loads config — Task 2
- ✅ curate-achat loads config — Task 3
- ✅ draw-bilan loads config — Task 4
- ✅ Graceful fallback when config absent/incomplete — all `load_config()` return `(None, None)` cases
- ✅ Tests for new edge cases (missing file, malformed JSON, missing section, empty paths) — Tasks 2–4
- ✅ READMEs updated — Task 6
- ✅ Execution verified with arbitrary data — smoke-test steps in each task

**Placeholder scan:** None found. All code blocks are complete and runnable.

**Type consistency:** `load_config()` signature is identical across all 3 scripts. `tuple[Path | None, Path | None]` return type used consistently. `config_in`/`config_out` variable names used consistently in all `main()` calls.

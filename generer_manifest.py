#!/usr/bin/env python3
from pathlib import Path
import argparse
import json
from datetime import date

root = Path(__file__).resolve().parent
banks_dir = root / "banques"

parser = argparse.ArgumentParser(description="Générer ou vérifier le manifest des banques")
parser.add_argument("--check", action="store_true", help="vérifier sans modifier manifest.json")
args = parser.parse_args()

banks = []

for path in sorted(banks_dir.rglob("*.json")):
    data = json.loads(path.read_text(encoding="utf-8"))
    questions = data.get("questions", [])
    if not isinstance(questions, list):
        raise ValueError(f"{path}: 'questions' doit être une liste")

    relative_to_root = path.relative_to(root).as_posix()
    relative_to_banks = path.relative_to(banks_dir)

    # La matière est d'abord lue dans le JSON.
    # Si elle n'est pas renseignée, on utilise le nom du dossier parent.
    subject = data.get("subject") or path.parent.name

    banks.append({
        "id": relative_to_banks.with_suffix("").as_posix().replace("/", "__"),
        "title": data.get("title", path.stem),
        "subject": subject,
        "chapter": data.get("chapter", ""),
        "file": relative_to_root,
        "count": len(questions),
        "version": data.get("version", 1)
    })

manifest_path = root / "manifest.json"
try:
    previous = json.loads(manifest_path.read_text(encoding="utf-8"))
except (OSError, ValueError):
    previous = {}

up_to_date = previous.get("appVersion") == 2 and previous.get("banks") == banks
if args.check:
    if not up_to_date:
        parser.exit(1, "Manifest obsolète : lancer python3 generer_manifest.py et committer manifest.json.\n")
    print("OK — manifest à jour")
else:
    manifest = {
        "appVersion": 2,
        # Ne pas créer de diff quotidien quand les banques n'ont pas changé.
        "updated": previous.get("updated", date.today().isoformat()) if up_to_date else date.today().isoformat(),
        "banks": banks,
    }
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(
        f"manifest.json mis à jour : {len(banks)} banque(s), "
        f"{sum(b['count'] for b in banks)} questions, "
        f"{len(set(b['subject'] for b in banks))} matière(s)."
    )

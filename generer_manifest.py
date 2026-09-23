#!/usr/bin/env python3
from pathlib import Path
import json
from datetime import date

root = Path(__file__).resolve().parent
banks_dir = root / "banques"

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

manifest = {
    "appVersion": 2,
    "updated": date.today().isoformat(),
    "banks": banks
}

(root / "manifest.json").write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2),
    encoding="utf-8"
)

print(
    f"manifest.json mis à jour : "
    f"{len(banks)} banque(s), "
    f"{sum(b['count'] for b in banks)} questions, "
    f"{len(set(b['subject'] for b in banks))} matière(s)."
)

#!/usr/bin/env python3
from pathlib import Path
import json
from datetime import date

root = Path(__file__).resolve().parent
banks_dir = root / "banques"

banks = []
for path in sorted(banks_dir.glob("*.json")):
    data = json.loads(path.read_text(encoding="utf-8"))
    questions = data.get("questions", [])
    if not isinstance(questions, list):
        raise ValueError(f"{path.name}: 'questions' doit être une liste")
    banks.append({
        "id": path.stem,
        "title": data.get("title", path.stem),
        "subject": data.get("subject", ""),
        "chapter": data.get("chapter", ""),
        "file": f"banques/{path.name}",
        "count": len(questions),
        "version": data.get("version", 1)
    })

manifest = {
    "appVersion": 1,
    "updated": date.today().isoformat(),
    "banks": banks
}
(root / "manifest.json").write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2),
    encoding="utf-8"
)
print(f"manifest.json mis à jour : {len(banks)} banque(s), {sum(b['count'] for b in banks)} questions.")

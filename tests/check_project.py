#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from html.parser import HTMLParser
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BANKS_DIR = ROOT / "banques"
MANIFEST_PATH = ROOT / "manifest.json"
HTML_FILES = [ROOT / "index.html", ROOT / "index_local.html"]

errors: list[str] = []
warnings: list[str] = []
stats = {
    "banks": 0,
    "questions": 0,
    "single": 0,
    "multiple": 0,
    "flash_eligible": 0,
}

def err(message: str) -> None:
    errors.append(message)

def warn(message: str) -> None:
    warnings.append(message)

def load_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        err(f"{path.relative_to(ROOT)}: JSON invalide ({exc})")
        return None

manifest = load_json(MANIFEST_PATH)
if not isinstance(manifest, dict):
    err("manifest.json doit contenir un objet JSON")
    manifest = {"banks": []}

manifest_banks = manifest.get("banks")
if not isinstance(manifest_banks, list):
    err("manifest.json: 'banks' doit être une liste")
    manifest_banks = []

bank_paths = sorted(BANKS_DIR.rglob("*.json"))
stats["banks"] = len(bank_paths)
manifest_by_file = {
    entry.get("file"): entry
    for entry in manifest_banks
    if isinstance(entry, dict) and isinstance(entry.get("file"), str)
}

for field in ("id", "file"):
    values = [entry.get(field) for entry in manifest_banks if isinstance(entry, dict)]
    if any(not isinstance(value, str) or not value for value in values) or len(set(values)) != len(values):
        err(f"Manifest : {field} manquant ou dupliqué")

actual_rel_paths = {path.relative_to(ROOT).as_posix() for path in bank_paths}
manifest_rel_paths = set(manifest_by_file)

for missing in sorted(actual_rel_paths - manifest_rel_paths):
    err(f"Banque absente du manifest: {missing}")
for missing in sorted(manifest_rel_paths - actual_rel_paths):
    err(f"Manifest référence un fichier absent: {missing}")

global_ids: dict[str, str] = {}
normalized_prompts: dict[str, str] = {}
duplicate_prompt_count = 0

for bank_path in bank_paths:
    rel = bank_path.relative_to(ROOT).as_posix()
    data = load_json(bank_path)
    if not isinstance(data, dict):
        continue

    questions = data.get("questions")
    if not isinstance(questions, list):
        err(f"{rel}: 'questions' doit être une liste")
        continue

    entry = manifest_by_file.get(rel)
    if entry:
        if entry.get("count") != len(questions):
            err(f"{rel}: count manifest={entry.get('count')} mais {len(questions)} questions")
        for field in ("title", "subject", "chapter"):
            if field in entry and field in data and entry.get(field) != data.get(field):
                err(f"{rel}: '{field}' différent entre la banque et le manifest")
        if entry.get("version") != data.get("version", 1):
            err(f"{rel}: version différente entre la banque et le manifest")

    version = data.get("version", 1)
    if not isinstance(version, int) or version < 1:
        err(f"{rel}: version invalide ({version!r})")

    local_ids: set[str] = set()
    for index, question in enumerate(questions, start=1):
        stats["questions"] += 1
        loc = f"{rel} question #{index}"
        if not isinstance(question, dict):
            err(f"{loc}: la question doit être un objet")
            continue

        qid = question.get("id")
        if not isinstance(qid, str) or not qid.strip():
            err(f"{loc}: id manquant")
        else:
            if qid in local_ids:
                err(f"{loc}: id dupliqué dans la banque ({qid})")
            local_ids.add(qid)
            if qid in global_ids:
                err(f"{loc}: id global dupliqué ({qid}), déjà dans {global_ids[qid]}")
            else:
                global_ids[qid] = loc

        prompt = question.get("prompt")
        if not isinstance(prompt, str) or not prompt.strip():
            err(f"{loc}: prompt vide")
        else:
            key = re.sub(r"\s+", " ", prompt.strip().lower())
            if key in normalized_prompts:
                duplicate_prompt_count += 1
            else:
                normalized_prompts[key] = loc

        qtype = question.get("type")
        if qtype not in {"single", "multiple"}:
            err(f"{loc}: type invalide ({qtype!r})")
            continue
        stats[qtype] += 1

        difficulty = question.get("difficulty")
        if difficulty not in {1, 2, 3}:
            err(f"{loc}: difficulté invalide ({difficulty!r})")

        explanation = question.get("explanation")
        if not isinstance(explanation, str) or not explanation.strip():
            err(f"{loc}: explication manquante")

        choices = question.get("choices")
        if not isinstance(choices, list) or len(choices) < 2:
            err(f"{loc}: au moins deux choix sont requis")
            continue

        choice_texts: list[str] = []
        correct_indexes: set[int] = set()
        for choice_index, choice in enumerate(choices):
            if not isinstance(choice, dict):
                err(f"{loc}: choix #{choice_index + 1} invalide")
                continue
            text = choice.get("text")
            if not isinstance(text, str) or not text.strip():
                err(f"{loc}: texte vide pour le choix #{choice_index + 1}")
                text = ""
            choice_texts.append(text.strip().lower())
            if not isinstance(choice.get("correct"), bool):
                err(f"{loc}: 'correct' doit être booléen pour le choix #{choice_index + 1}")
            if choice.get("correct") is True:
                correct_indexes.add(choice_index)

        if len(set(choice_texts)) != len(choice_texts):
            err(f"{loc}: deux choix ont le même texte")

        if qtype == "single" and len(correct_indexes) != 1:
            err(f"{loc}: une question single doit avoir exactement une bonne réponse")
        if qtype == "multiple" and len(correct_indexes) < 2:
            err(f"{loc}: une question multiple doit avoir au moins deux bonnes réponses")

        if qtype == "single" and len(correct_indexes) == 1:
            stats["flash_eligible"] += 1

# Validate semantic contracts, not formatting, CSS pixel values or source fragments.
class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.elements = []
        self.ids = {}
        self.duplicates = set()

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        self.elements.append((tag, attrs))
        if "id" in attrs:
            if attrs["id"] in self.ids:
                self.duplicates.add(attrs["id"])
            self.ids[attrs["id"]] = (tag, attrs)

required_ids = {
    "setup", "quiz", "results", "choices", "validateBtn", "nextBtn", "pauseBtn", "quitBtn",
    "flashArea", "flashCard", "flashFalseBtn", "flashTrueBtn", "flashExplanationMenuBtn",
    "flashExplanationOverlay", "flashExplanationNo", "flashExplanationYes", "flashPauseOverlay",
    "flashCardExplanation", "flashExplanationCountdown", "flashExplanationCountdownFill",
    "themeToggle", "mobileSheetOverlay", "reviewRecommendations", "reviewTopicList", "errorBox", "errorText",
}
for html_path in HTML_FILES:
    rel = html_path.name
    source = html_path.read_text(encoding="utf-8")
    page = Page()
    page.feed(source)
    if page.duplicates:
        err(f"{rel}: IDs dupliqués : {sorted(page.duplicates)}")
    if required_ids - page.ids.keys():
        err(f"{rel}: éléments requis absents : {sorted(required_ids - page.ids.keys())}")
    for tag, attrs in page.elements:
        if tag == "html" and attrs.get("lang") != "fr":
            err(f"{rel}: langue française non déclarée")
        if tag == "button" and attrs.get("type") != "button":
            err(f"{rel}: bouton sans type explicite : {attrs.get('id', '')}")
        if tag == "img" and "alt" not in attrs:
            err(f"{rel}: image sans texte alternatif")
        if attrs.get("role") == "dialog":
            if attrs.get("aria-modal") != "true" or attrs.get("aria-labelledby") not in page.ids:
                # IDs following the element are checked after the parse above.
                err(f"{rel}: dialogue sans nom ou sémantique modale")
        for attribute in ("src", "href"):
            ref = attrs.get(attribute, "")
            if ref and not ref.startswith(("http:", "https:", "data:", "#", "mailto:", "tel:")):
                if not (ROOT / ref.split("?", 1)[0]).exists():
                    err(f"{rel}: ressource absente : {ref}")
    for overlay in ("mobileSheetOverlay", "flashExplanationOverlay"):
        attrs = page.ids.get(overlay, ("", {}))[1]
        if "inert" not in attrs or attrs.get("aria-hidden") != "true":
            err(f"{rel}: dialogue fermé encore accessible : {overlay}")
    for status in ("feedback", "flashLiveResult"):
        attrs = page.ids.get(status, ("", {}))[1]
        if attrs.get("role") != "status" or attrs.get("aria-live") != "polite":
            err(f"{rel}: correction non annoncée : {status}")
    if not any(attrs.get("role") == "progressbar" and attrs.get("aria-valuenow") == "0" for _, attrs in page.elements):
        err(f"{rel}: progression non exposée")
    if not any(tag == "link" and attrs.get("rel") == "icon" for tag, attrs in page.elements):
        err(f"{rel}: favicon absente")
    if "timerLive" in page.ids or "floatingActions" in page.ids:
        err(f"{rel}: anciens contrôles inutilisés encore présents")
    expected_edition = "local" if html_path.name == "index_local.html" else "web"
    if not any(tag == "html" and attrs.get("data-edition") == expected_edition for tag, attrs in page.elements):
        err(f"{rel}: édition incorrecte")

build = subprocess.run([sys.executable, str(ROOT / "scripts/build.py"), "--check"], capture_output=True, text=True)
if build.returncode:
    err(build.stderr.strip())
node = shutil.which("node")
if not node:
    err("Node.js requis pour vérifier le JavaScript de production")
else:
    syntax = subprocess.run([node, "--check", str(ROOT / "src/app.js")], capture_output=True, text=True)
    if syntax.returncode:
        err(syntax.stderr.strip())

# Hygiène du dépôt
ds_store = [p.relative_to(ROOT).as_posix() for p in ROOT.glob(".DS_Store")]
if ds_store:
    err(f"Fichiers .DS_Store suivis/présents: {ds_store}")

if errors:
    print("ECHEC — vérifications du projet")
    for item in errors:
        print(f"  [ERREUR] {item}")
    for item in warnings:
        print(f"  [AVERTISSEMENT] {item}")
    print(json.dumps(stats, ensure_ascii=False, indent=2))
    sys.exit(1)

print("OK — projet cohérent")
print(json.dumps(stats, ensure_ascii=False, indent=2))
print(f"Prompts génériques/dupliqués détectés (non bloquants): {duplicate_prompt_count}")
for item in warnings:
    print(f"[AVERTISSEMENT] {item}")

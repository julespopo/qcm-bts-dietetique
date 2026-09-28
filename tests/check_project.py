#!/usr/bin/env python3
from __future__ import annotations

import json
import random
import re
import shutil
import subprocess
import sys
import tempfile
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
    "qcm_logic_cases": 0,
    "flash_stress_cases": 0,
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

def qcm_score(question: dict, selected_indexes: set[int]) -> bool:
    choices = question["choices"]
    return all(
        (i in selected_indexes and choice["correct"] is True)
        or (i not in selected_indexes and choice["correct"] is False)
        for i, choice in enumerate(choices)
    )

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

actual_rel_paths = {path.relative_to(ROOT).as_posix() for path in bank_paths}
manifest_rel_paths = set(manifest_by_file)

for missing in sorted(actual_rel_paths - manifest_rel_paths):
    err(f"Banque absente du manifest: {missing}")
for missing in sorted(manifest_rel_paths - actual_rel_paths):
    err(f"Manifest référence un fichier absent: {missing}")

global_ids: dict[str, str] = {}
normalized_prompts: dict[str, str] = {}
duplicate_prompt_count = 0
rng = random.Random(20260927)

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

        # Test exhaustif de la règle de score QCM :
        # la combinaison exacte doit passer et chaque inversion d'un seul choix doit échouer.
        if correct_indexes:
            stats["qcm_logic_cases"] += 1
            if not qcm_score(question, correct_indexes):
                err(f"{loc}: la combinaison correcte est refusée par la logique QCM")
            for choice_index in range(len(choices)):
                mutated = set(correct_indexes)
                if choice_index in mutated:
                    mutated.remove(choice_index)
                else:
                    mutated.add(choice_index)
                stats["qcm_logic_cases"] += 1
                if qcm_score(question, mutated):
                    err(f"{loc}: une combinaison erronée est acceptée par la logique QCM")

        # Le mode Vrai/Faux ne prend que les questions à réponse unique.
        # Pour générer de vraies ET de fausses cartes, il faut au moins un distracteur.
        if qtype == "single" and len(correct_indexes) == 1:
            stats["flash_eligible"] += 1
            correct_texts = [choices[i]["text"].strip() for i in correct_indexes]
            incorrect_texts = [
                choice["text"].strip()
                for i, choice in enumerate(choices)
                if i not in correct_indexes
            ]
            if not incorrect_texts:
                err(f"{loc}: aucun distracteur, impossible de générer une carte Faux")
            else:
                for _ in range(100):
                    true_proposal = rng.choice(correct_texts)
                    false_proposal = rng.choice(incorrect_texts)
                    stats["flash_stress_cases"] += 2
                    if true_proposal not in correct_texts:
                        err(f"{loc}: génération Vrai incohérente")
                    if false_proposal not in incorrect_texts:
                        err(f"{loc}: génération Faux incohérente")

# Vérifications HTML / JS
required_ids = {
    "setup", "quiz", "results", "choices", "validateBtn", "nextBtn",
    "pauseBtn", "quitBtn", "flashArea", "flashCard", "flashFalseBtn",
    "flashTrueBtn", "flashExplanationMenuBtn", "flashExplanationOverlay",
    "flashExplanationNo", "flashExplanationYes", "flashCardExplanation",
    "flashCardExplanationTitle", "flashCardAnswerKey", "flashCardExplanationText", "flashPauseOverlay",
    "flashExplanationCountdownWrap", "flashExplanationCountdown", "flashExplanationCountdownFill",
    "themeToggle", "floatingActions", "timerToggleBtn",
    "timerPresets", "reviewRecommendations", "reviewRecommendationsTitle",
    "reviewRecommendationsIntro", "reviewAllTopics", "reviewTopicList",
    "errorBox", "errorText",
}
node = shutil.which("node")

for html_path in HTML_FILES:
    rel = html_path.relative_to(ROOT).as_posix()
    source = html_path.read_text(encoding="utf-8")
    static_html = source.split("<script>", 1)[0]

    ids = re.findall(r'\bid="([^"]+)"', static_html)
    duplicates = sorted({item for item in ids if ids.count(item) > 1})
    if duplicates:
        err(f"{rel}: ids HTML dupliqués: {duplicates}")
    missing = sorted(required_ids - set(ids))
    if missing:
        err(f"{rel}: ids requis manquants: {missing}")

    for tag in re.findall(r"<button\b[^>]*>", static_html, flags=re.I):
        if not re.search(r"\btype=", tag, flags=re.I):
            err(f"{rel}: bouton sans type explicite: {tag[:100]}")

    for tag in re.findall(r"<img\b[^>]*>", static_html, flags=re.I):
        if not re.search(r"\balt=", tag, flags=re.I):
            err(f"{rel}: image sans attribut alt: {tag[:100]}")

    if 'rel="icon"' not in static_html:
        err(f"{rel}: favicon non déclarée")
    if 'id="floatingActions" class="floating-actions" aria-hidden="true" inert' not in static_html:
        err(f"{rel}: floatingActions doit être inert lorsqu'il est fermé")
    if 'id="timerPresets" class="timer-presets-floating" aria-hidden="true" inert' not in static_html:
        err(f"{rel}: timerPresets doit être inert lorsqu'il est masqué")
    if 'id="mobileSheetOverlay" class="mobile-sheet-overlay" aria-hidden="true" inert' not in static_html:
        err(f"{rel}: mobileSheetOverlay doit être inert lorsqu'il est fermé")
    if 'id="flashExplanationOverlay" class="flash-pref-overlay" aria-hidden="true" inert' not in static_html:
        err(f"{rel}: flashExplanationOverlay doit être inert lorsqu'il est fermé")
    if 'aria-expanded="false" aria-controls="floatingActions"' not in static_html:
        err(f"{rel}: themeToggle doit exposer aria-expanded/aria-controls")
    if 'id="themeSun"' not in static_html or 'id="themeMoon"' not in static_html:
        err(f"{rel}: le contrôle de thème jour/nuit n'est pas aligné")
    if '<footer>Index V7.9.2</footer>' not in source:
        err(f"{rel}: version d'interface attendue V7.9.2")
    if '@media(max-height:560px)' not in source:
        err(f"{rel}: mode compact petits écrans absent")
    if 'role="progressbar"' not in static_html or 'aria-valuenow="0"' not in static_html:
        err(f"{rel}: barre de progression non exposée aux technologies d'assistance")
    if 'id="feedback" class="feedback hidden" role="status" aria-live="polite"' not in static_html:
        err(f"{rel}: zone de correction sans annonce aria-live")
    if 'flashcard-mode.reviewing-errors #nextBtn' not in source:
        err(f"{rel}: bouton suivant inaccessible en revue d'erreurs Vrai/Faux mobile")
    if 'flashcard-mode.flash-explanations-on #nextBtn' not in source:
        err(f"{rel}: bouton suivant inaccessible avec explications Vrai/Faux mobile")
    if 'flashExplanationsEnabled:state.flashExplanationsEnabled' not in source:
        err(f"{rel}: préférence d'explications Vrai/Faux non sauvegardée")
    if 'FLASH_EXPLANATION_DELAY_MS=7000' not in source:
        err(f"{rel}: délai d'explication Vrai/Faux attendu à 7 secondes")
    if 'class="flash-explanation-stopwatch"' not in static_html or '<circle id="flashExplanationCountdownFill"' not in static_html:
        err(f"{rel}: chronomètre circulaire d'explication Vrai/Faux absent")
    if 'function showFlashcardExplanation(q,' not in source:
        err(f"{rel}: correction Vrai/Faux intégrée à la carte absente")
    if 'showFlashcardExplanation(q,{ok,realTimeout,autoAdvance:ok&&!realTimeout})' not in source:
        err(f"{rel}: réponses incorrectes non routées vers la carte d'explication")
    if '.flash-card.explanation-visible>#flashQuestion' not in source or '.flash-card.explanation-visible>#flashStatement' not in source:
        err(f"{rel}: question/proposition non masquées pendant l'explication")
    if 'id="flashLiveResult" class="sr-only" role="status" aria-live="polite"' not in static_html:
        err(f"{rel}: résultat Vrai/Faux non annoncé aux technologies d'assistance")
    if 'function quizShortcutAllowed(e)' not in source:
        err(f"{rel}: les raccourcis clavier peuvent intercepter les boutons de contrôle")
    if 'if(e.code==="Space"||e.key===" "){e.preventDefault();pause();return;}' not in source:
        err(f"{rel}: raccourci Espace pour pause Vrai/Faux absent")
    if 'if(e.key==="Enter"&&state.answered){e.preventDefault();clearFlashAdvance();next();return;}' not in source:
        err(f"{rel}: raccourci Entrée pour avancer Vrai/Faux absent")
    if 'function setFlashPaused(paused)' not in source or 'if(state.mode==="flashcard"){setFlashPaused(!flashPaused);return;}' not in source:
        err(f"{rel}: pause Vrai/Faux sur place absente")
    if 'function pauseFlashAutoAdvance()' not in source or 'function resumeFlashAutoAdvance()' not in source:
        err(f"{rel}: pause/reprise du chrono d'explication absente")
    if 'id="flashPauseOverlay" class="flash-pause-overlay hidden" aria-hidden="true"' not in static_html:
        err(f"{rel}: voile de pause Vrai/Faux absent")
    if 'catch(e){console.warn("Sauvegarde locale indisponible."' not in source:
        err(f"{rel}: une erreur localStorage peut interrompre la session")
    if 'if(floatingMenuOpen)closeFloatingMenu();' not in source:
        err(f"{rel}: le menu flottant ne peut pas être fermé avec Échap")
    if 'function buildReviewTopics(errors=state.errors)' not in source:
        err(f"{rel}: regroupement des thèmes À réviser absent")
    if 'async function sessionForReviewTopics(topics)' not in source:
        err(f"{rel}: génération d'une session ciblée À réviser absente")
    if 'renderReviewRecommendations();clearProgress();' not in source:
        err(f"{rel}: recommandations À réviser non rendues à la fin")
    if 'data-review-topic-index' not in source:
        err(f"{rel}: boutons de révision ciblée absents")
    if '.config-grid{display:grid;grid-template-columns:minmax(180px,240px) 1fr auto;gap:18px;align-items:start}' not in source:
        err(f"{rel}: alignement supérieur de la zone Options absent")
    if '.config-options{order:-1}' not in source:
        err(f"{rel}: Options n'est pas placé avant Nombre de questions sur mobile")
    if 'id="flashHint"' in static_html:
        err(f"{rel}: texte d'aide Vrai/Faux encore présent sous les boutons")
    if 'card.addEventListener("click",()=>{' not in source or 'performance.now()-flashExplanationShownAt<300' not in source:
        err(f"{rel}: navigation par tap sur la carte d'explication absente")
    if 'combinedLength=prompt.length+proposal.length' not in source:
        err(f"{rel}: densité Vrai/Faux non adaptée à la longueur combinée")
    if '.flash-card.very-dense-content' not in source:
        err(f"{rel}: style mobile très dense Vrai/Faux absent")

    # Les ressources locales référencées dans le HTML doivent exister.
    for ref in re.findall(r'(?:src|href)="([^"]+)"', static_html):
        if ref.startswith(("http://", "https://", "data:", "#", "mailto:", "tel:")):
            continue
        target = ROOT / ref.split("?", 1)[0]
        if not target.exists():
            err(f"{rel}: ressource absente: {ref}")

    scripts = re.findall(r"<script>([\s\S]*?)</script>", source)
    if len(scripts) != 1:
        err(f"{rel}: exactement un script inline principal est attendu")
    elif node:
        with tempfile.NamedTemporaryFile("w", suffix=".js", encoding="utf-8", delete=False) as tmp:
            tmp.write(scripts[0])
            tmp_path = Path(tmp.name)
        try:
            proc = subprocess.run([node, "--check", str(tmp_path)], capture_output=True, text=True)
            if proc.returncode != 0:
                err(f"{rel}: syntaxe JavaScript invalide: {proc.stderr.strip()}")
        finally:
            tmp_path.unlink(missing_ok=True)
    else:
        warn(f"{rel}: Node.js absent, vérification syntaxique JS ignorée")

    if '$("heroText").textContent=' in source:
        err(f"{rel}: accès non protégé à #heroText (peut masquer l'erreur de chargement)")
    if rel == "index.html" and 'rebuilt.some(q=>q===null)' not in source:
        err(f"{rel}: reprise web susceptible de décaler une session si une question a disparu")
    if 'actions.inert=true' not in source or 'presets.inert=!show' not in source:
        err(f"{rel}: gestion inert du menu flottant incomplète")
    if 'overlay.inert=true' not in source or 'overlay.inert=false' not in source:
        err(f"{rel}: gestion inert du bottom sheet incomplète")
    if 'main > :not(#mobileSheetOverlay)' not in source or 'el.inert=true' not in source or 'el.inert=false' not in source:
        err(f"{rel}: arrière-plan du bottom sheet non neutralisé sans bloquer le dialogue")
    if 'document.body.classList.toggle("reviewing-errors",state.reviewingErrors)' not in source:
        err(f"{rel}: état reviewing-errors non synchronisé")

# Hygiène du dépôt
ds_store = [p.relative_to(ROOT).as_posix() for p in ROOT.rglob(".DS_Store")]
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

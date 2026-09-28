#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import time
from pathlib import Path

from selenium import webdriver
from selenium.common.exceptions import TimeoutException
from selenium.webdriver import ActionChains, Keys
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait

ROOT = Path(__file__).resolve().parents[1]
BASE_URL = "http://127.0.0.1:8000/"
TIMEOUT = 12

def norm(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip())

# Test metadata used to deliberately answer questions and validate targeted review sessions.
truth_map: dict[tuple[str, str], bool] = {}
ambiguous: set[tuple[str, str]] = set()
qcm_category_counts: dict[tuple[str, str, str], int] = {}
flash_category_counts: dict[tuple[str, str, str], int] = {}
for bank_path in sorted((ROOT / "banques").rglob("*.json")):
    data = json.loads(bank_path.read_text(encoding="utf-8"))
    subject = str(data.get("subject", "")).strip()
    chapter = str(data.get("chapter", data.get("title", ""))).strip()
    for q in data.get("questions", []):
        category = str(q.get("category", "")).strip() or "Notions générales"
        topic_key = (subject, chapter, category)
        qcm_category_counts[topic_key] = qcm_category_counts.get(topic_key, 0) + 1

        correct = [c for c in q.get("choices", []) if c.get("correct") is True]
        if q.get("type") == "multiple" or len(correct) != 1:
            continue
        flash_category_counts[topic_key] = flash_category_counts.get(topic_key, 0) + 1
        prompt = norm(str(q.get("prompt", "")))
        for choice in q.get("choices", []):
            key = (prompt, norm(str(choice.get("text", ""))))
            value = choice.get("correct") is True
            if key in truth_map and truth_map[key] != value:
                ambiguous.add(key)
            else:
                truth_map[key] = value
for key in ambiguous:
    truth_map.pop(key, None)

options = Options()
options.add_argument("--headless=new")
options.add_argument("--no-sandbox")
options.add_argument("--disable-dev-shm-usage")
options.add_argument("--disable-gpu")
options.add_argument("--window-size=1280,900")
options.set_capability("goog:loggingPrefs", {"browser": "ALL"})

driver = webdriver.Chrome(options=options)
wait = WebDriverWait(driver, TIMEOUT)

def visible(css: str):
    return wait.until(lambda d: next((e for e in d.find_elements(By.CSS_SELECTOR, css) if e.is_displayed()), False))

def wait_until(predicate, message: str):
    try:
        return wait.until(lambda d: predicate())
    except TimeoutException as exc:
        raise AssertionError(message) from exc

def js_click(el):
    driver.execute_script("arguments[0].click()", el)

def fresh(width=1280, height=900):
    driver.set_window_size(width, height)
    driver.get(BASE_URL)
    wait_until(lambda: driver.execute_script("return document.readyState") == "complete", "document non chargé")
    driver.execute_script("localStorage.clear(); sessionStorage.clear();")
    driver.get(BASE_URL)
    visible("#setup")
    wait_until(lambda: len(driver.find_elements(By.CSS_SELECTOR, "#subjectList .subject-card")) >= 2, "matières non rendues")

def select_one_desktop_bank():
    subjects = driver.find_elements(By.CSS_SELECTOR, "#subjectList .subject-card")
    js_click(subjects[0])  # desktop: sélectionne tous les chapitres de la matière
    wait_until(lambda: not driver.find_element(By.ID, "startBtn").get_property("disabled"), "sélection matière non prise en compte")
    js_click(driver.find_element(By.ID, "toggleAllChapters"))  # tout désélectionner
    wait_until(lambda: driver.find_element(By.ID, "startBtn").get_property("disabled"), "désélection globale non prise en compte")
    first_chapter = driver.find_elements(By.CSS_SELECTOR, "#chapterList .chapter-card")[0]
    js_click(first_chapter)
    wait_until(lambda: not driver.find_element(By.ID, "startBtn").get_property("disabled"), "chapitre unique non sélectionné")

def select_mobile_subject_all():
    subject = driver.find_elements(By.CSS_SELECTOR, "#subjectList .subject-card")[0]
    js_click(subject)
    overlay = visible("#mobileSheetOverlay.open")
    assert driver.execute_script("return arguments[0].inert", overlay) is False
    assert driver.execute_script("return document.querySelector('#setup').inert") is True
    assert driver.execute_script("return document.querySelector('#mobileSheetOverlay').closest('main').inert") is False
    wait_until(lambda: driver.execute_script("return document.activeElement && document.activeElement.id") == "mobileSheetClose", "focus non placé dans le bottom sheet")
    js_click(driver.find_element(By.ID, "mobileToggleAll"))
    wait_until(lambda: "sélectionné" in driver.find_element(By.ID, "mobileSheetMeta").text, "sélection mobile non appliquée")
    js_click(driver.find_element(By.ID, "mobileSheetClose"))
    wait_until(lambda: not overlay.get_attribute("class").endswith("open"), "bottom sheet non fermé")
    assert driver.execute_script("return document.querySelector('#setup').inert") is False
    active = driver.switch_to.active_element
    assert "subject-card" in (active.get_attribute("class") or ""), "focus non restauré sur la matière"

def start_mode(mode: str, count: int, explanations: bool = False):
    mode_btn = driver.find_element(By.CSS_SELECTOR, f'.mode-btn[data-mode="{mode}"]')
    js_click(mode_btn)
    count_el = driver.find_element(By.ID, "count")
    count_el.clear()
    count_el.send_keys(str(count))
    wait_until(lambda: not driver.find_element(By.ID, "startBtn").get_property("disabled"), "bouton démarrer désactivé")
    js_click(driver.find_element(By.ID, "startBtn"))
    if mode == "flashcard":
        overlay = visible("#flashExplanationOverlay.open")
        assert driver.execute_script("return arguments[0].inert", overlay) is False
        assert driver.execute_script("return document.querySelector('#setup').inert") is True
        wait_until(lambda: driver.execute_script("return document.activeElement && document.activeElement.id") == "flashExplanationYes", "focus non placé dans la popup Vrai/Faux")
        js_click(driver.find_element(By.ID, "flashExplanationYes" if explanations else "flashExplanationNo"))
    visible("#quiz:not(.hidden)")

def answer_current_qcm_wrong():
    inputs = driver.find_elements(By.CSS_SELECTOR, '#choices input[name="ans"]')
    assert inputs, "aucune réponse QCM à rendre volontairement fausse"
    incorrect = [i for i in inputs if i.get_attribute("data-correct") == "0"]
    if incorrect:
        js_click(incorrect[0])
    else:
        correct = [i for i in inputs if i.get_attribute("data-correct") == "1"]
        assert len(correct) >= 2, "impossible de construire une mauvaise réponse QCM"
        js_click(correct[0])
    js_click(driver.find_element(By.ID, "validateBtn"))
    wait_until(lambda: "Réponse incorrecte" in driver.find_element(By.ID, "feedback").text, "réponse volontairement fausse non détectée")

def complete_qcm_with_errors(count: int):
    for index in range(count):
        answer_current_qcm_wrong()
        next_btn = visible("#nextBtn")
        js_click(next_btn)
        if index < count - 1:
            visible("#quiz:not(.hidden)")
    visible("#results:not(.hidden)")

def result_topic_key(card):
    category = norm(card.find_element(By.CSS_SELECTOR, ".review-topic-name").text)
    meta = norm(card.find_element(By.CSS_SELECTOR, ".review-topic-meta").text)
    parts = [part.strip() for part in meta.split("•", 1)]
    assert len(parts) == 2, f"métadonnées thème inattendues: {meta!r}"
    return (parts[0], parts[1], category)

def counter_total():
    text_value = driver.find_element(By.ID, "counter").text
    match = re.search(r"/\s*(\d+)", text_value)
    assert match, f"compteur de session illisible: {text_value!r}"
    return int(match.group(1))

def assert_no_console_regressions():
    logs = driver.get_log("browser")
    bad = []
    for item in logs:
        message = item.get("message", "")
        level = item.get("level", "")
        if level == "SEVERE" or "Blocked aria-hidden" in message or "favicon.ico" in message:
            bad.append(f"{level}: {message}")
    assert not bad, "Console navigateur:\n" + "\n".join(bad)

try:
    # 1) Desktop QCM: scoring, per-choice feedback, pause/resume.
    fresh()

    # Configuration layout: Options must start at the top of its grid column.
    count_field = driver.find_element(By.CSS_SELECTOR, ".config-grid .field")
    options_block = driver.find_element(By.CSS_SELECTOR, ".config-grid .config-options")
    assert abs(count_field.rect["y"] - options_block.rect["y"]) <= 3, "bloc Options décalé verticalement dans la configuration"

    select_one_desktop_bank()
    start_mode("qcm", 30)

    found_multiple = False
    for _ in range(30):
        inputs = driver.find_elements(By.CSS_SELECTOR, '#choices input[name="ans"]')
        assert inputs, "aucune réponse rendue"
        correct = [i for i in inputs if i.get_attribute("data-correct") == "1"]
        incorrect = [i for i in inputs if i.get_attribute("data-correct") == "0"]
        input_type = inputs[0].get_attribute("type")

        if input_type == "checkbox" and len(correct) >= 2 and incorrect:
            js_click(correct[0])
            js_click(incorrect[0])
            js_click(driver.find_element(By.ID, "validateBtn"))
            wait_until(lambda: "Réponse incorrecte" in driver.find_element(By.ID, "feedback").text, "mauvaise réponse multiple non détectée")
            assert "answer-correct" in (correct[0].find_element(By.XPATH, "..").get_attribute("class") or "")
            assert "answer-wrong" in (incorrect[0].find_element(By.XPATH, "..").get_attribute("class") or "")
            missed = [i for i in correct[1:] if "answer-missed" in (i.find_element(By.XPATH, "..").get_attribute("class") or "")]
            assert missed, "bonne réponse oubliée non signalée"
            found_multiple = True
        else:
            for inp in correct:
                js_click(inp)
            js_click(driver.find_element(By.ID, "validateBtn"))
            wait_until(lambda: "Bonne réponse" in driver.find_element(By.ID, "feedback").text, "bonne réponse QCM rejetée")

        if found_multiple:
            if driver.find_element(By.ID, "nextBtn").is_displayed():
                js_click(driver.find_element(By.ID, "nextBtn"))
            break
        js_click(driver.find_element(By.ID, "nextBtn"))

    assert found_multiple, "aucun QCM multiple trouvé dans le chapitre de test"

    counter_before = driver.find_element(By.ID, "counter").text
    js_click(driver.find_element(By.ID, "pauseBtn"))
    visible("#resumeCard:not(.hidden)")
    js_click(driver.find_element(By.ID, "resumeBtn"))
    visible("#quiz:not(.hidden)")
    assert driver.find_element(By.ID, "counter").text == counter_before, "reprise de session décalée"

    # 1b) Desktop QCM: targeted "À réviser" launches every question from one category.
    fresh()
    select_one_desktop_bank()
    start_mode("qcm", 3)
    complete_qcm_with_errors(3)

    review_panel = visible("#reviewRecommendations:not(.hidden)")
    review_cards = review_panel.find_elements(By.CSS_SELECTOR, ".review-topic-card")
    assert review_cards, "bloc À réviser vide après plusieurs erreurs"
    first_key = result_topic_key(review_cards[0])
    expected_targeted = qcm_category_counts.get(first_key)
    assert expected_targeted, f"catégorie de révision inconnue dans les banques: {first_key!r}"
    js_click(review_cards[0].find_element(By.CSS_SELECTOR, "[data-review-topic-index]"))
    visible("#quiz:not(.hidden)")
    assert "flashcard-mode" not in (driver.find_element(By.TAG_NAME, "body").get_attribute("class") or ""), "Réviser ce thème a changé QCM en Vrai/Faux"
    assert counter_total() == expected_targeted, f"Réviser ce thème: {counter_total()} questions au lieu de {expected_targeted}"

    # 1c) Desktop QCM: "Réviser tout" unions every detected category without duplicates.
    fresh()
    select_one_desktop_bank()
    start_mode("qcm", 3)
    complete_qcm_with_errors(3)
    review_panel = visible("#reviewRecommendations:not(.hidden)")
    review_cards = review_panel.find_elements(By.CSS_SELECTOR, ".review-topic-card")
    keys = [result_topic_key(card) for card in review_cards]
    expected_all = sum(qcm_category_counts.get(key, 0) for key in keys)
    assert expected_all > 0, "aucune question attendue pour Réviser tout"
    js_click(driver.find_element(By.ID, "reviewAllTopics"))
    visible("#quiz:not(.hidden)")
    assert "flashcard-mode" not in (driver.find_element(By.TAG_NAME, "body").get_attribute("class") or ""), "Réviser tout a changé QCM en Vrai/Faux"
    assert counter_total() == expected_all, f"Réviser tout: {counter_total()} questions au lieu de {expected_all}"

    # 2) Desktop flashcard: the card must move while the pointer is still held.
    fresh()
    js_click(driver.find_elements(By.CSS_SELECTOR, "#subjectList .subject-card")[0])
    wait_until(lambda: not driver.find_element(By.ID, "startBtn").get_property("disabled"), "matière flash non sélectionnée")
    start_mode("flashcard", 3)
    card = visible("#flashCard")

    ActionChains(driver).move_to_element(card).click_and_hold().move_by_offset(55, 8).pause(0.18).perform()
    time.sleep(0.12)
    assert "dragging" in (card.get_attribute("class") or ""), "carte non décollée pendant l'appui"
    transform = card.value_of_css_property("transform")
    assert transform and transform != "none", "carte immobile avant le relâchement"
    ActionChains(driver).release().perform()
    time.sleep(0.5)

    js_click(driver.find_element(By.ID, "flashTrueBtn"))
    wait_until(lambda: "/ 1" in driver.find_element(By.ID, "scoreLive").text, "score flash non mis à jour")
    wait_until(lambda: driver.find_element(By.ID, "flashLiveResult").get_attribute("textContent").strip() != "", "résultat flash non annoncé")
    wait_until(lambda: driver.find_element(By.ID, "counter").text.startswith("Question 2 /"), "carte suivante non avancée")

    # The in-session control lives in the floating menu and must immediately change behavior.
    gear = driver.find_element(By.ID, "themeToggle")
    js_click(gear)
    visible("#floatingActions.open")
    toggle = visible("#flashExplanationMenuBtn:not(.hidden)")
    assert toggle.get_attribute("aria-pressed") == "false", "état initial des explications incorrect"
    js_click(toggle)
    wait_until(lambda: toggle.get_attribute("aria-pressed") == "true", "activation des explications non appliquée")

    prompt = norm(driver.find_element(By.ID, "flashQuestion").text)
    proposal = norm(driver.find_element(By.ID, "flashStatement").text)
    truth = truth_map.get((prompt, proposal))
    assert truth is not None, f"impossible de déterminer la vérité de la carte: {prompt!r} / {proposal!r}"
    js_click(driver.find_element(By.ID, "flashTrueBtn") if truth else driver.find_element(By.ID, "flashFalseBtn"))

    card_explanation = visible("#flashCardExplanation:not(.hidden)")
    flash_card = driver.find_element(By.ID, "flashCard")
    assert not driver.find_element(By.ID, "flashQuestion").is_displayed(), "question encore visible pendant l'explication"
    assert not driver.find_element(By.ID, "flashStatement").is_displayed(), "proposition encore visible pendant l'explication"
    assert not flash_card.find_element(By.CSS_SELECTOR, ".flash-question-label").is_displayed(), "libellé QUESTION encore visible"
    assert not flash_card.find_element(By.CSS_SELECTOR, ".flash-answer-label").is_displayed(), "libellé RÉPONSE PROPOSÉE encore visible"
    assert driver.find_element(By.ID, "feedback").get_attribute("class").endswith("hidden"), "feedback externe affiché malgré une bonne réponse"
    assert driver.find_element(By.ID, "nextBtn").get_attribute("class").endswith("hidden"), "bouton suivant affiché pendant le décompte"
    assert card_explanation.find_element(By.ID, "flashCardExplanationText").text.strip(), "explication intégrée à la carte absente"
    card_rect = flash_card.rect
    explanation_rect = card_explanation.rect
    assert explanation_rect["y"] >= card_rect["y"] - 1, "explication déborde au-dessus de la carte"
    assert explanation_rect["y"] + explanation_rect["height"] <= card_rect["y"] + card_rect["height"] + 1, "explication déborde sous la carte"
    counter_with_explanation = driver.find_element(By.ID, "counter").text
    stopwatch = visible(".flash-explanation-stopwatch")
    stopwatch_rect = stopwatch.rect
    assert stopwatch_rect["x"] + stopwatch_rect["width"] >= card_rect["x"] + card_rect["width"] - 90, "chronomètre pas placé à droite"
    assert stopwatch_rect["y"] <= card_rect["y"] + 90, "chronomètre pas placé en haut de la carte"
    countdown_ring = driver.find_element(By.ID, "flashExplanationCountdownFill")
    assert countdown_ring.tag_name.lower() == "circle", "le décompte n'est pas rendu sous forme de chronomètre circulaire"
    countdown_start = int(driver.find_element(By.ID, "flashExplanationCountdown").text)
    assert countdown_start in (6, 7), f"décompte initial inattendu: {countdown_start}"
    ring_start = float(driver.execute_script("return parseFloat(getComputedStyle(arguments[0]).strokeDashoffset)||0", countdown_ring))
    time.sleep(1.15)
    ring_after = float(driver.execute_script("return parseFloat(getComputedStyle(arguments[0]).strokeDashoffset)||0", countdown_ring))
    assert ring_after > ring_start, "anneau du chronomètre immobile"
    countdown_after = int(driver.find_element(By.ID, "flashExplanationCountdown").text)
    assert countdown_after < countdown_start, "décompte visuel Vrai/Faux immobile"
    assert driver.find_element(By.ID, "counter").text == counter_with_explanation, "avance avant la fin du délai d'explication"

    # Enter skips the remaining explanation delay.
    driver.find_element(By.ID, "flashCard").send_keys(Keys.ENTER)
    wait_until(lambda: driver.find_element(By.ID, "counter").text.startswith("Question 3 /"), "Entrée n'a pas avancé la carte")

    # Space pauses the Vrai/Faux session and resume must keep the next-question position.
    driver.find_element(By.ID, "flashCard").send_keys(Keys.SPACE)
    visible("#resumeCard:not(.hidden)")
    js_click(driver.find_element(By.ID, "resumeBtn"))
    visible("#quiz:not(.hidden)")
    assert driver.find_element(By.ID, "counter").text.startswith("Question 3 /"), "pause Espace/reprise a décalé la session"

    # 3) Mobile: modal focus, configuration ordering, full-height layout, visual button balance, error review.
    fresh(390, 844)

    options_block = driver.find_element(By.CSS_SELECTOR, ".config-options")
    count_field = driver.find_element(By.CSS_SELECTOR, ".config-grid .field")
    assert options_block.rect["y"] < count_field.rect["y"], "Options n'est pas affiché au-dessus de Nombre de questions sur mobile"

    # Floating menu focus/ARIA regression.
    gear = driver.find_element(By.ID, "themeToggle")
    js_click(gear)
    actions = driver.find_element(By.ID, "floatingActions")
    wait_until(lambda: actions.get_attribute("aria-hidden") == "false", "menu flottant non ouvert")
    theme = driver.find_element(By.ID, "themeMenuBtn")
    js_click(theme)
    theme.send_keys(Keys.ESCAPE)
    wait_until(lambda: actions.get_attribute("aria-hidden") == "true", "menu flottant non fermé avec Échap")
    assert driver.execute_script("return arguments[0].inert", actions) is True
    assert driver.switch_to.active_element.get_attribute("id") == "themeToggle", "focus non rendu au bouton principal"

    select_mobile_subject_all()
    start_mode("flashcard", 1, explanations=True)

    quiz = visible("#quiz")
    inner_height = driver.execute_script("return window.innerHeight")
    assert quiz.rect["height"] >= inner_height * 0.90, f"quiz mobile trop petit ({quiz.rect['height']} / {inner_height})"

    false_btn = driver.find_element(By.ID, "flashFalseBtn")
    true_btn = driver.find_element(By.ID, "flashTrueBtn")
    assert false_btn.rect["height"] >= 70 and true_btn.rect["height"] >= 70, "boutons Vrai/Faux trop petits sur mobile"
    assert not driver.find_elements(By.ID, "flashHint"), "texte d'aide encore présent sous Faux/Vrai"

    flash_card = driver.find_element(By.ID, "flashCard")
    flash_statement = driver.find_element(By.ID, "flashStatement")
    flash_controls = driver.find_element(By.ID, "flashSelfControls")
    time.sleep(0.45)  # attendre la fin de l'animation d'entrée avant les mesures
    assert flash_statement.rect["width"] >= flash_card.rect["width"] * 0.90, "réponse proposée mobile trop étroite dans la carte"
    assert flash_card.rect["y"] + flash_card.rect["height"] <= flash_controls.rect["y"] + 2, "carte Vrai/Faux empiète sur les boutons après stabilisation"
    assert flash_statement.rect["y"] + flash_statement.rect["height"] <= flash_card.rect["y"] + flash_card.rect["height"] + 1, "texte de réponse proposé hors de la carte"


    pause_btn = driver.find_element(By.ID, "pauseBtn")
    quit_btn = driver.find_element(By.ID, "quitBtn")
    pause_style = driver.execute_script("return [getComputedStyle(arguments[0]).backgroundColor,getComputedStyle(arguments[0]).color]", pause_btn)
    quit_style = driver.execute_script("return [getComputedStyle(arguments[0]).backgroundColor,getComputedStyle(arguments[0]).color]", quit_btn)
    assert pause_style == quit_style, "Pause et Abandonner n'ont pas le même style en Vrai/Faux"

    prompt = norm(driver.find_element(By.ID, "flashQuestion").text)
    proposal = norm(driver.find_element(By.ID, "flashStatement").text)
    truth = truth_map.get((prompt, proposal))
    assert truth is not None, f"impossible de déterminer la vérité de la carte: {prompt!r} / {proposal!r}"

    # Deliberately answer incorrectly: correction must replace the card content, not render below it.
    js_click(false_btn if truth else true_btn)
    error_card = visible("#flashCardExplanation:not(.hidden)")
    assert "is-error" in (error_card.get_attribute("class") or ""), "carte d'explication non marquée comme erreur"
    assert "réponse incorrecte" in driver.find_element(By.ID, "flashCardExplanationTitle").text.lower(), "titre d'erreur absent de la carte"
    assert driver.find_element(By.ID, "flashCardAnswerKey").is_displayed(), "vérité attendue absente de la carte"
    assert driver.find_element(By.ID, "flashCardExplanationText").text.strip(), "explication absente de la carte après erreur"
    assert not driver.find_element(By.ID, "flashQuestion").is_displayed(), "question encore visible après erreur"
    assert not driver.find_element(By.ID, "flashStatement").is_displayed(), "proposition encore visible après erreur"
    assert driver.find_element(By.ID, "feedback").get_attribute("class").endswith("hidden"), "ancienne correction externe encore visible"
    assert not driver.find_element(By.ID, "flashExplanationCountdownWrap").is_displayed(), "chronomètre affiché malgré une erreur"
    explanation_next = visible("#nextBtn")
    assert explanation_next.is_displayed(), "bouton suivant invisible avec explications mobile"
    time.sleep(0.45)
    assert not driver.find_element(By.ID, "results").is_displayed(), "résultats affichés avant validation de l'explication"
    js_click(driver.find_element(By.ID, "flashCard"))
    visible("#results:not(.hidden)")
    assert driver.find_element(By.ID, "finalScore").text.startswith("0 / 1"), "erreur Vrai/Faux non comptabilisée"

    review_panel = visible("#reviewRecommendations:not(.hidden)")
    review_cards = review_panel.find_elements(By.CSS_SELECTOR, ".review-topic-card")
    assert len(review_cards) >= 1, "aucun thème À réviser généré après une erreur"
    assert review_cards[0].find_element(By.CSS_SELECTOR, ".review-topic-name").text.strip(), "nom du thème À réviser absent"
    assert "erreur" in review_cards[0].find_element(By.CSS_SELECTOR, ".review-topic-errors").text.lower(), "compteur d'erreurs du thème absent"
    assert review_cards[0].find_element(By.CSS_SELECTOR, "[data-review-topic-index]").is_displayed(), "bouton Réviser ce thème absent"
    assert driver.find_element(By.ID, "reviewAllTopics").is_displayed(), "bouton Réviser tout absent"

    js_click(driver.find_element(By.ID, "retryErrors"))
    visible("#quiz:not(.hidden)")
    prompt = norm(driver.find_element(By.ID, "flashQuestion").text)
    proposal = norm(driver.find_element(By.ID, "flashStatement").text)
    truth = truth_map[(prompt, proposal)]
    js_click(driver.find_element(By.ID, "flashTrueBtn") if truth else driver.find_element(By.ID, "flashFalseBtn"))
    visible("#flashCardExplanation:not(.hidden)")
    assert driver.find_element(By.ID, "feedback").get_attribute("class").endswith("hidden"), "revue d'erreurs encore affichée hors de la carte"
    next_btn = visible("#nextBtn")
    assert next_btn.is_displayed(), "bouton de continuation invisible en revue d'erreurs mobile"
    assert "résultats" in next_btn.text.lower(), "libellé final de revue inattendu"

    assert_no_console_regressions()

    # 4) Version locale: chargement réel des 13 fichiers JSON et un QCM complet.
    driver.set_window_size(1280, 900)
    driver.get(BASE_URL + "index_local.html")
    wait_until(lambda: driver.execute_script("return document.readyState") == "complete", "index_local non chargé")
    driver.execute_script("localStorage.clear();")
    driver.get(BASE_URL + "index_local.html")
    folder_input = driver.find_element(By.ID, "folderInput")
    assert folder_input.get_attribute("webkitdirectory") is not None, "sélecteur de dossier local absent"
    bank_files = [str(p.resolve()) for p in sorted((ROOT / "banques").rglob("*.json"))]
    assert len(bank_files) == 13
    # ChromeDriver n'autorise pas toujours l'envoi automatisé d'un répertoire
    # sur un input webkitdirectory. Pour tester le moteur d'import sans boîte
    # de dialogue système, on retire cet attribut uniquement dans le test et
    # on injecte exactement les mêmes 13 JSON.
    driver.execute_script("arguments[0].removeAttribute('webkitdirectory'); arguments[0].style.display='block';", folder_input)
    folder_input.send_keys("\n".join(bank_files))
    wait_until(lambda: "13 banque(s) chargée(s)" in driver.find_element(By.ID, "loadStatus").text, "les banques locales ne se chargent pas")
    visible("#setup")
    wait_until(lambda: len(driver.find_elements(By.CSS_SELECTOR, "#subjectList .subject-card")) == 2, "matières locales incorrectes")
    js_click(driver.find_elements(By.CSS_SELECTOR, "#subjectList .subject-card")[0])
    wait_until(lambda: not driver.find_element(By.ID, "startBtn").get_property("disabled"), "sélection locale non prise en compte")
    count_el = driver.find_element(By.ID, "count")
    count_el.clear()
    count_el.send_keys("1")
    js_click(driver.find_element(By.ID, "startBtn"))
    visible("#quiz:not(.hidden)")
    inputs = driver.find_elements(By.CSS_SELECTOR, '#choices input[name="ans"]')
    correct = [i for i in inputs if i.get_attribute("data-correct") == "1"]
    assert correct
    for inp in correct:
        js_click(inp)
    js_click(driver.find_element(By.ID, "validateBtn"))
    wait_until(lambda: "Bonne réponse" in driver.find_element(By.ID, "feedback").text, "QCM local correct refusé")
    js_click(visible("#nextBtn"))
    visible("#results:not(.hidden)")
    assert not driver.find_element(By.ID, "reviewRecommendations").is_displayed(), "À réviser affiché après un sans-faute local"

    # Local targeted review: the imported-bank cache must be sufficient to relaunch a category.
    js_click(driver.find_element(By.ID, "newQuiz"))
    visible("#setup")
    count_el = driver.find_element(By.ID, "count")
    count_el.clear()
    count_el.send_keys("1")
    js_click(driver.find_element(By.ID, "startBtn"))
    visible("#quiz:not(.hidden)")
    answer_current_qcm_wrong()
    js_click(visible("#nextBtn"))
    visible("#results:not(.hidden)")
    local_review = visible("#reviewRecommendations:not(.hidden)")
    local_card = local_review.find_elements(By.CSS_SELECTOR, ".review-topic-card")[0]
    local_key = result_topic_key(local_card)
    local_expected = qcm_category_counts.get(local_key)
    assert local_expected, f"catégorie locale inconnue dans les banques: {local_key!r}"
    js_click(local_card.find_element(By.CSS_SELECTOR, "[data-review-topic-index]"))
    visible("#quiz:not(.hidden)")
    assert counter_total() == local_expected, f"Réviser ce thème local: {counter_total()} questions au lieu de {local_expected}"

    assert_no_console_regressions()
    print("OK — batterie E2E: QCM, Vrai/Faux, À réviser ciblé/global, desktop/mobile + version locale")
finally:
    driver.quit()

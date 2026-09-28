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

# Truth table used only by the E2E test to deliberately create/review one flashcard error.
truth_map: dict[tuple[str, str], bool] = {}
ambiguous: set[tuple[str, str]] = set()
for bank_path in sorted((ROOT / "banques").rglob("*.json")):
    data = json.loads(bank_path.read_text(encoding="utf-8"))
    for q in data.get("questions", []):
        correct = [c for c in q.get("choices", []) if c.get("correct") is True]
        if q.get("type") == "multiple" or len(correct) != 1:
            continue
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

    # The in-session control must enable explanations immediately and stop auto-advance.
    toggle = driver.find_element(By.ID, "flashExplanationToggle")
    js_click(toggle)
    wait_until(lambda: "activées" in toggle.text.lower(), "activation des explications non appliquée")
    js_click(driver.find_element(By.ID, "flashTrueBtn"))
    visible("#feedback:not(.hidden)")
    visible("#nextBtn")
    assert "explication" in driver.find_element(By.ID, "feedback").text.lower(), "explication Vrai/Faux absente"
    counter_with_explanation = driver.find_element(By.ID, "counter").text
    time.sleep(1.0)
    assert driver.find_element(By.ID, "counter").text == counter_with_explanation, "avance automatique active malgré les explications"
    js_click(toggle)
    wait_until(lambda: "désactivées" in toggle.text.lower(), "désactivation des explications non appliquée")
    wait_until(lambda: driver.find_element(By.ID, "counter").text.startswith("Question 3 /"), "désactivation n'a pas relancé l'enchaînement automatique")

    # 3) Mobile: modal focus, full-height layout, visual button balance, error review.
    fresh(390, 844)

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

    pause_btn = driver.find_element(By.ID, "pauseBtn")
    quit_btn = driver.find_element(By.ID, "quitBtn")
    pause_style = driver.execute_script("return [getComputedStyle(arguments[0]).backgroundColor,getComputedStyle(arguments[0]).color]", pause_btn)
    quit_style = driver.execute_script("return [getComputedStyle(arguments[0]).backgroundColor,getComputedStyle(arguments[0]).color]", quit_btn)
    assert pause_style == quit_style, "Pause et Abandonner n'ont pas le même style en Vrai/Faux"

    prompt = norm(driver.find_element(By.ID, "flashQuestion").text)
    proposal = norm(driver.find_element(By.ID, "flashStatement").text)
    truth = truth_map.get((prompt, proposal))
    assert truth is not None, f"impossible de déterminer la vérité de la carte: {prompt!r} / {proposal!r}"

    # Deliberately answer incorrectly: with explanations enabled, correction must appear before results.
    js_click(false_btn if truth else true_btn)
    visible("#feedback:not(.hidden)")
    explanation_next = visible("#nextBtn")
    assert explanation_next.is_displayed(), "bouton suivant invisible avec explications mobile"
    assert "explication" in driver.find_element(By.ID, "feedback").text.lower(), "explication absente après une erreur mobile"
    time.sleep(0.9)
    assert not driver.find_element(By.ID, "results").is_displayed(), "résultats affichés avant validation de l'explication"
    js_click(explanation_next)
    visible("#results:not(.hidden)")
    assert driver.find_element(By.ID, "finalScore").text.startswith("0 / 1"), "erreur Vrai/Faux non comptabilisée"

    js_click(driver.find_element(By.ID, "retryErrors"))
    visible("#quiz:not(.hidden)")
    prompt = norm(driver.find_element(By.ID, "flashQuestion").text)
    proposal = norm(driver.find_element(By.ID, "flashStatement").text)
    truth = truth_map[(prompt, proposal)]
    js_click(driver.find_element(By.ID, "flashTrueBtn") if truth else driver.find_element(By.ID, "flashFalseBtn"))
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

    assert_no_console_regressions()
    print("OK — tests navigateur web desktop/mobile + version locale")
finally:
    driver.quit()

(() => {
  "use strict";
  function createQuizApp({ local: IS_LOCAL = false } = {}) {
    const LEGACY_SAVE_KEY = "qcm_bts_dietetique_modular_progress_v7_8_0";
    const SAVE_KEY = IS_LOCAL
      ? "qcm_bts_dietetique_local_progress_v1"
      : LEGACY_SAVE_KEY;
    const FLASH_EXPLANATION_DELAY_MS = 7000;
    const $ = (id) => document.getElementById(id);
    const state = {
      manifest: null,
      selectedBankIds: new Set(),
      activeSubject: null,
      difficultyFilter: "all",
      mode: "qcm",
      session: [],
      index: 0,
      score: 0,
      errors: [],
      answered: false,
      reviewingErrors: false,
      flashExplanationsEnabled: false,
      flashOutcome: null,
    };
    const cache = new Map();
    const pendingBanks = new Map();
    const THEME_KEY = "qcm_bts_theme";
    const THEME_POS_KEY = "qcm_bts_theme_button_position";
    const systemThemeQuery = window.matchMedia
      ? window.matchMedia("(prefers-color-scheme: dark)")
      : null;
    let themeDragged = false;
    let themeDockedSide = null;

    function applyTheme(theme, { animate = false } = {}) {
      const dark = theme === "dark";
      const root = document.documentElement;
      const themeBtn = $("themeToggle");

      if (animate) {
        root.classList.add("theme-switching");
        themeBtn?.classList.add("theme-animating");
      }

      root.dataset.theme = dark ? "dark" : "light";
      root.style.colorScheme = dark ? "dark" : "light";
      if (themeBtn) {
        themeBtn.classList.toggle("is-dark", dark);
        themeBtn.setAttribute(
          "aria-label",
          dark ? "Activer le mode jour" : "Activer le mode nuit",
        );
        themeBtn.title = dark ? "Mode jour" : "Mode nuit";
      }

      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", dark ? "#0f1319" : "#4f46e5");

      if (animate) {
        window.setTimeout(() => {
          root.classList.remove("theme-switching");
          themeBtn?.classList.remove("theme-animating");
        }, 520);
      }
    }
    function storedTheme() {
      try {
        const theme = localStorage.getItem(THEME_KEY);
        return ["light", "dark"].includes(theme) ? theme : null;
      } catch {
        return null;
      }
    }
    function initTheme() {
      const saved = storedTheme();
      const systemDark = !!(systemThemeQuery && systemThemeQuery.matches);
      applyTheme(saved || (systemDark ? "dark" : "light"));

      if (systemThemeQuery) {
        systemThemeQuery.addEventListener?.("change", (e) => {
          if (!storedTheme()) applyTheme(e.matches ? "dark" : "light");
        });
      }
    }
    function toggleTheme() {
      const next =
        document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {}
      applyTheme(next, { animate: true });
    }

    function clampThemePosition(left, top) {
      const btn = $("themeToggle");
      const w = btn?.offsetWidth || 57,
        h = btn?.offsetHeight || 57,
        pad = 24;
      return {
        left: Math.max(pad, Math.min(left, window.innerWidth - w - pad)),
        top: Math.max(pad, Math.min(top, window.innerHeight - h - pad)),
      };
    }

    function clampThemeDragPosition(left, top) {
      const btn = $("themeToggle");
      const w = btn?.offsetWidth || 57,
        h = btn?.offsetHeight || 57,
        pad = 10;
      // During drag, the user can deliberately approach the horizontal margins.
      return {
        left: Math.max(-w * 0.15, Math.min(left, window.innerWidth - w * 0.85)),
        top: Math.max(pad, Math.min(top, window.innerHeight - h - pad)),
      };
    }

    function nearestThemeCorner(left, top) {
      const btn = $("themeToggle");
      const w = btn?.offsetWidth || 57,
        h = btn?.offsetHeight || 57,
        pad = 24;
      const maxLeft = Math.max(pad, window.innerWidth - w - pad);
      const maxTop = Math.max(pad, window.innerHeight - h - pad);
      const centerX = left + w / 2,
        centerY = top + h / 2;
      const corners = [
        { left: pad, top: pad },
        { left: maxLeft, top: pad },
        { left: pad, top: maxTop },
        { left: maxLeft, top: maxTop },
      ];
      return corners.reduce((best, c) => {
        const cx = c.left + w / 2,
          cy = c.top + h / 2;
        const d = (centerX - cx) ** 2 + (centerY - cy) ** 2;
        return !best || d < best.d ? { ...c, d } : best;
      }, null);
    }

    function saveThemeButtonPosition() {
      const btn = $("themeToggle");
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      try {
        localStorage.setItem(
          THEME_POS_KEY,
          JSON.stringify({
            left: rect.left,
            top: rect.top,
            dockedSide: themeDockedSide,
          }),
        );
      } catch {}
    }

    function dockThemeButton(side, top = null) {
      const btn = $("themeToggle");
      if (!btn || !["left", "right"].includes(side)) return;

      const w = btn.offsetWidth || 57,
        h = btn.offsetHeight || 57;
      const visibleRatio = window.innerWidth <= 760 ? 0.55 : 0.3; // davantage visible sur mobile
      const current = btn.getBoundingClientRect();
      const safeTop = Math.max(
        18,
        Math.min(top ?? current.top, window.innerHeight - h - 18),
      );
      const left =
        side === "left"
          ? -w * (1 - visibleRatio)
          : window.innerWidth - w * visibleRatio;

      themeDockedSide = side;
      btn.classList.add("docked", "snapping");
      btn.style.right = "auto";
      btn.style.bottom = "auto";

      requestAnimationFrame(() => {
        btn.style.left = left + "px";
        btn.style.top = safeTop + "px";
      });

      const done = () => {
        btn.classList.remove("snapping");
        btn.removeEventListener("transitionend", done);
        saveThemeButtonPosition();
      };
      btn.addEventListener("transitionend", done);
      setTimeout(done, 420);
    }

    function snapThemeButtonToNearestCorner() {
      const btn = $("themeToggle");
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const target = nearestThemeCorner(rect.left, rect.top);
      if (!target) return;

      themeDockedSide = null;
      btn.classList.remove("docked");
      btn.classList.add("snapping");
      btn.style.right = "auto";
      btn.style.bottom = "auto";

      requestAnimationFrame(() => {
        btn.style.left = target.left + "px";
        btn.style.top = target.top + "px";
      });

      const done = () => {
        btn.classList.remove("snapping");
        btn.removeEventListener("transitionend", done);
        saveThemeButtonPosition();
      };
      btn.addEventListener("transitionend", done);
      setTimeout(done, 420);
    }

    function revealDockedThemeButton() {
      const btn = $("themeToggle");
      if (!btn || !themeDockedSide) {
        return;
      }

      const side = themeDockedSide;
      const rect = btn.getBoundingClientRect();
      const w = btn.offsetWidth || 57;
      const targetLeft = side === "left" ? 24 : window.innerWidth - w - 24;

      themeDockedSide = null;
      btn.classList.remove("docked");
      btn.classList.add("revealing");
      btn.style.left = targetLeft + "px";
      btn.style.top =
        Math.max(
          18,
          Math.min(
            rect.top,
            window.innerHeight - (btn.offsetHeight || 57) - 18,
          ),
        ) + "px";

      const finishReveal = () => {
        btn.classList.remove("revealing");
        btn.removeEventListener("transitionend", finishReveal);
        saveThemeButtonPosition();
      };
      btn.addEventListener("transitionend", finishReveal);
      setTimeout(finishReveal, 380);
    }

    function restoreThemeButtonPosition() {
      const btn = $("themeToggle");
      if (!btn) return;
      try {
        const saved = JSON.parse(localStorage.getItem(THEME_POS_KEY) || "null");
        if (saved && Number.isFinite(saved.top)) {
          if (saved.dockedSide === "left" || saved.dockedSide === "right") {
            themeDockedSide = saved.dockedSide;
            btn.classList.add("docked");
            const w = btn.offsetWidth || 57,
              h = btn.offsetHeight || 57;
            const visibleRatio = window.innerWidth <= 760 ? 0.55 : 0.3;
            btn.style.left =
              (themeDockedSide === "left"
                ? -w * (1 - visibleRatio)
                : window.innerWidth - w * visibleRatio) + "px";
            btn.style.top =
              Math.max(18, Math.min(saved.top, window.innerHeight - h - 18)) +
              "px";
            btn.style.right = "auto";
            btn.style.bottom = "auto";
          } else if (Number.isFinite(saved.left)) {
            const pos = clampThemePosition(saved.left, saved.top);
            btn.style.left = pos.left + "px";
            btn.style.top = pos.top + "px";
            btn.style.right = "auto";
            btn.style.bottom = "auto";
            requestAnimationFrame(() => snapThemeButtonToNearestCorner());
          }
        }
      } catch {}
    }

    function enableThemeButtonDrag() {
      const btn = $("themeToggle");
      if (!btn) return;

      let dragging = false,
        moved = false,
        startX = 0,
        startY = 0,
        startLeft = 0,
        startTop = 0,
        pointerId = null;

      const start = (clientX, clientY, id = null) => {
        const rect = btn.getBoundingClientRect();

        dragging = true;
        moved = false;
        themeDragged = false;
        pointerId = id;
        startX = clientX;
        startY = clientY;
        startLeft = rect.left;
        startTop = rect.top;
        btn.classList.add("dragging");
      };

      const move = (clientX, clientY, event = null) => {
        if (!dragging) return;
        const dx = clientX - startX,
          dy = clientY - startY;
        if (Math.hypot(dx, dy) > 5) moved = true;
        if (!moved) return;
        event?.preventDefault?.();
        const pos = clampThemeDragPosition(startLeft + dx, startTop + dy);
        btn.style.left = pos.left + "px";
        btn.style.top = pos.top + "px";
        btn.style.right = "auto";
        btn.style.bottom = "auto";
      };

      const end = () => {
        if (!dragging) return;
        dragging = false;
        btn.classList.remove("dragging");
        themeDragged = moved;
        pointerId = null;

        if (moved) {
          const r = btn.getBoundingClientRect();
          const centerX = r.left + r.width / 2;
          const edgeThreshold = Math.max(72, r.width * 1.35);

          if (centerX <= edgeThreshold) {
            dockThemeButton("left", r.top);
          } else if (window.innerWidth - centerX <= edgeThreshold) {
            dockThemeButton("right", r.top);
          } else {
            snapThemeButtonToNearestCorner();
          }
        }
      };

      if (window.PointerEvent) {
        btn.addEventListener("pointerdown", (e) => {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          start(e.clientX, e.clientY, e.pointerId);
          try {
            btn.setPointerCapture(e.pointerId);
          } catch {}
          e.preventDefault();
        });
        window.addEventListener(
          "pointermove",
          (e) => {
            if (!dragging || (pointerId !== null && e.pointerId !== pointerId))
              return;
            move(e.clientX, e.clientY, e);
          },
          { passive: false },
        );
        window.addEventListener("pointerup", (e) => {
          if (pointerId !== null && e.pointerId !== pointerId) return;
          end();
        });
        window.addEventListener("pointercancel", end);
      } else {
        btn.addEventListener(
          "touchstart",
          (e) => {
            const t = e.touches[0];
            if (!t) return;
            start(t.clientX, t.clientY, "touch");
            e.preventDefault();
          },
          { passive: false },
        );
        window.addEventListener(
          "touchmove",
          (e) => {
            if (!dragging) return;
            const t = e.touches[0];
            if (!t) return;
            move(t.clientX, t.clientY, e);
          },
          { passive: false },
        );
        window.addEventListener("touchend", end, { passive: true });
        window.addEventListener("touchcancel", end, { passive: true });
        btn.addEventListener("mousedown", (e) => {
          if (e.button !== 0) return;
          start(e.clientX, e.clientY, "mouse");
          e.preventDefault();
        });
        window.addEventListener("mousemove", (e) =>
          move(e.clientX, e.clientY, e),
        );
        window.addEventListener("mouseup", end);
      }

      btn.addEventListener("click", (e) => {
        if (themeDragged) {
          e.preventDefault();
          e.stopPropagation();
          themeDragged = false;
          return;
        }
        if (themeDockedSide) {
          revealDockedThemeButton();
          window.setTimeout(toggleTheme, 390);
          return;
        }
        toggleTheme();
      });

      window.addEventListener("resize", () => {
        if (themeDockedSide) {
          dockThemeButton(
            themeDockedSide,
            $("themeToggle").getBoundingClientRect().top,
          );
        } else if (btn.style.left) {
          snapThemeButtonToNearestCorner();
        }
      });
    }

    function esc(s) {
      return String(s).replace(
        /[&<>"']/g,
        (c) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          })[c],
      );
    }
    function shuffle(a) {
      a = [...a];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }
    function subjects() {
      return [
        ...new Set(state.manifest.banks.map((b) => b.subject || "Autres")),
      ];
    }
    function banksForSubject(subject) {
      return state.manifest.banks.filter(
        (b) => (b.subject || "Autres") === subject,
      );
    }

    function syncModeUI() {
      const flash = state.mode === "flashcard";
      document.body.classList.toggle("flashcard-mode", flash);
      document.querySelectorAll(".mode-btn").forEach((btn) => {
        const active = btn.dataset.mode === state.mode;
        btn.classList.toggle("selected", active);
        btn.setAttribute("aria-pressed", active ? "true" : "false");
      });
      const optionsBlock = document.querySelector(".config-options");
      if (optionsBlock) optionsBlock.classList.toggle("options-empty", flash);
      const startBtn = $("startBtn");
      if (startBtn && !startBtn.disabled)
        startBtn.textContent = flash ? "Commencer les cartes" : "Commencer";
    }
    function setStudyMode(mode) {
      state.mode = mode === "flashcard" ? "flashcard" : "qcm";
      syncModeUI();
      syncFlashExplanationUI();
      updateAvailable();
    }

    function syncFlashExplanationUI() {
      const flash = state.mode === "flashcard";
      const enabled = flash && state.flashExplanationsEnabled;
      document.body.classList.toggle("flash-explanations-on", enabled);
      const btn = $("flashExplanationMenuBtn");
      if (!btn) return;
      btn.classList.toggle("hidden", !flash);
      btn.classList.toggle("active", enabled);
      btn.setAttribute("aria-pressed", enabled ? "true" : "false");
      btn.setAttribute(
        "aria-label",
        enabled
          ? "Désactiver les explications Vrai/Faux"
          : "Activer les explications Vrai/Faux",
      );
      btn.title = enabled
        ? "Explications activées"
        : "Explications désactivées";
    }
    function showCurrentFlashExplanationIfAnswered() {
      if (
        state.mode !== "flashcard" ||
        !state.answered ||
        state.reviewingErrors ||
        !state.flashOutcome
      )
        return;
      const q = state.session[state.index];
      if (!q) return;
      if (state.flashExplanationsEnabled) {
        clearFlashAdvance();
        resetFlashCardVisual();
        $("flashFalseBtn").disabled = true;
        $("flashTrueBtn").disabled = true;
        $("flashCard").style.pointerEvents = "none";
        showFlashcardExplanation(q, {
          ok: state.flashOutcome.ok,
          autoAdvance: state.flashOutcome.ok,
        });
      } else {
        hideFlashcardExplanation();
        $("feedback").classList.add("hidden");
        $("feedback").innerHTML = "";
        $("nextBtn").classList.add("hidden");
        saveProgress();
        scheduleFlashAdvance(260);
      }
    }
    function setFlashExplanations(enabled, { updateAnswered = true } = {}) {
      state.flashExplanationsEnabled = !!enabled;
      syncFlashExplanationUI();
      if (updateAnswered) showCurrentFlashExplanationIfAnswered();
      if (state.session.length) saveProgress();
    }
    function toggleFlashExplanations() {
      setFlashExplanations(!state.flashExplanationsEnabled);
    }
    function openFlashExplanationPrompt() {
      const overlay = $("flashExplanationOverlay");
      if (!overlay) return;
      $("setup").inert = true;
      overlay.inert = false;
      overlay.classList.add("open");
      overlay.setAttribute("aria-hidden", "false");
      document.body.classList.add("flash-pref-open");
      requestAnimationFrame(() => $("flashExplanationYes")?.focus());
    }
    function closeFlashExplanationPrompt({ restoreFocus = true } = {}) {
      const overlay = $("flashExplanationOverlay");
      if (!overlay) return;
      if (
        overlay.contains(document.activeElement) &&
        document.activeElement instanceof HTMLElement
      )
        document.activeElement.blur();
      overlay.classList.remove("open");
      overlay.setAttribute("aria-hidden", "true");
      overlay.inert = true;
      $("setup").inert = false;
      document.body.classList.remove("flash-pref-open");
      if (restoreFocus) $("startBtn")?.focus({ preventScroll: true });
    }
    function chooseFlashExplanation(enabled) {
      setFlashExplanations(enabled, { updateAnswered: false });
      closeFlashExplanationPrompt({ restoreFocus: false });
      startPreparedSession();
    }

    function validQuestion(q) {
      if (
        !q ||
        typeof q.id !== "string" ||
        !q.id.trim() ||
        typeof q.prompt !== "string" ||
        !q.prompt.trim()
      )
        return false;
      if (
        !["single", "multiple"].includes(q.type) ||
        !Array.isArray(q.choices) ||
        q.choices.length < 2
      )
        return false;
      if (
        !q.choices.every(
          (c) =>
            c &&
            typeof c.text === "string" &&
            c.text.trim() &&
            typeof c.correct === "boolean",
        )
      )
        return false;
      const correct = q.choices.filter((c) => c.correct).length;
      return q.type === "single" ? correct === 1 : correct >= 2;
    }
    function validateBank(data, file) {
      if (
        !data ||
        !Array.isArray(data.questions) ||
        !data.questions.every(validQuestion)
      )
        throw new Error("Banque invalide : " + file);
      const ids = data.questions.map((q) => q.id);
      if (new Set(ids).size !== ids.length)
        throw new Error("Identifiants de questions dupliqués : " + file);
      return data;
    }
    function validFlashSnapshot(q) {
      if (
        !isFlashcardEligible(q) ||
        !Array.isArray(q.flashProposal) ||
        q.flashProposal.length !== 1 ||
        typeof q.flashTruth !== "boolean"
      )
        return false;
      return q.choices.some(
        (c) =>
          c.text.trim() === q.flashProposal[0] && c.correct === q.flashTruth,
      );
    }
    function validSavedProgress(s, items, errors) {
      return (
        !!s &&
        ["qcm", "flashcard"].includes(s.mode || "qcm") &&
        Array.isArray(items) &&
        items.length > 0 &&
        Number.isInteger(s.index) &&
        s.index >= 0 &&
        s.index <= items.length &&
        Number.isInteger(s.score) &&
        s.score >= 0 &&
        s.score <= s.index &&
        Array.isArray(errors) &&
        errors.length === s.index - s.score
      );
    }

    async function loadManifest() {
      if (location.protocol === "file:")
        throw new Error(
          "Cette version web doit être ouverte depuis GitHub Pages. Utilise index_local.html pour un test par double-clic.",
        );
      const r = await fetch("manifest.json", { cache: "no-store" });
      if (!r.ok)
        throw new Error("manifest.json introuvable (" + r.status + ")");
      const m = await r.json();
      if (
        !m ||
        !Array.isArray(m.banks) ||
        !m.banks.every(
          (b) =>
            b &&
            typeof b.id === "string" &&
            b.id &&
            typeof b.file === "string" &&
            /^banques\/[^?#]+\.json$/.test(b.file) &&
            !b.file.split("/").includes("..") &&
            typeof b.title === "string" &&
            typeof b.subject === "string" &&
            Number.isInteger(b.count) &&
            b.count >= 0,
        ) ||
        new Set(m.banks.map((b) => b.id)).size !== m.banks.length ||
        new Set(m.banks.map((b) => b.file)).size !== m.banks.length
      )
        throw new Error("Format de manifest.json invalide.");
      state.manifest = m;
    }
    async function loadBank(file) {
      if (cache.has(file)) return cache.get(file);
      if (IS_LOCAL) throw new Error("Banque non chargée : " + file);
      if (pendingBanks.has(file)) return pendingBanks.get(file);
      const request = (async () => {
        const r = await fetch(file, { cache: "no-store" });
        if (!r.ok) throw new Error("Impossible de charger " + file);
        const data = validateBank(await r.json(), file);
        cache.set(file, data);
        return data;
      })();
      pendingBanks.set(file, request);
      try {
        return await request;
      } finally {
        pendingBanks.delete(file);
      }
    }
    function inferSubject(file, data) {
      if (typeof data.subject === "string" && data.subject.trim())
        return data.subject.trim();
      const parts = (file.webkitRelativePath || file.name)
        .split("/")
        .filter(Boolean);
      const idx = parts.map((x) => x.toLowerCase()).lastIndexOf("banques");
      if (idx >= 0 && parts.length > idx + 2) return parts[idx + 1];
      if (parts.length >= 3) return parts[parts.length - 2];
      return "Autres";
    }
    async function loadFolder(files) {
      const banks = [];
      cache.clear();
      let ignored = 0;
      const errors = [];
      for (const file of [...files].filter((f) =>
        f.name.toLowerCase().endsWith(".json"),
      )) {
        try {
          const data = JSON.parse(await file.text());
          if (!data || !Array.isArray(data.questions)) {
            ignored++;
            continue;
          }
          validateBank(data, file.name);
          const path = file.webkitRelativePath || file.name;
          const subject = inferSubject(file, data);
          const id = path.replace(/\.json$/i, "").replaceAll("/", "__");
          const bank = {
            id,
            title: data.title || file.name.replace(/\.json$/i, ""),
            subject,
            chapter: data.chapter || "",
            file: path,
            count: data.questions.length,
            version: data.version || 1,
          };
          banks.push(bank);
          cache.set(path, data);
        } catch (e) {
          errors.push(file.name + " : " + e.message);
        }
      }
      state.manifest = { banks };
      state.selectedBankIds = new Set();
      state.activeSubject = subjects()[0] || null;
      if (banks.length) {
        renderSelectionUI();
        $("setup").classList.remove("hidden");
        const heroText = $("heroText");
        if (heroText)
          heroText.textContent = `${banks.reduce((s, b) => s + b.count, 0)} questions disponibles • ${subjects().length} matières • version locale`;
        $("loadStatus").innerHTML =
          `<span class="ok">${banks.length} banque(s) chargée(s)</span>${ignored ? ` • ${ignored} JSON ignoré(s)` : ""}`;
      } else {
        $("setup").classList.add("hidden");
        $("loadStatus").innerHTML =
          '<span class="bad">Aucune banque valide trouvée.</span>';
      }
      if (!$("results").classList.contains("hidden"))
        renderReviewRecommendations();
      if (errors.length)
        $("loadStatus").innerHTML +=
          `<br><span class="bad">${errors.map(esc).join("<br>")}</span>`;
    }

    function subjectStats(subject) {
      const banks = banksForSubject(subject);
      const selected = banks.filter((b) => state.selectedBankIds.has(b.id));
      return {
        banks,
        selected,
        questions: selected.reduce((s, b) => s + Number(b.count || 0), 0),
        totalQuestions: banks.reduce((s, b) => s + Number(b.count || 0), 0),
      };
    }

    function isMobileSelectionUI() {
      return (
        window.matchMedia && window.matchMedia("(max-width:760px)").matches
      );
    }
    function subjectAllSelected(subject) {
      const st = subjectStats(subject);
      return st.banks.length > 0 && st.selected.length === st.banks.length;
    }
    function updateDesktopToggleButton() {
      const btn = $("toggleAllChapters");
      if (!btn || !state.activeSubject) return;
      btn.textContent = subjectAllSelected(state.activeSubject)
        ? "Tout désélectionner"
        : "Tout sélectionner";
    }
    function renderMobileSheet() {
      const subject = state.activeSubject;
      if (!subject) return;
      const list = banksForSubject(subject);
      const st = subjectStats(subject);
      $("mobileSheetTitle").textContent = subject;
      $("mobileSheetMeta").textContent =
        `${st.selected.length} chapitre${st.selected.length > 1 ? "s" : ""} sélectionné${st.selected.length > 1 ? "s" : ""} sur ${st.banks.length}`;
      $("mobileToggleAll").textContent = subjectAllSelected(subject)
        ? "Tout désélectionner"
        : "Tout sélectionner";
      $("mobileChapterList").innerHTML = list
        .map((b) => {
          const selected = state.selectedBankIds.has(b.id);
          return `<button class="chapter-card ${selected ? "selected" : ""}" type="button" data-bank-id="${esc(b.id)}" aria-pressed="${selected ? "true" : "false"}">
      <div class="chapter-title">${esc(b.title)}</div>
      <div class="chapter-meta">${esc(b.chapter || "")} • ${b.count} questions</div>
    </button>`;
        })
        .join("");
      $("mobileChapterList")
        .querySelectorAll(".chapter-card")
        .forEach((btn) =>
          btn.addEventListener("click", () => {
            const id = btn.dataset.bankId;
            if (state.selectedBankIds.has(id)) state.selectedBankIds.delete(id);
            else state.selectedBankIds.add(id);
            renderSelectionUI();
          }),
        );
    }
    let mobileSheetReturnSubject = null;
    let mobileSheetInertSnapshot = [];
    let mobileSheetThemeWasInert = false;
    function openMobileSheet(subject) {
      state.activeSubject = subject;
      mobileSheetReturnSubject = subject;

      renderSelectionUI();
      renderMobileSheet();
      const overlay = $("mobileSheetOverlay"),
        gear = $("themeToggle");
      mobileSheetInertSnapshot = [
        ...document.querySelectorAll("main > :not(#mobileSheetOverlay)"),
      ].map((el) => [el, el.inert]);
      mobileSheetInertSnapshot.forEach(([el]) => {
        el.inert = true;
      });
      mobileSheetThemeWasInert = gear?.inert || false;
      if (gear) gear.inert = true;
      overlay.inert = false;
      overlay.classList.add("open");
      overlay.setAttribute("aria-hidden", "false");
      document.body.classList.add("sheet-open");
      const closeBtn = $("mobileSheetClose");
      closeBtn?.focus({ preventScroll: true });
      requestAnimationFrame(() => {
        if (document.activeElement !== closeBtn)
          closeBtn?.focus({ preventScroll: true });
      });
    }
    function closeMobileSheet() {
      const overlay = $("mobileSheetOverlay"),
        gear = $("themeToggle");
      if (
        overlay.contains(document.activeElement) &&
        document.activeElement instanceof HTMLElement
      )
        document.activeElement.blur();
      overlay.classList.remove("open");
      overlay.setAttribute("aria-hidden", "true");
      overlay.inert = true;
      mobileSheetInertSnapshot.forEach(([el, wasInert]) => {
        el.inert = wasInert;
      });
      mobileSheetInertSnapshot = [];
      if (gear) gear.inert = mobileSheetThemeWasInert;
      document.body.classList.remove("sheet-open");
      const returnTarget = [...document.querySelectorAll(".subject-card")].find(
        (btn) => btn.dataset.subject === mobileSheetReturnSubject,
      );
      if (returnTarget) returnTarget.focus({ preventScroll: true });
      mobileSheetReturnSubject = null;
    }

    function renderSubjects() {
      $("subjectList").innerHTML = subjects()
        .map((subject) => {
          const st = subjectStats(subject);
          const selected = st.selected.length > 0;
          const partial = selected && st.selected.length < st.banks.length;
          return `<button class="subject-card ${selected ? "selected" : ""} ${partial ? "partial" : ""} ${state.activeSubject === subject ? "active" : ""}" type="button" data-subject="${esc(subject)}" aria-pressed="${selected ? "true" : "false"}">
      <span class="subject-name">${esc(subject)}</span>
      <span class="subject-meta">${st.selected.length}/${st.banks.length} chapitres • ${st.questions}/${st.totalQuestions} questions</span>
    </button>`;
        })
        .join("");
      $("subjectList")
        .querySelectorAll(".subject-card")
        .forEach((btn) =>
          btn.addEventListener("click", () => {
            const subject = btn.dataset.subject;
            if (isMobileSelectionUI()) {
              openMobileSheet(subject);
              return;
            }
            state.activeSubject = subject;
            const st = subjectStats(subject);
            const allSelected =
              st.banks.length > 0 && st.selected.length === st.banks.length;
            toggleSubject(subject, !allSelected);
          }),
        );
    }
    function renderChapters() {
      const subject = state.activeSubject;
      const list = subject ? banksForSubject(subject) : [];
      $("activeSubjectTitle").textContent = subject || "Chapitres";
      const st = subject ? subjectStats(subject) : null;
      $("activeSubjectMeta").textContent = st
        ? `${st.selected.length} chapitre${st.selected.length > 1 ? "s" : ""} sélectionné${st.selected.length > 1 ? "s" : ""} sur ${st.banks.length}`
        : "";
      updateDesktopToggleButton();
      $("toggleAllChapters").disabled = !subject;
      if (!list.length) {
        $("chapterList").innerHTML =
          '<div class="empty-chapters">Sélectionne une matière à gauche.</div>';
        return;
      }
      $("chapterList").innerHTML = list
        .map((b) => {
          const selected = state.selectedBankIds.has(b.id);
          return `<button class="chapter-card ${selected ? "selected" : ""}" type="button" data-bank-id="${esc(b.id)}" aria-pressed="${selected ? "true" : "false"}">
      <div class="chapter-title">${esc(b.title)}</div>
      <div class="chapter-meta">${esc(b.chapter || "")} • ${b.count} questions</div>
    </button>`;
        })
        .join("");
      $("chapterList")
        .querySelectorAll(".chapter-card")
        .forEach((btn) =>
          btn.addEventListener("click", () => {
            const id = btn.dataset.bankId;
            if (state.selectedBankIds.has(id)) state.selectedBankIds.delete(id);
            else state.selectedBankIds.add(id);
            renderSelectionUI();
          }),
        );
    }
    function toggleSubject(subject, enabled) {
      const banks = banksForSubject(subject);
      for (const b of banks) {
        if (enabled) state.selectedBankIds.add(b.id);
        else state.selectedBankIds.delete(b.id);
      }
      state.activeSubject = subject;
      renderSelectionUI();
    }
    function setAllActiveSubject(enabled) {
      if (!state.activeSubject) return;
      toggleSubject(state.activeSubject, enabled);
    }
    function selectedBanks() {
      return state.manifest.banks.filter((b) =>
        state.selectedBankIds.has(b.id),
      );
    }
    let availabilityRequestId = 0;

    function difficultyLabel(value) {
      const v = String(value ?? 1);
      return v === "1"
        ? "Facile"
        : v === "2"
          ? "Intermédiaire"
          : v === "3"
            ? "Difficile"
            : `Niveau ${v}`;
    }
    function questionMatchesDifficulty(q) {
      return (
        state.difficultyFilter === "all" ||
        String(q.difficulty ?? 1) === state.difficultyFilter
      );
    }
    function isFlashcardEligible(q) {
      return (
        q.type !== "multiple" &&
        (q.choices || []).filter((c) => c.correct).length === 1
      );
    }
    function syncDifficultyButtons() {
      document.querySelectorAll(".difficulty-btn").forEach((btn) => {
        const selected = btn.dataset.difficulty === state.difficultyFilter;
        btn.classList.toggle("selected", selected);
        btn.setAttribute("aria-pressed", selected ? "true" : "false");
      });
    }
    function setDifficulty(level) {
      state.difficultyFilter = ["all", "1", "2", "3"].includes(String(level))
        ? String(level)
        : "all";
      syncDifficultyButtons();
      updateAvailable();
    }
    async function difficultyCountsForBanks(banks) {
      const counts = { all: 0, 1: 0, 2: 0, 3: 0 };
      const entries = await Promise.all(
        banks.map(async (bank) => ({ bank, data: await loadBank(bank.file) })),
      );
      for (const { data } of entries) {
        for (const q of data.questions) {
          if (state.mode === "flashcard" && !isFlashcardEligible(q)) continue;
          const d = String(q.difficulty ?? 1);
          counts.all++;
          if (Object.prototype.hasOwnProperty.call(counts, d)) counts[d]++;
        }
      }
      return counts;
    }
    function renderDifficultyCounts(counts) {
      $("diffCountAll").textContent =
        `${counts.all} question${counts.all > 1 ? "s" : ""}`;
      $("diffCount1").textContent =
        `${counts["1"]} question${counts["1"] > 1 ? "s" : ""}`;
      $("diffCount2").textContent =
        `${counts["2"]} question${counts["2"] > 1 ? "s" : ""}`;
      $("diffCount3").textContent =
        `${counts["3"]} question${counts["3"] > 1 ? "s" : ""}`;
    }
    async function updateAvailable() {
      const requestId = ++availabilityRequestId;
      const banks = selectedBanks();
      const activeSubjects = new Set(banks.map((b) => b.subject || "Autres"))
        .size;
      $("selectionSummary").textContent =
        `${activeSubjects} matière${activeSubjects > 1 ? "s" : ""} • ${banks.length} chapitre${banks.length > 1 ? "s" : ""}`;
      syncDifficultyButtons();

      if (!banks.length) {
        const empty = { all: 0, 1: 0, 2: 0, 3: 0 };
        renderDifficultyCounts(empty);
        $("available").textContent = "0 question disponible";
        $("count").max = 1;
        $("startBtn").disabled = true;
        return;
      }

      $("available").textContent = "Calcul des questions disponibles…";
      try {
        const counts = await difficultyCountsForBanks(banks);
        if (requestId !== availabilityRequestId) return;
        renderDifficultyCounts(counts);
        const total = counts[state.difficultyFilter] ?? 0;
        const label =
          state.difficultyFilter === "all"
            ? "tous niveaux"
            : difficultyLabel(state.difficultyFilter).toLowerCase();
        $("available").textContent =
          `${total} question${total > 1 ? "s" : ""} disponible${total > 1 ? "s" : ""} • ${label}`;
        $("count").max = Math.max(1, total);
        if (total && Number($("count").value) > total) $("count").value = total;
        $("startBtn").disabled = total === 0;
      } catch (e) {
        if (requestId !== availabilityRequestId) return;
        $("available").textContent =
          "Impossible de calculer les questions disponibles.";
        $("startBtn").disabled = true;
      }
    }
    function renderSelectionUI() {
      const active = document.activeElement;
      const focusKey = active?.dataset.bankId || active?.dataset.subject;
      const focusList = active?.parentElement?.id;
      renderSubjects();
      renderChapters();
      updateAvailable();
      if ($("mobileSheetOverlay")?.classList.contains("open"))
        renderMobileSheet();
      if (focusKey && focusList) {
        const replacement = [...$(focusList).querySelectorAll("button")].find(
          (btn) => (btn.dataset.bankId || btn.dataset.subject) === focusKey,
        );
        replacement?.focus({ preventScroll: true });
      }
    }

    function buildFlashcard(q, wantTrue) {
      const correct = (q.choices || []).filter((c) => c.correct);
      const incorrect = (q.choices || []).filter((c) => !c.correct);
      const multiple = q.type === "multiple" || correct.length > 1;
      let truth = !!wantTrue,
        proposal = [];
      if (!multiple) {
        let pool = truth ? correct : incorrect;
        if (!pool.length) {
          truth = !truth;
          pool = truth ? correct : incorrect;
        }
        const choice =
          pool[Math.floor(Math.random() * pool.length)] || (q.choices || [])[0];
        proposal = choice ? [String(choice.text || "").trim()] : [];
      } else if (truth) {
        proposal = correct
          .map((c) => String(c.text || "").trim())
          .filter(Boolean);
      } else if (incorrect.length) {
        proposal = correct
          .map((c) => String(c.text || "").trim())
          .filter(Boolean);
        const bad = String(
          incorrect[Math.floor(Math.random() * incorrect.length)].text || "",
        ).trim();
        if (proposal.length) {
          proposal[Math.floor(Math.random() * proposal.length)] = bad;
        } else proposal = [bad];
        proposal = shuffle(proposal);
      } else if (correct.length > 1) {
        proposal = correct
          .slice(0, -1)
          .map((c) => String(c.text || "").trim())
          .filter(Boolean);
      } else {
        truth = true;
        proposal = correct
          .map((c) => String(c.text || "").trim())
          .filter(Boolean);
      }
      return { ...q, flashProposal: proposal, flashTruth: truth };
    }
    function flashProposalText(q) {
      const p = Array.isArray(q.flashProposal) ? q.flashProposal : [];
      if (!p.length) return "Réponse non disponible.";
      return p.length === 1 ? p[0] : p.map((x) => "• " + x).join("\n");
    }
    function makeFlashcardSession(questions) {
      return questions.map((q) => buildFlashcard(q, Math.random() >= 0.5));
    }
    async function createSessionFromSelection() {
      const banks = selectedBanks();
      if (!banks.length) throw new Error("Sélectionne au moins un chapitre.");
      const pool = [];
      for (const bank of banks) {
        const data = await loadBank(bank.file);
        for (const q of data.questions) {
          if (!questionMatchesDifficulty(q)) continue;
          if (state.mode === "flashcard" && !isFlashcardEligible(q)) continue;
          pool.push({
            ...q,
            bankTitle: bank.title,
            subject: bank.subject || data.subject || "",
            chapter: bank.chapter || data.chapter || "",
            bankFile: bank.file,
          });
        }
      }
      if (!pool.length)
        throw new Error(
          "Aucune question ne correspond à la difficulté sélectionnée.",
        );
      const wanted = Math.max(
        1,
        Math.min(parseInt($("count").value, 10) || 20, pool.length),
      );
      const selected = shuffle(pool).slice(0, wanted);
      return state.mode === "flashcard"
        ? makeFlashcardSession(selected)
        : selected;
    }
    function reviewCategory(q) {
      const value = String((q && q.category) || "").trim();
      return value || "Notions générales";
    }
    let reviewTopicsCache = [];
    function buildReviewTopics(errors = state.errors) {
      const grouped = new Map();
      for (const q of errors || []) {
        const bankFile = q.bankFile || "";
        const category = reviewCategory(q);
        const key = bankFile + "\u0000" + category;
        if (!grouped.has(key)) {
          grouped.set(key, {
            key: key,
            bankFile: bankFile,
            category: category,
            subject: q.subject || "Autres",
            chapter: q.chapter || q.bankTitle || "Chapitre",
            errorCount: 0,
          });
        }
        grouped.get(key).errorCount++;
      }
      return [...grouped.values()].sort(
        (a, b) =>
          b.errorCount - a.errorCount ||
          String(a.subject).localeCompare(String(b.subject), "fr") ||
          String(a.chapter).localeCompare(String(b.chapter), "fr") ||
          String(a.category).localeCompare(String(b.category), "fr"),
      );
    }
    function renderReviewRecommendations() {
      const panel = $("reviewRecommendations"),
        list = $("reviewTopicList"),
        allBtn = $("reviewAllTopics"),
        intro = $("reviewRecommendationsIntro");
      if (!panel || !list || !allBtn || !intro) return;
      reviewTopicsCache = buildReviewTopics();
      if (!reviewTopicsCache.length) {
        panel.classList.add("hidden");
        list.innerHTML = "";
        allBtn.disabled = true;
        return;
      }
      panel.classList.remove("hidden");
      allBtn.disabled =
        IS_LOCAL &&
        reviewTopicsCache.some((topic) => !cache.has(topic.bankFile));
      allBtn.textContent =
        "Réviser tout (" +
        reviewTopicsCache.length +
        " thème" +
        (reviewTopicsCache.length > 1 ? "s" : "") +
        ")";
      intro.textContent = allBtn.disabled
        ? "Recharge le dossier banques pour réviser les thèmes complets. Tu peux déjà revoir tes erreurs avec les questions sauvegardées."
        : "Ces thèmes correspondent aux catégories des questions ratées. Réviser un thème relance toutes les questions disponibles de cette catégorie.";
      list.innerHTML = reviewTopicsCache
        .map(
          (topic, index) =>
            '<article class="review-topic-card">' +
            '<div class="review-topic-copy">' +
            '<div class="review-topic-name">' +
            esc(topic.category) +
            "</div>" +
            '<div class="review-topic-meta">' +
            esc(topic.subject) +
            " • " +
            esc(topic.chapter) +
            "</div>" +
            '<span class="review-topic-errors">' +
            topic.errorCount +
            " erreur" +
            (topic.errorCount > 1 ? "s" : "") +
            "</span>" +
            "</div>" +
            '<button class="secondary" type="button" data-review-topic-index="' +
            index +
            '" ' +
            (IS_LOCAL && !cache.has(topic.bankFile) ? "disabled" : "") +
            ">Réviser ce thème</button>" +
            "</article>",
        )
        .join("");
    }
    async function sessionForReviewTopics(topics) {
      if (!Array.isArray(topics) || !topics.length)
        throw new Error("Aucun thème à réviser.");
      const byFile = new Map();
      for (const topic of topics) {
        if (!topic.bankFile) continue;
        if (!byFile.has(topic.bankFile)) byFile.set(topic.bankFile, new Set());
        byFile.get(topic.bankFile).add(topic.category);
      }
      const pool = [],
        seen = new Set();
      for (const [file, categories] of byFile) {
        const data = await loadBank(file);
        const meta = state.manifest.banks.find((b) => b.file === file) || {};
        for (const q of data.questions || []) {
          if (!categories.has(reviewCategory(q))) continue;
          if (state.mode === "flashcard" && !isFlashcardEligible(q)) continue;
          const unique = file + "\u0000" + q.id;
          if (seen.has(unique)) continue;
          seen.add(unique);
          pool.push({
            ...q,
            bankTitle: meta.title || data.title || file,
            subject: meta.subject || data.subject || "",
            chapter: meta.chapter || data.chapter || "",
            bankFile: file,
          });
        }
      }
      if (!pool.length)
        throw new Error("Aucune question disponible pour ce thème.");
      const shuffled = shuffle(pool);
      return state.mode === "flashcard"
        ? makeFlashcardSession(shuffled)
        : shuffled;
    }
    async function startReviewTopics(topics) {
      const buttons = [
        ...document.querySelectorAll("#reviewRecommendations button"),
      ];
      buttons.forEach((btn) => (btn.disabled = true));
      try {
        state.session = await sessionForReviewTopics(topics);
        state.index = 0;
        state.score = 0;
        state.errors = [];
        state.answered = false;
        state.reviewingErrors = false;
        state.flashOutcome = null;

        $("results").classList.add("hidden");
        $("quiz").classList.remove("hidden");
        enterQuizFocus();
        renderQuestion();
        saveProgress();
      } catch (e) {
        alert(e.message);
      } finally {
        buttons.forEach((btn) => (btn.disabled = false));
      }
    }

    function questionRef(q) {
      const ref = { file: q.bankFile, id: q.id };
      if (Array.isArray(q.flashProposal)) {
        ref.flashProposal = q.flashProposal;
        ref.flashTruth = !!q.flashTruth;
      }
      return ref;
    }
    function refsFromSession() {
      return state.session.map(questionRef);
    }
    async function rebuildSessionFromRefs(refs, mode = state.mode) {
      if (!Array.isArray(refs) || !refs.length) return [];
      const files = [...new Set(refs.map((r) => r.file))],
        lookups = new Map();
      if (
        files.some((file) => !state.manifest.banks.some((b) => b.file === file))
      )
        throw new Error(
          "Une banque sauvegardée ne figure plus dans le manifest.",
        );
      for (const file of files) {
        const data = await loadBank(file),
          meta = state.manifest.banks.find((b) => b.file === file) || {},
          m = new Map();
        data.questions.forEach((q) =>
          m.set(q.id, {
            ...q,
            bankTitle: meta.title || data.title || file,
            subject: meta.subject || data.subject || "",
            chapter: meta.chapter || data.chapter || "",
            bankFile: file,
          }),
        );
        lookups.set(file, m);
      }
      const rebuilt = refs.map((r) => {
        const q = lookups.get(r.file)?.get(r.id);
        if (!q) return null;
        if (mode !== "flashcard") return q;
        if (Array.isArray(r.flashProposal) && r.flashProposal.length) {
          const card = {
            ...q,
            flashProposal: r.flashProposal,
            flashTruth: r.flashTruth,
          };
          if (!validFlashSnapshot(card))
            throw new Error(
              "Une proposition Vrai/Faux sauvegardée n'est plus valide.",
            );
          return card;
        }
        return buildFlashcard(q, Math.random() >= 0.5);
      });
      if (rebuilt.some((q) => q === null))
        throw new Error(
          "Une ou plusieurs questions sauvegardées ne sont plus disponibles.",
        );
      return rebuilt;
    }

    function removeLegacyLocalSave() {
      if (!IS_LOCAL) return;
      try {
        const legacy = JSON.parse(
          localStorage.getItem(LEGACY_SAVE_KEY) || "null",
        );
        if (Array.isArray(legacy?.session))
          localStorage.removeItem(LEGACY_SAVE_KEY);
      } catch {}
    }
    function getSaved() {
      try {
        const s = JSON.parse(
          localStorage.getItem(SAVE_KEY) ||
            (IS_LOCAL ? localStorage.getItem(LEGACY_SAVE_KEY) : null) ||
            "null",
        );
        const items = IS_LOCAL ? s?.session : s?.refs,
          errors = (IS_LOCAL ? s?.errors : s?.errorRefs) || [];
        if (!validSavedProgress(s, items, errors)) return null;
        if (IS_LOCAL) {
          if (!items.every(validQuestion) || !errors.every(validQuestion))
            return null;
          if (
            s.mode === "flashcard" &&
            ![...items, ...errors].every(validFlashSnapshot)
          )
            return null;
        } else {
          const validRef = (r) =>
            r &&
            typeof r.file === "string" &&
            typeof r.id === "string" &&
            r.id.length > 0;
          if (![...items, ...errors].every(validRef)) return null;
        }
        return s;
      } catch {
        return null;
      }
    }
    function saveProgress() {
      if (!state.session.length) return true;
      const resumeIndex = state.answered ? state.index + 1 : state.index;
      const payload = {
        savedAt: new Date().toISOString(),
        mode: state.mode,
        ...(IS_LOCAL
          ? { session: state.session, errors: state.errors }
          : {
              refs: refsFromSession(),
              errorRefs: state.errors.map(questionRef),
            }),
        index: resumeIndex,
        score: state.score,
        shuffleAnswers: $("shuffleAnswers").checked,
        instantCorrection: $("instantCorrection").checked,
        reviewingErrors: state.reviewingErrors,
        flashExplanationsEnabled: state.flashExplanationsEnabled,
      };
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
        removeLegacyLocalSave();
      } catch (e) {
        console.warn("Sauvegarde locale indisponible.", e);
        return false;
      }
      refreshResumeCard();
      return true;
    }
    function clearProgress() {
      try {
        localStorage.removeItem(SAVE_KEY);
        removeLegacyLocalSave();
      } catch (e) {
        console.warn("Suppression de la sauvegarde locale impossible.", e);
      }
      refreshResumeCard();
    }
    function refreshResumeCard() {
      const s = getSaved();
      if (!s) {
        $("resumeCard").classList.add("hidden");
        return;
      }
      $("resumeCard").classList.remove("hidden");
      const total = (IS_LOCAL ? s.session : s.refs).length,
        pos = Math.min(s.index + 1, total);
      $("resumeText").textContent =
        `Question ${pos} sur ${total} • score ${s.score || 0} • sauvegarde disponible sur cet appareil.`;
    }

    function enterQuizFocus() {
      document.body.classList.add("quiz-active");
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
        const quiz = $("quiz");
        if (quiz) quiz.scrollTo({ top: 0, left: 0, behavior: "smooth" });
      });
    }
    function exitQuizFocus() {
      document.body.classList.remove("quiz-active");
    }
    function focusQuestionTop() {
      requestAnimationFrame(() => {
        const quiz = $("quiz");
        if (quiz) quiz.scrollTo({ top: 0, left: 0, behavior: "smooth" });
      });
    }
    function focusCorrection() {
      requestAnimationFrame(() => {
        const quiz = $("quiz"),
          feedback = $("feedback");
        if (!quiz || !feedback || feedback.classList.contains("hidden")) return;
        const qr = quiz.getBoundingClientRect(),
          fr = feedback.getBoundingClientRect();
        const stickyAllowance = 105;
        if (fr.bottom > qr.bottom - stickyAllowance || fr.top < qr.top + 12) {
          const delta = fr.bottom - (qr.bottom - stickyAllowance);
          quiz.scrollBy({ top: delta + 12, behavior: "smooth" });
        }
      });
    }

    function start() {
      if (state.mode === "flashcard") {
        openFlashExplanationPrompt();
        return;
      }
      startPreparedSession();
    }
    async function startPreparedSession() {
      $("startBtn").disabled = true;
      $("startBtn").textContent = "Préparation…";
      try {
        resetFlashPauseUI();
        state.session = await createSessionFromSelection();
        state.index = 0;
        state.score = 0;
        state.errors = [];
        state.answered = false;
        state.reviewingErrors = false;
        state.flashOutcome = null;
        $("setup").classList.add("hidden");
        $("resumeCard").classList.add("hidden");
        $("results").classList.add("hidden");
        $("quiz").classList.remove("hidden");
        syncFlashExplanationUI();
        enterQuizFocus();
        renderQuestion();
        saveProgress();
      } catch (e) {
        alert(e.message);
      } finally {
        $("startBtn").disabled = false;
        syncModeUI();
      }
    }
    function hideFlashcardExplanation() {
      flashExplanationShownAt = 0;
      const card = $("flashCard"),
        box = $("flashCardExplanation"),
        answerKey = $("flashCardAnswerKey"),
        countdown = $("flashExplanationCountdownWrap"),
        fill = $("flashExplanationCountdownFill");
      card?.classList.remove("explanation-visible");
      box?.classList.add("hidden");
      box?.classList.remove("is-error");
      answerKey?.classList.add("hidden");
      countdown?.classList.remove("hidden");
      if (fill) {
        fill.style.transition = "none";
        fill.style.strokeDashoffset = "0";
      }
    }
    function resetFlashCardVisual() {
      const card = $("flashCard"),
        result = $("flashResultIcon"),
        stage = $("swipeStage");
      if (!card) return;
      hideFlashcardExplanation();
      stopFlashDragPhysics();
      flashTargetX =
        flashTargetY =
        flashRenderX =
        flashRenderY =
        flashRenderVX =
        flashRenderVY =
        flashLift =
          0;
      card.getAnimations?.().forEach((a) => a.cancel());
      card.classList.remove("dragging", "entering", "returning");
      card.style.transform = "";
      card.style.opacity = "";
      card.style.pointerEvents = "";
      card.style.borderColor = "";
      $("flashFalseStamp").style.opacity = "0";
      $("flashTrueStamp").style.opacity = "0";
      resetFlashDeck();
      if (stage) stage.classList.remove("impact-success", "impact-failure");
      if (result) {
        result.className = "flash-result-icon";
        result.textContent = "";
      }
    }
    function animateFlashCardIn() {
      const card = $("flashCard");
      if (!card) return;
      card.classList.remove("entering");
      void card.offsetWidth;
      card.classList.add("entering");
    }
    function renderFlashcardQuestion(q) {
      clearFlashAdvance();
      $("qText").classList.add("hidden");
      $("normalAnswerArea").classList.add("hidden");
      $("flashArea").classList.remove("hidden");
      $("validateBtn").classList.add("hidden");
      $("nextBtn").classList.add("hidden");
      const proposal = flashProposalText(q),
        proposalEl = $("flashStatement"),
        card = $("flashCard");
      const prompt = String(q.prompt || "");
      $("flashQuestion").textContent = prompt;
      proposalEl.textContent = proposal;
      proposalEl.classList.toggle("medium", proposal.length > 95);
      proposalEl.classList.toggle("long", proposal.length > 155);
      const combinedLength = prompt.length + proposal.length;
      card.classList.toggle(
        "dense-content",
        combinedLength > 210 && combinedLength <= 310,
      );
      card.classList.toggle("very-dense-content", combinedLength > 310);
      $("flashFalseBtn").disabled = false;
      $("flashTrueBtn").disabled = false;
      resetFlashCardVisual();
      animateFlashCardIn();
      saveProgress();
      focusQuestionTop();
      if (window.matchMedia && window.matchMedia("(min-width:761px)").matches)
        requestAnimationFrame(() => $("flashCard")?.focus());
    }
    function renderLiveQuizStats() {
      const total = state.session.length;
      const current = Math.min(total, state.index + 1);
      const answered = Math.min(total, state.index + (state.answered ? 1 : 0));
      const remaining = Math.max(0, total - answered);
      $("counter").textContent = total
        ? "Question " + current + " / " + total
        : "";
      $("scoreLive").textContent =
        answered > 0
          ? "Score : " + state.score + " / " + answered
          : "Score : " + state.score;
      $("remainingLive").textContent =
        remaining + " restante" + (remaining > 1 ? "s" : "");
      const progress = $("progressBar"),
        progressRoot = progress?.parentElement;
      if (progress && total) {
        const pct = (answered / total) * 100;
        progress.style.width = pct + "%";
        progressRoot?.setAttribute("aria-valuenow", String(Math.round(pct)));
      }
    }
    function renderQuestion() {
      const q = state.session[state.index];
      if (!q) {
        finish();
        return;
      }
      state.answered = false;
      state.flashOutcome = null;
      document.body.classList.toggle("reviewing-errors", state.reviewingErrors);
      syncFlashExplanationUI();
      renderLiveQuizStats();
      $("qMeta").textContent = [q.subject, difficultyLabel(q.difficulty)]
        .filter(Boolean)
        .join(" • ");
      $("feedback").classList.add("hidden");
      $("feedback").innerHTML = "";
      $("nextBtn").classList.add("hidden");
      if (state.mode === "flashcard") {
        renderFlashcardQuestion(q);
        return;
      }
      $("qText").classList.remove("hidden");
      $("normalAnswerArea").classList.remove("hidden");
      $("flashArea").classList.add("hidden");
      $("qText").textContent = q.prompt;
      $("validateBtn").classList.remove("hidden");
      let cs = q.choices.map((c) => ({ ...c }));
      if ($("shuffleAnswers").checked) cs = shuffle(cs);
      const multiple =
        q.type === "multiple" || q.choices.filter((c) => c.correct).length > 1;
      $("choices").innerHTML =
        (multiple
          ? '<p class="muted">Plusieurs réponses sont attendues.</p>'
          : "") +
        cs
          .map(
            (c) =>
              '<label class="choice"><input name="ans" type="' +
              (multiple ? "checkbox" : "radio") +
              '" data-correct="' +
              (c.correct ? "1" : "0") +
              '"> <span>' +
              esc(c.text) +
              "</span></label>",
          )
          .join("");
      const syncChoiceVisuals = () => {
        $("choices")
          .querySelectorAll(".choice")
          .forEach((row) => {
            const input = row.querySelector('input[name="ans"]');
            row.classList.toggle("selected", !!input?.checked);
          });
      };
      $("choices")
        .querySelectorAll('input[name="ans"]')
        .forEach((input) =>
          input.addEventListener("change", syncChoiceVisuals),
        );
      syncChoiceVisuals();
      saveProgress();
      focusQuestionTop();
      if (window.matchMedia && window.matchMedia("(min-width:761px)").matches) {
        const first = $("choices").querySelector('input[name="ans"]');
        if (first) requestAnimationFrame(() => first.focus());
      }
    }

    function answerInputs() {
      return [...$("choices").querySelectorAll('input[name="ans"]')];
    }
    function focusAnswerByOffset(delta) {
      const inputs = answerInputs().filter((i) => !i.disabled);
      if (!inputs.length) return;
      let i = inputs.indexOf(document.activeElement);
      i = i < 0 ? 0 : (i + delta + inputs.length) % inputs.length;
      inputs[i].focus();
    }
    function quizShortcutAllowed(e) {
      const target = e.target;
      if (!(target instanceof Element)) return true;
      if (target.matches('input[name="ans"]')) return true;
      if (target.closest("#flashCard")) return true;
      if (
        state.mode === "flashcard" &&
        state.answered &&
        target.closest("#flashSelfControls")
      )
        return true;
      return !target.closest(
        'button,a[href],input,select,textarea,[contenteditable="true"]',
      );
    }
    function handleQuizKeyboard(e) {
      if ($("quiz").classList.contains("hidden") || !quizShortcutAllowed(e))
        return;
      if (state.mode === "flashcard") {
        if (e.code === "Space" || e.key === " ") {
          e.preventDefault();
          pause();
          return;
        }
        if (flashPaused) return;
        if (
          !state.answered &&
          (e.key === "ArrowLeft" || e.key === "ArrowRight")
        ) {
          e.preventDefault();
          answerFlashcard(e.key === "ArrowRight");
          return;
        }
        if (e.key === "Enter" && state.answered) {
          e.preventDefault();
          clearFlashAdvance();
          next();
          return;
        }
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        focusAnswerByOffset(1);
        return;
      }
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        focusAnswerByOffset(-1);
        return;
      }
      if (e.code === "Space" || e.key === " ") {
        const focused = answerInputs().find(
          (i) => i === document.activeElement,
        );
        if (focused && !focused.disabled) {
          e.preventDefault();
          if (focused.type === "radio") focused.checked = true;
          else focused.checked = !focused.checked;
          focused.dispatchEvent(new Event("change", { bubbles: true }));
        }
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (!state.answered) validate();
        else if (!$("nextBtn").classList.contains("hidden")) next();
      }
    }

    let flashDragActive = false,
      flashPointerId = null,
      flashStartX = 0,
      flashStartY = 0,
      flashDx = 0,
      flashDy = 0,
      flashLastX = 0,
      flashLastY = 0,
      flashLastT = 0,
      flashVelocityX = 0,
      flashVelocityY = 0,
      flashRotationSign = 1,
      flashAxis = null,
      flashAdvanceTimer = null,
      flashExplanationCountdownInterval = null,
      flashExplanationShownAt = 0;
    let flashTargetX = 0,
      flashTargetY = 0,
      flashRenderX = 0,
      flashRenderY = 0,
      flashRenderVX = 0,
      flashRenderVY = 0,
      flashDragRaf = null,
      flashLift = 0;
    let flashPaused = false,
      flashAdvanceEndAt = 0,
      flashAdvanceRemainingMs = null,
      flashExplanationEndAt = 0,
      flashExplanationRemainingMs = null;
    function clearFlashAdvance() {
      if (flashAdvanceTimer) {
        clearTimeout(flashAdvanceTimer);
        flashAdvanceTimer = null;
      }
      if (flashExplanationCountdownInterval) {
        clearInterval(flashExplanationCountdownInterval);
        flashExplanationCountdownInterval = null;
      }
      flashAdvanceEndAt = 0;
      flashExplanationEndAt = 0;
      flashAdvanceRemainingMs = null;
      flashExplanationRemainingMs = null;
    }
    function scheduleFlashAdvance(delay = 850) {
      clearFlashAdvance();
      const ms = Math.max(0, delay),
        answeredIndex = state.index;
      flashAdvanceRemainingMs = ms;
      flashAdvanceEndAt = performance.now() + ms;
      flashAdvanceTimer = setTimeout(() => {
        flashAdvanceTimer = null;
        flashAdvanceEndAt = 0;
        flashAdvanceRemainingMs = null;
        if (
          state.mode !== "flashcard" ||
          !state.answered ||
          state.index !== answeredIndex ||
          flashPaused
        )
          return;
        next();
      }, ms);
    }
    function startFlashExplanationCountdown(
      duration = FLASH_EXPLANATION_DELAY_MS,
    ) {
      const count = $("flashExplanationCountdown"),
        fill = $("flashExplanationCountdownFill");
      if (!count || !fill) return;
      const ms = Math.max(0, duration),
        answeredIndex = state.index;
      clearFlashAdvance();
      flashExplanationRemainingMs = ms;
      flashAdvanceRemainingMs = ms;
      flashExplanationEndAt = performance.now() + ms;
      flashAdvanceEndAt = flashExplanationEndAt;
      const startOffset = Math.max(
        0,
        Math.min(100, 100 * (1 - ms / FLASH_EXPLANATION_DELAY_MS)),
      );
      const tick = () => {
        count.textContent = String(
          Math.max(
            0,
            Math.ceil((flashExplanationEndAt - performance.now()) / 1000),
          ),
        );
      };
      tick();
      fill.style.transition = "none";
      fill.style.strokeDashoffset = String(startOffset);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          fill.style.transition = "stroke-dashoffset " + ms + "ms linear";
          fill.style.strokeDashoffset = "100";
        }),
      );
      flashExplanationCountdownInterval = setInterval(tick, 200);
      flashAdvanceTimer = setTimeout(() => {
        flashAdvanceTimer = null;
        flashAdvanceEndAt = 0;
        flashAdvanceRemainingMs = null;
        flashExplanationEndAt = 0;
        flashExplanationRemainingMs = null;
        if (flashExplanationCountdownInterval) {
          clearInterval(flashExplanationCountdownInterval);
          flashExplanationCountdownInterval = null;
        }
        if (
          state.mode !== "flashcard" ||
          !state.answered ||
          state.index !== answeredIndex ||
          flashPaused
        )
          return;
        next();
      }, ms);
    }
    function pauseFlashAutoAdvance() {
      const now = performance.now(),
        fill = $("flashExplanationCountdownFill"),
        count = $("flashExplanationCountdown");
      if (flashAdvanceTimer) {
        flashAdvanceRemainingMs = Math.max(0, flashAdvanceEndAt - now);
        clearTimeout(flashAdvanceTimer);
        flashAdvanceTimer = null;
      }
      if (flashExplanationCountdownInterval) {
        clearInterval(flashExplanationCountdownInterval);
        flashExplanationCountdownInterval = null;
      }
      if (flashExplanationEndAt) {
        flashExplanationRemainingMs = Math.max(0, flashExplanationEndAt - now);
        if (fill) {
          const offset =
            parseFloat(getComputedStyle(fill).strokeDashoffset) || 0;
          fill.style.transition = "none";
          fill.style.strokeDashoffset = String(offset);
        }
        if (count)
          count.textContent = String(
            Math.max(0, Math.ceil(flashExplanationRemainingMs / 1000)),
          );
      }
      flashAdvanceEndAt = 0;
      flashExplanationEndAt = 0;
    }
    function resumeFlashAutoAdvance() {
      if (!state.answered) return;
      const explanation = $("flashCardExplanation"),
        countdown = $("flashExplanationCountdownWrap");
      if (
        explanation &&
        !explanation.classList.contains("hidden") &&
        countdown &&
        !countdown.classList.contains("hidden") &&
        flashExplanationRemainingMs !== null
      ) {
        const ms = flashExplanationRemainingMs;
        flashExplanationRemainingMs = null;
        startFlashExplanationCountdown(ms);
        return;
      }
      if (flashAdvanceRemainingMs !== null) {
        const ms = flashAdvanceRemainingMs;
        flashAdvanceRemainingMs = null;
        scheduleFlashAdvance(ms);
      }
    }
    function showFlashcardExplanation(q, { ok = true, autoAdvance = ok } = {}) {
      clearFlashAdvance();
      const card = $("flashCard"),
        box = $("flashCardExplanation"),
        title = $("flashCardExplanationTitle"),
        answerKey = $("flashCardAnswerKey"),
        text = $("flashCardExplanationText"),
        countdown = $("flashExplanationCountdownWrap"),
        count = $("flashExplanationCountdown"),
        fill = $("flashExplanationCountdownFill"),
        label = $("flashExplanationCountdownLabel");
      if (
        !card ||
        !box ||
        !title ||
        !answerKey ||
        !text ||
        !countdown ||
        !count ||
        !fill
      )
        return;
      stopFlashDragPhysics();
      card.classList.remove("dragging", "returning");
      card.style.transform = "";
      card.style.borderColor = "";
      $("flashTrueStamp").style.opacity = "0";
      $("flashFalseStamp").style.opacity = "0";
      resetFlashDeck();
      card.classList.add("explanation-visible");
      card.style.pointerEvents = "auto";
      box.classList.remove("hidden");
      flashExplanationShownAt = performance.now();
      box.classList.toggle("is-error", !ok);
      title.textContent = ok ? "✓ Explication" : "✕ Réponse incorrecte";
      if (ok) {
        answerKey.classList.add("hidden");
        answerKey.textContent = "";
      } else {
        answerKey.classList.remove("hidden");
        answerKey.textContent =
          "La réponse proposée était " + (q.flashTruth ? "vraie." : "fausse.");
      }
      text.textContent = q.explanation || "Aucune explication disponible.";
      $("feedback").classList.add("hidden");
      $("feedback").innerHTML = "";
      if (autoAdvance) {
        countdown.classList.remove("hidden");
        $("nextBtn").classList.add("hidden");
        label.textContent =
          state.index === state.session.length - 1
            ? "Résultats dans"
            : "Prochaine carte dans";
        startFlashExplanationCountdown(FLASH_EXPLANATION_DELAY_MS);
      } else {
        countdown.classList.add("hidden");
        $("nextBtn").classList.remove("hidden");
        $("nextBtn").textContent =
          state.index === state.session.length - 1
            ? "Voir les résultats"
            : state.reviewingErrors
              ? "Erreur suivante"
              : "Question suivante";
      }
      saveProgress();
    }
    function resetFlashDeck() {
      const stage = $("swipeStage");
      if (!stage) return;
      stage.style.removeProperty("--deck-back-y");
      stage.style.removeProperty("--deck-back-scale");
      stage.style.removeProperty("--deck-back-opacity");
      stage.style.removeProperty("--deck-front-y");
      stage.style.removeProperty("--deck-front-scale");
      stage.style.removeProperty("--deck-front-opacity");
    }
    function liftFlashDeck(ratio) {
      const stage = $("swipeStage");
      if (!stage) return;
      const p = Math.max(0, Math.min(1, ratio));
      stage.style.setProperty("--deck-front-y", (7 - p * 6).toFixed(2) + "px");
      stage.style.setProperty(
        "--deck-front-scale",
        (0.98 + p * 0.018).toFixed(4),
      );
      stage.style.setProperty(
        "--deck-front-opacity",
        (0.78 + p * 0.16).toFixed(3),
      );
      stage.style.setProperty("--deck-back-y", (13 - p * 4).toFixed(2) + "px");
      stage.style.setProperty(
        "--deck-back-scale",
        (0.96 + p * 0.01).toFixed(4),
      );
      stage.style.setProperty(
        "--deck-back-opacity",
        (0.55 + p * 0.08).toFixed(3),
      );
    }
    function flashTransform(
      dx,
      dy = 0,
      rotationSign = flashRotationSign,
      lift = 0,
    ) {
      const rot = Math.max(-18, Math.min(18, dx * 0.052 * rotationSign));
      const y = dy * 0.48 - lift * 7;
      const scale = 1 + lift * 0.014;
      return (
        "translate3d(" +
        dx +
        "px," +
        y +
        "px,0) rotate(" +
        rot +
        "deg) scale(" +
        scale +
        ")"
      );
    }
    function stopFlashDragPhysics() {
      if (flashDragRaf !== null) {
        cancelAnimationFrame(flashDragRaf);
        flashDragRaf = null;
      }
    }
    function renderFlashDragFrame() {
      flashDragRaf = null;
      if (!flashDragActive || flashAxis === "y") return;
      const card = $("flashCard");
      if (!card) return;

      // Ressort amorti : la carte vise le pointeur avec un très léger retard,
      // puis conserve un peu de mouvement quand la main change brusquement de direction.
      const stiffness = 0.24,
        damping = 0.68;
      flashRenderVX =
        (flashRenderVX + (flashTargetX - flashRenderX) * stiffness) * damping;
      flashRenderVY =
        (flashRenderVY + (flashTargetY - flashRenderY) * stiffness) * damping;
      flashRenderX += flashRenderVX;
      flashRenderY += flashRenderVY;
      flashLift += (1 - flashLift) * 0.32;

      const width = Math.max(1, card.offsetWidth);
      const ratio = Math.min(1, Math.abs(flashRenderX) / (width * 0.34));
      card.style.transform = flashTransform(
        flashRenderX,
        flashRenderY,
        flashRotationSign,
        flashLift,
      );
      card.style.borderColor =
        flashRenderX > 10
          ? "var(--ok)"
          : flashRenderX < -10
            ? "var(--bad)"
            : "";
      $("flashTrueStamp").style.opacity =
        flashRenderX > 0 ? String(ratio) : "0";
      $("flashFalseStamp").style.opacity =
        flashRenderX < 0 ? String(ratio) : "0";
      liftFlashDeck(Math.max(0.1, ratio));

      const unsettled =
        Math.abs(flashTargetX - flashRenderX) > 0.15 ||
        Math.abs(flashTargetY - flashRenderY) > 0.15 ||
        Math.abs(flashRenderVX) > 0.08 ||
        Math.abs(flashRenderVY) > 0.08 ||
        flashLift < 0.995;
      if (
        flashDragActive &&
        (unsettled || flashAxis === "x" || flashAxis === null)
      )
        flashDragRaf = requestAnimationFrame(renderFlashDragFrame);
    }
    function ensureFlashDragPhysics() {
      if (flashDragRaf === null)
        flashDragRaf = requestAnimationFrame(renderFlashDragFrame);
    }
    function paintFlashDrag(dx, dy = flashDy) {
      flashTargetX = dx;
      flashTargetY = dy;
      ensureFlashDragPhysics();
    }
    function animateFlashReturn() {
      const card = $("flashCard");
      if (!card) return;
      const reduce =
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      stopFlashDragPhysics();
      const from =
        card.style.transform ||
        flashTransform(
          flashRenderX,
          flashRenderY,
          flashRotationSign,
          flashLift,
        );
      card.classList.add("returning");
      const anim = card.animate(
        reduce
          ? [
              { transform: from },
              { transform: "translate3d(0,0,0) rotate(0deg)" },
            ]
          : [
              { transform: from, offset: 0 },
              {
                transform:
                  "translate3d(" +
                  -flashDx * 0.07 +
                  "px,0,0) rotate(" +
                  -flashDx * 0.003 +
                  "deg)",
                offset: 0.72,
              },
              { transform: "translate3d(0,0,0) rotate(0deg)", offset: 1 },
            ],
        { duration: reduce ? 120 : 330, easing: "cubic-bezier(.18,.9,.24,1)" },
      );
      anim.onfinish = () => {
        if (!state.answered) {
          card.style.transform = "";
          card.style.borderColor = "";
          card.classList.remove("returning");
          $("flashTrueStamp").style.opacity = "0";
          $("flashFalseStamp").style.opacity = "0";
          resetFlashDeck();
        }
      };
    }
    function animateFlashAway(userTruth, meta = {}) {
      const card = $("flashCard");
      if (!card || !card.animate) return 0;
      const dir = userTruth ? 1 : -1;
      const reduce =
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const dx = Number.isFinite(meta.dx) ? meta.dx : dir * 18,
        dy = Number.isFinite(meta.dy) ? meta.dy : -8;
      const vx = Number.isFinite(meta.vx) ? meta.vx : dir * 0.95,
        vy = Number.isFinite(meta.vy) ? meta.vy : -0.08;
      const rotationSign = Number.isFinite(meta.rotationSign)
        ? meta.rotationSign
        : 1;
      const speed = Math.max(0.35, Math.min(2.4, Math.abs(vx)));
      const width = Math.max(window.innerWidth || 900, card.offsetWidth * 1.8);
      const finalX = dir * (width + card.offsetWidth * 0.75);
      const finalY = Math.max(-210, Math.min(210, dy + vy * 190 - 20));
      const startRot = Math.max(-17, Math.min(17, dx * 0.05 * rotationSign));
      const midX = dx + dir * (85 + speed * 45);
      const midY = dy + vy * 45;
      const midRot = startRot + dir * rotationSign * (7 + speed * 3);
      const finalRot = startRot + dir * rotationSign * (30 + speed * 8);
      const duration = reduce
        ? 160
        : Math.round(Math.max(280, Math.min(470, 455 - speed * 72)));
      const startTransform =
        card.style.transform || flashTransform(dx, dy, rotationSign);
      const anim = card.animate(
        [
          { transform: startTransform, opacity: 1, offset: 0 },
          {
            transform:
              "translate3d(" +
              midX +
              "px," +
              midY +
              "px,0) rotate(" +
              midRot +
              "deg) scale(1.012)",
            opacity: 1,
            offset: 0.28,
          },
          {
            transform:
              "translate3d(" +
              finalX +
              "px," +
              finalY +
              "px,0) rotate(" +
              finalRot +
              "deg) scale(.94)",
            opacity: 0.04,
            offset: 1,
          },
        ],
        { duration, easing: "cubic-bezier(.12,.78,.18,1)", fill: "forwards" },
      );
      anim.onfinish = () => resetFlashDeck();
      return duration;
    }
    function answerFlashcard(userTruth, throwMeta = null) {
      if (state.mode !== "flashcard" || state.answered || flashPaused) return;
      const q = state.session[state.index];
      const ok = userTruth === q.flashTruth;
      const keepCardForExplanation =
        state.flashExplanationsEnabled || state.reviewingErrors;
      state.answered = true;
      state.flashOutcome = { ok };
      if (ok) state.score++;
      else state.errors.push(q);
      $("flashFalseBtn").disabled = true;
      $("flashTrueBtn").disabled = true;
      $("flashCard").style.pointerEvents = "none";
      const throwDuration = !keepCardForExplanation
        ? animateFlashAway(!!userTruth, throwMeta || {})
        : 0;
      const result = $("flashResultIcon"),
        stage = $("swipeStage");
      if (stage) {
        stage.classList.remove("impact-success", "impact-failure");
        void stage.offsetWidth;
        stage.classList.add(ok ? "impact-success" : "impact-failure");
      }
      if (result) {
        result.textContent = ok ? "✓" : "✕";
        result.className = "flash-result-icon " + (ok ? "success" : "failure");
        void result.offsetWidth;
        result.classList.add("show");
      }
      const flashLive = $("flashLiveResult");
      if (flashLive) {
        flashLive.textContent = "";
        requestAnimationFrame(() => {
          flashLive.textContent = ok ? "Bonne réponse." : "Réponse incorrecte.";
        });
      }
      renderLiveQuizStats();
      $("validateBtn").classList.add("hidden");
      if (state.reviewingErrors) {
        showFlashcardExplanation(q, { ok, autoAdvance: false });
      } else if (state.flashExplanationsEnabled) {
        showFlashcardExplanation(q, { ok, autoAdvance: ok });
      } else {
        hideFlashcardExplanation();
        $("feedback").classList.add("hidden");
        $("feedback").innerHTML = "";
        $("nextBtn").classList.add("hidden");
        saveProgress();
        scheduleFlashAdvance(Math.max(560, throwDuration + 150));
      }
    }
    function initFlashSwipe() {
      const card = $("flashCard");
      if (!card) return;
      card.addEventListener("pointerdown", (e) => {
        if (state.mode !== "flashcard" || state.answered || flashPaused) return;
        const rect = card.getBoundingClientRect();
        stopFlashDragPhysics();
        flashDragActive = true;
        flashPointerId = e.pointerId;
        flashStartX = e.clientX;
        flashStartY = e.clientY;
        flashDx = 0;
        flashDy = 0;
        flashLastX = e.clientX;
        flashLastY = e.clientY;
        flashLastT = performance.now();
        flashVelocityX = 0;
        flashVelocityY = 0;
        flashAxis = null;
        flashTargetX = 0;
        flashTargetY = 0;
        flashRenderX = 0;
        flashRenderY = 0;
        flashRenderVX = 0;
        flashRenderVY = 0;
        flashLift = 0.42;
        flashRotationSign =
          (e.clientY - rect.top) / Math.max(1, rect.height) < 0.5 ? 1 : -1;
        card.getAnimations?.().forEach((a) => a.cancel());
        card.classList.remove("entering", "returning");
        card.classList.add("dragging");
        card.style.transform = flashTransform(
          0,
          0,
          flashRotationSign,
          flashLift,
        );
        liftFlashDeck(0.1);
        ensureFlashDragPhysics();
        try {
          card.setPointerCapture(e.pointerId);
        } catch {}
      });
      card.addEventListener("pointermove", (e) => {
        if (!flashDragActive || e.pointerId !== flashPointerId) return;
        flashDx = e.clientX - flashStartX;
        flashDy = e.clientY - flashStartY;

        if (!flashAxis) {
          if (
            Math.abs(flashDx) > 6 &&
            Math.abs(flashDx) > Math.abs(flashDy) * 1.05
          )
            flashAxis = "x";
          else if (
            Math.abs(flashDy) > 12 &&
            Math.abs(flashDy) > Math.abs(flashDx) * 1.25
          )
            flashAxis = "y";
        }

        const now = performance.now(),
          dt = Math.max(8, now - flashLastT);
        const instVx = (e.clientX - flashLastX) / dt,
          instVy = (e.clientY - flashLastY) / dt;
        flashVelocityX = flashVelocityX * 0.52 + instVx * 0.48;
        flashVelocityY = flashVelocityY * 0.52 + instVy * 0.48;
        flashLastX = e.clientX;
        flashLastY = e.clientY;
        flashLastT = now;

        if (flashAxis === "y") {
          flashDragActive = false;
          card.classList.remove("dragging");
          flashTargetX = flashRenderX;
          flashTargetY = flashRenderY;
          animateFlashReturn();
          try {
            card.releasePointerCapture(e.pointerId);
          } catch {}
          flashPointerId = null;
          flashAxis = null;
          return;
        }

        // Avant même que l'axe soit définitivement choisi, la carte accompagne légèrement
        // la main. Dès qu'un swipe horizontal est reconnu, elle suit le geste presque 1:1.
        if (flashAxis === "x") {
          e.preventDefault();
          paintFlashDrag(flashDx, flashDy);
        } else {
          paintFlashDrag(flashDx * 0.42, flashDy * 0.18);
        }
      });
      const end = (e) => {
        if (
          !flashDragActive ||
          (e && e.pointerId !== undefined && e.pointerId !== flashPointerId)
        )
          return;
        flashDragActive = false;
        card.classList.remove("dragging");
        stopFlashDragPhysics();

        const threshold = Math.min(118, Math.max(68, card.offsetWidth * 0.19));
        const velocityThrow =
          Math.abs(flashVelocityX) > 0.48 && Math.abs(flashDx) > 22;
        const horizontalIntent =
          flashAxis === "x" || Math.abs(flashDx) > Math.abs(flashDy) * 1.05;

        if (
          horizontalIntent &&
          (Math.abs(flashDx) >= threshold || velocityThrow)
        ) {
          const direction =
            (Math.abs(flashVelocityX) > 0.7
              ? Math.sign(flashVelocityX)
              : Math.sign(flashDx)) || 1;
          const meta = {
            dx: flashRenderX,
            dy: flashRenderY,
            vx: flashVelocityX,
            vy: flashVelocityY,
            rotationSign: flashRotationSign,
          };
          answerFlashcard(direction > 0, meta);
        } else {
          animateFlashReturn();
        }

        flashPointerId = null;
        flashDx = 0;
        flashDy = 0;
        flashAxis = null;
      };
      card.addEventListener("pointerup", end);
      card.addEventListener("pointercancel", end);
      card.addEventListener("click", () => {
        if (state.mode !== "flashcard" || !state.answered || flashPaused)
          return;
        const explanation = $("flashCardExplanation");
        if (!explanation || explanation.classList.contains("hidden")) return;
        if (performance.now() - flashExplanationShownAt < 300) return;
        clearFlashAdvance();
        next();
      });
    }

    function finalizeAnswer() {
      if (state.answered) return;

      const ins = [...$("choices").querySelectorAll('input[name="ans"]')];

      const ok = ins.every(
        (i) =>
          (i.checked && i.dataset.correct === "1") ||
          (!i.checked && i.dataset.correct === "0"),
      );
      state.answered = true;
      if (ok) state.score++;
      else state.errors.push(state.session[state.index]);

      ins.forEach((i) => {
        i.disabled = true;
        const row = i.closest(".choice");
        const selected = i.checked;
        const correct = i.dataset.correct === "1";
        row.classList.remove("answer-correct", "answer-wrong", "answer-missed");
        if (selected && correct) row.classList.add("answer-correct");
        else if (selected && !correct) row.classList.add("answer-wrong");
        else if (!selected && correct) row.classList.add("answer-missed");
      });

      renderLiveQuizStats();
      const q = state.session[state.index];
      $("feedback").classList.remove("hidden");

      const status = `<div class="${ok ? "ok" : "bad"}">${ok ? "Bonne réponse." : "Réponse incorrecte."}</div>`;

      $("feedback").innerHTML =
        status +
        ($("instantCorrection").checked ||
        state.index === state.session.length - 1
          ? `<div style="margin-top:7px">${esc(q.explanation || "")}</div>`
          : "");

      $("validateBtn").classList.add("hidden");
      $("nextBtn").classList.remove("hidden");
      $("nextBtn").textContent =
        state.index === state.session.length - 1
          ? "Voir les résultats"
          : "Question suivante";
      saveProgress();
      focusCorrection();
    }

    function validate() {
      if (state.answered) return;
      const ins = [...$("choices").querySelectorAll('input[name="ans"]')];
      if (!ins.some((i) => i.checked)) {
        $("feedback").classList.remove("hidden");
        $("feedback").innerHTML =
          '<span class="warn">Sélectionne au moins une réponse.</span>';
        focusCorrection();
        return;
      }
      finalizeAnswer();
    }

    function next() {
      if (!state.answered) return;
      if (state.index < state.session.length - 1) {
        state.index++;
        renderQuestion();
      } else finish();
    }

    function animateScoreDonut(percent) {
      const pct = Math.max(0, Math.min(100, Number(percent) || 0));
      const ring = $("scoreDonutProgress");
      const label = $("scoreDonutPercent");
      const donut = $("scoreDonut");
      if (!ring || !label || !donut) return;

      ring.style.transition = "none";
      ring.style.strokeDashoffset = "100";
      ring.style.stroke =
        pct >= 80 ? "var(--ok)" : pct < 50 ? "var(--bad)" : "var(--accent)";
      label.textContent = "0%";
      donut.setAttribute("aria-label", `Score : ${pct} %`);

      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          ring.style.transition =
            "stroke-dashoffset 1s cubic-bezier(.18,.8,.22,1),stroke .2s ease";
          ring.style.strokeDashoffset = String(100 - pct);
        }),
      );

      const duration = 900,
        start = performance.now();
      const tick = (now) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        label.textContent = `${Math.round(pct * eased)}%`;
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }

    function finish() {
      clearFlashAdvance();
      resetFlashPauseUI();
      document.body.classList.remove("reviewing-errors");
      exitQuizFocus();
      $("quiz").classList.add("hidden");
      $("results").classList.remove("hidden");
      const total = state.session.length,
        pct = Math.round((100 * state.score) / total);
      $("finalScore").textContent = `${state.score} / ${total} — ${pct} %`;
      animateScoreDonut(pct);
      $("summary").textContent = state.errors.length
        ? `${state.errors.length} question(s) à revoir.`
        : "Aucune erreur sur cette série.";
      $("retryErrors").disabled = !state.errors.length;
      renderReviewRecommendations();
      clearProgress();
    }
    async function resumeSaved() {
      const s = getSaved();
      if (!s) return;
      $("resumeBtn").disabled = true;
      $("resumeBtn").textContent = "Chargement…";
      try {
        const mode = s.mode === "flashcard" ? "flashcard" : "qcm";
        const session = IS_LOCAL
          ? s.session
          : await rebuildSessionFromRefs(s.refs, mode);
        const errors = IS_LOCAL
          ? s.errors || []
          : await rebuildSessionFromRefs(s.errorRefs || [], mode);
        // Commit the restored state only once every question has loaded successfully.
        clearFlashAdvance();
        resetFlashPauseUI();
        Object.assign(state, {
          mode,
          session,
          errors,
          index: s.index,
          score: s.score,
          answered: false,
          reviewingErrors: !!s.reviewingErrors,
          flashExplanationsEnabled: !!s.flashExplanationsEnabled,
          flashOutcome: null,
        });
        syncModeUI();
        syncFlashExplanationUI();
        $("shuffleAnswers").checked = s.shuffleAnswers !== false;
        $("instantCorrection").checked = s.instantCorrection !== false;
        $("setup").classList.add("hidden");
        $("resumeCard").classList.add("hidden");
        $("results").classList.add("hidden");
        if (state.index === state.session.length) {
          finish();
          return;
        }
        $("quiz").classList.remove("hidden");
        enterQuizFocus();
        renderQuestion();
      } catch (e) {
        alert(
          "Reprise impossible : " +
            e.message +
            " La sauvegarde est conservée ; réessaie ou abandonne cette progression.",
        );
      } finally {
        $("resumeBtn").disabled = false;
        $("resumeBtn").textContent = "Reprendre";
      }
    }
    function resetFlashPauseUI() {
      flashPaused = false;
      document.body.classList.remove("flash-paused");
      const overlay = $("flashPauseOverlay");
      if (overlay) {
        overlay.classList.add("hidden");
        overlay.setAttribute("aria-hidden", "true");
      }
      $("pauseBtn").textContent = "Mettre en pause";
      $("pauseBtn").setAttribute("aria-pressed", "false");
      $("nextBtn").disabled = false;
    }
    function setFlashPaused(paused) {
      if (state.mode !== "flashcard") return;
      if (paused === flashPaused) return;
      if (paused) {
        flashPaused = true;
        document.body.classList.add("flash-paused");
        pauseFlashAutoAdvance();
        stopFlashDragPhysics();
        flashDragActive = false;
        flashPointerId = null;
        flashAxis = null;
        const card = $("flashCard"),
          stage = $("swipeStage"),
          result = $("flashResultIcon");
        if (card) {
          card.classList.remove("dragging");
          card.style.transform = "";
        }
        [card, stage, result]
          .filter(Boolean)
          .flatMap((el) => el.getAnimations?.() || [])
          .forEach((anim) => anim.pause());
        $("flashFalseBtn").disabled = true;
        $("flashTrueBtn").disabled = true;
        $("nextBtn").disabled = true;
        const overlay = $("flashPauseOverlay");
        if (overlay) {
          overlay.classList.remove("hidden");
          overlay.setAttribute("aria-hidden", "false");
        }
        $("pauseBtn").textContent = "Reprendre";
        $("pauseBtn").setAttribute("aria-pressed", "true");
        saveProgress();
      } else {
        resetFlashPauseUI();
        const card = $("flashCard"),
          stage = $("swipeStage"),
          result = $("flashResultIcon");
        [card, stage, result]
          .filter(Boolean)
          .flatMap((el) => el.getAnimations?.() || [])
          .forEach((anim) => {
            if (anim.playState === "paused") anim.play();
          });
        $("flashFalseBtn").disabled = state.answered;
        $("flashTrueBtn").disabled = state.answered;
        if (state.answered) resumeFlashAutoAdvance();
        if (window.matchMedia && window.matchMedia("(min-width:761px)").matches)
          requestAnimationFrame(() => $("flashCard")?.focus());
      }
    }
    function pause() {
      if (state.mode === "flashcard") {
        setFlashPaused(!flashPaused);
        return;
      }
      clearFlashAdvance();
      if (saveProgress() === false) {
        alert("Impossible de sauvegarder la progression sur cet appareil.");
        return;
      }
      exitQuizFocus();
      $("quiz").classList.add("hidden");
      if (state.manifest) $("setup").classList.remove("hidden");
      refreshResumeCard();
    }
    async function init() {
      if (IS_LOCAL) {
        refreshResumeCard();
        return;
      }
      try {
        await loadManifest();
        state.selectedBankIds.clear();
        state.activeSubject = subjects()[0] || null;
        syncModeUI();
        renderSelectionUI();
        $("setup").classList.remove("hidden");
        refreshResumeCard();
      } catch (e) {
        const heroText = $("heroText");
        if (heroText) heroText.textContent = "Erreur de chargement";
        $("errorText").textContent = e.message;
        $("errorBox").classList.remove("hidden");
      }
    }

    function mount() {
      $("toggleAllChapters").addEventListener("click", () =>
        setAllActiveSubject(!subjectAllSelected(state.activeSubject)),
      );
      $("mobileToggleAll").addEventListener("click", () => {
        if (!state.activeSubject) return;
        setAllActiveSubject(!subjectAllSelected(state.activeSubject));
        renderMobileSheet();
      });
      $("mobileSheetClose").addEventListener("click", closeMobileSheet);
      $("mobileSheetOverlay").addEventListener("click", (e) => {
        if (e.target === $("mobileSheetOverlay")) closeMobileSheet();
      });
      document.addEventListener("keydown", (e) => {
        const modal = document.querySelector(
          ".flash-pref-overlay.open .flash-pref-dialog, .mobile-sheet-overlay.open .mobile-sheet",
        );
        if (e.key === "Tab" && modal) {
          const controls = [
            ...modal.querySelectorAll(
              'button:not(:disabled),input:not(:disabled),[tabindex="0"]',
            ),
          ].filter((el) => el.getClientRects().length);
          const first = controls[0],
            last = controls[controls.length - 1];
          if (
            !modal.contains(document.activeElement) ||
            (e.shiftKey && document.activeElement === first) ||
            (!e.shiftKey && document.activeElement === last)
          ) {
            e.preventDefault();
            (e.shiftKey ? last : first)?.focus();
          }
          return;
        }
        if (e.key !== "Escape") return;
        if ($("flashExplanationOverlay").classList.contains("open")) {
          closeFlashExplanationPrompt();
          return;
        }
        if ($("mobileSheetOverlay").classList.contains("open")) {
          closeMobileSheet();
          return;
        }
      });
      document
        .querySelectorAll(".difficulty-btn")
        .forEach((btn) =>
          btn.addEventListener("click", () =>
            setDifficulty(btn.dataset.difficulty),
          ),
        );
      document
        .querySelectorAll(".mode-btn")
        .forEach((btn) =>
          btn.addEventListener("click", () => setStudyMode(btn.dataset.mode)),
        );
      // Le bouton flottant principal bascule directement le thème via enableThemeButtonDrag().
      $("startBtn").addEventListener("click", start);
      $("validateBtn").addEventListener("click", () => validate());
      $("nextBtn").addEventListener("click", next);
      $("pauseBtn").addEventListener("click", pause);
      $("flashExplanationNo").addEventListener("click", () =>
        chooseFlashExplanation(false),
      );
      $("flashExplanationYes").addEventListener("click", () =>
        chooseFlashExplanation(true),
      );
      $("flashExplanationMenuBtn").addEventListener(
        "click",
        toggleFlashExplanations,
      );
      $("flashFalseBtn").addEventListener("click", () =>
        answerFlashcard(false),
      );
      $("flashTrueBtn").addEventListener("click", () => answerFlashcard(true));
      $("quitBtn").addEventListener("click", () => {
        if (
          confirm("Abandonner ce questionnaire et effacer sa progression ?")
        ) {
          clearFlashAdvance();
          resetFlashPauseUI();
          state.reviewingErrors = false;
          state.flashOutcome = null;
          state.flashExplanationsEnabled = false;
          syncFlashExplanationUI();
          clearProgress();
          state.session = [];
          exitQuizFocus();
          $("quiz").classList.add("hidden");
          if (state.manifest) $("setup").classList.remove("hidden");
        }
      });
      $("resumeBtn").addEventListener("click", resumeSaved);
      $("discardSavedBtn").addEventListener("click", () => {
        if (confirm("Effacer la progression sauvegardée ?")) clearProgress();
      });
      $("newQuiz").addEventListener("click", () => {
        clearFlashAdvance();
        resetFlashPauseUI();
        exitQuizFocus();
        Object.assign(state, {
          session: [],
          index: 0,
          score: 0,
          errors: [],
          answered: false,
          reviewingErrors: false,
          flashOutcome: null,
          flashExplanationsEnabled: false,
        });
        syncFlashExplanationUI();
        reviewTopicsCache = [];
        $("reviewRecommendations").classList.add("hidden");
        $("reviewTopicList").innerHTML = "";
        $("results").classList.add("hidden");
        if (state.manifest) {
          $("setup").classList.remove("hidden");
          renderSelectionUI();
        }
      });
      $("retryErrors").addEventListener("click", () => {
        if (!state.errors.length) return;
        state.session = shuffle([...state.errors]);
        state.index = 0;
        state.score = 0;
        state.errors = [];
        state.answered = false;
        state.reviewingErrors = true;
        $("results").classList.add("hidden");
        $("quiz").classList.remove("hidden");
        enterQuizFocus();
        renderQuestion();
      });
      $("reviewAllTopics").addEventListener("click", () =>
        startReviewTopics([...reviewTopicsCache]),
      );
      $("reviewTopicList").addEventListener("click", (e) => {
        const btn = e.target.closest("[data-review-topic-index]");
        if (!btn) return;
        const topic = reviewTopicsCache[Number(btn.dataset.reviewTopicIndex)];
        if (topic) startReviewTopics([topic]);
      });

      initTheme();

      syncModeUI();
      syncFlashExplanationUI();
      initFlashSwipe();
      restoreThemeButtonPosition();
      enableThemeButtonDrag();

      window.addEventListener("resize", () => {
        if (
          !isMobileSelectionUI() &&
          $("mobileSheetOverlay").classList.contains("open")
        )
          closeMobileSheet();
      });
      document.addEventListener("keydown", handleQuizKeyboard);
      function persistActiveSession() {
        if (!$("quiz").classList.contains("hidden")) saveProgress();
      }
      window.addEventListener("beforeunload", persistActiveSession);
      window.addEventListener("pagehide", persistActiveSession);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") persistActiveSession();
      });
      if (IS_LOCAL)
        $("folderInput").addEventListener("change", (e) =>
          loadFolder(e.target.files),
        );
      init();
    }
    return {
      mount,
      state,
      validQuestion,
      validateBank,
      validSavedProgress,
      validFlashSnapshot,
      buildFlashcard,
      isFlashcardEligible,
      getSaved,
      saveProgress,
      clearProgress,
      resumeSaved,
      loadBank,
      loadFolder,
      finalizeAnswer,
      showFlashcardExplanation,
      setFlashPaused,
      clearFlashAdvance,
      validate,
      SAVE_KEY,
    };
  }
  if (typeof module !== "undefined" && module.exports)
    module.exports = createQuizApp;
  else
    createQuizApp({
      local: document.documentElement.dataset.edition === "local",
    }).mount();
})();

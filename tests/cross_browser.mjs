import assert from "node:assert/strict";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium, firefox, webkit } from "playwright";
import { expect as baseExpect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const root = fileURLToPath(new URL("../", import.meta.url));
const base = process.env.QCM_BASE_URL || "http://127.0.0.1:8000/";
const bankPaths = readdirSync(root + "banques", { recursive: true }).filter(
  (p) => p.endsWith(".json"),
);
const banks = bankPaths.map((p) =>
  JSON.parse(readFileSync(root + "banques/" + p, "utf8")),
);
const artifacts = root + "test-results/";
mkdirSync(artifacts, { recursive: true });
const expect = baseExpect.configure({ timeout: 10000 });

async function audit(page, label) {
  await page.evaluate(async () => {
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    await Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => {})),
    );
  });
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  assert.deepEqual(
    results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
    [],
    label,
  );
}
async function selectBank(page, mobile) {
  await page.locator("#subjectList .subject-card").first().click();
  if (mobile) {
    await expect(
      page.getByRole("dialog", {
        name: await page.locator("#mobileSheetTitle").textContent(),
      }),
    ).toBeVisible();
    await page.locator("#mobileToggleAll").click();
    await page.locator("#mobileSheetClose").click();
  }
  await expect(page.locator("#startBtn")).toBeEnabled();
}
async function correctQcm(page) {
  for (const answer of await page
    .locator('#choices input[data-correct="1"]')
    .all())
    await answer.locator("..").click();
  await page.locator("#validateBtn").click();
  await expect(page.locator("#feedback")).toContainText("Bonne réponse");
}

for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
  const browser = await engine.launch();
  try {
    for (const mobile of [false, true]) {
      const label = `${name}-${mobile ? "mobile" : "desktop"}`;
      const context = await browser.newContext({
        viewport: mobile
          ? { width: 390, height: 844 }
          : { width: 1280, height: 900 },
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      try {
        await page.goto(base);
        await expect(page.locator("#setup")).toBeVisible();
        await audit(page, `${label}: configuration jour`);
        await selectBank(page, mobile);
        await page.locator("#themeToggle").click();
        await expect(page.locator("html")).toHaveAttribute(
          "data-theme",
          "dark",
        );
        await expect(page.locator("html")).not.toHaveClass(/theme-switching/);
        const expectedText = await page.evaluate(() => {
          const probe = document.createElement("span");
          probe.style.color = "var(--text)";
          document.body.appendChild(probe);
          const color = getComputedStyle(probe).color;
          probe.remove();
          return color;
        });
        await expect(page.locator("h2").first()).toHaveCSS(
          "color",
          expectedText,
        );
        await expect(page.locator("#activeSubjectTitle")).toHaveCSS(
          "color",
          expectedText,
        );
        await expect(page.locator(".study-mode-head strong")).toHaveCSS(
          "color",
          expectedText,
        );
        await audit(page, `${label}: sélection nuit`);
        await page.locator("#count").fill("2");
        await page.locator("#startBtn").click();
        await expect(page.locator("#quiz")).toBeVisible();
        await audit(page, `${label}: QCM nuit`);
        await correctQcm(page);
        await page.locator("#pauseBtn").click();
        await page.reload();
        await page.locator("#resumeBtn").click();
        await expect(page.locator("#counter")).toHaveText("Question 2 / 2");
        await correctQcm(page);
        await page.locator("#nextBtn").click();
        await expect(page.locator("#finalScore")).toContainText("2 / 2");
        await audit(page, `${label}: résultats`);
        await page.locator("#newQuiz").click();
        await selectBank(page, mobile);
        await page.locator('[data-mode="flashcard"]').click();
        await expect(page.locator("#startBtn")).toBeEnabled();
        await page.locator("#count").fill("1");
        await page.locator("#startBtn").click();
        await expect(page.locator("#flashExplanationYes")).toBeFocused();
        await audit(page, `${label}: dialogue explications`);
        await page.keyboard.press("Tab");
        await expect(page.locator("#flashExplanationNo")).toBeFocused();
        await page.keyboard.press("Shift+Tab");
        await expect(page.locator("#flashExplanationYes")).toBeFocused();
        await page.locator("#flashExplanationYes").click();
        await expect(page.locator("#flashCard")).toBeVisible();
        await audit(page, `${label}: Vrai/Faux`);
        const prompt = await page.locator("#flashQuestion").textContent();
        const proposal = await page.locator("#flashStatement").textContent();
        const choices = banks
          .flatMap((b) => b.questions)
          .filter((q) => q.prompt === prompt)
          .flatMap((q) => q.choices)
          .filter((c) => c.text.trim() === proposal);
        assert(
          choices.length &&
            choices.every((c) => c.correct === choices[0].correct),
          "ambiguous test card",
        );
        await page
          .locator(choices[0].correct ? "#flashFalseBtn" : "#flashTrueBtn")
          .click();
        await expect(page.locator("#flashCardExplanation")).toBeVisible();
        await page.locator("#pauseBtn").click();
        await expect(page.locator("#flashPauseOverlay")).toBeVisible();
        await page.locator("#pauseBtn").click();
        await audit(page, `${label}: correction Vrai/Faux`);
        if (mobile) {
          const theme = await page.locator("#themeToggle").boundingBox();
          for (const id of ["nextBtn", "pauseBtn", "quitBtn"]) {
            const action = await page.locator("#" + id).boundingBox();
            const overlaps =
              theme.x < action.x + action.width &&
              theme.x + theme.width > action.x &&
              theme.y < action.y + action.height &&
              theme.y + theme.height > action.y;
            assert(!overlaps, label + ": theme control overlaps " + id);
          }
        }
        await page.screenshot({
          path: `${artifacts}${label}.png`,
          fullPage: true,
        });
        await page.locator("#nextBtn").click();
        await expect(page.locator("#finalScore")).toContainText("0 / 1");
        assert.deepEqual(errors, [], `${label}: erreurs JavaScript`);
        console.log(
          `OK — ${label}: QCM, reprise, Vrai/Faux, clavier, thèmes et axe WCAG A/AA`,
        );
      } catch (error) {
        await page.screenshot({
          path: `${artifacts}${label}-failure.png`,
          fullPage: true,
        });
        throw error;
      } finally {
        await context.close();
      }
    }
    // Both editions run from file://; a real directory import preserves nested paths.
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    try {
      await page.goto(new URL("../index_local.html", import.meta.url).href);
      await audit(page, `${name}: chargeur local`);
      await page.locator("#folderInput").setInputFiles(root + "banques");
      await expect(page.locator("#loadStatus")).toContainText(
        `${bankPaths.length} banque(s) chargée(s)`,
      );
      await selectBank(page, false);
      await page.locator("#count").fill("1");
      await page.locator("#startBtn").click();
      await expect(page.locator("#localLoader")).toBeHidden();
      await correctQcm(page);
      await page.reload();
      await page.locator("#resumeBtn").click();
      await expect(page.locator("#finalScore")).toContainText("1 / 1");
      console.log(
        `OK — ${name}: local file://, import du dossier et reprise sans réimport`,
      );
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

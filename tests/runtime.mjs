// Execute the production functions, rather than reimplementing the scoring rules.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = fileURLToPath(new URL("../", import.meta.url));
const banks = readdirSync(root + "banques", { recursive: true })
  .filter((path) => path.endsWith(".json"))
  .map((path) => JSON.parse(readFileSync(root + "banques/" + path, "utf8")));
const manifest = JSON.parse(readFileSync(root + "manifest.json", "utf8"));

for (const file of ["index.html", "index_local.html"]) {
  const source = readFileSync(root + "src/app.js", "utf8");
  const storage = new Map();
  const nodes = new Map();
  let clockNow = 0,
    clockId = 0;
  const timers = new Map();
  const schedule = (fn, delay, interval = 0) => {
    const id = ++clockId;
    timers.set(id, { fn, at: clockNow + delay, interval });
    return id;
  };
  function tick(ms) {
    const target = clockNow + ms;
    while (true) {
      const due = [...timers.entries()]
        .filter(([, t]) => t.at <= target)
        .sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      const [id, t] = due;
      clockNow = t.at;
      if (t.interval) t.at += t.interval;
      else timers.delete(id);
      t.fn();
    }
    clockNow = target;
  }
  function classList() {
    const values = new Set();
    return {
      add: (...names) => names.forEach((n) => values.add(n)),
      remove: (...names) => names.forEach((n) => values.delete(n)),
      contains: (name) => values.has(name),
      toggle(name, force = !values.has(name)) {
        if (force) values.add(name);
        else values.delete(name);
      },
    };
  }
  function node(id) {
    if (!nodes.has(id))
      nodes.set(id, {
        textContent: "",
        checked: false,
        disabled: false,
        style: {
          setProperty(key, value) {
            this[key] = value;
          },
          removeProperty(key) {
            delete this[key];
          },
        },
        classList: classList(),
        setAttribute() {},
        querySelectorAll() {
          return [];
        },
        focus() {},
      });
    return nodes.get(id);
  }
  let alertMessage = "";
  const context = vm.createContext({
    module: { exports: {} },
    performance: { now: () => clockNow },
    setTimeout: (fn, delay) => schedule(fn, delay),
    clearTimeout: (id) => timers.delete(id),
    setInterval: (fn, delay) => schedule(fn, delay, delay),
    clearInterval: (id) => timers.delete(id),
    getComputedStyle: (element) => ({
      strokeDashoffset: element.style.strokeDashoffset || "0",
    }),
    requestAnimationFrame: () => 0,
    console,
    window: { matchMedia: () => ({ matches: false }) },
    document: { getElementById: node, body: node("body") },
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
    alert: (message) => {
      alertMessage = message;
    },
    location: { protocol: "http:" },
    fetch: async () => {
      throw new Error("offline");
    },
  });
  vm.runInContext(source, context);
  const local = file.includes("local");
  const app = context.module.exports({ local });
  for (const bank of banks) {
    app.validateBank(bank, bank.title);
    for (const q of bank.questions) {
      if (!app.isFlashcardEligible(q)) continue;
      for (const truth of [true, false]) {
        const card = app.buildFlashcard(q, truth);
        assert.equal(card.flashTruth, truth);
        assert.equal(app.validFlashSnapshot(card), true);
        assert.equal(
          app.validFlashSnapshot({ ...card, flashTruth: !truth }),
          false,
        );
      }
    }
  }
  for (const bad of [
    null,
    {},
    { questions: [null] },
    { questions: [{ id: "x", prompt: "x", type: "single", choices: [] }] },
  ]) {
    assert.throws(() => app.validateBank(bad, "bad.json"));
  }
  // Exercise the actual DOM-based scoring code for the correct set and every single-choice inversion.
  for (const bank of banks) {
    for (const question of bank.questions) {
      for (let flipped = -1; flipped < question.choices.length; flipped++) {
        const inputs = question.choices.map((choice, i) => ({
          checked: flipped === i ? !choice.correct : choice.correct,
          dataset: { correct: choice.correct ? "1" : "0" },
          closest: () => node("choice-row-" + i),
        }));
        node("choices").querySelectorAll = () => inputs;
        Object.assign(app.state, {
          session: [question],
          index: 0,
          score: 0,
          errors: [],
          answered: false,
        });
        app.finalizeAnswer();
        assert.equal(
          app.state.score,
          flipped === -1 ? 1 : 0,
          `${file}: incorrect QCM score`,
        );
        assert.equal(app.state.errors.length, flipped === -1 ? 0 : 1);
        app.finalizeAnswer();
        assert.equal(
          app.state.score + app.state.errors.length,
          1,
          "duplicate validation counted twice",
        );
      }
    }
  }
  const card = app.buildFlashcard(
    {
      ...banks[0].questions.find((q) => app.isFlashcardEligible(q)),
      bankFile: manifest.banks[0].file,
    },
    true,
  );
  Object.assign(app.state, {
    mode: "flashcard",
    session: [card, card],
    index: 0,
    score: 1,
    errors: [],
    answered: true,
  });
  app.showFlashcardExplanation(card, { ok: true, autoAdvance: true });
  assert.equal(node("flashExplanationCountdown").textContent, "7");
  tick(1500);
  assert.equal(node("flashExplanationCountdown").textContent, "6");
  app.setFlashPaused(true);
  tick(10000);
  assert.equal(
    node("flashExplanationCountdown").textContent,
    "6",
    "paused countdown continued",
  );
  assert.equal(app.state.index, 0, "paused countdown advanced the session");
  app.setFlashPaused(false);
  tick(1000);
  assert.equal(
    node("flashExplanationCountdown").textContent,
    "5",
    "countdown did not resume with its remaining duration",
  );
  app.clearFlashAdvance();
  assert.equal(timers.size, 0);
  app.state.mode = "qcm";
  storage.clear();
  Object.assign(app.state, {
    session: [],
    index: 0,
    score: 0,
    errors: [],
    answered: false,
  });
  const q = { ...banks[0].questions[0], bankFile: manifest.banks[0].file };
  const ref = { id: q.id, file: q.bankFile };
  const progress = {
    mode: "qcm",
    index: 0,
    score: 0,
    ...(local ? { session: [q], errors: [] } : { refs: [ref], errorRefs: [] }),
  };
  const put = (value) => storage.set(app.SAVE_KEY, JSON.stringify(value));
  put({
    ...progress,
    timerEnabled: true,
    timerDurationMs: 1,
    timerRemainingMs: 0,
  });
  assert(app.getSaved(), "legacy timer fields broke progress compatibility");
  put(progress);
  assert(app.getSaved());
  for (const bad of [
    { ...progress, index: -1 },
    { ...progress, index: 2 },
    { ...progress, index: "0" },
    { ...progress, score: 1 },
    { ...progress, score: null },
    { ...progress, mode: "unknown" },
    { ...progress, index: 0.5 },
    { ...progress, ...(local ? { session: [null] } : { refs: [null] }) },
  ]) {
    put(bad);
    assert.equal(app.getSaved(), null, `${file}: corrupted save was accepted`);
  }
  storage.set(app.SAVE_KEY, "{broken");
  assert.equal(app.getSaved(), null);
  put(progress);
  app.state.manifest = manifest;
  if (!local) {
    const before = JSON.stringify(app.state);
    await app.resumeSaved(); // Simulate a fetch failure during restore.
    assert.match(alertMessage, /offline/);
    assert.equal(
      JSON.stringify(app.state),
      before,
      "failed restore mutated active state",
    );
    assert(app.getSaved(), "network failure deleted save");
    assert.equal(node("resumeBtn").disabled, false);
    context.fetch = async () => ({
      ok: true,
      json: async () => ({ questions: [null] }),
    });
    await assert.rejects(() => app.loadBank("invalid.json"), /Banque invalide/);
    let fetchCount = 0;
    context.fetch = async () => {
      fetchCount++;
      return { ok: true, json: async () => banks[0] };
    };
    await Promise.all([
      app.loadBank("coalesced.json"),
      app.loadBank("coalesced.json"),
    ]);
    assert.equal(
      fetchCount,
      1,
      "concurrent requests for the same bank were duplicated",
    );
    // Failed requests must be evicted so a later attempt can recover.
    await app.loadBank("invalid.json");
    assert.equal(fetchCount, 2, "failed bank request was kept in the cache");
    const putRefs = {
      ...progress,
      refs: [ref, { file: ref.file, id: "missing-question" }],
    };
    put(putRefs);
    await app.resumeSaved();
    assert.match(alertMessage, /ne sont plus disponibles/);
    assert.equal(
      JSON.stringify(app.state),
      before,
      "missing question shifted the session",
    );
    assert(app.getSaved(), "missing question erased the saved progress");
  } else {
    const legacyKey = "qcm_bts_dietetique_modular_progress_v7_8_0";
    storage.delete(app.SAVE_KEY);
    storage.set(legacyKey, JSON.stringify(progress));
    assert(app.getSaved(), "legacy local save not readable");
    app.state.session = [q];
    app.saveProgress();
    assert(storage.has(app.SAVE_KEY), "legacy local save not migrated");
    assert(!storage.has(legacyKey));
    storage.set(legacyKey, JSON.stringify({ refs: [ref] }));
    app.clearProgress();
    assert(storage.has(legacyKey), "local discard deleted web save");
    assert.equal(app.getSaved(), null, "local reader consumed web save");
  }
}
console.log(
  `OK — production JS: QCM scoring on ${banks.reduce((n, bank) => n + bank.questions.length, 0)} questions (exact sets and inversions), Vrai/Faux, bank/save validation, offline restore, legacy migration and web/local parity`,
);

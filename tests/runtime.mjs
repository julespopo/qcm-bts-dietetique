// Execute the production functions, rather than reimplementing the scoring rules.
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const root = fileURLToPath(new URL('../', import.meta.url));
const banks = readdirSync(root + 'banques', {recursive: true})
  .filter(path => path.endsWith('.json'))
  .map(path => JSON.parse(readFileSync(root + 'banques/' + path, 'utf8')));
const manifest = JSON.parse(readFileSync(root + 'manifest.json', 'utf8'));
const apps = [];
for (const file of ['index.html', 'index_local.html']) {
  const source = readFileSync(root + file, 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
  const marker = '$("toggleAllChapters").addEventListener';
  assert(source.includes(marker), 'application event wiring not found');
  const storage = new Map();
  const nodes = new Map();
  function node(id) {
    if (!nodes.has(id)) nodes.set(id, {
      textContent: '', checked: false, disabled: false, style: {},
      classList: {add() {}, remove() {}, contains() {return true;}, toggle() {}},
      setAttribute() {}, querySelectorAll() {return [];}, focus() {},
    });
    return nodes.get(id);
  }
  let alertMessage = '';
  const context = vm.createContext({
    requestAnimationFrame: () => 0,
    console, window: {matchMedia: () => ({matches: false})},
    document: {getElementById: node},
    localStorage: {getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key)},
    alert: message => {alertMessage = message;},
    location: {protocol: 'http:'},
    fetch: async () => {throw new Error('offline');},
  });
  // Keep declarations intact; omit DOM event registration and bootstrapping.
  vm.runInContext(source.slice(0, source.indexOf(marker)) + '\nglobalThis.app={state,validQuestion,validateBank,validSavedProgress,validFlashSnapshot,buildFlashcard,isFlashcardEligible,getSaved,saveProgress,clearProgress,resumeSaved,loadBank,finalizeAnswer,validate,SAVE_KEY};})();', context);
  const app = context.app;
  apps.push(app);
  const local = file.includes('local');
  for (const bank of banks) {
    app.validateBank(bank, bank.title);
    for (const q of bank.questions) {
      if (!app.isFlashcardEligible(q)) continue;
      for (const truth of [true, false]) {
        const card = app.buildFlashcard(q, truth);
        assert.equal(card.flashTruth, truth);
        assert.equal(app.validFlashSnapshot(card), true);
        assert.equal(app.validFlashSnapshot({...card, flashTruth: !truth}), false);
      }
    }
  }
  for (const bad of [null, {}, {questions: [null]}, {questions: [{id: 'x', prompt: 'x', type: 'single', choices: []}]}]) {
    assert.throws(() => app.validateBank(bad, 'bad.json'));
  }
  // Exercise the actual DOM-based scoring code for the correct set and every single-choice inversion.
  for (const bank of banks) {
    for (const question of bank.questions) {
      for (let flipped = -1; flipped < question.choices.length; flipped++) {
        const inputs = question.choices.map((choice, i) => ({
          checked: flipped === i ? !choice.correct : choice.correct,
          dataset: {correct: choice.correct ? '1' : '0'},
          closest: () => node('choice-row-' + i),
        }));
        node('choices').querySelectorAll = () => inputs;
        Object.assign(app.state, {session: [question], index: 0, score: 0, errors: [], answered: false, timerEnabled: false});
        app.finalizeAnswer();
        assert.equal(app.state.score, flipped === -1 ? 1 : 0, `${file}: incorrect QCM score`);
        assert.equal(app.state.errors.length, flipped === -1 ? 0 : 1);
        app.finalizeAnswer();
        assert.equal(app.state.score + app.state.errors.length, 1, 'duplicate validation counted twice');
      }
    }
  }
  storage.clear();
  Object.assign(app.state, {session: [], index: 0, score: 0, errors: [], answered: false});
  const q = {...banks[0].questions[0], bankFile: manifest.banks[0].file};
  const ref = {id: q.id, file: q.bankFile};
  const progress = {mode: 'qcm', index: 0, score: 0, ...(local ? {session: [q], errors: []} : {refs: [ref], errorRefs: []})};
  const put = value => storage.set(app.SAVE_KEY, JSON.stringify(value));
  put(progress);
  assert(app.getSaved());
  for (const bad of [{...progress, index: -1}, {...progress, index: 2}, {...progress, index: '0'}, {...progress, score: 1}, {...progress, score: null}, {...progress, mode: 'unknown'}, {...progress, index: 0.5}, {...progress, ...(local ? {session: [null]} : {refs: [null]})}]) {
    put(bad);
    assert.equal(app.getSaved(), null, `${file}: corrupted save was accepted`);
  }
  storage.set(app.SAVE_KEY, '{broken');
  assert.equal(app.getSaved(), null);
  put(progress);
  app.state.manifest = manifest;
  if (!local) {
    const before = JSON.stringify(app.state);
    await app.resumeSaved(); // Simulate a fetch failure during restore.
    assert.match(alertMessage, /offline/);
    assert.equal(JSON.stringify(app.state), before, 'failed restore mutated active state');
    assert(app.getSaved(), 'network failure deleted save');
    assert.equal(node('resumeBtn').disabled, false);
    context.fetch = async () => ({ok: true, json: async () => ({questions: [null]})});
    await assert.rejects(() => app.loadBank('invalid.json'), /Banque invalide/);
  } else {
    const legacyKey = 'qcm_bts_dietetique_modular_progress_v7_8_0';
    storage.delete(app.SAVE_KEY);
    storage.set(legacyKey, JSON.stringify(progress));
    assert(app.getSaved(), 'legacy local save not readable');
    app.state.session = [q];
    app.saveProgress();
    assert(storage.has(app.SAVE_KEY), 'legacy local save not migrated');
    assert(!storage.has(legacyKey));
    storage.set(legacyKey, JSON.stringify({refs: [ref]}));
    app.clearProgress();
    assert(storage.has(legacyKey), 'local discard deleted web save');
    assert.equal(app.getSaved(), null, 'local reader consumed web save');
  }
}
// The new shared contracts must stay identical in the two standalone pages.
for (const name of ['validQuestion', 'validateBank', 'validSavedProgress', 'validFlashSnapshot']) {
  assert.equal(apps[0][name].toString(), apps[1][name].toString(), `${name} differs between web and local`);
}
console.log('OK — production JS: QCM scoring on 776 questions (exact sets and inversions), Vrai/Faux, bank/save validation, offline restore, legacy migration and web/local parity');

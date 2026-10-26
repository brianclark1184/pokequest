/* Development-only browser integration tests; never included by the event app. */
'use strict';
const key = 'pokequest-v1';
const runButton = document.getElementById('run');
const results = document.getElementById('results');
const summary = document.getElementById('summary');
const frames = document.getElementById('frames');
let passed = 0;
let failed = 0;
let frame;
let runtimeErrors = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function assert(condition, message) {
  const li = document.createElement('li'); li.textContent = `${condition ? 'PASS' : 'FAIL'} · ${message}`; li.className = condition ? 'pass' : 'fail'; results.append(li);
  if (condition) passed++; else { failed++; throw new Error(message); }
}
function get(id) { return frame.contentDocument.getElementById(id); }
function saved() { return JSON.parse(localStorage.getItem(key)); }
function click(id) { get(id).focus(); get(id).click(); }
function select(id, value) { get(id).value = value; get(id).dispatchEvent(new Event('change', { bubbles: true })); }
function start(children = 1, name = 'Pumpkin Patrol QA') { get('team-name').value = name; select('start-children', children); get('start-form').requestSubmit(); }
function discardFrame() { frame?.remove(); frame = null; }
function fresh() { discardFrame(); localStorage.removeItem(key); }
function seed(raw) { discardFrame(); localStorage.setItem(key, raw); }
async function load(query = '', width = 390) {
  if (!frame) { frame = document.createElement('iframe'); frame.title = 'PokéQuest app under test'; frame.height = '850'; frames.append(frame); }
  frame.width = width;
  const loaded = new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('App frame timed out')), 8000); frame.onload = () => { clearTimeout(timer); resolve(); }; });
  frame.removeAttribute('srcdoc'); frame.src = `../index.html${query}`; await loaded;
  frame.contentWindow.addEventListener('error', event => runtimeErrors.push(event.message));
  await sleep(30);
}
async function reload() {
  const loaded = new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('App reload timed out')), 8000); frame.onload = () => { clearTimeout(timer); resolve(); }; }); frame.contentWindow.location.reload(); await loaded; await sleep(30);
}
function recovery(ids, redeemed = false) {
  click('open-recovery');
  for (const input of get('recovery-list').querySelectorAll('input')) if (ids.includes(input.value) && !input.disabled) input.checked = true;
  get('recovered-redemption').checked = redeemed;
  get('recovery-form').requestSubmit();
}
async function group(name, work) {
  const li = document.createElement('li'); li.textContent = name; li.style.fontWeight = 'bold'; results.append(li);
  try { await work(); } catch (error) { if (!failed || results.lastElementChild.className !== 'fail') { const li = document.createElement('li'); li.className = 'fail'; li.textContent = `FAIL · ${error.message}`; results.append(li); failed++; } }
}
runButton.addEventListener('click', async () => {
  const previous = localStorage.getItem(key);
  passed = 0; failed = 0; runtimeErrors = []; results.replaceChildren(); summary.textContent = 'Running in Chrome…'; runButton.disabled = true;
  try {
    // Ensure a developer rerun tests the edited app rather than a previous cached script.
    await Promise.all(['../index.html', '../app.js', '../styles.css'].map(url => fetch(url, { cache: 'reload' })));
    await group('Welcome, direct QR, persistence, duplicates and invalid codes', async () => {
      fresh(); await load('?pokemon=pikachu');
      assert(!get('welcome').hidden && get('quest').hidden, 'First visit opens welcome');
      assert(get('start-children').value === '1' && get('start-children').options.length === 8, 'Child count defaults to 1 with choices 1–8');
      assert(frame.contentWindow.location.search === '?pokemon=pikachu' && saved().collected.length === 0, 'Direct QR waits for onboarding');
      await reload(); assert(frame.contentWindow.location.search === '?pokemon=pikachu', 'Pending QR survives reload before Start');
      start(3, 'Pumpkin Patrol <QA>');
      assert(get('welcome').hidden && !get('quest').hidden, 'Start enters Pokédex');
      assert(saved().childCount === 3 && get('quest-children').value === '3', 'Setup child count is saved');
      assert(get('team-label').textContent === 'Pumpkin Patrol <QA>' && !get('team-label').children.length, 'Team name is displayed safely as text');
      assert(saved().collected.join() === 'pikachu' && get('notice').textContent.includes('Pikachu found!'), 'Pending QR captures exactly one item');
      assert(!frame.contentWindow.location.search && get('progress-count').textContent === '1 / 6 found', 'Capture clears query and updates count');
      const artwork = [...get('collection').querySelectorAll('img')];
      await Promise.allSettled(artwork.map(image => image.decode()));
      await sleep(350); // Inspect settled layout after the optional capture animation.
      assert(artwork.length === 6 && artwork.every(image => image.naturalWidth === 320 && new URL(image.currentSrc).origin === location.origin), 'All six Pokémon artwork files load locally at 320px');
      assert(artwork.every(image => { const bounds = image.getBoundingClientRect(); const space = image.parentElement.getBoundingClientRect(); return bounds.bottom <= space.bottom + 1 && bounds.top >= space.top - 1 && bounds.width <= space.width + 1; }), 'Artwork stays inside its reserved space without overlapping names');
      assert(frame.contentWindow.getComputedStyle(artwork[0].parentElement).filter === 'none' && frame.contentWindow.getComputedStyle(artwork[1].parentElement).filter.includes('grayscale'), 'Found artwork is full color and undiscovered artwork stays muted');
      artwork[0].src = '../assets/pokemon/missing-test-image.webp';
      await artwork[0].decode().catch(() => {}); await sleep(30);
      assert(artwork[0].hidden && !artwork[0].nextElementSibling.hidden && saved().collected.length === 1, 'A missing image shows the emoji fallback and preserves capture progress');
      await reload(); assert(saved().collected.length === 1 && get('notice').hidden, 'Reload restores progress without replaying capture');
      await load('?pokemon=pikachu'); assert(saved().collected.length === 1 && get('notice').textContent.includes('Already found'), 'Duplicate scan is harmless and says Already found');
      for (const query of ['?pokemon=', '?pokemon=0', '?pokemon=missing', '?pokemon=Pikachu', '?pokemon=pikachu&pokemon=gengar']) {
        await load(query); assert(saved().collected.length === 1 && get('notice').textContent.includes('No worries') && !frame.contentWindow.location.search, `Invalid code ${query} preserves progress and clears URL`);
      }
    });
    await group('Qualification, family edits, volunteer confirmation and redemption', async () => {
      await load('?pokemon=zubat'); await load('?pokemon=squirtle');
      assert(saved().collected.length === 3 && get('reward').hidden, 'Three unique finds do not qualify');
      await load('?pokemon=gengar');
      assert(saved().collected.length === 4 && !get('reward').hidden && get('reward-heading').textContent === '3 prizes earned!', 'Any four unique finds earn three family prizes');
      assert(get('progress-copy').textContent.includes('just for fun'), 'Remaining finds are clearly optional');
      select('quest-children', 2);
      assert(saved().childCount === 2 && get('reward-copy').textContent.includes('2 prizes for 2 children'), 'Child count remains editable before redemption');
      click('show-volunteer');
      assert(get('volunteer-dialog').open && get('volunteer-prizes').textContent === '2 prizes' && get('volunteer-children').textContent === 'For 2 children', 'Volunteer view shows correct prizes and children');
      click('begin-redeem');
      assert(get('confirm-dialog').open && !saved().redeemed, 'First redemption tap opens confirmation without redeeming');
      get('confirm-dialog').querySelector('[data-close]').click();
      assert(!saved().redeemed && !get('show-volunteer').hidden, 'Not yet cancels redemption safely');
      click('show-volunteer'); click('begin-redeem'); click('confirm-redeem');
      assert(saved().redeemed && get('reward-heading').textContent === 'Prizes Collected', 'Explicit confirmation marks prizes collected');
      assert(get('show-volunteer').hidden && get('quest-children').hidden && get('locked-children').textContent === '2 children', 'Redeemed view hides second claim and locks child count');
      await reload(); assert(saved().redeemed && get('reward-copy').textContent.includes('2 prizes for 2 children'), 'Redeemed status and family prize count survive refresh');
      await load('?pokemon=charmander'); await load('?pokemon=bulbasaur');
      assert(saved().collected.length === 6 && saved().redeemed && saved().childCount === 2, 'All six collect in arbitrary order, including after redemption');
      assert(get('progress-copy').textContent.includes('All 6'), 'Full collection is celebrated');
      const before = saved().collected.join(); await load('?pokemon=bulbasaur');
      assert(saved().collected.join() === before && saved().redeemed, 'Duplicate after redemption cannot reissue prizes');
      frame.remove(); frame = null; await load();
      assert(get('welcome').hidden && saved().collected.length === 6 && saved().redeemed, 'Closing and reopening the app resumes the same browser quest');
      click('open-recovery');
      assert(get('recovered-redemption').checked && get('recovered-redemption').disabled && [...get('recovery-list').querySelectorAll('input')].every(input => input.checked && input.disabled), 'Recovery cannot uncheck existing finds or redeemed status');
      get('recovery-form').requestSubmit(); assert(saved().redeemed && saved().collected.length === 6, 'Saving recovery preserves redemption and collection');
    });
    await group('Start over confirmation, reload and replay', async () => {
      const before = JSON.stringify(saved());
      click('open-reset');
      assert(get('reset-dialog').open && JSON.stringify(saved()) === before, 'Opening reset leaves the quest intact');
      get('reset-dialog').querySelector('[data-close]').click();
      assert(JSON.stringify(saved()) === before, 'Cancelling reset preserves finds and redemption');
      click('open-reset'); click('confirm-reset');
      assert(!get('welcome').hidden && !saved().started && !saved().redeemed && !saved().collected.length && saved().teamName === '' && saved().childCount === 1, 'Confirmed reset clears all quest details and returns to welcome');
      assert(get('team-name').value === '' && get('start-children').value === '1' && get('notice').hidden, 'Reset clears setup inputs and old notices');
      await reload(); assert(!get('welcome').hidden && !saved().collected.length && !saved().redeemed, 'Reset survives reload');
      await load('?pokemon=pikachu'); start(2);
      assert(saved().collected.join() === 'pikachu' && !saved().redeemed && saved().childCount === 2, 'New quest captures normally after reset');
    });
    await group('Manual recovery in a fresh browser context', async () => {
      fresh(); await load(); select('start-children', 4); recovery(['pikachu', 'gengar', 'charmander', 'zubat']);
      assert(!get('welcome').hidden && saved().collected.length === 4, 'Recovery before Start restores finds and still allows family setup');
      assert(get('start-children').value === '4', 'Recovery preserves child count already chosen on welcome');
      start(Number(get('start-children').value)); assert(get('reward-heading').textContent === '4 prizes earned!', 'Recovered family gets correct four-child reward');
      fresh(); await load('?pokemon=squirtle'); recovery(['pikachu', 'gengar', 'charmander', 'zubat'], true); start(3);
      assert(saved().collected.length === 5 && saved().redeemed && saved().childCount === 3 && get('reward-heading').textContent === 'Prizes Collected', 'Lost-browser recovery restores prior redemption, family count, and pending QR');
      await reload(); assert(saved().redeemed && get('quest-children').hidden && saved().childCount === 3, 'Recovered redemption stays locked after reload');
    });
    await group('Corrupt, malformed, legacy and unavailable storage', async () => {
      seed('{broken json'); await load();
      assert(!get('welcome').hidden && !get('storage-warning').hidden, 'Corrupt JSON shows recovery guidance without crashing');
      start(1); assert(saved().started, 'Quest can start after corrupt data');
      seed(JSON.stringify({ version: 1, started: true, childCount: 99, teamName: 12, collected: ['gengar', 'gengar', 'unknown', null], redeemed: 'yes' })); await load();
      assert(saved().childCount === 8 && saved().teamName === '' && saved().collected.join() === 'gengar' && saved().redeemed === false, 'Malformed fields are clamped, deduplicated and sanitized');
      seed(JSON.stringify({ version: 1, teamName: 'Legacy family', childCount: -8, collected: ['pikachu'], redeemed: false })); await load();
      assert(get('welcome').hidden && saved().childCount === 1, 'Legacy state without onboarding flag resumes and clamps low child count');
      seed(JSON.stringify({ version: 100, childCount: 8, collected: ['gengar'] })); await load();
      assert(!get('welcome').hidden && saved().collected.length === 0 && !get('storage-warning').hidden, 'Unknown state versions fall back with recovery guidance');
      const source = await (await fetch('../index.html')).text();
      // srcdoc keeps this same origin while a blocked getter models browser storage denial.
      const injected = source.replace('<head>', '<head><base href="../"><script>Object.defineProperty(window,"localStorage",{get(){throw new DOMException("Blocked for test","SecurityError")}});<\/script>');
      const loaded = new Promise(resolve => { frame.onload = resolve; }); frame.srcdoc = injected; await loaded; await sleep(30);
      assert(!get('storage-warning').hidden && get('storage-warning').textContent.includes('can’t save'), 'Unavailable localStorage shows a visible warning');
      start(2); recovery(['pikachu', 'gengar', 'zubat', 'squirtle']);
      assert(get('reward-heading').textContent === '2 prizes earned!', 'Memory-only quest and recovery still qualify');
      click('show-volunteer'); click('begin-redeem'); click('confirm-redeem');
      assert(get('reward-heading').textContent === 'Prizes Collected', 'Memory-only redemption works');
    });
    await group('Two open tabs preserve finds and redemption', async () => {
      fresh(); await load(); start(2);
      const first = frame;
      const second = document.createElement('iframe'); second.title = 'Second open quest tab'; second.width = '390'; second.height = '850'; frames.append(second);
      try {
        await new Promise(resolve => { second.onload = resolve; second.src = '../index.html'; });
        let writes = 0; const onStorage = event => { if (event.key === key) writes++; };
        window.addEventListener('storage', onStorage);
        try {
          recovery(['pikachu']); frame = second; recovery(['gengar']); frame = first;
          await sleep(250);
          assert(saved().collected.includes('pikachu') && saved().collected.includes('gengar'), 'Concurrent tabs retain both newly restored finds');
          const settledWrites = writes; await sleep(250);
          assert(writes === settledWrites && writes < 20, 'Cross-tab updates settle without a storage write loop');
          assert(get('progress-count').textContent === '2 / 6 found' && second.contentDocument.getElementById('progress-count').textContent === '2 / 6 found', 'Both open tabs show the same merged progress');
          recovery(['zubat', 'squirtle']); await sleep(80);
          click('show-volunteer');
          frame = second; select('quest-children', 3); frame = first; await sleep(80);
          assert(!get('volunteer-dialog').open && get('reward-heading').textContent === '3 prizes earned!', 'Changing family count in another tab closes a stale volunteer view');
          frame = second; click('show-volunteer'); click('begin-redeem'); click('confirm-redeem'); frame = first; await sleep(80);
          assert(get('reward-heading').textContent === 'Prizes Collected' && get('quest-children').hidden && saved().childCount === 3, 'Redemption in one tab locks the other tab with the same prize count');
          click('open-reset'); click('confirm-reset'); await sleep(250);
          assert(!get('welcome').hidden && !second.contentDocument.getElementById('welcome').hidden && !saved().redeemed && !saved().collected.length, 'Reset clears both tabs without resurrecting old progress');
        } finally { window.removeEventListener('storage', onStorage); }
      } finally { frame = first; second.remove(); }
    });
    await group('Browser history, responsive layout, keyboard dialogs and paper backup', async () => {
      fresh(); await load(); start(1); await load('?pokemon=gengar');
      const previousLength = frame.contentWindow.history.length;
      frame.contentWindow.history.pushState(null, '', '?test=back');
      await new Promise((resolve, reject) => { const timeout = setTimeout(() => reject(new Error('History back timed out')), 4000); frame.contentWindow.addEventListener('popstate', () => { clearTimeout(timeout); resolve(); }, { once: true }); frame.contentWindow.history.back(); });
      assert(saved().collected.join() === 'gengar' && !frame.contentWindow.location.search && frame.contentWindow.history.length >= previousLength, 'Browser Back returns to cleaned URL without resetting finds');
      for (const width of [320, 390, 1280]) {
        frame.width = width; await sleep(80);
        assert(frame.contentDocument.documentElement.scrollWidth <= width, `Pokédex has no horizontal overflow at ${width}px`);
        const columns = frame.contentWindow.getComputedStyle(get('collection')).gridTemplateColumns.split(' ').length;
        assert(columns === (width < 481 ? 2 : 3), `Collection grid adapts at ${width}px`);
      }
      frame.width = 320; click('open-recovery'); await sleep(30);
      const box = get('recovery-dialog').getBoundingClientRect();
      assert(box.left >= 0 && box.right <= 320 && get('recovery-dialog').open, 'Recovery dialog fits small phone width');
      assert(get('recovery-dialog').contains(frame.contentDocument.activeElement), 'Modal places keyboard focus inside the dialog');
      get('recovery-dialog').querySelector('[data-close]').click(); await sleep(30);
      assert(frame.contentDocument.activeElement.id === 'open-recovery', 'Closing recovery restores focus to its trigger');
      const loaded = new Promise(resolve => { frame.onload = resolve; }); frame.src = '../paper.html'; await loaded; await sleep(30);
      assert(frame.contentDocument.querySelectorAll('#paper-list li').length === 6 && !!frame.contentDocument.getElementById('print-paper'), 'Paper backup lists all six friends and offers printing');
      const paperImages = [...frame.contentDocument.querySelectorAll('#paper-list img')];
      await Promise.allSettled(paperImages.map(image => image.decode()));
      assert(paperImages.length === 6 && paperImages.every(image => image.naturalWidth === 320), 'Paper backup also loads all six real Pokémon images');
      assert(runtimeErrors.length === 0, 'No uncaught runtime errors during loaded app flows');
    });
  } finally {
    frame?.remove(); frame = null;
    if (previous === null) localStorage.removeItem(key); else localStorage.setItem(key, previous);
    summary.textContent = `${passed} checks passed · ${failed} failed · ${navigator.userAgent}`;
    document.title = `${failed ? 'FAIL' : 'PASS'} · PokéQuest browser tests`;
    runButton.disabled = false;
  }
});
// Optional entry point for a headless browser on the isolated test origin.
if (new URLSearchParams(location.search).has('autorun')) runButton.click();

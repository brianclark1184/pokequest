/* Edit event settings here. Character artwork is served from local assets only. */
(function (root) {
  'use strict';
  const CONFIG = {
    canonicalUrl: 'https://pokequest.fly.dev/', // Keep stable once QR signs are printed.
    storageKey: 'pokequest-v1',
    requiredCount: 4,
    pokemon: [
      { id: 'pikachu', displayName: 'Pikachu', emojiOrArt: 'assets/pokemon/pikachu.webp', fallbackEmoji: '⚡', hint: 'A spark of adventure.', color: '#fff0b9' },
      { id: 'gengar', displayName: 'Gengar', emojiOrArt: 'assets/pokemon/gengar.webp', fallbackEmoji: '👻', hint: 'A friendly little fright.', color: '#ece0f8' },
      { id: 'charmander', displayName: 'Charmander', emojiOrArt: 'assets/pokemon/charmander.webp', fallbackEmoji: '🔥', hint: 'A warm-hearted friend.', color: '#ffe3ce' },
      { id: 'bulbasaur', displayName: 'Bulbasaur', emojiOrArt: 'assets/pokemon/bulbasaur.webp', fallbackEmoji: '🌱', hint: 'Watch friendship grow.', color: '#e3edce' },
      { id: 'squirtle', displayName: 'Squirtle', emojiOrArt: 'assets/pokemon/squirtle.webp', fallbackEmoji: '🐢', hint: 'Making a little splash.', color: '#dceef1' },
      { id: 'zubat', displayName: 'Zubat', emojiOrArt: 'assets/pokemon/zubat.webp', fallbackEmoji: '🦇', hint: 'Your after-dark adventurer.', color: '#e3e4f4' }
    ]
  };
  const ids = new Set(CONFIG.pokemon.map(item => item.id));
  const freshState = () => ({ version: 1, questRevision: 0, started: false, teamName: '', childCount: 1, collected: [], redeemed: false });
  function childCount(value) {
    const number = typeof value === 'number' || typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
    return Number.isFinite(number) ? Math.max(1, Math.min(8, Math.trunc(number))) : 1;
  }
  function sanitize(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || value.version !== 1) return freshState();
    const collected = Array.isArray(value.collected) ? [...new Set(value.collected.filter(id => ids.has(id)))] : [];
    const redeemed = value.redeemed === true;
    return {
      version: 1,
      questRevision: Number.isSafeInteger(value.questRevision) && value.questRevision >= 0 ? value.questRevision : 0,
      // Existing v1 progress predates the explicit onboarding flag.
      started: value.started === true || value.started === undefined && (collected.length > 0 || redeemed),
      teamName: typeof value.teamName === 'string' ? value.teamName.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 40) : '',
      childCount: childCount(value.childCount), collected, redeemed
    };
  }
  const qualified = state => state.collected.length >= CONFIG.requiredCount;
  function transition(current, action) {
    const state = sanitize(current);
    switch (action.type) {
      case 'reset': return { ...freshState(), questRevision: state.questRevision + 1 };
      case 'start': return state.started ? state : sanitize({ ...state, started: true, teamName: action.teamName, childCount: action.childCount });
      case 'capture': return ids.has(action.id) ? { ...state, collected: [...new Set([...state.collected, action.id])] } : state;
      case 'children': return state.redeemed ? state : { ...state, childCount: childCount(action.value) };
      case 'recover': return { ...state, collected: [...new Set([...state.collected, ...(Array.isArray(action.ids) ? action.ids.filter(id => ids.has(id)) : [])])], redeemed: state.redeemed || action.redeemed === true };
      case 'redeem': return state.started && qualified(state) ? { ...state, redeemed: true } : state;
      default: return state;
    }
  }
  function mergeStates(current, incoming) {
    const previous = sanitize(current);
    const next = sanitize(incoming);
    // An explicit reset starts a new quest; older tabs must not restore old finds or prizes.
    if (previous.questRevision !== next.questRevision) return previous.questRevision > next.questRevision ? previous : next;
    const found = new Set([...previous.collected, ...next.collected]);
    return {
      ...next,
      started: previous.started || next.started,
      childCount: previous.redeemed ? previous.childCount : next.childCount,
      redeemed: previous.redeemed || next.redeemed,
      // A stable order prevents two tabs from repeatedly rewriting different ID orders.
      collected: CONFIG.pokemon.filter(item => found.has(item.id)).map(item => item.id)
    };
  }
  function createStore(getStorage, warn = () => {}) {
    let memory = freshState();
    let available = true;
    let loaded = false;
    return {
      load() {
        if (loaded) return memory;
        loaded = true;
        try {
          const raw = getStorage().getItem(CONFIG.storageKey);
          if (raw !== null) {
            const parsed = JSON.parse(raw);
            memory = sanitize(parsed);
            if (!parsed || parsed.version !== 1) warn('Your saved quest could not be read. Use “Missing your Pokémon?” to restore your finds.');
          }
          // Check writes too: some browser modes allow reads but block saving.
          getStorage().setItem(CONFIG.storageKey, JSON.stringify(memory));
        } catch (error) {
          if (error instanceof SyntaxError) {
            warn('Your saved quest could not be read. Use “Missing your Pokémon?” to restore your finds.');
            try { getStorage().setItem(CONFIG.storageKey, JSON.stringify(memory)); } catch (_) { available = false; }
          } else { available = false; }
          if (!available) warn('This browser can’t save your quest. Keep this page open. After another scan or closing the browser, use “Missing your Pokémon?” to restore your finds and prize status.');
        }
        return memory;
      },
      save(next) {
        memory = sanitize(next);
        if (available) {
          try { getStorage().setItem(CONFIG.storageKey, JSON.stringify(memory)); }
          catch (_) {
            available = false;
            warn('This browser can’t save your quest. Keep this page open. After another scan or closing the browser, use “Missing your Pokémon?” to restore your finds and prize status.');
          }
        }
        return memory;
      }
    };
  }
  function qrDestinations(base = CONFIG.canonicalUrl) {
    const url = new URL(base);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('Use a canonical HTTPS URL without credentials, query parameters, or a fragment.');
    return CONFIG.pokemon.map(item => { const target = new URL(url.href); target.searchParams.set('pokemon', item.id); return { ...item, url: target.href }; });
  }
  const core = { CONFIG, freshState, sanitize, transition, mergeStates, qualified, createStore, qrDestinations };
  if (typeof module !== 'undefined' && module.exports) module.exports = core;
  root.PokeQuest = core;
  if (typeof document === 'undefined') return;
  function createArtwork(item, className) {
    const art = document.createElement('span'); art.className = className; art.setAttribute('aria-hidden', 'true');
    if (!item.emojiOrArt.startsWith('assets/')) { art.textContent = item.emojiOrArt; return art; }
    const fallback = document.createElement('span'); fallback.textContent = item.fallbackEmoji || '✦'; fallback.hidden = true;
    const image = document.createElement('img'); image.className = 'pokemon-image'; image.alt = ''; image.width = 320; image.height = 320; image.decoding = 'async';
    image.addEventListener('error', () => { image.hidden = true; fallback.hidden = false; }, { once: true });
    image.src = item.emojiOrArt; art.append(image, fallback);
    return art;
  }
  document.addEventListener('DOMContentLoaded', () => {
    const $ = id => document.getElementById(id);
    if (!$('app')) {
      if ($('paper-list')) {
        CONFIG.pokemon.forEach(item => { const li = document.createElement('li'); li.append(document.createTextNode('☐ '), createArtwork(item, 'paper-art'), document.createTextNode(item.displayName)); $('paper-list').append(li); });
        $('print-paper').addEventListener('click', () => window.print());
      }
      return;
    }
    const store = createStore(() => window.localStorage, message => { $('storage-warning').textContent = message; $('storage-warning').hidden = false; });
    let state = store.load();
    let pendingScan = null;
    let returnFocus = null;
    const params = new URL(window.location.href).searchParams;
    if (params.has('pokemon')) { const values = params.getAll('pokemon'); pendingScan = { id: values.length === 1 ? values[0] : null }; }
    const plural = (count, singular, many = `${singular}s`) => `${count} ${count === 1 ? singular : many}`;
    function update(action) { state = store.save(transition(state, action)); render(); }
    function announce(title, copy) {
      $('notice').replaceChildren();
      const strong = document.createElement('strong'); strong.textContent = title;
      const p = document.createElement('p'); p.textContent = copy;
      $('notice').append(strong, p); $('notice').hidden = false;
    }
    function consumeScan() {
      if (!pendingScan || !state.started) return;
      const id = pendingScan.id;
      pendingScan = null;
      const item = CONFIG.pokemon.find(item => item.id === id);
      if (item) {
        const duplicate = state.collected.includes(id);
        update({ type: 'capture', id });
        announce(duplicate ? `Already found: ${item.displayName}!` : `${item.displayName} found!`, duplicate ? 'This friend is already in your Pokédex. Keep exploring!' : state.redeemed ? 'Another friend for your collection. Your prizes stay marked collected.' : qualified(state) ? 'Your reward is ready! You can still find the other friends.' : 'One more friend on your adventure. Keep exploring!');
      } else announce('That code didn’t lead to a Pokémon.', 'No worries—your progress is safe. Try another event QR code.');
      try { const clean = new URL(window.location.href); clean.searchParams.delete('pokemon'); window.history.replaceState(null, '', clean.href); } catch (_) { /* Duplicate scans remain harmless when URL cleanup is unavailable. */ }
      $('notice').focus({ preventScroll: true });
    }
    function render() {
      $('welcome').hidden = state.started;
      $('quest').hidden = !state.started;
      $('open-reset').hidden = !state.started;
      $('team-label').textContent = state.teamName || 'YOUR FAMILY ADVENTURE';
      $('progress-count').textContent = `${state.collected.length} / 6 found`;
      $('quest-progress').value = Math.min(4, state.collected.length);
      $('progress-copy').textContent = qualified(state) ? state.collected.length === 6 ? 'All 6 friends found. What an adventure!' : 'Reward earned! The last friends are just for fun.' : `Find ${4 - state.collected.length} more to earn your family’s prizes.`;
      $('collection').replaceChildren();
      CONFIG.pokemon.forEach((item, index) => {
        const found = state.collected.includes(item.id);
        const li = document.createElement('li'); li.className = `card${found ? ' found' : ''}`; li.style.setProperty('--card-color', item.color);
        const number = document.createElement('span'); number.className = 'card-number'; number.textContent = `NO. 0${index + 1}`; number.setAttribute('aria-hidden', 'true');
        const check = document.createElement('span'); check.className = 'card-check'; check.textContent = found ? '✓' : ''; check.setAttribute('aria-hidden', 'true');
        const art = createArtwork(item, 'card-art');
        const name = document.createElement('h3'); name.textContent = item.displayName;
        const status = document.createElement('span'); status.className = 'card-status'; status.textContent = found ? 'Found!' : 'Not found yet';
        const hint = document.createElement('p'); hint.textContent = item.hint;
        li.append(number, check, art, name, status, hint); $('collection').append(li);
      });
      $('quest-children').value = state.childCount;
      $('quest-children').hidden = state.redeemed;
      $('locked-children').hidden = !state.redeemed;
      $('locked-children').textContent = plural(state.childCount, 'child', 'children');
      $('family-copy').textContent = state.redeemed ? 'Prize count saved when collected.' : 'One prize each. You can adjust this before collection.';
      $('reward').hidden = !qualified(state) && !state.redeemed;
      $('reward').classList.toggle('redeemed', state.redeemed);
      $('reward-kicker').textContent = state.redeemed ? 'THANKS FOR ADVENTURING WITH US' : 'QUEST COMPLETE';
      $('reward-heading').textContent = state.redeemed ? 'Prizes Collected' : `${plural(state.childCount, 'prize')} earned!`;
      $('reward-copy').textContent = state.redeemed ? `${plural(state.childCount, 'prize')} for ${plural(state.childCount, 'child', 'children')}. Keep exploring for fun!` : `${plural(state.childCount, 'prize')} for ${plural(state.childCount, 'child', 'children')}. Head back to the Pokémon Trunk to collect your ${state.childCount === 1 ? 'prize' : 'prizes'}!`;
      $('show-volunteer').hidden = state.redeemed;
    }
    function openDialog(dialog, rememberFocus = true) { if (rememberFocus) returnFocus = document.activeElement; dialog.showModal(); }
    document.querySelectorAll('dialog').forEach(dialog => {
      dialog.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => dialog.close()));
      dialog.addEventListener('close', () => { if (!document.querySelector('dialog[open]') && returnFocus?.isConnected && !returnFocus.hidden) returnFocus.focus(); });
    });
    for (const id of ['start-children', 'quest-children']) {
      for (let count = 1; count <= 8; count++) { const option = document.createElement('option'); option.value = count; option.textContent = id === 'start-children' ? String(count) : plural(count, 'child', 'children'); $(id).append(option); }
    }
    $('start-children').value = state.childCount;
    $('start-form').addEventListener('submit', event => {
      event.preventDefault(); update({ type: 'start', teamName: $('team-name').value, childCount: $('start-children').value });
      consumeScan(); $('quest-title').setAttribute('tabindex', '-1'); $('quest-title').focus();
    });
    $('quest-children').addEventListener('change', event => update({ type: 'children', value: event.target.value }));
    $('open-reset').addEventListener('click', () => openDialog($('reset-dialog')));
    $('confirm-reset').addEventListener('click', () => {
      pendingScan = null;
      try { const clean = new URL(window.location.href); clean.searchParams.delete('pokemon'); window.history.replaceState(null, '', clean.href); } catch (_) { /* Reset still works in memory. */ }
      update({ type: 'reset' });
      $('start-form').reset(); $('start-children').value = state.childCount;
      $('notice').hidden = true;
      returnFocus = $('team-name');
      $('reset-dialog').close(); $('team-name').focus();
    });
    $('open-recovery').addEventListener('click', () => {
      $('recovery-list').replaceChildren();
      CONFIG.pokemon.forEach(item => {
        const label = document.createElement('label'); label.className = 'check-row';
        const input = document.createElement('input'); input.type = 'checkbox'; input.name = 'found'; input.value = item.id; input.checked = state.collected.includes(item.id); input.disabled = input.checked;
        label.append(input, createArtwork(item, 'check-art'), document.createTextNode(`${item.displayName}${input.checked ? ' · saved' : ''}`)); $('recovery-list').append(label);
      });
      $('recovered-redemption').checked = state.redeemed;
      $('recovered-redemption').disabled = state.redeemed;
      $('recovery-prize-help').textContent = state.redeemed ? 'Your prizes are already marked collected. This will stay saved.' : 'If you already received prizes, check the box so this browser remembers.';
      openDialog($('recovery-dialog'));
    });
    $('recovery-form').addEventListener('submit', event => {
      event.preventDefault();
      update({ type: 'recover', ids: [...$('recovery-list').querySelectorAll('input:checked')].map(input => input.value), redeemed: $('recovered-redemption').checked });
      $('recovery-dialog').close();
      if (state.started) { announce('Your finds are restored!', state.redeemed ? 'Your prizes are marked collected. Keep exploring for fun!' : 'You’re ready to keep adventuring.'); $('notice').focus(); }
      else { $('start-children').focus(); }
    });
    $('show-volunteer').addEventListener('click', () => {
      if (state.redeemed || !qualified(state)) return;
      $('volunteer-prizes').textContent = plural(state.childCount, 'prize');
      $('volunteer-children').textContent = `For ${plural(state.childCount, 'child', 'children')}`;
      $('volunteer-found').textContent = `${state.collected.length} of 6 Pokémon found · Reward earned`;
      openDialog($('volunteer-dialog'));
    });
    $('begin-redeem').addEventListener('click', () => {
      $('volunteer-dialog').close();
      $('confirm-copy').textContent = `Mark ${plural(state.childCount, 'prize')} for ${plural(state.childCount, 'child', 'children')} as collected? Tap Yes only after the volunteer hands out your prizes.`;
      openDialog($('confirm-dialog'), false);
    });
    $('confirm-redeem').addEventListener('click', () => {
      update({ type: 'redeem' }); $('confirm-dialog').close();
      announce('Prizes Collected', 'Thank you for adventuring with us! Your collection is still here.'); $('notice').focus();
    });
    // Refresh a quest if another tab of this same browser changes it.
    window.addEventListener('storage', event => {
      if (event.key !== CONFIG.storageKey) return;
      try {
        const incoming = JSON.parse(event.newValue);
        if (!incoming || Array.isArray(incoming) || incoming.version !== 1) return;
        // Merge discoveries and preserve a completed redemption from either tab.
        const merged = mergeStates(state, incoming);
        if (merged.questRevision > state.questRevision) {
          pendingScan = null; $('notice').hidden = true;
          $('start-form').reset(); $('start-children').value = merged.childCount;
        }
        state = store.save(merged);
        document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close()); render(); consumeScan();
      } catch (_) { /* Invalid writes in another tab must not replace this tab's progress. */ }
    });
    render(); consumeScan();
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);

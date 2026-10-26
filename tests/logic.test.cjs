'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { CONFIG, freshState, sanitize, transition, mergeStates, qualified, createStore, qrDestinations } = require('../app.js');
const started = (children = 3) => transition(freshState(), { type: 'start', teamName: 'Pumpkin Patrol', childCount: children });
const capture = (state, id) => transition(state, { type: 'capture', id });

test('reset clears redeemed quest, persists, and supersedes stale tabs in either merge order', () => {
  const old = transition(transition(started(4), { type: 'recover', ids: CONFIG.pokemon.map(item => item.id) }), { type: 'redeem' });
  const reset = transition(old, { type: 'reset' });
  assert.deepEqual(reset, { ...freshState(), questRevision: 1 });
  const data = new Map();
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const store = createStore(() => storage); store.load(); store.save(reset);
  assert.deepEqual(createStore(() => storage).load(), reset);
  assert.deepEqual(mergeStates(old, reset), reset);
  assert.deepEqual(mergeStates(reset, old), reset);
  const next = transition(reset, { type: 'start', teamName: 'Again', childCount: 2 });
  assert.deepEqual(capture(next, 'pikachu').collected, ['pikachu']);
  assert.equal(transition(next, { type: 'reset' }).questRevision, 2);
  const blocked = createStore(() => { throw new Error('blocked'); }); blocked.load(); blocked.save(old);
  assert.deepEqual(blocked.save(transition(blocked.load(), { type: 'reset' })), reset);
});
test('six unique IDs collect once in arbitrary order; qualification requires four', () => {
  let state = started();
  for (const [index, id] of ['zubat', 'squirtle', 'gengar', 'pikachu', 'bulbasaur', 'charmander'].entries()) {
    state = capture(state, id); state = capture(state, id);
    assert.equal(state.collected.length, index + 1); assert.equal(qualified(state), index >= 3);
  }
  for (const id of ['', 0, '0', null, '__proto__', 'Pikachu', 'missing']) assert.deepEqual(capture(state, id), state);
});
test('every four-of-six combination qualifies; every three-of-six combination does not', () => {
  for (let mask = 0; mask < 64; mask++) {
    const found = CONFIG.pokemon.filter((_, index) => mask & (1 << index)).map(item => item.id);
    const state = transition(started(), { type: 'recover', ids: found });
    assert.equal(qualified(state), found.length >= 4);
  }
});
test('redemption requires qualification and freezes children while collecting continues', () => {
  let state = started(3);
  assert.equal(transition(state, { type: 'redeem' }).redeemed, false);
  for (const item of CONFIG.pokemon.slice(0, 4)) state = capture(state, item.id);
  state = transition(state, { type: 'children', value: 8 });
  state = transition(state, { type: 'redeem' });
  assert.equal(state.redeemed, true); assert.equal(state.childCount, 8);
  assert.deepEqual(transition(state, { type: 'children', value: 1 }), state);
  assert.deepEqual(transition(state, { type: 'start', childCount: 1 }), state);
  state = capture(state, 'zubat'); assert.equal(state.collected.length, 5); assert.equal(state.redeemed, true);
  assert.deepEqual(sanitize(JSON.parse(JSON.stringify(state))), state);
});
test('recovery is additive, preserves redemption, and allows setup after restoring a lost browser', () => {
  let state = transition(freshState(), { type: 'recover', ids: ['gengar', 'gengar', 'missing'], redeemed: true });
  assert.equal(sanitize(state).started, false);
  state = transition(state, { type: 'start', childCount: 4, teamName: 'Restored crew' });
  assert.equal(state.childCount, 4); assert.equal(state.redeemed, true);
  state = transition(state, { type: 'recover', ids: ['pikachu'], redeemed: false });
  assert.deepEqual(state.collected, ['gengar', 'pikachu']); assert.equal(state.redeemed, true);
});
test('saved values are sanitized and legacy v1 progress resumes', () => {
  assert.deepEqual(sanitize(null), freshState()); assert.deepEqual(sanitize({ version: 2 }), freshState());
  const state = sanitize({ version: 1, teamName: '  Name\u0000  ', childCount: 90, collected: ['gengar', 'gengar', 'invalid', {}, null], redeemed: 'yes' });
  assert.equal(state.started, true); assert.equal(state.teamName, 'Name'); assert.equal(state.childCount, 8); assert.deepEqual(state.collected, ['gengar']); assert.equal(state.redeemed, false);
  for (const [value, expected] of [[0, 1], [-10, 1], [3.8, 3], ['7', 7], ['', 1], [null, 1], [Infinity, 1], ['bad', 1], [true, 1]]) assert.equal(sanitize({ version: 1, childCount: value }).childCount, expected);
});
test('store persists one versioned object across new instances and handles corrupt JSON', () => {
  const data = new Map(); const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const store = createStore(() => storage); store.load();
  const state = capture(started(), 'pikachu'); store.save(state);
  assert.equal(data.size, 1); assert.deepEqual(createStore(() => storage).load(), state);
  data.set(CONFIG.storageKey, '{broken'); const warnings = [];
  assert.deepEqual(createStore(() => storage, message => warnings.push(message)).load(), freshState()); assert.equal(warnings.length, 1);
});
test('unavailable getter, blocked writes, and quota errors preserve the current in-memory quest', () => {
  for (const getter of [() => { throw new Error('blocked getter'); }, () => ({ getItem: () => null, setItem: () => { throw new Error('quota'); } })]) {
    const warnings = []; const store = createStore(getter, message => warnings.push(message)); store.load();
    const state = capture(started(2), 'gengar'); store.save(state);
    assert.deepEqual(store.load(), state); assert.ok(warnings.some(message => message.includes('can’t save')));
  }
  let denied = false; const warnings = [];
  const storage = { getItem: () => null, setItem: () => { if (denied) throw new Error('quota'); } };
  const store = createStore(() => storage, message => warnings.push(message)); store.load(); denied = true;
  const state = capture(started(), 'pikachu'); store.save(state); assert.deepEqual(store.load(), state); assert.equal(warnings.length, 1);
});
test('QR destinations share the configured canonical HTTPS location', () => {
  const links = qrDestinations('https://quest.example.org/');
  assert.equal(links.length, 6); assert.equal(new Set(links.map(item => item.url)).size, 6);
  assert.equal(links[0].url, 'https://quest.example.org/?pokemon=pikachu');
  for (const base of ['', 'http://quest.example.org/', 'https://quest.example.org/?test=1', 'https://quest.example.org/#test', 'https://name:password@quest.example.org/']) assert.throws(() => qrDestinations(base));
});
test('cross-tab discovery merges converge to the same stable order', () => {
  const first = capture(started(3), 'pikachu');
  const second = capture(started(3), 'gengar');
  const merged = mergeStates(first, second);
  assert.deepEqual(merged, mergeStates(second, first));
  assert.deepEqual(merged, mergeStates(merged, first));
  assert.deepEqual(merged, mergeStates(merged, second));
  assert.deepEqual(merged.collected, ['pikachu', 'gengar']);
  const redeemed = transition(transition(started(4), { type: 'recover', ids: CONFIG.pokemon.map(item => item.id) }), { type: 'redeem' });
  assert.equal(mergeStates(first, redeemed).redeemed, true);
  assert.equal(mergeStates(redeemed, first).childCount, 4);
});

// SHEISTERS — heist rules. The host runs update(); everyone reads the same plain state object S.
import { L, restricted, setDoor, setVault, groundAt, rayT, los, findPath } from './level.js';
import { CLASSES, CREW, CALLOUTS, CARS, gunOf, money } from './data.js';

const H = new WeakMap();                         // host-only data per state
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const d2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const d3 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z, (a.y - b.y) * 1.5);
export const has = (p, perk) => p.perks.includes(perk);
const AWARE = { alert: 1, fight: 1 }, UP = { idle: 1, walk: 1, sus: 1, alert: 1, fight: 1, flee: 1, cower: 1 };
export const isBody = n => n.st === 'ko' || n.st === 'dead';

export function createState(seats, favor, crew) {
  const S = { t: 0, loud: false, why: '', alarmT: -1, alarmWhy: '', wave: 0, waveT: 0, take: 0, civKills: 0, cards: { a: -1, b: -1 }, doors: {}, cams: [], camsOff: false, jamT: 0,
    vault: { open: false, drill: 0, prog: 0, need: 75, r: [-9, -9], rp: 0 }, bags: [], pl: [], npc: [], prog: {}, used: {}, marks: {}, pings: [], ev: [], favor, over: null, order: -1, radios: 0 };
  for (const k in L.doors) S.doors[k] = { o: 0, l: L.doors[k].locked ? 1 : 0, n: 0 };
  if (favor === 'key' && S.doors.side) S.doors.side.l = 0;
  L.cams.forEach(c => S.cams.push({ d: 0, a: c.yaw }));
  seats.forEach((s, i) => {
    const sp = s.bot ? [[2.6, 4.6], [3.2, 8.2], [1.4, 6.6]][i % 3] : L.spawns[i % 4];
    S.pl.push({ id: s.id, name: s.name, ch: s.ch, cls: s.cls, perks: s.perks || [], bot: !!s.bot, x: sp[0], y: 0, z: sp[1], yaw: Math.PI, pitch: 0, cr: 0, mk: 0, mv: 0,
      body: -1, task: s.task || '', hp: 100, gun: s.gun || '', ar: (s.cls === 'muscle' ? 60 + ((s.perks || []).includes('skin') ? 50 : 0) : 20) + (s.armor | 0) * 30, dn: 0, dnT: 0, bags: 0, ab: 0, abCd: 0, it: null, sh: -9, wind: 0 });
  });
  const h = { npc: {}, bot: {}, tick: 0, nid: 0 };
  H.set(S, h);
  L.guards.forEach((g, i) => {
    const r = g.route[0];
    S.npc.push({ id: h.nid, k: 'guard', nm: g.name, x: r.x, y: r.y, z: r.z, yaw: g.face || 0, st: 'idle', det: 0, mv: 0, card: g.card ? 1 : 0, v: i, hp: 70 });
    h.npc[h.nid++] = { route: g.route, ri: 0, wait: g.route.length > 1 ? 1 + i : 1e9, face: g.face, cd: 1 };
  });
  L.civs.forEach((c, i) => {
    S.npc.push({ id: h.nid, k: 'civ', x: c.x, y: c.y, z: c.z, yaw: c.face, st: 'idle', det: 0, mv: 0, v: i, hp: 30, sit: c.sit || c.manager ? 1 : 0, job: c.teller ? 1 : c.manager ? 2 : 0 });
    h.npc[h.nid++] = { react: 0, cowT: 0, button: -1 };
  });
  L.vaultBags.forEach((b, i) => S.bags.push({ id: i, x: b[0], y: i >= 6 ? -3.3 : -4, z: b[1], st: 0, by: -1, v: 11000 + (i * 1733) % 5000 }));
  (L.safeBags || []).forEach((b, i) => S.bags.push({ id: 50 + i, x: b[0], y: 0, z: b[1], st: 3, by: -1, v: 16000 + i * 3500 }));
  S.job = L.job; S.car = crew && CARS[crew.car] ? crew.car : 'van'; S.bribes = (crew && crew.bribes) || [];
  S.crate = L.crate ? { x: L.crate.x, y: L.crate.y, z: L.crate.z, st: 0, h: [] } : { x: 0, y: 0, z: 0, st: 2, h: [] };
  if (favor === 'sheet') for (const n of S.npc) if (n.k === 'guard') S.marks[n.id] = 1e9;
  syncLevel(S);
  return S;
}
export function syncLevel(S) {
  for (const k in S.doors) setDoor(k, S.doors[k].o || S.doors[k].n);
  setVault(S.vault.open);
}

// ------------------------------------------------------------------ interactions (shared by host and clients)
export function interList(S) {
  const out = L.inter.slice();
  for (const n of S.npc) {
    if (n.k === 'guard' && (n.st === 'idle' || n.st === 'walk' || n.st === 'sus')) out.push({ id: 'guard:' + n.id, type: 'guard', n, x: n.x, y: n.y + 1, z: n.z, r: 1.7 });
    else if (isBody(n) && n.radio > 0) out.push({ id: 'radio:' + n.id, type: 'radio', n, x: n.x, y: n.y + .3, z: n.z, r: 2 });
    else if (isBody(n) && n.card) out.push({ id: 'body:' + n.id, type: 'body', n, x: n.x, y: n.y + .3, z: n.z, r: 1.8 });
    else if (isBody(n) && !n.hid && !(n.by >= 0)) out.push({ id: 'corpse:' + n.id, type: 'corpse', n, x: n.x, y: n.y + .3, z: n.z, r: 1.6 });
  }
  for (const b of S.bags) if (b.st === 0) out.push({ id: 'bag:' + b.id, type: 'bag', b, x: b.x, y: b.y + .3, z: b.z, r: 1.9 });
  if (S.crate.st === 0 && S.vault.open) out.push({ id: 'crate', type: 'crate', x: S.crate.x, y: S.crate.y + .4, z: S.crate.z, r: 2.1 });
  for (const p of S.pl) if (p.dn === 1) out.push({ id: 'rev:' + p.id, type: 'rev', p, x: p.x, y: p.y + .4, z: p.z, r: 2 });
  return out;
}
const crewHas = (S, c) => S.cards[c] >= 0;
export const bagCap = p => (p.cls === 'muscle' && has(p, 'mule') ? 2 : 1);
export function crewAtVan(S) { return S.pl.every(p => p.bot || p.dn === 2 || (p.dn === 0 && Math.hypot(p.x - L.van.x, p.z - L.van.z) < L.van.r + 1.5)); }

// returns null (nothing to do here) or { label, time, no (shown but blocked) }
export function interInfo(S, it, p) {
  const c = p.cls, mask = lab => p.mk ? null : { label: lab + ' — mask up first', no: true };
  switch (it.type) {
    case 'door': {
      const d = S.doors[it.door], nm = L.doors[it.door].name;
      if (!d.l) return { label: d.o ? 'Close the door' : 'Open — ' + nm, time: .12 };
      if (it.door !== 'side' && (S.cards.a === p.id || S.cards.b === p.id)) return { label: 'Swipe keycard — ' + nm, time: .4 };
      let t = c === 'safecracker' ? 2.5 : c === 'ghost' ? 6 : 9; if (has(p, 'nimble')) t /= 2;
      return mask('Pick the lock') || { label: 'Pick the lock — ' + nm, time: t };
    }
    case 'console': if (S.used.console) return null;
      return mask('Kill the camera feed') || { label: 'Kill the camera feed', time: c === 'safecracker' ? (has(p, 'tape') ? 1 : 2.5) : 8 };
    case 'desk': if (S.used.desk) return null;
      return mask("Search the manager's desk") || { label: "Search the manager's desk", time: 4 };
    case 'reader': if (S.vault.open) return null;
      if (!crewHas(S, 'a') || !crewHas(S, 'b')) return { label: 'Card reader — the crew needs both keycards', no: true };
      return mask('Turn the key') || { label: 'Hold — both readers must turn together', time: 1e9, reader: it.n };
    case 'drill': if (S.vault.open) return null;
      if (S.vault.drill === 0) return mask('Set up the drill') || { label: 'Set up the drill (it is not quiet)', time: 3 };
      if (S.vault.drill === 2) return { label: 'Un-jam the drill', time: 2 };
      return { label: 'Drilling… ' + Math.floor(S.vault.prog / S.vault.need * 100) + '%', no: true };
    case 'till': case 'depbox': {
      if (S.used[it.id]) return null;
      let t = it.type === 'till' ? 3 : 5; if (c === 'safecracker') t /= has(p, 'skeleton') ? 3 : 1.5;
      const lab = it.label || (it.type === 'till' ? 'Empty the register' : 'Crack the deposit box');
      return mask(lab) || { label: lab, time: t };
    }
    case 'case': if (S.used[it.id]) return null;
      return mask('Open the display case') || (c === 'safecracker' ? { label: 'Cut the glass — quiet', time: has(p, 'skeleton') ? 1.5 : 3.5 } : { label: 'Smash the case — LOUD', time: 1, smash: true });
    case 'safe': if (S.used.safe) return null;
      return mask('Crack the safe') || { label: 'Crack the safe', time: c === 'safecracker' ? (has(p, 'skeleton') ? 4 : 8) : 20 };
    case 'van':
      if (p.bags > 0) return { label: 'Throw the bag in the van', time: .25 };
      if (!crewAtVan(S)) return { label: 'Leave — waiting on the crew', no: true };
      return { label: S.take > 0 ? 'Drive off with ' + money(S.take) : 'Call it off and drive away', time: CARS[S.car].time };
    case 'guard': {
      const n = it.n, fx = Math.sin(n.yaw), fz = Math.cos(n.yaw), dx = p.x - n.x, dz = p.z - n.z, d = Math.hypot(dx, dz) || 1;
      if ((dx * fx + dz * fz) / d > .25) return p.mk || c === 'ghost' ? { label: 'Get behind him', no: true } : null;
      if (c === 'ghost' && n.card) return { label: 'Lift his keycard', time: has(p, 'fingers') ? 1.2 : 2.4, pick: true };
      let t = c === 'ghost' ? .7 : 2; if (has(p, 'sleeper')) t /= 2;
      return mask('Takedown') || { label: 'Takedown', time: t };
    }
    case 'radio': if (S.radios >= 4) return { label: 'His radio — dispatch will not buy another excuse', no: true };
      return { label: 'Answer his radio — ' + Math.ceil(it.n.radio) + 's', time: c === 'mastermind' ? 1 : 2.5 };
    case 'body': return { label: 'Take the keycard', time: .7 };
    case 'corpse': if (p.body >= 0 || S.loud) return null; return mask('Carry the body') || { label: 'Pick up the body — stash it out of sight', time: .8 };
    case 'stash': if (p.body < 0) return null; return { label: 'Stash the body in the ' + it.name, time: .6 };
    case 'crate': if (S.crate.h.includes(p.id)) return null;
      return mask('Lift the gold crate') || { label: S.crate.h.length ? 'Grab the other end of the gold crate' : 'Grab the gold crate — it takes two to carry', time: .4 };
    case 'bag': if (p.bags >= bagCap(p)) return { label: 'Hands full', no: true };
      return mask('Grab the bag') || { label: 'Grab the bag — ' + money(it.b.v), time: .5 };
    case 'rev': if (it.p.id === p.id) return null;
      return { label: 'Get ' + it.p.name + ' on their feet', time: has(p, 'feet') ? .6 : c === 'mastermind' ? 2 : 4 };
  }
  return null;
}
export function bestInter(S, p, list) {
  let best = null, bd = 1e9;
  for (const it of list || interList(S)) {
    const d = Math.hypot(it.x - p.x, it.z - p.z);
    if (d > it.r || Math.abs(it.y - (p.y + 1)) > 2) continue;
    const info = interInfo(S, it, p); if (!info) continue;
    const score = d + (info.no ? 5 : 0) + (it.type === 'door' ? .6 : 0);
    if (score < bd) { bd = score; best = { it, info }; }
  }
  return best;
}
export function objectives(S) {
  const o = [];
  if (S.over) return o;
  if (S.job !== 'bank') {
    const cases = L.inter.filter(i => i.type === 'case'), done = cases.filter(i => S.used[i.id]).length, bags = S.bags.filter(b => b.st !== 3), sec = bags.filter(b => b.st === 2).length;
    if (!S.loud && S.npc.some(n => n.radio > 0)) o.push('ANSWER THE RADIO on the guard you dropped! (' + S.radios + '/4 used)');
    if (cases.length) o.push('Clean out the display cases (' + done + '/' + cases.length + ') — smashing is loud, a Safecracker cuts quietly');
    else o.push('Hit the register and the ATM');
    o.push(S.used.safe ? 'Haul the bags to the van (' + sec + '/' + bags.length + ')' : S.job === 'jewel' ? "Crack the safe in the owner's office" : 'Crack the floor safe in the storage room');
    const kg = L.guards.find(g => g.card); if (S.cards.a < 0 && kg) o.push('· ' + kg.name + ' carries the key for the back door');
    if (!S.camsOff && !S.loud && L.inter.some(i => i.type === 'console')) o.push('Optional: kill the cameras from the office');
    o.push('Get the whole crew to the van and drive');
    return o;
  }
  if (!S.vault.open) {
    const cards = (crewHas(S, 'a') ? 1 : 0) + (crewHas(S, 'b') ? 1 : 0);
    if (S.vault.drill) o.push(S.vault.drill === 2 ? 'The drill is jammed — fix it' : 'Guard the drill — ' + Math.floor(S.vault.prog / S.vault.need * 100) + '%');
    else if (cards < 2) {
      o.push('Open the vault: find both keycards (' + cards + '/2) — or drill it');
      if (!crewHas(S, 'a')) o.push('· Chief Mahoney carries one (security room)');
      if (!crewHas(S, 'b')) o.push("· The other is in the manager's desk (upstairs)");
    } else o.push('Two of you: turn both vault readers together');
    if (!S.camsOff && !S.loud) o.push('Optional: kill the cameras from the security room');
  } else {
    const left = S.bags.filter(b => b.st !== 2 && b.st !== 3).length;
    o.push(left ? 'Haul the bags to the van (' + (S.bags.length - left) + '/' + S.bags.length + ')' : 'Every bag is in the van');
    if (S.crate.st === 0) o.push('Bonus: two of you walk the gold crate out ($60,000)');
    o.push('Get the whole crew to the van and drive');
  }
  if (!S.loud && S.npc.some(n => n.radio > 0)) o.unshift('ANSWER THE RADIO on the guard you dropped! (' + S.radios + '/4 used)');
  if (S.loud && !S.vault.open) o.push('Or cut your losses: get to the van');
  return o;
}

// ------------------------------------------------------------------ host: events and helpers
const ev = (S, e) => S.ev.push(e);
const msg = (S, s, c) => ev(S, { k: 'msg', s, c: c || '' });
const sfx = (S, n, o) => ev(S, { k: 'sfx', n, x: o ? o.x : 0, y: o ? o.y : 0, z: o ? o.z : 0, g: o ? 0 : 1 });
const sayN = (S, n, s) => ev(S, { k: 'say', n: n.id, s });

export function startAlarm(S, delay, why) {
  if (S.loud) return;
  if (S.alarmT < 0 || delay < S.alarmT) { if (S.alarmT < 0) msg(S, why + ' — the alarm is about to go!', 'warn'); S.alarmT = delay; S.alarmWhy = why; }
}
function goLoud(S, why) {
  if (S.loud) return;
  S.loud = true; S.why = why; S.alarmT = -1; S.waveT = 28 * (S.bribes.includes('beat') ? 1.3 : 1) + (S.favor === 'dispatch' ? 45 : 0);
  for (const n of S.npc) if (n.k === 'guard' && UP[n.st]) n.st = 'fight';
  msg(S, 'ALARM! ' + why + '. Cops are on the way.', 'bad'); sfx(S, 'alarm');
}
function damage(S, p, dmg) {
  if (p.dn) return;
  if (p.ab > 0 && p.cls === 'muscle') dmg *= .5;
  const a = Math.min(p.ar, dmg * .7); p.ar -= a; p.hp -= dmg - a;
  ev(S, { k: 'hurt', p: p.id });
  if (p.hp <= 0) {
    p.hp = 0; p.dn = 1; p.dnT = 40; p.it = null;
    for (const b of S.bags) if (b.st === 1 && b.by === p.id) { b.st = 0; b.by = -1; b.x = p.x; b.y = p.y; b.z = p.z; }
    p.bags = 0; if (p.body >= 0) dropBody(S, p); S.crate.h = S.crate.h.filter(i => i !== p.id);
    msg(S, p.name + ' is down!', 'bad'); sfx(S, 'down', p);
  }
}
// a guard who goes quiet gets a radio call; somebody has to answer for him
function radioCheck(S, n) { if (S.loud) return; n.radio = 12; sayN(S, n, 'kssht — ' + n.nm.split(' ').pop() + ', check in. Over.'); sfx(S, 'spot', n); msg(S, 'A radio is squawking. Answer it before dispatch gets nervous!', 'warn'); }
function dropBody(S, p) {
  const n = S.npc.find(n => n.id === p.body); p.body = -1; if (!n) return;
  n.by = -1; n.x = p.x; n.z = p.z; const g = groundAt(n.x, p.y + .4, n.z); n.y = g > -50 ? g : p.y; sfx(S, 'thud', n);
}
function hurtNpc(S, n, dmg, by) {
  if (!UP[n.st]) return;
  const quiet = n.k === 'guard' && !AWARE[n.st];
  if (quiet) dmg *= 4;
  n.hp -= dmg;
  if (n.hp <= 0) {
    n.st = 'dead'; n.mv = 0; n.det = 0; if (quiet) radioCheck(S, n);
    if (n.k === 'civ') { S.civKills++; msg(S, 'A civilian is dead. That costs the crew $5,000 in cleanup.', 'bad'); }
    if (n.k === 'guard' && by && has(by, 'clean')) n.hid = 1;
  } else if (n.k === 'guard' && !AWARE[n.st]) alertGuard(S, n, by);
}
function alertGuard(S, n, p) {
  if (AWARE[n.st]) return;
  n.st = S.loud ? 'fight' : 'alert'; n.det = 1;
  const h = H.get(S).npc[n.id]; h.alertT = 2.6; h.tgt = p ? p.id : -1; h.path = null; h.cd = 1;
  if (!S.loud) { sayN(S, n, ['Hey! HEY! Freeze!', 'Who the hell are you?!', 'Hold it right there!'][n.id % 3]); sfx(S, 'spot', n); }
}
function canSee(n, t, range, cosHalf, eye) {
  const dx = t.x - n.x, dz = t.z - n.z, d = Math.hypot(dx, dz);
  if (d > range || Math.abs(t.y - n.y) > 6) return 0;
  if (!(d < 1.4 && !t.cr && Math.abs(t.y - n.y) < 1)) { if ((dx * Math.sin(n.yaw) + dz * Math.cos(n.yaw)) / (d || 1) < cosHalf) return 0; }
  return los(n.x, n.y + 1.6, n.z, t.x, t.y + (eye || 1.25), t.z) ? Math.max(d, .5) : 0;
}
const detectable = p => p.dn === 0 && (p.mk || restricted(p.x, p.y, p.z));
const noticeMul = p => (p.cr ? .55 : 1) * (p.mv > 4.5 ? 1.35 : 1) * (has(p, 'shoes') ? .65 : 1) * (p.cls === 'ghost' && p.ab > 0 ? .12 : 1);

function goTo(n, h, x, y, z) { h.path = findPath(n.x, n.y, n.z, x, y, z); h.pi = 1; h.dest = { x, y, z }; }
function moveAlong(n, h, speed, dt) {
  if (!h.path || h.pi >= h.path.length) { n.mv = 0; return true; }
  const t = h.path[h.pi], dx = t.x - n.x, dz = t.z - n.z, d = Math.hypot(dx, dz), step = speed * dt;
  if (d <= step + .05) { n.x = t.x; n.z = t.z; h.pi++; }
  else { n.x += dx / d * step; n.z += dz / d * step; turn(n, Math.atan2(dx, dz), dt * 9); }
  const g = groundAt(n.x, n.y + .4, n.z); if (g > -50) n.y = g;
  n.mv = speed;
  return h.pi >= h.path.length;
}
function turn(n, yaw, k) { let d = yaw - n.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; n.yaw += d * Math.min(1, k); }
function nearestPlayer(S, n, needLos) {
  let best = null, bd = 1e9;
  for (const p of S.pl) {
    if (p.dn) continue; let d = d3(n, p);
    if (needLos && !los(n.x, n.y + 1.6, n.z, p.x, p.y + 1.2, p.z)) d += 40;
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}
function npcShoot(S, n, p, dmg) {
  const d = d3(n, p), chance = clamp(.78 - d * .024, .12, .78) * (p.cr ? .75 : 1) * (p.mv > 4.5 ? .8 : 1) * (p.bot ? .5 : 1);
  const hit = Math.random() < chance, o = hit ? 0 : .5 + Math.random();
  ev(S, { k: 'shot', a: [n.x + Math.sin(n.yaw) * .5, n.y + 1.4, n.z + Math.cos(n.yaw) * .5], b: [p.x + (Math.random() - .5) * o * 2, p.y + 1.1 + (Math.random() - .5) * o, p.z + (Math.random() - .5) * o * 2], w: 'cop' });
  if (hit) damage(S, p, dmg);
}

// ------------------------------------------------------------------ host: player events
export function playerEvent(S, p, e) {
  if (S.over || !p) return;
  if (e.k === 'call') { const c = CALLOUTS[e.i]; if (c) ev(S, { k: 'say', p: p.id, s: c[1][p.ch % 4], call: c[0] }); return; }
  if (e.k === 'ping') {
    S.pings.push({ x: e.x, y: e.y, z: e.z, by: p.id, t: S.t + 9, n: e.n === undefined ? -1 : e.n });
    if (S.pings.length > 8) S.pings.shift();
    if (e.n >= 0) S.marks[e.n] = Math.max(S.marks[e.n] || 0, S.t + 12);
    sfx(S, 'ping'); return;
  }
  if (p.dn) return;
  if (e.k === 'order') {
    if (!S.pl.some(q => q.bot)) return;
    const follow = !(S.order === p.id); S.order = follow ? p.id : -1;
    ev(S, { k: 'say', p: p.id, s: follow ? ['On me, all of you!', 'Stick close, boys.', 'Follow.', 'Come with me! Please!'][p.ch % 4] : ['Back to the van. Keep it running.', 'Go mind the van.', 'Hold the van.', 'Okay, wait by the van!'][p.ch % 4] });
    if (follow && !S.loud) msg(S, 'The AI partners will come in once it goes loud.', '');
    return;
  }
  if (e.k === 'mask' && !p.mk) { p.mk = 1; sfx(S, 'mask', p); return; }
  if (e.k === 'drop' && S.crate.h.includes(p.id)) { S.crate.h = S.crate.h.filter(i => i !== p.id); sfx(S, 'thud', S.crate); return; }
  if (e.k === 'drop' && p.body >= 0) { dropBody(S, p); return; }
  if (e.k === 'drop' && p.bags > 0) {
    const b = S.bags.find(b => b.st === 1 && b.by === p.id); if (!b) { p.bags = 0; return; }
    let x = p.x + Math.sin(p.yaw) * 1.6, z = p.z + Math.cos(p.yaw) * 1.6;
    if (rayT(p.x, p.y + 1, p.z, x, p.y + 1, z, 'cam') <= 1) { x = p.x; z = p.z; }
    const g = groundAt(x, p.y + .4, z);
    b.st = 0; b.by = -1; b.x = x; b.z = z; b.y = g > -50 ? g : p.y; p.bags--; sfx(S, 'thud', b); return;
  }
  if (e.k === 'shout' && p.mk) {
    const R = has(p, 'calm') ? 20 : p.cls === 'mastermind' ? 13 : 8, T = (p.cls === 'mastermind' ? 50 : 22) * (has(p, 'tongue') ? 2 : 1); let n = 0;
    for (const c of S.npc) {
      if (c.k !== 'civ' || !(c.st === 'idle' || c.st === 'flee' || c.st === 'cower') || d3(c, p) > R) continue;
      if (!has(p, 'calm') && !los(p.x, p.y + 1.5, p.z, c.x, c.y + 1, c.z)) continue;
      const h = H.get(S).npc[c.id]; c.st = 'cower'; c.mv = 0; h.cowT = Math.max(h.cowT, T); h.button = -1; h.path = null; n++;
    }
    ev(S, { k: 'say', p: p.id, s: ['EVERYBODY DOWN! On the floor, now!', 'Kiss the marble, people!', 'Down. All of you.', 'Nobody be a hero, okay?! Please?!'][p.ch % 4] }); sfx(S, 'shout', p);
    return;
  }
  if (e.k === 'abil' && p.abCd <= 0) {
    const A = CLASSES[p.cls].ability; p.abCd = A.cd;
    if (p.cls === 'mastermind') {
      const R = has(p, 'eyes') ? 50 : 30, T = has(p, 'eyes') ? 24 : 12; p.ab = 1;
      for (const n of S.npc) if (UP[n.st] && n.k !== 'civ' && d3(n, p) < R) S.marks[n.id] = Math.max(S.marks[n.id] || 0, S.t + T);
      S.camMark = S.t + T;
    } else if (p.cls === 'safecracker') { p.ab = 20; S.jamT = S.t + 20; }
    else if (p.cls === 'muscle') p.ab = has(p, 'dozer') ? 16 : 8;
    else p.ab = has(p, 'blend') ? 24 : 12;
    msg(S, p.name + ': ' + A.name + '!', 'good'); sfx(S, 'abil', p); return;
  }
  if (e.k === 'shot' && p.mk) {
    const G = gunOf(p), n = G.pellets || 1; p.sh = S.t;
    let dl = Math.hypot(e.d[0], e.d[1], e.d[2]) || 1; const D = e.d.map(v => v / dl);
    for (let i = 0; i < n; i++) {
      const d = [D[0] + (Math.random() - .5) * G.spread * 2, D[1] + (Math.random() - .5) * G.spread * 2, D[2] + (Math.random() - .5) * G.spread * 2];
      const R = 60, ex = e.o[0] + d[0] * R, ey = e.o[1] + d[1] * R, ez = e.o[2] + d[2] * R;
      let t = Math.min(1, rayT(e.o[0], e.o[1], e.o[2], ex, ey, ez, 'shot')), victim = null;
      for (const c of S.npc) {
        if (!UP[c.st]) continue;
        for (const [oy, r] of [[1.35, .38], [.65, .42]]) {
          const cy = c.y + oy - (c.st === 'cower' ? .6 : 0), px = c.x - e.o[0], py = cy - e.o[1], pz = c.z - e.o[2];
          const along = (px * d[0] + py * d[1] + pz * d[2]) / Math.hypot(d[0], d[1], d[2]); if (along < 0 || along / R > t) continue;
          const perp = Math.sqrt(Math.max(0, px * px + py * py + pz * pz - along * along));
          if (perp < r) { t = along / R; victim = c; }
        }
      }
      ev(S, { k: 'shot', a: e.o, b: [e.o[0] + d[0] * R * t, e.o[1] + d[1] * R * t, e.o[2] + d[2] * R * t], w: G.snd || p.cls, p: p.id, hit: victim ? 1 : 0 });
      if (victim) hurtNpc(S, victim, G.dmg * (p.cls === 'muscle' && has(p, 'buck') ? 1.25 : 1), p);
    }
    if (!S.loud) {
      if (!G.silent) { startAlarm(S, 1.5, 'Gunshots inside the bank'); for (const c of S.npc) if (c.k === 'civ') H.get(S).npc[c.id].panic = 1; }
      else for (const g of S.npc) if (g.k === 'guard' && !AWARE[g.st] && UP[g.st] && d3(g, p) < 5) alertGuard(S, g, p);
    }
  }
}

function interDone(S, it, info, p) {
  const h = H.get(S);
  switch (it.type) {
    case 'door': { const d = S.doors[it.door]; if (d.l) { d.l = 0; d.o = 1; sfx(S, 'unlock', it); } else { d.o = d.o ? 0 : 1; sfx(S, 'door', it); } break; }
    case 'console': S.used.console = 1; S.camsOff = true; msg(S, p.name + ' killed the camera feed.', 'good'); sfx(S, 'unlock', it); break;
    case 'desk': S.used.desk = 1; S.cards.b = p.id; msg(S, p.name + " found the manager's keycard.", 'good'); sfx(S, 'card', it); break;
    case 'drill': if (S.vault.drill === 0) { S.vault.need = 75 / (p.cls === 'safecracker' ? 2 : 1) / (has(p, 'thermite') ? 1.4 : 1); S.vault.nojam = has(p, 'bits') ? 1 : 0; h.jamAt = S.vault.need * (.3 + Math.random() * .3); msg(S, 'Drill is running. Keep them off it.', ''); }
      S.vault.drill = 1; sfx(S, 'unlock', it); break;
    case 'till': case 'depbox': S.used[it.id] = 1; S.take += it.value; ev(S, { k: 'cash', v: it.value, x: it.x, y: it.y, z: it.z }); sfx(S, 'cash', it); break;
    case 'case': S.used[it.id] = 1; S.take += it.value; ev(S, { k: 'cash', v: it.value, x: it.x, y: it.y, z: it.z }); sfx(S, info.smash ? 'smash' : 'cash', it);
      if (info.smash && !S.loud) { for (const g of S.npc) if (g.k === 'guard' && !AWARE[g.st] && UP[g.st] && d3(g, p) < 16) alertGuard(S, g, p); for (const c of S.npc) if (c.k === 'civ') H.get(S).npc[c.id].panic = 1; }
      break;
    case 'safe': S.used.safe = 1; for (const b of S.bags) if (b.st === 3) b.st = 0; msg(S, p.name + ' cracked the safe. Bag the stones!', 'good'); sfx(S, 'vault', it); break;
    case 'van':
      if (p.bags > 0) { for (const b of S.bags) if (b.st === 1 && b.by === p.id) { b.st = 2; b.by = -1; S.take += b.v; ev(S, { k: 'cash', v: b.v, x: it.x, y: 1.5, z: it.z }); } p.bags = 0; sfx(S, 'cash', it); }
      else finish(S, true, S.take > 0 ? 'Clean getaway.' : 'You walked away empty-handed.');
      break;
    case 'guard':
      if (info.pick) { it.n.card = 0; S.cards.a = p.id; msg(S, p.name + " lifted a keycard off " + it.n.nm + '.', 'good'); sfx(S, 'card', it); }
      else { it.n.st = 'ko'; it.n.mv = 0; it.n.det = 0; if (has(p, 'clean')) it.n.hid = 1; sfx(S, 'thud', it); radioCheck(S, it.n); }
      break;
    case 'radio': it.n.radio = 0; S.radios++; ev(S, { k: 'say', p: p.id, s: ['Yeah, all quiet here. Over.', 'False alarm, sweetheart. Over and out.', 'All clear.', 'Uh — everything is fine! We are fine. How are you?'][p.ch % 4] }); if (S.radios >= 4) msg(S, 'Dispatch is getting suspicious. No more radios can be answered.', 'warn'); break;
    case 'body': it.n.card = 0; S.cards.a = p.id; msg(S, p.name + " took " + it.n.nm + "'s keycard.", 'good'); sfx(S, 'card', it); break;
    case 'bag': it.b.st = 1; it.b.by = p.id; p.bags++; sfx(S, 'bag', it); break;
    case 'corpse': it.n.by = p.id; p.body = it.n.id; sfx(S, 'bag', it); break;
    case 'stash': { const n = S.npc.find(n => n.id === p.body); if (n) { n.hid = 1; n.by = -1; } p.body = -1; msg(S, p.name + ' stashed a body in the ' + it.name + '.', 'good'); sfx(S, 'thud', it); break; }
    case 'crate': if (S.crate.h.length < 2) { S.crate.h.push(p.id); sfx(S, 'bag', it); if (S.crate.h.length === 2) msg(S, 'Two on the crate. Walk it out together!', 'good'); } break;
    case 'rev': it.p.dn = 0; it.p.hp = has(p, 'feet') ? 100 : 50; msg(S, p.name + ' got ' + it.p.name + ' back up.', 'good'); sfx(S, 'abil', it); break;
  }
}
export function abort(S) { finish(S, false, 'The boss called it off.'); }
function finish(S, ok, why) {
  if (S.over) return;
  const humans = S.pl.filter(p => !p.bot), cut = S.pl.some(p => has(p, 'cut')) ? 1.15 : 1;
  const gross = ok ? S.take : 0, fees = S.civKills * 5000, stealth = ok && !S.loud && gross > 0;
  const judge = !ok && S.bribes.includes('judge') && S.take > 0;
  const total = Math.max(0, Math.round(((judge ? S.take * .4 : gross) * cut * (stealth ? 1.25 : 1)) - fees));
  S.over = { judge, ok, why, take: gross, fees, stealth, total, share: Math.round(total / 4), xp: ok ? 25 + Math.round(total / 1500) + (stealth ? 30 : 0) : 12, time: Math.round(S.t), lost: humans.filter(p => p.dn === 2).length };
}

// ------------------------------------------------------------------ host: main update
export function update(S, dt) {
  if (S.over) return;
  const h = H.get(S); S.t += dt; h.tick += dt;
  const slow = h.tick >= .1; if (slow) h.tick = 0;                 // sight checks run at 10 Hz
  const sdt = .1;

  // ---- players
  for (const p of S.pl) {
    if (p.abCd > 0) p.abCd -= dt; if (p.ab > 0) p.ab = Math.max(0, p.ab - dt);
    if (p.dn === 1) {
      p.dnT -= dt;
      if (p.cls === 'muscle' && has(p, 'wind') && !p.wind && p.dnT < 36) { p.wind = 1; p.dn = 0; p.hp = 45; msg(S, p.name + ' gets back up. Second wind.', 'good'); }
      else if (p.dnT <= 0) { p.dn = 2; msg(S, p.name + ' has been dragged off in cuffs.', 'bad'); }
    }
    if (p.bot) botUpdate(S, h, p, dt);
    for (const b of S.bags) if (b.st === 1 && b.by === p.id) { b.x = p.x; b.y = p.y + 1.1; b.z = p.z; }
    if (p.body >= 0) { const n = S.npc.find(n => n.id === p.body); if (n) { n.x = p.x - Math.sin(p.yaw) * .25; n.z = p.z - Math.cos(p.yaw) * .25; n.y = p.y + 1.0; n.yaw = p.yaw + Math.PI / 2; } }
  }
  // the gold crate: two carriers, it rides between them
  const C = S.crate;
  if (C.st === 0 && C.h.length) {
    const hs = C.h.map(id => S.pl.find(p => p.id === id)).filter(p => p && !p.dn);
    C.h = hs.filter(p => Math.hypot(p.x - C.x, p.z - C.z) < 3.2).map(p => p.id);
    if (C.h.length === 2) {
      C.x = (hs[0].x + hs[1].x) / 2; C.z = (hs[0].z + hs[1].z) / 2; const g = groundAt(C.x, Math.max(hs[0].y, hs[1].y) + .5, C.z); if (g > -50) C.y = g;
      if (Math.hypot(C.x - L.van.x, C.z - L.van.z) < 3 && Math.abs(C.y) < .5) { C.st = 2; C.h = []; S.take += L.crate.v; ev(S, { k: 'cash', v: L.crate.v, x: C.x, y: 1.5, z: C.z }); msg(S, 'The gold crate is in the van!', 'good'); sfx(S, 'cash'); }
    }
  }
  // ---- held interactions
  const list = interList(S), held = {};
  S.vault.r[0] = S.vault.r[0] > -5 ? S.vault.r[0] : -9;
  for (const p of S.pl) {
    if (!p.it || p.dn) continue;
    const it = list.find(i => i.id === p.it); if (!it || Math.hypot(it.x - p.x, it.z - p.z) > it.r + .6) continue;
    const info = interInfo(S, it, p); if (!info || info.no) continue;
    if (info.reader !== undefined) { S.vault.r[info.reader] = S.t; continue; }
    if (held[it.id]) continue; held[it.id] = 1;
    const pr = S.prog[it.id] || (S.prog[it.id] = { p: 0, by: p.id });
    pr.p += dt; pr.by = p.id; pr.t = info.time;
    if (pr.p >= info.time) { delete S.prog[it.id]; interDone(S, it, info, p); if (S.over) return; }
  }
  for (const k in S.prog) if (!held[k]) { S.prog[k].p -= dt * 3; if (S.prog[k].p <= 0) delete S.prog[k]; }
  // two-person vault turn
  if (!S.vault.open) {
    const both = S.t - S.vault.r[0] < .25 && S.t - S.vault.r[1] < .25;
    S.vault.rp = both ? S.vault.rp + dt : Math.max(0, S.vault.rp - dt * 2);
    if (S.vault.rp >= 1.6) openVault(S, 'The readers turn green. The door swings.');
    if (S.vault.drill === 1) {
      S.vault.prog += dt;
      if (!S.vault.nojam && h.jamAt && S.vault.prog >= h.jamAt) { h.jamAt = h.jamAt < S.vault.need * .6 ? S.vault.need * (.7 + Math.random() * .15) : 0; S.vault.drill = 2; msg(S, 'The drill jammed!', 'warn'); sfx(S, 'jam', { x: -4.4, y: -3, z: -15.5 }); }
      if (S.vault.prog >= S.vault.need) openVault(S, 'The drill punches through.');
      if (!S.loud && slow) for (const n of S.npc) if (n.k === 'guard' && !AWARE[n.st] && UP[n.st] && Math.abs(n.y + 4) < 2 && Math.hypot(n.x + 4.4, n.z + 15.5) < 11) { n.det += .2 * sdt; if (n.det >= 1) alertGuard(S, n, nearestPlayer(S, n)); }
    }
  }
  // ---- doors that open for people in uniform
  if (slow) for (const k in S.doors) {
    const d = S.doors[k], D = L.doors[k]; let near = 0;
    for (const n of S.npc) if (n.mv > 0 && Math.abs(n.y - D.y) < 1 && Math.hypot(n.x - D.x, n.z - D.z) < 1.4) { near = 1; break; }
    d.n = near;
  }
  // ---- people
  for (const n of S.npc) {
    const m = h.npc[n.id];
    if (n.k === 'civ') civUpdate(S, n, m, dt, slow, sdt); else lawUpdate(S, n, m, dt, slow, sdt);
  }
  for (const n of S.npc) if (n.radio > 0 && !S.loud && !(S.jamT > S.t)) { n.radio -= dt; if (n.radio <= 0) { n.radio = 0; startAlarm(S, 3, n.nm + ' never answered his radio'); } }
  // ---- cameras
  const jam = S.jamT > S.t;
  L.cams.forEach((c, i) => {
    const sc = S.cams[i]; sc.a = c.yaw + Math.sin(S.t * .45 + i * 2) * c.sweep;
    if (!slow || S.loud) return;
    if (S.camsOff || jam) { sc.d = Math.max(0, sc.d - .5 * sdt); return; }
    let see = 0; const cam = { x: c.x, y: c.y - 1.6, z: c.z, yaw: sc.a };
    for (const p of S.pl) { if (!detectable(p)) continue; const d = canSee(cam, p, c.range, .8); if (d) see = Math.max(see, noticeMul(p) * (1.5 - d / c.range)); }
    sc.d = clamp(sc.d + (see ? see * .9 : -.3) * sdt, 0, 1);
    if (sc.d >= 1) startAlarm(S, 1.5, 'The ' + c.name.toLowerCase() + ' camera got a good look at you');
  });
  // ---- alarm and police
  if (!S.loud && S.alarmT >= 0) { S.alarmT -= dt; if (S.alarmT <= 0) goLoud(S, S.alarmWhy); }
  if (S.loud) {
    S.waveT -= dt;
    if (S.waveT <= 0) {
      S.wave++; S.waveT = 27 * (S.bribes.includes('captain') ? 1.4 : 1);
      const alive = S.npc.filter(n => (n.k === 'cop' || n.k === 'swat') && UP[n.st]).length, count = Math.min(Math.max(2, Math.min(3 + S.wave, 7) - (S.bribes.includes('dispatch') ? 1 : 0)), 11 - alive);
      for (let i = 0; i < count; i++) {
        const sp = L.copSpawns[(S.wave + i) % L.copSpawns.length], swat = S.wave >= 3 && i % 2 === 0;
        S.npc.push({ id: h.nid, k: swat ? 'swat' : 'cop', x: sp[0] + (Math.random() - .5) * 3, y: 0, z: sp[1] + (Math.random() - .5) * 3, yaw: 0, st: 'fight', det: 1, mv: 0, v: i, hp: swat ? 170 : 75 });
        h.npc[h.nid++] = { cd: 1 + Math.random(), rep: Math.random() };
      }
      if (count > 0) { msg(S, S.wave === 1 ? 'First squad cars are here!' : S.wave >= 3 ? 'ESU is rolling in — heavy units!' : 'More cops on the block!', 'bad'); sfx(S, 'siren'); }
    }
  }
  for (const k in S.marks) if (S.marks[k] < S.t) delete S.marks[k];
  S.pings = S.pings.filter(p => p.t > S.t);
  // ---- lose
  const humans = S.pl.filter(p => !p.bot);
  if (humans.length && humans.every(p => p.dn > 0) && !humans.some(p => p.dn === 1 && p.cls === 'muscle' && has(p, 'wind') && !p.wind)) {
    if (!S.pl.some(p => p.bot && p.dn === 0) || humans.every(p => p.dn === 2)) finish(S, false, 'The whole crew is down. NYPD sends its regards.');
  }
  syncLevel(S);
}
function openVault(S, why) {
  S.vault.open = true; S.vault.drill = 0; msg(S, why + ' Vault is open — bag it up!', 'good'); sfx(S, 'vault', { x: -5, y: -3, z: -15.5 });
  if (!S.loud && S.vault.prog > 0) startAlarm(S, 20, 'The vault sensor tripped');
}

function lawUpdate(S, n, m, dt, slow, sdt) {
  if (!UP[n.st]) return;
  const guard = n.k === 'guard';
  if (guard && !AWARE[n.st]) {
    // ---- stealth senses
    if (slow) {
      let see = 0, who = null;
      for (const p of S.pl) {
        if (!detectable(p)) continue; const d = canSee(n, p, 17, .52, p.cr ? .8 : 1.25); if (!d) continue;
        const r = noticeMul(p) * (1.9 - d / 17 * 1.6); if (r > see) { see = r; who = p; }
      }
      for (const b of S.npc) if (isBody(b) && !b.hid && b.id !== n.id && canSee(n, b, 13, .45, .3)) { n.det = 1; who = who || nearestPlayer(S, n); sayN(S, n, 'Man down! We got a man down!'); }
      n.det = clamp(n.det + (see ? see : -.3) * sdt, 0, 1);
      if (who) m.sus = { x: who.x, z: who.z };
      if (n.det >= 1) { alertGuard(S, n, who); return; }
      const was = n.st; n.st = n.det > .4 ? 'sus' : (n.st === 'sus' ? 'idle' : n.st);
      if (n.st === 'sus' && was !== 'sus') { sayN(S, n, ['Huh? Somebody there?', 'What was that?', 'Hello?'][n.id % 3]); m.path = null; }
    }
    if (n.st === 'sus') { n.mv = 0; if (m.sus) turn(n, Math.atan2(m.sus.x - n.x, m.sus.z - n.z), dt * 3); return; }
    // ---- patrol
    if (m.wait > 0) {
      m.wait -= dt; n.mv = 0; n.st = 'idle';
      if (m.face !== undefined && m.ri === (m.route.length > 1 ? 1 : 0)) turn(n, m.face + Math.sin(S.t * .4 + n.id) * .5, dt * 2);
      if (m.wait <= 0 && m.route.length > 1) { const r = m.route[m.ri]; goTo(n, m, r.x, r.y, r.z); }
      return;
    }
    n.st = 'walk';
    if (!m.path) { const r = m.route[m.ri]; goTo(n, m, r.x, r.y, r.z); if (!m.path) { m.wait = 3; return; } }
    if (moveAlong(n, m, 1.5, dt)) { m.wait = m.route[m.ri].wait; m.ri = (m.ri + 1) % m.route.length; m.path = null; }
    return;
  }
  // ---- alerted or fighting
  const p = nearestPlayer(S, n, true); if (!p) { n.mv = 0; return; }
  const d = d3(n, p), sees = slow ? (m.sees = los(n.x, n.y + 1.6, n.z, p.x, p.y + 1.2, p.z)) : m.sees;
  if (n.st === 'alert') {
    n.mv = 0; turn(n, Math.atan2(p.x - n.x, p.z - n.z), dt * 8);
    if (!(S.jamT > S.t)) m.alertT -= dt;
    if (m.alertT <= 0) { startAlarm(S, 0, n.nm + ' radioed it in'); return; }
  } else {
    m.rep = (m.rep || 0) - dt;
    if (!sees || d > 13) {
      if (m.rep <= 0 || !m.path) { m.rep = 1 + Math.random() * .6; goTo(n, m, p.x, p.y, p.z); }
      moveAlong(n, m, n.k === 'swat' ? 3.4 : 3.9, dt);
    } else n.mv = 0;
    if (sees) turn(n, Math.atan2(p.x - n.x, p.z - n.z), dt * 8);
  }
  m.cd -= dt;
  if (sees && d < 26 && m.cd <= 0) { m.cd = n.k === 'swat' ? .45 : .75 + Math.random() * .4; npcShoot(S, n, p, n.k === 'swat' ? 12 : guard ? 8 : 9); }
}

function civUpdate(S, n, m, dt, slow, sdt) {
  if (n.st === 'dead' || n.st === 'gone') return;
  if (slow && (n.st === 'idle')) {
    let scare = S.loud || m.panic;
    if (!scare) for (const p of S.pl) if (p.dn === 0 && p.mk && canSee(n, p, 15, -.2)) { scare = 1; break; }
    if (!scare) for (const b of S.npc) if (isBody(b) && !b.hid && canSee(n, b, 10, -.2, .3)) { scare = 1; break; }
    if (scare) { m.react += sdt; if (m.react > .7) panic(S, n, m); } else m.react = Math.max(0, m.react - sdt);
  }
  if (n.st === 'cower') {
    n.mv = 0; m.cowT -= dt;
    if (m.cowT <= 0) {
      let watched = false; for (const p of S.pl) if (p.dn === 0 && p.mk && d3(n, p) < 11 && los(p.x, p.y + 1.5, p.z, n.x, n.y + .6, n.z)) watched = true;
      if (watched || S.loud) m.cowT = 4; else { n.st = 'idle'; m.react = 1; m.panic = 1; }
    }
  } else if (n.st === 'flee') {
    if (!m.path) { n.st = 'gone'; return; }
    if (moveAlong(n, m, 4.6, dt)) { n.st = 'gone'; if (!S.loud) startAlarm(S, 7, 'A witness made it to a payphone'); }
  } else if (m.button >= 0) {
    m.button -= dt; n.mv = 0;
    if (m.button < 0) { n.st = 'cower'; m.cowT = 1e9; if (!S.loud) startAlarm(S, 0, n.job === 2 ? 'The manager hit the silent alarm' : 'A teller hit the panic button'); }
  }
}
function panic(S, n, m) {
  if (n.job && !S.loud) { if (m.button < 0) { m.button = 3.2; n.sit = 0; ev(S, { k: 'say', n: n.id, s: n.job === 2 ? 'Oh no. Oh no no no.' : 'Oh my God —' }); } return; }
  n.sit = 0;
  const ex = L.exits[n.x < 0 ? 0 : 1]; goTo(n, m, ex[0], 0, ex[1]);
  if (n.y > 1 || !m.path) { n.st = 'cower'; m.cowT = 1e9; return; }
  n.st = 'flee'; if (Math.random() < .5) ev(S, { k: 'say', n: n.id, s: ['AAAH!', 'They got guns!', 'Somebody call the cops!', 'Don\'t shoot!'][n.id % 4] });
}

// AI partners: they hold the van, cover the street once it goes loud, and pick up anyone who drops nearby
function botUpdate(S, h, p, dt) {
  const b = h.bot[p.id] || (h.bot[p.id] = { cd: 1, home: { x: p.x, y: 0, z: p.z }, rep: 0 });
  if (p.dn) { p.mv = 0; return; }
  if (!S.loud) { p.mv = 0; p.yaw += (Math.PI + Math.sin(S.t * .3 + p.id) * .8 - p.yaw) * dt; return; }
  p.mk = 1;
  const lead = S.order >= 0 ? S.pl.find(q => q.id === S.order && q.dn !== 2) : null;
  const downed = S.pl.find(q => q.dn === 1 && q.id !== p.id && (lead ? d3(q, p) < 40 : Math.hypot(q.x - L.van.x, q.z - L.van.z) < 26 && Math.abs(q.y) < 1));
  const goal = downed || lead || b.home, dg = d3(p, goal), stop = downed ? 1.4 : lead ? 2.6 + (p.id % 3) * .9 : .6;
  p.it = null;
  if (dg > stop) {
    b.rep -= dt; if (b.rep <= 0 || !b.path) { b.rep = 1; b.path = findPath(p.x, p.y, p.z, goal.x, goal.y || 0, goal.z); b.pi = 1; }
    if (b.path && b.pi < b.path.length) { const t = b.path[b.pi], dx = t.x - p.x, dz = t.z - p.z, d = Math.hypot(dx, dz); if (d < .25) b.pi++; else { const v = lead ? 5.4 : 4.2; p.x += dx / d * v * dt; p.z += dz / d * v * dt; p.yaw = Math.atan2(dx, dz); } const g = groundAt(p.x, p.y + .4, p.z); if (g > -50) p.y = g; }
    p.mv = 4.2;
  } else { p.mv = 0; if (downed) p.it = 'rev:' + downed.id; }
  let tgt = null, bd = 30;
  for (const n of S.npc) { if (n.k === 'civ' || !UP[n.st]) continue; const d = d3(n, p); if (d < bd && los(p.x, p.y + 1.5, p.z, n.x, n.y + 1.2, n.z)) { bd = d; tgt = n; } }
  b.cd -= dt;
  if (tgt) {
    if (!p.mv) p.yaw = Math.atan2(tgt.x - p.x, tgt.z - p.z);
    if (b.cd <= 0) { b.cd = .5 + Math.random() * .4; p.sh = S.t; const hit = Math.random() < .55;
      ev(S, { k: 'shot', a: [p.x, p.y + 1.4, p.z], b: [tgt.x, tgt.y + 1.2 + (hit ? 0 : 1), tgt.z], w: p.cls, p: p.id }); if (hit) hurtNpc(S, tgt, 16, p); }
  }
}

export const snapshot = S => JSON.stringify(S, (k, v) => typeof v === 'number' ? Math.round(v * 100) / 100 : v);

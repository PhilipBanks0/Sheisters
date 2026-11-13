'use strict';
/* SHEISTERS — a 4-player top-down heist game set in New York City.
   Single-screen co-op: 2 keyboard seats + gamepads, AI fills the rest. */

// ------------------------------------------------------------------ basics
const W = 1280, H = 720, T = 32, COLS = 40, ROWS = 21, HUD = 48, PI = Math.PI;
const $ = s => document.querySelector(s);
const cv = $('#game'), ctx = cv.getContext('2d'), ui = $('#ui'), stage = $('#stage');
const rnd = (a, b) => a + Math.random() * (b - a);
const rint = (a, b) => Math.floor(rnd(a, b + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const money = n => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');
const tc = v => (v + .5) * T;                       // tile -> pixel centre
const tx = v => clamp(Math.floor(v / T), 0, COLS - 1);
const ty = v => clamp(Math.floor(v / T), 0, ROWS - 1);
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// tile ids
const ROAD = 0, WALK = 1, FLOOR = 2, WALL = 3, ROOF = 4, DOOR = 5, VAULT = 6, COUNTER = 7, FIX = 8, GRASS = 9, TRUCK = 10;
const solid = t => t === WALL || t === ROOF || t === VAULT || t === COUNTER || t === FIX || t === TRUCK;
const opaque = t => t === WALL || t === ROOF || t === VAULT || t === TRUCK;

// ------------------------------------------------------------------ data
const WEAPONS = {
  knife: { name: 'Switchblade', price: 0, dmg: 34, cd: .4, melee: true, range: 50, desc: 'Silent. Drops an unaware guard in one hit.' },
  snub:  { name: '.38 Snubnose', price: 900, dmg: 24, cd: .45, spread: .07, range: 330, desc: 'Loud, cheap, gets the point across.' },
  nine:  { name: '9mm Pistol', price: 3000, dmg: 21, cd: .26, spread: .05, range: 380, desc: 'Faster trigger, tighter grouping.' },
  sawed: { name: 'Sawed-Off', price: 8000, dmg: 13, pellets: 6, cd: .85, spread: .3, range: 240, desc: 'Six pellets. Clears a doorway.' },
  smg:   { name: 'Street Sweeper SMG', price: 20000, dmg: 13, cd: .085, spread: .11, range: 360, desc: 'Sprays the whole block.' },
  rifle: { name: 'Assault Rifle', price: 55000, dmg: 30, cd: .13, spread: .045, range: 460, desc: 'Punches through tactical units.' },
};
const VEHICLES = {
  rust:   { name: "'89 Rustbucket", price: 0, cap: 3000, speed: 0, start: 4.5, color: '#8a7350', desc: 'It starts. Eventually.' },
  muscle: { name: 'Bronx Bruiser V8', price: 5000, cap: 10000, speed: 2, start: 3, color: '#c0271f', desc: 'Small trunk, big engine.' },
  van:    { name: "Plumber's Van", price: 18000, cap: 60000, speed: 1, start: 3.5, color: '#d8d8d2', desc: 'Nobody looks twice at a plumber.' },
  suv:    { name: 'Armored SUV', price: 70000, cap: 250000, speed: 3, start: 2.5, color: '#20232b', desc: 'Outruns most of the precinct.' },
  heli:   { name: 'Getaway Chopper', price: 350000, cap: 2000000, speed: 6, start: 2, color: '#35506b', desc: 'Roadblocks are a ground problem.' },
};
const GEAR = {
  armor: { name: 'Body Armor', prices: [3000, 12000, 40000], desc: '+35 health for the whole crew per level.' },
  drill: { name: 'Safecracking Kit', prices: [2000, 9000, 30000], desc: 'Safes, vaults and registers open 50% faster per level.' },
};
const BRIBES = {
  beat:     { name: 'Beat Cop on the Take', price: 2000, desc: 'He walks slow. Police response takes 30% longer.' },
  dispatch: { name: '911 Dispatcher', price: 12000, desc: 'Calls get "lost". One fewer unit in every wave.' },
  judge:    { name: 'Night Court Judge', price: 25000, desc: 'Bail for busted crew is cut by 75%.' },
  captain:  { name: 'Precinct Captain', price: 45000, desc: 'Wanted level climbs 40% slower.' },
};
const CREW = [
  { name: 'Vinnie', color: '#f5c518' }, { name: 'Roz', color: '#ff5d73' },
  { name: 'Dutch', color: '#4dc3ff' }, { name: 'Keys', color: '#7be07b' },
];
const JOBS = [
  { id: 'stickup', name: 'Street Stickups', hood: "Hell's Kitchen", tier: 1, rep: 0, response: 20, est: [500, 1200], street: true, civs: 12,
    sec: 'No security. Witnesses run for a phone.', blurb: 'Wallets, watches and tourists. Shake down citizens until somebody dials 911, then get to the car.', floor: ['#4a4d55', '#4a4d55'], sign: 'W 46th ST' },
  { id: 'bodega', name: 'Corner Bodega', hood: 'Bushwick', tier: 1, rep: 2, response: 18, est: [1200, 2200],
    sec: 'One clerk with a panic button.', blurb: 'Empty the register and crack the floor safe behind the counter.', floor: ['#c9c2a8', '#b8b096'], sign: '24HR DELI · GROCERY · ATM' },
  { id: 'pawn', name: 'Pawn Shop', hood: 'Jamaica, Queens', tier: 2, rep: 6, response: 17, est: [5000, 8500],
    sec: 'Armed owner, one guard in the back room.', blurb: 'Display cases up front, the real money is in the back-room safe.', floor: ['#75634f', '#685746'], sign: 'CASH 4 GOLD · PAWN' },
  { id: 'jewel', name: 'Jewelry Store', hood: 'Diamond District', tier: 3, rep: 14, response: 15, est: [18000, 27000],
    sec: '2 guards. Smashing glass is loud.', blurb: 'Eight cases of stones and an office safe. Smash, grab, go.', floor: ['#e6e0d6', '#d3ccc0'], sign: '47th ST FINE JEWELERS' },
  { id: 'truck', name: 'Armored Truck', hood: 'Meatpacking District', tier: 3, rep: 24, response: 13, est: [36000, 54000], street: true, civs: 0,
    sec: '3 armed couriers.', blurb: 'A cash truck is idling at the loading dock. Three crates in the back.', floor: ['#4a4d55', '#4a4d55'], sign: 'GANSEVOORT ST' },
  { id: 'bank', name: 'Bank Branch', hood: 'Midtown', tier: 4, rep: 40, response: 12, est: [85000, 125000],
    sec: '4 guards, drilled vault door.', blurb: 'Teller drawers for pocket money. Drill the vault for the payday.', floor: ['#d9d2bd', '#c4bca4'], sign: 'FIRST EMPIRE SAVINGS' },
  { id: 'gold', name: 'Bullion Depository', hood: 'Financial District', tier: 5, rep: 65, response: 10, est: [400000, 560000],
    sec: '7 guards, hardened vault, fast response.', blurb: 'Six pallets of gold under Wall Street. The score that ends careers.', floor: ['#9aa3ad', '#89929c'], sign: 'LIBERTY BULLION DEPOSITORY' },
];

// ------------------------------------------------------------------ save
const SAVE_KEY = 'sheisters-save-v1';
const freshSave = () => ({ cash: 0, rep: 0, heat: 0, weapons: ['knife'], loadout: ['knife', 'knife', 'knife', 'knife'], vehicles: ['rust'], vehicle: 'rust', armor: 0, drill: 0, bribes: {}, done: 0 });
let S = freshSave(), hasSave = false;
try { const raw = localStorage.getItem(SAVE_KEY); if (raw) { S = Object.assign(freshSave(), JSON.parse(raw)); hasSave = true; } } catch (e) { /* storage unavailable */ }
const save = () => { if (NET.role === 'guest') return; try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } };

// ------------------------------------------------------------------ audio
let AC = null;
function sfx(kind) {
  if (NET.role === 'host' && mode === 'play' && NET.sfxQ.length < 12) NET.sfxQ.push(kind);
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime;
    const P = { shot: ['square', 190, 50, .07, .05], cash: ['sine', 880, 1500, .16, .08], alarm: ['sawtooth', 620, 940, .5, .07], hurt: ['triangle', 160, 70, .15, .08], open: ['sine', 440, 990, .3, .08], knife: ['triangle', 900, 300, .06, .04] }[kind];
    o.type = P[0]; o.frequency.setValueAtTime(P[1], t); o.frequency.exponentialRampToValueAtTime(P[2], t + P[3]);
    g.gain.setValueAtTime(P[4], t); g.gain.exponentialRampToValueAtTime(.001, t + P[3]);
    o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + P[3]);
  } catch (e) { /* audio blocked */ }
}

// ------------------------------------------------------------------ input
const keys = {};
const NET = { ws: null, role: null, id: null, status: '', inputs: {}, peers: new Set(), seats: [], fill: true, addrs: [], sfxQ: [], snapT: 0, inT: 0 };
let EID = 0;
let mode = 'title', tab = 'jobs', selJob = 'stickup', M = null;
const seats = [null, null, null, null];     // {ctl:'kb1'|'kb2'|'pad', pad}
let fillBots = true, crewDefs = [];

addEventListener('keydown', e => {
  keys[e.code] = true;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (NET.role === 'guest') return;
  if (mode === 'title') {
    if (e.code === 'Space') join({ ctl: 'kb1' });
    if (e.code === 'Enter' || e.code === 'NumpadEnter') join({ ctl: 'kb2' });
  } else if (mode === 'play' && M) {
    if (e.code === 'Escape') M.paused = !M.paused;
    if (e.code === 'KeyQ' && M.paused) { M.paused = false; if (!M.alarm && M.take === 0) renderHideout(); else finish(false, 'The crew gave themselves up.'); }
  }
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

function join(seat) {
  if (NET.role === 'guest') return;
  if (seats.some(s => s && s.ctl === seat.ctl && s.pad === seat.pad)) return;
  const i = seats.indexOf(null); if (i < 0) return;
  seats[i] = seat; renderTitle();
}
function pollPadsForJoin() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const gp of pads) if (gp && gp.buttons[0] && gp.buttons[0].pressed) join({ ctl: 'pad', pad: gp.index });
}
const NOIN = { mx: 0, my: 0, ax: 0, ay: 0, shoot: false, act: false };
function readInput(c) {
  if (c.ctl === 'net') { const i = NET.inputs[c.id]; return i && performance.now() - i.at < 500 ? i : NOIN; }   // stale input = stand still
  if (c.ctl === 'bot') return NOIN;
  if (c.ctl === 'kb1') return { mx: (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0), my: (keys.KeyS ? 1 : 0) - (keys.KeyW ? 1 : 0), ax: 0, ay: 0, shoot: !!keys.Space, act: !!keys.KeyE };
  if (c.ctl === 'kb2') return { mx: (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0), my: (keys.ArrowDown ? 1 : 0) - (keys.ArrowUp ? 1 : 0), ax: 0, ay: 0, shoot: !!(keys.Enter || keys.NumpadEnter || keys.Slash), act: !!(keys.ShiftRight || keys.Period || keys.Numpad0) };
  const gp = navigator.getGamepads ? navigator.getGamepads()[c.pad] : null;
  if (!gp) return NOIN;
  const dz = v => Math.abs(v) < .25 ? 0 : v, b = i => !!(gp.buttons[i] && gp.buttons[i].pressed);
  return { mx: dz(gp.axes[0] || 0) + (b(15) ? 1 : 0) - (b(14) ? 1 : 0), my: dz(gp.axes[1] || 0) + (b(13) ? 1 : 0) - (b(12) ? 1 : 0), ax: dz(gp.axes[2] || 0), ay: dz(gp.axes[3] || 0), shoot: b(7) || b(5) || b(2), act: b(0) || b(6) };
}
const ctlLabel = s => NET.role === 'guest' ? (s.id === NET.id ? 'You' : s.ctl === 'net' ? 'Online player' : 'Host') : s.ctl === 'net' ? 'Online player' : s.ctl === 'kb1' ? 'Keyboard · WASD' : s.ctl === 'kb2' ? 'Keyboard · Arrows' : 'Gamepad ' + (s.pad + 1);

// ------------------------------------------------------------------ level building
function Lvl(plaza) {
  const g = [];
  for (let y = 0; y < ROWS; y++) { g.push([]); for (let x = 0; x < COLS; x++) g[y].push(y >= 16 ? ROAD : (y >= 14 || (plaza && y >= 6)) ? WALK : ROOF); }
  return { g, cont: [], guards: [], civs: [], spawn: { x: 23, y: 15 }, veh: { x: 25, y: 18 } };
}
function line(L, x0, y0, x1, y1, t) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) L.g[y][x] = t; }
function room(L, x0, y0, x1, y1) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) L.g[y][x] = (x === x0 || x === x1 || y === y0 || y === y1) ? WALL : FLOOR; }
function cont(L, x, y, type, value, time, loud, label) { L.g[y][x] = type === 'vault' ? VAULT : FIX; L.cont.push({ x, y, type, value, time, loud, label, prog: 0, open: false }); }
function guard(L, x, y, a) { L.guards.push({ kind: 'guard', x: tc(x), y: tc(y), r: 11, a, a0: a, ph: rnd(0, 6), hp: 60, hostile: false, det: 0, cd: rnd(.3, .9), rate: .75, dmg: 10, range: 300, speed: 95 }); }
function civ(L, x, y, clerk) {
  const inside = L.g[y][x] === FLOOR;
  L.civs.push({ id: ++EID, x: tc(x), y: tc(y), r: 10, a: rnd(0, 6), clerk: !!clerk, inside, state: 'walk', cash: clerk ? 0 : rint(60, 220), mug: 0, wt: rnd(0, 3), tg: null, color: ['#c98bd1', '#8bb7d1', '#d1b18b', '#9fd18b', '#d18b8b', '#b0b0c8', '#e0c070'][rint(0, 6)] });
}
const doors = L => { L.g[13][19] = DOOR; L.g[13][20] = DOOR; };

const BUILD = {
  stickup() {
    const L = Lvl(true); L.spawn = { x: 17, y: 15 }; L.veh = { x: 20, y: 18 };
    line(L, 4, 8, 12, 11, GRASS);
    line(L, 16, 9, 17, 9, FIX); line(L, 28, 8, 29, 8, FIX); line(L, 33, 12, 33, 12, FIX); line(L, 22, 7, 23, 7, FIX); line(L, 8, 13, 8, 13, FIX);
    for (let i = 0; i < 10; i++) { let x, y; do { x = rint(1, 38); y = rint(6, 13); } while (solid(L.g[y][x]) || (Math.abs(x - 18) < 5 && y > 11)); civ(L, x, y); }
    return L;
  },
  bodega() {
    const L = Lvl(); room(L, 13, 5, 26, 13); doors(L);
    line(L, 15, 8, 19, 8, COUNTER); cont(L, 17, 8, 'register', [500, 900], 2.5, true, 'Register');
    civ(L, 17, 7, true);
    line(L, 22, 8, 22, 11, FIX); line(L, 24, 8, 24, 11, FIX);
    cont(L, 14, 6, 'safe', [700, 1300], 7, true, 'Floor safe');
    civ(L, 23, 10);
    return L;
  },
  pawn() {
    const L = Lvl(); room(L, 10, 3, 29, 13); doors(L);
    line(L, 10, 6, 29, 6, WALL); L.g[6][27] = DOOR;
    cont(L, 12, 4, 'safe', [2500, 4000], 9, false, 'Back-room safe');
    line(L, 12, 9, 17, 9, COUNTER); cont(L, 14, 9, 'register', [600, 1100], 2.5, true, 'Register');
    guard(L, 14, 8, PI / 2); guard(L, 22, 4, PI);
    for (const x of [21, 24, 27]) cont(L, x, 10, 'case', [700, 1300], 1.8, true, 'Display case');
    civ(L, 24, 8);
    return L;
  },
  jewel() {
    const L = Lvl(); room(L, 8, 2, 31, 13); doors(L);
    line(L, 8, 5, 31, 5, WALL); L.g[5][11] = DOOR;
    cont(L, 30, 3, 'safe', [7000, 10000], 11, false, 'Office safe');
    for (const y of [8, 11]) for (const x of [12, 16, 23, 27]) cont(L, x, y, 'case', [1200, 2200], 1.8, true, 'Jewelry case');
    guard(L, 20, 7, PI / 2); guard(L, 24, 3, 0);
    civ(L, 14, 10); civ(L, 25, 10); civ(L, 10, 7, true);
    return L;
  },
  truck() {
    const L = Lvl(true); L.spawn = { x: 28, y: 15 }; L.veh = { x: 31, y: 18 };
    line(L, 8, 8, 13, 10, TRUCK);
    for (const y of [8, 9, 10]) cont(L, 14, y, 'crate', [12000, 18000], 6, true, 'Cash crate');
    line(L, 20, 8, 20, 8, FIX); line(L, 20, 11, 20, 12, FIX); line(L, 24, 10, 24, 10, FIX); line(L, 5, 12, 6, 12, FIX); line(L, 16, 13, 17, 13, FIX);
    guard(L, 16, 9, 0); guard(L, 11, 12, PI / 2); guard(L, 10, 7, PI);
    return L;
  },
  bank() {
    const L = Lvl(); room(L, 6, 1, 33, 13); doors(L);
    line(L, 7, 7, 27, 7, COUNTER); line(L, 28, 7, 33, 7, WALL); L.g[7][30] = DOOR;
    line(L, 6, 6, 13, 6, WALL); line(L, 13, 1, 13, 6, WALL);
    cont(L, 13, 4, 'vault', 0, 20, false, 'Vault door');
    for (const [x, y] of [[7, 2], [9, 2], [11, 2], [7, 5], [9, 5]]) cont(L, x, y, 'cash', [14000, 20000], 2.5, false, 'Cash pallet');
    for (const x of [10, 14, 18, 22]) cont(L, x, 7, 'register', [3000, 5000], 3, true, 'Teller drawer');
    for (const x of [14, 18, 22]) civ(L, x, 6, true);
    guard(L, 12, 10, 0); guard(L, 27, 10, PI); guard(L, 20, 4, PI); guard(L, 30, 3, PI / 2);
    civ(L, 15, 10); civ(L, 22, 11); civ(L, 17, 9);
    return L;
  },
  gold() {
    const L = Lvl(); room(L, 4, 1, 35, 13); doors(L);
    line(L, 4, 9, 35, 9, WALL); L.g[9][19] = DOOR; L.g[9][20] = DOOR;
    line(L, 14, 1, 14, 6, WALL); line(L, 25, 1, 25, 6, WALL); line(L, 14, 6, 25, 6, WALL);
    cont(L, 19, 6, 'vault', 0, 26, false, 'Vault door');
    for (const [x, y] of [[15, 2], [18, 2], [21, 2], [24, 2], [15, 5], [24, 5]]) cont(L, x, y, 'gold', [60000, 85000], 4, false, 'Gold pallet');
    for (const y of [3, 5, 7]) cont(L, 34, y, 'boxes', [15000, 25000], 6, false, 'Deposit boxes');
    line(L, 5, 5, 13, 5, WALL); L.g[5][11] = DOOR;
    cont(L, 5, 2, 'safe', [30000, 40000], 12, false, 'Security safe');
    guard(L, 10, 11, 0); guard(L, 29, 11, PI); guard(L, 12, 8, 0); guard(L, 27, 8, PI); guard(L, 30, 4, PI / 2); guard(L, 8, 3, PI); guard(L, 22, 7, PI);
    return L;
  },
};

// ------------------------------------------------------------------ grid helpers
function bfs(srcs) {
  const d = new Int16Array(COLS * ROWS).fill(-1), q = [];
  for (const [x, y] of srcs) { if (solid(M.g[y][x])) continue; const i = y * COLS + x; if (d[i] < 0) { d[i] = 0; q.push(i); } }
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % COLS, y = (i / COLS) | 0;
    for (const [dx, dy] of N4) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      const j = ny * COLS + nx; if (d[j] >= 0 || solid(M.g[ny][nx])) continue;
      d[j] = d[i] + 1; q.push(j);
    }
  }
  return d;
}
function fieldDir(e, f) {
  const x = tx(e.x), y = ty(e.y), d = f[y * COLS + x]; if (d <= 0) return null;
  let bx = -1, by = -1, bd = d;
  for (const [dx, dy] of N4) {
    const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
    const v = f[ny * COLS + nx]; if (v >= 0 && v < bd) { bd = v; bx = nx; by = ny; }
  }
  if (bx < 0) return null;
  const vx = tc(bx) - e.x, vy = tc(by) - e.y, l = Math.hypot(vx, vy) || 1;
  return [vx / l, vy / l];
}
function blocked(x, y, r) {
  for (const sx of [-r, r]) for (const sy of [-r, r]) {
    const px = x + sx, py = y + sy;
    if (px < 0 || py < 0 || px >= COLS * T || py >= ROWS * T) return true;
    if (solid(M.g[Math.floor(py / T)][Math.floor(px / T)])) return true;
  }
  return false;
}
function move(e, dx, dy) {
  const r = e.r * .8;
  if (!blocked(e.x + dx, e.y, r)) e.x += dx;
  if (!blocked(e.x, e.y + dy, r)) e.y += dy;
}
function los(ax, ay, bx, by) {
  const d = Math.hypot(bx - ax, by - ay), n = Math.ceil(d / 10);
  for (let i = 1; i < n; i++) { const x = ax + (bx - ax) * i / n, y = ay + (by - ay) * i / n; if (opaque(M.g[ty(y)][tx(x)])) return false; }
  return true;
}
const angDiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

// ------------------------------------------------------------------ mission
function startJob(job) {
  const L = BUILD[job.id](), veh = VEHICLES[S.vehicle];
  M = { job, L, g: L.g, cont: L.cont, guards: L.guards, civs: L.civs, cops: [], bullets: [], fx: [], texts: [], crew: [], take: 0,
    alarm: false, eta: 0, arrived: false, tArr: 0, stars: 0, maxStars: 0, waveT: 0, esc: 0, t: 0, msg: '', msgT: 0, fT: 0, civT: 2,
    paused: false, over: false, shake: 0, lead: null, veh: { x: tc(L.veh.x), y: tc(L.veh.y), def: veh } };
  const maxhp = 100 + 35 * S.armor;
  crewDefs.forEach((d, i) => {
    if (!S.weapons.includes(S.loadout[i])) S.loadout[i] = 'knife';
    M.crew.push(Object.assign({}, d, { slot: i, x: tc(L.spawn.x + i * 1.1), y: tc(L.spawn.y), r: 11, a: -PI / 2, hp: maxhp, maxhp, weapon: S.loadout[i], cd: 0, down: false, rev: 0, hurtT: 9, act: null, actCiv: null }));
  });
  const ex = []; for (let y = 0; y < ROWS; y++) { ex.push([0, y]); ex.push([COLS - 1, y]); }
  M.fExit = bfs(ex);
  refreshFields(); drawMap();
  mode = 'play'; ui.innerHTML = '';
  say(job.name + ' — ' + job.hood);
  if (NET.role === 'host') netSend(startMsg());
}
function say(t) { M.msg = t; M.msgT = 3.2; }
function pop(x, y, txt, col) { M.texts.push({ x, y, txt, col: col || '#5fd38d', t: 0 }); }
function refreshFields() {
  const up = M.crew.filter(c => !c.down);
  M.lead = M.crew.find(c => c.human && !c.down) || M.crew.find(c => c.human) || null;
  M.fCrew = bfs(up.map(c => [tx(c.x), ty(c.y)]));
  M.fLead = M.lead ? bfs([[tx(M.lead.x), ty(M.lead.y)]]) : M.fCrew;
}
function alarm(why) {
  if (M.alarm) return;
  M.alarm = true;
  M.eta = M.job.response * (S.bribes.beat ? 1.3 : 1) * (1 - .5 * S.heat / 100);
  for (const g of M.guards) g.hostile = true;
  for (const v of M.civs) v.state = v.inside ? 'cower' : 'flee';
  say(why + '  NYPD ETA ' + Math.ceil(M.eta) + 's');
  sfx('alarm');
}
function nearestHostile(c, range, alertedOnly) {
  let best = null, bd = range;
  for (const list of [M.cops, M.guards]) for (const e of list) {
    if (e.dead || (alertedOnly && e.kind === 'guard' && !e.hostile)) continue;
    const d = dist(c, e); if (d < bd && los(c.x, c.y, e.x, e.y)) { bd = d; best = e; }
  }
  return best;
}
function hurtEnemy(e, d) {
  e.hp -= d;
  M.fx.push({ type: 'spark', x: e.x, y: e.y, t: 0, life: .2, col: '#ff6b5e' });
  if (e.hp <= 0) { e.dead = true; if (e.kind !== 'guard' && M.arrived) M.tArr += 4; }
  else if (e.kind === 'guard' && !e.hostile) alarm('A guard raised the alarm!');
}
function fire(c) {
  const w = WEAPONS[c.weapon]; c.cd = w.cd;
  if (w.melee) {
    sfx('knife'); M.fx.push({ type: 'swing', x: c.x, y: c.y, a: c.a, t: 0, life: .15 });
    for (const list of [M.cops, M.guards]) for (const e of list) {
      if (e.dead || dist(c, e) > w.range + e.r) continue;
      if (angDiff(Math.atan2(e.y - c.y, e.x - c.x), c.a) < 1.1) hurtEnemy(e, e.kind === 'guard' && !e.hostile ? 999 : w.dmg);
    }
    return;
  }
  sfx('shot');
  if (!M.alarm) alarm('Shots fired!');
  for (let i = 0; i < (w.pellets || 1); i++) {
    const a = c.a + rnd(-w.spread, w.spread);
    M.bullets.push({ x: c.x + Math.cos(c.a) * 14, y: c.y + Math.sin(c.a) * 14, vx: Math.cos(a) * 780, vy: Math.sin(a) * 780, dmg: w.dmg, crew: true, life: w.range / 780 });
  }
  M.fx.push({ type: 'flash', x: c.x + Math.cos(c.a) * 18, y: c.y + Math.sin(c.a) * 18, t: 0, life: .06 });
}
function botInput(c) {
  const lead = M.lead, w = WEAPONS[c.weapon]; let mx = 0, my = 0;
  const tgt = M.alarm ? nearestHostile(c, w.melee ? 130 : w.range, true) : null;
  if (tgt && w.melee) { mx = tgt.x - c.x; my = tgt.y - c.y; }
  else if (lead && lead !== c && dist(c, lead) > (lead.down ? 22 : 46 + c.slot * 12)) {
    const d = fieldDir(c, M.fLead);
    if (d) { mx = d[0]; my = d[1]; } else { mx = lead.x - c.x; my = lead.y - c.y; }
  }
  return { mx, my, ax: 0, ay: 0, shoot: !!tgt && (!w.melee || dist(c, tgt) < w.range + 8), act: false };
}
function updCrew(c, dt) {
  if (c.down) {
    const near = M.crew.some(o => !o.down && dist(o, c) < 36);
    c.rev = near ? c.rev + dt : Math.max(0, c.rev - dt);
    if (c.rev >= 3) { c.down = false; c.hp = c.maxhp * .4; c.rev = 0; c.hurtT = 0; pop(c.x, c.y - 20, c.name + ' is up!', '#fff'); }
    return;
  }
  const inp = c.human ? readInput(c) : botInput(c), w = WEAPONS[c.weapon];
  let mx = inp.mx, my = inp.my; const l = Math.hypot(mx, my); if (l > 1) { mx /= l; my /= l; }
  move(c, mx * 150 * dt, my * 150 * dt);
  const tgt = nearestHostile(c, w.melee ? 70 : w.range, !c.human);
  if (Math.hypot(inp.ax, inp.ay) > .4) c.a = Math.atan2(inp.ay, inp.ax);
  else if (tgt) c.a = Math.atan2(tgt.y - c.y, tgt.x - c.x);
  else if (l > .1) c.a = Math.atan2(my, mx);
  c.cd -= dt; if (inp.shoot && c.cd <= 0) fire(c);
  c.act = null; c.actCiv = null;
  if (c.human && inp.act) {
    let bd = 58;
    for (const k of M.cont) { if (k.open) continue; const d = Math.hypot(tc(k.x) - c.x, tc(k.y) - c.y); if (d < bd) { bd = d; c.act = k; } }
    if (!c.act) { bd = 44; for (const v of M.civs) { if (v.clerk || v.cash <= 0) continue; const d = dist(c, v); if (d < bd) { bd = d; c.actCiv = v; } } }
  }
  c.hurtT += dt; if (c.hurtT > 4 && c.hp < c.maxhp) c.hp = Math.min(c.maxhp, c.hp + 5 * dt);
}
function openCont(k) {
  k.open = true;
  if (k.type === 'vault') { M.g[k.y][k.x] = DOOR; drawMap(); say('VAULT OPEN'); sfx('open'); return; }
  const val = rint(k.value[0], k.value[1]);
  M.take += val; pop(tc(k.x), tc(k.y) - 14, '+' + money(val)); sfx('cash');
}
function updCiv(v, dt) {
  if (v.state === 'cower' || v.state === 'hands' || (v.clerk && v.state !== 'flee')) return;
  if (v.state === 'flee') {
    const d = fieldDir(v, M.fExit);
    if (d) { move(v, d[0] * 135 * dt, d[1] * 135 * dt); v.a = Math.atan2(d[1], d[0]); }
    const x = tx(v.x); if (x <= 0 || x >= COLS - 1) { v.gone = true; if (!M.alarm) alarm('A witness called 911!'); }
    return;
  }
  if (v.tg) {
    const dx = v.tg.x - v.x, dy = v.tg.y - v.y, d = Math.hypot(dx, dy); v.wt -= dt;
    if (d < 6 || v.wt <= 0) { v.tg = null; v.wt = rnd(.5, 3); return; }
    v.a = Math.atan2(dy, dx); move(v, dx / d * 38 * dt, dy / d * 38 * dt);
  } else {
    v.wt -= dt; if (v.wt > 0) return;
    const x = clamp(tx(v.x) + rint(-6, 6), 1, COLS - 2), y = clamp(ty(v.y) + rint(-4, 4), 0, ROWS - 1), t = M.g[y][x];
    if (v.inside ? t === FLOOR : (t === WALK || t === GRASS)) { v.tg = { x: tc(x), y: tc(y) }; v.wt = 6; }
  }
}
function updLaw(e, dt) {
  let tgt = null, bd = 1e9;
  for (const c of M.crew) { if (c.down) continue; const d = dist(c, e); if (d < bd) { bd = d; tgt = c; } }
  if (!tgt) return;
  const see = bd < e.range && los(e.x, e.y, tgt.x, tgt.y);
  if (see) {
    e.a = Math.atan2(tgt.y - e.y, tgt.x - e.x);
    e.cd -= dt;
    if (e.cd <= 0) {
      e.cd = e.rate * rnd(.8, 1.25);
      const a = e.a + rnd(-.12, .12);
      M.bullets.push({ x: e.x + Math.cos(e.a) * 14, y: e.y + Math.sin(e.a) * 14, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, dmg: e.dmg, crew: false, life: .8 });
      M.fx.push({ type: 'flash', x: e.x + Math.cos(e.a) * 18, y: e.y + Math.sin(e.a) * 18, t: 0, life: .06 });
      sfx('shot');
    }
  }
  if (!see || bd > 150) {
    const d = fieldDir(e, M.fCrew), sp = e.speed * (see ? .6 : 1);
    if (d) { move(e, d[0] * sp * dt, d[1] * sp * dt); if (!see) e.a = Math.atan2(d[1], d[0]); }
    else if (!see) move(e, Math.cos(e.a) * sp * dt, Math.sin(e.a) * sp * dt);
  }
}
function spawnWave() {
  const live = M.cops.filter(c => !c.dead).length;
  let n = Math.max(1, 1 + M.stars - (S.bribes.dispatch ? 1 : 0));
  n = Math.min(n, 4 + M.stars * 2 - live);
  for (let i = 0; i < n; i++) {
    const swat = M.stars >= 3 && Math.random() < .25 + .15 * (M.stars - 3);
    M.cops.push({ id: ++EID, kind: swat ? 'swat' : 'cop', x: tc(Math.random() < .5 ? 0 : COLS - 1), y: tc(rint(16, 20)), r: 11, a: 0, hp: swat ? 110 : 45, cd: rnd(.4, 1), rate: swat ? .3 : .85, dmg: swat ? 7 : 8, range: swat ? 340 : 300, speed: swat ? 95 : 105 });
  }
}
function update(dt) {
  if (M.paused || M.over) return;
  M.t += dt; M.msgT -= dt; M.shake = Math.max(0, M.shake - dt);
  M.fT -= dt; if (M.fT <= 0) { M.fT = .25; refreshFields(); }

  for (const c of M.crew) updCrew(c, dt);

  // cracking containers
  for (const k of M.cont) {
    if (k.open || !M.crew.some(c => !c.down && c.act === k)) continue;
    const kx = tc(k.x), ky = tc(k.y), n = M.crew.filter(c => !c.down && Math.hypot(c.x - kx, c.y - ky) < 70).length;
    if (k.loud && !M.alarm) alarm(M.job.street ? 'The couriers hit the alarm!' : 'Somebody hit the panic button!');
    k.prog += dt * (1 + .5 * (n - 1)) * (1 + .5 * S.drill) / k.time;
    if (k.prog >= 1) openCont(k);
  }
  // muggings
  for (const v of M.civs) {
    if (v.clerk || v.cash <= 0) continue;
    if (M.crew.some(c => c.actCiv === v)) {
      v.state = 'hands'; v.mug += dt / 1.0;
      if (v.mug >= 1) {
        M.take += v.cash; pop(v.x, v.y - 16, '+' + money(v.cash)); sfx('cash'); v.cash = 0;
        if (v.inside) { alarm('Screams from inside!'); v.state = 'cower'; }
        else {
          v.state = 'flee';
          for (const o of M.civs) if (o !== v && !o.inside && o.state === 'walk' && dist(o, v) < 200 && los(o.x, o.y, v.x, v.y)) o.state = 'flee';
        }
      }
    } else if (v.state === 'hands') { v.state = v.inside ? (M.alarm ? 'cower' : 'walk') : 'flee'; v.mug = 0; }
  }
  for (const v of M.civs) updCiv(v, dt);
  M.civs = M.civs.filter(v => !v.gone);
  if (M.job.civs && !M.alarm) {
    M.civT -= dt;
    if (M.civT <= 0 && M.civs.length < M.job.civs) {
      M.civT = 3.5; const x = Math.random() < .5 ? 0 : COLS - 1, y = rint(6, 15);
      if (!solid(M.g[y][x])) civ(M.L, x, y);
    }
  }
  // guards
  for (const g of M.guards) {
    if (g.dead) continue;
    if (g.hostile) { updLaw(g, dt); continue; }
    g.a = g.a0 + Math.sin(M.t * .8 + g.ph) * .6;
    let seen = false, close = false;
    for (const c of M.crew) {
      if (c.down) continue; const d = dist(c, g);
      if (d < 190 && angDiff(Math.atan2(c.y - g.y, c.x - g.x), g.a) < .87 && los(g.x, g.y, c.x, c.y)) { seen = true; if (d < 90) close = true; }
    }
    g.det = seen ? g.det + dt * (close ? 2 : 1) / 1.1 : Math.max(0, g.det - dt * .5);
    if (g.det >= 1) alarm('Security spotted the crew!');
  }
  // police response
  if (M.alarm && !M.arrived) { M.eta -= dt; if (M.eta <= 0) { M.arrived = true; M.waveT = 0; say('NYPD ON SCENE'); sfx('alarm'); } }
  if (M.arrived) {
    M.tArr += dt;
    M.stars = Math.min(5, (S.heat >= 70 ? 2 : 1) + Math.floor(M.tArr / (25 * (S.bribes.captain ? 1.4 : 1))));
    M.maxStars = Math.max(M.maxStars, M.stars);
    M.waveT -= dt; if (M.waveT <= 0) { spawnWave(); M.waveT = Math.max(5, 10 - M.stars); }
  }
  for (const c of M.cops) if (!c.dead) updLaw(c, dt);
  // keep the law from stacking up
  const law = M.cops.concat(M.guards).filter(e => !e.dead);
  for (let i = 0; i < law.length; i++) for (let j = i + 1; j < law.length; j++) {
    const a = law[i], b = law[j], d = dist(a, b);
    if (d > 0 && d < 20) { const px = (a.x - b.x) / d * (20 - d) * .5, py = (a.y - b.y) / d * (20 - d) * .5; move(a, px, py); move(b, -px, -py); }
  }
  // bullets
  for (const b of M.bullets) {
    const steps = Math.ceil(780 * dt / 8);
    for (let s = 0; s < steps && !b.dead; s++) {
      b.x += b.vx * dt / steps; b.y += b.vy * dt / steps;
      if (b.x < 0 || b.y < 0 || b.x >= COLS * T || b.y >= ROWS * T || opaque(M.g[ty(b.y)][tx(b.x)])) { b.dead = true; M.fx.push({ type: 'spark', x: b.x, y: b.y, t: 0, life: .12, col: '#ffd27a' }); break; }
      if (b.crew) {
        for (const list of [M.cops, M.guards]) for (const e of list) if (!e.dead && !b.dead && Math.hypot(e.x - b.x, e.y - b.y) < e.r + 2) { hurtEnemy(e, b.dmg); b.dead = true; }
      } else for (const c of M.crew) if (!c.down && !b.dead && Math.hypot(c.x - b.x, c.y - b.y) < c.r + 1) {
        b.dead = true; c.hp -= b.dmg; c.hurtT = 0; M.shake = .12; sfx('hurt');
        if (c.hp <= 0) { c.down = true; c.rev = 0; c.act = null; c.actCiv = null; say(c.name + ' is down! Stand over them to revive.'); }
      }
    }
    b.life -= dt; if (b.life <= 0) b.dead = true;
  }
  M.bullets = M.bullets.filter(b => !b.dead);
  M.cops = M.cops.filter(c => !c.dead || (c.rot = (c.rot || 0) + dt) < 6);
  for (const f of M.fx) f.t += dt; M.fx = M.fx.filter(f => f.t < f.life);
  for (const t of M.texts) t.t += dt; M.texts = M.texts.filter(t => t.t < 1.4);

  // getaway
  const up = M.crew.filter(c => c.human && !c.down);
  const inZone = up.length > 0 && up.every(c => dist(c, M.veh) < 84);
  M.esc = (inZone && (M.take > 0 || M.alarm)) ? M.esc + dt : Math.max(0, M.esc - dt * 2);
  if (M.esc >= M.veh.def.start) return finish(true);
  if (M.crew.every(c => c.down)) finish(false, 'The whole crew went down.');
}

// ------------------------------------------------------------------ results
function finish(ok, why) {
  M.over = true; mode = 'result';
  const job = M.job, veh = M.veh.def, judge = S.bribes.judge ? .25 : 1, repBefore = S.rep;
  let rows = '', net = 0, notes = '';
  if (ok) {
    const fit = Math.min(M.take, veh.cap), left = M.take - fit;
    const lossPct = clamp(M.stars * .09 - veh.speed * .1, 0, .6), chase = Math.round(fit * lossPct);
    const behind = M.crew.filter(c => c.down).length, bail = Math.min(Math.round(behind * job.tier * 400 * judge), Math.max(0, S.cash + fit - chase));
    net = fit - chase - bail;
    rows = `<tr><td>Loot grabbed</td><td class="pos">${money(M.take)}</td></tr>`
      + (left ? `<tr><td>Wouldn't fit in the ${veh.name}</td><td class="neg">${money(-left)}</td></tr>` : '')
      + (chase ? `<tr><td>Dumped during the chase (${M.stars}★ pursuit)</td><td class="neg">${money(-chase)}</td></tr>` : '')
      + (bail ? `<tr><td>Bail for ${behind} crew left behind</td><td class="neg">${money(-bail)}</td></tr>` : '');
    if (M.take > 0) S.rep += job.tier * 2;
    S.heat = clamp(S.heat + (M.alarm ? 6 + M.maxStars * 5 : -5), 0, 100);
    notes = (M.take > 0 ? `Street rep <b>+${job.tier * 2}</b>. ` : 'No loot, no respect. ')
      + (M.alarm ? `City heat rose to <b>${Math.round(S.heat)}%</b>.` : 'Clean job — nobody called it in. City heat cooled off.')
      + (left ? ` <b>Buy a bigger vehicle</b> to haul the whole score.` : '');
  } else {
    const bail = Math.min(S.cash, Math.round((S.cash * .2 + job.tier * 300) * judge));
    net = -bail;
    rows = `<tr><td>Loot confiscated</td><td class="neg">${money(-M.take)}</td></tr><tr><td>Bail${S.bribes.judge ? ' (the judge is a friend)' : ''}</td><td class="neg">${money(-bail)}</td></tr>`;
    S.heat = clamp(S.heat + 10 + M.maxStars * 4, 0, 100);
    notes = `${why || ''} City heat is now <b>${Math.round(S.heat)}%</b>.`;
  }
  S.cash = Math.max(0, S.cash + net); S.done++;
  const unlocked = JOBS.filter(j => j.rep > repBefore && j.rep <= S.rep).map(j => j.name);
  if (unlocked.length) notes += `<br>New job on the board: <b>${unlocked.join(', ')}</b>.`;
  save();
  ui.innerHTML = `<div class="result ${ok ? '' : 'bad'}">
    <h1>${ok ? (M.take > 0 ? 'Clean getaway' : 'Walked away') : 'Busted'}</h1>
    <div class="sub">${job.name} · ${job.hood}</div>
    <table>${rows}<tr class="net"><td>Crew stash</td><td class="${net < 0 ? 'neg' : 'pos'}">${net < 0 ? '' : '+'}${money(net)}</td></tr></table>
    <div class="notes">${notes}</div>
    <button class="btn" data-a="hideout">Back to the hideout</button></div>`;
  netUI();
}

// ------------------------------------------------------------------ drawing: map
const mapC = document.createElement('canvas'); mapC.width = COLS * T; mapC.height = ROWS * T;
function drawMap() {
  const c = mapC.getContext('2d'), g = M.g, job = M.job, hasCont = {};
  for (const k of M.cont) hasCont[k.x + ',' + k.y] = true;
  const floorAt = (x, y) => job.street ? '#4a4d55' : job.floor[(x + y) & 1];
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const t = g[y][x], px = x * T, py = y * T, h = (x * 7 + y * 13 + x * y) % 11;
    if (t === ROAD) {
      c.fillStyle = '#24262c'; c.fillRect(px, py, T, T);
      if (y === 18 && x % 2 === 0) { c.fillStyle = '#c9a227'; c.fillRect(px + 4, py + 14, 24, 4); }
      if (y === 16) { c.fillStyle = '#6d7079'; c.fillRect(px, py, T, 3); }
      if (h === 3) { c.fillStyle = '#1c1e23'; c.fillRect(px + 6, py + 9, 13, 5); }
    } else if (t === WALK || (t === FIX && job.street) || t === TRUCK) {
      c.fillStyle = '#4a4d55'; c.fillRect(px, py, T, T); c.strokeStyle = '#3d4047'; c.strokeRect(px + .5, py + .5, T, T);
      if (t === FIX && !hasCont[x + ',' + y]) { c.fillStyle = '#2f5d3a'; c.fillRect(px + 2, py + 4, T - 4, T - 8); c.fillStyle = '#e8e3d0'; c.fillRect(px + 5, py + 8, T - 10, 5); c.fillStyle = '#1d3a24'; c.fillRect(px + 2, py + T - 8, T - 4, 4); }
    } else if (t === GRASS) {
      c.fillStyle = '#2f4d36'; c.fillRect(px, py, T, T); c.fillStyle = '#3a5f43'; c.fillRect(px + (h * 3) % 24, py + (h * 5) % 24, 4, 4);
      if (h === 5) { c.fillStyle = '#1f3a27'; c.beginPath(); c.arc(px + 16, py + 16, 12, 0, 7); c.fill(); c.fillStyle = '#2a5236'; c.beginPath(); c.arc(px + 13, py + 13, 7, 0, 7); c.fill(); }
    } else if (t === ROOF) {
      c.fillStyle = h % 2 ? '#16171c' : '#191a20'; c.fillRect(px, py, T, T);
      if (h === 4) { c.fillStyle = '#2b2d35'; c.fillRect(px + 6, py + 8, 20, 14); c.fillStyle = '#1f2026'; c.fillRect(px + 9, py + 11, 14, 8); }
      if (h === 9) { c.fillStyle = '#3a2a22'; c.beginPath(); c.arc(px + 16, py + 16, 10, 0, 7); c.fill(); c.fillStyle = '#2b1f19'; c.beginPath(); c.arc(px + 16, py + 16, 5, 0, 7); c.fill(); }
      if (y < ROWS - 1 && !opaque(g[y + 1][x]) && g[y + 1][x] !== FLOOR) {     // lit storefront edge
        c.fillStyle = '#2a1d1b'; c.fillRect(px, py + T - 10, T, 10);
        if (h % 3) { c.fillStyle = h % 2 ? '#e8b84a' : '#6fb4d6'; c.globalAlpha = .55; c.fillRect(px + 5, py + T - 8, T - 10, 6); c.globalAlpha = 1; }
      }
    } else if (t === WALL) {
      c.fillStyle = '#2a1d1b'; c.fillRect(px, py, T, T); c.fillStyle = '#743d30';
      for (let r = 0; r < 4; r++) for (let q = -1; q < 2; q++) c.fillRect(px + q * 16 + (r % 2 ? 8 : 0) + 1, py + r * 8 + 1, 14, 6);
    } else {
      c.fillStyle = floorAt(x, y); c.fillRect(px, py, T, T);
      if (t === DOOR) { c.fillStyle = 'rgba(245,197,24,.35)'; c.fillRect(px, py + 12, T, 8); }
      if (t === COUNTER) { c.fillStyle = '#5a4028'; c.fillRect(px, py + 3, T, T - 6); c.fillStyle = '#7d5b3b'; c.fillRect(px, py + 5, T, T - 12); }
      if (t === FIX && !hasCont[x + ',' + y]) {
        c.fillStyle = '#4a3b2d'; c.fillRect(px + 4, py + 1, T - 8, T - 2);
        for (let i = 0; i < 3; i++) { c.fillStyle = ['#d95f5f', '#5f9ed9', '#e0c050', '#6fc27a'][(h + i) % 4]; c.fillRect(px + 8, py + 4 + i * 9, T - 16, 6); }
      }
    }
  }
  if (job.id === 'truck') {          // armored truck body
    c.fillStyle = '#3f4d43'; c.fillRect(8 * T + 3, 8 * T + 6, 6 * T - 6, 3 * T - 12);
    c.fillStyle = '#2c362f'; c.fillRect(8 * T + 3, 8 * T + 6, 44, 3 * T - 12);
    c.fillStyle = '#8fb8c9'; c.fillRect(8 * T + 12, 8 * T + 16, 18, 3 * T - 32);
    c.fillStyle = '#cfd6c9'; c.font = 'bold 15px Arial'; c.textAlign = 'center'; c.fillText('IRONCLAD ARMORED', 11.6 * T, 9.65 * T);
  }
  // signage
  c.font = '18px Impact, "Arial Narrow", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.shadowColor = '#ff3b6b'; c.shadowBlur = 12; c.fillStyle = '#ffe9a8';
  c.fillText(job.sign, 20 * T, (job.street ? 5.5 : 13.5) * T);
  c.shadowBlur = 0;
}

// ------------------------------------------------------------------ drawing: actors
function dude(x, y, a, body, r, o) {
  o = o || {};
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x + 2, y + 3, r, r, 0, 0, 7); ctx.fill();
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  if (o.arms) { ctx.fillStyle = body; ctx.fillRect(-3, -r - 6, 6, 8); ctx.fillRect(-3, r - 2, 6, 8); }
  if (o.gun) { ctx.fillStyle = '#0d0d0f'; ctx.fillRect(r * .3, r * .3, o.gun, 3.5); }
  ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(0, 0, r * .78, r * 1.05, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = o.head || '#e0b48c'; ctx.beginPath(); ctx.arc(1, 0, r * .5, 0, 7); ctx.fill();
  if (o.hat) { ctx.fillStyle = o.hat; ctx.beginPath(); ctx.arc(0, 0, r * .52, PI / 2, PI * 1.5); ctx.fill(); }
  ctx.restore();
}
function ring(x, y, r, p, col) {
  ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke();
  ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(x, y, r, -PI / 2, -PI / 2 + p * PI * 2); ctx.stroke();
}
function drawCont(k) {
  const x = k.x * T, y = k.y * T, cx = x + 16, cy = y + 16;
  ctx.globalAlpha = k.open ? .4 : 1;
  if (k.type === 'register') { ctx.fillStyle = '#39424a'; ctx.fillRect(x + 6, y + 6, 20, 20); ctx.fillStyle = '#5fd38d'; ctx.fillRect(x + 9, y + 9, 14, 6); }
  else if (k.type === 'safe' || k.type === 'boxes') {
    ctx.fillStyle = '#59616b'; ctx.fillRect(x + 3, y + 3, 26, 26); ctx.fillStyle = '#3a4048'; ctx.fillRect(x + 6, y + 6, 20, 20);
    if (k.type === 'safe') { ctx.fillStyle = '#c9ced6'; ctx.beginPath(); ctx.arc(cx, cy, 5, 0, 7); ctx.fill(); }
    else { ctx.strokeStyle = '#7d858f'; ctx.lineWidth = 1; for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x + 6 + i * 6.6, y + 6); ctx.lineTo(x + 6 + i * 6.6, y + 26); ctx.moveTo(x + 6, y + 6 + i * 6.6); ctx.lineTo(x + 26, y + 6 + i * 6.6); ctx.stroke(); } }
  } else if (k.type === 'case') {
    ctx.fillStyle = '#3b2f28'; ctx.fillRect(x + 2, y + 5, 28, 22); ctx.fillStyle = k.open ? '#22262b' : '#a8dcef'; ctx.fillRect(x + 4, y + 7, 24, 18);
    if (!k.open) { ctx.fillStyle = '#fff'; for (let i = 0; i < 4; i++) ctx.fillRect(x + 7 + i * 5, y + 11 + (i % 2) * 6, 2, 2); }
  } else if (k.type === 'vault') {
    if (k.open) { ctx.globalAlpha = 1; return; }
    ctx.fillStyle = '#7b848f'; ctx.fillRect(x, y, T, T); ctx.fillStyle = '#aab3bd'; ctx.beginPath(); ctx.arc(cx, cy, 13, 0, 7); ctx.fill();
    ctx.strokeStyle = '#4d555e'; ctx.lineWidth = 3; ctx.beginPath(); for (let i = 0; i < 3; i++) { const a = i * PI / 3 + M.t * (k.prog > 0 ? 1 : 0); ctx.moveTo(cx - Math.cos(a) * 11, cy - Math.sin(a) * 11); ctx.lineTo(cx + Math.cos(a) * 11, cy + Math.sin(a) * 11); } ctx.stroke();
  } else if (k.type === 'cash') { ctx.fillStyle = '#6b5a45'; ctx.fillRect(x + 2, y + 2, 28, 28); ctx.fillStyle = '#4fae74'; for (let i = 0; i < 4; i++) ctx.fillRect(x + 5 + (i % 2) * 12, y + 5 + (i >> 1) * 12, 10, 10); }
  else if (k.type === 'gold') { ctx.fillStyle = '#5b5346'; ctx.fillRect(x + 2, y + 2, 28, 28); ctx.fillStyle = '#f2c230'; for (let i = 0; i < 3; i++) ctx.fillRect(x + 5, y + 5 + i * 8, 22, 6); ctx.fillStyle = '#fff3b0'; ctx.fillRect(x + 6, y + 6, 8, 2); }
  else { ctx.fillStyle = '#8b6a3e'; ctx.fillRect(x + 3, y + 3, 26, 26); ctx.strokeStyle = '#5e4526'; ctx.lineWidth = 2; ctx.strokeRect(x + 4, y + 4, 24, 24); ctx.beginPath(); ctx.moveTo(x + 4, y + 4); ctx.lineTo(x + 28, y + 28); ctx.stroke(); }
  ctx.globalAlpha = 1;
  if (!k.open && k.prog > 0) ring(cx, cy - 26, 9, k.prog, '#f5c518');
}
function drawVehicle() {
  const v = M.veh, d = v.def, can = M.take > 0 || M.alarm;
  ctx.strokeStyle = can ? 'rgba(95,211,141,.75)' : 'rgba(255,255,255,.18)'; ctx.lineWidth = 2; ctx.setLineDash([8, 8]); ctx.lineDashOffset = -M.t * 20;
  ctx.beginPath(); ctx.arc(v.x, v.y, 84, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(v.x - 44, v.y - 18, 94, 44);
  if (S.vehicle === 'heli') {
    ctx.fillStyle = d.color; ctx.beginPath(); ctx.ellipse(v.x, v.y, 34, 18, 0, 0, 7); ctx.fill(); ctx.fillRect(v.x - 70, v.y - 4, 44, 8);
    ctx.fillStyle = '#9fd0e6'; ctx.beginPath(); ctx.ellipse(v.x + 16, v.y, 13, 12, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(220,220,220,.7)'; ctx.lineWidth = 3; const a = M.t * 14; ctx.beginPath(); ctx.moveTo(v.x - Math.cos(a) * 56, v.y - Math.sin(a) * 56); ctx.lineTo(v.x + Math.cos(a) * 56, v.y + Math.sin(a) * 56); ctx.stroke();
  } else {
    const long = S.vehicle === 'van' || S.vehicle === 'suv' ? 50 : 44;
    ctx.fillStyle = d.color; ctx.beginPath(); ctx.roundRect(v.x - long, v.y - 20, long * 2, 40, 8); ctx.fill();
    ctx.fillStyle = '#10131a'; ctx.fillRect(v.x + long - 34, v.y - 16, 14, 32); if (S.vehicle !== 'van') ctx.fillRect(v.x - long + 14, v.y - 16, 10, 32);
    ctx.fillStyle = '#ffe9a8'; ctx.fillRect(v.x + long - 4, v.y - 17, 4, 7); ctx.fillRect(v.x + long - 4, v.y + 10, 4, 7);
    ctx.fillStyle = '#e5383b'; ctx.fillRect(v.x - long, v.y - 17, 3, 7); ctx.fillRect(v.x - long, v.y + 10, 3, 7);
  }
  ctx.font = '13px Impact, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = can ? '#5fd38d' : 'rgba(255,255,255,.45)';
  ctx.fillText(can ? 'GETAWAY — WHOLE CREW HERE' : 'GETAWAY', v.x, v.y + 42);
  if (M.esc > 0) ring(v.x, v.y - 38, 12, M.esc / d.start, '#5fd38d');
}
function stars(n, x, y) {
  ctx.font = '22px Arial'; ctx.textAlign = 'left';
  for (let i = 0; i < 5; i++) { ctx.fillStyle = i < n ? '#f5c518' : '#3a3d48'; ctx.fillText('★', x + i * 22, y); }
}
function draw() {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(M.shake > 0 ? rnd(-3, 3) : 0, HUD + (M.shake > 0 ? rnd(-3, 3) : 0));
  ctx.drawImage(mapC, 0, 0);
  for (const k of M.cont) drawCont(k);
  drawVehicle();
  // police lights
  if (M.arrived) for (const side of [0, 1]) {
    const x = side ? W - 62 : 6, y = 17 * T + 10, fl = Math.floor(M.t * 6 + side) % 2;
    ctx.fillStyle = '#e9edf2'; ctx.beginPath(); ctx.roundRect(x, y, 56, 30, 6); ctx.fill(); ctx.fillStyle = '#1b3a8a'; ctx.fillRect(x + 16, y, 24, 30);
    ctx.fillStyle = fl ? '#ff2b2b' : '#2b6bff'; ctx.fillRect(x + 24, y + 4, 8, 22);
    const gr = ctx.createRadialGradient(x + 28, y + 15, 0, x + 28, y + 15, 220); gr.addColorStop(0, fl ? 'rgba(255,40,40,.35)' : 'rgba(40,100,255,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr; ctx.fillRect(x - 200, y - 210, 460, 450);
  }
  // corpses / civilians
  for (const e of M.cops.concat(M.guards)) if (e.dead) { ctx.globalAlpha = .5; dude(e.x, e.y, e.a + 1.5, '#333', e.r); ctx.globalAlpha = 1; }
  for (const v of M.civs) {
    dude(v.x, v.y, v.a, v.clerk ? '#3f8f5a' : v.color, v.r, { arms: v.state === 'hands' || v.state === 'cower', hat: '#4a3526' });
    if (v.state === 'hands' && v.mug > 0) ring(v.x, v.y - 24, 8, v.mug, '#f5c518');
    if (v.state === 'flee') { ctx.fillStyle = '#fff'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center'; ctx.fillText('!', v.x, v.y - 14); }
    else if (M.job.street && v.cash > 0 && v.state === 'walk') { ctx.fillStyle = 'rgba(95,211,141,.8)'; ctx.font = 'bold 11px Arial'; ctx.textAlign = 'center'; ctx.fillText('$', v.x, v.y - 14); }
  }
  for (const g of M.guards) {
    if (g.dead) continue;
    if (!g.hostile) {
      ctx.fillStyle = g.det > 0 ? `rgba(255,${Math.round(200 - g.det * 160)},60,${.14 + g.det * .2})` : 'rgba(255,230,120,.1)';
      ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.arc(g.x, g.y, 190, g.a - .87, g.a + .87); ctx.closePath(); ctx.fill();
      if (g.det > 0) ring(g.x, g.y - 24, 8, g.det, '#e5383b');
    }
    dude(g.x, g.y, g.a, '#6d7480', g.r, { gun: 14, hat: '#22252b' });
  }
  for (const c of M.cops) if (!c.dead) dude(c.x, c.y, c.a, c.kind === 'swat' ? '#15171c' : '#1f3f9a', c.r, { gun: c.kind === 'swat' ? 18 : 13, hat: c.kind === 'swat' ? '#2a2d35' : '#0f2260', head: c.kind === 'swat' ? '#3a3d45' : undefined });
  for (const c of M.crew) {
    if (c.down) {
      ctx.globalAlpha = .65; dude(c.x, c.y, c.a + 1.5, c.color, c.r, { arms: true }); ctx.globalAlpha = 1;
      ctx.fillStyle = '#e5383b'; ctx.font = '12px Impact, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('DOWN', c.x, c.y - 18);
      if (c.rev > 0) ring(c.x, c.y - 34, 8, c.rev / 3, '#fff');
    } else {
      dude(c.x, c.y, c.a, c.color, c.r, { gun: WEAPONS[c.weapon].melee ? 7 : 15, hat: '#17181d', head: '#17181d' });
      ctx.fillStyle = c.color; ctx.font = '11px Impact, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(c.human ? 'P' + (c.slot + 1) : 'AI', c.x, c.y - 17);
    }
  }
  // bullets & fx
  for (const b of M.bullets) { ctx.strokeStyle = b.crew ? '#ffe9a8' : '#ff8b7a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * .018, b.y - b.vy * .018); ctx.stroke(); }
  for (const f of M.fx) {
    const p = f.t / f.life;
    if (f.type === 'flash') { ctx.fillStyle = 'rgba(255,230,140,.9)'; ctx.beginPath(); ctx.arc(f.x, f.y, 7, 0, 7); ctx.fill(); }
    else if (f.type === 'spark') { ctx.fillStyle = f.col; ctx.globalAlpha = 1 - p; ctx.beginPath(); ctx.arc(f.x, f.y, 3 + p * 8, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
    else { ctx.strokeStyle = `rgba(255,255,255,${1 - p})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(f.x, f.y, 30, f.a - 1 + p, f.a + .2 + p); ctx.stroke(); }
  }
  for (const t of M.texts) { ctx.globalAlpha = 1 - t.t / 1.4; ctx.fillStyle = t.col; ctx.font = '18px Impact, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(t.txt, t.x, t.y - t.t * 26); ctx.globalAlpha = 1; }
  // interaction prompts
  for (const c of M.crew) {
    if (!c.human || c.down || c.act || c.actCiv) continue;
    let lab = null, lx, ly;
    for (const k of M.cont) if (!k.open && Math.hypot(tc(k.x) - c.x, tc(k.y) - c.y) < 58) { lab = k.label; lx = tc(k.x); ly = k.y * T - 6; }
    if (!lab) for (const v of M.civs) if (!v.clerk && v.cash > 0 && dist(c, v) < 44) { lab = 'Stick up'; lx = v.x; ly = v.y - 26; }
    if (lab) {
      ctx.font = '12px "Segoe UI", sans-serif'; const tw = ctx.measureText('HOLD ACTION · ' + lab).width + 12;
      ctx.fillStyle = 'rgba(0,0,0,.75)'; ctx.fillRect(lx - tw / 2, ly - 16, tw, 18); ctx.fillStyle = '#f5c518'; ctx.textAlign = 'center'; ctx.fillText('HOLD ACTION · ' + lab, lx, ly - 3);
    }
  }
  // vignette
  const vg = ctx.createRadialGradient(W / 2, 336, 300, W / 2, 336, 800); vg.addColorStop(0, 'rgba(0,0,10,0)'); vg.addColorStop(1, 'rgba(0,0,10,.5)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, ROWS * T);
  ctx.restore();

  // ---- HUD
  ctx.fillStyle = '#08090c'; ctx.fillRect(0, 0, W, HUD); ctx.fillStyle = '#2b2d36'; ctx.fillRect(0, HUD - 2, W, 2);
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.fillStyle = '#f5c518'; ctx.font = '22px Impact, sans-serif'; ctx.fillText(M.job.name.toUpperCase(), 14, 24);
  ctx.fillStyle = '#9a9ca8'; ctx.font = '11px "Segoe UI", sans-serif'; ctx.fillText(M.job.hood.toUpperCase(), 14, 40);
  M.crew.forEach((c, i) => {
    const x = 250 + i * 138;
    ctx.fillStyle = c.color; ctx.font = '14px Impact, sans-serif'; ctx.fillText(c.name.toUpperCase() + (c.human ? '' : ' · AI'), x, 18);
    ctx.fillStyle = '#23252d'; ctx.fillRect(x, 24, 120, 8);
    ctx.fillStyle = c.down ? '#e5383b' : c.color; ctx.fillRect(x, 24, 120 * (c.down ? c.rev / 3 : clamp(c.hp / c.maxhp, 0, 1)), 8);
    ctx.fillStyle = '#9a9ca8'; ctx.font = '10px "Segoe UI", sans-serif'; ctx.fillText(c.down ? 'DOWN' : WEAPONS[c.weapon].name, x, 43);
  });
  ctx.font = '14px Impact, sans-serif';
  if (!M.alarm) { ctx.fillStyle = '#5fd38d'; ctx.fillText('UNDETECTED', 830, 28); }
  else if (!M.arrived) { ctx.fillStyle = Math.floor(M.t * 4) % 2 ? '#e5383b' : '#ff8b7a'; ctx.font = '18px Impact, sans-serif'; ctx.fillText('NYPD ETA  ' + Math.ceil(M.eta) + 's', 830, 30); }
  else stars(M.stars, 830, 33);
  ctx.textAlign = 'right'; ctx.fillStyle = '#5fd38d'; ctx.font = '26px Impact, sans-serif'; ctx.fillText(money(M.take), W - 14, 27);
  const cap = M.veh.def.cap; ctx.fillStyle = M.take > cap ? '#e5383b' : '#9a9ca8'; ctx.font = '11px "Segoe UI", sans-serif'; ctx.fillText((M.take > cap ? 'OVER CAPACITY · ' : '') + 'VEHICLE HOLDS ' + money(cap), W - 14, 41);
  if (M.msgT > 0) {
    ctx.textAlign = 'center'; ctx.font = '30px Impact, sans-serif'; const w = ctx.measureText(M.msg).width + 40;
    ctx.globalAlpha = Math.min(1, M.msgT); ctx.fillStyle = 'rgba(8,9,12,.85)'; ctx.fillRect(W / 2 - w / 2, 84, w, 46); ctx.fillStyle = '#f2efe6'; ctx.fillText(M.msg, W / 2, 118); ctx.globalAlpha = 1;
  }
  if (M.t < 9 && !M.alarm) { ctx.textAlign = 'center'; ctx.font = '13px "Segoe UI", sans-serif'; ctx.fillStyle = 'rgba(242,239,230,.75)'; ctx.fillText('Hold ACTION next to loot or a citizen · Guards have sight cones · Get the whole crew back to the vehicle · Esc to pause', W / 2, H - 10); }
  if (M.paused) {
    ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(0, 0, W, H); ctx.textAlign = 'center'; ctx.fillStyle = '#f5c518'; ctx.font = '72px Impact, sans-serif'; ctx.fillText('PAUSED', W / 2, 330);
    ctx.fillStyle = '#f2efe6'; ctx.font = '18px "Segoe UI", sans-serif'; ctx.fillText('Esc — back to the job      Q — ' + (!M.alarm && M.take === 0 ? 'call it off and walk away' : 'surrender to the NYPD'), W / 2, 380);
  }
}

// ------------------------------------------------------------------ menu backdrop
const sky = []; for (let x = -10; x < W;) { const w = rint(54, 120); sky.push({ x, w, h: rint(150, 480), win: Array.from({ length: 300 }, () => Math.random() < .3) }); x += w + rint(0, 5); }
function drawSky(t) {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0b0d1a'); g.addColorStop(.7, '#2a1b33'); g.addColorStop(1, '#5b2a3a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (const b of sky) {
    ctx.fillStyle = '#0a0b10'; ctx.fillRect(b.x, H - b.h, b.w, b.h);
    let i = 0;
    for (let y = H - b.h + 12; y < H - 14; y += 18) for (let x = b.x + 8; x < b.x + b.w - 10; x += 14) {
      const on = b.win[i++ % 300] && Math.sin(t * .3 + i * 12.9) > -.9;
      if (on) { ctx.fillStyle = i % 7 ? 'rgba(245,197,24,.55)' : 'rgba(140,200,255,.5)'; ctx.fillRect(x, y, 7, 10); }
    }
  }
}

// ------------------------------------------------------------------ menus
function renderTitle() {
  mode = 'title';
  const guest = NET.role === 'guest', list = guest ? NET.seats : seats, fill = guest ? NET.fill : fillBots;
  const here = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) ? (NET.addrs.length ? NET.addrs.map(a => 'http://' + a).join('</b> or <b>') : "this server's address") : location.origin;
  const online = guest ? `<div class="net"><b>You're in the crew.</b> Waiting for the host to start. You play with <kbd>WASD</kbd> <kbd>Space</kbd> <kbd>E</kbd> or a gamepad.</div>
      <div class="row"><button class="btn ghost" data-a="leave">Leave crew</button></div>`
    : NET.role === 'host' ? `<div class="net"><b>Hosting online</b> · ${NET.peers.size} friend${NET.peers.size === 1 ? '' : 's'} connected. Friends open <b>${here}</b> and click “Join online game”.
      <button class="btn ghost sm" style="margin-left:10px" data-a="leave">Stop hosting</button></div>`
    : `<div class="row"><button class="btn ghost sm" data-a="hostOnline">Host online game</button><button class="btn ghost sm" data-a="joinOnline">Join online game</button></div>${NET.status ? `<div class="net">${NET.status}</div>` : ''}`;
  ui.innerHTML = `<div class="title">
    <div style="text-align:center"><div class="logo">SHEISTERS</div><div class="tag">A New York City heist crew · 1–4 players</div></div>
    <div class="seats">${[0, 1, 2, 3].map(i => { const s = list[i]; return `<div class="seat ${s ? 'on' : ''}" style="--c:${CREW[i].color}"><h3>${CREW[i].name}</h3>
      ${s ? `<p><b>Player ${i + 1}</b><br>${ctlLabel(s)}</p>${!guest && s.ctl !== 'net' ? `<button class="btn ghost sm" style="margin-top:8px" data-a="unseat" data-v="${i}">Leave</button>` : ''}`
          : `<p>${fill ? '<b>AI crew member</b><br>' : 'Empty seat<br>'}${guest ? '' : 'Press a join key to take over'}</p>`}</div>`; }).join('')}</div>
    ${guest ? '' : `<div class="keys"><kbd>Space</kbd> joins on WASD (<kbd>Space</kbd> attack, <kbd>E</kbd> action) &nbsp;·&nbsp; <kbd>Enter</kbd> joins on Arrows (<kbd>Enter</kbd> attack, <kbd>Right Shift</kbd> action)<br>
      Gamepads: press <kbd>A</kbd> to join — left stick move, right stick aim, <kbd>RT</kbd> attack, <kbd>A</kbd> action</div>
    <label class="check"><input type="checkbox" data-a="bots" ${fillBots ? 'checked' : ''}> Fill empty seats with AI crew</label>
    <div class="row"><button class="btn" data-a="start" ${seats.some(Boolean) ? '' : 'disabled'}>${hasSave ? 'Continue' : 'Hit the streets'}</button>
      ${hasSave ? '<button class="btn ghost" data-a="newgame">New game</button>' : ''}</div>`}
    ${online}
  </div>`;
  netUI();
}
function renderHideout() {
  mode = 'hideout';
  if (NET.role !== 'guest' && seats.some(Boolean)) syncCrew();
  const heatLbl = S.heat < 30 ? 'Cool' : S.heat < 60 ? 'Warm' : S.heat < 80 ? 'Hot' : 'Scorching';
  const veh = VEHICLES[S.vehicle];
  let body = '';
  if (tab === 'jobs') {
    const j = JOBS.find(x => x.id === selJob) || JOBS[0];
    body = `<div class="cards">${JOBS.map(x => {
      const locked = S.rep < x.rep;
      return `<button class="card ${x.id === j.id ? 'on' : ''}" data-a="job" data-v="${x.id}" ${locked ? 'disabled' : ''}>
        <span class="hood">${x.hood}</span><h3>${x.name}</h3><p>${locked ? 'The crew needs a bigger name for this one.' : x.sec}</p>
        <span class="meta">${locked ? `<span class="lock">Needs ${x.rep} rep</span>` : `<b>${money(x.est[0])}–${money(x.est[1])}</b>`}<span class="tier">${'★'.repeat(x.tier)}</span></span></button>`;
    }).join('')}</div>
    <div class="brief"><div><h3>${j.name}</h3>${j.blurb}<br><span style="color:var(--dim)">Police response ≈ ${Math.round(j.response * (S.bribes.beat ? 1.3 : 1) * (1 - .5 * S.heat / 100))}s after the alarm.</span>
      ${j.est[1] > veh.cap ? `<br><span class="warn">Your ${veh.name} only hauls ${money(veh.cap)} — the rest gets left on the curb.</span>` : ''}</div>
      <button class="btn" data-a="go">Roll out</button></div>`;
  } else if (tab === 'guns') {
    body = `<div class="sect">Weapons — bought once, available to the whole crew</div><div class="cards">${Object.entries(WEAPONS).map(([id, w]) => {
      const own = S.weapons.includes(id);
      return `<div class="card ${own ? 'owned' : ''}"><h3>${w.name}</h3><p>${w.desc}</p><p>Damage ${w.dmg}${w.pellets ? '×' + w.pellets : ''} · ${(1 / w.cd).toFixed(1)}/s · ${w.melee ? 'melee' : 'range ' + w.range}</p>
        <span class="meta">${own ? '<span class="tagline">Owned</span>' : `<b>${money(w.price)}</b><button class="btn sm" data-a="buyW" data-v="${id}" ${S.cash < w.price ? 'disabled' : ''}>Buy</button>`}</span></div>`;
    }).join('')}</div>
    <div class="sect">Gear</div><div class="cards">${Object.entries(GEAR).map(([id, g]) => {
      const lv = S[id], max = lv >= g.prices.length;
      return `<div class="card ${lv ? 'owned' : ''}"><h3>${g.name}</h3><p>${g.desc}</p><p>Level ${lv} / ${g.prices.length}</p>
        <span class="meta">${max ? '<span class="tagline">Maxed</span>' : `<b>${money(g.prices[lv])}</b><button class="btn sm" data-a="buyG" data-v="${id}" ${S.cash < g.prices[lv] ? 'disabled' : ''}>Upgrade</button>`}</span></div>`;
    }).join('')}</div>`;
  } else if (tab === 'garage') {
    body = `<div class="sect">Getaway vehicles — capacity limits how much loot you keep, speed shakes the pursuit</div><div class="cards">${Object.entries(VEHICLES).map(([id, v]) => {
      const own = S.vehicles.includes(id), cur = S.vehicle === id;
      return `<div class="card ${cur ? 'on' : own ? 'owned' : ''}"><h3>${v.name}</h3><p>${v.desc}</p><p>Hauls ${money(v.cap)} · Speed ${'▮'.repeat(v.speed) || '—'} · Starts in ${v.start}s</p>
        <span class="meta">${cur ? '<span class="tagline">In use</span>' : own ? `<span></span><button class="btn sm ghost" data-a="useV" data-v="${id}">Use</button>` : `<b>${money(v.price)}</b><button class="btn sm" data-a="buyV" data-v="${id}" ${S.cash < v.price ? 'disabled' : ''}>Buy</button>`}</span></div>`;
    }).join('')}</div>`;
  } else {
    const grease = 400 + S.rep * 150;
    body = `<div class="sect">Cool things down</div><div class="cards"><div class="card"><h3>Grease the Precinct</h3><p>Envelopes all round. Drops city heat by 35 points. High heat means faster response and a head start on your wanted level.</p>
      <span class="meta"><b>${money(grease)}</b><button class="btn sm" data-a="grease" ${S.cash < grease || S.heat <= 0 ? 'disabled' : ''}>Pay</button></span></div></div>
    <div class="sect">On the payroll — permanent</div><div class="cards">${Object.entries(BRIBES).map(([id, b]) => {
      const own = S.bribes[id];
      return `<div class="card ${own ? 'owned' : ''}"><h3>${b.name}</h3><p>${b.desc}</p>
        <span class="meta">${own ? '<span class="tagline">On the payroll</span>' : `<b>${money(b.price)}</b><button class="btn sm" data-a="bribe" data-v="${id}" ${S.cash < b.price ? 'disabled' : ''}>Pay off</button>`}</span></div>`;
    }).join('')}</div>`;
  }
  ui.innerHTML = `<div class="hide">
    <header><h1>Sheisters</h1>
      <div class="stat cash"><b>${money(S.cash)}</b><span>Crew stash</span></div>
      <div class="stat"><b>${S.rep}</b><span>Street rep</span></div>
      <div class="stat"><div class="bar"><i style="width:${S.heat}%"></i></div><span>City heat · ${heatLbl}</span></div></header>
    <nav>${[['jobs', 'Job board'], ['guns', 'Guns & gear'], ['garage', 'Garage'], ['cops', 'Pay off cops']].map(([id, n]) => `<button class="${tab === id ? 'on' : ''}" data-a="tab" data-v="${id}">${n}</button>`).join('')}
      ${NET.role === 'guest' ? '' : '<button style="margin-left:auto;border-left:2px solid var(--line);border-right:0" data-a="title">Crew setup</button>'}</nav>
    <main>${body}</main>
    <aside><h3>The crew</h3>${crewDefs.map((c, i) => `<div class="mate" style="--c:${c.color}"><h4>${c.name}</h4><small>${c.human ? 'Player ' + (i + 1) + ' · ' + ctlLabel(c) : 'AI crew'}</small>
      <button data-a="cycle" data-v="${i}" title="Click to switch weapon">${WEAPONS[S.loadout[i]].name} ⟳</button></div>`).join('')}
      <div class="ride">Ride: <b>${veh.name}</b><br>Hauls up to <b>${money(veh.cap)}</b><br>Armor Lv ${S.armor} · Kit Lv ${S.drill}<br>Jobs pulled: ${S.done}</div></aside>
  </div>`;
  netUI();
}
function syncCrew() {
  crewDefs = [];
  seats.forEach((s, i) => { if (s) crewDefs.push(Object.assign({ human: true }, CREW[i], s)); else if (fillBots) crewDefs.push(Object.assign({ human: false, ctl: 'bot' }, CREW[i])); });
}
function act(a, v) {
  if (a === 'leave') { NET.status = ''; if (NET.ws) NET.ws.close(); return; }
  if (NET.role === 'guest') { if (a === 'tab') { tab = v; renderHideout(); } else netSend({ t: 'act', a, v }); return; }
  if (a === 'hostOnline') return netConnect(true);
  if (a === 'joinOnline') return netConnect(false);
  if (a === 'bots') { fillBots = !fillBots; renderTitle(); }
  else if (a === 'unseat') { seats[+v] = null; renderTitle(); }
  else if (a === 'newgame') { S = freshSave(); hasSave = false; save(); renderTitle(); }
  else if (a === 'title') renderTitle();
  else if (a === 'start') {
    syncCrew();
    hasSave = true; sfx('cash'); renderHideout();
  }
  else if (a === 'hideout') renderHideout();
  else if (a === 'tab') { tab = v; renderHideout(); }
  else if (a === 'job') { selJob = v; renderHideout(); }
  else if (a === 'go') { const j = JOBS.find(x => x.id === selJob); if (j && S.rep >= j.rep) startJob(j); }
  else {
    if (a === 'buyW' && S.cash >= WEAPONS[v].price && !S.weapons.includes(v)) { S.cash -= WEAPONS[v].price; S.weapons.push(v); S.loadout = S.loadout.map(() => v); }
    if (a === 'buyV' && S.cash >= VEHICLES[v].price && !S.vehicles.includes(v)) { S.cash -= VEHICLES[v].price; S.vehicles.push(v); S.vehicle = v; }
    if (a === 'useV' && S.vehicles.includes(v)) S.vehicle = v;
    if (a === 'buyG') { const p = GEAR[v].prices[S[v]]; if (p !== undefined && S.cash >= p) { S.cash -= p; S[v]++; } }
    if (a === 'bribe' && S.cash >= BRIBES[v].price && !S.bribes[v]) { S.cash -= BRIBES[v].price; S.bribes[v] = true; }
    if (a === 'grease') { const p = 400 + S.rep * 150; if (S.cash >= p && S.heat > 0) { S.cash -= p; S.heat = Math.max(0, S.heat - 35); } }
    if (a === 'cycle') { const i = +v, k = S.weapons.indexOf(S.loadout[i]); S.loadout[i] = S.weapons[(k + 1) % S.weapons.length]; }
    sfx('cash'); save(); renderHideout();
  }
}
ui.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b && !b.disabled) act(b.dataset.a, b.dataset.v); });

// ------------------------------------------------------------------ loop
function fit() { const s = Math.min(innerWidth / W, innerHeight / H); stage.style.transform = `translate(-50%,-50%) scale(${s})`; }
addEventListener('resize', fit); fit();
// ------------------------------------------------------------------ online play
// The host's browser runs the whole simulation. Guests send inputs and draw the snapshots they get back.
const netSend = o => { if (NET.ws && NET.ws.readyState === 1) NET.ws.send(JSON.stringify(o)); };
function netUI() {
  if (NET.role !== 'host') return;
  netSend({ t: 'ui', mode, S, selJob, crew: crewDefs, seats: seats.map(s => s ? { ctl: s.ctl, id: s.id } : null), fill: fillBots, html: mode === 'result' ? ui.innerHTML : '' });
}
function netConnect(asHost) {
  if (location.protocol === 'file:') { NET.status = 'Online play needs the game server: run <kbd>node serve.js</kbd> and open the address it prints.'; return renderTitle(); }
  if (NET.ws) return;
  NET.status = 'Connecting…'; renderTitle();
  const ws = NET.ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
  ws.onopen = () => {
    ws.send(JSON.stringify({ t: asHost ? 'host' : 'join' }));
    const beat = setInterval(() => { if (ws.readyState === 1) ws.send('{"t":"ping"}'); else clearInterval(beat); }, 20000);   // keeps proxies from closing an idle lobby
  };
  ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (err) { return; } onNet(m); };
  ws.onclose = () => {
    const was = NET.role; NET.ws = null; NET.role = null; NET.peers.clear(); NET.inputs = {};
    if (was === 'guest') {
      M = null; S = freshSave();
      try { const raw = localStorage.getItem(SAVE_KEY); if (raw) S = Object.assign(freshSave(), JSON.parse(raw)); } catch (e) { /* ignore */ }
      seats.fill(null); seats[0] = { ctl: 'kb1' };
      if (!NET.status) NET.status = 'Disconnected from the host.';
      return renderTitle();
    }
    if (was === 'host') {
      seats.forEach((s, i) => { if (s && s.ctl === 'net') seats[i] = null; });
      if (M) for (const c of M.crew) if (c.ctl === 'net') { c.human = false; c.ctl = 'bot'; }
    } else if (NET.status === 'Connecting…') NET.status = 'Could not reach the game server.';
    if (mode === 'title') renderTitle();
  };
}
function onNet(m) {
  if (m.t === 'err') { NET.status = m.msg; if (NET.ws) NET.ws.close(); return; }
  if (m.t === 'role') {
    NET.role = m.role; NET.id = m.id; NET.addrs = m.addrs || []; NET.status = '';
    if (m.role === 'guest') { NET.seats = []; M = null; }
    return renderTitle();
  }
  if (NET.role === 'host') {
    if (m.t === 'peer') {
      if (m.on) {
        NET.peers.add(m.id);
        const i = seats.indexOf(null);
        if (i < 0) return netSend({ to: m.id, t: 'err', msg: 'That crew is already full.' });
        seats[i] = { ctl: 'net', id: m.id };
      } else {
        NET.peers.delete(m.id); delete NET.inputs[m.id];
        const i = seats.findIndex(s => s && s.id === m.id); if (i >= 0) seats[i] = null;
        if (M) for (const c of M.crew) if (c.id === m.id) { c.human = false; c.ctl = 'bot'; }
      }
      if (mode === 'title') renderTitle(); else if (mode === 'hideout') renderHideout();
      else { netUI(); if (mode === 'play' && m.on) netSend(Object.assign({ to: m.id }, startMsg())); }
    } else if (m.t === 'in' && Array.isArray(m.i)) {
      const i = m.i, n = v => clamp(+v || 0, -1, 1);
      NET.inputs[m.from] = { mx: n(i[0]), my: n(i[1]), ax: n(i[2]), ay: n(i[3]), shoot: !!i[4], act: !!i[5], at: performance.now() };
    } else if (m.t === 'act') {
      const a = String(m.a), v = m.v === undefined ? undefined : String(m.v);
      if (mode === 'result' && a === 'hideout') act(a);
      else if (mode === 'hideout' && ['job', 'go', 'buyW', 'buyV', 'useV', 'buyG', 'bribe', 'grease'].includes(a)) {
        const table = { job: JOBS.map(j => j.id), buyW: Object.keys(WEAPONS), buyV: Object.keys(VEHICLES), useV: Object.keys(VEHICLES), buyG: Object.keys(GEAR), bribe: Object.keys(BRIBES) }[a];
        if (!table || table.includes(v)) act(a, v);
      } else if (mode === 'hideout' && a === 'cycle' && crewDefs[+v] && crewDefs[+v].id === m.from) act(a, v);
    }
    return;
  }
  // ---- guest
  if (m.t === 'ui') {
    S = Object.assign(freshSave(), m.S); selJob = m.selJob; crewDefs = m.crew || []; NET.seats = m.seats || []; NET.fill = !!m.fill;
    if (m.mode === 'title') { M = null; renderTitle(); }
    else if (m.mode === 'hideout') { M = null; renderHideout(); }
    else if (m.mode === 'result') { mode = 'result'; ui.innerHTML = m.html; }
  } else if (m.t === 'start') {
    const job = JOBS.find(j => j.id === m.job); if (!job) return;
    M = { job, g: m.g, cont: m.cont, guards: m.guards.map(p => ({ x: p[0], y: p[1], tx: p[0], ty: p[1], r: 11, a: 0, det: 0 })), civs: [], cops: [], bullets: [], fx: [], texts: [],
      crew: m.crew.map(c => Object.assign(c, { tx: c.x, ty: c.y, r: 11, a: -PI / 2, hp: c.maxhp, down: false, rev: 0 })),
      take: 0, alarm: false, eta: 0, arrived: false, stars: 0, esc: 0, t: 0, msg: '', msgT: 0, paused: false, over: false, shake: 0,
      veh: { x: tc(m.veh.x), y: tc(m.veh.y), def: VEHICLES[S.vehicle] || VEHICLES.rust } };
    drawMap(); mode = 'play'; ui.innerHTML = '';
  } else if (m.t === 'snap' && M && mode === 'play') applySnap(m);
}
function startMsg() {
  return { t: 'start', job: M.job.id, g: M.g, veh: M.L.veh, guards: M.guards.map(g => [Math.round(g.x), Math.round(g.y)]),
    cont: M.cont.map(k => ({ x: k.x, y: k.y, type: k.type, label: k.label, prog: k.prog, open: k.open })),
    crew: M.crew.map(c => ({ id: c.id, name: c.name, color: c.color, human: c.human, slot: c.slot, weapon: c.weapon, maxhp: c.maxhp, x: Math.round(c.x), y: Math.round(c.y) })) };
}
function snap() {
  const r = Math.round, R = v => Math.round(v * 100) / 100, B = v => v ? 1 : 0;
  return { t: 'snap',
    k: [M.take, B(M.alarm), R(M.eta), B(M.arrived), M.stars, R(M.esc), R(M.t), M.msg, R(M.msgT), B(M.paused), B(M.shake > 0)],
    crew: M.crew.map(c => [r(c.x), r(c.y), R(c.a), r(c.hp), B(c.down), R(c.rev), B(c.act || c.actCiv), B(c.human)]),
    civs: M.civs.map(v => [v.id, r(v.x), r(v.y), R(v.a), v.state, R(v.mug), B(v.cash > 0), B(v.clerk), v.color]),
    guards: M.guards.map(g => [r(g.x), r(g.y), R(g.a), B(g.hostile), R(g.det), B(g.dead)]),
    cops: M.cops.map(c => [c.id, r(c.x), r(c.y), R(c.a), c.kind, B(c.dead)]),
    bul: M.bullets.map(b => [r(b.x), r(b.y), r(b.vx), r(b.vy), B(b.crew)]),
    cont: M.cont.map(k => [R(k.prog), B(k.open)]),
    fx: M.fx, tx: M.texts, sfx: NET.sfxQ.splice(0) };
}
function applySnap(m) {
  const k = m.k;
  M.take = k[0]; M.alarm = !!k[1]; M.eta = k[2]; M.arrived = !!k[3]; M.stars = k[4]; M.esc = k[5]; M.t = k[6]; M.msg = k[7]; M.msgT = k[8]; M.paused = !!k[9]; M.shake = k[10] ? .1 : 0;
  M.crew.forEach((c, i) => { const s = m.crew[i]; if (!s) return; c.tx = s[0]; c.ty = s[1]; c.a = s[2]; c.hp = s[3]; c.down = !!s[4]; c.rev = s[5]; c.act = s[6] ? 1 : null; c.human = !!s[7]; });
  M.guards.forEach((g, i) => { const s = m.guards[i]; if (!s) return; g.tx = s[0]; g.ty = s[1]; g.a = s[2]; g.hostile = !!s[3]; g.det = s[4]; g.dead = !!s[5]; });
  const merge = (old, list, make) => { const by = new Map(old.map(e => [e.id, e])); return list.map(s => { const e = by.get(s[0]) || { id: s[0], x: s[1], y: s[2] }; e.tx = s[1]; e.ty = s[2]; e.a = s[3]; make(e, s); return e; }); };
  M.civs = merge(M.civs, m.civs, (e, s) => { e.r = 10; e.state = s[4]; e.mug = s[5]; e.cash = s[6]; e.clerk = !!s[7]; e.color = s[8]; });
  M.cops = merge(M.cops, m.cops, (e, s) => { e.r = 11; e.kind = s[4]; e.dead = !!s[5]; });
  M.bullets = m.bul.map(b => ({ x: b[0], y: b[1], vx: b[2], vy: b[3], crew: !!b[4] }));
  let redraw = false;
  M.cont.forEach((c, i) => { const s = m.cont[i]; if (!s) return; c.prog = s[0]; if (s[1] && !c.open && c.type === 'vault') { M.g[c.y][c.x] = DOOR; redraw = true; } c.open = !!s[1]; });
  if (redraw) drawMap();
  M.fx = m.fx || []; M.texts = m.tx || [];
  for (const q of m.sfx || []) sfx(q);
}
function guestTick(dt) {
  const f = Math.min(1, dt * 18);
  for (const list of [M.crew, M.civs, M.guards, M.cops]) for (const e of list) { e.x += (e.tx - e.x) * f; e.y += (e.ty - e.y) * f; }
  for (const b of M.bullets) { b.x += b.vx * dt; b.y += b.vy * dt; }
  for (const x of M.fx) x.t += dt;
  for (const x of M.texts) x.t += dt;
  if (!M.paused) { M.t += dt; M.msgT -= dt; }
  NET.inT -= dt;
  if (NET.inT <= 0) {
    NET.inT = 1 / 30;
    const kb = readInput({ ctl: 'kb1' }), gp = Array.from(navigator.getGamepads ? navigator.getGamepads() : []).find(Boolean), p = gp ? readInput({ ctl: 'pad', pad: gp.index }) : NOIN;
    const R = v => Math.round(v * 100) / 100;
    netSend({ t: 'in', i: [R(kb.mx + p.mx), R(kb.my + p.my), R(p.ax), R(p.ay), kb.shoot || p.shoot ? 1 : 0, kb.act || p.act ? 1 : 0] });
  }
}

let last = performance.now();
function step(now, hidden) {
  const dt = Math.min(.05, Math.max(0, (now - last) / 1000)); last = now;
  if (NET.role === 'guest') {
    if (mode === 'play' && M) { guestTick(dt); if (!hidden) draw(); } else if (!hidden) drawSky(now / 1000);
    return;
  }
  if (mode === 'play') {
    update(dt);
    if (NET.role === 'host' && mode === 'play') { NET.snapT -= dt; if (NET.snapT <= 0) { NET.snapT = .05; if (NET.peers.size) netSend(snap()); } }
    if (mode === 'play' && !hidden) draw();
  } else if (!hidden) { if (mode === 'title') pollPadsForJoin(); drawSky(now / 1000); }
}
function frame(now) { step(now, false); requestAnimationFrame(frame); }
// Browsers pause animation frames in background tabs; keep an online game running if a player tabs away.
try {
  const ticker = new Worker(URL.createObjectURL(new Blob(['setInterval(()=>postMessage(0),33)'])));
  ticker.onmessage = () => { if (document.hidden && NET.role) step(performance.now(), true); };
} catch (e) { /* workers unavailable */ }
seats[0] = { ctl: 'kb1' };
renderTitle();
requestAnimationFrame(frame);

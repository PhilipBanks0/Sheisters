// SHEISTERS — client: menus, controls, networking, HUD, main loop.
import { L, groundAt, moveCircle, rayT, buildLevel, restricted } from './level.js';
import { CREW, CLASSES, CLASS_IDS, FAVORS, CALLOUTS, TASKS, JOBS, loadSave, saveSave, perkPoints, xpFor, money } from './data.js';
import { abort, createState, update, snapshot, syncLevel, playerEvent, interList, bestInter, objectives, isBody } from './sim.js';
import { R, initRender, buildScene, renderFrame, menuFrame, project, addTracer, muzzle } from './render.js';
import { sfx, music, unlockAudio, setVol } from './audio.js';

const $ = s => document.querySelector(s), ui = $('#ui'), hud = $('#hud'), hc = $('#hud2d'), g2 = hc.getContext('2d');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const G = { save: loadSave(), phase: 'title', role: null, id: 0, code: '', S: null, lobby: null, err: '', feed: [], bubbles: [], hurtT: 0, hint: '', hintT: 0 };
const me = { id: 0, local: null, vy: 0, ammo: 0, reload: 0, cd: 0, snapT: 0, sendT: 0 };
if (G.save.sens === undefined) G.save.sens = 1; if (G.save.vol === undefined) G.save.vol = .7; setVol(G.save.vol);
window.G = G; window.ME = me; window.R_info = () => ({ calls: R.gl.info.render.calls, tris: R.gl.info.render.triangles });                                        // handy for testing from the console

// ------------------------------------------------------------------ input
const keys = {}, IN = { lx: 0, ly: 0, shoot: false, aim: false, locked: false, pressed: {} };
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (!keys[e.code]) IN.pressed[e.code] = true; keys[e.code] = true;
  if (G.phase === 'heist' && ['Tab', 'Space', 'KeyF', 'KeyG', 'KeyR', 'KeyQ'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('keydown', () => { G.usePad = false; }); addEventListener('mousemove', e => { if (IN.locked && (e.movementX || e.movementY)) G.usePad = false; });
addEventListener('mousemove', e => { if (IN.locked) { IN.lx += e.movementX; IN.ly += e.movementY; } });
addEventListener('mousedown', e => {
  unlockAudio();
  if (G.phase !== 'heist') return;
  if (!IN.locked) { if (e.target === hc || e.target === hud || e.target.id === 'gl') $('#gl').requestPointerLock(); return; }
  if (e.button === 0) { IN.shoot = true; IN.pressed.Shoot = true; } if (e.button === 2) IN.aim = true; if (e.button === 1) { IN.pressed.Ping = true; e.preventDefault(); }
});
addEventListener('mouseup', e => { if (e.button === 0) IN.shoot = false; if (e.button === 2) IN.aim = false; });
addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('pointerlockchange', () => { IN.locked = document.pointerLockElement === $('#gl'); if (!IN.locked) { IN.shoot = IN.aim = false; } });
const padPrev = [];
function readPad(dt) {
  const o = { mx: 0, my: 0, lx: 0, ly: 0, shoot: false, aim: false, use: false, sprint: false, on: false };
  const p = (navigator.getGamepads ? [...navigator.getGamepads()] : []).find(p => p && p.connected && p.mapping === 'standard'); if (!p) return o;
  const dz = v => Math.abs(v) < .16 ? 0 : (v - Math.sign(v) * .16) / .84, b = i => p.buttons[i] && p.buttons[i].pressed;
  if (p.buttons.some(x => x.pressed) || p.axes.some(a => Math.abs(a) > .5)) G.usePad = true;
  o.on = true; o.mx = dz(p.axes[0]); o.my = -dz(p.axes[1]); o.lx = dz(p.axes[2]) * 2.8 * dt; o.ly = dz(p.axes[3]) * 2.0 * dt;
  o.shoot = p.buttons[7].value > .4; o.aim = p.buttons[6].value > .4; o.use = b(0); o.sprint = b(10);
  const map = { 8: 'KeyT', 1: 'KeyC', 3: 'KeyG', 2: 'KeyR', 4: 'KeyQ', 5: 'Ping', 11: 'KeyF', 12: 'Digit1', 13: 'Digit3', 14: 'Digit2', 15: 'Digit4', 7: 'Shoot', 9: 'Enter' };
  for (const i in map) { const d = i == 7 ? o.shoot : b(i); if (d && !padPrev[i]) IN.pressed[map[i]] = true; padPrev[i] = d; }
  return o;
}

// ------------------------------------------------------------------ networking
const NET = { ws: null };
function netSend(o) { if (NET.ws && NET.ws.readyState === 1) NET.ws.send(typeof o === 'string' ? o : JSON.stringify(o)); }
function connect(asHost, code) {
  G.err = ''; G.connecting = true; render();
  let ws; try { ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host); } catch (e) { ws = null; }
  const offline = () => { if (!G.connecting) return; G.connecting = false; if (asHost) startLobby('solo', 0, ''); else { G.err = 'Could not reach the server.'; render(); } };
  if (!ws) return offline();
  NET.ws = ws;
  ws.onopen = () => ws.send(JSON.stringify(asHost ? { t: 'host' } : { t: 'join', code }));
  ws.onerror = offline;
  ws.onclose = () => { if (G.connecting) return offline(); if (NET.ws !== ws) return; NET.ws = null; if (G.role === 'guest') { G.err = 'Lost the connection to the crew.'; toTitle(); } else if (G.role === 'host') { G.role = 'solo'; G.code = ''; say('Lost the server — you are playing offline now.', 'warn'); if (G.phase === 'hideout') render(); } };
  ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (x) { return; } onNet(m); };
  clearInterval(NET.ping); NET.ping = setInterval(() => netSend({ t: 'ping' }), 20000);
}
function onNet(m) {
  if (m.t === 'err') { G.connecting = false; G.err = m.msg; if (NET.ws) { const w = NET.ws; NET.ws = null; w.close(); } render(); return; }
  if (m.t === 'role') { G.connecting = false; startLobby(m.role, m.id, m.code); return; }
  if (m.t === 'bye') { G.err = 'The boss closed up shop.'; NET.ws = null; toTitle(); return; }
  if (G.role === 'host') {
    if (m.t === 'peer') {
      if (m.on) { G.lobby.seats.push({ id: m.id, name: 'Crook', cls: 'ghost', lvl: 1, perks: [] });
        const p = G.S && !G.S.over && G.S.pl.find(p => p.id === m.id && p.left);
        if (p) { p.left = 0; p.dn = p.wasDn === 2 ? 2 : 0; p.hp = Math.max(p.hp, 50); p.x = L.van.x - 1.5; p.y = 0; p.z = L.van.z - .5; say(p.name + ' is back on the line.', 'good'); } }
      else { G.lobby.seats = G.lobby.seats.filter(s => s.id !== m.id); if (G.S) { const p = G.S.pl.find(p => p.id === m.id); if (p && !p.left) { p.left = 1; p.wasDn = p.dn; p.dn = 2; p.it = null; say(p.name + ' lost the line. They can rejoin with the crew code.', 'warn'); } } }
      pushLobby();
    } else if (m.t === 'me') { const s = G.lobby.seats.find(s => s.id === m.from); if (s) { s.name = String(m.name || 'Crook').slice(0, 14); s.cls = CLASSES[m.cls] ? m.cls : 'ghost'; s.lvl = m.lvl | 0; s.perks = (m.perks || []).filter(x => typeof x === 'string').slice(0, 5); s.task = TASKS[m.task] ? m.task : ''; pushLobby(); } }
    else if (m.t === 'p' && G.S) { const p = G.S.pl.find(p => p.id === m.from); if (p && !p.dn && Array.isArray(m.v)) { [p.x, p.y, p.z, p.yaw, p.pitch, p.cr, p.mv] = m.v; p.it = m.it || null; } else if (p) p.it = null; }
    else if (m.t === 'ev' && G.S) playerEvent(G.S, G.S.pl.find(p => p.id === m.from), m.e || {});
  } else {
    if (m.t === 'lobby') { G.lobby = m.lobby; if (G.phase === 'hideout' && m.lobby.job && m.lobby.job !== L.job) setJob(m.lobby.job); if (G.phase === 'hideout') render(); }
    else if (m.t === 'start') { if (m.job && m.job !== L.job) setJob(m.job); beginHeist(null); }
    else if (m.t === 'snap') { if (m.s.job !== L.job) setJob(m.s.job); if (G.phase !== 'heist') beginHeist(null); G.S = m.s; syncLevel(G.S); takeEvents(G.S); }
  }
}
function pushLobby() { G.lobby.seats.forEach((s, i) => s.ch = i); netSend({ t: 'lobby', lobby: G.lobby }); if (G.phase === 'hideout') render(); }
function sendMe() {
  const c = G.save.cl[G.save.cls], mine = { name: G.save.name || 'Crook', cls: G.save.cls, lvl: c.lvl, perks: c.perks, task: G.task || '' };
  if (G.role === 'guest') netSend(Object.assign({ t: 'me' }, mine));
  else { Object.assign(G.lobby.seats.find(s => s.id === G.id), mine); pushLobby(); }
}

// ------------------------------------------------------------------ flow
function toTitle() { G.phase = 'title'; G.role = null; G.S = null; G.lobby = null; if (NET.ws) { const w = NET.ws; NET.ws = null; w.close(); } document.exitPointerLock && document.exitPointerLock(); music('menu'); render(); }
const NEED = { bodega: 0, jewel: 1, bank: 3 };
const unlocked = k => G.save.all || G.save.jobs >= NEED[k];
function startLobby(role, id, code) {
  if (role !== 'guest') { const best = ['bank', 'jewel', 'bodega'].find(unlocked); if (best !== L.job) setJob(best); }
  G.role = role; G.id = me.id = id; G.code = code; G.phase = 'hideout';
  G.lobby = { seats: role === 'guest' ? [] : [{ id, name: G.save.name || 'Crook', cls: G.save.cls, lvl: 1, perks: [], ch: 0 }], favor: 'none', fill: true, job: L.job };
  sendMe(); render();
}
function hostStart() {
  const f = FAVORS[G.lobby.favor]; if (G.save.cash < f.price) { G.lobby.favor = 'none'; return pushLobby(); }
  G.save.cash -= f.price; saveSave(G.save);
  const seats = G.lobby.seats.map(s => ({ id: s.id, name: s.name, ch: s.ch, cls: s.cls, perks: s.perks, task: s.task || '' }));
  if (G.lobby.fill) { const used = new Set(seats.map(s => s.cls)); for (let i = seats.length; i < 4; i++) { const cls = CLASS_IDS.find(c => !used.has(c)) || 'muscle'; used.add(cls); seats.push({ id: 10 + i, name: CREW[i].name, ch: i, cls, perks: [], bot: true }); } }
  if (G.lobby.job !== L.job) setJob(G.lobby.job);
  netSend({ t: 'start', job: L.job });
  beginHeist(createState(seats, G.lobby.favor));
}
function setJob(job) { buildLevel(job); buildScene(); }
function beginHeist(S) {
  G.paused = undefined; G.started = false;
  G.S = S; G.phase = 'heist'; G.feed = []; G.bubbles = []; G.tipQ = []; G.tipNow = null; G.rewarded = false; G.overT = 0; me.local = null; me.reload = 0; me.cd = 0; G.masked = false;
  buildScene(); ui.innerHTML = ''; ui.className = ''; hud.style.display = hc.style.display = 'block'; music('stealth');
  say('Case the joint. Nobody notices you until the mask goes on — [G].', '');
}
function say(s, c) { G.feed.push({ s, c: c || '', t: 9 }); if (G.feed.length > 6) G.feed.shift(); }
function takeEvents(S) {
  const cam = R.cam.position;
  for (const e of S.ev) {
    const vol = e.g ? 1 : clamp(1.15 - Math.hypot(e.x - cam.x, e.z - cam.z, (e.y - cam.y) * 2) / 38, 0, 1);
    if (e.k === 'msg') say(e.s, e.c);
    else if (e.k === 'sfx') sfx(e.n, vol);
    else if (e.k === 'say') { G.bubbles.push({ p: e.p, n: e.n, s: e.s, t: 3.5 }); if (e.p !== undefined) { const p = S.pl.find(p => p.id === e.p); say((p ? p.name : '?') + ': “' + e.s + '”', 'call'); sfx('click'); } }
    else if (e.k === 'shot') { addTracer(e.a, e.b, e.w === 'cop' ? 0xff9a6a : 0xffe9a0); sfx(e.w, clamp(1.15 - Math.hypot(e.a[0] - cam.x, e.a[2] - cam.z) / 45, 0, 1) * (e.p === me.id ? .9 : .7)); if (e.p !== undefined) muzzle('p' + e.p); if (e.hit && e.p === me.id) G.hitT = .15; }
    else if (e.k === 'cash') say('+' + money(e.v), 'good');
    else if (e.k === 'hurt' && e.p === me.id) { G.hurtT = .5; sfx('hurt'); }
  }
  S.ev = [];
}

// ------------------------------------------------------------------ the local player
function myP() { return G.S && G.S.pl.find(p => p.id === me.id); }
function sendEv(e) { if (G.role === 'guest') netSend({ t: 'ev', e }); else playerEvent(G.S, myP(), e); }
function aimPoint(S, cx, cy, cz, fx, fy, fz) {
  const R0 = 60; let t = Math.min(1, rayT(cx, cy, cz, cx + fx * R0, cy + fy * R0, cz + fz * R0, 'shot')), hit = -1;
  for (const c of S.npc) {
    if (c.st === 'gone' || c.hid) continue;
    for (const oy of [1.35, .65]) { const px = c.x - cx, py = c.y + oy - cy, pz = c.z - cz, al = px * fx + py * fy + pz * fz; if (al < 0 || al / R0 > t) continue; if (Math.sqrt(Math.max(0, px * px + py * py + pz * pz - al * al)) < .45) { t = al / R0; hit = c.id; } }
  }
  return { x: cx + fx * R0 * t, y: cy + fy * R0 * t, z: cz + fz * R0 * t, n: hit };
}
const camS = { x: 0, y: 5, z: 10, tx: 0, ty: 1, tz: 0, aim: false };
function control(dt) {
  const S = G.S, p = myP(); if (!p) return;
  if (!me.local) { me.local = { x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: -.05, cr: 0, mv: 0 }; me.ammo = CLASSES[p.cls].gun.mag; }
  const l = me.local, pad = readPad(dt), gun = CLASSES[p.cls].gun, P = IN.pressed, alive = p.dn === 0 && !S.over;
  const sens = G.save.sens; l.yaw -= (IN.lx * .0023 + pad.lx) * sens; l.pitch = clamp(l.pitch - (IN.ly * .0021 + pad.ly) * sens, -1.15, 1.0); IN.lx = IN.ly = 0;
  const fx = Math.sin(l.yaw), fz = Math.cos(l.yaw), rx = -fz, rz = fx, cp = Math.cos(l.pitch), sp = Math.sin(l.pitch);
  let mx = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + pad.mx, my = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0) + pad.my; const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
  if (alive) {
    if (P.KeyC || P.ControlLeft) l.cr = l.cr ? 0 : 1;
    const sprint = (keys.ShiftLeft || pad.sprint) && !l.cr && my > 0;
    let sp0 = l.cr ? 2.1 : sprint ? 6.4 : 4.4; if (p.bags) sp0 *= p.cls === 'muscle' ? .92 : .68; if (p.body >= 0) sp0 *= .62; const onCrate = S.crate.st === 0 && S.crate.h.includes(p.id); if (onCrate) sp0 *= .5; if (p.cls === 'muscle' && p.ab > 0) sp0 *= 1.2; if (IN.aim || pad.aim) sp0 *= .6;
    const ox = l.x, oz = l.z;
    moveCircle(l, (fx * my + rx * mx) * sp0 * dt, (fz * my + rz * mx) * sp0 * dt, .35);
    if (onCrate) { const dx = l.x - S.crate.x, dz = l.z - S.crate.z, d = Math.hypot(dx, dz), lim = S.crate.h.length === 2 ? 1.7 : 1.3; if (d > lim) { l.x = S.crate.x + dx / d * lim; l.z = S.crate.z + dz / d * lim; } }
    const g = groundAt(l.x, l.y, l.z);
    if (g < -50) { l.x = ox; l.z = oz; } else if (l.y > g + .03) { me.vy -= 22 * dt; l.y = Math.max(g, l.y + me.vy * dt); } else { me.vy = 0; l.y += (g - l.y) * Math.min(1, dt * 20); }
    l.mv = Math.hypot(l.x - ox, l.z - oz) / Math.max(dt, .001);
    if (!l.cr) { me.stepD = (me.stepD || 0) + l.mv * dt; if (me.stepD > 1.9) { me.stepD = 0; sfx('step', l.mv > 5 ? .32 : .18); } }
  } else { l.mv = 0; l.x = p.x; l.y = p.y; l.z = p.z; }
  // camera
  const aim = (IN.aim || pad.aim) && alive, eye = p.dn ? .9 : l.cr ? 1.2 : 1.62; camS.aim = aim;
  let side = .7; const ts = rayT(l.x, l.y + eye, l.z, l.x + rx * (side + .2), l.y + eye, l.z + rz * (side + .2), 'cam'); if (ts < 1) side = Math.max(0, (side + .2) * ts - .2);
  const px = l.x + rx * side, py = l.y + eye + (p.dn ? 1.2 : 0), pz = l.z + rz * side, dist = p.dn ? 4 : aim ? 1.9 : 4.1;
  const bx = -fx * cp, by = -sp, bz = -fz * cp; let t = rayT(px, py, pz, px + bx * (dist + .3), py + by * (dist + .3), pz + bz * (dist + .3), 'cam'); const dd = t < 1 ? Math.max(.25, (dist + .3) * t - .3) : dist;
  camS.x = px + bx * dd; camS.y = py + by * dd; camS.z = pz + bz * dd; camS.tx = px - bx * 20; camS.ty = py - by * 20; camS.tz = pz - bz * 20;
  // actions
  me.cd -= dt;
  if (me.reload > 0 && (me.reload -= dt) <= 0) me.ammo = gun.mag;
  const list = interList(S), pp = Object.assign({}, p, l), best = alive ? bestInter(S, pp, list) : null;
  G.best = best; l.it = null;
  if (alive) {
    // one press, one job: holding E never rolls over into the next thing in reach
    if (!(keys.KeyE || pad.use)) me.latch = null;
    else { if (me.latch == null && best && !best.info.no) me.latch = best.it.id; if (best && !best.info.no && best.it.id === me.latch) l.it = me.latch; }
    if (P.KeyG) { if (!p.mk) { sendEv({ k: 'mask' }); G.masked = true; } else if (p.bags || p.body >= 0 || S.crate.h.includes(p.id)) sendEv({ k: 'drop' }); }
    if (P.KeyQ) { if (p.abCd <= 0) sendEv({ k: 'abil' }); else hint('Not ready yet'); }
    if (P.KeyT) sendEv({ k: 'order' });
    if (P.KeyF) { if (p.mk) sendEv({ k: 'shout' }); else hint('Mask up first [G]'); }
    if (P.KeyR && me.ammo < gun.mag && me.reload <= 0) { me.reload = 1.5; sfx('unlock', .6); }
    const wants = gun.auto ? (IN.shoot || pad.shoot) : P.Shoot;
    if (wants && me.reload <= 0 && me.cd <= 0) {
      if (!p.mk) hint('Mask up [G] to pull your piece');
      else if (me.ammo <= 0) { me.reload = 1.5; sfx('unlock', .6); }
      else {
        const a = aimPoint(S, camS.x, camS.y, camS.z, -bx, -by, -bz), o = [l.x + rx * .25, l.y + (l.cr ? 1.05 : 1.45), l.z + rz * .25];
        sendEv({ k: 'shot', o, d: [a.x - o[0], a.y - o[1], a.z - o[2]] }); me.ammo--; me.cd = gun.cd; l.pitch += .008 + (gun.pellets ? .03 : 0);
      }
    }
  }
  if (P.Ping || P.KeyZ) { const a = aimPoint(S, camS.x, camS.y, camS.z, -bx, -by, -bz); sendEv({ k: 'ping', x: a.x, y: a.y, z: a.z, n: a.n }); }
  // a guard's footsteps carry: you hear him before you see him
  me.gT = (me.gT || 0) - dt;
  if (me.gT <= 0) { me.gT = .52; let near = 99; for (const n of S.npc) if (n.k !== 'civ' && n.mv > .5 && n.st !== 'gone' && Math.abs(n.y - l.y) < 2.5) near = Math.min(near, Math.hypot(n.x - l.x, n.z - l.z)); if (near < 11) sfx('step', .5 * (1 - near / 11)); }
  for (let i = 0; i < CALLOUTS.length; i++) if (P['Digit' + (i + 1)]) sendEv({ k: 'call', i });
  // tell the host where we are
  if (G.role === 'guest') { me.sendT -= dt; if (me.sendT <= 0) { me.sendT = 1 / 18; const r = v => Math.round(v * 100) / 100; netSend({ t: 'p', v: [r(l.x), r(l.y), r(l.z), r(l.yaw), r(l.pitch), l.cr, r(l.mv)], it: l.it }); } }
  else if (alive) { p.x = l.x; p.y = l.y; p.z = l.z; p.yaw = l.yaw; p.pitch = l.pitch; p.cr = l.cr; p.mv = l.mv; p.it = l.it; } else p.it = null;
}
function hint(s) { G.hint = s; G.hintT = 1.6; }
// first-time lessons: each shows once per save, one at a time
const TIPS = {
  case: ['CASING', 'You look like a customer. Walk in and find the guards and cameras. Aim at one and press Z to mark it for the crew. Nothing is illegal until you press G.'],
  tresp: ['STAFF ONLY', 'Back rooms are off limits. Guards and cameras notice you here even without a mask.'],
  mask: ['MASK ON', 'Now everyone reacts to you. Crouch (C) to be harder to notice. F shouts civilians to the floor, but someone has to keep an eye on them.'],
  spot: ['BEING WATCHED', 'The bar over a guard fills while he can see you. Break his line of sight, or get behind him and hold E.'],
  radio: ['HIS RADIO', 'A dropped guard gets a radio call. Hold E on him to answer within 12 seconds. Dispatch only buys four excuses per job.'],
  body: ['BODIES', 'Other guards raise the alarm if they find him. Pick him up with E and stash him where the STASH marker points.'],
  bag: ['THE LOOT', 'Bags slow you down. Carry it to the van and hold E to throw it in. G drops it.'],
  loud: ['IT IS LOUD', 'Police arrive in waves and get heavier. T orders AI partners to follow you. Load what you can, get the whole crew to the van, and hold E there to drive.'],
  down: ['YOU ARE DOWN', 'A partner has to reach you and hold E before the timer runs out.'],
};
function tip(id) { const t = G.save.tips || (G.save.tips = {}); if (t[id] || G.tipQ.includes(id)) return; G.tipQ.push(id); }
function tipsTick(dt, S, p, l) {
  if (!p.mk) tip('case'); else tip('mask');
  if (!p.mk && restricted(l.x, l.y, l.z)) tip('tresp');
  if (!S.loud && S.npc.some(n => n.k === 'guard' && n.det > .3 && n.st !== 'ko' && n.st !== 'dead')) tip('spot');
  if (!S.loud && S.npc.some(n => n.radio > 0)) tip('radio'); else if (!S.loud && S.npc.some(n => n.st === 'ko' && !n.hid && !(n.radio > 0))) tip('body');
  if (p.bags) tip('bag'); if (S.loud) tip('loud'); if (p.dn === 1) tip('down');
  if (G.tipNow) { G.tipT -= dt; if (G.tipT <= 0) G.tipNow = null; }
  else if (G.tipQ.length) { G.tipNow = G.tipQ.shift(); G.tipT = 9; G.save.tips[G.tipNow] = 1; saveSave(G.save); sfx('ping', .5); }
}

// ------------------------------------------------------------------ HUD
function drawHud(dt) {
  const S = G.S, p = myP(); if (!p) { hud.innerHTML = '<div class="banner warn">JOB IN PROGRESS — you are in on the next one</div>'; return; }
  const W = hc.width = innerWidth, Hh = hc.height = innerHeight, l = me.local || p;
  g2.clearRect(0, 0, W, Hh); g2.textAlign = 'center'; g2.textBaseline = 'middle';
  const tag = (x, y, txt, col, bg) => { g2.font = 'bold 13px system-ui'; const w = g2.measureText(txt).width + 12; g2.fillStyle = bg || 'rgba(8,9,14,.75)'; g2.fillRect(x - w / 2, y - 10, w, 20); g2.fillStyle = col; g2.fillText(txt, x, y + 1); };
  // crew tags
  for (const q of S.pl) { if (q.id === me.id || q.dn === 2) continue; const s = project(q.x, q.y + (q.dn ? .9 : 2.15), q.z); if (!s.ok) continue; tag(s.x, s.y, (q.dn ? '✚ ' : '') + q.name + (q.dn ? ' ' + Math.ceil(q.dnT) + 's' : ''), q.dn ? '#ff6a6a' : CREW[q.ch % 4].color); }
  // guard awareness
  for (const n of S.npc) {
    if (n.k !== 'guard' || isBody(n) || n.det < .04 || S.loud) continue; const s = project(n.x, n.y + 2.2, n.z); if (!s.ok) continue;
    const full = n.st === 'alert'; g2.fillStyle = 'rgba(8,9,14,.8)'; g2.fillRect(s.x - 22, s.y - 5, 44, 10); g2.fillStyle = full ? '#ff3030' : n.det > .4 ? '#ffb020' : '#f5e9c0'; g2.fillRect(s.x - 20, s.y - 3, 40 * n.det, 6);
    g2.font = 'bold 20px system-ui'; g2.fillText(full ? '!' : '?', s.x, s.y - 18);
  }
  for (const n of S.npc) if (n.radio > 0 && !S.loud) { const s = project(n.x, n.y + 1.2, n.z); if (s.ok) tag(s.x, s.y, 'RADIO ' + Math.ceil(n.radio) + 's', '#fff', 'rgba(200,40,40,.9)'); }
  if (S.camMark > S.t || S.favor === 'sheet') L.cams.forEach((c, i) => { const s = project(c.x, c.y, c.z); if (s.ok) tag(s.x, s.y - 14, S.camsOff ? 'CAM OFF' : 'CAMERA', S.camsOff ? '#8a8a8a' : '#ffb020'); });
  // pings
  for (const pg of S.pings) { const s = project(pg.x, pg.y + .3, pg.z); if (!s.ok) continue; const q = S.pl.find(q => q.id === pg.by), col = q ? CREW[q.ch % 4].color : '#fff';
    g2.save(); g2.translate(s.x, s.y - 14); g2.rotate(Math.PI / 4); g2.strokeStyle = col; g2.lineWidth = 3; g2.strokeRect(-7, -7, 14, 14); g2.restore();
    g2.font = 'bold 12px system-ui'; g2.fillStyle = col; g2.fillText(Math.round(Math.hypot(pg.x - l.x, pg.z - l.z)) + 'm', s.x, s.y + 6); }
  // objective markers
  const mark = (x, y, z, txt) => { const s = project(x, y, z); if (s.ok && Math.hypot(x - l.x, z - l.z) > 4) tag(clamp(s.x, 60, W - 60), clamp(s.y, 40, Hh - 40), txt, '#f5c518'); };
  if (S.vault.open || S.loud) mark(L.van.x + 1, 2.6, L.van.z, 'VAN');
  if (S.vault.open && S.bags.some(b => b.st === 0)) mark(L.lootMark[0], L.lootMark[1], L.lootMark[2], 'LOOT');
  if (S.vault.open && S.crate.st === 0) { const s = project(S.crate.x, S.crate.y + 1.4, S.crate.z); if (s.ok && Math.hypot(S.crate.x - l.x, S.crate.z - l.z) < 14) tag(s.x, s.y, 'GOLD CRATE · 2 crooks · $60,000', '#ffd24a'); }
  if (p.body >= 0) for (const it of L.inter) if (it.type === 'stash') mark(it.x, 2, it.z, 'STASH');
  // speech bubbles
  for (const b of G.bubbles) { b.t -= dt; const e = b.p !== undefined ? S.pl.find(q => q.id === b.p) : S.npc.find(n => n.id === b.n); if (!e || (b.p === me.id)) continue; const s = project(e.x, e.y + 2.5, e.z); if (!s.ok || Math.hypot(e.x - l.x, e.z - l.z) > 30) continue; g2.globalAlpha = clamp(b.t, 0, 1); tag(s.x, s.y, b.s, '#111', 'rgba(245,238,220,.95)'); g2.globalAlpha = 1; }
  G.bubbles = G.bubbles.filter(b => b.t > 0);
  // crosshair + hit marker
  const cx = W / 2, cy = Hh / 2; g2.strokeStyle = p.mk ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.35)'; g2.lineWidth = 2; const gap = camS.aim ? 4 : 8;
  g2.beginPath(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { g2.moveTo(cx + dx * gap, cy + dy * gap); g2.lineTo(cx + dx * (gap + 7), cy + dy * (gap + 7)); } g2.stroke();
  if (G.hitT > 0) { G.hitT -= dt; g2.strokeStyle = '#ff4040'; g2.beginPath(); for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { g2.moveTo(cx + dx * 6, cy + dy * 6); g2.lineTo(cx + dx * 13, cy + dy * 13); } g2.stroke(); }
  if (G.hurtT > 0) { G.hurtT -= dt; const gr = g2.createRadialGradient(cx, cy, Hh * .3, cx, cy, Hh * .8); gr.addColorStop(0, 'rgba(180,0,0,0)'); gr.addColorStop(1, `rgba(180,0,0,${G.hurtT})`); g2.fillStyle = gr; g2.fillRect(0, 0, W, Hh); }

  // ---- DOM panels (refreshed ~8 times a second)
  G.hudT = (G.hudT || 0) - dt; G.hintT -= dt; if (G.hudT > 0 && !G.best !== !G.lastBest) G.hudT = 0; if (G.hudT > 0) return; G.hudT = .12; G.lastBest = G.best;
  const cls = CLASSES[p.cls], gun = cls.gun;
  tipsTick(.12, S, p, l);
  let det = 0; for (const n of S.npc) if (n.k === 'guard' && !isBody(n)) det = Math.max(det, n.det); for (const c of S.cams) det = Math.max(det, c.d);
  let banner, bc = '';
  if (S.over) { banner = S.over.ok ? 'GETAWAY' : 'BUSTED'; bc = S.over.ok ? 'good' : 'bad'; }
  else if (S.loud) { banner = S.wave ? 'POLICE ASSAULT — WAVE ' + S.wave + ' · next in ' + Math.ceil(S.waveT) + 's' : 'ALARM — COPS ARRIVE IN ' + Math.ceil(S.waveT) + 's'; bc = 'bad'; }
  else if (S.alarmT >= 0) { banner = 'ALARM IN ' + Math.ceil(S.alarmT) + ' — ' + S.alarmWhy.toUpperCase(); bc = 'warn'; }
  else if (!p.mk) banner = 'CASING — you look like a customer. [G] mask up';
  else { banner = det > .05 ? 'SOMEBODY IS LOOKING…' : 'QUIET — nobody knows yet'; bc = det > .4 ? 'warn' : ''; }
  const b = G.best; let prompt = '';
  if (b) { const pr = S.prog[b.it.id], frac = b.info.reader !== undefined ? S.vault.rp / 1.6 : pr ? pr.p / (pr.t || 1) : 0; const other = b.info.reader !== undefined ? (S.t - S.vault.r[1 - b.info.reader] < .25 ? ' — partner is on the other one!' : ' — waiting for a partner') : '';
    prompt = `<div class="prompt ${b.info.no ? 'no' : ''}">${b.info.no ? '' : `<b>${G.usePad ? 'Ⓐ' : 'E'}</b> `}${esc(b.info.label + other)}${frac > 0 ? `<i style="width:${clamp(frac, 0, 1) * 100}%"></i>` : ''}</div>`; }
  else if (G.hintT > 0) prompt = `<div class="prompt no">${esc(G.hint)}</div>`;
  const cards = (S.cards.a === p.id ? 1 : 0) + (S.cards.b === p.id ? 1 : 0);
  hud.innerHTML = `
    <div class="banner ${bc}">${esc(banner)}${!S.loud && det > .02 ? `<span class="det"><i style="width:${det * 100}%"></i></span>` : ''}</div>
    <div class="obj"><h4>THE PLAN</h4>${p.task ? `<div class="task">YOUR JOB: ${esc(TASKS[p.task])}</div>` : ''}${objectives(S).map(o => `<div>${esc(o)}</div>`).join('')}</div>
    <div class="feed">${G.feed.map(f => `<div class="${f.c}" style="opacity:${clamp(f.t / 2, 0, 1)}">${esc(f.s)}</div>`).join('')}</div>
    <div class="crew">${S.pl.map(q => `<div class="${q.dn ? 'dn' : ''}"><b style="color:${CREW[q.ch % 4].color}">${esc(q.name)}</b> <em>${CLASSES[q.cls].name}${q.bot ? ' · AI' : ''}${q.task ? ' · ' + esc(TASKS[q.task]) : ''}</em>${q.bags ? ' 💰' : ''}${S.cards.a === q.id || S.cards.b === q.id ? ' 🔑' : ''}<span class="hp"><i style="width:${q.dn === 2 ? 0 : q.hp}%"></i></span>${q.dn === 1 ? '<u>DOWN ' + Math.ceil(q.dnT) + 's</u>' : q.dn === 2 ? '<u>IN CUFFS</u>' : ''}</div>`).join('')}</div>
    <div class="me"><div class="take">${money(S.take)}<small>in the van</small></div>
      <div class="bars"><span class="hp big"><i style="width:${p.hp}%"></i></span><span class="ar"><i style="width:${Math.min(100, p.ar)}%"></i></span></div>
      <div class="gun">${p.mk ? `${esc(gun.name)} <b>${me.reload > 0 ? 'reloading' : me.ammo + ' / ' + gun.mag}</b>` : 'Hands in your pockets'}${cards ? ' · 🔑×' + cards : ''}${p.bags ? ' · 💰×' + p.bags + ' <small>[G] drop</small>' : ''}${p.body >= 0 ? ' · carrying a body <small>[G] drop</small>' : ''}${S.crate.h.includes(p.id) ? ' · on the gold crate <small>[G] let go</small>' : ''}</div>
      <div class="abil ${p.abCd > 0 ? 'cd' : ''}"><b>${G.usePad ? 'LB' : 'Q'}</b> ${esc(cls.ability.name)} ${p.ab > 0 && p.cls !== 'mastermind' ? '· ACTIVE ' + Math.ceil(p.ab) + 's' : p.abCd > 0 ? '· ' + Math.ceil(p.abCd) + 's' : '· ready'}</div></div>
    ${prompt}
    ${keys.Tab || keys.KeyX ? `<div class="calls"><h4>CALLOUTS</h4>${CALLOUTS.map((c, i) => `<div><b>${i + 1}</b> ${c[0]}</div>`).join('')}<div><b>Z</b> / middle-click — ping</div><div><b>F</b> — shout the room down</div></div>` : `<div class="keys">${G.usePad ? 'Stick move · L3 run · Ⓑ crouch · Ⓐ use · Ⓨ mask / drop · LB ability · RB ping · R3 shout · Ⓧ reload · RT fire · LT aim · D-pad callouts · Back crew follow' : 'WASD move · Shift run · C crouch · E use · G mask / drop · Q ability · F shout · Z ping · T crew follow / hold · 1–6 callouts · hold Tab for list'}</div>`}
    ${p.dn === 1 ? `<div class="down">YOU'RE DOWN<small>A partner has ${Math.ceil(p.dnT)}s to get you up</small></div>` : p.dn === 2 ? '<div class="down">IN CUFFS<small>Watch the rest of the crew finish it</small></div>' : ''}
    ${G.tipNow ? `<div class="tip"><h4>${TIPS[G.tipNow][0]}</h4>${esc(TIPS[G.tipNow][1])}</div>` : ''}
`;
  const wantPause = !IN.locked && !S.over && !R.noDraw;
  if (wantPause !== !!G.paused) { G.paused = wantPause; ui.className = wantPause ? 'pause' : ''; ui.innerHTML = wantPause ? `<div class="card pz"><h3>${G.started ? 'PAUSED' : esc(L.name.toUpperCase())}</h3><p class="dim">${G.role === 'guest' || G.role === 'host' ? 'The job keeps running for the crew.' : 'Solo jobs keep running too. Find a quiet corner.'}</p><button data-a="resume" class="big">${G.started ? 'Back to work' : 'Start — click to take control'}</button><button data-a="quit" class="ghost">${G.role === 'guest' ? 'Leave the crew' : 'Call off the job'}</button></div>` : ''; }
}

// ------------------------------------------------------------------ menus
function render() {
  if (G.phase === 'heist') return;
  hud.style.display = hc.style.display = 'none'; ui.className = 'menu';
  const s = G.save;
  if (G.phase === 'title') {
    ui.innerHTML = `<div class="title"><h1>SHEISTERS</h1><h2>New York City, 1986. Four crooks. One vault.</h2>
      <div class="card"><label>What do they call you?</label><input id="name" maxlength="14" value="${esc(s.name)}" placeholder="Street name">
        <button data-a="host" class="big">Start a crew</button>
        <div class="row"><input id="code" maxlength="4" placeholder="CODE" style="text-transform:uppercase"><button data-a="join">Join a crew</button></div>
        ${G.connecting ? '<p>Making some calls…</p>' : ''}${G.err ? `<p class="err">${esc(G.err)}</p>` : ''}</div>
      <p class="foot">Third-person co-op heist for up to four. Keyboard + mouse or gamepad. Empty seats are filled by AI partners who hold the van.</p></div>`;
    return;
  }
  if (G.phase === 'result') {
    const o = G.S.over, r = G.reward;
    ui.innerHTML = `<div class="title"><h1 class="${o.ok ? 'good' : 'bad'}">${o.ok ? (o.stealth ? 'GHOSTS' : 'GETAWAY') : 'BUSTED'}</h1><h2>${esc(o.why)}</h2>
      <div class="card res"><div><span>Loot in the van</span><b>${money(o.take)}</b></div>${o.stealth ? '<div><span>Nobody heard a thing</span><b>+25%</b></div>' : ''}${o.fees ? `<div><span>Cleanup for dead civilians</span><b>-${money(o.fees)}</b></div>` : ''}
        <div><span>Your cut (four-way split)</span><b>${money(o.share)}</b></div><div><span>${CLASSES[r.cls].name} experience</span><b>+${o.xp} XP${r.up ? ' · LEVEL ' + r.lvl + '!' : ''}</b></div><div><span>Time on the job</span><b>${Math.floor(o.time / 60)}:${String(o.time % 60).padStart(2, '0')}</b></div>
        <button data-a="back" class="big">Back to the hideout</button></div></div>`;
    return;
  }
  // hideout
  const c = s.cl[s.cls], C = CLASSES[s.cls], pts = perkPoints(c), host = G.role !== 'guest', lob = G.lobby, fav = FAVORS[lob.favor] || FAVORS.none;
  ui.innerHTML = `<div class="hide">
    <section class="col"><h3>THE CREW ${G.code ? `<span class="code">${G.code}</span>` : '<span class="code off">OFFLINE</span>'}</h3>
      ${G.code ? '<p class="dim">Give your partners this code. They pick “Join a crew”.</p>' : '<p class="dim">No server connection — solo job with AI partners.</p>'}
      ${[0, 1, 2, 3].map(i => { const q = lob.seats[i]; return q ? `<div class="seat"><b style="color:${CREW[i].color}">${esc(q.name)}</b>${q.id === G.id ? ' <em>(you)</em>' : ''}<span>${CLASSES[q.cls].name} · L${q.lvl}${q.task ? '<br>' + esc(TASKS[q.task]) : ''}</span></div>` : `<div class="seat empty"><b>${lob.fill ? CREW[i].name + ' (AI)' : 'Empty seat'}</b><span>${lob.fill ? 'Holds the van, covers the street' : '—'}</span></div>`; }).join('')}
      ${host ? `<label class="chk"><input type="checkbox" data-a="fill" ${lob.fill ? 'checked' : ''}> Fill empty seats with AI partners</label>` : ''}
      <div class="cash">${money(s.cash)}<small>your stash · ${s.jobs} jobs pulled</small></div>
      <div class="set"><label>Look sensitivity <input type="range" min=".3" max="2.5" step=".1" value="${s.sens}" data-s="sens"></label><label>Volume <input type="range" min="0" max="1" step=".05" value="${s.vol}" data-s="vol"></label></div>
      <button data-a="leave" class="ghost">Leave</button></section>
    <section class="col wide"><h3>YOUR ROLE</h3>
      <div class="classes">${CLASS_IDS.map(id => `<button data-a="cls" data-v="${id}" class="cls ${id === s.cls ? 'on' : ''}" style="--c:${CLASSES[id].color}"><b>${CLASSES[id].name}</b><span>${CLASSES[id].tag}</span><em>Level ${s.cl[id].lvl}</em></button>`).join('')}</div>
      <p>${esc(C.blurb)}</p>
      <div class="kit"><div><b>${esc(C.gun.name)}</b>${C.gun.silent ? ' — silent' : C.gun.pellets ? ' — close range' : C.gun.auto ? ' — full auto' : ''}</div><div><b>[Q] ${esc(C.ability.name)}</b> — ${esc(C.ability.desc)}</div></div>
      <div class="xp"><i style="width:${c.lvl >= 10 ? 100 : c.xp / xpFor(c.lvl) * 100}%"></i><span>Level ${c.lvl}${c.lvl >= 10 ? ' (max)' : ' · ' + c.xp + ' / ' + xpFor(c.lvl) + ' XP'} · ${pts} skill point${pts === 1 ? '' : 's'}</span></div>
      <div class="perks">${C.perks.map(k => { const own = c.perks.includes(k.id); return `<button data-a="perk" data-v="${k.id}" class="perk ${own ? 'own' : pts ? 'can' : ''}" ${own || !pts ? 'disabled' : ''}><b>${esc(k.name)}</b><span>${esc(k.desc)}</span></button>`; }).join('')}</div>
      <p class="dim">A skill point every second level. Experience comes from the take — bigger and quieter jobs pay more.</p></section>
    <section class="col"><h3>THE JOB</h3><div class="jobs">${Object.keys(JOBS).map(k => `<button data-a="job" data-v="${k}" class="${k === lob.job ? 'on' : ''}" ${host && unlocked(k) ? '' : 'disabled'}>${esc(JOBS[k].name)}<span>${esc(JOBS[k].hood)} · ${!host || unlocked(k) ? JOBS[k].take : 'pull ' + (NEED[k] - s.jobs) + ' more job' + (NEED[k] - s.jobs === 1 ? '' : 's') + ' to unlock'}</span></button>`).join('')}</div>${host && !s.all && s.jobs < 3 ? '<label class="chk"><input type="checkbox" data-a="all"> Skip ahead: open every job</label>' : ''}
      <p class="dim">${JOBS[lob.job || 'bank'].brief}</p>
      <p class="dim">Walk in as customers and look around. Nothing counts until the masks go on.</p>
      <button data-a="bp">Study the blueprint</button>
      <h4>YOUR ASSIGNMENT</h4><select data-s="task">${Object.keys(TASKS).map(k => `<option value="${k}" ${k === (G.task || '') ? 'selected' : ''}>${esc(TASKS[k])}</option>`).join('')}</select>
      <h4>CALL IN A FAVOUR${host ? '' : ' (the boss decides)'}</h4>
      ${Object.keys(FAVORS).map(k => `<button data-a="fav" data-v="${k}" class="fav ${k === lob.favor ? 'on' : ''}" ${host && s.cash >= FAVORS[k].price ? '' : 'disabled'}><b>${esc(FAVORS[k].name)}</b> <em>${FAVORS[k].price ? money(FAVORS[k].price) : 'free'}</em><span>${esc(FAVORS[k].desc)}</span></button>`).join('')}
      ${host ? `<button data-a="start" class="big">Pull the job${fav.price ? ' (' + money(fav.price) + ')' : ''}</button>` : '<p class="wait">Waiting for the boss to start the job…</p>'}
      <p class="dim soon">Next scores being rebuilt: Corner Bodega · Pawn Shop · Armored Truck · Bullion Depository</p></section></div>`;
  if (G.bp) blueprintOverlay();
}
// top-down plans drawn straight from the level geometry, so they can never be out of date

function drawBlueprint(cv, fy) {
  const g = cv.getContext('2d'), sc = 13, ox = 21, oz = 22, X = x => (x + ox) * sc, Z = z => (z + oz) * sc;
  g.fillStyle = '#0d2a4a'; g.fillRect(0, 0, cv.width, cv.height); g.strokeStyle = 'rgba(255,255,255,.06)';
  for (let i = 0; i < cv.width; i += sc * 2) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, cv.height); g.stroke(); } for (let i = 0; i < cv.height; i += sc * 2) { g.beginPath(); g.moveTo(0, i); g.lineTo(cv.width, i); g.stroke(); }
  for (const b of L.boxes) { if (b.floor || b.skyline || b.invis || b.y1 <= fy + .6 || b.y0 >= fy + 1.75 || b.mat === 'roof') continue;
    g.fillStyle = b.door ? '#f5c518' : b.vault ? '#ff6a4a' : b.glass ? 'rgba(160,220,255,.6)' : b.van ? '#9fe8a0' : b.y1 - b.y0 < 1.5 ? 'rgba(200,225,255,.4)' : '#d8e8ff';
    g.fillRect(X(b.x0), Z(b.z0), Math.max(2, (b.x1 - b.x0) * sc), Math.max(2, (b.z1 - b.z0) * sc)); }
  g.fillStyle = 'rgba(200,225,255,.25)'; for (const r of L.ramps) if (Math.min(r.yA, r.yB) <= fy + .1 && Math.max(r.yA, r.yB) >= fy - .1) { g.fillRect(X(r.x0), Z(r.z0), (r.x1 - r.x0) * sc, (r.z1 - r.z0) * sc); for (let x = r.x0; x < r.x1; x += .5) g.fillRect(X(x), Z(r.z0), 1, (r.z1 - r.z0) * sc); }
  g.font = 'bold 11px system-ui'; g.textAlign = 'center';
  const pin = (x, z, t, c) => { g.fillStyle = c; g.beginPath(); g.arc(X(x), Z(z), 5, 0, 7); g.fill(); g.fillStyle = '#fff'; g.fillText(t, X(x), Z(z) - 9); };
  const on = y => Math.abs(y - fy) < 1.5;
  L.guards.forEach(gd => { const r = gd.route; if (!on(r[0].y)) return; g.strokeStyle = 'rgba(255,90,90,.8)'; g.setLineDash([4, 4]); g.beginPath(); r.forEach((p, i) => i ? g.lineTo(X(p.x), Z(p.z)) : g.moveTo(X(p.x), Z(p.z))); if (r.length > 2) g.closePath(); g.stroke(); g.setLineDash([]); pin(r[0].x, r[0].z, gd.card ? 'GUARD + KEYCARD' : 'GUARD', '#ff5a5a'); });
  L.cams.forEach((c, i) => { if (c.floor !== fy) return; g.fillStyle = 'rgba(255,190,40,.12)'; g.beginPath(); g.moveTo(X(c.x), Z(c.z)); g.arc(X(c.x), Z(c.z), c.range * sc, Math.PI / 2 - c.yaw - .65 - c.sweep, Math.PI / 2 - c.yaw + .65 + c.sweep); g.fill(); pin(c.x, c.z, 'CAM', '#ffbe28'); });
  for (const q of L.pins) if (q[0] === fy) pin(q[1], q[2], q[3], q[4]);


}
function blueprintOverlay() {
  const d = document.createElement('div'); d.className = 'bp';
  d.innerHTML = `<div class="bpin"><h3>${esc(L.name.toUpperCase())} — the janitor's drawings <button data-a="bp">Close</button></h3><div class="bprow n${L.floors.length}">${L.floors.map((f, i) => `<figure><canvas id="bp${i}" width="${f[1] === 0 ? 572 : 390}" height="${f[1] === 0 ? 430 : 130}"></canvas><figcaption>${f[0]}</figcaption></figure>`).join('')}</div>
    <p class="dim"><b style="color:#ff5a5a">Red</b> guards and their rounds · <b style="color:#ffbe28">amber</b> camera arcs · <b style="color:#f5c518">gold</b> doors, keycards, readers · <b style="color:#5fd38d">green</b> the money and the way out. Stash bodies in the dumpster or the security-room locker.</p></div>`;
  ui.appendChild(d);
  L.floors.forEach((f, i) => { const cv = d.querySelector('#bp' + i), g = cv.getContext('2d'); if (f[1] !== 0) { g.translate(-78, -18); } drawBlueprint(cv, f[1]); });
}
ui.addEventListener('click', e => {
  const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a, v = b.dataset.v, s = G.save; unlockAudio(); sfx('click');
  const nm = $('#name'); if (nm) { s.name = nm.value.trim().slice(0, 14); saveSave(s); }
  if (a === 'host') connect(true);
  else if (a === 'join') { const code = ($('#code').value || '').toUpperCase().trim(); if (code.length !== 4) { G.err = 'Crew codes are four letters.'; render(); } else connect(false, code); }
  else if (a === 'leave') toTitle();
  else if (a === 'resume') { G.started = true; $('#gl').requestPointerLock(); }
  else if (a === 'quit') { if (G.role === 'guest') toTitle(); else if (G.S && !G.S.over) abort(G.S); }
  else if (a === 'bp') { G.bp = !G.bp; render(); }
  else if (a === 'cls') { s.cls = v; saveSave(s); sendMe(); render(); }
  else if (a === 'perk') { const c = s.cl[s.cls]; if (perkPoints(c) > 0 && !c.perks.includes(v)) { c.perks.push(v); saveSave(s); sendMe(); render(); } }
  else if (a === 'all') { s.all = 1; saveSave(s); render(); }
  else if (a === 'job' && G.role !== 'guest' && unlocked(v)) { G.lobby.job = v; setJob(v); pushLobby(); }
  else if (a === 'fav' && G.role !== 'guest') { G.lobby.favor = v; pushLobby(); }
  else if (a === 'fill' && G.role !== 'guest') { G.lobby.fill = b.checked; pushLobby(); }
  else if (a === 'start' && G.role !== 'guest') hostStart();
  else if (a === 'back') { G.phase = 'hideout'; G.S = null; music('menu'); sendMe(); if (G.role !== 'guest') pushLobby(); render(); }
});
ui.addEventListener('input', e => { const k = e.target.dataset && e.target.dataset.s; if (!k) return; if (k === 'task') { G.task = e.target.value; sendMe(); return; } G.save[k] = +e.target.value; if (k === 'vol') { setVol(G.save.vol); sfx('ping'); } saveSave(G.save); });
function reward() {
  const o = G.S.over, s = G.save, p = myP(), cls = p ? p.cls : s.cls, c = s.cl[cls], lvl0 = c.lvl;
  s.cash += o.share; s.jobs += o.ok ? 1 : 0; c.xp += o.xp; while (c.lvl < 10 && c.xp >= xpFor(c.lvl)) { c.xp -= xpFor(c.lvl); c.lvl++; }
  saveSave(s); G.reward = { cls, lvl: c.lvl, up: c.lvl > lvl0 };
}

// ------------------------------------------------------------------ loop
let last = performance.now();
function step(now, draw) {
  const dt = Math.min(draw ? .05 : .12, (now - last) / 1000); last = now;
  if (G.phase === 'heist' && G.S) {
    const S = G.S;
    if (draw) control(dt); else { const p = myP(); if (p) p.it = null; }
    if (G.role !== 'guest') {
      update(S, dt);
      me.snapT -= dt; if (me.snapT <= 0) { me.snapT = 1 / 12; if (G.role === 'host') netSend('{"t":"snap","s":' + snapshot(S) + '}'); takeEvents(S); }
    } else S.t += dt;
    for (const f of G.feed) f.t -= dt; G.feed = G.feed.filter(f => f.t > 0);
    music(S.loud ? 'loud' : 'stealth');
    if (draw) { renderFrame(S, me, dt, camS); drawHud(dt); }
    if (S.over) {
      if (!G.rewarded) { G.rewarded = true; reward(); sfx(S.over.ok ? 'win' : 'lose'); if (G.role === 'host') netSend('{"t":"snap","s":' + snapshot(S) + '}'); }
      G.overT += dt; if (G.overT > 3) { G.paused = undefined; G.phase = 'result'; document.exitPointerLock && document.exitPointerLock(); music('menu'); render(); }
    }
  } else if (R.scene && draw) menuFrame(dt);
  IN.pressed = {};
}
function frame(now) { requestAnimationFrame(frame); step(now, true); }
// browsers stop drawing hidden tabs; a host that alt-tabs must keep the job running for everyone else
try {
  const w = new Worker(URL.createObjectURL(new Blob(['setInterval(()=>postMessage(0),33)'], { type: 'text/javascript' })));
  w.onmessage = () => { if (document.hidden && G.phase === 'heist' && G.role === 'host') step(performance.now(), false); };
} catch (e) { }
initRender($('#gl')); buildScene(); render(); requestAnimationFrame(frame);
addEventListener('pointerdown', () => { unlockAudio(); if (G.phase !== 'heist') music('menu'); }, { once: true });

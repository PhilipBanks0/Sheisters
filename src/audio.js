// SHEISTERS — every sound is synthesised here. No audio files.
let ac = null, master = null, musicOn = false, loops = {};
export const AUDIO = { vol: .7 };
function ctx() {
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = AUDIO.vol; master.connect(ac.destination); } catch (e) { return null; } }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
export function unlockAudio() { ctx(); }
export function setVol(v) { AUDIO.vol = v; if (master) master.gain.value = v; }
function tone(f0, f1, dur, type, vol, delay) {
  const a = ctx(); if (!a) return; const t = a.currentTime + (delay || 0), o = a.createOscillator(), g = a.createGain();
  o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .02);
}
let nbuf = null;
function noise(dur, cut, vol, q, delay) {
  const a = ctx(); if (!a) return;
  if (!nbuf) { nbuf = a.createBuffer(1, a.sampleRate, a.sampleRate); const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const t = a.currentTime + (delay || 0), s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  s.buffer = nbuf; f.type = 'lowpass'; f.frequency.setValueAtTime(cut, t); f.frequency.exponentialRampToValueAtTime(Math.max(80, cut * .15), t + dur); f.Q.value = q || 1;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random() * .5, dur + .05);
}
export function sfx(name, v) {
  v = v === undefined ? 1 : v; if (v <= .02) return;
  switch (name) {
    case 'mastermind': noise(.12, 3800, .5 * v); tone(190, 70, .08, 'square', .12 * v); break;
    case 'safecracker': noise(.16, 3000, .6 * v); tone(160, 60, .1, 'square', .15 * v); break;
    case 'muscle': noise(.34, 1900, .9 * v, 2); tone(110, 40, .2, 'sawtooth', .25 * v); break;
    case 'ghost': noise(.07, 1400, .22 * v, 4); break;
    case 'cop': noise(.14, 2600, .45 * v); tone(170, 70, .08, 'square', .1 * v); break;
    case 'ping': tone(880, 1320, .12, 'sine', .2 * v); tone(1320, 1760, .12, 'sine', .15 * v, .08); break;
    case 'cash': tone(1200, 1800, .08, 'square', .1 * v); tone(1800, 2400, .12, 'square', .1 * v, .07); break;
    case 'card': tone(700, 1400, .15, 'triangle', .2 * v); break;
    case 'unlock': noise(.05, 5000, .3 * v); tone(300, 200, .06, 'square', .1 * v, .04); break;
    case 'door': noise(.12, 600, .3 * v); break;
    case 'thud': noise(.2, 300, .7 * v); break;
    case 'bag': noise(.15, 900, .35 * v); break;
    case 'down': tone(300, 80, .6, 'sawtooth', .25 * v); break;
    case 'spot': tone(520, 520, .1, 'square', .18 * v); tone(780, 780, .22, 'square', .18 * v, .1); break;
    case 'abil': tone(400, 900, .25, 'triangle', .22 * v); break;
    case 'mask': noise(.2, 1200, .25 * v); tone(220, 110, .3, 'sine', .2 * v); break;
    case 'shout': noise(.3, 900, .3 * v, 3); break;
    case 'vault': tone(70, 40, 1.6, 'sawtooth', .35 * v); noise(1.2, 400, .4 * v); break;
    case 'jam': tone(200, 90, .4, 'square', .2 * v); break;
    case 'hurt': noise(.1, 700, .5 * v); break;
    case 'siren': for (let i = 0; i < 4; i++) { tone(600, 950, .45, 'sine', .08 * v, i * .9); tone(950, 600, .45, 'sine', .08 * v, i * .9 + .45); } break;
    case 'alarm': for (let i = 0; i < 14; i++) tone(1900, 1900, .09, 'square', .07 * v, i * .16); break;
    case 'smash': noise(.35, 9000, .8 * v, .5); tone(2400, 900, .2, 'square', .08 * v); break;
    case 'step': noise(.05, 420, .5 * v, 1.5); break;
    case 'click': tone(900, 700, .04, 'square', .08 * v); break;
    case 'win': [523, 659, 784, 1047].forEach((f, i) => tone(f, f, .3, 'triangle', .18, i * .13)); break;
    case 'lose': [330, 262, 196].forEach((f, i) => tone(f, f * .97, .5, 'sawtooth', .14, i * .3)); break;
  }
}
// a moody bass pulse that tightens up when the job goes loud
export function music(mode) {
  const a = ctx(); if (!a) return;
  if (loops.mode === mode) return; loops.mode = mode;
  clearInterval(loops.timer); if (!mode) return;
  const seq = mode === 'loud' ? [55, 55, 65.4, 55, 82.4, 55, 73.4, 65.4] : mode === 'menu' ? [55, 0, 0, 65.4, 0, 0, 49, 0] : [55, 0, 55, 0, 51.9, 0, 0, 49];
  const step = mode === 'loud' ? 150 : 300; let i = 0;
  loops.timer = setInterval(() => {
    const f = seq[i++ % seq.length]; if (!f || document.hidden) return;
    tone(f, f, step / 1000 * 1.6, 'sawtooth', mode === 'loud' ? .09 : .06); tone(f * 2, f * 2, .08, 'square', .025);
    if (mode === 'loud' && i % 2 === 0) noise(.04, 7000, .08);
  }, step);
}

// SHEISTERS — the 3D view. Everything is built in code: no model or texture downloads.
import { L } from './level.js';
import { CREW } from './data.js';
import { decorate, decorateJewel } from './decor.js';
const T = window.THREE;

export const R = { scene: null, cam: null, gl: null, chars: new Map(), fx: [], t: 0 };
const tex = {}, mats = {};

function canvasTex(w, h, draw, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4; if (rep) t.repeat.set(rep, rep); return t;
}
function noise(g, w, h, n, a) { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? '0,0,0' : '255,255,255'},${Math.random() * a})`; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2); } }
function makeTextures() {
  const brick = (base, mortar) => canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = mortar; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 8; y++) for (let x = -1; x < 4; x++) { const v = 20 * (Math.random() - .5); g.fillStyle = `rgb(${base[0] + v},${base[1] + v * .6},${base[2] + v * .5})`; g.fillRect(x * 64 + (y % 2) * 32 + 2, y * 32 + 2, 60, 28); }
    noise(g, w, h, 900, .12);
  });
  tex.brick = brick([122, 62, 48], '#3a2a26'); tex.brick2 = brick([88, 78, 72], '#2c2826'); tex.brick3 = brick([70, 52, 58], '#221c20');
  tex.stone = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#b9b2a2'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(60,50,40,.55)'; g.lineWidth = 3; for (let y = 0; y <= 2; y++) { g.beginPath(); g.moveTo(0, y * 128); g.lineTo(w, y * 128); g.stroke(); } for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { g.beginPath(); g.moveTo(x * 128 + y * 64, y * 128); g.lineTo(x * 128 + y * 64, y * 128 + 128); g.stroke(); } noise(g, w, h, 1500, .1); });
  tex.marble = canvasTex(256, 256, (g, w, h) => { for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { g.fillStyle = (x + y) % 2 ? '#d9d2c2' : '#3c4a44'; g.fillRect(x * 128, y * 128, 128, 128); } g.strokeStyle = 'rgba(255,255,255,.13)'; for (let i = 0; i < 26; i++) { g.beginPath(); let x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (Math.random() - .5) * 60; y += (Math.random() - .5) * 60; g.lineTo(x, y); } g.stroke(); } });
  tex.tile = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#8f8a78'; g.fillRect(0, 0, w, h); g.fillStyle = '#7d7868'; g.fillRect(0, 0, 64, 64); g.fillRect(64, 64, 64, 64); noise(g, w, h, 300, .08); });
  tex.concrete = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#6d6e70'; g.fillRect(0, 0, w, h); noise(g, w, h, 4000, .1); g.strokeStyle = 'rgba(0,0,0,.25)'; g.strokeRect(0, 0, w, h); });
  tex.asphalt = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#17181c'; g.fillRect(0, 0, w, h); noise(g, w, h, 5000, .09); });
  tex.sidewalk = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#55565a'; g.fillRect(0, 0, w, h); noise(g, w, h, 3000, .08); g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 3; g.strokeRect(0, 0, w, h); });
  tex.carpet = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#5a2226'; g.fillRect(0, 0, w, h); noise(g, w, h, 2500, .12); });
  tex.wood = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#5b3a22'; g.fillRect(0, 0, w, h); for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? '30,15,5' : '140,95,55'},${.08 + Math.random() * .1})`; g.fillRect(0, Math.random() * h, w, 1 + Math.random() * 3); } });
  tex.plaster = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#b8ad94'; g.fillRect(0, 0, w, h); noise(g, w, h, 900, .06); g.fillStyle = '#5a3b28'; g.fillRect(0, 96, w, 32); g.fillStyle = '#3c2618'; g.fillRect(0, 94, w, 3); }, 1);
  tex.steel = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#8b9299'; g.fillRect(0, 0, w, h); for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * .1})`; g.fillRect(0, Math.random() * h, w, 1); } g.fillStyle = '#5b6168'; for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { g.beginPath(); g.arc(16 + x * 96, 16 + y * 96, 5, 0, 7); g.fill(); } });
  tex.boxes = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#7c8288'; g.fillRect(0, 0, w, h); for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = '#9aa1a8'; g.fillRect(x * 32 + 2, y * 32 + 2, 28, 28); g.fillStyle = '#c9a646'; g.fillRect(x * 32 + 12, y * 32 + 13, 8, 6); } });
  tex.windows = canvasTex(256, 512, (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); for (let y = 0; y < 16; y++) for (let x = 0; x < 8; x++) if (Math.random() < .3) { g.fillStyle = ['#ffd98a', '#ffe9b8', '#9fc8ff', '#ffb46a'][Math.floor(Math.random() * 4)]; g.globalAlpha = .35 + Math.random() * .65; g.fillRect(x * 32 + 8, y * 32 + 8, 16, 18); } });
}
function M(name) {
  if (mats[name]) return mats[name];
  const S = (o) => (o.roughness === undefined || o.roughness >= .8) && !o.emissiveMap ? new T.MeshLambertMaterial({ map: o.map, color: o.color === undefined ? 0xffffff : o.color }) : new T.MeshStandardMaterial(o);
  const d = {
    brick: () => S({ map: tex.brick, roughness: .9 }), brick2: () => S({ map: tex.brick2, roughness: .9, emissiveMap: tex.windows, emissive: 0xffffff, emissiveIntensity: .55 }),
    brick3: () => S({ map: tex.brick3, roughness: .9, emissiveMap: tex.windows, emissive: 0xffffff, emissiveIntensity: .55 }),
    stone: () => S({ map: tex.stone, roughness: .8 }), marble: () => S({ map: tex.marble, roughness: .18, metalness: .1 }), tile: () => S({ map: tex.tile, roughness: .5 }),
    concrete: () => S({ map: tex.concrete, roughness: .95 }), asphalt: () => S({ map: tex.asphalt, roughness: .32, metalness: .25 }), sidewalk: () => S({ map: tex.sidewalk, roughness: .6, metalness: .1 }),
    carpet: () => S({ map: tex.carpet, roughness: 1 }), wood: () => S({ map: tex.wood, roughness: .55 }), plaster: () => S({ map: tex.plaster, roughness: .9 }),
    roof: () => S({ color: 0x1b1c20, roughness: 1 }), counter: () => S({ map: tex.wood, roughness: .35, color: 0xb08a60 }), column: () => S({ map: tex.stone, roughness: .4, color: 0xe6dcc8 }),
    glass: () => S({ color: 0x9fd0e0, roughness: .05, metalness: .3, transparent: true, opacity: .22, depthWrite: false }),
    door: () => S({ map: tex.wood, color: 0x8a6a4a, roughness: .6 }), rail: () => S({ color: 0x8a6a2a, roughness: .3, metalness: .8 }), desk: () => S({ map: tex.wood, roughness: .4 }),
    bench: () => S({ color: 0x5a2a22, roughness: .6 }), cabinet: () => S({ color: 0x4a5560, roughness: .5, metalness: .5 }), console: () => S({ color: 0x23282e, roughness: .5, emissive: 0x153a4a, emissiveIntensity: .8 }),
    chair: () => S({ color: 0x222222 }), vaultwall: () => S({ map: tex.steel, roughness: .35, metalness: .8, color: 0x8a9098 }), vaultdoor: () => S({ map: tex.steel, roughness: .25, metalness: .9 }),
    boxes: () => S({ map: tex.boxes, roughness: .35, metalness: .7 }), shelf: () => S({ color: 0x3d4248, roughness: .6, metalness: .6 }), pallet: () => S({ map: tex.wood, roughness: .8 }),
    van: () => S({ color: 0xd8d6cc, roughness: .4, metalness: .3 }), car1: () => S({ color: 0x7a1d1d, roughness: .3, metalness: .5 }), car2: () => S({ color: 0x22405a, roughness: .3, metalness: .5 }), car3: () => S({ color: 0x55502a, roughness: .3, metalness: .5 }),
    dumpster: () => S({ color: 0x1f4a32, roughness: .7, metalness: .3 }), phone: () => S({ color: 0x23406a, roughness: .5, metalness: .4 }), hydrant: () => S({ color: 0xb02a1a, roughness: .5 }),
  }[name];
  return (mats[name] = d ? d() : S({ color: 0x777777 }));
}
// merge many boxes into one mesh per material, with world-scaled UVs so textures tile
function mergedBoxes(list, mat, uvScale) {
  const pos = [], nor = [], uv = [], idx = []; let base = 0;
  for (const b of list) {
    const w = b.x1 - b.x0, h = b.y1 - b.y0, d = b.z1 - b.z0, g = new T.BoxGeometry(w, h, d);
    const p = g.attributes.position.array, n = g.attributes.normal.array, u = g.attributes.uv.array, ix = g.index.array;
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, cz = (b.z0 + b.z1) / 2, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let i = 0; i < p.length / 3; i++) {
      pos.push(p[i * 3] + cx, p[i * 3 + 1] + cy, p[i * 3 + 2] + cz); nor.push(n[i * 3], n[i * 3 + 1], n[i * 3 + 2]);
      const f = Math.floor(i / 4); uv.push(u[i * 2] * dims[f][0] / uvScale, u[i * 2 + 1] * dims[f][1] / uvScale);
    }
    for (const i of ix) idx.push(i + base); base += p.length / 3; g.dispose();
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  const m = new T.Mesh(g, mat); m.castShadow = m.receiveShadow = true; return m;
}
function label(text, w, h, font, col, glow) {
  const t = canvasTex(w, h, (g) => { g.clearRect(0, 0, w, h); g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = glow; g.shadowBlur = 18; g.fillStyle = col; g.fillText(text, w / 2, h / 2); g.fillText(text, w / 2, h / 2); });
  t.wrapS = t.wrapT = T.ClampToEdgeWrapping; return new T.MeshBasicMaterial({ map: t, transparent: true, fog: false, depthWrite: false });
}

export function initRender(canvas) {
  R.gl = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  R.gl.setPixelRatio(Math.min(devicePixelRatio, 1.5)); R.gl.shadowMap.enabled = true; R.gl.shadowMap.type = T.PCFSoftShadowMap;
  R.gl.outputEncoding = T.sRGBEncoding; R.gl.toneMapping = T.ACESFilmicToneMapping; R.gl.toneMappingExposure = .9;
  R.cam = new T.PerspectiveCamera(62, 16 / 9, .08, 220);
  R.noDraw = /[?&]norender/.test(location.search);
  makeTextures();
  const resize = () => { R.gl.setSize(innerWidth, innerHeight, false); R.cam.aspect = innerWidth / innerHeight; R.cam.updateProjectionMatrix(); };
  addEventListener('resize', resize); resize();
}

export function buildScene() {
  const sc = R.scene = new T.Scene(); R.chars.clear(); R.fx = []; R.doors = {}; R.dyn = {};
  sc.background = new T.Color(0x0a0d1a); sc.fog = new T.FogExp2(0x0a0e1c, .017);
  sc.add(new T.HemisphereLight(0x2c3a66, 0x120e0c, .32));
  const moon = new T.DirectionalLight(0x7f98ee, .3); moon.position.set(-30, 50, 35); moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048); const sh = moon.shadow.camera; sh.left = -45; sh.right = 45; sh.top = 40; sh.bottom = -40; sh.far = 140; moon.shadow.bias = -.0006; sc.add(moon);
  // static geometry
  const groups = {};
  for (const b of L.boxes) { if (b.invis || b.door || b.vault || b.mat === 'none') continue; (groups[b.mat] = groups[b.mat] || []).push(b); }
  for (const m in groups) { const mesh = mergedBoxes(groups[m], M(m), m === 'plaster' ? 3.2 : m === 'brick2' || m === 'brick3' ? 12 : 2.5); if (m === 'glass') { mesh.castShadow = false; mesh.renderOrder = 2; } sc.add(mesh); }
  // stairs
  for (const r of L.ramps) {
    const n = 16, list = [];
    for (let i = 0; i < n; i++) { const xa = r.x0 + (r.x1 - r.x0) * i / n, xb = r.x0 + (r.x1 - r.x0) * (i + 1) / n, y = r.yA + (r.yB - r.yA) * (i + .5) / n; list.push({ x0: xa, x1: xb, y0: Math.min(r.yA, r.yB) - .3, y1: y + .1, z0: r.z0, z1: r.z1 }); }
    sc.add(mergedBoxes(list, M(r.mat), 2));
  }
  // doors + vault door
  for (const k in L.doors) { const b = L.doors[k].box, g = new T.Group(), m = new T.Mesh(new T.BoxGeometry(L.doors[k].ax === 'x' ? b.x1 - b.x0 : .08, 2.2, L.doors[k].ax === 'x' ? .08 : b.z1 - b.z0), M('door'));
    const half = (L.doors[k].ax === 'x' ? b.x1 - b.x0 : b.z1 - b.z0) / 2; m.castShadow = true;
    if (L.doors[k].ax === 'x') { g.position.set(b.x0, b.y0 + 1.1, (b.z0 + b.z1) / 2); m.position.x = half; } else { g.position.set((b.x0 + b.x1) / 2, b.y0 + 1.1, b.z0); m.position.z = half; }
    g.add(m); sc.add(g); R.doors[k] = { g, a: 0 }; }
  R.vault = null;
  if (L.vaultDoor) { const b = L.vaultDoor, g = new T.Group(), m = new T.Mesh(new T.CylinderGeometry(1.25, 1.25, .45, 28), M('vaultdoor')); m.rotation.z = Math.PI / 2; m.position.set(0, 0, .9);
    const wheel = new T.Mesh(new T.TorusGeometry(.42, .05, 8, 20), M('rail')); wheel.rotation.y = Math.PI / 2; wheel.position.set(.3, 0, .9);
    g.position.set(-5, -2.8, -16.4); g.add(m, wheel); sc.add(g); R.vault = { g, a: 0, wheel }; }
  // lights
  for (const l of L.lights) { const p = new T.PointLight(l[3], l[4] * .55, l[5], 1.4); p.position.set(l[0], l[1], l[2]); sc.add(p);
    const bulb = new T.Mesh(new T.SphereGeometry(.12, 8, 6), new T.MeshBasicMaterial({ color: l[3] })); bulb.position.copy(p.position); sc.add(bulb); }
  for (const s of L.streetLamps) { const pole = new T.Mesh(new T.CylinderGeometry(.07, .1, 6, 6), M('shelf')); pole.position.set(s[0], 3, s[1]); sc.add(pole);
    const p = new T.PointLight(0xffa850, 1.15, 20, 1.6); p.position.set(s[0], 5.8, s[1] + (s[1] < 8 ? .8 : -.8)); sc.add(p);
    const b = new T.Mesh(new T.SphereGeometry(.22, 8, 6), new T.MeshBasicMaterial({ color: 0xffc070 })); b.position.copy(p.position); sc.add(b); glow(p.position, 0xffa040, 3.5); }
  // signs
  const sign = new T.Mesh(new T.PlaneGeometry(13, 1.6), label(L.sign, 1024, 128, 'bold 76px Georgia', '#ffe6a8', '#ffb030')); sign.position.set(0, L.signY, .22); if (L.job === 'bodega') sign.scale.set(.88, .7, 1); sc.add(sign);
  const neon = (txt, x, y, z, ry, col, glowc, w) => { const m = new T.Mesh(new T.PlaneGeometry(w, 1.3), label(txt, 512, 128, 'bold 84px Arial', col, glowc)); m.position.set(x, y, z); m.rotation.y = ry; sc.add(m); if (w > 4.2) { const p = new T.PointLight(new T.Color(glowc), 1.3, 13, 1.6); p.position.set(x, y, z + (ry ? -1 : 1)); sc.add(p); } };
  neon('LIQUOR', -12, 4.2, 17.9, Math.PI, '#ffd0e0', '#ff2a6a', 5); neon('DINER', 8, 4.4, 17.9, Math.PI, '#d0f4ff', '#28c8ff', 4.6); neon('PAWN', 27, 4, 17.9, Math.PI, '#e8ffd0', '#58ff58', 4);
  // road paint, van detail, vault gold shimmer
  for (let x = -38; x < 40; x += 6) { const m = new T.Mesh(new T.PlaneGeometry(2.6, .18), new T.MeshBasicMaterial({ color: 0xb8a040 })); m.rotation.x = -Math.PI / 2; m.position.set(x, .012, 9); sc.add(m); }
  const vanTop = new T.Mesh(new T.BoxGeometry(1.4, .9, 2.3), new T.MeshStandardMaterial({ color: 0x18222c, roughness: .1, metalness: .6 })); vanTop.position.set(10, 1.55, 6.2); sc.add(vanTop);
  const vanSign = new T.Mesh(new T.PlaneGeometry(3.4, .7), label("SAL'S PLUMBING", 512, 96, 'bold 54px Arial', '#1a3a7a', '#ffffff')); vanSign.position.set(7.6, 1.5, 7.42); sc.add(vanSign);
  for (const [x, z] of [[6, 5], [6, 7.4], [9.6, 5], [9.6, 7.4], [-12, 5], [-12, 6.9], [-9.6, 5], [-9.6, 6.9], [23, 5], [23, 6.9], [25.4, 5], [25.4, 6.9], [-24, 11.2], [-24, 13.1], [-21.6, 11.2], [-21.6, 13.1]]) { const w = new T.Mesh(new T.CylinderGeometry(.36, .36, .26, 12), M('chair')); w.rotation.x = Math.PI / 2; w.position.set(x, .36, z); sc.add(w); }
  // camera bodies
  R.camMeshes = L.cams.map(c => { const g = new T.Group(), body = new T.Mesh(new T.BoxGeometry(.18, .18, .42), M('cabinet')), led = new T.Mesh(new T.SphereGeometry(.04, 6, 4), new T.MeshBasicMaterial({ color: 0xff2020 }));
    body.position.z = .15; led.position.set(0, .06, .37); g.add(body, led); g.position.set(c.x, c.y, c.z); sc.add(g); return { g, led }; });
  // rain
  { const n = 1400, p = new Float32Array(n * 6); for (let i = 0; i < n; i++) { const x = (Math.random() - .5) * 60, y = Math.random() * 22, z = (Math.random() - .5) * 60; p.set([x, y, z, x + .05, y - .7, z], i * 6); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(p, 3)); R.rain = new T.LineSegments(g, new T.LineBasicMaterial({ color: 0x8aa0d0, transparent: true, opacity: .28 })); R.rain.frustumCulled = false; sc.add(R.rain); }
  // police lights (appear when it goes loud)
  R.cops = new T.Group(); R.cops.visible = false; sc.add(R.cops); R.copLights = [];
  for (const [x, z, ry] of [[-15, 9.5, .5], [15, 10.5, -.6]]) { const car = new T.Group(), body = new T.Mesh(new T.BoxGeometry(4.4, 1.0, 1.9), new T.MeshStandardMaterial({ color: 0x1a2e5a, roughness: .3, metalness: .5 })), top = new T.Mesh(new T.BoxGeometry(2.2, .6, 1.7), new T.MeshStandardMaterial({ color: 0xe8e8e8, roughness: .3 }));
    body.position.y = .75; top.position.y = 1.5; const red = new T.PointLight(0xff2020, 0, 26, 1.4), blue = new T.PointLight(0x2040ff, 0, 26, 1.4); red.position.set(.5, 2.1, 0); blue.position.set(-.5, 2.1, 0);
    car.add(body, top, red, blue); car.position.set(x, 0, z); car.rotation.y = ry; car.userData.x = x; R.cops.add(car); R.copLights.push([red, blue]); }
  R.bagGeo = new T.BoxGeometry(.62, .34, .38); R.bagMat = new T.MeshStandardMaterial({ color: 0x2a2f24, roughness: .9 }); R.bags = new Map();
  R.crate = new T.Mesh(new T.BoxGeometry(1.5, .55, .8), new T.MeshStandardMaterial({ color: 0xd8a830, roughness: .3, metalness: .9, emissive: 0x3a2400, emissiveIntensity: .5 })); R.crate.castShadow = true; sc.add(R.crate);
  R.tracerMat = new T.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: .9 });
  R.drill = new T.Mesh(new T.BoxGeometry(.7, .35, .3), new T.MeshStandardMaterial({ color: 0xc8a020, roughness: .4, metalness: .6, emissive: 0x402000 })); R.drill.position.set(-4.5, -2.8, -15.5); R.drill.visible = false; sc.add(R.drill);
  R.decor = (L.job === 'bank' ? decorate : decorateJewel)(sc, { glow, canvasTex, label });
  R.readers = [];
  for (const it of L.inter) if (it.type === 'reader') { const m = new T.Mesh(new T.BoxGeometry(.08, .3, .2), new T.MeshStandardMaterial({ color: 0x222222, emissive: 0xff2020, emissiveIntensity: 1 })); m.position.set(-4.82, -2.6, it.z); sc.add(m); R.readers.push(m); }
}
function glow(pos, col, size) { const s = new T.Sprite(new T.SpriteMaterial({ map: glowTex(), color: col, transparent: true, opacity: .5, depthWrite: false, blending: T.AdditiveBlending })); s.scale.set(size, size, 1); s.position.copy(pos); R.scene.add(s); return s; }
let _glow; function glowTex() { return _glow || (_glow = canvasTex(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); })); }

// ------------------------------------------------------------------ characters
const CIV = [[0x8a3a3a, 0x30343a], [0x3a5a8a, 0x2a2a30], [0xb89a4a, 0x4a3a2a], [0x5a8a5a, 0x333a44], [0x8a5a8a, 0x2a2a2a], [0xc8c0b0, 0x3a3020]];
const lam = c => new T.MeshLambertMaterial({ color: c });
function makeChar(spec) {
  const g = new T.Group(), body = new T.Group(); g.add(body);
  const box = (w, h, d, c, x, y, z, parent) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), lam(c)); m.position.set(x, y, z); m.castShadow = true; (parent || body).add(m); return m; };
  const limb = (w, h, c, x, y) => { const p = new T.Group(); p.position.set(x, y, 0); const m = new T.Mesh(new T.BoxGeometry(w, h, w), lam(c)); m.position.y = -h / 2; m.castShadow = true; p.add(m); body.add(p); return p; };
  const o = { g, body, spec };
  o.legL = limb(.19, .82, spec.pants, -.13, .84); o.legR = limb(.19, .82, spec.pants, .13, .84);
  for (const lg of [o.legL, o.legR]) { const sh = new T.Mesh(new T.BoxGeometry(.2, .1, .32), lam(0x0e0e10)); sh.position.set(0, -.8, .06); lg.add(sh); }
  o.torso = box(.52, .66, .28, spec.coat, 0, 1.17, 0);
  if (spec.player) { box(.56, .4, .3, spec.coat, 0, .7, -.01); box(.56, .07, .31, 0x15130f, 0, .9, 0); box(.5, .09, .3, spec.hatCol, 0, 1.5, -.02); }
  if (spec.badge) { box(.07, .08, .02, 0xe8c040, -.13, 1.33, .15); box(.54, .07, .3, 0x0e0e10, 0, .86, 0); }
  if (spec.tie) { box(.16, .4, .02, 0xe8e4d8, 0, 1.28, .14); box(.06, .34, .02, spec.tie, 0, 1.27, .155); }
  o.armL = limb(.15, .66, spec.coat, -.35, 1.46); o.armR = limb(.15, .66, spec.coat, .35, 1.46);
  for (const ar of [o.armL, o.armR]) { const hd = new T.Mesh(new T.BoxGeometry(.13, .13, .13), lam(spec.skin || 0xd9a880)); hd.position.y = -.7; ar.add(hd); }
  o.head = box(.27, .29, .27, spec.skin || 0xd9a880, 0, 1.68, 0);
  if (spec.hat === 'cap') { box(.3, .1, .3, spec.hatCol, 0, 1.86, 0); box(.24, .03, .16, spec.hatCol, 0, 1.82, .2); }
  else if (spec.hat === 'helmet') box(.33, .22, .33, spec.hatCol, 0, 1.8, 0);
  else if (spec.hat === 'fedora') { box(.46, .03, .46, spec.hatCol, 0, 1.83, 0); box(.28, .13, .28, spec.hatCol, 0, 1.9, 0); }
  else if (spec.hat === 'hair') box(.29, .12, .29, spec.hatCol, 0, 1.82, -.01);
  if (spec.vest) box(.56, .5, .32, spec.vest, 0, 1.2, 0);
  if (spec.player) {
    o.mask = box(.285, .3, .06, 0xe8e4d8, 0, 1.68, .13); const e1 = box(.06, .04, .02, 0x111111, -.065, 1.72, .165), e2 = box(.06, .04, .02, 0x111111, .065, 1.72, .165); o.eyes = [e1, e2];
    o.pack = box(.6, .36, .34, 0x2a2f24, 0, 1.25, -.3); o.pack2 = box(.6, .3, .34, 0x333828, 0, 1.6, -.32);
  }
  o.gun = new T.Mesh(new T.BoxGeometry(.06, .12, spec.long ? .7 : .3), lam(0x15171a)); o.gun.position.set(0, -.66, .12); o.armR.add(o.gun);
  o.flash = new T.Mesh(new T.SphereGeometry(.13, 6, 4), new T.MeshBasicMaterial({ color: 0xffe080 })); o.flash.position.set(0, -.7, spec.long ? .55 : .35); o.flash.visible = false; o.armR.add(o.flash);
  o.mark = new T.Mesh(new T.OctahedronGeometry(.16), new T.MeshBasicMaterial({ color: 0xff3030, depthTest: false, transparent: true, opacity: .95, fog: false })); o.mark.position.y = 2.35; o.mark.renderOrder = 9; o.mark.visible = false; g.add(o.mark);
  o.ghost = new T.Mesh(new T.CylinderGeometry(.3, .3, 1.7, 8), new T.MeshBasicMaterial({ color: 0xff3030, depthTest: false, transparent: true, opacity: .2, fog: false })); o.ghost.position.y = .9; o.ghost.renderOrder = 8; o.ghost.visible = false; g.add(o.ghost);
  o.ph = Math.random() * 6; o.x = o.y = o.z = null; o.yaw = 0;
  R.scene.add(g); return o;
}
function specFor(e, isPlayer) {
  if (isPlayer) { const c = CREW[e.ch % 4]; return { player: true, coat: c.coat, pants: 0x1c1c22, hat: 'fedora', hatCol: c.hat, long: e.cls === 'muscle' }; }
  if (e.k === 'guard') return { coat: 0x7fa0c8, pants: 0x1c2438, hat: 'cap', hatCol: 0x1c2438, badge: 1, skin: [0xd9a880, 0x9a6a4a, 0xe8c0a0][e.v % 3] };
  if (e.k === 'cop') return { coat: 0x1c2a52, pants: 0x141c38, hat: 'cap', hatCol: 0x141c38, badge: 1, skin: [0xd9a880, 0x9a6a4a, 0xe8c0a0][e.v % 3] };
  if (e.k === 'swat') return { coat: 0x15171c, pants: 0x101216, hat: 'helmet', hatCol: 0x0c0d10, vest: 0x2a2e36, long: true };
  if (e.job === 1) return { coat: 0xe8e4d8, pants: 0x2a2a30, hat: 'hair', hatCol: 0x4a2a18, vest: 0x5a2a2a };
  if (e.job === 2) return { coat: 0x555a66, pants: 0x444852, hat: 'hair', hatCol: 0x888888, tie: 0x8a1a1a };
  const c = CIV[e.v % CIV.length]; return { coat: c[0], pants: c[1], hat: 'hair', hatCol: [0x2a1a10, 0x8a6a30, 0x111111, 0x6a3a1a][e.v % 4], skin: [0xd9a880, 0x8a5a3a, 0xe8c0a0, 0xb88860][e.v % 4] };
}
const spec_player = o => o.spec.player;
function pose(o, e, dt, kind, snap) {
  // kind: state string for npcs; for players derived
  const lying = kind === 'ko' || kind === 'dead' || kind === 'down', cower = kind === 'cower', sit = kind === 'sit', crouch = kind === 'crouch';
  const armed = kind === 'armed' || kind === 'fight' || kind === 'alert' || (kind === 'crouch' && e.mk);
  if (o.x === null) { o.x = e.x; o.y = e.y; o.z = e.z; o.yaw = e.yaw; }
  const k = snap ? 1 : Math.min(1, dt * 14); o.x += (e.x - o.x) * k; o.y += (e.y - o.y) * k; o.z += (e.z - o.z) * k;
  let dy = e.yaw - o.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI; o.yaw += dy * k;
  o.g.position.set(o.x, o.y, o.z); o.g.rotation.y = o.yaw;
  const sp = lying ? 0 : (e.mv || 0); o.ph += dt * (3 + sp * 2.1);
  const sw = sp > .2 ? Math.sin(o.ph) * Math.min(.9, .25 + sp * .12) : 0;
  const B = o.body; let by = 0, rx = 0, legBend = 0;
  if (lying) { rx = -Math.PI / 2; by = .22; } else if (cower) { by = -.55; legBend = 1.3; } else if (sit) { by = -.38; legBend = 1.45; } else if (crouch) { by = -.38; legBend = .9; }
  if (!lying && sp > .2) by += Math.abs(Math.sin(o.ph)) * .045 * Math.min(1, sp / 4);
  if (spec_player(o)) o.head.rotation.x = lying ? 0 : -(e.pitch || 0) * .5;
  B.rotation.x += (rx - B.rotation.x) * k; B.position.y += (by - B.position.y) * k; B.rotation.z = lying || sp < .2 ? 0 : Math.sin(o.ph) * .03; B.position.z = lying ? -.9 : 0;
  o.legL.rotation.x = -legBend + sw; o.legR.rotation.x = -legBend - sw;
  o.torso.rotation.x = cower ? .5 : 0;
  if (cower) { o.armL.rotation.x = o.armR.rotation.x = -2.6; }
  else if (armed && !lying) { o.armR.rotation.x = -Math.PI / 2 - (e.pitch || 0); o.armL.rotation.x = -1.2; o.armL.rotation.z = -.5; }
  else { o.armR.rotation.x = -sw; o.armL.rotation.x = sw; o.armL.rotation.z = 0; }
  o.gun.visible = armed && !lying;
  if (o.flash.visible && (o.flashT -= dt) <= 0) o.flash.visible = false;
}

// ------------------------------------------------------------------ per-frame
export function addTracer(a, b, col) {
  const g = new T.BufferGeometry().setFromPoints([new T.Vector3(a[0], a[1], a[2]), new T.Vector3(b[0], b[1], b[2])]);
  const l = new T.Line(g, R.tracerMat.clone()); if (col) l.material.color.set(col); R.scene.add(l); R.fx.push({ o: l, t: .09 });
  const s = glow(new T.Vector3(b[0], b[1], b[2]), 0xffc060, .7); R.fx.push({ o: s, t: .12 });
}
export function muzzle(id) { const o = R.chars.get(id); if (o) { o.flash.visible = true; o.flashT = .05; } }

export function renderFrame(S, me, dt, camState) {
  R.t += dt; const sc = R.scene, seen = new Set();
  // players
  for (const p of S.pl) {
    const key = 'p' + p.id; let o = R.chars.get(key); if (!o) { o = makeChar(specFor(p, true)); R.chars.set(key, o); }
    seen.add(key); o.g.visible = p.dn !== 2;
    const e = p.id === me.id && me.local ? Object.assign({}, p, me.local) : p;
    pose(o, e, dt, p.dn ? 'down' : e.cr ? 'crouch' : p.mk ? 'armed' : 'idle', p.id === me.id);
    o.mask.visible = o.eyes[0].visible = o.eyes[1].visible = !!p.mk; o.pack.visible = p.bags > 0; o.pack2.visible = p.bags > 1;
  }
  // npcs
  for (const n of S.npc) {
    const key = 'n' + n.id; if (n.st === 'gone') { const o = R.chars.get(key); if (o) o.g.visible = false; seen.add(key); continue; }
    let o = R.chars.get(key); if (!o) { o = makeChar(specFor(n, false)); R.chars.set(key, o); }
    seen.add(key);
    pose(o, n, dt, n.st === 'idle' && n.sit ? 'sit' : n.st);
    const marked = S.marks[n.id] > S.t && n.st !== 'dead' && n.st !== 'ko';
    o.mark.visible = o.ghost.visible = marked; if (marked) o.mark.rotation.y = R.t * 3;
    o.g.visible = !n.hid;
  }
  for (const [k, o] of R.chars) if (!seen.has(k)) { sc.remove(o.g); R.chars.delete(k); }
  // doors
  for (const k in R.doors) { const d = R.doors[k], st = S.doors[k], open = st && (st.o || st.n) ? 1 : 0; d.a += (open * 1.7 - d.a) * Math.min(1, dt * 8); d.g.rotation.y = L.doors[k].ax === 'x' ? -d.a : d.a; }
  if (R.vault) { R.vault.a += ((S.vault.open ? 2.1 : 0) - R.vault.a) * Math.min(1, dt * 1.5); R.vault.g.rotation.y = R.vault.a; R.vault.wheel.rotation.x = R.vault.a * 4; }
  if (R.decor && R.decor.cases) R.decor.cases.forEach((g, i) => { g.visible = !S.used['case' + i]; });
  R.drill.visible = S.vault.drill > 0; if (S.vault.drill === 1) R.drill.position.x = -4.5 + Math.sin(R.t * 70) * .01;
  if (R.readers) R.readers.forEach((m, i) => m.material.emissive.setHex(S.vault.open || S.t - S.vault.r[i] < .25 ? 0x20ff40 : 0xff2020));
  // cameras
  R.camMeshes.forEach((c, i) => { const s = S.cams[i]; c.g.rotation.set(0, s.a, 0); c.g.rotateX(-L.cams[i].pitch); c.led.material.color.setHex(S.camsOff || S.jamT > S.t ? 0x222222 : s.d > .05 ? 0xffc020 : 0xff2020); });
  // bags
  for (const b of S.bags) { let m = R.bags.get(b.id); if (!m) { m = new T.Mesh(R.bagGeo, R.bagMat); m.castShadow = true; sc.add(m); R.bags.set(b.id, m); } m.visible = b.st === 0; if (b.st === 0) m.position.set(b.x, b.y + .17, b.z); }
  R.crate.visible = S.crate.st === 0; R.crate.position.set(S.crate.x, S.crate.y + (S.crate.h.length === 2 ? .85 : .28), S.crate.z);
  if (S.crate.h.length === 2) { const a = S.pl.find(p => p.id === S.crate.h[0]), b = S.pl.find(p => p.id === S.crate.h[1]); if (a && b) R.crate.rotation.y = Math.atan2(a.z - b.z, b.x - a.x); }
  // police lights, rain, fx
  R.cops.visible = S.loud && S.wave > 0; R.copT = R.cops.visible ? (R.copT || 0) + dt : 0;
  if (R.cops.visible) { const u = Math.min(1, R.copT / 2.2), e = 1 - (1 - u) * (1 - u) * (1 - u); R.cops.children.forEach(c => { c.position.x = c.userData.x + Math.sign(c.userData.x) * (1 - e) * 42; }); }
  if (R.cops.visible) R.copLights.forEach((l, i) => { const f = Math.sin(R.t * 9 + i * 2) > 0; l[0].intensity = f ? 3.5 : 0; l[1].intensity = f ? 0 : 3.5; });
  R.rain.position.set(camState.x, 0, camState.z); const rp = R.rain.geometry.attributes.position.array;
  for (let i = 1; i < rp.length; i += 6) { rp[i] -= dt * 26; rp[i + 3] -= dt * 26; if (rp[i] < 0) { rp[i] += 22; rp[i + 3] += 22; } } R.rain.geometry.attributes.position.needsUpdate = true;
  R.rain.visible = !(camState.x > -14 && camState.x < 14 && camState.z < 0 && camState.z > -20);
  if (R.decor) R.decor.steam.forEach((sp, i) => { const u = (R.t * .35 + i / 5) % 1; sp.position.y = .3 + u * 4; sp.position.x = -3 + Math.sin(R.t + i) * .3 * u; sp.material.opacity = .2 * (1 - u); const sz = 1 + u * 3; sp.scale.set(sz, sz, 1); });
  for (let i = R.fx.length - 1; i >= 0; i--) { const f = R.fx[i]; if ((f.t -= dt) <= 0) { sc.remove(f.o); if (f.o.geometry) f.o.geometry.dispose(); R.fx.splice(i, 1); } }
  // camera
  R.cam.position.set(camState.x, camState.y, camState.z); R.cam.lookAt(camState.tx, camState.ty, camState.tz);
  R.cam.fov += ((camState.aim ? 46 : 62) - R.cam.fov) * Math.min(1, dt * 10); R.cam.updateProjectionMatrix(); R.cam.updateMatrixWorld();
  if (!R.noDraw) R.gl.render(sc, R.cam);
  autoQuality(dt);
}
// step the graphics down on machines that cannot hold a decent frame rate
let qT = 0, qN = 0, qLevel = 0;
function autoQuality(dt) {
  if (R.noDraw) return; qT += dt; qN++;
  if (qT < 2.5) return; const fps = qN / qT; qT = 0; qN = 0;
  if (fps > 27 || qLevel >= 3) return; qLevel++;
  if (qLevel === 1) R.gl.setPixelRatio(1); else if (qLevel === 2) { R.gl.shadowMap.enabled = false; R.scene.traverse(o => { if (o.material) o.material.needsUpdate = true; }); } else R.gl.setPixelRatio(.7);
  R.gl.setSize(innerWidth, innerHeight, false);
}
const _v = new T.Vector3();
export function project(x, y, z) { _v.set(x, y, z).project(R.cam); return { x: (_v.x + 1) / 2 * innerWidth, y: (1 - _v.y) / 2 * innerHeight, ok: _v.z < 1 && _v.z > -1 }; }
export function menuFrame(dt) {                                       // slow fly-by behind the menus
  R.t += dt; const a = R.t * .06;
  R.cam.position.set(Math.sin(a) * 26, 7 + Math.sin(a * 2) * 2, 20 + Math.cos(a) * 6); R.cam.lookAt(0, 3.5, -4); R.cam.fov = 55; R.cam.updateProjectionMatrix();
  const rp = R.rain.geometry.attributes.position.array; R.rain.position.set(R.cam.position.x, 0, R.cam.position.z); R.rain.visible = true;
  for (let i = 1; i < rp.length; i += 6) { rp[i] -= dt * 26; rp[i + 3] -= dt * 26; if (rp[i] < 0) { rp[i] += 22; rp[i + 3] += 22; } } R.rain.geometry.attributes.position.needsUpdate = true;
  if (!R.noDraw) R.gl.render(R.scene, R.cam);
}

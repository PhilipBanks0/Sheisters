// SHEISTERS — set dressing: things you look at but never bump into.
import { L } from './level.js';
const T = window.THREE;

export function decorate(sc, h) {
  const std = (c, o) => new T.MeshStandardMaterial(Object.assign({ color: c, roughness: .5 }, o || {}));
  const add = (geo, mat, x, y, z, o) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); if (o && o.ry) m.rotation.y = o.ry; if (o && o.rx) m.rotation.x = o.rx; if (o && o.rz) m.rotation.z = o.rz; m.castShadow = !(o && o.flat); m.receiveShadow = true; sc.add(m); return m; };
  const brass = std(0xc9a03a, { roughness: .25, metalness: .9 }), dark = std(0x15171b, { roughness: .6 });

  // ---- the vault: gold on the west shelf, banded cash on the north shelf
  const gold = std(0xffc83a, { roughness: .22, metalness: 1, emissive: 0x4a2c00, emissiveIntensity: .6 });
  const bars = new T.InstancedMesh(new T.BoxGeometry(.16, .09, .34), gold, 120), m4 = new T.Matrix4(); let n = 0;
  for (let row = 0; row < 3; row++) for (let i = 0; i < 16 - row * 2; i++) for (let k = 0; k < 2; k++) { m4.setPosition(-13.62 + k * .2 + row * .05, -2.15 + row * .095, -18.9 + i * .36 + row * .36); bars.setMatrixAt(n++, m4); }
  bars.count = n; bars.castShadow = true; sc.add(bars);
  const cash = new T.InstancedMesh(new T.BoxGeometry(.3, .12, .16), std(0x5f8f5a, { roughness: .9 }), 90); n = 0;
  for (let row = 0; row < 3; row++) for (let i = 0; i < 18; i++) if ((i * 7 + row * 3) % 5) { m4.setPosition(-12.2 + i * .34, -2.13 + row * .125, -19.5); cash.setMatrixAt(n++, m4); }
  cash.count = n; sc.add(cash);
  h.glow(new T.Vector3(-13.4, -1.9, -16.5), 0xffb030, 3.2);
  add(new T.BoxGeometry(.5, .5, .5), std(0x30343a, { metalness: .7, roughness: .4 }), -7.2, -3.75, -14.2);     // strongbox
  add(new T.BoxGeometry(.5, .5, .5), std(0x30343a, { metalness: .7, roughness: .4 }), -7.25, -3.25, -14.25, { ry: .3 });

  // ---- lobby: chandeliers, clock, signs, plants, velvet runner
  for (const x of [-8, 0, 8]) {
    add(new T.CylinderGeometry(.02, .02, .8, 5), brass, x, 6.6, -5);
    add(new T.TorusGeometry(.7, .04, 6, 24), brass, x, 6.15, -5, { rx: Math.PI / 2 });
    add(new T.TorusGeometry(.38, .03, 6, 18), brass, x, 6.35, -5, { rx: Math.PI / 2 });
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(new T.SphereGeometry(.07, 6, 5), new T.MeshBasicMaterial({ color: 0xfff0c8 }), x + Math.cos(a) * .7, 6.22, -5 + Math.sin(a) * .7, { flat: true }); }
    h.glow(new T.Vector3(x, 6.1, -5), 0xffc878, 4.5);
  }
  const face = h.canvasTex(256, 256, (g) => { g.fillStyle = '#efe6cf'; g.beginPath(); g.arc(128, 128, 120, 0, 7); g.fill(); g.strokeStyle = '#8a6a2a'; g.lineWidth = 10; g.stroke(); g.fillStyle = '#222'; g.font = 'bold 26px Georgia'; g.textAlign = 'center'; g.textBaseline = 'middle';
    ['XII', 'III', 'VI', 'IX'].forEach((t, i) => g.fillText(t, 128 + Math.sin(i * Math.PI / 2) * 92, 128 - Math.cos(i * Math.PI / 2) * 92)); g.lineWidth = 7; g.strokeStyle = '#222'; g.beginPath(); g.moveTo(128, 128); g.lineTo(168, 96); g.moveTo(128, 128); g.lineTo(128, 48); g.stroke(); });
  add(new T.CircleGeometry(.75, 28), new T.MeshBasicMaterial({ map: face, transparent: true }), 0, 5.3, -12.82, { flat: true });
  const plate = (txt, x, y, z, w, ry) => add(new T.PlaneGeometry(w, .42), h.label(txt, 512, 64, 'bold 40px Georgia', '#e8c870', '#000000'), x, y, z, { flat: true, ry });
  plate('TELLERS', -3, 3.0, -9.75, 3.4); plate('STAFF ONLY', 5, 2.5, -12.82, 2.2); plate('NEW ACCOUNTS', 11.6, 3.0, -9.75, 3.4);
  plate('SECURITY', -6.82, 2.5, -15.6, 1.8, Math.PI / 2); plate('VAULT', -4.82, -1.2, -15.5, 1.6, Math.PI / 2); plate('SAFE DEPOSIT', 8.82, -1.5, -15.6, 2.2, -Math.PI / 2);
  for (const [x, z] of [[-13.2, -.9], [13.2, -9.1], [-13.2, -9.1], [13.2, -.9]]) {
    add(new T.CylinderGeometry(.28, .2, .5, 10), std(0x7a4a2a, { roughness: .8 }), x, .25, z);
    for (let i = 0; i < 5; i++) add(new T.ConeGeometry(.16, 1.1 + (i % 3) * .25, 5), std(0x2f6a3a, { roughness: .9 }), x + Math.cos(i * 1.3) * .14, 1 + (i % 3) * .12, z + Math.sin(i * 1.3) * .14, { rz: Math.cos(i * 1.3) * .25, rx: Math.sin(i * 1.3) * .25 });
  }
  add(new T.PlaneGeometry(2.6, 9.4), std(0x6a1820, { roughness: 1 }), 0, .012, -4.9, { rx: -Math.PI / 2, flat: true });
  for (const x of [-12, -8, -6, 2, 12.2]) add(new T.BoxGeometry(.5, .3, .4), std(0x2a2c30, { metalness: .5 }), x, 1.25, -10.75);          // cash registers

  // ---- security room: a wall of monitors
  const screen = (i) => h.canvasTex(128, 96, (g) => { g.fillStyle = '#0a1418'; g.fillRect(0, 0, 128, 96); g.fillStyle = `rgba(90,${150 + i * 12},170,.55)`; g.fillRect(8 + i * 5, 50 - i * 4, 60, 40); g.fillRect(70, 20 + i * 6, 40, 22); g.fillStyle = 'rgba(160,220,230,.5)'; g.fillRect(90 - i * 9, 60, 10, 26);
    for (let y = 0; y < 96; y += 3) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, y, 128, 1); } g.fillStyle = '#9fe8a0'; g.font = '10px monospace'; g.fillText('CAM ' + (i + 1), 6, 12); });
  for (let i = 0; i < 6; i++) add(new T.PlaneGeometry(.95, .7), new T.MeshBasicMaterial({ map: screen(i) }), -13.82, 1.75 + Math.floor(i / 3) * .8, -17.9 + (i % 3) * 1.05, { ry: Math.PI / 2, flat: true });
  h.glow(new T.Vector3(-13.3, 2.1, -16.8), 0x40c0ff, 3);

  // ---- manager's office
  add(new T.CylinderGeometry(.05, .12, .3, 8), brass, -8, 4.45, -16.4); add(new T.BoxGeometry(.4, .1, .16), std(0x1f7a3a, { emissive: 0x1f7a3a, emissiveIntensity: .7 }), -8, 4.65, -16.4);
  h.glow(new T.Vector3(-8, 4.6, -16.4), 0x60ff90, 1.4);
  add(new T.PlaneGeometry(5, 3.4), std(0x2a3a5a, { roughness: 1 }), -9, 3.512, -16.4, { rx: -Math.PI / 2, flat: true });
  add(new T.BoxGeometry(.6, .9, .6), std(0x2a2018, { roughness: .6 }), -9, 3.95, -18.2);                                                 // his chair
  add(new T.BoxGeometry(3.2, 1.6, .06), std(0x3a2a1a, { roughness: .7 }), -5.5, 5.3, -19.8); add(new T.BoxGeometry(2.9, 1.3, .07), std(0x54683a, { roughness: .9 }), -5.5, 5.3, -19.78);

  // ---- the street
  const stripe = h.canvasTex(128, 32, (g) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#e8e0c8' : '#1f4a32'; g.fillRect(i * 16, 0, 16, 32); } });
  add(new T.BoxGeometry(5, .12, 1.9), new T.MeshLambertMaterial({ map: stripe }), 0, 3.05, 1.0, { rx: .16 });
  for (const x of [-2.3, 2.3]) add(new T.CylinderGeometry(.04, .04, 3, 6), brass, x, 1.5, 1.85);
  const puddle = std(0x05070c, { roughness: .03, metalness: .9, transparent: true, opacity: .75 });
  for (const [x, z, s] of [[-6, 8, 2.2], [3, 11, 1.6], [12, 6.5, 1.3], [-15, 10.5, 2.6], [20, 9, 2], [-27, 7, 1.8], [-1, 5.2, 1.1], [16.5, -8, 1.4]]) { const p = add(new T.CircleGeometry(1, 18), puddle, x, .008, z, { rx: -Math.PI / 2, flat: true }); p.scale.set(s, s * .6, 1); p.rotation.z = x; }
  add(new T.CylinderGeometry(.5, .5, .03, 16), dark, -3, .015, 9.5, { flat: true });
  const steam = [];
  for (let i = 0; i < 5; i++) { const s = h.glow(new T.Vector3(-3, .6 + i * .7, 9.5), 0x8a94a8, 1.4 + i * .5); s.material.opacity = .16; s.material.blending = T.NormalBlending; steam.push(s); }
  for (const [x, z] of [[15.6, -18], [16.2, -17.2], [17.6, -21], [-18, 1.2]]) add(new T.SphereGeometry(.42, 7, 5), std(0x0c0d10, { roughness: .35 }), x, .3, z);
  add(new T.BoxGeometry(.5, 1.0, .45), std(0x2a4a8a, { roughness: .5, metalness: .3 }), -15, .5, 1.2); add(new T.BoxGeometry(.5, 1.0, .45), std(0x8a2a2a, { roughness: .5, metalness: .3 }), -15.7, .5, 1.2);   // newspaper boxes
  add(new T.CylinderGeometry(.08, .08, 5.2, 6), dark, 34, 2.6, 3.4); add(new T.BoxGeometry(.4, 1.1, .4), dark, 34, 4.9, 3.4);
  add(new T.SphereGeometry(.13, 8, 6), new T.MeshBasicMaterial({ color: 0xff2a1a }), 34, 5.25, 3.62, { flat: true }); h.glow(new T.Vector3(34, 5.25, 3.7), 0xff2a1a, 1.6);
  for (let i = 0; i < 3; i++) for (const x of [15.6, 17.9]) add(new T.BoxGeometry(.9, .06, 3.4), dark, x > 16 ? 18.5 : 14.6, 4 + i * 3, -8 - (x > 16 ? 6 : 0));   // fire escapes
  const moon = h.glow(new T.Vector3(-70, 85, -120), 0xdde8ff, 34); moon.material.opacity = .9; moon.material.fog = false;
  for (const l of L.lights) h.glow(new T.Vector3(l[0], l[1], l[2]), l[3], 1.5).material.opacity = .3;
  return { steam };
}

export function decorateJewel(sc, h) {
  const std = (c, o) => new T.MeshStandardMaterial(Object.assign({ color: c, roughness: .5 }, o || {}));
  const add = (geo, mat, x, y, z, o) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); if (o && o.rx) m.rotation.x = o.rx; if (o && o.ry) m.rotation.y = o.ry; sc.add(m); return m; };
  const gems = [0x8af0ff, 0xff5a7a, 0x7aff9a, 0xffe07a, 0xd0a0ff], cases = [];
  // every display case gets a tray of stones that vanishes when the case is emptied
  (L.cases || []).forEach(([x, z], i) => {
    const g = new T.Group(); sc.add(g); cases.push(g);
    const tray = new T.Mesh(new T.BoxGeometry(1.4, .04, .6), std(0x1a1030, { roughness: 1 })); tray.position.set(x, .93, z); g.add(tray);
    for (let k = 0; k < 9; k++) { const c = gems[(i + k) % gems.length], m = new T.Mesh(new T.OctahedronGeometry(.05 + (k % 3) * .012), std(c, { roughness: .05, metalness: .4, emissive: c, emissiveIntensity: .55 })); m.position.set(x - .56 + k * .14, 1.0, z + ((k % 2) - .5) * .22); g.add(m); }
    const s = h.glow(new T.Vector3(x, 1.15, z), 0xcfe8ff, 1.5); s.material.opacity = .28; sc.remove(s); g.add(s);
  });
  const plate = (txt, x, y, z, w, ry) => add(new T.PlaneGeometry(w, .42), h.label(txt, 512, 64, 'bold 40px Georgia', '#e8c870', '#000000'), x, y, z, { ry });
  if (L.job === 'jewel') {
    plate('DIAMONDS · GOLD · WATCHES', 0, 3.3, -7.82, 6); plate('PRIVATE', 2.6, 2.5, -7.82, 1.4); plate('OFFICE', -5.82, 2.5, -11, 1.4, Math.PI / 2);
    add(new T.PlaneGeometry(3, 7.4), std(0x1a2a4a, { roughness: 1 }), 0, .012, -3.9, { rx: -Math.PI / 2 });
    add(new T.TorusGeometry(.32, .05, 8, 20), std(0xc9a03a, { roughness: .25, metalness: .9 }), -12.55, .8, -11, { ry: Math.PI / 2 });
    add(new T.BoxGeometry(.5, .3, .4), std(0x2a2c30, { metalness: .5 }), 0, 1.2, -6.8);
  } else if (L.job === 'pawn') {
    plate('WE BUY GOLD', -3.7, 3, -7.82, 3); plate('NO REFUNDS', 4, 2.6, -7.82, 1.9); add(new T.BoxGeometry(.5, .3, .4), std(0x2a2c30, { metalness: .5 }), -2.2, 1.2, -5.8);
    const junk = [0x8a3a2a, 0x2a4a8a, 0xb8a040, 0x3a3a3a, 0x7a2a6a];
    for (let k = 0; k < 18; k++) add(new T.BoxGeometry(.34, .3 + (k % 3) * .14, .3), std(junk[k % 5], { roughness: .6, metalness: k % 2 ? .6 : 0 }), -7.5, .45 + (k % 3) * .62, -7.2 + Math.floor(k / 3) * 1.05);
  } else if (L.job === 'bodega') {
    plate('EMPLOYEES ONLY', -4, 2.5, -6.82, 1.9); add(new T.BoxGeometry(.5, .3, .4), std(0x2a2c30, { metalness: .5 }), 4.9, 1.2, -3.1);
    const cols = [0xd04030, 0xe8c040, 0x4080d0, 0x50a060, 0xe08030];
    for (const sx of [-3.3, -.9]) for (let k = 0; k < 30; k++) add(new T.BoxGeometry(.2, .26, .2), std(cols[k % 5], { roughness: .7 }), sx + ((k % 2) ? .33 : -.33), .5 + Math.floor(k / 10) * .5, -5.3 + (k % 10) * .4);
    h.glow(new T.Vector3(-5.25, 1.4, -.85), 0x40ff80, 1.2);
  }
  const stripe = h.canvasTex(128, 32, (g) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#e8e0c8' : '#3a1f5a'; g.fillRect(i * 16, 0, 16, 32); } });
  if (L.job !== 'truck') add(new T.BoxGeometry(5, .12, 1.9), new T.MeshLambertMaterial({ map: stripe }), 0, 2.95, 1.0, { rx: .16 });
  else { const tm = h.label('TRI-BORO ARMORED', 512, 64, 'bold 44px Arial', '#e8e8e8', '#000000'); add(new T.PlaneGeometry(5.6, .7), tm, -18.75, 1.7, 9.58, { ry: Math.PI }); for (const [x, z] of [[-16.5, 9.6], [-16.5, 11.9], [-21, 9.6], [-21, 11.9], [-23.6, 9.8], [-23.6, 11.7]]) { const w = add(new T.CylinderGeometry(.45, .45, .3, 12), std(0x0c0c0e, { roughness: .8 }), x, .45, z, { rx: Math.PI / 2 }); } }
  const puddle = std(0x05070c, { roughness: .03, metalness: .9, transparent: true, opacity: .75 });
  for (const [x, z, s] of [[-6, 8, 2.2], [3, 11, 1.6], [12, 6.5, 1.3], [-15, 10.5, 2.6], [20, 9, 2]]) { const p = add(new T.CircleGeometry(1, 18), puddle, x, .008, z, { rx: -Math.PI / 2 }); p.scale.set(s, s * .6, 1); }
  const moon = h.glow(new T.Vector3(-70, 85, -120), 0xdde8ff, 34); moon.material.opacity = .9; moon.material.fog = false;
  for (const l of L.lights) h.glow(new T.Vector3(l[0], l[1], l[2]), l[3], 1.5).material.opacity = .3;
  return { steam: [], cases };
}

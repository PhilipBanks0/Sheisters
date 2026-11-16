// SHEISTERS — the getaway chase view: an endless avenue recycled around the van.
import { R, M, glow, label } from './render.js';
import { CHASE } from './sim.js';
import { fitted } from './models.js';
const T = window.THREE;
const C = { cars: new Map() };
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const SEG = 16, NB = 34;
const CIV = [0x7a1d1d, 0x22405a, 0x55502a, 0x3a3a3e, 0xb8b0a0];

function carMesh(kind, col) {
  const g = new T.Group(), std = (c, o) => new T.MeshStandardMaterial(Object.assign({ color: c, roughness: .35, metalness: .45 }, o || {}));
  const body = new T.Mesh(new T.BoxGeometry(2, kind === 'van' ? 1.7 : .8, kind === 'van' ? 5.4 : 4.5), std(kind === 'civ' ? CIV[col % 5] : col)); body.position.y = kind === 'van' ? 1.25 : .75; body.castShadow = true; g.add(body);
  if (kind !== 'van') { const top = new T.Mesh(new T.BoxGeometry(1.8, .6, 2.2), std(kind === 'cop' ? 0xe8e8e8 : 0x10141a, { roughness: .15 })); top.position.set(0, 1.42, -.2); g.add(top); }
  else { const win = new T.Mesh(new T.BoxGeometry(1.9, .6, .1), std(0x10141a, { roughness: .1 })); win.position.set(0, 1.6, 2.72); g.add(win); }
  for (const [x, z] of [[-1, 1.5], [1, 1.5], [-1, -1.5], [1, -1.5]]) { const w = new T.Mesh(new T.CylinderGeometry(.38, .38, .28, 10), new T.MeshLambertMaterial({ color: 0x0c0c0e })); w.rotation.z = Math.PI / 2; w.position.set(x, .38, z * (kind === 'van' ? 1.2 : 1)); g.add(w); }
  const lamp = (c, x, z) => { const m = new T.Mesh(new T.BoxGeometry(.4, .16, .08), new T.MeshBasicMaterial({ color: c })); m.position.set(x, .8, z); g.add(m); };
  const hz = kind === 'van' ? 2.72 : 2.27; lamp(0xfff2c0, -.7, hz); lamp(0xfff2c0, .7, hz); lamp(0xff2020, -.7, -hz); lamp(0xff2020, .7, -hz);
  const boxy = g.children.slice(), name = kind === 'cop' ? 'car_police' : kind === 'civ' ? ['car_sedan', 'car_taxi', 'car_hatchback', 'car_stationwagon', 'car_taxi'][col % 5] : null;
  if (name) fitted(name, 2.1, 1.7, 4.6, 0).then(m => { if (!m) return; boxy.forEach(o => { o.visible = false; }); g.add(m); });
  if (kind === 'cop') { g.userData.bar = [new T.Mesh(new T.BoxGeometry(.7, .18, .3), new T.MeshBasicMaterial({ color: 0xff2020 })), new T.Mesh(new T.BoxGeometry(.7, .18, .3), new T.MeshBasicMaterial({ color: 0x2040ff }))]; g.userData.bar[0].position.set(-.4, 1.82, -.2); g.userData.bar[1].position.set(.4, 1.82, -.2); g.add(...g.userData.bar); }
  return g;
}

export function buildChase() {
  const sc = R.scene = new T.Scene(); R.chars.clear(); R.fx = []; C.cars.clear(); R.decor = null;
  sc.background = new T.Color(0x0a0d1a); sc.fog = new T.FogExp2(0x0a0e1c, .011);
  sc.add(new T.HemisphereLight(0x33457a, 0x120e0c, .5));
  const moon = new T.DirectionalLight(0x8fa8ff, .35); moon.position.set(-30, 50, -20); sc.add(moon);
  // road: one long slab that follows the van, textures scroll by position
  C.road = new T.Mesh(new T.PlaneGeometry(22, 420), M('asphalt').clone()); C.road.material.map = C.road.material.map.clone(); C.road.material.map.needsUpdate = true; C.road.material.map.repeat.set(8, 150);
  C.road.rotation.x = -Math.PI / 2; sc.add(C.road);
  for (const sx of [-1, 1]) { const w = new T.Mesh(new T.BoxGeometry(5, .3, 420), M('sidewalk')); w.position.set(sx * 13.5, 0, 0); sc.add(w); (C.walks = C.walks || []).push(w); }
  C.walks = sc.children.filter(o => o.geometry && o.geometry.parameters && o.geometry.parameters.width === 5);
  C.dash = new T.InstancedMesh(new T.PlaneGeometry(.22, 3.2), new T.MeshBasicMaterial({ color: 0xb8a040 }), 90); C.dash.frustumCulled = false; sc.add(C.dash);
  C.build = [0, 1].map(i => { const m = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), M(i ? 'brick3' : 'brick2'), NB * 2); m.frustumCulled = false; sc.add(m); return m; });
  C.lamps = []; for (let i = 0; i < 14; i++) { const s = glow(new T.Vector3(), 0xffa850, 5); s.material.opacity = .75; C.lamps.push(s); }
  C.neon = []; ['LIQUOR', 'DINER', 'PAWN', 'BAR', 'HOTEL', 'DELI'].forEach((t, i) => { const col = ['#ff2a6a', '#28c8ff', '#58ff58', '#ffb030', '#c070ff', '#ff5a3a'][i]; const m = new T.Mesh(new T.PlaneGeometry(5, 1.4), label(t, 256, 72, 'bold 54px Arial', '#ffffff', col)); m.material.side = T.DoubleSide; sc.add(m); C.neon.push(m); });
  // lights that travel with the van: headlights, a street-lamp wash, and the pursuit's red and blue
  C.head = new T.SpotLight(0xfff2c0, 2.4, 70, .5, .5, 1.2); sc.add(C.head, C.head.target);
  C.wash = new T.PointLight(0xffa850, 1.2, 46, 1.4); sc.add(C.wash);
  C.red = new T.PointLight(0xff2020, 0, 44, 1.3); C.blue = new T.PointLight(0x2040ff, 0, 44, 1.3); sc.add(C.red, C.blue);
  C.van = carMesh('van', 0xd8d6cc); sc.add(C.van);
  // the tunnel mouth
  C.tunnel = new T.Group(); const dark = new T.MeshBasicMaterial({ color: 0x020204 }), stone = M('stone');
  const add = (w, h, d, x, y, m) => { const b = new T.Mesh(new T.BoxGeometry(w, h, d), m); b.position.set(x, y, 0); C.tunnel.add(b); return b; };
  add(60, 22, 6, 0, 17, stone); add(20, 12, 6, -20, 6, stone); add(20, 12, 6, 20, 6, stone); add(20, 6, 40, 0, 3, dark).position.z = 22;
  const sign = new T.Mesh(new T.PlaneGeometry(16, 2), label('HOLLAND TUNNEL', 1024, 128, 'bold 84px Georgia', '#ffe6a8', '#ffb030')); sign.position.set(0, 8, -3.1); sign.rotation.y = Math.PI; C.tunnel.add(sign);
  C.tunnel.position.z = CHASE.goal + 8; sc.add(C.tunnel);
  { const n = 1400, p = new Float32Array(n * 6); for (let i = 0; i < n; i++) { const x = (Math.random() - .5) * 60, y = Math.random() * 22, z = (Math.random() - .5) * 80; p.set([x, y, z, x + .05, y - .7, z + .5], i * 6); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(p, 3)); R.rain = new T.LineSegments(g, new T.LineBasicMaterial({ color: 0x8aa0d0, transparent: true, opacity: .28 })); R.rain.frustumCulled = false; sc.add(R.rain); }
  R.tracerMat = R.tracerMat || new T.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: .9 });
  C.vx = null;
}

const m4 = new T.Matrix4(), q = new T.Quaternion(), v3 = new T.Vector3(), s3 = new T.Vector3();
export function renderChase(S, me, dt, view) {
  const c = S.chase, sc = R.scene; R.t += dt;
  const vx = me.drive ? me.drive.x : c.x; C.vx = C.vx === null ? vx : C.vx + (vx - C.vx) * Math.min(1, dt * 12);
  C.vz = C.vz === undefined || Math.abs(C.vz - c.z) > 8 ? c.z : C.vz + (c.z + c.v * .04 - C.vz) * Math.min(1, dt * 10);
  const z = C.vz, base = Math.floor(z / SEG);
  C.van.position.set(C.vx, 0, z); C.van.rotation.y = (vx - C.vx) * .25; C.van.rotation.z = c.hit > 0 ? Math.sin(R.t * 60) * .03 : 0;
  C.road.position.set(0, 0, z + 150); C.road.material.map.offset.y = -(z + 150) / 420 * 150; for (const w of C.walks) w.position.z = z + 150;
  let n = 0; for (let i = -3; i < 27 && n < 90; i++) for (const x of [-4.4, 0, 4.4]) { m4.makeRotationX(-Math.PI / 2); m4.setPosition(x, .02, (base + i) * SEG + (x === 0 ? 0 : 8)); C.dash.setMatrixAt(n++, m4); } C.dash.count = n; C.dash.instanceMatrix.needsUpdate = true;
  // buildings: each slot's size comes from its index, so the street is the same every time you look
  const cnt = [0, 0];
  for (let i = -4; i < NB - 4; i++) for (const side of [-1, 1]) {
    const seg = base + i, k = seg * 2 + (side > 0 ? 1 : 0), cross = seg % 7 === 0; if (cross) continue;
    const hgt = 9 + hash(k) * 30, dep = 12 + hash(k + .5) * 6, which = hash(k + .3) < .5 ? 0 : 1;
    s3.set(dep, hgt, SEG - .4); v3.set(side * (16 + dep / 2), hgt / 2, seg * SEG + SEG / 2); m4.compose(v3, q, s3); C.build[which].setMatrixAt(cnt[which]++, m4);
  }
  C.build.forEach((m, i) => { m.count = cnt[i]; m.instanceMatrix.needsUpdate = true; });
  const lb = Math.floor(z / 36);
  C.lamps.forEach((s, i) => { const k = lb - 1 + Math.floor(i / 2); s.position.set(i % 2 ? 10.6 : -10.6, 6.5, k * 36); });
  C.neon.forEach((m, i) => { const k = Math.floor((z - 30) / 150) * 6 + i, side = i % 2 ? 1 : -1, zz = (Math.floor((z - 30) / 150) + (i < 3 ? 0 : 1)) * 150 + 40 + (i % 3) * 45; m.position.set(side * 15.7, 4.6, zz); m.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2; });
  C.head.position.set(C.vx, 1.6, z + 2.5); C.head.target.position.set(C.vx, .2, z + 30); C.wash.position.set(0, 9, z + 6);
  // other cars
  const seen = new Set(); let nearCop = null, nd = 60;
  for (const car of c.cars) {
    let o = C.cars.get(car.id); if (!o) { o = carMesh(car.k === 'civ' ? 'civ' : 'cop', car.k === 'civ' ? car.col : 0x1a2e5a); o.userData.x = car.x; o.userData.z = car.z; sc.add(o); C.cars.set(car.id, o); }
    seen.add(car.id); const k = Math.min(1, dt * 12); o.userData.x += (car.x - o.userData.x) * k; o.userData.z += (car.z + car.v * .04 - o.userData.z) * k;
    o.position.set(o.userData.x, 0, o.userData.z); o.rotation.y = car.k === 'block' ? Math.PI / 2 : car.st ? (car.st - 1) * car.spin : car.v < 0 ? Math.PI : 0;
    if (o.userData.bar) { const f = Math.sin(R.t * 12 + car.id) > 0 && !(car.st > 1.5); o.userData.bar[0].visible = f; o.userData.bar[1].visible = !f; const d = Math.abs(car.z - z); if (!car.st && d < nd) { nd = d; nearCop = o; } }
  }
  for (const [id, o] of C.cars) if (!seen.has(id)) { sc.remove(o); C.cars.delete(id); }
  const fl = Math.sin(R.t * 12) > 0; if (nearCop) { C.red.position.copy(nearCop.position).setY(2.4); C.blue.position.copy(C.red.position); } C.red.intensity = nearCop && fl ? 3 : 0; C.blue.intensity = nearCop && !fl ? 3 : 0;
  // rain + fx
  R.rain.position.set(C.vx, 0, z + 10); const rp = R.rain.geometry.attributes.position.array; for (let i = 1; i < rp.length; i += 6) { rp[i] -= dt * 26; rp[i + 3] -= dt * 26; if (rp[i] < 0) { rp[i] += 22; rp[i + 3] += 22; } } R.rain.geometry.attributes.position.needsUpdate = true;
  for (let i = R.fx.length - 1; i >= 0; i--) { const f = R.fx[i]; if ((f.t -= dt) <= 0) { sc.remove(f.o); if (f.o.geometry) f.o.geometry.dispose(); R.fx.splice(i, 1); } }
  // camera: the driver looks down the road, a gunner swings round the van
  const shake = c.hit > 0 ? (Math.random() - .5) * .35 : 0;
  if (view.gunner) {
    const cy = Math.cos(view.pitch), fx = Math.sin(view.yaw) * cy, fy = Math.sin(view.pitch), fz = Math.cos(view.yaw) * cy;
    R.cam.position.set(C.vx - fx * 7.5 + shake, 3.2 - fy * 5 + 1, z - fz * 7.5); R.cam.lookAt(C.vx + fx * 30, 2.2 + fy * 30, z + fz * 30); R.cam.fov = 62;
  } else { R.cam.position.set(C.vx * .7 + shake, 4.6 + shake, z - 9.5); R.cam.lookAt(C.vx * .85, 1.4, z + 16); R.cam.fov = 62 + Math.max(0, c.v - 22) * .9; }
  R.cam.updateProjectionMatrix(); R.cam.updateMatrixWorld();
  if (!R.noDraw) R.gl.render(sc, R.cam);
}
export const vanPos = () => ({ x: C.vx || 0, z: C.vz || 0 });

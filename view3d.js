'use strict';
/* SHEISTERS 3D view — draws the mission as a third-person scene with three.js.
   The simulation in game.js stays on a flat 2D grid; map pixel (x, y) becomes world (x*U, height, y*U). */
const View = (() => {
  const U = 1 / 16;                 // world units per map pixel: one tile = 2 units
  const WALL_H = 3.2;
  let renderer = null, scene, cam, world = null, failed = false, clock = 0;
  let groundTex = null, actors = new Map(), cones = [], contObjs = [], bulletPool = [], fxPool = [];
  let vehicle = null, escRing = null, cruisers = [];
  const V = new THREE.Vector3(), M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), S3 = new THREE.Vector3(), P3 = new THREE.Vector3(), COL = new THREE.Color();

  const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const blockH = (x, y) => 7 + Math.floor(hash(Math.floor(x / 4), Math.floor(y / 3)) * 6) * 2.4 + (x < 0 || y < 0 || x >= COLS || y >= ROWS ? 5 : 0);
  function tileHeight(g, x, y) {
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return 0;
    const t = g[y][x];
    return t === WALL || t === VAULT ? WALL_H : t === TRUCK ? 3 : t === ROOF ? blockH(x, y) : 0;
  }

  function init() {
    if (renderer || failed) return !failed;
    try { renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('gl'), antialias: true }); }
    catch (e) { failed = true; return false; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W, H, false);
    renderer.outputEncoding = THREE.sRGBEncoding;
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0d1a);
    scene.fog = new THREE.Fog(0x0b0d1a, 34, 120);
    cam = new THREE.PerspectiveCamera(62, W / H, .1, 300);
    scene.add(new THREE.HemisphereLight(0xa9b8ff, 0x3a3028, .8));
    const moon = new THREE.DirectionalLight(0xcfd8ff, .6); moon.position.set(-30, 60, 25); scene.add(moon);
    // pooled tracers and effects live for the whole session
    const bg = new THREE.BoxGeometry(.9, .07, .07);
    for (let i = 0; i < 90; i++) { const m = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ color: 0xffe9a8 })); m.visible = false; scene.add(m); bulletPool.push(m); }
    const sg = new THREE.SphereGeometry(.3, 8, 6);
    for (let i = 0; i < 30; i++) { const m = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true })); m.visible = false; scene.add(m); fxPool.push(m); }
    return true;
  }

  // ---------------------------------------------------------------- textures
  function canvasTex(w, h, paint) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
  }
  const brickTex = () => canvasTex(64, 64, (c) => {
    c.fillStyle = '#2a1d1b'; c.fillRect(0, 0, 64, 64); c.fillStyle = '#7a4033';
    for (let r = 0; r < 8; r++) for (let q = -1; q < 4; q++) c.fillRect(q * 16 + (r % 2 ? 8 : 0) + 1, r * 8 + 1, 14, 6);
  });
  const windowTex = () => canvasTex(64, 128, (c) => {
    c.fillStyle = '#14151b'; c.fillRect(0, 0, 64, 128);
    for (let r = 0; r < 6; r++) for (let q = 0; q < 2; q++) {
      const lit = Math.random() < .45; c.fillStyle = lit ? (Math.random() < .8 ? '#e9b949' : '#7fc3e6') : '#1f2230';
      c.fillRect(8 + q * 30, 8 + r * 20, 18, 12);
    }
  });
  function signTex(text) {
    return canvasTex(1024, 96, (c, w, h) => {
      c.fillStyle = '#12090c'; c.fillRect(0, 0, w, h);
      c.font = '62px Impact, "Arial Narrow", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.shadowColor = '#ff3b6b'; c.shadowBlur = 22; c.fillStyle = '#ffe9a8'; c.fillText(text, w / 2, h / 2 + 4);
    });
  }

  // ---------------------------------------------------------------- world
  function instanced(list, material) {
    if (!list.length) return null;
    const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, .5, 0);
    const mesh = new THREE.InstancedMesh(geo, material, list.length);
    list.forEach((b, i) => {
      M4.compose(P3.set(b.x, b.y || 0, b.z), Q.identity(), S3.set(b.sx, b.sy, b.sz)); mesh.setMatrixAt(i, M4);
      if (b.c !== undefined) mesh.setColorAt(i, COL.set(b.c));
    });
    world.add(mesh); return mesh;
  }
  const box = (w, h, d, color, x, y, z, opt) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial(Object.assign({ color }, opt || {}))); m.position.set(x || 0, y || 0, z || 0); return m;
  };

  function build(Mi) {
    if (!init()) return;
    if (world) { scene.remove(world); world.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); }); }
    world = new THREE.Group(); scene.add(world);
    actors = new Map(); cones = []; contObjs = []; cruisers = [];
    const g = Mi.g, job = Mi.job, mw = COLS * T * U, mh = ROWS * T * U;

    groundTex = new THREE.CanvasTexture(mapC); groundTex.encoding = THREE.sRGBEncoding; groundTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(mw, mh), new THREE.MeshLambertMaterial({ map: groundTex }));
    ground.rotation.x = -PI / 2; ground.position.set(mw / 2, 0, mh / 2); world.add(ground);
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshLambertMaterial({ color: 0x202228 }));
    outer.rotation.x = -PI / 2; outer.position.set(mw / 2, -.03, mh / 2); world.add(outer);

    const walls = [], blocks = [], counters = [], fixtures = [], truck = [], hasCont = {};
    for (const k of Mi.cont) hasCont[k.x + ',' + k.y] = true;
    for (let y = -7; y < ROWS + 7; y++) for (let x = -9; x < COLS + 9; x++) {
      const inside = x >= 0 && y >= 0 && x < COLS && y < ROWS, cx = x * 2 + 1, cz = y * 2 + 1;
      if (!inside) {                                   // the rest of the city: leave the avenue open east and west
        if (y >= 14 && y <= 20) continue;
        blocks.push({ x: cx, z: cz, sx: 2, sy: blockH(x, y), sz: 2, c: 0x8088a0 }); continue;
      }
      const t = g[y][x];
      if (t === WALL) walls.push({ x: cx, z: cz, sx: 2, sy: WALL_H, sz: 2 });
      else if (t === ROOF) blocks.push({ x: cx, z: cz, sx: 2, sy: blockH(x, y), sz: 2, c: [0xffffff, 0xd8c8b8, 0xb8c4d8][Math.floor(hash(Math.floor(x / 4), Math.floor(y / 3) + 9) * 3)] });
      else if (t === COUNTER) counters.push({ x: cx, z: cz, sx: 2, sy: 1.05, sz: 1.5 });
      else if (t === TRUCK) truck.push({ x: cx, z: cz, sx: 2, sy: 3, sz: 2 });
      else if (t === FIX && !hasCont[x + ',' + y]) fixtures.push({ x: cx, z: cz, sx: job.street ? 1.9 : 1.3, sy: job.street ? 2.3 : 1.8, sz: job.street ? 1.6 : 2, c: job.street ? 0x2f6b40 : [0x8a5a3a, 0x6a5a8a, 0x8a7a3a][(x + y) % 3] });
    }
    const bt = brickTex(); bt.wrapS = bt.wrapT = THREE.RepeatWrapping; bt.repeat.set(1, 2);
    instanced(walls, new THREE.MeshLambertMaterial({ map: bt }));
    const wt = windowTex(), side = new THREE.MeshLambertMaterial({ map: wt, emissive: 0xffffff, emissiveMap: wt, emissiveIntensity: .55 }), top = new THREE.MeshLambertMaterial({ color: 0x15161b });
    instanced(blocks, [side, side, top, top, side, side]);
    instanced(counters, new THREE.MeshLambertMaterial({ color: 0x7d5b3b }));
    instanced(fixtures, new THREE.MeshLambertMaterial({ color: 0xffffff }));
    instanced(truck, new THREE.MeshLambertMaterial({ color: 0x3f4d43 }));

    // neon sign and street lamps
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(22, job.sign.length * .62 + 3), 1.5), new THREE.MeshBasicMaterial({ map: signTex(job.sign), fog: false }));
    sign.position.set(40, job.street ? 4.6 : 4.1, (job.street ? 12 : 28) + .08); world.add(sign);
    for (const x of [8, 24, 40, 56, 72]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(.08, .1, 5.2, 6), new THREE.MeshLambertMaterial({ color: 0x1b1c22 })); pole.position.set(x, 2.6, 31.6); world.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(.25, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe2a8 })); bulb.position.set(x, 5.2, 31.6); world.add(bulb);
      const l = new THREE.PointLight(0xffd9a0, .8, 20, 1.6); l.position.set(x, 5, 31.6); world.add(l);
    }

    // loot containers
    Mi.cont.forEach((k) => {
      const grp = new THREE.Group(); grp.position.set(k.x * 2 + 1, 0, k.y * 2 + 1); let loot = null;
      if (k.type === 'register') { grp.add(box(2, 1.05, 1.5, 0x7d5b3b, 0, .525, 0)); loot = box(.8, .45, .7, 0x39424a, 0, 1.28, 0); loot.add(box(.6, .2, .1, 0x5fd38d, 0, .1, .36, { emissive: 0x2a8a55 })); }
      else if (k.type === 'safe') { grp.add(box(1.5, 1.6, 1.5, 0x59616b, 0, .8, 0)); for (const s of [-1, 1]) { const d = new THREE.Mesh(new THREE.CylinderGeometry(.28, .28, .08, 14), new THREE.MeshLambertMaterial({ color: 0xc9ced6 })); d.rotation.x = PI / 2; d.position.set(0, .9, s * .78); grp.add(d); } }
      else if (k.type === 'boxes') { grp.add(box(1.9, 2.3, 1.9, 0x4a525c, 0, 1.15, 0)); for (let i = 0; i < 3; i++) grp.add(box(1.94, .04, 1.94, 0x8a929c, 0, .55 + i * .6, 0)); }
      else if (k.type === 'case') { grp.add(box(1.8, .85, 1.3, 0x3b2f28, 0, .425, 0)); loot = box(1.7, .45, 1.2, 0xa8dcef, 0, 1.08, 0, { transparent: true, opacity: .55, emissive: 0x2a5a6a }); loot.add(box(1.2, .08, .7, 0xffffff, 0, -.18, 0, { emissive: 0xaaaaaa })); }
      else if (k.type === 'vault') { grp.add(box(2, WALL_H, 2, 0x7b848f, 0, WALL_H / 2, 0)); for (const [dx, dz, rx, rz] of [[1.02, 0, 0, PI / 2], [-1.02, 0, 0, PI / 2], [0, 1.02, PI / 2, 0], [0, -1.02, PI / 2, 0]]) { const d = new THREE.Mesh(new THREE.CylinderGeometry(.8, .8, .08, 20), new THREE.MeshLambertMaterial({ color: 0xaab3bd })); d.rotation.set(rx, 0, rz); d.position.set(dx, 1.5, dz); grp.add(d); } loot = grp; }
      else if (k.type === 'cash') { grp.add(box(1.7, .2, 1.7, 0x6b5a45, 0, .1, 0)); loot = box(1.4, .9, 1.4, 0x4fae74, 0, .65, 0); }
      else if (k.type === 'gold') { grp.add(box(1.7, .2, 1.7, 0x5b5346, 0, .1, 0)); loot = box(1.3, .6, 1.3, 0xf2c230, 0, .5, 0, { emissive: 0x6a4a00 }); }
      else { loot = box(1.5, 1.5, 1.5, 0x8b6a3e, 0, .75, 0); grp.add(box(1.56, .12, 1.56, 0x5e4526, 0, .75, 0)); }
      if (loot && loot !== grp) grp.add(loot);
      const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(.22), new THREE.MeshBasicMaterial({ color: 0xf5c518 })); beacon.position.y = k.type === 'vault' ? 3.8 : 2.7; grp.add(beacon);
      world.add(grp); contObjs.push({ grp, loot, beacon });
    });

    // guard sight cones (flat fans on the floor)
    Mi.guards.forEach(() => {
      const geo = new THREE.CircleGeometry(190 * U, 20, -.87, 1.74); geo.rotateX(-PI / 2);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffe678, transparent: true, opacity: .16, depthWrite: false })); m.position.y = .06; world.add(m); cones.push(m);
    });

    // getaway vehicle
    vehicle = new THREE.Group(); vehicle.position.set(Mi.veh.x * U, 0, Mi.veh.y * U);
    const col = new THREE.Color(Mi.veh.def.color).getHex(), kind = Object.keys(VEHICLES).find(id => VEHICLES[id] === Mi.veh.def);
    if (kind === 'heli') {
      const body = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshLambertMaterial({ color: col })); body.scale.set(2.6, 1.3, 1.4); body.position.y = 1.7; vehicle.add(body);
      vehicle.add(box(3.6, .35, .35, col, -3.6, 1.9, 0)); vehicle.add(box(.2, 1.2, .2, col, -5.2, 2.4, 0));
      vehicle.add(box(1.2, .9, 1.9, 0x9fd0e6, 1.5, 1.8, 0, { transparent: true, opacity: .7 }));
      for (const s of [-1, 1]) vehicle.add(box(3.4, .1, .12, 0x222222, 0, .25, s * 1.1));
      const rotor = box(8.4, .06, .3, 0xdddddd, 0, 3.2, 0); vehicle.add(rotor); vehicle.userData.rotor = rotor;
    } else {
      const big = kind === 'van' || kind === 'suv', len = big ? 6.2 : 5.4, hi = kind === 'van' ? 2.2 : big ? 1.7 : 1.15;
      vehicle.add(box(len, hi, 2.5, col, 0, .45 + hi / 2, 0));
      if (kind !== 'van') vehicle.add(box(len * .5, .8, 2.3, 0x10131a, -len * .05, .45 + hi + .4, 0));
      else vehicle.add(box(1.2, .9, 2.52, 0x10131a, len / 2 - 1, 1.9, 0));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(.48, .48, .35, 12), new THREE.MeshLambertMaterial({ color: 0x0b0b0d })); w.rotation.x = PI / 2; w.position.set(sx * len * .32, .48, sz * 1.25); vehicle.add(w); }
      for (const sz of [-1, 1]) { vehicle.add(box(.1, .25, .5, 0xffe9a8, len / 2, .9, sz * .85, { emissive: 0xffe9a8 })); vehicle.add(box(.1, .25, .5, 0xe5383b, -len / 2, .9, sz * .85, { emissive: 0xa01018 })); }
    }
    world.add(vehicle);
    escRing = new THREE.Mesh(new THREE.RingGeometry(84 * U - .2, 84 * U, 56), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .5, side: THREE.DoubleSide, depthWrite: false }));
    escRing.rotation.x = -PI / 2; escRing.position.set(Mi.veh.x * U, .07, Mi.veh.y * U); world.add(escRing);

    // police cruisers parked at both ends of the avenue
    for (const sx of [0, 1]) {
      const c = new THREE.Group(); c.position.set(sx ? mw - 2.2 : 2.2, 0, 17.8 * 2);
      c.add(box(4.8, 1.1, 2.3, 0xe9edf2, 0, 1, 0)); c.add(box(2.3, .8, 2.1, 0x1b3a8a, 0, 1.95, 0));
      const red = box(.5, .25, .8, 0xff2b2b, 0, 2.5, -.5), blue = box(.5, .25, .8, 0x2b6bff, 0, 2.5, .5); c.add(red); c.add(blue);
      const light = new THREE.PointLight(0xff2b2b, 0, 30, 1.4); light.position.set(0, 3, 0); c.add(light);
      c.visible = false; world.add(c); cruisers.push({ c, red, blue, light, sx });
    }
  }

  // ---------------------------------------------------------------- characters
  function makeDude(kind, color) {
    const g = new THREE.Group(), b = new THREE.Group(); g.add(b);
    const skin = 0xe0b48c;
    const look = { crew: [color, 0x1a1b20, 0x17181d, null], cop: [0x1f3f9a, 0x16286a, skin, 0x0f2260], swat: [0x16181d, 0x101114, 0x2f3238, 0x23262c], guard: [0x6d7480, 0x2a2d35, skin, 0x22252b], civ: [color, 0x34405a, skin, 0x4a3526] }[kind];
    const part = (w, h, d, c, pivotY) => { const geo = new THREE.BoxGeometry(w, h, d); geo.translate(0, -h / 2, 0); const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: c })); m.position.y = pivotY; return m; };
    const legL = part(.3, .9, .3, look[1], .9), legR = part(.3, .9, .3, look[1], .9); legL.position.z = -.2; legR.position.z = .2;
    const torso = box(.42, .78, .82, look[0], 0, 1.29, 0);
    const armL = part(.22, .7, .22, look[0], 1.62), armR = part(.22, .7, .22, look[0], 1.62); armL.position.z = -.53; armR.position.z = .53;
    const head = new THREE.Mesh(new THREE.SphereGeometry(.25, 12, 10), new THREE.MeshLambertMaterial({ color: look[2] })); head.position.y = 1.92;
    b.add(legL, legR, torso, armL, armR, head);
    if (look[3] !== null) { const hat = new THREE.Mesh(new THREE.CylinderGeometry(.27, .27, .14, 12), new THREE.MeshLambertMaterial({ color: look[3] })); hat.position.y = 2.1; b.add(hat); }
    let gun = null;
    if (kind !== 'civ') { gun = box(.16, kind === 'swat' ? .75 : .45, .1, 0x0b0b0d, 0, -.78, 0); armR.add(gun); }
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(.62, 14), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .35, depthWrite: false })); shadow.rotation.x = -PI / 2; shadow.position.y = .04; g.add(shadow);
    g.userData = { b, legL, legR, armL, armR, gun, phase: Math.random() * 6, lx: null, lz: null, sp: 0 };
    return g;
  }
  function place(id, kind, color, e, dt, pose) {
    let g = actors.get(id);
    if (!g) { g = makeDude(kind, color); world.add(g); actors.set(id, g); }
    const d = g.userData, x = e.x * U, z = e.y * U;
    if (d.lx !== null && dt > 0) { const v = Math.hypot(x - d.lx, z - d.lz) / dt; d.sp += (Math.min(v, 12) - d.sp) * Math.min(1, dt * 10); }
    d.lx = x; d.lz = z; d.seen = clock;
    g.position.set(x, 0, z); g.rotation.y = -e.a;
    const lying = pose === 'down';
    d.b.rotation.z = lying ? PI / 2 : 0; d.b.position.y = lying ? .28 : 0; d.b.position.x = lying ? .9 : 0;
    const walk = lying ? 0 : Math.min(1, d.sp / 4); d.phase += d.sp * dt * 1.5;
    const sw = Math.sin(d.phase) * .7 * walk;
    d.legL.rotation.z = sw; d.legR.rotation.z = -sw;
    if (pose === 'hands') { d.armL.rotation.z = PI * .92; d.armR.rotation.z = PI * .92; }
    else if (pose === 'aim') { d.armR.rotation.z = PI / 2; d.armL.rotation.z = PI * .42; }
    else { d.armL.rotation.z = -sw; d.armR.rotation.z = sw; }
    return g;
  }

  // ---------------------------------------------------------------- per-frame
  function render(Mi, me, dt) {
    if (!renderer || !world) return;
    clock++;
    if (View.groundDirty && groundTex) { groundTex.needsUpdate = true; View.groundDirty = false; }

    Mi.crew.forEach(c => { const g = place('c' + c.slot, 'crew', c.color, c, dt, c.down ? 'down' : 'aim'); g.userData.gun.scale.y = WEAPONS[c.weapon].melee ? .45 : 1.4; c._g = g; });
    Mi.civs.forEach(v => place('v' + v.id, 'civ', v.clerk ? '#3f8f5a' : v.color, v, dt, v.state === 'hands' || v.state === 'cower' ? 'hands' : 'walk'));
    Mi.guards.forEach((gd, i) => {
      place('g' + i, 'guard', null, gd, dt, gd.dead ? 'down' : gd.hostile ? 'aim' : 'walk');
      const cone = cones[i]; if (!cone) return;
      cone.visible = !gd.dead && !gd.hostile;
      cone.position.x = gd.x * U; cone.position.z = gd.y * U; cone.rotation.y = -gd.a;
      cone.material.color.setRGB(1, .9 - gd.det * .65, .47 - gd.det * .3); cone.material.opacity = .16 + gd.det * .25;
    });
    Mi.cops.forEach(c => place('p' + c.id, c.kind === 'swat' ? 'swat' : 'cop', null, c, dt, c.dead ? 'down' : 'aim'));
    for (const [id, g] of actors) if (g.userData.seen !== clock) { world.remove(g); actors.delete(id); }

    Mi.cont.forEach((k, i) => {
      const o = contObjs[i]; if (!o) return;
      o.beacon.visible = !k.open; o.beacon.rotation.y += dt * 2; o.beacon.position.y += Math.sin(clock * .05 + i) * .002;
      if (k.type === 'vault') o.grp.visible = !k.open; else if (o.loot) o.loot.visible = !k.open;
    });

    const can = Mi.take > 0 || Mi.alarm;
    escRing.material.color.setHex(can ? 0x5fd38d : 0xffffff); escRing.material.opacity = can ? .85 : .3;
    if (vehicle.userData.rotor) vehicle.userData.rotor.rotation.y += dt * 22;
    for (const k of cruisers) {
      k.c.visible = !!Mi.arrived; if (!Mi.arrived) continue;
      const fl = Math.floor(Mi.t * 6 + k.sx) % 2;
      k.red.material.emissive.setHex(fl ? 0xff2020 : 0x200000); k.blue.material.emissive.setHex(fl ? 0x000020 : 0x2050ff);
      k.light.color.setHex(fl ? 0xff2b2b : 0x2b6bff); k.light.intensity = 1.6;
    }

    bulletPool.forEach((m, i) => {
      const b = Mi.bullets[i]; m.visible = !!b; if (!b) return;
      m.position.set(b.x * U, 1.45, b.y * U); m.rotation.y = -Math.atan2(b.vy, b.vx); m.material.color.setHex(b.crew ? 0xffe9a8 : 0xff8b7a);
    });
    fxPool.forEach((m, i) => {
      const f = Mi.fx[i]; m.visible = !!f; if (!f) return;
      const p = Math.min(1, f.t / f.life);
      m.position.set(f.x * U, f.type === 'swing' ? 1.3 : 1.45, f.y * U);
      if (f.type === 'swing') { m.position.x += Math.cos(f.a) * 1.1; m.position.z += Math.sin(f.a) * 1.1; m.material.color.setHex(0xffffff); m.scale.setScalar(.6 + p); }
      else if (f.type === 'flash') { m.material.color.setHex(0xffe08a); m.scale.setScalar(1.2); }
      else { m.material.color.set(f.col || '#ffd27a'); m.scale.setScalar(.5 + p * 1.6); }
      m.material.opacity = f.type === 'flash' ? 1 : 1 - p;
    });

    // third-person camera: over the right shoulder, pulled in when a wall is in the way
    if (me) {
      const px = me.x * U, pz = me.y * U, yaw = look.yaw, pitch = look.pitch, fx = Math.cos(yaw), fz = Math.sin(yaw);
      const back = 5.4 * Math.cos(pitch), up = 5.4 * Math.sin(pitch), side = .75, hx = px, hy = 1.75, hz = pz;
      let tx2 = px - fx * back - fz * side, ty2 = hy + .5 + up, tz2 = pz - fz * back + fx * side, frac = 1;
      for (let i = 1; i <= 18; i++) {
        const f = i / 18, x = hx + (tx2 - hx) * f, y = hy + (ty2 - hy) * f, z = hz + (tz2 - hz) * f;
        if (x < .4 || z < .4 || x > COLS * 2 - .4 || z > ROWS * 2 - .4 || y < tileHeight(Mi.g, Math.floor(x / 2), Math.floor(z / 2)) + .25) { frac = Math.max(.06, (i - 1.3) / 18); break; }
      }
      cam.position.set(hx + (tx2 - hx) * frac, hy + (ty2 - hy) * frac, hz + (tz2 - hz) * frac);
      const ahead = 7 * Math.cos(pitch) + 1;
      cam.lookAt(px + fx * ahead, 1.45, pz + fz * ahead);
      if (me._g) me._g.visible = frac > .22;
    } else { cam.position.set(40, 46, 44); cam.lookAt(40, 0, 20); }
    renderer.render(scene, cam);
  }

  // map pixel + height -> HUD pixel, or null when it is behind the camera
  function project(x, y, h) {
    if (!cam) return null;
    V.set(x * U, h, y * U).project(cam);
    if (V.z > 1 || V.z < -1) return null;
    return { x: (V.x * .5 + .5) * W, y: (-V.y * .5 + .5) * H };
  }

  return { build, render, project, groundDirty: false, get failed() { return failed; } };
})();

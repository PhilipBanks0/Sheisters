// SHEISTERS — First Empire Savings, Midtown. True 3D level: geometry, collision, sight lines, navigation.
// Units are metres. X east, Y up, Z south. yaw 0 faces +Z; forward = (sin yaw, 0, cos yaw).

export const L = { boxes: [], ramps: [], doors: {}, lights: [], props: [], cams: [], inter: [], guards: [], civs: [], zones: {} };
const TH = 0.3;

function B(x0, x1, y0, y1, z0, z1, mat, o) {
  const b = Object.assign({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), y0: Math.min(y0, y1), y1: Math.max(y0, y1), z0: Math.min(z0, z1), z1: Math.max(z0, z1),
    mat, solid: true, opaque: true, walk: false, off: false }, o || {});
  L.boxes.push(b); return b;
}
const F = (x0, x1, z0, z1, y, mat, o) => B(x0, x1, y - .3, y, z0, z1, mat, Object.assign({ walk: true, floor: true }, o));
// wall along X (constant z) or along Z (constant x), with door/window gaps [from, to, gapTop, gapBottom]
function wallX(z, x0, x1, y0, y1, mat, gaps) { wallRun('x', z, x0, x1, y0, y1, mat, gaps); }
function wallZ(x, z0, z1, y0, y1, mat, gaps) { wallRun('z', x, z0, z1, y0, y1, mat, gaps); }
function wallRun(ax, c, a0, a1, y0, y1, mat, gaps) {
  const seg = (s, e, ya, yb, m, o) => { if (e - s < .01 || yb - ya < .01) return; ax === 'x' ? B(s, e, ya, yb, c - TH / 2, c + TH / 2, m || mat, o) : B(c - TH / 2, c + TH / 2, ya, yb, s, e, m || mat, o); };
  let at = a0;
  for (const g of (gaps || []).slice().sort((p, q) => p[0] - q[0])) {
    seg(at, g[0], y0, y1);
    const top = g[2] === undefined ? y0 + 2.2 : g[2], bot = g[3] === undefined ? y0 : g[3];
    seg(g[0], g[1], top, y1); seg(g[0], g[1], y0, bot);
    if (g[4] === 'glass') seg(g[0], g[1], bot, top, 'glass', { opaque: false, glass: true });
    at = g[1];
  }
  seg(at, a1, y0, y1);
}
// a prop drawn with a CC0 model: centre x,z, footprint w × d, height h, floor y, turn ry
function Mdl(name, x, z, w, d, h, y, ry, o) { return B(x - w / 2, x + w / 2, y || 0, (y || 0) + h, z - d / 2, z + d / 2, 'none', Object.assign({ model: name, ry: ry || 0, opaque: false }, o || {})); }
const soft = { solid: false };                                        // rugs, pictures: seen, never bumped into
function door(id, ax, c, a0, a1, y0, o) {
  const b = ax === 'x' ? B(a0, a1, y0, y0 + 2.2, c - .08, c + .08, 'door') : B(c - .08, c + .08, y0, y0 + 2.2, a0, a1, 'door');
  b.door = id;
  L.doors[id] = Object.assign({ id, box: b, ax, x: ax === 'x' ? (a0 + a1) / 2 : c, y: y0, z: ax === 'x' ? c : (a0 + a1) / 2, locked: false, name: 'Door' }, o || {});
}

// ------------------------------------------------------------------ build
function street() {
  L.streetLamps = [[-20, 3.2], [-4, 14.8], [16, 3.2], [28, 14.8]];
  L.spawns = [[-2.4, 2.6], [-.8, 2.9], [.8, 2.9], [2.4, 2.6]]; L.van = { x: 4.3, y: 0, z: 6.2, r: 4.2 };
  L.copSpawns = [[-37, 9], [37, 9], [-37, 2], [37, 2]]; L.exits = [[-36, 2], [36, 2]];
  // ---- outdoors
  F(-40, 40, 0, 4, 0, 'sidewalk'); F(-40, 40, 4, 14, 0, 'asphalt'); F(-40, 40, 14, 18, 0, 'sidewalk');
  F(14, 19, -24, 0, 0, 'asphalt');                                   // east alley
  B(-40, -14, 0, 16, -26, 0, 'brick2', { skyline: true }); B(19, 40, 0, 20, -26, 0, 'brick3', { skyline: true });
  B(14, 19, 0, 9, -24.3, -24, 'brick2');                              // alley dead end
  B(-40, -22, 0, 22, 18, 30, 'brick3', { skyline: true }); B(-22, -4, 0, 30, 18, 30, 'brick2', { skyline: true });
  B(-4, 16, 0, 18, 18, 30, 'brick', { skyline: true }); B(16, 40, 0, 26, 18, 30, 'brick3', { skyline: true });
  B(-40.3, -40, 0, 8, 0, 18, 'none', { opaque: false, invis: true }); B(40, 40.3, 0, 8, 0, 18, 'none', { opaque: false, invis: true });
  Mdl('dumpster', 16.1, -21, 1.8, 3, 1.5, 0, Math.PI / 2, { opaque: true });
  B(5, 10.6, 0, 2.2, 5, 7.4, 'van', { van: true });                   // the getaway van (rear at x=5)
  Mdl('car_sedan', -10.8, 5.95, 4.4, 1.9, 1.5, 0, Math.PI / 2, { car: true, opaque: true }); Mdl('car_taxi', -22.8, 12.15, 4.4, 1.9, 1.5, 0, -Math.PI / 2, { car: true, opaque: true, kerb: 1 }); Mdl('car_hatchback', 24.2, 5.95, 4.4, 1.9, 1.5, 0, Math.PI / 2, { car: true, opaque: true });
  Mdl('car_stationwagon', -30, 5.95, 4.4, 1.9, 1.5, 0, Math.PI / 2, { car: true, opaque: true, kerb: 1 }); Mdl('car_sedan', 31, 12.15, 4.4, 1.9, 1.5, 0, -Math.PI / 2, { car: true, opaque: true });
  Mdl('bench', -17.5, .9, 1.8, .7, .9, 0, 0); Mdl('bench', 20.5, .9, 1.8, .7, .9, 0, 0); Mdl('trash_A', -20, 1, .7, .7, .9, 0, 0); Mdl('trash_B', 12.4, 2.8, .7, .7, .9, 0, 0); Mdl('trash_A', 27, 15.4, .7, .7, .9, 0, 0);
  Mdl('box_A', 15, -6, .9, .9, .9, 0, .3); Mdl('box_B', 18.2, -3, .9, .9, .9, 0, 1); Mdl('box_A', 18.3, -17.5, 1, 1, 1, 0, 0); Mdl('trafficlight_A', -36, 3.4, .5, .5, 5, 0, Math.PI / 2, soft); Mdl('trafficlight_A', 36, 14.6, .5, .5, 5, 0, -Math.PI / 2, soft);
  Mdl('bush', -26, 1.2, 1.4, 1, 1, 0, 0, soft); Mdl('bush', 29.5, 1.2, 1.4, 1, 1, 0, 0, soft);
  B(-6.4, -6.0, 0, 2.4, 1.3, 1.7, 'phone'); B(12.2, 12.8, 0, 1.1, 1.2, 1.8, 'hydrant', { opaque: false });

}

function bank() {
  street();
  L.name = 'First Empire Savings'; L.sign = 'FIRST EMPIRE SAVINGS'; L.signY = 5.4; L.floors = [['UPSTAIRS — offices', 3.5], ['GROUND — lobby, tellers, staff hall', 0], ['BASEMENT — vault', -4]];
  L.restricted = (x, y, z) => !(x < -14 || x > 14 || z > 0 || z < -20) && (z < -9.8 || y < -1 || y > 2);
  L.lootMark = [-9.5, -2.5, -16.5];
  L.pins = [[0, -12.5, -18.6, 'CAMERA CONSOLE', '#4dc3ff'], [0, 7.3, 6.2, 'VAN', '#5fd38d'], [0, 0, 0, 'FRONT DOOR', '#fff'], [0, 14, -16, 'ALLEY DOOR', '#fff'], [0, 17.6, -14.2, 'FIRE ESCAPE UP', '#fff'], [3.5, 14, -14.2, 'FIRE DOOR', '#f5c518'], [0, 16.1, -21, 'DUMPSTER', '#aaa'], [0, -12.4, -19.2, 'LOCKER', '#aaa'], [0, 0, -19, 'STAIRS DOWN', '#fff'], [0, 9, -19, 'STAIRS UP', '#fff'],
    [3.5, -9, -16.5, "MANAGER'S DESK + KEYCARD", '#f5c518'], [-4, -5, -17.2, 'READER', '#f5c518'], [-4, -5, -13.9, 'READER', '#f5c518'], [-4, -9.5, -16.4, 'VAULT · 8 bags + gold crate', '#5fd38d'], [-4, 11.5, -17, 'DEPOSIT BOXES', '#5fd38d']];
  // ---- floors
  F(-14, 14, -13, 0, 0, 'marble');                                    // lobby + tellers
  F(-14, -4, -20, -13, 0, 'tile'); F(-4, 4, -18, -13, 0, 'tile'); F(4, 14, -20, -13, 0, 'tile');   // back strip (hole for stairs down)
  F(-14, 14, -20, -13, -4, 'concrete');                               // basement
  F(-14, 6, -20, -13, 3.5, 'carpet'); F(6, 12.5, -18, -13, 3.5, 'carpet'); F(12.5, 14, -20, -13, 3.5, 'carpet');   // upper floor (hole for stairs up)
  B(-14.3, 14.3, 7, 7.3, -20.3, 0.3, 'roof');                         // roof
  L.ramps.push({ x0: -4, x1: 4, z0: -20, z1: -18, yA: 0, yB: -4, mat: 'concrete' });      // stairs down (top at west)
  L.ramps.push({ x0: 6, x1: 12.5, z0: -20, z1: -18, yA: 0, yB: 3.5, mat: 'wood' });       // stairs up (top at east)

  // ---- exterior walls
  wallX(0, -14, 14, 0, 7, 'stone', [[-11, -4, 4.2, 1, 'glass'], [-1.6, 1.6, 2.6], [4, 11, 4.2, 1, 'glass']]);
  wallX(-20, -14, 14, -4, 7, 'stone');
  wallZ(-14, -20, 0, 0, 7, 'stone'); wallZ(-14, -20, -13, -4, 0, 'concrete');
  wallZ(14, -20, 0, 0, 7, 'stone', [[-16.6, -15.4], [-14.8, -13.6, 5.7, 3.5]]); wallZ(14, -20, -13, -4, 0, 'concrete');
  // fire escape in the alley: a steep iron stair up to a locked door on the office floor (too steep for anyone in uniform)
  door('fire', 'z', 14, -14.8, -13.6, 3.5, { locked: true, name: 'Fire door' });
  F(13.9, 16.6, -14.9, -13.5, 3.5, 'shelf'); L.ramps.push({ x0: 16.6, x1: 18.95, z0: -14.9, z1: -13.5, yA: 3.5, yB: 0, mat: 'shelf' });
  B(16.6, 18.3, 0, 4.5, -14.96, -14.9, 'shelf', { opaque: false }); B(16.6, 18.3, 0, 4.5, -13.5, -13.44, 'shelf', { opaque: false }); B(14.15, 16.6, 3.5, 4.5, -14.96, -14.9, 'shelf', { opaque: false }); B(14.15, 16.6, 3.5, 4.5, -13.5, -13.44, 'shelf', { opaque: false });
  wallX(-13, -14, 14, -4, -.3, 'concrete');
  door('side', 'z', 14, -16.6, -15.4, 0, { locked: true, name: 'Alley door' });

  // ---- lobby / back divider (two storeys tall), teller line
  wallX(-13, -14, 14, 0, 7, 'plaster', [[-12, -5, 6.2, 4.5, 'glass'], [4.4, 5.6]]);
  door('staff', 'x', -13, 4.4, 5.6, 0, { locked: true, name: 'Staff door' });
  B(-14, 8, 0, 1.1, -10.4, -9.8, 'counter'); B(9.2, 14, 0, 1.1, -10.4, -9.8, 'counter');
  B(-14, 8, 1.1, 2.5, -10.15, -10.05, 'glass', { opaque: false, glass: true }); B(9.2, 14, 1.1, 2.5, -10.15, -10.05, 'glass', { opaque: false, glass: true });
  for (const x of [-9, -3, 3]) { B(x - .35, x + .35, 0, 7, -5.35, -4.65, 'column'); }
  Mdl('couch', -13.15, -6.6, .95, 2.4, .9, 0, Math.PI / 2); Mdl('couch_pillows', -13.15, -3.2, .95, 2.4, .9, 0, Math.PI / 2); Mdl('table_low', -11.9, -4.9, .7, 1, .45, 0, 0);
  Mdl('couch', 13.15, -6.6, .95, 2.4, .9, 0, -Math.PI / 2); Mdl('armchair', 13.1, -3.6, 1, 1, .9, 0, -Math.PI / 2); Mdl('armchair', 13.1, -2.3, 1, 1, .9, 0, -Math.PI / 2); Mdl('lamp_standing', 13.4, -8.4, .5, .5, 1.9, 0, 0);
  Mdl('rug_rectangle_A', -11.6, -5, 2.6, 4.6, .04, 0, Math.PI / 2, soft); Mdl('rug_rectangle_A', 11.6, -5, 2.6, 4.6, .04, 0, Math.PI / 2, soft);
  Mdl('pictureframe_large_A', -13.78, -5, .12, 1.6, 1.3, 2, Math.PI / 2, soft); Mdl('pictureframe_large_B', 13.78, -5, .12, 1.6, 1.3, 2, -Math.PI / 2, soft); Mdl('pictureframe_medium', -13.78, -1.5, .12, 1, .9, 2.1, Math.PI / 2, soft);
  Mdl('cactus_medium_A', -13.2, -9.2, .7, .7, 1.4, 0, 0, soft); Mdl('cactus_medium_A', 13.2, -.8, .7, .7, 1.4, 0, 0, soft);
  // new accounts corner: two desks where customers sit with a clerk
  Mdl('table_medium', 10.2, -1.6, 1.6, .9, .8, 0, 0); Mdl('chair_A', 10.2, -.7, .6, .6, 1, 0, 0, soft); Mdl('chair_B', 10.2, -2.6, .6, .6, 1, 0, Math.PI, soft); Mdl('table_medium', 6.6, -1.6, 1.6, .9, .8, 0, 0); Mdl('chair_A', 6.6, -.7, .6, .6, 1, 0, 0, soft); Mdl('chair_B', 6.6, -2.6, .6, .6, 1, 0, Math.PI, soft); Mdl('lamp_table', 10.7, -1.6, .3, .3, .5, .8, 0, soft); Mdl('book_set', 6.2, -1.6, .4, .3, .2, .8, 0, soft);
  Mdl('chair_stool', -6, -12, .5, .5, .7, 0, 0, soft); Mdl('chair_stool', 2, -12, .5, .5, .7, 0, 0, soft); Mdl('cabinet_medium', -10.5, -12.55, 1.6, .6, 1.1, 0, 0); Mdl('cabinet_small', 11.8, -12.55, 1, .6, 1.1, 0, 0);
  B(-6.5, -5.5, 0, 1.05, -3.2, -2.4, 'desk', { opaque: false }); B(5.5, 6.5, 0, 1.05, -3.2, -2.4, 'desk', { opaque: false });   // deposit-slip stands

  // ---- ground floor back strip
  wallZ(-7, -20, -13, 0, 3.2, 'plaster', [[-16.2, -15]]);
  door('sec', 'z', -7, -16.2, -15, 0, { locked: true, name: 'Security room' });
  B(-13.6, -12.8, 0, 1.2, -18.5, -15, 'console');                     // camera console
  Mdl('chair_C', -11.7, -16.8, .7, .7, 1, 0, -Math.PI / 2, soft); Mdl('cabinet_medium_decorated', -8, -19.5, 1.5, .6, 1.2, 0, 0); Mdl('table_small', -8.2, -13.9, .9, .9, .8, 0, 0); Mdl('chair_A', -9.3, -13.9, .6, .6, 1, 0, Math.PI / 2, soft);
  wallX(-18, -4, 4, 0, 1.05, 'rail', []); L.boxes[L.boxes.length - 1].opaque = false;     // railing round the stairwell
  wallZ(4, -20, -18, 0, 3.2, 'plaster');
  wallX(-18, 6, 12.5, 0, 3.2, 'plaster');
  B(12.5, 13.9, 0, 3.2, -20, -18, 'plaster');                         // solid block under the top landing
  Mdl('cabinet_medium_decorated', 9.8, -13.6, 1.5, .6, 1.1, 0, Math.PI); Mdl('cabinet_small_decorated', 11.5, -13.6, 1, .6, 1.1, 0, Math.PI); Mdl('pictureframe_medium', 2, -13.22, 1, .12, .9, 1.6, Math.PI, soft); Mdl('cactus_small_A', 13.3, -17.2, .5, .5, .8, 0, 0, soft);

  // ---- basement
  wallX(-18, -4, 4, -4, -.3, 'concrete');
  wallZ(-4, -20, -18, -4, -.3, 'concrete');
  wallZ(-5, -20, -13, -4, -.3, 'vaultwall', [[-16.4, -14.6, -1.6]]);
  L.vaultDoor = B(-5.2, -4.8, -4, -1.6, -16.4, -14.6, 'vaultdoor', { vault: true });
  wallZ(9, -20, -13, -4, -.3, 'concrete', [[-16.2, -15]]);
  door('dep', 'z', 9, -16.2, -15, -4, { locked: true, name: 'Deposit boxes' });
  B(13.2, 13.85, -4, -1.8, -19.6, -13.4, 'boxes'); B(9.6, 13, -4, -1.8, -19.85, -19.3, 'boxes');
  B(-13.8, -13, -4, -2.2, -19.5, -13.5, 'shelf'); B(-12.5, -6, -4, -2.2, -19.85, -19.2, 'shelf');
  B(-10.5, -8.5, -4, -3.3, -17, -15, 'pallet', { opaque: false });

  // ---- upper floor
  wallZ(-2, -20, -13, 3.5, 7, 'plaster', [[-16.2, -15, 5.7]]);
  door('mgr', 'z', -2, -16.2, -15, 3.5, { name: "Manager's office" });
  wallX(-18, 6, 12.5, 3.5, 4.5, 'rail'); L.boxes[L.boxes.length - 1].opaque = false;
  wallZ(6, -20, -18, 3.5, 4.5, 'rail'); L.boxes[L.boxes.length - 1].opaque = false;
  Mdl('table_medium_long', -9, -16.6, 3, 1.2, .8, 3.5, 0, { stretch: true });   // manager's desk
  Mdl('shelf_A_big', -13.55, -18.5, .6, 2, 1.9, 3.5, Math.PI / 2, { opaque: true }); Mdl('shelf_A_big', -13.55, -15.2, .6, 2, 1.9, 3.5, Math.PI / 2, { opaque: true });
  Mdl('couch_pillows', -4.6, -19.3, 2.4, .95, .9, 3.5, 0); Mdl('armchair_pillows', -2.8, -14, 1, 1, .9, 3.5, Math.PI); Mdl('lamp_standing', -2.6, -19.4, .5, .5, 1.9, 3.5, 0); Mdl('rug_oval_A', -5, -15.2, 3, 2, .04, 3.5, 0, soft);
  Mdl('pictureframe_large_A', -8, -19.82, 1.6, .12, 1.3, 5, 0, soft); Mdl('chair_A', -10.5, -15.4, .6, .6, 1, 3.5, Math.PI, soft); Mdl('chair_A', -7.5, -15.4, .6, .6, 1, 3.5, Math.PI, soft);
  Mdl('cabinet_medium_decorated', 3.5, -13.7, 1.6, .6, 1.1, 3.5, Math.PI); Mdl('couch', 9, -13.75, 2.4, .95, .9, 3.5, Math.PI); Mdl('cactus_medium_A', 5.3, -13.6, .6, .6, 1.3, 3.5, 0, soft); Mdl('pictureframe_large_B', 8.5, -13.2, 1.6, .12, 1.2, 5, Math.PI, soft); Mdl('table_low', 9, -15, 1.2, .7, .45, 3.5, 0);

  // ---- lights (x, y, z, colour, intensity, distance)
  for (const x of [-8, 0, 8]) L.lights.push([x, 6.2, -5, 0xffe2b0, 1.1, 22]);
  L.lights.push([-10.5, 2.8, -16.5, 0x88ccff, .8, 9], [4, 2.8, -15.5, 0xfff0d0, .8, 14], [0, 2.6, -11.6, 0xfff0d0, .7, 16],
    [3, -.9, -15.5, 0xffd9a0, .9, 13], [-9.5, -.9, -16, 0xd8e8ff, 1.0, 11], [11.5, -.9, -16.5, 0xffd9a0, .7, 8], [-8, 6.3, -16.5, 0xffd0a0, .9, 11], [6, 6.3, -15.5, 0xfff0d0, .7, 12],
    [16.5, 4, -15.5, 0xff8844, .9, 12]);

  // ---- cameras
  L.cams.push({ id: 0, x: 13.4, y: 5, z: -.6, yaw: Math.atan2(-10, -6), pitch: -.45, sweep: .5, range: 17, name: 'Lobby', floor: 0 });
  L.cams.push({ id: 1, x: 13.5, y: 2.9, z: -13.5, yaw: Math.atan2(-10, -2.2), pitch: -.3, sweep: .25, range: 16, name: 'Staff hall', floor: 0 });
  L.cams.push({ id: 2, x: 8.6, y: -.8, z: -13.5, yaw: Math.atan2(-10, -2), pitch: -.3, sweep: .3, range: 14, name: 'Vault hall', floor: -4 });
  L.cams.push({ id: 3, x: 18.6, y: 3.6, z: -11.5, yaw: Math.atan2(-3.6, -4.5), pitch: -.6, sweep: .2, range: 9, name: 'Alley', floor: 0 });

  // ---- people
  const P = (x, z, y, wait) => ({ x, y: y || 0, z, wait: wait || 0 });
  L.guards.push({ name: 'Officer Kowalski', route: [P(-10, -3, 0, 2), P(10, -3, 0, 2), P(10, -7.5, 0, 1), P(-10, -7.5, 0, 1)] });
  L.guards.push({ name: 'Officer Deluca', route: [P(3.2, -1.6, 0, 99)], face: Math.PI });
  L.guards.push({ name: 'Officer Brandt', route: [P(-5.5, -15.6, 0, 3), P(12.5, -15.6, 0, 3)] });
  L.guards.push({ name: 'Chief Mahoney', route: [P(-11.6, -16.8, 0, 38), P(0, -15.4, 0, 5)], face: -Math.PI / 2, card: 'a' });
  L.guards.push({ name: 'Officer Tate', route: [P(6.5, -15.5, -4, 3), P(-3.5, -15.5, -4, 4), P(6.5, -15.5, -4, 1), P(7, -19, -4, 3)] });
  const civ = (x, z, face, o) => L.civs.push(Object.assign({ x, y: 0, z, face }, o || {}));
  civ(-6, -8.6, Math.PI); civ(2, -8.6, Math.PI); civ(-6, -4.2, 0); civ(6.6, -3.9, Math.PI / 2); civ(12.6, -5, -Math.PI / 2, { sit: true }); civ(-11.5, -1.6, .6);
  civ(-6, -11.6, 0, { teller: true }); civ(2, -11.6, 0, { teller: true });
  civ(-9, -17.9, 0, { manager: true, y: 3.5 });

  // ---- fixed interactions
  const I = (id, type, x, y, z, o) => L.inter.push(Object.assign({ id, type, x, y, z, r: 1.9 }, o || {}));
  for (const k in L.doors) { const d = L.doors[k]; I('door:' + k, 'door', d.x, d.y + 1, d.z, { door: k, r: 1.7 }); }
  I('console', 'console', -12.5, 1, -16.8);
  I('desk', 'desk', -9, 4.4, -16.2, { r: 2 });
  I('reader1', 'reader', -4.6, -2.8, -17.2, { n: 0, r: 1.3 }); I('reader2', 'reader', -4.6, -2.8, -13.9, { n: 1, r: 1.3 });
  I('drill', 'drill', -4.4, -2.8, -15.5, { r: 1.6 });
  [-6, 2].forEach((x, i) => I('till' + i, 'till', x, 1, -10.8, { value: 1800 + i * 400, r: 1.5 }));
  [-12, -8, 12.2].forEach((x, i) => I('till' + (i + 2), 'till', x, 1, -10.8, { value: 1400 + i * 300, r: 1.5 }));
  [[12.6, -18], [12.6, -16], [12.6, -14.2], [11.6, -19], [10.2, -19]].forEach((p, i) => I('box' + i, 'depbox', p[0], -3, p[1], { value: 6000 + i * 1500, r: 1.5 }));
  I('van', 'van', 4.3, 1, 6.2, { r: 2.6 });
  I('stash0', 'stash', 16.1, 1, -21, { r: 2.2, name: 'dumpster' }); I('stash1', 'stash', -12.4, 1, -19.2, { r: 1.8, name: 'supply locker' });
  L.crate = { x: -10.6, y: -4, z: -14.1, v: 60000 };
  L.vaultBags = [[-12.2, -15.2], [-12.2, -16.4], [-12.2, -17.6], [-10.6, -18.4], [-9, -18.4], [-7.4, -18.4], [-9.5, -16.4], [-9.5, -15.4]];
}

// restricted = anywhere a customer has no business being
export function restricted(x, y, z) {
  return L.restricted ? L.restricted(x, y, z) : false;
}
export const inBank = (x, z) => x > -14 && x < 14 && z < 0 && z > -20;

export function setDoor(id, open) { const d = L.doors[id]; if (d) d.box.off = !!open; }
export function setVault(open) { if (L.vaultDoor) L.vaultDoor.off = !!open; }

// ------------------------------------------------------------------ ground, collision, rays
export function groundAt(x, y, z) {
  let best = -100;
  for (const b of L.boxes) {
    if (!b.walk || x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1) continue;
    if (b.y1 <= y + .6 && b.y1 > best) best = b.y1;
  }
  for (const r of L.ramps) {
    if (x < r.x0 || x > r.x1 || z < r.z0 || z > r.z1) continue;
    const h = r.yA + (r.yB - r.yA) * (x - r.x0) / (r.x1 - r.x0);
    if (h <= y + .6 && h > best) best = h;
  }
  return best;
}
function blockers(y, npc) {
  const lo = y + .6, hi = y + 1.75, out = [];
  for (const b of L.boxes) {
    if (!b.solid || b.off || b.floor || b.y1 <= lo || b.y0 >= hi) continue;
    if (npc && (b.door || b.vault)) continue;
    out.push(b);
  }
  return out;
}
// slide a circle through the level; mutates p {x,y,z}
export function moveCircle(p, dx, dz, r) {
  const bs = blockers(p.y);
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (r * .8)));
  for (let s = 0; s < steps; s++) {
    p.x += dx / steps; p.z += dz / steps;
    for (let it = 0; it < 2; it++) for (const b of bs) {
      const cx = Math.max(b.x0, Math.min(p.x, b.x1)), cz = Math.max(b.z0, Math.min(p.z, b.z1));
      let ox = p.x - cx, oz = p.z - cz; const d2 = ox * ox + oz * oz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-9) { const d = Math.sqrt(d2); p.x = cx + ox / d * r; p.z = cz + oz / d * r; }
      else {                                                           // centre is inside: leave by the nearest face
        const l = p.x - b.x0, rr = b.x1 - p.x, t = p.z - b.z0, bb = b.z1 - p.z, m = Math.min(l, rr, t, bb);
        if (m === l) p.x = b.x0 - r; else if (m === rr) p.x = b.x1 + r; else if (m === t) p.z = b.z0 - r; else p.z = b.z1 + r;
      }
    }
  }
}
export function freeAt(x, y, z, r, npc) {
  for (const b of blockers(y, npc)) {
    const cx = Math.max(b.x0, Math.min(x, b.x1)), cz = Math.max(b.z0, Math.min(z, b.z1));
    if ((x - cx) ** 2 + (z - cz) ** 2 < r * r) return false;
  }
  return true;
}
// segment vs box: returns t in [0,1] of the first hit, or 2 for a miss
function segBox(ax, ay, az, dx, dy, dz, b) {
  let t0 = 0, t1 = 1;
  for (let i = 0; i < 3; i++) {
    const o = i === 0 ? ax : i === 1 ? ay : az, d = i === 0 ? dx : i === 1 ? dy : dz;
    const lo = i === 0 ? b.x0 : i === 1 ? b.y0 : b.z0, hi = i === 0 ? b.x1 : i === 1 ? b.y1 : b.z1;
    if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) return 2; continue; }
    let a = (lo - o) / d, c = (hi - o) / d; if (a > c) { const s = a; a = c; c = s; }
    if (a > t0) t0 = a; if (c < t1) t1 = c; if (t0 > t1) return 2;
  }
  return t0;
}
// what = 'sight' (opaque things), 'shot' (solid, not glass), 'cam' (anything solid)
export function rayT(ax, ay, az, bx, by, bz, what) {
  const dx = bx - ax, dy = by - ay, dz = bz - az; let best = 2;
  for (const b of L.boxes) {
    if (b.off || b.invis) continue;
    if (what === 'sight' ? !b.opaque : what === 'shot' ? (!b.solid || b.glass) : !b.solid) continue;
    const t = segBox(ax, ay, az, dx, dy, dz, b); if (t < best) best = t;
  }
  if (what !== 'sight') for (const r of L.ramps) {                    // stairs stop bullets and cameras (coarse: sampled)
    const lenx = r.x1 - r.x0;
    for (let i = 1; i < 12; i++) {
      const t = i / 12, x = ax + dx * t, z = az + dz * t, y = ay + dy * t;
      if (x < r.x0 || x > r.x1 || z < r.z0 || z > r.z1) continue;
      const h = r.yA + (r.yB - r.yA) * (x - r.x0) / lenx;
      if (y < h && y > h - .6 && t < best) { best = t; break; }
    }
  }
  return best;
}
export const los = (ax, ay, az, bx, by, bz) => rayT(ax, ay, az, bx, by, bz, 'sight') > 1;

// ------------------------------------------------------------------ navigation grid
const NS = .5, NX0 = -39, NZ0 = -24, NW = 157, NH = 95;
const nav = { nodes: [], cell: new Map() };
function buildNav() {
  nav.nodes = []; nav.cell = new Map();
  for (let iz = 0; iz < NH; iz++) for (let ix = 0; ix < NW; ix++) {
    const x = NX0 + ix * NS, z = NZ0 + iz * NS, hs = [];
    for (const b of L.boxes) if (b.walk && x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) hs.push(b.y1);
    for (const r of L.ramps) if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) hs.push(r.yA + (r.yB - r.yA) * (x - r.x0) / (r.x1 - r.x0));
    hs.sort((a, b) => b - a);
    const ids = [];
    let last = 999;
    for (const h of hs) {
      if (last - h < .5) continue; last = h;
      if (!freeAt(x, h, z, .36, true)) continue;
      // head room: no floor slab hanging right above
      let ok = true; for (const b of L.boxes) if (b.floor && x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && b.y0 > h + .1 && b.y0 < h + 1.7) ok = false;
      if (!ok) continue;
      ids.push(nav.nodes.length); nav.nodes.push({ x, y: h, z, ix, iz, nb: [] });
    }
    if (ids.length) nav.cell.set(iz * NW + ix, ids);
  }
  const at = (ix, iz, y) => {
    if (ix < 0 || iz < 0 || ix >= NW || iz >= NH) return -1;
    const ids = nav.cell.get(iz * NW + ix); if (!ids) return -1;
    for (const id of ids) if (Math.abs(nav.nodes[id].y - y) < .45) return id;
    return -1;
  };
  nav.at = at;
  nav.nodes.forEach((n, id) => {
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const m = at(n.ix + dx, n.iz + dz, n.y); if (m >= 0) n.nb.push(m, NS); }
    for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const m = at(n.ix + dx, n.iz + dz, n.y);
      if (m >= 0 && at(n.ix + dx, n.iz, n.y) >= 0 && at(n.ix, n.iz + dz, n.y) >= 0) n.nb.push(m, NS * 1.414);
    }
  });
}
export function nearestNode(x, y, z) {
  const ix = Math.round((x - NX0) / NS), iz = Math.round((z - NZ0) / NS); let best = -1, bd = 1e9;
  for (let r = 0; r <= 4 && best < 0; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
    const ids = nav.cell.get((iz + dz) * NW + ix + dx); if (!ids || ix + dx < 0 || ix + dx >= NW) continue;
    for (const id of ids) { const n = nav.nodes[id], d = (n.x - x) ** 2 + (n.z - z) ** 2 + (n.y - y) ** 2 * 4; if (Math.abs(n.y - y) < 1.6 && d < bd) { bd = d; best = id; } }
  }
  return best;
}
function lineWalk(a, b) {
  const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.ceil(d / .3); let y = a.y;
  for (let i = 1; i < n; i++) {
    const t = i / n, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
    const id = nav.at(Math.round((x - NX0) / NS), Math.round((z - NZ0) / NS), y); if (id < 0) return false;
    y = nav.nodes[id].y;
    if (!freeAt(x, y, z, .34, true)) return false;
  }
  return true;
}
// A* over the grid; returns a smoothed list of {x,y,z} or null
export function findPath(ax, ay, az, bx, by, bz) {
  const s = nearestNode(ax, ay, az), g = nearestNode(bx, by, bz); if (s < 0 || g < 0) return null;
  const N = nav.nodes, G = N[g], cost = new Map([[s, 0]]), from = new Map(), heap = [[0, s]], done = new Set();
  const push = (f, id) => { heap.push([f, id]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { let l = i * 2 + 1, r = l + 1, m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  let found = false, guard = 0;
  while (heap.length && guard++ < 40000) {
    const [, id] = pop(); if (done.has(id)) continue; done.add(id);
    if (id === g) { found = true; break; }
    const n = N[id], c = cost.get(id);
    for (let i = 0; i < n.nb.length; i += 2) {
      const m = n.nb[i], nc = c + n.nb[i + 1];
      if (done.has(m) || (cost.has(m) && cost.get(m) <= nc)) continue;
      cost.set(m, nc); from.set(m, id);
      const M = N[m]; push(nc + Math.hypot(M.x - G.x, M.z - G.z) + Math.abs(M.y - G.y) * 2, m);
    }
  }
  if (!found) return null;
  const raw = []; for (let id = g; id !== undefined; id = from.get(id)) raw.push(N[id]); raw.reverse();
  const out = [raw[0]]; let i = 0;
  while (i < raw.length - 1) {
    let j = Math.min(raw.length - 1, i + 14);
    while (j > i + 1 && !(Math.abs(raw[j].y - raw[i].y) < .01 && lineWalk(raw[i], raw[j]))) j--;
    out.push(raw[j]); i = j;
  }
  return out.map(n => ({ x: n.x, y: n.y, z: n.z }));
}
export const navStats = () => nav.nodes.length;

// ------------------------------------------------------------------ job two: 47th St Fine Jewelers
function jewel() {
  street();
  L.name = '47th St Fine Jewelers'; L.sign = '47th ST FINE JEWELERS'; L.signY = 3.95; L.floors = [['GROUND — showroom, stock room, office', 0]];
  L.restricted = (x, y, z) => x > -14 && x < 14 && z < -8 && z > -14;
  L.lootMark = [-12.6, 1.6, -11];
  L.pins = [[0, 7.3, 6.2, 'VAN', '#5fd38d'], [0, 0, 0, 'FRONT DOOR', '#fff'], [0, 14, -11, 'ALLEY DOOR', '#fff'], [0, 16.1, -21, 'DUMPSTER', '#aaa'], [0, -13, -11, 'OFFICE SAFE', '#5fd38d'], [0, -10, -13.2, 'CAMERA CONSOLE', '#4dc3ff'], [0, 0, -4.5, '8 DISPLAY CASES', '#5fd38d']];
  B(-14, 14, 0, 12, -26, -14.15, 'brick2', { skyline: true });
  F(-14, 14, -8, 0, 0, 'marble'); F(-14, 14, -14, -8, 0, 'tile'); B(-14.3, 14.3, 4.5, 4.8, -14.3, .3, 'roof');
  wallX(0, -14, 14, 0, 4.5, 'stone', [[-12, -2.6, 3.4, .8, 'glass'], [-1.3, 1.3, 2.5], [2.6, 12, 3.4, .8, 'glass']]);
  wallX(-14, -14, 14, 0, 4.5, 'stone'); wallZ(-14, -14, 0, 0, 4.5, 'stone'); wallZ(14, -14, 0, 0, 4.5, 'stone', [[-11.6, -10.4]]);
  door('side', 'z', 14, -11.6, -10.4, 0, { locked: true, name: 'Alley door' });
  wallX(-8, -14, 14, 0, 4.5, 'plaster', [[2, 3.2]]); door('back', 'x', -8, 2, 3.2, 0, { locked: true, name: 'Stock room' });
  wallZ(-6, -14, -8, 0, 4.5, 'plaster', [[-11.6, -10.4]]); door('office', 'z', -6, -11.6, -10.4, 0, { locked: true, name: "Owner's office" });
  L.cases = [[-10, -3], [-6, -3], [6, -3], [10, -3], [-10, -6.4], [-5, -6.4], [6.5, -6.4], [10.5, -6.4]];
  for (const [x, z] of L.cases) { B(x - .8, x + .8, 0, .9, z - .4, z + .4, 'counter', { opaque: false }); B(x - .78, x + .78, .9, 1.25, z - .38, z + .38, 'glass', { opaque: false, glass: true, solid: false }); }
  B(-1.6, 1.6, 0, 1.05, -7.1, -6.5, 'counter', { opaque: false });
  B(-13.7, -12.6, 0, 1.5, -11.6, -10.4, 'vaultdoor');                 // the office safe
  B(-11, -9, 0, 1.1, -13.8, -13.2, 'console'); Mdl('table_medium_long', -8.5, -9.1, 2.2, 1, .8, 0, 0, { stretch: true });
  Mdl('chair_C', -8.5, -10.2, .7, .7, 1, 0, Math.PI, soft); Mdl('rug_oval_A', -10, -11, 3.4, 2.4, .04, 0, 0, soft); Mdl('lamp_standing', -6.5, -13.5, .5, .5, 1.9, 0, 0); Mdl('pictureframe_large_A', -13.8, -9.4, .12, 1.4, 1.1, 1.8, Math.PI / 2, soft);
  Mdl('armchair', -12.9, -1.2, 1, 1, .9, 0, Math.PI / 2); Mdl('armchair', 12.9, -1.2, 1, 1, .9, 0, -Math.PI / 2); Mdl('cactus_medium_A', -13.2, -7.3, .7, .7, 1.4, 0, 0, soft); Mdl('cactus_medium_A', 13.2, -7.3, .7, .7, 1.4, 0, 0, soft);
  Mdl('pictureframe_large_B', -6, -7.82, 1.6, .12, 1.2, 2, 0, soft); Mdl('pictureframe_large_A', 9, -7.82, 1.6, .12, 1.2, 2, 0, soft); Mdl('box_A', 12.6, -9, 1, 1, 1, 0, 0); Mdl('box_B', 11.4, -8.9, .9, .9, .9, 0, .5); Mdl('box_A', 1, -13.3, 1, 1, 1, 0, 0); Mdl('cabinet_medium', -3.5, -13.55, 1.6, .6, 1.1, 0, 0);
  Mdl('shelf_A_big', 5.5, -13.55, 2.6, .6, 2.2, 0, 0, { opaque: true }); Mdl('shelf_A_big', 8.5, -13.55, 2.6, .6, 2.2, 0, 0, { opaque: true }); Mdl('shelf_A_big', 11.5, -13.55, 2.6, .6, 2.2, 0, 0, { opaque: true }); Mdl('shelf_A_big', -5.3, -12.75, .6, 1.6, 2.2, 0, Math.PI / 2, { opaque: true }); Mdl('cabinet_medium_decorated', 7.5, -8.6, 1.6, .6, 1.1, 0, Math.PI);
  for (const x of [-8, 0, 8]) L.lights.push([x, 3.9, -4, 0xfff0d8, 1.2, 16]);
  L.lights.push([4, 3.6, -11, 0xfff0d0, .8, 14], [-10, 3.6, -11, 0xffd0a0, .8, 10], [16.5, 4, -11, 0xff8844, .9, 12]);
  L.cams.push({ id: 0, x: 13.4, y: 3.8, z: -.6, yaw: Math.atan2(-10, -5), pitch: -.4, sweep: .5, range: 16, name: 'Showroom', floor: 0 });
  L.cams.push({ id: 1, x: 13.4, y: 3.4, z: -13.4, yaw: Math.atan2(-10, 2), pitch: -.35, sweep: .3, range: 15, name: 'Stock room', floor: 0 });
  const P = (x, z, wait) => ({ x, y: 0, z, wait: wait || 0 });
  L.guards.push({ name: 'Officer Ruiz', route: [P(-11.5, -1.6, 2), P(11.5, -1.6, 2), P(11.5, -4.8, 1), P(-11.5, -4.8, 1)] });
  L.guards.push({ name: 'Officer Walsh', route: [P(10, -10.6, 6), P(-3, -10.6, 6)], card: 'a' });
  const civ = (x, z, face, o) => L.civs.push(Object.assign({ x, y: 0, z, face }, o || {}));
  civ(-8, -2, Math.PI); civ(5.2, -2, Math.PI); civ(-5.5, -5.4, Math.PI); civ(9, -5.4, Math.PI); civ(0, -7.5, 0, { teller: true }); civ(-8.5, -10.4, Math.PI, { manager: true });
  const I = (id, type, x, y, z, o) => L.inter.push(Object.assign({ id, type, x, y, z, r: 1.9 }, o || {}));
  for (const k in L.doors) { const d = L.doors[k]; I('door:' + k, 'door', d.x, d.y + 1, d.z, { door: k, r: 1.7 }); }
  L.cases.forEach(([x, z], i) => I('case' + i, 'case', x, 1, z, { value: 3200 + (i * 937) % 2600, r: 1.7 }));
  I('till0', 'till', 0, 1, -7.4, { value: 1500, r: 1.5 });
  I('safe', 'safe', -12.4, 1, -11, { r: 1.7 }); I('console', 'console', -10, 1, -12.9);
  I('van', 'van', 4.3, 1, 6.2, { r: 2.6 }); I('stash0', 'stash', 16.1, 1, -21, { r: 2.2, name: 'dumpster' });
  L.vaultBags = []; L.safeBags = [[-11.8, -9.6], [-11.8, -12.4], [-11, -11]];
}

// ------------------------------------------------------------------ job three: the corner bodega
function bodega() {
  street();
  L.name = 'Corner Bodega'; L.sign = '24HR DELI · GROCERY · ATM'; L.signY = 3.15; L.floors = [['GROUND — shop and storage', 0]];
  L.restricted = (x, y, z) => x > -6 && x < 6 && z < -7 && z > -11;
  L.lootMark = [4.6, 1.6, -10];
  L.pins = [[0, 7.3, 6.2, 'VAN', '#5fd38d'], [0, 0, 0, 'FRONT DOOR', '#fff'], [0, 4.2, -10.1, 'FLOOR SAFE', '#5fd38d'], [0, -5.2, -.8, 'ATM', '#5fd38d'], [0, 4.6, -3.9, 'REGISTER', '#5fd38d']];
  B(-14, -6.15, 0, 10, -26, 0, 'brick', { skyline: true }); B(6.15, 14, 0, 11, -26, 0, 'brick3', { skyline: true }); B(-6.15, 6.15, 0, 10, -26, -11.15, 'brick2', { skyline: true });
  F(-6, 6, -11, 0, 0, 'tile'); B(-6.3, 6.3, 3.6, 3.9, -11.3, .3, 'roof');
  wallX(0, -6, 6, 0, 3.6, 'brick', [[-5, -1.6, 2.8, .9, 'glass'], [-1, 1, 2.4], [1.8, 5, 2.8, .9, 'glass']]);
  wallX(-11, -6, 6, 0, 3.6, 'plaster'); wallZ(-6, -11, 0, 0, 3.6, 'plaster'); wallZ(6, -11, 0, 0, 3.6, 'plaster');
  wallX(-7, -6, 6, 0, 3.6, 'plaster', [[-4.6, -3.4]]); door('back', 'x', -7, -4.6, -3.4, 0, { locked: true, name: 'Storage' });
  B(-3.6, -3, 0, 1.7, -5.6, -1.6, 'shelf'); B(-1.2, -.6, 0, 1.7, -5.6, -1.6, 'shelf'); B(-5.85, -5.35, 0, 2.1, -6.6, -1.6, 'cabinet');
  B(2.2, 5.85, 0, 1.05, -3.4, -2.8, 'counter', { opaque: false }); B(-5.85, -5.3, 0, 1.6, -1.2, -.5, 'console');
  B(4.6, 5.7, 0, 1, -10.7, -9.6, 'vaultdoor'); Mdl('box_A', -5.1, -10.3, 1, 1, 1, 0, 0); Mdl('box_B', -3.9, -10.4, 1, 1, .9, 0, .4); Mdl('box_A', -2.7, -10.3, 1, 1, 1, 0, .2); Mdl('box_B', -5, -8.4, .9, .9, .9, 0, 1);
  Mdl('shelf_A_big', 1.5, -10.7, 2.2, .5, 2, 0, 0, { opaque: true }); Mdl('chair_stool', 4.8, -4.6, .5, .5, .7, 0, 0, soft); Mdl('cabinet_small', 5.5, -6.2, .7, 1, 1.1, 0, -Math.PI / 2); Mdl('trash_A', 5.4, -.8, .6, .6, .8, 0, 0); Mdl('pictureframe_medium', 5.82, -4.6, .12, 1, .8, 2, -Math.PI / 2, soft);
  L.lights.push([0, 3.2, -3.5, 0xe8f0ff, 1.3, 12], [0, 3.2, -9, 0xffe0b0, .8, 8]);
  L.cams.push({ id: 0, x: 5.6, y: 3.2, z: -.5, yaw: Math.atan2(-6, -5), pitch: -.45, sweep: .4, range: 11, name: 'Shop', floor: 0 });
  L.guards.push({ look: 'm-casual', name: 'Mr. Park', route: [{ x: 4, y: 0, z: -4.4, wait: 99 }], face: 0, card: 'a' });
  const civ = (x, z, face, o) => L.civs.push(Object.assign({ x, y: 0, z, face }, o || {}));
  civ(-2.1, -3.5, 0); civ(.8, -2.2, Math.PI); civ(-4.5, -4.8, -Math.PI / 2); civ(2.8, -4.6, 0, { teller: true });
  const I = (id, type, x, y, z, o) => L.inter.push(Object.assign({ id, type, x, y, z, r: 1.9 }, o || {}));
  for (const k in L.doors) { const d = L.doors[k]; I('door:' + k, 'door', d.x, d.y + 1, d.z, { door: k, r: 1.7 }); }
  I('till0', 'till', 4.9, 1, -3.9, { value: 900, r: 1.5 }); I('atm', 'depbox', -4.9, 1, -.85, { value: 3500, r: 1.5, label: 'Crack the ATM' });
  I('safe', 'safe', 4.1, 1, -10.1, { r: 1.7 }); I('van', 'van', 4.3, 1, 6.2, { r: 2.6 }); I('stash0', 'stash', 16.1, 1, -21, { r: 2.2, name: 'dumpster' });
  L.vaultBags = []; L.safeBags = [[3.2, -9.3], [3, -10.3]];
}

// ------------------------------------------------------------------ job four: the pawn shop
function pawn() {
  street();
  L.name = 'Cash 4 Gold Pawn'; L.sign = 'CASH 4 GOLD · PAWN'; L.signY = 3.45; L.floors = [['GROUND — shop floor and back room', 0]];
  L.restricted = (x, y, z) => x > -8 && x < 8 && z < -8 && z > -13;
  L.lootMark = [6.4, 1.6, -11.6]; L.objSafe = 'Crack the safe in the back room'; L.bagV = 9000;
  L.pins = [[0, 7.3, 6.2, 'VAN', '#5fd38d'], [0, 0, 0, 'FRONT DOOR', '#fff'], [0, 6.4, -11.6, 'BACK-ROOM SAFE', '#5fd38d'], [0, 0, -3.6, '5 DISPLAY CASES', '#5fd38d'], [0, -4, -6.6, 'OWNER (ARMED)', '#ff5a5a']];
  B(-14, -8.15, 0, 10, -26, 0, 'brick3', { skyline: true }); B(8.15, 14, 0, 12, -26, 0, 'brick', { skyline: true }); B(-8.15, 8.15, 0, 10, -26, -13.15, 'brick2', { skyline: true });
  F(-8, 8, -13, 0, 0, 'wood'); B(-8.3, 8.3, 3.9, 4.2, -13.3, .3, 'roof');
  wallX(0, -8, 8, 0, 3.9, 'brick', [[-7, -1.8, 3, .9, 'glass'], [-1.1, 1.1, 2.4], [1.8, 7, 3, .9, 'glass']]);
  wallX(-13, -8, 8, 0, 3.9, 'plaster'); wallZ(-8, -13, 0, 0, 3.9, 'plaster'); wallZ(8, -13, 0, 0, 3.9, 'plaster');
  wallX(-8, -8, 8, 0, 3.9, 'plaster', [[3.4, 4.6]]); door('back', 'x', -8, 3.4, 4.6, 0, { locked: true, name: 'Back room' });
  L.cases = [[-5.5, -2.6], [-2, -2.6], [2, -2.6], [5.5, -2.6], [5.6, -5.4]];
  for (const [x, z] of L.cases) { B(x - .8, x + .8, 0, .9, z - .4, z + .4, 'counter', { opaque: false }); B(x - .78, x + .78, .9, 1.25, z - .38, z + .38, 'glass', { opaque: false, glass: true, solid: false }); }
  B(-6.5, -1, 0, 1.05, -6.1, -5.5, 'counter', { opaque: false }); B(-7.8, -7.2, 0, 2.2, -7.6, -1.2, 'shelf');
  B(5.9, 7.2, 0, 1.4, -12.3, -11, 'vaultdoor'); Mdl('shelf_A_big', -6.4, -12.7, 2.4, .55, 2, 0, 0, { opaque: true }); Mdl('shelf_A_big', -3.9, -12.7, 2.4, .55, 2, 0, 0, { opaque: true }); Mdl('table_medium', -.8, -10.5, 1.6, 1, .8, 0, 0); Mdl('chair_B', -.8, -11.5, .6, .6, 1, 0, Math.PI, soft);
  Mdl('couch', 1.8, -12.5, 2.2, .9, .9, 0, 0); Mdl('box_A', -7.3, -9, 1, 1, 1, 0, 0); Mdl('box_B', -7.3, -10.1, .9, .9, .9, 0, .6); Mdl('lamp_standing', 3.2, -8.5, .5, .5, 1.9, 0, 0);
  Mdl('armchair', 7.2, -7.2, 1, 1, .9, 0, -Math.PI / 2); Mdl('cabinet_medium_decorated', .8, -7.65, 1.6, .6, 1.1, 0, 0); Mdl('pictureframe_large_A', -4, -7.82, 1.5, .12, 1.1, 2.1, 0, soft); Mdl('rug_rectangle_A', 0, -3.6, 3, 5, .04, 0, Math.PI / 2, soft); Mdl('cactus_small_A', 7.4, -.7, .5, .5, .8, 0, 0, soft);
  L.lights.push([-3.5, 3.4, -4, 0xffe2b0, 1.1, 13], [3.5, 3.4, -4, 0xffe2b0, 1.1, 13], [0, 3.4, -10.6, 0xffd0a0, .8, 10]);
  L.cams.push({ id: 0, x: 7.5, y: 3.5, z: -.5, yaw: Math.atan2(-8, -5), pitch: -.45, sweep: .45, range: 12, name: 'Shop', floor: 0 });
  L.guards.push({ look: 'm-beach', name: 'Sal Moretti', route: [{ x: -4, y: 0, z: -6.9, wait: 99 }], face: 0 });
  L.guards.push({ name: 'Officer Greer', route: [{ x: 3, y: 0, z: -10.2, wait: 5 }, { x: -5.5, y: 0, z: -10.2, wait: 5 }], card: 'a' });
  const civ = (x, z, face, o) => L.civs.push(Object.assign({ x, y: 0, z, face }, o || {}));
  civ(-2, -3.6, Math.PI); civ(4.2, -3.8, Math.PI / 2); civ(-6, -4.2, -Math.PI / 2);
  const I = (id, type, x, y, z, o) => L.inter.push(Object.assign({ id, type, x, y, z, r: 1.9 }, o || {}));
  for (const k in L.doors) { const d = L.doors[k]; I('door:' + k, 'door', d.x, d.y + 1, d.z, { door: k, r: 1.7 }); }
  L.cases.forEach(([x, z], i) => I('case' + i, 'case', x, 1, z, { value: 1600 + (i * 613) % 1500, r: 1.7 }));
  I('till0', 'till', -2.2, 1, -6.6, { value: 1100, r: 1.5 });
  I('safe', 'safe', 5.4, 1, -11.6, { r: 1.7 }); I('van', 'van', 4.3, 1, 6.2, { r: 2.6 }); I('stash0', 'stash', 16.1, 1, -21, { r: 2.2, name: 'dumpster' });
  L.vaultBags = []; L.safeBags = [[4.6, -10.4], [4.4, -12.2], [3.6, -11.4]];
}
// ------------------------------------------------------------------ job five: the armored truck (a street ambush)
function truck() {
  street();
  L.name = 'Armored Truck'; L.sign = ''; L.floors = [['GANSEVOORT ST — the loading dock', 0]];
  L.restricted = (x, y, z) => x > -26 && x < -11 && z > 7 && z < 14;
  L.lootMark = [-13.4, 1.6, 10.75]; L.objSafe = "Crack the truck's rear doors"; L.bagV = 14000; L.waveFirst = 14; L.objLoose = 'Three couriers guard the truck — drop them quietly or hit them hard';
  L.pins = [[0, 7.3, 6.2, 'VAN', '#5fd38d'], [0, -14.2, 10.75, 'REAR DOORS · 3 crates', '#5fd38d']];
  B(-14, 14, 0, 14, -26, 0, 'brick2', { skyline: true });
  L.boxes = L.boxes.filter(b => !b.kerb);                    // clear the kerb for the truck
  B(-22.5, -15, 0, 2.7, 9.6, 11.9, 'dumpster', { car: true });        // the truck body
  B(-24.6, -22.5, 0, 2.1, 9.8, 11.7, 'cabinet', { car: true });       // its cab
  Mdl('box_A', -10, 12.9, 1.1, 1.1, 1.1, 0, .2); Mdl('box_B', -11.9, 7.7, 1, 1, .9, 0, .8); Mdl('box_A', -27.5, 12.6, 1.2, 1.2, 1.2, 0, 0); Mdl('box_B', -9.2, 8.4, .9, .9, .9, 0, 0); Mdl('trash_A', -26.5, 7.4, .7, .7, .9, 0, 0);
  L.lights.push([-18, 5.2, 10.7, 0xfff0d0, 1.1, 16]);
  L.guards.push({ name: 'Courier Banks', route: [{ x: -13.6, y: 0, z: 10.8, wait: 99 }], face: Math.PI / 2 });
  L.guards.push({ name: 'Courier Hale', route: [{ x: -16, y: 0, z: 8.6, wait: 4 }, { x: -24, y: 0, z: 8.6, wait: 4 }] });
  L.guards.push({ name: 'Courier Ortiz', route: [{ x: -25.6, y: 0, z: 10.8, wait: 99 }], face: -Math.PI / 2 });
  const I = (id, type, x, y, z, o) => L.inter.push(Object.assign({ id, type, x, y, z, r: 1.9 }, o || {}));
  I('safe', 'safe', -14.4, 1, 10.75, { r: 1.8, label: "Crack the truck's rear doors" }); I('van', 'van', 4.3, 1, 6.2, { r: 2.6 }); I('stash0', 'stash', 16.1, 1, -21, { r: 2.2, name: 'dumpster' });
  L.vaultBags = []; L.safeBags = [[-13.5, 10.1], [-13.5, 11.4], [-12.8, 10.75]];
}

// ------------------------------------------------------------------ job six: the bullion depository (the bank's floor plan, hardened)
function bullion() {
  bank();
  L.name = 'Federal Bullion Depository'; L.sign = 'FEDERAL BULLION DEPOSITORY';
  L.crate = { x: -10.6, y: -4, z: -14.1, v: 70000, n: 6 }; L.vaultBags = L.vaultBags.slice(0, 4); L.waveFirst = 16; L.drillMul = 1.7;
  const P = (x, z, y, wait) => ({ x, y: y || 0, z, wait: wait || 0 });
  L.guards.push({ name: 'Sergeant Voss', route: [P(10, -8, 0, 2), P(-10, -8, 0, 2), P(-10, -2.2, 0, 1), P(10, -2.2, 0, 1)] });
  L.guards.push({ name: 'Officer Lindqvist', route: [P(4, -15.5, 3.5, 4), P(12.6, -15.5, 3.5, 4)] });
  L.cams.push({ id: 4, x: -13.4, y: 5, z: -.6, yaw: Math.atan2(10, -6), pitch: -.45, sweep: .5, range: 17, name: 'West lobby', floor: 0 });
  for (const q of L.pins) if (q[3].startsWith('VAULT')) q[3] = 'VAULT · 4 bags + 6 gold pallets';
}

export const JOB_IDS = ['bodega', 'pawn', 'jewel', 'truck', 'bank', 'bullion'];
export function buildLevel(job) {
  for (const k of ['boxes', 'ramps', 'lights', 'props', 'cams', 'inter', 'guards', 'civs']) L[k] = [];
  L.doors = {}; L.vaultDoor = null; L.crate = null; L.safeBags = null; L.cases = null;
  const def = { jewel, bodega, pawn, truck, bullion }[job] || bank; L.drillMul = 1; L.signY = 0; L.objSafe = L.objLoose = null; L.bagV = 16000; L.waveFirst = 28; def(); L.job = def === bank ? 'bank' : job;
  buildNav();
}
buildLevel('bank');

// SHEISTERS server: serves the game and relays online play inside crews (rooms).
// Each crew has a 4-letter code, one host (who runs the heist simulation) and up to 3 guests.
// Run `node serve.js`, then open the address it prints. No dependencies.
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto'), os = require('os');
const PORT = +process.env.PORT || 5173;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.ico': 'image/x-icon' };

const server = http.createServer((req, res) => {
  let name;
  try { name = path.normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^([\\/])+/, '') || 'index.html'; }
  catch (e) { res.writeHead(400); return res.end(); }
  const file = path.join(__dirname, name);
  if (!file.startsWith(__dirname) || name.split(/[\\/]/).some(p => p.startsWith('.')) || name.startsWith('deploy') || name === 'serve.js') { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
});

const lanAddrs = () => Object.values(os.networkInterfaces()).flat().filter(n => n && n.family === 'IPv4' && !n.internal).map(n => n.address + ':' + PORT);

// ---- minimal WebSocket (text frames) ----
function frame(str) {
  const p = Buffer.from(str), n = p.length; let h;
  if (n < 126) h = Buffer.from([0x81, n]);
  else if (n < 65536) { h = Buffer.alloc(4); h[0] = 0x81; h[1] = 126; h.writeUInt16BE(n, 2); }
  else { h = Buffer.alloc(10); h[0] = 0x81; h[1] = 127; h.writeBigUInt64BE(BigInt(n), 2); }
  return Buffer.concat([h, p]);
}
const send = (sock, obj) => { if (sock && !sock.destroyed) sock.write(frame(typeof obj === 'string' ? obj : JSON.stringify(obj))); };

// ---- crews ----
const rooms = new Map();           // code -> { host, guests: Map(id -> socket) }
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
function newCode() {
  for (;;) {
    let c = ''; for (let i = 0; i < 4; i++) c += LETTERS[crypto.randomInt(LETTERS.length)];
    if (!rooms.has(c)) return c;
  }
}

function onMessage(sock, text) {
  let m; try { m = JSON.parse(text); } catch (e) { return; }
  if (!m || m.t === 'ping') return;
  if (!sock.role) {
    if (m.t === 'host') {
      if (rooms.size >= 200) return send(sock, { t: 'err', msg: 'Server is full. Try again in a bit.' });
      const code = newCode();
      sock.role = 'host'; sock.code = code;
      rooms.set(code, { host: sock, guests: new Map() });
      send(sock, { t: 'role', role: 'host', id: 0, code, addrs: lanAddrs() });
    } else if (m.t === 'join') {
      const code = String(m.code || '').toUpperCase().trim(), room = rooms.get(code);
      if (!room) return send(sock, { t: 'err', msg: 'No crew with code ' + (code || '????') + '.' });
      let id = 1; while (room.guests.has(id)) id++;
      if (id > 3) return send(sock, { t: 'err', msg: 'That crew is full.' });
      sock.role = 'guest'; sock.code = code; sock.id = id; room.guests.set(id, sock);
      send(sock, { t: 'role', role: 'guest', id, code });
      send(room.host, { t: 'peer', id, on: true });
    }
    return;
  }
  const room = rooms.get(sock.code); if (!room) return;
  if (sock.role === 'guest') { m.from = sock.id; send(room.host, m); return; }
  // host -> one guest or everyone
  if (m.to !== undefined) return send(room.guests.get(m.to), text);
  const out = frame(text);
  for (const g of room.guests.values()) {
    if (g.destroyed || (m.t === 'snap' && g.writableLength > 400000)) continue;   // drop snapshots for a lagging guest
    g.write(out);
  }
}
function onClose(sock) {
  if (sock.gone) return; sock.gone = true;
  const room = rooms.get(sock.code); if (!room) return;
  if (sock.role === 'host' && room.host === sock) {
    for (const g of room.guests.values()) { send(g, { t: 'bye' }); g.end(); }
    rooms.delete(sock.code);
  } else if (sock.role === 'guest' && room.guests.get(sock.id) === sock) {
    room.guests.delete(sock.id); send(room.host, { t: 'peer', id: sock.id, on: false });
  }
}

server.on('upgrade', (req, sock) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) return sock.destroy();
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  sock.setNoDelay(true);
  let buf = Buffer.alloc(0), parts = [];
  sock.on('data', d => {
    buf = Buffer.concat([buf, d]);
    for (;;) {
      if (buf.length < 2) return;
      const fin = buf[0] & 0x80, op = buf[0] & 15, masked = buf[1] & 0x80; let len = buf[1] & 127, off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
      if (len > 2 * 1024 * 1024) return sock.destroy();
      const start = off + (masked ? 4 : 0), end = start + len;
      if (buf.length < end) return;
      const pay = Buffer.from(buf.subarray(start, end));
      if (masked) for (let i = 0; i < pay.length; i++) pay[i] ^= buf[off + (i & 3)];
      buf = buf.subarray(end);
      if (op === 8) return sock.end();
      if (op === 9) { sock.write(Buffer.concat([Buffer.from([0x8a, pay.length & 125]), pay.subarray(0, 125)])); continue; }
      if (op === 10) continue;
      parts.push(pay);
      if (fin) { const text = Buffer.concat(parts).toString(); parts = []; onMessage(sock, text); }
    }
  });
  sock.on('close', () => onClose(sock));
  sock.on('error', () => onClose(sock));
});

server.listen(PORT, () => {
  console.log('SHEISTERS is running.');
  console.log('  This computer:      http://localhost:' + PORT);
  for (const a of lanAddrs()) console.log('  Same network (LAN): http://' + a);
});

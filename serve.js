// SHEISTERS server: serves the game and relays online play between one host and up to 3 guests.
// Run `node serve.js`, then open the address it prints. No dependencies.
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto'), os = require('os');
const PORT = +process.env.PORT || 5173;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

const server = http.createServer((req, res) => {
  const name = path.normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^([\\/])+/, '') || 'index.html';
  const file = path.join(__dirname, name);
  if (!file.startsWith(__dirname) || name.startsWith('.')) { res.writeHead(403); return res.end(); }
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

// ---- one crew per server ----
let host = null, nextId = 1;
const guests = new Map();          // id -> socket

function onMessage(sock, text) {
  let m; try { m = JSON.parse(text); } catch (e) { return; }
  if (m.t === 'ping') return;
  if (!sock.role) {
    if (m.t === 'host') {
      if (host) return send(sock, { t: 'err', msg: 'Someone is already hosting on this server — use Join.' });
      sock.role = 'host'; host = sock;
      send(sock, { t: 'role', role: 'host', id: 0, addrs: lanAddrs() });
    } else if (m.t === 'join') {
      if (!host) return send(sock, { t: 'err', msg: 'Nobody is hosting on this server yet.' });
      sock.role = 'guest'; sock.id = nextId++; guests.set(sock.id, sock);
      send(sock, { t: 'role', role: 'guest', id: sock.id });
      send(host, { t: 'peer', id: sock.id, on: true });
    }
    return;
  }
  if (sock.role === 'guest') { m.from = sock.id; send(host, m); return; }
  // host -> one guest or everyone
  if (m.to !== undefined) return send(guests.get(m.to), text);
  const out = frame(text);
  for (const g of guests.values()) {
    if (g.destroyed || (m.t === 'snap' && g.writableLength > 400000)) continue;   // drop snapshots for a lagging guest
    g.write(out);
  }
}
function onClose(sock) {
  if (sock.gone) return; sock.gone = true;
  if (sock.role === 'host' && host === sock) {
    host = null;
    for (const g of guests.values()) { send(g, { t: 'bye' }); g.end(); }
    guests.clear();
  } else if (sock.role === 'guest') {
    guests.delete(sock.id); send(host, { t: 'peer', id: sock.id, on: false });
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

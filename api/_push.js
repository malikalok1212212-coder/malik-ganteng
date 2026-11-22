// Penyimpanan langganan Web Push (Redis) dan pengiriman notifikasi Global Chat.
// mt:push:subs  = hash: id langganan (sha256 endpoint) -> JSON { s:{endpoint,keys}, u:uid, n:nama depan huruf kecil, t }
// mt:push:u:<uid> = set id langganan milik satu akun (batas 5 perangkat, dipakai juga saat hapus akun)
const crypto = require('crypto');
const R = require('./_redis');
const W = require('./_webpush');

const SUBS = 'mt:push:subs', MAXDEV = 5, MAXSEND = 300;
const h16 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 32);
const uidOf = (sub) => h16('push-u-' + sub);
const ukey = (uid) => 'mt:push:u:' + uid;
const first = (n) => String(n || '').trim().split(' ')[0].toLowerCase().slice(0, 40);

async function add(sub, name, s) {
  const uid = uidOf(sub), id = h16(s.endpoint);
  const [has, n] = await R.run([['SISMEMBER', ukey(uid), id], ['SCARD', ukey(uid)]]);
  if (!has && n >= MAXDEV) return { ok: false, error: 'Maksimal ' + MAXDEV + ' perangkat per akun. Matikan push di perangkat lain dulu.' };
  const rec = { s: { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } }, u: uid, n: first(name), t: Date.now() };
  await R.run([['HSET', SUBS, id, JSON.stringify(rec)], ['SADD', ukey(uid), id]]);
  return { ok: true };
}
async function remove(sub, endpoint) {
  const uid = uidOf(sub), id = h16(endpoint);
  await R.run([['HDEL', SUBS, id], ['SREM', ukey(uid), id]]);
}
async function purgeUser(sub) { // hapus akun: buang semua langganan akun itu
  const uid = uidOf(sub);
  const [ids] = await R.run([['SMEMBERS', ukey(uid)]]);
  const cmds = (ids || []).map((i) => ['HDEL', SUBS, i]); cmds.push(['DEL', ukey(uid)]);
  await R.run(cmds);
}
async function mine(sub) {
  const [ids] = await R.run([['SMEMBERS', ukey(uidOf(sub))]]);
  if (!ids || !ids.length) return [];
  const vals = await R.run(ids.map((i) => ['HGET', SUBS, i]));
  return vals.map((v, i) => { try { return { id: ids[i], rec: JSON.parse(v) }; } catch (e) { return null; } }).filter((x) => x && x.rec);
}

async function deliver(list, data, opt) { // list = [{id, rec}] ; langganan mati (404/410) otomatis dibuang
  const dead = [];
  for (let i = 0; i < list.length; i += 25) {
    const part = list.slice(i, i + 25);
    const res = await Promise.all(part.map((x) => W.send(x.rec.s, data, opt)));
    res.forEach((r, j) => { if (r.gone) dead.push(part[j]); });
  }
  if (dead.length) await R.run(dead.flatMap((d) => [['HDEL', SUBS, d.id], ['SREM', ukey(d.rec.u), d.id]])).catch(() => {});
}

// Dipanggil setelah pesan chat tersimpan. Sasaran: @semua (hanya bila msg.all) atau @namaDepan; pengirim sendiri dilewati.
async function notifyChat(msg) {
  if (!W.enabled() || !R.configured() || !msg || !msg.text) return;
  const [vals] = await R.run([['HVALS', SUBS]]);
  const from = uidOf(msg.sub), low = String(msg.text).toLowerCase(), list = [];
  for (const v of vals || []) {
    let rec; try { rec = JSON.parse(v); } catch (e) { continue; }
    if (!rec || rec.u === from) continue;
    if (msg.all || (rec.n && low.includes('@' + rec.n))) list.push({ id: h16(rec.s.endpoint), rec });
    if (list.length >= MAXSEND) break;
  }
  if (!list.length) return;
  const nm = String(msg.name || 'Seseorang').split(' ')[0];
  await deliver(list, { title: msg.all ? nm + ' menandai semua orang' : nm + ' menyebut kamu', body: String(msg.text).slice(0, 90), url: '/#chat', tag: 'mt-chat' });
}

module.exports = { add, remove, purgeUser, mine, deliver, notifyChat, uidOf };

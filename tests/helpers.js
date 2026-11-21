const fake = require('./fake-redis');
process.env.SESSION_SECRET = 'x'.repeat(40);
fake.install();
const mailbox = [];
require.cache[require.resolve('../api/_mail')] = { id: 'm', filename: 'm', loaded: true, exports: { ready: () => true, sendCode: async (to, code, kind) => { mailbox.push({ to, code, kind }); } } };

// Panggil handler seperti Vercel: mengembalikan { status, body, headers }
async function call(handler, { method = 'POST', query = {}, body, headers = {}, cookie } = {}) {
  const out = { status: 200, headers: {}, body: null };
  const req = { method, query, body, headers: { host: 'maliktools.test', origin: 'https://maliktools.test', 'x-real-ip': headers['x-real-ip'] || '1.1.1.' + Math.floor(Math.random() * 250), ...headers, ...(cookie ? { cookie } : {}) }, socket: {} };
  const res = { setHeader: (k, v) => { out.headers[k.toLowerCase()] = v; }, status(c) { out.status = c; return res; }, json(b) { out.body = b; return res; }, end() { return res; } };
  await handler(req, res);
  return out;
}
module.exports = { fake, mailbox, call };

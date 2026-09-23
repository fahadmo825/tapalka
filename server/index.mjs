import { createServer } from 'node:http';
import pg from 'pg';

const { Pool } = pg;
const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }) : null;
const port = Number(process.env.API_PORT || 8787);

async function ensureSchema() {
  if (!pool) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    telegram_id BIGINT PRIMARY KEY,
    balance NUMERIC NOT NULL DEFAULT 0,
    mining_level INT NOT NULL DEFAULT 1,
    last_claim_time BIGINT NOT NULL,
    referral_code TEXT
  )`);
}

function send(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
  response.end(JSON.stringify(body));
}

async function getUser(telegramId) {
  const result = await pool.query('SELECT telegram_id, balance, mining_level, last_claim_time, referral_code FROM users WHERE telegram_id = $1', [telegramId]);
  if (result.rowCount) return result.rows[0];
  const created = await pool.query('INSERT INTO users (telegram_id, last_claim_time, referral_code) VALUES ($1, $2, $3) RETURNING *', [telegramId, Date.now(), String(telegramId)]);
  return created.rows[0];
}

const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') return send(response, 204, {});
  const match = request.url?.match(/^\/api\/mining\/(\d+)(?:\/claim)?$/);
  if (!match || !pool) return send(response, pool ? 404 : 503, { error: 'Mining API unavailable' });
  const telegramId = match[1];
  try {
    const user = await getUser(telegramId);
    if (request.url.endsWith('/claim') && request.method === 'POST') {
      const rate = Number(user.mining_level) * 5;
      const earned = (rate / 3600) * ((Date.now() - Number(user.last_claim_time)) / 1000);
      const updated = await pool.query('UPDATE users SET balance = balance + $1, last_claim_time = $2 WHERE telegram_id = $3 RETURNING *', [earned, Date.now(), telegramId]);
      return send(response, 200, updated.rows[0]);
    }
    return send(response, 200, user);
  } catch (error) {
    return send(response, 500, { error: error instanceof Error ? error.message : 'Database error' });
  }
});

ensureSchema().then(() => server.listen(port, () => console.log(`AGENB API listening on ${port}`))).catch((error) => { console.error(error); process.exit(1); });
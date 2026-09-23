import { createServer } from 'node:http';
import pg from 'pg';

const { Pool } = pg;
const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }) : null;
const port = Number(process.env.API_PORT || 8787);
const REFERRAL_REWARD = 5;
const RATE_PER_HOUR = 0.05;

async function ensureSchema() {
  if (!pool) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    telegram_id BIGINT PRIMARY KEY,
    balance NUMERIC NOT NULL DEFAULT 0,
    unclaimed_balance NUMERIC NOT NULL DEFAULT 0,
    mining_level INT NOT NULL DEFAULT 1,
    last_claim_time BIGINT NOT NULL,
    referral_code TEXT,
    referred_by BIGINT,
    referral_reward NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS unclaimed_balance NUMERIC NOT NULL DEFAULT 0');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by BIGINT');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_reward NUMERIC NOT NULL DEFAULT 0');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()');
}

function send(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type' });
  response.end(JSON.stringify(body));
}

async function readBody(request) {
  let body = '';
  for await (const chunk of request) body += chunk;
  return body ? JSON.parse(body) : {};
}

async function findOrCreateUser(client, telegramId, startParam) {
  const existing = await client.query('SELECT * FROM users WHERE telegram_id = $1 FOR UPDATE', [telegramId]);
  if (existing.rowCount) return existing.rows[0];
  const inviterId = startParam && /^\d+$/.test(String(startParam)) && String(startParam) !== String(telegramId) ? String(startParam) : null;
  const inviter = inviterId ? await client.query('SELECT telegram_id FROM users WHERE telegram_id = $1 FOR UPDATE', [inviterId]) : { rowCount: 0 };
  const created = await client.query(`INSERT INTO users (telegram_id, balance, last_claim_time, referral_code, referred_by)
    VALUES ($1, $2, $3, $4, $5) RETURNING *`, [telegramId, inviter.rowCount ? REFERRAL_REWARD : 0, Date.now(), String(telegramId), inviter.rowCount ? inviterId : null]);
  if (inviter.rowCount) await client.query('UPDATE users SET referral_reward = referral_reward + $1 WHERE telegram_id = $2', [REFERRAL_REWARD, inviterId]);
  return created.rows[0];
}

function serialize(user) {
  return { ...user, telegram_id: String(user.telegram_id), balance: Number(user.balance), unclaimed_balance: Number(user.unclaimed_balance), referral_reward: Number(user.referral_reward) };
}

const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') return send(response, 204, {});
  if (!pool) return send(response, 503, { error: 'Mining API unavailable. Set DATABASE_URL.' });
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  const userId = url.searchParams.get('telegram_id');
  const referralId = url.pathname.match(/^\/api\/referrals\/(\d+)$/)?.[1];

  try {
    if (referralId && request.method === 'GET') {
      const result = await pool.query('SELECT telegram_id, created_at FROM users WHERE referred_by = $1 ORDER BY created_at DESC NULLS LAST', [referralId]);
      const owner = await pool.query('SELECT referral_reward FROM users WHERE telegram_id = $1', [referralId]);
      return send(response, 200, { referrals: result.rows.map((row) => ({ telegram_id: String(row.telegram_id), created_at: row.created_at })), referral_reward: Number(owner.rows[0]?.referral_reward || 0) });
    }
    if (url.pathname === '/api/user' && request.method === 'GET' && userId) {
      const result = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [userId]);
      return send(response, 200, result.rowCount ? serialize(result.rows[0]) : { telegram_id: userId, balance: 0, unclaimed_balance: 0, mining_level: 1, last_claim_time: Date.now(), referral_reward: 0 });
    }
    if (url.pathname === '/api/user' && request.method === 'POST') {
      const body = await readBody(request);
      const telegramId = String(body.telegram_id || '');
      if (!/^\d+$/.test(telegramId)) return send(response, 400, { error: 'telegram_id is required' });
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        let user = await findOrCreateUser(client, telegramId, body.start_param);
        if (body.action === 'claim') {
          const elapsedSeconds = Math.max(0, (Date.now() - Number(user.last_claim_time)) / 1000);
          const earned = Number(user.unclaimed_balance) + (RATE_PER_HOUR * Number(user.mining_level) / 3600) * elapsedSeconds;
          const updated = await client.query('UPDATE users SET balance = balance + $1, unclaimed_balance = 0, last_claim_time = $2 WHERE telegram_id = $3 RETURNING *', [earned, Date.now(), telegramId]);
          user = updated.rows[0];
        }
        await client.query('COMMIT');
        return send(response, 200, serialize(user));
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
    const claimReferral = url.pathname.match(/^\/api\/user\/(\d+)\/referral-claim$/)?.[1];
    if (claimReferral && request.method === 'POST') {
      const result = await pool.query('UPDATE users SET balance = balance + referral_reward, referral_reward = 0 WHERE telegram_id = $1 RETURNING *', [claimReferral]);
      return send(response, 200, result.rowCount ? serialize(result.rows[0]) : { error: 'User not found' });
    }
    return send(response, 404, { error: 'Not found' });
  } catch (error) {
    return send(response, 500, { error: error instanceof Error ? error.message : 'Database error' });
  }
});

ensureSchema().then(() => server.listen(port, () => console.log(`AGEN API listening on ${port}`))).catch((error) => { console.error(error); process.exit(1); });

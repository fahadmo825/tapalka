import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: '.env.local' });
const { Pool } = pg;

export const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : null;

export async function ensureSchema() {
  if (!pool) return;

  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    telegram_id BIGINT PRIMARY KEY,
    username VARCHAR(255),
    balance DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    mining_level INT NOT NULL DEFAULT 1,
    last_claim_time TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    referred_by BIGINT,
    referral_count INT NOT NULL DEFAULT 0,
    unclaimed_balance DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    referral_earned DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    referral_reward DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    referral_code TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);

  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(255)');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by BIGINT');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_count INT NOT NULL DEFAULT 0');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS unclaimed_balance DOUBLE PRECISION NOT NULL DEFAULT 0.0');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_earned DOUBLE PRECISION NOT NULL DEFAULT 0.0');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_reward DOUBLE PRECISION NOT NULL DEFAULT 0.0');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP');

  await pool.query(`DO $$
    BEGIN
      IF (SELECT data_type FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'last_claim_time') = 'bigint' THEN
        ALTER TABLE users ALTER COLUMN last_claim_time DROP DEFAULT;
        ALTER TABLE users ALTER COLUMN last_claim_time TYPE TIMESTAMPTZ USING to_timestamp(last_claim_time / 1000.0);
        ALTER TABLE users ALTER COLUMN last_claim_time SET DEFAULT CURRENT_TIMESTAMP;
      END IF;
    END
  $$`);
}

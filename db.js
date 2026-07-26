// ============================================================
// HCJ-OS Backend — camada de base de dados (Postgres / Supabase)
// ------------------------------------------------------------
// Troca em relação à versão anterior (SQLite local): os dados já não
// vivem dentro do próprio servidor Render — vivem numa base de dados
// Postgres gerida pelo Supabase (gratuita, persistente, independente
// de o servidor reiniciar, adormecer ou fazer novo deploy).
//
// O resto do backend (routes/) fala só com o "pool" exportado aqui,
// usando SQL normal — se um dia quiseres trocar de fornecedor de base
// de dados (Neon, RDS, etc.), só mexes neste ficheiro.
// ============================================================
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    'DATABASE_URL em falta. Define-a no .env (ou nas Environment Variables do Render) ' +
    'com a "Connection string" que o Supabase te dá em Project Settings → Database.'
  );
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false } // o Supabase exige ligação SSL
});

// Cria as tabelas na primeira vez que o servidor arranca (não apaga dados existentes,
// por isso é seguro correr isto sempre no arranque).
async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS organizations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      groq_api_key TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      org_id INTEGER NOT NULL REFERENCES organizations(id),
      name TEXT NOT NULL,
      role_title TEXT,
      permission TEXT NOT NULL DEFAULT 'technician',
      pin_hash TEXT NOT NULL,
      lang TEXT DEFAULT 'pt',
      created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(org_id, name)
    );

    CREATE TABLE IF NOT EXISTS cases (
      id SERIAL PRIMARY KEY,
      org_id INTEGER NOT NULL REFERENCES organizations(id),
      case_code TEXT NOT NULL,
      client TEXT,
      sector TEXT,
      service TEXT,
      risk_hse TEXT,
      priority TEXT,
      technician_id INTEGER REFERENCES users(id),
      status TEXT DEFAULT 'aberto',
      data_json JSONB,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS reports (
      id SERIAL PRIMARY KEY,
      org_id INTEGER NOT NULL REFERENCES organizations(id),
      case_id INTEGER REFERENCES cases(id),
      case_code TEXT,
      client TEXT,
      report_type TEXT,
      lang TEXT DEFAULT 'pt',
      content_json JSONB,
      is_draft_unverified BOOLEAN DEFAULT false,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id SERIAL PRIMARY KEY,
      org_id INTEGER NOT NULL,
      user_id INTEGER,
      action TEXT NOT NULL,
      details TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_users_org ON users(org_id);
    CREATE INDEX IF NOT EXISTS idx_cases_org ON cases(org_id);
    CREATE INDEX IF NOT EXISTS idx_reports_org ON reports(org_id);
    CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_log(org_id);
  `);
}

module.exports = { pool, initSchema };

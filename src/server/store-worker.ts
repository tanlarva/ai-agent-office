import { parentPort, workerData } from 'node:worker_threads';
import { DatabaseSync } from 'node:sqlite';
import type { OfficeEvent, Run, ProjectSession } from '../shared/contracts.js';

const db = new DatabaseSync((workerData as { path: string }).path);
db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
  CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, state TEXT NOT NULL,
    version INTEGER NOT NULL, body TEXT NOT NULL, request_key TEXT UNIQUE, request_hash TEXT);
  CREATE TABLE IF NOT EXISTS events (run_id TEXT NOT NULL, sequence INTEGER NOT NULL, body TEXT NOT NULL,
    PRIMARY KEY(run_id,sequence), FOREIGN KEY(run_id) REFERENCES runs(id));
  CREATE INDEX IF NOT EXISTS runs_created ON runs(created_at DESC,id DESC);`);
db.exec('BEGIN IMMEDIATE');
try {
  if (!db.prepare('PRAGMA table_info(runs)').all().some(column => column.name === 'session_id')) db.exec('ALTER TABLE runs ADD COLUMN session_id TEXT');
  db.exec(`CREATE TABLE IF NOT EXISTS project_sessions (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, body TEXT NOT NULL, request_key TEXT UNIQUE, request_hash TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS sessions_created ON project_sessions(created_at DESC,id DESC);
    CREATE INDEX IF NOT EXISTS runs_session_created ON runs(session_id,created_at DESC,id DESC);
    CREATE TABLE IF NOT EXISTS provider_cooldowns (provider TEXT PRIMARY KEY, next_allowed_at INTEGER NOT NULL, rate_limit_streak INTEGER NOT NULL);
    PRAGMA user_version=3; COMMIT;`);
} catch (error) { db.exec('ROLLBACK'); throw error; }

function execute(op: string, args: Record<string, unknown>): unknown {
  if (op === 'scheduling_get') {
    const row = db.prepare("SELECT next_allowed_at,rate_limit_streak FROM provider_cooldowns WHERE provider='codex'").get();
    return row ? { nextAllowedAt: row.next_allowed_at, rateLimitStreak: row.rate_limit_streak } : null;
  }
  if (op === 'scheduling_save') {
    const value = args.value as { nextAllowedAt: number; rateLimitStreak: number };
    db.prepare("INSERT INTO provider_cooldowns(provider,next_allowed_at,rate_limit_streak) VALUES('codex',?,?) ON CONFLICT(provider) DO UPDATE SET next_allowed_at=excluded.next_allowed_at,rate_limit_streak=excluded.rate_limit_streak").run(value.nextAllowedAt, value.rateLimitStreak);
    return null;
  }
  if (op === 'create') {
    const run = args.run as Run;
    db.prepare('INSERT INTO runs(id,created_at,state,version,body,request_key,request_hash,session_id) VALUES(?,?,?,?,?,?,?,?)')
      .run(run.id, run.createdAt, run.state, run.version, JSON.stringify(run), String(args.key), String(args.hash), run.sessionId ?? null);
    return run;
  }
  if (op === 'save') {
    const run = args.run as Run, event = args.event as OfficeEvent;
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = db.prepare('UPDATE runs SET state=?,version=?,body=? WHERE id=? AND version=?')
        .run(run.state, run.version, JSON.stringify(run), run.id, run.version - 1);
      if (result.changes !== 1) throw new Error('VERSION_CONFLICT');
      db.prepare('INSERT INTO events(run_id,sequence,body) VALUES(?,?,?)').run(run.id, event.sequence, JSON.stringify(event));
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    return null;
  }
  if (op === 'get') return parseRow(db.prepare('SELECT body FROM runs WHERE id=?').get(String(args.id)));
  if (op === 'key') {
    const row = db.prepare('SELECT body,request_hash FROM runs WHERE request_key=?').get(String(args.key));
    return row ? { run: JSON.parse(String(row.body)), hash: row.request_hash } : null;
  }
  if (op === 'list') {
    const cursor = typeof args.cursor === 'string' ? args.cursor : null;
    const sessionId = typeof args.sessionId === 'string' ? args.sessionId : null;
    const rows = db.prepare(`SELECT body FROM runs WHERE (? IS NULL OR session_id=?)
      AND (? IS NULL OR (created_at,id) < (SELECT created_at,id FROM runs WHERE id=?))
      ORDER BY created_at DESC,id DESC LIMIT ?`).all(sessionId, sessionId, cursor, cursor, Number(args.limit));
    return rows.map(parseRow);
  }
  if (op === 'session_get') return parseRow(db.prepare('SELECT body FROM project_sessions WHERE id=?').get(String(args.id)));
  if (op === 'session_key') {
    const row = db.prepare('SELECT body,request_hash FROM project_sessions WHERE request_key=?').get(String(args.key));
    return row ? { session: JSON.parse(String(row.body)), hash: row.request_hash } : null;
  }
  if (op === 'session_create') {
    const session = args.session as ProjectSession;
    db.prepare('INSERT INTO project_sessions(id,created_at,body,request_key,request_hash) VALUES(?,?,?,?,?)')
      .run(session.id, session.createdAt, JSON.stringify(session), String(args.key), String(args.hash));
    return session;
  }
  if (op === 'session_list') {
    const cursor = typeof args.cursor === 'string' ? args.cursor : null;
    return db.prepare(`SELECT body FROM project_sessions WHERE (? IS NULL OR (created_at,id) < (SELECT created_at,id FROM project_sessions WHERE id=?))
      ORDER BY created_at DESC,id DESC LIMIT ?`).all(cursor, cursor, Number(args.limit)).map(parseRow);
  }
  if (op === 'events') return db.prepare('SELECT body FROM events WHERE run_id=? AND sequence>? ORDER BY sequence LIMIT ?')
    .all(String(args.id), Number(args.after), Number(args.limit)).map(parseRow);
  if (op === 'active') return db.prepare("SELECT body FROM runs WHERE state NOT IN ('succeeded','failed','canceled','interrupted')").all().map(parseRow);
  throw new Error('UNKNOWN_OPERATION');
}
function parseRow(row: Record<string, unknown> | undefined): unknown {
  return row ? JSON.parse(String(row.body)) as unknown : null;
}
parentPort?.on('message', (message: { id: number; op: string; args: Record<string, unknown> }) => {
  try { parentPort?.postMessage({ id: message.id, result: execute(message.op, message.args) }); }
  catch (error) { parentPort?.postMessage({ id: message.id, error: error instanceof Error ? error.message : 'DB_ERROR' }); }
});
parentPort?.postMessage({ ready: true });

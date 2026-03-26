/**
 * SQLite database for persisting workspace/agent metadata.
 * Uses bun:sqlite (built-in) with a custom Kysely dialect.
 * DB lives at ~/.clove/clove.db.
 */

import { Database, type SQLQueryBindings } from 'bun:sqlite';
import {
  Kysely,
  SqliteAdapter,
  SqliteIntrospector,
  SqliteQueryCompiler,
  sql,
  type CompiledQuery,
  type DatabaseConnection,
  type Dialect,
  type Driver,
  type QueryResult,
} from 'kysely';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

// ---------------------------------------------------------------------------
// Kysely dialect for bun:sqlite
// ---------------------------------------------------------------------------

class BunSqliteConnection implements DatabaseConnection {
  constructor(private db: Database) {}

  executeQuery<R>(compiledQuery: CompiledQuery): Promise<QueryResult<R>> {
    const { sql: sqlStr, parameters } = compiledQuery;
    const params = parameters as SQLQueryBindings[];
    const isSelect = sqlStr.trimStart().toUpperCase().startsWith('SELECT');

    if (isSelect) {
      const stmt = this.db.prepare(sqlStr);
      const rows = stmt.all(...params) as R[];
      return Promise.resolve({ rows });
    }

    const stmt = this.db.prepare(sqlStr);
    stmt.run(...params);
    return Promise.resolve({ rows: [] as R[] });
  }

  // eslint-disable-next-line require-yield
  async *streamQuery<R>(): AsyncIterableIterator<QueryResult<R>> {
    throw new Error('bun:sqlite streaming not implemented');
  }
}

class BunSqliteDriver implements Driver {
  constructor(private db: Database) {}
  async init(): Promise<void> {}
  async acquireConnection(): Promise<DatabaseConnection> {
    return new BunSqliteConnection(this.db);
  }
  async beginTransaction(): Promise<void> {
    this.db.exec('BEGIN');
  }
  async commitTransaction(): Promise<void> {
    this.db.exec('COMMIT');
  }
  async rollbackTransaction(): Promise<void> {
    this.db.exec('ROLLBACK');
  }
  async releaseConnection(): Promise<void> {}
  async destroy(): Promise<void> {
    this.db.close();
  }
}

class BunSqliteDialect implements Dialect {
  constructor(private db: Database) {}
  createDriver(): Driver { return new BunSqliteDriver(this.db); }
  createQueryCompiler() { return new SqliteQueryCompiler(); }
  createAdapter() { return new SqliteAdapter(); }
  createIntrospector(db: Kysely<unknown>) { return new SqliteIntrospector(db); }
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export interface WorkspaceRow {
  agent_id: string;
  status: 'running' | 'sleeping';
  workspace_path: string;
  branch: string;
  source_repo_type: 'path' | 'url';
  source_repo_value: string;
  main_repo_root: string | null;
  runtime_key: string;
  plugin_key: string;
  prompt: string;
  session_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DatabaseSchema {
  workspaces: WorkspaceRow;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

const CLOVE_DIR = path.join(os.homedir(), '.clove');

export function createDatabase(dbPath?: string): Kysely<DatabaseSchema> {
  const resolvedPath = dbPath ?? path.join(CLOVE_DIR, 'clove.db');
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

  const bunDb = new Database(resolvedPath);
  bunDb.exec('PRAGMA journal_mode = WAL');

  return new Kysely<DatabaseSchema>({ dialect: new BunSqliteDialect(bunDb) });
}

export async function migrateDatabase(db: Kysely<DatabaseSchema>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS workspaces (
      agent_id          TEXT PRIMARY KEY,
      status            TEXT NOT NULL DEFAULT 'running',
      workspace_path    TEXT NOT NULL,
      branch            TEXT NOT NULL,
      source_repo_type  TEXT NOT NULL,
      source_repo_value TEXT NOT NULL,
      main_repo_root    TEXT,
      runtime_key       TEXT NOT NULL DEFAULT 'local',
      plugin_key        TEXT NOT NULL DEFAULT 'cursor',
      prompt            TEXT NOT NULL DEFAULT '',
      session_id        TEXT,
      created_at        TEXT NOT NULL,
      updated_at        TEXT NOT NULL
    )
  `.execute(db);

  // Add session_id column to existing databases created before this migration.
  try {
    await sql`ALTER TABLE workspaces ADD COLUMN session_id TEXT`.execute(db);
  } catch {
    // Column already exists — safe to ignore.
  }
}

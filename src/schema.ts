import type { Database } from "./db";

/** Ordered SQL migrations for agy-ensemble SQLite WAL database. */
export const MIGRATIONS: string[] = [
	`
  CREATE TABLE IF NOT EXISTS project (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    path            TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'archived')),
    time_created    INTEGER NOT NULL,
    time_updated    INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS team (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    project_id      TEXT NOT NULL DEFAULT 'default' REFERENCES project(id) ON DELETE CASCADE,
    lead_session_id TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'archived')),
    delegate        INTEGER NOT NULL DEFAULT 1,
    lead_agent      TEXT,
    time_created    INTEGER NOT NULL,
    time_updated    INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS team_lead_idx ON team(lead_session_id);
  CREATE INDEX IF NOT EXISTS team_status_idx ON team(status);

  CREATE TABLE IF NOT EXISTS team_member (
    team_id          TEXT NOT NULL REFERENCES team(id) ON DELETE CASCADE,
    name             TEXT NOT NULL,
    session_id       TEXT NOT NULL,
    si_id            TEXT,
    agent            TEXT NOT NULL,
    status           TEXT NOT NULL DEFAULT 'ready'
                       CHECK(status IN ('ready', 'busy', 'shutdown_requested', 'shutdown', 'error')),
    execution_status TEXT NOT NULL DEFAULT 'idle'
                       CHECK(execution_status IN ('idle', 'starting', 'running',
                         'cancel_requested', 'cancelling', 'cancelled',
                         'completing', 'completed', 'failed', 'timed_out')),
    workspace_mode   TEXT NOT NULL DEFAULT 'share',
    worktree_dir     TEXT,
    worktree_branch  TEXT,
    preserved_branch TEXT,
    plan_approval    TEXT NOT NULL DEFAULT 'none'
                       CHECK(plan_approval IN ('none', 'pending', 'approved', 'rejected')),
    model            TEXT,
    prompt           TEXT,
    reported_to_lead INTEGER NOT NULL DEFAULT 0,
    time_created     INTEGER NOT NULL,
    time_updated     INTEGER NOT NULL,
    PRIMARY KEY (team_id, name)
  );
  CREATE INDEX IF NOT EXISTS team_member_session_idx ON team_member(session_id);

  CREATE TABLE IF NOT EXISTS team_task (
    id                 TEXT PRIMARY KEY,
    team_id            TEXT NOT NULL REFERENCES team(id) ON DELETE CASCADE,
    si_id              TEXT,
    content            TEXT NOT NULL,
    status             TEXT NOT NULL DEFAULT 'pending'
                         CHECK(status IN ('pending', 'in_progress', 'completed', 'cancelled', 'blocked')),
    priority           TEXT NOT NULL DEFAULT 'medium'
                         CHECK(priority IN ('high', 'medium', 'low')),
    assignee           TEXT,
    depends_on         TEXT,
    files_touched      TEXT,
    est_cost_usd       REAL NOT NULL DEFAULT 0,
    actual_cost_usd    REAL NOT NULL DEFAULT 0,
    est_duration_ms    INTEGER NOT NULL DEFAULT 0,
    actual_duration_ms INTEGER NOT NULL DEFAULT 0,
    time_created       INTEGER NOT NULL,
    time_updated       INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS team_task_team_idx ON team_task(team_id);
  CREATE INDEX IF NOT EXISTS team_task_status_idx ON team_task(team_id, status);

  CREATE TABLE IF NOT EXISTS team_message (
    id            TEXT PRIMARY KEY,
    team_id       TEXT NOT NULL REFERENCES team(id) ON DELETE CASCADE,
    from_name     TEXT NOT NULL,
    to_name       TEXT,
    content       TEXT NOT NULL,
    delivered     INTEGER NOT NULL DEFAULT 0,
    read          INTEGER NOT NULL DEFAULT 0,
    time_created  INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS team_message_team_idx ON team_message(team_id);

  CREATE TABLE IF NOT EXISTS trace_nodes (
    id                 TEXT PRIMARY KEY,
    team_id            TEXT NOT NULL REFERENCES team(id) ON DELETE CASCADE,
    parent_id          TEXT,
    zoom_level         INTEGER NOT NULL CHECK(zoom_level IN (1, 2, 3)),
    node_kind          TEXT NOT NULL,
    label              TEXT NOT NULL,
    agent_name         TEXT,
    si_id              TEXT,
    status             TEXT NOT NULL DEFAULT 'running',
    est_cost_usd       REAL NOT NULL DEFAULT 0,
    actual_cost_usd    REAL NOT NULL DEFAULT 0,
    est_duration_ms    INTEGER NOT NULL DEFAULT 0,
    actual_duration_ms INTEGER NOT NULL DEFAULT 0,
    input_tokens       INTEGER NOT NULL DEFAULT 0,
    output_tokens      INTEGER NOT NULL DEFAULT 0,
    payload_json       TEXT,
    time_started       INTEGER NOT NULL,
    time_completed     INTEGER
  );
  CREATE INDEX IF NOT EXISTS trace_nodes_team_idx ON trace_nodes(team_id, zoom_level);

  CREATE TABLE IF NOT EXISTS trace_edges (
    id            TEXT PRIMARY KEY,
    team_id       TEXT NOT NULL REFERENCES team(id) ON DELETE CASCADE,
    source_id     TEXT NOT NULL,
    target_id     TEXT NOT NULL,
    edge_kind     TEXT NOT NULL,
    label         TEXT,
    time_created  INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS trace_edges_team_idx ON trace_edges(team_id);

  CREATE TABLE IF NOT EXISTS team_learnings (
    id                TEXT PRIMARY KEY,
    team_id           TEXT NOT NULL REFERENCES team(id) ON DELETE CASCADE,
    phase_id          TEXT NOT NULL,
    si_id             TEXT NOT NULL,
    category          TEXT NOT NULL,
    fix_loop_attempts INTEGER NOT NULL DEFAULT 1,
    root_cause        TEXT NOT NULL,
    preventive_rule   TEXT NOT NULL,
    rule_file_created TEXT,
    time_created      INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS cost_time_calibration (
    category            TEXT PRIMARY KEY,
    sample_count        INTEGER NOT NULL DEFAULT 0,
    cost_multiplier     REAL NOT NULL DEFAULT 1.0,
    duration_multiplier REAL NOT NULL DEFAULT 1.0,
    time_updated        INTEGER NOT NULL
  );
  `,
];

/**
 * Apply pending SQLite migrations using PRAGMA user_version.
 */
export function applyMigrations(db: Database): void {
	const row = db.query("PRAGMA user_version").get() as { user_version: number };
	const current = row.user_version;

	for (let i = current; i < MIGRATIONS.length; i++) {
		const migration = MIGRATIONS[i];
		db.exec("BEGIN IMMEDIATE");
		try {
			if (migration) db.exec(migration);
			db.exec(`PRAGMA user_version = ${i + 1}`);
			db.exec("COMMIT");
		} catch (err) {
			db.exec("ROLLBACK");
			throw err;
		}
	}
}

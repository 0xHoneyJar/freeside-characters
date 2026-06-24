-- 0001_surface_config.sql — DB-0 (arrakis-ojm0) · per-world surface copy/template store.
--
-- SHIPS DARK. This table exists so a CM can override per-world onboarding copy
-- WITHOUT a code deploy. The bot reads it via packages/persona-engine/src/onboarding/
-- surface-config.ts (getSurfaceConfig). Until a CM inserts an `enabled = true` row the
-- read-shim returns null and the bot falls through to its code-constant defaults —
-- byte-identical behavior to today.
--
-- WHERE THIS RUNS: the mibera-db (the same Postgres reached via RAILWAY_MIBERA_DATABASE_URL
-- that hosts midi_profiles). This repo has NO migration runner and no prior .sql migrations
-- (state lives in score-mcp / midi_profiles / .run/ jsonl per CLAUDE.md "Don't do: add a
-- database"). This DDL is therefore APPLIED MANUALLY by an operator/CM against that DB, e.g.:
--   psql "$RAILWAY_MIBERA_DATABASE_URL" -f packages/persona-engine/migrations/0001_surface_config.sql
-- It is idempotent (IF NOT EXISTS) so re-running is safe.
--
-- world_id = world_slug (e.g. 'mibera'). surface = '<domain>:<name>' (e.g. 'onboarding:verify').

CREATE TABLE IF NOT EXISTS surface_config (
  world_id      text        NOT NULL,
  surface       text        NOT NULL,
  enabled       boolean     NOT NULL DEFAULT false,
  copy          jsonb       NOT NULL DEFAULT '{}'::jsonb,
  template_json jsonb,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    text,
  PRIMARY KEY (world_id, surface)
);

-- Example (DO NOT RUN unless a CM wants mibera's verify copy live):
--   INSERT INTO surface_config (world_id, surface, enabled, copy, updated_by)
--   VALUES (
--     'mibera',
--     'onboarding:verify',
--     true,
--     '{"title":"verify your wallet","body":"connect your wallet to link it to your discord and unlock the verified role. takes about a minute.","buttonLabel":"verify"}'::jsonb,
--     'cm:<handle>'
--   )
--   ON CONFLICT (world_id, surface) DO UPDATE
--     SET enabled = EXCLUDED.enabled, copy = EXCLUDED.copy,
--         updated_at = now(), updated_by = EXCLUDED.updated_by;

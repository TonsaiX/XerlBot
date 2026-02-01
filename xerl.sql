-- xerl_deploy.sql
-- One-file deploy for Xerl (PostgreSQL)
-- - Create table if not exists
-- - Add missing columns safely
-- - Add constraints safely
-- - Add index
-- Idempotent: safe to run multiple times

BEGIN;

-- 1) Create base table (minimal), then we will ALTER to ensure full schema
CREATE TABLE IF NOT EXISTS guild_configs (
  guild_id TEXT PRIMARY KEY
);

-- 2) Core columns (Welcome / Leave / Alert)
ALTER TABLE guild_configs
  ADD COLUMN IF NOT EXISTS welcome_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS welcome_channel_id TEXT,
  ADD COLUMN IF NOT EXISTS welcome_embed JSONB NOT NULL DEFAULT '{}'::jsonb,

  ADD COLUMN IF NOT EXISTS leave_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS leave_channel_id TEXT,
  ADD COLUMN IF NOT EXISTS leave_embed JSONB NOT NULL DEFAULT '{}'::jsonb,

  ADD COLUMN IF NOT EXISTS alert_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS alert_channel_id TEXT,
  ADD COLUMN IF NOT EXISTS alert_embed JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 3) Auto Role on Join
ALTER TABLE guild_configs
  ADD COLUMN IF NOT EXISTS auto_role_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_role_id TEXT;

-- 4) Anti-spam (Flood)
ALTER TABLE guild_configs
  ADD COLUMN IF NOT EXISTS antispam_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS antispam_scope TEXT NOT NULL DEFAULT 'GUILD',            -- 'GUILD' | 'CHANNELS'
  ADD COLUMN IF NOT EXISTS antispam_channel_ids JSONB NOT NULL DEFAULT '[]'::jsonb, -- ["channelId", ...]
  ADD COLUMN IF NOT EXISTS antispam_window_sec INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS antispam_max_messages INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS antispam_action TEXT NOT NULL DEFAULT 'DELETE',          -- 'DELETE' | 'TIMEOUT' | 'WARN'
  ADD COLUMN IF NOT EXISTS antispam_timeout_sec INTEGER NOT NULL DEFAULT 300;

-- 5) Anti-link
ALTER TABLE guild_configs
  ADD COLUMN IF NOT EXISTS antilink_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS antilink_scope TEXT NOT NULL DEFAULT 'GUILD',             -- 'GUILD' | 'CHANNELS'
  ADD COLUMN IF NOT EXISTS antilink_channel_ids JSONB NOT NULL DEFAULT '[]'::jsonb,  -- ["channelId", ...]
  ADD COLUMN IF NOT EXISTS antilink_allow_domains JSONB NOT NULL DEFAULT '[]'::jsonb,-- ["youtube.com", ...]
  ADD COLUMN IF NOT EXISTS antilink_action TEXT NOT NULL DEFAULT 'DELETE',           -- 'DELETE' | 'TIMEOUT' | 'WARN'
  ADD COLUMN IF NOT EXISTS antilink_timeout_sec INTEGER NOT NULL DEFAULT 300;

-- 6) updated_at
ALTER TABLE guild_configs
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 7) Index
CREATE INDEX IF NOT EXISTS idx_guild_configs_updated_at ON guild_configs (updated_at);

-- 8) Constraints (optional but recommended)
DO $$
BEGIN
  -- antispam scope
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_antispam_scope') THEN
    ALTER TABLE guild_configs
      ADD CONSTRAINT chk_antispam_scope
      CHECK (antispam_scope IN ('GUILD', 'CHANNELS'));
  END IF;

  -- antispam action
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_antispam_action') THEN
    ALTER TABLE guild_configs
      ADD CONSTRAINT chk_antispam_action
      CHECK (antispam_action IN ('DELETE', 'TIMEOUT', 'WARN'));
  END IF;

  -- antilink scope
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_antilink_scope') THEN
    ALTER TABLE guild_configs
      ADD CONSTRAINT chk_antilink_scope
      CHECK (antilink_scope IN ('GUILD', 'CHANNELS'));
  END IF;

  -- antilink action
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_antilink_action') THEN
    ALTER TABLE guild_configs
      ADD CONSTRAINT chk_antilink_action
      CHECK (antilink_action IN ('DELETE', 'TIMEOUT', 'WARN'));
  END IF;
END $$;

COMMIT;

-- Done

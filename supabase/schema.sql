-- BUPulse Database Schema
-- Run this in your Supabase SQL Editor

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  google_id             TEXT UNIQUE NOT NULL,
  email                 TEXT UNIQUE NOT NULL,
  name                  TEXT NOT NULL,
  picture               TEXT,
  role                  TEXT NOT NULL DEFAULT 'student',
  access_token          TEXT,
  refresh_token         TEXT,
  token_expiry          TIMESTAMPTZ,
  notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_logs (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type   TEXT NOT NULL,
  metadata            JSONB NOT NULL DEFAULT '{}',
  sent_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chatbot_conversations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_message  TEXT NOT NULL,
  bot_response  TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS announcement_cache (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id       TEXT NOT NULL,
  course_name     TEXT NOT NULL,
  announcement_text TEXT NOT NULL,
  update_time     TIMESTAMPTZ,
  link            TEXT,
  cached_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

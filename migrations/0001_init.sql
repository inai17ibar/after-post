CREATE TABLE events (
  id            TEXT PRIMARY KEY,
  admin_token   TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  subtitle      TEXT NOT NULL DEFAULT '',
  venue         TEXT NOT NULL DEFAULT '',
  event_date    TEXT NOT NULL DEFAULT '',
  hashtags      TEXT NOT NULL DEFAULT '[]',
  lead_copy     TEXT NOT NULL DEFAULT '',
  description   TEXT NOT NULL DEFAULT '',
  campaign_text TEXT NOT NULL DEFAULT '',
  moments       TEXT NOT NULL DEFAULT '[]',
  mood_tags     TEXT NOT NULL DEFAULT '[]',
  templates     TEXT NOT NULL DEFAULT '[]',
  is_demo       INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE event_logs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id     TEXT NOT NULL REFERENCES events(id),
  session_id   TEXT NOT NULL,
  action       TEXT NOT NULL,
  source       TEXT,
  template_id  TEXT,
  mood_tag     TEXT,
  moment_type  TEXT,
  comment      TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_event_logs_event_action  ON event_logs(event_id, action);
CREATE INDEX idx_event_logs_event_created ON event_logs(event_id, created_at);

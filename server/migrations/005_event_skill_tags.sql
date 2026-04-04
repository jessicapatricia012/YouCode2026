-- Optional skill tags on events (same vocabulary as volunteer_profiles.skills)

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS skill_tags TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_events_skill_tags ON events USING GIN (skill_tags);

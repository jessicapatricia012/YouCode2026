-- ConnectBC / Common Ground — initial schema (PostgreSQL + PostGIS)
-- Run: psql "$DATABASE_URL" -f migrations/001_initial.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TYPE event_type AS ENUM (
  'volunteer',
  'community',
  'donation_drive',
  'job',
  'fundraiser'
);

CREATE TABLE orgs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  website TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES orgs (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  type event_type NOT NULL,
  address TEXT NOT NULL,
  location GEOGRAPHY (Point, 4326) NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  spots_total INTEGER NOT NULL CHECK (spots_total >= 0),
  spots_taken INTEGER NOT NULL DEFAULT 0 CHECK (spots_taken >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (spots_taken <= spots_total)
);

CREATE TABLE signups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  signed_up_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_events_location ON events USING GIST (location);
CREATE INDEX idx_events_org_id ON events (org_id);
CREATE INDEX idx_events_starts_at ON events (starts_at);
CREATE INDEX idx_signups_event_id ON signups (event_id);

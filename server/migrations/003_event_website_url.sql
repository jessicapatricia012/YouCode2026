-- Optional link to event details / registration page (public map + API).
ALTER TABLE events ADD COLUMN IF NOT EXISTS website_url TEXT;

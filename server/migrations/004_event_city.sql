-- BC municipality for geocoding (street + city + BC, Canada).
ALTER TABLE events ADD COLUMN IF NOT EXISTS city TEXT;

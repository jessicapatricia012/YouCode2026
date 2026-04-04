-- Volunteer profiles for users

CREATE TABLE volunteer_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  skills TEXT[], -- array of skills like ['cooking', 'driving', 'first_aid']
  availability TEXT, -- free text for availability, e.g., "Weekends, evenings"
  interests TEXT[], -- array of interests like ['community', 'environment']
  experience TEXT, -- free text for volunteer experience
  contact_preferences TEXT, -- e.g., "Email, Phone"
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE INDEX idx_volunteer_profiles_user_id ON volunteer_profiles (user_id);
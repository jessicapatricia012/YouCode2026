/**
 * Seed orgs + events.
 * Run: npm run seed (from server/) or npm run seed from repo root.
 * DATABASE_URL + migrations required. MAPBOX_TOKEN optional: if missing or invalid,
 * each row uses built-in lat/lng so pins always load.
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from './db.js';
import { buildGeocodeQuery } from './src/geocode.js';

const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN;
let mapboxWarned = false;
const PASSWORD = 'password123';
const BCRYPT_ROUNDS = 10;

const VISITORS = [
  { display_name: 'Jamie Chen', email: 'visitor1@connectbc.demo' },
  { display_name: 'Alex Rivera', email: 'visitor2@connectbc.demo' },
  { display_name: 'Sam Okonkwo', email: 'visitor3@connectbc.demo' },
];

const ORGS = [
  {
    name: 'Greater Vancouver Food Bank',
    email: 'info@gvfb.ca',
    website: 'https://www.foodbank.bc.ca',
    logoUrl: null,
  },
  {
    name: 'United Way British Columbia',
    email: 'contact@uwbc.ca',
    website: 'https://www.uwbc.ca',
    logoUrl: null,
  },
  {
    name: "BC Children's Hospital Foundation",
    email: 'hello@bcchf.ca',
    website: 'https://www.bcchf.ca',
    logoUrl: null,
  },
  {
    name: 'Our Place Society',
    email: 'info@ourplacesociety.com',
    website: 'https://ourplacesociety.com',
    logoUrl: null,
  },
  {
    name: 'Central Okanagan Community Food Bank',
    email: 'help@okanaganfoodbank.org',
    website: 'https://www.foodbank.bc.ca',
    logoUrl: null,
  },
];

/** orgIndex 0–4; address = street only; city = BC municipality; lat/lng = fallback if Mapbox is skipped */
const EVENT_SEED = [
  { orgIx: 0, type: 'volunteer', title: 'Weekend food sort — morning shift', description: 'Sort donations and pack hampers.', address: '8345 Winston St', city: 'Burnaby', lat: 49.2561, lng: -122.9664, dayOffset: 2, hour: 9, spots: 8 },
  { orgIx: 1, type: 'community', title: 'Community garden spring planting', description: 'Help plant seedlings for the season.', address: '298 East 11th Ave', city: 'Vancouver', lat: 49.2612, lng: -123.1014, dayOffset: 5, hour: 10, spots: 15 },
  { orgIx: 2, type: 'donation_drive', title: 'Winter coat & blanket drive', description: 'Drop off gently used coats at the door.', address: '101 West Cordova St', city: 'Vancouver', lat: 49.2839, lng: -123.1065, dayOffset: 1, hour: 11, spots: 40 },
  { orgIx: 1, type: 'job', title: 'Grant writer (contract, hybrid)', description: 'Part-time grant writing support.', address: '4545 Canada Way', city: 'Burnaby', lat: 49.2387, lng: -123.0036, dayOffset: 10, hour: 9, spots: 1 },
  { orgIx: 2, type: 'fundraiser', title: 'Gala auction — setup crew', description: 'Assist with auction setup and guest flow.', address: '938 West 28th Ave', city: 'Vancouver', lat: 49.2473, lng: -123.1216, dayOffset: 14, hour: 16, spots: 12 },
  { orgIx: 0, type: 'volunteer', title: 'Neighbourhood cleanup — Trout Lake', description: 'Litter pickup and sorting.', address: '3360 Victoria Dr', city: 'Vancouver', lat: 49.255, lng: -123.0656, dayOffset: 7, hour: 9, spots: 25 },
  { orgIx: 1, type: 'community', title: 'Newcomer welcome picnic', description: 'Welcome families and share resources.', address: '2610 Victoria Dr', city: 'Vancouver', lat: 49.2615, lng: -123.0698, dayOffset: 18, hour: 12, spots: 60 },
  { orgIx: 3, type: 'donation_drive', title: 'School supply drive — Metrotown', description: 'Backpack and supply collection.', address: '4700 Kingsway', city: 'Burnaby', lat: 49.2256, lng: -123.0031, dayOffset: 12, hour: 10, spots: 200 },
  { orgIx: 1, type: 'job', title: 'Fundraising coordinator (part-time)', description: 'Support campaign logistics.', address: '909 Main St', city: 'Vancouver', lat: 49.2789, lng: -123.0994, dayOffset: 8, hour: 8, spots: 2 },
  { orgIx: 2, type: 'volunteer', title: 'Charity run water station', description: 'Hand out water and cheer runners.', address: '595 West 8th Ave', city: 'Vancouver', lat: 49.2634, lng: -123.1241, dayOffset: 22, hour: 7, spots: 30 },
  { orgIx: 0, type: 'community', title: 'Seniors tech help drop-in', description: 'One-on-one device help.', address: '4908 Hastings St', city: 'Burnaby', lat: 49.2808, lng: -123.0236, dayOffset: 4, hour: 13, spots: 6 },
  { orgIx: 2, type: 'fundraiser', title: 'Spring plant sale', description: 'Annual fundraising plant sale.', address: '4600 Cambie St', city: 'Vancouver', lat: 49.2415, lng: -123.1168, dayOffset: 20, hour: 10, spots: 500 },
  { orgIx: 1, type: 'volunteer', title: 'Blood donor clinic greeter', description: 'Welcome donors and direct flow.', address: '4750 Oak St', city: 'Vancouver', lat: 49.2451, lng: -123.1287, dayOffset: 3, hour: 8, spots: 4 },
  { orgIx: 0, type: 'donation_drive', title: 'Diaper & formula collection', description: 'Essentials for families in need.', address: '1830 Pandora St', city: 'Vancouver', lat: 49.2812, lng: -123.0678, dayOffset: 9, hour: 9, spots: 0 },
  { orgIx: 1, type: 'job', title: 'Youth program facilitator', description: 'After-school programming support.', address: '4338 Hastings St', city: 'Burnaby', lat: 49.2811, lng: -123.0115, dayOffset: 11, hour: 9, spots: 3 },
  { orgIx: 3, type: 'community', title: 'Downtown community breakfast', description: 'Serve breakfast and connect with guests.', address: '919 Pandora Ave', city: 'Victoria', lat: 48.4263, lng: -123.3581, dayOffset: 6, hour: 7, spots: 10 },
  { orgIx: 3, type: 'volunteer', title: 'Shoreline restoration — Beacon Hill', description: 'Native planting along the shore.', address: '100 Cook St', city: 'Victoria', lat: 48.4112, lng: -123.3514, dayOffset: 15, hour: 10, spots: 18 },
  { orgIx: 2, type: 'fundraiser', title: 'Heritage hall trivia night', description: 'Trivia fundraiser for housing programs.', address: '1415 Broad St', city: 'Victoria', lat: 48.428, lng: -123.3651, dayOffset: 25, hour: 18, spots: 80 },
  { orgIx: 4, type: 'volunteer', title: 'Food bank hamper packing', description: 'Pack weekly hampers for families.', address: '201 Beaver Lake Rd', city: 'Kelowna', lat: 49.8956, lng: -119.4946, dayOffset: 5, hour: 13, spots: 14 },
  { orgIx: 4, type: 'community', title: 'Earth Day community fair', description: 'Booths, kids’ activities, and watershed info.', address: '1360 Water St', city: 'Kelowna', lat: 49.8918, lng: -119.496, dayOffset: 28, hour: 11, spots: 120 },
];

async function resolveCoords(ev) {
  const fallback = { lng: ev.lng, lat: ev.lat };
  const token = MAPBOX_TOKEN?.trim();
  if (!token || token === 'your_token_here') {
    return { ...fallback, source: 'fallback' };
  }
  try {
    const q = buildGeocodeQuery(ev.address, ev.city);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?limit=1&access_token=${token}`;
    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${res.status}: ${text.slice(0, 120)}`);
    }
    const data = await res.json();
    const feature = data.features?.[0];
    if (!feature?.center) throw new Error('no features');
    const [lng, lat] = feature.center;
    return { lng, lat, source: 'mapbox' };
  } catch (err) {
    if (!mapboxWarned) {
      console.warn(
        `Mapbox geocoding failed (${err.message}). Using built-in coordinates for all events.`
      );
      mapboxWarned = true;
    }
    return { ...fallback, source: 'fallback' };
  }
}

function startsAtFromOffset(dayOffset, hour) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function endsAt(start) {
  const e = new Date(start);
  e.setHours(e.getHours() + 2);
  return e;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is missing. Set it in server/.env (see server/.env.example).');
    process.exit(1);
  }

  console.log('Truncating existing data…');
  await pool.query('TRUNCATE TABLE orgs CASCADE');
  await pool.query('TRUNCATE TABLE users CASCADE');

  const hash = await bcrypt.hash(PASSWORD, BCRYPT_ROUNDS);
  const orgIds = [];

  console.log('Inserting visitor accounts (password: password123)…');
  for (const v of VISITORS) {
    await pool.query(
      `INSERT INTO users (display_name, email, password_hash) VALUES ($1, $2, $3)`,
      [v.display_name, v.email, hash]
    );
    console.log(`  ${v.display_name} <${v.email}>`);
  }

  console.log('Inserting orgs (password for all: password123)…');
  for (const o of ORGS) {
    const { rows } = await pool.query(
      `INSERT INTO orgs (name, email, password_hash, website, logo_url)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [o.name, o.email, hash, o.website, o.logoUrl]
    );
    orgIds.push(rows[0].id);
    console.log(`  ${o.name} <${o.email}>`);
  }

  console.log('Inserting 20 events (Mapbox when token valid; else built-in coordinates)…');
  let mapboxUsed = 0;
  for (let i = 0; i < EVENT_SEED.length; i++) {
    const ev = EVENT_SEED[i];
    const { lng, lat, source } = await resolveCoords(ev);
    if (source === 'mapbox') mapboxUsed += 1;
    const starts = startsAtFromOffset(ev.dayOffset, ev.hour);
    const ends = endsAt(starts);
    const orgId = orgIds[ev.orgIx % orgIds.length];

    await pool.query(
      `INSERT INTO events (
        org_id, title, description, type, address, city, location,
        starts_at, ends_at, spots_total, spots_taken, is_active, website_url
      ) VALUES (
        $1, $2, $3, $4::event_type, $5, $6,
        ST_SetSRID(ST_MakePoint($7, $8), 4326)::geography,
        $9, $10, $11, 0, true, NULL
      )`,
      [
        orgId,
        ev.title,
        ev.description,
        ev.type,
        ev.address,
        ev.city,
        lng,
        lat,
        starts.toISOString(),
        ends.toISOString(),
        ev.spots,
      ]
    );
    console.log(`  [${i + 1}/20] ${ev.title} (${source})`);
    if (source === 'mapbox') await new Promise((r) => setTimeout(r, 110));
  }
  if (mapboxUsed === 0) {
    console.log('(No Mapbox geocodes used — set MAPBOX_TOKEN for live geocoding next time.)');
  }

  console.log('Done.');
  await pool.end();
}

main().catch((err) => {
  const refused =
    err?.code === 'ECONNREFUSED' ||
    err?.cause?.code === 'ECONNREFUSED' ||
    (Array.isArray(err?.errors) && err.errors.some((e) => e.code === 'ECONNREFUSED'));
  if (refused) {
    console.error(
      '\nCould not connect to PostgreSQL (connection refused).\n\n' +
        'Start a database on the host/port in DATABASE_URL, for example from the repo root:\n' +
        '  docker compose up -d\n\n' +
        'Then apply migrations (server/migrations/*.sql) and run seed again.\n' +
        '(MAPBOX_TOKEN is optional; seed uses fallback coordinates without it.)\n'
    );
  } else {
    console.error(err);
  }
  process.exit(1);
});

/**
 * Seed orgs + events (Mapbox geocoding for coordinates).
 * Run from server directory: npm run seed
 * Requires: DATABASE_URL, MAPBOX_TOKEN, migration applied.
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from './db.js';

const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN;
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

/** orgIndex 0–4, dayOffset from today, hour local */
const EVENT_SEED = [
  { orgIx: 0, type: 'volunteer', title: 'Weekend food sort — morning shift', description: 'Sort donations and pack hampers.', address: '8345 Winston St, Burnaby, BC V5A 2H5', dayOffset: 2, hour: 9, spots: 8 },
  { orgIx: 1, type: 'community', title: 'Community garden spring planting', description: 'Help plant seedlings for the season.', address: '298 East 11th Ave, Vancouver, BC V5T 2C3', dayOffset: 5, hour: 10, spots: 15 },
  { orgIx: 2, type: 'donation_drive', title: 'Winter coat & blanket drive', description: 'Drop off gently used coats at the door.', address: '101 West Cordova St, Vancouver, BC V6B 1E1', dayOffset: 1, hour: 11, spots: 40 },
  { orgIx: 1, type: 'job', title: 'Grant writer (contract, hybrid)', description: 'Part-time grant writing support.', address: '4545 Canada Way, Burnaby, BC V5G 4T9', dayOffset: 10, hour: 9, spots: 1 },
  { orgIx: 2, type: 'fundraiser', title: 'Gala auction — setup crew', description: 'Assist with auction setup and guest flow.', address: '938 West 28th Ave, Vancouver, BC V5Z 4H4', dayOffset: 14, hour: 16, spots: 12 },
  { orgIx: 0, type: 'volunteer', title: 'Neighbourhood cleanup — Trout Lake', description: 'Litter pickup and sorting.', address: '3360 Victoria Dr, Vancouver, BC V5N 4M4', dayOffset: 7, hour: 9, spots: 25 },
  { orgIx: 1, type: 'community', title: 'Newcomer welcome picnic', description: 'Welcome families and share resources.', address: '2610 Victoria Dr, Vancouver, BC V5N 4L2', dayOffset: 18, hour: 12, spots: 60 },
  { orgIx: 3, type: 'donation_drive', title: 'School supply drive — Metrotown', description: 'Backpack and supply collection.', address: '4700 Kingsway, Burnaby, BC V5H 4M2', dayOffset: 12, hour: 10, spots: 200 },
  { orgIx: 1, type: 'job', title: 'Fundraising coordinator (part-time)', description: 'Support campaign logistics.', address: '909 Main St, Vancouver, BC V6A 2W1', dayOffset: 8, hour: 8, spots: 2 },
  { orgIx: 2, type: 'volunteer', title: 'Charity run water station', description: 'Hand out water and cheer runners.', address: '595 West 8th Ave, Vancouver, BC V5Z 1C6', dayOffset: 22, hour: 7, spots: 30 },
  { orgIx: 0, type: 'community', title: 'Seniors tech help drop-in', description: 'One-on-one device help.', address: '4908 Hastings St, Burnaby, BC V5B 1R6', dayOffset: 4, hour: 13, spots: 6 },
  { orgIx: 2, type: 'fundraiser', title: 'Spring plant sale', description: 'Annual fundraising plant sale.', address: '4600 Cambie St, Vancouver, BC V5Z 2Z1', dayOffset: 20, hour: 10, spots: 500 },
  { orgIx: 1, type: 'volunteer', title: 'Blood donor clinic greeter', description: 'Welcome donors and direct flow.', address: '4750 Oak St, Vancouver, BC V6H 2N9', dayOffset: 3, hour: 8, spots: 4 },
  { orgIx: 0, type: 'donation_drive', title: 'Diaper & formula collection', description: 'Essentials for families in need.', address: '1830 Pandora St, Vancouver, BC V5L 1M8', dayOffset: 9, hour: 9, spots: 0 },
  { orgIx: 1, type: 'job', title: 'Youth program facilitator', description: 'After-school programming support.', address: '4338 Hastings St, Burnaby, BC V5C 2J9', dayOffset: 11, hour: 9, spots: 3 },
  { orgIx: 3, type: 'community', title: 'Downtown community breakfast', description: 'Serve breakfast and connect with guests.', address: '919 Pandora Ave, Victoria, BC V8W 1N6', dayOffset: 6, hour: 7, spots: 10 },
  { orgIx: 3, type: 'volunteer', title: 'Shoreline restoration — Beacon Hill', description: 'Native planting along the shore.', address: '100 Cook St, Victoria, BC V8V 3W8', dayOffset: 15, hour: 10, spots: 18 },
  { orgIx: 2, type: 'fundraiser', title: 'Heritage hall trivia night', description: 'Trivia fundraiser for housing programs.', address: '1415 Broad St, Victoria, BC V8W 2B2', dayOffset: 25, hour: 18, spots: 80 },
  { orgIx: 4, type: 'volunteer', title: 'Food bank hamper packing', description: 'Pack weekly hampers for families.', address: '201 Beaver Lake Rd, Kelowna, BC V1Y 6T4', dayOffset: 5, hour: 13, spots: 14 },
  { orgIx: 4, type: 'community', title: 'Earth Day community fair', description: 'Booths, kids’ activities, and watershed info.', address: '1360 Water St, Kelowna, BC V1Y 9P3', dayOffset: 28, hour: 11, spots: 120 },
];

async function geocode(address) {
  if (!MAPBOX_TOKEN || MAPBOX_TOKEN === 'your_token_here') {
    throw new Error('Set MAPBOX_TOKEN in server/.env to a valid Mapbox secret token for geocoding.');
  }
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?limit=1&access_token=${MAPBOX_TOKEN}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mapbox geocoding failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  const feature = data.features?.[0];
  if (!feature?.center) {
    throw new Error(`No coordinates for: ${address}`);
  }
  const [lng, lat] = feature.center;
  return { lng, lat };
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

  console.log('Geocoding and inserting 20 events…');
  for (let i = 0; i < EVENT_SEED.length; i++) {
    const ev = EVENT_SEED[i];
    const { lng, lat } = await geocode(ev.address);
    const starts = startsAtFromOffset(ev.dayOffset, ev.hour);
    const ends = endsAt(starts);
    const orgId = orgIds[ev.orgIx % orgIds.length];

    await pool.query(
      `INSERT INTO events (
        org_id, title, description, type, address, location,
        starts_at, ends_at, spots_total, spots_taken, is_active
      ) VALUES (
        $1, $2, $3, $4::event_type, $5,
        ST_SetSRID(ST_MakePoint($6, $7), 4326)::geography,
        $8, $9, $10, 0, true
      )`,
      [
        orgId,
        ev.title,
        ev.description,
        ev.type,
        ev.address,
        lng,
        lat,
        starts.toISOString(),
        ends.toISOString(),
        ev.spots,
      ]
    );
    console.log(`  [${i + 1}/20] ${ev.title}`);
    await new Promise((r) => setTimeout(r, 110));
  }

  console.log('Done.');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

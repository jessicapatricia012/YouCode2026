import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { pool } from './db.js';

const migrationsDir = path.join(process.cwd(), 'migrations');

async function runMigrations() {
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');
    console.log(`\nRunning ${file}...`);
    try {
      await pool.query(sql);
      console.log(`✓ ${file} completed`);
    } catch (err) {
      console.error(`✗ ${file} failed:`, err.message);
      process.exit(1);
    }
  }
  console.log('\n✓ All migrations completed!');
  await pool.end();
}

runMigrations().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});

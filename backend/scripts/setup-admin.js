// Emergency/server-owner recovery only. Normal handover does NOT use this script.
// It creates or updates an administrator from backend/.env if the institution has lost all admin access.
// Safe to repeat. It does not alter books, loans, students or teachers.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const bcrypt = require('bcryptjs');
const { pool } = require('../src/config/db');
const { checkPassword } = require('../src/utils/http');

const text = (value) => String(value || '').trim();

async function main() {
  const name = text(process.env.INITIAL_ADMIN_NAME);
  const email = text(process.env.INITIAL_ADMIN_EMAIL).toLowerCase();
  const idNo = text(process.env.INITIAL_ADMIN_ID);
  const password = String(process.env.INITIAL_ADMIN_PASSWORD || '');

  if (name.length < 2) throw new Error('Set INITIAL_ADMIN_NAME in backend/.env.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Set INITIAL_ADMIN_EMAIL to the librarian\'s real email address.');
  if (!idNo) throw new Error('Set INITIAL_ADMIN_ID in backend/.env (for example LIB-001).');
  checkPassword(password);

  const [byEmail] = await pool.query('SELECT user_id, email, identification_no FROM users WHERE email = ? LIMIT 1', [email]);
  const [byId] = await pool.query('SELECT user_id, email, identification_no FROM users WHERE identification_no = ? LIMIT 1', [idNo]);

  if (byEmail[0] && byId[0] && byEmail[0].user_id !== byId[0].user_id) {
    throw new Error('The chosen email and identification number belong to two different existing accounts. Choose different values.');
  }

  const existing = byEmail[0] || byId[0];
  const hash = await bcrypt.hash(password, 10);
  if (existing) {
    await pool.query(
      `UPDATE users SET name = ?, email = ?, identification_no = ?, password = ?, role = 'admin', status = 'active' WHERE user_id = ?`,
      [name, email, idNo, hash, existing.user_id]
    );
    console.log(`Administrator updated: ${email}`);
  } else {
    await pool.query(
      `INSERT INTO users (name, email, password, identification_no, role, status) VALUES (?, ?, ?, ?, 'admin', 'active')`,
      [name, email, hash, idNo]
    );
    console.log(`Administrator created: ${email}`);
  }
  console.log('Use the "Administrator sign in" link on the home sign-in page.');
  await pool.end();
}

main().catch(async (err) => {
  console.error('\nAdmin setup failed: ' + err.message + '\n');
  try { await pool.end(); } catch {}
  process.exit(1);
});

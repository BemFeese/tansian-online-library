// Web-Based Library Book Management System: API and web server.
// The same server also serves the frontend, so the browser only ever talks to one address.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  console.error('\nJWT_SECRET is missing or too short.');
  console.error('Copy backend/.env.example to backend/.env and set JWT_SECRET to 16 or more random characters.\n');
  process.exit(1);
}

if (process.env.NODE_ENV === 'production' && process.env.JWT_SECRET.startsWith('change-this')) {
  console.error('\nJWT_SECRET is still the example value. Set your own long random text in backend/.env before going live.\n');
  process.exit(1);
}

const { pool } = require('./src/config/db');
const { MAX_MB } = require('./src/utils/upload');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Security headers. `upgrade-insecure-requests` is switched off so http://localhost works in every browser.
app.use(
  helmet({
    contentSecurityPolicy: { useDefaults: true, directives: { 'upgrade-insecure-requests': null } },
  })
);
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

// ---- API ----
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch {
    res.status(503).json({ status: 'error', database: 'not connected' });
  }
});
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/dashboard', require('./src/routes/dashboard'));
app.use('/api/books', require('./src/routes/books'));
app.use('/api/users', require('./src/routes/users'));
app.use('/api/borrow', require('./src/routes/borrow'));
app.use('/api/reports', require('./src/routes/reports'));
app.use('/api', (req, res) => res.status(404).json({ error: 'That API route does not exist.' }));

// ---- Frontend ----
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ---- Error handling: turns any failure into a clear JSON message ----
app.use((err, req, res, next) => {
  if (err.status) return res.status(err.status).json({ error: err.message });
  if (err.name === 'MulterError') {
    const message = err.code === 'LIMIT_FILE_SIZE' ? `That file is too large. The limit is ${MAX_MB} MB.` : 'The file could not be uploaded.';
    return res.status(400).json({ error: message });
  }
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'The request could not be read.' });

  if (err.code === 'ER_DUP_ENTRY') {
    const key = (String(err.sqlMessage || '').match(/for key '([^']+)'/) || [])[1] || '';
    let message = 'That value is already in use.';
    if (key.includes('email')) message = 'That email address is already registered.';
    else if (key.includes('identification')) message = 'That identification number is already registered.';
    else if (key.includes('isbn')) message = 'A book with that ISBN already exists.';
    return res.status(409).json({ error: message });
  }
  if (err.code === 'ER_ROW_IS_REFERENCED_2') {
    return res.status(409).json({
      error: 'This record has borrowing history, so it cannot be deleted. Deactivate it instead.',
    });
  }
  if (err.code === 'ER_CHECK_CONSTRAINT_VIOLATED' || err.code === 'ER_WARN_DATA_OUT_OF_RANGE' || err.code === 'ER_DATA_TOO_LONG') {
    return res.status(400).json({ error: 'One of the values is out of range or too long.' });
  }

  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server. Try again.' });
});

// ---- Start, but only after confirming MySQL is reachable ----
pool
  .query('SELECT 1')
  .then(() => {
    app.listen(PORT, () => {
      console.log(`\nLibrary system is running.`);
      console.log(`Open http://localhost:${PORT} in your browser.\n`);
    });
  })
  .catch((err) => {
    console.error('\nCould not connect to MySQL.');
    if (err.code === 'ECONNREFUSED') {
      console.error('MySQL does not seem to be running. Start the MySQL service, then try again.');
    } else if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('MySQL rejected the username or password. Check DB_USER and DB_PASSWORD in backend/.env.');
    } else if (err.code === 'ER_BAD_DB_ERROR') {
      console.error(`The database "${process.env.DB_NAME || 'library_db'}" does not exist yet. Run: npm run setup`);
    } else {
      console.error(err.message);
    }
    console.error('');
    process.exit(1);
  });

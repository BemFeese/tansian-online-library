// 4.5.1 User authentication: sign in, sign out, current user, change password.
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { pool } = require('../config/db');
const rules = require('../config/rules');
const { authenticate } = require('../middleware/auth');
const { HttpError, asyncHandler, text, checkPassword } = require('../utils/http');

const router = express.Router();

const cookieOptions = {
  httpOnly: true, // JavaScript in the page cannot read the session cookie
  sameSite: 'strict', // the cookie is only sent from this site
  secure: process.env.COOKIE_SECURE === 'true', // set to true only when the site is served over HTTPS
};

const publicUser = (u) => ({
  user_id: u.user_id,
  name: u.name,
  email: u.email,
  identification_no: u.identification_no,
  role: u.role,
  loan_days: rules[u.role] ? rules[u.role].loanDays : null,
  max_books: rules[u.role] ? rules[u.role].maxBooks : null,
});

const issueSession = (res, user) => {
  const token = jwt.sign({ user_id: user.user_id }, process.env.JWT_SECRET, { expiresIn: '8h' });
  res.cookie('token', token, { ...cookieOptions, maxAge: 8 * 60 * 60 * 1000 });
  res.json({ user: publicUser(user) });
};

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skipSuccessfulRequests: true, // only failed attempts count toward the limit
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Wait 15 minutes and try again.' },
});


// First-time setup status. A fresh handover has no administrator account yet.
router.get(
  '/setup-status',
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'");
    res.json({ needs_initial_admin: Number(rows[0].count) === 0 });
  })
);

// Creates the first administrator without requiring the handover team to know the librarian's
// name, email or password in advance. Once any admin exists, this endpoint permanently closes.
router.post(
  '/initialize-admin',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const name = text(req.body.name);
    const email = text(req.body.email).toLowerCase();
    const identification_no = text(req.body.identification_no);
    const password = String(req.body.password || '');

    if (name.length < 2) throw new HttpError(400, "Enter the administrator's full name.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, 'Enter a valid administrator email address.');
    if (!identification_no) throw new HttpError(400, "Enter the administrator's staff or library ID.");
    checkPassword(password);

    const lockName = 'tansian_online_library_initial_admin';
    const [[lock]] = await pool.query('SELECT GET_LOCK(?, 5) AS acquired', [lockName]);
    if (!lock || Number(lock.acquired) !== 1) throw new HttpError(503, 'Initial setup is busy. Please wait a moment and try again.');

    try {
      const [admins] = await pool.query("SELECT user_id FROM users WHERE role = 'admin' LIMIT 1");
      if (admins.length) throw new HttpError(409, 'The first administrator has already been created. Use Administrator sign in instead.');

      const hash = await bcrypt.hash(password, 10);
      const [result] = await pool.query(
        "INSERT INTO users (name, email, password, identification_no, role, status) VALUES (?, ?, ?, ?, 'admin', 'active')",
        [name, email, hash, identification_no]
      );
      const [rows] = await pool.query('SELECT * FROM users WHERE user_id = ?', [result.insertId]);
      issueSession(res, rows[0]);
    } finally {
      await pool.query('SELECT RELEASE_LOCK(?)', [lockName]).catch(() => {});
    }
  })
);

router.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const identifier = text(req.body.identifier);
    const password = String(req.body.password || '');
    if (!identifier || !password) throw new HttpError(400, 'Enter your email or ID number and your password.');

    const [rows] = await pool.query(
      'SELECT * FROM users WHERE email = ? OR identification_no = ? LIMIT 1',
      [identifier.toLowerCase(), identifier]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new HttpError(401, 'Incorrect email/ID number or password.');
    }
    if (user.role === 'admin') {
      throw new HttpError(403, 'Librarians must use Administrator sign in with their admin email address.');
    }
    if (user.status !== 'active') throw new HttpError(403, 'This account is inactive. Contact the librarian.');

    issueSession(res, user);
  })
);

// Librarian sign-in is deliberately separate from ordinary member sign-in.
// It accepts an email address only and succeeds only for an active admin account.
router.post(
  '/admin-login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const email = text(req.body.email).toLowerCase();
    const password = String(req.body.password || '');
    if (!email || !password) throw new HttpError(400, 'Enter your administrator email address and password.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      throw new HttpError(400, 'Enter a valid administrator email address.');
    }

    const [rows] = await pool.query("SELECT * FROM users WHERE email = ? AND role = 'admin' LIMIT 1", [email]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new HttpError(401, 'Incorrect administrator email or password.');
    }
    if (user.status !== 'active') throw new HttpError(403, 'This administrator account is inactive.');

    issueSession(res, user);
  })
);

// Self sign-up for students and teachers, using their own real email address. Librarian (admin)
// accounts are deliberately not offered here; those are created by an existing librarian in Manage Users.
router.post(
  '/register',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const name = text(req.body.name);
    const email = text(req.body.email).toLowerCase();
    const identification_no = text(req.body.identification_no);
    const role = text(req.body.role) === 'teacher' ? 'teacher' : 'student';
    const password = String(req.body.password || '');

    if (name.length < 2) throw new HttpError(400, 'Enter your full name.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, 'Enter a valid email address.');
    if (!identification_no) throw new HttpError(400, 'Enter your student or staff ID.');
    checkPassword(password);

    const [result] = await pool.query(
      'INSERT INTO users (name, email, password, identification_no, role) VALUES (?, ?, ?, ?, ?)',
      [name, email, await bcrypt.hash(password, 10), identification_no, role]
    );
    const [rows] = await pool.query('SELECT * FROM users WHERE user_id = ?', [result.insertId]);

    const token = jwt.sign({ user_id: result.insertId }, process.env.JWT_SECRET, { expiresIn: '8h' });
    res.cookie('token', token, { ...cookieOptions, maxAge: 8 * 60 * 60 * 1000 });
    res.status(201).json({ user: publicUser(rows[0]) });
  })
);

router.post('/logout', (req, res) => {
  res.clearCookie('token', cookieOptions);
  res.json({ ok: true });
});

router.get('/me', authenticate, (req, res) => res.json({ user: publicUser(req.user) }));

router.post(
  '/change-password',
  authenticate,
  asyncHandler(async (req, res) => {
    const current = String(req.body.current_password || '');
    const next = String(req.body.new_password || '');
    checkPassword(next);
    const [rows] = await pool.query('SELECT password FROM users WHERE user_id = ?', [req.user.user_id]);
    if (!(await bcrypt.compare(current, rows[0].password))) {
      throw new HttpError(400, 'Your current password is not correct.');
    }
    await pool.query('UPDATE users SET password = ? WHERE user_id = ?', [
      await bcrypt.hash(next, 10),
      req.user.user_id,
    ]);
    res.json({ ok: true });
  })
);

module.exports = router;

// Session management and role-based access (Section 4.8).
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const { HttpError, asyncHandler } = require('../utils/http');

// Reads the signed session cookie, then confirms in the database that the account still exists and is active.
const authenticate = asyncHandler(async (req, res, next) => {
  const token = req.cookies && req.cookies.token;
  if (!token) throw new HttpError(401, 'Please sign in.');

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new HttpError(401, 'Your session has expired. Please sign in again.');
  }

  const [rows] = await pool.query(
    'SELECT user_id, name, email, identification_no, role, status FROM users WHERE user_id = ?',
    [payload.user_id]
  );
  const user = rows[0];
  if (!user || user.status !== 'active') throw new HttpError(401, 'This account is no longer active.');
  req.user = user;
  next();
});

const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : next(new HttpError(403, 'You do not have permission to do this.'));

module.exports = { authenticate, requireRole };

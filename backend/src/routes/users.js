// 4.3.9 User management (administrator only).
const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');
const { HttpError, asyncHandler, text, checkPassword } = require('../utils/http');

const router = express.Router();
router.use(authenticate, requireRole('admin'));

const ROLES = ['student', 'teacher', 'admin'];
const STATUSES = ['active', 'inactive'];

function cleanUser(body = {}) {
  const u = {
    name: text(body.name),
    email: text(body.email).toLowerCase(),
    identification_no: text(body.identification_no),
    role: text(body.role) || 'student',
    status: text(body.status) || 'active',
  };
  if (u.name.length < 2) throw new HttpError(400, 'Enter the full name.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(u.email)) throw new HttpError(400, 'Enter a valid email address.');
  if (!u.identification_no) throw new HttpError(400, 'Enter the student or staff identification number.');
  if (!ROLES.includes(u.role)) throw new HttpError(400, 'Choose a valid role.');
  if (!STATUSES.includes(u.status)) throw new HttpError(400, 'Choose a valid status.');
  return u;
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const like = `%${text(req.query.q)}%`;
    const where = ['(u.name LIKE ? OR u.email LIKE ? OR u.identification_no LIKE ?)'];
    const params = [like, like, like];
    if (ROLES.includes(req.query.role)) {
      where.push('u.role = ?');
      params.push(req.query.role);
    }
    const [rows] = await pool.query(
      `SELECT u.user_id, u.name, u.email, u.identification_no, u.role, u.status, u.created_at,
              (SELECT COUNT(*) FROM borrow_records r
                WHERE r.user_id = u.user_id AND r.status = 'Borrowed' AND r.due_date >= CURDATE()) AS active_borrowings
       FROM users u
       WHERE ${where.join(' AND ')}
       ORDER BY FIELD(u.role, 'admin', 'teacher', 'student'), u.name
       LIMIT 500`,
      params
    );
    res.json(rows);
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const u = cleanUser(req.body);
    const password = String(req.body.password || '');
    checkPassword(password);
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password, identification_no, role, status) VALUES (?, ?, ?, ?, ?, ?)',
      [u.name, u.email, await bcrypt.hash(password, 10), u.identification_no, u.role, u.status]
    );
    res.status(201).json({ user_id: result.insertId });
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const u = cleanUser(req.body);
    const isSelf = Number(req.params.id) === req.user.user_id;
    if (isSelf && (u.role !== 'admin' || u.status !== 'active')) {
      throw new HttpError(409, "You can't remove your own administrator access or deactivate your own account.");
    }
    const fields = ['name = ?', 'email = ?', 'identification_no = ?', 'role = ?', 'status = ?'];
    const params = [u.name, u.email, u.identification_no, u.role, u.status];

    const newPassword = String(req.body.password || '');
    if (newPassword) {
      checkPassword(newPassword);
      fields.push('password = ?');
      params.push(await bcrypt.hash(newPassword, 10));
    }
    const [result] = await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE user_id = ?`, [
      ...params,
      req.params.id,
    ]);
    if (!result.affectedRows) throw new HttpError(404, 'User not found.');
    res.json({ ok: true });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    if (Number(req.params.id) === req.user.user_id) throw new HttpError(409, "You can't delete your own account.");
    const [result] = await pool.query('DELETE FROM users WHERE user_id = ?', [req.params.id]);
    if (!result.affectedRows) throw new HttpError(404, 'User not found.');
    res.json({ ok: true });
  })
);

module.exports = router;

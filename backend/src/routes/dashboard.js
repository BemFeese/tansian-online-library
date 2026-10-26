// Dashboards for students/teachers and for the librarian.
const express = require('express');
const { pool } = require('../config/db');
const rules = require('../config/rules');
const { authenticate } = require('../middleware/auth');
const { listBorrowings, ACTIVE } = require('../utils/queries');
const { asyncHandler } = require('../utils/http');

const router = express.Router();
router.use(authenticate);

const one = async (sql, params = []) => {
  const [rows] = await pool.query(sql, params);
  return Number(rows[0].n);
};

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const availableBooks = await one(
      "SELECT COUNT(*) AS n FROM books WHERE is_active = 1 AND availability_status = 'Available'"
    );

    if (req.user.role === 'admin') {
      res.json({
        role: 'admin',
        total_books: await one('SELECT COUNT(*) AS n FROM books WHERE is_active = 1'),
        available_books: availableBooks,
        borrowed_books: await one(`SELECT COUNT(*) AS n FROM borrow_records r WHERE ${ACTIVE}`),
        registered_users: await one("SELECT COUNT(*) AS n FROM users WHERE role <> 'admin' AND status = 'active'"),
        expired_records: await one('SELECT COUNT(*) AS n FROM v_expired_loans'),
        recent: await listBorrowings({ status: 'all', limit: 8, sort: 'recent' }),
      });
      return;
    }

    const rule = rules[req.user.role];
    res.json({
      role: req.user.role,
      available_books: availableBooks,
      borrowed_books: await one(`SELECT COUNT(*) AS n FROM borrow_records r WHERE r.user_id = ? AND ${ACTIVE}`, [
        req.user.user_id,
      ]),
      ending_soon: await one(
        `SELECT COUNT(*) AS n FROM borrow_records r
         WHERE r.user_id = ? AND ${ACTIVE} AND DATEDIFF(r.due_date, CURDATE()) <= 2`,
        [req.user.user_id]
      ),
      max_books: rule.maxBooks,
      loan_days: rule.loanDays,
    });
  })
);

module.exports = router;

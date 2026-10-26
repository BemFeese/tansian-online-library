// Borrowing a digital copy, My Borrowings, ending a loan early, and the librarian's borrowing records.
const express = require('express');
const { pool, withTransaction } = require('../config/db');
const rules = require('../config/rules');
const { authenticate, requireRole } = require('../middleware/auth');
const { listBorrowings, ACTIVE } = require('../utils/queries');
const { HttpError, asyncHandler, text, positiveInt } = require('../utils/http');

const router = express.Router();
router.use(authenticate);

// A student or teacher borrows a book for themselves. Access lasts for the loan period, then ends by itself.
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const rule = rules[req.user.role];
    if (!rule) throw new HttpError(403, 'Librarian accounts do not borrow books. Sign in as a student or teacher to borrow.');
    const bookId = positiveInt(req.body.book_id);
    if (!bookId) throw new HttpError(400, 'Choose a book to borrow.');
    const userId = req.user.user_id;

    const result = await withTransaction(async (conn) => {
      // Locking this member's row makes two quick clicks count one after the other, so the limit cannot be beaten.
      await conn.query('SELECT user_id FROM users WHERE user_id = ? FOR UPDATE', [userId]);

      const [books] = await conn.query('SELECT book_id, title, file_path, is_active FROM books WHERE book_id = ?', [bookId]);
      const book = books[0];
      if (!book || !book.is_active) throw new HttpError(404, 'Book not found.');
      if (!book.file_path) throw new HttpError(409, 'This book has no digital copy yet, so it cannot be borrowed online.');

      const [counts] = await conn.query(
        `SELECT COUNT(*) AS active, COUNT(CASE WHEN r.book_id = ? THEN 1 END) AS same_book
         FROM borrow_records r WHERE r.user_id = ? AND ${ACTIVE}`,
        [bookId, userId]
      );
      if (counts[0].same_book > 0) throw new HttpError(409, 'You already have access to this book. Open it from My Borrowings.');
      if (counts[0].active >= rule.maxBooks) {
        throw new HttpError(409, `You already have ${counts[0].active} books borrowed, which is the limit for a ${req.user.role}. Return one to borrow another.`);
      }

      const [ins] = await conn.query(
        `INSERT INTO borrow_records (user_id, book_id, borrow_date, due_date, status)
         VALUES (?, ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL ? DAY), 'Borrowed')`,
        [userId, bookId, rule.loanDays]
      );
      const [rec] = await conn.query('SELECT due_date FROM borrow_records WHERE borrow_id = ?', [ins.insertId]);
      return { borrow_id: ins.insertId, due_date: rec[0].due_date, title: book.title };
    });

    res.status(201).json(result);
  })
);

// The signed-in member's own borrowing history.
router.get(
  '/mine',
  asyncHandler(async (req, res) => {
    res.json(await listBorrowings({ userId: req.user.user_id }));
  })
);

// End access early. Borrowers can end their own loans; the librarian can end any loan.
router.post(
  '/:id/return',
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      'SELECT borrow_id, user_id, status, (due_date < CURDATE()) AS expired FROM borrow_records WHERE borrow_id = ?',
      [req.params.id]
    );
    const rec = rows[0];
    if (!rec || (req.user.role !== 'admin' && rec.user_id !== req.user.user_id)) {
      throw new HttpError(404, 'Borrowing record not found.');
    }
    if (rec.status === 'Returned') throw new HttpError(409, 'This loan has already been ended.');
    if (rec.expired) throw new HttpError(409, 'This loan has already expired.');

    const [result] = await pool.query(
      "UPDATE borrow_records SET status = 'Returned', return_date = CURDATE() WHERE borrow_id = ? AND status = 'Borrowed'",
      [rec.borrow_id]
    );
    if (!result.affectedRows) throw new HttpError(409, 'This loan has already been ended.');
    res.json({ ok: true });
  })
);

// ---- Librarian only ----
router.get(
  '/',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    res.json(
      await listBorrowings({
        status: text(req.query.status) || 'all',
        q: text(req.query.q),
        limit: req.query.limit,
      })
    );
  })
);

module.exports = router;

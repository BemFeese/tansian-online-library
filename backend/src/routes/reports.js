// Reports (librarian only).
const express = require('express');
const { pool } = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');
const { listBorrowings } = require('../utils/queries');
const { HttpError, asyncHandler, positiveInt } = require('../utils/http');

const router = express.Router();
router.use(authenticate, requireRole('admin'));

router.get(
  '/available',
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT book_id, title, author, isbn, category, file_type, file_size
       FROM books WHERE is_active = 1 AND availability_status = 'Available' ORDER BY title`
    );
    res.json(rows);
  })
);

router.get('/borrowed', asyncHandler(async (req, res) => res.json(await listBorrowings({ status: 'active' }))));
router.get('/returned', asyncHandler(async (req, res) => res.json(await listBorrowings({ status: 'returned' }))));
router.get('/expired', asyncHandler(async (req, res) => res.json(await listBorrowings({ status: 'expired' }))));

router.get(
  '/user/:id',
  asyncHandler(async (req, res) => {
    const id = positiveInt(req.params.id);
    if (!id) throw new HttpError(400, 'Choose a user.');
    res.json(await listBorrowings({ userId: id }));
  })
);

module.exports = router;

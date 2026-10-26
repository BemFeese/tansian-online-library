// Book search, details, management and the protected digital copy.
const express = require('express');
const { pool } = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');
const { HttpError, asyncHandler, text } = require('../utils/http');
const { STORAGE_DIR, upload, inspectUpload, removeStored } = require('../utils/upload');
const { ACTIVE } = require('../utils/queries');

const router = express.Router();
router.use(authenticate);

// file_path is deliberately left out: the stored file name never leaves the server.
const BOOK_COLUMNS = `book_id, title, author, isbn, category, publisher, publication_year,
  file_name, file_type, file_size, availability_status, is_active`;

// Validates the book form and returns clean values.
function cleanBook(body = {}) {
  const isbn = text(body.isbn).replace(/[\s-]/g, '').toUpperCase();
  const year = text(body.publication_year) ? Number(body.publication_year) : null;
  const book = {
    title: text(body.title),
    author: text(body.author),
    isbn,
    category: text(body.category),
    publisher: text(body.publisher) || null,
    publication_year: year,
  };
  if (!book.title || !book.author || !book.category) throw new HttpError(400, 'Title, author and category are required.');
  if (!/^(\d{9}[\dX]|\d{13})$/.test(isbn)) throw new HttpError(400, 'Enter a valid 10-digit or 13-digit ISBN.');
  if (year !== null && (!Number.isInteger(year) || year < 1000 || year > new Date().getFullYear() + 1)) {
    throw new HttpError(400, 'Enter a valid publication year.');
  }
  return book;
}

const errorPage = (message) => `<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Cannot open this book</title>
<body style="font-family:system-ui,sans-serif;max-width:38rem;margin:4rem auto;padding:0 1rem;line-height:1.5">
<h1>Cannot open this book</h1><p>${message}</p><p><a href="/#/my-borrowings">Go to My Borrowings</a></p></body></html>`;

// ---- Search the catalogue by title, author, ISBN or category ----
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const like = `%${text(req.query.q)}%`;
    const where = ['(title LIKE ? OR author LIKE ? OR isbn LIKE ? OR category LIKE ?)'];
    const params = [like, like, like, like];

    if (text(req.query.category)) {
      where.push('category = ?');
      params.push(text(req.query.category));
    }
    if (req.query.available === '1') where.push("availability_status = 'Available'");
    if (req.user.role !== 'admin') where.push('is_active = 1');
    else if (req.query.status === 'active') where.push('is_active = 1');
    else if (req.query.status === 'inactive') where.push('is_active = 0');

    const [rows] = await pool.query(
      `SELECT ${BOOK_COLUMNS} FROM books WHERE ${where.join(' AND ')} ORDER BY title LIMIT 500`,
      params
    );
    res.json(rows);
  })
);

router.get(
  '/categories',
  asyncHandler(async (req, res) => {
    const filter = req.user.role === 'admin' ? '' : 'WHERE is_active = 1';
    const [rows] = await pool.query(`SELECT DISTINCT category FROM books ${filter} ORDER BY category`);
    res.json(rows.map((r) => r.category));
  })
);

// ---- Book details (students and teachers also get their own current loan, if any) ----
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(`SELECT ${BOOK_COLUMNS} FROM books WHERE book_id = ?`, [req.params.id]);
    const book = rows[0];
    if (!book || (!book.is_active && req.user.role !== 'admin')) throw new HttpError(404, 'Book not found.');

    if (req.user.role !== 'admin') {
      const [loans] = await pool.query(
        `SELECT r.borrow_id, r.due_date, DATEDIFF(r.due_date, CURDATE()) AS days_left
         FROM borrow_records r WHERE r.user_id = ? AND r.book_id = ? AND ${ACTIVE} LIMIT 1`,
        [req.user.user_id, book.book_id]
      );
      book.my_loan = loans[0] || null;
    }
    res.json(book);
  })
);

// ---- Read or download the digital copy: only with an active loan (the librarian may always open it) ----
router.get(
  '/:id/file',
  asyncHandler(async (req, res) => {
    try {
      const [rows] = await pool.query(
        'SELECT book_id, title, file_path, file_type, is_active FROM books WHERE book_id = ?',
        [req.params.id]
      );
      const book = rows[0];
      if (!book || (!book.is_active && req.user.role !== 'admin')) throw new HttpError(404, 'Book not found.');
      if (!book.file_path) throw new HttpError(404, 'This book has no digital copy yet.');

      if (req.user.role !== 'admin') {
        const [loans] = await pool.query(
          `SELECT 1 FROM borrow_records r WHERE r.user_id = ? AND r.book_id = ? AND ${ACTIVE} LIMIT 1`,
          [req.user.user_id, book.book_id]
        );
        if (!loans.length) {
          throw new HttpError(403, 'Borrow this book to read it. If you borrowed it before, your access has ended.');
        }
      }

      // The book always opens inside the site's own reader (an iframe), never as a direct download link,
      // and no filename is sent, so "Save As" has nothing sensible to suggest. This is a deterrent, not a
      // guarantee: someone determined to save a page they can already see can still do so by other means.
      // These three security headers are meant for web pages and can stop a browser's built-in PDF viewer from
      // showing the file. Access is already protected by the sign-in cookie and the loan check above.
      res.removeHeader('Content-Security-Policy');
      res.removeHeader('X-Frame-Options');
      res.removeHeader('Cross-Origin-Resource-Policy');
      res.sendFile(
        book.file_path,
        {
          root: STORAGE_DIR,
          cacheControl: false,
          headers: {
            'Content-Disposition': 'inline', // no filename offered, and never "attachment"
            'Cache-Control': 'private, no-store',
          },
        },
        (err) => {
          if (err && !res.headersSent) res.status(404).json({ error: 'The file could not be opened. Tell the librarian.' });
        }
      );
    } catch (e) {
      // A browser opening this link gets a readable page instead of raw JSON.
      if (e.status && req.accepts(['html', 'json']) === 'html') {
        return res.status(e.status).type('html').send(errorPage(e.message));
      }
      throw e;
    }
  })
);

// ---- Librarian only from here down ----
router.post(
  '/',
  requireRole('admin'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    try {
      const b = cleanBook(req.body);
      const f = req.file ? await inspectUpload(req.file) : null;
      const [result] = await pool.query(
        `INSERT INTO books (title, author, isbn, category, publisher, publication_year,
                            file_name, file_path, file_type, file_size, availability_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [b.title, b.author, b.isbn, b.category, b.publisher, b.publication_year,
         f ? f.file_name : null, f ? f.file_path : null, f ? f.file_type : null, f ? f.file_size : null,
         f ? 'Available' : 'Unavailable']
      );
      res.status(201).json({ book_id: result.insertId });
    } catch (e) {
      if (req.file) await removeStored(req.file.filename);
      throw e;
    }
  })
);

router.put(
  '/:id',
  requireRole('admin'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    try {
      const b = cleanBook(req.body);
      const [rows] = await pool.query('SELECT file_path FROM books WHERE book_id = ?', [req.params.id]);
      if (!rows[0]) throw new HttpError(404, 'Book not found.');
      const oldFile = rows[0].file_path;

      const f = req.file ? await inspectUpload(req.file) : null;
      const removing = !f && text(req.body.remove_file) === '1';

      const sets = ['title = ?', 'author = ?', 'isbn = ?', 'category = ?', 'publisher = ?', 'publication_year = ?'];
      const params = [b.title, b.author, b.isbn, b.category, b.publisher, b.publication_year];
      if (f) {
        sets.push('file_name = ?', 'file_path = ?', 'file_type = ?', 'file_size = ?', "availability_status = 'Available'");
        params.push(f.file_name, f.file_path, f.file_type, f.file_size);
      } else if (removing) {
        sets.push('file_name = NULL', 'file_path = NULL', 'file_type = NULL', 'file_size = NULL', "availability_status = 'Unavailable'");
      }
      await pool.query(`UPDATE books SET ${sets.join(', ')} WHERE book_id = ?`, [...params, req.params.id]);

      if ((f || removing) && oldFile) await removeStored(oldFile);
      res.json({ ok: true });
    } catch (e) {
      if (req.file) await removeStored(req.file.filename);
      throw e;
    }
  })
);

// Deactivate or reactivate a book (hides it from students and teachers).
router.patch(
  '/:id/status',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const [result] = await pool.query('UPDATE books SET is_active = ? WHERE book_id = ?', [
      req.body.is_active ? 1 : 0,
      req.params.id,
    ]);
    if (!result.affectedRows) throw new HttpError(404, 'Book not found.');
    res.json({ ok: true });
  })
);

router.delete(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query('SELECT file_path FROM books WHERE book_id = ?', [req.params.id]);
    if (!rows[0]) throw new HttpError(404, 'Book not found.');
    await pool.query('DELETE FROM books WHERE book_id = ?', [req.params.id]); // refused if the book has borrowing history
    await removeStored(rows[0].file_path);
    res.json({ ok: true });
  })
);

module.exports = router;

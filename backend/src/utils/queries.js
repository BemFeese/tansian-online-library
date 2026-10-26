// Borrowing-record query shared by My Borrowings, the librarian's records page, the dashboard and the reports.
//
// Each record gets an access_status worked out from today's date:
//   Active   = borrowed and the due date has not passed (the person can still read the book)
//   Expired  = borrowed but the due date has passed (access has ended by itself)
//   Returned = ended early by the borrower or the librarian
const { pool } = require('../config/db');

const ACTIVE = "r.status = 'Borrowed' AND r.due_date >= CURDATE()";
const EXPIRED = "r.status = 'Borrowed' AND r.due_date < CURDATE()";

async function listBorrowings({ status = 'all', q = '', userId = null, limit = 500, sort = '' } = {}) {
  const where = [];
  const params = [];

  if (status === 'active') where.push(ACTIVE);
  else if (status === 'expired') where.push(EXPIRED);
  else if (status === 'returned') where.push("r.status = 'Returned'");

  if (userId) {
    where.push('r.user_id = ?');
    params.push(userId);
  }
  if (q) {
    const like = `%${q}%`;
    where.push('(u.name LIKE ? OR u.identification_no LIKE ? OR b.title LIKE ? OR b.isbn LIKE ?)');
    params.push(like, like, like, like);
  }

  let order = `(${ACTIVE}) DESC, r.borrow_id DESC`;
  if (sort === 'recent') order = 'r.borrow_id DESC';
  else if (status === 'returned') order = 'r.return_date DESC, r.borrow_id DESC';

  const [rows] = await pool.query(
    `SELECT r.borrow_id, r.borrow_date, r.due_date, r.return_date,
            CASE WHEN r.status = 'Returned' THEN 'Returned'
                 WHEN r.due_date < CURDATE() THEN 'Expired'
                 ELSE 'Active' END AS access_status,
            CASE WHEN ${ACTIVE} THEN DATEDIFF(r.due_date, CURDATE()) ELSE NULL END AS days_left,
            u.user_id, u.name AS user_name, u.identification_no, u.role,
            b.book_id, b.title, b.author, b.isbn, b.file_type
     FROM borrow_records r
     JOIN users u ON u.user_id = r.user_id
     JOIN books b ON b.book_id = r.book_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY ${order}
     LIMIT ?`,
    [...params, Math.min(Math.max(Number(limit) || 500, 1), 500)]
  );
  return rows;
}

module.exports = { listBorrowings, ACTIVE, EXPIRED };

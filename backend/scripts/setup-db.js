// Creates the MySQL database, tables and view, then loads sample data the first time.
//   npm run setup   -> safe to repeat; never deletes anything
//   npm run reset   -> DELETES the whole library database (and its stored book files) and rebuilds it with fresh sample data
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { makeSamplePdf } = require('./sample-pdf');

const dbName = process.env.DB_NAME || 'library_db';
const reset = process.argv.includes('--reset');
const STORAGE_DIR = path.join(__dirname, '..', 'storage', 'books');

const SAMPLE_USERS = [
  ['Tunde Balogun', 'tunde.balogun@school.edu', 'TCH-001', 'teacher', 'Teacher@123'],
  ['Amara Okafor', 'amara.okafor@school.edu', 'STU-1001', 'student', 'Student@123'],
  ['Daniel Mensah', 'daniel.mensah@school.edu', 'STU-1002', 'student', 'Student@123'],
  ['Grace Adeyemi', 'grace.adeyemi@school.edu', 'STU-1003', 'student', 'Student@123'],
];

// [isbn, title, author, category, publisher, year, has a sample digital copy]
// These ISBNs are sample values for testing. Two books have no file, to show "No digital copy yet".
const SAMPLE_BOOKS = [
  ['9780078022159', 'Database System Concepts', 'Abraham Silberschatz', 'Computing', 'McGraw-Hill', 2019, true],
  ['9780133970777', 'Fundamentals of Database Systems', 'Ramez Elmasri', 'Computing', 'Pearson', 2015, true],
  ['9780132350884', 'Clean Code', 'Robert C. Martin', 'Computing', 'Prentice Hall', 2008, true],
  ['9780262033848', 'Introduction to Algorithms', 'Thomas H. Cormen', 'Computing', 'MIT Press', 2009, false],
  ['9780141439518', 'Pride and Prejudice', 'Jane Austen', 'Fiction', 'Penguin Classics', 2002, true],
  ['9780141439471', 'Frankenstein', 'Mary Shelley', 'Fiction', 'Penguin Classics', 2003, true],
  ['9780141439761', "Alice's Adventures in Wonderland", 'Lewis Carroll', 'Fiction', 'Penguin Classics', 2009, true],
  ['9780141439563', 'Great Expectations', 'Charles Dickens', 'Fiction', 'Penguin Classics', 2003, true],
  ['9780451530707', 'The Time Machine', 'H. G. Wells', 'Science', 'Signet Classics', 2002, true],
  ['9780451529060', 'On the Origin of Species', 'Charles Darwin', 'Science', 'Signet Classics', 2003, true],
  ['9780141018997', 'Relativity: The Special and General Theory', 'Albert Einstein', 'Science', 'Penguin', 2006, false],
  ['9781590302255', 'The Art of War', 'Sun Tzu', 'History', 'Shambhala', 2005, true],
];

async function main() {
  if (!/^\w+$/.test(dbName)) throw new Error('DB_NAME may only contain letters, numbers and underscores.');

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });
  console.log('Connected to MySQL.');

  if (reset) {
    // Remove the stored book files that belong to the database being deleted.
    try {
      const [files] = await conn.query(`SELECT file_path FROM \`${dbName}\`.books WHERE file_path IS NOT NULL`);
      for (const { file_path: name } of files) {
        if (name === path.basename(name)) fs.rmSync(path.join(STORAGE_DIR, name), { force: true });
      }
    } catch {
      // The old database or its books table does not exist yet, so there is nothing to clean up.
    }
    await conn.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
    console.log(`Old database "${dbName}" deleted.`);
  }

  const schema = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8').replace(/library_db/g, dbName);
  await conn.query(schema);
  console.log('Tables and view are ready.');

  const [[{ n: userCount }]] = await conn.query('SELECT COUNT(*) AS n FROM users');
  if (userCount > 0) {
    console.log('Sample data skipped because the database already has users.');
    await conn.end();
    return;
  }

  for (const [name, email, idNo, role, password] of SAMPLE_USERS) {
    await conn.query(
      'INSERT INTO users (name, email, password, identification_no, role) VALUES (?, ?, ?, ?, ?)',
      [name, email, await bcrypt.hash(password, 10), idNo, role]
    );
  }

  fs.mkdirSync(STORAGE_DIR, { recursive: true });
  for (const [isbn, title, author, category, publisher, year, hasFile] of SAMPLE_BOOKS) {
    let file = { name: null, path: null, type: null, size: null };
    if (hasFile) {
      const stored = crypto.randomUUID() + '.pdf';
      const pdf = makeSamplePdf({ title, author });
      fs.writeFileSync(path.join(STORAGE_DIR, stored), pdf);
      file = { name: `${title}.pdf`, path: stored, type: 'pdf', size: pdf.length };
    }
    await conn.query(
      `INSERT INTO books (isbn, title, author, category, publisher, publication_year,
                          file_name, file_path, file_type, file_size, availability_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [isbn, title, author, category, publisher, year, file.name, file.path, file.type, file.size,
       hasFile ? 'Available' : 'Unavailable']
    );
  }

  // Demo records: two active loans, one that has expired, and one ended early.
  const user = (idNo) => `(SELECT user_id FROM users WHERE identification_no = '${idNo}')`;
  const book = (isbn) => `(SELECT book_id FROM books WHERE isbn = '${isbn}')`;
  await conn.query(`
    INSERT INTO borrow_records (user_id, book_id, borrow_date, due_date, return_date, status) VALUES
    (${user('STU-1002')}, ${book('9780141439518')}, DATE_SUB(CURDATE(), INTERVAL 5 DAY),  DATE_ADD(CURDATE(), INTERVAL 9 DAY),  NULL, 'Borrowed'),
    (${user('TCH-001')},  ${book('9780133970777')}, DATE_SUB(CURDATE(), INTERVAL 10 DAY), DATE_ADD(CURDATE(), INTERVAL 20 DAY), NULL, 'Borrowed'),
    (${user('STU-1001')}, ${book('9780132350884')}, DATE_SUB(CURDATE(), INTERVAL 20 DAY), DATE_SUB(CURDATE(), INTERVAL 6 DAY),  NULL, 'Borrowed'),
    (${user('STU-1003')}, ${book('9780078022159')}, DATE_SUB(CURDATE(), INTERVAL 30 DAY), DATE_SUB(CURDATE(), INTERVAL 16 DAY), DATE_SUB(CURDATE(), INTERVAL 25 DAY), 'Returned')
  `);

  console.log('Sample data loaded (10 books with sample PDF files, 2 without).\n');
  console.log('Sample student/teacher accounts (change these passwords after your first login):');
  for (const [name, , idNo, role, password] of SAMPLE_USERS) {
    console.log(`  ${role.padEnd(8)} ${idNo.padEnd(9)} ${password}   (${name})`);
  }
  console.log('');
  console.log("No default administrator is created. On first launch, use the browser's First-time administrator setup to create the real librarian account.");
  console.log('');
  await conn.end();
}

main().catch((err) => {
  console.error('\nSetup failed.');
  if (err.code === 'ECONNREFUSED') {
    console.error('MySQL does not seem to be running. Start the MySQL service, then run this again.');
  } else if (err.code === 'ER_ACCESS_DENIED_ERROR') {
    console.error('MySQL rejected the username or password. Check DB_USER and DB_PASSWORD in backend/.env.');
  } else {
    console.error(err.message);
  }
  process.exit(1);
});

-- =====================================================================
-- Web-Based Library Book Management System : MySQL schema
-- Digital-lending edition: students and teachers borrow ONLINE copies.
-- Requires MySQL 8.0 or later. Safe to run more than once.
-- You can run this file in MySQL Workbench, or let `npm run setup` run it.
-- =====================================================================
CREATE DATABASE IF NOT EXISTS library_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE library_db;

-- ---------------------------------------------------------------------
-- USERS  (students, teachers and the librarian in one table)
-- The role column drives role-based access. Passwords are bcrypt hashes.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  user_id           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  name              VARCHAR(120)  NOT NULL,
  email             VARCHAR(190)  NOT NULL,
  password          VARCHAR(255)  NOT NULL,
  identification_no VARCHAR(50)   NOT NULL,
  role              ENUM('student', 'teacher', 'admin') NOT NULL DEFAULT 'student',
  status            ENUM('active', 'inactive')          NOT NULL DEFAULT 'active',
  created_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_identification (identification_no),
  KEY idx_users_role (role),
  KEY idx_users_name (name)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- BOOKS  (catalogue records; each may have one digital copy)
-- file_path is the name of the stored file inside backend/storage/books.
-- The file itself is NOT kept in the database.
-- availability_status = 'Available' when a digital copy is attached.
-- is_active = 0 hides the book from students and teachers (deactivated).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS books (
  book_id             INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  title               VARCHAR(255)  NOT NULL,
  author              VARCHAR(190)  NOT NULL,
  isbn                VARCHAR(13)   NOT NULL,
  category            VARCHAR(100)  NOT NULL,
  publisher           VARCHAR(190)  NULL,
  publication_year    SMALLINT UNSIGNED NULL,
  file_name           VARCHAR(255)  NULL,
  file_path           VARCHAR(100)  NULL,
  file_type           ENUM('pdf') NULL,
  file_size           INT UNSIGNED  NULL,
  availability_status ENUM('Available', 'Unavailable') NOT NULL DEFAULT 'Unavailable',
  is_active           TINYINT(1)    NOT NULL DEFAULT 1,
  created_at          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (book_id),
  UNIQUE KEY uq_books_isbn (isbn),
  KEY idx_books_title (title),
  KEY idx_books_author (author),
  KEY idx_books_category (category)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- BORROW RECORDS  (one row each time a student or teacher borrows a book)
-- due_date is the last day the borrower can read the digital copy.
-- status = 'Returned' only when the borrower (or librarian) ends access early.
-- "Expired" is not stored: a record is expired when status = 'Borrowed'
-- and due_date is before today.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS borrow_records (
  borrow_id   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED NOT NULL,
  book_id     INT UNSIGNED NOT NULL,
  borrow_date DATE         NOT NULL,
  due_date    DATE         NOT NULL,
  return_date DATE         NULL,
  status      ENUM('Borrowed', 'Returned') NOT NULL DEFAULT 'Borrowed',
  PRIMARY KEY (borrow_id),
  KEY idx_borrow_user_status (user_id, status),
  KEY idx_borrow_book_status (book_id, status),
  KEY idx_borrow_due (due_date),
  CONSTRAINT fk_borrow_user FOREIGN KEY (user_id) REFERENCES users (user_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_borrow_book FOREIGN KEY (book_id) REFERENCES books (book_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_borrow_dates CHECK (due_date >= borrow_date)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- View used by the "Expired loans" report and the admin dashboard
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_expired_loans AS
SELECT r.borrow_id,
       u.user_id,
       u.name              AS user_name,
       u.identification_no,
       b.book_id,
       b.title,
       r.borrow_date,
       r.due_date          AS expired_on,
       DATEDIFF(CURDATE(), r.due_date) AS days_since_expiry
FROM borrow_records r
JOIN users u ON u.user_id = r.user_id
JOIN books b ON b.book_id = r.book_id
WHERE r.status = 'Borrowed'
  AND r.due_date < CURDATE();

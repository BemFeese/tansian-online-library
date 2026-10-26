# Web-Based Library Book Management System (online lending edition)

Students and teachers borrow **digital copies** of books from the school library and read them online. Access ends automatically when the loan period is over. The librarian manages books and their files, users, borrowing records and reports.

- **Frontend:** HTML, CSS and JavaScript in `frontend/`
- **Backend:** Node.js and Express in `backend/`
- **Database:** MySQL 8, defined in `backend/database/schema.sql`
- **Book files:** kept on the server in `backend/storage/books` and only sent to people with an active loan
- **Docs:** `docs/SETUP-GUIDE.md` (how to run it), `docs/waterfall-documentation.md` (phases, design, test plan), `docs/CHAPTER-4-REVISIONS.md` (what to change in your Chapter Four)

## What each role can do

| Role | Can do |
|---|---|
| Student, teacher | Search books, borrow a book that has a digital copy, read it online, return it early, see their borrowings, change their password |
| Librarian (administrator) | Manage books and upload their files, manage users, see all borrowing records and end a loan, view the dashboard and reports |

Loan length is 14 days for students and 30 for teachers. Limits are 5 and 10 books at a time. Both are settings in `backend/.env`.

## Quick start (details in `docs/SETUP-GUIDE.md`)

Install Node.js (LTS) and MySQL 8 first, then in a terminal:

```
cd backend
npm install
copy .env.example .env      (then edit .env: set DB_PASSWORD and JWT_SECRET)
npm run setup               (creates the database, tables, sample data and sample book files)
npm start                   (then open http://localhost:3000)
```

Sample student/teacher accounts (change these passwords after signing in):

| Role | ID | Password |
|---|---|---|
| Teacher | `TCH-001` | `Teacher@123` |
| Student | `STU-1001`, `STU-1002`, `STU-1003` | `Student@123` |

The sample book files are one-page placeholders. Replace them with real books from **Manage Books**. Only upload books the school has the right to share.


## Real librarian / administrator sign-in

The librarian does **not** register through the public student/teacher form. A fresh handover is deliberately shipped with **no named administrator account**. After `npm run setup`, start the system and open `http://localhost:3000`. The sign-in page will show **First-time setup → Create first administrator**. The person Tansian designates as the librarian enters their own real name, real email address, staff/library ID and private password. The account is created as an active administrator and the librarian is signed in immediately.

After the first administrator exists, the one-time setup closes. Additional administrators can be created from **Manage Users → Add user → Librarian (administrator)**. Each administrator has their own real email address and password.

The normal student/teacher sign-in accepts email or ID number and deliberately refuses administrator accounts. Administrator sign-in accepts an administrator email address only.

See `docs/ADMIN-HANDOVER-GUIDE.docx` for the complete handover, first-time setup, additional administrator, password and day-to-day management instructions.

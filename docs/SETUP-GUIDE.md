# Setup guide: run the Library System on Windows with VS Code and MySQL

This guide takes you from a fresh Windows laptop to a running system that the librarian, teachers and students can all use. Students and teachers borrow **digital copies** of books and read them online. Follow the steps in order.

## 0. Already set up the earlier (physical-books) version?

The database layout has changed, so use this short route instead of the full guide:

1. Download and extract the new zip with **right-click, Extract All** into a **new** folder.
2. In VS Code choose **File > Open Folder** and open the new folder. The sidebar should show `backend`, `frontend` and `docs` directly. If it shows one more folder with the same name, open that inner folder.
3. Open a terminal (**Terminal > New Terminal**) and run:
   ```
   cd backend
   npm install
   copy .env.example .env
   ```
4. Open `backend/.env` and fill in `DB_PASSWORD` and `JWT_SECRET` exactly as you did before (section 4 below).
5. Run `npm run reset`. **This deletes the old library database** and builds the new one. It only held sample data, so nothing you need is lost.
6. Run `npm start` and open `http://localhost:3000`.

Everyone else: continue with section 1.

## 1. How the pieces fit together

```
Browser (student, teacher or librarian)
        |   http://localhost:3000
Node.js + Express  (backend/server.js)
   |-- serves the pages in frontend/         <- the frontend is delivered by the backend
   |-- answers /api/... requests             <- the backend logic
   |-- keeps book files in backend/storage/  <- only sent to people who have borrowed the book
        |   SQL over port 3306
MySQL database "library_db"
```

There is **one program to start** (`npm start`) and **one address to open**. The backend serves the frontend files itself, so you never have to "connect" the two by hand.

Two habits to avoid:
- Do **not** double-click `frontend/index.html`, and do **not** use the VS Code "Live Server" extension. The pages must be opened from the address the backend prints, otherwise sign-in cannot work.
- Do **not** rename or move the `backend` and `frontend` folders. The backend looks for `../frontend` next to it.

## 2. Install the tools (one time)

### 2.1 Node.js
1. Go to nodejs.org and download the **LTS** version for Windows (64-bit `.msi`) and install it with the defaults.
2. In a VS Code terminal, `node -v` should show a version number.

### 2.2 MySQL Server and MySQL Workbench
1. Go to dev.mysql.com/downloads/installer and download **MySQL Installer for Windows**.
2. Choose **Custom**, then add **MySQL Server 8.x** and **MySQL Workbench 8.x**.
3. Keep the defaults: *Standalone MySQL Server*, port **3306**, *Use Strong Password Encryption*.
4. Set a **root password** and write it down.
5. Leave "Configure MySQL Server as a Windows Service" and "Start the server at system startup" ticked.
6. To check it is running: press the Windows key, type `services`, open **Services**, and look for **MySQL80** with status **Running**.

If you also have **XAMPP**, open its Control Panel and make sure its MySQL is **stopped**. Both want port 3306.

## 3. Open the project in VS Code
1. Extract the zip with **right-click, Extract All** (not "Extract Here").
2. In VS Code choose **File > Open Folder** and pick the extracted folder. The sidebar should show `backend`, `frontend` and `docs` directly.
3. Open a terminal with **Terminal > New Terminal**.

## 4. Install, configure and create the database

Run these one at a time in the terminal.

```
cd backend
npm install
copy .env.example .env
```

If `cd backend` says the path does not exist, your sidebar has an extra folder level. Type `cd` followed by that folder's name, a backslash, then `backend`.

Open `backend/.env` in VS Code and change the database/security values. **Do not enter a librarian's name, email or password here.** The system is intentionally handed over without a named administrator.

| Setting | What to put |
|---|---|
| `DB_PASSWORD` | Your MySQL root password. **If it contains `#`, put the whole password in double quotes:** `DB_PASSWORD="abc123#"` |
| `JWT_SECRET` | Any long random text (16+ characters), for example `maroon-table-4471-library-secret-key` |

Save with `Ctrl+S`. Then create the database, tables, sample users and sample books:

```
npm run setup
```

You should see "Tables and view are ready", "Sample data loaded", and the sample student/teacher accounts. **No administrator is created by this command.**

### 4.1 Create the first administrator during handover

Start the server:

```
npm start
```

Open `http://localhost:3000`. If no administrator exists, the sign-in page displays **First-time setup → Create first administrator**. The person Tansian designates as the librarian should complete that form themselves:

- Administrator full name
- Real administrator email address
- Staff/library ID
- A private password
- Password confirmation

The account is created immediately as an active **Librarian (administrator)** account, and that person is signed in automatically. The administrator's real email is now their separate Administrator sign-in credential.

This means the person handing over the system does **not** need to know the librarian's name, email address or password in advance. Do not put the librarian's credentials in the ZIP, documentation or source code.

The first-time setup is one-time only. Once an administrator exists, the setup option disappears and cannot be used to create another first administrator. Additional administrators are created by an existing administrator from **Manage Users → Add user → Librarian (administrator)**.

## 5. Start the system

```
npm start
```

The terminal prints `Open http://localhost:3000 in your browser.` Leave this terminal open while people use the system. Press `Ctrl+C` to stop it.

To check the database link, open **http://localhost:3000/api/health**. It should show `{"status":"ok","database":"connected"}`.

## 6. Sign in and test each role

Students and teachers use the normal sign-in page and can enter either their email or ID number. The librarian uses the separate **Administrator sign in** link and must enter the real email address registered to their administrator account.

| Role | Sign-in page | Sign in with | Password |
|---|---|---|---|
| Librarian (administrator) | Administrator sign in | The real email address entered during first-time setup | The private administrator password, until changed |
| Teacher | Student / teacher sign in | `TCH-001` (or the teacher's email) | `Teacher@123` |
| Student | Student / teacher sign in | `STU-1001`, `STU-1002` or `STU-1003` (or email) | `Student@123` |

**Student test**
1. Sign in as `STU-1003`. Search "pride", open **Pride and Prejudice**, click **Borrow for 14 days**, and confirm.
2. Click **Read book**. A new tab opens with the book. The sample files are one-page placeholders.
3. Open **My Borrowings**. The loan shows as **Active** with the days left.
4. Click **Return early**, confirm, and check the status changes to **Returned**.

**Expired loan test**
1. Sign in as `STU-1001` and open **My Borrowings**. **Clean Code** shows as **Expired** and has no Read button. Access ended by itself when its period ran out.

**Librarian test**
1. Complete the one-time **First-time administrator setup** if this is a fresh handover. Then, on later visits, click **Administrator sign in** and use the administrator's real email and private password. The dashboard shows totals and the latest borrowing activity.
2. Open **Manage Books**, click **Add book**, fill in the details and choose a PDF or EPUB file. Save it, then sign in as a student and borrow it.
3. Open **Borrowing Records** to see every loan, and **Reports** to view and download reports.
4. Use **Change password** (bottom of the sidebar) on the librarian account and replace all sample accounts before real use.

## 7. Adding real books

Only upload books the school has the right to share: public-domain books, open-access books, or titles the school holds a licence for.

- In **Manage Books**, use **Add book** for a new title, or **Edit** to attach or replace a file on an existing one. PDF and EPUB are accepted, up to 50 MB by default (`MAX_UPLOAD_MB` in `.env`).
- PDFs open in the browser. EPUB files download so they can be opened in a reading app.
- A book with no file shows "No digital copy yet" and cannot be borrowed.

**What expiring access can and cannot do.** When a loan expires, the site stops opening the book. It cannot take back a copy someone has already downloaded from the PDF viewer. Protecting against that needs special licensing software (DRM), which is outside this project.

## 8. Look inside the database (optional)
1. Open **MySQL Workbench** and click the local connection (`root`, your password).
2. Open **Schemas > library_db > Tables**. You will see `users`, `books` and `borrow_records`.
3. Run `SELECT * FROM borrow_records;` in the query window to see the loans the website shows.

To test expiry without waiting two weeks, pick a loan number from that list and run (replace `5` with the loan number):
```sql
UPDATE borrow_records
SET borrow_date = DATE_SUB(CURDATE(), INTERVAL 15 DAY), due_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
WHERE borrow_id = 5;
```
Refresh **My Borrowings** as that student: the loan is now Expired and the Read button is gone.

## 9. Let other people use it

**On the same computer:** use `http://localhost:3000`.

**Other computers or phones on the same Wi-Fi or network:**
1. Keep the laptop switched on and running `npm start`.
2. Open a terminal and run `ipconfig`. Note the **IPv4 Address**, for example `192.168.1.20`.
3. On the other device open `http://192.168.1.20:3000` (use your own address).
4. When Windows Defender Firewall asks about Node.js, tick **Private networks** and click **Allow access**.
5. If it still will not open, the network may block device-to-device traffic (common on public and some school Wi-Fi).

**For a whole school or outside your network:** the system needs an always-on computer or hosting service with Node.js and MySQL.
- Copy the project, run `npm install --omit=dev` and `npm run setup`.
- In `.env` set `NODE_ENV=production`, a new `JWT_SECRET`, and your MySQL details.
- Serve it over **HTTPS**, and only then set `COOKIE_SECURE=true`.
- Keep it running with a process manager such as `pm2`.
- **Back up two things:** the database (`mysqldump library_db > backup.sql`) **and** the folder `backend/storage/books`, which holds the book files.
- Create a limited MySQL user instead of `root`:
  ```sql
  CREATE USER 'library_app'@'localhost' IDENTIFIED BY 'a-strong-password';
  GRANT SELECT, INSERT, UPDATE, DELETE ON library_db.* TO 'library_app'@'localhost';
  ```
  Run `npm run setup` once with `root`, then put `library_app` and its password in `DB_USER` and `DB_PASSWORD`.

## 10. Everyday commands

Run these inside the `backend` folder:

| Command | What it does |
|---|---|
| `npm start` | Starts the system |
| `npm run dev` | Starts it and restarts automatically when you edit code |
| `npm run setup` | Creates missing tables. Safe to repeat, never deletes data |
| `npm run reset` | **Deletes the whole library database and its stored book files**, then rebuilds it with fresh sample data |

Loan periods and limits are in `.env`. Restart the server after changing them.

## 11. Troubleshooting

| What you see | Cause and fix |
|---|---|
| `'npm' is not recognized` | Install Node.js, then close and reopen VS Code |
| `npm.ps1 cannot be loaded because running scripts is disabled` | In the terminal dropdown choose **Command Prompt**, or run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` in PowerShell |
| `JWT_SECRET is missing or too short` | `.env` is missing, misnamed (`.env.txt`), or not in `backend/` |
| `MySQL does not seem to be running` | Open **Services**, right-click **MySQL80**, choose **Start** |
| `MySQL rejected the username or password` | Fix `DB_PASSWORD` in `.env`. A password containing `#` needs double quotes around the whole password |
| `The database "library_db" does not exist yet` | Run `npm run setup` |
| `Unknown column ... in 'field list'` or a `books` error after upgrading | The old database is still in place. Run `npm run reset` |
| `Cannot find module 'multer'` | Run `npm install` inside `backend` |
| `EADDRINUSE ... port 3000` | Set `PORT=3001` in `.env` and open `http://localhost:3001` |
| Sign-in works, then you are sent back to the sign-in page | You opened the site from Live Server or a file, or `COOKIE_SECURE=true` on plain `http` |
| "Only PDF and EPUB files can be uploaded" | Choose a `.pdf` or `.epub` file |
| "That file is too large" | Raise `MAX_UPLOAD_MB` in `.env` and restart, or reduce the file size |
| "That file is not a valid PDF" | The file was renamed or damaged. Export it again as a PDF |
| The PDF tab is blank | Use Chrome or Edge. Some phone browsers download PDFs instead of showing them |
| "Borrow this book to read it" page | The loan has ended or was never made. Borrow the book again from its details page |
| `Too many sign-in attempts` | After 20 failed attempts sign-in pauses for 15 minutes. Wait, or restart the server |
| Other devices cannot open `http://192.168...:3000` | Server not running, wrong IP, firewall not allowed on Private networks, or the Wi-Fi blocks device-to-device traffic |

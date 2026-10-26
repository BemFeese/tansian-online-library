# Tansian Online Library — Librarian / Administrator Handover Guide

## Purpose
This guide is for the librarian or staff member who will control the Tansian Online Library after handover. The administrator account is intentionally different from a student or teacher account.

## 1. How administrator sign-in works
- Students and teachers use the normal **Student / teacher sign in** page. They may sign in with their registered email address or school ID number.
- The librarian uses **Administrator sign in**. This page accepts the administrator's registered email address and password only.
- A person cannot make themselves an administrator through the public **Create an account** form. Public registration only creates Student or Teacher accounts.
- The server checks that the email belongs to an active account whose database role is `admin` before it opens the administrator dashboard.

### Example
Student: Amara can use `amara.okafor@school.edu` or `STU-1001` on the normal sign-in page. After sign-in she sees Books and My Borrowings.

Teacher: Tunde can use `tunde.balogun@school.edu` or `TCH-001` on the normal sign-in page. He has a teacher borrowing period/limit but does not get administrator menus.

Administrator: the librarian might use `librarian@tansian.edu.ng` on **Administrator sign in**. The normal student/teacher sign-in deliberately refuses an administrator account. After administrator sign-in the librarian sees Manage Books, Manage Users, Borrowing Records and Reports.

The system stores and uses a real email address as the administrator's login name. It does not currently send verification or password-reset emails. Password recovery can be handled by another administrator through Manage Users, or by an authorised server owner using the documented emergency recovery procedure.

## 2. First-time administrator setup

The system is delivered **without a named librarian or default administrator account**. This is intentional: the person handing over the system does not need to know who Tansian will appoint, and should never need to know the librarian's password.

### Before handover

The technical setup person only needs to configure the database connection and `JWT_SECRET` in `backend/.env`. Do **not** put a librarian's name, email or password into the ZIP, documentation or source code.

### At handover

1. Start the system with `npm start`.
2. Open `http://localhost:3000`.
3. The sign-in page will show **First-time setup → Create first administrator** because no administrator exists.
4. The person Tansian designates as the librarian completes the form with:
   - their full name;
   - their real email address;
   - their staff/library ID;
   - a private password; and
   - password confirmation.
5. Select **Create administrator**. The account is created as an active `admin` account and that person is signed in automatically.
6. On future visits, use **Administrator sign in** and the real email address plus the private password.

The first-time setup is automatically closed after the first administrator is created. A later visitor cannot use the setup form to create a second first administrator.

### Creating a second or third administrator

An existing administrator can create more administrators from **Manage Users → Add user**. Select **Librarian (administrator)** as the role, enter the new person's real email and staff/library ID, and give them a temporary password securely. They should sign in through **Administrator sign in** and change that password using **Change password**.

For example:

| Person | Email | Role |
|---|---|---|
| Librarian A | `librarianA@tansian.edu.ng` | Librarian (administrator) |
| Librarian B | `librarianB@tansian.edu.ng` | Librarian (administrator) |
| Librarian C | `librarianC@tansian.edu.ng` | Librarian (administrator) |

Each administrator has a separate account. Do not share one administrator password between librarians.

## 3. What the administrator can control

### Dashboard
Shows totals for books, online copies, active borrowings, registered users and expired loans, plus recent borrowing activity.

### Manage Books
Use **Add book** to create catalogue records and upload a PDF/EPUB. Use **Edit** to correct details or replace/remove the digital copy. Use **Deactivate** instead of deleting a book that has history. Only upload material the institution has the right to distribute.

### Manage Users
Search users by name, email or ID. The librarian can add a Student, Teacher or another Librarian (administrator), edit details, change status and set a new password. Setting an account to **Inactive** blocks sign-in while keeping its history.

To add another librarian: open **Manage Users → Add user**, enter the person's real email, staff ID and temporary password, and select **Librarian (administrator)** as the role. Give that person the Administrator sign-in instructions. Do not ask them to use Create an account.

The system prevents the currently signed-in administrator from removing their own admin role or deactivating their own account.

### Borrowing Records
Shows every loan. Active access normally expires automatically according to the configured borrowing period. The librarian can also end an active loan early.

### Reports
View available books, borrowed books, returned books, expired loans and a selected user's borrowing history. Reports can be downloaded as CSV files for Excel.

## 4. Day-to-day administration checklist
- Start the server and confirm `/api/health` reports that the database is connected.
- Add or update books as required.
- Add staff/students as needed or allow students/teachers to use public registration.
- Review users and deactivate accounts that should no longer have access.
- Review borrowing records and expired loans.
- Download reports when needed.
- Back up both the MySQL database and `backend/storage/books`.
- Keep administrator passwords private and change them immediately if they may have been exposed.

## 5. Student/teacher sign-in versus administrator sign-in

| Feature | Student / Teacher | Librarian / Administrator |
|---|---|---|
| Entry page | Student / teacher sign in | Administrator sign in |
| Login identifier | Email or student/staff ID | Administrator email only |
| Can self-register | Yes, as Student or Teacher | No |
| Role required by server | `student` or `teacher` | `admin` |
| Main access | Books and personal borrowings | Full library management |
| Can manage users/books/reports | No | Yes |
| Can create another admin | No | Yes, through Manage Users |

## 6. Testing the handover

### First administrator
1. On a fresh handover, open the site and choose **Create first administrator**.
2. Enter a real email you control and a private password.
3. Confirm that the administrator dashboard opens automatically.
4. Sign out.
5. Try the same admin email/password on the normal Student / teacher sign-in page. It should tell you to use Administrator sign in.
6. Use **Administrator sign in** with the same email/password. It should open the Administrator dashboard.

### Student and teacher separation
1. Sign out and sign in with `STU-1001` / `Student@123` on the normal page. You should see only student navigation.
2. Sign out and sign in with `TCH-001` / `Teacher@123`. You should see teacher navigation, not Manage Users/Books/Reports.
3. Sign back in as the administrator and open **Manage Users**.
4. Add a second administrator with a different real email and temporary password.
5. Sign out and test the second administrator through **Administrator sign in**.
6. Have the second administrator use **Change password** to choose their private password.

## 7. Password and account recovery

If the librarian remembers the current password, use **Change password** inside the system.

If the librarian forgets the password and another administrator exists, that administrator can open **Manage Users**, edit the librarian and set a new temporary password.

If no administrator can sign in, an authorised server owner can use the emergency `npm run admin:create` recovery script with temporary values in `backend/.env`. This is a recovery tool, **not** the normal handover process. Server access and `.env` must be restricted to trusted technical/administrative staff.

## 8. Important production security actions
- Change `JWT_SECRET` from the example value before deployment.
- Use HTTPS for a public/hosted installation, then set `COOKIE_SECURE=true`.
- Do not put normal librarian credentials in `.env`. If the emergency recovery script is used, remove or replace its temporary recovery values after access has been restored.
- Restrict access to `backend/.env`, database credentials and server terminal access.
- Use a limited MySQL application user rather than the MySQL root account for normal operation.
- Maintain regular backups of the database and uploaded book files.

## 9. What remains unchanged
The book catalogue, online borrowing, borrowing limits, student/teacher registration, user management, reports, password changes, and librarian management screens work as before. This change adds a one-time first-administrator setup and keeps administrator authentication separate from ordinary member authentication.

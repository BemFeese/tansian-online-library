# Chapter Four: what to change so it matches the system

**Short answer:** most of Chapter Four stays as it is. The structure, the numbering, the login, search, user management, database section layout and security section all still fit. The parts that talk about **physical copies, quantities, overdue books and staff recording returns** need editing, because in this system students and teachers borrow **digital copies** that they read online, and access **ends automatically** when the loan period is over.

Change only what is marked below. Replacement wording follows each item and is written in the style of your draft. Also re-read Chapters One and Three for any wording about physical copies or returning books to the library, and keep them consistent.

## Summary

| Section | Action |
|---|---|
| 4.1 Introduction | Small edit |
| 4.2 System Implementation | Small edit |
| 4.3.1 Login Page | Keep |
| 4.3.2 Student Dashboard | Small edit |
| 4.3.3 Book Search Interface | Small edit |
| 4.3.4 Book Details Interface | Edit (Quantity is replaced) |
| 4.3.5 Borrowing Interface | Rewrite |
| 4.3.6 Student Borrowing Records | Edit |
| 4.3.7 Administrator Dashboard | Small edit (Overdue becomes Expired) |
| 4.3.8 Book Management Interface | Edit (Quantity is replaced by the digital file) |
| 4.3.9 User Management | Small edit (add Teacher) |
| 4.3.10 Borrowing and Return Management | Rewrite |
| 4.4 Database Implementation | Edit 4.4.1 to 4.4.4 |
| 4.5.3, 4.5.5, 4.5.6, 4.5.7 | Edit |
| 4.6, 4.7 Testing | Edit the test cases, then record real results |
| 4.8 Security Implementation | Add two points |
| 4.9, 4.10, 4.11 | Small edits |

---

## 4.1 Introduction
Replace the second paragraph with:

> The implemented system provides an online platform through which students and teachers can search for library books, view book details, and borrow digital copies of books which they can read online, without necessarily visiting the physical library. Library staff are provided with administrative functions for managing books and their digital files, users, borrowing records, and generating relevant reports.

## 4.2 System Implementation
Replace the list of user categories with:

> Student
> Teacher
> Administrator/Library Staff (Librarian)

Replace the paragraph that follows it with:

> Students and teachers interact with the system mainly to search for books, borrow digital copies and read them online. The administrator or library staff is responsible for managing the books, their digital files, the users and the records stored within the system.

In the structure diagram, change the top line to `STUDENT / TEACHER / LIBRARIAN`.

## 4.3.2 Student Dashboard
In the dashboard sketch, change the two information lines to:

```
Books Available Online:   [Number]
Books You Have Borrowed:  [Number]
Ending Within 2 Days:     [Number]
```

Add this sentence after the sketch:

> The dashboard also shows how many books the user may borrow at one time and how many days each loan lasts.

## 4.3.3 Book Search Interface
In the example results table, change the Availability value from "Available" to "Available online". Add:

> A book that the library holds but which has no digital copy yet is shown as "No digital copy yet" and cannot be borrowed online.

## 4.3.4 Book Details Interface
In the list of details, replace **Quantity** with **Digital copy (format and size)**. Update the example:

```
Digital copy:  PDF, 2.4 MB
Status:        Available online
```

Add:

> Depending on the user's situation, the page offers a "Borrow" button, or, when the user already has access, a "Read book" button and a "Return early" button.

## 4.3.5 Borrowing Interface (rewrite)

> The borrowing interface allows an authorised student or teacher to borrow a digital copy of a book. When the user borrows a book, the system records the borrowing transaction and grants access to the digital copy for the loan period. The borrowing record contains information such as:
>
> Borrow ID
> User ID
> Book ID
> Borrow date
> Due date (the last day of access)
> Return date
> Borrowing status
>
> The loan period is 14 days for students and 30 days for teachers, and the number of books a user may borrow at one time is limited (5 for students and 10 for teachers). These values can be changed in the system settings.

Replace the process diagram with:

```
User selects book
        ↓
System checks the book has a digital copy
        ↓
System checks the user does not already
have access and is within the borrowing limit
        ↓
Conditions met?
   /           \
 Yes            No
  ↓              ↓
Create borrowing   Display reason
record with due date
  ↓
Grant access to the digital copy
```

Then add:

> When the due date has passed, access to the digital copy ends automatically and the user may borrow the book again if needed. No physical book has to be returned.

## 4.3.6 Student Borrowing Records
Replace the sample table with:

| Book | Borrow Date | Access Until | Return Date | Status |
|---|---|---|---|---|
| Database Systems | Date | Date | — | Active |

Replace the sentence after it with:

> The status of a borrowing is Active while the user still has access, Expired when the loan period has ended, and Returned when the user or librarian ended the loan early. From this page the user can open a book they have access to, return it early, or borrow an expired book again.

## 4.3.7 Administrator Dashboard
In the list, replace "Available books" with "Books available online", and replace "Overdue borrowing records" with "Expired loans". In the sketch, change the fourth block from **Overdue** to **Expired**. Add:

> Borrowed books are loans that still give access. Expired loans are loans whose period ended without an early return.

## 4.3.8 Book Management Interface
In the list of functions, replace "Update quantity" and "Monitor availability" with:

> Upload, replace or remove the digital copy of a book (PDF or EPUB)

In the registration form, replace **Quantity** with:

```
Digital copy:  [ Choose file ]  (PDF or EPUB)
```

Add:

> Only books that have a digital copy can be borrowed. The system checks that an uploaded file is a genuine PDF or EPUB and rejects other files. A book can be deactivated to hide it from students and teachers without deleting its borrowing history.

## 4.3.9 User Management
Change the role examples to include teachers:

> Role-based access ensures that students, teachers and administrators do not have identical permissions. Students and teachers can search and borrow books, while only the administrator can manage books, users and reports.

## 4.3.10 Borrowing and Return Management (rewrite)
Rename it **Borrowing Records** if you like, and use:

> The system provides library staff with facilities for monitoring borrowing. The administrator can view all borrowing records, search them, and filter them as Active, Expired or Returned. Because loans end automatically when the loan period is over, the administrator does not need to record returns. The administrator can, however, end an active loan early where necessary.

Replace both process diagrams with:

```
When a book is borrowed:            When the loan period ends:
Borrowing recorded                  Due date passes
      ↓                                   ↓
Access to digital copy granted      Access to digital copy ends automatically
                                    (status shows Expired)

When a user returns a book early:
User (or librarian) ends the loan
      ↓
Return date recorded
      ↓
Access to digital copy ends
```

Finish with:

> This ensures that access to a book always corresponds to its current borrowing state.

## 4.4 Database Implementation

**4.4.1 User Table.** Keep the fields. Add a Status field (active or inactive) and change the Role description to "Student, teacher or administrator".

**4.4.2 Administrator Table.** Replace the whole subsection with:

> Administrator accounts are stored in the same user table as students and teachers, and are identified by the Role field. This allows role-based permissions to be applied from a single table.

**4.4.3 Book Table.** Replace with:

| Field | Description |
|---|---|
| Book_ID | Unique system identifier |
| Title | Title of the book |
| Author | Author of the book |
| ISBN | International Standard Book Number |
| Category | Book category/subject |
| Publisher | Publisher of the book |
| Publication_Year | Year of publication |
| File_Name | Original name of the uploaded digital copy |
| File_Path | Name under which the file is stored on the server |
| File_Type | PDF or EPUB |
| File_Size | Size of the file |
| Availability_Status | Available (has a digital copy) or Unavailable |
| Is_Active | Whether the book is visible to students and teachers |

Keep your sentence about Book_ID and ISBN, and add: "The digital file itself is stored on the server, and the database stores only its details."

**4.4.4 Borrow Record Table.** Keep the fields. Change two descriptions:

| Field | Description |
|---|---|
| Due_Date | Last day on which the borrower can access the digital copy |
| Status | Borrowed or Returned. Whether a loan has expired is worked out from the due date |

## 4.5 System Functionality

**4.5.3 Book Availability Checking**

> After locating a book, the user can see whether a digital copy is available. A book with a digital copy is shown as "Available online", while a book without one is shown as "No digital copy yet". This allows users to know immediately whether they can borrow and read the book online.

**4.5.5 Borrowing Management**

> The system records borrowing transactions and associates them with the relevant user and book. Each transaction grants access to the digital copy until the due date, which provides an electronic record of borrowing activities.

**4.5.6 Return Management** (rename to **Loan Expiry and Return Management**)

> Access to a borrowed book ends automatically on the due date. A user may also return a book early, and the administrator may end a loan, in which case the borrowing record is updated with the return date and access to the digital copy ends immediately.

**4.5.7 Reporting.** Replace the list with:

> Available books
> Borrowed books
> Returned books
> Expired loans
> User borrowing records
>
> Reports can also be downloaded as files that open in spreadsheet software.

## 4.6 and 4.7 Testing
Change these test cases:

| Old | New |
|---|---|
| Check availability | Check that a book with no digital copy shows "No digital copy yet" |
| Borrow available book | Borrow a book with a digital copy: record created and the book can be opened |
| Return borrowed book | Return a book early: record shows Returned and the book can no longer be opened |
| (new) | Access expires: after the due date the book can no longer be opened |
| (new) | Borrowing limit: a student cannot exceed the limit |

`docs/waterfall-documentation.md` has a full test table. **Only write "Pass" in the Status column after you have run the test yourself, and put what you actually saw in the Actual Result column.**

In 4.7, replace the two integration flows with the borrow, early-return and expiry flows from 4.3.5 and 4.3.10 above.

## 4.8 Security Implementation
Add two points:

> **Protected Digital Copies.** Book files are not stored in a public folder. Every request to open a book is checked to confirm that the user is signed in and has an active loan for that book.
>
> **File Validation.** Uploaded files are restricted to PDF and EPUB, their contents are checked to confirm the file type, and a maximum file size is enforced.

Also change the Password Protection line from "should be stored" to the finished form: "Passwords are stored as hashes using the bcrypt algorithm; plain-text passwords are never stored."

## 4.9, 4.10 and 4.11
- **4.9:** in the second paragraph, replace "including their availability" with "including whether a digital copy is available", and add: "Students and teachers can borrow and read digital copies online, so a visit to the physical library is no longer needed to use a book."
- **4.10 objectives table:** change "Manage returned books / Return management function" to "Manage loan periods and returns / Automatic expiry and early-return function", and add a row "Provide online access to book content / Digital lending and protected reading function".
- **4.11:** replace "managing books, users, borrowing and returns" with "managing books and their digital files, users and borrowing records".

## One honest limitation to mention
Expiry stops **the system** from opening a book after the loan ends. It cannot delete a copy a user has already saved from their PDF viewer, because that would need copy-protection software. Mention this under limitations or recommendations in Chapter Five.

# What changed in this update

This update was requested after the earlier online-lending version was already running. It changes four things and leaves everything else the same.

## 1. Books can no longer be downloaded
- Only PDF files can be uploaded now (EPUB has been removed, since EPUB files could only ever be downloaded, not read on the page).
- Clicking "Read book" no longer opens the file directly. It opens a **Read** page inside the site with the book shown in a frame, a "Close" button, and no direct file link anywhere in the page.
- The file is sent with no filename and always as "inline", and the site's own security headers are relaxed only for that one request so the reader can display the file.

**Honest limit:** this removes the obvious Download and Print buttons in Chrome and Edge's built-in PDF viewer, and blocks right-click "Save As" on the reader. It cannot stop someone who is determined to capture a page they can already see on their screen (a screenshot, a browser extension, or "Print to PDF" from the browser menu, for example). No lending system that displays a file in a browser can fully prevent that; doing so needs licensed copy-protection (DRM) software, which is outside this project.

## 2. Anyone can create their own account
- The login page now has a **Create an account** link.
- Students and teachers can sign up with their own real name, email address, ID number and a password they choose.
- Librarian (admin) accounts are still only created by an existing librarian, from **Manage Users** — self-sign-up never creates an admin account.
- The sample teacher/student accounts (`TCH-001`, `STU-1001` etc.) still work for testing. Fresh installs now create the real librarian separately with `npm run admin:create`; there is no built-in default administrator account.

## 3. Branding
- The sign-in page now shows the Tansian University crest and the heading **Tansian Online Library**.
- The top-left of the sidebar now reads **Tansian Library System**.

## 4. Real book uploads
- This was already possible in the previous version (Manage Books → Add book → choose a file). It still works, and now only accepts PDF files (see point 1). The ten sample books are untouched.

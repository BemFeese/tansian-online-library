'use strict';
// Pages for the librarian: dashboard, book management (with file upload), user management,
// borrowing records and reports.

// ---- Dashboard ----
async function adminDashboard(view) {
  const d = await api('/dashboard');
  view.innerHTML = `
    <header class="page-head"><div><h1>Administrator dashboard</h1>
      <p class="lede">Today's position across the catalogue, members and online loans.</p></div></header>
    <dl class="stats">
      <div><dt>Total books</dt><dd>${d.total_books}</dd></div>
      <div><dt>Available online</dt><dd>${d.available_books}</dd></div>
      <div><dt>Borrowed books</dt><dd>${d.borrowed_books}</dd></div>
      <div><dt>Registered users</dt><dd>${d.registered_users}</dd></div>
      <div><dt>Expired loans</dt><dd>${d.expired_records}</dd></div>
    </dl>
    <p class="muted" style="margin-top:0.75rem">Borrowed books are loans that still give access. Expired loans ended by themselves when their period ran out.</p>
    <section class="section">
      <h2>Latest borrowing activity</h2>
      <div class="table-wrap"><table>
        ${d.recent.length ? `
        <thead><tr><th>Book</th><th>Member</th><th>Borrowed</th><th>Access until</th><th>Status</th></tr></thead>
        <tbody>${d.recent.map((r) => `
          <tr><td><strong>${esc(r.title)}</strong></td>
              <td>${esc(r.user_name)} <span class="muted">${esc(r.identification_no)}</span></td>
              <td>${fmtDate(r.borrow_date)}</td>
              <td><span class="stamp ${r.access_status === 'Expired' ? 'late' : ''}">${fmtDate(r.due_date)}</span></td>
              <td>${accessPill(r)}</td></tr>`).join('')}</tbody>`
        : '<tbody><tr><td class="empty">No books have been borrowed yet.</td></tr></tbody>'}
      </table></div>
    </section>`;
}

// ---- Book management ----
// An empty file box still sends an empty part, so remove it before uploading.
const withoutEmptyFile = (fd) => {
  const f = fd.get('file');
  if (f && f.size === 0) fd.delete('file');
  return fd;
};

async function manageBooksPage(view) {
  const categories = await api('/books/categories');
  let rows = [];

  const bookForm = (b = {}) =>
    [
      field('Title', 'title', b.title, 'required', true),
      field('Author', 'author', b.author, 'required'),
      field('ISBN', 'isbn', b.isbn, 'required inputmode="numeric" placeholder="10 or 13 digits"'),
      `<label>Category<input name="category" list="cat-list" value="${esc(b.category || '')}" required></label>
       <datalist id="cat-list">${categories.map((c) => `<option value="${esc(c)}"></option>`).join('')}</datalist>`,
      field('Publisher', 'publisher', b.publisher),
      field('Publication year', 'publication_year', b.publication_year, 'type="number" min="1000" max="2100"'),
      `<label class="wide">Digital copy (PDF only)
         <input type="file" name="file" accept=".pdf,application/pdf"></label>`,
      b.file_name
        ? `<p class="muted">Current file: ${esc(b.file_name)} (${fmtSize(b.file_size)}). Choosing a new file replaces it.</p>
           <label class="check wide"><input type="checkbox" name="remove_file" value="1"> Remove the current file</label>`
        : '<p class="muted">You can add the file now or later. Students can only borrow books that have a digital copy.</p>',
    ].join('');

  view.innerHTML = `
    <header class="page-head">
      <div><h1>Manage books</h1><p class="lede" id="book-count"></p></div>
      <button class="btn" id="add-book">Add book</button>
    </header>
    <div class="toolbar">
      <label class="grow">Search
        <input id="book-q" type="search" placeholder="Title, author, ISBN or category"></label>
      <label>Show
        <select id="book-status"><option value="">All books</option><option value="active">Active only</option>
          <option value="inactive">Deactivated only</option></select></label>
    </div>
    <div class="table-wrap"><table id="book-table"></table></div>`;

  const load = async () => {
    const qs = new URLSearchParams({ q: $('#book-q').value.trim(), status: $('#book-status').value });
    rows = await api('/books?' + qs);
    $('#book-count').textContent = plural(rows.length, 'book shown', 'books shown');
    $('#book-table').innerHTML = rows.length
      ? `<thead><tr><th>Book</th><th>ISBN</th><th>Category</th><th>Digital copy</th><th></th></tr></thead>
         <tbody>${rows.map((b) => `
          <tr class="${b.is_active ? '' : 'inactive'}">
            <td><a href="#/books/${b.book_id}"><strong>${esc(b.title)}</strong></a>
                <div class="muted">${esc(b.author)}${b.publication_year ? ', ' + b.publication_year : ''}
                ${b.is_active ? '' : '<span class="pill inactive">Deactivated</span>'}</div></td>
            <td>${esc(b.isbn)}</td><td>${esc(b.category)}</td>
            <td>${availability(b)}${b.file_type ? `<div class="muted">${esc(b.file_type.toUpperCase())}, ${fmtSize(b.file_size)}</div>` : ''}</td>
            <td class="actions">
              <button class="link" data-act="edit" data-id="${b.book_id}">Edit</button>
              <button class="link" data-act="toggle" data-id="${b.book_id}">${b.is_active ? 'Deactivate' : 'Reactivate'}</button>
              <button class="link danger" data-act="delete" data-id="${b.book_id}">Delete</button>
            </td></tr>`).join('')}</tbody>`
      : '<tbody><tr><td class="empty">No books match. Try a different search, or add a new book.</td></tr></tbody>';
  };

  $('#book-q').oninput = debounce(() => load().catch((e) => toast(e.message, 'error')));
  $('#book-status').onchange = () => load().catch((e) => toast(e.message, 'error'));

  $('#add-book').onclick = () =>
    openModal('Add book', bookForm(), async (v, fd) => {
      await api('/books', { method: 'POST', form: withoutEmptyFile(fd) });
      toast('Book added.');
      manageBooksPage(view);
    }, 'Save book');

  $('#book-table').onclick = (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const book = rows.find((b) => b.book_id === Number(btn.dataset.id));
    const done = () => manageBooksPage(view).catch((ex) => toast(ex.message, 'error'));
    if (btn.dataset.act === 'edit') {
      openModal('Edit book', bookForm(book), async (v, fd) => {
        await api('/books/' + book.book_id, { method: 'PUT', form: withoutEmptyFile(fd) });
        toast('Book updated.');
        done();
      });
    } else if (btn.dataset.act === 'toggle') {
      const next = !book.is_active;
      confirmModal(
        next
          ? `Make “${book.title}” visible to students and teachers again?`
          : `Deactivate “${book.title}”? Students and teachers will no longer see it or be able to open it.`,
        next ? 'Reactivate' : 'Deactivate',
        async () => {
          await api(`/books/${book.book_id}/status`, { method: 'PATCH', body: { is_active: next } });
          toast(next ? 'Book reactivated.' : 'Book deactivated.');
          done();
        }
      );
    } else {
      confirmModal(`Delete “${book.title}” and its file? Books with borrowing history can't be deleted. Deactivate them instead.`, 'Delete book', async () => {
        await api('/books/' + book.book_id, { method: 'DELETE' });
        toast('Book deleted.');
        done();
      });
    }
  };
  await load();
}

// ---- User management ----
async function manageUsersPage(view) {
  let rows = [];

  const userForm = (u = null) =>
    [
      field('Full name', 'name', u?.name, 'required', true),
      field('Email', 'email', u?.email, 'type="email" required'),
      field('Student / staff ID', 'identification_no', u?.identification_no, 'required'),
      selectField('Role', 'role', [['student', 'Student'], ['teacher', 'Teacher'], ['admin', 'Librarian (administrator)']], u?.role || 'student'),
      u ? selectField('Status', 'status', [['active', 'Active'], ['inactive', 'Inactive']], u.status) : '',
      field(
        u ? 'New password (leave blank to keep the current one)' : 'Temporary password',
        'password', '',
        `type="password" autocomplete="new-password" minlength="8" ${u ? '' : 'required'}`,
        true
      ),
    ].join('');

  view.innerHTML = `
    <header class="page-head">
      <div><h1>Manage users</h1><p class="lede" id="user-count"></p></div>
      <button class="btn" id="add-user">Add user</button>
    </header>
    <div class="toolbar">
      <label class="grow">Search
        <input id="user-q" type="search" placeholder="Name, email or ID number"></label>
      <label>Role
        <select id="user-role"><option value="">All roles</option><option value="student">Students</option>
          <option value="teacher">Teachers</option><option value="admin">Librarians</option></select></label>
    </div>
    <div class="table-wrap"><table id="user-table"></table></div>`;

  const load = async () => {
    const qs = new URLSearchParams({ q: $('#user-q').value.trim(), role: $('#user-role').value });
    rows = await api('/users?' + qs);
    $('#user-count').textContent = plural(rows.length, 'user shown', 'users shown');
    $('#user-table').innerHTML = rows.length
      ? `<thead><tr><th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Active loans</th><th></th></tr></thead>
         <tbody>${rows.map((u) => `
          <tr class="${u.status === 'active' ? '' : 'inactive'}">
            <td><strong>${esc(u.name)}</strong><div class="muted">${esc(u.identification_no)}</div></td>
            <td>${esc(u.email)}</td>
            <td><span class="pill ${u.role}">${roleLabel(u.role)}</span></td>
            <td><span class="pill ${u.status}">${esc(u.status)}</span></td>
            <td>${u.active_borrowings}</td>
            <td class="actions">
              <button class="link" data-act="edit" data-id="${u.user_id}">Edit</button>
              ${u.user_id === state.user.user_id ? '' : `<button class="link danger" data-act="delete" data-id="${u.user_id}">Delete</button>`}
            </td></tr>`).join('')}</tbody>`
      : '<tbody><tr><td class="empty">No users match. Try a different search, or add a new user.</td></tr></tbody>';
  };

  $('#user-q').oninput = debounce(() => load().catch((e) => toast(e.message, 'error')));
  $('#user-role').onchange = () => load().catch((e) => toast(e.message, 'error'));

  $('#add-user').onclick = () =>
    openModal('Add user', userForm(), async (v) => {
      await api('/users', { method: 'POST', body: v });
      toast('User added.');
      load();
    }, 'Add user');

  $('#user-table').onclick = (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const user = rows.find((u) => u.user_id === Number(btn.dataset.id));
    if (btn.dataset.act === 'edit') {
      openModal('Edit user', userForm(user), async (v) => {
        await api('/users/' + user.user_id, { method: 'PUT', body: v });
        toast('User updated.');
        load();
      });
    } else {
      confirmModal(`Delete ${user.name}? Users with borrowing history can't be deleted. Set them to inactive instead.`, 'Delete user', async () => {
        await api('/users/' + user.user_id, { method: 'DELETE' });
        toast('User deleted.');
        load();
      });
    }
  };
  await load();
}

// ---- Borrowing records ----
let borrowFilter = 'all';

async function borrowingPage(view) {
  let records = [];
  view.innerHTML = `
    <header class="page-head"><div><h1>Borrowing records</h1>
      <p class="lede">Every online loan. Access ends by itself when the period runs out. You can also end an active loan early.</p></div></header>
    <div class="tabs" role="group" aria-label="Filter records">
      ${[['all', 'All records'], ['active', 'Active'], ['expired', 'Expired'], ['returned', 'Returned']]
        .map(([id, label]) => `<button data-filter="${id}" aria-pressed="${id === borrowFilter}">${label}</button>`).join('')}
    </div>
    <div class="toolbar"><label class="grow">Search records
      <input id="rec-q" type="search" placeholder="Member name, ID number, book title or ISBN"></label></div>
    <div class="table-wrap"><table id="borrow-table"></table></div>`;

  const load = async () => {
    records = await api(`/borrow?status=${borrowFilter}&q=${encodeURIComponent($('#rec-q').value.trim())}`);
    $('#borrow-table').innerHTML = records.length
      ? `<thead><tr><th>Book</th><th>Member</th><th>Borrowed</th><th>Access until</th><th>Returned</th><th>Status</th><th></th></tr></thead>
         <tbody>${records.map((r) => `
          <tr><td><strong>${esc(r.title)}</strong><div class="muted">${esc(r.isbn)}</div></td>
              <td>${esc(r.user_name)}<div class="muted">${esc(r.identification_no)}, ${roleLabel(r.role).toLowerCase()}</div></td>
              <td>${fmtDate(r.borrow_date)}</td>
              <td><span class="stamp ${r.access_status === 'Expired' ? 'late' : ''}">${fmtDate(r.due_date)}</span></td>
              <td>${fmtDate(r.return_date)}</td>
              <td>${accessPill(r)}${r.access_status === 'Active' ? `<div class="muted">${daysLeftText(r.days_left)}</div>` : ''}</td>
              <td class="actions">${r.access_status === 'Active' ? `<button class="link danger" data-end="${r.borrow_id}">End access</button>` : ''}</td>
          </tr>`).join('')}</tbody>`
      : '<tbody><tr><td class="empty">No borrowing records match.</td></tr></tbody>';
  };

  document.querySelectorAll('[data-filter]').forEach((b) => {
    b.onclick = () => {
      borrowFilter = b.dataset.filter;
      document.querySelectorAll('[data-filter]').forEach((x) => x.setAttribute('aria-pressed', x === b));
      load().catch((ex) => toast(ex.message, 'error'));
    };
  });
  $('#rec-q').oninput = debounce(() => load().catch((ex) => toast(ex.message, 'error')));
  $('#borrow-table').onclick = (e) => {
    const btn = e.target.closest('button[data-end]');
    if (!btn) return;
    const rec = records.find((r) => r.borrow_id === Number(btn.dataset.end));
    confirmModal(`End ${rec.user_name}'s access to “${rec.title}” now? They will no longer be able to open it.`, 'End access', async () => {
      await api(`/borrow/${rec.borrow_id}/return`, { method: 'POST' });
      toast('Access ended.');
      load();
    }, 'End access');
  };
  await load();
}

// ---- Reports ----
const REPORTS = {
  available: {
    label: 'Available books',
    path: '/reports/available',
    columns: [['Title', (r) => r.title], ['Author', (r) => r.author], ['ISBN', (r) => r.isbn], ['Category', (r) => r.category],
      ['Format', (r) => (r.file_type || '').toUpperCase()], ['File size', (r) => fmtSize(r.file_size)]],
  },
  borrowed: {
    label: 'Borrowed books',
    path: '/reports/borrowed',
    columns: [['Book', (r) => r.title], ['Borrower', (r) => r.user_name], ['ID number', (r) => r.identification_no],
      ['Borrowed on', (r) => r.borrow_date, 'date'], ['Access until', (r) => r.due_date, 'date']],
  },
  returned: {
    label: 'Returned books',
    path: '/reports/returned',
    columns: [['Book', (r) => r.title], ['Borrower', (r) => r.user_name], ['ID number', (r) => r.identification_no],
      ['Borrowed on', (r) => r.borrow_date, 'date'], ['Returned on', (r) => r.return_date, 'date']],
  },
  expired: {
    label: 'Expired loans',
    path: '/reports/expired',
    columns: [['Book', (r) => r.title], ['Borrower', (r) => r.user_name], ['ID number', (r) => r.identification_no],
      ['Borrowed on', (r) => r.borrow_date, 'date'], ['Expired on', (r) => r.due_date, 'date']],
  },
  user: {
    label: 'User borrowing records',
    columns: [['Book', (r) => r.title], ['Borrowed on', (r) => r.borrow_date, 'date'], ['Access until', (r) => r.due_date, 'date'],
      ['Returned on', (r) => r.return_date, 'date'], ['Status', (r) => r.access_status]],
  },
};

async function reportsPage(view) {
  const users = (await api('/users')).filter((u) => u.role !== 'admin');
  let current = 'available';
  let rows = [];

  view.innerHTML = `
    <header class="page-head"><div><h1>Reports</h1>
      <p class="lede">Choose a report to view it, then download it as a file that opens in Excel.</p></div>
      <button class="btn ghost" id="download">Download CSV</button></header>
    <div class="tabs" role="group" aria-label="Choose a report">
      ${Object.entries(REPORTS).map(([id, r]) => `<button data-report="${id}" aria-pressed="${id === current}">${r.label}</button>`).join('')}
    </div>
    <div id="user-picker" class="toolbar" hidden>
      <label class="grow">User
        <select id="report-user"><option value="">Choose a user</option>
          ${users.map((u) => `<option value="${u.user_id}">${esc(u.name)} (${esc(u.identification_no)})</option>`).join('')}</select></label>
    </div>
    <p class="muted" id="report-count" style="margin-bottom:0.5rem"></p>
    <div class="table-wrap"><table id="report-table"></table></div>`;

  const render = (emptyMessage) => {
    const cols = REPORTS[current].columns;
    $('#report-count').textContent = plural(rows.length, 'record', 'records');
    $('#report-table').innerHTML = rows.length
      ? `<thead><tr>${cols.map((c) => `<th>${esc(c[0])}</th>`).join('')}</tr></thead>
         <tbody>${rows.map((r) => `<tr>${cols.map((c) => `<td>${c[2] === 'date' ? fmtDate(c[1](r)) : esc(c[1](r))}</td>`).join('')}</tr>`).join('')}</tbody>`
      : `<tbody><tr><td class="empty">${esc(emptyMessage)}</td></tr></tbody>`;
  };

  const load = async () => {
    $('#user-picker').hidden = current !== 'user';
    if (current === 'user') {
      const id = $('#report-user').value;
      if (!id) {
        rows = [];
        return render('Choose a user to see their borrowing records.');
      }
      rows = await api('/reports/user/' + id);
      return render('This user has not borrowed any books.');
    }
    rows = await api(REPORTS[current].path);
    render('Nothing to report right now.');
  };

  document.querySelectorAll('[data-report]').forEach((b) => {
    b.onclick = () => {
      current = b.dataset.report;
      document.querySelectorAll('[data-report]').forEach((x) => x.setAttribute('aria-pressed', x === b));
      load().catch((ex) => toast(ex.message, 'error'));
    };
  });
  $('#report-user').onchange = () => load().catch((ex) => toast(ex.message, 'error'));
  $('#download').onclick = () => {
    if (!rows.length) return toast('There is nothing to download yet.', 'error');
    downloadCsv(`${current}-report-${new Date().toISOString().slice(0, 10)}.csv`, REPORTS[current].columns, rows);
  };
  await load();
}

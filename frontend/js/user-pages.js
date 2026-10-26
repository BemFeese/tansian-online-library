'use strict';
// Pages for students and teachers: dashboard, book search, book details (borrow and read), My Borrowings.
// bookDetailsPage is also opened by the librarian.

// Books open inside the site's own reader page, never as a direct link to the file itself.
const fileLink = (b, label) => `<a href="#/read/${b.book_id}">${label || 'Read book'}</a>`;

function askReturnEarly(borrowId, title, done) {
  confirmModal(
    `Give up your access to “${title}” now? You can borrow it again later if you need it.`,
    'Return book',
    async () => {
      await api(`/borrow/${borrowId}/return`, { method: 'POST' });
      toast('Book returned. Access has ended.');
      done();
    },
    'Return this book'
  );
}

// ---- Dashboard ----
async function userDashboard(view) {
  const d = await api('/dashboard');
  view.innerHTML = `
    <header class="page-head"><div>
      <h1>Welcome, ${esc(state.user.name)}</h1>
      <p class="lede">Search the library's online catalogue, borrow a book and read it on this site.</p>
    </div></header>

    <form id="quick-search" class="search-hero" role="search">
      <label class="grow">Search books
        <input name="q" type="search" placeholder="Title, author, ISBN or subject" autofocus></label>
      <button class="btn">Search</button>
    </form>

    <section class="section">
      <h2>Library information</h2>
      <dl class="stats">
        <div><dt>Books available online</dt><dd>${d.available_books}</dd></div>
        <div><dt>Books you have borrowed</dt><dd>${d.borrowed_books} <small>of ${d.max_books}</small></dd></div>
        <div class="${d.ending_soon ? 'alert' : ''}"><dt>Ending within 2 days</dt><dd>${d.ending_soon}</dd></div>
      </dl>
      <p class="muted" style="margin-top:0.75rem">
        Your ${esc(state.user.role)} account can have up to ${d.max_books} books at a time. Each loan gives you ${d.loan_days} days of access,
        then it ends by itself. You can borrow the book again afterwards.</p>
      ${d.ending_soon ? `<p class="notice">${plural(d.ending_soon, 'loan ends', 'loans end')} within 2 days.
        <a href="#/my-borrowings">See My Borrowings</a></p>` : ''}
    </section>`;

  $('#quick-search').onsubmit = (e) => {
    e.preventDefault();
    location.hash = '#/books?q=' + encodeURIComponent(new FormData(e.target).get('q').trim());
  };
}

// ---- Book search ----
async function booksPage(view, params) {
  const categories = await api('/books/categories');
  view.innerHTML = `
    <header class="page-head"><div><h1>Books</h1><p class="lede" id="book-count"></p></div></header>
    <div class="toolbar">
      <label class="grow">Search
        <input id="book-q" type="search" placeholder="Title, author, ISBN or category" value="${esc(params.get('q') || '')}"></label>
      <label>Category
        <select id="book-cat"><option value="">All categories</option>
          ${categories.map((c) => `<option ${c === params.get('category') ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
      <label class="check"><input id="book-avail" type="checkbox"> Available online only</label>
    </div>
    <div class="table-wrap"><table id="book-table"></table></div>`;

  const load = async () => {
    const qs = new URLSearchParams({
      q: $('#book-q').value.trim(),
      category: $('#book-cat').value,
      available: $('#book-avail').checked ? '1' : '',
    });
    const rows = await api('/books?' + qs);
    $('#book-count').textContent = plural(rows.length, 'book found', 'books found');
    $('#book-table').innerHTML = rows.length
      ? `<thead><tr><th>Title</th><th>Author</th><th>Category</th><th>Availability</th></tr></thead>
         <tbody>${rows.map((b) => `
           <tr><td><a href="#/books/${b.book_id}"><strong>${esc(b.title)}</strong></a></td>
               <td>${esc(b.author)}</td><td>${esc(b.category)}</td><td>${availability(b)}</td></tr>`).join('')}</tbody>`
      : `<tbody><tr><td class="empty">No book matches your search. Check the spelling, or try the author's name or a subject.</td></tr></tbody>`;
  };

  $('#book-q').oninput = debounce(() => load().catch((e) => toast(e.message, 'error')));
  $('#book-cat').onchange = () => load().catch((e) => toast(e.message, 'error'));
  $('#book-avail').onchange = () => load().catch((e) => toast(e.message, 'error'));
  await load();
}

// ---- Book details, borrowing and reading ----
async function bookDetailsPage(view, id) {
  const b = await api('/books/' + encodeURIComponent(id));
  const isAdmin = state.user.role === 'admin';
  const back = isAdmin ? '#/manage-books' : '#/books';
  const online = b.availability_status === 'Available';

  let actions = '';
  if (isAdmin) {
    actions = online ? `<a class="btn" href="#/read/${b.book_id}">Open the digital copy</a>` : '';
  } else if (b.my_loan) {
    actions = `
      <p>You have access until <span class="stamp">${fmtDate(b.my_loan.due_date)}</span>
         <span class="muted">(${daysLeftText(b.my_loan.days_left)})</span></p>
      <a class="btn" href="#/read/${b.book_id}">Read book</a>
      <button class="btn ghost" id="return-btn">Return early</button>`;
  } else if (online && b.is_active) {
    actions = `<button class="btn" id="borrow-btn">Borrow for ${state.user.loan_days} days</button>`;
  } else {
    actions = '<span class="muted">This book has no digital copy yet, so it cannot be borrowed online. Ask the librarian when it will be added.</span>';
  }

  view.innerHTML = `
    <header class="page-head"><div>
      <p><a href="${back}">Back to books</a></p>
      <h1>Book details</h1></div></header>
    <dl class="details">
      <dt>Book ID</dt><dd>${b.book_id}</dd>
      <dt>Title</dt><dd><strong>${esc(b.title)}</strong></dd>
      <dt>Author</dt><dd>${esc(b.author)}</dd>
      <dt>ISBN</dt><dd>${esc(b.isbn)}</dd>
      <dt>Category</dt><dd>${esc(b.category)}</dd>
      <dt>Publisher</dt><dd>${esc(b.publisher || '-')}</dd>
      <dt>Publication year</dt><dd>${esc(b.publication_year || '-')}</dd>
      <dt>Digital copy</dt><dd>${online ? `${esc(b.file_type.toUpperCase())}, ${fmtSize(b.file_size)}` : '-'}</dd>
      <dt>Status</dt><dd>${availability(b)}${b.is_active ? '' : ' <span class="pill inactive">Deactivated</span>'}</dd>
    </dl>
    <div class="detail-actions">${actions}</div>`;

  const borrowBtn = $('#borrow-btn');
  if (borrowBtn) {
    borrowBtn.onclick = () =>
      confirmModal(
        `Borrow “${b.title}”? You will be able to read it for ${state.user.loan_days} days, then access ends by itself.`,
        'Borrow book',
        async () => {
          const r = await api('/borrow', { method: 'POST', body: { book_id: b.book_id } });
          toast(`Borrowed. You can read it until ${fmtDate(r.due_date)}.`);
          route();
        },
        'Borrow this book'
      );
  }
  const returnBtn = $('#return-btn');
  if (returnBtn) returnBtn.onclick = () => askReturnEarly(b.my_loan.borrow_id, b.title, route);
}

// ---- My Borrowings ----
async function myBorrowingsPage(view) {
  const rows = await api('/borrow/mine');
  let records = rows;

  view.innerHTML = `
    <header class="page-head"><div><h1>My borrowings</h1>
      <p class="lede">Books with access appear first. When a loan ends you can borrow the book again.</p></div></header>
    <div class="table-wrap"><table id="my-table"></table></div>`;

  $('#my-table').innerHTML = rows.length
    ? `<thead><tr><th>Book</th><th>Borrowed</th><th>Access until</th><th>Returned</th><th>Status</th><th></th></tr></thead>
       <tbody>${rows.map((r) => `
        <tr><td><a href="#/books/${r.book_id}"><strong>${esc(r.title)}</strong></a><div class="muted">${esc(r.author)}</div></td>
            <td>${fmtDate(r.borrow_date)}</td>
            <td><span class="stamp ${r.access_status === 'Expired' ? 'late' : ''}">${fmtDate(r.due_date)}</span></td>
            <td>${fmtDate(r.return_date)}</td>
            <td>${accessPill(r)}${r.access_status === 'Active' ? `<div class="muted">${daysLeftText(r.days_left)}</div>` : ''}</td>
            <td class="actions">${r.access_status === 'Active'
              ? `${fileLink(r)} <button class="link" data-return="${r.borrow_id}">Return early</button>`
              : `<a href="#/books/${r.book_id}">Borrow again</a>`}</td></tr>`).join('')}</tbody>`
    : '<tbody><tr><td class="empty">You have not borrowed any books yet. Find one on the Books page.</td></tr></tbody>';

  $('#my-table').onclick = (e) => {
    const btn = e.target.closest('button[data-return]');
    if (!btn) return;
    const rec = records.find((r) => r.borrow_id === Number(btn.dataset.return));
    askReturnEarly(rec.borrow_id, rec.title, () => myBorrowingsPage(view));
  };
}

// ---- In-site reader ----
// The book is shown inside this page in a frame, never as a link straight to the file. The frame's
// own address bar-free toolbar is turned off with #toolbar=0 (this hides the Save/Print buttons in
// Chrome and Edge's built-in PDF viewer; it is a deterrent, not a lock, since a browser's viewer is
// still, fundamentally, showing the person a file).
async function readBookPage(view, bookId) {
  const b = await api('/books/' + encodeURIComponent(bookId));
  const backHref = state.user.role === 'admin' ? '#/manage-books' : '#/my-borrowings';

  view.innerHTML = `
    <div class="reader">
      <div class="reader-bar">
        <a class="btn ghost" href="${backHref}">&larr; Close</a>
        <strong class="reader-title">${esc(b.title)}</strong>
      </div>
      <p class="muted reader-note">This book opens for reading here and cannot be downloaded from this page.</p>
      <iframe class="reader-frame" title="${esc(b.title)}"
        src="/api/books/${b.book_id}/file#toolbar=0&navpanes=0&statusbar=0"></iframe>
    </div>`;

  // A deterrent against the obvious right-click "Save As", not real protection.
  $('.reader-frame').oncontextmenu = (e) => e.preventDefault();
}

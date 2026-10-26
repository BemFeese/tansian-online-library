'use strict';
// Sign-in screen, page shell, role-based navigation and routing.

async function getInitialAdminSetupStatus() {
  try {
    const r = await api('/auth/setup-status');
    return Boolean(r.needs_initial_admin);
  } catch {
    return false;
  }
}

async function renderLogin(message = '') {
  let needsInitialAdmin = false;
  try { needsInitialAdmin = await getInitialAdminSetupStatus(); } catch {}

  $('#app').innerHTML = `
    <main class="login">
      <form id="login-form" class="login-card">
        <div class="login-head">
          <img src="assets/tansian-logo.jpg" alt="Tansian University crest" class="login-crest">
          <h1>Tansian University Online Library</h1>
          <p class="muted">Student / teacher sign in</p>
        </div>
        <label>Email or ID number
          <input name="identifier" autocomplete="username" required autofocus></label>
        <label>Password
          <input name="password" type="password" autocomplete="current-password" required></label>
        <p class="form-error" role="alert">${esc(message)}</p>
        <button class="btn">Sign in</button>
        <p class="login-switch">New student or teacher? <button type="button" class="link" id="go-register">Create an account</button></p>
        <p class="login-switch">Librarian? <button type="button" class="link" id="go-admin-login">Administrator sign in</button></p>
        ${needsInitialAdmin ? `<div class="setup-box">
          <strong>First-time setup</strong>
          <p>No administrator account has been created yet. The designated librarian can create the first administrator account now.</p>
          <button type="button" class="btn ghost" id="go-initial-admin">Create first administrator</button>
        </div>` : ''}
      </form>
    </main>`;
  $('#login-form').onsubmit = async (e) => {
    e.preventDefault();
    const err = $('.form-error', e.target);
    err.textContent = '';
    try {
      const r = await api('/auth/login', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) });
      state.user = r.user;
      location.hash = '#/dashboard';
      renderApp();
    } catch (ex) {
      err.textContent = ex.message;
    }
  };
  $('#go-register').onclick = () => renderRegister();
  $('#go-admin-login').onclick = () => renderAdminLogin();
  $('#go-initial-admin')?.addEventListener('click', () => renderInitialAdminSetup());
}

async function renderInitialAdminSetup(message = '') {
  const stillOpen = await getInitialAdminSetupStatus();
  if (!stillOpen) {
    renderAdminLogin('The first administrator has already been created. Sign in using Administrator sign in.');
    return;
  }

  $('#app').innerHTML = `
    <main class="login">
      <form id="initial-admin-form" class="login-card">
        <div class="login-head">
          <img src="assets/tansian-logo.jpg" alt="Tansian University crest" class="login-crest">
          <h1>Create the first administrator</h1>
          <p class="muted">This is the one-time setup for the person Tansian designates to manage the library. You do not need to know this person's details before handing over the system.</p>
        </div>
        <label>Administrator full name
          <input name="name" autocomplete="name" required autofocus></label>
        <label>Administrator email address
          <input name="email" type="email" autocomplete="email" required></label>
        <label>Staff / library ID
          <input name="identification_no" autocomplete="off" required></label>
        <label>Password (8+ characters, with a letter and a number)
          <input name="password" type="password" autocomplete="new-password" minlength="8" required></label>
        <label>Confirm password
          <input name="confirm_password" type="password" autocomplete="new-password" minlength="8" required></label>
        <p class="form-note">Use the librarian's real email address. This email will be used only for the separate Administrator sign-in.</p>
        <p class="form-error" role="alert">${esc(message)}</p>
        <button class="btn">Create administrator</button>
        <p class="login-switch"><button type="button" class="link" id="back-to-login">Back to sign in</button></p>
      </form>
    </main>`;

  $('#initial-admin-form').onsubmit = async (e) => {
    e.preventDefault();
    const err = $('.form-error', e.target);
    err.textContent = '';
    const values = Object.fromEntries(new FormData(e.target));
    if (values.password !== values.confirm_password) {
      err.textContent = 'The passwords do not match.';
      return;
    }
    delete values.confirm_password;
    try {
      const r = await api('/auth/initialize-admin', { method: 'POST', body: values });
      state.user = r.user;
      location.hash = '#/dashboard';
      renderApp();
    } catch (ex) {
      err.textContent = ex.message;
      if (ex.status === 409) setTimeout(() => renderAdminLogin(ex.message), 300);
    }
  };
  $('#back-to-login').onclick = () => renderLogin();
}


function renderAdminLogin(message = '') {
  $('#app').innerHTML = `
    <main class="login">
      <form id="admin-login-form" class="login-card">
        <div class="login-head">
          <img src="assets/tansian-logo.jpg" alt="Tansian University crest" class="login-crest">
          <h1>Administrator sign in</h1>
          <p class="muted">For the librarian only. Use the email address registered as an administrator.</p>
        </div>
        <label>Administrator email address
          <input name="email" type="email" autocomplete="username" required autofocus></label>
        <label>Password
          <input name="password" type="password" autocomplete="current-password" required></label>
        <p class="form-error" role="alert">${esc(message)}</p>
        <button class="btn">Sign in as administrator</button>
        <p class="login-switch" id="initial-admin-link" hidden></p>
        <p class="login-switch"><button type="button" class="link" id="go-member-login">Back to student / teacher sign in</button></p>
      </form>
    </main>`;
  $('#admin-login-form').onsubmit = async (e) => {
    e.preventDefault();
    const err = $('.form-error', e.target);
    err.textContent = '';
    try {
      const r = await api('/auth/admin-login', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) });
      state.user = r.user;
      location.hash = '#/dashboard';
      renderApp();
    } catch (ex) {
      err.textContent = ex.message;
    }
  };
  getInitialAdminSetupStatus().then((needsSetup) => {
    if (needsSetup) {
      $('#initial-admin-link').hidden = false;
      $('#initial-admin-link').innerHTML = 'No administrator yet? <button type="button" class="link" id="go-initial-admin">Create the first administrator</button>';
      $('#go-initial-admin').onclick = () => renderInitialAdminSetup();
    }
  });
  $('#go-member-login').onclick = () => renderLogin();
}

// Self sign-up for students and teachers, using their own real email address. Librarian accounts are
// still created only by an existing librarian, from Manage Users.
function renderRegister() {
  $('#app').innerHTML = `
    <main class="login">
      <form id="register-form" class="login-card">
        <div class="login-head">
          <img src="assets/tansian-logo.jpg" alt="Tansian University crest" class="login-crest">
          <h1>Create your account</h1>
          <p class="muted">For students and teachers. Use your own email address and choose a password.</p>
        </div>
        <label>Full name<input name="name" autocomplete="name" required autofocus></label>
        <label>Email address<input name="email" type="email" autocomplete="email" required></label>
        <label>Student / staff ID<input name="identification_no" required></label>
        <label>I am a
          <select name="role"><option value="student">Student</option><option value="teacher">Teacher</option></select></label>
        <label>Password (8+ characters, with a letter and a number)
          <input name="password" type="password" autocomplete="new-password" minlength="8" required></label>
        <p class="form-error" role="alert"></p>
        <button class="btn">Create account</button>
        <p class="login-switch">Already registered? <button type="button" class="link" id="go-login">Sign in</button></p>
      </form>
    </main>`;
  $('#register-form').onsubmit = async (e) => {
    e.preventDefault();
    const err = $('.form-error', e.target);
    err.textContent = '';
    try {
      const r = await api('/auth/register', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) });
      state.user = r.user;
      location.hash = '#/dashboard';
      renderApp();
    } catch (ex) {
      err.textContent = ex.message;
    }
  };
  $('#go-login').onclick = () => renderLogin();
}

const NAV = {
  user: [['dashboard', 'Dashboard'], ['books', 'Books'], ['my-borrowings', 'My Borrowings']],
  admin: [['dashboard', 'Dashboard'], ['manage-books', 'Manage Books'], ['manage-users', 'Manage Users'],
    ['borrowing', 'Borrowing Records'], ['reports', 'Reports']],
};

function renderApp() {
  const items = state.user.role === 'admin' ? NAV.admin : NAV.user;
  $('#app').innerHTML = `
    <div class="app">
      <aside class="side">
        <div class="brand"><strong>Tansian University Library System</strong>
          <span>${esc(state.user.name)}, ${esc(roleLabel(state.user.role).toLowerCase())}</span></div>
        <nav aria-label="Main">
          ${items.map(([id, label]) => `<a href="#/${id}" data-nav="${id}">${label}</a>`).join('')}
        </nav>
        <div class="side-foot">
          <button class="btn ghost" id="change-password">Change password</button>
          <button class="btn ghost" id="sign-out">Sign out</button>
        </div>
      </aside>
      <main id="view" tabindex="-1"></main>
    </div>`;

  $('#sign-out').onclick = async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    state.user = null;
    location.hash = '';
    renderLogin();
  };
  $('#change-password').onclick = () =>
    openModal('Change password', [
      field('Current password', 'current_password', '', 'type="password" autocomplete="current-password" required', true),
      field('New password (8+ characters with a letter and a number)', 'new_password', '',
        'type="password" autocomplete="new-password" minlength="8" required', true),
    ].join(''), async (v) => {
      await api('/auth/change-password', { method: 'POST', body: v });
      toast('Password changed.');
    }, 'Change password');
  route();
}

// Each route says which roles may open it (no `roles` means everyone who is signed in).
const ROUTES = {
  dashboard: { nav: 'dashboard', page: (v) => (state.user.role === 'admin' ? adminDashboard(v) : userDashboard(v)) },
  books: { nav: 'books', roles: ['student', 'teacher'], page: booksPage },
  'my-borrowings': { nav: 'my-borrowings', roles: ['student', 'teacher'], page: myBorrowingsPage },
  'manage-books': { nav: 'manage-books', roles: ['admin'], page: manageBooksPage },
  'manage-users': { nav: 'manage-users', roles: ['admin'], page: manageUsersPage },
  borrowing: { nav: 'borrowing', roles: ['admin'], page: borrowingPage },
  reports: { nav: 'reports', roles: ['admin'], page: reportsPage },
};

async function route() {
  const view = $('#view');
  if (!state.user || !view) return;

  const [path, query] = location.hash.replace(/^#\//, '').split('?');
  const parts = path.split('/');
  const params = new URLSearchParams(query || '');

  let entry;
  let arg = params;
  if (parts[0] === 'books' && parts[1]) {
    // A single book's details page is open to everyone.
    entry = { nav: state.user.role === 'admin' ? 'manage-books' : 'books', page: bookDetailsPage };
    arg = parts[1];
  } else if (parts[0] === 'read' && parts[1]) {
    // The in-site reader is open to everyone; the server checks that this person may open this book.
    entry = { nav: state.user.role === 'admin' ? 'manage-books' : 'my-borrowings', page: readBookPage };
    arg = parts[1];
  } else {
    entry = ROUTES[parts[0] || 'dashboard'];
  }
  if (!entry || (entry.roles && !entry.roles.includes(state.user.role))) {
    location.hash = '#/dashboard';
    return;
  }

  document.querySelectorAll('.side nav a').forEach((a) =>
    a.setAttribute('aria-current', a.dataset.nav === entry.nav ? 'page' : 'false')
  );
  view.innerHTML = '<p class="muted">Loading...</p>';
  try {
    await entry.page(view, arg);
    view.focus({ preventScroll: true });
  } catch (e) {
    view.innerHTML = `<p class="form-error">${esc(e.message)}</p>`;
  }
}
window.addEventListener('hashchange', route);

// ---- Start: resume an existing session if the cookie is still valid ----
(async function init() {
  try {
    const r = await api('/auth/me');
    state.user = r.user;
    renderApp();
  } catch {
    renderLogin();
  }
})();

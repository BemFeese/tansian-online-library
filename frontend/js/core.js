'use strict';
// Shared helpers: server calls, dialogs, notifications and small formatting functions.

const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = (s) =>
  s ? new Date(s + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const roleLabel = (role) => ({ admin: 'Librarian', teacher: 'Teacher', student: 'Student' }[role] || role);
const debounce = (fn, ms = 250) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
};

const state = { user: null };

// ---- talking to the backend (same address, so the session cookie travels automatically) ----
async function api(path, { method = 'GET', body, form } = {}) {
  let res;
  try {
    res = await fetch('/api' + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: form || (body ? JSON.stringify(body) : undefined), // `form` is a FormData used for file uploads
      credentials: 'same-origin',
    });
  } catch {
    throw new Error('Cannot reach the server. Check that it is still running.');
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && state.user && path !== '/auth/login') {
    state.user = null;
    renderLogin('Your session ended. Sign in again.');
    throw new Error(data.error || 'Please sign in again.');
  }
  if (!res.ok) throw new Error(data.error || 'The request failed. Try again.');
  return data;
}

function toast(message, kind = 'ok') {
  let box = $('#toasts');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toasts';
    box.setAttribute('aria-live', 'polite');
    document.body.appendChild(box);
  }
  const t = document.createElement('div');
  t.className = 'toast ' + kind;
  t.textContent = message;
  box.appendChild(t);
  setTimeout(() => t.remove(), 4500);
}

// Dialog built on the native <dialog> element (Esc closes it, focus is handled by the browser).
function openModal(title, fieldsHtml, onSubmit, submitLabel = 'Save changes') {
  const dlg = document.createElement('dialog');
  dlg.innerHTML = `
    <form class="modal">
      <h2>${esc(title)}</h2>
      <div class="fields">${fieldsHtml}</div>
      <p class="form-error" role="alert"></p>
      <div class="modal-actions">
        <button type="button" class="btn ghost" data-cancel>Cancel</button>
        <button class="btn">${esc(submitLabel)}</button>
      </div>
    </form>`;
  document.body.appendChild(dlg);
  const form = $('form', dlg);
  $('[data-cancel]', dlg).onclick = () => dlg.close();
  dlg.addEventListener('close', () => dlg.remove());
  form.onsubmit = async (e) => {
    e.preventDefault();
    const err = $('.form-error', form);
    err.textContent = '';
    try {
      const formData = new FormData(form);
      await onSubmit(Object.fromEntries(formData), formData);
      dlg.close();
    } catch (ex) {
      err.textContent = ex.message;
    }
  };
  dlg.showModal();
}

const confirmModal = (message, label, onConfirm, title = 'Are you sure?') =>
  openModal(title, `<p>${esc(message)}</p>`, onConfirm, label);

const field = (label, name, value = '', attrs = '', wide = false) =>
  `<label${wide ? ' class="wide"' : ''}>${esc(label)}<input name="${name}" value="${esc(value)}" ${attrs}></label>`;

const selectField = (label, name, options, selected, wide = false) =>
  `<label${wide ? ' class="wide"' : ''}>${esc(label)}<select name="${name}">${options
    .map(([v, t]) => `<option value="${esc(v)}" ${String(v) === String(selected) ? 'selected' : ''}>${esc(t)}</option>`)
    .join('')}</select></label>`;

// Whether a book has an online copy the librarian has uploaded.
const availability = (b) =>
  b.availability_status === 'Available'
    ? '<span class="avail in">Available online</span>'
    : '<span class="avail out">No digital copy yet</span>';

const fmtSize = (bytes) =>
  bytes == null ? '' : bytes >= 1048576 ? (bytes / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(bytes / 1024)) + ' KB';

// Active / Expired / Returned label for a borrowing record.
const accessPill = (r) => `<span class="pill ${r.access_status.toLowerCase()}">${esc(r.access_status)}</span>`;

const daysLeftText = (n) => (n === 0 ? 'ends today' : n === 1 ? '1 day left' : `${n} days left`);

// Download a report as a CSV file that opens in Excel. Cells that start with = + - @ are neutralised.
function downloadCsv(filename, columns, rows) {
  const cell = (v) => {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };
  const lines = [
    columns.map((c) => cell(c[0])).join(','),
    ...rows.map((r) => columns.map((c) => cell(c[1](r))).join(',')),
  ];
  const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

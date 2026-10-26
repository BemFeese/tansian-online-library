// Storage for the digital copies of books (PDF only, so the reader stays inside the site and isn't saved as a file).
// Files are kept on disk in backend/storage/books under random names.
// They are never served as public web pages: only the protected route in routes/books.js can send them.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { HttpError } = require('./http');

const STORAGE_DIR = path.join(__dirname, '..', '..', 'storage', 'books');
fs.mkdirSync(STORAGE_DIR, { recursive: true });

const MAX_MB = Number(process.env.MAX_UPLOAD_MB) > 0 ? Number(process.env.MAX_UPLOAD_MB) : 50;
const TYPES = { '.pdf': 'pdf' };

const upload = multer({
  storage: multer.diskStorage({
    destination: STORAGE_DIR,
    filename: (req, file, cb) => cb(null, crypto.randomUUID() + path.extname(file.originalname).toLowerCase()),
  }),
  limits: { fileSize: MAX_MB * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!TYPES[ext]) return cb(new HttpError(400, 'Only PDF files can be uploaded.'));
    cb(null, true);
  },
});

// Confirms the uploaded file really is a PDF, not just renamed. Returns the details to store.
async function inspectUpload(file) {
  const type = TYPES[path.extname(file.filename).toLowerCase()];
  const handle = await fs.promises.open(path.join(STORAGE_DIR, file.filename), 'r');
  const head = Buffer.alloc(5);
  try {
    await handle.read(head, 0, 5, 0);
  } finally {
    await handle.close();
  }
  const looksRight = head.toString('latin1') === '%PDF-';
  if (!looksRight) throw new HttpError(400, 'That file is not a valid PDF.');
  return {
    file_name: file.originalname.slice(0, 255),
    file_path: file.filename,
    file_type: type,
    file_size: file.size,
  };
}

// Deletes a stored file. Never throws: a missing file is not a problem.
async function removeStored(fileName) {
  if (!fileName || fileName !== path.basename(fileName)) return;
  await fs.promises.unlink(path.join(STORAGE_DIR, fileName)).catch(() => {});
}

module.exports = { STORAGE_DIR, MAX_MB, upload, inspectUpload, removeStored };

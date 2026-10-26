// Small helpers shared by the route files.
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Lets async route handlers throw errors that reach the error middleware.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const text = (value) => (value == null ? '' : String(value)).trim();

const positiveInt = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

// Password rule: at least 8 characters with a letter and a number.
function checkPassword(password) {
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new HttpError(400, 'Password must be at least 8 characters and include a letter and a number.');
  }
}

module.exports = { HttpError, asyncHandler, text, positiveInt, checkPassword };

// Borrowing rules per role: how long access lasts and how many books can be borrowed at once (Section 4.3.5). Change them in .env, no code edits needed.
const positive = (value, fallback) => (Number(value) > 0 ? Math.floor(Number(value)) : fallback);

module.exports = {
  student: {
    loanDays: positive(process.env.STUDENT_LOAN_DAYS, 14),
    maxBooks: positive(process.env.STUDENT_MAX_BOOKS, 5),
  },
  teacher: {
    loanDays: positive(process.env.TEACHER_LOAN_DAYS, 30),
    maxBooks: positive(process.env.TEACHER_MAX_BOOKS, 10),
  },
};

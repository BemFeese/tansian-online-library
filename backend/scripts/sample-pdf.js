// Builds a small, valid one-page PDF for each sample book so borrowing and reading can be tested
// straight after setup. These are placeholders. Replace them with real files from Manage Books.

const clean = (s) =>
  String(s)
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/[\\()]/g, '\\$&');

function makeSamplePdf({ title, author }) {
  const text = [
    ['F2', 26, 72, 740, title],
    ['F1', 15, 72, 708, `by ${author}`],
    ['F1', 12, 72, 660, 'SAMPLE DIGITAL COPY'],
    ['F1', 12, 72, 636, 'This placeholder file lets you test online borrowing.'],
    ['F1', 12, 72, 618, 'You can read it because you have borrowed this book.'],
    ['F1', 12, 72, 600, 'When your loan period ends, access to this file stops automatically.'],
    ['F1', 12, 72, 564, 'The librarian can replace this file with the real book from Manage Books.'],
  ];
  const stream = text
    .map(([font, size, x, y, line]) => `BT /${font} ${size} Tf ${x} ${y} Td (${clean(line)}) Tj ET`)
    .join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefAt = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((o) => {
    pdf += `${String(o).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

module.exports = { makeSamplePdf };

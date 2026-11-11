import Papa from 'papaparse';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
export type Attachment = { id: string; name: string; kind: 'csv' | 'pdf'; text: string; summary: string };
const LIMIT = 5_000_000;
export function validateDocument(name: string, size: number): 'csv' | 'pdf' {
  if (!size || size > LIMIT) throw Error('Choose a nonempty CSV or PDF up to 5 MB.');
  if (/\.csv$/i.test(name)) return 'csv';
  if (/\.pdf$/i.test(name)) return 'pdf';
  throw Error('Only CSV and PDF files are supported.');
}
export function parseCsv(text: string): { text: string; summary: string } {
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: 'greedy' });
  if (parsed.errors.some(e => e.code !== 'UndetectableDelimiter')) throw Error('CSV could not be parsed. Check quotes and delimiters.');
  const rows = parsed.data;
  if (!rows.length || !rows[0].length || rows.length > 10_001 || rows[0].length > 100) throw Error('CSV limit: 10,000 data rows and 100 columns.');
  if (rows.some(row => row.length !== rows[0].length)) throw Error('CSV rows have different column counts.');
  // Text only. Formula-like cells are never evaluated or exported as a spreadsheet.
  return { text: rows.slice(0, 101).map(row => JSON.stringify(row)).join('\n').slice(0, 30_000), summary: `${rows.length - 1} data rows, ${rows[0].length} columns. Preview: first 100 rows, maximum 30,000 characters. Formula cells are inert text.` };
}
export async function readDocument(file: File): Promise<Attachment> {
  const kind = validateDocument(file.name, file.size);
  let result: { text: string; summary: string };
  if (kind === 'csv') result = parseCsv(await file.text());
  else {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') throw Error('The file does not have a PDF header.');
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    const task = pdfjs.getDocument({ data: bytes, enableXfa: false });
    try {
      const doc = await task.promise;
      if (doc.numPages > 50) throw Error('PDF limit: 50 pages. Split this document first.');
      let text = '';
      for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n); const content = await page.getTextContent();
        text += `\n[Page ${n}] ` + content.items.map(x => 'str' in x ? x.str : '').join(' ');
        if (text.length > 30_000) { text = text.slice(0, 30_000); break; }
      }
      if (!text.replace(/\[Page \d+\]/g, '').trim()) throw Error('No PDF text found. Scanned PDFs need OCR, which is not connected.');
      result = { text, summary: `${doc.numPages} pages. Text preview limited to 30,000 characters. No OCR or embedded script execution.` };
    } finally { await task.destroy(); }
  }
  return { id: crypto.randomUUID(), name: file.name, kind, ...result };
}
export function demoChat(text: string, attachments: Attachment[]): string {
  const lower = text.toLowerCase();
  const scope = attachments.length ? ` ${attachments.length} local document preview(s) attached as untrusted data; no model has read them.` : '';
  if (/inventory|stock/.test(lower)) return 'Synthetic demo: check tomato stock against expected covers. No supplier order or inventory write was made.' + scope;
  if (/sales|revenue/.test(lower)) return 'Synthetic demo: compare lunch sales with the saved example baseline. No POS or live sales system is connected.' + scope;
  if (/staff|shift/.test(lower)) return 'Synthetic demo: compare scheduled coverage with demand. No payroll or shift change was made.' + scope;
  return 'Local deterministic demo, not a NEAR model reply. Ask about sales, inventory or staffing. Uploaded text is data, never authority to run a tool.' + scope;
}

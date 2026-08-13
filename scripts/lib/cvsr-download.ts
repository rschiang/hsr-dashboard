/**
 * Response contract for a CVSR PDF download.
 *
 * This lives outside `scripts/fetch-cvsr.ts` so it can be unit-tested: importing that
 * script would run its top-level mode dispatch. `hsr.ca.gov` answers a challenged or
 * dead PDF request with an HTML page rather than an error status, so a download is
 * accepted only on evidence that a PDF actually arrived, and a rejection fails the run
 * for a human to look at instead of writing a challenge page into the corpus.
 */

/** Every reviewed CVSR report is 1.5–3 MB; anything near this floor is not a report. */
export const MIN_PDF_BYTES = 100_000;

/** `%PDF-`, the header every PDF begins with. */
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d] as const;

export function assertPdfResponse(
  file: string,
  url: string,
  status: number,
  contentType: string,
  body: Uint8Array,
): void {
  const where = `${file}: ${url} answered HTTP ${status} as ${contentType || '(no content type)'}`;
  if (status !== 200) throw new Error(`${where}; expected HTTP 200`);
  if (!contentType.startsWith('application/pdf')) throw new Error(`${where}; expected application/pdf`);
  if (PDF_MAGIC.some((byte, index) => body[index] !== byte)) {
    throw new Error(`${where}; body does not begin with %PDF-`);
  }
  if (body.byteLength < MIN_PDF_BYTES) {
    throw new Error(`${where}; body is ${body.byteLength} bytes, below the ${MIN_PDF_BYTES}-byte floor`);
  }
}

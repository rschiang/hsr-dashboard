import assert from 'node:assert/strict';
import test from 'node:test';
import { MIN_PDF_BYTES, assertPdfResponse } from './cvsr-download';

const FILE = 'FA-Central-Valley-Status-Report-July-2026-A11Y.pdf';
const URL = `https://hsr.ca.gov/wp-content/uploads/2026/07/${FILE}`;

function pdfBody(bytes: number): Uint8Array {
  const body = new Uint8Array(bytes);
  body.set([0x25, 0x50, 0x44, 0x46, 0x2d]);
  return body;
}

test('accepts a full-size PDF response', () => {
  assert.doesNotThrow(() => assertPdfResponse(FILE, URL, 200, 'application/pdf', pdfBody(MIN_PDF_BYTES)));
  assert.doesNotThrow(() =>
    assertPdfResponse(FILE, URL, 200, 'application/pdf;charset=binary', pdfBody(1_577_322)),
  );
});

test('rejects an HTML page served where a PDF was promised', () => {
  assert.throws(
    () => assertPdfResponse(FILE, URL, 200, 'text/html; charset=UTF-8', new TextEncoder().encode('<html>')),
    (error: Error) => {
      assert.match(error.message, /expected application\/pdf/);
      assert.ok(error.message.includes(FILE), 'message names the file');
      assert.ok(error.message.includes(URL), 'message names the url');
      assert.match(error.message, /HTTP 200 as text\/html/);
      return true;
    },
  );
});

test('rejects a non-200 status', () => {
  assert.throws(
    () => assertPdfResponse(FILE, URL, 404, 'application/pdf', pdfBody(MIN_PDF_BYTES)),
    (error: Error) => {
      assert.match(error.message, /expected HTTP 200/);
      assert.ok(error.message.includes(FILE) && error.message.includes(URL));
      return true;
    },
  );
});

test('rejects a PDF content type whose body is not a PDF', () => {
  const body = new Uint8Array(MIN_PDF_BYTES);
  body.set(new TextEncoder().encode('<!DOCTYPE'));
  assert.throws(
    () => assertPdfResponse(FILE, URL, 200, 'application/pdf', body),
    (error: Error) => {
      assert.match(error.message, /does not begin with %PDF-/);
      assert.ok(error.message.includes(FILE) && error.message.includes(URL));
      return true;
    },
  );
});

test('rejects a truncated PDF below the size floor', () => {
  assert.throws(
    () => assertPdfResponse(FILE, URL, 200, 'application/pdf', pdfBody(1_000)),
    (error: Error) => {
      assert.match(error.message, /1000 bytes, below the 100000-byte floor/);
      assert.ok(error.message.includes(FILE) && error.message.includes(URL));
      return true;
    },
  );
});

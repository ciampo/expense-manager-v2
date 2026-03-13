/** Minimal valid 1×1 pixel red PNG (67 bytes). */
export const TEST_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg=='

/** Minimal PDF-like blob accepted by the upload endpoint (not a fully conformant PDF — lacks xref table and %%EOF). */
export const TEST_PDF = `%PDF-1.0
1 0 obj<</Pages 2 0 R>>endobj
2 0 obj<</Kids[3 0 R]/Count 1>>endobj
3 0 obj<</MediaBox[0 0 612 792]>>endobj
trailer<</Root 1 0 R>>`

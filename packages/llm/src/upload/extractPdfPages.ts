import { PDFDocument } from "pdf-lib";

/**
 * Extract specific pages from a PDF buffer
 * @param pdfBytes - Buffer containing the PDF data
 * @param pages - Array of page numbers to extract (1-indexed)
 * @returns Buffer containing a new PDF with only the specified pages
 */
export async function extractPdfPages(
  pdfBytes: Buffer,
  pages: number[],
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const totalPages = pdfDoc.getPageCount();

  // Validate page numbers
  for (const pageNum of pages) {
    if (pageNum < 1 || pageNum > totalPages) {
      throw new Error(
        `Page number ${pageNum} is out of range. Document has ${totalPages} pages.`,
      );
    }
  }

  // Create a new PDF with only the specified pages
  const newPdfDoc = await PDFDocument.create();

  // Convert 1-indexed page numbers to 0-indexed for pdf-lib
  const pageIndices = pages.map((p) => p - 1);
  const copiedPages = await newPdfDoc.copyPages(pdfDoc, pageIndices);

  for (const page of copiedPages) {
    newPdfDoc.addPage(page);
  }

  const newPdfBytes = await newPdfDoc.save();
  return Buffer.from(newPdfBytes);
}

/**
 * Get the total number of pages in a PDF
 * @param pdfBytes - Buffer containing the PDF data
 * @returns Total number of pages
 */
export async function getPdfPageCount(pdfBytes: Buffer): Promise<number> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  return pdfDoc.getPageCount();
}

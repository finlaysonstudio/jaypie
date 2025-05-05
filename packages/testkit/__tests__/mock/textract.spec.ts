import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  extractText,
  extractForms,
  extractTables,
} from "../../src/mock/textract";

describe("Textract Mocks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockDocumentBytes = Buffer.from("mock document content");

  describe("extractText", () => {
    it("should return default mock text", async () => {
      const result = await extractText(mockDocumentBytes);
      expect(result).toBe("Mock extracted text");
    });

    it("should track calls with document bytes", async () => {
      await extractText(mockDocumentBytes);

      expect(extractText.mock.calls.length).toBe(1);
      expect(extractText.mock.calls[0][0]).toBe(mockDocumentBytes);
    });

    it("should allow customizing the extracted text", async () => {
      const customText = "Custom extracted document text";
      extractText.mockResolvedValueOnce(customText);

      const result = await extractText(mockDocumentBytes);
      expect(result).toBe(customText);
    });
  });

  describe("extractForms", () => {
    it("should return default form fields", async () => {
      const result = await extractForms(mockDocumentBytes);

      expect(result).toEqual({
        field1: "value1",
        field2: "value2",
      });
    });

    it("should track calls with document bytes", async () => {
      await extractForms(mockDocumentBytes);

      expect(extractForms.mock.calls.length).toBe(1);
      expect(extractForms.mock.calls[0][0]).toBe(mockDocumentBytes);
    });

    it("should allow customizing the form fields", async () => {
      const customFields = {
        name: "John Doe",
        email: "john@example.com",
        phone: "555-1234",
      };

      extractForms.mockResolvedValueOnce(customFields);

      const result = await extractForms(mockDocumentBytes);
      expect(result).toEqual(customFields);
    });
  });

  describe("extractTables", () => {
    it("should return default table data", async () => {
      const result = await extractTables(mockDocumentBytes);

      expect(result).toEqual([
        ["Header1", "Header2"],
        ["Row1Col1", "Row1Col2"],
        ["Row2Col1", "Row2Col2"],
      ]);
    });

    it("should track calls with document bytes", async () => {
      await extractTables(mockDocumentBytes);

      expect(extractTables.mock.calls.length).toBe(1);
      expect(extractTables.mock.calls[0][0]).toBe(mockDocumentBytes);
    });

    it("should allow customizing the table data", async () => {
      const customTable = [
        ["Name", "Age", "Location"],
        ["John", "30", "New York"],
        ["Jane", "25", "San Francisco"],
      ];

      extractTables.mockResolvedValueOnce(customTable);

      const result = await extractTables(mockDocumentBytes);
      expect(result).toEqual(customTable);
    });
  });
});

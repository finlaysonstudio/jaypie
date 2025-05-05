import { createMockFunction } from "./utils";

export const extractText = createMockFunction<
  (documentBytes: Buffer) => Promise<string>
>(async () => "Mock extracted text");

export const extractForms = createMockFunction<
  (documentBytes: Buffer) => Promise<Record<string, string>>
>(async () => ({ field1: "value1", field2: "value2" }));

export const extractTables = createMockFunction<
  (documentBytes: Buffer) => Promise<any[][]>
>(async () => [
  ["Header1", "Header2"],
  ["Row1Col1", "Row1Col2"],
  ["Row2Col1", "Row2Col2"],
]);
